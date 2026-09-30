import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface ConfigLintIssue {
  id: string;
  ruleCode: string;
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  message: string;
  suggestedFix: string;
  canAutoFix: boolean;
}

export interface ConfigLintReport {
  guildId: string;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  advisoryCount: number;
  issues: ConfigLintIssue[];
  isHealthy: boolean;
}

export class ConfigLinter {
  /**
   * REQ-26.188: Lint guild configuration and report risky or conflicting settings with automated fixes
   */
  public lintGuildConfig(guildId: string): ConfigLintReport {
    const config = dbService.get<{
      welcome_channel_id?: string;
      staff_review_channel_id?: string;
      showcase_channel_id?: string;
      help_channel_id?: string;
      audit_logs_channel_id?: string;
      larper_role_id?: string;
      verified_role_id?: string;
      suspicion_threshold?: number;
      anti_raid_enabled?: number;
      quiet_hours_start?: number;
      quiet_hours_end?: number;
    }>(`SELECT * FROM guild_configs WHERE guild_id = ?`, guildId);

    const issues: ConfigLintIssue[] = [];

    if (!config) {
      issues.push({
        id: `lint_${cryptoRandomUUID().substring(0, 8)}`,
        ruleCode: 'LINT-00',
        severity: 'CRITICAL',
        message: 'Guild has not run /setup; configuration missing completely.',
        suggestedFix: 'Run /setup to initialize server roles and channels.',
        canAutoFix: false
      });
      return this.buildReport(guildId, issues);
    }

    // LINT-01: Audit log channel missing
    if (!config.audit_logs_channel_id) {
      issues.push({
        id: `lint_${cryptoRandomUUID().substring(0, 8)}`,
        ruleCode: 'LINT-01',
        severity: 'WARNING',
        message: 'No audit logs channel configured. Critical moderation actions cannot be tracked.',
        suggestedFix: 'Set audit_logs_channel_id to a private staff channel.',
        canAutoFix: false
      });
    }

    // LINT-02: Overlapping staff and public channels
    if (
      config.staff_review_channel_id &&
      config.welcome_channel_id &&
      config.staff_review_channel_id === config.welcome_channel_id
    ) {
      issues.push({
        id: `lint_${cryptoRandomUUID().substring(0, 8)}`,
        ruleCode: 'LINT-02',
        severity: 'CRITICAL',
        message: 'Staff review channel is mapped to public welcome channel!',
        suggestedFix: 'Separate staff review into a restricted channel.',
        canAutoFix: false
      });
    }

    // LINT-03: Anti-raid disabled
    if (config.anti_raid_enabled === 0) {
      issues.push({
        id: `lint_${cryptoRandomUUID().substring(0, 8)}`,
        ruleCode: 'LINT-03',
        severity: 'WARNING',
        message: 'Anti-raid mode is disabled. Guild is vulnerable to bot user raids.',
        suggestedFix: 'Enable anti-raid protection (set anti_raid_enabled = 1).',
        canAutoFix: true
      });
    }

    // LINT-04: Extreme suspicion threshold
    if (
      config.suspicion_threshold !== undefined &&
      (config.suspicion_threshold < 0.2 || config.suspicion_threshold > 0.9)
    ) {
      issues.push({
        id: `lint_${cryptoRandomUUID().substring(0, 8)}`,
        ruleCode: 'LINT-04',
        severity: 'ADVISORY',
        message: `Suspicion threshold (${config.suspicion_threshold}) is unusually configured.`,
        suggestedFix: 'Reset suspicion_threshold to recommended 0.65.',
        canAutoFix: true
      });
    }

    // Persist issues into database
    const now = Date.now();
    for (const issue of issues) {
      dbService.run(
        `INSERT OR REPLACE INTO config_lint_results (
           id, guild_id, rule_code, severity, message, suggested_fix, detected_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        issue.id,
        guildId,
        issue.ruleCode,
        issue.severity,
        issue.message,
        issue.suggestedFix,
        now
      );
    }

    return this.buildReport(guildId, issues);
  }

  /**
   * Apply one-click automated safe fix
   */
  public applyAutoFix(guildId: string, ruleCode: string): { success: boolean; message: string } {
    if (ruleCode === 'LINT-03') {
      dbService.run(`UPDATE guild_configs SET anti_raid_enabled = 1 WHERE guild_id = ?`, guildId);
      return { success: true, message: 'Anti-raid protection enabled.' };
    }

    if (ruleCode === 'LINT-04') {
      dbService.run(`UPDATE guild_configs SET suspicion_threshold = 0.65 WHERE guild_id = ?`, guildId);
      return { success: true, message: 'Suspicion threshold reset to default 0.65.' };
    }

    return { success: false, message: `No automatic fix available for rule ${ruleCode}.` };
  }

  private buildReport(guildId: string, issues: ConfigLintIssue[]): ConfigLintReport {
    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
    const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
    const advisoryCount = issues.filter((i) => i.severity === 'ADVISORY').length;

    return {
      guildId,
      issueCount: issues.length,
      criticalCount,
      warningCount,
      advisoryCount,
      issues,
      isHealthy: criticalCount === 0 && warningCount === 0
    };
  }
}

export const configLinter = new ConfigLinter();
