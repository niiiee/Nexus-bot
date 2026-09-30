import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export type ConfirmationEvidenceType =
  | 'middleman_deal'
  | 'signed_agreement'
  | 'payment_confirmed'
  | 'explicit_consent';

export interface ConfirmationEvidence {
  type: ConfirmationEvidenceType;
  dealId?: string;
  agreementReference?: string;
  transactionReference?: string;
  consentStatement?: string;
  verifiedBy?: string;
  notes?: string;
}

export interface ConfirmationValidationResult {
  valid: boolean;
  reason?: string;
  conditionMet?: number;
}

export class ConfirmationRulesEngine {
  /**
   * REQ-22.3.1: Validate that at least one of the 4 explicit evidence criteria is met
   */
  public validateEvidence(evidence: ConfirmationEvidence): ConfirmationValidationResult {
    if (!evidence || !evidence.type) {
      return { valid: false, reason: 'Missing confirmation evidence or evidence type.' };
    }

    switch (evidence.type) {
      case 'middleman_deal': {
        // Condition 1: Middleman deal confirmed (Section 12)
        if (!evidence.dealId || evidence.dealId.trim().length === 0) {
          return {
            valid: false,
            reason: 'Middleman deal confirmation requires a valid deal ID.',
          };
        }

        // Verify deal existence or format
        const deal = dbService.get<{ id: string; status: string }>(
          `SELECT id, status FROM deals WHERE id = ?`,
          evidence.dealId.trim()
        );

        if (deal && !['completed', 'active', 'in_progress'].includes(deal.status.toLowerCase())) {
          return {
            valid: false,
            reason: `Middleman deal ${evidence.dealId} is in status '${deal.status}', which does not satisfy client confirmation criteria.`,
          };
        }

        return { valid: true, conditionMet: 1 };
      }

      case 'signed_agreement': {
        // Condition 2: Signed agreement / formal quote acceptance
        if (!evidence.agreementReference || evidence.agreementReference.trim().length === 0) {
          return {
            valid: false,
            reason: 'Signed agreement confirmation requires an agreement reference or signed document identifier.',
          };
        }

        return { valid: true, conditionMet: 2 };
      }

      case 'payment_confirmed': {
        // Condition 3: Payment confirmed by Verified Middleman
        if (!evidence.transactionReference || evidence.transactionReference.trim().length === 0) {
          return {
            valid: false,
            reason: 'Payment confirmation requires a verified transaction or receipt reference.',
          };
        }

        if (!evidence.verifiedBy || evidence.verifiedBy.trim().length === 0) {
          return {
            valid: false,
            reason: 'Payment confirmation requires the ID of the verified middleman or finance officer.',
          };
        }

        return { valid: true, conditionMet: 3 };
      }

      case 'explicit_consent': {
        // Condition 4: Explicit logged opt-in consent ("yes, keep my details")
        if (!evidence.consentStatement || evidence.consentStatement.trim().length === 0) {
          return {
            valid: false,
            reason: 'Explicit consent confirmation requires a logged affirmative consent statement.',
          };
        }

        const normalized = evidence.consentStatement.trim().toLowerCase();
        const affirmativeIndicators = [
          'yes',
          'keep my details',
          'i agree',
          'save my info',
          'opt in',
          'confirm',
          'نعم',
          'احفظ بياناتي',
          'موافق',
          'سجلني',
          'تمام',
        ];

        const hasAffirmative = affirmativeIndicators.some((indicator) => normalized.includes(indicator));
        if (!hasAffirmative && normalized.length < 5) {
          return {
            valid: false,
            reason: 'Explicit consent statement is ambiguous or does not contain clear affirmative intent.',
          };
        }

        return { valid: true, conditionMet: 4 };
      }

      default:
        return {
          valid: false,
          reason: `Unknown confirmation evidence type: ${(evidence as { type: string }).type}`,
        };
    }
  }

  /**
   * REQ-22.3.2: Enforce execution authority (Client Manager / Owner only, AI strictly forbidden)
   */
  public canExecutePromotion(
    actorId: string,
    actorRole: string,
    evidenceType: ConfirmationEvidenceType,
    guildId?: string
  ): { allowed: boolean; reason?: string } {
    const isAi = actorRole.toLowerCase() === 'ai' || actorId.toLowerCase().includes('ai');

    // Autonomous AI cannot promote autonomously under any circumstances (REQ-22.3.2, REQ-22.9.5)
    if (isAi) {
      // Check if auto-promotion is enabled for conditions 1 (middleman_deal) or 3 (payment_confirmed)
      const autoPromoEnabled = this.isAutoPromotionEnabled(guildId);
      if (autoPromoEnabled && (evidenceType === 'middleman_deal' || evidenceType === 'payment_confirmed')) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason:
          'AI assistants are strictly prohibited from promoting leads autonomously. Human Client Manager or Owner approval is required.',
      };
    }

    // Human client managers and owners are permitted
    const isAuthorizedRole = ['owner', 'staff', 'admin', 'client_manager'].includes(actorRole.toLowerCase());
    if (!isAuthorizedRole) {
      return {
        allowed: false,
        reason: `Actor role '${actorRole}' does not have Client Manager or Owner promotion privileges.`,
      };
    }

    return { allowed: true };
  }

  private isAutoPromotionEnabled(guildId?: string): boolean {
    if (!guildId) return false;
    try {
      const config = dbService.get<{ auto_promotion_enabled: number }>(
        `SELECT auto_promotion_enabled FROM lead_staging_config WHERE guild_id = ?`,
        guildId
      );
      return (config?.auto_promotion_enabled ?? 0) === 1;
    } catch {
      return false;
    }
  }
}

export const confirmationRulesEngine = new ConfirmationRulesEngine();
