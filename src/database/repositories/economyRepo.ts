import { dbService } from '../connection.js';
import { memberRepo } from './memberRepo.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  guild_id: string;
  amount: number;
  balance_after: number;
  source: string;
  description: string;
  timestamp: number;
}

export class EconomyRepository {
  public addTransaction(data: {
    user_id: string;
    guild_id: string;
    amount: number; // positive for gain, negative for spend
    source: string;
    description: string;
  }): CreditLedgerEntry {
    const id = uuidv4();
    const timestamp = Date.now();

    // Atomic update of user credits balance
    const member = memberRepo.getOrCreate(data.user_id, data.guild_id, 'Member');
    const newBalance = Math.max(0, member.credits_balance + data.amount);

    if (data.amount < 0 && member.credits_balance < Math.abs(data.amount)) {
      throw new Error(`Insufficient credits balance: has ${member.credits_balance}, requires ${Math.abs(data.amount)}`);
    }

    memberRepo.update(data.user_id, { credits_balance: newBalance });

    dbService.run(
      `INSERT INTO credit_ledger (
        id, user_id, guild_id, amount, balance_after, source, description, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.user_id,
      data.guild_id,
      data.amount,
      newBalance,
      data.source,
      data.description,
      timestamp
    );

    return {
      id,
      user_id: data.user_id,
      guild_id: data.guild_id,
      amount: data.amount,
      balance_after: newBalance,
      source: data.source,
      description: data.description,
      timestamp,
    };
  }

  public addCredits(
    userId: string,
    guildId: string,
    amount: number,
    source: string,
    description: string
  ): CreditLedgerEntry {
    return this.addTransaction({
      user_id: userId,
      guild_id: guildId,
      amount,
      source,
      description,
    });
  }

  public getHistory(userId: string, limit: number = 20): CreditLedgerEntry[] {
    return dbService.all<CreditLedgerEntry>(
      'SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
      userId,
      limit
    );
  }

  public getDailyEarned(userId: string, sinceTimestamp: number): number {
    const rows = dbService.all<{ amount: number }>(
      'SELECT amount FROM credit_ledger WHERE user_id = ? AND amount > 0 AND timestamp >= ?',
      userId,
      sinceTimestamp
    );
    return rows.reduce((sum, r) => sum + r.amount, 0);
  }
}

export const economyRepo = new EconomyRepository();
