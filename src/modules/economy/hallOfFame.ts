import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface HallOfFameInductee {
  userId: string;
  category: 'Top Earner' | 'Code Legend' | 'Visual Master' | 'Trusted Middleman' | 'Top Mentor';
  achievementSummary: string;
  monthYear: string;
}

export interface HallOfFameCard {
  inductees: HallOfFameInductee[];
  monthYear: string;
  formattedEmbedText: string;
  locale: 'ar' | 'en';
}

export class HallOfFameService {
  /**
   * Evaluates top performers across categories for the given month.
   */
  public generateMonthlyInductions(guildId: string, monthYear: string): HallOfFameInductee[] {
    const inductees: HallOfFameInductee[] = [];

    // 1. Top Coder (most approved task submissions)
    const topCoder = dbService.get<{ user_id: string; total_score: number; count: number }>(
      `SELECT user_id, SUM(score) as total_score, COUNT(*) as count 
       FROM task_submissions WHERE status = 'approved' GROUP BY user_id ORDER BY total_score DESC LIMIT 1`
    );
    if (topCoder) {
      inductees.push({
        userId: topCoder.user_id,
        category: 'Code Legend',
        achievementSummary: `${topCoder.count} approved tasks with total score ${topCoder.total_score}`,
        monthYear,
      });
    }

    // 2. Visual Master (most upvoted portfolio item)
    const topDesigner = dbService.get<{ user_id: string; title: string; upvotes: number }>(
      `SELECT user_id, title, upvotes FROM portfolio_items WHERE guild_id = ? ORDER BY upvotes DESC LIMIT 1`,
      guildId
    );
    if (topDesigner) {
      inductees.push({
        userId: topDesigner.user_id,
        category: 'Visual Master',
        achievementSummary: `"${topDesigner.title}" with ${topDesigner.upvotes} upvotes`,
        monthYear,
      });
    }

    // 3. Trusted Middleman (most completed deals with high rating)
    const topMiddleman = dbService.get<{ user_id: string; completed_deals: number; rating: number }>(
      `SELECT user_id, completed_deals, rating FROM middlemen 
       WHERE guild_id = ? AND is_suspended = 0 ORDER BY completed_deals DESC, rating DESC LIMIT 1`,
      guildId
    );
    if (topMiddleman && topMiddleman.completed_deals > 0) {
      inductees.push({
        userId: topMiddleman.user_id,
        category: 'Trusted Middleman',
        achievementSummary: `${topMiddleman.completed_deals} deals completed with a ${topMiddleman.rating.toFixed(1)} rating`,
        monthYear,
      });
    }

    // 4. Top Earner / Credit Champion
    const topEarner = dbService.get<{ user_id: string; credits: number }>(
      `SELECT user_id, credits FROM members WHERE guild_id = ? ORDER BY credits DESC LIMIT 1`,
      guildId
    );
    if (topEarner) {
      inductees.push({
        userId: topEarner.user_id,
        category: 'Top Earner',
        achievementSummary: `Community balance of ${topEarner.credits} credits`,
        monthYear,
      });
    }

    // 5. Top Mentor (most active pairings)
    const topMentor = dbService.get<{ mentor_id: string; count: number }>(
      `SELECT mentor_id, COUNT(*) as count FROM mentorship_pairings 
       WHERE guild_id = ? AND status = 'active' GROUP BY mentor_id ORDER BY count DESC LIMIT 1`,
      guildId
    );
    if (topMentor) {
      inductees.push({
        userId: topMentor.mentor_id,
        category: 'Top Mentor',
        achievementSummary: `Guiding ${topMentor.count} active mentees`,
        monthYear,
      });
    }

    return inductees;
  }

  /**
   * Generates a bilingual social recognition card ready for broadcasting.
   */
  public generateRecognitionCard(guildId: string, monthYear: string, locale: 'ar' | 'en' = 'ar'): HallOfFameCard {
    const inductees = this.generateMonthlyInductions(guildId, monthYear);

    const isAr = locale === 'ar';
    const lines: string[] = [];

    if (isAr) {
      lines.push(`👑 **لوحة الشرف — Hall of Fame (${monthYear})** 🌟`);
      lines.push(`يسعدنا الاحتفاء بنجوم مجتمعنا اللي أبدعوا وتميزوا الشهر ده:\n`);
      for (const ind of inductees) {
        let catAr: string = ind.category;
        if (ind.category === 'Code Legend') catAr = '💻 أسطورة الأكواد (Code Legend)';
        else if (ind.category === 'Visual Master') catAr = '🎨 عبقري التصميم (Visual Master)';
        else if (ind.category === 'Trusted Middleman') catAr = '🤝 الوسيط الأكثر موثوقية (Trusted Middleman)';
        else if (ind.category === 'Top Earner') catAr = '🪙 بطل الاقتصاد (Top Earner)';
        else if (ind.category === 'Top Mentor') catAr = '🧭 المرشد الأفضل (Top Mentor)';

        lines.push(`🏅 **${catAr}**: <@${ind.userId}>`);
        lines.push(`   └ ${ind.achievementSummary}`);
      }
      lines.push(`\n👏 ألف مبروك لجميع الفائزين، كود نظيف وتصميمات عالمية! استمروا في التألق! 💪`);
    } else {
      lines.push(`👑 **Community Hall of Fame — (${monthYear})** 🌟`);
      lines.push(`Celebrating the exceptional achievements of our standout members this month:\n`);
      for (const ind of inductees) {
        lines.push(`🏅 **${ind.category}**: <@${ind.userId}>`);
        lines.push(`   └ ${ind.achievementSummary}`);
      }
      lines.push(`\n👏 Congratulations to all inductees for your mastery and dedication! 💪`);
    }

    return {
      inductees,
      monthYear,
      formattedEmbedText: lines.join('\n'),
      locale,
    };
  }
}

export const hallOfFameService = new HallOfFameService();
