import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface ActiveTimeSession {
  id: string;
  userId: string;
  projectName: string;
  startTime: number;
}

export interface TimeSummary {
  userId: string;
  totalDurationSeconds: number;
  totalHours: number;
  projectBreakdown: Record<string, { seconds: number; hours: number }>;
}

export class TimeTrackerService {
  private activeTimers: Map<string, ActiveTimeSession> = new Map();

  public startTimer(userId: string, projectName: string): { success: boolean; message: string; session?: ActiveTimeSession } {
    if (this.activeTimers.has(userId)) {
      const active = this.activeTimers.get(userId)!;
      return {
        success: false,
        message: `You already have an active timer running for project "${active.projectName}". Stop it first with /track stop.`,
        session: active,
      };
    }

    const id = `time_${randomUUID().slice(0, 8)}`;
    const session: ActiveTimeSession = {
      id,
      userId,
      projectName,
      startTime: Date.now(),
    };

    this.activeTimers.set(userId, session);
    logger.info('TimeTracker', `Timer started for user ${userId} on project "${projectName}"`);

    return {
      success: true,
      message: `⏱️ Timer started for project **${projectName}** at ${new Date(session.startTime).toLocaleTimeString()}!`,
      session,
    };
  }

  public stopTimer(userId: string, notes?: string): { success: boolean; message: string; durationSeconds?: number } {
    const session = this.activeTimers.get(userId);
    if (!session) {
      return {
        success: false,
        message: 'No active timer found. Start one with /track start <project_name>.',
      };
    }

    const endTime = Date.now();
    const durationSeconds = Math.max(1, Math.round((endTime - session.startTime) / 1000));

    dbService.run(
      `INSERT INTO time_entries (id, user_id, project_name, start_time, end_time, duration_seconds, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      userId,
      session.projectName,
      session.startTime,
      endTime,
      durationSeconds,
      notes || ''
    );

    this.activeTimers.delete(userId);
    const durationFormatted = this.formatDuration(durationSeconds);
    logger.info('TimeTracker', `Timer stopped for user ${userId}. Duration: ${durationFormatted}`);

    return {
      success: true,
      message: `🛑 Timer stopped for **${session.projectName}**! Logged: **${durationFormatted}**.`,
      durationSeconds,
    };
  }

  public getSummary(userId: string, days = 7): TimeSummary {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const entries = dbService.all<{
      project_name: string;
      duration_seconds: number;
    }>(
      `SELECT project_name, duration_seconds FROM time_entries 
       WHERE user_id = ? AND start_time >= ?`,
      userId,
      since
    );

    let totalDurationSeconds = 0;
    const projectBreakdown: Record<string, { seconds: number; hours: number }> = {};

    for (const e of entries) {
      totalDurationSeconds += e.duration_seconds;
      if (!projectBreakdown[e.project_name]) {
        projectBreakdown[e.project_name] = { seconds: 0, hours: 0 };
      }
      projectBreakdown[e.project_name].seconds += e.duration_seconds;
    }

    for (const k in projectBreakdown) {
      projectBreakdown[k].hours = parseFloat((projectBreakdown[k].seconds / 3600).toFixed(2));
    }

    return {
      userId,
      totalDurationSeconds,
      totalHours: parseFloat((totalDurationSeconds / 3600).toFixed(2)),
      projectBreakdown,
    };
  }

  public formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }
}

export const timeTrackerService = new TimeTrackerService();
