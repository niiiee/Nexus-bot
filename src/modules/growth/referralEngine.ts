import { dbService } from '../../database/connection.js';
import { economyRepo } from '../../database/repositories/economyRepo.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface ReferralRecord {
  id: string;
  guildId: string;
  referrerId: string;
  referredId: string;
  status: 'pending' | 'verified' | 'rewarded';
  rewardCredits: number;
  createdAt: number;
}

export class ReferralEngine {
  public generateReferralLink(userId: string, guildId: string): string {
    return `https://discord.gg/senior-progg?ref=${userId}_${guildId.slice(0, 4)}`;
  }

  public registerReferral(params: {
    guildId: string;
    referrerId: string;
    referredId: string;
  }): { success: boolean; isAbuseDetected: boolean; referralId?: string; message: string } {
    if (params.referrerId === params.referredId) {
      return { success: false, isAbuseDetected: true, message: 'Self-referral is forbidden!' };
    }

    // Circular referral check: did referredId already refer referrerId?
    const circular = dbService.get<{ id: string }>(
      `SELECT id FROM referrals WHERE guild_id = ? AND referrer_id = ? AND referred_id = ?`,
      params.guildId,
      params.referredId,
      params.referrerId
    );

    if (circular) {
      logger.warn('ReferralEngine', `Circular referral fraud detected between ${params.referrerId} and ${params.referredId}!`);
      return {
        success: false,
        isAbuseDetected: true,
        message: 'Circular referral loop detected! Transaction blocked and reported to staff.',
      };
    }

    const id = `ref_${randomUUID().slice(0, 8)}`;
    dbService.run(
      `INSERT INTO referrals (id, guild_id, referrer_id, referred_id, status, reward_credits, created_at)
       VALUES (?, ?, ?, ?, 'pending', 50, ?)`,
      id,
      params.guildId,
      params.referrerId,
      params.referredId,
      Date.now()
    );

    logger.info('ReferralEngine', `Registered referral ${id}: ${params.referrerId} referred ${params.referredId}`);

    return {
      success: true,
      isAbuseDetected: false,
      referralId: id,
      message: 'Referral registered! Reward will be unlocked once your friend passes skill verification.',
    };
  }

  public handleReferredUserVerified(referredUserId: string, guildId: string): boolean {
    const referral = dbService.get<{ id: string; referrer_id: string; reward_credits: number }>(
      `SELECT id, referrer_id, reward_credits FROM referrals WHERE referred_id = ? AND guild_id = ? AND status = 'pending'`,
      referredUserId,
      guildId
    );

    if (!referral) return false;

    // Award credits to the referrer
    economyRepo.addCredits(
      referral.referrer_id,
      guildId,
      referral.reward_credits,
      'referral_reward',
      `Referral bonus: invited user ${referredUserId} passed verification!`
    );

    dbService.run(
      `UPDATE referrals SET status = 'rewarded', rewarded_at = ? WHERE id = ?`,
      Date.now(),
      referral.id
    );

    logger.info('ReferralEngine', `Referral reward of ${referral.reward_credits} credits delivered to ${referral.referrer_id}`);
    return true;
  }
}

export const referralEngine = new ReferralEngine();
