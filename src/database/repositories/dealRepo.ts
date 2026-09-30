import { dbService } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface DealRecord {
  id: string;
  guild_id: string;
  channel_id: string;
  client_id: string;
  freelancer_id: string;
  middleman_id: string;
  title: string;
  amount: number;
  currency: string;
  agreement_text: string;
  agreement_sha256: string;
  status: 'draft' | 'confirmed' | 'funded' | 'delivered' | 'completed' | 'disputed' | 'cancelled';
  client_confirmed: number;
  freelancer_confirmed: number;
  middleman_funds_verified: number;
  proof_attachment_url?: string | null;
  dispute_reason?: string | null;
  client_rating?: number | null;
  freelancer_rating?: number | null;
  created_at: number;
  closed_at?: number | null;
}

export class DealRepository {
  public create(data: {
    guild_id: string;
    channel_id: string;
    client_id: string;
    freelancer_id: string;
    middleman_id: string;
    title: string;
    amount: number;
    currency?: string;
    agreement_text: string;
  }): DealRecord {
    const id = uuidv4();
    const now = Date.now();
    const sha256 = crypto.createHash('sha256').update(data.agreement_text).digest('hex');

    dbService.run(
      `INSERT INTO deals (
        id, guild_id, channel_id, client_id, freelancer_id, middleman_id,
        title, amount, currency, agreement_text, agreement_sha256, status,
        client_confirmed, freelancer_confirmed, middleman_funds_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, 0, 0, ?)`,
      id,
      data.guild_id,
      data.channel_id,
      data.client_id,
      data.freelancer_id,
      data.middleman_id,
      data.title,
      data.amount,
      data.currency || 'USD',
      data.agreement_text,
      sha256,
      now
    );

    return this.get(id)!;
  }

  public get(id: string): DealRecord | undefined {
    return dbService.get<DealRecord>('SELECT * FROM deals WHERE id = ?', id);
  }

  public getByChannelId(channelId: string): DealRecord | undefined {
    return dbService.get<DealRecord>('SELECT * FROM deals WHERE channel_id = ?', channelId);
  }

  public update(id: string, partial: Partial<Omit<DealRecord, 'id' | 'created_at'>>): DealRecord {
    const keys = Object.keys(partial);
    if (keys.length === 0) return this.get(id)!;

    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(partial), id];

    dbService.run(`UPDATE deals SET ${setClauses} WHERE id = ?`, ...values as (string | number | null)[]);
    return this.get(id)!;
  }

  public listActiveForUser(userId: string): DealRecord[] {
    return dbService.all<DealRecord>(
      `SELECT * FROM deals WHERE (client_id = ? OR freelancer_id = ? OR middleman_id = ?)
       AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC`,
      userId,
      userId,
      userId
    );
  }

  public listCompletedForMiddleman(middlemanId: string): DealRecord[] {
    return dbService.all<DealRecord>(
      "SELECT * FROM deals WHERE middleman_id = ? AND status = 'completed'",
      middlemanId
    );
  }

  public createDeal(data: {
    guildId: string;
    channelId: string;
    clientId: string;
    freelancerId: string;
    middlemanId: string;
    title: string;
    amount: number;
    currency?: string;
    agreementText: string;
    agreementSha256?: string;
  }): DealRecord {
    return this.create({
      guild_id: data.guildId,
      channel_id: data.channelId,
      client_id: data.clientId,
      freelancer_id: data.freelancerId,
      middleman_id: data.middlemanId,
      title: data.title,
      amount: data.amount,
      currency: data.currency,
      agreement_text: data.agreementText,
    });
  }

  public getDealById(id: string): DealRecord | undefined {
    return this.get(id);
  }

  public updateStatus(id: string, status: any): DealRecord {
    return this.update(id, { status });
  }
}

export const dealRepo = new DealRepository();
