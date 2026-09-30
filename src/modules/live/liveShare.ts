import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('LiveShare');

export interface LiveShareSession {
  sessionId: string;
  courseTitle: string;
  courseUrl: string;
  hostId: string;
  guildId: string;
  channelId: string;
  language: 'ar' | 'en';
  status: 'playing' | 'paused' | 'ended';
  currentPositionSeconds: number;
  lastStateChangeTime: number;
  attendees: Set<string>;
}

export class LiveShareService {
  private activeSessions: Map<string, LiveShareSession> = new Map();

  public createSession(params: {
    courseTitle: string;
    courseUrl: string;
    hostId: string;
    guildId: string;
    channelId: string;
    language?: 'ar' | 'en';
  }): LiveShareSession {
    const sessionId = `live_${uuidv4().slice(0, 8)}`;
    const now = Date.now();

    const session: LiveShareSession = {
      sessionId,
      courseTitle: params.courseTitle,
      courseUrl: params.courseUrl,
      hostId: params.hostId,
      guildId: params.guildId,
      channelId: params.channelId,
      language: params.language || 'ar',
      status: 'paused',
      currentPositionSeconds: 0,
      lastStateChangeTime: now,
      attendees: new Set([params.hostId]),
    };

    this.activeSessions.set(sessionId, session);
    logger.info(`Live Share watch-party session ${sessionId} created for "${params.courseTitle}" by host ${params.hostId}`);
    return session;
  }

  public getSession(sessionId: string): LiveShareSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  public joinSession(sessionId: string, userId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status === 'ended') return false;
    session.attendees.add(userId);
    return true;
  }

  public leaveSession(sessionId: string, userId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    return session.attendees.delete(userId);
  }

  public play(sessionId: string, hostId: string): { success: boolean; currentPositionSeconds: number } {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.hostId !== hostId) return { success: false, currentPositionSeconds: 0 };

    session.status = 'playing';
    session.lastStateChangeTime = Date.now();
    return { success: true, currentPositionSeconds: session.currentPositionSeconds };
  }

  public pause(sessionId: string, hostId: string): { success: boolean; currentPositionSeconds: number } {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.hostId !== hostId) return { success: false, currentPositionSeconds: 0 };

    if (session.status === 'playing') {
      const elapsed = Math.round((Date.now() - session.lastStateChangeTime) / 1000);
      session.currentPositionSeconds += elapsed;
    }

    session.status = 'paused';
    session.lastStateChangeTime = Date.now();
    return { success: true, currentPositionSeconds: session.currentPositionSeconds };
  }

  public seek(sessionId: string, hostId: string, targetSeconds: number): { success: boolean; newPosition: number } {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.hostId !== hostId) return { success: false, newPosition: 0 };

    session.currentPositionSeconds = Math.max(0, targetSeconds);
    session.lastStateChangeTime = Date.now();
    return { success: true, newPosition: session.currentPositionSeconds };
  }

  public getSyncState(sessionId: string): {
    courseTitle: string;
    courseUrl: string;
    status: 'playing' | 'paused' | 'ended';
    currentPositionSeconds: number;
    attendeesCount: number;
  } | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    let position = session.currentPositionSeconds;
    if (session.status === 'playing') {
      position += Math.round((Date.now() - session.lastStateChangeTime) / 1000);
    }

    return {
      courseTitle: session.courseTitle,
      courseUrl: session.courseUrl,
      status: session.status,
      currentPositionSeconds: position,
      attendeesCount: session.attendees.size,
    };
  }
}

export const liveShareService = new LiveShareService();
