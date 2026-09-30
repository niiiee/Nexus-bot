import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { leadCrypto } from './leadCrypto.js';
import {
  confirmationRulesEngine,
  ConfirmationEvidence,
} from './confirmationRules.js';
import { StagedLeadRow } from './leadLifecycle.js';

export interface PromotionOptions {
  actorId: string;
  actorRole: string; // 'owner' | 'staff' | 'client_manager' | 'ai'
  evidence: ConfirmationEvidence;
  guildId?: string;
  summaryNotes?: string;
  currentTime?: number;
}

export interface PromotionResult {
  success: boolean;
  clientId?: string;
  isExisting?: boolean;
  error?: string;
}

export class LeadPromotionService {
  /**
   * REQ-22.4.1, REQ-22.4.2, REQ-22.4.3 & REQ-22.9.4: Atomic promotion to permanent client registry
   */
  public async promoteLead(leadId: string, options: PromotionOptions): Promise<PromotionResult> {
    const currentTime = options.currentTime ?? Date.now();

    // 1. Evidence Verification (REQ-22.3.1, REQ-22.9.5)
    const evidenceValidation = confirmationRulesEngine.validateEvidence(options.evidence);
    if (!evidenceValidation.valid) {
      logger.warn(`[LeadPromotion] Promotion rejected: ${evidenceValidation.reason}`);
      return { success: false, error: evidenceValidation.reason };
    }

    // 2. Authorization Verification (REQ-22.3.2)
    const authCheck = confirmationRulesEngine.canExecutePromotion(
      options.actorId,
      options.actorRole,
      options.evidence.type,
      options.guildId
    );
    if (!authCheck.allowed) {
      logger.warn(`[LeadPromotion] Unauthorized promotion attempt: ${authCheck.reason}`);
      return { success: false, error: authCheck.reason };
    }

    // 3. Locate Staged Lead
    const lead = dbService.get<StagedLeadRow>(`SELECT * FROM lead_staging WHERE id = ?`, leadId);
    if (!lead) {
      return { success: false, error: `Staged lead not found: ${leadId}` };
    }

    // Check if lead was declined or deleted on request
    if (lead.state === 'DELETED_ON_REQUEST') {
      return {
        success: false,
        error: 'Lead previously exercised opt-out/deletion right. Cannot promote.',
      };
    }

    // 4. Calculate permanent retention expiration (default 24 months) (REQ-22.4.4)
    const retentionMonths = this.getRegistryRetentionMonths(options.guildId);
    const retentionExpiresAt = currentTime + retentionMonths * 30 * 24 * 60 * 60 * 1000;

    // 5. Prepare permanent client record payload (Field-Restricted Migration, REQ-22.4.1)
    const servicesPurchased = lead.service_requested ? [lead.service_requested] : [];
    const dealReferences = options.evidence.dealId ? [options.evidence.dealId] : [];
    const consentRecord = {
      evidenceType: options.evidence.type,
      conditionMet: evidenceValidation.conditionMet,
      verifiedBy: options.evidence.verifiedBy || options.actorId,
      statement: options.evidence.consentStatement || null,
      promotedAt: currentTime,
      promotedBy: options.actorId,
    };

    // Re-encrypt or maintain encrypted name for permanent store
    let permanentEncryptedName = lead.encrypted_name;
    try {
      const decryptedName = leadCrypto.decrypt(lead.encrypted_name, 'staging');
      permanentEncryptedName = leadCrypto.encrypt(decryptedName, 'registry');
    } catch {
      // Keep staging encrypted representation if fallback
    }

    const clientId = cryptoRandomUUID();

    // 6. Execute Atomic Transaction (REQ-22.4.2 & REQ-22.9.4)
    try {
      return dbService.transaction(() => {
        // Idempotency check: see if client already exists in client_registry by psid_hash
        const existingClient = dbService.get<{ id: string }>(
          `SELECT id FROM client_registry WHERE client_psid_hash = ?`,
          lead.psid_hash
        );

        if (existingClient) {
          // Hard delete from staging and derived artifacts to guarantee cleanup
          dbService.run(`DELETE FROM lead_staging WHERE id = ?`, leadId);
          dbService.run(`DELETE FROM lead_derived_artifacts WHERE lead_id = ?`, leadId);

          this.logPromotionAudit(lead.psid_hash, options.actorId, options.actorRole, {
            clientId: existingClient.id,
            isExisting: true,
            evidenceType: options.evidence.type,
          });

          return {
            success: true,
            clientId: existingClient.id,
            isExisting: true,
          };
        }

        // Insert into permanent client registry (Raw chat transcripts excluded by default - REQ-22.4.1)
        dbService.run(
          `INSERT INTO client_registry (
             id, client_psid_hash, encrypted_name, contact_channel,
             services_purchased_json, deal_references_json, consent_record_json,
             summary_notes, promoted_by, promoted_at, last_activity_at,
             retention_expires_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          clientId,
          lead.psid_hash,
          permanentEncryptedName,
          lead.source_channel,
          JSON.stringify(servicesPurchased),
          JSON.stringify(dealReferences),
          JSON.stringify(consentRecord),
          options.summaryNotes || null,
          options.actorId,
          currentTime,
          currentTime,
          retentionExpiresAt,
          currentTime
        );

        // Hard delete from staging table (Atomic single transaction copy-and-delete)
        dbService.run(`DELETE FROM lead_staging WHERE id = ?`, leadId);

        // Delete all derived artifacts (embeddings, summaries, temporary cache entries)
        dbService.run(`DELETE FROM lead_derived_artifacts WHERE lead_id = ?`, leadId);

        // Audit log entry (REQ-22.4.3)
        this.logPromotionAudit(lead.psid_hash, options.actorId, options.actorRole, {
          clientId,
          isExisting: false,
          evidenceType: options.evidence.type,
          conditionMet: evidenceValidation.conditionMet,
          dealRef: options.evidence.dealId || null,
        });

        logger.info(`[LeadPromotion] Successfully promoted lead ${leadId} to client ${clientId}`);
        return {
          success: true,
          clientId,
          isExisting: false,
        };
      });
    } catch (err) {
      logger.error('[LeadPromotion] Transaction rollback occurred during lead promotion:', err);
      return {
        success: false,
        error: 'Database transaction failed during lead promotion. Rollback completed.',
      };
    }
  }

  private getRegistryRetentionMonths(guildId?: string): number {
    if (!guildId) return 24;
    try {
      const config = dbService.get<{ registry_retention_months: number }>(
        `SELECT registry_retention_months FROM lead_staging_config WHERE guild_id = ?`,
        guildId
      );
      return config?.registry_retention_months || 24;
    } catch {
      return 24;
    }
  }

  private logPromotionAudit(
    psidHash: string,
    actorId: string,
    actorRole: string,
    metadata: Record<string, unknown>
  ): void {
    try {
      dbService.run(
        `INSERT INTO lead_audit_ledger (id, lead_id_hash, event_type, actor_id, actor_role, metadata_json, timestamp)
         VALUES (?, ?, 'PROMOTED', ?, ?, ?, ?)`,
        cryptoRandomUUID(),
        psidHash,
        actorId,
        actorRole,
        JSON.stringify(metadata),
        Date.now()
      );
    } catch (err) {
      logger.error('[LeadPromotion] Failed to log promotion audit:', err);
    }
  }
}

export const leadPromotionService = new LeadPromotionService();
