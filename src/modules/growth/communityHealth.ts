import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { feedbackLoopsService } from './feedbackLoops.js';

export interface CommunityHealthScore {
  guildId: string;
  overallScore: number; // 0 - 100
  grade: 'Thriving' | 'Healthy' | 'Fair' | 'At Risk';
  metrics: {
    activeRatio: number;
    retentionScore: number;
    moderationHealth: number;
    sentimentScore: number;
    vitalityScore: number;
  };
  recommendations: string[];
}

export class CommunityHealthService {
  /**
   * Computes the weekly composite community health index.
   */
  public computeWeeklyHealth(guildId: string): CommunityHealthScore {
    // 1. Total members
    const totalMembers = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM members WHERE guild_id = ?`,
      guildId
    )?.count || 1;

    // 2. Active members in last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeSubmissions = dbService.get<{ count: number }>(
      `SELECT COUNT(DISTINCT user_id) as count FROM task_submissions WHERE created_at >= ?`,
      sevenDaysAgo
    )?.count || 0;

    const activeTimes = dbService.get<{ count: number }>(
      `SELECT COUNT(DISTINCT user_id) as count FROM time_entries WHERE start_time >= ?`,
      sevenDaysAgo
    )?.count || 0;

    const activeCount = Math.max(activeSubmissions, activeTimes, 1);
    const activeRatio = Math.min(100, Math.round((activeCount / totalMembers) * 100));

    // 3. Churn / Dormancy check (members inactive > 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const dormantCount = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM members WHERE guild_id = ? AND created_at < ?`,
      guildId,
      thirtyDaysAgo
    )?.count || 0;

    const churnRate = totalMembers > 0 ? (dormantCount / totalMembers) * 100 : 0;
    const retentionScore = Math.max(0, Math.min(100, Math.round(100 - churnRate * 0.5)));

    // 4. Moderation Health (unresolved incidents penalize score)
    const openIncidents = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM incidents WHERE guild_id = ? AND resolved = 0`,
      guildId
    )?.count || 0;

    const moderationHealth = Math.max(0, 100 - openIncidents * 15);

    // 5. Sentiment Score from pulse surveys
    const pulse = feedbackLoopsService.getPulseMetrics(guildId);
    // If no responses, default to 75
    const sentimentScore = pulse.totalResponses > 0
      ? Math.round((pulse.averageRating / 5) * 100)
      : 75;

    // 6. Vitality Score (tasks + jobs + suggestions)
    const recentTasks = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_submissions WHERE created_at >= ?`,
      sevenDaysAgo
    )?.count || 0;
    const recentJobs = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM jobs WHERE guild_id = ? AND created_at >= ?`,
      guildId,
      sevenDaysAgo
    )?.count || 0;

    const vitalityScore = Math.min(100, (recentTasks * 5) + (recentJobs * 10));

    // Composite Weighted Calculation
    // Active Ratio: 25%, Retention: 25%, Moderation: 20%, Sentiment: 20%, Vitality: 10%
    const overallScore = Math.round(
      activeRatio * 0.25 +
      retentionScore * 0.25 +
      moderationHealth * 0.20 +
      sentimentScore * 0.20 +
      vitalityScore * 0.10
    );

    let grade: 'Thriving' | 'Healthy' | 'Fair' | 'At Risk' = 'Fair';
    if (overallScore >= 85) grade = 'Thriving';
    else if (overallScore >= 70) grade = 'Healthy';
    else if (overallScore >= 50) grade = 'Fair';
    else grade = 'At Risk';

    const recommendations: string[] = [];
    if (activeRatio < 40) {
      recommendations.push('Run a win-back campaign or host a live workshop to reactivate dormant members.');
    }
    if (openIncidents > 2) {
      recommendations.push('Address unresolved moderation incidents in the queue to maintain community safety.');
    }
    if (pulse.averageRating < 3.5 && pulse.totalResponses > 0) {
      recommendations.push('Review pulse survey feedback and address member pain points in the next changelog.');
    }
    if (vitalityScore < 30) {
      recommendations.push('Post new daily programming and design challenges to spark engagement.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Community metrics are in great shape! Keep nurturing squad leaders and high performers.');
    }

    return {
      guildId,
      overallScore,
      grade,
      metrics: {
        activeRatio,
        retentionScore,
        moderationHealth,
        sentimentScore,
        vitalityScore,
      },
      recommendations,
    };
  }
}

export const communityHealthService = new CommunityHealthService();
