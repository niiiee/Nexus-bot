import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'crypto';

export interface EarningsEntry {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  source: string;
  dateStr: string;
  createdAt: number;
}

export interface MonthlyEarningsSummary {
  userId: string;
  month: string;
  totalAmount: number;
  currency: string;
  entryCount: number;
  asciiChart: string;
}

export class EarningsLedgerService {
  // 32-byte encryption key for AES-256-CBC (isolated to memory/instance)
  private encryptionKey = randomBytes(32);
  private iv = randomBytes(16);

  private encryptAmount(amount: number): string {
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, this.iv);
    let encrypted = cipher.update(amount.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptAmount(encryptedHex: string): number {
    try {
      const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, this.iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return parseFloat(decrypted);
    } catch {
      return 0;
    }
  }

  public logEarnings(params: {
    userId: string;
    amount: number;
    currency: string;
    source: string;
    dateStr?: string;
  }): EarningsEntry {
    const id = `earn_${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const dateStr = params.dateStr || new Date().toISOString().slice(0, 7); // YYYY-MM
    const encryptedAmount = this.encryptAmount(params.amount);

    dbService.run(
      `INSERT INTO earnings_records (id, user_id, encrypted_amount, currency, source, date_str, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      params.userId,
      encryptedAmount,
      params.currency,
      params.source,
      dateStr,
      now
    );

    logger.info('EarningsLedger', `Logged private earnings for user ${params.userId} in date ${dateStr}`);

    return {
      id,
      userId: params.userId,
      amount: params.amount,
      currency: params.currency,
      source: params.source,
      dateStr,
      createdAt: now,
    };
  }

  public getMonthlySummary(userId: string, targetMonth?: string): MonthlyEarningsSummary {
    const month = targetMonth || new Date().toISOString().slice(0, 7);
    const rows = dbService.all<{
      encrypted_amount: string;
      currency: string;
      source: string;
    }>(
      `SELECT encrypted_amount, currency, source FROM earnings_records 
       WHERE user_id = ? AND date_str = ?`,
      userId,
      month
    );

    let totalAmount = 0;
    let currency = 'USD';
    const sourceBreakdown: Record<string, number> = {};

    for (const r of rows) {
      currency = r.currency;
      const amt = this.decryptAmount(r.encrypted_amount);
      totalAmount += amt;
      sourceBreakdown[r.source] = (sourceBreakdown[r.source] || 0) + amt;
    }

    // Build ASCII horizontal bar chart
    let asciiChart = `📊 Monthly Earnings Chart (${month})\n`;
    for (const src in sourceBreakdown) {
      const srcAmt = sourceBreakdown[src];
      const barLength = Math.max(1, Math.min(25, Math.round((srcAmt / (totalAmount || 1)) * 20)));
      const bar = '█'.repeat(barLength);
      asciiChart += `${src.padEnd(12)} | ${bar} ${srcAmt} ${currency}\n`;
    }

    return {
      userId,
      month,
      totalAmount,
      currency,
      entryCount: rows.length,
      asciiChart,
    };
  }
}

export const earningsLedgerService = new EarningsLedgerService();
