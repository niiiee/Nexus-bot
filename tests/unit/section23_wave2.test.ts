import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { tenantManager } from '../../src/modules/platform/tenantManager.js';
import { brandingManager } from '../../src/modules/platform/brandingManager.js';
import { pluginMarketplace } from '../../src/modules/plugins/pluginMarketplace.js';
import { talentGraph } from '../../src/modules/talent/talentGraph.js';
import { verifiableCredentials } from '../../src/modules/credentials/verifiableCredentials.js';
import { aiProjectManager } from '../../src/modules/deals/aiProjectManager.js';
import { restorativeModeration } from '../../src/modules/moderation/restorativeModeration.js';
import { sentimentRadar } from '../../src/modules/sentiment/sentimentRadar.js';
import { codeLab } from '../../src/modules/labs/codeLab.js';
import { designLab } from '../../src/modules/labs/designLab.js';

describe('Section 23 - Wave 2: Advanced Marketplace, Talent & Lab Modules', () => {
  const guildW2 = 'guild_wave2_main';
  let tenantId: string;

  beforeEach(() => {
    const tenant = tenantManager.provisionTenant({
      guildId: guildW2,
      name: 'Wave 2 Community Hub',
      planTier: 'business'
    });
    tenantId = tenant.id;
  });

  // =========================================================================
  // 1. Chapter 3: Custom Branding & White-Labeling
  // =========================================================================
  describe('Chapter 3: Custom Branding & White-Labeling', () => {
    it('retrieves default brand kit and updates colors, logo, and tone preset', () => {
      const kit = brandingManager.getBrandKit(tenantId);
      expect(kit.brand_name).toBeDefined();

      const updated = brandingManager.updateBrandKit(tenantId, {
        brandName: 'Egyptian Freelancers Studio',
        primaryColor: '#FF5722',
        secondaryColor: '#FFC107',
        tonePreset: 'egyptian_casual',
        logoUrl: 'https://cdn.example.com/logo.png'
      });

      expect(updated.brand_name).toBe('Egyptian Freelancers Studio');
      expect(updated.primary_color).toBe('#FF5722');
      expect(updated.tone_preset).toBe('egyptian_casual');

      const tonePrompt = brandingManager.getTonePromptModifier('egyptian_casual');
      expect(tonePrompt).toContain('Egyptian');
      expect(tonePrompt).toContain('يا بطل');
    });

    it('enforces tier restrictions on removing "Powered by Nexus" attribution', () => {
      // Free tier tenant
      const freeTenant = tenantManager.provisionTenant({
        guildId: 'guild_branding_free',
        name: 'Free Server',
        planTier: 'free'
      });

      expect(() => {
        brandingManager.updateBrandKit(freeTenant.id, { poweredByBadge: false });
      }).toThrow(/requires a Business or Enterprise subscription/i);

      // Business tier tenant can remove badge
      const updatedBusiness = brandingManager.updateBrandKit(tenantId, { poweredByBadge: false });
      expect(updatedBusiness.powered_by_badge).toBe(0);
    });

    it('styles Discord embeds dynamically using tenant branding configuration', () => {
      brandingManager.updateBrandKit(tenantId, {
        brandName: 'Design Guild Pro',
        primaryColor: '#E91E63',
        logoUrl: 'https://cdn.example.com/logo.png',
        poweredByBadge: true
      });

      const styled = brandingManager.styleEmbed(tenantId, {
        title: 'New Freelance Opportunity',
        description: 'React + Node developer needed for fintech project'
      });

      expect(styled.title).toBe('New Freelance Opportunity');
      expect(styled.color).toBe(parseInt('E91E63', 16));
      expect(styled.thumbnail?.url).toBe('https://cdn.example.com/logo.png');
      expect(styled.footer?.text).toContain('Powered by Nexus Platform');
    });
  });

  // =========================================================================
  // 2. Chapter 4: Plugin & Integration Marketplace
  // =========================================================================
  describe('Chapter 4: Plugin & Integration Marketplace', () => {
    it('publishes plugins and enforces capability-based sandboxing permissions', () => {
      const plugin = pluginMarketplace.publishPlugin('author_alex', {
        name: 'GitHub PR Auto Reviewer',
        version: '1.2.0',
        description: 'Automatically posts AI reviews on GitHub pull requests in Discord threads',
        author: 'Alex Dev',
        permissions: ['discord:read', 'discord:write', 'webhooks:call'],
        entryPoint: 'dist/index.js'
      });

      expect(plugin.id).toContain('github_pr_auto_reviewer');
      expect(plugin.rating).toBe(5.0);

      // Installation fails if missing required permission consent
      expect(() => {
        pluginMarketplace.installPlugin(
          tenantId,
          plugin.id,
          ['discord:read'] // Missing discord:write and webhooks:call
        );
      }).toThrow(/missing consent for required permission/i);

      // Installation succeeds with full consent
      const installed = pluginMarketplace.installPlugin(
        tenantId,
        plugin.id,
        ['discord:read', 'discord:write', 'webhooks:call'],
        { repo: 'org/repo', notifyChannel: 'dev-prs' }
      );

      expect(installed.is_enabled).toBe(1);
      expect(JSON.parse(installed.config_json).repo).toBe('org/repo');

      const installedList = pluginMarketplace.getInstalledPlugins(tenantId);
      expect(installedList.length).toBeGreaterThanOrEqual(1);

      // Toggle and rate
      expect(pluginMarketplace.togglePlugin(tenantId, plugin.id, false)).toBe(true);
      const newRating = pluginMarketplace.ratePlugin(plugin.id, 4.0);
      expect(newRating).toBe(4.5); // (5.0 + 4.0) / 2
    });
  });

  // =========================================================================
  // 3. Chapter 10: Dynamic Talent Graph & Reputation Portability
  // =========================================================================
  describe('Chapter 10: Dynamic Talent Graph & Reputation Portability', () => {
    it('manages talent profiles, availability states, and deal history', () => {
      const node = talentGraph.upsertTalentNode(tenantId, 'usr_talent_1', {
        skills: ['TypeScript', 'React', 'PostgreSQL', 'Tailwind'],
        availabilityStatus: 'available',
        hourlyRateEstimate: 45,
        languages: ['en', 'ar']
      });

      expect(node.user_id).toBe('usr_talent_1');
      expect(JSON.parse(node.skills_json)).toContain('react');

      talentGraph.setAvailability(tenantId, 'usr_talent_1', 'busy');
      const updated = talentGraph.getTalentNode(tenantId, 'usr_talent_1');
      expect(updated?.availability_status).toBe('busy');

      talentGraph.recordCompletedDeal(tenantId, 'usr_talent_1', 4.8);
      const rated = talentGraph.getTalentNode(tenantId, 'usr_talent_1');
      expect(rated?.verified_deals_count).toBe(1);
    });

    it('matches and ranks talent by skills, rating, and availability', () => {
      talentGraph.upsertTalentNode(tenantId, 'usr_dev_a', {
        skills: ['Python', 'Docker', 'FastAPI'],
        availabilityStatus: 'available',
        hourlyRateEstimate: 50
      });

      talentGraph.upsertTalentNode(tenantId, 'usr_dev_b', {
        skills: ['Python', 'Django', 'PostgreSQL'],
        availabilityStatus: 'available',
        hourlyRateEstimate: 60
      });

      const matches = talentGraph.findMatchingTalent(tenantId, {
        requiredSkills: ['Python', 'FastAPI'],
        minRating: 4.0
      });

      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].node.user_id).toBe('usr_dev_a'); // Has both Python and FastAPI
      expect(matches[0].matchingSkills).toContain('fastapi');
    });

    it('exports portable talent passport JSON', () => {
      const passport = talentGraph.exportTalentPassport(tenantId, 'usr_talent_1');
      expect(passport.type).toBe('NexusTalentPassport');
      expect(passport.userId).toBe('usr_talent_1');
      expect(passport.skills).toBeInstanceOf(Array);
      expect(passport.exportedAt).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4. Chapter 11: Verifiable Credentials & Cryptographic Badges
  // =========================================================================
  describe('Chapter 11: Verifiable Credentials & On-Chain Badges', () => {
    it('issues cryptographically signed W3C-aligned credentials and validates integrity', () => {
      const cred = verifiableCredentials.issueCredential(tenantId, {
        recipientId: 'usr_grad_42',
        credentialType: 'academy_diploma',
        claims: {
          course: 'Fullstack Next.js 15 & AI Systems',
          grade: 'Distinction',
          capstoneUrl: 'https://github.com/grad42/capstone'
        },
        expiresInDays: 365
      });

      expect(cred.id.startsWith('urn:uuid:')).toBe(true);
      expect(cred.signature_hex).toHaveLength(64); // SHA-256 HMAC hex

      const verification = verifiableCredentials.verifyCredential(cred.id);
      expect(verification.valid).toBe(true);
      expect(verification.signatureMatch).toBe(true);
      expect(verification.isRevoked).toBe(false);
      expect(verification.isExpired).toBe(false);
      expect(verification.credential?.claims.grade).toBe('Distinction');
    });

    it('detects tampering and handles revocation in the registry', () => {
      const cred = verifiableCredentials.issueCredential(tenantId, {
        recipientId: 'usr_fraud_1',
        credentialType: 'skill_badge',
        claims: { skill: 'Solidity Smart Contracts' }
      });

      // Verification with wrong secret should fail signature check
      const tampered = verifiableCredentials.verifyCredential(cred.id, 'wrong_tampered_secret_key');
      expect(tampered.valid).toBe(false);
      expect(tampered.signatureMatch).toBe(false);

      // Revoke credential
      expect(verifiableCredentials.revokeCredential(cred.id, 'Plagiarized capstone submission')).toBe(true);

      const revokedVerify = verifiableCredentials.verifyCredential(cred.id);
      expect(revokedVerify.valid).toBe(false);
      expect(revokedVerify.isRevoked).toBe(true);
    });
  });

  // =========================================================================
  // 5. Chapter 13: AI Project Manager for Community Deals
  // =========================================================================
  describe('Chapter 13: AI Project Manager for Community Deals', () => {
    it('generates sequenced WBS project plan and proactive check-in nudges', () => {
      const plan = aiProjectManager.generateProjectPlan(
        tenantId,
        'deal_app_500',
        'Build a real-time collaborative whiteboard app with WebSockets and Canvas API'
      );

      expect(plan.deal_id).toBe('deal_app_500');
      const milestones = JSON.parse(plan.milestones_json);
      expect(milestones.length).toBe(3);
      expect(milestones[0].title).toContain('Architecture');

      const checkin = aiProjectManager.generateDeadlineCheckin('deal_app_500', 'ahmed_dev', 'client_sarah');
      expect(checkin.shouldSend).toBe(true);
      expect(checkin.message).toContain('Nexus AI PM');
      expect(checkin.message).toContain('ahmed_dev');
    });

    it('detects scope-creep expansion and adjusts deal risk scores', () => {
      const checkClean = aiProjectManager.evaluateScopeCreep(
        'deal_app_500',
        'Could we adjust the button border color to dark blue?'
      );
      expect(checkClean.isScopeCreep).toBe(false);

      const checkCreep = aiProjectManager.evaluateScopeCreep(
        'deal_app_500',
        'Can you also build an iOS native mobile app while you are at it?'
      );
      expect(checkCreep.isScopeCreep).toBe(true);
      expect(checkCreep.riskDelta).toBeGreaterThan(0);

      // Complete milestone
      expect(aiProjectManager.completeMilestone('deal_app_500', 'ms_1')).toBe(true);
    });
  });

  // =========================================================================
  // 6. Chapter 18: Community Moderation 2.0: Restorative Justice & Appeals
  // =========================================================================
  describe('Chapter 18: Community Moderation 2.0', () => {
    it('logs incident with contextual explanation and assigns restorative ethics quiz', () => {
      const { incident, restorativePath } = restorativeModeration.logIncident(
        tenantId,
        'usr_rulebreaker_1',
        'mod_bot',
        'off_platform_steering',
        'Message: DM me on Telegram to pay outside Discord'
      );

      expect(incident.id).toBeDefined();
      expect(incident.explanation.toLowerCase()).toContain('escrow');
      expect(restorativePath.requiredAction).toBe('ethics_quiz');
      expect(restorativePath.quizQuestion).toBeDefined();

      // Submit failing quiz answer
      const failAppeal = restorativeModeration.submitAppeal(incident.id, 'I am sorry', 0); // Option 0 is wrong
      expect(failAppeal.appealStatus).toBe('denied');

      // Submit correct restorative quiz answer (Option 1 is correct)
      const passAppeal = restorativeModeration.submitAppeal(incident.id, 'I understand the escrow safety rules', 1);
      expect(passAppeal.appealStatus).toBe('granted');

      // Compile staff evidence pack
      const evidence = restorativeModeration.generateStaffEvidencePack(incident.id);
      expect(evidence.targetUserId).toBe('usr_rulebreaker_1');
      expect(evidence.appealStatus).toBe('granted');
    });
  });

  // =========================================================================
  // 7. Chapter 19: Real-Time Community Sentiment & Vibe Radar
  // =========================================================================
  describe('Chapter 19: Real-Time Sentiment & Vibe Radar', () => {
    it('computes sentiment score, flags conflict risk, and identifies isolated members', () => {
      const now = Date.now();
      const messages = [
        { id: 'm1', authorId: 'usr_happy', content: 'Awesome progress team, great job! Shukran!', timestamp: now - 1000 },
        { id: 'm2', authorId: 'usr_tense', content: 'You are wrong and clueless about Docker', timestamp: now - 2000 },
        { id: 'm3', authorId: 'usr_lonely', content: 'Hello everyone, new here! What courses do you recommend?', timestamp: now - (5 * 60 * 60 * 1000), replyCount: 0 }
      ];

      const analysis = sentimentRadar.analyzeChannelVibe(tenantId, 'channel_chat', messages);

      expect(analysis.sentimentScore).toBeDefined();
      expect(analysis.topics.length).toBeGreaterThanOrEqual(1);
      expect(analysis.conflictRisk).toBeGreaterThan(0);
      expect(analysis.isolatedMembers.length).toBe(1);
      expect(analysis.isolatedMembers[0].userId).toBe('usr_lonely');

      // Bilingual icebreaker generation
      const icebreakerEn = sentimentRadar.generateIcebreaker(analysis.isolatedMembers[0], 'en');
      expect(icebreakerEn).toContain('usr_lonely');
      expect(icebreakerEn).toContain('welcome to the community');

      const icebreakerAr = sentimentRadar.generateIcebreaker(analysis.isolatedMembers[0], 'ar');
      expect(icebreakerAr).toContain('usr_lonely');
      expect(icebreakerAr).toContain('أهلاً بيك');
    });
  });

  // =========================================================================
  // 8. Chapter 25: Nexus Code Lab: Interactive Coding Arena
  // =========================================================================
  describe('Chapter 25: Nexus Code Lab', () => {
    it('creates challenge, evaluates submissions, and flags plagiarized code', () => {
      const challenge = codeLab.createChallenge(
        tenantId,
        'Reverse Words in String',
        'typescript',
        'beginner',
        [
          { input: 'hello world', expected: 'world hello' },
          { input: 'nexus coding', expected: 'coding nexus' }
        ]
      );

      expect(challenge.id).toBeDefined();

      // First original submission
      const codeA = 'function reverse(str: string): string {\n  return str.split(" ").reverse().join(" ");\n}';
      const evalA = codeLab.evaluateSubmission(tenantId, challenge.id, 'usr_coder_1', codeA);
      expect(evalA.allPassed).toBe(true);
      expect(evalA.isPlagiarismSuspect).toBe(false);

      // Second nearly identical submission from a different user
      const codeB = 'function reverse(str: string): string {\n  // Copied\n  return str.split(" ").reverse().join(" ");\n}';
      const evalB = codeLab.evaluateSubmission(tenantId, challenge.id, 'usr_copier_2', codeB);
      expect(evalB.allPassed).toBe(true);
      expect(evalB.isPlagiarismSuspect).toBe(true);
      expect(evalB.similarityScore).toBeGreaterThanOrEqual(0.85);

      const leaderboard = codeLab.getLeaderboard(challenge.id);
      expect(leaderboard.length).toBe(2);
      expect(leaderboard[0].passed_tests).toBe(2);
    });
  });

  // =========================================================================
  // 9. Chapter 26: Nexus Design Lab: Visual Critique & Review Studio
  // =========================================================================
  describe('Chapter 26: Nexus Design Lab', () => {
    it('calculates WCAG 2.1 contrast ratios and generates bilingual critique', () => {
      // Black on White: ratio should be 21:1
      const highContrast = designLab.calculateContrastRatio('#000000', '#ffffff');
      expect(highContrast.contrastRatio).toBeCloseTo(21.0, 0);
      expect(highContrast.meetsAaNormal).toBe(true);
      expect(highContrast.meetsAaaNormal).toBe(true);

      // Low contrast light gray on white: should fail WCAG AA
      const lowContrast = designLab.calculateContrastRatio('#cccccc', '#ffffff');
      expect(lowContrast.contrastRatio).toBeLessThan(3.0);
      expect(lowContrast.meetsAaNormal).toBe(false);

      // Full critique
      const { critiqueRecord, feedback } = designLab.critiqueDesign(
        tenantId,
        'usr_designer_1',
        'https://figma.com/file/123/dashboard',
        [
          { fg: '#000000', bg: '#ffffff' },
          { fg: '#cccccc', bg: '#ffffff' }
        ]
      );

      expect(critiqueRecord.id).toBeDefined();
      expect(feedback.wcagScore).toBe(50.0); // 1 passed, 1 failed
      expect(feedback.strengths.length).toBeGreaterThan(0);
      expect(feedback.improvements.length).toBeGreaterThan(0);
      expect(feedback.summaryAr).toContain('عاش يا بطل');
      expect(feedback.summaryEn).toContain('Overall design review score');
    });
  });
});
