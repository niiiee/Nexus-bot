import { describe, it, expect, beforeEach } from 'vitest';
import { setupWizardService } from '../../src/discord/setupWizard.js';
import { dbService } from '../../src/database/connection.js';
import { activeSessions } from '../../src/dashboard/authRoutes.js';

describe('Phase 7: Setup Wizard & Guild Provisioning (Section 10.4)', () => {
  const guildId = 'guild_wizard_test_1';
  const ownerId = 'user_wizard_owner_1';

  beforeEach(() => {
    dbService.run(`DELETE FROM guild_configs WHERE guild_id = ?`, guildId);
  });

  it('provisions all required channels, roles, and database configuration', async () => {
    const createdChannels: string[] = [];
    const createdRoles: string[] = [];

    const mockGuild = {
      id: guildId,
      name: 'Freelancer Dev Hub',
      ownerId,
      channels: {
        create: async (data: { name: string }) => {
          createdChannels.push(data.name);
          return { id: `mock_chan_${data.name}`, name: data.name };
        },
      },
      roles: {
        create: async (data: { name: string }) => {
          createdRoles.push(data.name);
          return { id: `mock_role_${data.name}`, name: data.name };
        },
      },
    };

    const result = await setupWizardService.provisionGuild(mockGuild, ownerId, 'ar');

    expect(result.success).toBe(true);
    expect(result.guildId).toBe(guildId);
    expect(result.channelsCreated.length).toBeGreaterThanOrEqual(8);
    expect(result.rolesCreated.length).toBeGreaterThanOrEqual(9);

    // Verify database row in guild_configs
    const config = dbService.get<{
      guild_id: string;
      welcome_channel_id: string;
      staff_review_channel_id: string;
      larper_role_id: string;
      verified_role_id: string;
      owner_role_id: string;
    }>(`SELECT * FROM guild_configs WHERE guild_id = ?`, guildId);

    expect(config).toBeDefined();
    expect(config?.owner_role_id).toBe(ownerId);
    expect(config?.welcome_channel_id).toBeDefined();
    expect(config?.larper_role_id).toBeDefined();
    expect(config?.verified_role_id).toBeDefined();

    // Verify dashboard token generated and registered in activeSessions
    expect(result.sessionToken).toBeDefined();
    expect(activeSessions.has(result.sessionToken)).toBe(true);
    const session = activeSessions.get(result.sessionToken);
    expect(session?.role).toBe('owner');
    expect(session?.userId).toBe(ownerId);

    // Verify bilingual summary text
    expect(result.summaryAr).toContain('تم تجهيز بنية سيرفر سينيور بروج بنجاح');
    expect(result.summaryEn).toContain('Senior Progg Server Architecture Provisioned Successfully');
  });
});
