import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID, sha256 } from '../../utils/crypto.js';

export interface MigrationPlan {
  id: string;
  sourceBot: string;
  dryRun: boolean;
  importedRolesCount: number;
  importedChannelsCount: number;
  status: 'simulated' | 'applied' | 'rolled_back';
}

export interface BlueprintDiff {
  blueprintName: string;
  addedRoles: string[];
  addedChannels: string[];
  permissionWarnings: string[];
}

export class OperabilityRolloutEngine {
  // Chapter 184: Migration Importers
  public executeMigration(params: {
    sourceBot: 'MEE6' | 'Dyno' | 'CarlBot' | 'ProBot';
    rawExportJson: string;
    dryRun: boolean;
  }): MigrationPlan {
    const id = `mig_${cryptoRandomUUID().substring(0, 8)}`;
    const parsed = JSON.parse(params.rawExportJson);
    const importedRolesCount = (parsed.roles || []).length;
    const importedChannelsCount = (parsed.channels || []).length;
    const status = params.dryRun ? 'simulated' : 'applied';

    dbService.run(
      `INSERT INTO migration_jobs (id, source_bot, dry_run, status, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      id,
      params.sourceBot,
      params.dryRun ? 1 : 0,
      status,
      Date.now()
    );

    return {
      id,
      sourceBot: params.sourceBot,
      dryRun: params.dryRun,
      importedRolesCount,
      importedChannelsCount,
      status
    };
  }

  public rollbackMigration(jobId: string): boolean {
    dbService.run(`UPDATE migration_jobs SET status = 'rolled_back' WHERE id = ?`, jobId);
    return true;
  }

  // Chapter 186: Server Blueprint Gallery
  public previewBlueprint(templateName: string, existingChannels: string[]): BlueprintDiff {
    const templates: Record<string, { roles: string[]; channels: string[] }> = {
      'freelance_hub': {
        roles: ['Freelancer', 'Client', 'Escrow_Arbitrator'],
        channels: ['announcements', 'client-briefs', 'project-showcase', 'deal-rooms']
      },
      'dev_academy': {
        roles: ['Mentor', 'Student', 'Alumni'],
        channels: ['general-study', 'code-review', 'quizzes', 'pair-programming']
      }
    };

    const chosen = templates[templateName] || templates['freelance_hub'];
    const addedChannels = chosen.channels.filter((c) => !existingChannels.includes(c));
    const permissionWarnings: string[] = [];

    if (chosen.roles.includes('Escrow_Arbitrator')) {
      permissionWarnings.push('Advisory: Non-custodial escrow policies must be verified before launch.');
    }

    return {
      blueprintName: templateName,
      addedRoles: chosen.roles,
      addedChannels,
      permissionWarnings
    };
  }

  // Chapter 189: Permission Diff Visualizer
  public computePermissionDiff(
    currentPerms: Record<string, number>,
    targetPerms: Record<string, number>
  ): { elevated: string[]; reduced: string[]; unchanged: string[] } {
    const elevated: string[] = [];
    const reduced: string[] = [];
    const unchanged: string[] = [];

    const allKeys = Array.from(new Set([...Object.keys(currentPerms), ...Object.keys(targetPerms)]));

    for (const key of allKeys) {
      const cur = currentPerms[key] ?? 0;
      const tar = targetPerms[key] ?? 0;
      if (tar > cur) elevated.push(key);
      else if (tar < cur) reduced.push(key);
      else unchanged.push(key);
    }

    return { elevated, reduced, unchanged };
  }

  // Chapter 190: Event Replay Debugger
  public replayEventStream(
    events: Array<{ type: string; payload: Record<string, unknown> }>
  ): { processedCount: number; errors: string[]; stateSnapshotHash: string } {
    const errors: string[] = [];
    let stateAccumulator = '';

    for (const ev of events) {
      if (!ev.type) {
        errors.push('Malformed event: missing type');
        continue;
      }
      stateAccumulator += `${ev.type}:${JSON.stringify(ev.payload)}|`;
    }

    const stateSnapshotHash = sha256(stateAccumulator || 'empty_state');
    return {
      processedCount: events.length - errors.length,
      errors,
      stateSnapshotHash
    };
  }

  // Chapter 191: Event-Sourced Audit Store (Cryptographic Hash Chains)
  public appendAuditEvent(eventType: string, payload: Record<string, unknown>): {
    eventId: string;
    prevHash: string;
    currentHash: string;
  } {
    const lastRow = dbService.get<{ current_hash: string }>(
      'SELECT current_hash FROM audit_events_chain ORDER BY created_at DESC LIMIT 1'
    );
    const prevHash = lastRow?.current_hash || '0'.repeat(64);
    const eventId = `audit_${cryptoRandomUUID().substring(0, 8)}`;
    const payloadJson = JSON.stringify(payload);
    const currentHash = sha256(`${prevHash}:${eventType}:${payloadJson}`);

    dbService.run(
      `INSERT INTO audit_events_chain (id, event_type, payload_json, prev_hash, current_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      eventId,
      eventType,
      payloadJson,
      prevHash,
      currentHash,
      Date.now()
    );

    return { eventId, prevHash, currentHash };
  }

  // Chapter 193: Pilot Server Program
  public evaluatePilotRollout(params: {
    guildId: string;
    hasTelemetryConsent: boolean;
    killSwitchEngaged: boolean;
  }): { isFeatureEnabled: boolean; reason: string } {
    if (params.killSwitchEngaged) {
      return { isFeatureEnabled: false, reason: 'Kill switch engaged by platform operations' };
    }
    if (!params.hasTelemetryConsent) {
      return { isFeatureEnabled: false, reason: 'Requires explicit telemetry consent for pilot ring' };
    }
    return { isFeatureEnabled: true, reason: 'Enrolled in pilot ring' };
  }

  // Chapter 194: Bug Report to Test Case Generator
  public generateTestSkeleton(report: {
    title: string;
    expectedBehavior: string;
    actualBehavior: string;
    reproductionSteps: string[];
  }): string {
    return [
      `// Automated Test Skeleton for: ${report.title}`,
      `import { describe, it, expect } from 'vitest';`,
      ``,
      `describe('Bug Reproduction: ${report.title.replace(/'/g, "\\'")}', () => {`,
      `  it('satisfies expected invariant', async () => {`,
      ...report.reproductionSteps.map((step) => `    // Step: ${step}`),
      `    const actual = '${report.actualBehavior.replace(/'/g, "\\'")}';`,
      `    const expected = '${report.expectedBehavior.replace(/'/g, "\\'")}';`,
      `    expect(actual).toBe(expected);`,
      `  });`,
      `});`
    ].join('\n');
  }
}

export const operabilityRolloutEngine = new OperabilityRolloutEngine();
