import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface GuildPod {
  id: string;
  tenantId: string;
  name: string;
  topic: string;
  leaderId: string;
  memberIds: string[];
  sprintEndsAt: number;
  status: 'active' | 'completed' | 'archived';
}

export interface CommunityBounty {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  bountyAmountUsd: number;
  creatorId: string;
  assigneeId: string | null;
  status: 'open' | 'in_progress' | 'submitted' | 'approved' | 'paid';
  votesCount: number;
  quadraticVotesSum: number;
  createdAt: number;
}

export class BountyAndPodsService {
  private pods = new Map<string, GuildPod>();
  private bounties = new Map<string, CommunityBounty>();

  /**
   * REQ-23.9.1: Spin up dedicated micro-community pod for a focused sprint
   */
  public createPod(
    tenantId: string,
    name: string,
    topic: string,
    leaderId: string,
    durationDays = 14
  ): GuildPod {
    const id = cryptoRandomUUID();
    const sprintEndsAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;

    const pod: GuildPod = {
      id,
      tenantId,
      name,
      topic,
      leaderId,
      memberIds: [leaderId],
      sprintEndsAt,
      status: 'active'
    };

    this.pods.set(id, pod);
    return pod;
  }

  public joinPod(podId: string, userId: string): boolean {
    const pod = this.pods.get(podId);
    if (!pod || pod.status !== 'active') return false;
    if (!pod.memberIds.includes(userId)) {
      pod.memberIds.push(userId);
    }
    return true;
  }

  public evaluatePodSprint(podId: string): { isExpired: boolean; status: string } {
    const pod = this.pods.get(podId);
    if (!pod) throw new Error('Pod not found');

    if (Date.now() > pod.sprintEndsAt && pod.status === 'active') {
      pod.status = 'completed';
      return { isExpired: true, status: 'completed' };
    }
    return { isExpired: false, status: pod.status };
  }

  /**
   * REQ-23.12.1: Submit a community bounty proposal
   */
  public createBounty(
    tenantId: string,
    creatorId: string,
    title: string,
    description: string,
    bountyAmountUsd: number
  ): CommunityBounty {
    const id = cryptoRandomUUID();
    const bounty: CommunityBounty = {
      id,
      tenantId,
      title,
      description,
      bountyAmountUsd,
      creatorId,
      assigneeId: null,
      status: 'open',
      votesCount: 0,
      quadraticVotesSum: 0,
      createdAt: Date.now()
    };

    this.bounties.set(id, bounty);
    return bounty;
  }

  /**
   * REQ-23.12.2: Cast vote using quadratic voting formula: effectiveVotes = sqrt(reputationTokensSpent)
   */
  public castQuadraticVote(
    bountyId: string,
    voterId: string,
    tokensSpent: number
  ): { effectiveVotes: number; newQuadraticTotal: number } {
    const bounty = this.bounties.get(bountyId);
    if (!bounty) throw new Error('Bounty not found');

    const effectiveVotes = Number(Math.sqrt(Math.max(1, tokensSpent)).toFixed(2));
    bounty.votesCount += 1;
    bounty.quadraticVotesSum = Number((bounty.quadraticVotesSum + effectiveVotes).toFixed(2));

    return {
      effectiveVotes,
      newQuadraticTotal: bounty.quadraticVotesSum
    };
  }

  /**
   * REQ-23.12.3: Claim bounty, submit work, and authorize payout
   */
  public claimBounty(bountyId: string, claimantId: string): boolean {
    const bounty = this.bounties.get(bountyId);
    if (!bounty || bounty.status !== 'open') return false;

    bounty.assigneeId = claimantId;
    bounty.status = 'in_progress';
    return true;
  }

  public submitBountyDeliverable(bountyId: string): boolean {
    const bounty = this.bounties.get(bountyId);
    if (!bounty || bounty.status !== 'in_progress') return false;

    bounty.status = 'submitted';
    return true;
  }

  public approveAndReleaseBounty(bountyId: string, approverId: string): { released: boolean; payoutAmountUsd: number } {
    const bounty = this.bounties.get(bountyId);
    if (!bounty || bounty.status !== 'submitted') {
      return { released: false, payoutAmountUsd: 0 };
    }

    bounty.status = 'paid';
    return {
      released: true,
      payoutAmountUsd: bounty.bountyAmountUsd
    };
  }
}

export const bountyAndPods = new BountyAndPodsService();
