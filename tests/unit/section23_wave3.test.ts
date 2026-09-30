import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { tenantManager } from '../../src/modules/platform/tenantManager.js';
import { adaptiveAcademy } from '../../src/modules/academy/adaptiveAcademy.js';
import { aiMentorship } from '../../src/modules/mentorship/aiMentorship.js';
import { bountyAndPods } from '../../src/modules/governance/bountyAndPods.js';
import { multiCurrencySettlement } from '../../src/modules/payments/multiCurrencySettlement.js';
import { communityAnalytics } from '../../src/modules/intelligence/communityAnalyticsEngine.js';
import { marketingStudio } from '../../src/modules/marketing/marketingStudio.js';
import { enterpriseGateway } from '../../src/modules/enterprise/enterpriseGateway.js';

describe('Section 23 - Wave 3: Academy, Mentorship, Governance & Enterprise', () => {
  const guildW3 = 'guild_wave3_main';
  let tenantId: string;

  beforeEach(() => {
    const tenant = tenantManager.provisionTenant({
      guildId: guildW3,
      name: 'Wave 3 Enterprise & Learning Hub',
      planTier: 'enterprise'
    });
    tenantId = tenant.id;
  });

  // =========================================================================
  // 1. Chapter 14: Adaptive Learning Academy & Skill Paths
  // =========================================================================
  describe('Chapter 14: Adaptive Learning Academy', () => {
    it('creates course, tracks adaptive progress, and issues diploma on completion', () => {
      const course = adaptiveAcademy.createCourse(
        tenantId,
        'instructor_youssef',
        'Advanced TypeScript & Systems Architecture',
        'Master generic constraints, decorators, and high-throughput backend services',
        [
          {
            id: 'l1',
            title: 'Generic Type Narrowing',
            content: 'Use conditional types and type guards.',
            quiz: {
              question: 'Which operator checks if a property exists in an object type?',
              options: ['typeof', 'keyof', 'in', 'instanceof'],
              correctIndex: 2,
              difficulty: 'medium'
            }
          },
          {
            id: 'l2',
            title: 'Distributed Transaction Patterns',
            content: 'Explore Sagas and 2PC.',
            quiz: {
              question: 'Which pattern uses compensating transactions on partial failures?',
              options: ['Saga Pattern', 'Two-Phase Commit', 'Event Sourcing', 'CQRS'],
              correctIndex: 0,
              difficulty: 'hard'
            }
          }
        ]
      );

      expect(course.id).toBeDefined();

      // Submit first quiz correctly
      const step1 = adaptiveAcademy.submitLessonQuiz(course.id, 'usr_student_1', 'l1', 2);
      expect(step1.passed).toBe(true);
      expect(step1.currentProgress).toBe(50.0);
      expect(step1.isCourseCompleted).toBe(false);

      // Submit second quiz correctly (hard difficulty -> accelerated pacing)
      const step2 = adaptiveAcademy.submitLessonQuiz(course.id, 'usr_student_1', 'l2', 0);
      expect(step2.passed).toBe(true);
      expect(step2.currentProgress).toBe(100.0);
      expect(step2.isCourseCompleted).toBe(true);
      expect(step2.credentialId).toBeDefined(); // Graduated & credential issued!
      expect(step2.nextRecommendedPacing).toBe('accelerated');
    });
  });

  // =========================================================================
  // 2. Chapter 15: AI-Powered Mentorship & 1-on-1 Office Hours
  // =========================================================================
  describe('Chapter 15: AI-Powered Mentorship & 1-on-1 Office Hours', () => {
    it('provisions mentorship, generates weekly study plan, and evaluates tasks', () => {
      const mentorship = aiMentorship.establishMentorship(
        tenantId,
        'usr_mentee_1',
        ['Master Next.js 15 Server Actions', 'Build Production Portfolio'],
        { language: 'ar' }
      );

      expect(mentorship.id).toBeDefined();
      const plan = JSON.parse(mentorship.weekly_plan_json);
      expect(plan.dailyTasks.length).toBe(3);
      expect(plan.mentorNudge).toContain('يا بطل');

      // Record task completion
      const checkin = aiMentorship.recordTaskCompletion(tenantId, 'usr_mentee_1', 'Sunday');
      expect(checkin.completedPercentage).toBeCloseTo(33.3, 1);
      expect(checkin.checkinMessage).toContain('Great job');
    });

    it('conducts asynchronous code clinic review with scores and actionable advice', () => {
      const sampleCode = `
        function calculateFee(amount) {
          if (!amount || amount <= 0) return 0;
          try {
            return amount * 0.05;
          } catch (e) {
            return 0;
          }
        }
      `;

      const review = aiMentorship.conductCodeClinicReview(sampleCode, 'en');
      expect(review.score).toBeGreaterThanOrEqual(80);
      expect(review.actionableAdvice.length).toBeGreaterThanOrEqual(2);
      expect(review.feedback).toContain('Solid code architecture');
    });
  });

  // =========================================================================
  // 3. Chapter 9 & 12: Dynamic Guild Pods & DAO-Lite Bounty Board
  // =========================================================================
  describe('Chapter 9 & 12: Dynamic Guild Pods & DAO-Lite Bounty Board', () => {
    it('manages micro-community pod lifecycle and sprint expiration', () => {
      const pod = bountyAndPods.createPod(
        tenantId,
        'Fintech AI Hackathon Squad',
        'Building an algorithmic trading agent in Python',
        'leader_omar',
        7 // 7 days
      );

      expect(pod.id).toBeDefined();
      expect(pod.memberIds).toContain('leader_omar');

      expect(bountyAndPods.joinPod(pod.id, 'usr_dev_kareem')).toBe(true);
      expect(pod.memberIds).toContain('usr_dev_kareem');

      const sprintCheck = bountyAndPods.evaluatePodSprint(pod.id);
      expect(sprintCheck.isExpired).toBe(false);
      expect(sprintCheck.status).toBe('active');
    });

    it('supports quadratic voting on community bounties and milestone release', () => {
      const bounty = bountyAndPods.createBounty(
        tenantId,
        'creator_tarek',
        'Build Discord Bot Dark Mode Analytics Dashboard',
        'Integrate Recharts with responsive mobile drawer',
        350
      );

      expect(bounty.status).toBe('open');

      // Member casts 16 reputation tokens -> sqrt(16) = 4 effective votes
      const vote1 = bountyAndPods.castQuadraticVote(bounty.id, 'voter_1', 16);
      expect(vote1.effectiveVotes).toBe(4.0);
      expect(vote1.newQuadraticTotal).toBe(4.0);

      // Second member casts 9 tokens -> sqrt(9) = 3 effective votes
      const vote2 = bountyAndPods.castQuadraticVote(bounty.id, 'voter_2', 9);
      expect(vote2.effectiveVotes).toBe(3.0);
      expect(vote2.newQuadraticTotal).toBe(7.0);

      // Claim, submit, and release
      expect(bountyAndPods.claimBounty(bounty.id, 'freelancer_salma')).toBe(true);
      expect(bountyAndPods.submitBountyDeliverable(bounty.id)).toBe(true);

      const release = bountyAndPods.approveAndReleaseBounty(bounty.id, 'creator_tarek');
      expect(release.released).toBe(true);
      expect(release.payoutAmountUsd).toBe(350);
    });
  });

  // =========================================================================
  // 4. Chapter 16 & 17: Multi-Currency Escrow & Sponsor Marketplace
  // =========================================================================
  describe('Chapter 16 & 17: Multi-Currency Escrow & Sponsor Marketplace', () => {
    it('converts USD into EUR, EGP, AED, USDC, and SOL with real-time exchange rates', () => {
      const quoteEgp = multiCurrencySettlement.convertCurrency(100, 'EGP');
      expect(quoteEgp.convertedAmount).toBeGreaterThan(4000); // 100 USD in EGP (~4761)
      expect(quoteEgp.targetCurrency).toBe('EGP');

      const quoteSol = multiCurrencySettlement.convertCurrency(290, 'SOL');
      expect(quoteSol.convertedAmount).toBe(2.0); // 290 USD / 145 = 2.0 SOL
    });

    it('generates non-custodial milestone release tokens and handles dispute locks', () => {
      const auth = multiCurrencySettlement.authorizeMilestoneRelease(
        'deal_web3_77',
        'ms_contract_audit',
        500,
        'USDC'
      );

      expect(auth.releaseToken.startsWith('rel_')).toBe(true);
      expect(auth.signatureHex).toHaveLength(64);
      expect(auth.isDisputed).toBe(false);

      // Lock milestone in dispute
      const locked = multiCurrencySettlement.lockDisputedMilestone(auth, 'Client reported deliverable defect');
      expect(locked.isDisputed).toBe(true);
    });

    it('lists sponsor packages and generates customized checkout URLs', () => {
      const packages = multiCurrencySettlement.getSponsorPackages();
      expect(packages.length).toBe(3);
      expect(packages[0].id).toBe('sponsor_bronze');

      const url = multiCurrencySettlement.generateSponsorCheckoutUrl(tenantId, 'sponsor_gold');
      expect(url).toContain(tenantId);
      expect(url).toContain('sponsor_gold');
    });
  });

  // =========================================================================
  // 5. Chapter 8, 20 & 23: Multi-Platform Sync, Churn & Burnout, Global Search
  // =========================================================================
  describe('Chapter 8, 20 & 23: Multi-Platform Sync & Intelligence', () => {
    it('normalizes bridge messages across Telegram, Slack, and Discord', () => {
      const tgRaw = {
        message_id: 101,
        chat: { id: -100123456 },
        from: { id: 777, username: 'telegram_coder' },
        text: 'Hello from Cairo Telegram group!',
        date: 1727620000
      };

      const normalized = communityAnalytics.normalizeMessage('telegram', tgRaw);
      expect(normalized.platform).toBe('telegram');
      expect(normalized.authorName).toBe('telegram_coder');
      expect(normalized.content).toBe('Hello from Cairo Telegram group!');
    });

    it('predicts churn risk and evaluates moderator fatigue', () => {
      // User inactive for 35 days with negative sentiment history
      const thirtyFiveDaysAgo = Date.now() - 35 * 24 * 60 * 60 * 1000;
      const churn = communityAnalytics.predictChurnRisk('usr_quiet', thirtyFiveDaysAgo, [-0.5, -0.8]);

      expect(churn.churnProbability).toBeGreaterThan(0.7);
      expect(churn.riskTier).toBe('critical');
      expect(churn.recommendation).toContain('reconnection DM');

      // Moderator working 45 hours handling 280 actions -> high fatigue
      const burnout = communityAnalytics.evaluateModeratorFatigue('mod_sam', 45, 280);
      expect(burnout.burnoutRisk).toBe('high_fatigue');
      expect(burnout.needsRestNudge).toBe(true);
    });

    it('executes unified global search across knowledge articles and workflows', () => {
      const results = communityAnalytics.searchGlobal(tenantId, 'Stripe webhook');
      expect(results).toBeInstanceOf(Array);
    });
  });

  // =========================================================================
  // 6. Chapter 21, 22, 27 & 28: Gamification, Stage Co-Pilot & Marketing Studio
  // =========================================================================
  describe('Chapter 21, 22, 27 & 28: Marketing Studio & Gamification', () => {
    it('generates seasonal quests with streak freeze protection', () => {
      const quests = marketingStudio.generateSeasonalQuests(4);
      expect(quests.length).toBe(3);
      expect(quests[0].streakProtected).toBe(true);
      expect(quests[0].rewardXp).toBeGreaterThan(0);
    });

    it('summarizes live stage sessions and ranks audience Q&A questions by upvotes', () => {
      const summary = marketingStudio.summarizeStageSession(
        'stage_workshop_10',
        'Microservices Architecture',
        'Discussed message queues and distributed caching',
        [
          { author: 'UserB', question: 'How do you handle schema migrations?', upvotes: 12 },
          { author: 'UserA', question: 'What about database connections?', upvotes: 4 }
        ]
      );

      expect(summary.keyTakeaways.length).toBeGreaterThan(0);
      expect(summary.audienceQuestions[0].upvotes).toBe(12); // Highest upvoted first
    });

    it('scores copywriting and generates weekly community changelogs', () => {
      const copyAnalysis = marketingStudio.analyzeCopywriting(
        'How to boost your freelance earnings fast. Step-by-step guide to landing $5k clients. Click and sign up now!'
      );

      expect(copyAnalysis.headlineScore).toBeGreaterThanOrEqual(80);
      expect(copyAnalysis.ctaStrength).toBe('strong');

      const changelog = marketingStudio.generateWeeklyChangelog('Nexus Dev Guild', ['Added Code Lab', 'Launched Bounty Board'], 8);
      expect(changelog).toContain('Nexus Dev Guild');
      expect(changelog).toContain('8 verified escrow milestone(s)');
    });
  });

  // =========================================================================
  // 7. Chapter 30: Enterprise Guild Solutions
  // =========================================================================
  describe('Chapter 30: Enterprise Guild Solutions', () => {
    it('configures enterprise SAML SSO metadata, SCIM, and regional data residency', () => {
      const config = enterpriseGateway.configureEnterprise(tenantId, {
        ssoProvider: 'Okta',
        ssoMetadataUrl: 'https://okta.example.com/app/saml/metadata',
        scimEndpoint: 'https://api.nexus.platform/scim/v2',
        dataResidencyRegion: 'me-central1',
        retentionDays: 365
      });

      expect(config.sso_provider).toBe('Okta');
      expect(config.data_residency_region).toBe('me-central1');
      expect(config.retention_days).toBe(365);
    });

    it('performs CMEK envelope encryption and decryption with AES-256-GCM', () => {
      const keySecret = 'enterprise_cmek_customer_key_secret_881';
      const sensitiveData = 'Confidential client contract terms: $50,000 USD deliverable';

      const encrypted = enterpriseGateway.encryptWithCmek(sensitiveData, keySecret);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toHaveLength(24);
      expect(encrypted.tag).toHaveLength(32);

      const decrypted = enterpriseGateway.decryptWithCmek(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        keySecret
      );
      expect(decrypted).toBe(sensitiveData);
    });

    it('processes SCIM 2.0 provisioning and enforces data retention purging', () => {
      const scimUser = {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: 'usr_corp_99',
        userName: 'khalid@enterprise.com',
        name: { formatted: 'Khalid Enterprise' },
        emails: [{ value: 'khalid@enterprise.com', primary: true }],
        active: true
      };

      const provision = enterpriseGateway.processScimProvision(tenantId, 'CREATE', scimUser);
      expect(provision.status).toBe('PROVISIONED');
      expect(provision.active).toBe(true);

      const purgedAuditRows = enterpriseGateway.enforceRetentionPolicy(tenantId);
      expect(typeof purgedAuditRows).toBe('number');
    });
  });
});
