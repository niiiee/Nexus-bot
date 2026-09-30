import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { rulesEngine } from '../rules/rulesEngine.js';

export interface ShadowActionEntry {
  id: string;
  guildId: string;
  userId: string;
  ruleId: string;
  wouldBeAction: string;
  contextSnippet: string;
  evaluatedAt: number;
}

export interface ShadowModeSummary {
  guildId: string;
  totalEvaluated: number;
  wouldBeViolations: number;
  violationRatePercent: number;
  actionBreakdown: Record<string, number>;
  latestEntries: ShadowActionEntry[];
}

export class ShadowModeCoordinator {
  /**
   * REQ-26.192: Process message in Shadow Mode with ZERO live Discord/Telegram/DB side-effects
   */
  public processShadowMessage(params: {
    guildId: string;
    userId: string;
    content: string;
    language?: 'en' | 'ar';
  }): { wouldTrigger: boolean; ruleId?: string; wouldBeAction?: string } {
    const { guildId, userId, content, language = 'en' } = params;

    // Evaluate message with rulesEngine in shadow mode
    const result = rulesEngine.evaluateMessage({
      guildId,
      userId,
      content,
      language,
      isShadow: true
    });

    if (result.isViolation) {
      const id = `shadow_${cryptoRandomUUID().substring(0, 8)}`;
      const now = Date.now();

      // Log exclusively to shadow_action_logs for telemetry analysis
      dbService.run(
        `INSERT INTO shadow_action_logs (
           id, guild_id, user_id, rule_id, would_be_action, context_snippet, evaluated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        guildId,
        userId,
        result.ruleId,
        result.actionTaken,
        content.substring(0, 100),
        now
      );

      return {
        wouldTrigger: true,
        ruleId: result.ruleId,
        wouldBeAction: result.actionTaken
      };
    }

    return { wouldTrigger: false };
  }

  public getShadowSummary(guildId: string): ShadowModeSummary {
    const entries = dbService.all<{
      id: string;
      guild_id: string;
      user_id: string;
      rule_id: string;
      would_be_action: string;
      context_snippet: string;
      evaluated_at: number;
    }>(
      `SELECT id, guild_id, user_id, rule_id, would_be_action, context_snippet, evaluated_at
       FROM shadow_action_logs
       WHERE guild_id = ?
       ORDER BY evaluated_at DESC`,
      guildId
    );

    const actionBreakdown: Record<string, number> = {};
    for (const e of entries) {
      actionBreakdown[e.would_be_action] = (actionBreakdown[e.would_be_action] || 0) + 1;
    }

    const totalEvaluated = entries.length;

    return {
      guildId,
      totalEvaluated,
      wouldBeViolations: entries.length,
      violationRatePercent: totalEvaluated > 0 ? 100 : 0,
      actionBreakdown,
      latestEntries: entries.slice(0, 10).map((e) => ({
        id: e.id,
        guildId: e.guild_id,
        userId: e.user_id,
        ruleId: e.rule_id,
        wouldBeAction: e.would_be_action,
        contextSnippet: e.context_snippet,
        evaluatedAt: e.evaluated_at
      }))
    };
  }
}

export const shadowModeCoordinator = new ShadowModeCoordinator();
