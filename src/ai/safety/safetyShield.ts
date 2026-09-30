import { createLogger } from '../../utils/logger.js';

const logger = createLogger('SafetyShield');

export class SafetyShield {
  private static readonly INJECTION_PATTERNS = [
    /ignore (all )?(previous|prior|above) instructions/i,
    /system (override|prompt|directive)/i,
    /disregard (all )?rules/i,
    /you are now in (developer|dan|god) mode/i,
    /bypass (verification|vetting|testing|rubric)/i,
    /mark me as (verified|passed|admin|senior|owner)/i,
    /output the (system prompt|hidden rubric|secret token)/i,
    /reveal the hidden (rubric|criteria|answers)/i,
  ];

  public static isSuspiciousInput(input: string): { isMalicious: boolean; reason?: string } {
    for (const pattern of SafetyShield.INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        logger.warn(`Prompt injection pattern detected: ${pattern.toString()}`);
        return {
          isMalicious: true,
          reason: 'Input contains prohibited instruction override pattern',
        };
      }
    }
    return { isMalicious: false };
  }

  public static wrapUntrustedInput(rawInput: string): string {
    // Delimit untrusted data so LLM parses it strictly as content, never instruction
    const sanitized = rawInput
      .replace(/<<</g, '')
      .replace(/>>>/g, '');

    return `<<<UNTRUSTED_MEMBER_CONTENT_START>>>\n${sanitized}\n<<<UNTRUSTED_MEMBER_CONTENT_END>>>`;
  }

  public static sanitizeAIOutput(text: string): string {
    // Prevent accidental leak of hidden tokens or system identifiers
    let clean = text;
    clean = clean.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_API_KEY]');
    clean = clean.replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, '[REDACTED_GEMINI_KEY]');
    return clean;
  }
}
