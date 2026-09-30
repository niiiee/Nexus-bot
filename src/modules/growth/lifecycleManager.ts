import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export type LifecycleStage = 'Newcomer' | 'Active' | 'Contributor' | 'Leader' | 'Dormant' | 'Churned';

export class LifecycleManagerService {
  public evaluateLifecycleStage(params: {
    daysSinceJoined: number;
    daysSinceLastActive: number;
    reputationScore: number;
    verifiedTasksOrProjects: number;
    isMentorOrSquadLead?: boolean;
  }): LifecycleStage {
    if (params.daysSinceLastActive > 45) return 'Churned';
    if (params.daysSinceLastActive >= 14) return 'Dormant';

    if (params.reputationScore >= 200 || params.isMentorOrSquadLead) {
      return 'Leader';
    }

    if (params.verifiedTasksOrProjects >= 3) {
      return 'Contributor';
    }

    if (params.daysSinceJoined > 7) {
      return 'Active';
    }

    return 'Newcomer';
  }

  public updateMemberLifecycle(userId: string, guildId: string): LifecycleStage {
    const member = dbService.get<{
      created_at: number;
      reputation_score: number;
      lifecycle_stage: LifecycleStage;
    }>(
      `SELECT created_at, reputation_score, lifecycle_stage FROM members WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );

    if (!member) return 'Newcomer';

    const now = Date.now();
    const daysSinceJoined = Math.floor((now - member.created_at) / (24 * 60 * 60 * 1000));

    const submissionsCount = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_submissions WHERE user_id = ? AND status = 'approved'`,
      userId
    )?.count || 0;

    const newStage = this.evaluateLifecycleStage({
      daysSinceJoined,
      daysSinceLastActive: 1, // actively called
      reputationScore: member.reputation_score,
      verifiedTasksOrProjects: submissionsCount,
    });

    if (newStage !== member.lifecycle_stage) {
      dbService.run(
        `UPDATE members SET lifecycle_stage = ? WHERE user_id = ? AND guild_id = ?`,
        newStage,
        userId,
        guildId
      );
      logger.info('LifecycleManager', `Member ${userId} progressed from ${member.lifecycle_stage} to ${newStage}`);
    }

    return newStage;
  }
}

export const lifecycleManagerService = new LifecycleManagerService();
