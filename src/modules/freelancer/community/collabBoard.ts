import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface CollabRequest {
  id: string;
  guildId: string;
  authorId: string;
  title: string;
  category: 'code_help' | 'design_feedback' | 'testing' | 'general';
  description: string;
  status: 'open' | 'claimed' | 'completed';
  claimedById?: string;
  createdAt: number;
}

export class CollabBoardService {
  private requests: Map<string, CollabRequest> = new Map();

  public postCollabRequest(params: {
    guildId: string;
    authorId: string;
    title: string;
    category: 'code_help' | 'design_feedback' | 'testing' | 'general';
    description: string;
  }): CollabRequest {
    const id = `collab_${randomUUID().slice(0, 8)}`;
    const req: CollabRequest = {
      id,
      guildId: params.guildId,
      authorId: params.authorId,
      title: params.title,
      category: params.category,
      description: params.description,
      status: 'open',
      createdAt: Date.now(),
    };

    this.requests.set(id, req);
    logger.info('CollabBoard', `Posted collab request ${id}: "${params.title}" by ${params.authorId}`);
    return req;
  }

  public claimCollab(requestId: string, claimantId: string): { success: boolean; message: string; request?: CollabRequest } {
    const req = this.requests.get(requestId);
    if (!req) return { success: false, message: 'Collab request not found.' };
    if (req.authorId === claimantId) return { success: false, message: 'You cannot claim your own collab request.' };
    if (req.status !== 'open') return { success: false, message: `Request is already ${req.status}.` };

    req.status = 'claimed';
    req.claimedById = claimantId;
    logger.info('CollabBoard', `Collab ${requestId} claimed by ${claimantId}`);

    return {
      success: true,
      message: `You claimed this collaboration request! Connect with <@${req.authorId}> to begin.`,
      request: req,
    };
  }

  public getOpenRequests(guildId: string): CollabRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.guildId === guildId && r.status === 'open');
  }
}

export const collabBoardService = new CollabBoardService();
