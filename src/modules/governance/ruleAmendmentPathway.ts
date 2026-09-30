import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface AmendmentProposal {
  id: string;
  proposerId: string;
  targetRuleId: string;
  proposedText: string;
  rationale: string;
  votesFor: number;
  votesAgainst: number;
  status: 'active' | 'adopted' | 'rejected';
  expiresAt: number;
  createdAt: number;
}

export class RuleAmendmentPathway {
  /**
   * REQ-26.277: Submit community rule amendment proposal with supermajority voting
   */
  public submitProposal(params: {
    proposerId: string;
    targetRuleId: string;
    proposedText: string;
    rationale: string;
    votingDays?: number;
  }): AmendmentProposal {
    const id = `prop_${cryptoRandomUUID().substring(0, 8)}`;
    const now = Date.now();
    const expiresAt = now + (params.votingDays || 7) * 24 * 3600 * 1000;

    dbService.run(
      `INSERT INTO rule_amendment_proposals (
         id, proposer_id, target_rule_id, proposed_text, rationale,
         votes_for, votes_against, status, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)`,
      id,
      params.proposerId,
      params.targetRuleId,
      params.proposedText,
      params.rationale,
      expiresAt,
      now
    );

    return {
      id,
      proposerId: params.proposerId,
      targetRuleId: params.targetRuleId,
      proposedText: params.proposedText,
      rationale: params.rationale,
      votesFor: 0,
      votesAgainst: 0,
      status: 'active',
      expiresAt,
      createdAt: now
    };
  }

  public castVote(proposalId: string, voterId: string, support: boolean): boolean {
    const column = support ? 'votes_for' : 'votes_against';
    dbService.run(
      `UPDATE rule_amendment_proposals SET ${column} = ${column} + 1 WHERE id = ? AND status = 'active'`,
      proposalId
    );
    return true;
  }

  public tallyProposal(proposalId: string): { status: 'adopted' | 'rejected' | 'active'; supermajorityAchieved: boolean } {
    const prop = dbService.get<{
      votes_for: number;
      votes_against: number;
      expires_at: number;
    }>(`SELECT votes_for, votes_against, expires_at FROM rule_amendment_proposals WHERE id = ?`, proposalId);

    if (!prop) return { status: 'rejected', supermajorityAchieved: false };

    const totalVotes = prop.votes_for + prop.votes_against;
    const ratio = totalVotes > 0 ? prop.votes_for / totalVotes : 0;
    const supermajorityAchieved = ratio >= 0.667 && totalVotes >= 10;

    let newStatus: 'adopted' | 'rejected' | 'active' = 'active';
    if (Date.now() >= prop.expires_at || supermajorityAchieved) {
      newStatus = supermajorityAchieved ? 'adopted' : 'rejected';
      dbService.run(`UPDATE rule_amendment_proposals SET status = ? WHERE id = ?`, newStatus, proposalId);
    }

    return { status: newStatus, supermajorityAchieved };
  }
}

export const ruleAmendmentPathway = new RuleAmendmentPathway();
