import { dbService } from '../../database/connection.js';
import { memberRepo } from '../../database/repositories/memberRepo.js';
import { economyRepo } from '../../database/repositories/economyRepo.js';
import { perkRepo } from '../../database/repositories/perkRepo.js';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('DailyTaskManager');

export interface DailyTaskRecord {
  id: string;
  field: string;
  level: string;
  title: string;
  description: string;
  criteria_json: string;
  reward_credits: number;
  reward_xp: number;
  date_str: string;
}

export class DailyTaskManager {
  constructor() {
    this.seedDefaultTasks();
  }

  private seedDefaultTasks(): void {
    const today = new Date().toISOString().split('T')[0];

    const tasks = [
      {
        id: `task_dev_junior_${today}`,
        field: 'development',
        level: 'Junior',
        title: 'Array Deduplication & Performance',
        description: 'Write a TypeScript function that deduplicates an array of 100,000 objects by a specific property in O(N) time.',
        criteria: JSON.stringify(['Uses Map or Set', 'Handles null/undefined properties', 'Benchmarked']),
        reward_credits: 50,
        reward_xp: 100,
        date_str: today,
      },
      {
        id: `task_dev_senior_${today}`,
        field: 'development',
        level: 'Senior',
        title: 'Circuit Breaker Implementation',
        description: 'Implement a zero-dependency Circuit Breaker state machine (CLOSED, OPEN, HALF_OPEN) with timeout and half-open probes.',
        criteria: JSON.stringify(['State transitions correct', 'Timeouts caught', 'No race conditions in probe']),
        reward_credits: 100,
        reward_xp: 250,
        date_str: today,
      },
      {
        id: `task_design_junior_${today}`,
        field: 'design',
        level: 'Junior',
        title: 'Contrast Ratio Accessibility Audit',
        description: 'Select a hero banner and redesign its CTA buttons to meet WCAG AAA contrast ratio standards (7:1). Provide color hexes and rationale.',
        criteria: JSON.stringify(['Calculates contrast ratio', 'Provides accessible hex codes', 'Addresses dark mode']),
        reward_credits: 50,
        reward_xp: 100,
        date_str: today,
      },
    ];

    for (const t of tasks) {
      dbService.run(
        `INSERT OR IGNORE INTO daily_tasks (id, field, level, title, description, criteria_json, reward_credits, reward_xp, date_str)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.id,
        t.field,
        t.level,
        t.title,
        t.description,
        t.criteria,
        t.reward_credits,
        t.reward_xp,
        t.date_str
      );
    }
  }

  public getTaskForMember(userId: string): DailyTaskRecord | undefined {
    const member = memberRepo.get(userId);
    const field = member?.field || 'development';
    const level = member?.seniority_level || 'Junior';
    const today = new Date().toISOString().split('T')[0];

    let task = dbService.get<DailyTaskRecord>(
      'SELECT * FROM daily_tasks WHERE field = ? AND level = ? AND date_str = ? LIMIT 1',
      field,
      level,
      today
    );

    // Fallback if specific tier task not authored for today
    if (!task) {
      task = dbService.get<DailyTaskRecord>(
        'SELECT * FROM daily_tasks WHERE field = ? LIMIT 1',
        field
      );
    }

    return task;
  }

  public submitTask(userId: string, guildId: string, taskId: string, submissionText: string): {
    success: boolean;
    score: number;
    creditsAwarded: number;
    xpAwarded: number;
    newStreak: number;
    feedback: string;
  } {
    const task = dbService.get<DailyTaskRecord>('SELECT * FROM daily_tasks WHERE id = ?', taskId);
    if (!task) throw new Error(`Daily task ${taskId} not found`);

    const submissionId = uuidv4();
    const isQuality = submissionText.length > 40;
    const score = isQuality ? 90 : 40;
    const passed = score >= 50;

    let creditsAwarded = passed ? task.reward_credits : 0;
    let xpAwarded = passed ? task.reward_xp : 0;

    // Apply XP booster perks if member owns them
    if (perkRepo.hasActivePerk(userId, 'xp_boost_10')) {
      creditsAwarded = Math.round(creditsAwarded * 1.1);
      xpAwarded = Math.round(xpAwarded * 1.1);
    }

    const member = memberRepo.getOrCreate(userId, guildId, 'Member');
    const today = new Date().toISOString().split('T')[0];

    let newStreak = member.current_streak;
    if (passed) {
      if (member.last_task_date !== today) {
        newStreak += 1;
      }
    }

    dbService.run(
      `INSERT INTO task_submissions (id, task_id, user_id, submission_text, score, feedback, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      submissionId,
      taskId,
      userId,
      submissionText,
      score,
      passed ? 'Solution approved! Great execution.' : 'Submission was too brief to verify criteria.',
      passed ? 'approved' : 'rejected',
      Date.now()
    );

    if (passed) {
      memberRepo.update(userId, {
        current_streak: newStreak,
        last_task_date: today,
      });

      economyRepo.addTransaction({
        user_id: userId,
        guild_id: guildId,
        amount: creditsAwarded,
        source: 'daily_task',
        description: `Completed task: ${task.title} (Streak: ${newStreak})`,
      });
    }

    return {
      success: passed,
      score,
      creditsAwarded,
      xpAwarded,
      newStreak,
      feedback: passed ? 'Solution approved! Great execution.' : 'Submission was too brief to satisfy criteria.',
    };
  }
}

export const dailyTaskManager = new DailyTaskManager();
