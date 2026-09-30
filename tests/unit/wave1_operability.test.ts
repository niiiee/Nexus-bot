import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { liveIntegrationHarness } from '../../src/modules/operability/liveIntegrationHarness.js';
import { goldenCorpusEvaluator } from '../../src/modules/operability/goldenCorpus.js';
import { loadSoakLab } from '../../src/modules/operability/loadSoakLab.js';
import { restoreDrillsEngine } from '../../src/modules/operability/restoreDrills.js';
import { setupSimulator } from '../../src/modules/operability/setupSimulator.js';
import { configLinter } from '../../src/modules/operability/configLinter.js';
import { shadowModeCoordinator } from '../../src/modules/operability/shadowModeCoordinator.js';
import { commandExplorer } from '../../src/modules/operability/commandExplorer.js';
import { threatModelManager } from '../../src/modules/governance/threatModelManager.js';
import { privacyImpactAssessmentEngine } from '../../src/modules/governance/privacyImpactAssessment.js';
import { modelCardsRegistry } from '../../src/modules/governance/aiModelCards.js';
import { auditorGateway } from '../../src/modules/governance/auditorGateway.js';
import { integrationHealthMonitor } from '../../src/modules/integrations/integrationHealthMonitor.js';
import { rulesEngine } from '../../src/modules/rules/rulesEngine.js';

describe('Wave 1 Behavioral Test Suite (Chapters 181-195, 271-276, 300)', () => {
  const guildId = 'guild_wave1_test';

  beforeEach(() => {
    rulesEngine.seedRulesTable();
  });

  // Chapter 181: Live Integration Harness
  describe('Chapter 181: Live Integration Harness (REQ-26.181)', () => {
    it('drives full member journey across all 6 lifecycle stages with timing verification', async () => {
      const report = await liveIntegrationHarness.runFullMemberJourney({
        guildId,
        username: 'SeniorCandidate',
        field: 'Systems Engineering'
      });

      expect(report.allStepsPassed).toBe(true);
      expect(report.steps.length).toBe(6);
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);

      const stepNames = report.steps.map((s) => s.step);
      expect(stepNames).toEqual([
        'join',
        'vetting',
        'skill_test',
        'work_submission',
        'deal_creation',
        'dispute_resolution'
      ]);

      // Check DB persistence of member and deal
      const member = dbService.get<{ username: string }>(
        `SELECT username FROM members WHERE user_id = ?`,
        report.userId
      );
      expect(member?.username).toBe('SeniorCandidate');
    });
  });

  // Chapter 182: Golden Conversation Corpus
  describe('Chapter 182: Golden Conversation Corpus (REQ-26.182)', () => {
    it('evaluates dialect precision and recall above the required threshold across all dialects', () => {
      const report = goldenCorpusEvaluator.evaluateClassifier();

      expect(report.totalSamples).toBeGreaterThanOrEqual(20);
      expect(report.overallAccuracy).toBeGreaterThanOrEqual(0.85);
      expect(report.f1Score).toBeGreaterThanOrEqual(0.85);
      expect(report.passedThreshold).toBe(true);

      // Verify all dialect breakdowns pass
      const dialects = report.dialectBreakdown.map((d) => d.dialect);
      expect(dialects).toContain('egyptian');
      expect(dialects).toContain('gulf');
      expect(dialects).toContain('levantine');
      expect(dialects).toContain('maghrebi');
      expect(dialects).toContain('msa');
      expect(dialects).toContain('english');
      expect(dialects).toContain('mixed_tech');
    });
  });

  // Chapter 183: Load & Soak Lab
  describe('Chapter 183: Load & Soak Lab (REQ-26.183)', () => {
    it('executes burst operations and measures p95 latency within SLA', async () => {
      const report = await loadSoakLab.runSoakSimulation({
        concurrentUsers: 10,
        totalOperations: 100,
        burstBatchSize: 20
      });

      expect(report.operationsCompleted).toBe(100);
      expect(report.errorCount).toBe(0);
      expect(report.errorRatePercent).toBe(0);
      expect(report.latency.p95Ms).toBeLessThan(250);
      expect(report.passed).toBe(true);
      expect(report.failureReasons.length).toBe(0);
    });
  });

  // Chapter 185: Monthly Restore Drills
  describe('Chapter 185: Monthly Restore Drills (REQ-26.185)', () => {
    it('executes automated database backup, staging restore, and verifies cryptographic parity', () => {
      const drill = restoreDrillsEngine.executeRestoreDrill();

      expect(drill.isValid).toBe(true);
      expect(drill.originalSnapshotHash).toBe(drill.restoredSnapshotHash);
      expect(drill.tableCount).toBe(3);
      expect(drill.durationMs).toBeGreaterThanOrEqual(0);

      // Verify drill logged in DB
      const history = restoreDrillsEngine.getDrillHistory(1);
      expect(history.length).toBe(1);
      expect(history[0].drillId).toBe(drill.drillId);
      expect(history[0].isValid).toBe(true);
    });
  });

  // Chapter 187: Setup Simulator
  describe('Chapter 187: Setup Simulator (REQ-26.187)', () => {
    it('previews configuration changes and flags critical overlapping channel conflicts', () => {
      // Seed guild config
      dbService.run(
        `INSERT OR REPLACE INTO guild_configs (
           guild_id, welcome_channel_id, staff_review_channel_id, created_at, updated_at
         ) VALUES (?, 'chan_welcome_1', 'chan_staff_1', ?, ?)`,
        guildId,
        Date.now(),
        Date.now()
      );

      // Safe update
      const safeSim = setupSimulator.simulateConfigChange(guildId, {
        suspicion_threshold: 0.70
      });
      expect(safeSim.isSafe).toBe(true);
      expect(safeSim.safeToApply).toBe(true);
      expect(safeSim.diffs.find((d) => d.key === 'suspicion_threshold')?.newValue).toBe(0.70);

      // Dangerous update: staff review = welcome channel
      const dangerousSim = setupSimulator.simulateConfigChange(guildId, {
        welcome_channel_id: 'chan_public_leak',
        staff_review_channel_id: 'chan_public_leak'
      });
      expect(dangerousSim.isSafe).toBe(false);
      expect(dangerousSim.warnings.some((w) => w.includes('CRITICAL'))).toBe(true);
    });
  });

  // Chapter 188: Config Linter & Advisor
  describe('Chapter 188: Config Linter & Advisor (REQ-26.188)', () => {
    it('detects risky settings and applies one-click safe automated fixes', () => {
      dbService.run(
        `INSERT OR REPLACE INTO guild_configs (
           guild_id, welcome_channel_id, anti_raid_enabled, suspicion_threshold, created_at, updated_at
         ) VALUES (?, 'chan_welc', 0, 0.95, ?, ?)`,
        guildId,
        Date.now(),
        Date.now()
      );

      const lintReport = configLinter.lintGuildConfig(guildId);
      expect(lintReport.isHealthy).toBe(false);
      expect(lintReport.issues.some((i) => i.ruleCode === 'LINT-03')).toBe(true);

      // Apply auto-fix for anti-raid
      const fixResult = configLinter.applyAutoFix(guildId, 'LINT-03');
      expect(fixResult.success).toBe(true);

      const updated = dbService.get<{ anti_raid_enabled: number }>(
        `SELECT anti_raid_enabled FROM guild_configs WHERE guild_id = ?`,
        guildId
      );
      expect(updated?.anti_raid_enabled).toBe(1);
    });
  });

  // Chapter 192: Shadow Mode Coordinator
  describe('Chapter 192: Shadow Mode Coordinator (REQ-26.192)', () => {
    it('evaluates rule violation with zero live Discord/DB side effects and records shadow telemetry', () => {
      const shadowUser = `user_shadow_spec_${Date.now()}`;
      const res = shadowModeCoordinator.processShadowMessage({
        guildId,
        userId: shadowUser,
        content: 'spam spam spam repetitive links buy cheap followers'
      });

      expect(res.wouldTrigger).toBe(true);
      expect(res.ruleId).toBe('R01');

      // Verify zero points added
      const activePts = rulesEngine.getActivePoints(guildId, shadowUser);
      expect(activePts.totalActivePoints).toBe(0);

      // Verify shadow telemetry logged
      const summary = shadowModeCoordinator.getShadowSummary(guildId);
      expect(summary.totalEvaluated).toBeGreaterThanOrEqual(1);
      expect(summary.actionBreakdown['reminder']).toBeDefined();
    });
  });

  // Chapter 195: Self-Documenting Command Explorer
  describe('Chapter 195: Self-Documenting Command Explorer (REQ-26.195)', () => {
    it('introspects runtime commands and generates bilingual documentation without doc drift', () => {
      const report = commandExplorer.generateDocs(['setup', 'rules', 'rule', 'mypoints', 'appeal']);

      expect(report.isDriftFree).toBe(true);
      expect(report.driftCount).toBe(0);
      expect(report.commandCount).toBeGreaterThanOrEqual(5);

      // Bilingual markdown verification
      expect(report.markdownDocEn).toContain('# Nexus Bot Slash Commands Reference');
      expect(report.markdownDocEn).toContain('### `/rules`');
      expect(report.markdownDocAr).toContain('# دليل أوامر بوت نيكسس');
      expect(report.markdownDocAr).toContain('### `/rules`');
    });
  });

  // Chapter 271: Threat Model & Abuse Cases
  describe('Chapter 271: Threat Model & Abuse Cases (REQ-26.271)', () => {
    it('retrieves STRIDE threat models with DREAD scores and mapped test cases', () => {
      const escrowModel = threatModelManager.getModelForModule('escrow');
      expect(escrowModel.threats.length).toBeGreaterThanOrEqual(2);
      expect(escrowModel.threats.some((t) => t.category === 'Tampering')).toBe(true);
      expect(escrowModel.threats.some((t) => t.category === 'Elevation_of_Privilege')).toBe(true);

      const moderationModel = threatModelManager.getModelForModule('rules_engine');
      expect(moderationModel.threats.some((t) => t.id === 'THR-MOD-01')).toBe(true);
      expect(moderationModel.threats[0].status).toBe('mitigated');
    });
  });

  // Chapter 273: Privacy Impact Assessment per Module
  describe('Chapter 273: Privacy Impact Assessment (REQ-26.273)', () => {
    it('approves compliant modules and flags unmitigated sensitive PII without consent', () => {
      // Compliant module
      const compliantPIA = privacyImpactAssessmentEngine.conductAssessment({
        moduleId: 'portfolio_showcase',
        moduleName: 'Member Portfolio Showcase',
        dataCategories: [
          { category: 'public_profile', purpose: 'Display skills', retentionDays: 180, isConsentRequired: true, isThirdPartyShared: false }
        ],
        intendedRetentionDays: 180
      });
      expect(compliantPIA.isApproved).toBe(true);
      expect(compliantPIA.riskScore).toBeLessThanOrEqual(5.0);

      // Risky module
      const riskyPIA = privacyImpactAssessmentEngine.conductAssessment({
        moduleId: 'unauthorized_dm_tracker',
        moduleName: 'DM Scraping Tool',
        dataCategories: [
          { category: 'sensitive_pii', purpose: 'Tracking', retentionDays: 730, isConsentRequired: false, isThirdPartyShared: true }
        ],
        intendedRetentionDays: 730
      });
      expect(riskyPIA.isApproved).toBe(false);
      expect(riskyPIA.complianceFlags.length).toBeGreaterThanOrEqual(2);
    });
  });

  // Chapter 275: Model Cards per AI Feature
  describe('Chapter 275: Model Cards per AI Feature (REQ-26.275)', () => {
    it('retrieves standardized model cards documenting ethics, dialects, and human review policies', () => {
      const card = modelCardsRegistry.getCard('ai_vetting_evaluator');
      expect(card).toBeDefined();
      expect(card?.dialectsSupported).toContain('Egyptian Arabic');
      expect(card?.outOfScopeUses.length).toBeGreaterThan(0);
      expect(card?.evaluationMetrics.precision).toBeGreaterThanOrEqual(0.9);

      const markdown = modelCardsRegistry.exportMarkdown('ai_vetting_evaluator');
      expect(markdown).toContain('Adaptive Vetting & Authenticity Evaluator');
      expect(markdown).toContain('Out-of-Scope & Prohibited Uses');
    });
  });

  // Chapter 276: Independent Auditor Read-Only Gateway
  describe('Chapter 276: Independent Auditor Read-Only Gateway (REQ-26.276)', () => {
    it('creates time-limited sessions, enforces read-only queries, and automatically masks PII', () => {
      const session = auditorGateway.createAuditorSession({
        auditorName: 'AuditCorp International',
        organization: 'Independent Trust & Safety Council',
        durationHours: 12
      });

      expect(session.token).toBeDefined();
      expect(session.expiresAt).toBeGreaterThan(Date.now());

      // Seed dummy member with PII in database
      dbService.run(
        `INSERT OR REPLACE INTO members (
           user_id, guild_id, username, tools, created_at, updated_at
         ) VALUES ('auditor_test_user', 'guild_audit', 'JohnDoe', 'contact: john.doe@example.com or 01012345678', ?, ?)`,
        Date.now(),
        Date.now()
      );

      // Execute read-only query
      const queryRes = auditorGateway.executeAuditorQuery(
        session.token,
        `SELECT user_id, tools FROM members WHERE user_id = 'auditor_test_user'`
      );

      expect(queryRes.success).toBe(true);
      const data = queryRes.data as Array<{ tools: string }>;
      expect(data[0].tools).toContain('j***@example.com');
      expect(data[0].tools).toContain('0101****78');

      // Attempt forbidden write query -> Rejected
      const writeRes = auditorGateway.executeAuditorQuery(
        session.token,
        `DELETE FROM members WHERE user_id = 'auditor_test_user'`
      );
      expect(writeRes.success).toBe(false);
      expect(writeRes.error).toContain('Forbidden');
    });
  });

  // Chapter 300: Integration Health Monitor
  describe('Chapter 300: Integration Health Monitor (REQ-26.300)', () => {
    it('monitors external integration endpoints and records latency and status telemetry', async () => {
      const checks = await integrationHealthMonitor.runHealthChecks();
      expect(checks.length).toBeGreaterThanOrEqual(4);

      const serviceNames = checks.map((c) => c.serviceName);
      expect(serviceNames).toContain('Discord Gateway');
      expect(serviceNames).toContain('Telegram Bot API');
      expect(serviceNames).toContain('AI Provider Gateway (Gemini/OpenAI)');
      expect(serviceNames).toContain('Stripe Connect Webhook');

      const summary = integrationHealthMonitor.getSystemHealthSummary();
      expect(summary.services.length).toBeGreaterThanOrEqual(4);
      expect(summary.overallStatus).toBeDefined();
    });
  });
});
