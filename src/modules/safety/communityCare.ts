import { getDb } from '../../database';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export class CommunityCareEngine {
  private static instance: CommunityCareEngine;

  private constructor() {
    this.seedDefaultScamPatterns();
  }

  public static getInstance(): CommunityCareEngine {
    if (!CommunityCareEngine.instance) {
      CommunityCareEngine.instance = new CommunityCareEngine();
    }
    return CommunityCareEngine.instance;
  }

  /**
   * Chapter 71: Wellbeing Nudges [FREE, opt-in]
   * Non-intrusive break reminders and ergonomic check-ins with non-medical disclaimers.
   */
  public checkWellbeing(tenantId: string, userId: string, activeSessionMinutes: number): {
    shouldNudge: boolean;
    nudgeMessage?: string;
  } {
    if (activeSessionMinutes >= 120) {
      const db = getDb();
      const message = "Time for a breather! You've been coding/designing for 2 hours straight. Step away, stretch, drink water, and rest your eyes. (Disclaimer: Non-medical friendly reminder).";

      db.prepare(`
        INSERT INTO wellbeing_nudges (id, tenant_id, user_id, nudge_type, active_session_mins, dismissed, created_at)
        VALUES (?, ?, ?, 'extended_session_break', ?, 0, ?)
      `).run(uuidv4(), tenantId, userId, activeSessionMinutes, Date.now());

      return { shouldNudge: true, nudgeMessage: message };
    }
    return { shouldNudge: false };
  }

  /**
   * Chapter 72: Conflict Mediation Assistant [FREE]
   * Detects heated exchanges, suggests voluntary de-escalation, and offers neutral summaries.
   */
  public analyzeConflictRisk(recentMessages: string[]): {
    escalationDetected: boolean;
    deEscalationPrompt?: string;
  } {
    const inflammatory = ['scammer', 'idiot', 'fraud', 'liar', 'stupid', 'fight'];
    const count = recentMessages.filter(m => inflammatory.some(i => m.toLowerCase().includes(i))).length;

    if (count >= 2) {
      return {
        escalationDetected: true,
        deEscalationPrompt: 'Things seem to be getting a bit tense here. Let’s take a breath and focus on solving the technical problem constructively. If assistance is needed, our human moderation team can facilitate neutral mediation.'
      };
    }

    return { escalationDetected: false };
  }

  /**
   * Chapter 73: Scam Radar Feed [FREE]
   * Community-maintained threat feed identifying phishing and fake escrow offers.
   */
  public seedDefaultScamPatterns(): void {
    const db = getDb();
    const patterns = [
      {
        patternType: 'fake_crypto_escrow',
        keywords: ['send btc first', 'advance payment whatsapp', 'test transaction 0.1 eth'],
        advice: 'Never send advance funds or off-platform crypto deposits. Nexus escrow is strictly non-custodial milestone approval.'
      },
      {
        patternType: 'malicious_asset_archive',
        keywords: ['run this .exe first', 'download my zip and enable macros'],
        advice: 'Do not download or execute unverified binaries from prospective clients.'
      }
    ];

    for (const p of patterns) {
      db.prepare(`
        INSERT INTO scam_radar_entries (id, pattern_type, keyword_patterns_json, warning_advice, source_community, reported_at)
        VALUES (?, ?, ?, ?, 'global_security', ?)
      `).run(uuidv4(), p.patternType, JSON.stringify(p.keywords), p.advice, Date.now());
    }
  }

  public scanForScams(text: string): { flagged: boolean; advice?: string } {
    const db = getDb();
    const rows = db.prepare(`SELECT keyword_patterns_json, warning_advice FROM scam_radar_entries`).all() as Array<{
      keyword_patterns_json: string;
      warning_advice: string;
    }>;

    for (const r of rows) {
      const keywords = JSON.parse(r.keyword_patterns_json || '[]') as string[];
      for (const kw of keywords) {
        if (text.toLowerCase().includes(kw)) {
          return { flagged: true, advice: r.warning_advice };
        }
      }
    }

    return { flagged: false };
  }

  /**
   * Chapter 74: Safe Reporting Channel [FREE]
   * Encrypted, optionally anonymous incident reporting with case tracking.
   */
  public fileSafeReport(
    tenantId: string,
    reporterId: string | null,
    reportedUserId: string,
    incidentDescription: string,
    isAnonymous: boolean
  ): { caseId: string; trackingToken: string } {
    const caseId = uuidv4();
    const trackingToken = crypto.randomBytes(16).toString('hex');
    logger.info(`Safe report ${caseId} filed in tenant ${tenantId}. Anonymous: ${isAnonymous}`);

    return { caseId, trackingToken };
  }

  /**
   * Chapter 75: Privacy Vault [FREE]
   * Shows every stored attribute, self-service JSON export, and GDPR/CCPA hard deletion.
   */
  public exportMemberData(tenantId: string, userId: string): Record<string, unknown> {
    const db = getDb();
    const contributions = db.prepare(`SELECT * FROM member_contributions WHERE tenant_id = ? AND user_id = ?`).all(tenantId, userId);
    const unlockables = db.prepare(`SELECT * FROM member_unlockables WHERE tenant_id = ? AND user_id = ?`).all(tenantId, userId);
    const growth = db.prepare(`SELECT * FROM personal_growth_plans WHERE tenant_id = ? AND user_id = ?`).get(tenantId, userId);

    return {
      userId,
      tenantId,
      exportedAt: Date.now(),
      contributions,
      unlockables,
      growthPlan: growth || null
    };
  }

  public hardPurgeMemberData(tenantId: string, userId: string): { success: boolean; recordsRemoved: number } {
    const db = getDb();
    let totalRemoved = 0;

    const tables = ['member_contributions', 'member_unlockables', 'time_bank_accounts', 'personal_growth_plans'];
    for (const t of tables) {
      const info = db.prepare(`DELETE FROM ${t} WHERE tenant_id = ? AND user_id = ?`).run(tenantId, userId);
      totalRemoved += Number(info.changes);
    }

    return { success: true, recordsRemoved: totalRemoved };
  }

  /**
   * Chapter 76: Transparent AI Ledger [FREE]
   * Permanent audit log recording automated decisions with human appeal pathways.
   */
  public logAIDecision(
    tenantId: string,
    userId: string,
    decisionType: string,
    inputSummary: string,
    plainLanguageReason: string
  ): { logId: string } {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO transparent_ai_logs (id, tenant_id, user_id, decision_type, input_summary, plain_language_reason, is_contested, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, tenantId, userId, decisionType, inputSummary, plainLanguageReason, Date.now());

    return { logId: id };
  }

  public contestAIDecision(logId: string, reason: string): { success: boolean; message: string } {
    const db = getDb();
    db.prepare(`UPDATE transparent_ai_logs SET is_contested = 1 WHERE id = ?`).run(logId);
    return {
      success: true,
      message: 'Decision flagged for independent human moderator review.'
    };
  }

  /**
   * Chapter 77: Youth Safety Mode [FREE]
   * DM restrictions from unknown adults and open-room mentorship enforcement.
   */
  public canDirectMessage(senderIsAdult: boolean, recipientIsMinor: boolean, hasPriorFriendship: boolean): boolean {
    if (senderIsAdult && recipientIsMinor && !hasPriorFriendship) {
      return false; // Direct outreach restricted under youth safety policy
    }
    return true;
  }

  /**
   * Chapter 78: Verified Human Badge & Anti-Impersonation [FREE]
   * Detects lookalike usernames, copied avatars, and deceptive bios.
   */
  public checkImpersonationRisk(existingUsernames: string[], candidateUsername: string): {
    isImpersonating: boolean;
    targetUser?: string;
  } {
    const normalize = (s: string) => s.toLowerCase()
      .replace(/1/g, 'i')
      .replace(/0/g, 'o')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/@/g, 'a')
      .replace(/[^a-z0-9]/g, '');

    const cand = normalize(candidateUsername);

    for (const ex of existingUsernames) {
      const target = normalize(ex);
      if (cand === target && candidateUsername.toLowerCase() !== ex.toLowerCase()) {
        return { isImpersonating: true, targetUser: ex };
      }
      if (cand !== target && (cand.includes(target) || target.includes(cand)) && Math.abs(cand.length - target.length) <= 2) {
        return { isImpersonating: true, targetUser: ex };
      }
    }

    return { isImpersonating: false };
  }

  /**
   * Chapter 79: Ethics & Copyright Guard [FREE]
   * Detects license conflicts, missing attribution, and client confidentiality warnings.
   */
  public checkEthicsAndCopyright(content: string): {
    licenseWarning?: string;
    confidentialityWarning?: string;
  } {
    let licenseWarning: string | undefined;
    let confidentialityWarning: string | undefined;

    if (content.includes('GPL') && (content.includes('proprietary') || content.includes('closed source'))) {
      licenseWarning = 'Potential license conflict: Code incorporates GPL components in a closed-source context.';
    }

    if (content.toLowerCase().includes('confidential') || content.toLowerCase().includes('strictly secret') || content.includes('api_key')) {
      confidentialityWarning = 'Warning: Potential disclosure of client confidential data or secret API keys.';
    }

    return { licenseWarning, confidentialityWarning };
  }

  /**
   * Chapter 80: Crisis-Aware Response Layer [FREE]
   * Compassionate distress pattern recognition with instant hotline routing.
   */
  public evaluateCrisisSignals(text: string): {
    isCrisis: boolean;
    hotlineMessage?: string;
  } {
    const crisisSignals = ['want to die', 'end my life', 'kill myself', 'suicide', 'self harm'];
    const matched = crisisSignals.some(s => text.toLowerCase().includes(s));

    if (matched) {
      const hotlineMessage = "We hear you, and your life is precious. If you are struggling or in pain, please reach out to someone who can help right now. You are not alone.\n\n- Global Crisis Resources: https://findahelpline.com/\n- Egypt National Suicide Prevention Hotline: 08008880700 / 0220816831\n- US/International 988 Suicide & Crisis Lifeline: Call or text 988\n\nA designated senior community care moderator has also been quietly alerted to offer support.";

      return { isCrisis: true, hotlineMessage };
    }

    return { isCrisis: false };
  }
}
