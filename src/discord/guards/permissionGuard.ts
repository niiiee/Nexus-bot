import { GuildMember, PermissionsBitField } from 'discord.js';
import { guildRepo } from '../../database/repositories/guildRepo.js';
import { auditRepo } from '../../database/repositories/auditRepo.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('PermissionGuard');

export class PermissionGuard {
  public static isOwnerOrAdmin(member: GuildMember): boolean {
    // 1. Check if member possesses Discord Administrator permission
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return true;
    }

    // 2. Check if member has configured Owner/Staff role
    const config = guildRepo.get(member.guild.id);
    if (config?.owner_role_id && member.roles.cache.has(config.owner_role_id)) {
      return true;
    }

    return false;
  }

  public static isStaff(member: GuildMember): boolean {
    if (this.isOwnerOrAdmin(member)) return true;

    const config = guildRepo.get(member.guild.id);
    if (config?.staff_role_id && member.roles.cache.has(config.staff_role_id)) {
      return true;
    }

    return false;
  }

  public static assertOwnerOrAdmin(member: GuildMember, commandName: string): boolean {
    const isAuthorized = this.isOwnerOrAdmin(member);

    if (!isAuthorized) {
      logger.warn(`Unauthorized attempt to execute administrative command '${commandName}' by user ${member.id}`);
      auditRepo.log({
        guild_id: member.guild.id,
        action_type: 'unauthorized_admin_command_attempt',
        actor_id: member.id,
        details: { commandName },
        reasoning: 'Member lacked Administrator or Owner role.',
        reversible: false,
      });
      return false;
    }

    return true;
  }
}
