import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export type MiddlemanTier = 'Trainee' | 'Middleman' | 'Senior Middleman' | 'Head Middleman';

export interface MiddlemanProfile {
  userId: string;
  guildId: string;
  tier: MiddlemanTier;
  maxDealSize: number;
  completedDeals: number;
  disputedDeals: number;
  rating: number;
  isSuspended: boolean;
  feePercentage: number;
}

export const TIER_LIMITS: Record<MiddlemanTier, number> = {
  Trainee: 500,
  Middleman: 2000,
  'Senior Middleman': 10000,
  'Head Middleman': 1000000,
};

export class MiddlemanDirectoryService {
  public registerOrUpdateMiddleman(params: {
    userId: string;
    guildId: string;
    tier: MiddlemanTier;
    feePercentage?: number;
  }): MiddlemanProfile {
    const maxDealSize = TIER_LIMITS[params.tier];
    const feePercentage = params.feePercentage ?? 3.0;

    const existing = dbService.get<{ user_id: string }>(
      `SELECT user_id FROM middlemen WHERE user_id = ?`,
      params.userId
    );

    if (existing) {
      dbService.run(
        `UPDATE middlemen SET tier = ?, max_deal_size = ?, fee_percentage = ? WHERE user_id = ?`,
        params.tier,
        maxDealSize,
        feePercentage,
        params.userId
      );
    } else {
      dbService.run(
        `INSERT INTO middlemen (user_id, guild_id, tier, max_deal_size, completed_deals, disputed_deals, rating, is_suspended, fee_percentage, created_at)
         VALUES (?, ?, ?, ?, 0, 0, 5.0, 0, ?, ?)`,
        params.userId,
        params.guildId,
        params.tier,
        maxDealSize,
        feePercentage,
        Date.now()
      );
    }

    logger.info('MiddlemanDirectory', `Registered/updated middleman ${params.userId} as ${params.tier}`);

    return {
      userId: params.userId,
      guildId: params.guildId,
      tier: params.tier,
      maxDealSize,
      completedDeals: 0,
      disputedDeals: 0,
      rating: 5.0,
      isSuspended: false,
      feePercentage,
    };
  }

  public getDirectory(guildId: string): MiddlemanProfile[] {
    const rows = dbService.all<{
      user_id: string;
      guild_id: string;
      tier: MiddlemanTier;
      max_deal_size: number;
      completed_deals: number;
      disputed_deals: number;
      rating: number;
      is_suspended: number;
      fee_percentage: number;
    }>(
      `SELECT * FROM middlemen WHERE guild_id = ? AND is_suspended = 0 ORDER BY rating DESC, completed_deals DESC`,
      guildId
    );

    return rows.map((r) => ({
      userId: r.user_id,
      guildId: r.guild_id,
      tier: r.tier,
      maxDealSize: r.max_deal_size,
      completedDeals: r.completed_deals,
      disputedDeals: r.disputed_deals,
      rating: r.rating,
      isSuspended: Boolean(r.is_suspended),
      feePercentage: r.fee_percentage,
    }));
  }

  public verifyAntiImpersonation(
    userId: string,
    claimedUsername: string,
    guildId: string
  ): { isVerifiedMiddleman: boolean; verificationBadge: string } {
    const middleman = dbService.get<{ tier: string; is_suspended: number }>(
      `SELECT tier, is_suspended FROM middlemen WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );

    if (middleman && !middleman.is_suspended) {
      return {
        isVerifiedMiddleman: true,
        verificationBadge: `🛡️ **[VERIFIED OFFICIAL MIDDLEMAN - ${middleman.tier.toUpperCase()}]**`,
      };
    }

    // Check if an unverified user is impersonating middleman terms in their display name
    const lowerName = claimedUsername.toLowerCase();
    if (lowerName.includes('middleman') || lowerName.includes('ضامن') || lowerName.includes('escrow_mod')) {
      logger.warn('MiddlemanDirectory', `Impersonation alert: User ${userId} (${claimedUsername}) using middleman keywords without verification!`);
      return {
        isVerifiedMiddleman: false,
        verificationBadge: '🚨 **[UNVERIFIED - POTENTIAL IMPERSONATOR]**',
      };
    }

    return {
      isVerifiedMiddleman: false,
      verificationBadge: '',
    };
  }
}

export const middlemanDirectoryService = new MiddlemanDirectoryService();
