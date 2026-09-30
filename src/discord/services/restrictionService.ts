import { memberRepo } from '../../database/repositories/memberRepo.js';
import { guildRepo } from '../../database/repositories/guildRepo.js';
import { auditRepo } from '../../database/repositories/auditRepo.js';
import { dbService } from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('RestrictionService');

export interface RestrictionDecision {
  userId: string;
  guildId: string;
  durationHours: number;
  expiresAt: number;
  reason: string;
  sentimentAdjustment: 'shorter_calm' | 'longer_hostile' | 'neutral';
}

export class RestrictionService {
  public calculateRestrictionDuration(params: {
    guildId: string;
    score: number;
    reactionText?: string;
  }): { durationHours: number; sentimentAdjustment: 'shorter_calm' | 'longer_hostile' | 'neutral' } {
    const config = guildRepo.getOrCreate(params.guildId);
    const minHours = config.min_restriction_hours;
    const maxHours = config.max_restriction_hours;

    // Baseline proportional to how far below passing threshold (50)
    // score 45 -> closer to minHours; score 0 -> closer to maxHours
    const deficitRatio = (50 - Math.max(0, params.score)) / 50;
    let baseHours = minHours + deficitRatio * (maxHours - minHours) * 0.5;

    let sentimentAdjustment: 'shorter_calm' | 'longer_hostile' | 'neutral' = 'neutral';
    if (params.reactionText) {
      const lower = params.reactionText.toLowerCase();
      // Hostile, abusive, or gaming signals
      if (lower.includes('cheat') || lower.includes('trash bot') || lower.includes('f***') || lower.includes('stupid') || lower.includes('scam')) {
        baseHours = Math.min(maxHours, baseHours * 1.5);
        sentimentAdjustment = 'longer_hostile';
      }
      // Calm, reflective, respectful signals
      else if (lower.includes('thank') || lower.includes('understand') || lower.includes('will practice') || lower.includes('شكرا') || lower.includes('تمام')) {
        baseHours = Math.max(minHours, baseHours * 0.7);
        sentimentAdjustment = 'shorter_calm';
      }
    }

    const durationHours = Math.round(Math.min(maxHours, Math.max(minHours, baseHours)));
    return { durationHours, sentimentAdjustment };
  }

  public applyRestriction(params: {
    userId: string;
    guildId: string;
    score: number;
    reactionText?: string;
    actorId?: string;
  }): RestrictionDecision {
    const { durationHours, sentimentAdjustment } = this.calculateRestrictionDuration(params);
    const now = Date.now();
    const expiresAt = now + durationHours * 3600 * 1000;

    // Update DB member state
    memberRepo.update(params.userId, {
      is_restricted: 1,
      restriction_expires_at: expiresAt,
    });

    const reason = `Skill test score ${params.score}% below passing threshold 50%. Sentiment adjustment: ${sentimentAdjustment}.`;

    auditRepo.log({
      guild_id: params.guildId,
      action_type: 'restriction_applied_larper',
      actor_id: params.actorId || 'system_ai',
      target_id: params.userId,
      details: {
        score: params.score,
        durationHours,
        expiresAt,
        sentimentAdjustment,
      },
      reasoning: reason,
      reversible: true,
    });

    logger.info(`Applied restriction to user ${params.userId} for ${durationHours} hours.`);
    return {
      userId: params.userId,
      guildId: params.guildId,
      durationHours,
      expiresAt,
      reason,
      sentimentAdjustment,
    };
  }

  public liftRestriction(userId: string, guildId: string, reviewerId: string, reason: string): boolean {
    memberRepo.update(userId, {
      is_restricted: 0,
      restriction_expires_at: null,
    });

    auditRepo.log({
      guild_id: guildId,
      action_type: 'restriction_lifted',
      actor_id: reviewerId,
      target_id: userId,
      details: { reason },
      reasoning: `Manual restriction override by staff: ${reason}`,
      reversible: false,
    });

    return true;
  }

  public fileAppeal(params: {
    userId: string;
    guildId: string;
    reason: string;
  }): { appealId: string; status: string } {
    const appealId = `appeal_${uuidv4().slice(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO appeals (id, user_id, guild_id, case_type, reason, status, created_at)
       VALUES (?, ?, ?, 'restriction_appeal', ?, 'pending', ?)`,
      appealId,
      params.userId,
      params.guildId,
      params.reason,
      now
    );

    auditRepo.log({
      guild_id: params.guildId,
      action_type: 'appeal_filed',
      actor_id: params.userId,
      target_id: params.userId,
      details: { appealId, reason: params.reason },
      reasoning: 'Member filed formal restriction appeal.',
      reversible: false,
    });

    return { appealId, status: 'pending' };
  }

  public checkExpiredRestrictions(): string[] {
    const now = Date.now();
    const expiredMembers = dbService.all<{ user_id: string; guild_id: string }>(
      'SELECT user_id, guild_id FROM members WHERE is_restricted = 1 AND restriction_expires_at <= ?',
      now
    );

    const liftedIds: string[] = [];
    for (const m of expiredMembers) {
      this.liftRestriction(m.user_id, m.guild_id, 'auto_expiry_job', 'Scheduled restriction duration expired.');
      liftedIds.push(m.user_id);
    }

    return liftedIds;
  }
}

export const restrictionService = new RestrictionService();
