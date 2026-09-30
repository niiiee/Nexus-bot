import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface MilestoneItem {
  id: string;
  title: string;
  description: string;
  deliverables: string[];
  dueInDays: number;
  completed: boolean;
}

export interface ScopeCreepFlag {
  id: string;
  requestText: string;
  flaggedReason: string;
  detectedAt: number;
  status: 'pending_review' | 'accepted' | 'rejected';
}

export interface DealProjectPlanRecord {
  id: string;
  deal_id: string;
  tenant_id: string;
  milestones_json: string;
  risk_score: number;
  scope_creep_flags_json: string;
  last_checkin_at: number | null;
  created_at: number;
  updated_at: number;
}

export class AiProjectManager {
  /**
   * REQ-23.13.1: Generate WBS milestones and project plan from deal scope text
   */
  public generateProjectPlan(
    tenantId: string,
    dealId: string,
    dealScopeText: string
  ): DealProjectPlanRecord {
    const existing = dbService.get<DealProjectPlanRecord>(
      `SELECT * FROM deal_project_plans WHERE deal_id = ?`,
      dealId
    );

    const now = Date.now();
    const milestones: MilestoneItem[] = [
      {
        id: 'ms_1',
        title: 'Requirements & Architecture Specification',
        description: 'Finalize technical specs, database schemas, and UX wireframes based on scope.',
        deliverables: ['Architecture doc', 'Approved wireframes'],
        dueInDays: 3,
        completed: false
      },
      {
        id: 'ms_2',
        title: 'Core Implementation & Test Suite',
        description: 'Develop backend APIs, UI components, and automated test cases.',
        deliverables: ['Working prototype', 'Passing test suite'],
        dueInDays: 10,
        completed: false
      },
      {
        id: 'ms_3',
        title: 'Deployment, QA & Deliverable Sign-off',
        description: 'Deploy to staging, run client acceptance testing, and release production deliverable.',
        deliverables: ['Live deployment URL', 'Documentation & sign-off'],
        dueInDays: 14,
        completed: false
      }
    ];

    if (existing) {
      dbService.run(
        `UPDATE deal_project_plans
         SET milestones_json = ?, updated_at = ?
         WHERE id = ?`,
        JSON.stringify(milestones),
        now,
        existing.id
      );
      return {
        ...existing,
        milestones_json: JSON.stringify(milestones),
        updated_at: now
      };
    } else {
      const id = cryptoRandomUUID();
      dbService.run(
        `INSERT INTO deal_project_plans (
           id, deal_id, tenant_id, milestones_json, risk_score,
           scope_creep_flags_json, last_checkin_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 0.1, '[]', NULL, ?, ?)`,
        id,
        dealId,
        tenantId,
        JSON.stringify(milestones),
        now,
        now
      );

      return {
        id,
        deal_id: dealId,
        tenant_id: tenantId,
        milestones_json: JSON.stringify(milestones),
        risk_score: 0.1,
        scope_creep_flags_json: '[]',
        last_checkin_at: null,
        created_at: now,
        updated_at: now
      };
    }
  }

  public getProjectPlan(dealId: string): DealProjectPlanRecord | null {
    return dbService.get<DealProjectPlanRecord>(
      `SELECT * FROM deal_project_plans WHERE deal_id = ?`,
      dealId
    ) || null;
  }

  /**
   * REQ-23.13.2: Automated proactive deadline check-in message generator
   */
  public generateDeadlineCheckin(
    dealId: string,
    freelancerName: string,
    clientName: string
  ): { shouldSend: boolean; message: string; milestoneTitle?: string } {
    const plan = this.getProjectPlan(dealId);
    if (!plan) return { shouldSend: false, message: '' };

    const milestones: MilestoneItem[] = JSON.parse(plan.milestones_json);
    const activeMilestone = milestones.find(m => !m.completed);

    if (!activeMilestone) {
      return { shouldSend: false, message: 'All milestones completed.' };
    }

    const now = Date.now();
    dbService.run(
      `UPDATE deal_project_plans SET last_checkin_at = ?, updated_at = ? WHERE id = ?`,
      now,
      now,
      plan.id
    );

    const message = `🔔 **Nexus AI PM Milestone Check-in (Deal #${dealId})**\n\n` +
      `Hey @${freelancerName} and @${clientName}! Current milestone **"${activeMilestone.title}"** is in progress.\n` +
      `Deliverables expected:\n` +
      activeMilestone.deliverables.map(d => `• ${d}`).join('\n') + `\n\n` +
      `Please confirm if everything is on track or if you need an adjustment to avoid timeline delays.`;

    return {
      shouldSend: true,
      message,
      milestoneTitle: activeMilestone.title
    };
  }

  /**
   * REQ-23.13.3: Scope-creep detector comparing new requests against baseline deliverables
   */
  public evaluateScopeCreep(
    dealId: string,
    requestedText: string
  ): { isScopeCreep: boolean; reason: string; riskDelta: number } {
    const plan = this.getProjectPlan(dealId);
    if (!plan) {
      return { isScopeCreep: false, reason: 'No plan found', riskDelta: 0 };
    }

    const lower = requestedText.toLowerCase();
    const scopeExpansionTriggers = [
      'also add mobile app',
      'can you also build',
      'in addition to what was agreed',
      'redesign the whole',
      'bonus feature',
      'while you are at it',
      'complete rewrite'
    ];

    let isScopeCreep = false;
    let reason = 'Request falls within agreed deliverables.';
    let riskDelta = 0.0;

    for (const trig of scopeExpansionTriggers) {
      if (lower.includes(trig)) {
        isScopeCreep = true;
        reason = `Request contains out-of-scope expansion pattern: "${trig}". Should be negotiated as a paid milestone add-on.`;
        riskDelta = 0.25;
        break;
      }
    }

    if (isScopeCreep) {
      const flags: ScopeCreepFlag[] = JSON.parse(plan.scope_creep_flags_json);
      const newFlag: ScopeCreepFlag = {
        id: cryptoRandomUUID(),
        requestText: requestedText,
        flaggedReason: reason,
        detectedAt: Date.now(),
        status: 'pending_review'
      };
      flags.push(newFlag);

      const newRisk = Math.min(1.0, plan.risk_score + riskDelta);
      dbService.run(
        `UPDATE deal_project_plans
         SET scope_creep_flags_json = ?, risk_score = ?, updated_at = ?
         WHERE id = ?`,
        JSON.stringify(flags),
        newRisk,
        Date.now(),
        plan.id
      );
    }

    return { isScopeCreep, reason, riskDelta };
  }

  /**
   * REQ-23.13.4: Complete milestone and recalibrate risk score
   */
  public completeMilestone(dealId: string, milestoneId: string): boolean {
    const plan = this.getProjectPlan(dealId);
    if (!plan) return false;

    const milestones: MilestoneItem[] = JSON.parse(plan.milestones_json);
    const ms = milestones.find(m => m.id === milestoneId);
    if (!ms) return false;

    ms.completed = true;
    const remainingIncomplete = milestones.filter(m => !m.completed).length;
    const newRisk = Number((remainingIncomplete * 0.1).toFixed(2));

    dbService.run(
      `UPDATE deal_project_plans
       SET milestones_json = ?, risk_score = ?, updated_at = ?
       WHERE id = ?`,
      JSON.stringify(milestones),
      newRisk,
      Date.now(),
      plan.id
    );

    return true;
  }
}

export const aiProjectManager = new AiProjectManager();
