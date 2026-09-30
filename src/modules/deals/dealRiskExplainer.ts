export interface RiskFactor {
  factorCode: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  remediationAdvice: string;
}

export interface DealRiskAnalysis {
  dealId: string;
  overallRiskLevel: 'LOW' | 'MODERATE' | 'ELEVATED';
  riskScore: number; // 0-100
  factors: RiskFactor[];
  requiresHumanMiddleman: boolean;
  canProceedWithoutBlock: boolean;
}

export class DealRiskExplainer {
  /**
   * REQ-26.228: Transparent factor breakdown for deal risk scores; never blocks without human review
   */
  public analyzeDealRisk(params: {
    dealId: string;
    amount: number;
    timelineDays: number;
    isClientNew: boolean;
    hasOffPlatformMention: boolean;
  }): DealRiskAnalysis {
    const { dealId, amount, timelineDays, isClientNew, hasOffPlatformMention } = params;
    const factors: RiskFactor[] = [];
    let riskScore = 15; // Baseline healthy risk

    if (isClientNew) {
      riskScore += 20;
      factors.push({
        factorCode: 'NEW_CLIENT_ACCOUNT',
        severity: 'MEDIUM',
        description: 'Client account is newly registered with 0 prior completed deals in Nexus.',
        remediationAdvice: 'Ensure Milestone 1 funds are verified in escrow before commencing work.'
      });
    }

    if (amount > 2000 && timelineDays < 3) {
      riskScore += 35;
      factors.push({
        factorCode: 'AGGRESSIVE_TIMELINE_HIGH_VALUE',
        severity: 'HIGH',
        description: `High contract value ($${amount}) paired with short turnaround (${timelineDays} days).`,
        remediationAdvice: 'Break delivery into 2 smaller milestones to reduce delivery dispute risk.'
      });
    }

    if (hasOffPlatformMention) {
      riskScore += 25;
      factors.push({
        factorCode: 'OFF_PLATFORM_COMMUNICATION_RISK',
        severity: 'MEDIUM',
        description: 'Conversation referenced moving discussion or payment to external unmonitored apps.',
        remediationAdvice: 'Keep contract terms in Nexus deal room to maintain dispute protection.'
      });
    }

    const overallRiskLevel = riskScore > 60 ? 'ELEVATED' : riskScore > 35 ? 'MODERATE' : 'LOW';

    return {
      dealId,
      overallRiskLevel,
      riskScore: Math.min(100, riskScore),
      factors,
      requiresHumanMiddleman: overallRiskLevel === 'ELEVATED',
      // Inviolable guarantee: Automated system NEVER blocks deals outright
      canProceedWithoutBlock: true
    };
  }
}

export const dealRiskExplainer = new DealRiskExplainer();
