import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { SCHEMA_SQL } from './schema.js';

const logger = createLogger('Database');

export class DatabaseService {
  private db: DatabaseSync;
  private static instance: DatabaseService | null = null;

  private constructor(dbPath: string = env.DATABASE_URL) {
    if (dbPath === ':memory:') {
      logger.info('Initializing in-memory SQLite database');
      this.db = new DatabaseSync(':memory:');
    } else {
      const resolvedPath = path.resolve(process.cwd(), dbPath);
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      logger.info(`Initializing file-backed SQLite database at ${resolvedPath}`);
      this.db = new DatabaseSync(resolvedPath);
    }

    this.init();
  }

  public static getInstance(dbPath?: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath);
    }
    return DatabaseService.instance;
  }

  private init(): void {
    logger.info('Executing database schema migrations...');
    this.db.exec(SCHEMA_SQL);
    logger.info('Database schema migration complete.');
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public run(sql: string, ...params: (string | number | bigint | null | Buffer)[]): { changes: number | bigint; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  public get<T = Record<string, unknown>>(sql: string, ...params: (string | number | bigint | null | Buffer)[]): T | undefined {
    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result as T | undefined;
  }

  public all<T = Record<string, unknown>>(sql: string, ...params: (string | number | bigint | null | Buffer)[]): T[] {
    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params);
    return results as T[];
  }

  public close(): void {
    logger.info('Closing database connection.');
    this.db.close();
    DatabaseService.instance = null;
  }
}

export const dbService = DatabaseService.getInstance();
