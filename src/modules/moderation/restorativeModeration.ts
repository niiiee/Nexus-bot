import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface ModerationIncidentRecord {
  id: string;
  tenant_id: string;
  target_id: string;
  actor_id: string;
  incident_type: 'toxic_language' | 'unsolicited_dm' | 'off_platform_steering' | 'spam_flood';
  context_snippet: string;
  explanation: string;
  action_taken: string;
  is_appealed: number;
  appeal_status: 'pending' | 'granted' | 'denied' | null;
  created_at: number;
}

export interface RestorativePath {
  requiredAction: 'read_guidelines' | 'ethics_quiz' | 'public_apology' | 'cooldown_period';
  instructions: string;
  quizQuestion?: {
    question: string;
    options: string[];
    correctIndex: number;
  };
}

export interface AppealSubmissionResult {
  incidentId: string;
  appealStatus: 'pending' | 'granted' | 'denied';
  staffReviewSummary: string;
}

export class RestorativeModerationEngine {
  /**
   * REQ-23.18.1 & REQ-23.18.2: Create moderation incident with AI contextual explanation and restorative task
   */
  public logIncident(
    tenantId: string,
    targetUserId: string,
    actorId: string,
    incidentType: ModerationIncidentRecord['incident_type'],
    contextSnippet: string
  ): { incident: ModerationIncidentRecord; restorativePath: RestorativePath } {
    const id = cryptoRandomUUID();
    const now = Date.now();

    const explanation = this.generateContextualExplanation(incidentType, contextSnippet);
    const restorativePath = this.getRestorativePath(incidentType);
    const actionTaken = `Restorative Notice Issued (${restorativePath.requiredAction})`;

    const record: ModerationIncidentRecord = {
      id,
      tenant_id: tenantId,
      target_id: targetUserId,
      actor_id: actorId,
      incident_type: incidentType,
      context_snippet: contextSnippet,
      explanation,
      action_taken: actionTaken,
      is_appealed: 0,
      appeal_status: null,
      created_at: now
    };

    dbService.run(
      `INSERT INTO moderation_incidents_v2 (
         id, tenant_id, target_id, actor_id, incident_type, context_snippet,
         explanation, action_taken, is_appealed, appeal_status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
      record.id,
      record.tenant_id,
      record.target_id,
      record.actor_id,
      record.incident_type,
      record.context_snippet,
      record.explanation,
      record.action_taken,
      record.created_at
    );

    return { incident: record, restorativePath };
  }

  /**
   * REQ-23.18.1: Friendly, human-centric educational explanation
   */
  public generateContextualExplanation(
    type: ModerationIncidentRecord['incident_type'],
    snippet: string
  ): string {
    switch (type) {
      case 'toxic_language':
        return `Your message ("${snippet.substring(0, 50)}...") contained hostile phrasing. Nexus is a respectful learning and work environment where constructive critique is welcome, but personal attacks are prohibited.`;
      case 'off_platform_steering':
        return `Your message requested transacting off-platform. To protect freelancers and clients from non-payment and chargeback scams, all verified deals must be tracked via Nexus Escrow milestones.`;
      case 'unsolicited_dm':
        return `Direct-messaging community members without their prior consent violates our anti-harassment policy. Please keep professional inquiries in public channels or designated job threads.`;
      case 'spam_flood':
      default:
        return `Repetitive messaging or flooding disrupts conversation channels. Please pace your messages and use threads for detailed discussions.`;
    }
  }

  /**
   * REQ-23.18.2: Assign constructive restorative educational path
   */
  public getRestorativePath(type: ModerationIncidentRecord['incident_type']): RestorativePath {
    switch (type) {
      case 'off_platform_steering':
        return {
          requiredAction: 'ethics_quiz',
          instructions: 'Complete our quick 1-question safety check on escrow protection to restore full posting permissions.',
          quizQuestion: {
            question: 'Why does Nexus require deals to be tracked in-server with verified milestones?',
            options: [
              'To take a 30% cut from your work',
              'To provide impartial dispute resolution and protect both parties from chargebacks',
              'Because off-platform work is illegal',
              'To restrict member freedom'
            ],
            correctIndex: 1
          }
        };
      case 'toxic_language':
        return {
          requiredAction: 'read_guidelines',
          instructions: 'Review our Code of Conduct on Constructive Feedback and acknowledge adherence.'
        };
      case 'unsolicited_dm':
      case 'spam_flood':
      default:
        return {
          requiredAction: 'cooldown_period',
          instructions: 'Take a 10-minute cooldown pause to reflect before rejoining public discussions.'
        };
    }
  }

  /**
   * REQ-23.18.3: Submit appeal and evaluate restorative quiz answer
   */
  public submitAppeal(
    incidentId: string,
    appealStatement: string,
    quizAnswerIndex?: number
  ): AppealSubmissionResult {
    const incident = dbService.get<ModerationIncidentRecord>(
      `SELECT * FROM moderation_incidents_v2 WHERE id = ?`,
      incidentId
    );

    if (!incident) throw new Error('Incident not found');

    const path = this.getRestorativePath(incident.incident_type);
    let granted = false;

    if (path.requiredAction === 'ethics_quiz' && path.quizQuestion) {
      if (quizAnswerIndex === path.quizQuestion.correctIndex) {
        granted = true;
      }
    } else if (appealStatement.trim().length >= 20) {
      granted = true; // Sincere restorative acknowledgment accepted
    }

    const appealStatus: 'granted' | 'denied' = granted ? 'granted' : 'denied';

    dbService.run(
      `UPDATE moderation_incidents_v2
       SET is_appealed = 1, appeal_status = ?
       WHERE id = ?`,
      appealStatus,
      incidentId
    );

    const summary = granted
      ? `Appeal automatically approved: Restorative requirements met by member <@${incident.target_id}>.`
      : `Appeal denied: Member did not satisfy restorative requirements. Sent to human staff for secondary review.`;

    return {
      incidentId,
      appealStatus,
      staffReviewSummary: summary
    };
  }

  /**
   * REQ-23.18.4: Compile staff escalation evidence pack
   */
  public generateStaffEvidencePack(incidentId: string): Record<string, any> {
    const incident = dbService.get<ModerationIncidentRecord>(
      `SELECT * FROM moderation_incidents_v2 WHERE id = ?`,
      incidentId
    );
    if (!incident) throw new Error('Incident not found');

    return {
      incidentId: incident.id,
      tenantId: incident.tenant_id,
      targetUserId: incident.target_id,
      incidentType: incident.incident_type,
      contextSnippet: incident.context_snippet,
      policyExplanation: incident.explanation,
      isAppealed: incident.is_appealed === 1,
      appealStatus: incident.appeal_status,
      timestamp: incident.created_at,
      recommendedStaffAction: incident.appeal_status === 'granted' ? 'Reinstate with Clean Slate' : 'Uphold 24h Mute'
    };
  }
}

export const restorativeModeration = new RestorativeModerationEngine();
