import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export interface EconomyHealthMetrics {
  guildId: string;
  totalCreditSupply: number;
  faucetTotal7d: number;
  sinkTotal7d: number;
  sinkToFaucetRatio: number; // ideal is ~0.7 to 1.1
  moneyVelocity: number;
  inflationStatus: 'Deflationary' | 'Balanced' | 'Moderate Inflation' | 'High Inflation';
  recommendedFaucetMultiplier: number; // e.g. 1.0, 0.8, 1.2
  actionableNotes: string[];
}

export class EconomyBalancingService {
  /**
   * Computes the macroeconomic health of the server credit economy.
   */
  public evaluateEconomy(guildId: string): EconomyHealthMetrics {
    // 1. Total credit supply in circulation
    const totalCirculation = dbService.get<{ total: number }>(
      `SELECT COALESCE(SUM(credits), 0) as total FROM members WHERE guild_id = ?`,
      guildId
    )?.total || 0;

    // 2. Faucets & Sinks in the last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const faucet7d = dbService.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM credit_ledger 
       WHERE guild_id = ? AND source IN ('faucet_reward', 'quest_reward', 'admin_grant') AND timestamp >= ?`,
      guildId,
      sevenDaysAgo
    )?.total || 1; // avoid division by 0

    const sink7d = Math.abs(dbService.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM credit_ledger 
       WHERE guild_id = ? AND source IN ('perk_purchase', 'marketplace_escrow') AND amount < 0 AND timestamp >= ?`,
      guildId,
      sevenDaysAgo
    )?.total || 0);

    const sinkToFaucetRatio = parseFloat((sink7d / Math.max(1, faucet7d)).toFixed(2));

    // 3. Velocity: (total volume transferred or spent) / total supply
    const totalVolume7d = dbService.get<{ total: number }>(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM credit_ledger 
       WHERE guild_id = ? AND timestamp >= ?`,
      guildId,
      sevenDaysAgo
    )?.total || 0;

    const moneyVelocity = totalCirculation > 0
      ? parseFloat((totalVolume7d / totalCirculation).toFixed(2))
      : 0;

    // 4. Inflation Diagnosis
    let inflationStatus: EconomyHealthMetrics['inflationStatus'] = 'Balanced';
    let multiplier = 1.0;
    const notes: string[] = [];

    if (sinkToFaucetRatio < 0.4) {
      inflationStatus = 'High Inflation';
      multiplier = 0.75; // cut faucet payouts by 25%
      notes.push('Faucet output exceeds sink consumption significantly. Introducing limited-edition perks or auction sinks is recommended.');
    } else if (sinkToFaucetRatio < 0.7) {
      inflationStatus = 'Moderate Inflation';
      multiplier = 0.9;
      notes.push('Slight inflationary pressure detected. Monitor quest payouts and perk store pricing.');
    } else if (sinkToFaucetRatio > 1.3) {
      inflationStatus = 'Deflationary';
      multiplier = 1.25; // boost faucet payouts by 25%
      notes.push('Economy is currently deflationary (sinks draining credits faster than minted). Increase quest rewards to stimulate circulation.');
    } else {
      inflationStatus = 'Balanced';
      notes.push('Credit minting and sinking are in healthy equilibrium.');
    }

    if (moneyVelocity < 0.2) {
      notes.push('Low money velocity detected (members hoarding credits). Consider running a community challenge or marketplace rebate.');
    }

    return {
      guildId,
      totalCreditSupply: totalCirculation,
      faucetTotal7d: faucet7d,
      sinkTotal7d: sink7d,
      sinkToFaucetRatio,
      moneyVelocity,
      inflationStatus,
      recommendedFaucetMultiplier: multiplier,
      actionableNotes: notes,
    };
  }
}

export const economyBalancingService = new EconomyBalancingService();
