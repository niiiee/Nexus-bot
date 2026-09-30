import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface ProjectTeam {
  id: string;
  guildId: string;
  leadId: string;
  projectConcept: string;
  neededRoles: Array<{ roleName: string; filledByUserId?: string }>;
  status: 'recruiting' | 'complete' | 'in_development';
  createdAt: number;
}

export class TeamFormationService {
  private teams: Map<string, ProjectTeam> = new Map();

  public createTeam(params: {
    guildId: string;
    leadId: string;
    projectConcept: string;
    rolesNeeded: string[]; // e.g. ["Frontend React", "Backend Node.js", "UI/UX Designer"]
  }): ProjectTeam {
    const id = `team_${randomUUID().slice(0, 8)}`;
    const team: ProjectTeam = {
      id,
      guildId: params.guildId,
      leadId: params.leadId,
      projectConcept: params.projectConcept,
      neededRoles: params.rolesNeeded.map((r) => ({ roleName: r })),
      status: 'recruiting',
      createdAt: Date.now(),
    };

    this.teams.set(id, team);
    logger.info('TeamFormation', `Created project team ${id} led by ${params.leadId} for "${params.projectConcept}"`);
    return team;
  }

  public joinTeamRole(teamId: string, roleName: string, userId: string): { success: boolean; message: string; team?: ProjectTeam } {
    const team = this.teams.get(teamId);
    if (!team) return { success: false, message: 'Team not found.' };

    const target = team.neededRoles.find((r) => r.roleName.toLowerCase() === roleName.toLowerCase());
    if (!target) return { success: false, message: `Role "${roleName}" is not needed for this team.` };
    if (target.filledByUserId) return { success: false, message: `Role "${roleName}" is already filled.` };

    target.filledByUserId = userId;

    const allFilled = team.neededRoles.every((r) => Boolean(r.filledByUserId));
    if (allFilled) {
      team.status = 'complete';
      logger.info('TeamFormation', `Team ${teamId} is now complete with all roles filled!`);
    }

    return {
      success: true,
      message: `Joined team for role **${roleName}**!${allFilled ? ' All roles filled! Team is ready to build.' : ''}`,
      team,
    };
  }

  public getTeam(teamId: string): ProjectTeam | undefined {
    return this.teams.get(teamId);
  }
}

export const teamFormationService = new TeamFormationService();
