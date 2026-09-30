import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface BankQuestion {
  id: string;
  field: string;
  difficulty: 'Junior' | 'Mid' | 'Senior' | 'Lead';
  questionText: string;
  rubric: string[];
  exposureCount: number;
  isLeaked: boolean;
}

export class SkillAssessmentBank {
  constructor() {
    this.seedDefaultBank();
  }

  private seedDefaultBank(): void {
    const existing = dbService.get<{ count: number }>(`SELECT count(*) as count FROM skill_bank_items`);
    if (!existing || existing.count === 0) {
      this.addQuestion({
        field: 'Fullstack TypeScript',
        difficulty: 'Senior',
        questionText: 'How do you prevent race conditions when updating shared counters in distributed Redis caches?',
        rubric: ['Mentions Redis lua scripts or WATCH/MULTI', 'Addresses network retry idempotency']
      });
      this.addQuestion({
        field: 'Frontend UI/UX',
        difficulty: 'Mid',
        questionText: 'Explain how container queries differ from media queries and when you choose one over the other.',
        rubric: ['Mentions element container size vs viewport size', 'Describes modular component design']
      });
    }
  }

  /**
   * REQ-26.211: Manage versioned skill item bank with exposure tracking and leak protection
   */
  public addQuestion(params: {
    field: string;
    difficulty: BankQuestion['difficulty'];
    questionText: string;
    rubric: string[];
  }): BankQuestion {
    const id = `qb_${cryptoRandomUUID().substring(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO skill_bank_items (
         id, field, difficulty, question_text, rubric_json, exposure_count, is_leaked, created_at
       ) VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
      id,
      params.field,
      params.difficulty,
      params.questionText,
      JSON.stringify(params.rubric),
      now
    );

    return {
      id,
      field: params.field,
      difficulty: params.difficulty,
      questionText: params.questionText,
      rubric: params.rubric,
      exposureCount: 0,
      isLeaked: false
    };
  }

  public getRotatedQuestion(field: string, difficulty: BankQuestion['difficulty']): BankQuestion | null {
    const item = dbService.get<{
      id: string;
      field: string;
      difficulty: string;
      question_text: string;
      rubric_json: string;
      exposure_count: number;
      is_leaked: number;
    }>(
      `SELECT * FROM skill_bank_items
       WHERE field = ? AND difficulty = ? AND is_leaked = 0
       ORDER BY exposure_count ASC
       LIMIT 1`,
      field,
      difficulty
    );

    if (!item) return null;

    // Increment exposure
    dbService.run(
      `UPDATE skill_bank_items SET exposure_count = exposure_count + 1 WHERE id = ?`,
      item.id
    );

    return {
      id: item.id,
      field: item.field,
      difficulty: item.difficulty as BankQuestion['difficulty'],
      questionText: item.question_text,
      rubric: JSON.parse(item.rubric_json || '[]'),
      exposureCount: item.exposure_count + 1,
      isLeaked: item.is_leaked === 1
    };
  }

  public flagQuestionLeak(questionId: string): void {
    dbService.run(`UPDATE skill_bank_items SET is_leaked = 1 WHERE id = ?`, questionId);
  }
}

export const skillAssessmentBank = new SkillAssessmentBank();
