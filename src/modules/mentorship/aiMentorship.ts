import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface MentorshipRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  goals_json: string;
  weekly_plan_json: string;
  preferences_json: string;
  last_checkin_at: number | null;
  created_at: number;
}

export interface MentorshipPlan {
  weekNumber: number;
  focusArea: string;
  dailyTasks: Array<{ day: string; task: string; completed: boolean }>;
  mentorNudge: string;
}

export class AiMentorshipService {
  /**
   * REQ-23.15.1: Initialize or update 1-on-1 AI mentorship relationship
   */
  public establishMentorship(
    tenantId: string,
    userId: string,
    goals: string[],
    preferences: { preferredTime?: string; language?: 'en' | 'ar' } = {}
  ): MentorshipRecord {
    const existing = dbService.get<MentorshipRecord>(
      `SELECT * FROM ai_mentorships WHERE tenant_id = ? AND user_id = ?`,
      tenantId,
      userId
    );

    const now = Date.now();
    const initialPlan = this.generateWeeklyPlan(goals, preferences.language || 'en');

    if (existing) {
      dbService.run(
        `UPDATE ai_mentorships
         SET goals_json = ?, weekly_plan_json = ?, preferences_json = ?
         WHERE id = ?`,
        JSON.stringify(goals),
        JSON.stringify(initialPlan),
        JSON.stringify(preferences),
        existing.id
      );
      return {
        ...existing,
        goals_json: JSON.stringify(goals),
        weekly_plan_json: JSON.stringify(initialPlan),
        preferences_json: JSON.stringify(preferences)
      };
    } else {
      const id = cryptoRandomUUID();
      dbService.run(
        `INSERT INTO ai_mentorships (
           id, tenant_id, user_id, goals_json, weekly_plan_json, preferences_json, last_checkin_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        id,
        tenantId,
        userId,
        JSON.stringify(goals),
        JSON.stringify(initialPlan),
        JSON.stringify(preferences),
        now
      );

      return {
        id,
        tenant_id: tenantId,
        user_id: userId,
        goals_json: JSON.stringify(goals),
        weekly_plan_json: JSON.stringify(initialPlan),
        preferences_json: JSON.stringify(preferences),
        last_checkin_at: null,
        created_at: now
      };
    }
  }

  /**
   * REQ-23.15.2: Generate structured weekly personalized study plan
   */
  public generateWeeklyPlan(goals: string[], lang: 'en' | 'ar' = 'en'): MentorshipPlan {
    const primaryGoal = goals[0] || 'Fullstack Competence';

    if (lang === 'ar') {
      return {
        weekNumber: 1,
        focusArea: primaryGoal,
        dailyTasks: [
          { day: 'Sunday', task: `مراجعة المفاهيم الأساسية لـ ${primaryGoal}`, completed: false },
          { day: 'Tuesday', task: `بناء نموذج عملي مصغر وتطبيقه`, completed: false },
          { day: 'Thursday', task: `مشاركة كود المشروع في قناة الشو كيس للحصول على مراجعة النظراء`, completed: false }
        ],
        mentorNudge: 'يا بطل، الالتزام اليومي البسيط بيعمل نتائج أسطورية على المدى الطويل! عاش يا وحش.'
      };
    }

    return {
      weekNumber: 1,
      focusArea: primaryGoal,
      dailyTasks: [
        { day: 'Monday', task: `Deep dive into architecture patterns for ${primaryGoal}`, completed: false },
        { day: 'Wednesday', task: 'Implement hands-on code project and write unit tests', completed: false },
        { day: 'Friday', task: 'Submit PR to community showcase channel for peer feedback', completed: false }
      ],
      mentorNudge: 'Consistency is your superpower. Ship small increments every week and you will master this!'
    };
  }

  /**
   * REQ-23.15.3: Weekly progress check-in
   */
  public recordTaskCompletion(
    tenantId: string,
    userId: string,
    dayName: string
  ): { completedPercentage: number; checkinMessage: string } {
    const mentorship = dbService.get<MentorshipRecord>(
      `SELECT * FROM ai_mentorships WHERE tenant_id = ? AND user_id = ?`,
      tenantId,
      userId
    );

    if (!mentorship) throw new Error('Mentorship profile not found');

    const plan: MentorshipPlan = JSON.parse(mentorship.weekly_plan_json);
    const targetTask = plan.dailyTasks.find(t => t.day.toLowerCase() === dayName.toLowerCase());
    if (targetTask) {
      targetTask.completed = true;
    }

    const completedCount = plan.dailyTasks.filter(t => t.completed).length;
    const completedPercentage = Number(((completedCount / plan.dailyTasks.length) * 100).toFixed(1));
    const now = Date.now();

    dbService.run(
      `UPDATE ai_mentorships
       SET weekly_plan_json = ?, last_checkin_at = ?
       WHERE id = ?`,
      JSON.stringify(plan),
      now,
      mentorship.id
    );

    const checkinMessage = `🌟 Great job <@${userId}>! You have completed ${completedCount}/${plan.dailyTasks.length} weekly goals (${completedPercentage}%).`;

    return { completedPercentage, checkinMessage };
  }

  /**
   * REQ-23.15.4: Asynchronous code review feedback
   */
  public conductCodeClinicReview(codeSnippet: string, userLanguage: 'en' | 'ar' = 'en'): {
    score: number;
    feedback: string;
    actionableAdvice: string[];
  } {
    const hasErrorHandling = codeSnippet.includes('try') || codeSnippet.includes('catch') || codeSnippet.includes('if (!');
    const hasTests = codeSnippet.includes('expect') || codeSnippet.includes('assert') || codeSnippet.includes('test(');

    let score = 75;
    if (hasErrorHandling) score += 15;
    if (hasTests) score += 10;

    const advice = [
      'Extract reusable helper utilities to maintain single responsibility.',
      'Ensure comprehensive edge-case handling for null or undefined arguments.',
      'Include inline comments explaining non-trivial business logic.'
    ];

    const feedback = userLanguage === 'ar'
      ? `كودك ممتاز ومنظم! تقييم المراجعة: ${score}/100. بننصحك تعزز معالجة الأخطاء وتضيف اختبارات آلية.`
      : `Solid code architecture! Review score: ${score}/100. Continue prioritizing type safety and edge-case validation.`;

    return {
      score,
      feedback,
      actionableAdvice: advice
    };
  }
}

export const aiMentorship = new AiMentorshipService();
