import { Router, Request, Response } from 'express';
import { requireOwnerAuth } from './authRoutes.js';
import { supplyDemandEngine } from '../modules/outreach/supplyDemandEngine.js';
import { outreachReviewQueue } from '../modules/outreach/outreachReviewQueue.js';
import { outreachRulesGuard } from '../modules/outreach/rulesGuard.js';
import { attributionFunnelService } from '../modules/outreach/attributionFunnel.js';
import { logger } from '../utils/logger.js';

export const outreachRouter = Router();

/**
 * REQ-21.1.6: Visual Dashboard Gap Heatmap & Alerts
 */
outreachRouter.get('/outreach/gaps', requireOwnerAuth, (req: Request, res: Response) => {
  const guildId = (req.query.guildId as string) || 'default-guild';
  const heatmap = supplyDemandEngine.generateFullHeatmap(guildId);
  const alerts = supplyDemandEngine.evaluateAlerts(guildId);

  res.json({
    guildId,
    heatmap,
    alerts,
    timestamp: Date.now(),
  });
});

/**
 * REQ-21.6.1: Pending Review Queue items
 */
outreachRouter.get('/outreach/reviews', requireOwnerAuth, (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const reviews = outreachReviewQueue.getPendingReviews(limit);
  const queueStats = outreachReviewQueue.getQueueStats();

  res.json({
    reviews,
    queueStats,
    count: reviews.length,
  });
});

/**
 * REQ-21.6.1: Approve draft reply
 */
outreachRouter.post('/outreach/reviews/:id/approve', requireOwnerAuth, async (req: Request, res: Response) => {
  const reviewerId = (req as Request & { user?: { id?: string } }).user?.id || 'dashboard-owner';
  const result = await outreachReviewQueue.approve(req.params.id, reviewerId);

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

/**
 * REQ-21.6.1: Edit and approve draft reply
 */
outreachRouter.post('/outreach/reviews/:id/edit', requireOwnerAuth, async (req: Request, res: Response) => {
  const reviewerId = (req as Request & { user?: { id?: string } }).user?.id || 'dashboard-owner';
  const { editedReply } = req.body;

  if (!editedReply || typeof editedReply !== 'string') {
    res.status(400).json({ success: false, error: 'editedReply string is required' });
    return;
  }

  const result = await outreachReviewQueue.edit(req.params.id, editedReply, reviewerId);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

/**
 * REQ-21.6.1: Reject draft reply
 */
outreachRouter.post('/outreach/reviews/:id/reject', requireOwnerAuth, (req: Request, res: Response) => {
  const reviewerId = (req as Request & { user?: { id?: string } }).user?.id || 'dashboard-owner';
  const { reason } = req.body;

  const result = outreachReviewQueue.reject(req.params.id, reviewerId, reason || 'Rejected via Dashboard');
  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

/**
 * REQ-21.6.1: Mark candidate as Do Not Post
 */
outreachRouter.post('/outreach/reviews/:id/do-not-post', requireOwnerAuth, (req: Request, res: Response) => {
  const reviewerId = (req as Request & { user?: { id?: string } }).user?.id || 'dashboard-owner';
  const { reason } = req.body;

  const result = outreachReviewQueue.markDoNotPost(req.params.id, reviewerId, reason || 'Marked Do Not Post via Dashboard');
  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

/**
 * REQ-21.0.9 & REQ-21.6.5: Emergency Kill Switch Status & Toggle
 */
outreachRouter.get('/outreach/kill-switch', requireOwnerAuth, (req: Request, res: Response) => {
  res.json({
    active: outreachRulesGuard.isKillSwitchActive(),
    reason: outreachRulesGuard.getKillSwitchReason(),
  });
});

outreachRouter.post('/outreach/kill-switch', requireOwnerAuth, (req: Request, res: Response) => {
  const { active, reason } = req.body;
  if (typeof active !== 'boolean') {
    res.status(400).json({ error: 'active boolean flag is required' });
    return;
  }

  outreachRulesGuard.setKillSwitch(active, reason || 'Toggled via Web Dashboard');
  logger.warn(`[Dashboard] Outreach Kill Switch set to ${active} by owner`);

  res.json({
    success: true,
    active: outreachRulesGuard.isKillSwitchActive(),
    reason: outreachRulesGuard.getKillSwitchReason(),
  });
});

/**
 * REQ-21.7.1: Funnel & Performance Attribution Stats
 */
outreachRouter.get('/outreach/stats', requireOwnerAuth, (req: Request, res: Response) => {
  const campaignCode = req.query.campaignCode as string | undefined;
  const funnel = attributionFunnelService.getFunnelMetrics(campaignCode);
  const stoplist = outreachRulesGuard.getStoplist();
  const queueStats = outreachReviewQueue.getQueueStats();
  const learningDataset = attributionFunnelService.getLearningDataset(10);

  res.json({
    funnel,
    stoplistCount: stoplist.length,
    queueStats,
    learningExamplesCount: learningDataset.length,
  });
});

/**
 * REQ-21.7.4: Weekly Intelligence Digest Report
 */
outreachRouter.get('/outreach/report', requireOwnerAuth, (req: Request, res: Response) => {
  const guildId = (req.query.guildId as string) || 'default-guild';
  const report = attributionFunnelService.generateWeeklyReport(guildId);
  res.json({ report });
});

/**
 * REQ-21.7.2: Moderator Signal Handler & Auto-Pause Trigger
 */
outreachRouter.post('/outreach/moderator-signal', requireOwnerAuth, (req: Request, res: Response) => {
  const { platform, community, signal, note } = req.body;
  if (!platform || !community || !signal) {
    res.status(400).json({ error: 'platform, community, and signal are required' });
    return;
  }

  const result = attributionFunnelService.handleModeratorSignal(platform, community, signal, note);
  res.json(result);
});

/**
 * REQ-21.0.7: Stoplist Management
 */
outreachRouter.get('/outreach/stoplist', requireOwnerAuth, (req: Request, res: Response) => {
  const stoplist = outreachRulesGuard.getStoplist();
  res.json({ stoplist, count: stoplist.length });
});

outreachRouter.post('/outreach/stoplist', requireOwnerAuth, (req: Request, res: Response) => {
  const { targetIdentifier, platform, reason } = req.body;
  if (!targetIdentifier) {
    res.status(400).json({ error: 'targetIdentifier is required' });
    return;
  }

  outreachRulesGuard.addToStoplist(targetIdentifier, platform || 'global', reason || 'Added via Web Dashboard');
  res.json({ success: true, targetIdentifier, platform: platform || 'global' });
});
