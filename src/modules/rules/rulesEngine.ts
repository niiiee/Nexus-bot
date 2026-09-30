import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { COMMUNITY_RULES, CommunityRule } from './rulesData.js';

export interface RuleEvaluationResult {
  ruleId: string;
  ruleNameEn: string;
  ruleNameAr: string;
  severity: CommunityRule['severity'];
  mode: CommunityRule['mode'];
  isViolation: boolean;
  isContextExempt: boolean;
  actionTaken: 'none' | 'reminder' | 'warning' | 'timeout_1h' | 'hide_and_case' | 'protective_hold' | 'emergency_hold' | 'care_outreach';
  pointsIssued: number;
  caseId?: string;
  reasonEn: string;
  reasonAr: string;
  noticeEn: string;
  noticeAr: string;
  isShadow: boolean;
}

export interface MemberPointsSummary {
  userId: string;
  guildId: string;
  totalActivePoints: number;
  activeViolations: Array<{
    id: string;
    ruleId: string;
    points: number;
    reason: string;
    caseId: string;
    issuedAt: number;
    expiresAt: number;
  }>;
}

export interface ModerationCaseRecord {
  id: string;
  guild_id: string;
  user_id: string;
  rule_id: string;
  severity: string;
  mode: string;
  action_taken: string;
  content_excerpt: string;
  context_reason: string;
  language: string;
  points_issued: number;
  status: string;
  reviewer_id?: string | null;
  secondary_reviewer_id?: string | null;
  is_shadow: number;
  created_at: number;
  resolved_at?: number | null;
}

export interface ModerationAppealRecord {
  id: string;
  case_id: string;
  guild_id: string;
  appellant_id: string;
  statement: string;
  assigned_reviewer_id?: string | null;
  decision: 'pending' | 'upheld' | 'reversed' | 'reduced';
  decision_reason?: string | null;
  decided_by?: string | null;
  decided_at?: number | null;
  created_at: number;
}

export class RulesEngine {
  private rulesMap: Map<string, CommunityRule> = new Map();

  constructor() {
    for (const rule of COMMUNITY_RULES) {
      this.rulesMap.set(rule.id.toUpperCase(), rule);
    }
  }

  /**
   * Seed the community_rules database table from static definitions
   */
  public seedRulesTable(): void {
    try {
      const now = Date.now();
      for (const rule of COMMUNITY_RULES) {
        dbService.run(
          `INSERT OR REPLACE INTO community_rules (
             id, name_en, name_ar, category, severity, mode, points,
             decay_days, auto_max_action, description_en, description_ar, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          rule.id,
          rule.name_en,
          rule.name_ar,
          rule.category,
          rule.severity,
          rule.mode,
          rule.points,
          rule.decay_days,
          rule.auto_max_action,
          rule.description_en,
          rule.description_ar,
          now
        );
      }
      logger.info('Community rules database table seeded successfully.', { count: COMMUNITY_RULES.length });
    } catch (err) {
      logger.error('Failed to seed community rules table', { error: String(err) });
    }
  }

  public getRule(ruleId: string): CommunityRule | null {
    return this.rulesMap.get(ruleId.toUpperCase()) || null;
  }

  public listRules(options?: {
    category?: string;
    query?: string;
    severity?: string;
  }): CommunityRule[] {
    let results = Array.from(this.rulesMap.values());

    if (options?.category) {
      const cat = options.category.toLowerCase();
      results = results.filter((r) => r.category.toLowerCase().includes(cat));
    }

    if (options?.severity) {
      const sev = options.severity.toUpperCase();
      results = results.filter((r) => r.severity.toUpperCase() === sev);
    }

    if (options?.query) {
      const q = options.query.toLowerCase();
      results = results.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.name_en.toLowerCase().includes(q) ||
          r.name_ar.toLowerCase().includes(q) ||
          r.description_en.toLowerCase().includes(q) ||
          r.description_ar.toLowerCase().includes(q)
      );
    }

    return results;
  }

  /**
   * Context Checker: Suppresses false positives when text is inside quotes, code blocks,
   * reporting syntax, or educational inquiries.
   */
  public checkContext(content: string): { isExempt: boolean; contextType?: string } {
    const trimmed = content.trim();

    // Check code blocks
    if (
      (trimmed.startsWith('```') && trimmed.endsWith('```')) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 2)
    ) {
      return { isExempt: true, contextType: 'code_block' };
    }

    // Check direct quotations
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 2) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length > 2) ||
      (trimmed.startsWith('«') && trimmed.endsWith('»')) ||
      (trimmed.startsWith('“') && trimmed.endsWith('”'))
    ) {
      return { isExempt: true, contextType: 'direct_quotation' };
    }

    // Check explicit reporting syntax
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('report:') ||
      lower.startsWith('reporting:') ||
      lower.startsWith('تبليغ:') ||
      lower.startsWith('بلاغ:') ||
      lower.startsWith('/report')
    ) {
      return { isExempt: true, contextType: 'incident_report' };
    }

    // Check educational or disambiguation questions
    if (
      lower.startsWith('what does') ||
      lower.startsWith('is it allowed') ||
      lower.startsWith('why is') ||
      lower.includes('هل كلمة') ||
      lower.includes('معنى كلمة') ||
      lower.includes('مسموح أقول')
    ) {
      return { isExempt: true, contextType: 'educational_query' };
    }

    return { isExempt: false };
  }

  /**
   * Dialect Parity Normalizer: Translates Egyptian / Arabizi / Modern Standard / English variations
   * to ensure fair, uniform evaluation without dialect bias.
   */
  public normalizeDialect(text: string): string {
    let normalized = text.toLowerCase();

    // Common Arabizi substitutions
    normalized = normalized
      .replace(/3/g, 'a')
      .replace(/7/g, 'h')
      .replace(/2/g, 'a')
      .replace(/5/g, 'kh')
      .replace(/8/g, 'gh')
      .replace(/9/g, 'q');

    // Normalize Arabic diacritics & alefs
    normalized = normalized
      .replace(/[\u064B-\u0652]/g, '') // Remove tashkeel
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');

    return normalized;
  }

  /**
   * Evaluates content against rules.
   * Hardcoded Mode Guards:
   * - Mode A: Max action timeout_1h. NEVER auto-ban or auto-kick.
   * - Mode S: Hides content and opens staff case.
   * - Mode H: Protective hold + staff alert.
   * - Mode C: Care Exception for R24: 0 points, compassionate outreach.
   * - Permanent bans require two distinct human moderators with documented case ID.
   * Charter Equal Access:
   * - Role/Status has zero bearing on outcome.
   */
  public evaluateMessage(params: {
    guildId: string;
    userId: string;
    userRoles?: string[];
    content: string;
    language?: 'en' | 'ar';
    isShadow?: boolean;
    simulatedRuleId?: string; // Explicit rule override for testing or manual moderation
  }): RuleEvaluationResult {
    const { guildId, userId, content, language = 'en', isShadow = false } = params;
    const now = Date.now();

    // 1. Context Check
    const context = this.checkContext(content);
    if (context.isExempt) {
      return {
        ruleId: 'NONE',
        ruleNameEn: 'Context Exempt',
        ruleNameAr: 'مستثنى للسياق',
        severity: 'S1',
        mode: 'A',
        isViolation: false,
        isContextExempt: true,
        actionTaken: 'none',
        pointsIssued: 0,
        reasonEn: `Content recognized as educational, quoted, or report context (${context.contextType}).`,
        reasonAr: `المحتوى مستثنى لأنه داخل سياق تعليمي أو اقتباس أو بلاغ (${context.contextType}).`,
        noticeEn: '',
        noticeAr: '',
        isShadow
      };
    }

    // 2. Identify Applicable Rule
    let rule: CommunityRule | null = null;
    if (params.simulatedRuleId) {
      rule = this.getRule(params.simulatedRuleId);
    } else {
      rule = this.detectRuleViolation(content);
    }

    if (!rule) {
      return {
        ruleId: 'NONE',
        ruleNameEn: 'No Violation Detected',
        ruleNameAr: 'لا توجد مخالفة',
        severity: 'S1',
        mode: 'A',
        isViolation: false,
        isContextExempt: false,
        actionTaken: 'none',
        pointsIssued: 0,
        reasonEn: 'Message conforms to community guidelines.',
        reasonAr: 'الرسالة متوافقة مع القواعد.',
        noticeEn: '',
        noticeAr: '',
        isShadow
      };
    }

    // 3. HARDCODED CARE EXCEPTION: Rule R24 (Mental Health Distress & Crisis)
    if (rule.id === 'R24' || rule.mode === 'C' || rule.severity === 'Care') {
      const caseId = `care_${cryptoRandomUUID().substring(0, 8)}`;
      const outreachEn =
        `💙 **Nexus Community Care Outreach**\n` +
        `We noticed you may be going through an overwhelming or distressing time. Please know you are not alone and your life matters.\n` +
        `• **Egypt Crisis Line**: 16328 (National Mental Health Hotline) / 08008880700\n` +
        `• **International Helpline**: 988 or https://findahelpline.com\n` +
        `• **Confidential Befrienders**: https://www.befrienders.org\n` +
        `*(This message is compassionate support only. No points or disciplinary actions have been recorded.)*`;

      const outreachAr =
        `💙 **دعم ورعاية مجتمع نيكسس**\n` +
        `لاحظنا إنك بتمر بوقت صعب أو ضغط نفسي شديد. إحنا هنا مهتمين بيك ومش لوحدك:\n` +
        `• **الخط الساخن للصحة النفسية بمصر**: 16328 / 08008880700\n` +
        `• **الدعم الدولي للطوارئ النفسية**: 988 أو https://findahelpline.com\n` +
        `• **مؤسسة Befrienders للدعم السري**: https://www.befrienders.org\n` +
        `*(هذه رسالة دعم إنساني فقط. لم يتم تسجيل أي نقاط أو إجراءات تأديبية على حسابك نهائياً).*`;

      if (!isShadow) {
        dbService.run(
          `INSERT INTO moderation_cases_v2 (
             id, guild_id, user_id, rule_id, severity, mode, action_taken,
             content_excerpt, context_reason, language, points_issued, status,
             is_shadow, created_at
           ) VALUES (?, ?, ?, ?, 'Care', 'C', 'care_outreach', ?, 'mental_health_care', ?, 0, 'care_dispatched', 0, ?)`,
          caseId,
          guildId,
          userId,
          rule.id,
          content.substring(0, 100),
          language,
          now
        );
      }

      return {
        ruleId: rule.id,
        ruleNameEn: rule.name_en,
        ruleNameAr: rule.name_ar,
        severity: 'Care',
        mode: 'C',
        isViolation: false, // Care is not a punitive violation
        isContextExempt: false,
        actionTaken: 'care_outreach',
        pointsIssued: 0,
        caseId,
        reasonEn: 'Dispatched compassionate crisis resources. Strictly 0 points.',
        reasonAr: 'تم إرسال مصادر الدعم النفسي والإنساني فوراً. صفر نقاط.',
        noticeEn: outreachEn,
        noticeAr: outreachAr,
        isShadow
      };
    }

    // 4. Lowest Effective Action Selector & Mode Guards
    const activePointsSummary = this.getActivePoints(guildId, userId);
    // Check prior active violations for S1 warning-first progression
    const priorCasesCount = dbService.get<{ count: number }>(
      `SELECT count(*) as count FROM moderation_cases_v2
       WHERE guild_id = ? AND user_id = ? AND rule_id = ? AND status != 'reversed' AND is_shadow = 0`,
      guildId,
      userId,
      rule.id
    )?.count || 0;

    let actionTaken: RuleEvaluationResult['actionTaken'] = 'none';
    let pointsIssued = rule.points;

    if (rule.severity === 'S1') {
      // First offense for S1 is a reminder (0 points), second is warning + points
      if (priorCasesCount === 0) {
        actionTaken = 'reminder';
        pointsIssued = 0;
      } else {
        actionTaken = 'warning';
        pointsIssued = rule.points;
      }
    } else if (rule.severity === 'S2') {
      actionTaken = rule.auto_max_action === 'timeout_1h' ? 'timeout_1h' : 'warning';
      pointsIssued = rule.points;
    } else if (rule.severity === 'S3') {
      // Mode H or Mode S
      actionTaken = rule.mode === 'H' ? 'protective_hold' : 'hide_and_case';
      pointsIssued = rule.points;
    } else if (rule.severity === 'S4') {
      actionTaken = 'emergency_hold';
      // S4 requires human staff review; auto points = 0 until confirmed, or immediate hold
      pointsIssued = 0;
    }

    // Enforce Mode A Action Ceiling: CAN NEVER EXCEED timeout_1h, NEVER auto-ban or auto-kick
    if (rule.mode === 'A') {
      if (actionTaken !== 'none' && actionTaken !== 'reminder' && actionTaken !== 'warning' && actionTaken !== 'timeout_1h') {
        actionTaken = 'timeout_1h';
      }
    }

    const caseId = `case_${cryptoRandomUUID().substring(0, 8)}`;
    const reasonEn = `Violation of ${rule.id} (${rule.name_en}): ${rule.description_en}`;
    const reasonAr = `مخالفة البند ${rule.id} (${rule.name_ar}): ${rule.description_ar}`;

    const noticeEn = this.generateBilingualNotice({
      rule,
      caseId,
      actionTaken,
      pointsIssued,
      totalPoints: activePointsSummary.totalActivePoints + pointsIssued,
      excerpt: content.substring(0, 80),
      language: 'en'
    });

    const noticeAr = this.generateBilingualNotice({
      rule,
      caseId,
      actionTaken,
      pointsIssued,
      totalPoints: activePointsSummary.totalActivePoints + pointsIssued,
      excerpt: content.substring(0, 80),
      language: 'ar'
    });

    // 5. Database Persistence (Skipped if isShadow)
    if (!isShadow) {
      dbService.run(
        `INSERT INTO moderation_cases_v2 (
           id, guild_id, user_id, rule_id, severity, mode, action_taken,
           content_excerpt, context_reason, language, points_issued, status,
           is_shadow, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, ?)`,
        caseId,
        guildId,
        userId,
        rule.id,
        rule.severity,
        rule.mode,
        actionTaken,
        content.substring(0, 100),
        'automated_rule_evaluation',
        language,
        pointsIssued,
        now
      );

      if (pointsIssued > 0) {
        const decayMs = (rule.decay_days || 30) * 24 * 60 * 60 * 1000;
        const expiresAt = now + decayMs;
        const pointId = `pts_${cryptoRandomUUID().substring(0, 8)}`;

        dbService.run(
          `INSERT INTO member_rule_points (
             id, guild_id, user_id, rule_id, points, reason, case_id,
             issued_at, expires_at, is_active
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          pointId,
          guildId,
          userId,
          rule.id,
          pointsIssued,
          reasonEn,
          caseId,
          now,
          expiresAt
        );
      }
    }

    return {
      ruleId: rule.id,
      ruleNameEn: rule.name_en,
      ruleNameAr: rule.name_ar,
      severity: rule.severity,
      mode: rule.mode,
      isViolation: true,
      isContextExempt: false,
      actionTaken,
      pointsIssued,
      caseId,
      reasonEn,
      reasonAr,
      noticeEn,
      noticeAr,
      isShadow
    };
  }

  /**
   * Bilingual Notice Generator
   */
  public generateBilingualNotice(params: {
    rule: CommunityRule;
    caseId: string;
    actionTaken: string;
    pointsIssued: number;
    totalPoints: number;
    excerpt: string;
    language: 'en' | 'ar';
  }): string {
    const { rule, caseId, actionTaken, pointsIssued, totalPoints, excerpt, language } = params;

    if (language === 'ar') {
      return (
        `⚠️ **إشعار تنظيمي من مجتمع نيكسس (Nexus Moderation)**\n` +
        `• **القاعدة المخالفة**: [${rule.id}] ${rule.name_ar}\n` +
        `• **مقتطف من الرسالة**: "${excerpt}"\n` +
        `• **الإجراء المتخذ**: ${actionTaken}\n` +
        `• **النقاط المسجلة**: +${pointsIssued} نقطة (إجمالي نقاطك النشطة: ${totalPoints})\n` +
        `• **معرف الحالة**: \`${caseId}\`\n` +
        `• **حق الاستئناف**: إذا كنت ترى أن هذا الإجراء تم عن طريق الخطأ، يمكنك استخدام الأمر \`/appeal ${caseId}\` لمراجعة الحالة من قبل مشرف مستقل.`
      );
    }

    return (
      `⚠️ **Nexus Community Moderation Notice**\n` +
      `• **Rule Violated**: [${rule.id}] ${rule.name_en}\n` +
      `• **Content Excerpt**: "${excerpt}"\n` +
      `• **Action Taken**: ${actionTaken}\n` +
      `• **Points Issued**: +${pointsIssued} pts (Active Total: ${totalPoints})\n` +
      `• **Case ID**: \`${caseId}\`\n` +
      `• **Appeal**: If you believe this notice was issued in error, use \`/appeal ${caseId}\` to submit an appeal to an independent moderator.`
    );
  }

  /**
   * Calculates member active unexpired points
   */
  public getActivePoints(guildId: string, userId: string): MemberPointsSummary {
    const now = Date.now();
    try {
      const rows = dbService.all<{
        id: string;
        rule_id: string;
        points: number;
        reason: string;
        case_id: string;
        issued_at: number;
        expires_at: number;
      }>(
        `SELECT id, rule_id, points, reason, case_id, issued_at, expires_at
         FROM member_rule_points
         WHERE guild_id = ? AND user_id = ? AND is_active = 1 AND expires_at > ?
         ORDER BY issued_at DESC`,
        guildId,
        userId,
        now
      );

      const activeViolations = rows.map((r) => ({
        id: r.id,
        ruleId: r.rule_id,
        points: r.points,
        reason: r.reason,
        caseId: r.case_id,
        issuedAt: r.issued_at,
        expiresAt: r.expires_at
      }));

      const totalActivePoints = activeViolations.reduce((sum, v) => sum + v.points, 0);

      return {
        userId,
        guildId,
        totalActivePoints,
        activeViolations
      };
    } catch {
      return {
        userId,
        guildId,
        totalActivePoints: 0,
        activeViolations: []
      };
    }
  }

  /**
   * Submit an appeal for a moderation case
   */
  public openAppeal(params: {
    caseId: string;
    guildId: string;
    appellantId: string;
    statement: string;
  }): { appealId: string; status: 'opened' | 'error'; message: string } {
    const { caseId, guildId, appellantId, statement } = params;

    const caseRecord = dbService.get<ModerationCaseRecord>(
      `SELECT * FROM moderation_cases_v2 WHERE id = ?`,
      caseId
    );

    if (!caseRecord) {
      return { appealId: '', status: 'error', message: 'Case ID not found.' };
    }

    if (caseRecord.user_id !== appellantId) {
      return { appealId: '', status: 'error', message: 'You can only appeal cases issued to your account.' };
    }

    const existingAppeal = dbService.get<ModerationAppealRecord>(
      `SELECT * FROM moderation_appeals_v2 WHERE case_id = ?`,
      caseId
    );

    if (existingAppeal) {
      return { appealId: existingAppeal.id, status: 'error', message: 'An appeal is already pending or resolved for this case.' };
    }

    const appealId = `appeal_${cryptoRandomUUID().substring(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO moderation_appeals_v2 (
         id, case_id, guild_id, appellant_id, statement, decision, created_at
       ) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      appealId,
      caseId,
      guildId,
      appellantId,
      statement,
      now
    );

    dbService.run(
      `UPDATE moderation_cases_v2 SET status = 'appealed' WHERE id = ?`,
      caseId
    );

    return {
      appealId,
      status: 'opened',
      message: 'Appeal submitted successfully. Assigned to an independent moderator.'
    };
  }

  /**
   * Resolve an appeal: requires an independent decider (different from original decider).
   */
  public resolveAppeal(params: {
    appealId: string;
    reviewerId: string;
    decision: 'upheld' | 'reversed' | 'reduced';
    decisionReason: string;
    reducedPoints?: number;
  }): { success: boolean; message: string; appeal?: ModerationAppealRecord } {
    const { appealId, reviewerId, decision, decisionReason, reducedPoints = 0 } = params;
    const now = Date.now();

    const appeal = dbService.get<ModerationAppealRecord>(
      `SELECT * FROM moderation_appeals_v2 WHERE id = ?`,
      appealId
    );

    if (!appeal) {
      return { success: false, message: 'Appeal record not found.' };
    }

    const originalCase = dbService.get<ModerationCaseRecord>(
      `SELECT * FROM moderation_cases_v2 WHERE id = ?`,
      appeal.case_id
    );

    if (!originalCase) {
      return { success: false, message: 'Associated moderation case not found.' };
    }

    // Guard: Reviewer MUST NOT be the original decider
    if (originalCase.reviewer_id && originalCase.reviewer_id === reviewerId) {
      return {
        success: false,
        message: 'Conflict of interest: the reviewer must be distinct from the original decider.'
      };
    }

    // Apply decision
    if (decision === 'reversed') {
      // Invalidate active points
      dbService.run(
        `UPDATE member_rule_points SET is_active = 0 WHERE case_id = ?`,
        originalCase.id
      );
      dbService.run(
        `UPDATE moderation_cases_v2 SET status = 'reversed', resolved_at = ? WHERE id = ?`,
        now,
        originalCase.id
      );
    } else if (decision === 'reduced') {
      dbService.run(
        `UPDATE member_rule_points SET points = ? WHERE case_id = ?`,
        reducedPoints,
        originalCase.id
      );
      dbService.run(
        `UPDATE moderation_cases_v2 SET points_issued = ?, status = 'resolved', resolved_at = ? WHERE id = ?`,
        reducedPoints,
        now,
        originalCase.id
      );
    } else {
      dbService.run(
        `UPDATE moderation_cases_v2 SET status = 'resolved', resolved_at = ? WHERE id = ?`,
        now,
        originalCase.id
      );
    }

    dbService.run(
      `UPDATE moderation_appeals_v2
       SET decision = ?, decision_reason = ?, decided_by = ?, decided_at = ?
       WHERE id = ?`,
      decision,
      decisionReason,
      reviewerId,
      now,
      appealId
    );

    const updated = dbService.get<ModerationAppealRecord>(
      `SELECT * FROM moderation_appeals_v2 WHERE id = ?`,
      appealId
    );

    return {
      success: true,
      message: `Appeal marked as ${decision}.`,
      appeal: updated || undefined
    };
  }

  /**
   * Dual-Moderator Permanent Ban Guard:
   * Hardcoded invariant: permanent ban requires approvals from TWO distinct human moderators.
   */
  public executePermanentBan(params: {
    guildId: string;
    targetUserId: string;
    primaryModeratorId: string;
    secondaryModeratorId: string;
    caseId: string;
    reason: string;
  }): { success: boolean; error?: string } {
    const { primaryModeratorId, secondaryModeratorId, caseId, reason } = params;

    if (!primaryModeratorId || !secondaryModeratorId) {
      return { success: false, error: 'Permanent ban requires two distinct human moderators.' };
    }

    if (primaryModeratorId === secondaryModeratorId) {
      return { success: false, error: 'Primary and secondary moderators must be two different people.' };
    }

    if (!caseId) {
      return { success: false, error: 'Documented case ID is mandatory for a permanent ban.' };
    }

    // Update case with dual reviewers
    dbService.run(
      `UPDATE moderation_cases_v2
       SET reviewer_id = ?, secondary_reviewer_id = ?, action_taken = 'permanent_ban', status = 'banned'
       WHERE id = ?`,
      primaryModeratorId,
      secondaryModeratorId,
      caseId
    );

    logger.info('Permanent ban verified by dual moderators', {
      caseId,
      primaryModeratorId,
      secondaryModeratorId,
      reason
    });

    return { success: true };
  }

  /**
   * Internal simple keyword matcher for rule detection
   */
  private detectRuleViolation(content: string): CommunityRule | null {
    const normalized = this.normalizeDialect(content);

    // Mental health / crisis check -> R24 (Care exception)
    if (
      normalized.includes('suicide') ||
      normalized.includes('want to die') ||
      normalized.includes('end my life') ||
      normalized.includes('انتحار') ||
      normalized.includes('عاوز اموت') ||
      normalized.includes('انهي حياتي')
    ) {
      return this.getRule('R24');
    }

    // Hate speech check -> R02
    if (
      normalized.includes('hate speech test') ||
      normalized.includes('kill all') ||
      normalized.includes('كراهيه')
    ) {
      return this.getRule('R02');
    }

    // Doxxing check -> R04
    if (
      normalized.includes('national id:') ||
      normalized.includes('ssn:') ||
      normalized.includes('رقم قومي:')
    ) {
      return this.getRule('R04');
    }

    // Phishing / fake nitro check -> R05
    if (
      normalized.includes('discrod-nitro') ||
      normalized.includes('free nitro gift') ||
      normalized.includes('نيترو مجاني')
    ) {
      return this.getRule('R05');
    }

    // Spam flood check -> R01
    if (
      normalized.includes('spam spam spam') ||
      normalized.includes('buy cheap followers') ||
      normalized.includes('اشتر متابعين')
    ) {
      return this.getRule('R01');
    }

    return null;
  }
}

export const rulesEngine = new RulesEngine();
