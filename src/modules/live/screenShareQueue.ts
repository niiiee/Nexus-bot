import { logger } from '../../utils/logger.js';

export interface PresenterEntry {
  userId: string;
  topic: string;
  joinedAt: number;
}

export interface ActiveStageState {
  currentPresenter?: PresenterEntry & { startedAt: number; durationMinutes: number };
  queue: PresenterEntry[];
}

export class ScreenShareQueueService {
  // In-memory queue per guild: guildId -> ActiveStageState
  private stageState = new Map<string, ActiveStageState>();

  private getState(guildId: string): ActiveStageState {
    if (!this.stageState.has(guildId)) {
      this.stageState.set(guildId, { queue: [] });
    }
    return this.stageState.get(guildId)!;
  }

  /**
   * Enqueues a member to present code or design on stage.
   */
  public joinQueue(guildId: string, userId: string, topic: string): { success: boolean; position: number; error?: string } {
    const state = this.getState(guildId);

    if (state.currentPresenter?.userId === userId) {
      return { success: false, position: 0, error: 'You are already presenting on stage' };
    }

    if (state.queue.some(p => p.userId === userId)) {
      return { success: false, position: 0, error: 'You are already in the queue' };
    }

    const entry: PresenterEntry = {
      userId,
      topic,
      joinedAt: Date.now(),
    };

    state.queue.push(entry);
    logger.info(`[ScreenShareQueue] User ${userId} joined queue for "${topic}" in guild ${guildId}. Position: ${state.queue.length}`);

    return { success: true, position: state.queue.length };
  }

  /**
   * Removes a member from the waiting queue.
   */
  public leaveQueue(guildId: string, userId: string): boolean {
    const state = this.getState(guildId);
    const initialLen = state.queue.length;
    state.queue = state.queue.filter(p => p.userId !== userId);
    return state.queue.length < initialLen;
  }

  /**
   * Advances the queue, making the next person the active presenter with a set time limit.
   */
  public nextPresenter(guildId: string, durationMinutes = 10): (PresenterEntry & { startedAt: number; durationMinutes: number }) | null {
    const state = this.getState(guildId);
    const next = state.queue.shift();

    if (!next) {
      state.currentPresenter = undefined;
      return null;
    }

    state.currentPresenter = {
      ...next,
      startedAt: Date.now(),
      durationMinutes,
    };

    logger.info(`[ScreenShareQueue] Next presenter in ${guildId}: ${next.userId} for ${durationMinutes} minutes`);
    return state.currentPresenter;
  }

  /**
   * Checks the remaining time for the current presenter.
   */
  public checkStageTimer(guildId: string): {
    hasActivePresenter: boolean;
    minutesLeft: number;
    secondsLeft: number;
    isExpired: boolean;
    presenterId?: string;
  } {
    const state = this.getState(guildId);
    if (!state.currentPresenter) {
      return { hasActivePresenter: false, minutesLeft: 0, secondsLeft: 0, isExpired: false };
    }

    const elapsedMs = Date.now() - state.currentPresenter.startedAt;
    const totalAllowedMs = state.currentPresenter.durationMinutes * 60 * 1000;
    const remainingMs = totalAllowedMs - elapsedMs;

    if (remainingMs <= 0) {
      return {
        hasActivePresenter: true,
        minutesLeft: 0,
        secondsLeft: 0,
        isExpired: true,
        presenterId: state.currentPresenter.userId,
      };
    }

    const totalSec = Math.floor(remainingMs / 1000);
    return {
      hasActivePresenter: true,
      minutesLeft: Math.floor(totalSec / 60),
      secondsLeft: totalSec % 60,
      isExpired: false,
      presenterId: state.currentPresenter.userId,
    };
  }

  /**
   * Formats the current queue status for Discord embeds.
   */
  public formatQueueStatus(guildId: string, locale: 'ar' | 'en' = 'ar'): string {
    const state = this.getState(guildId);
    const isAr = locale === 'ar';
    const lines: string[] = [];

    lines.push(isAr ? `🎙️ **طابور المنصة وعرض الشاشة (Screen Share Queue)**` : `🎙️ **Screen Share & Review Queue**`);

    if (state.currentPresenter) {
      const timer = this.checkStageTimer(guildId);
      lines.push(
        isAr
          ? `🔴 **يعرض الآن:** <@${state.currentPresenter.userId}> — *${state.currentPresenter.topic}* (${timer.minutesLeft}د ${timer.secondsLeft}ث متبقية)`
          : `🔴 **Currently Presenting:** <@${state.currentPresenter.userId}> — *${state.currentPresenter.topic}* (${timer.minutesLeft}m ${timer.secondsLeft}s remaining)`
      );
    } else {
      lines.push(isAr ? `⚪ **المنصة خالية حالياً.**` : `⚪ **The stage is currently open.**`);
    }

    lines.push(isAr ? `\n📋 **قائمة الانتظار (${state.queue.length} أعضاء):**` : `\n📋 **Waiting Queue (${state.queue.length} in line):**`);

    if (state.queue.length === 0) {
      lines.push(isAr ? `  *لا يوجد أحد في الانتظار.*` : `  *Queue is currently empty.*`);
    } else {
      state.queue.forEach((p, idx) => {
        lines.push(`  ${idx + 1}. <@${p.userId}> — *${p.topic}*`);
      });
    }

    lines.push(
      isAr
        ? `\n💡 للانضمام: \`/queue-join <الموضوع>\` | للمغادرة: \`/queue-leave\``
        : `\n💡 To join: \`/queue-join <topic>\` | To leave: \`/queue-leave\``
    );

    return lines.join('\n');
  }
}

export const screenShareQueueService = new ScreenShareQueueService();
