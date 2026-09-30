import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export type AvailabilityStatus = 'available' | 'busy' | 'away' | 'contract_only';

export interface TalentNodeRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  skills_json: string;
  verified_deals_count: number;
  rating_score: number;
  availability_status: AvailabilityStatus;
  hourly_rate_estimate: number | null;
  timezone: string;
  languages_json: string;
  updated_at: number;
}

export interface TalentMatchResult {
  node: TalentNodeRecord;
  matchScore: number;
  matchingSkills: string[];
  missingSkills: string[];
}

export interface UpsertTalentNodeOptions {
  skills: string[];
  availabilityStatus?: AvailabilityStatus;
  hourlyRateEstimate?: number;
  timezone?: string;
  languages?: string[];
}

export class TalentGraph {
  /**
   * REQ-23.10.1: Upsert talent node in community graph
   */
  public upsertTalentNode(
    tenantId: string,
    userId: string,
    options: UpsertTalentNodeOptions
  ): TalentNodeRecord {
    const existing = dbService.get<TalentNodeRecord>(
      `SELECT * FROM talent_nodes WHERE tenant_id = ? AND user_id = ?`,
      tenantId,
      userId
    );

    const now = Date.now();
    const skillsJson = JSON.stringify(options.skills.map(s => s.toLowerCase().trim()));
    const availability = options.availabilityStatus || existing?.availability_status || 'available';
    const hourlyRate = options.hourlyRateEstimate !== undefined ? options.hourlyRateEstimate : existing?.hourly_rate_estimate || null;
    const timezone = options.timezone || existing?.timezone || 'UTC';
    const languagesJson = JSON.stringify(options.languages || (existing ? JSON.parse(existing.languages_json) : ['en']));

    if (existing) {
      dbService.run(
        `UPDATE talent_nodes
         SET skills_json = ?, availability_status = ?, hourly_rate_estimate = ?,
             timezone = ?, languages_json = ?, updated_at = ?
         WHERE id = ?`,
        skillsJson,
        availability,
        hourlyRate,
        timezone,
        languagesJson,
        now,
        existing.id
      );

      return {
        ...existing,
        skills_json: skillsJson,
        availability_status: availability,
        hourly_rate_estimate: hourlyRate,
        timezone,
        languages_json: languagesJson,
        updated_at: now
      };
    } else {
      const id = cryptoRandomUUID();
      dbService.run(
        `INSERT INTO talent_nodes (
           id, tenant_id, user_id, skills_json, verified_deals_count,
           rating_score, availability_status, hourly_rate_estimate,
           timezone, languages_json, updated_at
         ) VALUES (?, ?, ?, ?, 0, 5.0, ?, ?, ?, ?, ?)`,
        id,
        tenantId,
        userId,
        skillsJson,
        availability,
        hourlyRate,
        timezone,
        languagesJson,
        now
      );

      return {
        id,
        tenant_id: tenantId,
        user_id: userId,
        skills_json: skillsJson,
        verified_deals_count: 0,
        rating_score: 5.0,
        availability_status: availability,
        hourly_rate_estimate: hourlyRate,
        timezone,
        languages_json: languagesJson,
        updated_at: now
      };
    }
  }

  public getTalentNode(tenantId: string, userId: string): TalentNodeRecord | null {
    return dbService.get<TalentNodeRecord>(
      `SELECT * FROM talent_nodes WHERE tenant_id = ? AND user_id = ?`,
      tenantId,
      userId
    ) || null;
  }

  /**
   * REQ-23.10.2: Update availability status
   */
  public setAvailability(tenantId: string, userId: string, status: AvailabilityStatus): void {
    dbService.run(
      `UPDATE talent_nodes SET availability_status = ?, updated_at = ? WHERE tenant_id = ? AND user_id = ?`,
      status,
      Date.now(),
      tenantId,
      userId
    );
  }

  /**
   * Record deal completion and adjust rating score
   */
  public recordCompletedDeal(tenantId: string, userId: string, clientRating: number): void {
    const node = this.getTalentNode(tenantId, userId);
    if (!node) return;

    const newCount = node.verified_deals_count + 1;
    // Weighted moving average
    const newRating = Number(((node.rating_score * node.verified_deals_count + clientRating) / newCount).toFixed(2));

    dbService.run(
      `UPDATE talent_nodes
       SET verified_deals_count = ?, rating_score = ?, updated_at = ?
       WHERE id = ?`,
      newCount,
      newRating,
      Date.now(),
      node.id
    );
  }

  /**
   * REQ-23.10.3: Match candidates by skills, availability, and rating
   */
  public findMatchingTalent(
    tenantId: string,
    criteria: {
      requiredSkills: string[];
      minRating?: number;
      maxHourlyRate?: number;
      onlyAvailable?: boolean;
    }
  ): TalentMatchResult[] {
    const nodes = dbService.all<TalentNodeRecord>(
      `SELECT * FROM talent_nodes WHERE tenant_id = ?`,
      tenantId
    );

    const results: TalentMatchResult[] = [];
    const targetSkills = criteria.requiredSkills.map(s => s.toLowerCase().trim());
    const minRating = criteria.minRating ?? 4.0;

    for (const node of nodes) {
      if (node.rating_score < minRating) continue;
      if (criteria.onlyAvailable && node.availability_status !== 'available') continue;
      if (criteria.maxHourlyRate && node.hourly_rate_estimate && node.hourly_rate_estimate > criteria.maxHourlyRate) {
        continue;
      }

      const nodeSkills: string[] = JSON.parse(node.skills_json);
      const matchingSkills = targetSkills.filter(s => nodeSkills.includes(s));
      const missingSkills = targetSkills.filter(s => !nodeSkills.includes(s));

      if (matchingSkills.length > 0) {
        // Match score: skill overlap percentage (0.6) + rating factor (0.3) + deal experience factor (0.1)
        const skillRatio = matchingSkills.length / targetSkills.length;
        const ratingFactor = node.rating_score / 5.0;
        const expFactor = Math.min(1.0, node.verified_deals_count / 10);

        const score = Number((skillRatio * 0.6 + ratingFactor * 0.3 + expFactor * 0.1).toFixed(2));

        results.push({
          node,
          matchScore: score,
          matchingSkills,
          missingSkills
        });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * REQ-23.10.4: Export portable talent passport JSON
   */
  public exportTalentPassport(tenantId: string, userId: string): Record<string, any> {
    const node = this.getTalentNode(tenantId, userId);
    if (!node) {
      throw new Error(`Talent profile not found for user ${userId}`);
    }

    return {
      version: '1.0',
      type: 'NexusTalentPassport',
      issuerTenant: tenantId,
      userId: node.user_id,
      verifiedDealsCount: node.verified_deals_count,
      reputationScore: node.rating_score,
      skills: JSON.parse(node.skills_json),
      languages: JSON.parse(node.languages_json),
      availabilityStatus: node.availability_status,
      hourlyRateEstimate: node.hourly_rate_estimate,
      exportedAt: Date.now()
    };
  }
}

export const talentGraph = new TalentGraph();
