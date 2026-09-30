import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export type ExternalPlatform = 'telegram' | 'whatsapp' | 'slack' | 'matrix' | 'discord';

export interface NormalizedBridgeMessage {
  platform: ExternalPlatform;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  mediaUrls: string[];
  originalMessageId: string;
  timestamp: number;
}

export interface ChurnPredictionResult {
  userId: string;
  churnProbability: number;
  riskTier: 'low' | 'medium' | 'high' | 'critical';
  inactivityDays: number;
  recommendation: string;
}

export interface BurnoutAssessment {
  moderatorId: string;
  weeklyActiveHours: number;
  actionsHandledCount: number;
  burnoutRisk: 'healthy' | 'moderate' | 'high_fatigue';
  needsRestNudge: boolean;
}

export interface GlobalSearchResultItem {
  type: 'knowledge_article' | 'deal' | 'talent' | 'workflow';
  id: string;
  title: string;
  snippet: string;
  relevanceScore: number;
}

export class CommunityAnalyticsEngine {
  /**
   * REQ-23.8.1: Normalize incoming messages across various external chat platforms
   */
  public normalizeMessage(
    platform: ExternalPlatform,
    rawPayload: Record<string, any>
  ): NormalizedBridgeMessage {
    switch (platform) {
      case 'telegram':
        return {
          platform: 'telegram',
          channelId: String(rawPayload.chat?.id || ''),
          authorId: String(rawPayload.from?.id || ''),
          authorName: rawPayload.from?.username || rawPayload.from?.first_name || 'TG User',
          content: rawPayload.text || '',
          mediaUrls: rawPayload.photo ? ['tg://photo'] : [],
          originalMessageId: String(rawPayload.message_id || ''),
          timestamp: (rawPayload.date ? rawPayload.date * 1000 : Date.now())
        };
      case 'slack':
        return {
          platform: 'slack',
          channelId: String(rawPayload.channel || ''),
          authorId: String(rawPayload.user || ''),
          authorName: rawPayload.user_name || 'Slack User',
          content: rawPayload.text || '',
          mediaUrls: [],
          originalMessageId: String(rawPayload.ts || ''),
          timestamp: Date.now()
        };
      case 'discord':
      default:
        return {
          platform: 'discord',
          channelId: String(rawPayload.channelId || rawPayload.channel_id || ''),
          authorId: String(rawPayload.authorId || rawPayload.author?.id || ''),
          authorName: rawPayload.author?.username || 'Discord User',
          content: rawPayload.content || '',
          mediaUrls: rawPayload.attachments?.map((a: any) => a.url) || [],
          originalMessageId: String(rawPayload.id || ''),
          timestamp: Date.now()
        };
    }
  }

  /**
   * REQ-23.20.1: Churn risk prediction based on inactivity and engagement drop
   */
  public predictChurnRisk(
    userId: string,
    lastActiveTimestamp: number,
    recentSentiments: number[] = []
  ): ChurnPredictionResult {
    const now = Date.now();
    const daysInactive = Math.max(0, Math.floor((now - lastActiveTimestamp) / (24 * 60 * 60 * 1000)));

    let probability = 0.05; // Base churn risk

    if (daysInactive >= 30) probability += 0.70;
    else if (daysInactive >= 14) probability += 0.45;
    else if (daysInactive >= 7) probability += 0.20;

    // Check negative sentiment trend
    const avgSentiment = recentSentiments.length > 0
      ? recentSentiments.reduce((a, b) => a + b, 0) / recentSentiments.length
      : 0;

    if (avgSentiment < -0.3) probability += 0.15;

    probability = Number(Math.min(1.0, Math.max(0.0, probability)).toFixed(2));

    let riskTier: ChurnPredictionResult['riskTier'] = 'low';
    let recommendation = 'Member is actively engaged.';

    if (probability >= 0.75) {
      riskTier = 'critical';
      recommendation = 'Send personalized reconnection DM highlighting new bounties matching their skills.';
    } else if (probability >= 0.45) {
      riskTier = 'high';
      recommendation = 'Tag member in upcoming workshop or community challenge.';
    } else if (probability >= 0.20) {
      riskTier = 'medium';
      recommendation = 'Monitor engagement over next 7 days.';
    }

    return {
      userId,
      churnProbability: probability,
      riskTier,
      inactivityDays: daysInactive,
      recommendation
    };
  }

  /**
   * REQ-23.20.2: Moderator burnout and fatigue assessment
   */
  public evaluateModeratorFatigue(
    moderatorId: string,
    weeklyActiveHours: number,
    actionsHandledCount: number
  ): BurnoutAssessment {
    let burnoutRisk: BurnoutAssessment['burnoutRisk'] = 'healthy';
    let needsRestNudge = false;

    if (weeklyActiveHours > 40 || actionsHandledCount > 250) {
      burnoutRisk = 'high_fatigue';
      needsRestNudge = true;
    } else if (weeklyActiveHours > 25 || actionsHandledCount > 150) {
      burnoutRisk = 'moderate';
    }

    return {
      moderatorId,
      weeklyActiveHours,
      actionsHandledCount,
      burnoutRisk,
      needsRestNudge
    };
  }

  /**
   * REQ-23.23.1: Global search indexer across all tenant data
   */
  public searchGlobal(tenantId: string, query: string): GlobalSearchResultItem[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (tokens.length === 0) return [];

    const results: GlobalSearchResultItem[] = [];

    // 1. Search knowledge articles
    const articles = dbService.all<{ id: string; title: string; content: string }>(
      `SELECT id, title, content FROM knowledge_articles WHERE tenant_id = ?`,
      tenantId
    );
    for (const art of articles) {
      const text = `${art.title} ${art.content}`.toLowerCase();
      let matchCount = 0;
      for (const t of tokens) {
        if (text.includes(t)) matchCount++;
      }
      if (matchCount > 0) {
        results.push({
          type: 'knowledge_article',
          id: art.id,
          title: art.title,
          snippet: art.content.substring(0, 100) + '...',
          relevanceScore: Number((matchCount / tokens.length).toFixed(2))
        });
      }
    }

    // 2. Search workflows
    const workflows = dbService.all<{ id: string; name: string; trigger_type: string }>(
      `SELECT id, name, trigger_type FROM workflows WHERE tenant_id = ?`,
      tenantId
    );
    for (const wf of workflows) {
      const text = `${wf.name} ${wf.trigger_type}`.toLowerCase();
      let matchCount = 0;
      for (const t of tokens) {
        if (text.includes(t)) matchCount++;
      }
      if (matchCount > 0) {
        results.push({
          type: 'workflow',
          id: wf.id,
          title: wf.name,
          snippet: `Trigger: ${wf.trigger_type}`,
          relevanceScore: Number((matchCount / tokens.length).toFixed(2))
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

export const communityAnalytics = new CommunityAnalyticsEngine();
