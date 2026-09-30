import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface JobListing {
  id: string;
  guildId: string;
  posterId: string;
  title: string;
  budgetRange: string;
  deadline: string;
  requiredSkills: string[];
  description: string;
  status: 'open' | 'filled' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export class JobBoardService {
  public postJob(params: {
    guildId: string;
    posterId: string;
    title: string;
    budgetRange: string;
    deadline: string;
    requiredSkills: string[];
    description: string;
    durationDays?: number;
  }): JobListing {
    const id = `job_${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const durationDays = params.durationDays || 14;
    const expiresAt = now + durationDays * 24 * 60 * 60 * 1000;

    dbService.run(
      `INSERT INTO jobs (id, guild_id, poster_id, title, budget_range, deadline, required_skills, description, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      id,
      params.guildId,
      params.posterId,
      params.title,
      params.budgetRange,
      params.deadline,
      JSON.stringify(params.requiredSkills),
      params.description,
      now,
      expiresAt
    );

    logger.info('JobBoard', `Job listing posted: ${params.title} (${id})`);

    return {
      id,
      guildId: params.guildId,
      posterId: params.posterId,
      title: params.title,
      budgetRange: params.budgetRange,
      deadline: params.deadline,
      requiredSkills: params.requiredSkills,
      description: params.description,
      status: 'open',
      createdAt: now,
      expiresAt,
    };
  }

  public getActiveJobs(guildId: string, skillFilter?: string): JobListing[] {
    const now = Date.now();
    this.cleanExpiredJobs(guildId);

    const rows = dbService.all<{
      id: string;
      guild_id: string;
      poster_id: string;
      title: string;
      budget_range: string;
      deadline: string;
      required_skills: string;
      description: string;
      status: 'open' | 'filled' | 'expired';
      created_at: number;
      expires_at: number;
    }>(
      `SELECT * FROM jobs WHERE guild_id = ? AND status = 'open' AND expires_at > ? ORDER BY created_at DESC`,
      guildId,
      now
    );

    const jobs: JobListing[] = rows.map((r) => ({
      id: r.id,
      guildId: r.guild_id,
      posterId: r.poster_id,
      title: r.title,
      budgetRange: r.budget_range,
      deadline: r.deadline,
      requiredSkills: JSON.parse(r.required_skills || '[]'),
      description: r.description,
      status: r.status,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    }));

    if (skillFilter) {
      const lower = skillFilter.toLowerCase();
      return jobs.filter((j) => j.requiredSkills.some((s) => s.toLowerCase().includes(lower)));
    }

    return jobs;
  }

  public cleanExpiredJobs(guildId: string): number {
    const now = Date.now();
    const result = dbService.run(
      `UPDATE jobs SET status = 'expired' WHERE guild_id = ? AND status = 'open' AND expires_at <= ?`,
      guildId,
      now
    );
    return Number(result.changes);
  }

  public generateJobEmbed(job: JobListing, lang: 'en' | 'ar' = 'en') {
    const isAr = lang === 'ar';
    return {
      title: isAr ? `💼 فرصة عمل جديدة: ${job.title}` : `💼 New Opportunity: ${job.title}`,
      description: job.description,
      color: 0x3b82f6,
      fields: [
        {
          name: isAr ? '💰 الميزانية' : '💰 Budget',
          value: job.budgetRange,
          inline: true,
        },
        {
          name: isAr ? '⏰ الموعد النهائي' : '⏰ Deadline',
          value: job.deadline,
          inline: true,
        },
        {
          name: isAr ? '🛠 المهارات المطلوبة' : '🛠 Required Skills',
          value: job.requiredSkills.map((s) => `\`${s}\``).join(', ') || (isAr ? 'غير محدد' : 'General'),
          inline: false,
        },
      ],
      footer: {
        text: isAr
          ? `رقم الوظيفة: ${job.id} | تنتهي في ${new Date(job.expiresAt).toLocaleDateString()}`
          : `Job ID: ${job.id} | Expires: ${new Date(job.expiresAt).toLocaleDateString()}`,
      },
    };
  }
}

export const jobBoardService = new JobBoardService();
