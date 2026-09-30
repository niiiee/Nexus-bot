import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface ReminderRecord {
  id: string;
  userId: string;
  reminderType: 'payment' | 'deadline' | 'followup';
  message: string;
  dueAt: number;
  isSent: boolean;
  createdAt: number;
}

export class ReminderService {
  public addReminder(params: {
    userId: string;
    reminderType: 'payment' | 'deadline' | 'followup';
    message: string;
    dueInHours: number;
  }): ReminderRecord {
    const id = `rem_${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const dueAt = now + params.dueInHours * 60 * 60 * 1000;

    dbService.run(
      `INSERT INTO reminders (id, user_id, reminder_type, message, due_at, is_sent, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      id,
      params.userId,
      params.reminderType,
      params.message,
      dueAt,
      now
    );

    logger.info(
      'ReminderService',
      `Created ${params.reminderType} reminder ${id} for user ${params.userId} due in ${params.dueInHours}h`
    );

    return {
      id,
      userId: params.userId,
      reminderType: params.reminderType,
      message: params.message,
      dueAt,
      isSent: false,
      createdAt: now,
    };
  }

  public getDueReminders(): ReminderRecord[] {
    const now = Date.now();
    const rows = dbService.all<{
      id: string;
      user_id: string;
      reminder_type: 'payment' | 'deadline' | 'followup';
      message: string;
      due_at: number;
      is_sent: number;
      created_at: number;
    }>(
      `SELECT * FROM reminders WHERE is_sent = 0 AND due_at <= ?`,
      now
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      reminderType: r.reminder_type,
      message: r.message,
      dueAt: r.due_at,
      isSent: Boolean(r.is_sent),
      createdAt: r.created_at,
    }));
  }

  public markSent(reminderId: string): void {
    dbService.run(`UPDATE reminders SET is_sent = 1 WHERE id = ?`, reminderId);
  }

  public getUserReminders(userId: string): ReminderRecord[] {
    const rows = dbService.all<{
      id: string;
      user_id: string;
      reminder_type: 'payment' | 'deadline' | 'followup';
      message: string;
      due_at: number;
      is_sent: number;
      created_at: number;
    }>(
      `SELECT * FROM reminders WHERE user_id = ? AND is_sent = 0 ORDER BY due_at ASC`,
      userId
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      reminderType: r.reminder_type,
      message: r.message,
      dueAt: r.due_at,
      isSent: Boolean(r.is_sent),
      createdAt: r.created_at,
    }));
  }
}

export const reminderService = new ReminderService();
