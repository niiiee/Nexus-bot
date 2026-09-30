import { dbService } from '../../database/connection.js';

export interface GuildConfigState {
  welcome_channel_id?: string;
  staff_review_channel_id?: string;
  showcase_channel_id?: string;
  help_channel_id?: string;
  audit_logs_channel_id?: string;
  suspicion_threshold?: number;
  anti_raid_enabled?: number;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
}

export interface ConfigDiffEntry {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  action: 'added' | 'modified' | 'removed' | 'unchanged';
}

export interface SimulationResult {
  guildId: string;
  isSafe: boolean;
  diffs: ConfigDiffEntry[];
  warnings: string[];
  safeToApply: boolean;
}

export class SetupSimulator {
  /**
   * REQ-26.187: Preview guild configuration changes on an emulated guild before real application
   */
  public simulateConfigChange(guildId: string, proposedChanges: Partial<GuildConfigState>): SimulationResult {
    const current = dbService.get<GuildConfigState>(
      `SELECT welcome_channel_id, staff_review_channel_id, showcase_channel_id,
              help_channel_id, audit_logs_channel_id, suspicion_threshold,
              anti_raid_enabled, quiet_hours_start, quiet_hours_end
       FROM guild_configs
       WHERE guild_id = ?`,
      guildId
    ) || {};

    const diffs: ConfigDiffEntry[] = [];
    const warnings: string[] = [];

    const keys = Object.keys(proposedChanges) as Array<keyof GuildConfigState>;

    for (const key of keys) {
      const oldVal = current[key];
      const newVal = proposedChanges[key];

      if (oldVal === undefined && newVal !== undefined) {
        diffs.push({ key, oldValue: null, newValue: newVal, action: 'added' });
      } else if (oldVal !== undefined && newVal === undefined) {
        diffs.push({ key, oldValue: oldVal, newValue: null, action: 'removed' });
      } else if (oldVal !== newVal) {
        diffs.push({ key, oldValue: oldVal, newValue: newVal, action: 'modified' });
      } else {
        diffs.push({ key, oldValue: oldVal, newValue: newVal, action: 'unchanged' });
      }
    }

    // Safety Audits
    if (proposedChanges.suspicion_threshold !== undefined) {
      if (proposedChanges.suspicion_threshold < 0.1 || proposedChanges.suspicion_threshold > 0.95) {
        warnings.push(`Suspicion threshold (${proposedChanges.suspicion_threshold}) is dangerously extreme. Recommended range: 0.50 - 0.85.`);
      }
    }

    if (proposedChanges.anti_raid_enabled === 0) {
      warnings.push('Disabling anti-raid protection exposes the guild to token flood attacks.');
    }

    if (
      proposedChanges.quiet_hours_start !== undefined &&
      proposedChanges.quiet_hours_end !== undefined
    ) {
      if (proposedChanges.quiet_hours_start === proposedChanges.quiet_hours_end) {
        warnings.push('Quiet hours start and end are identical, resulting in 0-hour quiet period.');
      }
    }

    if (proposedChanges.staff_review_channel_id === proposedChanges.welcome_channel_id && proposedChanges.staff_review_channel_id) {
      warnings.push('CRITICAL: Staff review channel cannot be the same as the public welcome channel.');
    }

    const hasCriticalWarning = warnings.some((w) => w.startsWith('CRITICAL'));
    const isSafe = !hasCriticalWarning;

    return {
      guildId,
      isSafe,
      diffs,
      warnings,
      safeToApply: isSafe
    };
  }
}

export const setupSimulator = new SetupSimulator();
