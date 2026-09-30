import { aiOrchestrator } from '../orchestrator.js';
import { plagiarismDetector, PlagiarismReport } from './plagiarismDetector.js';
import { memberRepo } from '../../database/repositories/memberRepo.js';
import { dbService } from '../../database/connection.js';
import { auditRepo } from '../../database/repositories/auditRepo.js';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('WorkEvaluator');

export interface WorkEvaluationResult {
  submissionId: string;
  assignedRole: string;
  qualityScore: number; // 0-100
  plagiarism: PlagiarismReport;
  feedback: string;
  status: 'approved' | 'flagged' | 'rejected';
}

export class WorkEvaluator {
  public async evaluateFirstWork(params: {
    userId: string;
    guildId: string;
    field: string;
    claimedYears: number;
    urlOrAsset: string;
    description: string;
    codeSnippet?: string;
  }): Promise<WorkEvaluationResult> {
    const submissionId = uuidv4();
    const now = Date.now();

    // 1. Plagiarism & asset authenticity check
    const plagiarismReport = await plagiarismDetector.evaluateSubmission({
      urlOrAsset: params.urlOrAsset,
      description: params.description,
      codeSnippet: params.codeSnippet,
    });

    // 2. Multi-factor AI quality & seniority assessment
    const systemPrompt = `
You are Senior Progg evaluating a new member's first-work submission to assign their official community seniority role.
Field: ${params.field}
Claimed Years: ${params.claimedYears}
Project URL/Asset: ${params.urlOrAsset}
Project Description: ${params.description}
Plagiarism Flagged: ${plagiarismReport.isFlagged}

Role tiers per field:
- Junior (0-2 years, basic functionality, needs guidance)
- Mid (2-4 years, solid architecture, clean error handling, independent execution)
- Senior (4-7 years, high performance, robust system design, tests, scalability)
- Specialist (7+ years or deep niche expertise, e.g. compiler design, distributed systems, high-tier visual direction)

Output JSON:
{
  "qualityScore": number between 0 and 100,
  "assignedSeniority": "Junior" | "Mid" | "Senior" | "Specialist",
  "feedback": "Constructive, mentor-level feedback highlighting strengths and architecture improvements",
  "status": "approved" | "flagged" | "rejected"
}
`.trim();

    let assignedRole = `${params.field === 'design' ? 'Junior Designer' : 'Junior Developer'}`;
    let qualityScore = 75;
    let feedback = 'Solid initial submission. You have demonstrated clean foundational architecture.';
    let status: 'approved' | 'flagged' | 'rejected' = plagiarismReport.isFlagged ? 'flagged' : 'approved';

    try {
      const response = await aiOrchestrator.generateJSON<{
        qualityScore: number;
        assignedSeniority: 'Junior' | 'Mid' | 'Senior' | 'Specialist';
        feedback: string;
        status: 'approved' | 'flagged' | 'rejected';
      }>([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Evaluate submission for seniority role assignment.' },
      ]);

      if (response && response.assignedSeniority) {
        qualityScore = response.qualityScore || 75;
        const rolePrefix = response.assignedSeniority;
        assignedRole = `${rolePrefix} ${params.field === 'design' ? 'Designer' : 'Developer'}`;
        feedback = response.feedback;
        if (!plagiarismReport.isFlagged) {
          status = response.status || 'approved';
        }
      }
    } catch (err) {
      logger.error('Failed AI first-work evaluation', err);
    }

    // Persist in work_submissions table
    dbService.run(
      `INSERT INTO work_submissions (
        id, user_id, guild_id, url_or_asset, description, ai_evaluation_json,
        plagiarism_score, assigned_role, status, telegram_synced, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      submissionId,
      params.userId,
      params.guildId,
      params.urlOrAsset,
      params.description,
      JSON.stringify({ qualityScore, feedback }),
      plagiarismReport.plagiarismScore,
      assignedRole,
      status,
      now
    );

    // If approved, update member seniority level in database
    if (status === 'approved') {
      const seniorityLevel = assignedRole.split(' ')[0] || 'Junior';
      memberRepo.update(params.userId, {
        seniority_level: seniorityLevel,
        lifecycle_stage: 'Active',
      });
      memberRepo.adjustCredits(params.userId, 100); // 100 credits first-work reward
      memberRepo.adjustReputation(params.userId, 20); // +20 reputation
    }

    auditRepo.log({
      guild_id: params.guildId,
      action_type: 'first_work_evaluated',
      actor_id: 'ai_brain',
      target_id: params.userId,
      details: {
        submissionId,
        assignedRole,
        qualityScore,
        plagiarismScore: plagiarismReport.plagiarismScore,
        status,
      },
      reasoning: `Evaluated work submission: assigned ${assignedRole} with score ${qualityScore}. Status: ${status}.`,
      reversible: true,
    });

    return {
      submissionId,
      assignedRole,
      qualityScore,
      plagiarism: plagiarismReport,
      feedback,
      status,
    };
  }
}

export const workEvaluator = new WorkEvaluator();
