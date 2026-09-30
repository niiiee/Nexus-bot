import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { institutionalMemoryService } from '../../src/modules/intelligence/institutionalMemory.js';
import { agenticServerManager } from '../../src/modules/intelligence/agenticServerManager.js';
import { semanticCommunitySearch } from '../../src/modules/intelligence/semanticSearch.js';
import { sourceMapAnswersEngine } from '../../src/modules/intelligence/sourceMapAnswers.js';
import { arabicDialectUnderstandingPack } from '../../src/modules/intelligence/dialectPack.js';
import { hallucinationFirewall } from '../../src/modules/intelligence/hallucinationFirewall.js';
import { skillAssessmentBank } from '../../src/modules/academy/skillAssessmentBank.js';
import { projectCertificationEngine } from '../../src/modules/academy/projectCertification.js';
import { explainableJobMatchingEngine } from '../../src/modules/freelancer/explainableJobMatching.js';
import { dealRiskExplainer } from '../../src/modules/deals/dealRiskExplainer.js';
import { portfolioAuthenticityAdvisor } from '../../src/modules/freelancer/portfolioAuthenticity.js';
import { ruleSimulator } from '../../src/modules/rules/ruleSimulator.js';
import { ruleAmendmentPathway } from '../../src/modules/governance/ruleAmendmentPathway.js';
import { whistleblowerProtectionEngine } from '../../src/modules/governance/whistleblowerProtection.js';
import { advancedMinorSafetySystem } from '../../src/modules/safety/advancedMinorSafety.js';
import { federatedBlocklistManager } from '../../src/modules/safety/federatedBlocklist.js';
import { rulesEngine } from '../../src/modules/rules/rulesEngine.js';

describe('Wave 2 Behavioral Test Suite (16 Chapters)', () => {
  beforeEach(() => {
    rulesEngine.seedRulesTable();
  });

  // Chapter 196: Institutional Memory
  describe('Chapter 196: Institutional Memory (REQ-26.196)', () => {
    it('stores approved community decisions and enforces strict tenant isolation', () => {
      institutionalMemoryService.recordDecision({
        tenantId: 'tenant_alpha',
        topic: 'Deal Dispute Fee Policy',
        approvedDecision: 'Standard fee is 0% for members and 2% for non-members.',
        decidedBy: 'Council Vote #42',
        tags: ['deals', 'fees']
      });

      // Tenant Alpha gets results
      const resAlpha = institutionalMemoryService.queryMemory('tenant_alpha', 'fee');
      expect(resAlpha.length).toBeGreaterThanOrEqual(1);
      expect(resAlpha[0].approvedDecision).toContain('0%');

      // Tenant Beta gets zero results (Isolation Guard)
      const resBeta = institutionalMemoryService.queryMemory('tenant_beta', 'fee');
      expect(resBeta.length).toBe(0);
    });
  });

  // Chapter 197: Agentic Server Manager
  describe('Chapter 197: Agentic Server Manager (REQ-26.197)', () => {
    it('plans multi-step server tasks with dry-run preview, approval gate, and rollback', () => {
      const plan = agenticServerManager.generatePlan({
        guildId: 'guild_agent_test',
        requesterId: 'admin_user',
        title: 'Provision Career Coaching Hub',
        steps: [
          { stepNumber: 1, action: 'create_channel', target: 'career-coaching', parameters: { type: 'forum' } },
          { stepNumber: 2, action: 'update_role', target: 'VerifiedCoach', parameters: { mentionable: true } }
        ]
      });

      expect(plan.status).toBe('pending_approval');
      expect(plan.steps.length).toBe(2);

      // Approve & execute
      const execRes = agenticServerManager.approveAndExecutePlan(plan.id, 'owner_human');
      expect(execRes.success).toBe(true);

      // Rollback
      const rbRes = agenticServerManager.rollbackPlan(plan.id);
      expect(rbRes.success).toBe(true);
    });
  });

  // Chapter 205: Semantic Community Search
  describe('Chapter 205: Semantic Community Search (REQ-26.205)', () => {
    it('searches knowledge documents with permission filtering', () => {
      // Regular member search -> gets public docs, excludes staff
      const publicSearch = semanticCommunitySearch.search('escrow milestone', ['member']);
      expect(publicSearch.length).toBeGreaterThanOrEqual(1);
      expect(publicSearch.some((d) => d.title.includes('Escrow'))).toBe(true);
      expect(publicSearch.some((d) => d.docId === 'KB-STAFF')).toBe(false);

      // Staff member search -> includes staff playbook
      const staffSearch = semanticCommunitySearch.search('moderation escalation', ['staff']);
      expect(staffSearch.some((d) => d.docId === 'KB-STAFF')).toBe(true);
    });
  });

  // Chapter 206: Answers with Source Map
  describe('Chapter 206: Answers with Source Map (REQ-26.206)', () => {
    it('generates answers linking claims to source citations and triggers fallback for ungrounded queries', () => {
      const docs = [
        { id: 'DOC-1', content: 'Nexus community rules prohibit off-platform escrow evasion to protect freelancers.' }
      ];

      // Grounded query
      const grounded = sourceMapAnswersEngine.generateGroundedAnswer('How does Nexus protect freelancers in escrow?', docs);
      expect(grounded.isGrounded).toBe(true);
      expect(grounded.sourceMap.length).toBeGreaterThan(0);
      expect(grounded.sourceMap[0].sourceDocId).toBe('DOC-1');

      // Ungrounded out-of-scope query
      const ungrounded = sourceMapAnswersEngine.generateGroundedAnswer('What is the weather in Tokyo tomorrow?', docs);
      expect(ungrounded.isGrounded).toBe(false);
      expect(ungrounded.fallbackTriggered).toBe(true);
      expect(ungrounded.answerText).toContain('do not have verified community documentation');
    });
  });

  // Chapter 209: Arabic Dialect Understanding Pack
  describe('Chapter 209: Arabic Dialect Understanding Pack (REQ-26.209)', () => {
    it('detects distinct Arabic dialects and normalizes text', () => {
      const egRes = arabicDialectUnderstandingPack.analyzeDialect('ازيك يا هندسة عامل ايه دلوقتي');
      expect(egRes.detectedDialect).toBe('egyptian');
      expect(egRes.confidence).toBeGreaterThan(0.7);

      const gfRes = arabicDialectUnderstandingPack.analyzeDialect('شلونك يا ليت تسويلي هذا الكود');
      expect(gfRes.detectedDialect).toBe('gulf');

      const mgRes = arabicDialectUnderstandingPack.analyzeDialect('عندي مشكل ديال السيرفر كيعطيني ارور');
      expect(mgRes.detectedDialect).toBe('maghrebi');
    });
  });

  // Chapter 210: Hallucination Firewall
  describe('Chapter 210: Hallucination Firewall (REQ-26.210)', () => {
    it('intercepts fabricated slash commands and suspicious phishing domains', () => {
      const clean = hallucinationFirewall.inspectResponse('Please check /rules or visit https://nexus.community/docs');
      expect(clean.passed).toBe(true);

      const hallucinated = hallucinationFirewall.inspectResponse('Use the command /magical-free-nitro-generator to get coins');
      expect(hallucinated.passed).toBe(false);
      expect(hallucinated.hallucinationsDetected.length).toBeGreaterThan(0);
    });
  });

  // Chapter 211: Verified Skill Assessment Bank
  describe('Chapter 211: Verified Skill Assessment Bank (REQ-26.211)', () => {
    it('rotates questions by exposure count and isolates leaked items', () => {
      const q1 = skillAssessmentBank.getRotatedQuestion('Fullstack TypeScript', 'Senior');
      expect(q1).toBeDefined();

      // Flag leak
      if (q1) {
        skillAssessmentBank.flagQuestionLeak(q1.id);
        const qAfterLeak = skillAssessmentBank.getRotatedQuestion('Fullstack TypeScript', 'Senior');
        // Leaked question must not be returned
        expect(qAfterLeak?.id).not.toBe(q1.id);
      }
    });
  });

  // Chapter 212: Project-Based Certification
  describe('Chapter 212: Project-Based Certification (REQ-26.212)', () => {
    it('conducts blind peer reviews and excludes authors from grading their own projects', () => {
      const cert = projectCertificationEngine.submitProject({
        userId: 'candidate_dev',
        projectTitle: 'Distributed Task Queue',
        repositoryUrl: 'https://github.com/candidate/queue'
      });

      // Conflict of interest check
      const selfGrade = projectCertificationEngine.addPanelEvaluation({
        certId: cert.id,
        reviewerId: 'candidate_dev', // Same as author
        codeQualityScore: 25,
        testCoverageScore: 25,
        architectureScore: 25,
        documentationScore: 25,
        comments: 'Self appraisal'
      });
      expect(selfGrade.success).toBe(false);
      expect(selfGrade.message).toContain('Conflict of interest');

      // Valid independent review
      const rev1 = projectCertificationEngine.addPanelEvaluation({
        certId: cert.id,
        reviewerId: 'independent_evaluator_1',
        codeQualityScore: 22,
        testCoverageScore: 20,
        architectureScore: 23,
        documentationScore: 20,
        comments: 'Clean architecture and solid tests.'
      });
      expect(rev1.success).toBe(true);
      expect(rev1.record?.finalScore).toBe(85);
    });
  });

  // Chapter 226: Explainable Job Matching
  describe('Chapter 226: Explainable Job Matching (REQ-26.226)', () => {
    it('provides clear reason codes and guarantees newcomer exploration quota', () => {
      const recommendations = explainableJobMatchingEngine.matchJob({
        jobId: 'job_react_lead',
        requiredField: 'Frontend Engineering',
        requiredTools: ['React', 'Next.js', 'Tailwind'],
        candidates: [
          { userId: 'senior_1', field: 'Frontend Engineering', tools: ['React', 'Next.js'], seniority: 'Senior', dealCount: 15 },
          { userId: 'newcomer_1', field: 'Frontend Engineering', tools: ['React'], seniority: 'Junior', dealCount: 0 }
        ]
      });

      expect(recommendations.length).toBe(2);
      expect(recommendations[0].reasonCodes.length).toBeGreaterThan(0);

      // Check newcomer quota allocation
      const newcomerRec = recommendations.find((r) => r.candidateId === 'newcomer_1');
      expect(newcomerRec?.isNewcomerQuota).toBe(true);
      expect(newcomerRec?.reasonCodes.some((rc) => rc.includes('NEWCOMER_EXPLORATION_QUOTA'))).toBe(true);
    });
  });

  // Chapter 228: Deal Risk Score Explainer
  describe('Chapter 228: Deal Risk Score Explainer (REQ-26.228)', () => {
    it('breaks down risk factors transparently and never blocks deals automatically', () => {
      const risk = dealRiskExplainer.analyzeDealRisk({
        dealId: 'deal_high_value_rush',
        amount: 3500,
        timelineDays: 2,
        isClientNew: true,
        hasOffPlatformMention: true
      });

      expect(risk.overallRiskLevel).toBe('ELEVATED');
      expect(risk.factors.length).toBe(3);
      expect(risk.requiresHumanMiddleman).toBe(true);
      // Hardcoded charter guarantee: automated system never blocks outright
      expect(risk.canProceedWithoutBlock).toBe(true);
    });
  });

  // Chapter 229: Portfolio Authenticity Check (Advisory)
  describe('Chapter 229: Portfolio Authenticity Check (REQ-26.229)', () => {
    it('detects duplicate repos and opens staff advisory without issuing public accusations', () => {
      const report = portfolioAuthenticityAdvisor.screenPortfolio({
        id: 'port_1',
        userId: 'dev_suspect',
        url: 'https://github.com/facebook/react',
        title: 'My Custom UI Library',
        authorClaim: 'Built from scratch'
      });

      expect(report.isSuspectDuplicate).toBe(true);
      expect(report.similarityScore).toBeGreaterThanOrEqual(0.70);
      expect(report.isStaffAdvisoryOpened).toBe(true);
      // Inviolable guarantee: no public accusations
      expect(report.publicAccusationIssued).toBe(false);
    });
  });

  // Chapter 269: Rule Simulator on Scenarios
  describe('Chapter 269: Rule Simulator on Scenarios (REQ-26.269)', () => {
    it('evaluates simulated scenario without creating disciplinary DB records', () => {
      const sim = ruleSimulator.simulateScenario('spam spam spam buy cheap followers', 'en');

      expect(sim.isViolation).toBe(true);
      expect(sim.ruleTriggered).toBe('R01');
      expect(sim.isSandboxed).toBe(true);

      // Verify zero records in DB
      const count = dbService.get<{ count: number }>(
        `SELECT count(*) as count FROM moderation_cases_v2 WHERE user_id = 'sandbox_user'`
      );
      expect(count?.count).toBe(0);
    });
  });

  // Chapter 277: Charter & Rules Amendment Pathway
  describe('Chapter 277: Charter & Rules Amendment Pathway (REQ-26.277)', () => {
    it('manages democratic amendment proposal and supermajority voting', () => {
      const prop = ruleAmendmentPathway.submitProposal({
        proposerId: 'active_contributor',
        targetRuleId: 'R01',
        proposedText: 'Updated threshold for link repetitive frequency',
        rationale: 'Modernizing spam definition for AI dev threads'
      });

      expect(prop.status).toBe('active');

      // Cast 12 votes for
      for (let i = 0; i < 12; i++) {
        ruleAmendmentPathway.castVote(prop.id, `voter_${i}`, true);
      }

      const tally = ruleAmendmentPathway.tallyProposal(prop.id);
      expect(tally.supermajorityAchieved).toBe(true);
      expect(tally.status).toBe('adopted');
    });
  });

  // Chapter 279: Whistleblower Protection
  describe('Chapter 279: Whistleblower Protection (REQ-26.279)', () => {
    it('accepts anonymous encrypted whistleblower report with zero tracking metadata', () => {
      const receipt = whistleblowerProtectionEngine.submitReport({
        category: 'fund_misappropriation',
        statement: 'A staff member attempted to request off-book payment.',
        evidenceLinks: ['https://storage.nexus/evidence1.png']
      });

      expect(receipt.reportId).toBeDefined();
      expect(receipt.receiptToken).toBeDefined();
      expect(receipt.anonymityGuaranteed).toBe(true);

      const status = whistleblowerProtectionEngine.getReportStatus(receipt.reportId);
      expect(status?.status).toBe('pending_audit');
    });
  });

  // Chapter 280: Advanced Minor Safety Tools
  describe('Chapter 280: Advanced Minor Safety Tools (REQ-26.280)', () => {
    it('blocks unmonitored adult-to-minor DMs and intercepts predatory language', () => {
      advancedMinorSafetySystem.registerMinorUser('minor_student_1');

      // Adult trying to DM minor -> Blocked
      const dmCheck = advancedMinorSafetySystem.evaluateInteraction({
        senderId: 'adult_user_99',
        recipientId: 'minor_student_1',
        isDirectMessage: true,
        content: 'Hey, are you free to chat?'
      });
      expect(dmCheck.isBlocked).toBe(true);
      expect(dmCheck.safetyAlertTriggered).toBe(true);

      // Predatory solicitation phrase -> Blocked & staff alerted
      const predatoryCheck = advancedMinorSafetySystem.evaluateInteraction({
        senderId: 'adult_user_99',
        recipientId: 'minor_student_1',
        isDirectMessage: false,
        content: 'send me your photo and keep this secret'
      });
      expect(predatoryCheck.isBlocked).toBe(true);
      expect(predatoryCheck.safetyAlertTriggered).toBe(true);
    });
  });

  // Chapter 283: Cross-Community Blocklist Sharing
  describe('Chapter 283: Cross-Community Blocklist Sharing (REQ-26.283)', () => {
    it('records federated entries with evidence SHA-256 and supports universal appeal', () => {
      const entry = federatedBlocklistManager.addEntry({
        targetId: 'bad_actor_global',
        reason: 'Confirmed token stealer payload distribution',
        evidenceSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        originatingCommunity: 'DevGuild Cairo'
      });

      expect(entry.status).toBe('active');

      const check = federatedBlocklistManager.checkTarget('bad_actor_global');
      expect(check.isFlagged).toBe(true);
      expect(check.entry?.evidenceSha256).toBeDefined();

      // Submit universal appeal
      const appealSuccess = federatedBlocklistManager.submitBlocklistAppeal(entry.id, 'My account was hijacked and recovered.');
      expect(appealSuccess).toBe(true);
    });
  });
});
