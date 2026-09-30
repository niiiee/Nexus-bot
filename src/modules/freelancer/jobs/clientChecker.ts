import { logger } from '../../../utils/logger.js';

export interface ClientCheckResult {
  riskScore: number; // 0 to 100
  overallVerdict: 'low_risk' | 'moderate_risk' | 'high_risk';
  flags: Array<{
    type: 'scope_creep' | 'ambiguity' | 'unreasonable_demands' | 'payment_risk';
    description: string;
    suggestedClauseOrReply: string;
  }>;
  summary: string;
}

export class ClientCheckerService {
  private redFlagRules = [
    {
      regex: /(unlimited revisions|as many edits as needed|تعديلات غير محدودة|تعدل لحد ما يعجبني)/i,
      type: 'scope_creep' as const,
      descEn: 'Client expects unlimited revisions without additional billing.',
      descAr: 'العميل يطلب تعديلات لا نهائية بدون تكلفة إضافية، وده استنزاف كبير للوقت.',
      replyEn: 'Include a strict revision cap: "Agreement includes up to 2 rounds of design/code revisions. Additional revisions billed at standard hourly rate."',
      replyAr: 'حدد التعديلات في العقد: "الاتفاق يشمل جولتين من التعديلات بحد أقصى، وأي تعديل إضافي يتم حسابه بالساعة."',
    },
    {
      regex: /(simple app|just like uber|like facebook but easy|تطبيق بسيط زي أوبر|حاجة خفيفة زي فيسبوك)/i,
      type: 'ambiguity' as const,
      descEn: 'Extremely complex product trivialized as "simple", masking immense scope.',
      descAr: 'التقليل من تعقيد المنصة بوصفها "بسيطة"، وده بيخفي وراه متطلبات برمجية ضخمة.',
      replyEn: 'Request an exhaustive feature list: "Before pricing, we must document all architectural components, user roles, and third-party integrations."',
      replyAr: 'اطلب مواصفات دقيقة: "قبل التسعير محتاجين نكتب وثيقة متطلبات دقيقة (SRS) توضح كل شاشة ونظام الدفع."',
    },
    {
      regex: /(equity only|pay after profit|share in revenue|شراكة بالأرباح|أرباح لما المشروع ينجح)/i,
      type: 'payment_risk' as const,
      descEn: 'Offering speculative future profit/equity instead of guaranteed freelance compensation.',
      descAr: 'عرض نسبة من الأرباح أو شراكة بدلاً من مقابل مالي حقيقي ومضمون.',
      replyEn: 'Require cash compensation for dev work: "I operate as an independent contractor on cash milestones. I cannot finance client development with speculative equity."',
      replyAr: 'وضح أنك مستقل ولست مستثمراً: "أنا بقدم خدمات برمجية بمقابل مالي محدد لكل مرحلة تسليم، ولا أقبل الشراكة غير الممولة."',
    },
    {
      regex: /(available 24\/7|urgent weekend|must answer my calls at night|متاح 24 ساعة|ترد عليا في أي وقت)/i,
      type: 'unreasonable_demands' as const,
      descEn: 'Expecting continuous off-hours availability without retainer or on-call compensation.',
      descAr: 'توقع تواجدك على مدار الساعة والرد في أيام الإجازات بدون اشتراك دعم مخصص.',
      replyEn: 'Define communication hours: "Working hours are Sunday-Thursday, 10 AM - 6 PM UTC+2. Asynchronous replies provided within 4 business hours."',
      replyAr: 'حدد أوقات التواصل في الاتفاق: "مواعيد العمل الرسمية من 10 صباحاً لـ 6 مساءً بتوقيت القاهرة، والردود تتم عبر الديسكورد خلال ساعات العمل."',
    },
  ];

  public analyzeClientBrief(brief: string, lang: 'en' | 'ar' = 'en'): ClientCheckResult {
    const isAr = lang === 'ar';
    const flags: ClientCheckResult['flags'] = [];
    let riskScore = 10;

    for (const rule of this.redFlagRules) {
      if (rule.regex.test(brief)) {
        riskScore += 25;
        flags.push({
          type: rule.type,
          description: isAr ? rule.descAr : rule.descEn,
          suggestedClauseOrReply: isAr ? rule.replyAr : rule.replyEn,
        });
      }
    }

    if (brief.length < 50) {
      riskScore += 20;
      flags.push({
        type: 'ambiguity',
        description: isAr ? 'تفاصيل المشروع مبهمة وقصيرة جداً.' : 'Brief is excessively vague and lacks essential project parameters.',
        suggestedClauseOrReply: isAr
          ? 'اطلب ملء استبيان متطلبات (Client Onboarding Brief) قبل البدء.'
          : 'Send a structured project discovery questionnaire before quoting.',
      });
    }

    riskScore = Math.min(100, riskScore);

    let overallVerdict: 'low_risk' | 'moderate_risk' | 'high_risk' = 'low_risk';
    if (riskScore >= 60) overallVerdict = 'high_risk';
    else if (riskScore >= 30) overallVerdict = 'moderate_risk';

    const summary = isAr
      ? `تحليل الطلب: درجة المخاطرة ${riskScore}/100 (${overallVerdict === 'high_risk' ? 'خطر مرتفع' : overallVerdict === 'moderate_risk' ? 'متوسط' : 'آمن نسبياً'}). تم رصد ${flags.length} ملاحظات هامة.`
      : `Brief Analysis: Risk score ${riskScore}/100 (${overallVerdict.replace('_', ' ').toUpperCase()}). Detected ${flags.length} risk factors.`;

    logger.info('ClientChecker', `Analyzed brief: score=${riskScore}, verdict=${overallVerdict}`);

    return {
      riskScore,
      overallVerdict,
      flags,
      summary,
    };
  }
}

export const clientCheckerService = new ClientCheckerService();
