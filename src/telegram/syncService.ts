import crypto from 'crypto';
import { dbService } from '../database/connection.js';
import { memberRepo } from '../database/repositories/memberRepo.js';
import { auditRepo } from '../database/repositories/auditRepo.js';
import { telegramBotService } from './bot.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TelegramSyncService');

export interface SyncResult {
  syncedCount: number;
  skippedUnconsentingCount: number;
  duplicateCount: number;
  errorsCount: number;
}

export class TelegramSyncService {
  private syncedHashes: Set<string> = new Set();

  public async syncWorkSubmission(submissionId: string): Promise<{ success: boolean; reason?: string }> {
    const sub = dbService.get<{
      id: string;
      user_id: string;
      guild_id: string;
      url_or_asset: string;
      description: string;
      assigned_role: string;
      status: string;
      telegram_synced: number;
    }>('SELECT * FROM work_submissions WHERE id = ?', submissionId);

    if (!sub) return { success: false, reason: 'Submission not found' };
    if (sub.status !== 'approved') return { success: false, reason: 'Work submission is not approved' };
    if (sub.telegram_synced === 1) return { success: true, reason: 'Already synced' };

    // Strict Consent Check (Section 6.1, 6.5)
    const member = memberRepo.get(sub.user_id);
    if (!member || member.opt_in_telegram_backup !== 1) {
      logger.info(`Skipping Telegram sync for submission ${submissionId}: User ${sub.user_id} did not opt in.`);
      return { success: false, reason: 'User did not opt in to Telegram backup' };
    }

    // Deduplication by Content Hash (Section 6.4)
    const contentPayload = `${sub.url_or_asset}::${sub.description}`;
    const hash = crypto.createHash('sha256').update(contentPayload).digest('hex');

    if (this.syncedHashes.has(hash)) {
      logger.info(`Duplicate content hash ${hash} detected for submission ${submissionId}. Skipping.`);
      return { success: false, reason: 'Duplicate content already archived' };
    }

    // Format archive message
    const message = `
📦 <b>[COMMUNITY WORK ARCHIVE BACKUP]</b>
<b>Author:</b> <code>${member.username}</code> (${sub.assigned_role})
<b>Deliverable URL:</b> ${sub.url_or_asset}
<b>Description:</b>
${sub.description}

<i>Verified by Senior Progg AI & Community Staff</i>
#portfolio #backup #${sub.assigned_role.toLowerCase().replace(/[\s-]/g, '_')}
`.trim();

    const posted = await telegramBotService.postArchiveMessage(message);
    if (posted) {
      this.syncedHashes.add(hash);
      dbService.run('UPDATE work_submissions SET telegram_synced = 1 WHERE id = ?', submissionId);

      auditRepo.log({
        guild_id: sub.guild_id,
        action_type: 'telegram_backup_synced',
        actor_id: 'sync_service',
        target_id: sub.user_id,
        details: { submissionId, hash },
        reasoning: 'Consent verified. Work item archived off-platform.',
        reversible: false,
      });

      return { success: true };
    }

    return { success: false, reason: 'Failed to deliver message to Telegram channel' };
  }

  public async syncAllApproved(guildId: string, actorId: string): Promise<SyncResult> {
    const approvedSubs = dbService.all<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM work_submissions WHERE guild_id = ? AND status = 'approved' AND telegram_synced = 0",
      guildId
    );

    let synced = 0;
    let skipped = 0;
    let duplicates = 0;
    let errors = 0;

    for (const sub of approvedSubs) {
      const res = await this.syncWorkSubmission(sub.id);
      if (res.success) synced++;
      else if (res.reason?.includes('opt in')) skipped++;
      else if (res.reason?.includes('Duplicate')) duplicates++;
      else errors++;
    }

    auditRepo.log({
      guild_id: guildId,
      action_type: 'telegram_bulk_sync_executed',
      actor_id: actorId,
      details: { synced, skipped, duplicates, errors },
      reasoning: `Owner requested bulk sync to Telegram archive.`,
      reversible: false,
    });

    return { syncedCount: synced, skippedUnconsentingCount: skipped, duplicateCount: duplicates, errorsCount: errors };
  }

  public getArchiveSummary(guildId: string): { totalApproved: number; totalSynced: number; unconsentingCount: number } {
    const totalApproved = dbService.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM work_submissions WHERE guild_id = ? AND status = 'approved'",
      guildId
    )?.count || 0;

    const totalSynced = dbService.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM work_submissions WHERE guild_id = ? AND telegram_synced = 1',
      guildId
    )?.count || 0;

    const unconsentingCount = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM work_submissions ws
       JOIN members m ON ws.user_id = m.user_id
       WHERE ws.guild_id = ? AND ws.status = 'approved' AND m.opt_in_telegram_backup = 0`,
      guildId
    )?.count || 0;

    return { totalApproved, totalSynced, unconsentingCount };
  }
}

export const telegramSyncService = new TelegramSyncService();
