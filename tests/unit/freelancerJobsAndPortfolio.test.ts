import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';
import { jobBoardService } from '../../src/modules/freelancer/jobs/jobBoard.js';
import { jobMatcherService } from '../../src/modules/freelancer/jobs/jobMatcher.js';
import { clientScamShield } from '../../src/modules/freelancer/jobs/clientScamShield.js';
import { proposalCoachService } from '../../src/modules/freelancer/jobs/proposalCoach.js';
import { clientCheckerService } from '../../src/modules/freelancer/jobs/clientChecker.js';
import { directHireService } from '../../src/modules/freelancer/jobs/directHire.js';
import { portfolioGalleryService } from '../../src/modules/freelancer/portfolio/portfolioGallery.js';
import { portfolioReviewQueueService } from '../../src/modules/freelancer/portfolio/portfolioReviewQueue.js';
import { reputationEngine } from '../../src/modules/freelancer/portfolio/reputationEngine.js';
import { endorsementEngine } from '../../src/modules/freelancer/portfolio/endorsementEngine.js';
import { badgeEngine } from '../../src/modules/freelancer/portfolio/badgeEngine.js';
import { caseStudyGeneratorService } from '../../src/modules/freelancer/portfolio/caseStudyGenerator.js';

describe('Phase 4: Freelancer Modules - Jobs & Portfolio (Categories A & B)', () => {
  const guildId = 'guild_jobs_port_test';

  beforeEach(() => {
    // Reset DB tables for test isolation
    dbService.run('DELETE FROM jobs');
    dbService.run('DELETE FROM portfolio_items');
    dbService.run('DELETE FROM portfolio_reviews');
    dbService.run('DELETE FROM endorsements');
    dbService.run('DELETE FROM member_badges');
    dbService.run('DELETE FROM members');
  });

  describe('Category A: Jobs & Clients (REQ-11.1 to REQ-11.6)', () => {
    it('REQ-11.1: posts job opportunities, handles expiry and embed generation', () => {
      const job = jobBoardService.postJob({
        guildId,
        posterId: 'client_1',
        title: 'Fullstack Next.js 15 Platform',
        budgetRange: '$2,000 - $3,500',
        deadline: '3 weeks',
        requiredSkills: ['Next.js', 'TypeScript', 'Node.js'],
        description: 'Need a production-ready SaaS MVP with auth and billing.',
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe('open');

      const active = jobBoardService.getActiveJobs(guildId, 'TypeScript');
      expect(active.length).toBe(1);
      expect(active[0].title).toBe('Fullstack Next.js 15 Platform');

      const embed = jobBoardService.generateJobEmbed(job, 'ar');
      expect(embed.title).toContain('فرصة عمل جديدة');
      expect(embed.fields[0].value).toBe('$2,000 - $3,500');
    });

    it('REQ-11.2: matches candidate profiles based on skill overlap and sends alerts', () => {
      memberRepo.createMember({
        userId: 'dev_alex',
        guildId,
        username: 'AlexDev',
        seniorityLevel: 'Senior',
        tools: 'Next.js, TypeScript, Tailwind, Node.js',
        field: 'Web Development',
        optInJobMatching: true,
      });

      memberRepo.createMember({
        userId: 'dev_designer',
        guildId,
        username: 'SaraDesign',
        seniorityLevel: 'Mid',
        tools: 'Figma, Adobe XD, UI/UX',
        field: 'Design',
        optInJobMatching: true,
      });

      const job = jobBoardService.postJob({
        guildId,
        posterId: 'client_1',
        title: 'React & TypeScript Refactor',
        budgetRange: '$1,000',
        deadline: '1 week',
        requiredSkills: ['TypeScript', 'Next.js'],
        description: 'Refactor messy components.',
      });

      const matches = jobMatcherService.findMatches(job);
      expect(matches.length).toBe(1);
      expect(matches[0].userId).toBe('dev_alex');
      expect(matches[0].matchScore).toBe(100);

      const alertMsg = jobMatcherService.formatAlertMessage(matches[0], job);
      expect(alertMsg).toContain('AlexDev');
      expect(alertMsg).toContain('React & TypeScript Refactor');
    });

    it('REQ-11.3: client scam shield flags off-platform coercion and advance fees', () => {
      const scamListing = clientScamShield.scanJobPosting(
        'URGENT: Easy Data Entry Work',
        'Contact me on WhatsApp right now and pay $50 registration fee via Western Union before receiving files.',
        '$5,000'
      );

      expect(scamListing.isFlagged).toBe(true);
      expect(scamListing.recommendation).toBe('block_and_escalate');
      expect(scamListing.reasons.length).toBeGreaterThanOrEqual(2);

      const banner = clientScamShield.generateWarningBanner(scamListing, 'en');
      expect(banner).toContain('HIGH RISK FRAUD ALERT');
    });

    it('REQ-11.4 & REQ-11.5: coaches draft proposals and checks client briefs for scope creep', async () => {
      // Proposal Coach test
      const critique = await proposalCoachService.coachProposal(
        'I will work for cheap. Pick me because I am the lowest price in town.',
        'Need senior backend engineer',
        'en'
      );
      expect(critique.redFlags.length).toBeGreaterThan(0);
      expect(critique.optimizedRewrite).toBeDefined();

      // Client Red Flag Checker test
      const briefCheck = clientCheckerService.analyzeClientBrief(
        'I need an app just like Uber but simple. You must be available 24/7 and give me unlimited revisions.',
        'en'
      );
      expect(briefCheck.overallVerdict).toBe('high_risk');
      expect(briefCheck.flags.some((f) => f.type === 'scope_creep')).toBe(true);
      expect(briefCheck.flags.some((f) => f.type === 'unreasonable_demands')).toBe(true);
    });

    it('REQ-11.6: handles private direct-hire workflow with negotiation options', () => {
      const hireReq = directHireService.createHireRequest({
        clientId: 'client_bob',
        freelancerId: 'dev_alex',
        guildId,
        projectTitle: 'E-commerce API Integration',
        budget: '$1,800',
        timeline: '10 days',
        initialMessage: 'I reviewed your past work in #showcase and loved it.',
      });

      expect(hireReq.status).toBe('pending');

      const response = directHireService.respondToRequest(hireReq.id, 'dev_alex', 'accept');
      expect(response.success).toBe(true);
      expect(response.request?.status).toBe('accepted');
    });
  });

  describe('Category B: Portfolio & Reputation (REQ-11.7 to REQ-11.12)', () => {
    it('REQ-11.7: adds portfolio items and manages upvotes', () => {
      const item = portfolioGalleryService.addPortfolioItem({
        userId: 'dev_alex',
        guildId,
        title: 'Open Source SQLite Dashboard',
        description: 'Blazing fast dashboard for embedded databases.',
        url: 'https://github.com/alex/sqlite-dash',
        tags: ['sqlite', 'typescript', 'react'],
      });

      expect(item.id).toBeDefined();

      const upvoteRes = portfolioGalleryService.upvoteItem(item.id, 'fan_user_1');
      expect(upvoteRes.success).toBe(true);
      expect(upvoteRes.newUpvotes).toBe(1);

      // Self-upvote should be rejected
      const selfUpvote = portfolioGalleryService.upvoteItem(item.id, 'dev_alex');
      expect(selfUpvote.success).toBe(false);

      const items = portfolioGalleryService.getMemberItems('dev_alex', guildId);
      expect(items.length).toBe(1);
    });

    it('REQ-11.8: processes peer reviews and rewards reviewers with credits', () => {
      memberRepo.createMember({
        userId: 'peer_reviewer',
        guildId,
        username: 'ReviewerPro',
        creditsBalance: 100,
      });

      const item = portfolioGalleryService.addPortfolioItem({
        userId: 'dev_alex',
        guildId,
        title: 'Mobile Banking App',
        description: 'Fintech mobile interface.',
        url: 'https://behance.net/bank-app',
        tags: ['figma', 'mobile'],
      });

      const reviewRes = portfolioReviewQueueService.submitReview({
        portfolioId: item.id,
        reviewerId: 'peer_reviewer',
        guildId,
        feedback: 'Great color hierarchy and accessible contrast. Would recommend tighter button padding on smaller mobile viewports.',
        rating: 5,
      });

      expect(reviewRes.success).toBe(true);
      expect(reviewRes.creditsAwarded).toBe(25);

      const reviews = portfolioReviewQueueService.getReviewsForItem(item.id);
      expect(reviews.length).toBe(1);
      expect(reviews[0].rating).toBe(5);
    });

    it('REQ-11.9: calculates transparent multi-factor reputation scores', () => {
      memberRepo.createMember({
        userId: 'dev_alex',
        guildId,
        username: 'AlexDev',
      });

      // Insert 1 approved work submission (+30) and 1 clean deal (+50)
      dbService.run(
        `INSERT INTO work_submissions (id, user_id, guild_id, url_or_asset, description, status, created_at)
         VALUES ('w1', 'dev_alex', ?, 'https://github.com/app', 'Full app', 'approved', ?)`,
        guildId,
        Date.now()
      );

      dbService.run(
        `INSERT INTO deals (id, guild_id, channel_id, client_id, freelancer_id, middleman_id, title, amount, agreement_text, agreement_sha256, status, created_at)
         VALUES ('d1', ?, 'ch1', 'c1', 'dev_alex', 'm1', 'Project A', 500, 'text', 'hash', 'completed', ?)`,
        guildId,
        Date.now()
      );

      const breakdown = reputationEngine.calculateReputation('dev_alex', guildId, 'en');
      // Base (100) + 30 (work) + 50 (clean deal) = 180
      expect(breakdown.totalScore).toBe(180);
      expect(breakdown.explanation).toContain('180 pts');
    });

    it('REQ-11.10: skill endorsement detects circular collusion rings', () => {
      // User A endorses User B
      const res1 = endorsementEngine.endorseMember({
        giverId: 'user_A',
        receiverId: 'user_B',
        guildId,
        skill: 'TypeScript',
      });
      expect(res1.success).toBe(true);
      expect(res1.isRingDetected).toBe(false);

      // User B tries to endorse User A back for same/different skill -> cycle A -> B -> A
      const res2 = endorsementEngine.endorseMember({
        giverId: 'user_B',
        receiverId: 'user_A',
        guildId,
        skill: 'Node.js',
      });
      expect(res2.success).toBe(true);
      expect(res2.isRingDetected).toBe(true);
      expect(res2.cycle).toEqual(['user_B', 'user_A', 'user_B']);
    });

    it('REQ-11.11 & REQ-11.12: awards achievement badges and generates portfolio case studies', async () => {
      memberRepo.createMember({
        userId: 'badge_user',
        guildId,
        username: 'BadgeUser',
        currentStreak: 12,
      });

      // 1. Check badges (streak >= 10 should award task_champion)
      const awarded = badgeEngine.checkAndAwardBadges('badge_user', guildId);
      expect(awarded.some((b) => b.id === 'task_champion')).toBe(true);

      // 2. Case Study Generator test
      const caseStudy = await caseStudyGeneratorService.generateCaseStudy(
        {
          projectTitle: 'High-Throughput E-Commerce Gateway',
          clientIndustry: 'Retail',
          problemStatement: 'Existing checkout crashed under 1,000 req/sec load.',
          solutionAndTech: 'Built microservice with Redis caching and distributed locks in Node.js.',
          measuredOutcomes: 'P99 latency dropped from 2.4s to 85ms with zero downtime during Black Friday.',
        },
        'en'
      );

      expect(caseStudy.title).toBe('High-Throughput E-Commerce Gateway');
      expect(caseStudy.markdown).toBeDefined();
    });
  });
});
