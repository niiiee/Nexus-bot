import { describe, it, expect, beforeEach } from 'vitest';
import { dbService } from '../../src/database/connection.js';
import { guildRepo } from '../../src/database/repositories/guildRepo.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';
import { auditRepo } from '../../src/database/repositories/auditRepo.js';
import { vettingRepo } from '../../src/database/repositories/vettingRepo.js';
import { testRepo } from '../../src/database/repositories/testRepo.js';
import { dealRepo } from '../../src/database/repositories/dealRepo.js';
import { perkRepo } from '../../src/database/repositories/perkRepo.js';
import { economyRepo } from '../../src/database/repositories/economyRepo.js';

describe('Database Repositories & Connection', () => {
  const guildId = 'guild_test_100';
  const userId = 'user_test_200';

  it('initializes in-memory database and creates tables', () => {
    expect(dbService).toBeDefined();
    const tables = dbService.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('guild_configs');
    expect(tableNames).toContain('members');
    expect(tableNames).toContain('vetting_sessions');
    expect(tableNames).toContain('skill_tests');
    expect(tableNames).toContain('deals');
    expect(tableNames).toContain('audit_logs');
    expect(tableNames).toContain('perk_definitions');
    expect(tableNames).toContain('credit_ledger');
  });

  it('handles guild repository getOrCreate and update', () => {
    const config = guildRepo.getOrCreate(guildId);
    expect(config.guild_id).toBe(guildId);
    expect(config.passing_score).toBe(50);

    const updated = guildRepo.update(guildId, { passing_score: 60, welcome_channel_id: 'chan_welcome_1' });
    expect(updated.passing_score).toBe(60);
    expect(updated.welcome_channel_id).toBe('chan_welcome_1');
  });

  it('handles member repository lifecycle and data privacy export', () => {
    const member = memberRepo.getOrCreate(userId, guildId, 'DevSam');
    expect(member.username).toBe('DevSam');
    expect(member.seniority_level).toBe('Junior');

    memberRepo.update(userId, { seniority_level: 'Senior', claimed_experience_years: 4 });
    const updated = memberRepo.get(userId)!;
    expect(updated.seniority_level).toBe('Senior');
    expect(updated.claimed_experience_years).toBe(4);

    const exported = memberRepo.exportUserData(userId);
    expect(exported.memberProfile).toBeDefined();
  });

  it('records and queries immutable audit logs with reversibility', () => {
    const logEntry = auditRepo.log({
      guild_id: guildId,
      action_type: 'role_penalty_applied',
      actor_id: 'bot_system',
      target_id: userId,
      details: { role: 'Larper', reason: 'Failed test score 42%' },
      reasoning: 'Candidate scored below 50% passing threshold.',
      reversible: true,
    });

    expect(logEntry.id).toBeDefined();
    expect(logEntry.reversible).toBe(1);

    const fetched = auditRepo.getById(logEntry.id);
    expect(fetched?.reasoning).toContain('threshold');

    const reversed = auditRepo.markReversed(logEntry.id);
    expect(reversed).toBe(true);
    expect(auditRepo.getById(logEntry.id)?.reversed).toBe(1);
  });

  it('handles vetting sessions and past question retrieval', () => {
    const session = vettingRepo.create({
      user_id: userId,
      guild_id: guildId,
      field: 'development',
      claimed_years: 4,
      initial_questions: ['How do you debug async race conditions?', 'Explain CAP theorem tradeoffs.'],
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('in_progress');

    const pastQuestions = vettingRepo.getAllPastQuestionsForUser(userId);
    expect(pastQuestions.length).toBe(2);
    expect(pastQuestions[0]).toContain('race conditions');
  });

  it('records skill tests and grades them with hidden rubrics', () => {
    const test = testRepo.create({
      user_id: userId,
      guild_id: guildId,
      field: 'development',
      questions: [{ id: 'q1', prompt: 'Fix deadlock', type: 'debugging' }],
      rubric: { q1_min_score: 25 },
      timebox_minutes: 45,
    });

    expect(test.expires_at).toBeGreaterThan(Date.now());

    const completed = testRepo.completeTest(test.id, { q1: 'applied mutex lock' }, 80, true, 'Great work');
    expect(completed.passed).toBe(1);
    expect(completed.score).toBe(80);
  });

  it('creates escrow deals with SHA-256 agreement integrity hashes', () => {
    const deal = dealRepo.create({
      guild_id: guildId,
      channel_id: 'chan_deal_500',
      client_id: 'client_1',
      freelancer_id: userId,
      middleman_id: 'middleman_1',
      title: 'Fullstack Next.js MVP',
      amount: 1500,
      currency: 'USD',
      agreement_text: 'Deliver responsive MVP in 14 calendar days.',
    });

    expect(deal.status).toBe('draft');
    expect(deal.agreement_sha256).toHaveLength(64); // Valid sha256 hex
  });

  it('manages perks and double-entry credit ledger transactions', () => {
    perkRepo.upsertDefinition({
      id: 'xp_boost_10',
      name: 'Bronze Spark',
      category: 'Progression',
      description: 'Passive 10% XP boost',
      credit_price: 150,
      level_requirement: 1,
      stock: -1,
      duration_seconds: 86400,
      is_active: 1,
    });

    const perks = perkRepo.listActiveDefinitions();
    expect(perks.some(p => p.id === 'xp_boost_10')).toBe(true);

    // Initial balance is 50. Add 200 credits for completing task
    const creditTx = economyRepo.addTransaction({
      user_id: userId,
      guild_id: guildId,
      amount: 200,
      source: 'daily_task',
      description: 'Completed Daily Task #1',
    });
    expect(creditTx.balance_after).toBe(250);

    // Spend 150 on perk
    const spendTx = economyRepo.addTransaction({
      user_id: userId,
      guild_id: guildId,
      amount: -150,
      source: 'perk_purchase',
      description: 'Purchased Bronze Spark',
    });
    expect(spendTx.balance_after).toBe(100);

    // Grant perk
    perkRepo.grantPerk(userId, guildId, 'xp_boost_10', 86400);
    expect(perkRepo.hasActivePerk(userId, 'xp_boost_10')).toBe(true);
  });
});
