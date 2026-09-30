import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface WorkshopRecord {
  id: string;
  guildId: string;
  title: string;
  hostId: string;
  scheduledTime: number;
  attendees: string[]; // user IDs
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  createdAt: number;
}

export interface WorkshopQuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export class WorkshopManagerService {
  /**
   * Schedules a new technical or design workshop.
   */
  public scheduleWorkshop(params: {
    guildId: string;
    title: string;
    hostId: string;
    scheduledTime: number;
  }): WorkshopRecord {
    const id = cryptoRandomUUID();
    const createdAt = Date.now();

    dbService.run(
      `INSERT INTO workshops (id, guild_id, title, host_id, scheduled_time, attendees_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, '[]', 'scheduled', ?)`,
      id,
      params.guildId,
      params.title,
      params.hostId,
      params.scheduledTime,
      createdAt
    );

    logger.info(`[WorkshopManager] Scheduled workshop "${params.title}" at ${new Date(params.scheduledTime).toISOString()}`);

    return {
      id,
      guildId: params.guildId,
      title: params.title,
      hostId: params.hostId,
      scheduledTime: params.scheduledTime,
      attendees: [],
      status: 'scheduled',
      createdAt,
    };
  }

  /**
   * Adds or removes RSVP registration for a member.
   */
  public toggleRSVP(workshopId: string, userId: string): { rsvpActive: boolean; count: number } {
    const workshop = dbService.get<{ attendees_json: string }>(
      `SELECT attendees_json FROM workshops WHERE id = ?`,
      workshopId
    );

    if (!workshop) {
      return { rsvpActive: false, count: 0 };
    }

    let attendees: string[] = [];
    try {
      attendees = JSON.parse(workshop.attendees_json);
    } catch {
      attendees = [];
    }

    const index = attendees.indexOf(userId);
    let rsvpActive = false;

    if (index >= 0) {
      attendees.splice(index, 1);
      rsvpActive = false;
    } else {
      attendees.push(userId);
      rsvpActive = true;
    }

    dbService.run(
      `UPDATE workshops SET attendees_json = ? WHERE id = ?`,
      JSON.stringify(attendees),
      workshopId
    );

    return { rsvpActive, count: attendees.length };
  }

  /**
   * Generates countdown broadcast messages (e.g. 1 hour or 15 minutes before).
   */
  public formatCountdownAnnouncement(workshop: WorkshopRecord, minutesRemaining: number, locale: 'ar' | 'en' = 'ar'): string {
    const isAr = locale === 'ar';
    if (isAr) {
      return (
        `⏰ **تذكير ببدء ورشة العمل: ${workshop.title}** 🎙️\n` +
        `الورشة ستبدأ خلال **${minutesRemaining} دقيقة** في الروم الصوتي!\n` +
        `المحاضر: <@${workshop.hostId}> | المسجلين: ${workshop.attendees.length} عضو.\n` +
        `جهز أدواتك وانضم للروم الصوتي للاستفادة! 🚀`
      );
    }
    return (
      `⏰ **Workshop Reminder: ${workshop.title}** 🎙️\n` +
      `The workshop begins in **${minutesRemaining} minutes** in the voice stage!\n` +
      `Host: <@${workshop.hostId}> | RSVPs: ${workshop.attendees.length} members.\n` +
      `Join early and get ready to learn! 🚀`
    );
  }

  /**
   * Marks workshop as live or completed.
   */
  public updateStatus(workshopId: string, status: 'scheduled' | 'live' | 'completed' | 'cancelled'): boolean {
    const res = dbService.run(`UPDATE workshops SET status = ? WHERE id = ?`, status, workshopId);
    return Number(res.changes) > 0;
  }

  /**
   * Evaluates post-session quiz answers and rewards XP.
   */
  public gradePostSessionQuiz(
    userId: string,
    guildId: string,
    workshopId: string,
    userAnswers: number[],
    quizQuestions: WorkshopQuizQuestion[]
  ): { score: number; total: number; passed: boolean; xpEarned: number } {
    let score = 0;
    for (let i = 0; i < quizQuestions.length; i++) {
      if (userAnswers[i] === quizQuestions[i].correctAnswerIndex) {
        score++;
      }
    }

    const total = quizQuestions.length;
    const passed = score >= Math.ceil(total * 0.6); // 60%+ pass
    const xpEarned = score * 50;

    if (xpEarned > 0) {
      dbService.run(
        `UPDATE members SET xp = xp + ? WHERE user_id = ? AND guild_id = ?`,
        xpEarned,
        userId,
        guildId
      );
      logger.info(`[WorkshopManager] User ${userId} scored ${score}/${total} on workshop ${workshopId} quiz, earned ${xpEarned} XP`);
    }

    return {
      score,
      total,
      passed,
      xpEarned,
    };
  }
}

export const workshopManagerService = new WorkshopManagerService();
