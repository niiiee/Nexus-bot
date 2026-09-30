import { dbService } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface SkillTestRecord {
  id: string;
  user_id: string;
  guild_id: string;
  field: string;
  questions_json: string;
  hidden_rubric_json: string;
  timebox_minutes: number;
  expires_at: number;
  submitted_answers_json?: string | null;
  score: number;
  passed: number;
  feedback_markdown?: string | null;
  created_at: number;
  graded_at?: number | null;
}

export class TestRepository {
  public create(data: {
    user_id: string;
    guild_id: string;
    field: string;
    questions: Array<{ id: string; prompt: string; type: string }>;
    rubric: Record<string, unknown>;
    timebox_minutes?: number;
  }): SkillTestRecord {
    const id = uuidv4();
    const now = Date.now();
    const timebox = data.timebox_minutes ?? 30;
    const expiresAt = now + timebox * 60 * 1000;

    dbService.run(
      `INSERT INTO skill_tests (
        id, user_id, guild_id, field, questions_json, hidden_rubric_json,
        timebox_minutes, expires_at, score, passed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      id,
      data.user_id,
      data.guild_id,
      data.field,
      JSON.stringify(data.questions),
      JSON.stringify(data.rubric),
      timebox,
      expiresAt,
      now
    );

    return this.get(id)!;
  }

  public get(id: string): SkillTestRecord | undefined {
    return dbService.get<SkillTestRecord>('SELECT * FROM skill_tests WHERE id = ?', id);
  }

  public getActiveForUser(userId: string): SkillTestRecord | undefined {
    const now = Date.now();
    return dbService.get<SkillTestRecord>(
      'SELECT * FROM skill_tests WHERE user_id = ? AND expires_at > ? AND graded_at IS NULL ORDER BY created_at DESC LIMIT 1',
      userId,
      now
    );
  }

  public completeTest(id: string, answers: Record<string, string>, score: number, passed: boolean, feedback: string): SkillTestRecord {
    const now = Date.now();
    dbService.run(
      `UPDATE skill_tests SET
        submitted_answers_json = ?, score = ?, passed = ?, feedback_markdown = ?, graded_at = ?
      WHERE id = ?`,
      JSON.stringify(answers),
      score,
      passed ? 1 : 0,
      feedback,
      now,
      id
    );

    return this.get(id)!;
  }
}

export const testRepo = new TestRepository();
