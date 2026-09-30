import { logger } from '../../../utils/logger.js';

export interface PrivacySettings {
  userId: string;
  hideRealName: boolean;
  hideContactInfo: boolean;
  hideEarnings: boolean;
  hideActiveHours: boolean;
}

export class PrivacyModeService {
  private userSettings: Map<string, PrivacySettings> = new Map();

  public getSettings(userId: string): PrivacySettings {
    const existing = this.userSettings.get(userId);
    if (existing) return existing;

    const defaultSettings: PrivacySettings = {
      userId,
      hideRealName: false,
      hideContactInfo: false,
      hideEarnings: true, // private by default
      hideActiveHours: false,
    };
    this.userSettings.set(userId, defaultSettings);
    return defaultSettings;
  }

  public updateSettings(userId: string, partial: Partial<Omit<PrivacySettings, 'userId'>>): PrivacySettings {
    const current = this.getSettings(userId);
    const updated = { ...current, ...partial };
    this.userSettings.set(userId, updated);
    logger.info('PrivacyMode', `Updated privacy settings for user ${userId}`);
    return updated;
  }

  public filterProfileForPublic(
    userId: string,
    rawProfile: {
      username: string;
      realName?: string;
      contactHandle?: string;
      earningsSummary?: string;
      activeHours?: string;
      skills: string[];
      reputationScore: number;
    }
  ) {
    const settings = this.getSettings(userId);

    return {
      username: rawProfile.username,
      realName: settings.hideRealName ? undefined : rawProfile.realName,
      contactHandle: settings.hideContactInfo ? undefined : rawProfile.contactHandle,
      earningsSummary: settings.hideEarnings ? '[Private / Hidden]' : rawProfile.earningsSummary,
      activeHours: settings.hideActiveHours ? undefined : rawProfile.activeHours,
      skills: rawProfile.skills,
      reputationScore: rawProfile.reputationScore,
    };
  }
}

export const privacyModeService = new PrivacyModeService();
