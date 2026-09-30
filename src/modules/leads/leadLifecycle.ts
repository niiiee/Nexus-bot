import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { leadCrypto } from './leadCrypto.js';
import { leadRulesGuard } from './leadRulesGuard.js';

export type LeadState =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFYING'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'DELETED_ON_REQUEST';

export interface StagedLeadRow {
  id: string;
  psid_hash: string;
  encrypted_psid: string;
  encrypted_name: string;
  encrypted_message: string;
  service_requested: string | null;
  source_channel: string;
  source_reference: string | null;
  language: 'en' | 'ar';
  state: LeadState;
  consent_notice_sent: number;
  follow_up_count: number;
  last_interaction_at: number;
  expires_at: number;
  extended_once: number;
  declined_at: number | null;
  created_at: number;
  updated_at: number;
}

export class LeadLifecycleService {
  private readonly validTransitions: Record<LeadState, LeadState[]> = {
    NEW: ['CONTACTED', 'QUALIFYING', 'DECLINED', 'EXPIRED', 'DELETED_ON_REQUEST'],
    CONTACTED: ['QUALIFYING', 'DECLINED', 'EXPIRED', 'DELETED_ON_REQUEST'],
    QUALIFYING: ['CONFIRMED', 'DECLINED', 'EXPIRED', 'DELETED_ON_REQUEST'],
    CONFIRMED: [], // Terminal in staging (promoted to client_registry)
    DECLINED: ['DELETED_ON_REQUEST'], // Can request immediate deletion while waiting 7d purge
    EXPIRED: ['DELETED_ON_REQUEST'],
    DELETED_ON_REQUEST: [], // Terminal
  };

  /**
   * REQ-22.2.1 & REQ-22.2.2: Validate and transition lead lifecycle state with audit logging
   */
  public transitionState(
    leadId: string,
    newState: LeadState,
    actorId: string,
    reason: string,
    currentTime: number = Date.now()
  ): { success: boolean; error?: string; previousState?: LeadState } {
    try {
      const lead = dbService.get<StagedLeadRow>(`SELECT * FROM lead_staging WHERE id = ?`, leadId);
      if (!lead) {
        return { success: false, error: `Lead not found: ${leadId}` };
      }

      const currentState = lead.state as LeadState;

      if (currentState === newState) {
        return { success: true, previousState: currentState };
      }

      const allowedTargets = this.validTransitions[currentState] || [];
      if (!allowedTargets.includes(newState)) {
        const errorMsg = `Invalid state transition from ${currentState} to ${newState}.`;
        logger.warn(`[LeadLifecycle] ${errorMsg} Lead: ${leadId}`);
        return { success: false, error: errorMsg, previousState: currentState };
      }

      // Execute update
      const declinedAt = newState === 'DECLINED' ? currentTime : lead.declined_at;

      dbService.run(
        `UPDATE lead_staging SET
           state = ?,
           declined_at = ?,
           updated_at = ?
         WHERE id = ?`,
        newState,
        declinedAt,
        currentTime,
        leadId
      );

      // Log state transition in audit ledger (REQ-22.2.2)
      this.logAuditEvent(leadId, 'STATE_TRANSITION', actorId, {
        from: currentState,
        to: newState,
        reason,
      });

      return { success: true, previousState: currentState };
    } catch (err) {
      logger.error('[LeadLifecycle] Error transitioning state:', err);
      return { success: false, error: 'Database error occurred during state transition.' };
    }
  }

  /**
   * REQ-22.2.3 & REQ-22.9.8: Record a follow-up, enforcing cap (<= 2) and Meta 24-hr messaging window
   */
  public recordFollowUp(
    leadId: string,
    actorId: string,
    currentTime: number = Date.now(),
    guildId?: string
  ): { success: boolean; error?: string; followUpCount?: number } {
    try {
      const lead = dbService.get<StagedLeadRow>(`SELECT * FROM lead_staging WHERE id = ?`, leadId);
      if (!lead) {
        return { success: false, error: `Lead not found: ${leadId}` };
      }

      // No follow-ups allowed after decline, expiry, or confirmation
      if (['DECLINED', 'EXPIRED', 'DELETED_ON_REQUEST', 'CONFIRMED'].includes(lead.state)) {
        return {
          success: false,
          error: `Cannot send follow-up: lead is in terminal/declined state '${lead.state}'.`,
        };
      }

      // Check max follow-up cap (default 2)
      const maxFollowUps = this.getMaxFollowUps(guildId);
      if (lead.follow_up_count >= maxFollowUps) {
        return {
          success: false,
          error: `Follow-up cap reached (${lead.follow_up_count}/${maxFollowUps}). No further follow-ups permitted.`,
        };
      }

      // Validate Meta 24-hour messaging window (REQ-22.0.8, REQ-22.9.8)
      if (!leadRulesGuard.isWithin24HrWindow(lead.last_interaction_at, currentTime)) {
        return {
          success: false,
          error: 'Meta 24-hour messaging window expired. Unsolicited outreach prohibited without user re-engagement.',
        };
      }

      const nextCount = lead.follow_up_count + 1;
      const nextState = lead.state === 'NEW' ? 'CONTACTED' : lead.state;

      dbService.run(
        `UPDATE lead_staging SET
           follow_up_count = ?,
           state = ?,
           last_interaction_at = ?,
           updated_at = ?
         WHERE id = ?`,
        nextCount,
        nextState,
        currentTime,
        currentTime,
        leadId
      );

      this.logAuditEvent(leadId, 'FOLLOW_UP_SENT', actorId, {
        followUpNumber: nextCount,
        maxAllowed: maxFollowUps,
      });

      return { success: true, followUpCount: nextCount };
    } catch (err) {
      logger.error('[LeadLifecycle] Error recording follow-up:', err);
      return { success: false, error: 'Database error occurred while recording follow-up.' };
    }
  }

  /**
   * REQ-22.0.4 & REQ-22.9.2: Single extension up to a hard ceiling of 90 days maximum
   */
  public extendStaging(
    leadId: string,
    additionalDays: number,
    actorId: string,
    currentTime: number = Date.now()
  ): { success: boolean; error?: string; newExpiresAt?: number } {
    try {
      const lead = dbService.get<StagedLeadRow>(`SELECT * FROM lead_staging WHERE id = ?`, leadId);
      if (!lead) {
        return { success: false, error: `Lead not found: ${leadId}` };
      }

      // Check active state
      if (!['NEW', 'CONTACTED', 'QUALIFYING'].includes(lead.state)) {
        return {
          success: false,
          error: `Cannot extend staging for lead in state '${lead.state}'.`,
        };
      }

      // Enforce single extension rule (REQ-22.0.4)
      if (lead.extended_once === 1) {
        return {
          success: false,
          error: 'Lead staging has already been extended once. Multiple extensions are strictly prohibited.',
        };
      }

      if (additionalDays <= 0) {
        return { success: false, error: 'Additional extension days must be greater than zero.' };
      }

      // Hard ceiling: 90 days from creation timestamp (REQ-22.0.4, REQ-22.9.2)
      const hardCeiling = lead.created_at + 90 * 24 * 60 * 60 * 1000;
      const requestedExpiry = lead.expires_at + additionalDays * 24 * 60 * 60 * 1000;
      const newExpiresAt = Math.min(requestedExpiry, hardCeiling);

      dbService.run(
        `UPDATE lead_staging SET
           expires_at = ?,
           extended_once = 1,
           updated_at = ?
         WHERE id = ?`,
        newExpiresAt,
        currentTime,
        leadId
      );

      this.logAuditEvent(leadId, 'STAGING_EXTENDED', actorId, {
        previousExpiresAt: lead.expires_at,
        newExpiresAt,
        additionalDaysRequested: additionalDays,
        hitHardCeiling: requestedExpiry > hardCeiling,
      });

      return { success: true, newExpiresAt };
    } catch (err) {
      logger.error('[LeadLifecycle] Error extending staging:', err);
      return { success: false, error: 'Database error occurred while extending staging.' };
    }
  }

  private getMaxFollowUps(guildId?: string): number {
    if (!guildId) return 2;
    try {
      const config = dbService.get<{ max_follow_ups: number }>(
        `SELECT max_follow_ups FROM lead_staging_config WHERE guild_id = ?`,
        guildId
      );
      return config?.max_follow_ups ?? 2;
    } catch {
      return 2;
    }
  }

  private logAuditEvent(leadId: string, eventType: string, actorId: string, metadata: Record<string, unknown>): void {
    try {
      const leadIdHash = leadCrypto.hashIdentifier(leadId);
      dbService.run(
        `INSERT INTO lead_audit_ledger (id, lead_id_hash, event_type, actor_id, actor_role, metadata_json, timestamp)
         VALUES (?, ?, ?, ?, 'staff', ?, ?)`,
        cryptoRandomUUID(),
        leadIdHash,
        eventType,
        actorId,
        JSON.stringify(metadata),
        Date.now()
      );
    } catch (err) {
      logger.error('[LeadLifecycle] Failed to write audit event:', err);
    }
  }
}

export const leadLifecycleService = new LeadLifecycleService();
