import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { creditLedgerService } from './creditLedger.js';

export interface CheatDetectionResult {
  isSuspicious: boolean;
  reason?: 'spam_velocity' | 'repeated_content' | 'reaction_burst';
  actionTaken?: 'warn' | 'cooldown' | 'rollback_and_freeze';
}

export class AntiCheatEngineService {
  // In-memory sliding windows: userId -> timestamps[]
  private messageTimestamps = new Map<string, number[]>();
  private recentMessageHashes = new Map<string, string[]>();
  private reactionTimestamps = new Map<string, number[]>();
  private frozenAccounts = new Set<string>();

  /**
   * Evaluates incoming message activity for farming heuristics.
   */
  public inspectMessageActivity(userId: string, guildId: string, content: string): CheatDetectionResult {
    if (this.frozenAccounts.has(userId)) {
      return { isSuspicious: true, actionTaken: 'rollback_and_freeze', reason: 'spam_velocity' };
    }

    const now = Date.now();

    // 1. Velocity Check (> 8 messages in 10 seconds)
    const tenSecondsAgo = now - 10 * 1000;
    let timestamps = this.messageTimestamps.get(userId) || [];
    timestamps = timestamps.filter(t => t > tenSecondsAgo);
    timestamps.push(now);
    this.messageTimestamps.set(userId, timestamps);

    if (timestamps.length > 8) {
      this.freezeAccountAndRollback(userId, guildId, 'Rapid message spam velocity');
      return {
        isSuspicious: true,
        reason: 'spam_velocity',
        actionTaken: 'rollback_and_freeze',
      };
    }

    // 2. Repeated Copy-Paste Content Check
    const normalized = content.trim().toLowerCase();
    if (normalized.length > 10) {
      let hashes = this.recentMessageHashes.get(userId) || [];
      const identicalCount = hashes.filter(h => h === normalized).length;
      hashes.push(normalized);
      if (hashes.length > 10) hashes.shift();
      this.recentMessageHashes.set(userId, hashes);

      if (identicalCount >= 4) {
        this.freezeAccountAndRollback(userId, guildId, 'Repeated duplicate message spam');
        return {
          isSuspicious: true,
          reason: 'repeated_content',
          actionTaken: 'rollback_and_freeze',
        };
      }
    }

    return { isSuspicious: false };
  }

  /**
   * Evaluates reaction velocity (> 15 reactions in 5 seconds).
   */
  public inspectReactionActivity(userId: string, guildId: string): CheatDetectionResult {
    const now = Date.now();
    const fiveSecondsAgo = now - 5000;
    let timestamps = this.reactionTimestamps.get(userId) || [];
    timestamps = timestamps.filter(t => t > fiveSecondsAgo);
    timestamps.push(now);
    this.reactionTimestamps.set(userId, timestamps);

    if (timestamps.length > 15) {
      this.freezeAccountAndRollback(userId, guildId, 'Reaction farming burst');
      return {
        isSuspicious: true,
        reason: 'reaction_burst',
        actionTaken: 'rollback_and_freeze',
      };
    }

    return { isSuspicious: false };
  }

  /**
   * Freezes account and rolls back credits earned in the last 1 hour.
   */
  public freezeAccountAndRollback(userId: string, guildId: string, reason: string): void {
    this.frozenAccounts.add(userId);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    // Sum credits earned recently
    const recentFarmed = dbService.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM credit_ledger 
       WHERE user_id = ? AND source IN ('faucet_reward', 'quest_reward') AND timestamp >= ?`,
      userId,
      oneHourAgo
    )?.total || 0;

    if (recentFarmed > 0) {
      creditLedgerService.recordTransaction({
        userId,
        guildId,
        amount: -recentFarmed,
        type: 'rollback',
        description: `Anti-cheat penalty rollback: ${reason}`,
        bypassCap: true,
      });
    }

    // Log incident
    dbService.run(
      `INSERT INTO incidents (id, guild_id, type, severity, summary, timeline_json, resolved, created_at)
       VALUES (?, ?, 'economy_exploit', 'medium', ?, ?, 0, ?)`,
      `ac_${Date.now()}_${userId.slice(0, 4)}`,
      guildId,
      `User ${userId} flagged for credit farming (${reason})`,
      JSON.stringify([{ timestamp: Date.now(), event: `Account frozen and ${recentFarmed} credits revoked` }]),
      Date.now()
    );

    logger.warn(`[AntiCheat] User ${userId} flagged: ${reason}. Revoked ${recentFarmed} credits and froze economy interactions.`);
  }

  /**
   * Checks if an account is currently frozen.
   */
  public isFrozen(userId: string): boolean {
    return this.frozenAccounts.has(userId);
  }

  /**
   * Unfreezes an account upon staff review.
   */
  public unfreezeAccount(userId: string): void {
    this.frozenAccounts.delete(userId);
    this.messageTimestamps.delete(userId);
    this.reactionTimestamps.delete(userId);
    logger.info(`[AntiCheat] User ${userId} unfrozen by staff.`);
  }
}

export const antiCheatEngineService = new AntiCheatEngineService();
