import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { leadCrypto } from './leadCrypto.js';
import { leadLifecycleService, LeadState, StagedLeadRow } from './leadLifecycle.js';
import { leadPromotionService, PromotionOptions, PromotionResult } from './leadPromotion.js';
import { leadPurgeEngine } from './leadPurgeEngine.js';

export interface LeadStagingConfig {
  guild_id: string;
  staging_ttl_days: number;
  registry_retention_months: number;
  max_follow_ups: number;
  auto_promotion_enabled: number;
  meta_verify_token: string | null;
  meta_app_secret: string | null;
  updated_at: number;
}

export interface PipelineMetrics {
  countsByState: Record<LeadState | 'PERMANENT_CLIENTS', number>;
  totalStaged: number;
  totalClients: number;
  ageDistribution: {
    under7Days: number;
    between7And14Days: number;
    between14And30Days: number;
    over30Days: number;
  };
  upcomingExpirationsCount: number;
  timestamp: number;
}

export interface DsarExportData {
  requestedIdentifier: string;
  psidHash: string;
  stagingRecord: {
    id: string;
    displayName: string;
    serviceRequested: string | null;
    source: string;
    state: string;
    messageHistory: string;
    createdAt: string;
    expiresAt: string;
  } | null;
  permanentRegistryRecord: {
    id: string;
    displayName: string;
    contactChannel: string;
    servicesPurchased: string[];
    dealReferences: string[];
    promotedAt: string;
    retentionExpiresAt: string;
  } | null;
  auditEvents: Array<{
    eventType: string;
    timestamp: string;
    actorRole: string;
  }>;
  exportedAt: string;
  exportedBy: string;
}

export class LeadService {
  /**
   * REQ-22.2.4 & REQ-22.7.1: Pipeline metrics, age distribution, upcoming expirations
   */
  public getPipelineMetrics(currentTime: number = Date.now()): PipelineMetrics {
    const countsByState: Record<LeadState | 'PERMANENT_CLIENTS', number> = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFYING: 0,
      CONFIRMED: 0,
      DECLINED: 0,
      EXPIRED: 0,
      DELETED_ON_REQUEST: 0,
      PERMANENT_CLIENTS: 0,
    };

    const stateRows = dbService.all<{ state: string; count: number }>(
      `SELECT state, COUNT(*) as count FROM lead_staging GROUP BY state`
    );

    for (const row of stateRows) {
      if (row.state in countsByState) {
        countsByState[row.state as LeadState] = Number(row.count);
      }
    }

    const clientCountRow = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM client_registry`
    );
    countsByState.PERMANENT_CLIENTS = Number(clientCountRow?.count || 0);

    const totalStaged = Object.entries(countsByState)
      .filter(([k]) => k !== 'PERMANENT_CLIENTS')
      .reduce((sum, [, count]) => sum + count, 0);

    // Age distribution of active staged leads
    const activeLeads = dbService.all<{ created_at: number }>(
      `SELECT created_at FROM lead_staging WHERE state IN ('NEW', 'CONTACTED', 'QUALIFYING')`
    );

    const dayMs = 24 * 60 * 60 * 1000;
    const ageDistribution = {
      under7Days: 0,
      between7And14Days: 0,
      between14And30Days: 0,
      over30Days: 0,
    };

    for (const lead of activeLeads) {
      const ageDays = (currentTime - lead.created_at) / dayMs;
      if (ageDays < 7) {
        ageDistribution.under7Days++;
      } else if (ageDays < 14) {
        ageDistribution.between7And14Days++;
      } else if (ageDays < 30) {
        ageDistribution.between14And30Days++;
      } else {
        ageDistribution.over30Days++;
      }
    }

    // Expirations within 3 days
    const upcomingExpRow = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM lead_staging
       WHERE expires_at > ? AND expires_at <= ? AND state NOT IN ('CONFIRMED', 'DELETED_ON_REQUEST')`,
      currentTime,
      currentTime + 3 * dayMs
    );
    const upcomingExpirationsCount = Number(upcomingExpRow?.count || 0);

    return {
      countsByState,
      totalStaged,
      totalClients: countsByState.PERMANENT_CLIENTS,
      ageDistribution,
      upcomingExpirationsCount,
      timestamp: currentTime,
    };
  }

  /**
   * List staged leads with decrypted display names
   */
  public listStagedLeads(filters: { state?: LeadState; limit?: number; offset?: number } = {}) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    let query = `SELECT * FROM lead_staging`;
    const params: (string | number)[] = [];

    if (filters.state) {
      query += ` WHERE state = ?`;
      params.push(filters.state);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = dbService.all<StagedLeadRow>(query, ...params);

    return rows.map((row) => {
      let displayName = 'Unknown';
      try {
        displayName = leadCrypto.decrypt(row.encrypted_name, 'staging');
      } catch {
        // Fallback
      }

      return {
        id: row.id,
        psid_hash: row.psid_hash,
        displayName,
        serviceRequested: row.service_requested,
        sourceChannel: row.source_channel,
        language: row.language,
        state: row.state,
        followUpCount: row.follow_up_count,
        lastInteractionAt: row.last_interaction_at,
        expiresAt: row.expires_at,
        extendedOnce: Boolean(row.extended_once),
        createdAt: row.created_at,
      };
    });
  }

  /**
   * Get full lead details including decrypted message
   */
  public getLeadDetails(leadId: string) {
    const lead = dbService.get<StagedLeadRow>(`SELECT * FROM lead_staging WHERE id = ?`, leadId);
    if (!lead) return null;

    let displayName = 'Unknown';
    let message = '';
    let psid = '';

    try {
      displayName = leadCrypto.decrypt(lead.encrypted_name, 'staging');
    } catch {
      //
    }
    try {
      message = leadCrypto.decrypt(lead.encrypted_message, 'staging');
    } catch {
      //
    }
    try {
      psid = leadCrypto.decrypt(lead.encrypted_psid, 'staging');
    } catch {
      //
    }

    return {
      id: lead.id,
      psid,
      psidHash: lead.psid_hash,
      displayName,
      message,
      serviceRequested: lead.service_requested,
      sourceChannel: lead.source_channel,
      sourceReference: lead.source_reference,
      language: lead.language,
      state: lead.state,
      consentNoticeSent: Boolean(lead.consent_notice_sent),
      followUpCount: lead.follow_up_count,
      lastInteractionAt: lead.last_interaction_at,
      expiresAt: lead.expires_at,
      extendedOnce: Boolean(lead.extended_once),
      declinedAt: lead.declined_at,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    };
  }

  /**
   * REQ-22.7.2 & REQ-22.9.7: Export single-lead Data Subject Access Request (DSAR) package
   */
  public exportLeadDsar(identifier: string, actorId: string, actorRole: string): DsarExportData | null {
    const psidHash =
      identifier.length === 64 && /^[0-9a-f]+$/i.test(identifier)
        ? identifier
        : leadCrypto.hashIdentifier(identifier);

    // 1. Fetch staging record if present
    const stagingRow = dbService.get<StagedLeadRow>(
      `SELECT * FROM lead_staging WHERE id = ? OR psid_hash = ?`,
      identifier,
      psidHash
    );

    let stagingRecord: DsarExportData['stagingRecord'] = null;
    if (stagingRow) {
      let displayName = 'Redacted';
      let messageHistory = '';
      try {
        displayName = leadCrypto.decrypt(stagingRow.encrypted_name, 'staging');
      } catch {}
      try {
        messageHistory = leadCrypto.decrypt(stagingRow.encrypted_message, 'staging');
      } catch {}

      stagingRecord = {
        id: stagingRow.id,
        displayName,
        serviceRequested: stagingRow.service_requested,
        source: stagingRow.source_channel,
        state: stagingRow.state,
        messageHistory,
        createdAt: new Date(stagingRow.created_at).toISOString(),
        expiresAt: new Date(stagingRow.expires_at).toISOString(),
      };
    }

    // 2. Fetch permanent client record if present
    const clientRow = dbService.get<{
      id: string;
      encrypted_name: string;
      contact_channel: string;
      services_purchased_json: string;
      deal_references_json: string;
      promoted_at: number;
      retention_expires_at: number;
    }>(`SELECT * FROM client_registry WHERE client_psid_hash = ?`, psidHash);

    let permanentRegistryRecord: DsarExportData['permanentRegistryRecord'] = null;
    if (clientRow) {
      let displayName = 'Redacted';
      try {
        displayName = leadCrypto.decrypt(clientRow.encrypted_name, 'registry');
      } catch {}

      let servicesPurchased: string[] = [];
      let dealReferences: string[] = [];
      try {
        servicesPurchased = JSON.parse(clientRow.services_purchased_json);
      } catch {}
      try {
        dealReferences = JSON.parse(clientRow.deal_references_json);
      } catch {}

      permanentRegistryRecord = {
        id: clientRow.id,
        displayName,
        contactChannel: clientRow.contact_channel,
        servicesPurchased,
        dealReferences,
        promotedAt: new Date(clientRow.promoted_at).toISOString(),
        retentionExpiresAt: new Date(clientRow.retention_expires_at).toISOString(),
      };
    }

    if (!stagingRecord && !permanentRegistryRecord) {
      return null;
    }

    // 3. Fetch audit ledger entries
    const auditRows = dbService.all<{ event_type: string; actor_role: string; timestamp: number }>(
      `SELECT event_type, actor_role, timestamp FROM lead_audit_ledger
       WHERE lead_id_hash = ? ORDER BY timestamp ASC`,
      psidHash
    );

    const auditEvents = auditRows.map((r) => ({
      eventType: r.event_type,
      actorRole: r.actor_role,
      timestamp: new Date(r.timestamp).toISOString(),
    }));

    // Log the export action (REQ-22.1.4, REQ-22.9.7)
    dbService.run(
      `INSERT INTO lead_audit_ledger (id, lead_id_hash, event_type, actor_id, actor_role, metadata_json, timestamp)
       VALUES (?, ?, 'DSAR_EXPORT_GENERATED', ?, ?, ?, ?)`,
      cryptoRandomUUID(),
      psidHash,
      actorId,
      actorRole,
      JSON.stringify({ exportedForIdentifier: identifier }),
      Date.now()
    );

    return {
      requestedIdentifier: identifier,
      psidHash,
      stagingRecord,
      permanentRegistryRecord,
      auditEvents,
      exportedAt: new Date().toISOString(),
      exportedBy: actorId,
    };
  }

  /**
   * REQ-22.7.3: Get or initialize lead staging config
   */
  public getConfig(guildId: string = 'default-guild'): LeadStagingConfig {
    const existing = dbService.get<LeadStagingConfig>(
      `SELECT * FROM lead_staging_config WHERE guild_id = ?`,
      guildId
    );

    if (existing) {
      return existing;
    }

    const defaultConfig: LeadStagingConfig = {
      guild_id: guildId,
      staging_ttl_days: 30,
      registry_retention_months: 24,
      max_follow_ups: 2,
      auto_promotion_enabled: 0,
      meta_verify_token: 'nexus_lead_meta_verify_token',
      meta_app_secret: null,
      updated_at: Date.now(),
    };

    try {
      dbService.run(
        `INSERT INTO lead_staging_config (
           guild_id, staging_ttl_days, registry_retention_months,
           max_follow_ups, auto_promotion_enabled, meta_verify_token,
           meta_app_secret, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        defaultConfig.guild_id,
        defaultConfig.staging_ttl_days,
        defaultConfig.registry_retention_months,
        defaultConfig.max_follow_ups,
        defaultConfig.auto_promotion_enabled,
        defaultConfig.meta_verify_token,
        defaultConfig.meta_app_secret,
        defaultConfig.updated_at
      );
    } catch {
      // Ignore if concurrent insert
    }

    return defaultConfig;
  }

  /**
   * REQ-22.0.4 & REQ-22.7.3: Update config with hard limits enforcement (7 to 90 days TTL)
   */
  public updateConfig(guildId: string, updates: Partial<LeadStagingConfig>): { success: boolean; error?: string } {
    const current = this.getConfig(guildId);

    // Validate staging TTL limit (7 to 90 days - REQ-22.0.4)
    if (updates.staging_ttl_days !== undefined) {
      if (updates.staging_ttl_days < 7 || updates.staging_ttl_days > 90) {
        return {
          success: false,
          error: 'Staging TTL must be between 7 and 90 days (never unlimited).',
        };
      }
    }

    // Validate follow up limits
    if (updates.max_follow_ups !== undefined && (updates.max_follow_ups < 0 || updates.max_follow_ups > 5)) {
      return { success: false, error: 'Max follow-ups must be between 0 and 5.' };
    }

    const newTtl = updates.staging_ttl_days ?? current.staging_ttl_days;
    const newRetention = updates.registry_retention_months ?? current.registry_retention_months;
    const newFollowUps = updates.max_follow_ups ?? current.max_follow_ups;
    const newAutoPromo = updates.auto_promotion_enabled ?? current.auto_promotion_enabled;
    const newVerifyToken = updates.meta_verify_token ?? current.meta_verify_token;
    const newAppSecret = updates.meta_app_secret ?? current.meta_app_secret;
    const now = Date.now();

    dbService.run(
      `UPDATE lead_staging_config SET
         staging_ttl_days = ?,
         registry_retention_months = ?,
         max_follow_ups = ?,
         auto_promotion_enabled = ?,
         meta_verify_token = ?,
         meta_app_secret = ?,
         updated_at = ?
       WHERE guild_id = ?`,
      newTtl,
      newRetention,
      newFollowUps,
      newAutoPromo,
      newVerifyToken,
      newAppSecret,
      now,
      guildId
    );

    return { success: true };
  }

  public getAuditLogs(leadIdOrHash?: string, limit: number = 100) {
    if (leadIdOrHash) {
      const hash =
        leadIdOrHash.length === 64 && /^[0-9a-f]+$/i.test(leadIdOrHash)
          ? leadIdOrHash
          : leadCrypto.hashIdentifier(leadIdOrHash);

      return dbService.all(
        `SELECT * FROM lead_audit_ledger WHERE lead_id_hash = ? ORDER BY timestamp DESC LIMIT ?`,
        hash,
        limit
      );
    }

    return dbService.all(
      `SELECT * FROM lead_audit_ledger ORDER BY timestamp DESC LIMIT ?`,
      limit
    );
  }
}

export const leadService = new LeadService();
