import { logger } from '../../utils/logger.js';

export const ALLOWED_LEAD_SOURCES = [
  'messenger',
  'page_messenger',
  'page_comment',
  'lead_ad',
  'web_form',
  'manual_entry',
] as const;

export type LeadSource = typeof ALLOWED_LEAD_SOURCES[number];

export const FORBIDDEN_LEAD_SOURCES = [
  'facebook_group',
  'personal_profile',
  'third_party_broker',
  'scraped_list',
  'browser_automation',
  'fake_account',
];

export const PRIVACY_NOTICE_EN =
  '[Nexus Privacy Notice] We keep your message for up to 30 days to help with your request. Reply "DELETE" any time to remove it.';

export const PRIVACY_NOTICE_AR =
  '[إشعار الخصوصية من نيكسس] بنحتفظ برسالتك لمدة تصل إلى 30 يوماً فقط لمتابعة طلبك والرد عليك. تقدر تبعت "امسح" أو "DELETE" في أي وقت لحذفها فوراً.';

export class LeadRulesGuard {
  private deletionKeywords = [
    'delete',
    'stop',
    'unsubscribe',
    'remove',
    'forget me',
    'opt out',
    'optout',
    'امسح',
    'احذف',
    'مش عايز',
    'الغاء',
    'إلغاء',
    'وقف',
    'شيل بياناتي',
  ];

  /**
   * REQ-22.0.1: Validate that lead source is lawful and official Meta property
   */
  public validateSource(source: string): { allowed: boolean; reason?: string } {
    const normalized = source.toLowerCase().trim();

    if (
      FORBIDDEN_LEAD_SOURCES.includes(normalized) ||
      normalized.includes('group') ||
      normalized.includes('scrape') ||
      normalized.includes('broker') ||
      normalized.includes('harvest') ||
      normalized.includes('crawler') ||
      normalized.includes('profile')
    ) {
      return {
        allowed: false,
        reason: `Harvesting or scraping from '${source}' is strictly prohibited by policy.`,
      };
    }

    if (!ALLOWED_LEAD_SOURCES.includes(normalized as LeadSource)) {
      return {
        allowed: false,
        reason: `Source '${source}' is not an authorized official Meta or Nexus inbound channel.`,
      };
    }

    return { allowed: true };
  }

  /**
   * REQ-22.0.2: Enforce strict data minimization. Strips prohibited fields.
   */
  public sanitizeRawPayload(payload: Record<string, unknown>): {
    psid: string;
    displayName: string;
    content: string;
    serviceRequested?: string;
    source: LeadSource;
    language: 'en' | 'ar';
    sourceReference?: string;
  } {
    // Prohibited attributes: profile photos, friend lists, birthdays, location history, etc.
    const forbiddenKeys = ['profile_pic', 'friends', 'birthday', 'location', 'religion', 'politics', 'health'];
    for (const key of forbiddenKeys) {
      if (key in payload) {
        logger.warn(`[LeadRulesGuard] Discarding non-minimized field '${key}' per REQ-22.0.2.`);
        delete payload[key];
      }
    }

    const psid = String(payload.psid || payload.senderId || payload.userId || '').trim();
    if (!psid) {
      throw new Error('Data Minimization Error: Missing required platform-scoped user ID (PSID).');
    }

    const displayName = String(payload.displayName || payload.name || 'Potential Client').trim().slice(0, 100);
    const content = String(payload.content || payload.message || payload.formInput || '').trim();
    const serviceRequested = payload.serviceRequested ? String(payload.serviceRequested).trim() : undefined;
    const source = (payload.source as LeadSource) || 'messenger';
    const language = payload.language === 'ar' || /[\u0600-\u06FF]/.test(content) ? 'ar' : 'en';
    const sourceReference = payload.sourceReference ? String(payload.sourceReference).trim() : undefined;

    return {
      psid,
      displayName,
      content,
      serviceRequested,
      source,
      language,
      sourceReference,
    };
  }

  /**
   * REQ-22.0.3: Generate initial transparency & privacy notice
   */
  public getInitialPrivacyNotice(language: 'en' | 'ar' = 'en', ttlDays: number = 30): string {
    if (language === 'ar') {
      return ttlDays === 30
        ? PRIVACY_NOTICE_AR
        : `[إشعار الخصوصية من نيكسس] بنحتفظ برسالتك لمدة تصل إلى ${ttlDays} يوماً فقط لمتابعة طلبك والرد عليك. تقدر تبعت "امسح" أو "DELETE" في أي وقت لحذفها فوراً.`;
    }
    return ttlDays === 30
      ? PRIVACY_NOTICE_EN
      : `[Nexus Privacy Notice] We keep your message for up to ${ttlDays} days to help with your request. Reply "DELETE" any time to remove it.`;
  }

  /**
   * REQ-22.0.6: Detect user deletion / opt-out requests across languages and dialects
   */
  public isDeletionRequest(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    return this.deletionKeywords.some((keyword) => normalized.includes(keyword));
  }

  /**
   * Alias for isDeletionRequest
   */
  public isDeletionKeyword(text: string): boolean {
    return this.isDeletionRequest(text);
  }

  /**
   * Detect if message is in Arabic or English
   */
  public detectLanguage(text: string): 'en' | 'ar' {
    return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
  }

  /**
   * Convenience check for Meta 24-hr window
   */
  public isWithin24HrWindow(lastInteractionAt: number, currentTime: number = Date.now()): boolean {
    return this.isWithinMetaMessagingWindow(lastInteractionAt, undefined, currentTime).allowed;
  }

  /**
   * REQ-22.0.8: Meta Messaging Window enforcement (24-hour standard window)
   */
  public isWithinMetaMessagingWindow(
    lastInteractionAt: number,
    messageTag?: 'CONFIRMED_EVENT_UPDATE' | 'POST_PURCHASE_UPDATE' | 'HUMAN_AGENT',
    currentTime: number = Date.now()
  ): { allowed: boolean; reason?: string } {
    if (messageTag) {
      return { allowed: true };
    }

    const windowDurationMs = 24 * 60 * 60 * 1000; // 24 hours
    const timeSinceLastInteraction = currentTime - lastInteractionAt;

    if (timeSinceLastInteraction > windowDurationMs) {
      const hoursAgo = Math.round(timeSinceLastInteraction / (1000 * 60 * 60));
      return {
        allowed: false,
        reason: `Meta 24-hour messaging window expired (${hoursAgo} hours since last interaction). Permitted message tag required.`,
      };
    }

    return { allowed: true };
  }
}

export const leadRulesGuard = new LeadRulesGuard();
