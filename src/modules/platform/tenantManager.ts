import crypto from 'node:crypto';
import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export type TenantTemplate = 'freelancer_hub' | 'design_studio' | 'dev_community' | 'course_community';
export type PlanTier = 'free' | 'pro' | 'business' | 'enterprise';

export interface TenantRecord {
  id: string;
  guild_id: string;
  name: string;
  template: TenantTemplate;
  plan_tier: PlanTier;
  custom_domain: string | null;
  status: 'active' | 'suspended' | 'deleted';
  quota_members: number;
  quota_ai_calls: number;
  quota_storage_mb: number;
  encryption_salt: string;
  created_at: number;
  updated_at: number;
}

export interface TenantUsageRecord {
  tenant_id: string;
  month_key: string;
  ai_calls_count: number;
  ai_tokens_count: number;
  storage_bytes: number;
  api_calls_count: number;
}

export interface ProvisionTenantOptions {
  guildId: string;
  name: string;
  template?: TenantTemplate;
  planTier?: PlanTier;
  customDomain?: string;
  actorId?: string;
}

export interface BlueprintChannel {
  name: string;
  type: 'text' | 'voice' | 'forum';
  topic: string;
}

export interface BlueprintRole {
  name: string;
  color: string;
  permissions: string[];
}

export class TenantManager {
  private tenantRateLimits = new Map<string, { requests: number; windowStart: number }>();

  /**
   * REQ-23.1.1: Provision a new tenant with dedicated encryption salt and quotas
   */
  public provisionTenant(options: ProvisionTenantOptions): TenantRecord {
    const existing = dbService.get<TenantRecord>(
      `SELECT * FROM tenants WHERE guild_id = ?`,
      options.guildId
    );

    if (existing && existing.status !== 'deleted') {
      return existing;
    }

    const tenantId = cryptoRandomUUID();
    const template = options.template || 'freelancer_hub';
    const planTier = options.planTier || 'free';
    const salt = crypto.randomBytes(16).toString('hex');
    const now = Date.now();

    // Default quotas based on plan tier
    const quotas = this.getDefaultQuotas(planTier);

    if (existing) {
      dbService.run(
        `UPDATE tenants
         SET id = ?, name = ?, template = ?, plan_tier = ?, custom_domain = ?,
             status = 'active', quota_members = ?, quota_ai_calls = ?,
             quota_storage_mb = ?, encryption_salt = ?, created_at = ?, updated_at = ?
         WHERE guild_id = ?`,
        tenantId,
        options.name,
        template,
        planTier,
        options.customDomain || null,
        quotas.members,
        quotas.aiCalls,
        quotas.storageMb,
        salt,
        now,
        now,
        options.guildId
      );
    } else {
      dbService.run(
        `INSERT INTO tenants (
           id, guild_id, name, template, plan_tier, custom_domain, status,
           quota_members, quota_ai_calls, quota_storage_mb, encryption_salt,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
        tenantId,
        options.guildId,
        options.name,
        template,
        planTier,
        options.customDomain || null,
        quotas.members,
        quotas.aiCalls,
        quotas.storageMb,
        salt,
        now,
        now
      );
    }

    // Initialize usage row for current month
    const monthKey = new Date(now).toISOString().slice(0, 7);
    dbService.run(
      `INSERT INTO tenant_usage (
         id, tenant_id, month_key, ai_calls_count, ai_tokens_count,
         storage_bytes, api_calls_count, updated_at
       ) VALUES (?, ?, ?, 0, 0, 0, 0, ?)`,
      cryptoRandomUUID(),
      tenantId,
      monthKey,
      now
    );

    // Audit log
    this.logTenantAudit(
      tenantId,
      'TENANT_PROVISIONED',
      options.actorId || 'system',
      'owner',
      { guildId: options.guildId, planTier, template }
    );

    logger.info(`[TenantManager] Provisioned tenant ${tenantId} for guild ${options.guildId} (${template})`);
    return this.getTenant(tenantId)!;
  }

  /**
   * Fetch tenant record by Tenant UUID or Discord Guild ID
   */
  public getTenant(idOrGuildId: string): TenantRecord | null {
    const tenant = dbService.get<TenantRecord>(
      `SELECT * FROM tenants WHERE (id = ? OR guild_id = ?) AND status != 'deleted'`,
      idOrGuildId,
      idOrGuildId
    );
    return tenant || null;
  }

  public getTenantById(id: string): TenantRecord | null {
    return this.getTenant(id);
  }

  public getTenantByGuild(guildId: string): TenantRecord | null {
    return this.getTenant(guildId);
  }

  public getUsage(tenantId: string, monthKey?: string): TenantUsageRecord {
    return this.getTenantUsage(tenantId, monthKey);
  }

  public seedDemoSandbox(): TenantRecord {
    return this.seedDemoTenant();
  }

  public resetDemoSandbox(): TenantRecord {
    return this.resetDemoTenant();
  }

  /**
   * List all active tenants (super-admin view)
   */
  public listTenants(limit = 100, offset = 0): { tenants: TenantRecord[]; total: number } {
    const rows = dbService.all<TenantRecord>(
      `SELECT * FROM tenants WHERE status != 'deleted' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      limit,
      offset
    );
    const countRow = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM tenants WHERE status != 'deleted'`
    );
    return { tenants: rows, total: countRow?.count || 0 };
  }

  /**
   * REQ-23.1.2: Template onboarding wizard provisioning blueprints
   */
  public getTemplateBlueprint(template: TenantTemplate): {
    channels: BlueprintChannel[];
    roles: BlueprintRole[];
  } {
    switch (template) {
      case 'design_studio':
        return {
          channels: [
            { name: 'critique-gallery', type: 'forum', topic: 'Visual design feedback and peer review' },
            { name: 'accessibility-audits', type: 'text', topic: 'WCAG contrast and UX checks' },
            { name: 'figma-collab', type: 'text', topic: 'Live design files and sprint syncs' },
            { name: 'escrow-deals', type: 'text', topic: 'Middleman-backed client deliverables' },
          ],
          roles: [
            { name: 'Lead Designer', color: '#E91E63', permissions: ['review_designs', 'verify_skills'] },
            { name: 'UI/UX Specialist', color: '#9C27B0', permissions: ['post_critiques'] },
            { name: 'Apprentice Designer', color: '#03A9F4', permissions: ['submit_work'] },
          ],
        };
      case 'dev_community':
      case 'course_community':
      case 'freelancer_hub':
      default:
        return {
          channels: [
            { name: 'welcome-verify', type: 'text', topic: 'Onboarding and automated skill verification' },
            { name: 'jobs-board', type: 'forum', topic: 'Vetted client freelance job posts' },
            { name: 'escrow-deals', type: 'text', topic: 'Non-custodial milestone deals' },
            { name: 'code-sandbox', type: 'text', topic: 'Interactive bot playground & tests' },
            { name: 'showcase', type: 'forum', topic: 'Peer-reviewed member portfolios' },
          ],
          roles: [
            { name: 'Specialist Freelancer', color: '#FFD700', permissions: ['lead_deals', 'review_prs'] },
            { name: 'Senior Member', color: '#7289DA', permissions: ['apply_jobs', 'take_tests'] },
            { name: 'Verified Member', color: '#43B581', permissions: ['participate_general'] },
          ],
        };
    }
  }

  /**
   * REQ-23.1.3: Noisy-neighbor protection (rate limits per tenant)
   */
  public checkRateLimit(tenantId: string, maxPerMinute = 120): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.tenantRateLimits.get(tenantId) || { requests: 0, windowStart: now };

    if (now - entry.windowStart >= 60000) {
      entry.requests = 1;
      entry.windowStart = now;
      this.tenantRateLimits.set(tenantId, entry);
      return { allowed: true, remaining: maxPerMinute - 1 };
    }

    if (entry.requests >= maxPerMinute) {
      return { allowed: false, remaining: 0 };
    }

    entry.requests++;
    this.tenantRateLimits.set(tenantId, entry);
    return { allowed: true, remaining: maxPerMinute - entry.requests };
  }

  /**
   * REQ-23.1.1 & REQ-23.2.3: Check resource quota before executing operations
   */
  public checkQuota(
    tenantId: string,
    resource: 'members' | 'ai_calls' | 'storage_mb'
  ): { allowed: boolean; current: number; max: number; isSoftLimit: boolean } {
    const tenant = this.getTenant(tenantId);
    if (!tenant) return { allowed: false, current: 0, max: 0, isSoftLimit: false };

    const monthKey = new Date().toISOString().slice(0, 7);
    const usage = this.getTenantUsage(tenantId, monthKey);

    let current = 0;
    let max = 0;

    if (resource === 'ai_calls') {
      current = usage.ai_calls_count;
      max = tenant.quota_ai_calls;
    } else if (resource === 'storage_mb') {
      current = Math.round(usage.storage_bytes / (1024 * 1024));
      max = tenant.quota_storage_mb;
    } else {
      const memberCountRow = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM members WHERE guild_id = ?`,
        tenant.guild_id
      );
      current = memberCountRow?.count || 0;
      max = tenant.quota_members;
    }

    const isSoftLimit = current >= max * 0.85 && current < max;
    const allowed = current < max;

    return { allowed, current, max, isSoftLimit };
  }

  /**
   * Increment usage counters for a tenant
   */
  public recordUsage(
    tenantId: string,
    delta: { aiCalls?: number; aiTokens?: number; storageBytesDelta?: number; apiCalls?: number }
  ): void {
    const monthKey = new Date().toISOString().slice(0, 7);
    const now = Date.now();

    dbService.run(
      `INSERT INTO tenant_usage (
         id, tenant_id, month_key, ai_calls_count, ai_tokens_count,
         storage_bytes, api_calls_count, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, month_key) DO UPDATE SET
         ai_calls_count = ai_calls_count + excluded.ai_calls_count,
         ai_tokens_count = ai_tokens_count + excluded.ai_tokens_count,
         storage_bytes = MAX(0, storage_bytes + excluded.storage_bytes),
         api_calls_count = api_calls_count + excluded.api_calls_count,
         updated_at = excluded.updated_at`,
      cryptoRandomUUID(),
      tenantId,
      monthKey,
      delta.aiCalls || 0,
      delta.aiTokens || 0,
      delta.storageBytesDelta || 0,
      delta.apiCalls || 0,
      now
    );
  }

  /**
   * Retrieve usage metrics for a tenant
   */
  public getTenantUsage(tenantId: string, monthKey?: string): TenantUsageRecord {
    const key = monthKey || new Date().toISOString().slice(0, 7);
    const row = dbService.get<TenantUsageRecord>(
      `SELECT * FROM tenant_usage WHERE tenant_id = ? AND month_key = ?`,
      tenantId,
      key
    );

    return (
      row || {
        tenant_id: tenantId,
        month_key: key,
        ai_calls_count: 0,
        ai_tokens_count: 0,
        storage_bytes: 0,
        api_calls_count: 0,
      }
    );
  }

  /**
   * REQ-23.1.5: Complete hard purge of all tenant data across all tables on request
   */
  public purgeTenant(tenantIdOrGuildId: string, actorId: string, reason = 'Administrative purge request'): { success: boolean; purgedRecords: number } {
    const tenant = this.getTenant(tenantIdOrGuildId);
    if (!tenant) return { success: false, purgedRecords: 0 };

    let totalPurged = 0;
    const actualTenantId = tenant.id;

    dbService.transaction(() => {
      // 1. Delete platform & tenant configuration
      const d1 = dbService.run(`DELETE FROM workflows WHERE tenant_id = ?`, actualTenantId);
      const d2 = dbService.run(`DELETE FROM workflow_runs WHERE tenant_id = ?`, actualTenantId);
      const d3 = dbService.run(`DELETE FROM api_keys WHERE tenant_id = ?`, actualTenantId);
      const d4 = dbService.run(`DELETE FROM outbound_webhooks WHERE tenant_id = ?`, actualTenantId);
      const d5 = dbService.run(`DELETE FROM webhook_deliveries WHERE tenant_id = ?`, actualTenantId);
      const d6 = dbService.run(`DELETE FROM knowledge_articles WHERE tenant_id = ?`, actualTenantId);
      const d7 = dbService.run(`DELETE FROM subscriptions WHERE tenant_id = ?`, actualTenantId);
      const d8 = dbService.run(`DELETE FROM brand_kits WHERE tenant_id = ?`, actualTenantId);
      const d9 = dbService.run(`DELETE FROM tenant_plugins WHERE tenant_id = ?`, actualTenantId);
      const d10 = dbService.run(`DELETE FROM tenant_usage WHERE tenant_id = ?`, actualTenantId);

      // 2. Mark tenant deleted in registry
      dbService.run(
        `UPDATE tenants SET status = 'deleted', updated_at = ? WHERE id = ?`,
        Date.now(),
        actualTenantId
      );

      // 3. Log audit event
      this.logTenantAudit(actualTenantId, 'TENANT_PURGED', actorId, 'owner', { reason });

      totalPurged =
        Number(d1.changes) +
        Number(d2.changes) +
        Number(d3.changes) +
        Number(d4.changes) +
        Number(d5.changes) +
        Number(d6.changes) +
        Number(d7.changes) +
        Number(d8.changes) +
        Number(d9.changes) +
        Number(d10.changes) +
        1;
    });

    logger.info(`[TenantManager] Purged tenant ${actualTenantId}. ${totalPurged} related records removed.`);
    return { success: true, purgedRecords: totalPurged };
  }

  /**
   * REQ-23.A.3: Seed realistic sandbox demo tenant for sales demos with one-click reset
   */
  public seedDemoTenant(): TenantRecord {
    const demoGuildId = 'guild_demo_sandbox_001';
    let tenant = this.getTenant(demoGuildId);

    if (!tenant) {
      tenant = this.provisionTenant({
        guildId: demoGuildId,
        name: 'Nexus Demo Academy & Freelancer Hub',
        template: 'freelancer_hub',
        planTier: 'business',
        customDomain: 'demo.nexuscommunity.io',
        actorId: 'system_demo_seeder',
      });
    }

    // Seed realistic sample knowledge article
    dbService.run(
      `INSERT OR REPLACE INTO knowledge_articles (
         id, tenant_id, title, content, category, contributor_id, upvotes, is_verified, created_at, updated_at
       ) VALUES ('demo_article_01', ?, 'Best Practices for Escrow Milestone Delivery',
         'When delivering milestones in Nexus Escrow, always attach a verification video or git commit hash.',
         'freelancing', 'demo_contributor_1', 42, 1, ?, ?)`,
      tenant.id,
      Date.now(),
      Date.now()
    );

    return tenant;
  }

  /**
   * One-click reset for the sales demo sandbox
   */
  public resetDemoTenant(): TenantRecord {
    const demoGuildId = 'guild_demo_sandbox_001';
    const existing = this.getTenant(demoGuildId);
    if (existing) {
      this.purgeTenant(existing.id, 'demo_reset_trigger', 'Demo sandbox reset request');
    }
    return this.seedDemoTenant();
  }

  private getDefaultQuotas(planTier: PlanTier): { members: number; aiCalls: number; storageMb: number } {
    switch (planTier) {
      case 'pro':
        return { members: 1000, aiCalls: 10000, storageMb: 5000 };
      case 'business':
        return { members: 5000, aiCalls: 50000, storageMb: 25000 };
      case 'enterprise':
        return { members: 25000, aiCalls: 250000, storageMb: 100000 };
      case 'free':
      default:
        return { members: 150, aiCalls: 250, storageMb: 500 };
    }
  }

  private logTenantAudit(
    tenantId: string,
    eventType: string,
    actorId: string,
    actorRole: string,
    details: Record<string, unknown>
  ): void {
    try {
      dbService.run(
        `INSERT INTO tenant_audit_ledger (id, tenant_id, event_type, actor_id, actor_role, details_json, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        cryptoRandomUUID(),
        tenantId,
        eventType,
        actorId,
        actorRole,
        JSON.stringify(details),
        Date.now()
      );
    } catch (err) {
      logger.error('[TenantManager] Failed to log tenant audit event:', err);
    }
  }
}

export const tenantManager = new TenantManager();
