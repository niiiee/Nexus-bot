import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { leadCrypto } from './leadCrypto.js';
import { leadRulesGuard } from './leadRulesGuard.js';

export interface PurgeResult {
  purgedStagingCount: number;
  purgedArtifactsCount: number;
  purgedRegistryCount: number;
  verifiedClean: boolean;
  leftoverCount: number;
  timestamp: number;
}

export interface DeletionRequestResult {
  success: boolean;
  purgedStaging: boolean;
  purgedRegistry: boolean;
  confirmationMessage: string;
  language: 'en' | 'ar';
}

export class LeadPurgeEngine {
  private timer: NodeJS.Timeout | null = null;

  /**
   * Start automated background purge job (runs hourly by default)
   */
  public startScheduledPurge(intervalMs: number = 3600000): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    logger.info(`[LeadPurgeEngine] Starting automated purge job (interval: ${intervalMs}ms)`);
    this.timer = setInterval(() => {
      this.executePurge().catch((err) => {
        logger.error('[LeadPurgeEngine] Scheduled purge run failed:', err);
      });
    }, intervalMs);

    // Unref timer so it doesn't prevent process exit in test environments
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public stopScheduledPurge(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[LeadPurgeEngine] Scheduled purge job stopped.');
    }
  }

  /**
   * REQ-22.5.1, REQ-22.5.2 & REQ-22.9.3: Execute purge and run zero-leftover verification scan
   */
  public async executePurge(currentTime: number = Date.now()): Promise<PurgeResult> {
    const sevenDaysAgo = currentTime - 7 * 24 * 60 * 60 * 1000;

    try {
      // 1. Find all candidate records for staging purge
      // - Expired TTL
      // - Declined > 7 days ago
      // - Deleted on user request
      const candidateLeads = dbService.all<{ id: string; psid_hash: string; state: string }>(
        `SELECT id, psid_hash, state FROM lead_staging
         WHERE expires_at <= ?
            OR (state = 'DECLINED' AND declined_at IS NOT NULL AND declined_at <= ?)
            OR state = 'DELETED_ON_REQUEST'`,
        currentTime,
        sevenDaysAgo
      );

      const candidateIds = candidateLeads.map((l) => l.id);
      let purgedArtifactsCount = 0;

      if (candidateIds.length > 0) {
        // Execute purge in transaction
        dbService.transaction(() => {
          for (const lead of candidateLeads) {
            // Delete derived artifacts
            const artifactRes = dbService.run(
              `DELETE FROM lead_derived_artifacts WHERE lead_id = ?`,
              lead.id
            );
            purgedArtifactsCount += Number(artifactRes.changes);

            // Hard delete staging record
            dbService.run(`DELETE FROM lead_staging WHERE id = ?`, lead.id);

            // Audit log (Content-free, hash only - REQ-22.5.4)
            this.logPurgeAudit(lead.psid_hash, 'PURGED_LIFECYCLE', {
              leadId: lead.id,
              state: lead.state,
              timestamp: currentTime,
            });
          }
        });
      }

      // 2. Also check for expired client registry records (REQ-22.4.4)
      const expiredClients = dbService.all<{ id: string; client_psid_hash: string }>(
        `SELECT id, client_psid_hash FROM client_registry WHERE retention_expires_at <= ?`,
        currentTime
      );

      let purgedRegistryCount = 0;
      if (expiredClients.length > 0) {
        dbService.transaction(() => {
          for (const client of expiredClients) {
            dbService.run(`DELETE FROM client_registry WHERE id = ?`, client.id);
            purgedRegistryCount++;

            this.logPurgeAudit(client.client_psid_hash, 'PURGED_REGISTRY_RETENTION', {
              clientId: client.id,
              timestamp: currentTime,
            });
          }
        });
      }

      // 3. REQ-22.5.2 & REQ-22.9.3: Deletion Verifier & Zero-Leftover Assertion
      const leftoverCheck = this.verifyZeroLeftovers(candidateIds);

      logger.info(
        `[LeadPurgeEngine] Purge completed. Staging purged: ${candidateIds.length}, Artifacts: ${purgedArtifactsCount}, Registry: ${purgedRegistryCount}. Zero-leftover verified: ${leftoverCheck.verifiedClean}`
      );

      return {
        purgedStagingCount: candidateIds.length,
        purgedArtifactsCount,
        purgedRegistryCount,
        verifiedClean: leftoverCheck.verifiedClean,
        leftoverCount: leftoverCheck.leftoverCount,
        timestamp: currentTime,
      };
    } catch (err) {
      logger.error('[LeadPurgeEngine] Error during purge execution:', err);
      return {
        purgedStagingCount: 0,
        purgedArtifactsCount: 0,
        purgedRegistryCount: 0,
        verifiedClean: false,
        leftoverCount: -1,
        timestamp: currentTime,
      };
    }
  }

  /**
   * REQ-22.5.2: Verification scan ensuring zero records remain for the purged IDs
   */
  public verifyZeroLeftovers(purgedLeadIds: string[]): { verifiedClean: boolean; leftoverCount: number } {
    if (purgedLeadIds.length === 0) {
      return { verifiedClean: true, leftoverCount: 0 };
    }

    let remainingStaging = 0;
    let remainingArtifacts = 0;

    for (const id of purgedLeadIds) {
      const stagingRow = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM lead_staging WHERE id = ?`,
        id
      );
      remainingStaging += stagingRow?.count || 0;

      const artifactRow = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM lead_derived_artifacts WHERE lead_id = ?`,
        id
      );
      remainingArtifacts += artifactRow?.count || 0;
    }

    const totalLeftovers = remainingStaging + remainingArtifacts;
    const isClean = totalLeftovers === 0;

    if (!isClean) {
      logger.error(
        `[LeadPurgeEngine] CRITICAL: Deletion verification failed! ${totalLeftovers} lingering items detected.`
      );
    }

    return {
      verifiedClean: isClean,
      leftoverCount: totalLeftovers,
    };
  }

  /**
   * REQ-22.5.5, REQ-22.0.6 & REQ-22.9.6: Multilingual Deletion Request Handler (executed within 24h/instant)
   */
  public async handleDeletionRequest(
    identifier: string, // leadId, PSID, or hashed PSID
    actorId: string = 'user_request',
    detectedLang?: 'en' | 'ar'
  ): Promise<DeletionRequestResult> {
    const psidHash = identifier.length === 64 && /^[0-9a-f]+$/i.test(identifier)
      ? identifier
      : leadCrypto.hashIdentifier(identifier);

    // Locate in staging
    const stagingLead = dbService.get<{ id: string; language: 'en' | 'ar' }>(
      `SELECT id, language FROM lead_staging WHERE id = ? OR psid_hash = ?`,
      identifier,
      psidHash
    );

    const lang: 'en' | 'ar' = detectedLang || stagingLead?.language || 'en';
    let purgedStaging = false;
    let purgedRegistry = false;

    dbService.transaction(() => {
      if (stagingLead) {
        // Delete artifacts
        dbService.run(`DELETE FROM lead_derived_artifacts WHERE lead_id = ?`, stagingLead.id);
        // Hard delete staging
        dbService.run(`DELETE FROM lead_staging WHERE id = ?`, stagingLead.id);
        purgedStaging = true;
      }

      // Also delete from client_registry if present (GDPR / DSAR right to be forgotten)
      const registryClient = dbService.get<{ id: string }>(
        `SELECT id FROM client_registry WHERE client_psid_hash = ?`,
        psidHash
      );

      if (registryClient) {
        dbService.run(`DELETE FROM client_registry WHERE id = ?`, registryClient.id);
        purgedRegistry = true;
      }

      // Record immutable audit event
      this.logPurgeAudit(psidHash, 'DELETION_ON_REQUEST_EXECUTED', {
        actorId,
        purgedStaging,
        purgedRegistry,
        timestamp: Date.now(),
      });
    });

    const confirmationMessage =
      lang === 'ar'
        ? 'تم مسح جميع بياناتك ومعلومات التواصل الخاصة بك نهائياً من نظامنا المؤقت، ولن تتلقى أي رسائل أخرى من نيكسس.'
        : 'Your data and contact information have been completely deleted from our temporary staging system. You will receive no further messages from Nexus.';

    logger.info(`[LeadPurgeEngine] Handled deletion request for ${psidHash}. Staging: ${purgedStaging}, Registry: ${purgedRegistry}`);

    return {
      success: true,
      purgedStaging,
      purgedRegistry,
      confirmationMessage,
      language: lang,
    };
  }

  private logPurgeAudit(psidHash: string, eventType: string, metadata: Record<string, unknown>): void {
    try {
      dbService.run(
        `INSERT INTO lead_audit_ledger (id, lead_id_hash, event_type, actor_id, actor_role, metadata_json, timestamp)
         VALUES (?, ?, ?, 'lead_purge_engine', 'system', ?, ?)`,
        cryptoRandomUUID(),
        psidHash,
        eventType,
        JSON.stringify(metadata),
        Date.now()
      );
    } catch (err) {
      logger.error('[LeadPurgeEngine] Failed to write purge audit event:', err);
    }
  }
}

export const leadPurgeEngine = new LeadPurgeEngine();
