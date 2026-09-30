import { describe, it, expect } from 'vitest';
import { PracticeLabsEngine } from '../../src/modules/learning/practiceLabs.js';
import { GrowthAssistantEngine } from '../../src/modules/assistance/growthAssistant.js';
import { CommunityCareEngine } from '../../src/modules/safety/communityCare.js';
import { TraditionsAndCultureEngine } from '../../src/modules/culture/traditionsAndFestivals.js';

describe('Section 24: Learning, Assistance, Safety & Culture (Chapters 51 to 90)', () => {
  const practiceLabs = PracticeLabsEngine.getInstance();
  const growthAssistant = GrowthAssistantEngine.getInstance();
  const communityCare = CommunityCareEngine.getInstance();
  const cultureEngine = TraditionsAndCultureEngine.getInstance();
  const testTenant = 'guild_culture_test_1';
  const testUser = 'user_learner_sarah';

  describe('Part C: Skills, Learning & Real-World Practice (Chapters 51 to 60)', () => {
    it('Chapter 51: retrieves visual skill trees with prerequisites and milestones', () => {
      const tree = practiceLabs.getSkillTree('frontend');
      expect(tree.length).toBeGreaterThan(0);
      expect(tree[0].discipline).toBe('frontend');
      expect(tree[0].resources[0].free).toBe(true);
    });

    it('Chapter 52: forms study squads with streak tracking', () => {
      const squad = practiceLabs.formStudySquad(testTenant, 'Fullstack Explorers', 'frontend', ['user_1', 'user_2', 'user_3'], 'UTC+2');
      expect(squad.id).toBeDefined();
      expect(squad.memberIds).toHaveLength(3);
      expect(squad.streakWeeks).toBe(0);
    });

    it('Chapter 53: gates Course Commons lesson publishing behind effort score, while keeping learning free', () => {
      const lowScoreRes = practiceLabs.publishCourseLesson('Intro to TypeScript', 'frontend', testUser, 'Lesson body...', [], 10);
      expect(lowScoreRes.success).toBe(false);
      expect(lowScoreRes.message).toContain('Effort score >= 20');

      const highScoreRes = practiceLabs.publishCourseLesson('Intro to TypeScript', 'frontend', testUser, 'Lesson body...', [], 25);
      expect(highScoreRes.success).toBe(true);
      expect(highScoreRes.lessonId).toBeDefined();
    });

    it('Chapter 54: simulates mock interview with STAR rubric feedback', () => {
      const result = practiceLabs.conductMockInterview('technical_code', [
        { question: 'Explain promises in JavaScript', answerSnippet: 'A promise represents an eventual completion of an async operation with pending, fulfilled, or rejected states.' }
      ]);
      expect(result.overallScore).toBeGreaterThanOrEqual(70);
      expect(result.recommendedDrills.length).toBeGreaterThan(0);
    });

    it('Chapter 55: tests kata submission for plagiarism and returns hint ladder', () => {
      const refCode = 'function twoSum(nums, target) { return []; }';
      const userCode = 'function twoSum(nums, target) { const map = new Map(); return []; }';

      const kataRes = practiceLabs.submitKataSolution(userCode, refCode);
      expect(kataRes.hintLadder).toHaveLength(3);
      expect(kataRes.similarityPercent).toBeLessThan(100);
    });

    it('Chapter 56: validates peer review submission and awards review credits', () => {
      const shortReview = practiceLabs.submitPeerReview(testTenant, testUser, 'sub_123', 'frontend', 4, 'Looks good.');
      expect(shortReview.success).toBe(false);

      const goodReview = practiceLabs.submitPeerReview(
        testTenant,
        testUser,
        'sub_123',
        'frontend',
        5,
        'Excellent modular code architecture with clean decoupling between data fetching and UI presentation.'
      );
      expect(goodReview.success).toBe(true);
      expect(goodReview.earnedCredit).toBe(true);
    });

    it('Chapter 57: pitches community projects on the Open Project Incubator', () => {
      const proj = practiceLabs.pitchCommunityProject(testTenant, testUser, 'Nexus Open Mobile Client', 'Cross-platform client', ['Lead Dev', 'UI Designer']);
      expect(proj.projectId).toBeDefined();
    });

    it('Chapter 58: creates volunteer civic tasks on the Impact Bounty Board', () => {
      const bounty = practiceLabs.createImpactBounty(testTenant, 'Build Accessible Landing Page for Youth NGO', 'ngo', 'Youth Coding Initiative', 'Full responsive site');
      expect(bounty.bountyId).toBeDefined();
    });

    it('Chapter 59: analyzes career skills gap with Career Compass', () => {
      const compass = practiceLabs.analyzeCareerCompass(['TypeScript', 'React'], 'senior_frontend');
      expect(compass.matchedSkills).toContain('TypeScript');
      expect(compass.missingSkills.length).toBeGreaterThan(0);
    });

    it('Chapter 60: synthesizes Portfolio Night critique themes and action items', () => {
      const synthesis = practiceLabs.synthesizePortfolioCritiques([
        { reviewer: 'designer_pro', feedback: 'Hero text lacks sufficient contrast on mobile devices, check WCAG.' }
      ]);
      expect(synthesis.keyThemes).toContain('Accessibility & Visual Hierarchy');
      expect(synthesis.actionItems[0]).toContain('WCAG AA');
    });
  });

  describe('Part D: Intelligence & Automation (Chapters 61 to 70)', () => {
    it('Chapter 61: maintains personal growth dashboard and next best actions', () => {
      const plan = growthAssistant.updateGrowthPlan(testTenant, testUser, ['Master System Architecture'], ['TypeScript', 'Docker']);
      expect(plan.nextBestAction).toContain('Master System Architecture');
    });

    it('Chapter 62: generates personalized Smart Digest within notification budgets', () => {
      const digest = growthAssistant.generateSmartDigest(testUser, ['frontend']);
      expect(digest.topDiscussions.length).toBeGreaterThan(0);
      expect(digest.unansweredQuestionsInDomain.length).toBeGreaterThan(0);
    });

    it('Chapter 63: routes help requests to active domain experts with cooldowns', () => {
      const routed = growthAssistant.routeHelpRequest(testTenant, testUser, 'Node.js Performance', 'How to profile memory leaks?');
      expect(routed.status).toBeDefined();
    });

    it('Chapter 64: coaches question quality and highlights missing reproducible contexts', () => {
      const vague = growthAssistant.evaluateQuestionQuality('It does not work help');
      expect(vague.score).toBeLessThan(70);
      expect(vague.suggestions.length).toBeGreaterThan(0);

      const good = growthAssistant.evaluateQuestionQuality('Getting error in Express ```TypeError: req.body is undefined``` at line 45');
      expect(good.score).toBeGreaterThan(70);
    });

    it('Chapter 65: explains runtime error stack traces and recommends verification steps', () => {
      const explanation = growthAssistant.explainError('TypeError: Cannot read properties of undefined (reading "map") at renderList');
      expect(explanation.errorType).toContain('TypeError');
      expect(explanation.verificationSteps.length).toBeGreaterThan(0);
    });

    it('Chapter 66: generates auto-documentation drafts and Mermaid architecture diagrams', () => {
      const docs = growthAssistant.generateProjectDocs({
        name: 'Nexus Core',
        description: 'Community operating bot',
        techStack: ['TypeScript', 'Node.js', 'SQLite']
      });
      expect(docs.readmeMarkdown).toContain('Nexus Core');
      expect(docs.mermaidDiagram).toContain('graph TD');
    });

    it('Chapter 67: validates startup ideas with MVP boundary and non-commercial disclaimers', () => {
      const validation = growthAssistant.validateIdea('A decentralized peer-to-peer tutoring network for student engineers');
      expect(validation.suggestedMvpFeatures.length).toBeGreaterThan(0);
      expect(validation.disclaimer).toContain('brainstorming tool');
    });

    it('Chapter 68: summarizes team meeting transcripts into decisions and tasks', () => {
      const summary = growthAssistant.summarizeMeeting('Transcript of engineering sync...');
      expect(summary.decisions.length).toBeGreaterThan(0);
      expect(summary.actionItems.length).toBeGreaterThan(0);
    });

    it('Chapter 69: conducts multi-agent Specialist Review across security and performance', () => {
      const review = growthAssistant.performSpecialistReview(testTenant, 'sub_999', 'const data = eval(input);');
      expect(review.securityScore).toBeLessThan(75);
      expect(review.summary).toContain('Specialist Review');
    });

    it('Chapter 70: provides interactive AI Literacy modules on verification and disclosure', () => {
      const modules = growthAssistant.getAILiteracyModules();
      expect(modules).toHaveLength(2);
      expect(modules[0].title).toContain('Hallucination Spotting');
    });
  });

  describe('Part E: Safety, Wellbeing & Trust (Chapters 71 to 80)', () => {
    it('Chapter 71: triggers friendly non-medical wellbeing break reminders after 2 hours', () => {
      const noNudge = communityCare.checkWellbeing(testTenant, testUser, 60);
      expect(noNudge.shouldNudge).toBe(false);

      const nudge = communityCare.checkWellbeing(testTenant, testUser, 130);
      expect(nudge.shouldNudge).toBe(true);
      expect(nudge.nudgeMessage).toContain('Non-medical friendly reminder');
    });

    it('Chapter 72: detects heated discussions and suggests voluntary mediation', () => {
      const calm = communityCare.analyzeConflictRisk(['Hello friend', 'Nice PR']);
      expect(calm.escalationDetected).toBe(false);

      const heated = communityCare.analyzeConflictRisk(['You are a scammer and liar', 'Stupid idiot stop']);
      expect(heated.escalationDetected).toBe(true);
      expect(heated.deEscalationPrompt).toContain('neutral mediation');
    });

    it('Chapter 73: scans text for known scam patterns and phishing attempts', () => {
      const scanClean = communityCare.scanForScams('Can you review my React code please?');
      expect(scanClean.flagged).toBe(false);

      const scanPhish = communityCare.scanForScams('To get hired send btc first to our wallet');
      expect(scanPhish.flagged).toBe(true);
      expect(scanPhish.advice).toContain('Never send advance funds');
    });

    it('Chapter 74: files safe encrypted reports with tracking tokens', () => {
      const report = communityCare.fileSafeReport(testTenant, testUser, 'bad_actor_1', 'Harassing DMs', true);
      expect(report.caseId).toBeDefined();
      expect(report.trackingToken).toHaveLength(32);
    });

    it('Chapter 75: exports member data and supports GDPR/CCPA hard deletion', () => {
      const data = communityCare.exportMemberData(testTenant, testUser);
      expect(data.userId).toBe(testUser);

      const purge = communityCare.hardPurgeMemberData(testTenant, testUser);
      expect(purge.success).toBe(true);
    });

    it('Chapter 76: logs explainable AI decisions with human appeal pathways', () => {
      const log = communityCare.logAIDecision(testTenant, testUser, 'SKILL_EVAL', 'Solved async kata', 'Achieved 95% test coverage');
      expect(log.logId).toBeDefined();

      const contest = communityCare.contestAIDecision(log.logId, 'I believe my solution handles edge cases correctly');
      expect(contest.success).toBe(true);
      expect(contest.message).toContain('independent human moderator');
    });

    it('Chapter 77: enforces youth safety DM restrictions between adults and minors', () => {
      const allowed = communityCare.canDirectMessage(true, true, true);
      expect(allowed).toBe(true);

      const blocked = communityCare.canDirectMessage(true, true, false);
      expect(blocked).toBe(false);
    });

    it('Chapter 78: detects lookalike username impersonation attempts', () => {
      const check = communityCare.checkImpersonationRisk(['AdminDave', 'LeadModerator'], 'Adm1nDave');
      expect(check.isImpersonating).toBe(true);
      expect(check.targetUser).toBe('AdminDave');
    });

    it('Chapter 79: alerts on license conflicts and confidentiality disclosures', () => {
      const ethics = communityCare.checkEthicsAndCopyright('Here is client confidential api_key = "sk_live_123" with GPL code in proprietary app');
      expect(ethics.licenseWarning).toBeDefined();
      expect(ethics.confidentialityWarning).toBeDefined();
    });

    it('Chapter 80: detects crisis signals and routes to verified hotlines immediately', () => {
      const crisis = communityCare.evaluateCrisisSignals('I am feeling so hopeless and want to end my life');
      expect(crisis.isCrisis).toBe(true);
      expect(crisis.hotlineMessage).toContain('findahelpline.com');
      expect(crisis.hotlineMessage).toContain('08008880700');
    });
  });

  describe('Part F: Culture, Experience & Longevity (Chapters 81 to 90)', () => {
    it('Chapter 81: generates themed onboarding quest steps', () => {
      const quests = cultureEngine.getOnboardingQuests('builder');
      expect(quests).toHaveLength(3);
      expect(quests[0].title).toBe('The First Spark');
    });

    it('Chapter 82: provides seasonal festival and tradition status', () => {
      const trad = cultureEngine.getSeasonalTraditionStatus();
      expect(trad.activeFestival).toBeDefined();
    });

    it('Chapter 83: plots member career timeline milestones', () => {
      const tl = cultureEngine.generateMemberTimeline(testUser, Date.now() - 30 * 86400000, ['Joined', 'Completed Kata', 'First Deal']);
      expect(tl.timelineEntries).toHaveLength(3);
    });

    it('Chapter 84: drafts community radio recap script in English and Egyptian Arabic', () => {
      const scripts = cultureEngine.generateWeeklyRecapScript({ topAnswers: 42, dealsClosed: 12, newMembers: 85 });
      expect(scripts.englishScript).toContain('42 technical questions');
      expect(scripts.arabicScript).toContain('42 سؤال برمجي');
    });

    it('Chapter 85: records learning game scores for seasonal improvement leaderboards', () => {
      const res = cultureEngine.recordGameScore(testTenant, 'regex_golf', testUser, 95);
      expect(res.rankSummary).toContain('Score 95 recorded');
    });

    it('Chapter 86: broadcasts alliance events to partner communities with data isolation', () => {
      const res = cultureEngine.broadcastAllianceEvent('Cross-Community AI Hackathon', ['guild_alpha', 'guild_beta']);
      expect(res.notifiedCount).toBe(2);
    });

    it('Chapter 88: compiles annual public impact report with aggregated statistics', () => {
      const rep = cultureEngine.generateAnnualImpactReport(2026);
      expect(rep.hoursMentoredTotal).toBeGreaterThan(1000);
      expect(rep.economicValueGeneratedUsd).toBeGreaterThan(100000);
    });

    it('Chapter 89: registers regional city chapters', () => {
      const reg = cultureEngine.registerRegionalChapter(testTenant, 'Egypt Chapter', 'Cairo', 'UTC+2', 'cairo_ambassador');
      expect(reg.chapterId).toBeDefined();
    });

    it('Chapter 90: monitors community succession runbook and bus-factor resilience', () => {
      const runbook = cultureEngine.getSuccessionRunbook();
      expect(runbook.busFactorScore).toBeGreaterThanOrEqual(3);
    });
  });
});
