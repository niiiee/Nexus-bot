import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface DirectHireRequest {
  id: string;
  clientId: string;
  freelancerId: string;
  guildId: string;
  projectTitle: string;
  budget: string;
  timeline: string;
  initialMessage: string;
  status: 'pending' | 'accepted' | 'declined' | 'negotiating';
  createdAt: number;
}

export class DirectHireService {
  private requests: Map<string, DirectHireRequest> = new Map();

  public createHireRequest(params: {
    clientId: string;
    freelancerId: string;
    guildId: string;
    projectTitle: string;
    budget: string;
    timeline: string;
    initialMessage: string;
  }): DirectHireRequest {
    const id = `hire_${randomUUID().slice(0, 8)}`;
    const hireRequest: DirectHireRequest = {
      id,
      clientId: params.clientId,
      freelancerId: params.freelancerId,
      guildId: params.guildId,
      projectTitle: params.projectTitle,
      budget: params.budget,
      timeline: params.timeline,
      initialMessage: params.initialMessage,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.requests.set(id, hireRequest);
    logger.info('DirectHire', `Direct hire request created: ${id} from ${params.clientId} to ${params.freelancerId}`);
    return hireRequest;
  }

  public respondToRequest(
    id: string,
    freelancerId: string,
    action: 'accept' | 'decline' | 'negotiate'
  ): { success: boolean; message: string; request?: DirectHireRequest } {
    const req = this.requests.get(id);
    if (!req) {
      return { success: false, message: 'Hire request not found or expired.' };
    }

    if (req.freelancerId !== freelancerId) {
      return { success: false, message: 'You are not authorized to respond to this request.' };
    }

    if (req.status !== 'pending' && req.status !== 'negotiating') {
      return { success: false, message: `Request is already ${req.status}.` };
    }

    if (action === 'accept') {
      req.status = 'accepted';
      logger.info('DirectHire', `Hire request ${id} accepted by freelancer.`);
      return {
        success: true,
        message: 'Request accepted! You can now start an escrow deal ticket with /deal create.',
        request: req,
      };
    } else if (action === 'decline') {
      req.status = 'declined';
      logger.info('DirectHire', `Hire request ${id} declined.`);
      return { success: true, message: 'Hire request declined politely.', request: req };
    } else {
      req.status = 'negotiating';
      logger.info('DirectHire', `Hire request ${id} marked for negotiation.`);
      return {
        success: true,
        message: 'Client notified that you wish to discuss terms/budget adjustments.',
        request: req,
      };
    }
  }

  public getRequest(id: string): DirectHireRequest | undefined {
    return this.requests.get(id);
  }
}

export const directHireService = new DirectHireService();
