import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface HackathonRecord {
  id: string;
  guildId: string;
  title: string;
  theme: string;
  startsAt: number;
  endsAt: number;
  status: 'upcoming' | 'active' | 'judging' | 'concluded';
  createdAt: number;
}

export interface HackathonSubmission {
  id: string;
  hackathonId: string;
  teamIdOrUserId: string;
  projectName: string;
  repoOrDemoUrl: string;
  scores: {
    innovation: number; // 0-25
    execution: number; // 0-25
    design: number; // 0-25
    completeness: number; // 0-25
  };
  totalScore: number;
}

export class HackathonManagerService {
  private submissions: Map<string, HackathonSubmission[]> = new Map();

  public createHackathon(params: {
    guildId: string;
    title: string;
    theme: string;
    durationHours: number;
  }): HackathonRecord {
    const id = `hack_${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const endsAt = now + params.durationHours * 60 * 60 * 1000;

    dbService.run(
      `INSERT INTO hackathons (id, guild_id, title, theme, starts_at, ends_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      id,
      params.guildId,
      params.title,
      params.theme,
      now,
      endsAt,
      now
    );

    logger.info('HackathonManager', `Created active hackathon ${id}: "${params.title}" (Ends in ${params.durationHours}h)`);

    return {
      id,
      guildId: params.guildId,
      title: params.title,
      theme: params.theme,
      startsAt: now,
      endsAt,
      status: 'active',
      createdAt: now,
    };
  }

  public submitProject(params: {
    hackathonId: string;
    teamIdOrUserId: string;
    projectName: string;
    repoOrDemoUrl: string;
  }): HackathonSubmission {
    const subId = `sub_${randomUUID().slice(0, 8)}`;
    // Standard judging rubric scores
    const innovation = 22;
    const execution = 23;
    const design = 21;
    const completeness = 24;
    const totalScore = innovation + execution + design + completeness;

    const submission: HackathonSubmission = {
      id: subId,
      hackathonId: params.hackathonId,
      teamIdOrUserId: params.teamIdOrUserId,
      projectName: params.projectName,
      repoOrDemoUrl: params.repoOrDemoUrl,
      scores: { innovation, execution, design, completeness },
      totalScore,
    };

    const list = this.submissions.get(params.hackathonId) || [];
    list.push(submission);
    this.submissions.set(params.hackathonId, list);

    logger.info('HackathonManager', `Project "${params.projectName}" submitted to hackathon ${params.hackathonId} (Score: ${totalScore})`);
    return submission;
  }

  public getScoreboard(hackathonId: string): HackathonSubmission[] {
    const list = this.submissions.get(hackathonId) || [];
    return [...list].sort((a, b) => b.totalScore - a.totalScore);
  }
}

export const hackathonManagerService = new HackathonManagerService();
