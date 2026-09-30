import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export interface MatchedPortfolioItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  upvotes: number;
  matchScore: number;
}

export interface ClientShowcasePitch {
  jobId: string;
  matchedItems: MatchedPortfolioItem[];
  formattedPitch: string;
  locale: 'ar' | 'en';
}

export class PortfolioPipelineService {
  /**
   * Matches open client job requirements against community portfolio items.
   */
  public matchPortfolioForJob(jobId: string, limit = 3): MatchedPortfolioItem[] {
    const job = dbService.get<{
      id: string;
      guild_id: string;
      title: string;
      required_skills: string;
    }>(`SELECT id, guild_id, title, required_skills FROM jobs WHERE id = ?`, jobId);

    if (!job) return [];

    let requiredSkills: string[] = [];
    try {
      requiredSkills = JSON.parse(job.required_skills);
    } catch {
      requiredSkills = job.required_skills.split(',').map(s => s.trim().toLowerCase());
    }

    const items = dbService.all<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      url: string;
      tags: string;
      upvotes: number;
    }>(`SELECT * FROM portfolio_items WHERE guild_id = ?`, job.guild_id);

    const scored: MatchedPortfolioItem[] = [];

    for (const item of items) {
      let tags: string[] = [];
      try {
        tags = JSON.parse(item.tags);
      } catch {
        tags = item.tags.split(',').map(t => t.trim().toLowerCase());
      }

      // Calculate score based on tag overlap and community upvotes
      let matchCount = 0;
      for (const skill of requiredSkills) {
        if (tags.some(t => t.toLowerCase() === skill.toLowerCase())) {
          matchCount++;
        }
      }

      const matchScore = matchCount * 25 + Math.min(25, item.upvotes * 2);

      scored.push({
        id: item.id,
        userId: item.user_id,
        title: item.title,
        description: item.description,
        url: item.url,
        tags,
        upvotes: item.upvotes,
        matchScore,
      });
    }

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.slice(0, limit);
  }

  /**
   * Generates a sleek client-facing pitch bundle highlighting top matching community projects.
   */
  public generateClientPitch(jobId: string, locale: 'ar' | 'en' = 'ar'): ClientShowcasePitch {
    const matches = this.matchPortfolioForJob(jobId);
    const isAr = locale === 'ar';
    const lines: string[] = [];

    if (isAr) {
      lines.push(`💼 **ملف الأعمال المقترح لطلبك البرمجي/التصميمي** 🚀`);
      lines.push(`بناءً على المهارات المطلوبة، إليك أفضل الأعمال المنفذة في مجتمعنا من مبرمجين معتمدين:\n`);

      if (matches.length === 0) {
        lines.push(`• جاري التنسيق مع نخبة المطورين لتجهيز عروض متخصصة.`);
      } else {
        matches.forEach((m, idx) => {
          lines.push(`**${idx + 1}. ${m.title}** (بواسطة <@${m.userId}>)`);
          lines.push(`   └ المهارات: \`${m.tags.join(', ')}\` | تقييم المجتمع: 👍 ${m.upvotes}`);
          lines.push(`   └ رابط المعاينة: ${m.url}`);
        });
      }

      lines.push(`\n🔒 يمكنك التعاقد عبر نظام الوساطة الضامنة لضمان تسليم الكود وحماية الدفعات!`);
    } else {
      lines.push(`💼 **Curated Portfolio Showcase for Your Project** 🚀`);
      lines.push(`Based on your tech stack requirements, here are verified high-impact projects delivered by our senior community:\n`);

      if (matches.length === 0) {
        lines.push(`• Matching with senior specialists in our roster.`);
      } else {
        matches.forEach((m, idx) => {
          lines.push(`**${idx + 1}. ${m.title}** (by <@${m.userId}>)`);
          lines.push(`   └ Skills: \`${m.tags.join(', ')}\` | Upvotes: 👍 ${m.upvotes}`);
          lines.push(`   └ Preview: ${m.url}`);
        });
      }

      lines.push(`\n🔒 Work securely with our non-custodial milestone escrow system!`);
    }

    return {
      jobId,
      matchedItems: matches,
      formattedPitch: lines.join('\n'),
      locale,
    };
  }
}

export const portfolioPipelineService = new PortfolioPipelineService();
