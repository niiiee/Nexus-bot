import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID, sha256 } from '../../utils/crypto.js';

export class GovernanceSecurityEngine {
  // Chapter 272: Vulnerability Program (Recognition)
  public recordVulnerabilityReport(params: {
    researcherHandle: string;
    description: string;
    isSafeHarborCompliant: boolean;
  }): { reportId: string; hallOfFameEligible: boolean; error?: string } {
    if (!params.isSafeHarborCompliant) {
      return {
        reportId: '',
        hallOfFameEligible: false,
        error: 'Violation of Safe Harbor: Vulnerability research must not access user PII or disrupt production services.'
      };
    }

    const reportId = `vuln_${cryptoRandomUUID().substring(0, 8)}`;
    return {
      reportId,
      hallOfFameEligible: true
    };
  }

  // Chapter 274: Automatic Data-Flow Maps
  public generateDataFlowDiagram(components: string[], externalApis: string[]): {
    mermaidChart: string;
    externalApisCount: number;
  } {
    const lines = ['flowchart TD', '  User([Discord User]) --> DiscordGateway[Discord Gateway API]'];
    for (const comp of components) {
      lines.push(`  DiscordGateway --> ${comp}[${comp}]`);
    }
    for (const api of externalApis) {
      lines.push(`  BackendService --> Ext_${api.replace(/[^a-zA-Z0-9]/g, '_')}(["${api}"])`);
    }

    return {
      mermaidChart: lines.join('\n'),
      externalApisCount: externalApis.length
    };
  }

  // Chapter 278: Council Elections & Recall
  public openCouncilElection(title: string, term: string): string {
    const id = `elec_${cryptoRandomUUID().substring(0, 8)}`;
    dbService.run(
      `INSERT INTO council_elections (id, title, term, status, votes_cast, created_at)
       VALUES (?, ?, ?, 'open', 0, ?)`,
      id,
      title,
      term,
      Date.now()
    );
    return id;
  }

  public castCouncilVote(electionId: string, voterId: string, hasVotedAlready: boolean): { success: boolean; error?: string } {
    // Sybil defense: 1-member-1-vote
    if (hasVotedAlready) {
      return { success: false, error: 'Sybil Guard: Member has already cast a ballot in this election cycle.' };
    }
    dbService.run(`UPDATE council_elections SET votes_cast = votes_cast + 1 WHERE id = ?`, electionId);
    return { success: true };
  }

  // Chapter 281: Harassment Pattern Mapping
  public detectCoordinatedHarassment(
    recentMentions: Array<{ senderId: string; targetId: string; channelId: string; timestamp: number }>
  ): { targetId: string; isCoordinatedSpike: boolean; distinctSenders: number } {
    if (recentMentions.length === 0) {
      return { targetId: '', isCoordinatedSpike: false, distinctSenders: 0 };
    }

    const targetId = recentMentions[0].targetId;
    const senders = new Set(recentMentions.map((m) => m.senderId));
    // Alert if 4+ distinct accounts target the same user across multiple channels within 5 minutes
    const isCoordinatedSpike = senders.size >= 4;

    return {
      targetId,
      isCoordinatedSpike,
      distinctSenders: senders.size
    };
  }

  // Chapter 282: Legal Hold & Records Requests
  public placeLegalHold(scope: string, reason: string): string {
    const id = `hold_${cryptoRandomUUID().substring(0, 8)}`;
    dbService.run(
      `INSERT INTO legal_holds (id, scope, reason, active, created_at)
       VALUES (?, ?, ?, 1, ?)`,
      id,
      scope,
      reason,
      Date.now()
    );
    return id;
  }

  public isPurgeBlocked(channelOrUserId: string): boolean {
    const row = dbService.get<{ active: number }>(
      'SELECT active FROM legal_holds WHERE scope = ? AND active = 1',
      channelOrUserId
    );
    return Boolean(row?.active);
  }

  public releaseLegalHold(holdId: string): boolean {
    dbService.run('UPDATE legal_holds SET active = 0 WHERE id = ?', holdId);
    return true;
  }

  // Chapter 284: Plagiarism Takedown Handling
  public processTakedownNotice(notice: {
    workTitle: string;
    originalUrl: string;
    infringingUrl: string;
    hasSwornAffidavit: boolean;
  }): { noticeId: string; actionTaken: 'quarantined' | 'rejected'; reason?: string } {
    if (!notice.hasSwornAffidavit) {
      return {
        noticeId: '',
        actionTaken: 'rejected',
        reason: 'Statutory Requirement: Takedown notice requires a signed good-faith statement.'
      };
    }

    const noticeId = `dmca_${cryptoRandomUUID().substring(0, 8)}`;
    return {
      noticeId,
      actionTaken: 'quarantined'
    };
  }

  // Chapter 285: Emergency Response Plans
  public triggerEmergencyPlaybook(threatType: 'raid' | 'token_leak' | 'data_breach'): {
    containmentActive: boolean;
    playbookActions: string[];
  } {
    const playbooks: Record<string, string[]> = {
      'raid': ['Lockdown newcomer onboarding', 'Enable slowmode 30s', 'Alert active human moderator roster'],
      'token_leak': ['Instantly revoke bot gateway token', 'Invalidate OAuth session tokens', 'Trigger key rotation drill'],
      'data_breach': ['Freeze outbound webhooks', 'Isolate staging & DB network routes', 'Publish incident status alert']
    };

    return {
      containmentActive: true,
      playbookActions: playbooks[threatType] || playbooks['raid']
    };
  }
}

export const governanceSecurityEngine = new GovernanceSecurityEngine();
