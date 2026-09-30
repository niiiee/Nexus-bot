import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { opportunityDiscoveryService } from './opportunityDiscovery.js';
import { supplyDemandEngine, SkillGapMetrics } from './supplyDemandEngine.js';

export interface AttributionRecord {
  id: string;
  campaignCode: string;
  platform: string;
  community: string;
  clicks: number;
  joins: number;
  verified: number;
  active30d: number;
  createdAt: number;
}

export interface FunnelMetrics {
  totalCampaigns: number;
  totalClicks: number;
  totalJoins: number;
  totalVerified: number;
  totalActive30d: number;
  clickToJoinRate: number;
  joinToVerifiedRate: number;
  verifiedToActiveRate: number;
  byPlatform: Record<string, { clicks: number; joins: number; verified: number; active30d: number }>;
  byCommunity: Record<string, { clicks: number; joins: number; verified: number; active30d: number }>;
}

export interface AmbassadorEditExample {
  id: string;
  reviewId: string;
  originalDraft: string;
  editedReply: string;
  reason?: string;
  category: string;
  platform: string;
  charDelta: number;
  timestamp: number;
}

export interface WeeklyIntelligenceReport {
  reportId: string;
  guildId: string;
  generatedAt: number;
  gapShifts: {
    category: string;
    gapScore: number;
    trend: string;
    demandIndex: number;
    effectiveSupply: number;
  }[];
  outreachFunnel: FunnelMetrics;
  reviewQueueActivity: {
    pending: number;
    approved: number;
    rejected: number;
    doNotPost: number;
  };
  topPerformingSources: {
    platform: string;
    community: string;
    joins: number;
    conversionRate: number;
  }[];
  recommendedFocusAreas: string[];
  bilingualSummary: {
    en: string;
    ar: string;
  };
}

export class AttributionFunnelService {
  private learningDataset: AmbassadorEditExample[] = [];

  /**
   * Initializes or fetches a campaign attribution tracker
   */
  public createCampaign(campaignCode: string, platform: string, community: string): AttributionRecord {
    const existing = this.getCampaign(campaignCode);
    if (existing) return existing;

    const id = cryptoRandomUUID();
    const now = Date.now();
    try {
      dbService.run(
        `INSERT INTO outreach_attributions (id, campaign_code, platform, community, clicks, joins, verified, active_30d, created_at)
         VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?)`,
        id,
        campaignCode,
        platform,
        community,
        now
      );
    } catch (err) {
      logger.error('[Attribution] Error creating campaign:', err);
    }

    return {
      id,
      campaignCode,
      platform,
      community,
      clicks: 0,
      joins: 0,
      verified: 0,
      active30d: 0,
      createdAt: now,
    };
  }

  public getCampaign(campaignCode: string): AttributionRecord | null {
    try {
      const row = dbService.get<{
        id: string;
        campaign_code: string;
        platform: string;
        community: string;
        clicks: number;
        joins: number;
        verified: number;
        active_30d: number;
        created_at: number;
      }>(
        `SELECT * FROM outreach_attributions WHERE campaign_code = ?`,
        campaignCode
      );

      if (!row) return null;
      return {
        id: row.id,
        campaignCode: row.campaign_code,
        platform: row.platform,
        community: row.community,
        clicks: row.clicks,
        joins: row.joins,
        verified: row.verified,
        active30d: row.active_30d,
        createdAt: row.created_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Track invite link click
   */
  public recordClick(campaignCode: string): boolean {
    try {
      const result = dbService.run(
        `UPDATE outreach_attributions SET clicks = clicks + 1 WHERE campaign_code = ?`,
        campaignCode
      );
      return result.changes > 0;
    } catch {
      return false;
    }
  }

  /**
   * Track member join with campaign code
   */
  public recordJoin(campaignCode: string): boolean {
    try {
      const result = dbService.run(
        `UPDATE outreach_attributions SET joins = joins + 1 WHERE campaign_code = ?`,
        campaignCode
      );
      return result.changes > 0;
    } catch {
      return false;
    }
  }

  /**
   * Track member verification
   */
  public recordVerified(campaignCode: string): boolean {
    try {
      const result = dbService.run(
        `UPDATE outreach_attributions SET verified = verified + 1 WHERE campaign_code = ?`,
        campaignCode
      );
      return result.changes > 0;
    } catch {
      return false;
    }
  }

  /**
   * Track member 30-day retention
   */
  public recordActive30d(campaignCode: string): boolean {
    try {
      const result = dbService.run(
        `UPDATE outreach_attributions SET active_30d = active_30d + 1 WHERE campaign_code = ?`,
        campaignCode
      );
      return result.changes > 0;
    } catch {
      return false;
    }
  }

  /**
   * Compute full conversion funnel metrics
   */
  public getFunnelMetrics(campaignCode?: string): FunnelMetrics {
    let query = `SELECT * FROM outreach_attributions`;
    const params: (string | number)[] = [];
    if (campaignCode) {
      query += ` WHERE campaign_code = ?`;
      params.push(campaignCode);
    }

    try {
      const rows = dbService.all<{
        campaign_code: string;
        platform: string;
        community: string;
        clicks: number;
        joins: number;
        verified: number;
        active_30d: number;
      }>(query, ...params);

      let totalClicks = 0;
      let totalJoins = 0;
      let totalVerified = 0;
      let totalActive30d = 0;

      const byPlatform: Record<string, { clicks: number; joins: number; verified: number; active30d: number }> = {};
      const byCommunity: Record<string, { clicks: number; joins: number; verified: number; active30d: number }> = {};

      for (const r of rows) {
        totalClicks += r.clicks;
        totalJoins += r.joins;
        totalVerified += r.verified;
        totalActive30d += r.active_30d;

        // By Platform
        if (!byPlatform[r.platform]) {
          byPlatform[r.platform] = { clicks: 0, joins: 0, verified: 0, active30d: 0 };
        }
        byPlatform[r.platform].clicks += r.clicks;
        byPlatform[r.platform].joins += r.joins;
        byPlatform[r.platform].verified += r.verified;
        byPlatform[r.platform].active30d += r.active_30d;

        // By Community
        const commKey = `${r.platform}/${r.community}`;
        if (!byCommunity[commKey]) {
          byCommunity[commKey] = { clicks: 0, joins: 0, verified: 0, active30d: 0 };
        }
        byCommunity[commKey].clicks += r.clicks;
        byCommunity[commKey].joins += r.joins;
        byCommunity[commKey].verified += r.verified;
        byCommunity[commKey].active30d += r.active_30d;
      }

      return {
        totalCampaigns: rows.length,
        totalClicks,
        totalJoins,
        totalVerified,
        totalActive30d,
        clickToJoinRate: totalClicks > 0 ? Number((totalJoins / totalClicks).toFixed(3)) : 0,
        joinToVerifiedRate: totalJoins > 0 ? Number((totalVerified / totalJoins).toFixed(3)) : 0,
        verifiedToActiveRate: totalVerified > 0 ? Number((totalActive30d / totalVerified).toFixed(3)) : 0,
        byPlatform,
        byCommunity,
      };
    } catch {
      return {
        totalCampaigns: 0,
        totalClicks: 0,
        totalJoins: 0,
        totalVerified: 0,
        totalActive30d: 0,
        clickToJoinRate: 0,
        joinToVerifiedRate: 0,
        verifiedToActiveRate: 0,
        byPlatform: {},
        byCommunity: {},
      };
    }
  }

  /**
   * REQ-21.7.2: Handles community quality signals and triggers auto-pause on moderator warning/removal
   */
  public handleModeratorSignal(
    platform: string,
    community: string,
    signal: 'warning' | 'removal' | 'upvote' | 'thanks',
    note?: string
  ): { paused: boolean; message: string; signal: string } {
    if (signal === 'warning' || signal === 'removal') {
      const reason = note || `Moderator signal: ${signal.toUpperCase()}`;
      opportunityDiscoveryService.pauseCommunity(platform, community, reason);
      logger.warn(`[QualityLoop] Community ${platform}/${community} auto-paused due to moderator ${signal}: ${reason}`);
      return {
        paused: true,
        message: `Community ${platform}/${community} automatically paused due to moderator ${signal}. Owners notified.`,
        signal,
      };
    }

    logger.info(`[QualityLoop] Positive signal "${signal}" received for ${platform}/${community}`);
    return {
      paused: false,
      message: `Positive signal "${signal}" logged for ${platform}/${community}`,
      signal,
    };
  }

  /**
   * REQ-21.7.3: Record ambassador edits as labeled training dataset
   */
  public recordAmbassadorEdit(data: {
    reviewId: string;
    originalDraft: string;
    editedReply: string;
    reason?: string;
    category: string;
    platform: string;
  }): AmbassadorEditExample {
    const example: AmbassadorEditExample = {
      id: cryptoRandomUUID(),
      reviewId: data.reviewId,
      originalDraft: data.originalDraft,
      editedReply: data.editedReply,
      reason: data.reason,
      category: data.category,
      platform: data.platform,
      charDelta: data.editedReply.length - data.originalDraft.length,
      timestamp: Date.now(),
    };

    this.learningDataset.push(example);
    logger.info(
      `[LearningLoop] Recorded ambassador edit for review ${data.reviewId} (Delta: ${example.charDelta} chars, Category: ${data.category})`
    );
    return example;
  }

  public getLearningDataset(limit: number = 50): AmbassadorEditExample[] {
    return this.learningDataset.slice(-limit);
  }

  /**
   * REQ-21.7.4: Generate weekly intelligence report
   */
  public generateWeeklyReport(guildId: string): WeeklyIntelligenceReport {
    // 1. Full heatmap
    const heatmap = supplyDemandEngine.generateFullHeatmap(guildId);
    const gapShifts = heatmap.map(h => ({
      category: h.category,
      gapScore: h.gapScore,
      trend: h.trend,
      demandIndex: h.demandIndex,
      effectiveSupply: h.effectiveSupply,
    }));

    // 2. Review queue counts
    const reviewCounts = { pending: 0, approved: 0, rejected: 0, doNotPost: 0 };
    try {
      const rows = dbService.all<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count FROM outreach_reviews GROUP BY status`
      );
      for (const r of rows) {
        if (r.status === 'pending') reviewCounts.pending = r.count;
        if (r.status === 'approved') reviewCounts.approved = r.count;
        if (r.status === 'rejected') reviewCounts.rejected = r.count;
        if (r.status === 'do_not_post') reviewCounts.doNotPost = r.count;
      }
    } catch {
      // ignore
    }

    // 3. Attribution funnel
    const funnel = this.getFunnelMetrics();

    // 4. Top performing sources
    const topPerformingSources = Object.entries(funnel.byCommunity)
      .map(([commKey, metrics]) => {
        const [platform, community] = commKey.split('/');
        return {
          platform,
          community,
          joins: metrics.joins,
          conversionRate: metrics.clicks > 0 ? Number((metrics.joins / metrics.clicks).toFixed(3)) : 0,
        };
      })
      .sort((a, b) => b.joins - a.joins)
      .slice(0, 5);

    // 5. Recommended focus areas (top 3 gaps)
    const sortedGaps = [...heatmap].sort((a, b) => b.gapScore - a.gapScore);
    const recommendedFocusAreas = sortedGaps.slice(0, 3).map(g => g.category);

    const reportId = `report_outreach_${Date.now()}`;
    const generatedAt = Date.now();

    const enSummary = `Weekly Nexus Outreach Digest:
- Highest Skill Gaps: ${recommendedFocusAreas.join(', ')}
- Review Queue: ${reviewCounts.approved} approved, ${reviewCounts.rejected} rejected, ${reviewCounts.pending} pending.
- Conversion Funnel: ${funnel.totalClicks} clicks -> ${funnel.totalJoins} joins (${funnel.totalVerified} verified members).
- Recommendations: Direct outreach toward ${recommendedFocusAreas[0]} developers and host community challenges.`;

    const arSummary = `تقرير نكسس الأسبوعي لذكاء العرض والطلب:
- أكبر فجوات مهارات حالياً: ${recommendedFocusAreas.join('، ')}
- نشاط المراجعة: ${reviewCounts.approved} منشور تم قبوله، ${reviewCounts.rejected} مرفوض، ${reviewCounts.pending} قيد الانتظار.
- مسار التحويل: ${funnel.totalClicks} نقرة -> ${funnel.totalJoins} عضو منضم (${funnel.totalVerified} عضو موثق).
- التوصيات: نركز في الفترة دي على استقطاب مبرمجين في مجال ${recommendedFocusAreas[0]} وتنظيم تحديات مجتمعية.`;

    return {
      reportId,
      guildId,
      generatedAt,
      gapShifts,
      outreachFunnel: funnel,
      reviewQueueActivity: reviewCounts,
      topPerformingSources,
      recommendedFocusAreas,
      bilingualSummary: {
        en: enSummary,
        ar: arSummary,
      },
    };
  }
}

export const attributionFunnelService = new AttributionFunnelService();
