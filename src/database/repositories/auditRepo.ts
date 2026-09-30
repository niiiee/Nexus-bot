import { dbService } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  id: string;
  guild_id: string;
  action_type: string;
  actor_id: string;
  target_id?: string;
  details_json: string;
  reasoning: string;
  reversible: number;
  reversed: number;
  timestamp: number;
}

export class AuditRepository {
  public log(entry: {
    guild_id: string;
    action_type: string;
    actor_id: string;
    target_id?: string;
    details: Record<string, unknown>;
    reasoning: string;
    reversible?: boolean;
  }): AuditLogEntry {
    const id = uuidv4();
    const timestamp = Date.now();
    const detailsJson = JSON.stringify(entry.details);
    const reversible = entry.reversible === false ? 0 : 1;

    dbService.run(
      `INSERT INTO audit_logs (
        id, guild_id, action_type, actor_id, target_id, details_json, reasoning, reversible, reversed, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      id,
      entry.guild_id,
      entry.action_type,
      entry.actor_id,
      entry.target_id ?? null,
      detailsJson,
      entry.reasoning,
      reversible,
      timestamp
    );

    return {
      id,
      guild_id: entry.guild_id,
      action_type: entry.action_type,
      actor_id: entry.actor_id,
      target_id: entry.target_id,
      details_json: detailsJson,
      reasoning: entry.reasoning,
      reversible,
      reversed: 0,
      timestamp,
    };
  }

  public getById(id: string): AuditLogEntry | undefined {
    return dbService.get<AuditLogEntry>('SELECT * FROM audit_logs WHERE id = ?', id);
  }

  public listRecent(guildId: string, limit: number = 50): AuditLogEntry[] {
    return dbService.all<AuditLogEntry>(
      'SELECT * FROM audit_logs WHERE guild_id = ? ORDER BY timestamp DESC LIMIT ?',
      guildId,
      limit
    );
  }

  public markReversed(id: string): boolean {
    const result = dbService.run('UPDATE audit_logs SET reversed = 1 WHERE id = ? AND reversible = 1', id);
    return Number(result.changes) > 0;
  }
}

export const auditRepo = new AuditRepository();
