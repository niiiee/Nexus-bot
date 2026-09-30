import crypto from 'node:crypto';
import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { PlanTier, TenantRecord } from '../platform/tenantManager.js';

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  priceUsdMonthly: number;
  quotaMembers: number;
  quotaAiCalls: number;
  quotaStorageMb: number;
  rateLimitPerMin: number;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    name: 'Nexus Community Starter',
    priceUsdMonthly: 0,
    quotaMembers: 150,
    quotaAiCalls: 250,
    quotaStorageMb: 500,
    rateLimitPerMin: 60,
    features: ['basic_moderation', 'freelancer_matching', 'standard_support']
  },
  pro: {
    tier: 'pro',
    name: 'Nexus Professional',
    priceUsdMonthly: 49,
    quotaMembers: 1000,
    quotaAiCalls: 10000,
    quotaStorageMb: 5000,
    rateLimitPerMin: 300,
    features: ['basic_moderation', 'freelancer_matching', 'custom_branding', 'priority_support', 'webhooks']
  },
  business: {
    tier: 'business',
    name: 'Nexus Business',
    priceUsdMonthly: 199,
    quotaMembers: 5000,
    quotaAiCalls: 50000,
    quotaStorageMb: 25000,
    rateLimitPerMin: 1200,
    features: ['all_pro_features', 'white_label', 'custom_domain', 'plugin_runtime', 'dedicated_ip']
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Nexus Enterprise Guild',
    priceUsdMonthly: 799,
    quotaMembers: 25000,
    quotaAiCalls: 250000,
    quotaStorageMb: 100000,
    rateLimitPerMin: 6000,
    features: ['all_business_features', 'sso_saml', 'custom_slas', 'hipaa_compliance', 'air_gapped_llm']
  }
};

export interface SubscriptionRecord {
  id: string;
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_tier: PlanTier;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: number;
  created_at: number;
}

export interface StripeEventPayload {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, any>;
  };
}

export interface OverageReport {
  tenantId: string;
  monthKey: string;
  planTier: PlanTier;
  basePriceUsd: number;
  aiCallsUsed: number;
  aiCallsQuota: number;
  aiCallsOverage: number;
  aiCallsOverageChargeUsd: number;
  storageMbUsed: number;
  storageMbQuota: number;
  storageMbOverage: number;
  storageMbOverageChargeUsd: number;
  totalOverageChargeUsd: number;
  totalBillUsd: number;
  thresholdWarnings: {
    aiCallsPercent: number;
    storagePercent: number;
    needsUpgradeAlert: boolean;
  };
}

export class SubscriptionEngine {
  private webhookSecret: string;
  private processedEvents = new Set<string>();

  constructor(webhookSecret = 'whsec_nexus_live_mock_secret_key_892') {
    this.webhookSecret = webhookSecret;
  }

  /**
   * REQ-23.2.1: Verify Stripe webhook HMAC SHA-256 signature
   */
  public verifyStripeSignature(payloadRaw: string, signatureHeader: string): boolean {
    if (!signatureHeader) return false;
    
    // Parse Stripe signature format: t=timestamp,v1=signature
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let signature = '';

    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') signature = value;
    }

    if (!timestamp || !signature) {
      return false;
    }

    const signedPayload = `${timestamp}.${payloadRaw}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch {
      return false;
    }
  }

  /**
   * REQ-23.2.1: Process incoming Stripe webhook events with idempotency
   */
  public handleWebhookEvent(event: StripeEventPayload): { success: boolean; action: string; duplicate?: boolean } {
    if (this.processedEvents.has(event.id)) {
      logger.info('SubscriptionEngine: Duplicate Stripe event ignored', { eventId: event.id });
      return { success: true, action: 'ignored_duplicate', duplicate: true };
    }

    this.processedEvents.add(event.id);
    const obj = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const tenantId = obj.client_reference_id || obj.metadata?.tenant_id;
        const planTier = (obj.metadata?.plan_tier as PlanTier) || 'pro';
        const customerId = obj.customer as string;
        const subscriptionId = obj.subscription as string;

        if (tenantId) {
          this.activateSubscription(tenantId, planTier, customerId, subscriptionId);
          return { success: true, action: 'activated_subscription' };
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscriptionId = obj.id as string;
        const planTier = (obj.metadata?.plan_tier as PlanTier) || 'pro';
        const status = obj.status === 'past_due' ? 'past_due' : obj.status === 'active' ? 'active' : 'canceled';
        const sub = dbService.get<SubscriptionRecord>(
          `SELECT * FROM subscriptions WHERE stripe_subscription_id = ?`,
          subscriptionId
        );

        if (sub) {
          this.updateSubscriptionStatus(sub.tenant_id, planTier, status);
          return { success: true, action: 'updated_subscription' };
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscriptionId = obj.id as string;
        const sub = dbService.get<SubscriptionRecord>(
          `SELECT * FROM subscriptions WHERE stripe_subscription_id = ?`,
          subscriptionId
        );

        if (sub) {
          this.cancelSubscription(sub.tenant_id);
          return { success: true, action: 'canceled_subscription' };
        }
        break;
      }

      case 'invoice.payment_failed': {
        const customerId = obj.customer as string;
        const sub = dbService.get<SubscriptionRecord>(
          `SELECT * FROM subscriptions WHERE stripe_customer_id = ?`,
          customerId
        );

        if (sub) {
          this.triggerDunning(sub.tenant_id);
          return { success: true, action: 'dunning_triggered' };
        }
        break;
      }
    }

    return { success: true, action: 'noop' };
  }

  /**
   * REQ-23.2.2: Activate a tenant plan and enforce new quota caps
   */
  public activateSubscription(
    tenantId: string,
    tier: PlanTier,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): SubscriptionRecord {
    const config = PLAN_CONFIGS[tier];
    const now = Date.now();
    const periodEnd = now + 30 * 24 * 60 * 60 * 1000;

    // 1. Update or insert subscription row
    const existing = dbService.get<SubscriptionRecord>(
      `SELECT * FROM subscriptions WHERE tenant_id = ?`,
      tenantId
    );

    let subRecord: SubscriptionRecord;

    if (existing) {
      dbService.run(
        `UPDATE subscriptions
         SET stripe_customer_id = COALESCE(?, stripe_customer_id),
             stripe_subscription_id = COALESCE(?, stripe_subscription_id),
             plan_tier = ?,
             status = 'active',
             current_period_start = ?,
             current_period_end = ?,
             cancel_at_period_end = 0
         WHERE tenant_id = ?`,
        stripeCustomerId || null,
        stripeSubscriptionId || null,
        tier,
        now,
        periodEnd,
        tenantId
      );
      subRecord = {
        ...existing,
        plan_tier: tier,
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd
      };
    } else {
      const subId = cryptoRandomUUID();
      dbService.run(
        `INSERT INTO subscriptions (
           id, tenant_id, stripe_customer_id, stripe_subscription_id,
           plan_tier, status, current_period_start, current_period_end,
           cancel_at_period_end, created_at
         ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 0, ?)`,
        subId,
        tenantId,
        stripeCustomerId || null,
        stripeSubscriptionId || null,
        tier,
        now,
        periodEnd,
        now
      );
      subRecord = {
        id: subId,
        tenant_id: tenantId,
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null,
        plan_tier: tier,
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
        cancel_at_period_end: 0,
        created_at: now
      };
    }

    // 2. Enforce new quota limits on tenant row
    dbService.run(
      `UPDATE tenants
       SET plan_tier = ?,
           quota_members = ?,
           quota_ai_calls = ?,
           quota_storage_mb = ?,
           updated_at = ?
       WHERE id = ?`,
      tier,
      config.quotaMembers,
      config.quotaAiCalls,
      config.quotaStorageMb,
      now,
      tenantId
    );

    logger.info('Subscription activated and quotas applied', { tenantId, tier });
    return subRecord;
  }

  public updateSubscriptionStatus(tenantId: string, tier: PlanTier, status: 'active' | 'past_due' | 'canceled'): void {
    const config = PLAN_CONFIGS[tier];
    const now = Date.now();

    dbService.run(
      `UPDATE subscriptions SET plan_tier = ?, status = ? WHERE tenant_id = ?`,
      tier,
      status,
      tenantId
    );

    if (status === 'active') {
      dbService.run(
        `UPDATE tenants
         SET plan_tier = ?, quota_members = ?, quota_ai_calls = ?, quota_storage_mb = ?, updated_at = ?
         WHERE id = ?`,
        tier,
        config.quotaMembers,
        config.quotaAiCalls,
        config.quotaStorageMb,
        now,
        tenantId
      );
    }
  }

  /**
   * Downgrades to free tier when canceled
   */
  public cancelSubscription(tenantId: string): void {
    const freeConfig = PLAN_CONFIGS.free;
    const now = Date.now();

    dbService.run(
      `UPDATE subscriptions SET status = 'canceled', plan_tier = 'free' WHERE tenant_id = ?`,
      tenantId
    );

    dbService.run(
      `UPDATE tenants
       SET plan_tier = 'free',
           quota_members = ?,
           quota_ai_calls = ?,
           quota_storage_mb = ?,
           updated_at = ?
       WHERE id = ?`,
      freeConfig.quotaMembers,
      freeConfig.quotaAiCalls,
      freeConfig.quotaStorageMb,
      now,
      tenantId
    );

    logger.info('Subscription canceled and downgraded to free', { tenantId });
  }

  /**
   * REQ-23.2.5: Dunning management: 7-day grace period
   */
  public triggerDunning(tenantId: string): { gracePeriodEndsAt: number; warningNotice: string } {
    const now = Date.now();
    const gracePeriodDurationMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const gracePeriodEndsAt = now + gracePeriodDurationMs;

    dbService.run(
      `UPDATE subscriptions SET status = 'past_due' WHERE tenant_id = ?`,
      tenantId
    );

    const warningNotice = `Payment failed for your Nexus subscription. You have a 7-day grace period ending on ${new Date(
      gracePeriodEndsAt
    ).toISOString()} before your server is automatically downgraded to the Free tier.`;

    logger.warn('Dunning triggered for tenant', { tenantId, gracePeriodEndsAt });
    return { gracePeriodEndsAt, warningNotice };
  }

  /**
   * Check if past-due subscription exceeded grace period and downgrade if needed
   */
  public evaluateDunningGracePeriod(tenantId: string, gracePeriodStart: number): boolean {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (now - gracePeriodStart > sevenDaysMs) {
      this.cancelSubscription(tenantId);
      return true; // downgraded
    }
    return false; // still in grace
  }

  /**
   * REQ-23.2.3: Metered overage billing calculation ($0.005/extra AI call, $0.10/extra GB storage)
   */
  public calculateOverage(tenantId: string, monthKey?: string): OverageReport {
    const currentMonthKey = monthKey || new Date().toISOString().substring(0, 7);

    const tenant = dbService.get<TenantRecord>(`SELECT * FROM tenants WHERE id = ?`, tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const usage = dbService.get<{
      ai_calls_count: number;
      storage_bytes: number;
    }>(
      `SELECT ai_calls_count, storage_bytes FROM tenant_usage WHERE tenant_id = ? AND month_key = ?`,
      tenantId,
      currentMonthKey
    ) || { ai_calls_count: 0, storage_bytes: 0 };

    const plan = PLAN_CONFIGS[tenant.plan_tier];
    const storageMbUsed = Math.ceil(usage.storage_bytes / (1024 * 1024));

    // Overages
    const aiCallsOverage = Math.max(0, usage.ai_calls_count - tenant.quota_ai_calls);
    const storageMbOverage = Math.max(0, storageMbUsed - tenant.quota_storage_mb);

    // Pricing rates
    const aiCallsRate = 0.005; // $0.005 per extra AI call
    const storageGbRate = 0.10; // $0.10 per extra GB (1024 MB)
    const storageGbOverage = storageMbOverage / 1024;

    const aiCallsOverageChargeUsd = Number((aiCallsOverage * aiCallsRate).toFixed(2));
    const storageMbOverageChargeUsd = Number((storageGbOverage * storageGbRate).toFixed(2));
    const totalOverageChargeUsd = Number((aiCallsOverageChargeUsd + storageMbOverageChargeUsd).toFixed(2));
    const totalBillUsd = Number((plan.priceUsdMonthly + totalOverageChargeUsd).toFixed(2));

    const aiCallsPercent = tenant.quota_ai_calls > 0 ? (usage.ai_calls_count / tenant.quota_ai_calls) * 100 : 0;
    const storagePercent = tenant.quota_storage_mb > 0 ? (storageMbUsed / tenant.quota_storage_mb) * 100 : 0;
    const needsUpgradeAlert = aiCallsPercent >= 80 || storagePercent >= 80;

    return {
      tenantId,
      monthKey: currentMonthKey,
      planTier: tenant.plan_tier,
      basePriceUsd: plan.priceUsdMonthly,
      aiCallsUsed: usage.ai_calls_count,
      aiCallsQuota: tenant.quota_ai_calls,
      aiCallsOverage,
      aiCallsOverageChargeUsd,
      storageMbUsed,
      storageMbQuota: tenant.quota_storage_mb,
      storageMbOverage,
      storageMbOverageChargeUsd,
      totalOverageChargeUsd,
      totalBillUsd,
      thresholdWarnings: {
        aiCallsPercent: Number(aiCallsPercent.toFixed(1)),
        storagePercent: Number(storagePercent.toFixed(1)),
        needsUpgradeAlert
      }
    };
  }

  /**
   * REQ-23.2.4: In-Discord upgrade prompt generator with checkout URL
   */
  public generateUpgradePrompt(
    tenantId: string,
    targetTier: PlanTier,
    lang: 'en' | 'ar' = 'en'
  ): { title: string; body: string; checkoutUrl: string } {
    const targetConfig = PLAN_CONFIGS[targetTier];
    const checkoutUrl = `https://checkout.nexus.platform/pay?tenant=${tenantId}&plan=${targetTier}`;

    if (lang === 'ar') {
      return {
        title: `🚀 ترقية باقة مجتمع نكسس إلى ${targetConfig.name}`,
        body: `لقد اقترب مجتمعك من استنفاد الحصة الشهرية. مع باقة ${targetConfig.name} هتحصل على:\n` +
          `• حتى ${targetConfig.quotaMembers.toLocaleString()} عضو نشط\n` +
          `• ${targetConfig.quotaAiCalls.toLocaleString()} طلب ذكاء اصطناعي شهرياً\n` +
          `• مساحة تخزين ${targetConfig.quotaStorageMb.toLocaleString()} ميجابايت\n` +
          `• تكلفة شهرية: $${targetConfig.priceUsdMonthly}/شهرياً.\n` +
          `إضغط على الرابط أدناه لإتمام عملية الترقية في ثوانٍ.`,
        checkoutUrl
      };
    }

    return {
      title: `🚀 Upgrade your Nexus Guild to ${targetConfig.name}`,
      body: `Your community is approaching its monthly resource threshold. Upgrading to ${targetConfig.name} grants:\n` +
        `• Up to ${targetConfig.quotaMembers.toLocaleString()} active members\n` +
        `• ${targetConfig.quotaAiCalls.toLocaleString()} AI requests / month\n` +
        `• ${targetConfig.quotaStorageMb.toLocaleString()} MB high-speed cloud storage\n` +
        `• Pricing: $${targetConfig.priceUsdMonthly}/month.\n` +
        `Click the secure checkout link below to upgrade instantly.`,
      checkoutUrl
    };
  }
}

/**
 * REQ-24.0.3: Charter Errata Override for Chapter 2
 * Replaces commercial plan gating with universal Fair-Use & Resource Guard protection.
 */
export class FairUseResourceGuard {
  public static readonly UNIFORM_QUOTA = {
    quotaMembers: 50000,
    quotaAiCalls: 100000,
    quotaStorageMb: 50000,
    rateLimitPerMin: 2000
  };

  public static enforceFairUse(tenantId: string): void {
    const now = Date.now();
    dbService.run(
      `UPDATE tenants
       SET plan_tier = 'free',
           quota_members = ?,
           quota_ai_calls = ?,
           quota_storage_mb = ?,
           updated_at = ?
       WHERE id = ?`,
      FairUseResourceGuard.UNIFORM_QUOTA.quotaMembers,
      FairUseResourceGuard.UNIFORM_QUOTA.quotaAiCalls,
      FairUseResourceGuard.UNIFORM_QUOTA.quotaStorageMb,
      now,
      tenantId
    );
    logger.info('Applied Nexus Charter Fair-Use quotas to tenant', { tenantId });
  }

  public static getPassiveDonationPrompt(lang: 'en' | 'ar' = 'en'): { message: string; donationUrl: string } {
    const donationUrl = 'https://nexuscommunity.org/donate';
    if (lang === 'ar') {
      return {
        message: 'نيكسوس مجاني بالكامل لكل الناس بموجب الميثاق. لو حابب تساهم في تكاليف الخوادم والمسابقات بشكل تطوعي (بدون أي مميزات إضافية)، تقدر تتبرع هنا:',
        donationUrl
      };
    }
    return {
      message: 'Nexus is 100% free for everyone under the Nexus Charter. If you wish to voluntarily support infrastructure and prize pools (with zero perks or status), you may donate here:',
      donationUrl
    };
  }
}

export const subscriptionEngine = new SubscriptionEngine();

