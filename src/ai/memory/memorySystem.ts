import { dbService } from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryFact {
  id: string;
  user_id: string;
  fact_key: string;
  fact_value: string;
  confidence: number;
  source: string;
  timestamp: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class MemorySystem {
  // Ephemeral in-memory short-term buffers (userId -> list of turns)
  private shortTermContext: Map<string, ConversationTurn[]> = new Map();
  private maxTurnsPerUser: number = 10;

  public addShortTermTurn(userId: string, role: 'user' | 'assistant', content: string): void {
    if (!this.shortTermContext.has(userId)) {
      this.shortTermContext.set(userId, []);
    }
    const turns = this.shortTermContext.get(userId)!;
    turns.push({ role, content, timestamp: Date.now() });

    if (turns.length > this.maxTurnsPerUser) {
      turns.shift(); // Evict oldest turn
    }
  }

  public getShortTermHistory(userId: string): ConversationTurn[] {
    return this.shortTermContext.get(userId) || [];
  }

  public clearShortTermHistory(userId: string): void {
    this.shortTermContext.delete(userId);
  }

  public saveFact(userId: string, key: string, value: string, confidence: number = 1.0, source: string = 'interview'): MemoryFact {
    // Prohibit storing secrets or sensitive strings
    if (key.includes('password') || key.includes('token') || key.includes('credit_card')) {
      throw new Error('Forbidden: Attempted to store sensitive credential in long-term memory');
    }

    const id = uuidv4();
    const timestamp = Date.now();

    // Check if fact already exists; update if higher or equal confidence
    const existing = dbService.get<MemoryFact>(
      'SELECT id FROM memory_facts WHERE user_id = ? AND fact_key = ?',
      userId,
      key
    );

    if (existing) {
      dbService.run(
        'UPDATE memory_facts SET fact_value = ?, confidence = ?, source = ?, timestamp = ? WHERE id = ?',
        value,
        confidence,
        source,
        timestamp,
        existing.id
      );
      return { id: existing.id, user_id: userId, fact_key: key, fact_value: value, confidence, source, timestamp };
    }

    dbService.run(
      'INSERT INTO memory_facts (id, user_id, fact_key, fact_value, confidence, source, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      userId,
      key,
      value,
      confidence,
      source,
      timestamp
    );

    return { id, user_id: userId, fact_key: key, fact_value: value, confidence, source, timestamp };
  }

  public getFactsForUser(userId: string): MemoryFact[] {
    return dbService.all<MemoryFact>('SELECT * FROM memory_facts WHERE user_id = ? ORDER BY timestamp DESC', userId);
  }

  public deleteFact(userId: string, factId: string): boolean {
    const result = dbService.run('DELETE FROM memory_facts WHERE user_id = ? AND id = ?', userId, factId);
    return Number(result.changes) > 0;
  }

  public wipeAllMemory(userId: string): void {
    this.clearShortTermHistory(userId);
    dbService.run('DELETE FROM memory_facts WHERE user_id = ?', userId);
  }
}

export const memorySystem = new MemorySystem();
