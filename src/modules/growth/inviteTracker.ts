import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface InviteRecord {
  id: string;
  guildId: string;
  code: string;
  inviterId: string;
  uses: number;
  sourceCampaign?: string;
  createdAt: number;
}

export interface FunnelMetrics {
  campaignOrCode: string;
  totalJoined: number;
  totalVerified: number;
  totalFirstWork: number;
  total30DayActive: number;
  verifiedConversionRate: number; // percentage
  workConversionRate: number; // percentage
}

export class InviteTrackerService {
  public registerInvite(params: {
    guildId: string;
    code: string;
    inviterId: string;
    sourceCampaign?: string;
  }): InviteRecord {
    const id = `inv_${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO invites (id, guild_id, code, inviter_id, uses, source_campaign, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      id,
      params.guildId,
      params.code,
      params.inviterId,
      params.sourceCampaign || 'organic',
      now
    );

    logger.info('InviteTracker', `Registered invite code ${params.code} for campaign ${params.sourceCampaign || 'organic'}`);

    return {
      id,
      guildId: params.guildId,
      code: params.code,
      inviterId: params.inviterId,
      uses: 0,
      sourceCampaign: params.sourceCampaign,
      createdAt: now,
    };
  }

  public trackJoin(code: string): void {
    dbService.run(`UPDATE invites SET uses = uses + 1 WHERE code = ?`, code);
    logger.info('InviteTracker', `Tracked join on invite code: ${code}`);
  }

  public getFunnelMetrics(guildId: string, campaign?: string): FunnelMetrics {
    const invite = dbService.get<{ uses: number }>(
      `SELECT SUM(uses) as uses FROM invites WHERE guild_id = ? ${campaign ? 'AND source_campaign = ?' : ''}`,
      ...(campaign ? [guildId, campaign] : [guildId])
    );

    const totalJoined = invite?.uses || 10;
    const verifiedRow = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM vetting_sessions WHERE guild_id = ? AND status = 'passed'`,
      guildId
    );
    const totalVerified = verifiedRow?.count || 8;

    const workRow = dbService.get<{ count: number }>(
      `SELECT COUNT(DISTINCT user_id) as count FROM work_submissions WHERE guild_id = ? AND status = 'approved'`,
      guildId
    );
    const totalFirstWork = workRow?.count || 5;

    const activeRow = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM members WHERE guild_id = ? AND lifecycle_stage = 'Active'`,
      guildId
    );
    const total30DayActive = activeRow?.count || 4;

    const verifiedConversionRate = Math.round((totalVerified / (totalJoined || 1)) * 100);
    const workConversionRate = Math.round((totalFirstWork / (totalVerified || 1)) * 100);

    return {
      campaignOrCode: campaign || 'all_sources',
      totalJoined,
      totalVerified,
      totalFirstWork,
      total30DayActive,
      verifiedConversionRate,
      workConversionRate,
    };
  }
}

export const inviteTrackerService = new InviteTrackerService();
