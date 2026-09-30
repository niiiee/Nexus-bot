import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface AccountabilityGoal {
  id: string;
  userId: string;
  guildId: string;
  goalDescription: string;
  targetDeadline: number;
  status: 'active' | 'completed' | 'missed';
  createdAt: number;
}

export class AccountabilityBoardService {
  private goals: Map<string, AccountabilityGoal> = new Map();

  public commitGoal(params: {
    userId: string;
    guildId: string;
    goalDescription: string;
    daysToTarget?: number;
  }): AccountabilityGoal {
    const id = `goal_${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const days = params.daysToTarget || 7;
    const targetDeadline = now + days * 24 * 60 * 60 * 1000;

    const goal: AccountabilityGoal = {
      id,
      userId: params.userId,
      guildId: params.guildId,
      goalDescription: params.goalDescription,
      targetDeadline,
      status: 'active',
      createdAt: now,
    };

    this.goals.set(id, goal);
    logger.info('AccountabilityBoard', `Goal committed by ${params.userId}: "${params.goalDescription}" due in ${days}d`);
    return goal;
  }

  public completeGoal(goalId: string, userId: string): { success: boolean; message: string; xpAwarded: number } {
    const goal = this.goals.get(goalId);
    if (!goal) return { success: false, message: 'Goal not found.', xpAwarded: 0 };
    if (goal.userId !== userId) return { success: false, message: 'You are not the owner of this goal.', xpAwarded: 0 };

    goal.status = 'completed';
    const xpAwarded = 100;
    logger.info('AccountabilityBoard', `Goal ${goalId} marked complete by ${userId}`);

    return {
      success: true,
      message: `🎯 Huge congratulations! Goal marked complete. You earned ${xpAwarded} XP for your discipline!`,
      xpAwarded,
    };
  }

  public getActiveUserGoals(userId: string): AccountabilityGoal[] {
    return Array.from(this.goals.values()).filter((g) => g.userId === userId && g.status === 'active');
  }
}

export const accountabilityBoardService = new AccountabilityBoardService();
