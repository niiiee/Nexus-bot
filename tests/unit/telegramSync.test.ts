import { describe, it, expect, beforeEach } from 'vitest';
import { telegramSyncService } from '../../src/telegram/syncService.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';
import { dbService } from '../../src/database/connection.js';

describe('Phase 3: Telegram Companion Bot & Synchronization (Section 6)', () => {
  const guildId = 'guild_tg_test';
  const consentingUser = 'user_tg_consent';
  const nonConsentingUser = 'user_tg_no_consent';

  beforeEach(() => {
    memberRepo.getOrCreate(consentingUser, guildId, 'ConsentingDev');
    memberRepo.update(consentingUser, { opt_in_telegram_backup: 1 });

    memberRepo.getOrCreate(nonConsentingUser, guildId, 'PrivateDev');
    memberRepo.update(nonConsentingUser, { opt_in_telegram_backup: 0 });
  });

  it('rejects backup for users who did not opt in with consent checkbox (Section 6.1, 6.5)', async () => {
    const subId = 'sub_no_consent';
    dbService.run(
      `INSERT INTO work_submissions (id, user_id, guild_id, url_or_asset, description, assigned_role, status, telegram_synced, created_at)
       VALUES (?, ?, ?, 'https://github.com/priv/code', 'Private repo', 'Senior Developer', 'approved', 0, ?)`,
      subId,
      nonConsentingUser,
      guildId,
      Date.now()
    );

    const result = await telegramSyncService.syncWorkSubmission(subId);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('opt in');
  });

  it('syncs approved work for consenting users and prevents duplicates via SHA-256 hash (Section 6.4)', async () => {
    const subId1 = 'sub_consenting_1';
    dbService.run(
      `INSERT INTO work_submissions (id, user_id, guild_id, url_or_asset, description, assigned_role, status, telegram_synced, created_at)
       VALUES (?, ?, ?, 'https://github.com/open/my-tool', 'Open source utility', 'Mid Developer', 'approved', 0, ?)`,
      subId1,
      consentingUser,
      guildId,
      Date.now()
    );

    const firstSync = await telegramSyncService.syncWorkSubmission(subId1);
    expect(firstSync.success).toBe(true);

    // Verify marked in DB as synced
    const row = dbService.get<{ telegram_synced: number }>('SELECT telegram_synced FROM work_submissions WHERE id = ?', subId1);
    expect(row?.telegram_synced).toBe(1);

    // Attempt duplicate sync with same content payload
    const subId2 = 'sub_consenting_2';
    dbService.run(
      `INSERT INTO work_submissions (id, user_id, guild_id, url_or_asset, description, assigned_role, status, telegram_synced, created_at)
       VALUES (?, ?, ?, 'https://github.com/open/my-tool', 'Open source utility', 'Mid Developer', 'approved', 0, ?)`,
      subId2,
      consentingUser,
      guildId,
      Date.now()
    );

    const duplicateSync = await telegramSyncService.syncWorkSubmission(subId2);
    expect(duplicateSync.success).toBe(false);
    expect(duplicateSync.reason).toContain('Duplicate');
  });

  it('provides archive summary and respect privacy counts', () => {
    const summary = telegramSyncService.getArchiveSummary(guildId);
    expect(summary.totalApproved).toBeGreaterThanOrEqual(1);
    expect(summary.unconsentingCount).toBeGreaterThanOrEqual(1);
  });
});
