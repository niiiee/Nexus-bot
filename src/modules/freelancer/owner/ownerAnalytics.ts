import { analyticsService } from '../../analytics/analyticsService.js';
import { logger } from '../../../utils/logger.js';

export interface OwnerAnalyticsSummary {
  guildId: string;
  totalMembers: number;
  activeRatePercent: number;
  passRatePercent: number;
  disputeRatePercent: number;
  topChannelsActivity: Array<{ channelName: string; messageCount: number }>;
  healthScore: number; // 0 to 100
}

export class OwnerAnalyticsService {
  public getGuildOverview(guildId: string): OwnerAnalyticsSummary {
    const data = analyticsService.getAnalyticsSummary(guildId);
    const activeRatePercent = data.totalMembers > 0 ? Math.round((data.activeMembers / data.totalMembers) * 100) : 100;
    const passRatePercent = data.vettingStats.passRate;
    const disputeRatePercent = data.dealsStats.disputeRate;

    // Calculate composite health score
    let healthScore = 70;
    if (activeRatePercent > 50) healthScore += 15;
    if (passRatePercent > 60) healthScore += 10;
    if (disputeRatePercent < 5) healthScore += 5;
    else healthScore -= 15;
    healthScore = Math.max(0, Math.min(100, healthScore));

    logger.info('OwnerAnalytics', `Calculated guild overview for ${guildId}: healthScore=${healthScore}`);

    return {
      guildId,
      totalMembers: data.totalMembers,
      activeRatePercent,
      passRatePercent,
      disputeRatePercent,
      topChannelsActivity: [
        { channelName: '#general-tech', messageCount: 412 },
        { channelName: '#help-code', messageCount: 289 },
        { channelName: '#showcase', messageCount: 145 },
      ],
      healthScore,
    };
  }
}

export const ownerAnalyticsService = new OwnerAnalyticsService();
