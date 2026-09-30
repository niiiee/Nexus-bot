import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface SquadRecord {
  id: string;
  guildId: string;
  name: string;
  leaderId: string;
  points: number;
  channelId?: string;
  createdAt: number;
  membersCount?: number;
}

export class SquadManagerService {
  private maxSquadCapacity = 8;
  private minLeaderReputation = 50;

  /**
   * Creates a new freelance / developer squad.
   */
  public createSquad(guildId: string, leaderId: string, squadName: string): {
    success: boolean;
    squad?: SquadRecord;
    error?: string;
  } {
    // 1. Check if user is already in a squad
    const existingMembership = dbService.get<{ squad_id: string }>(
      `SELECT s.id as squad_id FROM squads s 
       JOIN squad_members sm ON s.id = sm.squad_id 
       WHERE s.guild_id = ? AND sm.user_id = ?`,
      guildId,
      leaderId
    );

    if (existingMembership) {
      return { success: false, error: 'You are already a member of a squad' };
    }

    // 2. Check reputation requirement
    const member = dbService.get<{ reputation_score: number }>(
      `SELECT reputation_score FROM members WHERE user_id = ? AND guild_id = ?`,
      leaderId,
      guildId
    );

    if (!member || member.reputation_score < this.minLeaderReputation) {
      return {
        success: false,
        error: `Squad leaders require at least ${this.minLeaderReputation} reputation points`,
      };
    }

    // 3. Check name uniqueness
    const nameTaken = dbService.get<{ id: string }>(
      `SELECT id FROM squads WHERE guild_id = ? AND LOWER(name) = LOWER(?)`,
      guildId,
      squadName.trim()
    );

    if (nameTaken) {
      return { success: false, error: 'A squad with this name already exists' };
    }

    const id = cryptoRandomUUID();
    const createdAt = Date.now();

    try {
      dbService.transaction(() => {
        dbService.run(
          `INSERT INTO squads (id, guild_id, name, leader_id, points, created_at)
           VALUES (?, ?, ?, ?, 0, ?)`,
          id,
          guildId,
          squadName.trim(),
          leaderId,
          createdAt
        );

        dbService.run(
          `INSERT INTO squad_members (squad_id, user_id, role, joined_at)
           VALUES (?, ?, 'leader', ?)`,
          id,
          leaderId,
          createdAt
        );
      });

      logger.info(`[SquadManager] Squad "${squadName}" created by ${leaderId}`);

      return {
        success: true,
        squad: {
          id,
          guildId,
          name: squadName.trim(),
          leaderId,
          points: 0,
          createdAt,
          membersCount: 1,
        },
      };
    } catch (err) {
      logger.error(`[SquadManager] Error creating squad:`, err);
      return { success: false, error: 'Failed to create squad' };
    }
  }

  /**
   * Adds a member to an existing squad.
   */
  public joinSquad(guildId: string, squadId: string, userId: string): { success: boolean; error?: string } {
    const squad = dbService.get<{ id: string; guild_id: string }>(
      `SELECT id, guild_id FROM squads WHERE id = ? AND guild_id = ?`,
      squadId,
      guildId
    );

    if (!squad) {
      return { success: false, error: 'Squad not found' };
    }

    // Check capacity
    const memberCount = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM squad_members WHERE squad_id = ?`,
      squadId
    )?.count || 0;

    if (memberCount >= this.maxSquadCapacity) {
      return { success: false, error: `Squad is full (maximum ${this.maxSquadCapacity} members)` };
    }

    // Check if user is already in a squad
    const existing = dbService.get<{ squad_id: string }>(
      `SELECT s.id as squad_id FROM squads s 
       JOIN squad_members sm ON s.id = sm.squad_id 
       WHERE s.guild_id = ? AND sm.user_id = ?`,
      guildId,
      userId
    );

    if (existing) {
      return { success: false, error: 'User is already in a squad' };
    }

    dbService.run(
      `INSERT INTO squad_members (squad_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`,
      squadId,
      userId,
      Date.now()
    );

    logger.info(`[SquadManager] User ${userId} joined squad ${squadId}`);
    return { success: true };
  }

  /**
   * Removes or leaves a squad.
   */
  public leaveSquad(squadId: string, userId: string): { success: boolean; error?: string } {
    const squad = dbService.get<{ leader_id: string }>(
      `SELECT leader_id FROM squads WHERE id = ?`,
      squadId
    );

    if (squad && squad.leader_id === userId) {
      return { success: false, error: 'Squad leader cannot leave without transferring leadership or disbanding' };
    }

    const result = dbService.run(
      `DELETE FROM squad_members WHERE squad_id = ? AND user_id = ?`,
      squadId,
      userId
    );

    return { success: Number(result.changes) > 0 };
  }

  /**
   * Awards points to a squad.
   */
  public addSquadPoints(squadId: string, points: number): number {
    dbService.run(`UPDATE squads SET points = points + ? WHERE id = ?`, points, squadId);
    const updated = dbService.get<{ points: number }>(`SELECT points FROM squads WHERE id = ?`, squadId);
    return updated?.points || 0;
  }

  /**
   * Links a private Discord channel to the squad.
   */
  public setSquadChannel(squadId: string, channelId: string): void {
    dbService.run(`UPDATE squads SET channel_id = ? WHERE id = ?`, channelId, squadId);
  }

  /**
   * Retrieves the squad leaderboard.
   */
  public getLeaderboard(guildId: string, limit = 10): SquadRecord[] {
    const rows = dbService.all<{
      id: string;
      guild_id: string;
      name: string;
      leader_id: string;
      points: number;
      channel_id: string;
      created_at: number;
      member_count: number;
    }>(
      `SELECT s.id, s.guild_id, s.name, s.leader_id, s.points, s.channel_id, s.created_at,
              COUNT(sm.user_id) as member_count
       FROM squads s
       LEFT JOIN squad_members sm ON s.id = sm.squad_id
       WHERE s.guild_id = ?
       GROUP BY s.id
       ORDER BY s.points DESC
       LIMIT ?`,
      guildId,
      limit
    );

    return rows.map(r => ({
      id: r.id,
      guildId: r.guild_id,
      name: r.name,
      leaderId: r.leader_id,
      points: r.points,
      channelId: r.channel_id,
      createdAt: r.created_at,
      membersCount: r.member_count,
    }));
  }
}

export const squadManagerService = new SquadManagerService();
