import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { MiddlemanTier, TIER_LIMITS } from './middlemanDirectory.js';

export class MiddlemanAdminService {
  public suspendMiddleman(userId: string, reason: string): { success: boolean; reassignedDealsCount: number; message: string } {
    dbService.run(`UPDATE middlemen SET is_suspended = 1 WHERE user_id = ?`, userId);

    // Find any open or active deals assigned to this suspended middleman
    const activeDeals = dbService.all<{ id: string }>(
      `SELECT id FROM deals WHERE middleman_id = ? AND status IN ('draft', 'agreed', 'funded')`,
      userId
    );

    logger.warn('MiddlemanAdmin', `Suspended middleman ${userId}: "${reason}". Found ${activeDeals.length} active deals to reassign.`);

    return {
      success: true,
      reassignedDealsCount: activeDeals.length,
      message: `Middleman <@${userId}> has been suspended. ${activeDeals.length} active deals flagged for reassignment.`,
    };
  }

  public promoteMiddleman(userId: string, newTier: MiddlemanTier): { success: boolean; newTier: MiddlemanTier; newCap: number } {
    const newCap = TIER_LIMITS[newTier];
    dbService.run(
      `UPDATE middlemen SET tier = ?, max_deal_size = ? WHERE user_id = ?`,
      newTier,
      newCap,
      userId
    );

    logger.info('MiddlemanAdmin', `Promoted middleman ${userId} to ${newTier} (Cap: $${newCap})`);

    return {
      success: true,
      newTier,
      newCap,
    };
  }

  public getDisputeAnalytics(guildId: string): {
    totalDeals: number;
    disputedDeals: number;
    resolvedDisputes: number;
    avgDisputeResolutionHours: number;
  } {
    const dealRows = dbService.all<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM deals WHERE guild_id = ? GROUP BY status`,
      guildId
    );

    let totalDeals = 0;
    let disputedDeals = 0;
    for (const r of dealRows) {
      totalDeals += r.count;
      if (r.status === 'disputed') disputedDeals += r.count;
    }

    const disputes = dbService.all<{ created_at: number; resolved_at: number }>(
      `SELECT dd.created_at, dd.resolved_at FROM deal_disputes dd
       JOIN deals d ON dd.deal_id = d.id
       WHERE d.guild_id = ? AND dd.status = 'resolved' AND dd.resolved_at IS NOT NULL`,
      guildId
    );

    let totalDurationMs = 0;
    for (const d of disputes) {
      totalDurationMs += (d.resolved_at - d.created_at);
    }
    const avgDisputeResolutionHours = disputes.length > 0 ? parseFloat((totalDurationMs / (disputes.length * 3600 * 1000)).toFixed(2)) : 0;

    return {
      totalDeals,
      disputedDeals,
      resolvedDisputes: disputes.length,
      avgDisputeResolutionHours,
    };
  }
}

export const middlemanAdminService = new MiddlemanAdminService();
