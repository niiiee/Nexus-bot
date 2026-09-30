import { v4 as uuidv4 } from 'uuid';
import { guildRepo } from '../../database/repositories/guildRepo.js';
import { auditRepo } from '../../database/repositories/auditRepo.js';
import { AuthenticityReport } from '../../ai/evaluators/authenticityAnalyzer.js';
import { ExplainabilityCard } from '../../ai/explainability/explainabilityCard.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('EscalationService');

export interface EscalationCase {
  caseId: string;
  guildId: string;
  userId: string;
  username: string;
  field: string;
  claimedYears: number;
  suspicionScore: number;
  report: AuthenticityReport;
  status: 'pending' | 'approved' | 'rejected' | 'test_requested';
  createdAt: number;
}

export class EscalationService {
  private activeCases: Map<string, EscalationCase> = new Map();

  public createCase(params: {
    guildId: string;
    userId: string;
    username: string;
    field: string;
    claimedYears: number;
    report: AuthenticityReport;
  }): EscalationCase {
    const caseId = `case_${uuidv4().slice(0, 8)}`;
    const now = Date.now();

    const escalationCase: EscalationCase = {
      caseId,
      guildId: params.guildId,
      userId: params.userId,
      username: params.username,
      field: params.field,
      claimedYears: params.claimedYears,
      suspicionScore: params.report.suspicionScore,
      report: params.report,
      status: 'pending',
      createdAt: now,
    };

    this.activeCases.set(caseId, escalationCase);

    // Record in immutable audit log
    auditRepo.log({
      guild_id: params.guildId,
      action_type: 'vetting_suspicion_escalation',
      actor_id: 'ai_brain',
      target_id: params.userId,
      details: {
        caseId,
        username: params.username,
        suspicionScore: params.report.suspicionScore,
        signals: params.report.signals,
      },
      reasoning: `Suspicion score of ${(params.report.suspicionScore * 100).toFixed(1)}% exceeded escalation threshold. Silently routed to staff.`,
      reversible: true,
    });

    logger.info(`Silent escalation case ${caseId} created for user ${params.userId}`);
    return escalationCase;
  }

  public getCase(caseId: string): EscalationCase | undefined {
    return this.activeCases.get(caseId);
  }

  public renderStaffEmbedPayload(escCase: EscalationCase): {
    title: string;
    description: string;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    color: number;
  } {
    const whyCard = ExplainabilityCard.renderCard({
      decisionType: 'vetting_suspicion',
      targetUserId: escCase.userId,
      verdict: 'Needs Human Review',
      confidenceScore: escCase.report.confidence,
      signalsDetected: escCase.report.signals,
      evidenceExcerpts: escCase.report.evidenceExcerpts,
      reasoning: escCase.report.reasoning,
      suggestedStaffAction: 'Review candidate answers or request a live skill test.',
    });

    return {
      title: `🚨 [Staff Review] Candidate Vetting Suspicion Alert (${escCase.caseId})`,
      description: `A member completed the intake interview with a high suspicion score. Please review the dossier below and take action.\n\n${whyCard}`,
      fields: [
        { name: 'Member', value: `<@${escCase.userId}> (${escCase.username})`, inline: true },
        { name: 'Field / Experience', value: `${escCase.field} (${escCase.claimedYears} years)`, inline: true },
        { name: 'Suspicion Score', value: `**${(escCase.suspicionScore * 100).toFixed(1)}%**`, inline: true },
      ],
      color: 0xffa500, // Amber warning
    };
  }

  public resolveCase(caseId: string, reviewerId: string, resolution: 'approved' | 'rejected' | 'test_requested'): EscalationCase {
    const escCase = this.activeCases.get(caseId);
    if (!escCase) throw new Error(`Escalation case ${caseId} not found`);

    escCase.status = resolution;

    auditRepo.log({
      guild_id: escCase.guildId,
      action_type: `escalation_resolved_${resolution}`,
      actor_id: reviewerId,
      target_id: escCase.userId,
      details: { caseId, resolution },
      reasoning: `Human staff member resolved case as ${resolution}.`,
      reversible: true,
    });

    return escCase;
  }
}

export const escalationService = new EscalationService();
