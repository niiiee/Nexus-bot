import { logger } from '../../utils/logger.js';

export interface RedactionResult {
  cleanText: string;
  hasRedactions: boolean;
  redactedTypes: string[];
  warningNotice?: string;
}

export class LeadRedactor {
  // Regex patterns
  private ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  private egyptianNationalIdRegex = /\b[23]\d{13}\b/g;
  private passwordRegex = /(?:password|passwd|pwd|pass|secret|كلمة\s*المرور|الباسورد)\s*[:=]\s*([^\s,;]+)/gi;
  private creditCardRegex = /\b(?:\d[ -]*){13,19}\b/g;

  /**
   * Scans text and redacts payment cards, government IDs, and passwords immediately.
   */
  public redactSensitiveInfo(text: string, language: 'en' | 'ar' = 'en'): RedactionResult {
    let cleanText = text;
    const redactedTypes: string[] = [];

    // 1. Redact Passwords & Secrets
    if (this.passwordRegex.test(cleanText)) {
      this.passwordRegex.lastIndex = 0;
      cleanText = cleanText.replace(this.passwordRegex, (match, p1) => {
        return match.replace(p1, '[CREDENTIAL_REDACTED]');
      });
      redactedTypes.push('password');
    }

    // 2. Redact Government IDs
    if (this.ssnRegex.test(cleanText)) {
      cleanText = cleanText.replace(this.ssnRegex, '[GOVERNMENT_ID_REDACTED]');
      redactedTypes.push('government_id');
    }

    if (this.egyptianNationalIdRegex.test(cleanText)) {
      cleanText = cleanText.replace(this.egyptianNationalIdRegex, '[NATIONAL_ID_REDACTED]');
      redactedTypes.push('national_id');
    }

    // 3. Redact Payment Cards (with Luhn algorithm check)
    const cardMatches = cleanText.match(this.creditCardRegex);
    if (cardMatches) {
      for (const rawMatch of cardMatches) {
        const digits = rawMatch.replace(/\D/g, '');
        if (digits.length >= 13 && digits.length <= 19 && this.luhnCheck(digits)) {
          cleanText = cleanText.replace(rawMatch, '[PAYMENT_CARD_REDACTED]');
          if (!redactedTypes.includes('payment_card')) {
            redactedTypes.push('payment_card');
          }
        }
      }
    }

    const hasRedactions = redactedTypes.length > 0;
    let warningNotice: string | undefined;

    if (hasRedactions) {
      logger.warn(`[LeadRedactor] Sensitive information detected and redacted: ${redactedTypes.join(', ')}`);
      warningNotice = language === 'ar'
        ? '⚠️ تنبيه أمني: لاحظنا مشاركة بيانات حساسة (مثل أرقام بطاقات أو كلمات مرور). تم حجبها فوراً ولن يتم حفظها لحماية خصوصيتك.'
        : '⚠️ Security Notice: We detected sensitive information (such as payment card numbers, passwords, or government IDs). These have been redacted immediately and will never be stored.';
    }

    return {
      cleanText,
      hasRedactions,
      redactedTypes,
      warningNotice,
    };
  }

  /**
   * Luhn algorithm for valid credit card number detection
   */
  private luhnCheck(numStr: string): boolean {
    let sum = 0;
    let shouldDouble = false;
    for (let i = numStr.length - 1; i >= 0; i--) {
      let digit = parseInt(numStr.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }
}

export const leadRedactor = new LeadRedactor();
