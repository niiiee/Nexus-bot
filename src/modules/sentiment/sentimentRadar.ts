import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface SentimentSnapshotRecord {
  id: string;
  tenant_id: string;
  channel_id: string;
  score: number;
  topics_json: string;
  conflict_risk: number;
  isolated_members_count: number;
  timestamp: number;
}

export interface IsolatedMember {
  userId: string;
  channelId: string;
  messageSnippet: string;
  postedAt: number;
  hoursUnanswered: number;
}

export interface SentimentAnalysisResult {
  sentimentScore: number;
  sentimentLabel: 'ecstatic' | 'positive' | 'neutral' | 'frustrated' | 'tense';
  topics: string[];
  conflictRisk: number;
  isConflictWarning: boolean;
  isolatedMembers: IsolatedMember[];
}

export class SentimentRadar {
  private static readonly POSITIVE_WORDS = [
    'great', 'awesome', 'thanks', 'love', 'helpful', 'excited', 'good',
    'congrats', 'shukran', 'mashallah', 'tamam', 'ash', 'mabrouk'
  ];

  private static readonly NEGATIVE_WORDS = [
    'bad', 'awful', 'terrible', 'annoyed', 'scam', 'hate', 'broken',
    'wrong', 'late', 'angry', 'trash', 'slow', 'fail', 'fake'
  ];

  private static readonly CONFLICT_TRIGGERS = [
    'you are lying', 'you have no idea', 'stop talking', 'you are wrong',
    'shut up', 'learn to code', 'clueless', 'incompetent', 'stolen'
  ];

  /**
   * REQ-23.19.1, REQ-23.19.2, REQ-23.19.3, REQ-23.19.4: Analyze messages in a channel and save snapshot
   */
  public analyzeChannelVibe(
    tenantId: string,
    channelId: string,
    messages: Array<{ id: string; authorId: string; content: string; timestamp: number; replyCount?: number }>
  ): SentimentAnalysisResult {
    let positiveCount = 0;
    let negativeCount = 0;
    let conflictHits = 0;
    const topicFrequency = new Map<string, number>();

    const now = Date.now();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    const isolated: IsolatedMember[] = [];

    for (const msg of messages) {
      const lower = msg.content.toLowerCase();

      // Check sentiment keywords
      for (const pw of SentimentRadar.POSITIVE_WORDS) {
        if (lower.includes(pw)) positiveCount++;
      }
      for (const nw of SentimentRadar.NEGATIVE_WORDS) {
        if (lower.includes(nw)) negativeCount++;
      }

      // Check conflict triggers
      for (const ct of SentimentRadar.CONFLICT_TRIGGERS) {
        if (lower.includes(ct)) conflictHits++;
      }

      // Topic extraction: simple noun/technology token extractor
      const tokens = lower.split(/[^a-zA-Z0-9#_]+/).filter(t => t.length > 3);
      for (const t of tokens) {
        if (['the', 'this', 'that', 'with', 'from', 'have', 'what', 'your', 'about'].includes(t)) continue;
        topicFrequency.set(t, (topicFrequency.get(t) || 0) + 1);
      }

      // Isolated member check: questions or intros unanswered after 4 hours
      if (
        (lower.includes('?') || lower.includes('hello') || lower.includes('intro') || lower.includes('new here')) &&
        (msg.replyCount === 0 || msg.replyCount === undefined) &&
        (now - msg.timestamp > fourHoursMs)
      ) {
        isolated.push({
          userId: msg.authorId,
          channelId,
          messageSnippet: msg.content.substring(0, 80),
          postedAt: msg.timestamp,
          hoursUnanswered: Number(((now - msg.timestamp) / (60 * 60 * 1000)).toFixed(1))
        });
      }
    }

    const totalSentimentWords = positiveCount + negativeCount;
    let rawScore = 0.0;
    if (totalSentimentWords > 0) {
      rawScore = (positiveCount - negativeCount) / totalSentimentWords;
    }
    const score = Number(Math.max(-1.0, Math.min(1.0, rawScore)).toFixed(2));

    let label: SentimentAnalysisResult['sentimentLabel'] = 'neutral';
    if (score >= 0.5) label = 'ecstatic';
    else if (score > 0.1) label = 'positive';
    else if (score <= -0.5) label = 'tense';
    else if (score < -0.1) label = 'frustrated';

    // Conflict risk: scaled by conflict phrase hits and negative sentiment ratio
    const conflictRisk = Number(Math.min(1.0, conflictHits * 0.25 + (score < -0.2 ? 0.3 : 0.0)).toFixed(2));
    const isConflictWarning = conflictRisk >= 0.5;

    // Top 5 topics
    const sortedTopics = Array.from(topicFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    // Save snapshot to database
    const snapshotId = cryptoRandomUUID();
    dbService.run(
      `INSERT INTO community_sentiment_snapshots (
         id, tenant_id, channel_id, score, topics_json, conflict_risk,
         isolated_members_count, timestamp
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      snapshotId,
      tenantId,
      channelId,
      score,
      JSON.stringify(sortedTopics),
      conflictRisk,
      isolated.length,
      now
    );

    return {
      sentimentScore: score,
      sentimentLabel: label,
      topics: sortedTopics,
      conflictRisk,
      isConflictWarning,
      isolatedMembers: isolated
    };
  }

  /**
   * REQ-23.19.4: Generate welcoming AI icebreaker for isolated member
   */
  public generateIcebreaker(isolated: IsolatedMember, lang: 'en' | 'ar' = 'en'): string {
    if (lang === 'ar') {
      return `أهلاً بيك يا <@${isolated.userId}> في مجتمعنا! شفت رسالتك بخصوص "${isolated.messageSnippet}..."، منور السيرفر! تحب نبدأ بإيه في مجالك؟`;
    }
    return `Hey <@${isolated.userId}>, welcome to the community! Saw your question about "${isolated.messageSnippet}...". Happy to help you get started—what kind of projects are you building?`;
  }
}

export const sentimentRadar = new SentimentRadar();
