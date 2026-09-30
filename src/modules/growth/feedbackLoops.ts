import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface PulseSurveyEntry {
  id: string;
  guildId: string;
  userId: string;
  rating: number; // 1 to 5
  feedback?: string;
  createdAt: number;
}

export interface SuggestionEntry {
  id: string;
  guildId: string;
  userId: string;
  title: string;
  description: string;
  upvotes: number;
  status: 'open' | 'under_review' | 'planned' | 'completed' | 'declined';
  createdAt: number;
}

export class FeedbackLoopsService {
  /**
   * Submits a quick 1-5 star pulse rating.
   */
  public submitPulseSurvey(guildId: string, userId: string, rating: number, feedback?: string): PulseSurveyEntry {
    const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));
    const id = cryptoRandomUUID();
    const createdAt = Date.now();

    dbService.run(
      `INSERT INTO pulse_surveys (id, guild_id, user_id, rating, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      guildId,
      userId,
      clampedRating,
      feedback || null,
      createdAt
    );

    logger.info(`[FeedbackLoops] Pulse survey submitted by ${userId} with rating ${clampedRating}`);

    return {
      id,
      guildId,
      userId,
      rating: clampedRating,
      feedback,
      createdAt,
    };
  }

  /**
   * Aggregates pulse survey metrics (Average Score, CSAT%, NPS proxy).
   */
  public getPulseMetrics(guildId: string): {
    totalResponses: number;
    averageRating: number;
    csatPercentage: number;
    ratingBreakdown: Record<number, number>;
  } {
    const rows = dbService.all<{ rating: number }>(
      `SELECT rating FROM pulse_surveys WHERE guild_id = ?`,
      guildId
    );

    if (rows.length === 0) {
      return {
        totalResponses: 0,
        averageRating: 0,
        csatPercentage: 0,
        ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let satisfied = 0;

    for (const r of rows) {
      breakdown[r.rating] = (breakdown[r.rating] || 0) + 1;
      sum += r.rating;
      if (r.rating >= 4) satisfied++;
    }

    return {
      totalResponses: rows.length,
      averageRating: parseFloat((sum / rows.length).toFixed(2)),
      csatPercentage: Math.round((satisfied / rows.length) * 100),
      ratingBreakdown: breakdown,
    };
  }

  /**
   * Submits a feature or community suggestion to the suggestion box.
   */
  public submitSuggestion(guildId: string, userId: string, title: string, description: string): SuggestionEntry {
    const id = cryptoRandomUUID();
    const createdAt = Date.now();

    dbService.run(
      `INSERT INTO suggestions (id, guild_id, user_id, title, description, upvotes, status, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 'open', ?)`,
      id,
      guildId,
      userId,
      title,
      description,
      createdAt
    );

    logger.info(`[FeedbackLoops] New suggestion created by ${userId}: "${title}"`);

    return {
      id,
      guildId,
      userId,
      title,
      description,
      upvotes: 1,
      status: 'open',
      createdAt,
    };
  }

  /**
   * Upvotes a suggestion.
   */
  public upvoteSuggestion(suggestionId: string): number {
    dbService.run(
      `UPDATE suggestions SET upvotes = upvotes + 1 WHERE id = ?`,
      suggestionId
    );

    const updated = dbService.get<{ upvotes: number }>(
      `SELECT upvotes FROM suggestions WHERE id = ?`,
      suggestionId
    );

    return updated?.upvotes || 0;
  }

  /**
   * Updates status of a suggestion (e.g. from open -> planned -> completed).
   */
  public updateSuggestionStatus(
    suggestionId: string,
    status: 'open' | 'under_review' | 'planned' | 'completed' | 'declined'
  ): boolean {
    const result = dbService.run(
      `UPDATE suggestions SET status = ? WHERE id = ?`,
      status,
      suggestionId
    );

    return Number(result.changes) > 0;
  }

  /**
   * Formats a bilingual changelog update based on recently completed suggestions.
   */
  public formatChangelog(guildId: string, version: string, customNotes?: string[], locale: 'ar' | 'en' = 'ar'): string {
    const completed = dbService.all<{ title: string; description: string }>(
      `SELECT title, description FROM suggestions WHERE guild_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 5`,
      guildId
    );

    if (locale === 'ar') {
      const items = completed.map(c => `• **${c.title}**: ${c.description}`);
      if (customNotes) {
        items.push(...customNotes.map(n => `• ${n}`));
      }

      return [
        `📢 **تحديث جديد للسيرفر — الإصدار v${version}** 🚀`,
        `بناءً على اقتراحاتكم الرائعة، تم تنفيذ التحسينات التالية:`,
        items.length > 0 ? items.join('\n') : '• تحسينات شاملة في الأداء واستقرار البوت.',
        `\n💡 عندك فكرة جديدة؟ شاركها عبر أمر \`/suggest\` وصوّت لأفضل الاقتراحات!`,
      ].join('\n');
    } else {
      const items = completed.map(c => `• **${c.title}**: ${c.description}`);
      if (customNotes) {
        items.push(...customNotes.map(n => `• ${n}`));
      }

      return [
        `📢 **Server Update Changelog — v${version}** 🚀`,
        `Based on your top voted suggestions, we have shipped the following:`,
        items.length > 0 ? items.join('\n') : '• General performance enhancements and stability fixes.',
        `\n💡 Have a great idea? Submit it via \`/suggest\` and vote for your favorites!`,
      ].join('\n');
    }
  }
}

export const feedbackLoopsService = new FeedbackLoopsService();
