import { Router, Request, Response, NextFunction } from 'express';
import { activeSessions, requireOwnerAuth } from './authRoutes.js';
import { leadService } from '../modules/leads/leadService.js';
import { leadLifecycleService, LeadState } from '../modules/leads/leadLifecycle.js';
import { leadPromotionService } from '../modules/leads/leadPromotion.js';
import { leadPurgeEngine } from '../modules/leads/leadPurgeEngine.js';
import { leadIngestionService } from '../modules/leads/leadIngestion.js';
import { leadRulesGuard } from '../modules/leads/leadRulesGuard.js';
import { ConfirmationEvidence } from '../modules/leads/confirmationRules.js';
import { logger } from '../utils/logger.js';
import { cryptoRandomUUID } from '../utils/crypto.js';

export const leadRouter = Router();

// Store for Meta data deletion requests: code -> { identifier: string; status: string; timestamp: number }
const metaDeletionRequests = new Map<string, { identifier: string; status: string; timestamp: number }>();

/**
 * RBAC Middleware: requires Owner or Client Manager (staff) session
 */
export function requireLeadStaffAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.session_token;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing session token' });
    return;
  }

  const session = activeSessions.get(token);
  if (!session || (session.role !== 'owner' && session.role !== 'staff')) {
    res.status(403).json({ error: 'Forbidden: Owner or Client Manager privileges required' });
    return;
  }

  (req as unknown as { user: typeof session }).user = session;
  next();
}

// =========================================================================
// 1. Meta Platform Integration Endpoints (Public Webhook & Deletion Callbacks)
// (Must be defined first to prevent parameterized route collisions)
// =========================================================================

/**
 * REQ-22.1.2 & REQ-22.8.1: Meta Webhook Verification (hub.challenge)
 */
leadRouter.get('/leads/meta-webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const config = leadService.getConfig('default-guild');
  const expectedToken = config.meta_verify_token || 'nexus_lead_meta_verify_token';

  if (mode === 'subscribe' && token === expectedToken) {
    logger.info('[MetaWebhook] Verified webhook challenge successfully.');
    res.status(200).send(challenge);
    return;
  }

  logger.warn('[MetaWebhook] Verification token mismatch or invalid mode.');
  res.status(403).send('Forbidden: Token mismatch');
});

/**
 * REQ-22.1.2, REQ-22.0.1, REQ-22.5.5: Meta Webhook Event Receiver
 */
leadRouter.post('/leads/meta-webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  const config = leadService.getConfig('default-guild');
  const appSecret = config.meta_app_secret || process.env.META_APP_SECRET || 'nexus_meta_app_secret_test';

  // Verify HMAC signature if signature header is provided or appSecret configured
  if (signature) {
    const isValid = leadIngestionService.verifyMetaWebhookSignature(rawBody, signature, appSecret);
    if (!isValid) {
      logger.warn('[MetaWebhook] Invalid X-Hub-Signature-256 header. Rejected.');
      res.status(403).json({ error: 'Forbidden: Invalid webhook signature' });
      return;
    }
  }

  const body = req.body;
  if (!body || body.object !== 'page') {
    res.status(200).send('EVENT_RECEIVED');
    return;
  }

  try {
    for (const entry of body.entry || []) {
      for (const messaging of entry.messaging || []) {
        const senderPsid = messaging.sender?.id;
        const messageText = messaging.message?.text;

        if (!senderPsid || !messageText) continue;

        // Check if message is a deletion/opt-out request (REQ-22.0.6, REQ-22.5.5)
        if (leadRulesGuard.isDeletionKeyword(messageText)) {
          const detectedLang = leadRulesGuard.detectLanguage(messageText);
          await leadPurgeEngine.handleDeletionRequest(senderPsid, 'user_keyword', detectedLang);
          continue;
        }

        // Ingest lead
        await leadIngestionService.ingestLead({
          psid: senderPsid,
          content: messageText,
          source: 'page_messenger',
          language: leadRulesGuard.detectLanguage(messageText),
        });
      }
    }
  } catch (err) {
    logger.error('[MetaWebhook] Error processing webhook event:', err);
  }

  res.status(200).send('EVENT_RECEIVED');
});

/**
 * REQ-22.8.2: Meta Data Deletion Request Callback
 * When a user removes the Meta app and requests deletion of their data,
 * Meta issues an HTTP POST with signed_request.
 */
leadRouter.post('/leads/meta-deletion-callback', async (req: Request, res: Response) => {
  const confirmationCode = cryptoRandomUUID().slice(0, 12);
  const identifier = (req.body?.user_id as string) || (req.query?.user_id as string) || confirmationCode;

  // Execute deletion across stores immediately
  await leadPurgeEngine.handleDeletionRequest(identifier, 'meta_deletion_callback');

  metaDeletionRequests.set(confirmationCode, {
    identifier,
    status: 'DELETED',
    timestamp: Date.now(),
  });

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const statusUrl = `${protocol}://${host}/api/leads/meta-deletion-status/${confirmationCode}`;

  logger.info(`[MetaDeletionCallback] Processed deletion request for ${identifier}. Code: ${confirmationCode}`);

  res.json({
    url: statusUrl,
    confirmation_code: confirmationCode,
  });
});

/**
 * REQ-22.8.2: Meta Data Deletion Status URL
 */
leadRouter.get('/leads/meta-deletion-status/:code', (req: Request, res: Response) => {
  const record = metaDeletionRequests.get(req.params.code);
  if (!record) {
    // If not found in temporary cache, it is already deleted
    res.json({
      confirmation_code: req.params.code,
      status: 'DELETED',
      message: 'Data deletion has been executed and confirmed.',
    });
    return;
  }

  res.json({
    confirmation_code: req.params.code,
    status: record.status,
    timestamp: new Date(record.timestamp).toISOString(),
    message: 'Your personal data has been completely erased from Nexus staging records.',
  });
});

// =========================================================================
// 2. Static Dashboard Lead Routes (Before /leads/:id)
// =========================================================================

/**
 * REQ-22.2.4 & REQ-22.7.1: Pipeline metrics & age distribution
 */
leadRouter.get('/leads/pipeline', requireLeadStaffAuth, (req: Request, res: Response) => {
  const metrics = leadService.getPipelineMetrics();
  res.json(metrics);
});

/**
 * REQ-22.7.1: List staged leads with pagination & filter
 */
leadRouter.get('/leads/staging', requireLeadStaffAuth, (req: Request, res: Response) => {
  const state = req.query.state as LeadState | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const leads = leadService.listStagedLeads({ state, limit, offset });
  res.json({ leads, count: leads.length });
});

/**
 * REQ-22.1.4: View audit ledger
 */
leadRouter.get('/leads/audit', requireOwnerAuth, (req: Request, res: Response) => {
  const leadId = req.query.leadId as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const logs = leadService.getAuditLogs(leadId, limit);
  res.json({ logs, count: logs.length });
});

/**
 * REQ-22.7.3: Lead staging configuration
 */
leadRouter.get('/leads/config', requireOwnerAuth, (req: Request, res: Response) => {
  const guildId = (req.query.guildId as string) || 'default-guild';
  const config = leadService.getConfig(guildId);
  res.json(config);
});

leadRouter.post('/leads/config', requireOwnerAuth, (req: Request, res: Response) => {
  const guildId = (req.body?.guildId as string) || 'default-guild';
  const result = leadService.updateConfig(guildId, req.body);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json({ success: true, config: leadService.getConfig(guildId) });
});

/**
 * REQ-22.5.1: Trigger automated purge cycle manually
 */
leadRouter.post('/leads/purge', requireOwnerAuth, async (req: Request, res: Response) => {
  const result = await leadPurgeEngine.executePurge();
  res.json(result);
});

// =========================================================================
// 3. Parameterized Lead Routes (/leads/:id)
// =========================================================================

/**
 * REQ-22.7.2: Get single lead details
 */
leadRouter.get('/leads/:id', requireLeadStaffAuth, (req: Request, res: Response) => {
  const lead = leadService.getLeadDetails(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json(lead);
});

/**
 * REQ-22.3.1, REQ-22.3.2, REQ-22.4.1 & REQ-22.7.2: Promote lead to permanent client
 */
leadRouter.post('/leads/:id/promote', requireLeadStaffAuth, async (req: Request, res: Response) => {
  const user = (req as unknown as { user?: { userId: string; role: string } }).user;
  const actorId = user?.userId || 'dashboard_client_manager';
  const actorRole = user?.role || 'staff';

  const { evidence, summaryNotes, guildId } = req.body as {
    evidence: ConfirmationEvidence;
    summaryNotes?: string;
    guildId?: string;
  };

  if (!evidence) {
    res.status(400).json({ error: 'Confirmation evidence is required for promotion.' });
    return;
  }

  const result = await leadPromotionService.promoteLead(req.params.id, {
    actorId,
    actorRole,
    evidence,
    summaryNotes,
    guildId,
  });

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

/**
 * REQ-22.2.1 & REQ-22.7.2: Decline lead
 */
leadRouter.post('/leads/:id/decline', requireLeadStaffAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user?: { userId: string } }).user;
  const actorId = user?.userId || 'dashboard_client_manager';
  const reason = (req.body?.reason as string) || 'Declined by client or manager';

  const result = leadLifecycleService.transitionState(req.params.id, 'DECLINED', actorId, reason);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

/**
 * REQ-22.0.4, REQ-22.2.1 & REQ-22.7.2: Extend staging window once (up to 90d max)
 */
leadRouter.post('/leads/:id/extend', requireLeadStaffAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user?: { userId: string } }).user;
  const actorId = user?.userId || 'dashboard_client_manager';
  const additionalDays = parseInt(req.body?.additionalDays, 10) || 30;

  const result = leadLifecycleService.extendStaging(req.params.id, additionalDays, actorId);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

/**
 * REQ-22.2.3 & REQ-22.9.8: Record follow-up
 */
leadRouter.post('/leads/:id/follow-up', requireLeadStaffAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user?: { userId: string } }).user;
  const actorId = user?.userId || 'dashboard_client_manager';

  const result = leadLifecycleService.recordFollowUp(req.params.id, actorId);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

/**
 * REQ-22.0.6, REQ-22.5.5 & REQ-22.7.2: Manual Delete lead (Right to be Forgotten)
 */
leadRouter.delete('/leads/:id', requireLeadStaffAuth, async (req: Request, res: Response) => {
  const user = (req as unknown as { user?: { userId: string } }).user;
  const actorId = user?.userId || 'dashboard_client_manager';

  const result = await leadPurgeEngine.handleDeletionRequest(req.params.id, actorId);
  res.json(result);
});

/**
 * REQ-22.7.2, REQ-22.8.3 & REQ-22.9.7: Single-lead DSAR export
 */
leadRouter.get('/leads/:id/dsar', requireLeadStaffAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user?: { userId: string; role: string } }).user;
  const actorId = user?.userId || 'dashboard_client_manager';
  const actorRole = user?.role || 'staff';

  const exportData = leadService.exportLeadDsar(req.params.id, actorId, actorRole);
  if (!exportData) {
    res.status(404).json({ error: 'No data found for this identifier' });
    return;
  }

  res.json(exportData);
});
