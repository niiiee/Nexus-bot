import { dbService } from '../../database/connection.js';
import { dealRepo } from '../../database/repositories/dealRepo.js';
import { aiOrchestrator } from '../../ai/orchestrator.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface DisputeRecord {
  id: string;
  dealId: string;
  initiatorId: string;
  reason: string;
  aiSummary: string;
  ladderLevel: 'middleman' | 'senior_middleman' | 'owner';
  status: 'open' | 'resolved' | 'cancelled';
  resolutionNotes?: string;
  createdAt: number;
  resolvedAt?: number;
}

export class DisputeEngine {
  public async openDispute(params: {
    dealId: string;
    initiatorId: string;
    reason: string;
    chatTranscriptSummary?: string;
  }): Promise<DisputeRecord> {
    const deal = dealRepo.getDealById(params.dealId);
    if (!deal) throw new Error('Deal not found');

    const id = `disp_${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    // Generate neutral AI summary and recommendation
    const prompt = `You are Senior Progg, acting as a strictly neutral, objective technical mediator for a freelancer escrow dispute.
Deal Title: "${deal.title}"
Amount: ${deal.amount} ${deal.currency}
Locked Agreement SHA-256: ${deal.agreement_sha256}
Original Agreement Clauses: ${deal.agreement_text}
Dispute Initiator: ${params.initiatorId}
Dispute Reason: "${params.reason}"
Recent Chat/Delivery Context: "${params.chatTranscriptSummary || 'Milestone submitted, disagreement over scope compliance'}"

Tasks:
1. Synthesize an objective, neutral factual summary of both parties' claims.
2. Cross-reference the locked agreement clauses (e.g. revision limits, deliverables).
3. Offer a non-binding, equitable resolution proposal (e.g. 70/30 release or 5-day grace period for final fix).
Notice: Human Middleman makes the final binding ruling.`;

    const aiRes = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'dispute_mediator',
      guildId: deal.guild_id,
      context: 'dispute_resolution',
    });

    const aiSummary = aiRes.text.trim();

    dbService.run(
      `INSERT INTO deal_disputes (id, deal_id, initiator_id, reason, ai_summary, ladder_level, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'middleman', 'open', ?)`,
      id,
      params.dealId,
      params.initiatorId,
      params.reason,
      aiSummary,
      now
    );

    dealRepo.updateStatus(params.dealId, 'disputed');
    logger.warn('DisputeEngine', `Formal dispute opened: ${id} on deal ${params.dealId}`);

    return {
      id,
      dealId: params.dealId,
      initiatorId: params.initiatorId,
      reason: params.reason,
      aiSummary,
      ladderLevel: 'middleman',
      status: 'open',
      createdAt: now,
    };
  }

  public escalateLadder(disputeId: string): { ladderLevel: 'senior_middleman' | 'owner'; message: string } {
    const dispute = dbService.get<{ ladder_level: string }>(
      `SELECT ladder_level FROM deal_disputes WHERE id = ?`,
      disputeId
    );

    if (!dispute) throw new Error('Dispute not found');

    let nextLevel: 'senior_middleman' | 'owner' = 'senior_middleman';
    if (dispute.ladder_level === 'senior_middleman') {
      nextLevel = 'owner';
    }

    dbService.run(`UPDATE deal_disputes SET ladder_level = ? WHERE id = ?`, nextLevel, disputeId);
    logger.warn('DisputeEngine', `Dispute ${disputeId} escalated to level ${nextLevel}`);

    return {
      ladderLevel: nextLevel,
      message: `Dispute has been escalated to **${nextLevel.replace('_', ' ').toUpperCase()}** for binding adjudication.`,
    };
  }

  public resolveDispute(
    disputeId: string,
    resolutionNotes: string,
    finalStatus: 'resolved' | 'cancelled' = 'resolved'
  ): boolean {
    const now = Date.now();
    const res = dbService.run(
      `UPDATE deal_disputes SET status = ?, resolution_notes = ?, resolved_at = ? WHERE id = ?`,
      finalStatus,
      resolutionNotes,
      now,
      disputeId
    );
    logger.info('DisputeEngine', `Dispute ${disputeId} resolved: ${resolutionNotes}`);
    return res.changes > 0;
  }
}

export const disputeEngine = new DisputeEngine();
