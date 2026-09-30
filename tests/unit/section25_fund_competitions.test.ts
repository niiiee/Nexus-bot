import { describe, it, expect, beforeEach } from 'vitest';
import { CommunityFundEngine } from '../../src/modules/fund/communityFundEngine.js';
import { CommunityCompetitionEngine } from '../../src/modules/competitions/communityCompetitionEngine.js';
import * as crypto from 'crypto';

describe('Section 25: Community Fund & Competitions (Chapters 151 to 180)', () => {
  const fundEngine = CommunityFundEngine.getInstance();
  const compEngine = CommunityCompetitionEngine.getInstance();
  const testTenant = 'guild_fund_test_1';
  const testDonor = 'supporter_khaled';
  const secretKey = 'test_webhook_secret_key';

  beforeEach(() => {
    fundEngine.initializeDefaultBuckets(testTenant);
  });

  describe('Part M: Community Fund (Chapters 151 to 161, 173 to 180)', () => {
    it('Chapter 151 & 155: initializes allocation buckets with emergency reserves', () => {
      const runway = fundEngine.calculateRunway(testTenant, 100);
      expect(runway.totalReserveUsd).toBeGreaterThanOrEqual(1000);
      expect(runway.runwayMonths).toBeGreaterThan(5);
    });

    it('Chapter 152 & 158: processes signed donation webhooks with donor privacy guarantees', () => {
      const extId = 'tx_' + Date.now();
      const amount = 250;
      const signature = crypto.createHmac('sha256', secretKey)
        .update(JSON.stringify({ externalId: extId, amountUsd: amount }))
        .digest('hex');

      const res = fundEngine.processDonationWebhook({
        tenantId: testTenant,
        provider: 'stripe',
        externalId: extId,
        donorIdentifier: testDonor,
        amountUsd: amount,
        isAnonymous: true,
        optInPublicList: false,
        signatureHeader: signature,
        signatureSecret: secretKey
      });

      expect(res.success).toBe(true);
      expect(res.donationId).toBeDefined();

      // Idempotency: duplicate webhook should succeed gracefully without double-crediting
      const dup = fundEngine.processDonationWebhook({
        tenantId: testTenant,
        provider: 'stripe',
        externalId: extId,
        donorIdentifier: testDonor,
        amountUsd: amount,
        isAnonymous: true,
        optInPublicList: false,
        signatureHeader: signature,
        signatureSecret: secretKey
      });
      expect(dup.message).toContain('Duplicate transaction');
    });

    it('Chapter 154: appends tamper-evident cryptographic hash chain to public ledger', () => {
      const entry = fundEngine.appendLedgerEntry(
        testTenant,
        'DISBURSEMENT',
        'infrastructure',
        50.0,
        'tx_srv_123',
        'Monthly SQLite replica hosting server invoice'
      );
      expect(entry.entryId).toBeDefined();
      expect(entry.entryHash).toHaveLength(64);
    });

    it('Chapter 156: processes participatory budgeting proposals', () => {
      const prop = fundEngine.submitBudgetProposal(
        testTenant,
        'member_ahmed',
        'Upgrade Code Lab test runner RAM',
        75.0,
        'development',
        'Increase container memory limits from 256MB to 512MB for faster grading'
      );
      expect(prop.proposalId).toBeDefined();
    });

    it('Chapter 159: lints donation messaging copy to eliminate guilt-based pressure', () => {
      const pushy = fundEngine.lintDonationCopy('If you care about this server you owe it to donate today');
      expect(pushy.allowed).toBe(false);
      expect(pushy.violations.length).toBeGreaterThan(0);

      const polite = fundEngine.lintDonationCopy('Nexus is 100% free under our charter. Voluntary donations to our server hosting pool are appreciated: https://nexus.org/donate');
      expect(polite.allowed).toBe(true);
    });

    it('Chapter 160: handles refunds and ledger reversals gracefully', () => {
      const ref = fundEngine.handleRefund(testTenant, 'tx_to_refund', 100);
      expect(ref.refunded).toBe(true);
    });

    it('Chapter 161: Donor Fairness Guard proves donation status confers zero privileges or perks', () => {
      const check = fundEngine.runDonorFairnessCheck(testDonor);
      expect(check.fairnessConfirmed).toBe(true);
      expect(check.unauthorizedPerksFound).toHaveLength(0);
    });

    it('Chapter 176: handles needs-based educational Access Grants', () => {
      const grant = fundEngine.submitAccessGrant(testTenant, 'student_omar', 'course', 'Cloud Architecture Masterclass', 40.0);
      expect(grant.grantId).toBeDefined();
      expect(grant.status).toContain('pending_review');
    });

    it('Chapter 177: enforces dual human approval for disbursements above $100', () => {
      const singleAppr = fundEngine.verifyDualApproval(250, 'admin_1', 'admin_1');
      expect(singleAppr.approved).toBe(false);
      expect(singleAppr.error).toContain('two distinct human administrator approvals');

      const dualAppr = fundEngine.verifyDualApproval(250, 'admin_1', 'admin_2');
      expect(dualAppr.approved).toBe(true);
    });

    it('Chapter 179: Donation Fraud Guard detects rapid transaction velocity spikes', () => {
      const normal = fundEngine.inspectTransactionVelocity('192.168.1.1', 2);
      expect(normal.flagged).toBe(false);

      const cardTester = fundEngine.inspectTransactionVelocity('192.168.1.1', 7);
      expect(cardTester.flagged).toBe(true);
      expect(cardTester.reason).toContain('card testing');
    });

    it('Chapter 180: provides community-voted Fund Sunset Plan', () => {
      const sunset = fundEngine.getSunsetPlan();
      expect(sunset.successorOrganization).toContain('Free Software Foundation');
      expect(sunset.dissolutionVoteThreshold).toContain('75%');
    });
  });

  describe('Part M: Free Skill Competitions (Chapters 162 to 172)', () => {
    let competitionId: string;

    it('Chapter 162: creates skill-based competition with published rubrics and zero entry fees', () => {
      const comp = compEngine.createCompetition(
        testTenant,
        'Autonomous Agent Hackathon',
        'hackathon',
        'Build a zero-downtime micro-agent. Zero entry fees. Blind peer judging.',
        { architecture: 40, usability: 30, testCoverage: 30 },
        14
      );
      expect(comp.id).toBeDefined();
      expect(comp.status).toBe('active');
      competitionId = comp.id;
    });

    it('Chapter 163: reserves prize allocation from Prize Pool bucket', () => {
      const res = compEngine.reservePrizePool(testTenant, competitionId, 200.0);
      expect(res.success).toBe(true);
      expect(res.reservedUsd).toBe(200.0);
    });

    it('Chapter 164: judges submissions blindly and strictly excludes judges from their own entries', () => {
      const sub = compEngine.submitEntry(competitionId, 'entrant_youssef', 'Safe Agent Core', 'https://github.com/agent', { commits: 14 });
      expect(sub.submissionId).toBeDefined();

      // Conflict of interest: entrant cannot judge own submission
      const selfJudge = compEngine.judgeSubmission(sub.submissionId, 'entrant_youssef', { architecture: 38, usability: 28, testCoverage: 29 }, 'Self score');
      expect(selfJudge.success).toBe(false);
      expect(selfJudge.message).toContain('Conflict of interest');

      // Valid impartial judge
      const fairJudge = compEngine.judgeSubmission(sub.submissionId, 'judge_external_tariq', { architecture: 38, usability: 28, testCoverage: 29 }, 'Superb execution');
      expect(fairJudge.success).toBe(true);
      expect(fairJudge.totalScore).toBe(95);
    });

    it('Chapter 165: detects plagiarism and submission similarity', () => {
      const prior = ['export function solve() { return 42; }'];
      const copycat = 'export function solve() { return 42; }';
      const original = 'class Solver { computeResult() { return Math.PI; } }';

      const flag = compEngine.evaluateSubmissionIntegrity(copycat, prior);
      expect(flag.flagged).toBe(true);

      const pass = compEngine.evaluateSubmissionIntegrity(original, prior);
      expect(pass.flagged).toBe(false);
    });

    it('Chapter 166: verifies minor age compliance and guardian consent', () => {
      const minorNoConsent = compEngine.verifyEligibility(16, false);
      expect(minorNoConsent.eligibleForCashPrize).toBe(false);
      expect(minorNoConsent.alternativePrizeRequired).toBe(true);

      const minorWithConsent = compEngine.verifyEligibility(16, true);
      expect(minorWithConsent.eligibleForCashPrize).toBe(true);
    });

    it('Chapter 167: authorizes prize payout through non-custodial provider payload with dual approval', () => {
      const auth = compEngine.authorizePrizePayout(competitionId, 'entrant_youssef', 200.0, 'admin_signer_1', 'admin_signer_2');
      expect(auth.authId).toBeDefined();
      expect(auth.status).toBe('authorized_for_provider_execution');
      expect(auth.externalPayload.providerPayoutReference).toBeDefined();
    });

    it('Chapter 168: maintains 48-hour public challenge window before prize settlement', () => {
      const status = compEngine.getChallengeWindowStatus(Date.now() - 3600000);
      expect(status.challengeWindowOpen).toBe(true);
      expect(status.hoursRemaining).toBeGreaterThan(0);
    });

    it('Chapter 170: provides non-cash educational prize options', () => {
      const options = compEngine.getNonCashPrizeOptions();
      expect(options.length).toBeGreaterThanOrEqual(3);
      expect(options[0].name).toContain('License');
    });

    it('Chapter 171 & 172: supports seasonal competition leagues and member-proposed contests', () => {
      const schedule = compEngine.getLeagueSchedule();
      expect(schedule.length).toBeGreaterThan(0);

      const prop = compEngine.proposeCommunityContest('member_laila', 'Clean Architecture Sprint', 100, 'Refactor challenge');
      expect(prop.status).toContain('community referendum');
    });
  });
});
