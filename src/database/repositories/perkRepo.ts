import { dbService } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface PerkDefinitionRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  credit_price: number;
  level_requirement: number;
  stock: number;
  duration_seconds: number;
  is_active: number;
}

export interface MemberPerkRecord {
  id: string;
  user_id: string;
  guild_id: string;
  perk_id: string;
  acquired_at: number;
  expires_at?: number | null;
  is_active: number;
}

export class PerkRepository {
  public upsertDefinition(def: PerkDefinitionRecord): void {
    dbService.run(
      `INSERT INTO perk_definitions (
        id, name, category, description, credit_price, level_requirement, stock, duration_seconds, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        description = excluded.description,
        credit_price = excluded.credit_price,
        level_requirement = excluded.level_requirement,
        stock = excluded.stock,
        duration_seconds = excluded.duration_seconds,
        is_active = excluded.is_active`,
      def.id,
      def.name,
      def.category,
      def.description,
      def.credit_price,
      def.level_requirement,
      def.stock,
      def.duration_seconds,
      def.is_active
    );
  }

  public getDefinition(id: string): PerkDefinitionRecord | undefined {
    return dbService.get<PerkDefinitionRecord>('SELECT * FROM perk_definitions WHERE id = ?', id);
  }

  public listAllDefinitions(): PerkDefinitionRecord[] {
    return dbService.all<PerkDefinitionRecord>('SELECT * FROM perk_definitions ORDER BY category ASC, credit_price ASC');
  }

  public listActiveDefinitions(): PerkDefinitionRecord[] {
    return dbService.all<PerkDefinitionRecord>('SELECT * FROM perk_definitions WHERE is_active = 1 ORDER BY category ASC, credit_price ASC');
  }

  public grantPerk(userId: string, guildId: string, perkId: string, durationSeconds: number = 0): MemberPerkRecord {
    const id = uuidv4();
    const now = Date.now();
    const expiresAt = durationSeconds > 0 ? now + durationSeconds * 1000 : null;

    dbService.run(
      `INSERT INTO member_perks (
        id, user_id, guild_id, perk_id, acquired_at, expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      id,
      userId,
      guildId,
      perkId,
      now,
      expiresAt
    );

    return {
      id,
      user_id: userId,
      guild_id: guildId,
      perk_id: perkId,
      acquired_at: now,
      expires_at: expiresAt,
      is_active: 1,
    };
  }

  public listMemberPerks(userId: string): (MemberPerkRecord & { name: string; category: string; description: string })[] {
    const now = Date.now();
    return dbService.all(
      `SELECT mp.*, pd.name, pd.category, pd.description
       FROM member_perks mp
       JOIN perk_definitions pd ON mp.perk_id = pd.id
       WHERE mp.user_id = ? AND mp.is_active = 1
       AND (mp.expires_at IS NULL OR mp.expires_at > ?)
       ORDER BY mp.acquired_at DESC`,
      userId,
      now
    );
  }

  public hasActivePerk(userId: string, perkId: string): boolean {
    const now = Date.now();
    const record = dbService.get(
      `SELECT id FROM member_perks
       WHERE user_id = ? AND perk_id = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`,
      userId,
      perkId,
      now
    );
    return !!record;
  }
}

export const perkRepo = new PerkRepository();
