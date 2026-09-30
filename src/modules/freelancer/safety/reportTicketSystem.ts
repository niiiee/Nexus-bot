import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface ReportTicket {
  id: string;
  guildId: string;
  reporterId: string;
  targetId: string;
  reason: string;
  evidenceUrls: string[];
  status: 'pending' | 'under_investigation' | 'resolved' | 'dismissed';
  staffAction?: string;
  createdAt: number;
  resolvedAt?: number;
}

export class ReportTicketSystem {
  public fileReport(params: {
    guildId: string;
    reporterId: string;
    targetId: string;
    reason: string;
    evidenceUrls?: string[];
  }): ReportTicket {
    const id = `rep_${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const evidenceUrls = params.evidenceUrls || [];

    dbService.run(
      `INSERT INTO reports (id, guild_id, reporter_id, target_id, reason, evidence_urls, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      id,
      params.guildId,
      params.reporterId,
      params.targetId,
      params.reason,
      JSON.stringify(evidenceUrls),
      now
    );

    logger.info('ReportTicketSystem', `Report filed ${id} by ${params.reporterId} against ${params.targetId}`);

    return {
      id,
      guildId: params.guildId,
      reporterId: params.reporterId,
      targetId: params.targetId,
      reason: params.reason,
      evidenceUrls,
      status: 'pending',
      createdAt: now,
    };
  }

  public resolveReport(
    reportId: string,
    staffAction: 'warn' | 'mute' | 'ban' | 'dismissed',
    notes: string
  ): boolean {
    const now = Date.now();
    const status = staffAction === 'dismissed' ? 'dismissed' : 'resolved';
    const actionDetails = `${staffAction.toUpperCase()}: ${notes}`;

    const res = dbService.run(
      `UPDATE reports SET status = ?, staff_action = ?, resolved_at = ? WHERE id = ?`,
      status,
      actionDetails,
      now,
      reportId
    );

    logger.info('ReportTicketSystem', `Report ${reportId} resolved with action ${staffAction}`);
    return res.changes > 0;
  }

  public getPendingReports(guildId: string): ReportTicket[] {
    const rows = dbService.all<{
      id: string;
      guild_id: string;
      reporter_id: string;
      target_id: string;
      reason: string;
      evidence_urls: string;
      status: 'pending' | 'under_investigation' | 'resolved' | 'dismissed';
      staff_action: string | null;
      created_at: number;
      resolved_at: number | null;
    }>(
      `SELECT * FROM reports WHERE guild_id = ? AND status = 'pending' ORDER BY created_at ASC`,
      guildId
    );

    return rows.map((r) => ({
      id: r.id,
      guildId: r.guild_id,
      reporterId: r.reporter_id,
      targetId: r.target_id,
      reason: r.reason,
      evidenceUrls: JSON.parse(r.evidence_urls || '[]'),
      status: r.status,
      staffAction: r.staff_action || undefined,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at || undefined,
    }));
  }
}

export const reportTicketSystem = new ReportTicketSystem();
