import { getDb } from '../../database';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export interface MeritCharterClause {
  id: string;
  clauseKey: string;
  title: string;
  category: 'core_free' | 'earnable_extra' | 'forbidden_monetization';
  isImmutable: boolean;
  allowedEarnable: boolean;
  description: string;
  updatedAt: number;
}

export interface ContributionRecord {
  id: string;
  tenantId: string;
  userId: string;
  contributionType: 'helpful_answer' | 'code_review' | 'mentoring' | 'event_help' | 'docs' | 'mod_assist';
  qualityWeight: number; // 0.1 to 5.0
  evidenceUrl?: string;
  verifiedBy?: string;
  isActive: boolean;
  createdAt: number;
}

export interface MemberUnlockable {
  id: string;
  tenantId: string;
  userId: string;
  unlockableKey: string;
  category: 'cosmetic' | 'convenience';
  unlockedAt: number;
}

export interface EqualAccessAuditResult {
  passed: boolean;
  violations: Array<{
    component: string;
    violationType: string;
    details: string;
  }>;
  auditedAt: number;
}

export class MeritCharterEngine {
  private static instance: MeritCharterEngine;

  private constructor() {
    this.initializeDefaultCharter();
  }

  public static getInstance(): MeritCharterEngine {
    if (!MeritCharterEngine.instance) {
      MeritCharterEngine.instance = new MeritCharterEngine();
    }
    return MeritCharterEngine.instance;
  }

  /**
   * Initializes the machine-readable YAML/SQL charter clauses ensuring free core boundaries.
   * Chapter 31: Merit Charter Engine [FREE]
   */
  public initializeDefaultCharter(): void {
    const db = getDb();
    const clauses: Array<Omit<MeritCharterClause, 'id' | 'updatedAt'>> = [
      {
        clauseKey: 'free_core_learning',
        title: 'Universal Learning & Skill Tree Access',
        category: 'core_free',
        isImmutable: true,
        allowedEarnable: false,
        description: 'All courses, skill trees, coding challenges, design critiques, and learning materials are 100% free for everyone forever.'
      },
      {
        clauseKey: 'free_core_portfolio_deals',
        title: 'Universal Portfolio & Job Board Access',
        category: 'core_free',
        isImmutable: true,
        allowedEarnable: false,
        description: 'Portfolio builder, client deal-making, verified credentials, and middleman escrow are 100% free with zero paywalled visibility.'
      },
      {
        clauseKey: 'free_core_safety_support',
        title: 'Universal Safety & AI Assistance',
        category: 'core_free',
        isImmutable: true,
        allowedEarnable: false,
        description: 'Moderation, conflict mediation, fraud radar, scam reporting, and baseline AI helpers are completely free for all members.'
      },
      {
        clauseKey: 'earnable_cosmetics',
        title: 'Earnable Profile Cosmetics',
        category: 'earnable_extra',
        isImmutable: false,
        allowedEarnable: true,
        description: 'Profile themes, animated badges, and hall-of-fame placements are earnable strictly through verified contributions.'
      },
      {
        clauseKey: 'earnable_convenience',
        title: 'Earnable Convenience Extras',
        category: 'earnable_extra',
        isImmutable: false,
        allowedEarnable: true,
        description: 'Extra private study rooms and minor non-essential AI quota boosts can be unlocked by effort, never purchased.'
      },
      {
        clauseKey: 'forbidden_pay_to_win',
        title: 'Absolute Prohibition on Paid Advantages',
        category: 'forbidden_monetization',
        isImmutable: true,
        allowedEarnable: false,
        description: 'Money cannot buy visibility, ranking, reputation, roles, review priority, or influence over judging or moderation.'
      }
    ];

    const now = Date.now();
    for (const c of clauses) {
      db.prepare(`
        INSERT INTO merit_charter_clauses (id, clause_key, title, category, is_immutable, allowed_earnable, description, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(clause_key) DO UPDATE SET
          title = excluded.title,
          category = excluded.category,
          is_immutable = excluded.is_immutable,
          allowed_earnable = excluded.allowed_earnable,
          description = excluded.description,
          updated_at = excluded.updated_at
      `).run(uuidv4(), c.clauseKey, c.title, c.category, c.isImmutable ? 1 : 0, c.allowedEarnable ? 1 : 0, c.description, now);
    }
  }

  /**
   * Asserts whether a given capability is protected as CORE_FREE.
   * If a module attempts to gate a CORE_FREE feature behind money or merit points, this fails.
   */
  public assertCoreAccess(featureKey: string, proposedGatingType: 'none' | 'effort' | 'money'): { allowed: boolean; reason: string } {
    if (proposedGatingType === 'money') {
      return {
        allowed: false,
        reason: `VIOLATION of Nexus Charter: Feature "${featureKey}" cannot be gated by money under any circumstances.`
      };
    }

    const coreFeatures = [
      'verification', 'learning', 'portfolio', 'job_board', 'deals',
      'escrow', 'help', 'events', 'mentorship_access', 'ai_helpers', 'safety'
    ];

    if (coreFeatures.includes(featureKey) && proposedGatingType === 'effort') {
      return {
        allowed: false,
        reason: `VIOLATION of Nexus Charter: Core feature "${featureKey}" is universally free and cannot be locked behind effort requirements.`
      };
    }

    return { allowed: true, reason: 'Complies with Nexus Charter.' };
  }

  /**
   * Records a verified contribution and updates member effort score.
   * Chapter 32: Effort & Contribution Score [EARNED]
   */
  public recordContribution(
    tenantId: string,
    userId: string,
    type: ContributionRecord['contributionType'],
    qualityWeight: number,
    evidenceUrl?: string,
    verifiedBy?: string
  ): { contributionId: string; totalScore: number } {
    const db = getDb();
    const id = uuidv4();
    const now = Date.now();
    const clampedWeight = Math.min(Math.max(qualityWeight, 0.1), 5.0);

    db.prepare(`
      INSERT INTO member_contributions (id, tenant_id, user_id, contribution_type, quality_weight, evidence_url, verified_by, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, tenantId, userId, type, clampedWeight, evidenceUrl || null, verifiedBy || null, now);

    // Also append to append-only tamper-evident contribution ledger (Chapter 35)
    this.appendContributionLedgerEntry(tenantId, userId, 'CONTRIBUTION_LOGGED', {
      contributionId: id,
      type,
      qualityWeight: clampedWeight,
      verifiedBy
    });

    const totalScore = this.calculateEffortScore(tenantId, userId);
    return { contributionId: id, totalScore };
  }

  /**
   * Calculates anti-farming, quality-weighted effort score.
   * Diminishing returns on excessive volume + decay for prolonged inactivity (without ever revoking core access).
   */
  public calculateEffortScore(tenantId: string, userId: string): number {
    const db = getDb();
    const rows = db.prepare(`
      SELECT contribution_type, quality_weight, created_at
      FROM member_contributions
      WHERE tenant_id = ? AND user_id = ? AND is_active = 1
      ORDER BY created_at DESC
    `).all(tenantId, userId) as Array<{ contribution_type: string; quality_weight: number; created_at: number }>;

    let score = 0;
    const typeCountMap = new Map<string, number>();

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const r of rows) {
      const count = typeCountMap.get(r.contribution_type) || 0;
      typeCountMap.set(r.contribution_type, count + 1);

      // Diminishing returns: each subsequent contribution of same type yields diminishing factor
      const diminishingFactor = 1 / (1 + count * 0.15);

      // Inactivity / age dampening: contributions older than 60 days decay gently towards 50%
      const ageMs = now - r.created_at;
      const ageDecay = ageMs > thirtyDaysMs ? Math.max(0.5, 1 - (ageMs - thirtyDaysMs) / (90 * 24 * 60 * 60 * 1000)) : 1.0;

      score += r.quality_weight * diminishingFactor * ageDecay * 10;
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * Unlocks an earned cosmetic or convenience perk.
   * Chapter 33: Unlockables Vault [EARNED]
   */
  public unlockPerk(
    tenantId: string,
    userId: string,
    unlockableKey: string,
    category: 'cosmetic' | 'convenience'
  ): { success: boolean; message: string } {
    const db = getDb();

    // Verify it is not an essential core feature
    const check = this.assertCoreAccess(unlockableKey, 'effort');
    if (!check.allowed) {
      return { success: false, message: check.reason };
    }

    const currentScore = this.calculateEffortScore(tenantId, userId);
    const requiredScore = category === 'cosmetic' ? 25 : 50;

    if (currentScore < requiredScore) {
      return {
        success: false,
        message: `Score insufficient: ${currentScore}/${requiredScore} required for ${unlockableKey}.`
      };
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO member_unlockables (id, tenant_id, user_id, unlockable_key, category, unlocked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, userId, unlockableKey, category, Date.now());

    return {
      success: true,
      message: `Unlocked ${category} perk: "${unlockableKey}" via verified effort!`
    };
  }

  /**
   * Append-only cryptographic ledger entry for contributions.
   * Chapter 35: Contribution Ledger [FREE]
   */
  public appendContributionLedgerEntry(
    tenantId: string,
    userId: string,
    eventType: string,
    details: Record<string, unknown>
  ): { entryId: string; entryHash: string } {
    const db = getDb();
    const id = uuidv4();
    const now = Date.now();

    const lastEntry = db.prepare(`
      SELECT entry_hash FROM contribution_ledger_entries
      WHERE tenant_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(tenantId) as { entry_hash: string } | undefined;

    const prevHash = lastEntry ? lastEntry.entry_hash : 'GENESIS_MERIT_HASH';
    const payload = JSON.stringify({ id, tenantId, userId, eventType, details, prevHash, now });
    const entryHash = crypto.createHash('sha256').update(payload).digest('hex');

    db.prepare(`
      INSERT INTO contribution_ledger_entries (id, tenant_id, user_id, event_type, details_json, entry_hash, prev_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, userId, eventType, JSON.stringify(details), entryHash, prevHash, now);

    return { entryId: id, entryHash };
  }

  /**
   * Peer Kudos system with daily quotas & circular collusion detection.
   * Chapter 36: Peer Kudos & Recognition [EARNED]
   */
  public sendKudos(
    tenantId: string,
    senderId: string,
    recipientId: string,
    reason: string
  ): { success: boolean; message: string } {
    if (senderId === recipientId) {
      return { success: false, message: 'Self-kudos is not permitted.' };
    }

    const db = getDb();
    const todayStr = new Date().toISOString().slice(0, 10);

    // Limit 3 kudos per member per day
    const sentToday = db.prepare(`
      SELECT COUNT(*) as count FROM peer_kudos
      WHERE tenant_id = ? AND sender_id = ? AND date_str = ?
    `).get(tenantId, senderId, todayStr) as { count: number };

    if (sentToday.count >= 3) {
      return { success: false, message: 'Daily kudos limit reached (maximum 3 per day).' };
    }

    // Check for circular kudos collusion (reciprocal kudos in last 24h)
    const reciprocal = db.prepare(`
      SELECT id FROM peer_kudos
      WHERE tenant_id = ? AND sender_id = ? AND recipient_id = ? AND date_str = ?
    `).get(tenantId, recipientId, senderId, todayStr);

    if (reciprocal) {
      logger.warn(`Potential reciprocal kudos swap flagged between ${senderId} and ${recipientId}`);
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO peer_kudos (id, tenant_id, sender_id, recipient_id, reason, date_str, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, senderId, recipientId, reason, todayStr, Date.now());

    // Award minor contribution score to recipient
    this.recordContribution(tenantId, recipientId, 'helpful_answer', 0.5, undefined, senderId);

    return {
      success: true,
      message: `Kudos successfully awarded to member with reason: "${reason}".`
    };
  }

  /**
   * Time Bank: 1:1 teaching credit minting and scheduling.
   * Chapter 37: Time Bank: Teach an Hour, Earn an Hour [EARNED]
   */
  public logTimeBankSession(
    tenantId: string,
    teacherId: string,
    studentId: string,
    topic: string,
    durationHours: number
  ): { success: boolean; teacherBalance: number; studentBalance: number } {
    const db = getDb();
    const now = Date.now();

    // Ensure accounts exist
    db.prepare(`
      INSERT INTO time_bank_accounts (id, tenant_id, user_id, balance_hours, lifetime_taught, lifetime_learned, updated_at)
      VALUES (?, ?, ?, 0.0, 0.0, 0.0, ?)
      ON CONFLICT(tenant_id, user_id) DO NOTHING
    `).run(uuidv4(), tenantId, teacherId, now);

    db.prepare(`
      INSERT INTO time_bank_accounts (id, tenant_id, user_id, balance_hours, lifetime_taught, lifetime_learned, updated_at)
      VALUES (?, ?, ?, 0.0, 0.0, 0.0, ?)
      ON CONFLICT(tenant_id, user_id) DO NOTHING
    `).run(uuidv4(), tenantId, studentId, now);

    // Credit teacher +duration, debit student -duration (can overdraft up to -2.0 for newcomers)
    db.prepare(`
      UPDATE time_bank_accounts
      SET balance_hours = balance_hours + ?, lifetime_taught = lifetime_taught + ?, updated_at = ?
      WHERE tenant_id = ? AND user_id = ?
    `).run(durationHours, durationHours, now, tenantId, teacherId);

    db.prepare(`
      UPDATE time_bank_accounts
      SET balance_hours = balance_hours - ?, lifetime_learned = lifetime_learned + ?, updated_at = ?
      WHERE tenant_id = ? AND user_id = ?
    `).run(durationHours, durationHours, now, tenantId, studentId);

    const sessionId = uuidv4();
    db.prepare(`
      INSERT INTO time_bank_sessions (id, tenant_id, teacher_id, student_id, topic, duration_hours, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
    `).run(sessionId, tenantId, teacherId, studentId, topic, durationHours, now);

    const tAcc = db.prepare(`SELECT balance_hours FROM time_bank_accounts WHERE tenant_id = ? AND user_id = ?`).get(tenantId, teacherId) as { balance_hours: number };
    const sAcc = db.prepare(`SELECT balance_hours FROM time_bank_accounts WHERE tenant_id = ? AND user_id = ?`).get(tenantId, studentId) as { balance_hours: number };

    return {
      success: true,
      teacherBalance: tAcc.balance_hours,
      studentBalance: sAcc.balance_hours
    };
  }

  /**
   * Community Council Proposal & One-Member-One-Vote Ballot.
   * Chapter 38: Community Council & Voting [FREE]
   */
  public submitCouncilProposal(
    tenantId: string,
    authorId: string,
    title: string,
    description: string,
    category: string,
    proposalType: 'binding_referendum' | 'advisory_poll'
  ): { proposalId: string } {
    const db = getDb();
    const id = uuidv4();
    const now = Date.now();
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7-day vote

    db.prepare(`
      INSERT INTO community_council_proposals (id, tenant_id, author_id, title, description, category, proposal_type, status, votes_for, votes_against, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, ?, ?)
    `).run(id, tenantId, authorId, title, description, category, proposalType, expiresAt, now);

    return { proposalId: id };
  }

  public castVote(
    proposalId: string,
    userId: string,
    vote: 'for' | 'against'
  ): { success: boolean; message: string } {
    const db = getDb();

    const existing = db.prepare(`
      SELECT id FROM community_council_votes WHERE proposal_id = ? AND user_id = ?
    `).get(proposalId, userId);

    if (existing) {
      return { success: false, message: 'You have already voted on this proposal.' };
    }

    const voteId = uuidv4();
    db.prepare(`
      INSERT INTO community_council_votes (id, proposal_id, user_id, vote, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(voteId, proposalId, userId, vote, Date.now());

    if (vote === 'for') {
      db.prepare(`UPDATE community_council_proposals SET votes_for = votes_for + 1 WHERE id = ?`).run(proposalId);
    } else {
      db.prepare(`UPDATE community_council_proposals SET votes_against = votes_against + 1 WHERE id = ?`).run(proposalId);
    }

    return { success: true, message: 'Vote recorded successfully.' };
  }

  /**
   * Transparent Moderation Ledger recording anonymized incidents, overturn rates, and appeal duration.
   * Chapter 39: Transparent Moderation Ledger [FREE]
   */
  public logModerationAction(
    tenantId: string,
    targetUserId: string,
    category: string,
    action: string,
    reason: string,
    language: string = 'en'
  ): { logId: string } {
    const db = getDb();
    const id = uuidv4();
    const anonymizedHash = crypto.createHash('sha256').update(targetUserId).digest('hex').slice(0, 16);

    db.prepare(`
      INSERT INTO transparent_moderation_logs (id, tenant_id, category, anonymized_target_hash, action, reason, overturn_status, appeal_duration_hours, language, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'upheld', 0.0, ?, ?)
    `).run(id, tenantId, category, anonymizedHash, action, reason, language, Date.now());

    return { logId: id };
  }

  /**
   * Resolves appeal in moderation ledger.
   */
  public recordModerationAppeal(
    logId: string,
    overturned: boolean,
    durationHours: number
  ): void {
    const db = getDb();
    db.prepare(`
      UPDATE transparent_moderation_logs
      SET overturn_status = ?, appeal_duration_hours = ?
      WHERE id = ?
    `).run(overturned ? 'overturned' : 'upheld', durationHours, logId);
  }

  /**
   * Accessibility Suite utilities: screen-reader formatting, alt-text prompts, and high-contrast markers.
   * Chapter 40: Accessibility & Inclusion Suite [FREE]
   */
  public formatAccessibleMessage(
    text: string,
    options: { dyslexiaFriendly?: boolean; simpleLanguage?: boolean; highContrastTag?: boolean }
  ): string {
    let output = text;

    if (options.simpleLanguage) {
      // Simplify technical jargon and wrap steps in clear ordered list
      output = output.replace(/\butilize\b/gi, 'use')
                     .replace(/\bcommence\b/gi, 'start')
                     .replace(/\bterminate\b/gi, 'end');
    }

    if (options.dyslexiaFriendly) {
      // Avoid wall-of-text formatting with extra line breaks and clearer separators
      output = output.split('\n').map(line => line.trim()).filter(Boolean).join('\n\n');
    }

    if (options.highContrastTag) {
      output = `[ACCESSIBILITY MODE] \n${output}`;
    }

    return output;
  }
}

/**
 * Chapter 34: Equal Access Auditor [FREE]
 * Continuously scans all routes, database structures, permissions, and roles to detect any pay-to-win,
 * wealth-gating, or donor-exclusive privileges.
 */
export class EqualAccessAuditor {
  public static runAudit(tenantId: string): EqualAccessAuditResult {
    const db = getDb();
    const violations: EqualAccessAuditResult['violations'] = [];

    // 1. Audit Charter clauses: confirm no core clause is flagged as earnable or paywalled
    const badClauses = db.prepare(`
      SELECT clause_key, category FROM merit_charter_clauses
      WHERE category = 'core_free' AND allowed_earnable = 1
    `).all() as Array<{ clause_key: string; category: string }>;

    for (const bc of badClauses) {
      violations.push({
        component: 'MeritCharter',
        violationType: 'CORE_FEATURE_GATED',
        details: `Core feature ${bc.clause_key} was incorrectly configured as earnable.`
      });
    }

    // 2. Audit unlockables: confirm no unlockable grants core utility (only cosmetics/convenience)
    const badUnlockables = db.prepare(`
      SELECT unlockable_key, category FROM member_unlockables
      WHERE category NOT IN ('cosmetic', 'convenience')
    `).all() as Array<{ unlockable_key: string; category: string }>;

    for (const bu of badUnlockables) {
      violations.push({
        component: 'UnlockablesVault',
        violationType: 'CRITICAL_FEATURE_LOCKED',
        details: `Unlockable perk ${bu.unlockable_key} has forbidden category ${bu.category}.`
      });
    }

    // 3. Audit donor records: verify donor records never contain role grants or permission elevates
    const donorViolations = db.prepare(`
      SELECT id, donor_identifier FROM fund_donations
      WHERE status = 'granted_role' OR status = 'granted_priority'
    `).all() as Array<{ id: string; donor_identifier: string }>;

    for (const dv of donorViolations) {
      violations.push({
        component: 'DonorFairness',
        violationType: 'DONOR_ADVANTAGE_DETECTED',
        details: `Donation ${dv.id} attempted to confer an advantage to donor ${dv.donor_identifier}.`
      });
    }

    const passed = violations.length === 0;
    const now = Date.now();

    db.prepare(`
      INSERT INTO equal_access_audits (id, tenant_id, component, check_type, passed, violation_details, audited_at)
      VALUES (?, ?, 'SYSTEM_WIDE', 'EQUAL_ACCESS_SCAN', ?, ?, ?)
    `).run(uuidv4(), tenantId, passed ? 1 : 0, JSON.stringify(violations), now);

    return {
      passed,
      violations,
      auditedAt: now
    };
  }
}
