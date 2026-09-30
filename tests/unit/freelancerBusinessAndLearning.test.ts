import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';
import { rateCalculatorService } from '../../src/modules/freelancer/business/rateCalculator.js';
import { invoiceGeneratorService } from '../../src/modules/freelancer/business/invoiceGenerator.js';
import { sowBuilderService } from '../../src/modules/freelancer/business/sowBuilder.js';
import { clauseExplainerService } from '../../src/modules/freelancer/business/clauseExplainer.js';
import { timeTrackerService } from '../../src/modules/freelancer/business/timeTracker.js';
import { reminderService } from '../../src/modules/freelancer/business/reminderService.js';
import { earningsLedgerService } from '../../src/modules/freelancer/business/earningsLedger.js';
import { taxAndCurrencyService } from '../../src/modules/freelancer/business/taxAndCurrency.js';
import { roadmapGeneratorService } from '../../src/modules/freelancer/learning/roadmapGenerator.js';
import { clientSimulatorService, NEGOTIATION_SCENARIOS } from '../../src/modules/freelancer/learning/clientSimulator.js';
import { interviewSimulatorService } from '../../src/modules/freelancer/learning/interviewSimulator.js';
import { codeReviewService } from '../../src/modules/freelancer/learning/codeReviewer.js';
import { designCritiqueService } from '../../src/modules/freelancer/learning/designCritique.js';
import { challengeEngine } from '../../src/modules/freelancer/learning/challengeEngine.js';
import { pairSessionManager } from '../../src/modules/freelancer/learning/pairSessionManager.js';
import { resourceLibraryService } from '../../src/modules/freelancer/learning/resourceLibrary.js';

describe('Phase 4: Freelancer Modules - Business & Learning (Categories C & D)', () => {
  const guildId = 'guild_biz_learn_test';

  beforeEach(() => {
    dbService.run('DELETE FROM time_entries');
    dbService.run('DELETE FROM reminders');
    dbService.run('DELETE FROM earnings_records');
    dbService.run('DELETE FROM resources');
    dbService.run('DELETE FROM members');
  });

  describe('Category C: Business Tools (REQ-11.13 to REQ-11.20)', () => {
    it('REQ-11.13: calculates rates with overhead buffer and regional benchmarks', () => {
      const result = rateCalculatorService.calculateRate({
        monthlyTargetIncome: 3000,
        currency: 'USD',
        billableHoursPerWeek: 25,
        vacationWeeksPerYear: 4,
        overheadBufferPercent: 25,
        region: 'mena',
        skillLevel: 'Senior',
      });

      expect(result.baseHourlyRate).toBeGreaterThan(20);
      expect(result.minimumFloorRate).toBeLessThan(result.baseHourlyRate);
      expect(result.recommendedProjectRateDaily).toBe(result.baseHourlyRate * 6);
      expect(result.explanation).toContain('USD');
    });

    it('REQ-11.14: generates professional invoice HTML with legal disclaimer', () => {
      const invoice = invoiceGeneratorService.generateInvoiceHtml({
        invoiceNumber: 'INV-100234',
        type: 'invoice',
        freelancerName: 'Tarek Freelancer',
        freelancerEmailOrContact: 'tarek@example.com',
        clientName: 'Acme Corp Inc.',
        currency: 'USD',
        dueDate: '2026-10-15',
        items: [
          { description: 'Phase 1: Backend Architecture Setup', quantity: 1, unitPrice: 1200 },
          { description: 'Phase 2: Authentication & Stripe Webhooks', quantity: 1, unitPrice: 1500 },
        ],
      });

      expect(invoice.invoiceNumber).toBe('INV-100234');
      expect(invoice.total).toBe(2700);
      expect(invoice.html).toContain('Acme Corp Inc.');
      expect(invoice.html).toContain('DISCLAIMER');
    });

    it('REQ-11.15 & REQ-11.16: builds SOW with revision caps and explains contract clauses', async () => {
      const sow = await sowBuilderService.buildScopeOfWork(
        {
          projectTitle: 'Enterprise Logistics Dashboard',
          clientRequirements: 'Fleet tracking, driver alerts, delivery route optimizer',
          estimatedTimeline: '4 weeks',
          totalBudget: '$4,500',
        },
        'en'
      );

      expect(sow.projectTitle).toBe('Enterprise Logistics Dashboard');
      expect(sow.revisionCap).toBe(2);
      expect(sow.milestones.length).toBe(3);

      const clause = clauseExplainerService.explainClause('Client shall indemnify without limitation all damages');
      expect(clause.riskLevel).toBe('high_risk');
      expect(clause.protectiveRecommendationEn).toContain('Total liability of Freelancer shall not exceed');
    });

    it('REQ-11.17: tracks project time sessions and generates summaries', () => {
      const startRes = timeTrackerService.startTimer('user_dev_time', 'E-commerce API');
      expect(startRes.success).toBe(true);

      const stopRes = timeTrackerService.stopTimer('user_dev_time', 'Implemented discount coupons');
      expect(stopRes.success).toBe(true);
      expect(stopRes.durationSeconds).toBeGreaterThanOrEqual(1);

      const summary = timeTrackerService.getSummary('user_dev_time');
      expect(summary.totalDurationSeconds).toBeGreaterThanOrEqual(1);
      expect(summary.projectBreakdown['E-commerce API']).toBeDefined();
    });

    it('REQ-11.18: schedules and retrieves due payment and deadline reminders', () => {
      const rem = reminderService.addReminder({
        userId: 'dev_reminder_user',
        reminderType: 'payment',
        message: 'Follow up on Milestone 2 invoice for Client Zenith',
        dueInHours: -1, // already due
      });

      expect(rem.id).toBeDefined();

      const due = reminderService.getDueReminders();
      expect(due.some((r) => r.id === rem.id)).toBe(true);

      reminderService.markSent(rem.id);
      const afterSent = reminderService.getDueReminders();
      expect(afterSent.some((r) => r.id === rem.id)).toBe(false);
    });

    it('REQ-11.19 & REQ-11.20: manages encrypted earnings ledger and tax/currency guidance', () => {
      earningsLedgerService.logEarnings({
        userId: 'dev_earn_1',
        amount: 1500,
        currency: 'USD',
        source: 'Client Alpha Web App',
      });

      earningsLedgerService.logEarnings({
        userId: 'dev_earn_1',
        amount: 800,
        currency: 'USD',
        source: 'Client Beta Mobile Fix',
      });

      const summary = earningsLedgerService.getMonthlySummary('dev_earn_1');
      expect(summary.totalAmount).toBe(2300);
      expect(summary.asciiChart).toContain('Client Alpha');

      const conv = taxAndCurrencyService.convertCurrency(100, 'USD', 'EGP');
      expect(conv.convertedAmount).toBeGreaterThan(4000);

      const taxInfo = taxAndCurrencyService.getTaxGuidance('egypt_freelance');
      expect(taxInfo.actionableStepsEn.length).toBeGreaterThan(0);
    });
  });

  describe('Category D: Learning & Growth (REQ-11.21 to REQ-11.28)', () => {
    it('REQ-11.21: generates adaptive roadmaps with weekly milestones and exercises', async () => {
      const roadmap = await roadmapGeneratorService.generateRoadmap({
        specialization: 'Fullstack Next.js & Node Architecture',
        currentLevel: 'Mid',
        durationWeeks: 4,
      });

      expect(roadmap.durationWeeks).toBe(4);
      expect(roadmap.weeks.length).toBe(4);
      expect(roadmap.introMarkdown).toBeDefined();
    });

    it('REQ-11.22: evaluates mock client negotiation roleplay sessions', async () => {
      const scenario = NEGOTIATION_SCENARIOS[0]; // discount pusher
      const evalResult = await clientSimulatorService.evaluateResponse(
        scenario,
        'I cannot lower my rate to $500 because high quality and security require rigorous testing. We can, however, reduce scope to fit your budget.'
      );

      expect(evalResult.score).toBeGreaterThanOrEqual(70);
      expect(evalResult.firmnessRating).toBe('diplomatic_and_firm');
    });

    it('REQ-11.23 & REQ-11.24: generates interview questions and provides deep code reviews', async () => {
      const question = await interviewSimulatorService.generateInterviewQuestion('Senior Node Engineer', 'technical');
      expect(question).toBeDefined();

      const review = await codeReviewService.reviewCode(
        `function getUser(id) {
          return db.query("SELECT * FROM users WHERE id = " + id);
        }`,
        'javascript'
      );

      expect(review.securityRating).toBe('critical_vulnerabilities');
      expect(review.codeQualityScore).toBeLessThan(70);
    });

    it('REQ-11.25 to REQ-11.28: critique design, challenge engine, pair sessions, and resource library', async () => {
      // 1. Design critique
      const designCritique = await designCritiqueService.critiqueDesign('Figma landing page with low contrast gray text on white background');
      expect(designCritique.totalScore).toBeGreaterThan(60);
      expect(designCritique.actionableImprovements.length).toBeGreaterThan(0);

      // 2. Challenge engine
      memberRepo.createMember({
        userId: 'chal_user',
        guildId,
        username: 'ChalUser',
        creditsBalance: 50,
      });

      const chal = challengeEngine.getTodaysChallenge('code');
      const subRes = challengeEngine.submitChallengeSolution({
        challengeId: chal.id,
        userId: 'chal_user',
        guildId,
        solutionText: 'class LRUCache { constructor(capacity) { this.map = new Map(); } }',
      });
      expect(subRes.success).toBe(true);
      expect(subRes.creditsAwarded).toBe(chal.rewardCredits);

      // 3. Pair session manager
      const pair1 = pairSessionManager.joinQueue({
        userId: 'dev_user_1',
        guildId,
        topic: 'Docker Compose Debugging',
        type: 'code_pair',
      });
      expect(pair1.matched).toBe(false);

      const pair2 = pairSessionManager.joinQueue({
        userId: 'dev_user_2',
        guildId,
        topic: 'Redis Queue Architecture',
        type: 'code_pair',
      });
      expect(pair2.matched).toBe(true);
      expect(pair2.match?.user1Id).toBe('dev_user_1');
      expect(pair2.match?.user2Id).toBe('dev_user_2');

      // 4. Resource Library
      resourceLibraryService.seedInitialResources(guildId);
      const resources = resourceLibraryService.searchResources(guildId, 'architecture');
      expect(resources.length).toBeGreaterThanOrEqual(1);
    });
  });
});
