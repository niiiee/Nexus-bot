import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { voiceTranscriberService } from '../../src/modules/live/voiceTranscriber.js';
import { workshopManagerService } from '../../src/modules/live/workshopManager.js';
import { screenShareQueueService } from '../../src/modules/live/screenShareQueue.js';
import { pomodoroRoomsService } from '../../src/modules/live/pomodoroRooms.js';
import { courseCertificatesService } from '../../src/modules/career/courseCertificates.js';
import { careerCenterService } from '../../src/modules/career/careerCenter.js';
import { portfolioPipelineService } from '../../src/modules/career/portfolioPipeline.js';
import { certificationTracksService } from '../../src/modules/career/certificationTracks.js';
import { alumniSuccessService } from '../../src/modules/career/alumniSuccess.js';
import { partnerOpportunitiesService } from '../../src/modules/career/partnerOpportunities.js';

describe('Live Sessions, Voice & Career Center (Section 20)', () => {
  const guildId = 'guild_live_123';
  const userId = 'user_live_456';

  beforeEach(() => {
    dbService.run(`DELETE FROM members WHERE guild_id = ?`, guildId);
    const now = Date.now();
    dbService.run(
      `INSERT INTO members (user_id, guild_id, username, credits, xp, reputation_score, created_at, updated_at)
       VALUES (?, ?, 'LiveUser', 500, 1000, 150, ?, ?)`,
      userId,
      guildId,
      now,
      now
    );
  });

  it('REQ-20.1: voiceTranscriber issues bilingual consent and produces structured RAG summary', () => {
    const consent = voiceTranscriberService.getConsentAnnouncement('ar');
    expect(consent).toContain('تنبيه الشفافية والموافقة');

    const summary = voiceTranscriberService.summarizeSession({
      guildId,
      channelId: 'voice_room_1',
      hostId: userId,
      topic: 'Clean Architecture with TypeScript',
      transcriptText: 'We discussed hexagonal architecture.\nAction: refactor repository layer to decouple sqlite.',
      attendeesCount: 15,
      locale: 'en',
    });

    expect(summary.actionItems.length).toBeGreaterThan(0);
    expect(summary.indexedToRAG).toBe(true);
  });

  it('REQ-20.2: workshopManager schedules workshop, toggles RSVP, and grades post-session quiz', () => {
    const workshop = workshopManagerService.scheduleWorkshop({
      guildId,
      title: 'Advanced Figma Design Systems',
      hostId: userId,
      scheduledTime: Date.now() + 3600 * 1000,
    });
    expect(workshop.title).toBe('Advanced Figma Design Systems');

    const rsvp = workshopManagerService.toggleRSVP(workshop.id, userId);
    expect(rsvp.rsvpActive).toBe(true);

    const quiz = workshopManagerService.gradePostSessionQuiz(
      userId,
      guildId,
      workshop.id,
      [1, 0],
      [
        { question: 'Q1', options: ['A', 'B'], correctAnswerIndex: 1 },
        { question: 'Q2', options: ['A', 'B'], correctAnswerIndex: 0 },
      ]
    );
    expect(quiz.passed).toBe(true);
    expect(quiz.score).toBe(2);
  });

  it('REQ-20.3: screenShareQueue handles joining queue, advancing presenter, and stage timer', () => {
    const join = screenShareQueueService.joinQueue(guildId, userId, 'Refactoring Database Layer');
    expect(join.success).toBe(true);

    const presenter = screenShareQueueService.nextPresenter(guildId, 15);
    expect(presenter).toBeDefined();
    expect(presenter?.userId).toBe(userId);

    const timer = screenShareQueueService.checkStageTimer(guildId);
    expect(timer.hasActivePresenter).toBe(true);
    expect(timer.isExpired).toBe(false);
  });

  it('REQ-20.4: pomodoroRooms tracks focus/break cycles and rewards focus XP', () => {
    const room = pomodoroRoomsService.startPomodoro({
      channelId: 'study_lounge_1',
      guildId,
      focusMinutes: 25,
      breakMinutes: 5,
    });
    expect(room.phase).toBe('focus');

    pomodoroRoomsService.registerParticipant('study_lounge_1', userId);
    const state = pomodoroRoomsService.getRoomState('study_lounge_1');
    expect(state?.participants.has(userId)).toBe(true);
  });

  it('REQ-20.5: courseCertificates issues tamper-proof SHA-256 verified certificates', () => {
    const cert = courseCertificatesService.issueCertificate({
      userId,
      title: 'Full-Stack TypeScript Professional',
    });
    expect(cert.verificationSha256).toBeDefined();

    const verify = courseCertificatesService.verifyCertificate(cert.verificationSha256);
    expect(verify.isValid).toBe(true);
    expect(verify.certificate?.userId).toBe(userId);

    const card = courseCertificatesService.formatCertificateCard(cert, 'ar');
    expect(card).toContain('شهادة إتمام معتمدة');
  });

  it('REQ-20.6: careerCenter audits resume text and generates personalized cover letter', () => {
    const resumeText = 'Architected and optimized microservices reducing latency by 35% across 50k users.';
    const audit = careerCenterService.auditResume(resumeText);
    expect(audit.score).toBeGreaterThanOrEqual(75);
    expect(audit.hasMetrics).toBe(true);

    const letter = careerCenterService.generateCoverLetter({
      candidateName: 'Ahmed Developer',
      jobTitle: 'Senior Node.js Contractor',
      clientOrCompany: 'FinTech Startup',
      keySkills: ['TypeScript', 'SQLite', 'Docker'],
      yearsExperience: 4,
      locale: 'ar',
    });
    expect(letter).toContain('FinTech Startup');
    expect(letter).toContain('Ahmed Developer');
  });

  it('REQ-20.7: portfolioPipeline matches jobs with portfolio items and formats pitch', () => {
    // Seed job and portfolio item
    dbService.run(
      `INSERT INTO jobs (id, guild_id, poster_id, title, budget_range, deadline, required_skills, description, status, created_at, expires_at)
       VALUES ('job_pipe_1', ?, 'client_1', 'React & TypeScript Dashboard', '$1,000', '1 week', '["react", "typescript"]', 'Dashboard needed', 'open', ?, ?)`,
      guildId,
      Date.now(),
      Date.now() + 86400000
    );

    dbService.run(
      `INSERT INTO portfolio_items (id, user_id, guild_id, title, description, url, tags, upvotes, created_at)
       VALUES ('port_pipe_1', ?, ?, 'SaaS Dashboard Pro', 'Full React dashboard with TS', 'https://github.com/example/dash', '["react", "typescript"]', 12, ?)`,
      userId,
      guildId,
      Date.now()
    );

    const pitch = portfolioPipelineService.generateClientPitch('job_pipe_1', 'en');
    expect(pitch.matchedItems.length).toBeGreaterThan(0);
    expect(pitch.formattedPitch).toContain('SaaS Dashboard Pro');
  });

  it('REQ-20.8: certificationTracks evaluates prerequisites and issues graduation certificate', () => {
    // Seed required tasks to pass track_fullstack_senior
    for (let i = 0; i < 5; i++) {
      dbService.run(
        `INSERT INTO task_submissions (id, task_id, user_id, submission_text, score, feedback, status, created_at)
         VALUES (?, 'task_1', ?, 'Code submission', 90, 'Great', 'approved', ?)`,
        `sub_${i}_${userId}`,
        userId,
        Date.now()
      );
    }

    const elig = certificationTracksService.evaluateEligibility(userId, guildId, 'track_fullstack_senior');
    expect(elig.isEligible).toBe(true);

    const grad = certificationTracksService.graduateTrack(userId, guildId, 'track_fullstack_senior');
    expect(grad.success).toBe(true);
    expect(grad.certificate?.title).toContain('Certified Senior Full-Stack Engineer');
  });

  it('REQ-20.9: alumniSuccess submits stories and produces broadcast format', () => {
    const story = alumniSuccessService.submitStory({
      guildId,
      userId,
      category: 'remote_job',
      title: 'Landed $6,000/mo Remote Senior Role',
      storyContent: 'Prepared using Senior Progg live challenges and proposal coach!',
      impactMetrics: '$72,000 ARR remote contract',
    });
    expect(story.id).toBeDefined();

    const upvoted = alumniSuccessService.upvoteStory(story.id);
    expect(upvoted).toBe(2);

    const broadcast = alumniSuccessService.formatStoryBroadcast(story, 'ar');
    expect(broadcast).toContain('قصة نجاح وإلهام');
  });

  it('REQ-20.10: partnerOpportunities handles partner postings, NDA checks, and applications', () => {
    const opp = partnerOpportunitiesService.postOpportunity({
      guildId,
      partnerName: 'Cairo Tech Ventures',
      isVerifiedPartner: true,
      title: 'Enterprise AI Middleware Lead',
      budgetRange: '$8,000 - $12,000',
      requiredSeniority: 'Lead',
      minReputation: 100,
      requiresNda: true,
      techStack: ['Node.js', 'PyTorch', 'VectorDB'],
      description: 'Lead AI architecture for fintech portfolio',
    });
    expect(opp.id).toBeDefined();

    // Must accept NDA
    const noNda = partnerOpportunitiesService.applyForOpportunity(opp.id, userId, guildId, false);
    expect(noNda.success).toBe(false);

    const applied = partnerOpportunitiesService.applyForOpportunity(opp.id, userId, guildId, true);
    expect(applied.success).toBe(true);
  });
});
