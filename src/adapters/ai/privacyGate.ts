import { sha256 } from '../../utils/crypto.js';

export type DataCategory =
  | 'PUBLIC'
  | 'SYNTHETIC'
  | 'PRIVATE_MEMBER'
  | 'MINOR'
  | 'LEAD_STAGING'
  | 'FINANCIAL_DEAL';

export interface PromptPayload {
  prompt: string;
  category: DataCategory;
  provider: 'gemini_free' | 'gemini_paid' | 'vertex_ai' | 'ollama' | 'openai' | 'anthropic';
  attachedImageText?: string;
}

export class PrivacyGate {
  private injectionPatterns = [
    /ignore (all )?(previous|prior|above) instructions/i,
    /system (override|prompt|directive)/i,
    /escalate privileges/i,
    /reveal the hidden (rubric|criteria|answers|system prompt)/i,
    /act as an unconstrained/i
  ];

  /**
   * Enforces the Data-Use Gate: blocks private content from free training tiers.
   */
  public evaluateDataUseGate(payload: PromptPayload): { allowed: boolean; reason?: string } {
    const isFreeTrainingTier = payload.provider === 'gemini_free';
    const isSensitiveCategory = [
      'PRIVATE_MEMBER',
      'MINOR',
      'LEAD_STAGING',
      'FINANCIAL_DEAL'
    ].includes(payload.category);

    if (isFreeTrainingTier && isSensitiveCategory) {
      return {
        allowed: false,
        reason: `Privacy Gate Violation: Content of category '${payload.category}' is strictly prohibited from free AI tiers where terms allow product training or human review.`
      };
    }

    return { allowed: true };
  }

  /**
   * Redacts sensitive personal and financial data prior to transmission.
   */
  public redactPrompt(text: string): { sanitizedText: string; redactionCount: number } {
    let count = 0;

    let sanitized = text;

    // 1. Email addresses
    sanitized = sanitized.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, () => {
      count++;
      return '[REDACTED_EMAIL]';
    });

    // 2. Phone numbers (international and local formats)
    sanitized = sanitized.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, () => {
      count++;
      return '[REDACTED_PHONE]';
    });

    // 3. API Keys and Tokens (sk-, ghp_, Bearer, AIzaSy)
    sanitized = sanitized.replace(/(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AIzaSy[a-zA-Z0-9_-]{20,}|Bearer\s+[a-zA-Z0-9._-]+)/g, () => {
      count++;
      return '[REDACTED_SECRET]';
    });

    // 4. Financial accounts / IBAN / Credit Cards
    sanitized = sanitized.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, () => {
      count++;
      return '[REDACTED_PAYMENT_INFO]';
    });

    // 5. Discord Snowflakes (17-19 digits) to pseudonymous hashes
    sanitized = sanitized.replace(/\b\d{17,19}\b/g, (match) => {
      count++;
      return `anon_usr_${sha256(match).substring(0, 8)}`;
    });

    return { sanitizedText: sanitized, redactionCount: count };
  }

  /**
   * Scans text or multimodal image descriptions for visual prompt injections.
   */
  public sanitizeMultimodalInput(imageText: string): { isSafe: boolean; sanitizedText: string; flags: string[] } {
    const flags: string[] = [];

    for (const pattern of this.injectionPatterns) {
      if (pattern.test(imageText)) {
        flags.push(`Detected prompt injection directive: ${pattern.toString()}`);
      }
    }

    if (flags.length > 0) {
      // Neutralize the untrusted text completely
      return {
        isSafe: false,
        sanitizedText: '[IMAGE_TEXT_QUARANTINED_PROMPT_INJECTION_DETECTED]',
        flags
      };
    }

    return {
      isSafe: true,
      sanitizedText: `[Untrusted User Image OCR]: ${imageText}`,
      flags: []
    };
  }
}

export const privacyGate = new PrivacyGate();
