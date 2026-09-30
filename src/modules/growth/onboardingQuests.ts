import { dbService } from '../../database/connection.js';
import { badgeEngine } from '../freelancer/portfolio/badgeEngine.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface DailyQuest {
  dayNumber: number;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  rewardCredits: number;
}

export const SEVEN_DAY_QUESTS: DailyQuest[] = [
  { dayNumber: 1, titleEn: 'Profile Setup', titleAr: 'إعداد الملف الشخصي', descriptionEn: 'Complete intake interview and set up tech stack', descriptionAr: 'أكمل المقابلة وحدد لغاتك وأدواتك', rewardCredits: 25 },
  { dayNumber: 2, titleEn: 'Knowledge Tour', titleAr: 'جولة المعرفة', descriptionEn: 'Watch a masterclass in #recorded-courses', descriptionAr: 'شاهد درساً في دورات السيرفر', rewardCredits: 25 },
  { dayNumber: 3, titleEn: 'First Code Mission', titleAr: 'مهمتك البرمجية الأولى', descriptionEn: 'Submit and complete your first daily task', descriptionAr: 'حل وسلم مهمتك اليومية الأولى', rewardCredits: 35 },
  { dayNumber: 4, titleEn: 'Portfolio Showcase', titleAr: 'عرض معرض الأعمال', descriptionEn: 'Add your first project to /portfolio', descriptionAr: 'أضف مشروعك الأول لمعرض الأعمال', rewardCredits: 35 },
  { dayNumber: 5, titleEn: 'Community Helper', titleAr: 'مساعد المجتمع', descriptionEn: 'Answer or post a question in #help', descriptionAr: 'شارك بسؤال أو إجابة في قناة المساعدة', rewardCredits: 40 },
  { dayNumber: 6, titleEn: 'Peer Session', titleAr: 'جلسة التوأمة البرمجية', descriptionEn: 'Join a pair study session in voice', descriptionAr: 'انضم لغرفة عمل أو دراسة صوتية', rewardCredits: 40 },
  { dayNumber: 7, titleEn: 'Pioneer Graduation', titleAr: 'التخرج الماسي', descriptionEn: 'Complete all 7 quests and claim your Pioneer Badge', descriptionAr: 'أتمم الأسبوع وافتح شارة الريادة', rewardCredits: 100 },
];

export class OnboardingQuestsService {
  public getMemberQuestProgress(userId: string): Array<DailyQuest & { isCompleted: boolean }> {
    const completedRows = dbService.all<{ day_number: number }>(
      `SELECT day_number FROM onboarding_quests WHERE user_id = ? AND completed = 1`,
      userId
    );
    const completedDays = new Set(completedRows.map((r) => r.day_number));

    return SEVEN_DAY_QUESTS.map((q) => ({
      ...q,
      isCompleted: completedDays.has(q.dayNumber),
    }));
  }

  public completeQuest(userId: string, guildId: string, dayNumber: number): { success: boolean; allCompleted: boolean; message: string } {
    const existing = dbService.get<{ id: string; completed: number }>(
      `SELECT id, completed FROM onboarding_quests WHERE user_id = ? AND day_number = ?`,
      userId,
      dayNumber
    );

    if (existing && existing.completed) {
      return { success: false, allCompleted: false, message: 'Quest already completed!' };
    }

    const quest = SEVEN_DAY_QUESTS.find((q) => q.dayNumber === dayNumber) || SEVEN_DAY_QUESTS[0];
    const now = Date.now();

    if (existing) {
      dbService.run(`UPDATE onboarding_quests SET completed = 1, completed_at = ? WHERE id = ?`, now, existing.id);
    } else {
      const id = `qst_${randomUUID().slice(0, 8)}`;
      dbService.run(
        `INSERT INTO onboarding_quests (id, user_id, day_number, quest_name, completed, completed_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        id,
        userId,
        dayNumber,
        quest.titleEn,
        now
      );
    }

    const progress = this.getMemberQuestProgress(userId);
    const allCompleted = progress.every((p) => p.isCompleted);

    if (allCompleted) {
      badgeEngine.grantBadge(userId, guildId, 'century_contributor');
      logger.info('OnboardingQuests', `User ${userId} completed ALL 7 onboarding quests!`);
    }

    return {
      success: true,
      allCompleted,
      message: `Day ${dayNumber} Quest "${quest.titleEn}" completed! +${quest.rewardCredits} credits awarded!`,
    };
  }
}

export const onboardingQuestsService = new OnboardingQuestsService();
