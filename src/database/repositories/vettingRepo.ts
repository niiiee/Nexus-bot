import { dbService } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface VettingSessionRecord {
  id: string;
  user_id: string;
  guild_id: string;
  field: string;
  claimed_years: number;
  questions_json: string;
  answers_json: string;
  suspicion_score: number;
  status: 'in_progress' | 'passed' | 'failed' | 'needs_human_review';
  escalation_case_id?: string | null;
  created_at: number;
  completed_at?: number | null;
}

export class VettingRepository {
  public create(data: {
    user_id: string;
    guild_id: string;
    field: string;
    claimed_years: number;
    initial_questions: string[];
  }): VettingSessionRecord {
    const id = uuidv4();
    const now = Date.now();
    const questionsJson = JSON.stringify(data.initial_questions);
    const answersJson = JSON.stringify([]);

    dbService.run(
      `INSERT INTO vetting_sessions (
        id, user_id, guild_id, field, claimed_years, questions_json, answers_json,
        suspicion_score, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, 'in_progress', ?)`,
      id,
      data.user_id,
      data.guild_id,
      data.field,
      data.claimed_years,
      questionsJson,
      answersJson,
      now
    );

    return this.get(id)!;
  }

  public get(id: string): VettingSessionRecord | undefined {
    return dbService.get<VettingSessionRecord>('SELECT * FROM vetting_sessions WHERE id = ?', id);
  }

  public getLatestForUser(userId: string): VettingSessionRecord | undefined {
    return dbService.get<VettingSessionRecord>(
      'SELECT * FROM vetting_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      userId
    );
  }

  public update(id: string, partial: Partial<Omit<VettingSessionRecord, 'id' | 'created_at'>>): VettingSessionRecord {
    const keys = Object.keys(partial);
    if (keys.length === 0) return this.get(id)!;

    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(partial), id];

    dbService.run(`UPDATE vetting_sessions SET ${setClauses} WHERE id = ?`, ...values as (string | number | null)[]);
    return this.get(id)!;
  }

  public getAllPastQuestionsForUser(userId: string): string[] {
    const sessions = dbService.all<{ questions_json: string }>(
      'SELECT questions_json FROM vetting_sessions WHERE user_id = ?',
      userId
    );
    const questions: string[] = [];
    for (const s of sessions) {
      try {
        const parsed = JSON.parse(s.questions_json);
        if (Array.isArray(parsed)) questions.push(...parsed);
      } catch {}
    }
    return questions;
  }
}

export const vettingRepo = new VettingRepository();
