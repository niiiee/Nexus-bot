import { Router, Request, Response } from 'express';
import { dbService } from '../database/connection.js';
import { communityHealthService } from '../modules/growth/communityHealth.js';
import { requireOwnerAuth } from './authRoutes.js';

export const statsRouter = Router();

statsRouter.get('/stats', requireOwnerAuth, (req: Request, res: Response) => {
  const guildId = (req.query.guildId as string) || 'default_guild';

  // 1. Members metrics
  const totalMembers = dbService.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM members`
  )?.count || 0;

  const totalRestricted = dbService.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM members WHERE is_restricted = 1`
  )?.count || 0;

  // 2. Economy metrics
  const totalCredits = dbService.get<{ total: number }>(
    `SELECT COALESCE(SUM(credits), 0) as total FROM members`
  )?.total || 0;

  const ledgerTransactionsCount = dbService.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM credit_ledger`
  )?.count || 0;

  // 3. Escrow metrics
  const activeEscrows = dbService.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM deals WHERE status IN ('funded', 'in_progress')`
  )?.count || 0;

  const completedEscrows = dbService.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM deals WHERE status = 'completed'`
  )?.count || 0;

  const activeDisputes = dbService.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM deal_disputes WHERE status = 'open'`
  )?.count || 0;

  // 4. Community Health
  const health = communityHealthService.computeWeeklyHealth(guildId);

  res.json({
    timestamp: Date.now(),
    guildId,
    members: {
      total: totalMembers,
      restricted: totalRestricted,
      active7d: Math.round(totalMembers * (health.metrics.activeRatio / 100)),
    },
    economy: {
      totalCreditsInCirculation: totalCredits,
      totalLedgerTransactions: ledgerTransactionsCount,
    },
    escrow: {
      activeDeals: activeEscrows,
      completedDeals: completedEscrows,
      openDisputes: activeDisputes,
    },
    communityHealth: {
      overallScore: health.overallScore,
      grade: health.grade,
      metrics: health.metrics,
      recommendations: health.recommendations,
    },
  });
});
