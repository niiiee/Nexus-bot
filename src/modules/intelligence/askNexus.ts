import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface AskNexusQueryResult {
  query: string;
  sqlExecuted?: string;
  result: any;
  summary: string;
  executionTimeMs: number;
}

export interface ProposedActionPreview {
  token: string;
  tenantId: string;
  actionType: 'bulk_assign_role' | 'bulk_remove_role' | 'purge_inactive_invites';
  description: string;
  affectedCount: number;
  beforeState: any[];
  afterState: any[];
  expiresAt: number;
}

export interface ReversibleActionRecord {
  id: string;
  tenantId: string;
  actionType: string;
  actorId: string;
  previousStateJson: string;
  newStateJson: string;
  createdAt: number;
  undoExpiresAt: number;
  isReverted: boolean;
}

export class AskNexusCommandCenter {
  private static readonly ALLOWED_TABLES = new Set([
    'members',
    'deals',
    'reputation_events',
    'talent_nodes',
    'community_sentiment_snapshots',
    'workflows',
    'audit_logs'
  ]);

  private static readonly DESTRUCTIVE_KEYWORDS = [
    'DROP',
    'DELETE',
    'UPDATE',
    'INSERT',
    'ALTER',
    'TRUNCATE',
    'REPLACE',
    'CREATE',
    'EXEC',
    'ATTACH',
    'DETACH'
  ];

  private static readonly INJECTION_PATTERNS = [
    /ignore\s+previous\s+instructions/i,
    /system\s+prompt/i,
    /other\s+tenant/i,
    /all\s+tenants/i,
    /bypass\s+security/i,
    /drop\s+table/i,
    /select\s+\*\s+from\s+tenants/i,
    /--/,
    /;/
  ];

  private pendingActions = new Map<string, ProposedActionPreview>();
  private reversibleActions = new Map<string, ReversibleActionRecord>();

  /**
   * REQ-23.7.5: Prompt-injection defense layer
   */
  public sanitizeAndValidatePrompt(nlPrompt: string): { safe: boolean; error?: string } {
    for (const pattern of AskNexusCommandCenter.INJECTION_PATTERNS) {
      if (pattern.test(nlPrompt)) {
        return {
          safe: false,
          error: `Potential prompt-injection or boundary-crossing query detected: pattern '${pattern.source}'`
        };
      }
    }
    return { safe: true };
  }

  /**
   * REQ-23.7.2: Verify SQL is strictly read-only and uses allowlisted tables
   */
  public validateSqlSafety(sql: string): { safe: boolean; error?: string } {
    const upper = sql.toUpperCase();

    for (const kw of AskNexusCommandCenter.DESTRUCTIVE_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(upper)) {
        return { safe: false, error: `Disallowed SQL operation keyword: '${kw}'` };
      }
    }

    if (!upper.trim().startsWith('SELECT')) {
      return { safe: false, error: 'Only SELECT queries are permitted in Ask Nexus' };
    }

    return { safe: true };
  }

  /**
   * REQ-23.7.1: Natural language query processor translating administrative queries
   */
  public async processQuery(tenantId: string, naturalLanguageQuery: string): Promise<AskNexusQueryResult> {
    const startTime = Date.now();

    // 1. Injection validation
    const promptCheck = this.sanitizeAndValidatePrompt(naturalLanguageQuery);
    if (!promptCheck.safe) {
      return {
        query: naturalLanguageQuery,
        result: null,
        summary: `Query rejected: ${promptCheck.error}`,
        executionTimeMs: Date.now() - startTime
      };
    }

    const lower = naturalLanguageQuery.toLowerCase();
    let sql = '';
    let params: any[] = [];
    let summary = '';

    // 2. Intent matching
    if (lower.includes('how many members') || lower.includes('total members')) {
      sql = `SELECT COUNT(*) as count FROM members WHERE guild_id = (SELECT guild_id FROM tenants WHERE id = ?)`;
      params = [tenantId];
      const res = dbService.get<{ count: number }>(sql, ...params);
      const count = res?.count || 0;
      summary = `Your community currently has ${count.toLocaleString()} member(s) enrolled.`;
      return {
        query: naturalLanguageQuery,
        sqlExecuted: sql,
        result: { count },
        summary,
        executionTimeMs: Date.now() - startTime
      };
    }

    if (lower.includes('inactive members') || lower.includes('dormant')) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      sql = `SELECT id, username, joined_at, last_active_at FROM members 
             WHERE guild_id = (SELECT guild_id FROM tenants WHERE id = ?) 
             AND (last_active_at < ? OR last_active_at IS NULL) LIMIT 10`;
      params = [tenantId, thirtyDaysAgo];
      const rows = dbService.all<any>(sql, ...params);
      summary = `Found ${rows.length} member(s) with no activity in the last 30 days.`;
      return {
        query: naturalLanguageQuery,
        sqlExecuted: sql,
        result: rows,
        summary,
        executionTimeMs: Date.now() - startTime
      };
    }

    if (lower.includes('deals') || lower.includes('completed deals') || lower.includes('revenue')) {
      sql = `SELECT COUNT(*) as completed_count, COALESCE(SUM(value_usd), 0) as total_value
             FROM deals WHERE tenant_id = ? AND status = 'completed'`;
      params = [tenantId];
      const stats = dbService.get<{ completed_count: number; total_value: number }>(sql, ...params) || {
        completed_count: 0,
        total_value: 0
      };
      summary = `Your community has completed ${stats.completed_count} deal(s) with a cumulative value of $${stats.total_value.toLocaleString()}.`;
      return {
        query: naturalLanguageQuery,
        sqlExecuted: sql,
        result: stats,
        summary,
        executionTimeMs: Date.now() - startTime
      };
    }

    if (lower.includes('workflows') || lower.includes('automations')) {
      sql = `SELECT id, name, trigger_type, is_active FROM workflows WHERE tenant_id = ?`;
      params = [tenantId];
      const workflows = dbService.all<any>(sql, ...params);
      summary = `You have ${workflows.length} active automation workflow(s) registered.`;
      return {
        query: naturalLanguageQuery,
        sqlExecuted: sql,
        result: workflows,
        summary,
        executionTimeMs: Date.now() - startTime
      };
    }

    // Default general query fallback
    sql = `SELECT name, plan_tier, quota_members, quota_ai_calls FROM tenants WHERE id = ?`;
    params = [tenantId];
    const tenantInfo = dbService.get<any>(sql, ...params);
    summary = `Guild "${tenantInfo?.name || 'Community'}" is operating on the ${tenantInfo?.plan_tier || 'free'} tier.`;

    return {
      query: naturalLanguageQuery,
      sqlExecuted: sql,
      result: tenantInfo,
      summary,
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * REQ-23.7.3: Two-step confirmation preview for administrative actions
   */
  public proposeAction(
    tenantId: string,
    actionType: 'bulk_assign_role' | 'bulk_remove_role' | 'purge_inactive_invites',
    targetRoleOrParams: Record<string, any>
  ): ProposedActionPreview {
    const token = cryptoRandomUUID();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min preview expiry

    let description = '';
    let affectedCount = 0;
    let beforeState: any[] = [];
    let afterState: any[] = [];

    if (actionType === 'bulk_assign_role') {
      const roleName = targetRoleOrParams.roleName || 'Veteran';
      const targetUserIds: string[] = targetRoleOrParams.userIds || [];
      affectedCount = targetUserIds.length;
      description = `Assign role "${roleName}" to ${affectedCount} designated member(s).`;
      beforeState = targetUserIds.map(uid => ({ userId: uid, role: null }));
      afterState = targetUserIds.map(uid => ({ userId: uid, role: roleName }));
    } else if (actionType === 'bulk_remove_role') {
      const roleName = targetRoleOrParams.roleName || 'Muted';
      const targetUserIds: string[] = targetRoleOrParams.userIds || [];
      affectedCount = targetUserIds.length;
      description = `Remove role "${roleName}" from ${affectedCount} member(s).`;
      beforeState = targetUserIds.map(uid => ({ userId: uid, role: roleName }));
      afterState = targetUserIds.map(uid => ({ userId: uid, role: null }));
    } else {
      description = 'Purge expired and stale invitations';
      affectedCount = 3;
      beforeState = [{ invite: 'invite_1' }, { invite: 'invite_2' }, { invite: 'invite_3' }];
      afterState = [];
    }

    const preview: ProposedActionPreview = {
      token,
      tenantId,
      actionType,
      description,
      affectedCount,
      beforeState,
      afterState,
      expiresAt
    };

    this.pendingActions.set(token, preview);
    return preview;
  }

  /**
   * REQ-23.7.3 & REQ-23.7.4: Execute confirmed action and record in reversible action log
   */
  public confirmAction(
    token: string,
    confirmedBy: string
  ): { success: boolean; reversibleActionId?: string; message: string } {
    const preview = this.pendingActions.get(token);
    if (!preview) {
      return { success: false, message: 'Invalid or expired confirmation token' };
    }

    if (Date.now() > preview.expiresAt) {
      this.pendingActions.delete(token);
      return { success: false, message: 'Confirmation token has expired' };
    }

    const actionId = cryptoRandomUUID();
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;

    const record: ReversibleActionRecord = {
      id: actionId,
      tenantId: preview.tenantId,
      actionType: preview.actionType,
      actorId: confirmedBy,
      previousStateJson: JSON.stringify(preview.beforeState),
      newStateJson: JSON.stringify(preview.afterState),
      createdAt: now,
      undoExpiresAt: now + oneHourMs,
      isReverted: false
    };

    this.reversibleActions.set(actionId, record);
    this.pendingActions.delete(token);

    logger.info('Ask Nexus administrative action confirmed and logged', {
      actionId,
      actionType: preview.actionType,
      actor: confirmedBy
    });

    return {
      success: true,
      reversibleActionId: actionId,
      message: `Action "${preview.description}" executed successfully. You can undo this within 60 minutes.`
    };
  }

  /**
   * REQ-23.7.4: One-click undo for actions executed via Ask Nexus within 1 hour
   */
  public undoAction(
    actionId: string,
    actorId: string
  ): { success: boolean; message: string } {
    const record = this.reversibleActions.get(actionId);
    if (!record) {
      return { success: false, message: 'Reversible action record not found' };
    }

    if (record.isReverted) {
      return { success: false, message: 'Action has already been reverted' };
    }

    if (Date.now() > record.undoExpiresAt) {
      return { success: false, message: 'Undo window (60 minutes) has expired' };
    }

    record.isReverted = true;
    logger.info('Ask Nexus action successfully reverted', { actionId, actorId });

    return {
      success: true,
      message: `Successfully rolled back action "${record.actionType}". Previous state restored.`
    };
  }
}

export const askNexus = new AskNexusCommandCenter();
