export type StrideCategory =
  | 'Spoofing'
  | 'Tampering'
  | 'Repudiation'
  | 'Information_Disclosure'
  | 'Denial_of_Service'
  | 'Elevation_of_Privilege';

export interface ThreatItem {
  id: string;
  moduleId: string;
  category: StrideCategory;
  description: string;
  mitigation: string;
  testCaseRef: string;
  dreadScore: {
    damage: number; // 1-10
    reproducibility: number; // 1-10
    exploitability: number; // 1-10
    affectedUsers: number; // 1-10
    discoverability: number; // 1-10
    total: number;
  };
  status: 'mitigated' | 'open' | 'accepted_risk';
}

export interface ModuleThreatModel {
  moduleId: string;
  moduleName: string;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  threats: ThreatItem[];
}

export class ThreatModelManager {
  private threatRegistry: Map<string, ThreatItem[]> = new Map();

  constructor() {
    this.seedStandardThreatModels();
  }

  private seedStandardThreatModels(): void {
    // Deal & Escrow Module (Chapter 2)
    this.addThreat({
      id: 'THR-ESC-01',
      moduleId: 'escrow',
      category: 'Tampering',
      description: 'Malicious participant attempts to alter deal amount or agreement text after confirmation.',
      mitigation: 'Cryptographic SHA-256 agreement hash locked in database on dual confirmation.',
      testCaseRef: 'tests/unit/dealRoom.test.ts#verifyHashParity',
      dreadScore: this.calculateDread(9, 8, 4, 6, 5),
      status: 'mitigated'
    });

    this.addThreat({
      id: 'THR-ESC-02',
      moduleId: 'escrow',
      category: 'Elevation_of_Privilege',
      description: 'Single rogue moderator attempts unilateral release of disputed funds.',
      mitigation: 'Dual-approval multi-sig requirement in database schema for any dispute fund reallocation.',
      testCaseRef: 'tests/unit/escrowDispute.test.ts#requireDualApproval',
      dreadScore: this.calculateDread(10, 7, 5, 5, 4),
      status: 'mitigated'
    });

    // Rules & Moderation Module (Section 26.3)
    this.addThreat({
      id: 'THR-MOD-01',
      moduleId: 'rules_engine',
      category: 'Elevation_of_Privilege',
      description: 'Automated bot script executes permanent ban without human oversight.',
      mitigation: 'Hardcoded mode ceiling in rulesEngine.ts preventing automated bans or timeouts > 1 hour.',
      testCaseRef: 'tests/unit/rules_engine.test.ts#neverAutoBans',
      dreadScore: this.calculateDread(8, 8, 3, 7, 6),
      status: 'mitigated'
    });

    this.addThreat({
      id: 'THR-MOD-02',
      moduleId: 'rules_engine',
      category: 'Repudiation',
      description: 'Member or moderator denies taking a disciplinary action or filing an appeal.',
      mitigation: 'Append-only ledger in moderation_cases_v2 and moderation_appeals_v2 with timestamps.',
      testCaseRef: 'tests/unit/rules_engine.test.ts#auditLogPersistence',
      dreadScore: this.calculateDread(6, 6, 6, 5, 7),
      status: 'mitigated'
    });

    // Worker Sandbox (Chapter 29)
    this.addThreat({
      id: 'THR-SBX-01',
      moduleId: 'worker_sandbox',
      category: 'Denial_of_Service',
      description: 'Untrusted user code executes infinite loop or memory fork bomb.',
      mitigation: 'Isolated worker process with CPU timeout (5000ms) and memory cap (128MB).',
      testCaseRef: 'tests/unit/sandbox.test.ts#timesOutInfiniteLoops',
      dreadScore: this.calculateDread(7, 9, 8, 8, 8),
      status: 'mitigated'
    });
  }

  public addThreat(threat: ThreatItem): void {
    const list = this.threatRegistry.get(threat.moduleId) || [];
    list.push(threat);
    this.threatRegistry.set(threat.moduleId, list);
  }

  public getModelForModule(moduleId: string, moduleName = moduleId): ModuleThreatModel {
    const threats = this.threatRegistry.get(moduleId) || [];
    const avgScore = threats.length > 0 ? threats.reduce((sum, t) => sum + t.dreadScore.total, 0) / threats.length : 0;
    const overallRiskLevel = avgScore > 35 ? 'HIGH' : avgScore > 20 ? 'MEDIUM' : 'LOW';

    return {
      moduleId,
      moduleName,
      overallRiskLevel,
      threats
    };
  }

  public calculateDread(d: number, r: number, e: number, a: number, disc: number) {
    return {
      damage: d,
      reproducibility: r,
      exploitability: e,
      affectedUsers: a,
      discoverability: disc,
      total: d + r + e + a + disc
    };
  }
}

export const threatModelManager = new ThreatModelManager();
