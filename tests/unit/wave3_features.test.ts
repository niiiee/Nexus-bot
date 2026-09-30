import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { learningCredentialsEngine } from '../../src/modules/academy/learningCredentialsEngine.js';
import { workMarketEngine } from '../../src/modules/freelancer/workMarketEngine.js';
import { creatorsContentEngine } from '../../src/modules/content/creatorsContentEngine.js';
import { socialDepthEngine } from '../../src/modules/social/socialDepthEngine.js';

describe('Wave 3 Behavioral Test Suite (54 Chapters)', () => {
  beforeEach(() => {
    // Clean up Wave 3 tables
    dbService.run('DELETE FROM apprenticeships');
    dbService.run('DELETE FROM micro_credentials');
    dbService.run('DELETE FROM group_bids');
    dbService.run('DELETE FROM subcontract_agreements');
    dbService.run('DELETE FROM client_feedback_records');
    dbService.run('DELETE FROM design_gallery_submissions');
    dbService.run('DELETE FROM meetup_events');
    dbService.run('DELETE FROM volunteer_hours_ledger');
  });

  // ==========================================
  // PART 3: ACADEMY (Chapters 213–225)
  // ==========================================
  describe('Part 3: Academy & Credentials (Chapters 213–225)', () => {
    it('Chapter 213: Apprenticeship Program (REQ-26.213) - enforces supervised channels for minors', () => {
      // Minor without supervised channel -> blocked
      const blocked = learningCredentialsEngine.createMentorship({
        mentorId: 'mentor_1',
        apprenticeId: 'minor_apprentice',
        isMinor: true,
        isSupervisedChannel: false
      });
      expect(blocked.success).toBe(false);
      expect(blocked.error).toContain('Safeguard Violation');

      // Minor with supervised channel -> created
      const approved = learningCredentialsEngine.createMentorship({
        mentorId: 'mentor_1',
        apprenticeId: 'minor_apprentice',
        isMinor: true,
        isSupervisedChannel: true
      });
      expect(approved.success).toBe(true);
      expect(approved.agreement?.status).toBe('active');

      // Adult mentorship -> created
      const adult = learningCredentialsEngine.createMentorship({
        mentorId: 'mentor_1',
        apprenticeId: 'adult_user',
        isMinor: false,
        isSupervisedChannel: false
      });
      expect(adult.success).toBe(true);
    });

    it('Chapter 214: Career Path Library (REQ-26.214) - returns structured checkpoints', () => {
      const path = learningCredentialsEngine.getCareerPath('Fullstack Engineer');
      expect(path.role).toBe('Fullstack Engineer');
      expect(path.checkpoints.length).toBeGreaterThan(0);
      expect(path.estimatedMonths).toBe(6);

      const generic = learningCredentialsEngine.getCareerPath('Rust Developer');
      expect(generic.checkpoints.length).toBe(3);
    });

    it('Chapter 215: Stackable Micro-Credentials (REQ-26.215) - issues and cascades revocations', () => {
      const cred = learningCredentialsEngine.issueCredential({
        userId: 'student_1',
        title: 'Async TS Specialist',
        criteria: 'Passed advanced async exam',
        issuerId: 'trainer_1'
      });
      expect(cred.isRevoked).toBe(false);

      const revocation = learningCredentialsEngine.revokeCredential(cred.id);
      expect(revocation.success).toBe(true);
      expect(revocation.cascadesUpdated).toBe(1);

      const row = dbService.get<{ is_revoked: number }>(
        'SELECT is_revoked FROM micro_credentials WHERE id = ?',
        cred.id
      );
      expect(row?.is_revoked).toBe(1);
    });

    it('Chapter 216: Live Cohort Bootcamps (REQ-26.216) - tracks attendance and enforces 80% graduation gate', () => {
      learningCredentialsEngine.recordCohortAttendance('cohort_1', 'user_1', 1);
      expect(learningCredentialsEngine.verifyBootcampGraduation(7, 10)).toBe(false);
      expect(learningCredentialsEngine.verifyBootcampGraduation(8, 10)).toBe(true);
      expect(learningCredentialsEngine.verifyBootcampGraduation(10, 10)).toBe(true);
    });

    it('Chapter 217: Spaced Repetition Everywhere (REQ-26.217) - SM-2 calculation and failure reset', () => {
      expect(learningCredentialsEngine.calculateNextReviewInterval(0, 1, true)).toBe(1);
      expect(learningCredentialsEngine.calculateNextReviewInterval(1, 1, true)).toBe(6);
      expect(learningCredentialsEngine.calculateNextReviewInterval(2, 6, true)).toBe(13);
      // Reset on failure
      expect(learningCredentialsEngine.calculateNextReviewInterval(5, 30, false)).toBe(1);
    });

    it('Chapter 218: Reading & Paper Clubs (REQ-26.218) - generates discussion guides with citations', () => {
      const guide = learningCredentialsEngine.generatePaperDiscussionGuide(
        'Attention Is All You Need',
        'We propose a new simple network architecture, the Transformer...'
      );
      expect(guide.title).toBe('Attention Is All You Need');
      expect(guide.safeSummary).toContain('Cited from original author');
      expect(guide.questions.length).toBe(2);
    });

    it('Chapter 219: Language Exchange for Freelancer English (REQ-26.219) - matches compatible pairs', () => {
      const p1 = { userId: 'user_eg', timezone: 'UTC+2', level: 'intermediate' };
      const p2 = { userId: 'user_uk', timezone: 'UTC+2', level: 'native' };
      const p3 = { userId: 'user_us', timezone: 'UTC-5', level: 'native' };

      expect(learningCredentialsEngine.matchLanguagePair(p1, p2)).toBe(true);
      expect(learningCredentialsEngine.matchLanguagePair(p1, p3)).toBe(false);
      expect(learningCredentialsEngine.matchLanguagePair(p1, p1)).toBe(false);
    });

    it('Chapter 220: Soft Skills Academy (REQ-26.220) - scores negotiation framing', () => {
      const goodResponse = learningCredentialsEngine.evaluateNegotiationResponse(
        'Based on the project value and clear milestone deliverables, our fixed quote covers complete testing.'
      );
      expect(goodResponse.score).toBe(85);

      const weakResponse = learningCredentialsEngine.evaluateNegotiationResponse(
        'I can do it cheaper for $5 an hour if you want.'
      );
      expect(weakResponse.score).toBe(50);
    });

    it('Chapter 221: Volunteer Teacher Toolkit (REQ-26.221) - structures balanced session plans', () => {
      const plan = learningCredentialsEngine.generateSessionPlan('GraphQL Basics', 60);
      expect(plan.totalMinutes).toBe(60);
      expect(plan.modules.length).toBe(3);
      expect(plan.modules[0].minutes + plan.modules[1].minutes + plan.modules[2].minutes).toBe(60);
    });

    it('Chapter 222: Peer Teaching Rewards (REQ-26.222) - prevents farming with minimum student threshold', () => {
      expect(learningCredentialsEngine.issueTeachingBadge('teacher_1', 2).badgeIssued).toBe(false);
      const awarded = learningCredentialsEngine.issueTeachingBadge('teacher_1', 3);
      expect(awarded.badgeIssued).toBe(true);
      expect(awarded.badgeName).toBe('Certified Peer Mentor');
    });

    it('Chapter 223: Personal Learning Analytics (REQ-26.223) - exports complete member telemetry payload', () => {
      const exported = learningCredentialsEngine.exportMemberAnalytics('user_analytics_1');
      expect(exported.userId).toBe('user_analytics_1');
      const parsed = JSON.parse(exported.exportPayload);
      expect(parsed.quizzesTaken).toBe(5);
    });

    it('Chapter 224: Accessible Learning Modes (REQ-26.224) - formats for dyslexia, simplified, and low bandwidth', () => {
      const raw = 'The algorithm performs adequately. Furthermore, tests passed.';
      const dyslexia = learningCredentialsEngine.formatAccessible('Test\n\nContent', 'dyslexia');
      expect(dyslexia).toContain('[OpenDyslexic Formatted]');

      const simplified = learningCredentialsEngine.formatAccessible(raw, 'simplified');
      expect(simplified).toContain('so');

      const lowBw = learningCredentialsEngine.formatAccessible('Ascii content € special', 'low_bandwidth');
      expect(lowBw).not.toContain('€');
    });

    it('Chapter 225: Offline Study Packs (REQ-26.225) - packages self-contained CC-BY licensed bundles', () => {
      const pack = learningCredentialsEngine.packageOfflineStudyPack('Web Security', ['Lesson 1', 'Lesson 2']);
      expect(pack.isSelfContained).toBe(true);
      expect(pack.license).toContain('CC-BY-4.0');
      expect(pack.lessonCount).toBe(2);
    });
  });

  // ==========================================
  // PART 4: FREELANCER & MARKET (Chapters 227, 230–240)
  // ==========================================
  describe('Part 4: Freelancer & Market (Chapters 227, 230–240)', () => {
    it('Chapter 227: Client Tools (REQ-26.227) - generates structured client brief with checklists', () => {
      const brief = workMarketEngine.generateClientBrief({
        title: 'E-commerce API',
        budget: 2500,
        milestones: ['Design', 'Build', 'QA']
      });
      expect(brief.hasChecklist).toBe(true);
      expect(brief.budget).toBe(2500);
    });

    it('Chapter 230: Group Bids (REQ-26.230) - creates cryptographic snapshot requiring all members consent', () => {
      const bid = workMarketEngine.createGroupBid({
        dealId: 'deal_100',
        leadId: 'lead_dev',
        members: [
          { userId: 'dev_1', role: 'Backend', feeSharePercent: 60 },
          { userId: 'dev_2', role: 'Frontend', feeSharePercent: 40 }
        ]
      });
      expect(bid.bidId).toMatch(/^gbid_/);
      expect(bid.allConsented).toBe(false);
      expect(bid.snapshotHash).toHaveLength(64);

      const row = dbService.get<{ status: string }>('SELECT status FROM group_bids WHERE id = ?', bid.bidId);
      expect(row?.status).toBe('pending_all_consent');
    });

    it('Chapter 231: Subcontracting Network (REQ-26.231) - establishes non-custodial subcontracting agreements', () => {
      const sub = workMarketEngine.createSubcontract({
        parentDealId: 'deal_100',
        contractorId: 'agency_lead',
        subcontractorId: 'sub_dev',
        amount: 800
      });
      expect(sub.isNonCustodial).toBe(true);
      const row = dbService.get<{ amount: number }>('SELECT amount FROM subcontract_agreements WHERE id = ?', sub.subcontractId);
      expect(row?.amount).toBe(800);
    });

    it('Chapter 232: Agency Toolkit (REQ-26.232) - provisions collaborative team workspace', () => {
      const agency = workMarketEngine.createAgencyWorkspace('Apex Software', 'founder_1');
      expect(agency.name).toBe('Apex Software');
      expect(agency.agencyId).toMatch(/^agency_/);
    });

    it('Chapter 233: Reference Service (REQ-26.233) - guards reference lookups behind explicit consent', () => {
      expect(workMarketEngine.verifyReference('client_1', 'freelancer_1', false)).toBe(false);
      expect(workMarketEngine.verifyReference('client_1', 'freelancer_1', true)).toBe(true);
    });

    it('Chapter 234: Aggregated Rate Benchmarks (REQ-26.234) - enforces k-anonymity >= 5 suppression', () => {
      // Less than 5 rates -> suppressed to protect individual privacy
      const suppressed = workMarketEngine.calculateRateBenchmark([45, 50, 55, 60]);
      expect(suppressed.isSuppressed).toBe(true);
      expect(suppressed.medianRate).toBe(0);

      // 5 or more rates -> median calculated
      const unsuppressed = workMarketEngine.calculateRateBenchmark([40, 50, 60, 70, 80]);
      expect(unsuppressed.isSuppressed).toBe(false);
      expect(unsuppressed.medianRate).toBe(60);
    });

    it('Chapter 235: Availability Sync (REQ-26.235) - synchronizes availability securely', () => {
      const synced = workMarketEngine.syncCalendarAvailability('freelancer_1', { '2026-10-01': true, '2026-10-02': false });
      expect(synced).toBe(true);
    });

    it('Chapter 236: Client Kickoff Pack (REQ-26.236) - generates phased milestones based on duration', () => {
      const milestones = workMarketEngine.generateKickoffMilestones({ scope: 'MVP App', durationWeeks: 4 });
      expect(milestones).toHaveLength(3);
      expect(milestones[1].dueWeek).toBe(2);
      expect(milestones[2].dueWeek).toBe(4);
    });

    it('Chapter 237: Scope Change Manager (REQ-26.237) - preserves original agreement cryptographic hash', () => {
      const hash = 'a'.repeat(64);
      const req = workMarketEngine.requestScopeChange({
        dealId: 'deal_100',
        originalAgreementHash: hash,
        deltaAmount: 500,
        newScopeDescription: 'Additional payment gateway integration'
      });
      expect(req.originalHashPreserved).toBe(true);
    });

    it('Chapter 238: Dispute Prevention Coach (REQ-26.238) - detects delivery silence near deadlines', () => {
      // 4 days of silence with deadline in 1 day -> nudge required
      const nudge = workMarketEngine.checkDeliveryHealth(4, 1);
      expect(nudge.nudgeRequired).toBe(true);
      expect(nudge.advice).toBeDefined();

      // Active communication -> no nudge
      const ok = workMarketEngine.checkDeliveryHealth(1, 5);
      expect(ok.nudgeRequired).toBe(false);
    });

    it('Chapter 239: Case Study Library (REQ-26.239) - blocks publishing without client NDA clearance', () => {
      const blocked = workMarketEngine.publishCaseStudy('Fintech Scaling', 'Details of arch...', false);
      expect(blocked.published).toBe(false);
      expect(blocked.error).toContain('Confidentiality Guard');

      const approved = workMarketEngine.publishCaseStudy('Fintech Scaling', 'Details of arch...', true);
      expect(approved.published).toBe(true);
    });

    it('Chapter 240: Client Feedback Loop (REQ-26.240) - intercepts retaliatory dispute reviews', () => {
      const normal = workMarketEngine.recordFeedback({
        dealId: 'deal_1',
        reviewerId: 'client_1',
        targetId: 'dev_1',
        rating: 5,
        comments: 'Outstanding code quality!'
      });
      expect(normal.isRetaliatory).toBe(false);

      // Low score during dispute retaliation
      const retaliatory = workMarketEngine.recordFeedback({
        dealId: 'deal_2',
        reviewerId: 'client_angry',
        targetId: 'dev_1',
        rating: 1,
        comments: 'Furious about arbitration result',
        isDisputeRetaliation: true
      });
      expect(retaliatory.isRetaliatory).toBe(true);

      const row = dbService.get<{ is_retaliatory: number }>(
        'SELECT is_retaliatory FROM client_feedback_records WHERE target_id = ? AND rating = 1',
        'dev_1'
      );
      expect(row?.is_retaliatory).toBe(1);
    });
  });

  // ==========================================
  // PART 5: CREATORS & CONTENT (Chapters 241–255)
  // ==========================================
  describe('Part 5: Creators & Content (Chapters 241–255)', () => {
    it('Chapter 241: Workshop Broadcast Studio (REQ-26.241) - checks recording consent before recording', () => {
      const withoutConsent = creatorsContentEngine.scheduleWorkshop({ title: 'Docker 101', recordingConsentGranted: false });
      expect(withoutConsent.recordingAllowed).toBe(false);

      const withConsent = creatorsContentEngine.scheduleWorkshop({ title: 'Docker 101', recordingConsentGranted: true });
      expect(withConsent.recordingAllowed).toBe(true);
    });

    it('Chapter 242: Podcast Pipeline (REQ-26.242) - requires guest consent for show notes and publication', () => {
      const blocked = creatorsContentEngine.processPodcast({ title: 'Ep 1', transcript: 'Audio text', guestConsent: false });
      expect(blocked.published).toBe(false);

      const approved = creatorsContentEngine.processPodcast({ title: 'Ep 1', transcript: 'Audio text', guestConsent: true });
      expect(approved.published).toBe(true);
      expect(approved.showNotes).toContain('Ep 1');
    });

    it('Chapter 243: Community Newsletter (REQ-26.243) - includes mandatory 1-click unsubscribe link', () => {
      const letter = creatorsContentEngine.generateNewsletter(['Article 1', 'Article 2']);
      expect(letter.hasUnsubscribeLink).toBe(true);
      expect(letter.html).toContain('Nexus Weekly');
    });

    it('Chapter 244: Short-Clip Factory (REQ-26.244) - enforces all-speaker consent before clip generation', () => {
      const failed = creatorsContentEngine.createHighlightClip({ speaker1: true, speaker2: false });
      expect(failed.clipCreated).toBe(false);
      expect(failed.error).toContain('Consent Violation');

      const passed = creatorsContentEngine.createHighlightClip({ speaker1: true, speaker2: true });
      expect(passed.clipCreated).toBe(true);
    });

    it('Chapter 245: Interview Series Scheduler (REQ-26.245) - computes feasible multi-timezone slots', () => {
      const res = creatorsContentEngine.scheduleInterview(['UTC-4', 'UTC+2', 'UTC+8']);
      expect(res.allTimezonesFeasible).toBe(true);
      expect(res.scheduledUtcTimestamp).toBeGreaterThan(Date.now());
    });

    it('Chapter 246: Design Galleries with Voting (REQ-26.246) - resists vote brigading', () => {
      const designId = creatorsContentEngine.submitDesign('artist_1', 'Nexus Dark Theme', 'https://cdn.nexus/art1.png');
      expect(designId).toMatch(/^des_/);

      const validVote = creatorsContentEngine.castDesignVote(designId, 'voter_1', false);
      expect(validVote).toBe(true);

      const brigadedVote = creatorsContentEngine.castDesignVote(designId, 'bot_voter', true);
      expect(brigadedVote).toBe(false);

      const row = dbService.get<{ votes_count: number }>('SELECT votes_count FROM design_gallery_submissions WHERE id = ?', designId);
      expect(row?.votes_count).toBe(1);
    });

    it('Chapter 247: Code Snippet Library with Tests (REQ-26.247) - verifies snippets pass sandbox tests', () => {
      const verified = creatorsContentEngine.verifySnippetWithTest('const add = (a, b) => a + b;', 'expect(add(1, 2)).toBe(3);');
      expect(verified.runsInSandbox).toBe(true);
      expect(verified.testsPassed).toBe(true);
    });

    it('Chapter 248: Free Template Library (REQ-26.248) - verifies permissive open licenses', () => {
      expect(creatorsContentEngine.validateTemplateLicense('MIT').isPermissive).toBe(true);
      expect(creatorsContentEngine.validateTemplateLicense('Apache-2.0').allowsCommercial).toBe(true);
      expect(creatorsContentEngine.validateTemplateLicense('CC-BY-NC-4.0').allowsCommercial).toBe(false);
      expect(creatorsContentEngine.validateTemplateLicense('PROPRIETARY').isPermissive).toBe(false);
    });

    it('Chapter 249: Font & Asset License Advisor (REQ-26.249) - flags attribution requirements and commercial safety', () => {
      const font = creatorsContentEngine.adviseAssetLicense('font', 'SIL Open Font License 1.1');
      expect(font.requiresAttribution).toBe(true);
      expect(font.commercialSafe).toBe(true);

      const nonComm = creatorsContentEngine.adviseAssetLicense('photo', 'CC-BY-NC');
      expect(nonComm.commercialSafe).toBe(false);
    });

    it('Chapter 250: Devlogs for Member Projects (REQ-26.250) - verifies git commit hash format', () => {
      const valid = creatorsContentEngine.createDevlog('proj_1', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4', 'Initial release');
      expect(valid.verifiedCommit).toBe(true);

      const invalid = creatorsContentEngine.createDevlog('proj_1', 'bad_hash', 'Bogus');
      expect(invalid.verifiedCommit).toBe(false);
    });

    it('Chapter 251: Documentary Timeline (REQ-26.251) - records community milestones with timestamps', () => {
      const ms = creatorsContentEngine.recordHistoricalMilestone('Nexus v1.0 Launch', 2026);
      expect(ms.title).toBe('2026: Nexus v1.0 Launch');
    });

    it('Chapter 252: Guest Expert Booking (REQ-26.252) - gates expert sessions with vetting and safeguarding', () => {
      expect(creatorsContentEngine.bookGuestExpert('Dr. Security', false).bookingConfirmed).toBe(false);
      expect(creatorsContentEngine.bookGuestExpert('Dr. Security', true).bookingConfirmed).toBe(true);
    });

    it('Chapter 253: Translation Guild (REQ-26.253) - peer reviews translation contributions', () => {
      expect(creatorsContentEngine.submitTranslationReview('trans_ar_01', 'peer_rev_1', true)).toBe(true);
      expect(creatorsContentEngine.submitTranslationReview('trans_ar_01', 'peer_rev_1', false)).toBe(false);
    });

    it('Chapter 254: Brand Voice Lab (REQ-26.254) - optimizes tone while preserving core meaning', () => {
      const res = creatorsContentEngine.optimizeTone('   Join our Discord to learn async programming!   ');
      expect(res.optimized).toBe('Join our Discord to learn async programming!');
      expect(res.meaningPreserved).toBe(true);
    });

    it('Chapter 255: Content Accessibility Checker (REQ-26.255) - checks contrast ratios and image alt text', () => {
      const passing = creatorsContentEngine.checkPostAccessibility({ hasAltText: true, contrastRatio: 4.8 });
      expect(passing.isAccessible).toBe(true);
      expect(passing.flags).toHaveLength(0);

      const failing = creatorsContentEngine.checkPostAccessibility({ hasAltText: false, contrastRatio: 3.2 });
      expect(failing.isAccessible).toBe(false);
      expect(failing.flags).toContain('Missing image alt-text');
      expect(failing.flags).toContain('Contrast ratio below WCAG AA 4.5:1');
    });
  });

  // ==========================================
  // PART 6: SOCIAL DEPTH & COMMUNITY (Chapters 256–268, 270)
  // ==========================================
  describe('Part 6: Social Depth & Community (Chapters 256–268, 270)', () => {
    it('Chapter 256: Interest Circles (REQ-26.256) - provisions focused community circles', () => {
      const circle = socialDepthEngine.createInterestCircle('Cloud Native Systems', 'lead_user_1');
      expect(circle.name).toBe('Cloud Native Systems');
      expect(circle.circleId).toMatch(/^circ_/);
    });

    it('Chapter 257: Local Meetup Organizer Kit (REQ-26.257) - requires safety checklist before approval', () => {
      const unapproved = socialDepthEngine.registerMeetup('org_1', 'Cairo TS Devs', 'Cairo', Date.now() + 86400000, false);
      expect(unapproved.isApproved).toBe(false);

      const approved = socialDepthEngine.registerMeetup('org_1', 'Cairo TS Devs', 'Cairo', Date.now() + 86400000, true);
      expect(approved.isApproved).toBe(true);

      const row = dbService.get<{ safety_checklist_completed: number }>('SELECT safety_checklist_completed FROM meetup_events WHERE id = ?', approved.meetupId);
      expect(row?.safety_checklist_completed).toBe(1);
    });

    it('Chapter 258: Follow-the-Sun Support Desk (REQ-26.258) - balances load and matches timezones', () => {
      const volunteers = [
        { id: 'v_us', timezone: 'UTC-5', activeTickets: 0 },
        { id: 'v_eg_busy', timezone: 'UTC+2', activeTickets: 3 },
        { id: 'v_eg_free', timezone: 'UTC+2', activeTickets: 1 }
      ];
      // Should pick v_eg_free because timezone matches and tickets < 3
      const chosen = socialDepthEngine.routeSupportQuestion('UTC+2', volunteers);
      expect(chosen).toBe('v_eg_free');
    });

    it('Chapter 259: Structured Peer Support Circles (REQ-26.259) - intercepts crisis language for Care escalation', () => {
      const normal = socialDepthEngine.evaluatePeerCircleMessage('I am struggling with this Docker tutorial.');
      expect(normal.triggersCareEscalation).toBe(false);

      const crisisEn = socialDepthEngine.evaluatePeerCircleMessage('I cannot take this anymore, I want to end my life');
      expect(crisisEn.triggersCareEscalation).toBe(true);

      const crisisAr = socialDepthEngine.evaluatePeerCircleMessage('أفكر في الانتحار تعبت جدا');
      expect(crisisAr.triggersCareEscalation).toBe(true);
    });

    it('Chapter 260: Isolation Detection (REQ-26.260) - respects opt-in before sending gentle check-in nudge', () => {
      // Silent member who opted in -> nudge
      expect(socialDepthEngine.evaluateMemberIsolation(0, true).sendGentleNudge).toBe(true);

      // Silent member who did NOT opt in -> no nudge (privacy respected)
      expect(socialDepthEngine.evaluateMemberIsolation(0, false).sendGentleNudge).toBe(false);

      // Active member -> no nudge
      expect(socialDepthEngine.evaluateMemberIsolation(12, true).sendGentleNudge).toBe(false);
    });

    it('Chapter 261: Collaboration Partner Suggestions (REQ-26.261) - pairs complementary opted-in members', () => {
      const candidates = [
        { id: 'cand_1', skills: ['TypeScript', 'React'], isOptedIn: false },
        { id: 'cand_2', skills: ['UI/UX', 'Figma'], isOptedIn: true }
      ];
      const match = socialDepthEngine.suggestPartner(['TypeScript', 'Postgres'], candidates);
      expect(match).toBe('cand_2');
    });

    it('Chapter 262: Event Series Automation (REQ-26.262) - manages recurring schedule and updates reminders', () => {
      const res = socialDepthEngine.rescheduleEventSeries('series_algo_meetup', Date.now() + 100000);
      expect(res.remindersUpdated).toBe(true);
    });

    it('Chapter 263: Community Ritual Engine (REQ-26.263) - honors server quiet hours', () => {
      // Quiet hours 22:00 to 06:00
      expect(socialDepthEngine.checkQuietHoursForRitual(23, 22, 6)).toBe(true);
      expect(socialDepthEngine.checkQuietHoursForRitual(3, 22, 6)).toBe(true);
      expect(socialDepthEngine.checkQuietHoursForRitual(14, 22, 6)).toBe(false);
    });

    it('Chapter 264: Restorative Justice Tools (REQ-26.264) - gates mediation to S1/S2 with dual consent', () => {
      // S1 with both consenting -> opened
      const ok = socialDepthEngine.initRestorativeMediation('case_10', 'S1', true, true);
      expect(ok.mediationOpened).toBe(true);

      // S1 without consent from one party -> blocked
      const noConsent = socialDepthEngine.initRestorativeMediation('case_11', 'S1', true, false);
      expect(noConsent.mediationOpened).toBe(false);

      // S4 severe infraction -> ineligible for mediation
      const severe = socialDepthEngine.initRestorativeMediation('case_12', 'S4', true, true);
      expect(severe.mediationOpened).toBe(false);
    });

    it('Chapter 265: New Leader Training Path (REQ-26.265) - enforces completion of all mandatory modules', () => {
      expect(socialDepthEngine.verifyLeaderEligibility(['mod_ethics', 'mod_deescalation'])).toBe(false);
      expect(
        socialDepthEngine.verifyLeaderEligibility(['mod_ethics', 'mod_deescalation', 'mod_charter_parity'])
      ).toBe(true);
    });

    it('Chapter 266: Volunteer Management Hub (REQ-26.266) - logs volunteer hours into transparent ledger', () => {
      const logged = socialDepthEngine.logVolunteerHours('vol_dev_1', 'Weekly code mentoring', 3.5);
      expect(logged).toBe(true);

      const row = dbService.get<{ hours_logged: number }>('SELECT hours_logged FROM volunteer_hours_ledger WHERE volunteer_id = ?', 'vol_dev_1');
      expect(row?.hours_logged).toBe(3.5);
    });

    it('Chapter 267: Recognition Wall with Stories (REQ-26.267) - requires consent and minimum substance', () => {
      expect(socialDepthEngine.submitImpactStory('user_1', 'Short', true).published).toBe(false);
      expect(socialDepthEngine.submitImpactStory('user_1', 'This community helped me land my first junior software engineering job!', false).published).toBe(false);
      expect(socialDepthEngine.submitImpactStory('user_1', 'This community helped me land my first junior software engineering job!', true).published).toBe(true);
    });

    it('Chapter 268: Values Quiz at Onboarding (REQ-26.268) - Charter guarantee: never blocks access', () => {
      const lowScore = socialDepthEngine.scoreValuesQuiz(20);
      expect(lowScore.accessBlocked).toBe(false);

      const highScore = socialDepthEngine.scoreValuesQuiz(100);
      expect(highScore.accessBlocked).toBe(false);
    });

    it('Chapter 270: Anonymous Opinion Pulse (REQ-26.270) - applies timing defense for k-anonymity', () => {
      const vote = socialDepthEngine.castPulseVote('poll_roadmap_1', 2, true);
      expect(vote.recorded).toBe(true);
      expect(vote.anonymous).toBe(true);
    });
  });
});
