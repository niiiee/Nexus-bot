import { describe, it, expect } from 'vitest';
import { testGenerator } from '../../src/ai/generators/testGenerator.js';
import { codeSandbox } from '../../src/ai/evaluators/codeSandbox.js';
import { rubricGrader } from '../../src/ai/evaluators/rubricGrader.js';
import { restrictionService } from '../../src/discord/services/restrictionService.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';

describe('Phase 2: Live Skill Test & Sandbox Execution (Section 3)', () => {
  const guildId = 'guild_test_sec3';
  const userId = 'user_test_sec3';

  it('generates a unique multi-part test with hidden rubric', async () => {
    const testRecord = await testGenerator.generateLiveTest({
      userId,
      guildId,
      field: 'development',
      claimedYears: 4,
      tools: 'Node.js, Redis, PostgreSQL',
      language: 'en',
      timeboxMinutes: 30,
    });

    expect(testRecord.id).toBeDefined();
    expect(testRecord.timebox_minutes).toBe(30);

    const questions = JSON.parse(testRecord.questions_json);
    expect(questions.length).toBeGreaterThanOrEqual(2);

    const rubric = JSON.parse(testRecord.hidden_rubric_json);
    expect(rubric.passThreshold).toBe(50);
  });

  it('executes submitted code safely in sandbox with resource limits', async () => {
    // Valid code execution
    const validCode = 'console.log(1 + 2);';
    const validResult = await codeSandbox.executeJavaScript(validCode);
    expect(validResult.success).toBe(true);
    expect(validResult.stdout).toBe('3');

    // Security policy violation (e.g. process manipulation / filesystem)
    const hostileCode = 'require("child_process").execSync("dir");';
    const hostileResult = await codeSandbox.executeJavaScript(hostileCode);
    expect(hostileResult.success).toBe(false);
    expect(hostileResult.stderr).toContain('Security Policy Violation');

    // Infinite loop CPU timeout defense
    const infiniteLoop = 'while(true) {}';
    const loopResult = await codeSandbox.executeJavaScript(infiniteLoop);
    expect(loopResult.success).toBe(false);
    expect(loopResult.timedOut).toBe(true);
  });

  it('grades submitted answers using hidden rubric and self-reflection loop', async () => {
    const testRecord = await testGenerator.generateLiveTest({
      userId,
      guildId,
      field: 'development',
      claimedYears: 3,
      tools: 'TypeScript',
      language: 'en',
    });

    const answers = {
      q1: 'class LRUCache { constructor(capacity) { this.cap = capacity; this.map = new Map(); } }',
      q2: 'Fixing memory leak: ensure idle connection event listeners are detached upon client disconnect.',
    };

    const grade = await rubricGrader.gradeTest(testRecord, answers);
    expect(grade.score).toBeDefined();
    expect(grade.feedback).toBeDefined();
    expect(grade.selfReflection).toBeDefined();
  });

  it('applies Larper role and calculates restriction duration based on sentiment', () => {
    memberRepo.getOrCreate(userId, guildId, 'TestCandidate');

    // Failing score (30) with calm, respectful response
    const calmResult = restrictionService.applyRestriction({
      userId,
      guildId,
      score: 30,
      reactionText: 'Thank you for the review, I understand and will practice more.',
    });
    expect(calmResult.sentimentAdjustment).toBe('shorter_calm');
    expect(calmResult.durationHours).toBeLessThanOrEqual(50);

    // Failing score (20) with hostile, abusive response
    const hostileResult = restrictionService.applyRestriction({
      userId,
      guildId,
      score: 20,
      reactionText: 'Stupid bot, this test is garbage trash f*** this',
    });
    expect(hostileResult.sentimentAdjustment).toBe('longer_hostile');
    expect(hostileResult.durationHours).toBeGreaterThan(calmResult.durationHours);

    // Verify member is marked restricted in DB
    const member = memberRepo.get(userId);
    expect(member?.is_restricted).toBe(1);

    // Member appeals via /appeal
    const appeal = restrictionService.fileAppeal({
      userId,
      guildId,
      reason: 'I misunderstood question 2, please re-evaluate my portfolio repository.',
    });
    expect(appeal.appealId).toBeDefined();
    expect(appeal.status).toBe('pending');

    // Staff overrides/lifts restriction with one click
    const lifted = restrictionService.liftRestriction(userId, guildId, 'staff_lead', 'Appeal approved by CEO.');
    expect(lifted).toBe(true);
    expect(memberRepo.get(userId)?.is_restricted).toBe(0);
  });
});
