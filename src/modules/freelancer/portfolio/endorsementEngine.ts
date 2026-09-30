import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface EndorsementResult {
  success: boolean;
  message: string;
  isRingDetected: boolean;
  cycle?: string[];
}

export class EndorsementEngine {
  public endorseMember(params: {
    giverId: string;
    receiverId: string;
    guildId: string;
    skill: string;
  }): EndorsementResult {
    if (params.giverId === params.receiverId) {
      return {
        success: false,
        message: 'You cannot endorse yourself, ya basha!',
        isRingDetected: false,
      };
    }

    // Check if giver already endorsed receiver for this exact skill
    const existing = dbService.get<{ id: string }>(
      `SELECT id FROM endorsements WHERE giver_id = ? AND receiver_id = ? AND skill = ? AND guild_id = ?`,
      params.giverId,
      params.receiverId,
      params.skill,
      params.guildId
    );

    if (existing) {
      return {
        success: false,
        message: 'You have already endorsed this member for this skill.',
        isRingDetected: false,
      };
    }

    // Graph analysis: check for collusive cycles before committing
    const ringCheck = this.detectCollusionRing(params.giverId, params.receiverId, params.guildId);

    const id = `end_${randomUUID().slice(0, 8)}`;
    dbService.run(
      `INSERT INTO endorsements (id, giver_id, receiver_id, guild_id, skill, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      params.giverId,
      params.receiverId,
      params.guildId,
      params.skill,
      Date.now()
    );

    if (ringCheck.isRing) {
      logger.warn(
        'EndorsementEngine',
        `Collusive endorsement cycle detected between [${ringCheck.cycle.join(' -> ')}]`
      );
      return {
        success: true,
        message: 'Endorsement recorded, but flagged for staff audit due to circular endorsement pattern.',
        isRingDetected: true,
        cycle: ringCheck.cycle,
      };
    }

    logger.info(
      'EndorsementEngine',
      `Endorsement recorded: ${params.giverId} endorsed ${params.receiverId} for ${params.skill}`
    );

    return {
      success: true,
      message: `Successfully endorsed for "${params.skill}"!`,
      isRingDetected: false,
    };
  }

  public detectCollusionRing(
    giverId: string,
    receiverId: string,
    guildId: string
  ): { isRing: boolean; cycle: string[] } {
    // Look for path from receiverId back to giverId in the endorsement graph
    // Directed graph where edge U -> V means U endorsed V
    const rows = dbService.all<{ giver_id: string; receiver_id: string }>(
      `SELECT giver_id, receiver_id FROM endorsements WHERE guild_id = ?`,
      guildId
    );

    const adj = new Map<string, string[]>();
    for (const r of rows) {
      const list = adj.get(r.giver_id) || [];
      list.push(r.receiver_id);
      adj.set(r.giver_id, list);
    }

    // Direct mutual endorsement check: receiverId already endorsed giverId
    const receiverEndorsements = adj.get(receiverId) || [];
    if (receiverEndorsements.includes(giverId)) {
      return { isRing: true, cycle: [giverId, receiverId, giverId] };
    }

    // BFS for 3-node or 4-node cycles (e.g. A -> B -> C -> A)
    const queue: Array<{ current: string; path: string[] }> = [{ current: receiverId, path: [giverId, receiverId] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      if (path.length > 4) continue; // limit depth to avoid deep traversals

      const neighbors = adj.get(current) || [];
      for (const next of neighbors) {
        if (next === giverId) {
          return { isRing: true, cycle: [...path, giverId] };
        }
        if (!visited.has(next)) {
          visited.add(next);
          queue.push({ current: next, path: [...path, next] });
        }
      }
    }

    return { isRing: false, cycle: [] };
  }
}

export const endorsementEngine = new EndorsementEngine();
