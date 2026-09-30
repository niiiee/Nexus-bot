import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface AMASession {
  id: string;
  guildId: string;
  guestNameOrId: string;
  topic: string;
  scheduledTime: number;
  status: 'scheduled' | 'live' | 'completed';
}

export class AMAAndSpotlightService {
  private scheduledAMAs: Map<string, AMASession> = new Map();

  public scheduleAMA(params: {
    guildId: string;
    guestNameOrId: string;
    topic: string;
    scheduledTime: number;
  }): AMASession {
    const id = `ama_${randomUUID().slice(0, 8)}`;
    const session: AMASession = {
      id,
      guildId: params.guildId,
      guestNameOrId: params.guestNameOrId,
      topic: params.topic,
      scheduledTime: params.scheduledTime,
      status: 'scheduled',
    };

    this.scheduledAMAs.set(id, session);
    logger.info('AMAAndSpotlight', `Scheduled AMA ${id} with ${params.guestNameOrId} on "${params.topic}"`);
    return session;
  }

  public getMemberOfTheWeek(guildId: string): { userId: string; username: string; reputation: number; reason: string } | null {
    // Find top reputation member who is not restricted
    const topMember = dbService.get<{ user_id: string; username: string; reputation_score: number }>(
      `SELECT user_id, username, reputation_score FROM members 
       WHERE guild_id = ? AND is_restricted = 0 
       ORDER BY reputation_score DESC LIMIT 1`,
      guildId
    );

    if (!topMember) return null;

    return {
      userId: topMember.user_id,
      username: topMember.username,
      reputation: topMember.reputation_score,
      reason: 'Top community reputation, exceptional code contributions, and outstanding peer support!',
    };
  }

  public generateSpotlightEmbed(spotlight: { username: string; reputation: number; reason: string }, lang: 'en' | 'ar' = 'en') {
    const isAr = lang === 'ar';
    return {
      title: isAr ? `🌟 نجم الأسبوع في مجتمعنا: ${spotlight.username}!` : `🌟 Community Spotlight: Member of the Week - ${spotlight.username}!`,
      description: isAr
        ? `تحية تقدير كبيرة لعضو الأسبوع **${spotlight.username}**! جهود جبارة ومساعدة مستمرة لكل الزملاء في السيرفر.`
        : `Huge shoutout to **${spotlight.username}** for being our standout contributor this week!`,
      color: 0xf59e0b,
      fields: [
        {
          name: isAr ? '🏅 رصيد السمعة' : '🏅 Reputation Score',
          value: `${spotlight.reputation} pts`,
          inline: true,
        },
        {
          name: isAr ? '💡 سبب الاختيار' : '💡 Why Selected',
          value: spotlight.reason,
          inline: false,
        },
      ],
      footer: {
        text: isAr ? 'مجتمع Senior Progg للمستقلين' : 'Senior Progg Freelancer Community',
      },
    };
  }
}

export const amaAndSpotlightService = new AMAAndSpotlightService();
