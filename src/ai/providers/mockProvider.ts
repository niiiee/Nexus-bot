import { BaseLLMProvider, LLMMessage, LLMOptions, LLMResponse } from './baseProvider.js';

export class MockLLMProvider implements BaseLLMProvider {
  public name = 'mock';

  public isAvailable(): boolean {
    return true;
  }

  public async generateText(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const lastMessage = messages[messages.length - 1]?.content || '';
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';

    let content = 'Senior Progg: Looks solid! Let me know if you need code review or architectural guidance.';

    if (lastMessage.includes('debug') || lastMessage.includes('bug') || lastMessage.includes('error')) {
      content = 'Here is the fix: check for null dereferences and ensure async/await error boundaries are caught properly.\n```typescript\ntry {\n  const result = await processTask();\n} catch (err) {\n  logger.error("Failed to process", err);\n}\n```';
    } else if (lastMessage.includes('إيه رأيك') || lastMessage.includes('مشكلة') || lastMessage.includes('كود')) {
      content = 'يا باشا الكود محتاج بس شوية تظبيط في الـ error handling وتنظيم الـ async calls والدنيا هتبقى تمام وزي الفل!';
    } else if (lastMessage.includes('banter') || systemMessage.includes('banter')) {
      content = 'يا عم سيبك من الـ console.log واستعمل debugger حقيقي عشان متزعلش في البرودكشن! ☕';
    }

    return {
      content,
      provider: 'mock',
      model: 'mock-progg-v1',
      usage: { promptTokens: 50, completionTokens: 40, totalTokens: 90 },
    };
  }

  public async generateJSON<T = Record<string, unknown>>(messages: LLMMessage[], options?: LLMOptions): Promise<T> {
    const lastMessage = messages[messages.length - 1]?.content || '';
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';

    // Vetting Question Generation
    if (systemMessage.includes('vetting') || lastMessage.includes('vetting')) {
      return {
        questions: [
          'Scenario: You deployed a microservice that suddenly exhausts database connections under peak load. How do you diagnose connection pool starvation without taking down the service?',
          'Why did you choose your primary framework over its closest alternative? Explain one critical architectural tradeoff you made.',
          'Debug challenge: A client reports sporadic 504 Gateway Timeouts only on mobile devices on cellular networks. What layers do you inspect first?',
        ],
        focusArea: 'debugging-and-architecture',
      } as unknown as T;
    }

    // Authenticity Analysis
    if (systemMessage.includes('authenticity') || lastMessage.includes('suspicion')) {
      const isSuspect = lastMessage.includes('As an AI language model') || lastMessage.includes('ignore previous instructions');
      return {
        suspicionScore: isSuspect ? 0.95 : 0.15,
        confidence: 0.92,
        signals: isSuspect ? ['generic_ai_markers', 'contradictory_claims'] : ['concrete_specifics', 'natural_latency'],
        reasoning: isSuspect ? 'Detected generic AI template phrasing and evasive architecture claims' : 'Consistent practical engineering details provided',
      } as unknown as T;
    }

    // Skill Test Generation (3+ years experience)
    if (systemMessage.includes('skill test') || lastMessage.includes('skill test')) {
      return {
        testId: 'mock-test-123',
        timeboxMinutes: 30,
        questions: [
          {
            id: 'q1',
            type: 'debugging',
            prompt: 'Identify the concurrency race condition in this Node.js worker snippet and fix it.',
          },
          {
            id: 'q2',
            type: 'architecture',
            prompt: 'Design an idempotent webhook delivery system that survives database failovers.',
          },
        ],
        hiddenRubric: {
          q1_criteria: ['Identifies mutex/atomic lock need', 'Handles promise rejections', 'Provides clean code'],
          q2_criteria: ['Mentions idempotency keys', 'Dead letter queue integration', 'Exponential backoff'],
          maxScore: 100,
          passThreshold: 50,
        },
      } as unknown as T;
    }

    // Rubric Grading
    if (systemMessage.includes('grading') || lastMessage.includes('rubric')) {
      const isWeak = lastMessage.includes('bad') || lastMessage.includes('fail');
      const score = isWeak ? 35 : 85;
      return {
        score,
        passed: score >= 50,
        feedback: score >= 50
          ? 'Strong demonstration of architectural tradeoffs and concurrency handling.'
          : 'Answers lacked depth on failure recovery and concurrency safety.',
        rubricBreakdown: {
          concurrency: score >= 50 ? 40 : 15,
          architecture: score >= 50 ? 45 : 20,
        },
        selfReflection: 'Verified against edge-case criteria; evaluation consistent with rubric.',
      } as unknown as T;
    }

    // Escrow Dispute Analysis
    if (systemMessage.includes('dispute') || lastMessage.includes('dispute')) {
      return {
        summary: 'Client claims deliverable lacked responsiveness; Freelancer proves deliverable matches approved Figma milestone 2.',
        clausesApplicable: ['Clause 3.2: Revisions capped at 2', 'Clause 4: Responsive breakpoints per spec'],
        nonBindingSuggestion: 'Deliver 1 final mobile patch before fund release.',
        confidence: 0.88,
      } as unknown as T;
    }

    // Default fallback structured JSON
    return {
      result: 'success',
      data: 'Mock structured output generated successfully',
    } as unknown as T;
  }
}
