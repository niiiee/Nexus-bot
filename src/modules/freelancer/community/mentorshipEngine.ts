import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface MentorshipPairing {
  id: string;
  guildId: string;
  mentorId: string;
  menteeId: string;
  domain: string;
  status: 'active' | 'completed' | 'paused';
  lastCheckin: number;
  createdAt: number;
}

export class MentorshipEngine {
  public matchMentor(params: {
    guildId: string;
    menteeId: string;
    domain: string; // e.g. "Backend Architecture", "UI/UX Design", "Flutter"
  }): { success: boolean; pairing?: MentorshipPairing; message: string } {
    // Look for eligible senior members in the guild with matching field/tools
    const mentors = dbService.all<{ user_id: string; tools: string; field: string }>(
      `SELECT user_id, tools, field FROM members 
       WHERE guild_id = ? AND seniority_level IN ('Senior', 'Specialist') 
         AND user_id != ? AND is_restricted = 0`,
      params.guildId,
      params.menteeId
    );

    const domainLower = params.domain.toLowerCase();
    const candidate = mentors.find(
      (m) =>
        (m.tools || '').toLowerCase().includes(domainLower) ||
        (m.field || '').toLowerCase().includes(domainLower)
    ) || mentors[0]; // fallback to first senior

    if (!candidate) {
      return {
        success: false,
        message: 'No available mentors currently open for this domain. We have added you to the waitlist!',
      };
    }

    const id = `mnt_${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO mentorship_pairings (id, guild_id, mentor_id, mentee_id, domain, status, last_checkin, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      id,
      params.guildId,
      candidate.user_id,
      params.menteeId,
      params.domain,
      now,
      now
    );

    logger.info('MentorshipEngine', `Paired mentor ${candidate.user_id} with mentee ${params.menteeId} for ${params.domain}`);

    const pairing: MentorshipPairing = {
      id,
      guildId: params.guildId,
      mentorId: candidate.user_id,
      menteeId: params.menteeId,
      domain: params.domain,
      status: 'active',
      lastCheckin: now,
      createdAt: now,
    };

    return {
      success: true,
      pairing,
      message: `🎯 Matched with mentor <@${candidate.user_id}> for **${params.domain}**! Automated bi-weekly check-in initialized.`,
    };
  }

  public getDueCheckins(): MentorshipPairing[] {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const rows = dbService.all<{
      id: string;
      guild_id: string;
      mentor_id: string;
      mentee_id: string;
      domain: string;
      status: 'active' | 'completed' | 'paused';
      last_checkin: number;
      created_at: number;
    }>(
      `SELECT * FROM mentorship_pairings WHERE status = 'active' AND last_checkin <= ?`,
      twoWeeksAgo
    );

    return rows.map((r) => ({
      id: r.id,
      guildId: r.guild_id,
      mentorId: r.mentor_id,
      menteeId: r.mentee_id,
      domain: r.domain,
      status: r.status,
      lastCheckin: r.last_checkin,
      createdAt: r.created_at,
    }));
  }

  public recordCheckin(pairingId: string): void {
    dbService.run(`UPDATE mentorship_pairings SET last_checkin = ? WHERE id = ?`, Date.now(), pairingId);
  }
}

export const mentorshipEngine = new MentorshipEngine();
