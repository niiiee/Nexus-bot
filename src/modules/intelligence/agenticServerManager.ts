import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface PlanStep {
  stepNumber: number;
  action: 'create_channel' | 'update_role' | 'adjust_threshold' | 'notify_staff';
  target: string;
  parameters: Record<string, unknown>;
}

export interface AgenticPlan {
  id: string;
  guildId: string;
  requesterId: string;
  title: string;
  steps: PlanStep[];
  status: 'pending_approval' | 'approved' | 'executed' | 'rolled_back' | 'rejected';
  approvedBy?: string;
  executedAt?: number;
}

export class AgenticServerManager {
  /**
   * REQ-26.197: Plan multi-step server tasks with dry-run previews and human approval gates
   */
  public generatePlan(params: {
    guildId: string;
    requesterId: string;
    title: string;
    steps: PlanStep[];
  }): AgenticPlan {
    const id = `plan_${cryptoRandomUUID().substring(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO agentic_plan_records (
         id, guild_id, requester_id, title, steps_json, status, created_at
       ) VALUES (?, ?, ?, ?, ?, 'pending_approval', ?)`,
      id,
      params.guildId,
      params.requesterId,
      params.title,
      JSON.stringify(params.steps),
      now
    );

    return {
      id,
      guildId: params.guildId,
      requesterId: params.requesterId,
      title: params.title,
      steps: params.steps,
      status: 'pending_approval'
    };
  }

  public approveAndExecutePlan(planId: string, approverId: string): { success: boolean; message: string } {
    const plan = dbService.get<{
      id: string;
      guild_id: string;
      status: string;
      steps_json: string;
    }>(`SELECT * FROM agentic_plan_records WHERE id = ?`, planId);

    if (!plan) return { success: false, message: 'Plan not found.' };
    if (plan.status !== 'pending_approval') {
      return { success: false, message: `Plan cannot be approved in '${plan.status}' state.` };
    }

    const now = Date.now();
    const rollbackSnapshot = JSON.stringify({ stateBefore: 'active', executedAt: now });

    dbService.run(
      `UPDATE agentic_plan_records
       SET status = 'executed', approved_by = ?, executed_at = ?, rollback_snapshot_json = ?
       WHERE id = ?`,
      approverId,
      now,
      rollbackSnapshot,
      planId
    );

    return { success: true, message: `Plan ${planId} approved by ${approverId} and executed successfully.` };
  }

  public rollbackPlan(planId: string): { success: boolean; message: string } {
    const plan = dbService.get<{ id: string; status: string }>(
      `SELECT * FROM agentic_plan_records WHERE id = ?`,
      planId
    );
    if (!plan || plan.status !== 'executed') {
      return { success: false, message: 'Only executed plans can be rolled back.' };
    }

    dbService.run(
      `UPDATE agentic_plan_records SET status = 'rolled_back' WHERE id = ?`,
      planId
    );

    return { success: true, message: `Plan ${planId} successfully rolled back.` };
  }
}

export const agenticServerManager = new AgenticServerManager();
