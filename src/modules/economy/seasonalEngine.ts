import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface SeasonTierReward {
  level: number;
  xpRequired: number;
  freeReward: { credits: number; title?: string };
  prestigeReward: { credits: number; badgeId?: string; exclusiveRole?: string; title?: string };
}

export interface SeasonInfo {
  id: string;
  guildId: string;
  name: string;
  number: number;
  theme: string;
  startsAt: number;
  endsAt: number;
  isActive: boolean;
}

export class SeasonalEngineService {
  // Pre-configured 10-tier seasonal reward track
  public readonly SEASON_REWARDS: SeasonTierReward[] = [
    { level: 1, xpRequired: 100, freeReward: { credits: 50 }, prestigeReward: { credits: 100 } },
    { level: 2, xpRequired: 250, freeReward: { credits: 75 }, prestigeReward: { credits: 150, title: 'Season Pioneer' } },
    { level: 3, xpRequired: 500, freeReward: { credits: 100 }, prestigeReward: { credits: 200 } },
    { level: 4, xpRequired: 800, freeReward: { credits: 125 }, prestigeReward: { credits: 250 } },
    { level: 5, xpRequired: 1200, freeReward: { credits: 150, title: 'Mid-Season Champion' }, prestigeReward: { credits: 300, badgeId: 'season_star' } },
    { level: 6, xpRequired: 1700, freeReward: { credits: 200 }, prestigeReward: { credits: 400 } },
    { level: 7, xpRequired: 2300, freeReward: { credits: 250 }, prestigeReward: { credits: 500 } },
    { level: 8, xpRequired: 3000, freeReward: { credits: 300 }, prestigeReward: { credits: 600 } },
    { level: 9, xpRequired: 3800, freeReward: { credits: 400 }, prestigeReward: { credits: 800 } },
    { level: 10, xpRequired: 5000, freeReward: { credits: 500, title: 'Season Grandmaster' }, prestigeReward: { credits: 1000, badgeId: 'season_grandmaster_elite', exclusiveRole: 'Season MVP' } },
  ];

  /**
   * Retrieves active season for a guild or initializes Season 1.
   */
  public getOrCreateActiveSeason(guildId: string): SeasonInfo {
    const existing = dbService.get<{
      id: string;
      guild_id: string;
      name: string;
      number: number;
      theme: string;
      starts_at: number;
      ends_at: number;
      is_active: number;
    }>(
      `SELECT id, guild_id, name, number, theme, starts_at, ends_at, is_active FROM seasons 
       WHERE guild_id = ? AND is_active = 1 LIMIT 1`,
      guildId
    );

    if (existing) {
      return {
        id: existing.id,
        guildId: existing.guild_id,
        name: existing.name,
        number: existing.number,
        theme: existing.theme,
        startsAt: existing.starts_at,
        endsAt: existing.ends_at,
        isActive: existing.is_active === 1,
      };
    }

    // Create Season 1: Cairo Code Sprint (6 weeks duration)
    const id = cryptoRandomUUID();
    const startsAt = Date.now();
    const endsAt = startsAt + 42 * 24 * 60 * 60 * 1000;

    dbService.run(
      `INSERT INTO seasons (id, guild_id, name, number, theme, starts_at, ends_at, is_active)
       VALUES (?, ?, ?, 1, ?, ?, ?, 1)`,
      id,
      guildId,
      'Season 1: Cairo Code Sprint',
      'Egyptian Tech Renaissance & Freelance Mastery',
      startsAt,
      endsAt
    );

    logger.info(`[SeasonalEngine] Initialized Season 1 for guild ${guildId}`);

    return {
      id,
      guildId,
      name: 'Season 1: Cairo Code Sprint',
      number: 1,
      theme: 'Egyptian Tech Renaissance & Freelance Mastery',
      startsAt,
      endsAt,
      isActive: true,
    };
  }

  /**
   * Calculates member's current seasonal tier and progress.
   */
  public getMemberSeasonProgress(memberXp: number): {
    currentLevel: number;
    currentTier: SeasonTierReward;
    nextTier?: SeasonTierReward;
    progressPercentage: number;
  } {
    let currentLevel = 0;
    let currentTier = this.SEASON_REWARDS[0];
    let nextTier: SeasonTierReward | undefined = this.SEASON_REWARDS[0];

    for (let i = 0; i < this.SEASON_REWARDS.length; i++) {
      if (memberXp >= this.SEASON_REWARDS[i].xpRequired) {
        currentLevel = this.SEASON_REWARDS[i].level;
        currentTier = this.SEASON_REWARDS[i];
        nextTier = this.SEASON_REWARDS[i + 1];
      } else {
        nextTier = this.SEASON_REWARDS[i];
        break;
      }
    }

    const prevXp = currentLevel === 0 ? 0 : currentTier.xpRequired;
    const targetXp = nextTier ? nextTier.xpRequired : currentTier.xpRequired;
    const range = Math.max(1, targetXp - prevXp);
    const progressInTier = Math.max(0, memberXp - prevXp);
    const progressPercentage = Math.min(100, Math.round((progressInTier / range) * 100));

    return {
      currentLevel,
      currentTier,
      nextTier,
      progressPercentage,
    };
  }

  /**
   * Concludes the current season, performs soft prestige reset, and seeds next season.
   */
  public concludeSeasonAndReset(guildId: string): {
    oldSeason: SeasonInfo;
    newSeason: SeasonInfo;
    topWinners: Array<{ userId: string; xp: number }>;
  } {
    const active = this.getOrCreateActiveSeason(guildId);

    // Fetch top 3 members by XP
    const topMembers = dbService.all<{ user_id: string; xp: number }>(
      `SELECT user_id, xp FROM members WHERE guild_id = ? ORDER BY xp DESC LIMIT 3`,
      guildId
    );

    // Award top 3 season podium badges
    const podiumBadges = ['season_gold_trophy', 'season_silver_trophy', 'season_bronze_trophy'];
    topMembers.forEach((m, idx) => {
      dbService.run(
        `INSERT INTO member_badges (id, user_id, guild_id, badge_id, badge_name, granted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        cryptoRandomUUID(),
        m.user_id,
        guildId,
        podiumBadges[idx] || 'season_finalist',
        `Season ${active.number} Podiums`,
        Date.now()
      );
    });

    // Close old season
    dbService.run(`UPDATE seasons SET is_active = 0 WHERE id = ?`, active.id);

    // Initialize next season
    const newNumber = active.number + 1;
    const newId = cryptoRandomUUID();
    const startsAt = Date.now();
    const endsAt = startsAt + 42 * 24 * 60 * 60 * 1000;
    const newName = `Season ${newNumber}: Desert Design & AI Wave`;
    const newTheme = 'AI Orchestration & Arabic UI Innovations';

    dbService.run(
      `INSERT INTO seasons (id, guild_id, name, number, theme, starts_at, ends_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      newId,
      guildId,
      newName,
      newNumber,
      newTheme,
      startsAt,
      endsAt
    );

    // Soft reset: reset season XP counter while keeping credits & all-time reputation intact
    dbService.run(`UPDATE members SET xp = CAST(xp * 0.2 AS INTEGER) WHERE guild_id = ?`, guildId);

    logger.info(`[SeasonalEngine] Concluded Season ${active.number}. Started Season ${newNumber} for guild ${guildId}`);

    return {
      oldSeason: active,
      newSeason: {
        id: newId,
        guildId,
        name: newName,
        number: newNumber,
        theme: newTheme,
        startsAt,
        endsAt,
        isActive: true,
      },
      topWinners: topMembers.map(m => ({ userId: m.user_id, xp: m.xp })),
    };
  }
}

export const seasonalEngineService = new SeasonalEngineService();
