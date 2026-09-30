import { Router, Request, Response } from 'express';
import { dbService } from '../database/connection.js';
import { requireOwnerAuth } from './authRoutes.js';
import { logger } from '../utils/logger.js';

export const escrowRouter = Router();

/**
 * List all escrow deals
 */
escrowRouter.get('/escrows', requireOwnerAuth, (req: Request, res: Response) => {
  const status = req.query.status as string;
  let sql = `SELECT * FROM deals`;
  const params: (string | number)[] = [];

  if (status) {
    sql += ` WHERE status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT 50`;
  const deals = dbService.all(sql, ...params);

  res.json({ deals });
});

/**
 * List all open disputes
 */
escrowRouter.get('/escrows/disputes', requireOwnerAuth, (req: Request, res: Response) => {
  const disputes = dbService.all(
    `SELECT * FROM deal_disputes WHERE status = 'open' ORDER BY created_at DESC`
  );
  res.json({ disputes });
});

/**
 * Emergency owner override release for a deal
 */
escrowRouter.post('/escrows/:id/override-release', requireOwnerAuth, (req: Request, res: Response) => {
  const dealId = req.params.id;
  const { recipient, reason } = req.body; // 'freelancer' | 'client'

  const deal = dbService.get<{
    id: string;
    client_id: string;
    freelancer_id: string;
    amount: number;
    status: string;
  }>(`SELECT * FROM deals WHERE id = ?`, dealId);

  if (!deal) {
    res.status(404).json({ error: 'Deal not found' });
    return;
  }

  const targetUserId = recipient === 'client' ? deal.client_id : deal.freelancer_id;

  dbService.run(
    `UPDATE deals SET status = 'completed', closed_at = ? WHERE id = ?`,
    Date.now(),
    dealId
  );

  logger.warn(`[Dashboard] Owner override-released deal ${dealId} to ${recipient} (${targetUserId}): ${reason}`);

  res.json({
    success: true,
    dealId,
    recipient,
    targetUserId,
    amount: deal.amount,
    reason,
  });
});

/**
 * Update Middleman status or tier
 */
escrowRouter.post('/escrows/middlemen/:id/tier', requireOwnerAuth, (req: Request, res: Response) => {
  const userId = req.params.id;
  const { tier, isSuspended } = req.body;

  dbService.run(
    `UPDATE middlemen SET tier = COALESCE(?, tier), is_suspended = COALESCE(?, is_suspended) WHERE user_id = ?`,
    tier || null,
    isSuspended !== undefined ? (isSuspended ? 1 : 0) : null,
    userId
  );

  logger.info(`[Dashboard] Updated middleman ${userId}: tier=${tier}, suspended=${isSuspended}`);
  res.json({ success: true, userId, tier, isSuspended });
});
