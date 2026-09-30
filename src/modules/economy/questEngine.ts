import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { creditLedgerService } from './creditLedger.js';

export type QuestPath = 'code_warrior' | 'design_maestro' | 'freelance_strategist' | 'community_guardian';

export interface QuestObjective {
  id: string;
  descriptionEn: string;
  descriptionAr: string;
  targetCount: number;
}

export interface QuestTemplate {
  id: string;
  path: QuestPath;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  rewardCredits: number;
  rewardXp: number;
  objectives: QuestObjective[];
}

export interface ActiveUserQuest {
  userId: string;
  guildId: string;
  quest: QuestTemplate;
  progress: Record<string, number>; // objectiveId -> currentCount
  isCompleted: boolean;
  completedAt?: number;
}

export class QuestEngineService {
  public readonly QUEST_CATALOG: QuestTemplate[] = [
    {
      id: 'cw_quest_1',
      path: 'code_warrior',
      titleEn: 'The Clean Code Crucible',
      titleAr: 'بوتقة الكود النظيف',
      descriptionEn: 'Submit your code for automated peer review and optimize a function.',
      descriptionAr: 'قدم كود للمراجعة وحسن أداء دالة برمجية.',
      rewardCredits: 120,
      rewardXp: 200,
      objectives: [
        { id: 'cw_obj_1', descriptionEn: 'Run /review-code on a function', descriptionAr: 'شغل فحص /review-code على دالة', targetCount: 1 },
        { id: 'cw_obj_2', descriptionEn: 'Complete 1 daily programming task', descriptionAr: 'أكمل مهمة برمجية يومية واحدة', targetCount: 1 },
      ],
    },
    {
      id: 'dm_quest_1',
      path: 'design_maestro',
      titleEn: 'Pixel Perfect Harmony',
      titleAr: 'تناغم البكسل المثالي',
      descriptionEn: 'Audit a UI design for WCAG contrast and submit feedback in the portfolio gallery.',
      descriptionAr: 'افحص تصميم واجهة لتوافق التباين وعلق على عمل في المعرض.',
      rewardCredits: 120,
      rewardXp: 200,
      objectives: [
        { id: 'dm_obj_1', descriptionEn: 'Run /design-critique on an asset', descriptionAr: 'شغل فحص التصميم /design-critique على ملف', targetCount: 1 },
        { id: 'dm_obj_2', descriptionEn: 'Review a portfolio piece in the gallery', descriptionAr: 'قدم مراجعة لعمل فني في المعرض', targetCount: 1 },
      ],
    },
    {
      id: 'fs_quest_1',
      path: 'freelance_strategist',
      titleEn: 'The Winning Proposal',
      titleAr: 'عرض العمل الرابح',
      descriptionEn: 'Generate a proposal breakdown with AI and track project hours with the time tracker.',
      descriptionAr: 'أنشئ عرض عمل احترافي وسجل ساعات عمل في المؤقت.',
      rewardCredits: 150,
      rewardXp: 250,
      objectives: [
        { id: 'fs_obj_1', descriptionEn: 'Generate proposal using /proposal-coach', descriptionAr: 'أنشئ مقترحاً باستخدام /proposal-coach', targetCount: 1 },
        { id: 'fs_obj_2', descriptionEn: 'Track at least 30 minutes in /timer', descriptionAr: 'سجل ٣٠ دقيقة عمل على الأقل عبر /timer', targetCount: 1 },
      ],
    },
    {
      id: 'cg_quest_1',
      path: 'community_guardian',
      titleEn: 'The Helpful Senior',
      titleAr: 'الزميل المعطاء',
      descriptionEn: 'Endorse a colleague, answer a technical question, and upvote a community suggestion.',
      descriptionAr: 'قدم توصية لزميل، جاوب على استفسار، وصوت لاقتراح في السيرفر.',
      rewardCredits: 100,
      rewardXp: 180,
      objectives: [
        { id: 'cg_obj_1', descriptionEn: 'Endorse a peer with /endorse', descriptionAr: 'أعط زميلاً تزكية عبر /endorse', targetCount: 1 },
        { id: 'cg_obj_2', descriptionEn: 'Upvote a suggestion with /suggest', descriptionAr: 'صوّت لاقتراح في صندوق الأفكار', targetCount: 1 },
      ],
    },
  ];

  // In-memory active user quests: `${userId}:${guildId}:${questId}` -> ActiveUserQuest
  private userQuests = new Map<string, ActiveUserQuest>();

  /**
   * Assigns or starts a quest path for a user.
   */
  public startQuest(userId: string, guildId: string, questId: string): ActiveUserQuest | null {
    const quest = this.QUEST_CATALOG.find(q => q.id === questId);
    if (!quest) return null;

    const key = `${userId}:${guildId}:${questId}`;
    const initialProgress: Record<string, number> = {};
    for (const obj of quest.objectives) {
      initialProgress[obj.id] = 0;
    }

    const activeQuest: ActiveUserQuest = {
      userId,
      guildId,
      quest,
      progress: initialProgress,
      isCompleted: false,
    };

    this.userQuests.set(key, activeQuest);
    logger.info(`[QuestEngine] User ${userId} started quest: ${quest.titleEn}`);
    return activeQuest;
  }

  /**
   * Increments objective progress and evaluates quest completion.
   */
  public recordProgress(
    userId: string,
    guildId: string,
    questId: string,
    objectiveId: string,
    amount = 1
  ): { quest: ActiveUserQuest | null; newlyCompleted: boolean } {
    const key = `${userId}:${guildId}:${questId}`;
    let active = this.userQuests.get(key);

    if (!active) {
      active = this.startQuest(userId, guildId, questId) || undefined;
      if (!active) return { quest: null, newlyCompleted: false };
    }

    if (active.isCompleted) {
      return { quest: active, newlyCompleted: false };
    }

    active.progress[objectiveId] = (active.progress[objectiveId] || 0) + amount;

    // Check if all objectives met
    const allDone = active.quest.objectives.every(
      obj => (active!.progress[obj.id] || 0) >= obj.targetCount
    );

    let newlyCompleted = false;

    if (allDone) {
      active.isCompleted = true;
      active.completedAt = Date.now();
      newlyCompleted = true;

      // Credit ledger award
      creditLedgerService.recordTransaction({
        userId,
        guildId,
        amount: active.quest.rewardCredits,
        type: 'quest_reward',
        description: `Completed quest: ${active.quest.titleEn}`,
      });

      // Add XP to member
      dbService.run(
        `UPDATE members SET xp = xp + ? WHERE user_id = ? AND guild_id = ?`,
        active.quest.rewardXp,
        userId,
        guildId
      );

      logger.info(`[QuestEngine] User ${userId} completed quest "${active.quest.titleEn}"! Rewarded ${active.quest.rewardCredits} credits and ${active.quest.rewardXp} XP.`);
    }

    return { quest: active, newlyCompleted };
  }

  /**
   * Retrieves active quest for a user.
   */
  public getActiveQuest(userId: string, guildId: string, questId: string): ActiveUserQuest | undefined {
    return this.userQuests.get(`${userId}:${guildId}:${questId}`);
  }
}

export const questEngineService = new QuestEngineService();
