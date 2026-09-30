import { describe, it, expect } from 'vitest';
import { moderationAssist } from '../../src/ai/safety/moderationAssist.js';
import { analyticsService } from '../../src/modules/analytics/analyticsService.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';

describe('Phase 3: Moderation Assist & Server Analytics (Section 7.5, 7.6)', () => {
  const guildId = 'guild_mod_analytics';
  const userId = 'user_mod_1';

  it('detects sensitive credential and token leaks', () => {
    // Discord Token
    const resDiscord = moderationAssist.checkMessage(
      userId,
      guildId,
      'My bot token is NTI3NjI5ODc1MDc1MjE5NDU2.XmBvQA.123456789012345678901234567 please help'
    );
    expect(resDiscord.isViolating).toBe(true);
    expect(resDiscord.actionRequired).toBe('delete');
    expect(resDiscord.violationType).toBe('credential_leak');

    // Gemini API key
    const resGemini = moderationAssist.checkMessage(
      userId,
      guildId,
      'Here is the key: AIzaSyD9x7Q2M4abcdefghij1234567890123'
    );
    expect(resGemini.isViolating).toBe(true);
    expect(resGemini.violationType).toBe('credential_leak');
  });

  it('detects known phishing URLs and flags for staff review', () => {
    const resPhish = moderationAssist.checkMessage(
      userId,
      guildId,
      'Claim your free Discord nitro gift here: https://discrod-nitro.gift/claim'
    );
    expect(resPhish.isViolating).toBe(true);
    expect(resPhish.actionRequired).toBe('escalate_staff');
    expect(resPhish.violationType).toBe('phishing');
  });

  it('detects rapid spam bursts from malicious actors', () => {
    const spammerId = 'user_spammer_rapid';
    let lastVerdict = moderationAssist.checkMessage(spammerId, guildId, 'Hello 1');

    for (let i = 2; i <= 9; i++) {
      lastVerdict = moderationAssist.checkMessage(spammerId, guildId, `Rapid spam message ${i}`);
    }

    expect(lastVerdict.isViolating).toBe(true);
    expect(lastVerdict.violationType).toBe('spam');
    expect(lastVerdict.actionRequired).toBe('escalate_staff');
  });

  it('generates comprehensive guild analytics covering growth, vetting, and funnel', () => {
    memberRepo.getOrCreate('m1', guildId, 'UserOne');
    memberRepo.getOrCreate('m2', guildId, 'UserTwo');

    const summary = analyticsService.getGuildAnalytics(guildId);
    expect(summary.totalMembers).toBeGreaterThanOrEqual(2);
    expect(summary.lifecycleDistribution).toBeDefined();
    expect(summary.vettingStats).toBeDefined();
    expect(summary.taskStats).toBeDefined();
    expect(summary.dealsStats).toBeDefined();
    expect(summary.funnel).toBeDefined();
  });
});
