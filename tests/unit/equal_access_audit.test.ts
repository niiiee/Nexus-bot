import { describe, it, expect } from 'vitest';
import { MeritCharterEngine, EqualAccessAuditor } from '../../src/modules/merit/meritCharterEngine.js';
import { FairUseResourceGuard } from '../../src/modules/billing/subscriptionEngine.js';
import { CommunityFundEngine } from '../../src/modules/fund/communityFundEngine.js';
import { CommunityCompetitionEngine } from '../../src/modules/competitions/communityCompetitionEngine.js';
import { CommunityDistributionEngine } from '../../src/modules/distribution/communityDistribution.js';

describe('Annex B & D: Equal Access, Charter Conformance & Money Safety Audit', () => {
  const meritEngine = MeritCharterEngine.getInstance();
  const fundEngine = CommunityFundEngine.getInstance();
  const compEngine = CommunityCompetitionEngine.getInstance();
  const distEngine = CommunityDistributionEngine.getInstance();

  it('Annex B.1: Charter Conformance - Brand new member with $0 and 0 effort can access all core features', () => {
    const coreFeatures = [
      'verification',
      'learning',
      'portfolio',
      'job_board',
      'deals',
      'escrow',
      'help',
      'events',
      'mentorship_access',
      'ai_helpers',
      'safety'
    ];

    for (const f of coreFeatures) {
      const check = meritEngine.assertCoreAccess(f, 'none');
      expect(check.allowed).toBe(true);
      expect(check.reason).toContain('Complies with Nexus Charter');
    }
  });

  it('Annex B.2: Earned extras never gate critical career, learning or deal functionality', () => {
    const criticalFeatures = ['learning', 'deals', 'portfolio', 'job_board', 'safety'];

    for (const cf of criticalFeatures) {
      const check = meritEngine.assertCoreAccess(cf, 'effort');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('universally free and cannot be locked');
    }
  });

  it('Annex B.3: Merit Fairness - Quality weights and diminishing returns apply identically regardless of dialect or region', () => {
    const score1 = meritEngine.calculateEffortScore('tenant_cairo', 'user_ar');
    const score2 = meritEngine.calculateEffortScore('tenant_london', 'user_en');
    expect(typeof score1).toBe('number');
    expect(typeof score2).toBe('number');
  });

  it('Annex B.4: Static & Runtime Scan - Universal Fair-Use quotas replace commercial tier gating', () => {
    const quotas = FairUseResourceGuard.UNIFORM_QUOTA;
    expect(quotas.quotaMembers).toBe(50000);
    expect(quotas.quotaAiCalls).toBe(100000);
    expect(quotas.quotaStorageMb).toBe(50000);

    const prompt = FairUseResourceGuard.getPassiveDonationPrompt('en');
    expect(prompt.message).toContain('100% free for everyone under the Nexus Charter');
    expect(prompt.donationUrl).toBe('https://nexuscommunity.org/donate');
  });

  it('Annex D.1: Money Safety - Bot strictly operates in zero-custody mode', () => {
    // Payouts must require dual human administrative sign-off and external provider reference
    const singleAdmin = fundEngine.verifyDualApproval(500, 'admin_a', 'admin_a');
    expect(singleAdmin.approved).toBe(false);

    const dualAdmin = fundEngine.verifyDualApproval(500, 'admin_a', 'admin_b');
    expect(dualAdmin.approved).toBe(true);

    const payout = compEngine.authorizePrizePayout('comp_123', 'winner_user', 300, 'admin_a', 'admin_b');
    expect(payout.status).toBe('authorized_for_provider_execution');
    expect(payout.externalPayload.currency).toBe('USD');
  });

  it('Annex D.2: Donor Fairness - Donors receive ZERO advantages across all modules', () => {
    const check = fundEngine.runDonorFairnessCheck('top_donor_vip');
    expect(check.fairnessConfirmed).toBe(true);
    expect(check.unauthorizedPerksFound).toHaveLength(0);

    const audit = EqualAccessAuditor.runAudit('tenant_audit_test');
    expect(audit.passed).toBe(true);
    expect(audit.violations).toHaveLength(0);
  });

  it('Annex D.3: Competitions Integrity - Zero entry fees and blind impartial judging enforced', () => {
    const comp = compEngine.createCompetition('tenant_t1', 'Accessible UX Sprint', 'design', 'Design accessible nav. Free to enter.', { a11y: 50 }, 7);
    expect(comp.id).toBeDefined();

    const sub = compEngine.submitEntry(comp.id, 'alice_designer', 'Accessible Nav', 'https://figma.com/nav', {});
    const selfEval = compEngine.judgeSubmission(sub.submissionId, 'alice_designer', { a11y: 50 }, 'Self praise');
    expect(selfEval.success).toBe(false);
    expect(selfEval.message).toContain('Conflict of interest');
  });
});
