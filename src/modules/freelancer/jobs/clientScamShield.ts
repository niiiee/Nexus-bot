import { logger } from '../../../utils/logger.js';

export interface ScamScanResult {
  isFlagged: boolean;
  riskScore: number; // 0 to 100
  reasons: string[];
  recommendation: 'safe' | 'caution' | 'block_and_escalate';
}

export class ClientScamShield {
  private scamPatterns = [
    { pattern: /(telegram|whatsapp|direct dm|contact me on|reach me at @)/i, reason: 'Coercing communication off-platform before agreement' },
    { pattern: /(western union|moneygram|gift card|crypto transfer first|pay fee to get job|registration fee)/i, reason: 'Payment advance scam / unverified off-platform payment method' },
    { pattern: /(free test project|build the full app for free|unpaid trial feature|sample work without pay)/i, reason: 'Demanding extensive unpaid work/spec work disguised as a test' },
    { pattern: /(send cash|bank wire to receive funds|overpayment refund)/i, reason: 'Overpayment / check fraud pattern' },
    { pattern: /(guaranteed 1000% return|double your money|investment opportunity)/i, reason: 'High-yield investment / crypto Ponzi scheme terminology' },
  ];

  public scanJobPosting(title: string, description: string, budgetRange: string): ScamScanResult {
    const combined = `${title} ${description} ${budgetRange}`.toLowerCase();
    const reasons: string[] = [];
    let riskScore = 0;

    for (const rule of this.scamPatterns) {
      if (rule.pattern.test(combined)) {
        reasons.push(rule.reason);
        riskScore += 35;
      }
    }

    // Check for unrealistic budget anomalies
    const numbers = combined.match(/\$?\b\d+([,.]\d+)?\b/g);
    if (numbers && numbers.some((n) => parseFloat(n.replace(/[$,]/g, '')) > 200000) && combined.includes('simple')) {
      reasons.push('Extremely unrealistic budget for supposedly simple task (classic bait scam)');
      riskScore += 40;
    }

    // Check for urgent pressure tactics
    if (/urgent.*immediate.*right now.*no questions/i.test(combined)) {
      reasons.push('High-pressure urgency tactic to bypass due diligence');
      riskScore += 20;
    }

    riskScore = Math.min(100, riskScore);

    let recommendation: 'safe' | 'caution' | 'block_and_escalate' = 'safe';
    if (riskScore >= 60) {
      recommendation = 'block_and_escalate';
    } else if (riskScore >= 25) {
      recommendation = 'caution';
    }

    if (riskScore > 0) {
      logger.warn('ClientScamShield', `Scam shield flagged posting: score=${riskScore}, reasons=${reasons.join('; ')}`);
    }

    return {
      isFlagged: riskScore >= 25,
      riskScore,
      reasons,
      recommendation,
    };
  }

  public generateWarningBanner(result: ScamScanResult, lang: 'en' | 'ar' = 'en'): string {
    const isAr = lang === 'ar';
    if (result.recommendation === 'block_and_escalate') {
      return isAr
        ? `🚨 **تحذير أمني شديد:** تم حظر هذا الإعلان وإحالته للإدارة لاشتباه احتيال عالي (${result.riskScore}%).\nالأسباب:\n• ${result.reasons.join('\n• ')}`
        : `🚨 **HIGH RISK FRAUD ALERT:** This posting has been blocked and escalated to staff due to high scam probability (${result.riskScore}%).\nReasons:\n• ${result.reasons.join('\n• ')}`;
    }

    if (result.recommendation === 'caution') {
      return isAr
        ? `⚠️ **تنبيه حذر للمستقلين:** الإعلان يحتوي على إشارات تتطلب الحذر (${result.riskScore}%):\n• ${result.reasons.join('\n• ')}\nنوصي باستخدام نظام الضامن (Middleman) حصراً وعدم تحويل أي مبالغ مقدمة.`
        : `⚠️ **CAUTION NOTICE:** This listing shows potential risk flags (${result.riskScore}%):\n• ${result.reasons.join('\n• ')}\nAlways use the server middleman escrow and never pay upfront fees or accept off-platform payments.`;
    }

    return '';
  }
}

export const clientScamShield = new ClientScamShield();
