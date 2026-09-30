import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export type PomodoroPhase = 'focus' | 'break' | 'idle';

export interface PomodoroRoomState {
  channelId: string;
  guildId: string;
  phase: PomodoroPhase;
  focusMinutes: number;
  breakMinutes: number;
  cycleCount: number;
  currentCycleStart: number;
  participants: Set<string>;
}

export class PomodoroRoomsService {
  // In-memory active rooms: channelId -> PomodoroRoomState
  private rooms = new Map<string, PomodoroRoomState>();

  /**
   * Initializes or starts a synced Pomodoro timer in a study voice/text channel.
   */
  public startPomodoro(params: {
    channelId: string;
    guildId: string;
    focusMinutes?: number;
    breakMinutes?: number;
  }): PomodoroRoomState {
    const focusMinutes = params.focusMinutes || 25;
    const breakMinutes = params.breakMinutes || 5;

    const state: PomodoroRoomState = {
      channelId: params.channelId,
      guildId: params.guildId,
      phase: 'focus',
      focusMinutes,
      breakMinutes,
      cycleCount: 1,
      currentCycleStart: Date.now(),
      participants: new Set<string>(),
    };

    this.rooms.set(params.channelId, state);
    logger.info(`[PomodoroRooms] Started Pomodoro room in channel ${params.channelId}: ${focusMinutes}m focus / ${breakMinutes}m break`);
    return state;
  }

  /**
   * Registers a member participating in the current focus cycle.
   */
  public registerParticipant(channelId: string, userId: string): boolean {
    const room = this.rooms.get(channelId);
    if (!room) return false;
    room.participants.add(userId);
    return true;
  }

  /**
   * Checks the timer and advances phase if interval has elapsed.
   */
  public tick(channelId: string): {
    phaseChanged: boolean;
    currentPhase: PomodoroPhase;
    cycleCount: number;
    transitionMessage?: string;
    rewardedUserIds?: string[];
  } {
    const room = this.rooms.get(channelId);
    if (!room || room.phase === 'idle') {
      return { phaseChanged: false, currentPhase: 'idle', cycleCount: 0 };
    }

    const elapsedMinutes = (Date.now() - room.currentCycleStart) / (60 * 1000);
    const targetMinutes = room.phase === 'focus' ? room.focusMinutes : room.breakMinutes;

    if (elapsedMinutes >= targetMinutes) {
      // Transition!
      if (room.phase === 'focus') {
        // Switch to break, reward participants with Focus XP
        const rewarded = Array.from(room.participants);
        for (const userId of rewarded) {
          dbService.run(
            `UPDATE members SET xp = xp + 50 WHERE user_id = ? AND guild_id = ?`,
            userId,
            room.guildId
          );
        }

        room.phase = 'break';
        room.currentCycleStart = Date.now();

        return {
          phaseChanged: true,
          currentPhase: 'break',
          cycleCount: room.cycleCount,
          transitionMessage: `🔔 **استراحة قصيرة! (Short Break)** ☕\nعاش يا شباب! خلصتم ${room.focusMinutes} دقيقة تركيز تام. خذوا استراحة ${room.breakMinutes} دقائق، وتمت إضافة 50 Focus XP للمشاركين!`,
          rewardedUserIds: rewarded,
        };
      } else {
        // Switch back to focus
        room.phase = 'focus';
        room.cycleCount++;
        room.currentCycleStart = Date.now();
        room.participants.clear(); // reset for next round

        return {
          phaseChanged: true,
          currentPhase: 'focus',
          cycleCount: room.cycleCount,
          transitionMessage: `🔔 **وقت التركيز بدأ! (Focus Time)** 💻\nالجولة رقم ${room.cycleCount} بدأت! ${room.focusMinutes} دقيقة تركيز بدون مشتتات. يلا كود نظيف وإنتاجية عالية! 💪`,
        };
      }
    }

    return { phaseChanged: false, currentPhase: room.phase, cycleCount: room.cycleCount };
  }

  /**
   * Stops the active Pomodoro session in the room.
   */
  public stopPomodoro(channelId: string): boolean {
    const exists = this.rooms.has(channelId);
    this.rooms.delete(channelId);
    return exists;
  }

  /**
   * Gets state of a room.
   */
  public getRoomState(channelId: string): PomodoroRoomState | undefined {
    return this.rooms.get(channelId);
  }
}

export const pomodoroRoomsService = new PomodoroRoomsService();
