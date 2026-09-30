import { logger } from '../../../utils/logger.js';

export interface CurrencyConversionResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  indicativeRate: number;
  disclaimer: string;
}

export interface TaxGuidance {
  topic: string;
  summaryEn: string;
  summaryAr: string;
  actionableStepsEn: string[];
  actionableStepsAr: string[];
  disclaimer: string;
}

export class TaxAndCurrencyService {
  // Approximate indicative exchange rates to USD base
  private ratesToUSD: Record<string, number> = {
    USD: 1.0,
    EGP: 48.5,
    EUR: 0.92,
    SAR: 3.75,
    AED: 3.67,
  };

  public convertCurrency(amount: number, from: string, to: string): CurrencyConversionResult {
    const fromRate = this.ratesToUSD[from.toUpperCase()] || 1.0;
    const toRate = this.ratesToUSD[to.toUpperCase()] || 1.0;

    const inUSD = amount / fromRate;
    const convertedAmount = parseFloat((inUSD * toRate).toFixed(2));
    const indicativeRate = parseFloat((toRate / fromRate).toFixed(4));

    const disclaimer =
      'DISCLAIMER: Currency rates are indicative reference values only and may fluctuate. Verify official rates with your bank before transactions.';

    logger.info('TaxAndCurrency', `Converted ${amount} ${from} to ${convertedAmount} ${to}`);

    return {
      fromCurrency: from.toUpperCase(),
      toCurrency: to.toUpperCase(),
      amount,
      convertedAmount,
      indicativeRate,
      disclaimer,
    };
  }

  public getTaxGuidance(topic: 'egypt_freelance' | 'us_w8ben' | 'vat_basics' = 'egypt_freelance'): TaxGuidance {
    const disclaimer =
      'DISCLAIMER: This guidance is informational only and does not substitute for certified accounting or legal counsel. Always consult a qualified tax advisor.';

    if (topic === 'us_w8ben') {
      return {
        topic: 'US Clients & Form W-8BEN',
        summaryEn: 'Form W-8BEN certifies foreign tax status for non-US freelancers, preventing 30% automatic US tax withholding.',
        summaryAr: 'نموذج W-8BEN يثبت أنك مستقل غير مقيم بالولايات المتحدة لمنع خصم 30% من أرباحك كضرائب أمريكية.',
        actionableStepsEn: [
          'Request W-8BEN form from US client or platform (Upwork, Stripe, etc.)',
          'Fill in Full Legal Name, Country of Citizenship, and Permanent Address',
          'Provide your local Tax Identification Number (TIN/الرقم القومي)',
          'Sign and submit annually or when address changes',
        ],
        actionableStepsAr: [
          'اطلب نموذج W-8BEN من العميل الأمريكي أو المنصة',
          'اكتب اسمك الثلاثي وعنوانك الدائم في مصر بدقة',
          'اكتب رقمك القومي أو الضريبي في خانة Foreign Tax ID',
          'وقع إلكترونياً وجدد النموذج كل 3 سنوات',
        ],
        disclaimer,
      };
    }

    return {
      topic: 'Egypt Freelancer Tax & Banking Reference',
      summaryEn: 'Overview of freelance tax card registration, bank foreign currency accounts, and e-invoicing exemptions.',
      summaryAr: 'دليل المستقل في مصر: البطاقة الضريبية وحسابات العملة الأجنبية والفاتورة الإلكترونية.',
      actionableStepsEn: [
        'Open a dedicated USD/EUR foreign currency bank account for freelance receipts',
        'Obtain a freelance tax card (بطاقة ضريبية مهن غير تجارية)',
        'Register for the ETA portal (منظومة الفاتورة الإلكترونية) if billing local entities',
        'Keep accurate invoices and contracts as proof of source of funds for bank transfers',
      ],
      actionableStepsAr: [
        'افتح حساب بنكي دولاري/يورو لاستقبال تحويلات العملاء من الخارج',
        'استخرج بطاقة ضريبية (مهن حرة) لتوفيق وضعك القانوني وتسهيل المعاملات البنكية',
        'سجل في منظومة الفاتورة الإلكترونية إذا كنت تتعامل مع شركات محلية',
        'احتفظ دائماً بنسخة من العقود وفواتير العمل لإثبات مصدر الأموال للبنك عند الطلب',
      ],
      disclaimer,
    };
  }
}

export const taxAndCurrencyService = new TaxAndCurrencyService();
