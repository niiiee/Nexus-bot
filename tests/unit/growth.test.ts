import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { inviteTrackerService } from '../../src/modules/growth/inviteTracker.js';
import { referralEngine } from '../../src/modules/growth/referralEngine.js';
import { lifecycleManagerService } from '../../src/modules/growth/lifecycleManager.js';
import { churnPredictorService } from '../../src/modules/growth/churnPredictor.js';
import { onboardingQuestsService } from '../../src/modules/growth/onboardingQuests.js';
import { winBackCampaignService } from '../../src/modules/growth/winBackCampaign.js';
import { notificationLimiterService } from '../../src/modules/growth/notificationLimiter.js';
import { feedbackLoopsService } from '../../src/modules/growth/feedbackLoops.js';
import { abTestingService } from '../../src/modules/growth/abTesting.js';
import { communityHealthService } from '../../src/modules/growth/communityHealth.js';

describe('Growth Engine (Section 15)', () => {
  const guildId = 'guild_growth_123';
  const userId = 'user_growth_456';

  beforeEach(() => {
    // Clean and seed member
    dbService.run(`DELETE FROM members WHERE guild_id = ?`, guildId);
    const now = Date.now();
    dbService.run(
      `INSERT INTO members (user_id, guild_id, username, credits, xp, reputation_score, created_at, updated_at)
       VALUES (?, ?, 'GrowthUser', 100, 200, 75, ?, ?)`,
      userId,
      guildId,
      now - 10 * 24 * 60 * 60 * 1000,
      now
    );
  });

  it('REQ-15.1: inviteTracker tracks invite codes and increments usage', () => {
    const invite = inviteTrackerService.registerInvite({
      guildId,
      code: 'PROMO2026',
      inviterId: userId,
      sourceCampaign: 'welcome_promo',
    });
    expect(invite.code).toBe('PROMO2026');
    expect(invite.sourceCampaign).toBe('welcome_promo');

    inviteTrackerService.trackJoin(invite.code);
    const metrics = inviteTrackerService.getFunnelMetrics(guildId, 'welcome_promo');
    expect(metrics.totalJoined).toBeGreaterThanOrEqual(1);
  });

  it('REQ-15.2: referralEngine handles referral creation and reward payout', () => {
    const newMemberId = 'new_member_789';
    const ref = referralEngine.registerReferral({
      guildId,
      referrerId: userId,
      referredId: newMemberId,
    });
    expect(ref.success).toBe(true);

    const verified = referralEngine.handleReferredUserVerified(newMemberId, guildId);
    expect(verified).toBe(true);
  });

  it('REQ-15.3: lifecycleManager evaluates lifecycle stage correctly', () => {
    const stage = lifecycleManagerService.evaluateLifecycleStage({
      daysSinceJoined: 15,
      daysSinceLastActive: 2,
      reputationScore: 50,
      verifiedTasksOrProjects: 4,
    });
    expect(stage).toBe('Contributor');
  });

  it('REQ-15.4: churnPredictor computes churn risk from inactivity', () => {
    const risk = churnPredictorService.predictChurn({
      userId,
      daysInactive: 25,
      hasFailedSkillTest: false,
      unansweredQuestionsCount: 1,
      currentCredits: 50,
      lang: 'en',
    });
    expect(risk.churnRiskScore).toBeGreaterThanOrEqual(40);
    expect(risk.recommendedAction).toBe('winback_offer');
  });

  it('REQ-15.5: onboardingQuests seeds and checks quest completion', () => {
    const quests = onboardingQuestsService.getMemberQuestProgress(userId);
    expect(quests.length).toBe(7);

    const completed = onboardingQuestsService.completeQuest(userId, guildId, 1);
    expect(completed.success).toBe(true);
  });

  it('REQ-15.6: winBackCampaign generates digest and redeems welcome back promo', () => {
    const digest = winBackCampaignService.generateDigest(userId, guildId, 20, 'ar');
    expect(digest.welcomeBackPerk.code).toContain('WELCOMEBACK-');
    expect(digest.formattedMessage).toContain('وحشتنا يا باشا');

    const claimed = winBackCampaignService.claimReturnPerk(userId, guildId, digest.welcomeBackPerk.code, 75);
    expect(claimed.success).toBe(true);
  });

  it('REQ-15.7: notificationLimiter enforces limits and permits security bypass', () => {
    notificationLimiterService.resetLimits(userId);

    // Security bypass
    const sec = notificationLimiterService.canSendDM(userId, 'security');
    expect(sec.allowed).toBe(true);

    // Rate limit window check
    notificationLimiterService.recordDMSent(userId);
    notificationLimiterService.recordDMSent(userId);
    notificationLimiterService.recordDMSent(userId);

    const fourth = notificationLimiterService.canSendDM(userId, 'growth_digest');
    expect(fourth.allowed).toBe(false);
  });

  it('REQ-15.8: feedbackLoops records pulse survey, suggestion box, and changelog', () => {
    const survey = feedbackLoopsService.submitPulseSurvey(guildId, userId, 5, 'Great bot!');
    expect(survey.rating).toBe(5);

    const metrics = feedbackLoopsService.getPulseMetrics(guildId);
    expect(metrics.totalResponses).toBeGreaterThan(0);
    expect(metrics.averageRating).toBe(5);

    const sug = feedbackLoopsService.submitSuggestion(guildId, userId, 'Dark mode UI', 'Add dark mode to preview');
    expect(sug.upvotes).toBe(1);

    const newUpvotes = feedbackLoopsService.upvoteSuggestion(sug.id);
    expect(newUpvotes).toBe(2);

    feedbackLoopsService.updateSuggestionStatus(sug.id, 'completed');
    const changelog = feedbackLoopsService.formatChangelog(guildId, '1.5.0', undefined, 'ar');
    expect(changelog).toContain('Dark mode UI');
  });

  it('REQ-15.9: abTesting assigns deterministic variants and computes conversions', () => {
    const variant = abTestingService.getOrAssignVariant(userId, 'onboarding_v2');
    expect(['A', 'B']).toContain(variant);

    abTestingService.recordImpression(guildId, 'onboarding_v2', 'A');
    abTestingService.recordImpression(guildId, 'onboarding_v2', 'A');
    abTestingService.recordConversion(guildId, 'onboarding_v2', 'A');

    const results = abTestingService.getTestResults(guildId, 'onboarding_v2');
    expect(results).toBeDefined();
    expect(results?.variantA.views).toBeGreaterThanOrEqual(2);
    expect(results?.variantA.conversions).toBeGreaterThanOrEqual(1);
  });

  it('REQ-15.10: communityHealth computes weekly composite health index', () => {
    const health = communityHealthService.computeWeeklyHealth(guildId);
    expect(health.overallScore).toBeGreaterThanOrEqual(0);
    expect(health.overallScore).toBeLessThanOrEqual(100);
    expect(['Thriving', 'Healthy', 'Fair', 'At Risk']).toContain(health.grade);
    expect(health.recommendations.length).toBeGreaterThan(0);
  });
});
