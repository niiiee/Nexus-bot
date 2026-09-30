import { describe, it, expect } from 'vitest';
import { questionGenerator } from '../../src/ai/generators/questionGenerator.js';
import { authenticityAnalyzer } from '../../src/ai/evaluators/authenticityAnalyzer.js';
import { escalationService } from '../../src/discord/services/escalationService.js';

describe('Phase 2: Adaptive Vetting & Authenticity (Section 2)', () => {
  it('generates scenario and debugging questions without repeats', async () => {
    const questions = await questionGenerator.generateQuestions({
      userId: 'test_vet_user',
      field: 'development',
      claimedYears: 2,
      tools: 'React, Node.js',
      language: 'en',
    });

    expect(questions.length).toBeGreaterThanOrEqual(1);
    expect(questions[0].prompt).toBeDefined();
    expect(questions[0].type).toBeDefined();
  });

  it('generates adaptive follow-up probing questions', async () => {
    const probe = await questionGenerator.generateFollowUpProbe({
      previousQuestion: 'How do you handle microservice network partitioning?',
      candidateAnswer: 'I just use circuit breakers and retries.',
      language: 'en',
    });

    expect(probe).toBeDefined();
    expect(probe.length).toBeGreaterThan(10);
  });

  it('detects formulaic AI markers and computes suspicion score', async () => {
    const aiAnswer = [
      'As an AI language model, it is important to remember that caching must be handled carefully.',
      'In conclusion, both approaches have their pros and cons when dealing with database locks.',
    ];

    const report = await authenticityAnalyzer.analyzeAnswers({
      claimedYears: 3,
      field: 'development',
      questions: ['Q1', 'Q2'],
      answers: aiAnswer,
      responseLatencySeconds: [1, 2], // 1-2 seconds for full paragraphs = suspicious
    });

    expect(report.suspicionScore).toBeGreaterThan(0.6);
    expect(report.signals.some(s => s.includes('formulaic_ai_marker'))).toBe(true);
    expect(report.signals.some(s => s.includes('unrealistic_typing_latency'))).toBe(true);
  });

  it('creates silent escalation case with staff embed payload when suspicion exceeds threshold', () => {
    const escCase = escalationService.createCase({
      guildId: 'guild_esc_1',
      userId: 'user_suspicious_1',
      username: 'SusUser',
      field: 'development',
      claimedYears: 4,
      report: {
        suspicionScore: 0.85,
        confidence: 0.9,
        signals: ['formulaic_ai_marker', 'unrealistic_typing_latency'],
        evidenceExcerpts: ['As an AI language model...'],
        reasoning: 'Copied ChatGPT boilerplate with 1s submission latency.',
      },
    });

    expect(escCase.caseId).toBeDefined();
    expect(escCase.status).toBe('pending');

    const embed = escalationService.renderStaffEmbedPayload(escCase);
    expect(embed.title).toContain('Staff Review');
    expect(embed.description).toContain('EXPLAINABILITY CARD');
    expect(embed.fields.some(f => f.name.includes('Suspicion Score'))).toBe(true);

    const resolved = escalationService.resolveCase(escCase.caseId, 'admin_user', 'approved');
    expect(resolved.status).toBe('approved');
  });
});
