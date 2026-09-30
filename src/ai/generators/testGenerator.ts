import { aiOrchestrator } from '../orchestrator.js';
import { testRepo, SkillTestRecord } from '../../database/repositories/testRepo.js';
import { SupportedLanguage } from '../../utils/i18n.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('TestGenerator');

export interface TestQuestion {
  id: string;
  type: 'problem_solving' | 'debugging' | 'architecture' | 'feature_brief';
  prompt: string;
  starterCode?: string;
}

export interface HiddenRubric {
  criteria: Record<string, { weight: number; keyPoints: string[] }>;
  maxScore: number;
  passThreshold: number;
  sandboxTestCases?: Array<{ input: string; expectedOutput: string }>;
}

export interface GeneratedSkillTest {
  testId: string;
  questions: TestQuestion[];
  hiddenRubric: HiddenRubric;
  timeboxMinutes: number;
  expiresAt: number;
}

export class TestGenerator {
  public async generateLiveTest(params: {
    userId: string;
    guildId: string;
    field: string;
    claimedYears: number;
    tools: string;
    language: SupportedLanguage;
    timeboxMinutes?: number;
  }): Promise<SkillTestRecord> {
    const timebox = params.timeboxMinutes ?? 30;
    const systemPrompt = `
You are Senior Progg's Technical Examination Architect.
Generate a comprehensive, un-gameable live skill assessment for an engineer claiming ${params.claimedYears} years in ${params.field}.
Stack: ${params.tools}
Language: ${params.language}

The test MUST contain 4 distinct sections:
1. Problem Solving: Realistic algorithm or data transformation puzzle.
2. Debugging: A faulty code snippet with subtle concurrency, race condition, or memory bug.
3. Feature / Design Brief: Rapid specification or interface layout requirement.
4. Architectural Tradeoff: System design reasoning under high throughput or failure conditions.

Along with the questions, generate an internal HIDDEN RUBRIC (scoring criteria, points per question, passThreshold=50).

Output JSON:
{
  "questions": [
    { "id": "q1", "type": "problem_solving", "prompt": "...", "starterCode": "..." },
    { "id": "q2", "type": "debugging", "prompt": "...", "starterCode": "..." },
    { "id": "q3", "type": "feature_brief", "prompt": "..." },
    { "id": "q4", "type": "architecture", "prompt": "..." }
  ],
  "hiddenRubric": {
    "criteria": {
      "q1": { "weight": 25, "keyPoints": ["O(N) time complexity", "Edge cases (empty/null) handled"] },
      "q2": { "weight": 25, "keyPoints": ["Identifies unhandled promise/lock", "Clean fix provided"] },
      "q3": { "weight": 25, "keyPoints": ["Structured deliverables", "Realistic milestone breakdown"] },
      "q4": { "weight": 25, "keyPoints": ["Idempotency", "Decoupling components", "Failure recovery"] }
    },
    "maxScore": 100,
    "passThreshold": 50
  }
}
`.trim();

    try {
      const response = await aiOrchestrator.generateJSON<{ questions: TestQuestion[]; hiddenRubric: HiddenRubric }>([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate unique live skill test with hidden rubric.' },
      ]);

      if (response?.questions && response.hiddenRubric) {
        return testRepo.create({
          user_id: params.userId,
          guild_id: params.guildId,
          field: params.field,
          questions: response.questions,
          rubric: response.hiddenRubric as unknown as Record<string, unknown>,
          timebox_minutes: timebox,
        });
      }
    } catch (err) {
      logger.error('Failed to generate live test via LLM', err);
    }

    // High fidelity fallback test
    const fallbackQuestions: TestQuestion[] = [
      {
        id: 'q1',
        type: 'problem_solving',
        prompt: 'Implement an LRU (Least Recently Used) cache with O(1) get and put operations in TypeScript or Python.',
        starterCode: 'class LRUCache {\n  constructor(capacity: number) {}\n  get(key: number): number { return -1; }\n  put(key: number, value: number): void {}\n}',
      },
      {
        id: 'q2',
        type: 'debugging',
        prompt: 'Find and fix the memory leak and race condition in this connection pool handler.',
        starterCode: 'async function acquireConnection(pool) {\n  let conn;\n  while (!conn) {\n    if (pool.idle.length > 0) conn = pool.idle.pop();\n    else await new Promise(r => setTimeout(r, 10));\n  }\n  return conn;\n}',
      },
      {
        id: 'q3',
        type: 'feature_brief',
        prompt: 'A client requests a real-time collaborative document editor. Provide a 1-page technical spec addressing conflict resolution (OT vs CRDT) and offline sync.',
      },
      {
        id: 'q4',
        type: 'architecture',
        prompt: 'Design a resilient rate-limiting layer for a public API handling 50k requests/second with distributed Redis clusters.',
      },
    ];

    const fallbackRubric: HiddenRubric = {
      criteria: {
        q1: { weight: 25, keyPoints: ['Hashmap + Doubly Linked List design', 'O(1) capacity eviction'] },
        q2: { weight: 25, keyPoints: ['Avoids busy-wait spinloop', 'Uses event emitter or async queue'] },
        q3: { weight: 25, keyPoints: ['Evaluates CRDT vs OT tradeoffs', 'Clean delta sync format'] },
        q4: { weight: 25, keyPoints: ['Token bucket or sliding window algorithm', 'Redis pipeline/Lua atomicity'] },
      },
      maxScore: 100,
      passThreshold: 50,
    };

    return testRepo.create({
      user_id: params.userId,
      guild_id: params.guildId,
      field: params.field,
      questions: fallbackQuestions,
      rubric: fallbackRubric as unknown as Record<string, unknown>,
      timebox_minutes: timebox,
    });
  }
}

export const testGenerator = new TestGenerator();
