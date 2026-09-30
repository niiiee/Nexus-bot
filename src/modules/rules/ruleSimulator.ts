import { rulesEngine, RuleEvaluationResult } from './rulesEngine.js';

export interface RuleSimulationOutput {
  scenarioText: string;
  isViolation: boolean;
  ruleTriggered?: string;
  ruleNameEn?: string;
  ruleNameAr?: string;
  severity?: string;
  mode?: string;
  actionCeiling: string;
  explanationEn: string;
  explanationAr: string;
  isSandboxed: boolean;
}

export class RuleSimulator {
  /**
   * REQ-26.269: Interactive scenario sandbox demonstrating rule applications with zero disciplinary consequences
   */
  public simulateScenario(scenarioText: string, language: 'en' | 'ar' = 'ar'): RuleSimulationOutput {
    // Run evaluation in shadow mode (zero DB persistence)
    const result: RuleEvaluationResult = rulesEngine.evaluateMessage({
      guildId: 'sandbox_simulation',
      userId: 'sandbox_user',
      content: scenarioText,
      language,
      isShadow: true
    });

    if (result.isViolation || result.actionTaken === 'care_outreach') {
      return {
        scenarioText,
        isViolation: result.isViolation,
        ruleTriggered: result.ruleId,
        ruleNameEn: result.ruleNameEn,
        ruleNameAr: result.ruleNameAr,
        severity: result.severity,
        mode: result.mode,
        actionCeiling: result.actionTaken,
        explanationEn: `This text triggers [${result.ruleId}] ${result.ruleNameEn}. Simulated action: ${result.actionTaken}.`,
        explanationAr: `هذا النص ينطبق عليه البند [${result.ruleId}] ${result.ruleNameAr}. الإجراء المحاكى: ${result.actionTaken}.`,
        isSandboxed: true
      };
    }

    return {
      scenarioText,
      isViolation: false,
      actionCeiling: 'none',
      explanationEn: 'This message conforms to community guidelines and would not trigger any moderation action.',
      explanationAr: 'هذا النص متوافق تماماً مع قواعد المجتمع ولا يترتب عليه أي إجراء تنظيمي.',
      isSandboxed: true
    };
  }
}

export const ruleSimulator = new RuleSimulator();
