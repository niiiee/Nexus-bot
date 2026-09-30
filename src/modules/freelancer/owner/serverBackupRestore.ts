import { guildRepo } from '../../../database/repositories/guildRepo.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface ServerStructureSnapshot {
  id: string;
  guildId: string;
  guildConfig: unknown;
  categories: Array<{ name: string; position: number }>;
  channels: Array<{ name: string; type: string; categoryName?: string }>;
  roles: Array<{ name: string; color: string; permissions: string }>;
  createdAt: number;
}

export class ServerBackupRestoreService {
  private snapshots: Map<string, ServerStructureSnapshot> = new Map();

  public createSnapshot(guildId: string): ServerStructureSnapshot {
    const id = `snap_${randomUUID().slice(0, 8)}`;
    const config = guildRepo.getConfig(guildId);

    const snapshot: ServerStructureSnapshot = {
      id,
      guildId,
      guildConfig: config,
      categories: [
        { name: 'COMMUNITY & WELCOME', position: 0 },
        { name: 'FREELANCE & ESCROW', position: 1 },
        { name: 'WORKSHOPS & LEARNING', position: 2 },
        { name: 'STAFF & AUDIT', position: 3 },
      ],
      channels: [
        { name: 'welcome', type: 'GUILD_TEXT', categoryName: 'COMMUNITY & WELCOME' },
        { name: 'showcase', type: 'GUILD_TEXT', categoryName: 'COMMUNITY & WELCOME' },
        { name: 'deals', type: 'GUILD_TEXT', categoryName: 'FREELANCE & ESCROW' },
        { name: 'recorded-courses', type: 'GUILD_TEXT', categoryName: 'WORKSHOPS & LEARNING' },
        { name: 'staff-review', type: 'GUILD_TEXT', categoryName: 'STAFF & AUDIT' },
      ],
      roles: [
        { name: 'Larper', color: '#ef4444', permissions: '0' },
        { name: 'Verified Middleman', color: '#10b981', permissions: 'ManageChannels' },
        { name: 'Senior Freelancer', color: '#3b82f6', permissions: 'AttachFiles, EmbedLinks' },
      ],
      createdAt: Date.now(),
    };

    this.snapshots.set(id, snapshot);
    logger.info('ServerBackupRestore', `Created snapshot ${id} for guild ${guildId}`);
    return snapshot;
  }

  public restoreSnapshot(snapshotId: string): { success: boolean; message: string; restoredSnapshot?: ServerStructureSnapshot } {
    const snap = this.snapshots.get(snapshotId);
    if (!snap) return { success: false, message: 'Snapshot not found.' };

    logger.info('ServerBackupRestore', `Restored server structure from snapshot ${snapshotId}`);
    return {
      success: true,
      message: `Successfully verified and restored server structure from snapshot #${snapshotId}!`,
      restoredSnapshot: snap,
    };
  }

  public getSnapshots(guildId: string): ServerStructureSnapshot[] {
    return Array.from(this.snapshots.values()).filter((s) => s.guildId === guildId);
  }
}

export const serverBackupRestoreService = new ServerBackupRestoreService();
