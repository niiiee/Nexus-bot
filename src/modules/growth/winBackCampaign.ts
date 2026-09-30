import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface WinBackDigest {
  userId: string;
  guildId: string;
  inactiveDays: number;
  locale: 'ar' | 'en';
  topJobs: Array<{ id: string; title: string; budget: string }>;
  topWins: string[];
  upcomingEvents: string[];
  welcomeBackPerk: {
    code: string;
    bonusCredits: number;
    expiresInDays: number;
  };
  formattedMessage: string;
}

export class WinBackCampaignService {
  /**
   * Identifies members eligible for a win-back campaign (14 to 45 days dormant).
   */
  public getEligibleMembers(guildId: string): Array<{ userId: string; inactiveDays: number }> {
    const now = Date.now();
    const members = dbService.all<{ user_id: string; last_active?: number; created_at: number }>(
      `SELECT user_id, created_at FROM members WHERE guild_id = ?`,
      guildId
    );

    const eligible: Array<{ userId: string; inactiveDays: number }> = [];

    for (const m of members) {
      // Find latest activity from task_submissions or time_entries
      const latestSub = dbService.get<{ created_at: number }>(
        `SELECT created_at FROM task_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
        m.user_id
      );
      const latestTime = dbService.get<{ start_time: number }>(
        `SELECT start_time FROM time_entries WHERE user_id = ? ORDER BY start_time DESC LIMIT 1`,
        m.user_id
      );

      const lastActivity = Math.max(
        m.created_at,
        latestSub?.created_at || 0,
        latestTime?.start_time || 0
      );

      const daysInactive = Math.floor((now - lastActivity) / (24 * 60 * 60 * 1000));
      if (daysInactive >= 14 && daysInactive <= 45) {
        eligible.push({ userId: m.user_id, inactiveDays: daysInactive });
      }
    }

    return eligible;
  }

  /**
   * Generates a "What You Missed" digest for an inactive user.
   */
  public generateDigest(userId: string, guildId: string, inactiveDays: number, locale: 'ar' | 'en' = 'ar'): WinBackDigest {
    // 1. Fetch recent open jobs
    const jobs = dbService.all<{ id: string; title: string; budget_range: string }>(
      `SELECT id, title, budget_range FROM jobs WHERE guild_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 3`,
      guildId
    ).map(j => ({ id: j.id, title: j.title, budget: j.budget_range }));

    // 2. Fetch upcoming hackathons
    const hackathons = dbService.all<{ title: string; theme: string }>(
      `SELECT title, theme FROM hackathons WHERE guild_id = ? AND status = 'upcoming' LIMIT 2`,
      guildId
    ).map(h => `${h.title} (${h.theme})`);

    const topWins = [
      locale === 'ar' ? 'فريقنا سلم ٣ مشاريع جديدة الأسبوع ده!' : 'Our community delivered 3 client projects this week!',
      locale === 'ar' ? 'أكثر من ٢٠ مبرمج ومصمم كسبوا تقييم 5 نجوم!' : 'Over 20 freelancers achieved 5-star ratings!',
    ];

    const bonusCredits = inactiveDays >= 30 ? 150 : 75;
    const promoCode = `WELCOMEBACK-${userId.slice(0, 4).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

    let formattedMessage = '';
    if (locale === 'ar') {
      formattedMessage = [
        `👋 **وحشتنا يا باشا! بقالك ${inactiveDays} يوم غايب عن السيرفر.**`,
        `فاتك كتير بس متقلقش، لخصنالك أهم الأحداث:`,
        `\n💼 **أحدث الفرص والشغل:**`,
        jobs.length > 0 ? jobs.map(j => `• ${j.title} (${j.budget})`).join('\n') : '• مشاريع فريلانس حصرية مستنياك في السيرفر!',
        `\n🏆 **إنجازات المجتمع:**`,
        topWins.map(w => `• ${w}`).join('\n'),
        hackathons.length > 0 ? `\n🚀 **فعاليات قادمة:**\n` + hackathons.map(h => `• ${h}`).join('\n') : '',
        `\n🎁 **هدية رجوعك:**`,
        `استخدم الكود \`${promoCode}\` عشان تاخد **${bonusCredits} نقطة رصيد مجانية** فوراً!`,
        `مستنيينك تنورنا تاني في قنوات النقاش والشغل! 💪`,
      ].filter(Boolean).join('\n');
    } else {
      formattedMessage = [
        `👋 **We missed you! It has been ${inactiveDays} days since your last visit.**`,
        `Here is a quick digest of what you missed:`,
        `\n💼 **Latest Job Opportunities:**`,
        jobs.length > 0 ? jobs.map(j => `• ${j.title} (${j.budget})`).join('\n') : '• Exclusive freelance projects waiting for you!',
        `\n🏆 **Community Wins:**`,
        topWins.map(w => `• ${w}`).join('\n'),
        hackathons.length > 0 ? `\n🚀 **Upcoming Events:**\n` + hackathons.map(h => `• ${h}`).join('\n') : '',
        `\n🎁 **Welcome Back Gift:**`,
        `Use code \`${promoCode}\` to claim **${bonusCredits} free credits** instantly!`,
        `We are excited to see you back in the community! 💪`,
      ].filter(Boolean).join('\n');
    }

    return {
      userId,
      guildId,
      inactiveDays,
      locale,
      topJobs: jobs,
      topWins,
      upcomingEvents: hackathons,
      welcomeBackPerk: {
        code: promoCode,
        bonusCredits,
        expiresInDays: 7,
      },
      formattedMessage,
    };
  }

  /**
   * Applies the welcome-back promo code, crediting the returning member.
   */
  public claimReturnPerk(userId: string, guildId: string, promoCode: string, credits: number): { success: boolean; message: string } {
    if (!promoCode.startsWith('WELCOMEBACK-')) {
      return { success: false, message: 'Invalid promo code' };
    }

    try {
      dbService.run(
        `UPDATE members SET credits = credits + ? WHERE user_id = ? AND guild_id = ?`,
        credits,
        userId,
        guildId
      );

      logger.info(`[WinBackCampaign] User ${userId} claimed return perk of ${credits} credits with code ${promoCode}`);
      return { success: true, message: `Successfully claimed ${credits} credits!` };
    } catch (err) {
      logger.error(`[WinBackCampaign] Error claiming return perk:`, err);
      return { success: false, message: 'Failed to apply return bonus' };
    }
  }
}

export const winBackCampaignService = new WinBackCampaignService();
