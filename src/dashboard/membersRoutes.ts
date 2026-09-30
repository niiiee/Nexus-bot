import { Router, Request, Response } from 'express';
import { dbService } from '../database/connection.js';
import { creditLedgerService } from '../modules/economy/creditLedger.js';
import { requireOwnerAuth } from './authRoutes.js';
import { logger } from '../utils/logger.js';

export const membersRouter = Router();

/**
 * List members with search and pagination
 */
membersRouter.get('/members', requireOwnerAuth, (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.min(50, Math.max(5, parseInt(req.query.pageSize as string, 10) || 15));
  const offset = (page - 1) * pageSize;

  let sql = `SELECT user_id, guild_id, username, seniority_level, credits, xp, reputation_score, lifecycle_stage, is_restricted, created_at 
             FROM members WHERE 1=1`;
  const params: (string | number)[] = [];

  if (query) {
    sql += ` AND (user_id LIKE ? OR username LIKE ? OR seniority_level LIKE ?)`;
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  const countRow = dbService.get<{ total: number }>(
    `SELECT COUNT(*) as total FROM members WHERE 1=1 ${query ? 'AND (user_id LIKE ? OR username LIKE ? OR seniority_level LIKE ?)' : ''}`,
    ...params
  );
  const total = countRow?.total || 0;

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const members = dbService.all(sql, ...params);

  res.json({
    members,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

/**
 * Get individual member profile and history
 */
membersRouter.get('/members/:id', requireOwnerAuth, (req: Request, res: Response) => {
  const userId = req.params.id;

  const member = dbService.get(
    `SELECT * FROM members WHERE user_id = ?`,
    userId
  );

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Recent task submissions
  const submissions = dbService.all(
    `SELECT * FROM task_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
    userId
  );

  // Vetting history
  const vetting = dbService.all(
    `SELECT * FROM vetting_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`,
    userId
  );

  // Badges
  const badges = dbService.all(
    `SELECT * FROM member_badges WHERE user_id = ? ORDER BY granted_at DESC`,
    userId
  );

  res.json({
    member,
    submissions,
    vetting,
    badges,
  });
});

/**
 * Adjust credits balance
 */
membersRouter.patch('/members/:id/credits', requireOwnerAuth, (req: Request, res: Response) => {
  const userId = req.params.id;
  const { amount, reason, guildId } = req.body;

  if (typeof amount !== 'number') {
    res.status(400).json({ error: 'Amount must be a number' });
    return;
  }

  const targetGuildId = guildId || 'default_guild';
  const result = creditLedgerService.recordTransaction({
    userId,
    guildId: targetGuildId,
    amount,
    type: 'admin_grant',
    description: reason || 'Owner dashboard credit adjustment',
    bypassCap: true,
  });

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    success: true,
    newBalance: result.transaction?.balanceAfter,
  });
});

/**
 * Override member role
 */
membersRouter.patch('/members/:id/role', requireOwnerAuth, (req: Request, res: Response) => {
  const userId = req.params.id;
  const { seniorityLevel } = req.body;

  if (!seniorityLevel) {
    res.status(400).json({ error: 'seniorityLevel is required' });
    return;
  }

  dbService.run(
    `UPDATE members SET seniority_level = ? WHERE user_id = ?`,
    seniorityLevel,
    userId
  );

  logger.info(`[Dashboard] Member ${userId} role overridden to ${seniorityLevel}`);
  res.json({ success: true, seniorityLevel });
});

/**
 * Freeze or unfreeze member account
 */
membersRouter.post('/members/:id/freeze', requireOwnerAuth, (req: Request, res: Response) => {
  const userId = req.params.id;
  const { freeze } = req.body;

  const isRestricted = freeze ? 1 : 0;
  dbService.run(
    `UPDATE members SET is_restricted = ? WHERE user_id = ?`,
    isRestricted,
    userId
  );

  logger.info(`[Dashboard] Member ${userId} restriction set to ${isRestricted}`);
  res.json({ success: true, isRestricted });
});
