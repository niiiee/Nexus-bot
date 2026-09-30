import { logger } from '../../../utils/logger.js';

export interface LeakScanResult {
  hasLeak: boolean;
  leakType?: 'api_key' | 'private_key' | 'db_credentials' | 'nda_marker';
  redactedPreview: string;
  warningMessageEn: string;
  warningMessageAr: string;
}

export class ConfidentialityGuardService {
  private leakRules = [
    { regex: /AKIA[0-9A-Z]{16}/, type: 'api_key' as const, name: 'AWS Access Key' },
    { regex: /sk_live_[0-9a-zA-Z]{24,}/, type: 'api_key' as const, name: 'Live Stripe Secret' },
    { regex: /ghp_[0-9a-zA-Z]{36}/, type: 'api_key' as const, name: 'GitHub Personal Access Token' },
    { regex: /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/, type: 'private_key' as const, name: 'Cryptographic Private Key' },
    { regex: /(postgres|mysql|mongodb(\+srv)?):\/\/[^\s:]+:[^\s@]+@[^\s/]+/, type: 'db_credentials' as const, name: 'Database Connection String with Password' },
    { regex: /(confidential.*do not disclose|strictly confidential client proprietary)/i, type: 'nda_marker' as const, name: 'NDA Confidentiality Banner' },
  ];

  public scanContent(text: string): LeakScanResult {
    for (const rule of this.leakRules) {
      if (rule.regex.test(text)) {
        logger.warn('ConfidentialityGuard', `Confidential leak intercepted: ${rule.name}`);
        const redactedPreview = text.replace(rule.regex, '[REDACTED_SECRET]');
        return {
          hasLeak: true,
          leakType: rule.type,
          redactedPreview,
          warningMessageEn: `⚠️ **CONFIDENTIALITY ALERT:** Your message appears to contain sensitive credentials (${rule.name}). For your client's and your own security, do not share private tokens in public channels!`,
          warningMessageAr: `⚠️ **تنبيه أمني سري:** رسالتك تحتوي على بيانات حساسة أو مفاتيح سرية (${rule.name}). لحماية عقودك وعملائك، تجنب نشر المفاتيح والرموز السرية في القنوات العامة!`,
        };
      }
    }

    return {
      hasLeak: false,
      redactedPreview: text,
      warningMessageEn: '',
      warningMessageAr: '',
    };
  }
}

export const confidentialityGuardService = new ConfidentialityGuardService();
