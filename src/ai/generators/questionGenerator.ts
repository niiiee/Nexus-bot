import { aiOrchestrator } from '../orchestrator.js';
import { vettingRepo } from '../../database/repositories/vettingRepo.js';
import { SupportedLanguage } from '../../utils/i18n.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('QuestionGenerator');

export interface VettingQuestion {
  id: string;
  type: 'scenario' | 'debugging' | 'tradeoff' | 'architecture';
  prompt: string;
  criteria: string;
}

export class QuestionGenerator {
  public async generateQuestions(params: {
    userId: string;
    field: string;
    claimedYears: number;
    tools: string;
    language: SupportedLanguage;
  }): Promise<VettingQuestion[]> {
    const pastQuestions = vettingRepo.getAllPastQuestionsForUser(params.userId);
    const randomSeed = Math.floor(Math.random() * 1000000);

    const systemPrompt = `
You are an expert technical interviewer for Senior Progg's vetting system.
Field: ${params.field}
Claimed Years: ${params.claimedYears}
Primary Stack/Tools: ${params.tools}
Language: ${params.language}
Seed: ${randomSeed}

Rule: Questions MUST be realistic scenarios, debugging puzzles, or architectural tradeoffs.
FORBIDDEN: Generic trivia, textbook definitions, or questions easily answered by direct copy-paste.
Avoid repeating or closely paraphrasing any of these previously asked questions:
${pastQuestions.slice(-10).map((q, idx) => `${idx + 1}. ${q}`).join('\n')}

Generate exactly 3 diverse questions formatted as JSON:
{
  "questions": [
    {
      "id": "q1",
      "type": "debugging" | "scenario" | "tradeoff",
      "prompt": "The detailed scenario or problem statement",
      "criteria": "Key indicators of real-world competence"
    }
  ]
}
`.trim();

    try {
      const response = await aiOrchestrator.generateJSON<{ questions: VettingQuestion[] }>([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate vetting challenge for ${params.field} engineer (${params.claimedYears} years experience).` },
      ]);

      if (response?.questions && Array.isArray(response.questions) && response.questions.length > 0) {
        return response.questions.map((q: any, idx: number) => {
          if (typeof q === 'string') {
            return {
              id: `q${idx + 1}`,
              type: 'scenario' as const,
              prompt: q,
              criteria: 'Demonstrates practical depth and real engineering experience.',
            };
          }
          return {
            id: q.id || `q${idx + 1}`,
            type: q.type || 'scenario',
            prompt: q.prompt || String(q),
            criteria: q.criteria || 'Demonstrates practical depth.',
          };
        });
      }
    } catch (err) {
      logger.error('Failed to generate dynamic vetting questions via LLM', err);
    }

    // High quality deterministic fallback matching candidate stack
    return this.getFallbackQuestions(params.field, params.language);
  }

  public async generateFollowUpProbe(params: {
    previousQuestion: string;
    candidateAnswer: string;
    language: SupportedLanguage;
  }): Promise<string> {
    const systemPrompt = `
You are Senior Progg probing a candidate's previous response to check technical depth and authenticity.
Question Asked: "${params.previousQuestion}"
Candidate Answer: "${params.candidateAnswer}"
Language: ${params.language}

Rules:
1. Identify any vague claims, hand-waving, or missing edge-case handling in their answer.
2. Ask one sharp, polite follow-up question asking for concrete mechanics (e.g. "What happens when X fails?", "How did you manage Y edge-case?").
3. Language: Match ${params.language === 'ar' ? 'friendly casual Egyptian Arabic' : 'English'}.
`.trim();

    const response = await aiOrchestrator.generateText([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate adaptive follow-up probe.' },
    ]);

    return response.content;
  }

  private getFallbackQuestions(field: string, lang: SupportedLanguage): VettingQuestion[] {
    if (lang === 'ar') {
      return [
        {
          id: 'fb_ar_1',
          type: 'debugging',
          prompt: 'سيناريو: الداتا بيز فجأة بدأت تسرب Connections وتوقع السيرفر أول ما الـ Traffic بيزيد بنسبة 30%. إيه أول 3 خطوات هتعملها عشان تكتشف سبب المشكلة وتمنع الـ crash ده؟',
          criteria: 'ذكر connection pooling، timeout configuration، وفحص الـ unclosed transactions.',
        },
        {
          id: 'fb_ar_2',
          type: 'tradeoff',
          prompt: 'لو هتبني نظام Notifications بيبعت آلاف الرسايل اللحظية، ليه تختار Redis Pub/Sub أو RabbitMQ؟ وضح الـ Tradeoff في الـ persistence والـ latency.',
          criteria: 'مقارنة دقيقة بين سرعة الـ in-memory وحتمية وصول الرسائل مع الـ message acknowledgment.',
        },
        {
          id: 'fb_ar_3',
          type: 'scenario',
          prompt: 'واجهت قبل كده مشكلة أداء غير متوقعة في الـ Frontend أو الـ Backend بعد الـ Deploy؟ إيه كان جذر المشكلة وحلتها إزاي؟',
          criteria: 'تجربة حقيقية وشرح لآلية الـ Root Cause Analysis.',
        },
      ];
    }

    return [
      {
        id: 'fb_en_1',
        type: 'debugging',
        prompt: 'Scenario: Your production Node/Python service memory consumption climbs monotonically until the container is OOMKilled every 6 hours under constant load. How do you isolate the leak without stopping production traffic?',
        criteria: 'Heap profiling, inspecting event listeners, unclosed streams or global caches.',
      },
      {
        id: 'fb_en_2',
        type: 'tradeoff',
        prompt: 'Explain a specific scenario where choosing an event-driven architecture created more operational complexity than a modular monolith. What tradeoff did you compromise on?',
        criteria: 'Clear rationale on eventual consistency, tracing overhead, and operational cost.',
      },
      {
        id: 'fb_en_3',
        type: 'scenario',
        prompt: 'A critical third-party API webhook is occasionally dropping events or sending out-of-order retries. How do you design your ingestion pipeline for absolute idempotency?',
        criteria: 'Mentions unique idempotency keys, atomic locks, and dead-letter queue recovery.',
      },
    ];
  }
}

export const questionGenerator = new QuestionGenerator();
