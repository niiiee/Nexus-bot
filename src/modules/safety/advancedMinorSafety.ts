import { logger } from '../../utils/logger.js';

export interface MinorSafeguardCheckResult {
  isBlocked: boolean;
  reason?: string;
  safetyAlertTriggered: boolean;
  safeguardMode: 'protected' | 'standard';
}

export class AdvancedMinorSafetySystem {
  private protectedMinorUserIds: Set<string> = new Set();

  public registerMinorUser(userId: string): void {
    this.protectedMinorUserIds.add(userId);
  }

  public isMinor(userId: string): boolean {
    return this.protectedMinorUserIds.has(userId);
  }

  /**
   * REQ-26.280: Enforce age-aware safeguards and block unmonitored adult-to-minor direct interactions
   */
  public evaluateInteraction(params: {
    senderId: string;
    recipientId: string;
    isDirectMessage: boolean;
    content: string;
  }): MinorSafeguardCheckResult {
    const { senderId, recipientId, isDirectMessage, content } = params;

    const isRecipientMinor = this.isMinor(recipientId);
    const isSenderMinor = this.isMinor(senderId);

    // Block unmonitored direct messages from adults to minors
    if (isDirectMessage && isRecipientMinor && !isSenderMinor) {
      logger.warn('Safeguard intercept: adult attempted unmonitored direct message to protected minor account', {
        senderId,
        recipientId
      });
      return {
        isBlocked: true,
        reason: 'Direct messages to minor community members are restricted to protect youth safety.',
        safetyAlertTriggered: true,
        safeguardMode: 'protected'
      };
    }

    // Flag grooming or high-risk solicitation phrases
    const lower = content.toLowerCase();
    if (
      (isRecipientMinor || isSenderMinor) &&
      (lower.includes('send me your photo') || lower.includes('keep this secret') || lower.includes('متعرفش حد'))
    ) {
      logger.error('High-risk safeguard alert: predatory solicitation pattern detected near minor account', {
        senderId,
        recipientId
      });
      return {
        isBlocked: true,
        reason: 'Message blocked by youth protection filters and referred to senior safety staff.',
        safetyAlertTriggered: true,
        safeguardMode: 'protected'
      };
    }

    return {
      isBlocked: false,
      safetyAlertTriggered: false,
      safeguardMode: isRecipientMinor ? 'protected' : 'standard'
    };
  }
}

export const advancedMinorSafetySystem = new AdvancedMinorSafetySystem();
