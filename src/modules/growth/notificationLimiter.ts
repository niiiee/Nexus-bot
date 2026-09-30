import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export type NotificationCategory = 'growth_digest' | 'job_alert' | 'event_reminder' | 'quest' | 'security' | 'escrow';

export interface UserNotificationPreference {
  userId: string;
  allowJobAlerts: boolean;
  allowEventReminders: boolean;
  allowGrowthDigests: boolean;
  quietHoursStart: number; // e.g. 23 (11 PM)
  quietHoursEnd: number;   // e.g. 8 (8 AM)
}

export class NotificationLimiterService {
  // In-memory window tracking for rate limiting: userId -> timestamps[]
  private dmTimestamps = new Map<string, number[]>();
  private defaultMaxPerDay = 3;

  /**
   * Checks whether a notification DM can be sent to the user right now.
   */
  public canSendDM(
    userId: string,
    category: NotificationCategory,
    userPref?: Partial<UserNotificationPreference>
  ): { allowed: boolean; reason?: string } {
    // Critical security and escrow notifications always bypass limits
    if (category === 'security' || category === 'escrow') {
      return { allowed: true };
    }

    // 1. Check user preferences
    if (userPref) {
      if (category === 'job_alert' && userPref.allowJobAlerts === false) {
        return { allowed: false, reason: 'User opted out of job alerts' };
      }
      if (category === 'event_reminder' && userPref.allowEventReminders === false) {
        return { allowed: false, reason: 'User opted out of event reminders' };
      }
      if (category === 'growth_digest' && userPref.allowGrowthDigests === false) {
        return { allowed: false, reason: 'User opted out of digests' };
      }
    }

    // 2. Check Quiet Hours
    const now = new Date();
    const currentHour = now.getUTCHours(); // or local server hour
    const quietStart = userPref?.quietHoursStart ?? 22; // 10 PM
    const quietEnd = userPref?.quietHoursEnd ?? 8;      // 8 AM

    const isQuietHour = quietStart > quietEnd
      ? (currentHour >= quietStart || currentHour < quietEnd)
      : (currentHour >= quietStart && currentHour < quietEnd);

    if (isQuietHour) {
      return { allowed: false, reason: 'Suppressed during quiet hours' };
    }

    // 3. Rate Limit check (max per 24 hours)
    const nowMs = Date.now();
    const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;

    let timestamps = this.dmTimestamps.get(userId) || [];
    timestamps = timestamps.filter(t => t > oneDayAgo);
    this.dmTimestamps.set(userId, timestamps);

    if (timestamps.length >= this.defaultMaxPerDay) {
      return { allowed: false, reason: `Rate limit reached (${this.defaultMaxPerDay} DMs per 24h)` };
    }

    return { allowed: true };
  }

  /**
   * Records that a DM was successfully dispatched to the user.
   */
  public recordDMSent(userId: string): void {
    const timestamps = this.dmTimestamps.get(userId) || [];
    timestamps.push(Date.now());
    this.dmTimestamps.set(userId, timestamps);
  }

  /**
   * Resets rate limit for testing or administrative purposes.
   */
  public resetLimits(userId: string): void {
    this.dmTimestamps.delete(userId);
  }
}

export const notificationLimiterService = new NotificationLimiterService();
