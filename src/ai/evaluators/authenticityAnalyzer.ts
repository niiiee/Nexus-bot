import { aiOrchestrator } from '../orchestrator.js';
import { SafetyShield } from '../safety/safetyShield.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('AuthenticityAnalyzer');

export interface AuthenticityReport {
  suspicionScore: number; // 0.0 (authentic) to 1.0 (highly suspicious)
  confidence: number;
  signals: string[];
  evidenceExcerpts: string[];
  reasoning: string;
}

export class AuthenticityAnalyzer {
  private static readonly SUSPICIOUS_PHRASES = [
    'as an ai language model',
    'it is important to remember that',
    'in conclusion, both approaches have their pros and cons',
    'furthermore, it is essential to consider',
    'delve into',
    'testament to',
    'tapestry of',
  ];

  public async analyzeAnswers(params: {
    claimedYears: number;
    field: string;
    questions: string[];
    answers: string[];
    responseLatencySeconds?: number[];
  }): Promise<AuthenticityReport> {
    const combinedAnswers = params.answers.join('\n');

    // 1. Static heuristic scans
    const detectedSignals: string[] = [];
    const excerpts: string[] = [];

    // Check for formulaic AI markers
    for (const phrase of AuthenticityAnalyzer.SUSPICIOUS_PHRASES) {
      if (combinedAnswers.toLowerCase().includes(phrase)) {
        detectedSignals.push(`contains_formulaic_ai_marker: "${phrase}"`);
        excerpts.push(phrase);
      }
    }

    // Check for prompt injection attempts
    const injectionCheck = SafetyShield.isSuspiciousInput(combinedAnswers);
    if (injectionCheck.isMalicious) {
      detectedSignals.push('prompt_injection_attempt_in_answers');
      excerpts.push(injectionCheck.reason || 'Malicious prompt override detected');
    }

    // Check for suspiciously fast copy-paste latency (< 4 seconds for long answer)
    if (params.responseLatencySeconds) {
      for (let i = 0; i < params.answers.length; i++) {
        const words = params.answers[i]?.split(/\s+/).length || 0;
        const latency = params.responseLatencySeconds[i] ?? 10;
        if (words > 10 && latency < 3) {
          detectedSignals.push(`unrealistic_typing_latency: ${words} words submitted in ${latency}s`);
          excerpts.push(params.answers[i].slice(0, 80) + '...');
        }
      }
    }

    // 2. LLM semantic consistency evaluation
    const systemPrompt = `
You are Senior Progg's Authenticity & Fraud Evaluator.
Analyze whether the candidate's answers demonstrate real hands-on engineering experience vs regurgitated generic AI copy-paste.
Claimed Years: ${params.claimedYears}
Field: ${params.field}

Heuristic Signals Already Flagged:
${detectedSignals.join('\n')}

Output JSON:
{
  "suspicionScore": number between 0.0 and 1.0 (0.0 = completely genuine, 1.0 = obvious fraud/copy-paste),
  "confidence": number between 0.0 and 1.0,
  "signals": ["signal1", "signal2"],
  "evidenceExcerpts": ["excerpt 1", "excerpt 2"],
  "reasoning": "Clear, objective explanation of what seems genuine or fabricated"
}
`.trim();

    try {
      const wrappedQnA = params.questions.map((q, i) => `Q: ${q}\nA: ${params.answers[i] || 'No answer'}`).join('\n\n');
      const response = await aiOrchestrator.generateJSON<AuthenticityReport>([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: SafetyShield.wrapUntrustedInput(wrappedQnA) },
      ]);

      if (response && typeof response.suspicionScore === 'number') {
        const combinedSignals = Array.from(new Set([...detectedSignals, ...(response.signals || [])]));
        const combinedExcerpts = Array.from(new Set([...excerpts, ...(response.evidenceExcerpts || [])]));

        return {
          suspicionScore: Math.min(1.0, Math.max(0.0, response.suspicionScore)),
          confidence: response.confidence || 0.85,
          signals: combinedSignals,
          evidenceExcerpts: combinedExcerpts,
          reasoning: response.reasoning || 'Evaluated for practical technical consistency and answer depth.',
        };
      }
    } catch (err) {
      logger.error('Failed LLM authenticity analysis', err);
    }

    // Heuristic fallback
    const hasFlags = detectedSignals.length > 0;
    return {
      suspicionScore: hasFlags ? 0.75 : 0.15,
      confidence: 0.8,
      signals: detectedSignals.length > 0 ? detectedSignals : ['natural_response_patterns'],
      evidenceExcerpts: excerpts,
      reasoning: hasFlags ? 'Flagged based on heuristic marker and latency detection.' : 'Answers match expected technical profile.',
    };
  }
}

export const authenticityAnalyzer = new AuthenticityAnalyzer();
