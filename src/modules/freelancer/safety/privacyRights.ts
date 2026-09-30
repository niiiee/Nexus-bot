import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';

export interface UserDataExport {
  userId: string;
  memberRecord: unknown;
  vettingSessions: unknown[];
  skillTests: unknown[];
  workSubmissions: unknown[];
  taskSubmissions: unknown[];
  portfolioItems: unknown[];
  endorsementsGiven: unknown[];
  endorsementsReceived: unknown[];
  badges: unknown[];
  memoryFacts: unknown[];
  creditLedger: unknown[];
  exportedAt: number;
}

export class PrivacyRightsService {
  public exportUserData(userId: string): UserDataExport {
    const memberRecord = dbService.get(`SELECT * FROM members WHERE user_id = ?`, userId);
    const vettingSessions = dbService.all(`SELECT * FROM vetting_sessions WHERE user_id = ?`, userId);
    const skillTests = dbService.all(`SELECT * FROM skill_tests WHERE user_id = ?`, userId);
    const workSubmissions = dbService.all(`SELECT * FROM work_submissions WHERE user_id = ?`, userId);
    const taskSubmissions = dbService.all(`SELECT * FROM task_submissions WHERE user_id = ?`, userId);
    const portfolioItems = dbService.all(`SELECT * FROM portfolio_items WHERE user_id = ?`, userId);
    const endorsementsGiven = dbService.all(`SELECT * FROM endorsements WHERE giver_id = ?`, userId);
    const endorsementsReceived = dbService.all(`SELECT * FROM endorsements WHERE receiver_id = ?`, userId);
    const badges = dbService.all(`SELECT * FROM member_badges WHERE user_id = ?`, userId);
    const memoryFacts = dbService.all(`SELECT * FROM memory_facts WHERE user_id = ?`, userId);
    const creditLedger = dbService.all(`SELECT * FROM credit_ledger WHERE user_id = ?`, userId);

    logger.info('PrivacyRights', `Exported full data package for user ${userId}`);

    return {
      userId,
      memberRecord,
      vettingSessions,
      skillTests,
      workSubmissions,
      taskSubmissions,
      portfolioItems,
      endorsementsGiven,
      endorsementsReceived,
      badges,
      memoryFacts,
      creditLedger,
      exportedAt: Date.now(),
    };
  }

  public purgeUserData(userId: string): { success: boolean; recordsPurged: number } {
    let recordsPurged = 0;

    const tables = [
      'vetting_sessions',
      'skill_tests',
      'work_submissions',
      'task_submissions',
      'portfolio_items',
      'endorsements',
      'member_badges',
      'memory_facts',
      'credit_ledger',
      'reminders',
      'earnings_records',
      'members',
    ];

    for (const table of tables) {
      const col = table === 'endorsements' ? 'giver_id' : 'user_id';
      const res = dbService.run(`DELETE FROM ${table} WHERE ${col} = ?`, userId);
      recordsPurged += Number(res.changes);

      if (table === 'endorsements') {
        const res2 = dbService.run(`DELETE FROM endorsements WHERE receiver_id = ?`, userId);
        recordsPurged += Number(res2.changes);
      }
    }

    logger.warn('PrivacyRights', `PURGED all user data for user ${userId} (${recordsPurged} records deleted)`);

    return {
      success: true,
      recordsPurged,
    };
  }

  public getTransparencyNotice(lang: 'en' | 'ar' = 'en'): string {
    const isAr = lang === 'ar';
    if (isAr) {
      return (
        `🔒 **إشعار الخصوصية والشفافية - Senior Progg**\n\n` +
        `1. **البيانات المخزنة:** نخزن فقط معرف الديسكورد، اسم المستخدم، التخصص المعلن، نتائج التقييم، وتاريخ المهام المنجزة.\n` +
        `2. **الرسائل الخاصة (DMs):** البوت لا يخزن أبداً رسائلك الخاصة أو كلمات المرور أو أي مفاتيح برمجية سرية.\n` +
        `3. **التحكم وحق النسيان:** يمكنك في أي وقت تصدير كامل بياناتك بصيغة JSON أو حذف حسابك نهائياً باستخدام أمر \`/mydata\`.\n` +
        `4. **عدم المشاركة:** لا يتم بيع أو مشاركة أي بيانات مع أي جهات خارجية أو أطراف ثالثة إطلاقاً.`
      );
    }

    return (
      `🔒 **Privacy & Transparency Notice - Senior Progg**\n\n` +
      `1. **Stored Data:** We only persist your Discord ID, username, declared skills, test scores, and task history.\n` +
      `2. **Private Messages & Secrets:** We never store private DMs, passwords, API tokens, or payment details.\n` +
      `3. **User Rights & Export:** You retain 100% control to export your data in JSON or permanently purge your record with \`/mydata\`.\n` +
      `4. **Zero Third-Party Sharing:** Your data is strictly self-contained within this server and never shared or sold.`
    );
  }
}

export const privacyRightsService = new PrivacyRightsService();
