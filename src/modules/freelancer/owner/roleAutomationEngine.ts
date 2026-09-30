import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface RoleRule {
  id: string;
  guildId: string;
  targetRoleId: string;
  conditionType: 'reputation' | 'verified_projects' | 'tasks_completed' | 'clean_deals';
  threshold: number;
}

export class RoleAutomationEngine {
  public addRule(params: {
    guildId: string;
    targetRoleId: string;
    conditionType: 'reputation' | 'verified_projects' | 'tasks_completed' | 'clean_deals';
    threshold: number;
  }): RoleRule {
    const id = `rule_${randomUUID().slice(0, 8)}`;

    dbService.run(
      `INSERT INTO role_rules (id, guild_id, target_role_id, condition_type, threshold, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      params.guildId,
      params.targetRoleId,
      params.conditionType,
      params.threshold,
      Date.now()
    );

    logger.info('RoleAutomation', `Added role automation rule ${id}: Grant ${params.targetRoleId} when ${params.conditionType} >= ${params.threshold}`);

    return {
      id,
      guildId: params.guildId,
      targetRoleId: params.targetRoleId,
      conditionType: params.conditionType,
      threshold: params.threshold,
    };
  }

  public evaluateMemberRules(userId: string, guildId: string): string[] {
    const rules = dbService.all<{
      target_role_id: string;
      condition_type: 'reputation' | 'verified_projects' | 'tasks_completed' | 'clean_deals';
      threshold: number;
    }>(`SELECT target_role_id, condition_type, threshold FROM role_rules WHERE guild_id = ?`, guildId);

    if (rules.length === 0) return [];

    const member = dbService.get<{ reputation_score: number }>(
      `SELECT reputation_score FROM members WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );
    const verifiedProjects = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM work_submissions WHERE user_id = ? AND guild_id = ? AND status = 'approved'`,
      userId,
      guildId
    )?.count || 0;
    const tasksCompleted = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_submissions WHERE user_id = ? AND status = 'approved'`,
      userId
    )?.count || 0;
    const cleanDeals = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM deals WHERE guild_id = ? AND (freelancer_id = ? OR client_id = ?) AND status = 'completed'`,
      guildId,
      userId,
      userId
    )?.count || 0;

    const rolesToGrant: string[] = [];

    for (const r of rules) {
      let satisfies = false;
      if (r.condition_type === 'reputation') {
        satisfies = (member?.reputation_score || 0) >= r.threshold;
      } else if (r.condition_type === 'verified_projects') {
        satisfies = verifiedProjects >= r.threshold;
      } else if (r.condition_type === 'tasks_completed') {
        satisfies = tasksCompleted >= r.threshold;
      } else if (r.condition_type === 'clean_deals') {
        satisfies = cleanDeals >= r.threshold;
      }

      if (satisfies) {
        rolesToGrant.push(r.target_role_id);
      }
    }

    return rolesToGrant;
  }
}

export const roleAutomationEngine = new RoleAutomationEngine();
