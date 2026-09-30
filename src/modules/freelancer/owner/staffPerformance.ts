import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';

export interface StaffPerformanceRecord {
  staffId: string;
  reportsResolved: number;
  avgResolutionTimeHours: number;
  reviewsConducted: number;
  auditActionsCount: number;
}

export class StaffPerformanceService {
  public getStaffStats(guildId: string): StaffPerformanceRecord[] {
    const auditRows = dbService.all<{ actor_id: string; count: number }>(
      `SELECT actor_id, COUNT(*) as count FROM audit_logs WHERE guild_id = ? GROUP BY actor_id`,
      guildId
    );

    const reports = dbService.all<{
      staff_action: string;
      created_at: number;
      resolved_at: number;
    }>(
      `SELECT staff_action, created_at, resolved_at FROM reports 
       WHERE guild_id = ? AND status = 'resolved' AND resolved_at IS NOT NULL`,
      guildId
    );

    let totalDurationMs = 0;
    for (const r of reports) {
      totalDurationMs += (r.resolved_at - r.created_at);
    }

    const avgResolutionHours = reports.length > 0 ? parseFloat((totalDurationMs / (reports.length * 3600 * 1000)).toFixed(2)) : 0;

    const records: StaffPerformanceRecord[] = auditRows.map((a) => ({
      staffId: a.actor_id,
      reportsResolved: reports.length,
      avgResolutionTimeHours: avgResolutionHours,
      reviewsConducted: a.count,
      auditActionsCount: a.count,
    }));

    logger.info('StaffPerformance', `Calculated staff performance metrics for ${records.length} staff members`);
    return records;
  }
}

export const staffPerformanceService = new StaffPerformanceService();
