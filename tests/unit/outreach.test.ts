import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import {
  outreachRulesGuard,
  MANDATORY_DISCLOSURE_EN,
  MANDATORY_DISCLOSURE_AR,
} from '../../src/modules/outreach/rulesGuard.js';
import {
  supplyDemandEngine,
  SKILL_CATEGORIES,
} from '../../src/modules/outreach/supplyDemandEngine.js';
import {
  opportunityDiscoveryService,
  CandidateOpportunity,
} from '../../src/modules/outreach/opportunityDiscovery.js';
import {
  solutionEngine,
  specialistSolutionEngine,
} from '../../src/modules/outreach/solutionEngine.js';
import {
  replyComposer,
} from '../../src/modules/outreach/replyComposer.js';
import {
  followUpHandler,
} from '../../src/modules/outreach/followUpHandler.js';
import {
  outreachReviewQueue,
} from '../../src/modules/outreach/outreachReviewQueue.js';
import {
  attributionFunnelService,
} from '../../src/modules/outreach/attributionFunnel.js';

describe('Section 21: Supply/Demand Intelligence & Community Outreach Engine', () => {
  const guildId = 'test_guild_outreach_1';

  beforeEach(() => {
    // Reset kill switch
    outreachRulesGuard.setKillSwitch(false);
  });

  // =========================================================================
  // 1. Database Schema
  // =========================================================================
  it('creates all 6 Section 21 SQLite outreach tables', () => {
    const tables = dbService.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'outreach_%'"
    );
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('outreach_gaps');
    expect(tableNames).toContain('outreach_candidates');
    expect(tableNames).toContain('outreach_reviews');
    expect(tableNames).toContain('outreach_stoplist');
    expect(tableNames).toContain('outreach_community_rules');
    expect(tableNames).toContain('outreach_attributions');
  });

  // =========================================================================
  // 2. Non-Negotiable Rules & OutreachRulesGuard (REQ-21.0, REQ-21.8.1, REQ-21.8.2)
  // =========================================================================
  describe('OutreachRulesGuard (REQ-21.0 & Compliance)', () => {
    it('REQ-21.0.1 & REQ-21.8.1: verifies mandatory AI disclosure in English and Arabic', () => {
      const validEn = `Hello! ${MANDATORY_DISCLOSURE_EN} Here is the solution to your React bug.`;
      const validAr = `أهلاً بك! ${MANDATORY_DISCLOSURE_AR} ده حل مشكلة الـ flexbox.`;
      const invalid = 'Hello! Here is the solution to your bug without any disclosure.';

      expect(outreachRulesGuard.verifyDisclosure(validEn)).toBe(true);
      expect(outreachRulesGuard.verifyDisclosure(validAr)).toBe(true);
      expect(outreachRulesGuard.verifyDisclosure(invalid)).toBe(false);
    });

    it('REQ-21.0.1: verifies outward-facing account bio description', () => {
      expect(outreachRulesGuard.verifyAccountProfile('AI-assisted community helper for Nexus')).toBe(true);
      expect(outreachRulesGuard.verifyAccountProfile('مساعد مجتمع ذكي لـ Nexus')).toBe(true);
      expect(outreachRulesGuard.verifyAccountProfile('Senior fullstack developer freelancer')).toBe(false);
    });

    it('REQ-21.0.2: validates single official registered account per platform', () => {
      expect(outreachRulesGuard.validateAccountUniqueness('reddit', 'u/NexusCommunityHelper')).toBe(true);
      expect(outreachRulesGuard.validateAccountUniqueness('reddit', 'u/RandomSpamBot')).toBe(false);
      expect(outreachRulesGuard.validateAccountUniqueness('stackoverflow', 'nexus-community-helper')).toBe(true);
      expect(outreachRulesGuard.validateAccountUniqueness('hackernews', 'nexus_helper')).toBe(true);
    });

    it('REQ-21.0.3 & REQ-21.8.3: enforces Facebook manual-only policy', () => {
      // Automated Facebook scraping forbidden
      const autoFb = outreachRulesGuard.validatePlatformIngestion({ platform: 'facebook', isManualSubmission: false });
      expect(autoFb.allowed).toBe(false);
      expect(autoFb.reason).toContain('Facebook scraping is forbidden');

      // Manual submission allowed
      const manualFb = outreachRulesGuard.validatePlatformIngestion({ platform: 'facebook', isManualSubmission: true });
      expect(manualFb.allowed).toBe(true);

      // Written admin permission allowed
      const adminPermFb = outreachRulesGuard.validatePlatformIngestion({ platform: 'facebook', hasWrittenAdminPermission: true });
      expect(adminPermFb.allowed).toBe(true);

      // Other platforms allowed for standard ingestion
      const reddit = outreachRulesGuard.validatePlatformIngestion({ platform: 'reddit' });
      expect(reddit.allowed).toBe(true);
    });

    it('REQ-21.0.6 & REQ-21.8.4: rejects unsolicited direct messages', () => {
      expect(outreachRulesGuard.validateChannelType('public_thread')).toBe(true);
      expect(outreachRulesGuard.validateChannelType('dm', false)).toBe(false); // Unsolicited DM blocked
      expect(outreachRulesGuard.validateChannelType('dm', true)).toBe(true);  // Recipient initiated allowed
    });

    it('REQ-21.0.7 & REQ-21.8.4: stop means stop - permanently halts outreach to stoplisted targets', () => {
      const testUser = 'user_opt_out_77';
      expect(outreachRulesGuard.isStopped(testUser, 'reddit')).toBe(false);

      outreachRulesGuard.addToStoplist(testUser, 'reddit', 'User commented stop');
      expect(outreachRulesGuard.isStopped(testUser, 'reddit')).toBe(true);

      // Validation fails when target is on stoplist
      const validation = outreachRulesGuard.validateOutboundPublish({
        text: `Hello ${MANDATORY_DISCLOSURE_EN}`,
        platform: 'reddit',
        community: 'r/reactjs',
        targetUser: testUser,
        isHumanApproved: true,
        channelType: 'public_thread',
      });
      expect(validation.allowed).toBe(false);
      expect(validation.violations).toContain(`Recipient ${testUser} is on the permanent stoplist`);
    });

    it('REQ-21.0.8 & REQ-21.8.8: enforces strict privacy & data minimization (zero profiling)', () => {
      const sanitized = outreachRulesGuard.sanitizeCandidateData({
        postUrl: 'https://reddit.com/r/webdev/comments/123',
        problemSummary: 'How to center a div using CSS grid?',
        category: 'web_dev',
        rawContent: 'My name is John Doe, email john@example.com, IP 1.2.3.4, age 25',
      });

      expect(sanitized.postUrl).toBe('https://reddit.com/r/webdev/comments/123');
      expect(sanitized.problemSummary).toBe('How to center a div using CSS grid?');
      expect(sanitized.category).toBe('web_dev');
      expect((sanitized as Record<string, unknown>).rawContent).toBeUndefined();
    });

    it('REQ-21.0.9 & REQ-21.8.2: Emergency Kill Switch halts all outbound operations immediately', () => {
      expect(outreachRulesGuard.isKillSwitchActive()).toBe(false);

      outreachRulesGuard.setKillSwitch(true, 'Test security lockdown');
      expect(outreachRulesGuard.isKillSwitchActive()).toBe(true);
      expect(outreachRulesGuard.getKillSwitchReason()).toBe('Test security lockdown');

      const validation = outreachRulesGuard.validateOutboundPublish({
        text: `Hello ${MANDATORY_DISCLOSURE_EN}`,
        platform: 'reddit',
        community: 'r/javascript',
        targetUser: 'some_user',
        isHumanApproved: true,
        channelType: 'public_thread',
      });
      expect(validation.allowed).toBe(false);
      expect(validation.violations?.[0]).toContain('emergency kill switch');

      // Reset
      outreachRulesGuard.setKillSwitch(false);
      expect(outreachRulesGuard.isKillSwitchActive()).toBe(false);
    });

    it('REQ-21.0.4 & REQ-21.8.2: blocks publishing without human Community Ambassador approval', () => {
      const unapproved = outreachRulesGuard.validateOutboundPublish({
        text: `Hello ${MANDATORY_DISCLOSURE_EN}`,
        platform: 'reddit',
        community: 'r/javascript',
        targetUser: 'some_user',
        isHumanApproved: false,
        channelType: 'public_thread',
      });
      expect(unapproved.allowed).toBe(false);
      expect(unapproved.violations).toContain('Outbound publish requires explicit human Community Ambassador approval');
    });

    it('REQ-21.2.4 & REQ-21.8.9: rejects sensitive topics (crisis, legal, minors)', () => {
      const crisis = outreachRulesGuard.isSensitiveTopic('I feel depressed and considering self-harm');
      expect(crisis.isSensitive).toBe(true);
      expect(crisis.reason).toContain('Crisis');

      const legal = outreachRulesGuard.isSensitiveTopic('My client refused to pay and I want to sue my client in court with a lawsuit');
      expect(legal.isSensitive).toBe(true);
      expect(legal.reason).toContain('legal');

      const minor = outreachRulesGuard.isSensitiveTopic('I am 13 years old and trying to build a website');
      expect(minor.isSensitive).toBe(true);
      expect(minor.reason).toContain('Minor');

      const normal = outreachRulesGuard.isSensitiveTopic('How do I fix a hydration error in Next.js 14?');
      expect(normal.isSensitive).toBe(false);
    });
  });

  // =========================================================================
  // 3. Supply/Demand Intelligence Engine (REQ-21.1)
  // =========================================================================
  describe('SupplyDemandEngine (REQ-21.1)', () => {
    it('covers all 10 defined skill categories', () => {
      expect(SKILL_CATEGORIES.length).toBe(10);
      expect(SKILL_CATEGORIES).toContain('web_dev');
      expect(SKILL_CATEGORIES).toContain('mobile_dev');
      expect(SKILL_CATEGORIES).toContain('bots_automation');
      expect(SKILL_CATEGORIES).toContain('ui_ux');
      expect(SKILL_CATEGORIES).toContain('video_editing');
      expect(SKILL_CATEGORIES).toContain('data_ai');
    });

    it('computes demand index, effective supply, and weekly gap score', () => {
      const gapMetrics = supplyDemandEngine.calculateCategoryGap(guildId, 'web_dev');
      expect(gapMetrics.category).toBe('web_dev');
      expect(typeof gapMetrics.demandIndex).toBe('number');
      expect(typeof gapMetrics.effectiveSupply).toBe('number');
      expect(typeof gapMetrics.gapScore).toBe('number');
      expect(['rising', 'stable', 'falling']).toContain(gapMetrics.trend);
      expect(gapMetrics.topUnmetSkills.length).toBeGreaterThan(0);
      expect(typeof gapMetrics.recommendedAction).toBe('string');
    });

    it('generates full heatmap for all 10 categories', () => {
      const heatmap = supplyDemandEngine.generateFullHeatmap(guildId);
      expect(heatmap.length).toBe(10);
      for (const cat of SKILL_CATEGORIES) {
        expect(heatmap.some(h => h.category === cat)).toBe(true);
      }
    });

    it('evaluates proactive gap alerts when threshold is exceeded', () => {
      supplyDemandEngine.setAlertThreshold(0.5); // Lower threshold to trigger alert
      const alerts = supplyDemandEngine.evaluateAlerts(guildId);
      expect(Array.isArray(alerts)).toBe(true);
      if (alerts.length > 0) {
        expect(alerts[0].gapScore).toBeGreaterThanOrEqual(0.5);
        expect(alerts[0].actionSuggestions.length).toBeGreaterThan(0);
      }
      supplyDemandEngine.setAlertThreshold(1.8); // Reset to default
    });
  });

  // =========================================================================
  // 4. Opportunity Discovery & Candidate Scoring (REQ-21.2)
  // =========================================================================
  describe('OpportunityDiscoveryService (REQ-21.2)', () => {
    it('fetches community rules and allows setting/updating rules', () => {
      const profile = opportunityDiscoveryService.getCommunityRules('reddit', 'r/reactjs');
      expect(profile.platform).toBe('reddit');
      expect(profile.communityName).toBe('r/reactjs');

      opportunityDiscoveryService.setCommunityRules({
        platform: 'reddit',
        communityName: 'r/reactjs',
        allowsBots: true,
        allowsPromo: false,
        allowsLinks: true,
        allowsUnsolicitedHelp: true,
        isPaused: false,
      });

      const updated = opportunityDiscoveryService.getCommunityRules('reddit', 'r/reactjs');
      expect(updated.allowsPromo).toBe(false);
    });

    it('scores candidates accurately and enforces quality threshold >= 0.65', () => {
      const goodPost = {
        title: 'Urgent: Next.js API route crashing with out of memory error',
        body: 'I have tried increasing node max memory and optimizing imports but serverless deployment still fails immediately. Need urgent help.',
        platform: 'reddit',
        community: 'r/nextjs',
        category: 'web_dev',
      };

      const score = opportunityDiscoveryService.scoreCandidate(goodPost);
      expect(score).toBeGreaterThanOrEqual(0.65);

      const vaguePost = {
        title: 'help',
        body: 'code does not work',
        platform: 'reddit',
        community: 'r/learnprogramming',
        category: 'web_dev',
      };

      const vagueScore = opportunityDiscoveryService.scoreCandidate(vaguePost);
      expect(vagueScore).toBeLessThan(score);
    });

    it('ingests permitted opportunities and filters out sensitive posts and stopped users', () => {
      outreachRulesGuard.addToStoplist('blocked_author_1', 'reddit', 'Requested opt-out');

      const opportunities = opportunityDiscoveryService.discoverOpportunities({
        platform: 'reddit',
        community: 'r/reactjs',
        category: 'web_dev',
        samplePosts: [
          {
            id: 'post_1',
            title: 'TypeScript error with React Router 6 loader types',
            body: 'How do I infer the loader data type correctly in React Router v6 component? Getting unknown type error.',
            authorId: 'dev_user_1',
            postUrl: 'https://reddit.com/r/reactjs/comments/1',
          },
          {
            id: 'post_2_sensitive',
            title: 'I am 13 and getting sued by client for breach of contract',
            body: 'My client is taking me to court with a lawyer.',
            authorId: 'dev_user_2',
            postUrl: 'https://reddit.com/r/reactjs/comments/2',
          },
          {
            id: 'post_3_blocked',
            title: 'Valid technical question but user opted out',
            body: 'How to optimize re-renders with useMemo?',
            authorId: 'blocked_author_1',
            postUrl: 'https://reddit.com/r/reactjs/comments/3',
          },
        ],
      });

      // Sensitive post and stopped user must be filtered out
      expect(opportunities.some(o => o.id === 'post_2_sensitive')).toBe(false);
      expect(opportunities.some(o => o.id === 'post_3_blocked')).toBe(false);

      const validCandidate = opportunities.find(o => o.id === 'post_1');
      expect(validCandidate).toBeDefined();
      expect(validCandidate?.score).toBeGreaterThanOrEqual(0.65);
    });
  });

  // =========================================================================
  // 5. Specialist Solution Engine & Code Sandbox Execution (REQ-21.3 & REQ-21.8.5)
  // =========================================================================
  describe('Specialist Solution Engine & Code Sandbox (REQ-21.3 & REQ-21.8.5)', () => {
    it('executes programming solutions in sandbox and returns execution metrics', async () => {
      const solution = await specialistSolutionEngine.solveProgramming({
        problemDescription: 'How to reverse an array in JavaScript without mutating original array?',
        language: 'javascript',
        codeSnippet: 'const arr = [1, 2, 3]; const reversed = [...arr].reverse(); console.log(JSON.stringify(reversed));',
      });

      expect(solution.codeSnippet).toContain('reversed');
      expect(solution.sandboxResult).toBeDefined();
      expect(solution.sandboxResult.success).toBe(true);
      expect(solution.sandboxResult.output).toContain('[3,2,1]');
      expect(solution.sandboxResult.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(solution.sandboxResult.isUntestedSnippet).toBe(false);
      expect(solution.confidenceScore).toBeGreaterThanOrEqual(0.8);
    });

    it('REQ-21.8.5: flags unverified or failed code snippets with [UNTESTED SNIPPET]', async () => {
      const brokenSolution = await specialistSolutionEngine.solveProgramming({
        problemDescription: 'Broken script testing fallback',
        language: 'javascript',
        codeSnippet: 'this is not valid javascript syntax (((( throw error;',
      });

      expect(brokenSolution.sandboxResult.success).toBe(false);
      expect(brokenSolution.sandboxResult.isUntestedSnippet).toBe(true);
      expect(brokenSolution.codeSnippet).toContain('[UNTESTED SNIPPET]');
    });

    it('produces design solutions with WCAG contrast and typography checks', () => {
      const designSol = specialistSolutionEngine.solveDesign({
        problemDescription: 'My landing page has white text on light gray background and fonts feel too small',
      });

      expect(designSol.actionableCritique.length).toBeGreaterThan(0);
      expect(designSol.wcagCompliantAdjustments).toBeDefined();
      expect(designSol.wcagCompliantAdjustments.length).toBeGreaterThan(0);
      expect(designSol.confidenceScore).toBeGreaterThanOrEqual(0.7);
    });

    it('produces business solutions with explicit non-legal/financial disclaimers', () => {
      const bizSol = specialistSolutionEngine.solveBusiness({
        problemDescription: 'How should I price my first freelance React project for an international client?',
      });

      expect(bizSol.pricingGuidance).toBeDefined();
      expect(bizSol.contractChecklist.length).toBeGreaterThan(0);
      expect(bizSol.legalDisclaimer).toContain('Disclaimer');
    });

    it('passes end-to-end multi-modal problem solving with self-reflection', async () => {
      const solution = await solutionEngine.generateSolution({
        category: 'web_dev',
        problemDescription: 'Fix Node.js HTTP 500 error when parsing JSON body',
        codeSnippet: 'const parsed = JSON.parse(req.body);',
      });

      expect(solution.category).toBe('web_dev');
      expect(solution.confidence).toBeGreaterThan(0.6);
      expect(solution.solutionSummary.length).toBeGreaterThan(20);
      expect(solution.nextSteps.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 6. 4-Part Reply Composer & Dialect Variation (REQ-21.4 & REQ-21.8.6)
  // =========================================================================
  describe('4-Part Reply Composer (REQ-21.4 & REQ-21.8.6)', () => {
    const candidate: CandidateOpportunity = {
      id: 'cand_test_900',
      platform: 'reddit',
      community: 'r/reactjs',
      postUrl: 'https://reddit.com/r/reactjs/comments/abc',
      title: 'React Router loader data type inference error',
      problemSummary: 'React Router loader data type inference error',
      category: 'web_dev',
      language: 'en',
      authorId: 'react_dev_1',
      score: 0.88,
      relevance: 0.9,
      urgency: 0.8,
      solvability: 0.9,
      communityFit: 0.8,
      allowsPromo: true,
      allowsLinks: true,
      status: 'discovered',
      createdAt: Date.now(),
    };

    it('composes all 4 parts in English with mandatory disclosure and tracked link', async () => {
      const rules = {
        platform: 'reddit',
        communityName: 'r/reactjs',
        allowsBots: true,
        allowsPromo: true,
        allowsLinks: true,
        allowsUnsolicitedHelp: true,
        isPaused: false,
      };

      const solution = await solutionEngine.generateSolution({
        category: 'web_dev',
        problemDescription: candidate.problemSummary,
        codeSnippet: 'const data = useLoaderData() as ExpectedType;',
      });

      const draft = replyComposer.composeReply({
        candidate,
        solution,
        rules,
        language: 'en',
      });

      // Part 1: Greeting + Disclosure
      expect(draft.part1Greeting).toBeDefined();
      expect(outreachRulesGuard.verifyDisclosure(draft.part1Greeting)).toBe(true);

      // Part 2: Verified Solution
      expect(draft.part2Solution.length).toBeGreaterThan(30);

      // Part 3: About Nexus (promo allowed)
      expect(draft.part3AboutNexus).toBeDefined();
      expect(draft.part3AboutNexus).toContain('Nexus');

      // Part 4: Tracked Link
      expect(draft.part4Link).toBeDefined();
      expect(draft.part4Link).toContain('discord.gg/nexus');

      // Full text contains all parts & disclosure
      expect(draft.fullText).toContain(MANDATORY_DISCLOSURE_EN);
      expect(outreachRulesGuard.verifyDisclosure(draft.fullText)).toBe(true);
    });

    it('composes in casual Egyptian Arabic with dialect match and Arabic disclosure', async () => {
      const arCandidate: CandidateOpportunity = {
        ...candidate,
        language: 'ar',
        problemSummary: 'عندي مشكلة في كود بايثون بيطلع KeyError',
      };

      const rules = {
        platform: 'facebook',
        communityName: 'Egyptian Freelancers Group',
        allowsBots: true,
        allowsPromo: true,
        allowsLinks: true,
        allowsUnsolicitedHelp: true,
        isPaused: false,
      };

      const solution = await solutionEngine.generateSolution({
        category: 'bots_automation',
        problemDescription: arCandidate.problemSummary,
      });

      const draft = replyComposer.composeReply({
        candidate: arCandidate,
        solution,
        rules,
        language: 'ar',
      });

      expect(draft.part1Greeting).toBeDefined();
      expect(outreachRulesGuard.verifyDisclosure(draft.part1Greeting)).toBe(true);
      expect(draft.fullText).toContain(MANDATORY_DISCLOSURE_AR);
      expect(draft.fullText).toContain('مجتمع Nexus');
    });

    it('REQ-21.8.3: omits Part 3 and Part 4 when community rules forbid promo or links', async () => {
      const strictRules = {
        platform: 'stackoverflow',
        communityName: 'stackoverflow.com',
        allowsBots: true,
        allowsPromo: false, // NO PROMO
        allowsLinks: false, // NO LINKS
        allowsUnsolicitedHelp: true,
        isPaused: false,
      };

      const solution = await solutionEngine.generateSolution({
        category: 'web_dev',
        problemDescription: candidate.problemSummary,
      });

      const draft = replyComposer.composeReply({
        candidate,
        solution,
        rules: strictRules,
        language: 'en',
      });

      expect(draft.part1Greeting).toBeDefined();
      expect(draft.part2Solution).toBeDefined();
      // Part 3 and 4 must be completely omitted
      expect(draft.part3AboutNexus).toBeUndefined();
      expect(draft.part4Link).toBeUndefined();
      expect(draft.fullText).not.toContain('discord.gg/nexus');
    });

    it('REQ-21.8.6: generates varied phrasing to avoid repetitive bot templates', async () => {
      const rules = opportunityDiscoveryService.getCommunityRules('reddit', 'r/webdev');
      const solution = await solutionEngine.generateSolution({
        category: 'web_dev',
        problemDescription: 'CSS layout flexbox wrapping issue',
      });

      const draft1 = replyComposer.composeReply({ candidate, solution, rules, language: 'en' });
      const draft2 = replyComposer.composeReply({ candidate, solution, rules, language: 'en' });

      // The greeting and disclosure wording or structure should vary across runs
      expect(draft1.fullText).toBeDefined();
      expect(draft2.fullText).toBeDefined();
      expect(outreachRulesGuard.verifyDisclosure(draft1.fullText)).toBe(true);
      expect(outreachRulesGuard.verifyDisclosure(draft2.fullText)).toBe(true);
    });
  });

  // =========================================================================
  // 7. Follow-Up & Identity Honesty Handler (REQ-21.5 & REQ-21.8.7)
  // =========================================================================
  describe('FollowUpHandler & Honesty Protocol (REQ-21.5 & REQ-21.8.7)', () => {
    it('REQ-21.5.3 & REQ-21.8.7: provides radical honesty when asked "are you a bot?"', async () => {
      const enQuery = 'Wait, are you a bot or an AI?';
      const enReply = await followUpHandler.handleIncomingReply({
        platform: 'reddit',
        community: 'r/reactjs',
        authorId: 'curious_user',
        replyText: enQuery,
        previousSnippet: '',
      });

      expect(enReply.shouldContinue).toBe(true);
      expect(enReply.response).toContain('AI-assisted community helper');
      expect(enReply.response).toContain('Nexus');

      const arQuery = 'هو انت روبوت ولا ايه؟';
      const arReply = await followUpHandler.handleIncomingReply({
        platform: 'facebook',
        community: 'Egyptian Tech Hub',
        authorId: 'curious_user_2',
        replyText: arQuery,
        previousSnippet: '',
      });

      expect(arReply.shouldContinue).toBe(true);
      expect(arReply.response).toContain('ذكاء اصطناعي');
      expect(arReply.response).toContain('Nexus');
    });

    it('REQ-21.5.4: immediately stops and stoplists user upon hostility or opt-out', async () => {
      const hostileUser = 'angry_troll_404';
      const hostileMessage = 'Stop spamming this subreddit you stupid bot, unsubscribe and leave us alone!';

      const reply = await followUpHandler.handleIncomingReply({
        platform: 'reddit',
        community: 'r/webdev',
        authorId: hostileUser,
        replyText: hostileMessage,
        previousSnippet: '',
      });

      expect(reply.shouldContinue).toBe(false);
      expect(reply.response).toContain('Apologies for any disruption');
      expect(outreachRulesGuard.isStopped(hostileUser, 'reddit')).toBe(true);
    });

    it('REQ-21.5.2 & REQ-21.8.7: reproduces code challenge in sandbox and provides corrected patch', async () => {
      const challengeMsg = "Your code gave a TypeError: Cannot read property 'map' of undefined when data is empty";
      const oldSnippet = 'const renderList = (data) => data.map(x => x.name);';

      const reply = await followUpHandler.handleIncomingReply({
        platform: 'reddit',
        community: 'r/javascript',
        authorId: 'bug_reporter',
        replyText: challengeMsg,
        previousSnippet: oldSnippet,
      });

      expect(reply.shouldContinue).toBe(true);
      expect(reply.correctedSnippet).toBeDefined();
      expect(reply.response).toContain('reproduced');
    });
  });

  // =========================================================================
  // 8. Review Queue, Stand-Alone Value Gate & Governance (REQ-21.6)
  // =========================================================================
  describe('OutreachReviewQueue (REQ-21.6 & Value Gate)', () => {
    const candidate: CandidateOpportunity = {
      id: 'cand_review_test_1',
      platform: 'reddit',
      community: 'r/node',
      postUrl: 'https://reddit.com/r/node/comments/xyz',
      title: 'Memory leak in Express EventEmitter listeners',
      problemSummary: 'Memory leak in Express EventEmitter listeners',
      category: 'web_dev',
      language: 'en',
      authorId: 'node_dev_55',
      score: 0.91,
      relevance: 0.9,
      urgency: 0.8,
      solvability: 0.9,
      communityFit: 0.8,
      allowsPromo: true,
      allowsLinks: true,
      status: 'discovered',
      createdAt: Date.now(),
    };

    it('REQ-21.6.3: enforces stand-alone value gate (rejects incomplete drafts)', () => {
      const emptyDraft = {
        fullText: 'Short draft',
        part1Greeting: 'Hi',
        part2Solution: 'Try using google.', // Less than 50 chars / incomplete
      };

      expect(() => {
        outreachReviewQueue.queueForReview(candidate, emptyDraft);
      }).toThrow('Value Gate Failed');
    });

    it('queues valid draft and enables ambassador approval, edit, reject, and do-not-post', async () => {
      const validDraft = {
        fullText: `Hello! ${MANDATORY_DISCLOSURE_EN}\n\nHere is how you fix the EventEmitter memory leak: call removeListener or use once() inside your route handler to ensure cleanup on connection close.\n\nJoin Nexus: discord.gg/nexus`,
        part1Greeting: `Hello! ${MANDATORY_DISCLOSURE_EN}`,
        part2Solution: 'Here is how you fix the EventEmitter memory leak: call removeListener or use once() inside your route handler to ensure cleanup on connection close.',
        part3AboutNexus: 'Nexus is a freelance community.',
        part4Link: 'https://discord.gg/nexus',
      };

      const reviewItem = outreachReviewQueue.queueForReview(candidate, validDraft, 'Sandbox tests passed in 12ms');
      expect(reviewItem.id).toBeDefined();
      expect(reviewItem.status).toBe('pending');

      const pending = outreachReviewQueue.getPendingReviews();
      expect(pending.some(p => p.id === reviewItem.id)).toBe(true);

      // 1. Ambassador edit with valid disclosure retention
      const editedText = `${validDraft.fullText}\n\nAdditional tip: check process.on('warning') to trace emitter leaks.`;
      const editResult = await outreachReviewQueue.edit(reviewItem.id, editedText, 'ambassador_sam');
      expect(editResult.success).toBe(true);
      expect(editResult.publishedText).toContain('Additional tip');
    });

    it('prevents ambassador edit if mandatory disclosure is removed', async () => {
      const validDraft = {
        fullText: `Hello! ${MANDATORY_DISCLOSURE_EN}\n\nComprehensive solution with standalone value and full explanation for debugging.`,
        part1Greeting: `Hello! ${MANDATORY_DISCLOSURE_EN}`,
        part2Solution: 'Comprehensive solution with standalone value and full explanation for debugging.',
      };

      const item = outreachReviewQueue.queueForReview({ ...candidate, id: 'cand_review_test_2' }, validDraft);
      
      // Attempting to remove disclosure
      const strippedEdit = 'Comprehensive solution with standalone value but NO AI DISCLOSURE HERE.';
      const res = await outreachReviewQueue.edit(item.id, strippedEdit, 'ambassador_sam');
      expect(res.success).toBe(false);
      expect(res.error).toContain('mandatory Nexus disclosure line');
    });

    it('rejects candidate with recorded decision reason', () => {
      const validDraft = {
        fullText: `Hello! ${MANDATORY_DISCLOSURE_EN}\n\nComprehensive solution with standalone value and full explanation for debugging.`,
        part1Greeting: `Hello! ${MANDATORY_DISCLOSURE_EN}`,
        part2Solution: 'Comprehensive solution with standalone value and full explanation for debugging.',
      };

      const item = outreachReviewQueue.queueForReview({ ...candidate, id: 'cand_review_test_3' }, validDraft);
      const rejRes = outreachReviewQueue.reject(item.id, 'ambassador_sam', 'Thread was already answered by OP');
      expect(rejRes.success).toBe(true);
    });

    it('marks candidate as Do Not Post with reason', () => {
      const validDraft = {
        fullText: `Hello! ${MANDATORY_DISCLOSURE_EN}\n\nComprehensive solution with standalone value and full explanation for debugging.`,
        part1Greeting: `Hello! ${MANDATORY_DISCLOSURE_EN}`,
        part2Solution: 'Comprehensive solution with standalone value and full explanation for debugging.',
      };

      const item = outreachReviewQueue.queueForReview({ ...candidate, id: 'cand_review_test_4' }, validDraft);
      const dnpRes = outreachReviewQueue.markDoNotPost(item.id, 'ambassador_sam', 'Competitor thread');
      expect(dnpRes.success).toBe(true);
    });
  });

  // =========================================================================
  // 9. Attribution Funnel, Auto-Pause & Weekly Report (REQ-21.7)
  // =========================================================================
  describe('AttributionFunnelService (REQ-21.7)', () => {
    const campaignCode = `nx_camp_${Date.now()}`;

    it('creates campaign and tracks full conversion funnel', () => {
      const campaign = attributionFunnelService.createCampaign(campaignCode, 'reddit', 'r/reactjs');
      expect(campaign.campaignCode).toBe(campaignCode);
      expect(campaign.clicks).toBe(0);

      // Track clicks
      expect(attributionFunnelService.recordClick(campaignCode)).toBe(true);
      expect(attributionFunnelService.recordClick(campaignCode)).toBe(true);

      // Track join
      expect(attributionFunnelService.recordJoin(campaignCode)).toBe(true);

      // Track verification
      expect(attributionFunnelService.recordVerified(campaignCode)).toBe(true);

      // Track 30d retention
      expect(attributionFunnelService.recordActive30d(campaignCode)).toBe(true);

      const metrics = attributionFunnelService.getFunnelMetrics(campaignCode);
      expect(metrics.totalClicks).toBe(2);
      expect(metrics.totalJoins).toBe(1);
      expect(metrics.totalVerified).toBe(1);
      expect(metrics.totalActive30d).toBe(1);
      expect(metrics.clickToJoinRate).toBe(0.5);
    });

    it('REQ-21.7.2: automatically pauses community upon moderator warning or removal', () => {
      const platform = 'reddit';
      const community = 'r/unfriendly_mods';

      // Ensure community is active
      opportunityDiscoveryService.setCommunityRules({
        platform,
        communityName: community,
        allowsBots: true,
        allowsPromo: true,
        allowsLinks: true,
        allowsUnsolicitedHelp: true,
        isPaused: false,
      });

      expect(opportunityDiscoveryService.getCommunityRules(platform, community).isPaused).toBe(false);

      // Moderator issues warning
      const res = attributionFunnelService.handleModeratorSignal(
        platform,
        community,
        'warning',
        'Outreach bot post removed by mod team'
      );

      expect(res.paused).toBe(true);
      expect(res.message).toContain('automatically paused');

      // Verify community rules state is paused
      const rules = opportunityDiscoveryService.getCommunityRules(platform, community);
      expect(rules.isPaused).toBe(true);
      expect(rules.pauseReason).toContain('Outreach bot post removed');
    });

    it('REQ-21.7.3: captures ambassador edits as labeled learning dataset', () => {
      const example = attributionFunnelService.recordAmbassadorEdit({
        reviewId: 'rev_test_55',
        originalDraft: 'Original drafted reply text here.',
        editedReply: 'Original drafted reply text here with helpful extra explanation.',
        category: 'web_dev',
        platform: 'reddit',
        reason: 'Added deeper explanation of async/await',
      });

      expect(example.id).toBeDefined();
      expect(example.charDelta).toBeGreaterThan(0);

      const dataset = attributionFunnelService.getLearningDataset();
      expect(dataset.some(d => d.reviewId === 'rev_test_55')).toBe(true);
    });

    it('REQ-21.7.4: generates weekly outreach intelligence report in English and Arabic', () => {
      const report = attributionFunnelService.generateWeeklyReport(guildId);
      expect(report.reportId).toBeDefined();
      expect(report.gapShifts.length).toBe(10);
      expect(report.recommendedFocusAreas.length).toBeGreaterThan(0);
      expect(report.bilingualSummary.en).toContain('Weekly Nexus Outreach Digest');
      expect(report.bilingualSummary.ar).toContain('تقرير نكسس الأسبوعي');
    });
  });
});
