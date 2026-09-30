import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface FederatedBlocklistEntry {
  id: string;
  targetId: string;
  reason: string;
  evidenceSha256: string;
  originatingCommunity: string;
  status: 'active' | 'appealed' | 'revoked';
  createdAt: number;
}

export class FederatedBlocklistManager {
  /**
   * REQ-26.283: Opt-in federated blocklist sharing requiring evidence hashes and universal appeals
   */
  public addEntry(params: {
    targetId: string;
    reason: string;
    evidenceSha256: string;
    originatingCommunity: string;
  }): FederatedBlocklistEntry {
    const id = `fblk_${cryptoRandomUUID().substring(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO federated_blocklist_entries (
         id, target_id, reason, evidence_sha256, originating_community, status, created_at
       ) VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      id,
      params.targetId,
      params.reason,
      params.evidenceSha256,
      params.originatingCommunity,
      now
    );

    return {
      id,
      targetId: params.targetId,
      reason: params.reason,
      evidenceSha256: params.evidenceSha256,
      originatingCommunity: params.originatingCommunity,
      status: 'active',
      createdAt: now
    };
  }

  public checkTarget(targetId: string): { isFlagged: boolean; entry?: FederatedBlocklistEntry } {
    const row = dbService.get<{
      id: string;
      target_id: string;
      reason: string;
      evidence_sha256: string;
      originating_community: string;
      status: string;
      created_at: number;
    }>(
      `SELECT * FROM federated_blocklist_entries WHERE target_id = ? AND status = 'active'`,
      targetId
    );

    if (!row) return { isFlagged: false };

    return {
      isFlagged: true,
      entry: {
        id: row.id,
        targetId: row.target_id,
        reason: row.reason,
        evidenceSha256: row.evidence_sha256,
        originatingCommunity: row.originating_community,
        status: row.status as FederatedBlocklistEntry['status'],
        createdAt: row.created_at
      }
    };
  }

  public submitBlocklistAppeal(entryId: string, appealReason: string): boolean {
    dbService.run(
      `UPDATE federated_blocklist_entries SET status = 'appealed' WHERE id = ?`,
      entryId
    );
    return true;
  }
}

export const federatedBlocklistManager = new FederatedBlocklistManager();
