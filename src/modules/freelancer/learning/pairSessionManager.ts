import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface PairRequest {
  id: string;
  userId: string;
  guildId: string;
  topic: string;
  type: 'code_pair' | 'design_swap' | 'coworking';
  joinedAt: number;
}

export interface PairMatch {
  matchId: string;
  user1Id: string;
  user2Id: string;
  topic: string;
  type: string;
  matchedAt: number;
}

export class PairSessionManager {
  private queue: Map<string, PairRequest> = new Map();
  private activeMatches: Map<string, PairMatch> = new Map();

  public joinQueue(params: {
    userId: string;
    guildId: string;
    topic: string;
    type: 'code_pair' | 'design_swap' | 'coworking';
  }): { matched: boolean; match?: PairMatch; message: string } {
    // Check if there is an existing compatible partner in queue
    for (const [otherUserId, req] of this.queue.entries()) {
      if (otherUserId !== params.userId && req.guildId === params.guildId && req.type === params.type) {
        this.queue.delete(otherUserId);
        const matchId = `pair_${randomUUID().slice(0, 8)}`;
        const match: PairMatch = {
          matchId,
          user1Id: otherUserId,
          user2Id: params.userId,
          topic: `${req.topic} & ${params.topic}`,
          type: params.type,
          matchedAt: Date.now(),
        };

        this.activeMatches.set(matchId, match);
        logger.info('PairSessionManager', `Matched pair ${matchId}: ${otherUserId} + ${params.userId}`);

        return {
          matched: true,
          match,
          message: `🎉 Match found! You have been paired with <@${otherUserId}> for **${params.type.replace('_', ' ')}**!`,
        };
      }
    }

    // No immediate match, add to queue
    const id = `req_${randomUUID().slice(0, 8)}`;
    const newReq: PairRequest = {
      id,
      userId: params.userId,
      guildId: params.guildId,
      topic: params.topic,
      type: params.type,
      joinedAt: Date.now(),
    };
    this.queue.set(params.userId, newReq);
    logger.info('PairSessionManager', `User ${params.userId} joined pair queue for ${params.type}`);

    return {
      matched: false,
      message: `You have joined the pairing queue for **${params.type.replace('_', ' ')}** on "${params.topic}". We will alert you the moment a partner joins!`,
    };
  }

  public leaveQueue(userId: string): boolean {
    return this.queue.delete(userId);
  }
}

export const pairSessionManager = new PairSessionManager();
