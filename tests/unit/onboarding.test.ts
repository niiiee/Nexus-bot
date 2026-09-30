import { describe, it, expect, beforeEach } from 'vitest';
import { onboardingService } from '../../src/discord/services/onboardingService.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';

describe('Phase 2: Onboarding Flow (Section 1)', () => {
  const guildId = 'guild_onboard_1';
  const userId = 'user_onboard_1';

  beforeEach(() => {
    memberRepo.getOrCreate(userId, guildId, 'DevUser');
  });

  it('generates a personalized welcome embed with rules and tone', () => {
    const welcomeEn = onboardingService.getWelcomeEmbed('DevUser', 'en');
    expect(welcomeEn.title).toContain('Welcome');
    expect(welcomeEn.description).toContain('DevUser');
    expect(welcomeEn.fields.some(f => f.name.includes('Rules'))).toBe(true);

    const welcomeAr = onboardingService.getWelcomeEmbed('DevUser', 'ar');
    expect(welcomeAr.title).toContain('يا باشا');
    expect(welcomeAr.description).toContain('DevUser');
  });

  it('conducts conversational intake interview and records profile', async () => {
    onboardingService.startOnboarding(userId, guildId, 'DevUser', 'en');

    // Step 1: Field
    const step1 = await onboardingService.processAnswer(userId, 'I am a backend development specialist');
    expect(step1.isComplete).toBe(false);
    expect(step1.reply).toContain('development');

    // Step 2: Experience
    const step2 = await onboardingService.processAnswer(userId, '2 years');
    expect(step2.isComplete).toBe(false);
    expect(step2.reply).toContain('tools');

    // Step 3: Tools
    const step3 = await onboardingService.processAnswer(userId, 'Node.js, TypeScript, PostgreSQL, Docker');
    expect(step3.isComplete).toBe(false);

    // Step 4: Goals
    const step4 = await onboardingService.processAnswer(userId, 'Finding freelance contracts and collaborating with designers');
    expect(step4.isComplete).toBe(false);
    expect(step4.reply).toContain('vetting questions');

    // Verify member record was updated in database
    const member = memberRepo.get(userId);
    expect(member?.claimed_experience_years).toBe(2);
    expect(member?.tools).toContain('TypeScript');
    expect(member?.goals).toContain('freelance');
  });

  it('triggers live skill test immediately when experience >= 3 years', async () => {
    const seniorUserId = 'user_senior_claim';
    onboardingService.startOnboarding(seniorUserId, guildId, 'SeniorLead', 'en');

    await onboardingService.processAnswer(seniorUserId, 'Fullstack web development');
    await onboardingService.processAnswer(seniorUserId, '5 years of enterprise experience');
    await onboardingService.processAnswer(seniorUserId, 'Go, React, Kubernetes');
    const triggerRes = await onboardingService.processAnswer(seniorUserId, 'Lead complex client projects');

    expect(triggerRes.requiresTest).toBe(true);
    expect(triggerRes.testId).toBeDefined();
    expect(triggerRes.reply).toContain('live skill test');
  });
});
