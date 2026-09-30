import { createHash } from 'crypto';
import { logger } from '../../utils/logger.js';

export interface DealRiskAssessment {
  riskScore: number; // 0 to 100
  riskLevel: 'low' | 'medium' | 'high';
  flags: string[];
  recommendation: string;
}

export class EscrowFraudShield {
  private knownProofHashes = new Set<string>();
  private blacklist = new Set<string>();

  public assessDealRisk(params: {
    clientAccountAgeDays: number;
    freelancerAccountAgeDays: number;
    dealAmount: number;
    agreementText: string;
  }): DealRiskAssessment {
    const flags: string[] = [];
    let riskScore = 0;

    // 1. Account age checks
    if (params.clientAccountAgeDays < 7) {
      flags.push('Client Discord account was created less than 7 days ago.');
      riskScore += 30;
    }
    if (params.freelancerAccountAgeDays < 7) {
      flags.push('Freelancer Discord account is very new (< 7 days).');
      riskScore += 25;
    }

    // 2. High value deal anomaly
    if (params.dealAmount > 5000 && params.clientAccountAgeDays < 30) {
      flags.push('Large deal value ($5,000+) on a relatively new account.');
      riskScore += 25;
    }

    // 3. Off-platform DM pressure language
    if (/dm me|talk on whatsapp|telegram me|take this off discord|outside escrow/i.test(params.agreementText)) {
      flags.push('Language encouraging off-platform communication or bypassing middleman.');
      riskScore += 45;
    }

    // 4. Extreme urgency language
    if (/urgent.*immediate.*right now.*no questions/i.test(params.agreementText)) {
      flags.push('High-pressure rush language.');
      riskScore += 15;
    }

    riskScore = Math.min(100, riskScore);

    let riskLevel: DealRiskAssessment['riskLevel'] = 'low';
    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    const recommendation =
      riskLevel === 'high'
        ? 'Require Senior Middleman assignment and strict external identity/funds verification.'
        : riskLevel === 'medium'
        ? 'Standard verification with caution flags highlighted to participants.'
        : 'Deal parameters appear standard and safe.';

    logger.info('EscrowFraudShield', `Assessed deal risk: score=${riskScore}, level=${riskLevel}`);

    return {
      riskScore,
      riskLevel,
      flags,
      recommendation,
    };
  }

  public inspectPaymentProof(imageBufferOrUrl: string): { isAuthentic: boolean; reason: string; imageHash: string } {
    const imageHash = createHash('sha256').update(imageBufferOrUrl).digest('hex');

    // Check for duplicate payment screenshot reuse across different deals
    if (this.knownProofHashes.has(imageHash)) {
      logger.warn('EscrowFraudShield', `DUPLICATE proof screenshot detected: ${imageHash}`);
      return {
        isAuthentic: false,
        reason: 'Duplicate payment proof detected! This exact receipt screenshot was previously submitted in another deal.',
        imageHash,
      };
    }

    this.knownProofHashes.add(imageHash);
    return {
      isAuthentic: true,
      reason: 'Screenshot hash unique and registered for this transaction.',
      imageHash,
    };
  }

  public isBlacklisted(userId: string): boolean {
    return this.blacklist.has(userId);
  }

  public addToBlacklist(userId: string, reason: string): void {
    this.blacklist.add(userId);
    logger.warn('EscrowFraudShield', `User ${userId} added to fraud blacklist: ${reason}`);
  }

  public detectDMPressure(messageText: string): boolean {
    return /(let('?s| us) talk in (dms?|pms?)|talk in (dms?|pms?)|dm me for payment|message me privately|whatsapp|telegram)/i.test(messageText);
  }
}

export const escrowFraudShield = new EscrowFraudShield();
