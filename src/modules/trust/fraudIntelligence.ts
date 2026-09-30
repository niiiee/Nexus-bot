import crypto from 'node:crypto';
import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface CollusionFlagRecord {
  id: string;
  tenant_id: string;
  ring_type: 'circular_vouch' | 'review_ring' | 'bidding_syndicate';
  user_ids_json: string;
  confidence_score: number;
  evidence_json: string;
  status: 'pending_review' | 'confirmed' | 'dismissed';
  created_at: number;
}

export interface IdentityVerificationRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  provider: 'stripe_identity' | 'sumsub' | 'persona_mock';
  verification_id: string;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  verified_at: number | null;
  expires_at: number | null;
  created_at: number;
}

export interface ScamReportRecord {
  id: string;
  tenant_id: string;
  reporter_id: string;
  scammer_identifier: string;
  platform: string;
  pattern_description: string;
  evidence_hash: string;
  status: 'confirmed' | 'investigating' | 'dismissed';
  is_globally_shared: number;
  created_at: number;
}

export interface VouchEdge {
  fromUserId: string;
  toUserId: string;
  rating: number;
  dealId?: string;
  timestamp: number;
}

export interface AnomalyReport {
  userId: string;
  anomalyScore: number;
  isFlagged: boolean;
  reasons: string[];
}

export class FraudIntelligenceCenter {
  private globalBlocklistHashes = new Set<string>();

  constructor() {
    this.reloadGlobalBlocklist();
  }

  public reloadGlobalBlocklist(): void {
    const reports = dbService.all<ScamReportRecord>(
      `SELECT evidence_hash, scammer_identifier FROM scam_reports WHERE is_globally_shared = 1 AND status = 'confirmed'`
    );
    this.globalBlocklistHashes.clear();
    for (const r of reports) {
      this.globalBlocklistHashes.add(this.hashIdentifier(r.scammer_identifier));
    }
  }

  public hashIdentifier(identifier: string): string {
    return crypto.createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
  }

  /**
   * REQ-23.29.1: Graph-based collusion detection (circular vouches and review rings)
   */
  public detectCollusionRings(
    tenantId: string,
    vouches: VouchEdge[]
  ): CollusionFlagRecord[] {
    const flaggedRecords: CollusionFlagRecord[] = [];
    const adj = new Map<string, Set<string>>();

    for (const v of vouches) {
      if (!adj.has(v.fromUserId)) {
        adj.set(v.fromUserId, new Set());
      }
      adj.get(v.fromUserId)!.add(v.toUserId);
    }

    // 1. Detect 2-cycles (A -> B and B -> A reciprocal vouching)
    const detectedPairs = new Set<string>();
    for (const [userA, targets] of adj.entries()) {
      for (const userB of targets) {
        if (userA === userB) continue;
        const key = [userA, userB].sort().join(':');
        if (detectedPairs.has(key)) continue;

        if (adj.has(userB) && adj.get(userB)!.has(userA)) {
          detectedPairs.add(key);

          // Found reciprocal 2-node cycle
          const id = cryptoRandomUUID();
          const now = Date.now();
          const userIds = [userA, userB];
          const evidence = {
            cycleType: '2-node-reciprocal-vouch',
            userA,
            userB,
            timestamp: now
          };

          const record: CollusionFlagRecord = {
            id,
            tenant_id: tenantId,
            ring_type: 'circular_vouch',
            user_ids_json: JSON.stringify(userIds),
            confidence_score: 0.88,
            evidence_json: JSON.stringify(evidence),
            status: 'pending_review',
            created_at: now
          };

          dbService.run(
            `INSERT INTO collusion_flags (
               id, tenant_id, ring_type, user_ids_json, confidence_score,
               evidence_json, status, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            record.id,
            record.tenant_id,
            record.ring_type,
            record.user_ids_json,
            record.confidence_score,
            record.evidence_json,
            record.status,
            record.created_at
          );

          flaggedRecords.push(record);
        }
      }
    }

    // 2. Detect 3-cycles (A -> B -> C -> A review rings)
    for (const [userA, targetsB] of adj.entries()) {
      for (const userB of targetsB) {
        if (userB === userA) continue;
        const targetsC = adj.get(userB) || new Set();
        for (const userC of targetsC) {
          if (userC === userA || userC === userB) continue;
          if (adj.get(userC)?.has(userA)) {
            const cycleKey = [userA, userB, userC].sort().join(':');
            if (detectedPairs.has(cycleKey)) continue;
            detectedPairs.add(cycleKey);

            const id = cryptoRandomUUID();
            const now = Date.now();
            const userIds = [userA, userB, userC];
            const evidence = {
              cycleType: '3-node-ring',
              chain: [userA, userB, userC, userA],
              timestamp: now
            };

            const record: CollusionFlagRecord = {
              id,
              tenant_id: tenantId,
              ring_type: 'review_ring',
              user_ids_json: JSON.stringify(userIds),
              confidence_score: 0.94,
              evidence_json: JSON.stringify(evidence),
              status: 'pending_review',
              created_at: now
            };

            dbService.run(
              `INSERT INTO collusion_flags (
                 id, tenant_id, ring_type, user_ids_json, confidence_score,
                 evidence_json, status, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              record.id,
              record.tenant_id,
              record.ring_type,
              record.user_ids_json,
              record.confidence_score,
              record.evidence_json,
              record.status,
              record.created_at
            );

            flaggedRecords.push(record);
          }
        }
      }
    }

    return flaggedRecords;
  }

  /**
   * REQ-23.29.2: Behavioral anomaly scoring
   */
  public evaluateBehavioralAnomaly(
    userId: string,
    recentEvents: Array<{ type: string; content?: string; timestamp: number }>
  ): AnomalyReport {
    let score = 0;
    const reasons: string[] = [];

    // 1. Velocity check: rapid succession of actions (> 10 events in 30 seconds)
    const now = Date.now();
    const last30s = recentEvents.filter(e => now - e.timestamp < 30000);
    if (last30s.length > 10) {
      score += 0.45;
      reasons.push(`High event frequency: ${last30s.length} events in 30 seconds`);
    }

    // 2. Coordinated / copy-paste bid similarity
    const bidContents = recentEvents.filter(e => e.type === 'bid_placed' && e.content).map(e => e.content!);
    if (bidContents.length >= 3) {
      let identicalPairs = 0;
      for (let i = 0; i < bidContents.length; i++) {
        for (let j = i + 1; j < bidContents.length; j++) {
          if (bidContents[i] === bidContents[j] || bidContents[i].trim().toLowerCase() === bidContents[j].trim().toLowerCase()) {
            identicalPairs++;
          }
        }
      }
      if (identicalPairs >= 2) {
        score += 0.40;
        reasons.push('Coordinated or automated copy-paste proposals detected');
      }
    }

    score = Math.min(1.0, score);
    return {
      userId,
      anomalyScore: Number(score.toFixed(2)),
      isFlagged: score >= 0.75,
      reasons
    };
  }

  /**
   * REQ-23.29.3: Third-party identity proofing integration
   */
  public startIdentityVerification(
    tenantId: string,
    userId: string,
    provider: 'stripe_identity' | 'sumsub' | 'persona_mock' = 'stripe_identity'
  ): { verificationId: string; verificationUrl: string } {
    const id = cryptoRandomUUID();
    const verificationId = `idv_${provider}_${crypto.randomBytes(8).toString('hex')}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO identity_verifications (
         id, tenant_id, user_id, provider, verification_id, status,
         verified_at, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, ?)`,
      id,
      tenantId,
      userId,
      provider,
      verificationId,
      now
    );

    return {
      verificationId,
      verificationUrl: `https://verify.nexus.platform/session/${verificationId}`
    };
  }

  public completeIdentityVerification(
    verificationId: string,
    success: boolean
  ): boolean {
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    if (success) {
      dbService.run(
        `UPDATE identity_verifications
         SET status = 'verified', verified_at = ?, expires_at = ?
         WHERE verification_id = ?`,
        now,
        now + oneYearMs,
        verificationId
      );
      return true;
    } else {
      dbService.run(
        `UPDATE identity_verifications SET status = 'rejected' WHERE verification_id = ?`,
        verificationId
      );
      return false;
    }
  }

  public hasVerifiedBadge(tenantId: string, userId: string): boolean {
    const record = dbService.get<IdentityVerificationRecord>(
      `SELECT * FROM identity_verifications 
       WHERE tenant_id = ? AND user_id = ? AND status = 'verified' AND expires_at > ?`,
      tenantId,
      userId,
      Date.now()
    );
    return !!record;
  }

  /**
   * REQ-23.29.4: Community scam intelligence knowledge base
   */
  public reportScam(
    tenantId: string,
    reporterId: string,
    scammerIdentifier: string,
    platform: string,
    patternDescription: string,
    evidenceText: string,
    shareGlobally = true
  ): ScamReportRecord {
    const id = cryptoRandomUUID();
    const evidenceHash = crypto.createHash('sha256').update(evidenceText).digest('hex');
    const now = Date.now();

    const record: ScamReportRecord = {
      id,
      tenant_id: tenantId,
      reporter_id: reporterId,
      scammer_identifier: scammerIdentifier,
      platform,
      pattern_description: patternDescription,
      evidence_hash: evidenceHash,
      status: 'confirmed',
      is_globally_shared: shareGlobally ? 1 : 0,
      created_at: now
    };

    dbService.run(
      `INSERT INTO scam_reports (
         id, tenant_id, reporter_id, scammer_identifier, platform,
         pattern_description, evidence_hash, status, is_globally_shared, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.tenant_id,
      record.reporter_id,
      record.scammer_identifier,
      record.platform,
      record.pattern_description,
      record.evidence_hash,
      record.status,
      record.is_globally_shared,
      record.created_at
    );

    if (shareGlobally) {
      this.globalBlocklistHashes.add(this.hashIdentifier(scammerIdentifier));
    }

    return record;
  }

  /**
   * REQ-23.29.4: Scan text for known scam vectors
   */
  public scanTextForScams(text: string): { riskDetected: boolean; matchedScams: string[]; recommendation: string } {
    const lower = text.toLowerCase();
    const matches: string[] = [];

    if (
      (lower.includes('telegram') || lower.includes('whatsapp')) &&
      (lower.includes('payment') || lower.includes('dm me') || lower.includes('pay') || lower.includes('outside'))
    ) {
      matches.push('Off-platform payment steering (disintermediates escrow protection)');
    }

    if (lower.includes('fake-escrow') || lower.includes('escrow-release-funds.com') || lower.includes('gift card')) {
      matches.push('Phishing / fraudulent escrow service redirection');
    }

    if (lower.includes('refund fee') || lower.includes('deposit first to receive payment')) {
      matches.push('Advance-fee fraud / fake client deposit scheme');
    }

    return {
      riskDetected: matches.length > 0,
      matchedScams: matches,
      recommendation: matches.length > 0
        ? 'Warning: Never transact off-platform or pay advance deposit fees. Escrow is strictly non-custodial and verified in-channel.'
        : 'Text appears safe.'
    };
  }

  /**
   * REQ-23.29.5: Automated cross-tenant threat sharing & privacy-preserving blocklist check
   */
  public checkGlobalBlocklist(identifier: string): { blocked: boolean; hash: string } {
    const hash = this.hashIdentifier(identifier);
    const blocked = this.globalBlocklistHashes.has(hash);
    return { blocked, hash };
  }
}

export const fraudIntelligence = new FraudIntelligenceCenter();
