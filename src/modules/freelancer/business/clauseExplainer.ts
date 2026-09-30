import { logger } from '../../../utils/logger.js';

export interface ClauseAnalysis {
  clauseType: string;
  plainEnglishExplanation: string;
  plainArabicExplanation: string;
  riskLevel: 'safe' | 'standard' | 'high_risk';
  protectiveRecommendationEn: string;
  protectiveRecommendationAr: string;
  disclaimer: string;
}

export class ClauseExplainerService {
  private standardClauses: Record<
    string,
    {
      name: string;
      en: string;
      ar: string;
      risk: 'safe' | 'standard' | 'high_risk';
      recEn: string;
      recAr: string;
    }
  > = {
    ip_transfer: {
      name: 'Intellectual Property (IP) Transfer upon Full Payment',
      en: 'States that intellectual property rights transfer to the client ONLY after all milestone invoices are paid in full. Protects you against unpaid code theft.',
      ar: 'حقوق الملكية الفكرية لا تنتقل للعميل إلا بعد استلامك لكامل مستحقاتك المالية. ده بيحميك تماماً من استخدام الكود أو التصميم لو العميل دفع عربون ومكملش.',
      risk: 'safe',
      recEn: 'Always maintain this clause: "All rights and code transfer to Client only upon 100% full settlement of agreed fees."',
      recAr: 'اتمسك بالبند ده دائماً: "تنتقل ملكية الكود للعميل فور سداد كامل الأتعاب المتفق عليها فقط."',
    },
    kill_fee: {
      name: 'Kill Fee / Early Cancellation Compensation',
      en: 'Requires the client to pay for all work completed to date plus a predetermined percentage (e.g. 25-50%) if they cancel the project midway without cause.',
      ar: 'بند شرط جزائي للتعويض عند إلغاء المشروع من طرف العميل فجأة. يضمن حصولك على أتعاب العمل المنجز بالإضافة لنسبة تعويض عن حجز وقتك.',
      risk: 'standard',
      recEn: 'Standard recommendation: "If Client terminates for convenience, Freelancer is entitled to pro-rated pay for work performed plus a 25% cancellation fee."',
      recAr: 'صيغة موصى بها: "في حال إلغاء العميل للمشروع بدون إخلال من المستقل، يستحق المستقل أتعاب ما تم إنجازه بالإضافة إلى 25% من باقي قيمة العقد تعويضاً."',
    },
    unlimited_indemnity: {
      name: 'Unlimited Indemnification & Consequential Damages',
      en: 'Dangerous clause holding the freelancer personally liable for any indirect damages, lost client revenues, or security breaches without a financial cap.',
      ar: 'بند عالي الخطورة يُلزم المستقل بتعويض العميل عن أي خسائر غير مباشرة أو أرباح فائتة أو ثغرات أمنية بدون حد أقصى للتعويض!',
      risk: 'high_risk',
      recEn: 'DANGER: Always cap liability: "Total liability of Freelancer shall not exceed the total fees actually paid to Freelancer under this Agreement."',
      recAr: 'تحذير: لا توافق أبداً بدون تحديد سقف: "في جميع الأحوال، لا تتجاوز مسؤولية المستقل الإجمالية إجمالي المبالغ المستلمة فعلياً بموجب هذا الاتفاق."',
    },
    warranty_period: {
      name: 'Warranty & Post-Launch Bug Fixing Period',
      en: 'Specifies the time window (e.g. 14 to 30 days) during which the freelancer will fix verified bugs introduced during original scope, at no extra cost.',
      ar: 'فترة الضمان (عادة من 14 إلى 30 يوماً بعد التسليم) يلتزم فيها المستقل بإصلاح أي أخطاء برمجية في النطاق المتفق عليه مجاناً، ولا تشمل ميزات جديدة.',
      risk: 'standard',
      recEn: 'Limit duration and clarify exclusions: "Warranty covers critical bugs in agreed scope for 30 days. New features or third-party API changes are billed separately."',
      recAr: 'حدد المدة واستبعد الميزات الجديدة: "الضمان يشمل معالجة العيوب البرمجية في النطاق الأصلي لمدة 30 يوماً من التسليم. أي إضافات جديدة تحسب كطلب منفصل."',
    },
  };

  public explainClause(clauseTextOrKey: string): ClauseAnalysis {
    const lower = clauseTextOrKey.toLowerCase();
    let matched = this.standardClauses.ip_transfer;

    if (lower.includes('kill') || lower.includes('cancel') || lower.includes('termination')) {
      matched = this.standardClauses.kill_fee;
    } else if (lower.includes('indemn') || lower.includes('liab') || lower.includes('damage')) {
      matched = this.standardClauses.unlimited_indemnity;
    } else if (lower.includes('warran') || lower.includes('bug') || lower.includes('guarantee')) {
      matched = this.standardClauses.warranty_period;
    }

    const disclaimer =
      'DISCLAIMER: This analysis is provided for educational and community coordination purposes only. It is not formal legal advice. Consult a licensed attorney for binding contract reviews.';

    logger.info('ClauseExplainer', `Explained clause type "${matched.name}" (risk=${matched.risk})`);

    return {
      clauseType: matched.name,
      plainEnglishExplanation: matched.en,
      plainArabicExplanation: matched.ar,
      riskLevel: matched.risk,
      protectiveRecommendationEn: matched.recEn,
      protectiveRecommendationAr: matched.recAr,
      disclaimer,
    };
  }
}

export const clauseExplainerService = new ClauseExplainerService();
