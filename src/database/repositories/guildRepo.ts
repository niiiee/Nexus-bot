import { dbService } from '../connection.js';
import { DEFAULT_THRESHOLDS } from '../../config/constants.js';

export interface GuildConfig {
  guild_id: string;
  welcome_channel_id?: string;
  staff_review_channel_id?: string;
  showcase_channel_id?: string;
  help_channel_id?: string;
  courses_channel_id?: string;
  deals_category_id?: string;
  events_channel_id?: string;
  audit_logs_channel_id?: string;
  larper_role_id?: string;
  verified_role_id?: string;
  staff_role_id?: string;
  owner_role_id?: string;
  suspicion_threshold: number;
  passing_score: number;
  min_restriction_hours: number;
  max_restriction_hours: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
  ai_tone_intensity: number;
  anti_raid_enabled: number;
  created_at: number;
  updated_at: number;
}

export class GuildRepository {
  public get(guildId: string): GuildConfig | undefined {
    return dbService.get<GuildConfig>('SELECT * FROM guild_configs WHERE guild_id = ?', guildId);
  }

  public getOrCreate(guildId: string): GuildConfig {
    const existing = this.get(guildId);
    if (existing) return existing;

    const now = Date.now();
    dbService.run(
      `INSERT INTO guild_configs (
        guild_id, suspicion_threshold, passing_score, min_restriction_hours,
        max_restriction_hours, quiet_hours_start, quiet_hours_end, ai_tone_intensity,
        anti_raid_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      guildId,
      DEFAULT_THRESHOLDS.SUSPICION_ESCALATION,
      DEFAULT_THRESHOLDS.PASSING_TEST_SCORE,
      DEFAULT_THRESHOLDS.MIN_RESTRICTION_HOURS,
      DEFAULT_THRESHOLDS.MAX_RESTRICTION_HOURS,
      DEFAULT_THRESHOLDS.QUIET_HOURS_START_UTC,
      DEFAULT_THRESHOLDS.QUIET_HOURS_END_UTC,
      1.0,
      1,
      now,
      now
    );

    return this.get(guildId)!;
  }

  public getConfig(guildId: string): GuildConfig {
    return this.getOrCreate(guildId);
  }

  public update(guildId: string, partial: Partial<Omit<GuildConfig, 'guild_id' | 'created_at'>>): GuildConfig {
    this.getOrCreate(guildId);
    const keys = Object.keys(partial);
    if (keys.length === 0) return this.get(guildId)!;

    const setClauses = keys.map(k => `${k} = ?`).join(', ') + ', updated_at = ?';
    const values = [...Object.values(partial), Date.now(), guildId];

    dbService.run(`UPDATE guild_configs SET ${setClauses} WHERE guild_id = ?`, ...values as (string | number)[]);
    return this.get(guildId)!;
  }
}

export const guildRepo = new GuildRepository();
