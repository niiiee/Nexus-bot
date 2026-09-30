import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export interface MultiPartySplit {
  recipientId: string;
  role: string;
  percentage: number;
  payoutAmount: number;
}

export class ExtraEscrowService {
  private onCallMiddlemenQueue: string[] = [];

  public registerOnCallMiddleman(userId: string): void {
    if (!this.onCallMiddlemenQueue.includes(userId)) {
      this.onCallMiddlemenQueue.push(userId);
      logger.info('ExtraEscrow', `Middleman ${userId} added to on-call rotation queue`);
    }
  }

  public getNextOnCallMiddleman(dealAmount: number): string | null {
    if (this.onCallMiddlemenQueue.length === 0) return null;

    // Filter by capacity
    for (let i = 0; i < this.onCallMiddlemenQueue.length; i++) {
      const candidateId = this.onCallMiddlemenQueue[i];
      const middleman = dbService.get<{ max_deal_size: number; is_suspended: number }>(
        `SELECT max_deal_size, is_suspended FROM middlemen WHERE user_id = ?`,
        candidateId
      );

      if (middleman && !middleman.is_suspended && middleman.max_deal_size >= dealAmount) {
        // Rotate to back of line
        this.onCallMiddlemenQueue.splice(i, 1);
        this.onCallMiddlemenQueue.push(candidateId);
        logger.info('ExtraEscrow', `Assigned on-call middleman ${candidateId} for deal size ${dealAmount}`);
        return candidateId;
      }
    }

    return this.onCallMiddlemenQueue[0];
  }

  public calculateMultiPartySplits(
    totalDealAmount: number,
    splits: Array<{ recipientId: string; role: string; percentage: number }>
  ): MultiPartySplit[] {
    const totalPct = splits.reduce((acc, s) => acc + s.percentage, 0);
    if (totalPct !== 100) {
      throw new Error(`Split percentages must total exactly 100% (currently ${totalPct}%)`);
    }

    return splits.map((s) => ({
      recipientId: s.recipientId,
      role: s.role,
      percentage: s.percentage,
      payoutAmount: Math.round((s.percentage / 100) * totalDealAmount),
    }));
  }

  public calculateMemberReliability(userId: string, guildId: string): {
    reliabilityScore: number; // 0 to 100
    completedDeals: number;
    disputedDeals: number;
    hasTrustedDealmakerBadge: boolean;
  } {
    const deals = dbService.all<{ status: string }>(
      `SELECT status FROM deals WHERE guild_id = ? AND (freelancer_id = ? OR client_id = ?)`,
      guildId,
      userId,
      userId
    );

    let completed = 0;
    let disputed = 0;

    for (const d of deals) {
      if (d.status === 'completed') completed++;
      else if (d.status === 'disputed') disputed++;
    }

    const total = completed + disputed;
    const reliabilityScore = total > 0 ? Math.round((completed / total) * 100) : 100;
    const hasTrustedDealmakerBadge = completed >= 3 && disputed === 0;

    return {
      reliabilityScore,
      completedDeals: completed,
      disputedDeals: disputed,
      hasTrustedDealmakerBadge,
    };
  }
}

export const extraEscrowService = new ExtraEscrowService();
