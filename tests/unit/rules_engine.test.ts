import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { rulesEngine, RulesEngine } from '../../src/modules/rules/rulesEngine.js';
import { COMMUNITY_RULES } from '../../src/modules/rules/rulesData.js';

describe('Section 26.3: Rules Engine Behavioral Suite (R01-R50)', () => {
  const guildId = 'guild_rules_test';
  const ownerId = 'user_owner_rules';
  const newcomerId = 'user_newcomer_rules';
  const mod1 = 'moderator_human_1';
  const mod2 = 'moderator_human_2';

  beforeEach(() => {
    // Seed rules
    rulesEngine.seedRulesTable();
  });

  it('loads all 50 bilingual rules with severities, modes, and points', () => {
    expect(COMMUNITY_RULES.length).toBe(50);
    const r01 = rulesEngine.getRule('R01');
    expect(r01).toBeDefined();
    expect(r01?.severity).toBe('S1');
    expect(r01?.mode).toBe('A');
    expect(r01?.points).toBe(1);

    const r24 = rulesEngine.getRule('R24');
    expect(r24).toBeDefined();
    expect(r24?.severity).toBe('Care');
    expect(r24?.mode).toBe('C');
    expect(r24?.points).toBe(0);

    const r50 = rulesEngine.getRule('R50');
    expect(r50).toBeDefined();
    expect(r50?.id).toBe('R50');
  });

  it('filters and searches rules by category and bilingual text', () => {
    const safetyRules = rulesEngine.listRules({ category: 'Safety' });
    expect(safetyRules.length).toBeGreaterThanOrEqual(10);

    const spamSearch = rulesEngine.listRules({ query: 'سبام' });
    expect(spamSearch.length).toBeGreaterThanOrEqual(1);
    expect(spamSearch[0].id).toBe('R01');

    const enSearch = rulesEngine.listRules({ query: 'harassment' });
    expect(enSearch.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces lowest effective action for S1: reminder on first offense, points on second', () => {
    const user = `user_s1_${Date.now()}`;

    // 1st offense -> Reminder with 0 points
    const res1 = rulesEngine.evaluateMessage({
      guildId,
      userId: user,
      content: 'spam spam spam repetitive links buy cheap followers'
    });

    expect(res1.isViolation).toBe(true);
    expect(res1.ruleId).toBe('R01');
    expect(res1.actionTaken).toBe('reminder');
    expect(res1.pointsIssued).toBe(0);

    // Active points should still be 0
    const pointsAfterFirst = rulesEngine.getActivePoints(guildId, user);
    expect(pointsAfterFirst.totalActivePoints).toBe(0);

    // 2nd offense -> Warning with points
    const res2 = rulesEngine.evaluateMessage({
      guildId,
      userId: user,
      content: 'spam spam spam buy cheap followers again'
    });

    expect(res2.isViolation).toBe(true);
    expect(res2.actionTaken).toBe('warning');
    expect(res2.pointsIssued).toBe(1);

    const pointsAfterSecond = rulesEngine.getActivePoints(guildId, user);
    expect(pointsAfterSecond.totalActivePoints).toBe(1);
    expect(pointsAfterSecond.activeViolations.length).toBe(1);
  });

  it('enforces Mode H protective hold on R02 hate speech and never auto-bans', () => {
    const user = `user_hate_${Date.now()}`;
    const res = rulesEngine.evaluateMessage({
      guildId,
      userId: user,
      content: 'hate speech test kill all minorities'
    });

    expect(res.isViolation).toBe(true);
    expect(res.ruleId).toBe('R02');
    expect(res.mode).toBe('H');
    expect(res.actionTaken).toBe('protective_hold');
    // Inviolable guarantee: CANNOT be auto-ban
    expect(res.actionTaken).not.toBe('permanent_ban');
    expect(res.actionTaken).not.toBe('kick');

    // Case created in DB
    const caseRecord = dbService.get<{ action_taken: string; status: string }>(
      `SELECT action_taken, status FROM moderation_cases_v2 WHERE id = ?`,
      res.caseId
    );
    expect(caseRecord?.action_taken).toBe('protective_hold');
    expect(caseRecord?.status).toBe('open');
  });

  it('strictly applies Care Exception (R24) with zero points and compassionate resources', () => {
    const user = `user_crisis_${Date.now()}`;
    const res = rulesEngine.evaluateMessage({
      guildId,
      userId: user,
      content: 'I want to die, I feel hopeless and I want to end my life',
      language: 'ar'
    });

    expect(res.ruleId).toBe('R24');
    expect(res.mode).toBe('C');
    expect(res.severity).toBe('Care');
    expect(res.pointsIssued).toBe(0);
    expect(res.actionTaken).toBe('care_outreach');
    expect(res.isViolation).toBe(false); // Care is not a punitive violation

    // Check points in DB - must be 0
    const pointsSummary = rulesEngine.getActivePoints(guildId, user);
    expect(pointsSummary.totalActivePoints).toBe(0);
    expect(pointsSummary.activeViolations.length).toBe(0);

    // Notice contains official helpline info
    expect(res.noticeAr).toContain('16328');
    expect(res.noticeAr).toContain('لم يتم تسجيل أي نقاط');
  });

  it('guarantees Charter Equal Access: Owner vs Newcomer receive identical decisions', () => {
    const testContent = 'spam spam spam buy cheap followers';

    const ownerRes = rulesEngine.evaluateMessage({
      guildId,
      userId: ownerId,
      userRoles: ['owner', 'admin', 'vip_donor'],
      content: testContent
    });

    const newcomerRes = rulesEngine.evaluateMessage({
      guildId,
      userId: newcomerId,
      userRoles: ['newcomer'],
      content: testContent
    });

    // Both get identical action and points
    expect(ownerRes.ruleId).toBe(newcomerRes.ruleId);
    expect(ownerRes.severity).toBe(newcomerRes.severity);
    expect(ownerRes.mode).toBe(newcomerRes.mode);
    expect(ownerRes.actionTaken).toBe(newcomerRes.actionTaken);
    expect(ownerRes.pointsIssued).toBe(newcomerRes.pointsIssued);
  });

  it('suppresses false positives when content is in quotes, code blocks, or educational queries', () => {
    const codeBlock = '```\nconst x = "spam spam spam buy cheap followers";\n```';
    const res1 = rulesEngine.evaluateMessage({ guildId, userId: 'u1', content: codeBlock });
    expect(res1.isContextExempt).toBe(true);
    expect(res1.isViolation).toBe(false);

    const quoted = '"spam spam spam buy cheap followers"';
    const res2 = rulesEngine.evaluateMessage({ guildId, userId: 'u1', content: quoted });
    expect(res2.isContextExempt).toBe(true);
    expect(res2.isViolation).toBe(false);

    const report = 'report: user sent spam spam spam';
    const res3 = rulesEngine.evaluateMessage({ guildId, userId: 'u1', content: report });
    expect(res3.isContextExempt).toBe(true);
    expect(res3.isViolation).toBe(false);

    const inquiry = 'هل كلمة spam spam spam ممنوعة في السيرفر؟';
    const res4 = rulesEngine.evaluateMessage({ guildId, userId: 'u1', content: inquiry });
    expect(res4.isContextExempt).toBe(true);
    expect(res4.isViolation).toBe(false);
  });

  it('normalizes Arabizi and Egyptian dialect to enforce dialect parity', () => {
    // Egyptian Arabic crisis
    const resAr = rulesEngine.evaluateMessage({
      guildId,
      userId: 'u_eg',
      content: 'مش قادر استحمل خلاص وعاوز اموت'
    });
    expect(resAr.ruleId).toBe('R24');
    expect(resAr.severity).toBe('Care');

    // Hate speech in Arabic
    const resHateAr = rulesEngine.evaluateMessage({
      guildId,
      userId: 'u_eg2',
      content: 'كراهية واعتداء'
    });
    expect(resHateAr.ruleId).toBe('R02');
  });

  it('executes shadow mode without writing cases or points to the database', () => {
    const user = `user_shadow_${Date.now()}`;
    const res = rulesEngine.evaluateMessage({
      guildId,
      userId: user,
      content: 'spam spam spam buy cheap followers',
      isShadow: true
    });

    expect(res.isShadow).toBe(true);
    expect(res.isViolation).toBe(true);

    // Zero rows written
    const points = rulesEngine.getActivePoints(guildId, user);
    expect(points.totalActivePoints).toBe(0);

    const caseCount = dbService.get<{ count: number }>(
      `SELECT count(*) as count FROM moderation_cases_v2 WHERE user_id = ?`,
      user
    );
    expect(caseCount?.count).toBe(0);
  });

  it('enforces that permanent bans require two distinct human moderators with documented case ID', () => {
    const target = 'bad_actor_user';
    const caseId = 'case_ban_test_1';

    // Seed case
    dbService.run(
      `INSERT INTO moderation_cases_v2 (
         id, guild_id, user_id, rule_id, severity, mode, action_taken,
         content_excerpt, context_reason, language, points_issued, status,
         is_shadow, created_at
       ) VALUES (?, ?, ?, 'R08', 'S4', 'H', 'emergency_hold', 'token stealer', 'exploit', 'en', 0, 'open', 0, ?)`,
      caseId,
      guildId,
      target,
      Date.now()
    );

    // Fail: single moderator
    const fail1 = rulesEngine.executePermanentBan({
      guildId,
      targetUserId: target,
      primaryModeratorId: mod1,
      secondaryModeratorId: '',
      caseId,
      reason: 'Malware'
    });
    expect(fail1.success).toBe(false);

    // Fail: identical moderator IDs (self-approval)
    const fail2 = rulesEngine.executePermanentBan({
      guildId,
      targetUserId: target,
      primaryModeratorId: mod1,
      secondaryModeratorId: mod1,
      caseId,
      reason: 'Malware'
    });
    expect(fail2.success).toBe(false);
    expect(fail2.error).toContain('two different people');

    // Success: two distinct human moderators
    const success = rulesEngine.executePermanentBan({
      guildId,
      targetUserId: target,
      primaryModeratorId: mod1,
      secondaryModeratorId: mod2,
      caseId,
      reason: 'Confirmed malware distribution'
    });
    expect(success.success).toBe(true);

    const caseRecord = dbService.get<{ status: string; action_taken: string }>(
      `SELECT status, action_taken FROM moderation_cases_v2 WHERE id = ?`,
      caseId
    );
    expect(caseRecord?.status).toBe('banned');
    expect(caseRecord?.action_taken).toBe('permanent_ban');
  });

  it('handles appeal submission and reversal by an independent decider with conflict-of-interest guard', () => {
    const user = `user_appeal_${Date.now()}`;
    const testCaseId = `case_test_app_${Date.now()}`;
    const originalMod = 'mod_original_decider';
    const independentMod = 'mod_independent_reviewer';

    // Create case with issued points
    dbService.run(
      `INSERT INTO moderation_cases_v2 (
         id, guild_id, user_id, rule_id, severity, mode, action_taken,
         content_excerpt, context_reason, language, points_issued, status,
         reviewer_id, is_shadow, created_at
       ) VALUES (?, ?, ?, 'R01', 'S1', 'A', 'warning', 'snippet', 'reason', 'en', 1, 'open', ?, 0, ?)`,
      testCaseId,
      guildId,
      user,
      originalMod,
      Date.now()
    );

    dbService.run(
      `INSERT INTO member_rule_points (
         id, guild_id, user_id, rule_id, points, reason, case_id,
         issued_at, expires_at, is_active
       ) VALUES ('pt_app_1', ?, ?, 'R01', 1, 'spam', ?, ?, ?, 1)`,
      guildId,
      user,
      testCaseId,
      Date.now(),
      Date.now() + 1000000
    );

    // Appellant opens appeal
    const appealRes = rulesEngine.openAppeal({
      caseId: testCaseId,
      guildId,
      appellantId: user,
      statement: 'It was a misunderstanding, I was sharing an open-source tutorial.'
    });

    expect(appealRes.status).toBe('opened');
    expect(appealRes.appealId).toBeDefined();

    // Guard: original decider CANNOT decide their own appeal
    const conflictRes = rulesEngine.resolveAppeal({
      appealId: appealRes.appealId,
      reviewerId: originalMod, // Same person
      decision: 'reversed',
      decisionReason: 'I changed my mind'
    });
    expect(conflictRes.success).toBe(false);
    expect(conflictRes.message).toContain('Conflict of interest');

    // Independent reviewer reverses the decision
    const resolveRes = rulesEngine.resolveAppeal({
      appealId: appealRes.appealId,
      reviewerId: independentMod, // Distinct person
      decision: 'reversed',
      decisionReason: 'Verified educational context; appeal granted.'
    });
    expect(resolveRes.success).toBe(true);
    expect(resolveRes.appeal?.decision).toBe('reversed');

    // Points should now be deactivated
    const pointsSummary = rulesEngine.getActivePoints(guildId, user);
    expect(pointsSummary.totalActivePoints).toBe(0);
  });
});
