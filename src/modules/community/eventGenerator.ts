import { aiOrchestrator } from '../../ai/orchestrator.js';
import { activityMonitor, ActivitySnapshot } from './activityMonitor.js';
import { DEFAULT_ROLES } from '../../config/constants.js';
import { SupportedLanguage } from '../../utils/i18n.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('EventGenerator');

export interface GeneratedCommunityEvent {
  eventId: string;
  targetRole: string;
  title: string;
  description: string;
  eventType: 'challenge' | 'mini_jam' | 'code_review_night' | 'portfolio_critique';
  rewardCredits: number;
  durationHours: number;
  shouldPing: boolean;
}

export class EventGenerator {
  public async triggerEventIfNeeded(params: {
    guildId: string;
    snapshot: ActivitySnapshot;
    language?: SupportedLanguage;
  }): Promise<GeneratedCommunityEvent | null> {
    if (!params.snapshot.isBelowThreshold) {
      return null; // Activity is healthy
    }

    if (params.snapshot.isInQuietHours) {
      logger.info(`Activity low in guild ${params.guildId}, but quiet hours active. Suppressing pings.`);
      return null;
    }

    if (!activityMonitor.canPingEvents(params.guildId)) {
      logger.warn(`Event ping rate-limit reached for guild ${params.guildId}.`);
      return null;
    }

    // Generate creative event
    const lang = params.language || 'en';
    const targetField = Math.random() > 0.5 ? 'development' : 'design';
    const targetRole = targetField === 'development' ? DEFAULT_ROLES.TECH_EVENTS : DEFAULT_ROLES.DESIGN_EVENTS;

    const event = await this.generateEventContent(targetField, lang);
    activityMonitor.recordPing(params.guildId);

    return {
      ...event,
      targetRole,
      shouldPing: true,
    };
  }

  public async generateEventContent(field: 'development' | 'design', lang: SupportedLanguage): Promise<{
    eventId: string;
    title: string;
    description: string;
    eventType: 'challenge' | 'mini_jam' | 'code_review_night' | 'portfolio_critique';
    rewardCredits: number;
    durationHours: number;
  }> {
    const eventId = `event_${Date.now()}`;
    if (lang === 'ar') {
      if (field === 'design') {
        return {
          eventId,
          title: '🎨 ليلة مراجعة ونقد البورتفوليو والتصميم (UI Critique Night)',
          description: 'يا شباب التصميم! النشاط هادي شوية، جهزوا تصاميمكم وروابط Behance/Figma وهنعمل جلسة نقد فني وتبادل آراء مع مكافأة 150 كريدت لأفضل تعديل تفاعلي!',
          eventType: 'portfolio_critique',
          rewardCredits: 150,
          durationHours: 3,
        };
      }
      return {
        eventId,
        title: '⚡ تحدي الكود السريع: إصلاح ثغرات الـ Concurrency (Mini-Jam)',
        description: 'يا باشمهندسين! معانا ميني-جام لمدة ساعتين: تحدي كتابة Worker آمن بدون race conditions. أول 3 حلول صحيحة هتاخد 200 كريدت وشارة الـ Bug Hunter!',
        eventType: 'mini_jam',
        rewardCredits: 200,
        durationHours: 2,
      };
    }

    if (field === 'design') {
      return {
        eventId,
        title: '🎨 Live UI/UX Critique & Design Swap',
        description: 'Designers! Activity is winding down—drop your latest Figma prototypes or hero sections in #showcase for live feedback, accessibility tear-downs, and a 150 credit reward.',
        eventType: 'portfolio_critique',
        rewardCredits: 150,
        durationHours: 3,
      };
    }

    return {
      eventId,
      title: '⚡ Flash Coding Challenge: Async Pipeline Speedrun',
      description: 'Engineers assemble! We are launching a 2-hour mini-jam: build an in-memory batching queue that debounces writes under high concurrency. 200 server credits to top entries!',
      eventType: 'challenge',
      rewardCredits: 200,
      durationHours: 2,
    };
  }
}

export const eventGenerator = new EventGenerator();
