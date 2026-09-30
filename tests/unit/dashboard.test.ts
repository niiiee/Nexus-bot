import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDashboardApp } from '../../src/dashboard/server.js';
import { dbService } from '../../src/database/connection.js';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';

describe('Phase 6: Owner Web Dashboard & REST API (Section 16)', () => {
  let server: Server;
  let baseUrl: string;
  const ownerToken = 'progg_admin_secret_token_2026';

  beforeAll(async () => {
    // Ensure in-memory database is initialized with guild_configs and members
    dbService.exec(`
      INSERT OR IGNORE INTO guild_configs (guild_id, created_at, updated_at) VALUES ('guild_dash_test', 1700000000000, 1700000000000);
      INSERT OR REPLACE INTO members (user_id, guild_id, username, seniority_level, credits, xp, reputation_score, created_at, updated_at)
      VALUES ('user_dash_1', 'guild_dash_test', 'DevAhmed', 'mid', 250, 1200, 85, 1700000000000, 1700000000000);
      INSERT OR REPLACE INTO deals (id, guild_id, channel_id, client_id, freelancer_id, middleman_id, title, amount, currency, agreement_text, agreement_sha256, status, created_at)
      VALUES ('deal_dash_1', 'guild_dash_test', 'chan_escrow_1', 'client_1', 'user_dash_1', 'mid_man_1', 'Web App Design', 1500, 'USD', 'Agreement details', 'dummy_hash', 'funded', 1700000000000);
      INSERT OR REPLACE INTO deal_disputes (id, deal_id, initiator_id, reason, status, created_at)
      VALUES ('disp_dash_1', 'deal_dash_1', 'client_1', 'Milestone delayed by 3 days', 'open', 1700000000000);
    `);

    const app = createDashboardApp();
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects unauthorized requests with 401 when no token is provided', async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('authenticates with Bearer token and returns user profile on /auth/me', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(true);
    expect(data.user.role).toBe('owner');
    expect(data.user.username).toBe('Senior Progg Owner');
  });

  it('fetches server stats and community health overview', async () => {
    const res = await fetch(`${baseUrl}/api/stats?guildId=guild_dash_test`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.members).toBeDefined();
    expect(data.members.total).toBeGreaterThanOrEqual(1);
    expect(data.economy.totalCreditsInCirculation).toBeGreaterThanOrEqual(250);
    expect(data.escrow.openDisputes).toBeGreaterThanOrEqual(1);
    expect(data.communityHealth).toBeDefined();
  });

  it('lists members with search query and pagination', async () => {
    const res = await fetch(`${baseUrl}/api/members?q=DevAhmed`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.members).toBeInstanceOf(Array);
    expect(data.members.length).toBeGreaterThanOrEqual(1);
    expect(data.members[0].username).toBe('DevAhmed');
    expect(data.members[0].seniority_level).toBe('mid');
  });

  it('adjusts member credits balance via PATCH /api/members/:id/credits', async () => {
    const res = await fetch(`${baseUrl}/api/members/user_dash_1/credits`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: 100, reason: 'Test bonus from dashboard', guildId: 'guild_dash_test' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.newBalance).toBe(350);
  });

  it('overrides member role and freezes/unfreezes account', async () => {
    // 1. Role override
    const roleRes = await fetch(`${baseUrl}/api/members/user_dash_1/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seniorityLevel: 'senior' }),
    });
    expect(roleRes.status).toBe(200);
    const roleData = await roleRes.json();
    expect(roleData.seniorityLevel).toBe('senior');

    // 2. Freeze account
    const freezeRes = await fetch(`${baseUrl}/api/members/user_dash_1/freeze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ freeze: true }),
    });
    expect(freezeRes.status).toBe(200);
    const freezeData = await freezeRes.json();
    expect(freezeData.isRestricted).toBe(1);
  });

  it('lists escrows and allows emergency owner override release', async () => {
    // 1. List deals
    const listRes = await fetch(`${baseUrl}/api/escrows`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.deals).toBeInstanceOf(Array);
    expect(listData.deals.length).toBeGreaterThanOrEqual(1);

    // 2. Override release
    const overrideRes = await fetch(`${baseUrl}/api/escrows/deal_dash_1/override-release`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient: 'freelancer', reason: 'Verified milestone delivery' }),
    });
    expect(overrideRes.status).toBe(200);
    const overrideData = await overrideRes.json();
    expect(overrideData.success).toBe(true);
    expect(overrideData.targetUserId).toBe('user_dash_1');
    expect(overrideData.dealId).toBe('deal_dash_1');
  });

  it('updates AI configuration and tests live prompt generation', async () => {
    // 1. Update config
    const confRes = await fetch(`${baseUrl}/api/ai/config`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        temperature: 0.7,
        toneIntensity: 'medium',
        personaOverride: 'Senior Progg Bot Master',
      }),
    });
    expect(confRes.status).toBe(200);
    const confData = await confRes.json();
    expect(confData.config.toneIntensity).toBe('medium');
    expect(confData.config.personaOverride).toBe('Senior Progg Bot Master');

    // 2. Test prompt
    const testRes = await fetch(`${baseUrl}/api/ai/test-prompt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'ازيك يا برو، كودي مش شغال', lang: 'ar' }),
    });
    expect(testRes.status).toBe(200);
    const testData = await testRes.json();
    expect(testData.success).toBe(true);
    expect(testData.response).toBeDefined();
    expect(testData.explainability.tone).toContain('Egyptian casual');
  });
});
