import { describe, it, expect } from 'vitest';
import { activityMonitor } from '../../src/modules/community/activityMonitor.js';
import { eventGenerator } from '../../src/modules/community/eventGenerator.js';

describe('Phase 3: Activity Monitor & Community Events (Section 5)', () => {
  const guildId = 'guild_activity_1';

  it('calculates activity index and flags drops below threshold', () => {
    // Normal activity
    const healthy = activityMonitor.evaluateGuildActivity({
      guildId,
      recentMessagesCount: 100,
      baselineMessagesCount: 120,
      recentSubmissionsCount: 5,
      currentUtcHour: 14, // 2 PM UTC (outside quiet hours)
    });
    expect(healthy.isBelowThreshold).toBe(false);
    expect(healthy.isInQuietHours).toBe(false);

    // Activity dropped by 60%
    const dropped = activityMonitor.evaluateGuildActivity({
      guildId,
      recentMessagesCount: 40,
      baselineMessagesCount: 100,
      recentSubmissionsCount: 1,
      currentUtcHour: 15,
    });
    expect(dropped.isBelowThreshold).toBe(true);
    expect(dropped.dropPercentage).toBe(60);
  });

  it('suppresses event pings during quiet hours (22:00 to 06:00 UTC)', async () => {
    const quietSnapshot = activityMonitor.evaluateGuildActivity({
      guildId,
      recentMessagesCount: 20,
      baselineMessagesCount: 100,
      recentSubmissionsCount: 0,
      currentUtcHour: 23, // 11 PM UTC (inside quiet hours)
    });
    expect(quietSnapshot.isInQuietHours).toBe(true);

    const triggered = await eventGenerator.triggerEventIfNeeded({
      guildId,
      snapshot: quietSnapshot,
      language: 'en',
    });
    expect(triggered).toBeNull();
  });

  it('triggers context-aware event and respects hourly ping rate limits', async () => {
    const lowSnapshot = activityMonitor.evaluateGuildActivity({
      guildId,
      recentMessagesCount: 30,
      baselineMessagesCount: 100,
      recentSubmissionsCount: 0,
      currentUtcHour: 14,
    });

    const eventAr = await eventGenerator.triggerEventIfNeeded({
      guildId,
      snapshot: lowSnapshot,
      language: 'ar',
    });

    expect(eventAr).not.toBeNull();
    expect(eventAr?.targetRole).toBeDefined();
    expect(eventAr?.title).toBeDefined();
    expect(eventAr?.shouldPing).toBe(true);
  });
});
