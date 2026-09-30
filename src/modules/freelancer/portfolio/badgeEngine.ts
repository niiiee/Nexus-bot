import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface BadgeDefinition {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  icon: string;
}

export const COMMUNITY_BADGES: Record<string, BadgeDefinition> = {
  verified_creator: {
    id: 'verified_creator',
    name: 'Verified Creator',
    nameAr: 'مبدع موثق',
    description: 'Successfully verified first real-world project deliverable',
    icon: '🏆',
  },
  task_champion: {
    id: 'task_champion',
    name: 'Task Champion',
    nameAr: 'بطل المهام اليومية',
    description: 'Maintained a 10+ day consecutive daily task streak',
    icon: '🔥',
  },
  master_reviewer: {
    id: 'master_reviewer',
    name: 'Master Reviewer',
    nameAr: 'مراجع خبير',
    description: 'Provided 5+ constructive peer portfolio reviews',
    icon: '🔍',
  },
  trusted_dealmaker: {
    id: 'trusted_dealmaker',
    name: 'Trusted Dealmaker',
    nameAr: 'تاجر موثوق',
    description: 'Completed 3+ dispute-free escrow deals with top satisfaction',
    icon: '🤝',
  },
  century_contributor: {
    id: 'century_contributor',
    name: 'Century Contributor',
    nameAr: 'مساهم مئوي',
    description: 'Completed 20+ community tasks and verified contributions',
    icon: '⭐',
  },
};

export class BadgeEngine {
  public checkAndAwardBadges(userId: string, guildId: string): BadgeDefinition[] {
    const newlyAwarded: BadgeDefinition[] = [];

    // Get currently awarded badge IDs
    const existingRows = dbService.all<{ badge_id: string }>(
      `SELECT badge_id FROM member_badges WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );
    const existingBadges = new Set(existingRows.map((r) => r.badge_id));

    // 1. Check verified creator
    if (!existingBadges.has('verified_creator')) {
      const verified = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM work_submissions WHERE user_id = ? AND guild_id = ? AND status = 'approved'`,
        userId,
        guildId
      )?.count || 0;

      if (verified >= 1) {
        this.grantBadge(userId, guildId, 'verified_creator');
        newlyAwarded.push(COMMUNITY_BADGES.verified_creator);
      }
    }

    // 2. Check task champion (streak >= 10)
    if (!existingBadges.has('task_champion')) {
      const member = dbService.get<{ current_streak: number }>(
        `SELECT current_streak FROM members WHERE user_id = ? AND guild_id = ?`,
        userId,
        guildId
      );

      if (member && member.current_streak >= 10) {
        this.grantBadge(userId, guildId, 'task_champion');
        newlyAwarded.push(COMMUNITY_BADGES.task_champion);
      }
    }

    // 3. Check master reviewer
    if (!existingBadges.has('master_reviewer')) {
      const reviews = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM portfolio_reviews WHERE reviewer_id = ?`,
        userId
      )?.count || 0;

      if (reviews >= 5) {
        this.grantBadge(userId, guildId, 'master_reviewer');
        newlyAwarded.push(COMMUNITY_BADGES.master_reviewer);
      }
    }

    // 4. Check trusted dealmaker
    if (!existingBadges.has('trusted_dealmaker')) {
      const deals = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM deals 
         WHERE guild_id = ? AND (freelancer_id = ? OR client_id = ?) AND status = 'completed'`,
        guildId,
        userId,
        userId
      )?.count || 0;

      if (deals >= 3) {
        this.grantBadge(userId, guildId, 'trusted_dealmaker');
        newlyAwarded.push(COMMUNITY_BADGES.trusted_dealmaker);
      }
    }

    // 5. Check century contributor
    if (!existingBadges.has('century_contributor')) {
      const tasks = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM task_submissions WHERE user_id = ? AND status = 'approved'`,
        userId
      )?.count || 0;

      if (tasks >= 20) {
        this.grantBadge(userId, guildId, 'century_contributor');
        newlyAwarded.push(COMMUNITY_BADGES.century_contributor);
      }
    }

    return newlyAwarded;
  }

  public grantBadge(userId: string, guildId: string, badgeId: string): void {
    const badge = COMMUNITY_BADGES[badgeId];
    if (!badge) return;

    const id = `bdg_${randomUUID().slice(0, 8)}`;
    dbService.run(
      `INSERT INTO member_badges (id, user_id, guild_id, badge_id, badge_name, granted_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      userId,
      guildId,
      badge.id,
      badge.name,
      Date.now()
    );

    logger.info('BadgeEngine', `Granted badge ${badge.name} to user ${userId}`);
  }

  public getMemberBadges(userId: string, guildId: string): BadgeDefinition[] {
    const rows = dbService.all<{ badge_id: string }>(
      `SELECT badge_id FROM member_badges WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );

    return rows.map((r) => COMMUNITY_BADGES[r.badge_id]).filter(Boolean);
  }
}

export const badgeEngine = new BadgeEngine();
