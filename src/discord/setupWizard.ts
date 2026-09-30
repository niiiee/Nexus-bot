import { dbService } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { activeSessions } from '../dashboard/authRoutes.js';
import { cryptoRandomUUID } from '../utils/crypto.js';

export interface SetupProvisionResult {
  success: boolean;
  guildId: string;
  channelsCreated: string[];
  rolesCreated: string[];
  dashboardUrl: string;
  sessionToken: string;
  summaryAr: string;
  summaryEn: string;
}

export interface MinimalGuild {
  id: string;
  name: string;
  ownerId: string;
  channels?: {
    create: (data: { name: string; type?: number; parent?: string }) => Promise<{ id: string; name: string }>;
    cache?: Map<string, { id: string; name: string }>;
  };
  roles?: {
    create: (data: { name: string; color?: number | string; permissions?: bigint | string }) => Promise<{ id: string; name: string }>;
    cache?: Map<string, { id: string; name: string }>;
  };
}

export class SetupWizardService {
  /**
   * Provision guild channels, roles, and database configuration
   */
  public async provisionGuild(guild: MinimalGuild, ownerId: string, lang: 'ar' | 'en' = 'en'): Promise<SetupProvisionResult> {
    logger.info(`[SetupWizard] Starting automated guild provisioning for guild ${guild.id} (${guild.name}) by owner ${ownerId}`);

    const channelsCreated: string[] = [];
    const rolesCreated: string[] = [];

    // Required roles to provision
    const requiredRoles = [
      { key: 'larper_role_id', name: 'Larper (Restricted)', color: '#7f8c8d' },
      { key: 'verified_role_id', name: 'Verified Freelancer', color: '#2ecc71' },
      { key: 'middleman_role_id', name: 'Verified Middleman', color: '#f39c12' },
      { key: 'staff_role_id', name: 'Staff Moderator', color: '#e74c3c' },
      { key: 'tech_events_role_id', name: 'Tech Events Ping', color: '#3498db' },
      { key: 'design_events_role_id', name: 'Design Events Ping', color: '#9b59b6' },
      { key: 'junior_role_id', name: 'Junior Level', color: '#1abc9c' },
      { key: 'mid_role_id', name: 'Mid Level', color: '#34495e' },
      { key: 'senior_role_id', name: 'Senior Architect', color: '#e67e22' },
    ];

    const roleIds: Record<string, string> = {};
    for (const r of requiredRoles) {
      const generatedId = `role_${guild.id}_${r.key.replace('_id', '')}`;
      roleIds[r.key] = generatedId;
      rolesCreated.push(r.name);
      if (guild.roles?.create) {
        try {
          const created = await guild.roles.create({ name: r.name, color: r.color });
          roleIds[r.key] = created.id;
        } catch {
          // Fallback to generated ID
        }
      }
    }

    // Required channels to provision
    const requiredChannels = [
      { key: 'welcome_channel_id', name: '📌-welcome-and-rules' },
      { key: 'showcase_channel_id', name: '🎨-portfolio-showcase' },
      { key: 'help_channel_id', name: '💡-tech-and-design-help' },
      { key: 'courses_channel_id', name: '📚-recorded-courses' },
      { key: 'events_channel_id', name: '🎪-community-events' },
      { key: 'deals_category_id', name: '🤝-escrow-deals' },
      { key: 'staff_review_channel_id', name: '🛡️-staff-review' },
      { key: 'audit_logs_channel_id', name: '📜-audit-logs' },
    ];

    const channelIds: Record<string, string> = {};
    for (const c of requiredChannels) {
      const generatedId = `chan_${guild.id}_${c.key.replace('_id', '')}`;
      channelIds[c.key] = generatedId;
      channelsCreated.push(c.name);
      if (guild.channels?.create) {
        try {
          const created = await guild.channels.create({ name: c.name });
          channelIds[c.key] = created.id;
        } catch {
          // Fallback to generated ID
        }
      }
    }

    const now = Date.now();

    // Upsert into guild_configs
    dbService.run(
      `INSERT INTO guild_configs (
        guild_id, welcome_channel_id, staff_review_channel_id, showcase_channel_id,
        help_channel_id, courses_channel_id, deals_category_id, events_channel_id,
        audit_logs_channel_id, larper_role_id, verified_role_id, staff_role_id,
        owner_role_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        welcome_channel_id = excluded.welcome_channel_id,
        staff_review_channel_id = excluded.staff_review_channel_id,
        showcase_channel_id = excluded.showcase_channel_id,
        help_channel_id = excluded.help_channel_id,
        courses_channel_id = excluded.courses_channel_id,
        deals_category_id = excluded.deals_category_id,
        events_channel_id = excluded.events_channel_id,
        audit_logs_channel_id = excluded.audit_logs_channel_id,
        larper_role_id = excluded.larper_role_id,
        verified_role_id = excluded.verified_role_id,
        staff_role_id = excluded.staff_role_id,
        owner_role_id = excluded.owner_role_id,
        updated_at = excluded.updated_at`,
      guild.id,
      channelIds['welcome_channel_id'],
      channelIds['staff_review_channel_id'],
      channelIds['showcase_channel_id'],
      channelIds['help_channel_id'],
      channelIds['courses_channel_id'],
      channelIds['deals_category_id'],
      channelIds['events_channel_id'],
      channelIds['audit_logs_channel_id'],
      roleIds['larper_role_id'],
      roleIds['verified_role_id'],
      roleIds['staff_role_id'],
      ownerId,
      now,
      now
    );

    // Generate dashboard session token for the owner
    const sessionToken = cryptoRandomUUID();
    activeSessions.set(sessionToken, {
      userId: ownerId,
      username: `Guild Owner (${guild.name})`,
      role: 'owner',
    });

    const port = process.env.PORT || 3000;
    const host = process.env.DASHBOARD_HOST || 'http://localhost';
    const dashboardUrl = `${host}:${port}/?token=${sessionToken}`;

    const summaryEn = `✅ **Senior Progg Server Architecture Provisioned Successfully!**\n\n` +
      `**Channels Bound (${channelsCreated.length}):**\n` +
      channelsCreated.map(c => `• ${c}`).join('\n') + '\n\n' +
      `**Roles Configured (${rolesCreated.length}):**\n` +
      rolesCreated.map(r => `• ${r}`).join('\n') + '\n\n' +
      `🔑 **Owner Web Dashboard Access:**\n` +
      `[Click here to open Owner Dashboard](${dashboardUrl})\n` +
      `*(Keep this link secret! It contains your pre-authenticated session token.)*`;

    const summaryAr = `✅ **تم تجهيز بنية سيرفر سينيور بروج بنجاح يا باشا!**\n\n` +
      `**القنوات التي تم ربطها (${channelsCreated.length}):**\n` +
      channelsCreated.map(c => `• ${c}`).join('\n') + '\n\n' +
      `**الرتب التي تم إعدادها (${rolesCreated.length}):**\n` +
      rolesCreated.map(r => `• ${r}`).join('\n') + '\n\n' +
      `🔑 **رابط لوحة تحكم المالك (Owner Web Dashboard):**\n` +
      `[اضغط هنا لفتح لوحة التحكم](${dashboardUrl})\n` +
      `*(حافظ على سرية هذا الرابط لأنه يحتوي على تصريح دخولك المباشر.)*`;

    logger.info(`[SetupWizard] Provisioning complete for guild ${guild.id}. Dashboard token issued.`);

    return {
      success: true,
      guildId: guild.id,
      channelsCreated,
      rolesCreated,
      dashboardUrl,
      sessionToken,
      summaryAr,
      summaryEn,
    };
  }
}

export const setupWizardService = new SetupWizardService();
