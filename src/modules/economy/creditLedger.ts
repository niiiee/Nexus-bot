import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface LedgerTransaction {
  id: string;
  userId: string;
  guildId: string;
  amount: number;
  type: 'faucet_reward' | 'quest_reward' | 'perk_purchase' | 'transfer_in' | 'transfer_out' | 'marketplace_escrow' | 'marketplace_payout' | 'admin_grant' | 'rollback';
  description: string;
  balanceAfter: number;
  timestamp: number;
}

export class CreditLedgerService {
  private dailyEarningCap = 500; // max daily faucet/chat credits

  /**
   * Gets current balance of a member.
   */
  public getBalance(userId: string, guildId: string): number {
    const row = dbService.get<{ credits: number }>(
      `SELECT credits FROM members WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );
    return row?.credits || 0;
  }

  /**
   * Calculates total credits earned from faucets/quests in the last 24 hours.
   */
  public getDailyEarnedCredits(userId: string): number {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const row = dbService.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM credit_ledger 
       WHERE user_id = ? AND source IN ('faucet_reward', 'quest_reward') AND timestamp >= ?`,
      userId,
      oneDayAgo
    );
    return row?.total || 0;
  }

  /**
   * Records an immutable credit ledger operation with balance check and daily cap enforcement.
   */
  public recordTransaction(params: {
    userId: string;
    guildId: string;
    amount: number; // positive for credit, negative for debit
    type: LedgerTransaction['type'];
    description: string;
    bypassCap?: boolean;
  }): { success: boolean; transaction?: LedgerTransaction; error?: string } {
    const currentBalance = this.getBalance(params.userId, params.guildId);

    // If debiting, ensure non-negative balance
    if (params.amount < 0 && currentBalance + params.amount < 0) {
      return { success: false, error: 'Insufficient credit balance' };
    }

    // If faucet or quest reward, check daily cap
    if (params.amount > 0 && !params.bypassCap && (params.type === 'faucet_reward' || params.type === 'quest_reward')) {
      const dailyEarned = this.getDailyEarnedCredits(params.userId);
      if (dailyEarned >= this.dailyEarningCap) {
        return { success: false, error: `Daily earning cap of ${this.dailyEarningCap} credits reached` };
      }
      // Clamp to remaining daily allowance
      params.amount = Math.min(params.amount, this.dailyEarningCap - dailyEarned);
    }

    const newBalance = currentBalance + params.amount;
    const id = cryptoRandomUUID();
    const timestamp = Date.now();

    try {
      dbService.transaction(() => {
        // Update member credits and credits_balance
        dbService.run(
          `UPDATE members SET credits = ?, credits_balance = ? WHERE user_id = ? AND guild_id = ?`,
          newBalance,
          newBalance,
          params.userId,
          params.guildId
        );

        // Record in credit_ledger
        dbService.run(
          `INSERT INTO credit_ledger (id, user_id, guild_id, amount, balance_after, source, description, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          params.userId,
          params.guildId,
          params.amount,
          newBalance,
          params.type,
          params.description,
          timestamp
        );
      });

      logger.info(`[CreditLedger] User ${params.userId}: ${params.type} ${params.amount > 0 ? '+' : ''}${params.amount}. Balance: ${newBalance}`);

      return {
        success: true,
        transaction: {
          id,
          userId: params.userId,
          guildId: params.guildId,
          amount: params.amount,
          type: params.type,
          description: params.description,
          balanceAfter: newBalance,
          timestamp,
        },
      };
    } catch (err) {
      logger.error(`[CreditLedger] Failed to execute ledger transaction:`, err);
      return { success: false, error: 'Database transaction failed' };
    }
  }

  /**
   * Transfers credits between two members.
   */
  public transferCredits(
    fromUserId: string,
    toUserId: string,
    guildId: string,
    amount: number,
    memo?: string
  ): { success: boolean; error?: string } {
    if (amount <= 0) {
      return { success: false, error: 'Transfer amount must be positive' };
    }

    if (fromUserId === toUserId) {
      return { success: false, error: 'Cannot transfer to yourself' };
    }

    const debit = this.recordTransaction({
      userId: fromUserId,
      guildId,
      amount: -amount,
      type: 'transfer_out',
      description: `Transfer to ${toUserId}: ${memo || 'Member transfer'}`,
      bypassCap: true,
    });

    if (!debit.success) {
      return { success: false, error: debit.error };
    }

    const credit = this.recordTransaction({
      userId: toUserId,
      guildId,
      amount: amount,
      type: 'transfer_in',
      description: `Transfer from ${fromUserId}: ${memo || 'Member transfer'}`,
      bypassCap: true,
    });

    if (!credit.success) {
      // Rollback debit
      this.recordTransaction({
        userId: fromUserId,
        guildId,
        amount: amount,
        type: 'rollback',
        description: `Rollback failed transfer to ${toUserId}`,
        bypassCap: true,
      });
      return { success: false, error: 'Transfer failed, funds rolled back' };
    }

    return { success: true };
  }
}

export const creditLedgerService = new CreditLedgerService();
