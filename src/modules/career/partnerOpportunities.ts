import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface PartnerOpportunity {
  id: string;
  guildId: string;
  partnerName: string;
  isVerifiedPartner: boolean;
  title: string;
  budgetRange: string;
  requiredSeniority: 'Mid' | 'Senior' | 'Lead';
  minReputation: number;
  requiresNda: boolean;
  techStack: string[];
  description: string;
  createdAt: number;
  applicants: string[];
}

export class PartnerOpportunitiesService {
  private opportunities = new Map<string, PartnerOpportunity>();

  /**
   * Posts a verified corporate partner contract or sponsored project.
   */
  public postOpportunity(params: {
    guildId: string;
    partnerName: string;
    isVerifiedPartner: boolean;
    title: string;
    budgetRange: string;
    requiredSeniority: 'Mid' | 'Senior' | 'Lead';
    minReputation: number;
    requiresNda: boolean;
    techStack: string[];
    description: string;
  }): PartnerOpportunity {
    const id = cryptoRandomUUID();
    const createdAt = Date.now();

    const opp: PartnerOpportunity = {
      id,
      guildId: params.guildId,
      partnerName: params.partnerName,
      isVerifiedPartner: params.isVerifiedPartner,
      title: params.title,
      budgetRange: params.budgetRange,
      requiredSeniority: params.requiredSeniority,
      minReputation: params.minReputation,
      requiresNda: params.requiresNda,
      techStack: params.techStack,
      description: params.description,
      createdAt,
      applicants: [],
    };

    this.opportunities.set(id, opp);
    logger.info(`[PartnerOpportunities] New partner contract posted by ${params.partnerName}: "${params.title}" (${params.budgetRange})`);
    return opp;
  }

  /**
   * Applies for a partner opportunity with qualification checks.
   */
  public applyForOpportunity(
    oppId: string,
    userId: string,
    guildId: string,
    ndaAccepted: boolean
  ): { success: boolean; error?: string } {
    const opp = this.opportunities.get(oppId);
    if (!opp) return { success: false, error: 'Opportunity not found' };

    if (opp.requiresNda && !ndaAccepted) {
      return { success: false, error: 'You must accept the confidentiality NDA to apply' };
    }

    if (opp.applicants.includes(userId)) {
      return { success: false, error: 'You have already applied for this opportunity' };
    }

    // Check member reputation
    const member = dbService.get<{ reputation_score: number }>(
      `SELECT reputation_score FROM members WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );

    const rep = member?.reputation_score || 0;
    if (rep < opp.minReputation) {
      return {
        success: false,
        error: `Insufficient reputation. Requires ${opp.minReputation} points (you have ${rep})`,
      };
    }

    opp.applicants.push(userId);
    logger.info(`[PartnerOpportunities] User ${userId} applied for partner opportunity ${oppId}`);
    return { success: true };
  }

  /**
   * Lists available opportunities for a guild.
   */
  public listOpportunities(guildId: string): PartnerOpportunity[] {
    return Array.from(this.opportunities.values()).filter(o => o.guildId === guildId);
  }
}

export const partnerOpportunitiesService = new PartnerOpportunitiesService();
