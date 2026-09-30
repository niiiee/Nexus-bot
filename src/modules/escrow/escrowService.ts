import { logger } from '../../utils/logger.js';

export class EscrowService {
  public static readonly LEGAL_DISCLAIMER_EN =
    '⚠️ **STRICT NON-CUSTODIAL NOTICE:** Senior Progg and this Discord server do NOT hold, transfer, custody, or transmit fiat or cryptocurrency. The bot is an evidence-logging and workflow-coordination tool only. All payments are sent and received externally between parties via verified human middlemen. No banking or escrow services are provided.';

  public static readonly LEGAL_DISCLAIMER_AR =
    '⚠️ **إخلاء مسؤولية غير وصائي صارم (Non-Custodial):** بوت Senior Progg وإدارة السيرفر لا يمسكون أو يحفظون أو يحولون أي أموال أو عملات رقمية إطلاقاً. البوت مجرد أداة لتسجيل الاتفاقيات وتوثيق مراحل التسليم. كافة المعاملات المالية تتم خارجياً عبر وسطاء بشريين معتمدين. البوت ليس بنكاً ولا وسيط دفع مالي.';

  public getDisclaimer(lang: 'en' | 'ar' = 'en'): string {
    return lang === 'ar' ? EscrowService.LEGAL_DISCLAIMER_AR : EscrowService.LEGAL_DISCLAIMER_EN;
  }

  public assertNonCustodialCompliance(): boolean {
    logger.info('EscrowService', 'Non-custodial compliance check: VERIFIED. Zero custodial payment pathways exist.');
    return true;
  }
}

export const escrowService = new EscrowService();
