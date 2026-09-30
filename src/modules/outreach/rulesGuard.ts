import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export const MANDATORY_DISCLOSURE_EN = "I'm the Nexus community helper, an AI-assisted account run by our team.";
export const MANDATORY_DISCLOSURE_AR = "أنا المساعد الذكي لمجتمع Nexus، حساب مدعوم بالذكاء الاصطناعي يُدار بواسطة فريقنا.";

export interface RulesValidationResult {
  allowed: boolean;
  reason?: string;
  violations?: string[];
}

export class OutreachRulesGuard {
  private killSwitchActive: boolean = false;
  private killSwitchReason: string = '';
  private registeredAccounts: Map<string, string> = new Map(); // platform -> official handle

  constructor() {
    // Hard-coded official single accounts per platform (REQ-21.0.2)
    this.registeredAccounts.set('reddit', 'u/NexusCommunityHelper');
    this.registeredAccounts.set('stackoverflow', 'nexus-community-helper');
    this.registeredAccounts.set('hackernews', 'nexus_helper');
    this.registeredAccounts.set('devto', 'nexus_helper');
    this.registeredAccounts.set('facebook', 'Nexus Community Assistance (Manual Submission Only)');
  }

  /**
   * REQ-21.0.9: Emergency Kill Switch
   */
  public isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  public setKillSwitch(active: boolean, reason: string = 'Owner command'): void {
    this.killSwitchActive = active;
    this.killSwitchReason = reason;
    if (active) {
      logger.warn(`[RulesGuard] EMERGENCY KILL SWITCH ACTIVATED: ${reason}. Halting all outreach immediately.`);
    } else {
      logger.info(`[RulesGuard] Emergency kill switch deactivated by owner.`);
    }
  }

  public getKillSwitchReason(): string {
    return this.killSwitchReason;
  }

  /**
   * REQ-21.0.1: Transparency & Mandatory Disclosure Line
   */
  public verifyDisclosure(text: string): boolean {
    const hasEn = text.includes(MANDATORY_DISCLOSURE_EN) || 
                  text.toLowerCase().includes("ai-assisted account run by our team") ||
                  text.toLowerCase().includes("nexus community helper");
    const hasAr = text.includes(MANDATORY_DISCLOSURE_AR) || 
                  text.includes("المساعد الذكي لمجتمع Nexus") ||
                  text.includes("مدعوم بالذكاء الاصطناعي");
    return hasEn || hasAr;
  }

  /**
   * REQ-21.0.1: Verify outward-facing account bio
   */
  public verifyAccountProfile(bio: string): boolean {
    const lower = bio.toLowerCase();
    return lower.includes('ai-assisted community helper for nexus') || 
           bio.includes('مساعد مجتمع ذكي لـ Nexus');
  }

  /**
   * REQ-21.0.2: One Account Per Platform
   */
  public validateAccountUniqueness(platform: string, handle: string): boolean {
    const officialHandle = this.registeredAccounts.get(platform.toLowerCase());
    if (!officialHandle) return false;
    return officialHandle.toLowerCase() === handle.toLowerCase();
  }

  /**
   * REQ-21.0.3: Platform rules & Facebook manual-only enforcement
   */
  public validatePlatformIngestion(params: {
    platform: string;
    isManualSubmission?: boolean;
    hasWrittenAdminPermission?: boolean;
  }): { allowed: boolean; reason?: string } {
    const platform = params.platform.toLowerCase();
    if (platform === 'facebook') {
      if (params.hasWrittenAdminPermission) {
        return { allowed: true };
      }
      if (!params.isManualSubmission) {
        return {
          allowed: false,
          reason: 'Facebook scraping is forbidden. Only manual human submission or written admin permission is permitted.',
        };
      }
    }
    return { allowed: true };
  }

  /**
   * REQ-21.0.6: Zero unsolicited DMs (Public threads only)
   */
  public validateChannelType(channelType: 'public_thread' | 'dm', initiatedByRecipient: boolean = false): boolean {
    if (channelType === 'dm' && !initiatedByRecipient) {
      return false; // strictly forbidden
    }
    return true;
  }

  /**
   * REQ-21.0.7: Stop means stop (permanent stoplist)
   */
  public isStopped(targetIdentifier: string, platform: string): boolean {
    try {
      const row = dbService.get<{ id: string }>(
        `SELECT id FROM outreach_stoplist WHERE target_identifier = ? AND (platform = ? OR platform = 'global')`,
        targetIdentifier,
        platform
      );
      return !!row;
    } catch {
      return false;
    }
  }

  public addToStoplist(targetIdentifier: string, platform: string, reason: string): void {
    try {
      dbService.run(
        `INSERT OR REPLACE INTO outreach_stoplist (id, target_identifier, platform, reason, added_at)
         VALUES (?, ?, ?, ?, ?)`,
        cryptoRandomUUID(),
        targetIdentifier,
        platform,
        reason,
        Date.now()
      );
      logger.info(`[RulesGuard] Permanently stoplisted ${targetIdentifier} on ${platform}: ${reason}`);
    } catch (err) {
      logger.error('[RulesGuard] Failed to add to stoplist:', err);
    }
  }

  public getStoplist(): Array<{ id: string; targetIdentifier: string; platform: string; reason: string; addedAt: number }> {
    try {
      const rows = dbService.all<{ id: string; target_identifier: string; platform: string; reason: string; added_at: number }>(
        `SELECT * FROM outreach_stoplist ORDER BY added_at DESC`
      );
      return rows.map(r => ({
        id: r.id,
        targetIdentifier: r.target_identifier,
        platform: r.platform,
        reason: r.reason,
        addedAt: r.added_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * REQ-21.0.8: Data minimization / anti-profiling check
   */
  public sanitizeCandidateData(data: {
    postUrl: string;
    problemSummary: string;
    category: string;
    rawContent?: string;
  }): { postUrl: string; problemSummary: string; category: string } {
    // Only store URL, brief problem summary, and category. Never store full user profiles or PII.
    return {
      postUrl: data.postUrl,
      problemSummary: data.problemSummary.slice(0, 300),
      category: data.category,
    };
  }

  /**
   * REQ-21.2.4: Safety filters for sensitive topics
   */
  public isSensitiveTopic(content: string): { isSensitive: boolean; reason?: string } {
    const lower = content.toLowerCase();

    // Medical, self-harm, crisis
    if (lower.includes('suicide') || lower.includes('self-harm') || lower.includes('depression') || lower.includes('medical diagnosis') || lower.includes('cancer treatment')) {
      return { isSensitive: true, reason: 'Medical/Crisis topic' };
    }

    // Legal disputes
    if (lower.includes('lawsuit') || lower.includes('court') || lower.includes('sue my client') || lower.includes('arrested') || lower.includes('legal counsel')) {
      return { isSensitive: true, reason: 'Active legal dispute' };
    }

    // Minors
    if (lower.includes('i am 13') || lower.includes('i am 14') || lower.includes('underage') || lower.includes('middle school child')) {
      return { isSensitive: true, reason: 'Minor protection' };
    }

    return { isSensitive: false };
  }

  /**
   * Comprehensive validation for publishing an outbound message
   */
  public validateOutboundPublish(params: {
    text: string;
    platform: string;
    community: string;
    targetUser: string;
    isHumanApproved: boolean;
    channelType: 'public_thread' | 'dm';
    userInitiatedDm?: boolean;
  }): RulesValidationResult {
    const violations: string[] = [];

    // 1. Kill switch
    if (this.killSwitchActive) {
      violations.push(`Outreach halted by emergency kill switch: ${this.killSwitchReason}`);
    }

    // 2. Human approval (REQ-21.0.4)
    if (!params.isHumanApproved) {
      violations.push('Outbound publish requires explicit human Community Ambassador approval');
    }

    // 3. Disclosure verification (REQ-21.0.1)
    if (!this.verifyDisclosure(params.text)) {
      violations.push('Mandatory AI helper disclosure line is missing from the message');
    }

    // 4. Channel type / No unsolicited DM (REQ-21.0.6)
    if (!this.validateChannelType(params.channelType, params.userInitiatedDm)) {
      violations.push('Unsolicited direct messaging is strictly forbidden');
    }

    // 5. Stoplist check (REQ-21.0.7)
    if (this.isStopped(params.targetUser, params.platform)) {
      violations.push(`Recipient ${params.targetUser} is on the permanent stoplist`);
    }

    if (this.isStopped(params.community, params.platform)) {
      violations.push(`Community ${params.community} is on the permanent stoplist`);
    }

    return {
      allowed: violations.length === 0,
      reason: violations.join('; '),
      violations,
    };
  }
}

export const outreachRulesGuard = new OutreachRulesGuard();
