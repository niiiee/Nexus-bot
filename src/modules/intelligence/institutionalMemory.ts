import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface MemoryRecord {
  id: string;
  tenantId: string;
  topic: string;
  approvedDecision: string;
  decidedBy: string;
  tags: string[];
  createdAt: number;
}

export class InstitutionalMemoryService {
  /**
   * REQ-26.196: Store and retrieve approved community norms with strict tenant isolation
   */
  public recordDecision(params: {
    tenantId: string;
    topic: string;
    approvedDecision: string;
    decidedBy: string;
    tags?: string[];
  }): MemoryRecord {
    const { tenantId, topic, approvedDecision, decidedBy, tags = [] } = params;
    const id = `mem_${cryptoRandomUUID().substring(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO institutional_memory_records (
         id, tenant_id, topic, approved_decision, decided_by, tags_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      tenantId,
      topic,
      approvedDecision,
      decidedBy,
      JSON.stringify(tags),
      now
    );

    return {
      id,
      tenantId,
      topic,
      approvedDecision,
      decidedBy,
      tags,
      createdAt: now
    };
  }

  public queryMemory(tenantId: string, query: string): MemoryRecord[] {
    const q = `%${query.toLowerCase()}%`;
    const rows = dbService.all<{
      id: string;
      tenant_id: string;
      topic: string;
      approved_decision: string;
      decided_by: string;
      tags_json: string;
      created_at: number;
    }>(
      `SELECT * FROM institutional_memory_records
       WHERE tenant_id = ? AND (LOWER(topic) LIKE ? OR LOWER(approved_decision) LIKE ?)
       ORDER BY created_at DESC`,
      tenantId,
      q,
      q
    );

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      topic: r.topic,
      approvedDecision: r.approved_decision,
      decidedBy: r.decided_by,
      tags: JSON.parse(r.tags_json || '[]'),
      createdAt: r.created_at
    }));
  }
}

export const institutionalMemoryService = new InstitutionalMemoryService();
