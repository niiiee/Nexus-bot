import { logger } from '../../../utils/logger.js';

export interface ScamDetectionResult {
  isThreat: boolean;
  threatType?: 'phishing' | 'fake_nitro' | 'advance_fee_scam' | 'unsolicited_offplatform';
  matchedRule: string;
  recommendedAction: 'none' | 'warn' | 'delete_and_timeout';
}

export class AntiScamShieldService {
  private scamSignatures = [
    { regex: /(free.*nitro|discord.*gift.*nitro|claim.*steam.*nitro|gift.*discord\.gg\/)/i, type: 'fake_nitro' as const, action: 'delete_and_timeout' as const },
    { regex: /(pay.*registration.*fee|advance.*processing.*fee|deposit.*before.*work|send.*crypto.*to.*verify)/i, type: 'advance_fee_scam' as const, action: 'delete_and_timeout' as const },
    { regex: /(grabify\.link|iplogger|blasze\.com|bit\.ly\/.*suspicious)/i, type: 'phishing' as const, action: 'delete_and_timeout' as const },
    { regex: /(dm me on whatsapp for easy cash|earn \$500 per hour typing words)/i, type: 'unsolicited_offplatform' as const, action: 'warn' as const },
  ];

  public inspectMessage(content: string): ScamDetectionResult {
    for (const sig of this.scamSignatures) {
      if (sig.regex.test(content)) {
        logger.warn('AntiScamShield', `Scam threat detected (${sig.type}): pattern matched "${sig.regex}"`);
        return {
          isThreat: true,
          threatType: sig.type,
          matchedRule: sig.regex.toString(),
          recommendedAction: sig.action,
        };
      }
    }

    return {
      isThreat: false,
      matchedRule: '',
      recommendedAction: 'none',
    };
  }
}

export const antiScamShieldService = new AntiScamShieldService();
