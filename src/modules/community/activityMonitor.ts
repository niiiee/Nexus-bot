import { guildRepo } from '../../database/repositories/guildRepo.js';
import { dbService } from '../../database/connection.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ActivityMonitor');

export interface ActivitySnapshot {
  guildId: string;
  totalMessages: number;
  totalSubmissions: number;
  activeUsersCount: number;
  engagementIndex: number; // 0 to 100 composite index
  dropPercentage: number;
  isBelowThreshold: boolean;
  isInQuietHours: boolean;
}

export class ActivityMonitor {
  private pingsThisHour: Map<string, number> = new Map();
  private lastPingReset: number = Date.now();

  public recordActivity(guildId: string, userId: string, type: 'message' | 'submission'): void {
    // In production or tests, activities can be logged to a rolling window table or memory
    // For fast retrieval, we can query recent activity
  }

  public evaluateGuildActivity(params: {
    guildId: string;
    recentMessagesCount: number;
    baselineMessagesCount: number;
    recentSubmissionsCount: number;
    currentUtcHour?: number;
  }): ActivitySnapshot {
    const config = guildRepo.getOrCreate(params.guildId);
    const utcHour = params.currentUtcHour ?? new Date().getUTCHours();

    // Check quiet hours (e.g. 22:00 to 06:00 UTC)
    let isInQuietHours = false;
    if (config.quiet_hours_start > config.quiet_hours_end) {
      isInQuietHours = utcHour >= config.quiet_hours_start || utcHour < config.quiet_hours_end;
    } else {
      isInQuietHours = utcHour >= config.quiet_hours_start && utcHour < config.quiet_hours_end;
    }

    const baseline = Math.max(1, params.baselineMessagesCount);
    const dropPercentage = Math.max(0, ((baseline - params.recentMessagesCount) / baseline) * 100);
    const isBelowThreshold = dropPercentage >= 40; // Dropped by >= 40%

    const engagementIndex = Math.min(
      100,
      Math.round((params.recentMessagesCount * 1.5 + params.recentSubmissionsCount * 10) / (baseline / 50 || 1))
    );

    return {
      guildId: params.guildId,
      totalMessages: params.recentMessagesCount,
      totalSubmissions: params.recentSubmissionsCount,
      activeUsersCount: Math.round(params.recentMessagesCount * 0.3),
      engagementIndex,
      dropPercentage: Math.round(dropPercentage),
      isBelowThreshold,
      isInQuietHours,
    };
  }

  public canPingEvents(guildId: string, maxHourlyPings: number = 3): boolean {
    const now = Date.now();
    if (now - this.lastPingReset > 3600 * 1000) {
      this.pingsThisHour.clear();
      this.lastPingReset = now;
    }

    const currentPings = this.pingsThisHour.get(guildId) || 0;
    return currentPings < maxHourlyPings;
  }

  public recordPing(guildId: string): void {
    const current = this.pingsThisHour.get(guildId) || 0;
    this.pingsThisHour.set(guildId, current + 1);
  }
}

export const activityMonitor = new ActivityMonitor();
