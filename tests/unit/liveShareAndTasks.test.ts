import { describe, it, expect } from 'vitest';
import { liveShareService } from '../../src/modules/live/liveShare.js';
import { dailyTaskManager } from '../../src/modules/tasks/dailyTaskManager.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';

describe('Phase 3: Live Share & Daily Tasks Engine (Section 7.1, 7.3)', () => {
  const guildId = 'guild_live_1';
  const hostId = 'user_host_1';
  const viewerId = 'user_viewer_2';

  it('manages synchronized watch-party sessions for recorded courses', () => {
    const session = liveShareService.createSession({
      courseTitle: 'Fullstack Next.js 15 Masterclass',
      courseUrl: 'https://courses.seniorprogg.io/watch/next15',
      hostId,
      guildId,
      channelId: 'chan_courses_1',
      language: 'ar',
    });

    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe('paused');

    // Viewer joins
    liveShareService.joinSession(session.sessionId, viewerId);
    let state = liveShareService.getSyncState(session.sessionId);
    expect(state?.attendeesCount).toBe(2);

    // Host plays
    liveShareService.play(session.sessionId, hostId);
    state = liveShareService.getSyncState(session.sessionId);
    expect(state?.status).toBe('playing');

    // Host seeks to 120 seconds
    liveShareService.seek(session.sessionId, hostId, 120);
    state = liveShareService.getSyncState(session.sessionId);
    expect(state?.currentPositionSeconds).toBe(120);

    // Host pauses
    liveShareService.pause(session.sessionId, hostId);
    state = liveShareService.getSyncState(session.sessionId);
    expect(state?.status).toBe('paused');
  });

  it('delivers tailored daily tasks and tracks streaks with XP/credit rewards', () => {
    const member = memberRepo.getOrCreate(hostId, guildId, 'DevPro');
    memberRepo.update(hostId, { field: 'development', seniority_level: 'Senior' });

    const task = dailyTaskManager.getTaskForMember(hostId);
    expect(task).toBeDefined();
    expect(task?.field).toBe('development');

    const sub = dailyTaskManager.submitTask(
      hostId,
      guildId,
      task!.id,
      'Here is the complete solution using a mutex lock and async queue to handle state machine transitions.'
    );

    expect(sub.success).toBe(true);
    expect(sub.score).toBeGreaterThanOrEqual(50);
    expect(sub.creditsAwarded).toBeGreaterThan(0);
    expect(sub.newStreak).toBeGreaterThanOrEqual(1);

    const updatedMember = memberRepo.get(hostId);
    expect(updatedMember?.current_streak).toBe(sub.newStreak);
  });
});
