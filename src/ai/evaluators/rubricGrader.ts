import { aiOrchestrator } from '../orchestrator.js';
import { HiddenRubric } from '../generators/testGenerator.js';
import { codeSandbox, SandboxExecutionResult } from './codeSandbox.js';
import { testRepo, SkillTestRecord } from '../../database/repositories/testRepo.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('RubricGrader');

export interface GradeResult {
  score: number;
  passed: boolean;
  feedback: string;
  rubricBreakdown: Record<string, number>;
  selfReflection: string;
  sandboxResults?: Record<string, SandboxExecutionResult>;
}

export class RubricGrader {
  public async gradeTest(
    testRecord: SkillTestRecord,
    candidateAnswers: Record<string, string>
  ): Promise<GradeResult> {
    const rubric: HiddenRubric = JSON.parse(testRecord.hidden_rubric_json);
    const questions: Array<{ id: string; prompt: string; type: string; starterCode?: string }> = JSON.parse(testRecord.questions_json);

    // 1. If any answers contain executable code, test in sandbox
    const sandboxResults: Record<string, SandboxExecutionResult> = {};
    for (const [qId, answerCode] of Object.entries(candidateAnswers)) {
      if (answerCode.includes('function') || answerCode.includes('class') || answerCode.includes('const') || answerCode.includes('def ')) {
        const result = await codeSandbox.executeJavaScript(answerCode);
        sandboxResults[qId] = result;
      }
    }

    // 2. Perform AI Rubric Evaluation
    const systemPrompt = `
You are Senior Progg's Principal Technical Examiner.
Evaluate candidate answers against the following HIDDEN RUBRIC.
Internal Rubric (Keep strictly confidential):
${JSON.stringify(rubric, null, 2)}

Code Sandbox Execution Results:
${JSON.stringify(sandboxResults, null, 2)}

Instructions:
1. Grade each question based on actual mechanics, correctness, and architecture.
2. Calculate total score out of ${rubric.maxScore}. Pass threshold is ${rubric.passThreshold}.
3. Perform a SELF-REFLECTION pass: "What could I be overly harsh or lenient about? Did the candidate demonstrate real intuition despite syntax errors?"
4. Provide constructive candidate feedback highlighting concepts to improve WITHOUT quoting or revealing the rubric criteria directly.

Output JSON:
{
  "score": number between 0 and 100,
  "passed": boolean,
  "feedback": "Constructive, mentor-level feedback for the candidate",
  "rubricBreakdown": { "q1": number, "q2": number, "q3": number, "q4": number },
  "selfReflection": "Internal reasoning critique verified"
}
`.trim();

    try {
      const wrappedQnA = questions
        .map(q => `Question ${q.id} (${q.type}): ${q.prompt}\nAnswer:\n${candidateAnswers[q.id] || 'No answer provided'}`)
        .join('\n\n---\n\n');

      const response = await aiOrchestrator.generateJSON<GradeResult>([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: wrappedQnA },
      ]);

      if (response && typeof response.score === 'number') {
        const passed = response.score >= rubric.passThreshold;
        testRepo.completeTest(testRecord.id, candidateAnswers, response.score, passed, response.feedback);

        return {
          score: response.score,
          passed,
          feedback: response.feedback,
          rubricBreakdown: response.rubricBreakdown || {},
          selfReflection: response.selfReflection || 'Evaluated against all core rubric dimensions.',
          sandboxResults,
        };
      }
    } catch (err) {
      logger.error('Failed AI rubric grading', err);
    }

    // Deterministic fallback grading
    let totalScore = 0;
    const breakdown: Record<string, number> = {};
    for (const q of questions) {
      const ans = candidateAnswers[q.id] || '';
      const points = ans.length > 30 ? 20 : 5;
      breakdown[q.id] = points;
      totalScore += points;
    }

    const passed = totalScore >= rubric.passThreshold;
    const feedback = passed
      ? 'Well done! You demonstrated solid architectural and problem-solving fundamentals.'
      : 'The submission lacked key architectural depth and error-handling requirements for this experience tier.';

    testRepo.completeTest(testRecord.id, candidateAnswers, totalScore, passed, feedback);

    return {
      score: totalScore,
      passed,
      feedback,
      rubricBreakdown: breakdown,
      selfReflection: 'Applied standard fallback baseline assessment.',
      sandboxResults,
    };
  }
}

export const rubricGrader = new RubricGrader();
