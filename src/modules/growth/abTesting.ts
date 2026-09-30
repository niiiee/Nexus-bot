import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export type ABVariant = 'A' | 'B';

export interface ABTestResult {
  testName: string;
  isActive: boolean;
  variantA: { views: number; conversions: number; conversionRate: number };
  variantB: { views: number; conversions: number; conversionRate: number };
  upliftPercentage: number;
  leadingVariant: 'A' | 'B' | 'Tie';
}

export class ABTestingService {
  /**
   * Assigns a deterministic variant ('A' or 'B') for a user in a given experiment.
   */
  public getOrAssignVariant(userId: string, testName: string): ABVariant {
    // Simple fast deterministic hash
    let hash = 0;
    const combined = `${userId}:${testName}`;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
  }

  /**
   * Initializes or fetches an active A/B test in a guild.
   */
  public getOrCreateTest(guildId: string, testName: string): void {
    const existing = dbService.get<{ id: string }>(
      `SELECT id FROM ab_tests WHERE guild_id = ? AND test_name = ?`,
      guildId,
      testName
    );

    if (!existing) {
      dbService.run(
        `INSERT INTO ab_tests (id, guild_id, test_name, variant_a_views, variant_a_conversions, variant_b_views, variant_b_conversions, is_active)
         VALUES (?, ?, ?, 0, 0, 0, 0, 1)`,
        cryptoRandomUUID(),
        guildId,
        testName
      );
    }
  }

  /**
   * Records a view / impression for the given variant.
   */
  public recordImpression(guildId: string, testName: string, variant: ABVariant): void {
    this.getOrCreateTest(guildId, testName);
    const col = variant === 'A' ? 'variant_a_views' : 'variant_b_views';
    dbService.run(
      `UPDATE ab_tests SET ${col} = ${col} + 1 WHERE guild_id = ? AND test_name = ? AND is_active = 1`,
      guildId,
      testName
    );
  }

  /**
   * Records a conversion event (e.g. completed onboarding quest, joined first squad).
   */
  public recordConversion(guildId: string, testName: string, variant: ABVariant): void {
    this.getOrCreateTest(guildId, testName);
    const col = variant === 'A' ? 'variant_a_conversions' : 'variant_b_conversions';
    dbService.run(
      `UPDATE ab_tests SET ${col} = ${col} + 1 WHERE guild_id = ? AND test_name = ? AND is_active = 1`,
      guildId,
      testName
    );
  }

  /**
   * Computes experiment statistics and conversion rates.
   */
  public getTestResults(guildId: string, testName: string): ABTestResult | null {
    const test = dbService.get<{
      test_name: string;
      variant_a_views: number;
      variant_a_conversions: number;
      variant_b_views: number;
      variant_b_conversions: number;
      is_active: number;
    }>(
      `SELECT test_name, variant_a_views, variant_a_conversions, variant_b_views, variant_b_conversions, is_active
       FROM ab_tests WHERE guild_id = ? AND test_name = ?`,
      guildId,
      testName
    );

    if (!test) return null;

    const rateA = test.variant_a_views > 0
      ? (test.variant_a_conversions / test.variant_a_views) * 100
      : 0;

    const rateB = test.variant_b_views > 0
      ? (test.variant_b_conversions / test.variant_b_views) * 100
      : 0;

    let uplift = 0;
    let leader: 'A' | 'B' | 'Tie' = 'Tie';

    if (rateA > rateB) {
      leader = 'A';
      uplift = rateB > 0 ? parseFloat((((rateA - rateB) / rateB) * 100).toFixed(2)) : 100;
    } else if (rateB > rateA) {
      leader = 'B';
      uplift = rateA > 0 ? parseFloat((((rateB - rateA) / rateA) * 100).toFixed(2)) : 100;
    }

    return {
      testName: test.test_name,
      isActive: test.is_active === 1,
      variantA: {
        views: test.variant_a_views,
        conversions: test.variant_a_conversions,
        conversionRate: parseFloat(rateA.toFixed(2)),
      },
      variantB: {
        views: test.variant_b_views,
        conversions: test.variant_b_conversions,
        conversionRate: parseFloat(rateB.toFixed(2)),
      },
      upliftPercentage: uplift,
      leadingVariant: leader,
    };
  }
}

export const abTestingService = new ABTestingService();
