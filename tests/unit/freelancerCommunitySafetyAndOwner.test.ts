import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';
import { teamFormationService } from '../../src/modules/freelancer/community/teamFormation.js';
import { hackathonManagerService } from '../../src/modules/freelancer/community/hackathonManager.js';
import { mentorshipEngine } from '../../src/modules/freelancer/community/mentorshipEngine.js';
import { amaAndSpotlightService } from '../../src/modules/freelancer/community/amaAndSpotlight.js';
import { collabBoardService } from '../../src/modules/freelancer/community/collabBoard.js';
import { accountabilityBoardService } from '../../src/modules/freelancer/community/accountabilityBoard.js';
import { winsAutomationService } from '../../src/modules/freelancer/community/winsAutomation.js';
import { antiScamShieldService } from '../../src/modules/freelancer/safety/antiScamShield.js';
import { confidentialityGuardService } from '../../src/modules/freelancer/safety/confidentialityGuard.js';
import { reportTicketSystem } from '../../src/modules/freelancer/safety/reportTicketSystem.js';
import { privacyModeService } from '../../src/modules/freelancer/safety/privacyMode.js';
import { privacyRightsService } from '../../src/modules/freelancer/safety/privacyRights.js';
import { ownerAnalyticsService } from '../../src/modules/freelancer/owner/ownerAnalytics.js';
import { eventSchedulerService } from '../../src/modules/freelancer/owner/eventScheduler.js';
import { channelSummariesService } from '../../src/modules/freelancer/owner/channelSummaries.js';
import { faqAutoBuilderService } from '../../src/modules/freelancer/owner/faqAutoBuilder.js';
import { translationEngineService } from '../../src/modules/freelancer/owner/translationEngine.js';
import { serverBackupRestoreService } from '../../src/modules/freelancer/owner/serverBackupRestore.js';
import { roleAutomationEngine } from '../../src/modules/freelancer/owner/roleAutomationEngine.js';
import { staffPerformanceService } from '../../src/modules/freelancer/owner/staffPerformance.js';

describe('Phase 4: Freelancer Modules - Community, Safety & Owner Toolkit (Categories E, F & G)', () => {
  const guildId = 'guild_comm_safety_owner_test';

  beforeEach(() => {
    dbService.run('DELETE FROM reports');
    dbService.run('DELETE FROM mentorship_pairings');
    dbService.run('DELETE FROM hackathons');
    dbService.run('DELETE FROM role_rules');
    dbService.run('DELETE FROM audit_logs');
    dbService.run('DELETE FROM members');
  });

  describe('Category E: Community & Collab (REQ-11.29 to REQ-11.35)', () => {
    it('REQ-11.29: forms project teams and recruits complementary skillsets', () => {
      const team = teamFormationService.createTeam({
        guildId,
        leadId: 'user_lead',
        projectConcept: 'Open Source Freelance CRM',
        rolesNeeded: ['Frontend Dev', 'Backend Dev', 'UI Designer'],
      });

      expect(team.status).toBe('recruiting');

      const joinRes = teamFormationService.joinTeamRole(team.id, 'Frontend Dev', 'user_frontend');
      expect(joinRes.success).toBe(true);
      expect(joinRes.team?.neededRoles.find((r) => r.roleName === 'Frontend Dev')?.filledByUserId).toBe('user_frontend');
    });

    it('REQ-11.30: orchestrates hackathons, submissions, and scored scoreboards', () => {
      const hack = hackathonManagerService.createHackathon({
        guildId,
        title: 'Ramadan AI Code Jam 2026',
        theme: 'AI Tools for Egyptian Freelancers',
        durationHours: 48,
      });

      expect(hack.status).toBe('active');

      const sub = hackathonManagerService.submitProject({
        hackathonId: hack.id,
        teamIdOrUserId: 'team_alpha',
        projectName: 'Smart Invoicing Agent',
        repoOrDemoUrl: 'https://github.com/team-alpha/invoice-ai',
      });

      expect(sub.totalScore).toBeGreaterThan(80);

      const scoreboard = hackathonManagerService.getScoreboard(hack.id);
      expect(scoreboard.length).toBe(1);
      expect(scoreboard[0].projectName).toBe('Smart Invoicing Agent');
    });

    it('REQ-11.31 to REQ-11.35: mentorship, AMA/spotlight, collab board, goals, and wins', () => {
      // 1. Mentorship
      memberRepo.createMember({
        userId: 'senior_mentor',
        guildId,
        username: 'SeniorLead',
        seniorityLevel: 'Senior',
        tools: 'Backend, Node.js, Postgres',
      });

      const matchRes = mentorshipEngine.matchMentor({
        guildId,
        menteeId: 'junior_dev',
        domain: 'Backend',
      });
      expect(matchRes.success).toBe(true);
      expect(matchRes.pairing?.mentorId).toBe('senior_mentor');

      // 2. AMA and Spotlight
      const ama = amaAndSpotlightService.scheduleAMA({
        guildId,
        guestNameOrId: 'Staff Guest',
        topic: 'Landing High-Ticket Global Clients',
        scheduledTime: Date.now() + 86400000,
      });
      expect(ama.status).toBe('scheduled');

      // 3. Collab board
      const collab = collabBoardService.postCollabRequest({
        guildId,
        authorId: 'dev_user_a',
        title: 'Need someone with Stripe US account to test webhook',
        category: 'testing',
        description: 'Just need 5 minutes of verification.',
      });
      const claimRes = collabBoardService.claimCollab(collab.id, 'dev_user_b');
      expect(claimRes.success).toBe(true);

      // 4. Accountability board
      const goal = accountabilityBoardService.commitGoal({
        userId: 'goal_user',
        guildId,
        goalDescription: 'Complete 3 daily tasks and submit 1 PR',
      });
      const compRes = accountabilityBoardService.completeGoal(goal.id, 'goal_user');
      expect(compRes.success).toBe(true);
      expect(compRes.xpAwarded).toBe(100);

      // 5. Wins automation
      const celebration = winsAutomationService.generateCelebrationMessage(
        {
          userId: 'dev_alex',
          username: 'AlexDev',
          category: 'first_client',
          details: 'Just signed my first $2,500 contract!',
        },
        'ar'
      );
      expect(celebration.shoutout).toBeDefined();
    });
  });

  describe('Category F: Safety & Trust (REQ-11.36 to REQ-11.40)', () => {
    it('REQ-11.36 & REQ-11.37: detects scam messages and blocks secret leaks', () => {
      const scamRes = antiScamShieldService.inspectMessage('Click here for free discord gift nitro! discord.gg/gift-nitro');
      expect(scamRes.isThreat).toBe(true);
      expect(scamRes.threatType).toBe('fake_nitro');

      const leakRes = confidentialityGuardService.scanContent('My AWS key is AKIA1234567890ABCDEF for testing.');
      expect(leakRes.hasLeak).toBe(true);
      expect(leakRes.leakType).toBe('api_key');
      expect(leakRes.redactedPreview).toContain('[REDACTED_SECRET]');
    });

    it('REQ-11.38 to REQ-11.40: report ticketing, privacy mode, and GDPR data export/purge', () => {
      // 1. Report system
      const report = reportTicketSystem.fileReport({
        guildId,
        reporterId: 'user_victim',
        targetId: 'user_suspect',
        reason: 'Attempted off-platform payment scam in DMs',
      });
      expect(report.id).toBeDefined();

      const resolveRes = reportTicketSystem.resolveReport(report.id, 'ban', 'Confirmed scam pattern');
      expect(resolveRes).toBe(true);

      // 2. Privacy mode
      privacyModeService.updateSettings('user_private', { hideEarnings: true, hideContactInfo: true });
      const filtered = privacyModeService.filterProfileForPublic('user_private', {
        username: 'SecretDev',
        contactHandle: 'secret@dev.com',
        earningsSummary: '$50,000/yr',
        skills: ['Rust', 'C++'],
        reputationScore: 150,
      });
      expect(filtered.contactHandle).toBeUndefined();
      expect(filtered.earningsSummary).toContain('[Private');

      // 3. Privacy Rights /mydata export and purge
      memberRepo.createMember({
        userId: 'user_purge_test',
        guildId,
        username: 'PurgeMe',
      });
      const dataExport = privacyRightsService.exportUserData('user_purge_test');
      expect(dataExport.userId).toBe('user_purge_test');

      const purgeResult = privacyRightsService.purgeUserData('user_purge_test');
      expect(purgeResult.success).toBe(true);
      expect(purgeResult.recordsPurged).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Category G: Owner Toolkit (REQ-11.41 to REQ-11.48)', () => {
    it('REQ-11.41 to REQ-11.48: executes owner admin tools and automations', async () => {
      // 1. Owner analytics
      const overview = ownerAnalyticsService.getGuildOverview(guildId);
      expect(overview.healthScore).toBeGreaterThan(0);

      // 2. Event scheduler
      const ev = eventSchedulerService.scheduleEvent({
        guildId,
        title: 'Weekly UI Critique Jam',
        type: 'workshop',
        scheduledTime: Date.now() + 100000,
        description: 'Live feedback on portfolio screens',
      });
      expect(ev.id).toBeDefined();

      // 3. Channel digest
      const digest = await channelSummariesService.generateDigest(
        'general-tech',
        ['UserA: How to configure node:sqlite in Node 24?', 'UserB: Use DatabaseSync!']
      );
      expect(digest.summaryMarkdown).toBeDefined();

      // 4. FAQ Builder
      const faqs = await faqAutoBuilderService.buildCandidateFAQs(['How does escrow work?', 'How to upgrade level?']);
      expect(faqs.length).toBeGreaterThanOrEqual(1);

      // 5. Translation engine
      const trans = await translationEngineService.translateText('كود نظيف وتسليم في الموعد المحدد');
      expect(trans.translatedText).toBeDefined();

      // 6. Server backup/restore
      const snapshot = serverBackupRestoreService.createSnapshot(guildId);
      const restoreRes = serverBackupRestoreService.restoreSnapshot(snapshot.id);
      expect(restoreRes.success).toBe(true);

      // 7. Role Automation Engine
      roleAutomationEngine.addRule({
        guildId,
        targetRoleId: 'role_veteran_freelancer',
        conditionType: 'reputation',
        threshold: 120,
      });

      memberRepo.createMember({
        userId: 'dev_eligible',
        guildId,
        username: 'EligibleDev',
        reputationScore: 150,
      });

      const grantedRoles = roleAutomationEngine.evaluateMemberRules('dev_eligible', guildId);
      expect(grantedRoles).toContain('role_veteran_freelancer');

      // 8. Staff performance stats
      const stats = staffPerformanceService.getStaffStats(guildId);
      expect(Array.isArray(stats)).toBe(true);
    });
  });
});
