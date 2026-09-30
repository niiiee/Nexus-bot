import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface AlumniStory {
  id: string;
  guildId: string;
  userId: string;
  category: 'remote_job' | 'high_ticket_deal' | 'saas_launch' | 'career_pivot';
  title: string;
  storyContent: string;
  impactMetrics: string;
  upvotes: number;
  createdAt: number;
}

export class AlumniSuccessService {
  // Store stories in memory or link to community suggestions table
  private stories = new Map<string, AlumniStory>();

  /**
   * Submits an inspiring alumni success story.
   */
  public submitStory(params: {
    guildId: string;
    userId: string;
    category: AlumniStory['category'];
    title: string;
    storyContent: string;
    impactMetrics: string;
  }): AlumniStory {
    const id = cryptoRandomUUID();
    const createdAt = Date.now();

    const story: AlumniStory = {
      id,
      guildId: params.guildId,
      userId: params.userId,
      category: params.category,
      title: params.title,
      storyContent: params.storyContent,
      impactMetrics: params.impactMetrics,
      upvotes: 1,
      createdAt,
    };

    this.stories.set(id, story);
    logger.info(`[AlumniSuccess] Member ${params.userId} submitted alumni story: "${params.title}"`);
    return story;
  }

  /**
   * Upvotes an alumni story.
   */
  public upvoteStory(storyId: string): number {
    const story = this.stories.get(storyId);
    if (!story) return 0;
    story.upvotes++;
    return story.upvotes;
  }

  /**
   * Lists stories for a guild.
   */
  public getStories(guildId: string, limit = 5): AlumniStory[] {
    return Array.from(this.stories.values())
      .filter(s => s.guildId === guildId)
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, limit);
  }

  /**
   * Formats an alumni success story for community broadcast.
   */
  public formatStoryBroadcast(story: AlumniStory, locale: 'ar' | 'en' = 'ar'): string {
    const isAr = locale === 'ar';

    if (isAr) {
      return [
        `🌟 **قصة نجاح وإلهام من مجتمعنا (Alumni Spotlight)** 🚀`,
        `يسعدنا مشاركة إنجاز مميز من الزميل/ة <@${story.userId}>:\n`,
        `🏆 **${story.title}**`,
        `💬 *"${story.storyContent}"*`,
        `\n📊 **الأثر الرقمي:** \`${story.impactMetrics}\``,
        `\n👏 كل التوفيق والدعم المستمر لأبطال مجتمعنا! كود نظيف وعمل جاد يثمر دائماً! 💪`,
        `❤️ اضغط على التفاعل لتهنئة زميلك ودعمه!`,
      ].join('\n');
    }

    return [
      `🌟 **Community Alumni Spotlight & Success Story** 🚀`,
      `Celebrating an inspiring milestone achieved by <@${story.userId}>:\n`,
      `🏆 **${story.title}**`,
      `💬 *"${story.storyContent}"*`,
      `\n📊 **Key Impact:** \`${story.impactMetrics}\``,
      `\n👏 Huge congratulations! Consistent effort and clean craftsmanship always pay off! 💪`,
      `❤️ React to congratulate your peer!`,
    ].join('\n');
  }
}

export const alumniSuccessService = new AlumniSuccessService();
