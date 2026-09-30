import { dbService } from '../../database/connection.js';

export interface AnalyticsSummary {
  guildId: string;
  totalMembers: number;
  activeMembers: number;
  lifecycleDistribution: Record<string, number>;
  seniorityDistribution: Record<string, number>;
  vettingStats: {
    totalSessions: number;
    passed: number;
    failed: number;
    escalated: number;
    passRate: number;
  };
  taskStats: {
    totalSubmissions: number;
    approved: number;
    completionRate: number;
  };
  dealsStats: {
    totalDeals: number;
    completed: number;
    disputed: number;
    disputeRate: number;
  };
  funnel: {
    joined: number;
    verified: number;
    submittedFirstWork: number;
    activeDay30: number;
  };
}

export class AnalyticsService {
  public getGuildAnalytics(guildId: string): AnalyticsSummary {
    const totalMembers = dbService.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM members WHERE guild_id = ?',
      guildId
    )?.count || 0;

    const activeMembers = dbService.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM members WHERE guild_id = ? AND lifecycle_stage IN ('Active', 'Contributor', 'Leader')",
      guildId
    )?.count || 0;

    // Distribution by lifecycle stage
    const stages = dbService.all<{ lifecycle_stage: string; count: number }>(
      'SELECT lifecycle_stage, COUNT(*) as count FROM members WHERE guild_id = ? GROUP BY lifecycle_stage',
      guildId
    );
    const lifecycleDistribution: Record<string, number> = {};
    for (const s of stages) lifecycleDistribution[s.lifecycle_stage] = s.count;

    // Distribution by seniority
    const seniorities = dbService.all<{ seniority_level: string; count: number }>(
      'SELECT seniority_level, COUNT(*) as count FROM members WHERE guild_id = ? GROUP BY seniority_level',
      guildId
    );
    const seniorityDistribution: Record<string, number> = {};
    for (const s of seniorities) seniorityDistribution[s.seniority_level] = s.count;

    // Vetting metrics
    const vettingRows = dbService.all<{ status: string; count: number }>(
      'SELECT status, COUNT(*) as count FROM vetting_sessions WHERE guild_id = ? GROUP BY status',
      guildId
    );
    let totalSessions = 0;
    let passed = 0;
    let failed = 0;
    let escalated = 0;
    for (const v of vettingRows) {
      totalSessions += v.count;
      if (v.status === 'passed') passed += v.count;
      else if (v.status === 'failed') failed += v.count;
      else if (v.status === 'needs_human_review') escalated += v.count;
    }
    const passRate = totalSessions > 0 ? Math.round((passed / totalSessions) * 100) : 100;

    // Daily task completion
    const taskSubs = dbService.all<{ status: string; count: number }>(
      `SELECT ts.status, COUNT(*) as count FROM task_submissions ts
       JOIN members m ON ts.user_id = m.user_id
       WHERE m.guild_id = ? GROUP BY ts.status`,
      guildId
    );
    let totalSubmissions = 0;
    let approved = 0;
    for (const t of taskSubs) {
      totalSubmissions += t.count;
      if (t.status === 'approved') approved += t.count;
    }
    const completionRate = totalSubmissions > 0 ? Math.round((approved / totalSubmissions) * 100) : 0;

    // Deals and escrow metrics
    const dealRows = dbService.all<{ status: string; count: number }>(
      'SELECT status, COUNT(*) as count FROM deals WHERE guild_id = ? GROUP BY status',
      guildId
    );
    let totalDeals = 0;
    let completedDeals = 0;
    let disputedDeals = 0;
    for (const d of dealRows) {
      totalDeals += d.count;
      if (d.status === 'completed') completedDeals += d.count;
      else if (d.status === 'disputed') disputedDeals += d.count;
    }
    const disputeRate = totalDeals > 0 ? Math.round((disputedDeals / totalDeals) * 100) : 0;

    // Conversion funnel
    const firstWorks = dbService.get<{ count: number }>(
      "SELECT COUNT(DISTINCT user_id) as count FROM work_submissions WHERE guild_id = ? AND status = 'approved'",
      guildId
    )?.count || 0;

    return {
      guildId,
      totalMembers,
      activeMembers,
      lifecycleDistribution,
      seniorityDistribution,
      vettingStats: {
        totalSessions,
        passed,
        failed,
        escalated,
        passRate,
      },
      taskStats: {
        totalSubmissions,
        approved,
        completionRate,
      },
      dealsStats: {
        totalDeals,
        completed: completedDeals,
        disputed: disputedDeals,
        disputeRate,
      },
      funnel: {
        joined: totalMembers,
        verified: passed || totalMembers,
        submittedFirstWork: firstWorks,
        activeDay30: activeMembers,
      },
    };
  }
  public getAnalyticsSummary(guildId: string): AnalyticsSummary {
    return this.getGuildAnalytics(guildId);
  }
}

export const analyticsService = new AnalyticsService();
