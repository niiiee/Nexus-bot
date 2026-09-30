import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface FreelancerCandidate {
  userId: string;
  field: string;
  tools: string[];
  seniority: 'Junior' | 'Mid' | 'Senior';
  dealCount: number;
}

export interface MatchRecommendation {
  id: string;
  jobId: string;
  candidateId: string;
  matchScore: number;
  reasonCodes: string[];
  isNewcomerQuota: boolean;
}

export class ExplainableJobMatchingEngine {
  /**
   * REQ-26.226: Match freelancers to job with transparent reason codes and newcomer quota
   */
  public matchJob(params: {
    jobId: string;
    requiredField: string;
    requiredTools: string[];
    candidates: FreelancerCandidate[];
  }): MatchRecommendation[] {
    const { jobId, requiredField, requiredTools, candidates } = params;
    const recommendations: MatchRecommendation[] = [];

    let newcomerCount = 0;

    for (const c of candidates) {
      const reasons: string[] = [];
      let score = 50;

      // 1. Field alignment
      if (c.field.toLowerCase() === requiredField.toLowerCase()) {
        score += 25;
        reasons.push('FIELD_ALIGNMENT: Candidate primary field directly matches job domain.');
      }

      // 2. Tools overlap
      const sharedTools = c.tools.filter((t) => requiredTools.includes(t));
      if (sharedTools.length > 0) {
        score += Math.min(20, sharedTools.length * 10);
        reasons.push(`TOOL_COMPATIBILITY: Overlapping verified tech stack (${sharedTools.join(', ')}).`);
      }

      // 3. Newcomer exploration quota (Newcomers with 0 deals get guaranteed consideration)
      let isNewcomerQuota = false;
      if (c.dealCount === 0 && newcomerCount < 2) {
        score += 15;
        isNewcomerQuota = true;
        newcomerCount++;
        reasons.push('NEWCOMER_EXPLORATION_QUOTA: Charter fair-chance allocation for unverified newcomer.');
      }

      const recId = `match_${cryptoRandomUUID().substring(0, 8)}`;
      const finalScore = Math.min(100, score);

      dbService.run(
        `INSERT INTO job_matching_recommendations (
           id, job_id, user_id, match_score, reason_codes_json, is_newcomer_quota, matched_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        recId,
        jobId,
        c.userId,
        finalScore,
        JSON.stringify(reasons),
        isNewcomerQuota ? 1 : 0,
        Date.now()
      );

      recommendations.push({
        id: recId,
        jobId,
        candidateId: c.userId,
        matchScore: finalScore,
        reasonCodes: reasons,
        isNewcomerQuota
      });
    }

    return recommendations.sort((a, b) => b.matchScore - a.matchScore);
  }
}

export const explainableJobMatchingEngine = new ExplainableJobMatchingEngine();
