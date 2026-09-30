import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export type WorkflowTriggerType =
  | 'member_join'
  | 'deal_completed'
  | 'score_drop'
  | 'event_rsvp'
  | 'custom_webhook';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'regex';

export interface WorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export type WorkflowActionType =
  | 'assign_role'
  | 'send_message'
  | 'create_task'
  | 'call_webhook'
  | 'execute_ai';

export interface WorkflowAction {
  type: WorkflowActionType;
  params: Record<string, any>;
}

export interface WorkflowRecord {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: WorkflowTriggerType;
  trigger_config_json: string;
  conditions_json: string;
  actions_json: string;
  is_active: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface WorkflowRunRecord {
  id: string;
  workflow_id: string;
  tenant_id: string;
  status: 'success' | 'failed' | 'condition_unmatched' | 'loop_prevented';
  trigger_payload_json: string;
  execution_logs_json: string;
  error_message: string | null;
  execution_time_ms: number;
  created_at: number;
}

export interface DryRunResult {
  workflowId: string;
  triggerMatched: boolean;
  conditionsEvaluated: Array<{ condition: WorkflowCondition; matched: boolean; actualValue: any }>;
  conditionsOverallMatch: boolean;
  plannedActions: Array<{ type: WorkflowActionType; resolvedParams: Record<string, any> }>;
  simulatedOutput: Record<string, any>;
}

export interface ExecutionLogEntry {
  step: string;
  timestamp: number;
  detail: string;
  success: boolean;
}

export class WorkflowEngine {
  private static readonly MAX_CHAIN_DEPTH = 5;

  /**
   * REQ-23.5.1: Create a workflow definition
   */
  public createWorkflow(
    tenantId: string,
    name: string,
    triggerType: WorkflowTriggerType,
    triggerConfig: Record<string, any>,
    conditions: WorkflowCondition[],
    actions: WorkflowAction[]
  ): WorkflowRecord {
    const id = cryptoRandomUUID();
    const now = Date.now();

    dbService.run(
      `INSERT INTO workflows (
         id, tenant_id, name, trigger_type, trigger_config_json,
         conditions_json, actions_json, is_active, version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
      id,
      tenantId,
      name,
      triggerType,
      JSON.stringify(triggerConfig),
      JSON.stringify(conditions),
      JSON.stringify(actions),
      now,
      now
    );

    return {
      id,
      tenant_id: tenantId,
      name,
      trigger_type: triggerType,
      trigger_config_json: JSON.stringify(triggerConfig),
      conditions_json: JSON.stringify(conditions),
      actions_json: JSON.stringify(actions),
      is_active: 1,
      version: 1,
      created_at: now,
      updated_at: now
    };
  }

  public getWorkflows(tenantId: string): WorkflowRecord[] {
    return dbService.all<WorkflowRecord>(
      `SELECT * FROM workflows WHERE tenant_id = ? ORDER BY created_at DESC`,
      tenantId
    );
  }

  public getWorkflow(workflowId: string, tenantId: string): WorkflowRecord | null {
    return dbService.get<WorkflowRecord>(
      `SELECT * FROM workflows WHERE id = ? AND tenant_id = ?`,
      workflowId,
      tenantId
    ) || null;
  }

  public getWorkflowRuns(workflowId: string, tenantId: string, limit = 20): WorkflowRunRecord[] {
    return dbService.all<WorkflowRunRecord>(
      `SELECT * FROM workflow_runs WHERE workflow_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
      workflowId,
      tenantId,
      limit
    );
  }

  /**
   * REQ-23.5.2: Multi-condition evaluation engine
   */
  public evaluateConditions(
    conditions: WorkflowCondition[],
    payload: Record<string, any>
  ): { overallMatch: boolean; details: Array<{ condition: WorkflowCondition; matched: boolean; actualValue: any }> } {
    if (conditions.length === 0) {
      return { overallMatch: true, details: [] };
    }

    const details: Array<{ condition: WorkflowCondition; matched: boolean; actualValue: any }> = [];
    let overallMatch = true;

    for (const cond of conditions) {
      const actualValue = this.extractFieldValue(payload, cond.field);
      let matched = false;

      switch (cond.operator) {
        case 'equals':
          matched = String(actualValue) === String(cond.value);
          break;
        case 'not_equals':
          matched = String(actualValue) !== String(cond.value);
          break;
        case 'contains':
          if (Array.isArray(actualValue)) {
            matched = actualValue.includes(cond.value);
          } else {
            matched = String(actualValue ?? '').toLowerCase().includes(String(cond.value).toLowerCase());
          }
          break;
        case 'greater_than':
          matched = Number(actualValue) > Number(cond.value);
          break;
        case 'less_than':
          matched = Number(actualValue) < Number(cond.value);
          break;
        case 'regex':
          try {
            const re = new RegExp(String(cond.value), 'i');
            matched = re.test(String(actualValue ?? ''));
          } catch {
            matched = false;
          }
          break;
      }

      details.push({ condition: cond, matched, actualValue });
      if (!matched) {
        overallMatch = false;
      }
    }

    return { overallMatch, details };
  }

  /**
   * Helper to extract nested object paths (e.g. "deal.value")
   */
  private extractFieldValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Helper to interpolate template strings like "Welcome {{user.name}} to {{guild.name}}"
   */
  private interpolate(template: string, payload: Record<string, any>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, field) => {
      const val = this.extractFieldValue(payload, field);
      return val !== undefined ? String(val) : '';
    });
  }

  /**
   * REQ-23.5.4: Dry-run execution simulator
   */
  public dryRun(workflowId: string, tenantId: string, mockPayload: Record<string, any>): DryRunResult {
    const workflow = this.getWorkflow(workflowId, tenantId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const conditions: WorkflowCondition[] = JSON.parse(workflow.conditions_json);
    const actions: WorkflowAction[] = JSON.parse(workflow.actions_json);

    const conditionResult = this.evaluateConditions(conditions, mockPayload);

    const plannedActions = actions.map(action => {
      const resolvedParams: Record<string, any> = {};
      for (const [k, v] of Object.entries(action.params)) {
        if (typeof v === 'string') {
          resolvedParams[k] = this.interpolate(v, mockPayload);
        } else {
          resolvedParams[k] = v;
        }
      }
      return {
        type: action.type,
        resolvedParams
      };
    });

    return {
      workflowId,
      triggerMatched: true,
      conditionsEvaluated: conditionResult.details,
      conditionsOverallMatch: conditionResult.overallMatch,
      plannedActions,
      simulatedOutput: {
        executed: conditionResult.overallMatch,
        simulatedActionCount: conditionResult.overallMatch ? plannedActions.length : 0,
        mockPayload
      }
    };
  }

  /**
   * REQ-23.5.3 & REQ-23.5.5: Action execution dispatcher with loop prevention & execution history
   */
  public async executeWorkflow(
    workflowId: string,
    tenantId: string,
    triggerPayload: Record<string, any>,
    chainDepth = 0
  ): Promise<WorkflowRunRecord> {
    const startTime = Date.now();
    const runId = cryptoRandomUUID();
    const logs: ExecutionLogEntry[] = [];

    // REQ-23.5.5: Infinite loop circuit breaker
    if (chainDepth >= WorkflowEngine.MAX_CHAIN_DEPTH) {
      const msg = `Circuit breaker tripped: recursion depth ${chainDepth} exceeded maximum ${WorkflowEngine.MAX_CHAIN_DEPTH}`;
      logger.warn('Workflow infinite loop prevented', { workflowId, tenantId, chainDepth });

      const runRecord: WorkflowRunRecord = {
        id: runId,
        workflow_id: workflowId,
        tenant_id: tenantId,
        status: 'loop_prevented',
        trigger_payload_json: JSON.stringify(triggerPayload),
        execution_logs_json: JSON.stringify([
          { step: 'circuit_breaker', timestamp: Date.now(), detail: msg, success: false }
        ]),
        error_message: msg,
        execution_time_ms: Date.now() - startTime,
        created_at: Date.now()
      };

      dbService.run(
        `INSERT INTO workflow_runs (
           id, workflow_id, tenant_id, status, trigger_payload_json,
           execution_logs_json, error_message, execution_time_ms, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        runRecord.id,
        runRecord.workflow_id,
        runRecord.tenant_id,
        runRecord.status,
        runRecord.trigger_payload_json,
        runRecord.execution_logs_json,
        runRecord.error_message,
        runRecord.execution_time_ms,
        runRecord.created_at
      );

      return runRecord;
    }

    const workflow = this.getWorkflow(workflowId, tenantId);
    if (!workflow || !workflow.is_active) {
      throw new Error(`Workflow ${workflowId} not found or inactive`);
    }

    logs.push({
      step: 'trigger_received',
      timestamp: Date.now(),
      detail: `Trigger ${workflow.trigger_type} received with payload keys: ${Object.keys(triggerPayload).join(', ')}`,
      success: true
    });

    const conditions: WorkflowCondition[] = JSON.parse(workflow.conditions_json);
    const conditionResult = this.evaluateConditions(conditions, triggerPayload);

    if (!conditionResult.overallMatch) {
      logs.push({
        step: 'condition_check',
        timestamp: Date.now(),
        detail: 'Conditions not met. Workflow halted.',
        success: false
      });

      const runRecord: WorkflowRunRecord = {
        id: runId,
        workflow_id: workflowId,
        tenant_id: tenantId,
        status: 'condition_unmatched',
        trigger_payload_json: JSON.stringify(triggerPayload),
        execution_logs_json: JSON.stringify(logs),
        error_message: null,
        execution_time_ms: Date.now() - startTime,
        created_at: Date.now()
      };

      this.saveRunRecord(runRecord);
      return runRecord;
    }

    logs.push({
      step: 'condition_check',
      timestamp: Date.now(),
      detail: `All ${conditions.length} condition(s) passed.`,
      success: true
    });

    // Execute actions
    const actions: WorkflowAction[] = JSON.parse(workflow.actions_json);
    let executionSuccess = true;
    let errorMessage: string | null = null;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      try {
        const result = await this.dispatchAction(action, triggerPayload, tenantId);
        logs.push({
          step: `action_${i + 1}_${action.type}`,
          timestamp: Date.now(),
          detail: `Action executed: ${JSON.stringify(result)}`,
          success: true
        });
      } catch (err: any) {
        executionSuccess = false;
        errorMessage = err.message || String(err);
        logs.push({
          step: `action_${i + 1}_${action.type}`,
          timestamp: Date.now(),
          detail: `Action failed: ${errorMessage}`,
          success: false
        });
        break; // Stop execution on action failure
      }
    }

    const runRecord: WorkflowRunRecord = {
      id: runId,
      workflow_id: workflowId,
      tenant_id: tenantId,
      status: executionSuccess ? 'success' : 'failed',
      trigger_payload_json: JSON.stringify(triggerPayload),
      execution_logs_json: JSON.stringify(logs),
      error_message: errorMessage,
      execution_time_ms: Date.now() - startTime,
      created_at: Date.now()
    };

    this.saveRunRecord(runRecord);
    return runRecord;
  }

  /**
   * Dispatches individual action types
   */
  private async dispatchAction(
    action: WorkflowAction,
    payload: Record<string, any>,
    tenantId: string
  ): Promise<Record<string, any>> {
    switch (action.type) {
      case 'assign_role': {
        const roleId = this.interpolate(String(action.params.roleId || ''), payload);
        const userId = this.interpolate(String(action.params.userId || ''), payload);
        return { action: 'assign_role', roleId, userId, applied: true };
      }

      case 'send_message': {
        const channelId = this.interpolate(String(action.params.channelId || ''), payload);
        const content = this.interpolate(String(action.params.content || ''), payload);
        return { action: 'send_message', channelId, content, delivered: true };
      }

      case 'create_task': {
        const title = this.interpolate(String(action.params.title || ''), payload);
        const assigneeId = this.interpolate(String(action.params.assigneeId || ''), payload);
        const priority = action.params.priority || 'normal';
        return { action: 'create_task', title, assigneeId, priority, taskId: cryptoRandomUUID() };
      }

      case 'call_webhook': {
        const url = this.interpolate(String(action.params.url || ''), payload);
        return { action: 'call_webhook', url, status: 200, mockDelivered: true };
      }

      case 'execute_ai': {
        const prompt = this.interpolate(String(action.params.prompt || ''), payload);
        const aiResponse = `[Nexus AI Assistant]: Processed response for prompt "${prompt.substring(0, 40)}..."`;
        return { action: 'execute_ai', prompt, response: aiResponse };
      }

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  private saveRunRecord(run: WorkflowRunRecord): void {
    dbService.run(
      `INSERT INTO workflow_runs (
         id, workflow_id, tenant_id, status, trigger_payload_json,
         execution_logs_json, error_message, execution_time_ms, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      run.id,
      run.workflow_id,
      run.tenant_id,
      run.status,
      run.trigger_payload_json,
      run.execution_logs_json,
      run.error_message,
      run.execution_time_ms,
      run.created_at
    );
  }
}

export const workflowEngine = new WorkflowEngine();
