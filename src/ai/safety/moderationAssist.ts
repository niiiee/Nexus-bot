import { SafetyShield } from './safetyShield.js';
import { auditRepo } from '../../database/repositories/auditRepo.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ModerationAssist');

export interface ModerationVerdict {
  isViolating: boolean;
  actionRequired: 'none' | 'warn' | 'delete' | 'escalate_staff';
  violationType?: 'spam' | 'phishing' | 'credential_leak' | 'prompt_injection';
  reason?: string;
}

export class ModerationAssist {
  private userMessageHistory: Map<string, number[]> = new Map(); // userId -> message timestamps

  private static readonly PHISHING_DOMAINS = [
    'discrod-nitro.gift',
    'steam-community-free.ru',
    'airdrop-claim-now.xyz',
    'discord-verify-claim.top',
  ];

  public checkMessage(userId: string, guildId: string, content: string): ModerationVerdict {
    const now = Date.now();

    // 1. Token & Credential Leak Detection (Section 7.5)
    if (
      content.match(/[a-zA-Z0-9_-]{24,}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,}/) || // Discord token
      content.match(/AIzaSy[a-zA-Z0-9_-]{25,35}/) ||                                 // Google API key
      content.match(/sk-[a-zA-Z0-9]{32,}/)                                           // OpenAI API key
    ) {
      logger.warn(`Credential leak detected in message by user ${userId}`);
      auditRepo.log({
        guild_id: guildId,
        action_type: 'credential_leak_intercepted',
        actor_id: userId,
        target_id: userId,
        details: { preview: content.slice(0, 30) },
        reasoning: 'Interception of potential API key or bot token leak.',
        reversible: false,
      });

      return {
        isViolating: true,
        actionRequired: 'delete',
        violationType: 'credential_leak',
        reason: 'Sensitive API token or credential detected. Message removed for security.',
      };
    }

    // 2. Phishing URL Inspection
    for (const domain of ModerationAssist.PHISHING_DOMAINS) {
      if (content.toLowerCase().includes(domain)) {
        logger.warn(`Phishing domain "${domain}" detected in message by user ${userId}`);
        return {
          isViolating: true,
          actionRequired: 'escalate_staff',
          violationType: 'phishing',
          reason: `Phishing domain identified: ${domain}`,
        };
      }
    }

    // 3. Prompt Injection Defense
    const injectionCheck = SafetyShield.isSuspiciousInput(content);
    if (injectionCheck.isMalicious) {
      return {
        isViolating: true,
        actionRequired: 'warn',
        violationType: 'prompt_injection',
        reason: 'Instruction override pattern detected.',
      };
    }

    // 4. Spam & Raid Burst Velocity
    if (!this.userMessageHistory.has(userId)) {
      this.userMessageHistory.set(userId, []);
    }
    const timestamps = this.userMessageHistory.get(userId)!;
    timestamps.push(now);

    // Keep only timestamps within last 10 seconds
    const recent = timestamps.filter(t => now - t < 10000);
    this.userMessageHistory.set(userId, recent);

    if (recent.length > 7) {
      // More than 7 messages in 10 seconds = spam/raid burst
      return {
        isViolating: true,
        actionRequired: 'escalate_staff',
        violationType: 'spam',
        reason: `Rate limit burst: ${recent.length} messages sent in 10 seconds.`,
      };
    }

    return { isViolating: false, actionRequired: 'none' };
  }
}

export const moderationAssist = new ModerationAssist();
