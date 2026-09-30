import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { dealRepo } from '../../src/database/repositories/dealRepo.js';
import { escrowService } from '../../src/modules/escrow/escrowService.js';
import { middlemanDirectoryService } from '../../src/modules/escrow/middlemanDirectory.js';
import { dealLifecycleService } from '../../src/modules/escrow/dealLifecycle.js';
import { disputeEngine } from '../../src/modules/escrow/disputeEngine.js';
import { escrowFraudShield } from '../../src/modules/escrow/escrowFraudShield.js';
import { feeCalculatorService } from '../../src/modules/escrow/feeCalculator.js';
import { dealTemplatesService } from '../../src/modules/escrow/dealTemplates.js';
import { middlemanAdminService } from '../../src/modules/escrow/middlemanAdmin.js';
import { extraEscrowService } from '../../src/modules/escrow/extraEscrow.js';

describe('Phase 4: Section 12 Middleman & Escrow Module Integration Suite', () => {
  const guildId = 'guild_escrow_integration_test';

  beforeEach(() => {
    dbService.run('DELETE FROM deal_milestones');
    dbService.run('DELETE FROM deal_disputes');
    dbService.run('DELETE FROM deals');
    dbService.run('DELETE FROM middlemen');
    dbService.run('DELETE FROM members');
  });

  describe('Non-Custodial Rules & Disclaimers (REQ-12.1)', () => {
    it('displays mandatory legal disclaimers in English and Arabic and passes compliance check', () => {
      expect(escrowService.getDisclaimer('en')).toContain('STRICT NON-CUSTODIAL NOTICE');
      expect(escrowService.getDisclaimer('ar')).toContain('إخلاء مسؤولية غير وصائي صارم');
      expect(escrowService.assertNonCustodialCompliance()).toBe(true);
    });
  });

  describe('Middleman Verification & Anti-Impersonation (REQ-12.2)', () => {
    it('manages tiered rankings, deal caps, and detects impersonation attempts', () => {
      // Register Middleman
      const mm = middlemanDirectoryService.registerOrUpdateMiddleman({
        userId: 'verified_middleman_1',
        guildId,
        tier: 'Senior Middleman',
      });

      expect(mm.tier).toBe('Senior Middleman');
      expect(mm.maxDealSize).toBe(10000);

      // Verify anti-impersonation badge
      const badgeRes = middlemanDirectoryService.verifyAntiImpersonation(
        'verified_middleman_1',
        'OfficialMiddleman',
        guildId
      );
      expect(badgeRes.isVerifiedMiddleman).toBe(true);
      expect(badgeRes.verificationBadge).toContain('SENIOR MIDDLEMAN');

      // Impersonator using middleman keywords
      const impRes = middlemanDirectoryService.verifyAntiImpersonation(
        'scammer_user',
        'Middleman_Official_Mod',
        guildId
      );
      expect(impRes.isVerifiedMiddleman).toBe(false);
      expect(impRes.verificationBadge).toContain('POTENTIAL IMPERSONATOR');
    });
  });

  describe('Structured Deal Lifecycle & Milestone Delivery (REQ-12.3)', () => {
    it('executes full deal lifecycle with SHA-256 agreement lock, milestones, and external funding', () => {
      middlemanDirectoryService.registerOrUpdateMiddleman({
        userId: 'mm_lead',
        guildId,
        tier: 'Middleman',
      });

      const agreement = dealTemplatesService.populateAgreementFromTemplate({
        templateType: 'web_landing',
        dealId: 'deal_full_lifecycle',
        totalAmount: 1500,
        currency: 'USD',
        deadline: '2026-10-30',
      });

      // 1. Create deal draft
      const deal = dealLifecycleService.createDealDraft({
        guildId,
        channelId: 'channel_deal_101',
        clientId: 'client_acme',
        freelancerId: 'freelancer_bob',
        middlemanId: 'mm_lead',
        title: 'Acme SaaS Web Landing Page',
        amount: 1500,
        currency: 'USD',
        agreement,
      });

      expect(deal.id).toBeDefined();
      expect(deal.agreement_sha256).toBeDefined();
      expect(deal.status).toBe('draft');

      // 2. Both parties sign
      const clientSign = dealLifecycleService.confirmAgreement(deal.id, 'client');
      expect(clientSign.isFullyConfirmed).toBe(false);

      const freelancerSign = dealLifecycleService.confirmAgreement(deal.id, 'freelancer');
      expect(freelancerSign.isFullyConfirmed).toBe(true);

      const agreedDeal = dealRepo.getDealById(deal.id)!;
      expect(agreedDeal.status).toBe('agreed');

      // 3. Middleman verifies external funds receipt with proof
      const fundingRes = dealLifecycleService.confirmFundingByMiddleman(
        deal.id,
        'mm_lead',
        'https://cdn.discordapp.com/proofs/bank_wire_receipt_778.png'
      );
      expect(fundingRes.success).toBe(true);

      const fundedDeal = dealRepo.getDealById(deal.id)!;
      expect(fundedDeal.status).toBe('funded');
      expect(fundedDeal.middleman_funds_verified).toBe(1);

      // 4. Milestone delivery and approval
      const m1Approved = dealLifecycleService.approveMilestone(deal.id, 'm_1');
      expect(m1Approved).toBe(true);

      // 5. Completion release by middleman
      const closeRes = dealLifecycleService.closeDealCompleted(deal.id, 'mm_lead');
      expect(closeRes.success).toBe(true);

      const closedDeal = dealRepo.getDealById(deal.id)!;
      expect(closedDeal.status).toBe('completed');
    });
  });

  describe('Dispute Resolution & Human Ladder (REQ-12.4)', () => {
    it('opens dispute, generates neutral AI summary, and escalates ladder', async () => {
      const deal = dealRepo.createDeal({
        guildId,
        channelId: 'deal_disp_ch',
        clientId: 'client_disp',
        freelancerId: 'free_disp',
        middlemanId: 'mm_disp',
        title: 'Mobile App Redesign',
        amount: 2000,
        currency: 'USD',
        agreementText: 'Deliver 5 screens by Friday. Max 2 revisions.',
        agreementSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });

      const dispute = await disputeEngine.openDispute({
        dealId: deal.id,
        initiatorId: 'client_disp',
        reason: 'Freelancer delivered 4 screens instead of 5 and stopped responding.',
        chatTranscriptSummary: 'Client asked for 5th screen, freelancer said it was out of scope.',
      });

      expect(dispute.id).toBeDefined();
      expect(dispute.ladderLevel).toBe('middleman');
      expect(dispute.aiSummary).toBeDefined();

      // Escalate to Senior Middleman
      const esc1 = disputeEngine.escalateLadder(dispute.id);
      expect(esc1.ladderLevel).toBe('senior_middleman');

      // Escalate to Owner
      const esc2 = disputeEngine.escalateLadder(dispute.id);
      expect(esc2.ladderLevel).toBe('owner');

      // Resolve dispute
      const resolved = disputeEngine.resolveDispute(
        dispute.id,
        'Owner ruled: 80% payout to freelancer for 4 screens, 20% refunded to client externally.'
      );
      expect(resolved).toBe(true);
    });
  });

  describe('Fraud Shield & Duplicate Proof Detection (REQ-12.5)', () => {
    it('evaluates deal risk and intercepts duplicate receipt screenshots', () => {
      // High-risk deal: very new account, huge amount, off-platform language
      const assessment = escrowFraudShield.assessDealRisk({
        clientAccountAgeDays: 2,
        freelancerAccountAgeDays: 45,
        dealAmount: 12000,
        agreementText: 'Immediate payment, contact me on WhatsApp outside escrow right now.',
      });

      expect(assessment.riskLevel).toBe('high');
      expect(assessment.flags.length).toBeGreaterThanOrEqual(2);

      // Duplicate proof inspection
      const proofUrl = 'https://fake-proof-cdn.com/receipt_123.jpg';
      const scan1 = escrowFraudShield.inspectPaymentProof(proofUrl);
      expect(scan1.isAuthentic).toBe(true);

      // Attempting to reuse the exact same receipt in another deal
      const scan2 = escrowFraudShield.inspectPaymentProof(proofUrl);
      expect(scan2.isAuthentic).toBe(false);
      expect(scan2.reason).toContain('Duplicate payment proof detected');

      // DM pressure detection
      expect(escrowFraudShield.detectDMPressure('Hey let us talk in DMs instead of this channel')).toBe(true);
    });
  });

  describe('Fee Transparency & Split Models (REQ-12.6)', () => {
    it('calculates tiered and split fee allocations correctly with non-custodial notes', () => {
      const splitResult = feeCalculatorService.calculateFee({
        dealAmount: 1000,
        currency: 'USD',
        model: 'tiered', // 3.5% = $35
        payerAllocation: 'split_50_50',
      });

      expect(splitResult.totalFee).toBe(35);
      expect(splitResult.clientPortion).toBe(18); // 35 / 2 rounded
      expect(splitResult.freelancerPortion).toBe(17);
      expect(splitResult.grossAmountPaidByClient).toBe(1018);
      expect(splitResult.netPayoutToFreelancer).toBe(983);
      expect(splitResult.transparencyNote).toContain('bot never collects or holds these fees');
    });
  });

  describe('Owner Governance, Extra Capabilities & Reliability (REQ-12.8 & REQ-12.9)', () => {
    it('manages middleman suspensions, on-call rotations, and multi-party deal splits', () => {
      middlemanDirectoryService.registerOrUpdateMiddleman({
        userId: 'mm_candidate',
        guildId,
        tier: 'Trainee',
      });

      // Promote
      const promo = middlemanAdminService.promoteMiddleman('mm_candidate', 'Middleman');
      expect(promo.newTier).toBe('Middleman');
      expect(promo.newCap).toBe(2000);

      // On-call rotation
      extraEscrowService.registerOnCallMiddleman('mm_candidate');
      const assigned = extraEscrowService.getNextOnCallMiddleman(1000);
      expect(assigned).toBe('mm_candidate');

      // Multi-party team split
      const splits = extraEscrowService.calculateMultiPartySplits(2000, [
        { recipientId: 'frontend_lead', role: 'Frontend Architecture', percentage: 50 },
        { recipientId: 'backend_lead', role: 'API & Database', percentage: 30 },
        { recipientId: 'designer_lead', role: 'UI/UX & Assets', percentage: 20 },
      ]);

      expect(splits[0].payoutAmount).toBe(1000);
      expect(splits[1].payoutAmount).toBe(600);
      expect(splits[2].payoutAmount).toBe(400);

      // Reliability Score
      dbService.run(
        `INSERT INTO deals (id, guild_id, channel_id, client_id, freelancer_id, middleman_id, title, amount, agreement_text, agreement_sha256, status, created_at)
         VALUES ('deal_clean_1', ?, 'ch', 'c', 'free_star', 'mm', 'Title', 500, 't', 'h', 'completed', ?)`,
        guildId,
        Date.now()
      );
      dbService.run(
        `INSERT INTO deals (id, guild_id, channel_id, client_id, freelancer_id, middleman_id, title, amount, agreement_text, agreement_sha256, status, created_at)
         VALUES ('deal_clean_2', ?, 'ch', 'c', 'free_star', 'mm', 'Title', 500, 't', 'h', 'completed', ?)`,
        guildId,
        Date.now()
      );
      dbService.run(
        `INSERT INTO deals (id, guild_id, channel_id, client_id, freelancer_id, middleman_id, title, amount, agreement_text, agreement_sha256, status, created_at)
         VALUES ('deal_clean_3', ?, 'ch', 'c', 'free_star', 'mm', 'Title', 500, 't', 'h', 'completed', ?)`,
        guildId,
        Date.now()
      );

      const rel = extraEscrowService.calculateMemberReliability('free_star', guildId);
      expect(rel.reliabilityScore).toBe(100);
      expect(rel.hasTrustedDealmakerBadge).toBe(true);

      // Suspend Middleman
      const susp = middlemanAdminService.suspendMiddleman('mm_candidate', 'Conduct violation investigation');
      expect(susp.success).toBe(true);
    });
  });
});
