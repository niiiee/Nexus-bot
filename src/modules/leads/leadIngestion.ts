import crypto from 'node:crypto';
import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { leadCrypto } from './leadCrypto.js';
import { leadRedactor } from './leadRedactor.js';
import { leadRulesGuard, LeadSource } from './leadRulesGuard.js';

export interface IngestionInput {
  psid: string;
  displayName?: string;
  content: string;
  source: LeadSource;
  serviceRequested?: string;
  sourceReference?: string;
  language?: 'en' | 'ar';
  guildId?: string;
}

export interface IngestionResult {
  success: boolean;
  leadId?: string;
  isNew?: boolean;
  consentNotice?: string;
  securityWarning?: string;
  state?: string;
  error?: string;
}

export class LeadIngestionService {
  /**
   * REQ-22.1.2: Verifies Meta X-Hub-Signature-256 HMAC
   */
  public verifyMetaWebhookSignature(
    rawBody: string | Buffer,
    signatureHeader: string | undefined,
    appSecret: string
  ): boolean {
    if (!signatureHeader || !appSecret) {
      return false;
    }

    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }

    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const expectedSig = Buffer.from(expectedHash, 'utf8');
    const actualSig = Buffer.from(parts[1], 'utf8');

    if (expectedSig.length !== actualSig.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedSig, actualSig);
  }

  /**
   * Ingest lead payload with source validation, data minimization, sensitive redaction, and encryption
   */
  public async ingestLead(input: IngestionInput, currentTime: number = Date.now()): Promise<IngestionResult> {
    // 1. Source verification (REQ-22.0.1)
    const sourceValidation = leadRulesGuard.validateSource(input.source);
    if (!sourceValidation.allowed) {
      logger.warn(`[LeadIngestion] Ingestion rejected: ${sourceValidation.reason}`);
      return { success: false, error: sourceValidation.reason };
    }

    // 2. Data minimization & field sanitization (REQ-22.0.2)
    const sanitized = leadRulesGuard.sanitizeRawPayload({
      psid: input.psid,
      displayName: input.displayName,
      content: input.content,
      serviceRequested: input.serviceRequested,
      source: input.source,
      language: input.language,
      sourceReference: input.sourceReference,
    });

    // 3. Sensitive data redaction (REQ-22.0.2)
    const redaction = leadRedactor.redactSensitiveInfo(sanitized.content, sanitized.language);
    const cleanContent = redaction.cleanText;

    // 4. Salted hash deduplication (REQ-22.1.5)
    const psidHash = leadCrypto.hashIdentifier(sanitized.psid);

    // 5. Check if lead already exists in staging
    try {
      const existing = dbService.get<{
        id: string;
        state: string;
        encrypted_message: string;
        last_interaction_at: number;
        expires_at: number;
        consent_notice_sent: number;
      }>(`SELECT * FROM lead_staging WHERE psid_hash = ?`, psidHash);

      const ttlDays = this.getConfiguredTtlDays(input.guildId);

      if (existing) {
        // If lead already confirmed or declined, respect state or resume if active
        if (existing.state === 'DELETED_ON_REQUEST') {
          return { success: false, error: 'User previously requested data deletion and opt-out.' };
        }

        // Decrypt old message to append new incoming note (within retention window)
        let updatedMessage = cleanContent;
        try {
          const previousHistory = leadCrypto.decrypt(existing.encrypted_message, 'staging');
          updatedMessage = `${previousHistory}\n---\n[Follow-up ${new Date(currentTime).toISOString()}]: ${cleanContent}`;
        } catch {
          // fallback to cleanContent if corrupted
        }

        const encryptedUpdatedMsg = leadCrypto.encrypt(updatedMessage, 'staging');

        dbService.run(
          `UPDATE lead_staging SET
             encrypted_message = ?,
             last_interaction_at = ?,
             updated_at = ?
           WHERE id = ?`,
          encryptedUpdatedMsg,
          currentTime,
          currentTime,
          existing.id
        );

        // Audit log (hash only, zero content)
        this.logAuditEvent(existing.id, 'MESSAGE_RECEIVED', 'meta_webhook', { source: sanitized.source });

        return {
          success: true,
          leadId: existing.id,
          isNew: false,
          state: existing.state,
          securityWarning: redaction.warningNotice,
        };
      }

      // 6. Create new staged lead
      const newLeadId = cryptoRandomUUID();
      const encryptedPsid = leadCrypto.encrypt(sanitized.psid, 'staging');
      const encryptedName = leadCrypto.encrypt(sanitized.displayName, 'staging');
      const encryptedMessage = leadCrypto.encrypt(cleanContent, 'staging');
      const expiresAt = currentTime + ttlDays * 24 * 60 * 60 * 1000;

      dbService.run(
        `INSERT INTO lead_staging (
           id, psid_hash, encrypted_psid, encrypted_name, encrypted_message,
           service_requested, source_channel, source_reference, language,
           state, consent_notice_sent, follow_up_count, last_interaction_at,
           expires_at, extended_once, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 1, 0, ?, ?, 0, ?, ?)`,
        newLeadId,
        psidHash,
        encryptedPsid,
        encryptedName,
        encryptedMessage,
        sanitized.serviceRequested || null,
        sanitized.source,
        sanitized.sourceReference || null,
        sanitized.language,
        currentTime,
        expiresAt,
        currentTime,
        currentTime
      );

      // Initial transparency notice (REQ-22.0.3)
      const consentNotice = leadRulesGuard.getInitialPrivacyNotice(sanitized.language, ttlDays);

      // Audit log entry
      this.logAuditEvent(newLeadId, 'INGESTED', 'meta_webhook', {
        source: sanitized.source,
        ttlDays,
        language: sanitized.language,
      });

      return {
        success: true,
        leadId: newLeadId,
        isNew: true,
        consentNotice,
        securityWarning: redaction.warningNotice,
        state: 'NEW',
      };
    } catch (err) {
      logger.error('[LeadIngestion] Database error during lead staging:', err);
      return { success: false, error: 'Database error occurred during lead staging.' };
    }
  }

  private getConfiguredTtlDays(guildId?: string): number {
    if (!guildId) return 30;
    try {
      const config = dbService.get<{ staging_ttl_days: number }>(
        `SELECT staging_ttl_days FROM lead_staging_config WHERE guild_id = ?`,
        guildId
      );
      return config?.staging_ttl_days || 30;
    } catch {
      return 30;
    }
  }

  private logAuditEvent(leadId: string, eventType: string, actorId: string, metadata: Record<string, unknown>): void {
    try {
      const leadIdHash = leadCrypto.hashIdentifier(leadId);
      dbService.run(
        `INSERT INTO lead_audit_ledger (id, lead_id_hash, event_type, actor_id, actor_role, metadata_json, timestamp)
         VALUES (?, ?, ?, ?, 'bot', ?, ?)`,
        cryptoRandomUUID(),
        leadIdHash,
        eventType,
        actorId,
        JSON.stringify(metadata),
        Date.now()
      );
    } catch (err) {
      logger.error('[LeadIngestion] Failed to log audit event:', err);
    }
  }
}

export const leadIngestionService = new LeadIngestionService();
