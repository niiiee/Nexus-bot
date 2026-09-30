import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface ScheduledCommunityEvent {
  id: string;
  guildId: string;
  title: string;
  type: 'tournament' | 'reward_drop' | 'theme_week' | 'workshop';
  scheduledTime: number;
  description: string;
  isAnnounced: boolean;
}

export class EventSchedulerService {
  private events: Map<string, ScheduledCommunityEvent> = new Map();

  public scheduleEvent(params: {
    guildId: string;
    title: string;
    type: 'tournament' | 'reward_drop' | 'theme_week' | 'workshop';
    scheduledTime: number;
    description: string;
  }): ScheduledCommunityEvent {
    const id = `ev_${randomUUID().slice(0, 8)}`;
    const event: ScheduledCommunityEvent = {
      id,
      guildId: params.guildId,
      title: params.title,
      type: params.type,
      scheduledTime: params.scheduledTime,
      description: params.description,
      isAnnounced: false,
    };

    this.events.set(id, event);
    logger.info('EventScheduler', `Scheduled ${params.type} event "${params.title}" for ${new Date(params.scheduledTime).toISOString()}`);
    return event;
  }

  public getUpcomingEvents(guildId: string): ScheduledCommunityEvent[] {
    const now = Date.now();
    return Array.from(this.events.values())
      .filter((e) => e.guildId === guildId && e.scheduledTime >= now)
      .sort((a, b) => a.scheduledTime - b.scheduledTime);
  }
}

export const eventSchedulerService = new EventSchedulerService();
