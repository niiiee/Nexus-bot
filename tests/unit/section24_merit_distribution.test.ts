import { describe, it, expect, beforeEach } from 'vitest';
import { MeritCharterEngine, EqualAccessAuditor } from '../../src/modules/merit/meritCharterEngine.js';
import { CommunityDistributionEngine } from '../../src/modules/distribution/communityDistribution.js';
import { getDb } from '../../src/database/index.js';

describe('Section 24: The Nexus Charter & Open Distribution', () => {
  const meritEngine = MeritCharterEngine.getInstance();
  const distEngine = CommunityDistributionEngine.getInstance();
  const testTenant = 'guild_charter_test_1';
  const testUser = 'user_merit_alice';

  beforeEach(() => {
    meritEngine.initializeDefaultCharter();
  });

  describe('Part A: Merit, Fairness & Governance (Chapters 31 to 40)', () => {
    it('Chapter 31: Merit Charter Engine enforces free core boundaries and rejects money gating', () => {
      const freeCheck = meritEngine.assertCoreAccess('learning', 'none');
      expect(freeCheck.allowed).toBe(true);

      const moneyCheck = meritEngine.assertCoreAccess('learning', 'money');
      expect(moneyCheck.allowed).toBe(false);
      expect(moneyCheck.reason).toContain('cannot be gated by money');

      const effortCoreCheck = meritEngine.assertCoreAccess('portfolio', 'effort');
      expect(effortCoreCheck.allowed).toBe(false);
      expect(effortCoreCheck.reason).toContain('universally free');
    });

    it('Chapter 32: calculates quality-weighted effort score with diminishing returns and decay', () => {
      meritEngine.recordContribution(testTenant, testUser, 'helpful_answer', 1.0);
      meritEngine.recordContribution(testTenant, testUser, 'helpful_answer', 1.0);
      meritEngine.recordContribution(testTenant, testUser, 'code_review', 2.0);

      const score = meritEngine.calculateEffortScore(testTenant, testUser);
      expect(score).toBeGreaterThan(20);
    });

    it('Chapter 33: Unlockables Vault unlocks cosmetics and convenience, rejecting core lockups', () => {
      // Record substantive contributions to reach threshold
      for (let i = 0; i < 5; i++) {
        meritEngine.recordContribution(testTenant, testUser, 'code_review', 3.0);
      }

      const unlockRes = meritEngine.unlockPerk(testTenant, testUser, 'profile_theme_cyberpunk', 'cosmetic');
      expect(unlockRes.success).toBe(true);
      expect(unlockRes.message).toContain('Unlocked cosmetic perk');

      // Attempting to unlock a core feature as a perk must be rejected
      const badRes = meritEngine.unlockPerk(testTenant, testUser, 'job_board', 'convenience');
      expect(badRes.success).toBe(false);
      expect(badRes.message).toContain('universally free');
    });

    it('Chapter 34: Equal Access Auditor scans and verifies zero paywalls or donor advantages', () => {
      const audit = EqualAccessAuditor.runAudit(testTenant);
      expect(audit.passed).toBe(true);
      expect(audit.violations.length).toBe(0);
    });

    it('Chapter 35: appends tamper-evident contribution ledger entries', () => {
      const entry = meritEngine.appendContributionLedgerEntry(testTenant, testUser, 'DOCS_CONTRIBUTED', {
        section: 'Getting Started Guide',
        charsAdded: 450
      });
      expect(entry.entryId).toBeDefined();
      expect(entry.entryHash).toHaveLength(64);
    });

    it('Chapter 36: manages peer kudos with daily quotas and collusion protection', () => {
      const kudosRes = meritEngine.sendKudos(testTenant, testUser, 'user_merit_bob', 'Helped clarify Docker setup');
      expect(kudosRes.success).toBe(true);

      const selfKudos = meritEngine.sendKudos(testTenant, testUser, testUser, 'Self praise');
      expect(selfKudos.success).toBe(false);
      expect(selfKudos.message).toContain('Self-kudos is not permitted');
    });

    it('Chapter 37: Time Bank tracks 1:1 teaching credits and session balances', () => {
      const session = meritEngine.logTimeBankSession(testTenant, 'teacher_dan', 'student_eva', 'React Hooks deep dive', 1.5);
      expect(session.success).toBe(true);
      expect(session.teacherBalance).toBe(1.5);
      expect(session.studentBalance).toBe(-1.5);
    });

    it('Chapter 38: Community Council processes proposals and one-member-one-vote ballots', () => {
      const prop = meritEngine.submitCouncilProposal(
        testTenant,
        testUser,
        'Add Weekly Mobile Design Sprint',
        'Organize weekly Saturday sprints for Flutter and React Native.',
        'events',
        'binding_referendum'
      );
      expect(prop.proposalId).toBeDefined();

      const vote1 = meritEngine.castVote(prop.proposalId, 'voter_1', 'for');
      expect(vote1.success).toBe(true);

      const voteDup = meritEngine.castVote(prop.proposalId, 'voter_1', 'against');
      expect(voteDup.success).toBe(false);
      expect(voteDup.message).toContain('already voted');
    });

    it('Chapter 39: records transparent moderation incidents and appeal metrics', () => {
      const modLog = meritEngine.logModerationAction(testTenant, 'bad_actor_99', 'spam', 'mute_1h', 'Repeated copy-paste invite link', 'en');
      expect(modLog.logId).toBeDefined();

      meritEngine.recordModerationAppeal(modLog.logId, true, 2.5);
      const db = getDb();
      const row = db.prepare(`SELECT overturn_status, appeal_duration_hours FROM transparent_moderation_logs WHERE id = ?`).get(modLog.logId) as {
        overturn_status: string;
        appeal_duration_hours: number;
      };
      expect(row.overturn_status).toBe('overturned');
      expect(row.appeal_duration_hours).toBe(2.5);
    });

    it('Chapter 40: Accessibility Suite provides screen-reader and dyslexia-friendly formatting', () => {
      const raw = 'Please utilize this command to commence testing.\nCheck logs.';
      const formatted = meritEngine.formatAccessibleMessage(raw, {
        simpleLanguage: true,
        dyslexiaFriendly: true,
        highContrastTag: true
      });
      expect(formatted).toContain('[ACCESSIBILITY MODE]');
      expect(formatted).toContain('use this command to start testing');
    });
  });

  describe('Part B: Open Distribution & Community Ownership (Chapters 41 to 50)', () => {
    it('Chapter 41: runs preflight installer checks and generates cryptographic secrets', () => {
      const preflight = distEngine.runPreflightChecks({
        dbConnected: true,
        discordTokenPresent: true,
        portsAvailable: true
      });
      expect(preflight.passed).toBe(true);
      expect(preflight.checks).toHaveLength(3);

      const secrets = distEngine.generateInstallSecrets();
      expect(secrets.jwtSecret).toHaveLength(64);
      expect(secrets.encryptionKey).toHaveLength(64);
    });

    it('Chapter 42: compiles redacted diagnostic telemetry bundle for self-hosters', () => {
      const bundle = distEngine.generateDiagnosticsBundle(testTenant);
      expect(bundle.credentialsRedacted).toBe(true);
      expect(bundle.nodeVersion).toBeDefined();
      expect(bundle.diagnosticSignature).toHaveLength(64);
    });

    it('Chapter 43: reports community edition hosting metrics with fair share status', () => {
      const metrics = distEngine.getCommunityHostingMetrics();
      expect(metrics.fairShareStatus).toContain('Zero paywall throttling');
      expect(metrics.memoryUsedMb).toBeGreaterThan(0);
    });

    it('Chapter 44: registers Community Plugin Commons package with zero platform cuts', () => {
      const pluginRes = distEngine.registerCommunityPlugin({
        id: 'plug_auto_linter',
        name: 'Auto Linter',
        authorId: 'dev_community_star',
        version: '1.2.0',
        manifestPermissions: ['discord:read', 'discord:write'],
        sourceUrl: 'https://github.com/community/linter'
      });
      expect(pluginRes.success).toBe(true);
      expect(pluginRes.packageHash).toHaveLength(64);
    });

    it('Chapter 45: exports and previews server blueprint diffs safely', () => {
      const bp = distEngine.exportBlueprint(
        'Fullstack Freelancer Guild',
        'Standard production layout for developer collectives',
        testUser,
        [{ name: 'welcome', type: 'text' }, { name: 'code-review', type: 'text' }],
        [{ name: 'Mentor', color: '#38BDF8', permissions: ['ADMIN'] }]
      );
      expect(bp.id).toBeDefined();

      const diff = distEngine.previewBlueprintDiff(['welcome'], ['welcome', 'code-review']);
      expect(diff.toCreate).toEqual(['code-review']);
      expect(diff.unchanged).toEqual(['welcome']);
    });

    it('Chapter 47: translates core messages into casual Egyptian Arabic and English', () => {
      const en = distEngine.translate('welcome.message', 'en');
      const ar = distEngine.translate('welcome.message', 'ar_EG');

      expect(en).toContain('100% free for everyone');
      expect(ar).toContain('مجانية ١٠٠٪ لكل الناس');
    });

    it('Chapter 48: generates public changelog with "You Asked, We Shipped" attribution', () => {
      const changelog = distEngine.generateChangelogEntry('2.4.0', [
        { feature: 'Time Bank Mentoring System', proposedBy: 'alice_dev' }
      ]);
      expect(changelog).toContain('You Asked, We Shipped!');
      expect(changelog).toContain('@alice_dev');
    });

    it('Chapter 50: aggregates transparency summary declaring donors receive zero advantages', () => {
      const summary = distEngine.getTransparencySummary(testTenant);
      expect(summary.disclaimer).toContain('confer zero perks, privileges, status, or scoring advantages');
    });
  });
});
