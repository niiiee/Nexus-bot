import { describe, it, expect } from 'vitest';
import { aiOrchestrator } from '../../src/ai/orchestrator.js';
import { personalityEngine } from '../../src/ai/personality/personalityEngine.js';
import { memorySystem } from '../../src/ai/memory/memorySystem.js';
import { knowledgeBase } from '../../src/ai/rag/knowledgeBase.js';
import { detectLanguage } from '../../src/utils/i18n.js';

describe('Central AI Brain Architecture', () => {
  it('classifies intents accurately', () => {
    const techQuery = aiOrchestrator.classifyIntent('How to debug memory leak in Node.js?');
    expect(techQuery.intent).toBe('technical_question');

    const banterQuery = aiOrchestrator.classifyIntent('Roast my code يا باشا!');
    expect(banterQuery.intent).toBe('playful_banter');

    const disputeQuery = aiOrchestrator.classifyIntent('I want to open a dispute regarding this deal');
    expect(disputeQuery.intent).toBe('dispute_resolution');
  });

  it('generates text using primary or fallback provider', async () => {
    const res = await aiOrchestrator.generateText([
      { role: 'user', content: 'Explain how to handle promise errors in typescript' },
    ]);
    expect(res.content).toBeDefined();
    expect(res.content.length).toBeGreaterThan(10);
  });

  it('generates structured JSON for vetting, tests, and grading', async () => {
    const vettingRes = await aiOrchestrator.generateJSON<{ questions: string[] }>([
      { role: 'system', content: 'Generate vetting questions' },
      { role: 'user', content: 'Candidate claims 4 years backend dev' },
    ]);
    expect(vettingRes.questions).toBeDefined();
    expect(vettingRes.questions.length).toBeGreaterThanOrEqual(1);

    const testRes = await aiOrchestrator.generateJSON<{ hiddenRubric: { passThreshold: number } }>([
      { role: 'system', content: 'Generate skill test with rubric' },
      { role: 'user', content: 'Candidate claims senior architecture' },
    ]);
    expect(testRes.hiddenRubric.passThreshold).toBe(50);
  });

  it('provides bilingual persona with Egyptian Arabic and English support', () => {
    const arPrompt = personalityEngine.getSystemPrompt('ar', { seniority: 'Junior', allowBanter: true });
    expect(arPrompt).toContain('سينور بروج');
    expect(arPrompt).toContain('يا باشا');

    const enPrompt = personalityEngine.getSystemPrompt('en', { seniority: 'Senior', allowBanter: false });
    expect(enPrompt).toContain('Senior Progg');
    expect(enPrompt).toContain('Disabled');
  });

  it('detects language accurately', () => {
    expect(detectLanguage('يا باشا الكود ضارب إيرور')).toBe('ar');
    expect(detectLanguage('How do I configure docker container')).toBe('en');
    expect(detectLanguage('السلام عليكم، عندي مشكلة في السيرفر')).toBe('ar');
  });

  it('stores and wipes short-term and long-term memory adhering to /mydata', () => {
    const userId = 'user_mem_123';
    memorySystem.addShortTermTurn(userId, 'user', 'I work mainly with Vue and Go');
    memorySystem.addShortTermTurn(userId, 'assistant', 'Got it, Vue and Go are great tools.');

    const history = memorySystem.getShortTermHistory(userId);
    expect(history.length).toBe(2);

    memorySystem.saveFact(userId, 'primary_stack', 'Vue + Go', 0.95);
    const facts = memorySystem.getFactsForUser(userId);
    expect(facts.length).toBe(1);
    expect(facts[0].fact_value).toBe('Vue + Go');

    // Wipe memory
    memorySystem.wipeAllMemory(userId);
    expect(memorySystem.getShortTermHistory(userId).length).toBe(0);
    expect(memorySystem.getFactsForUser(userId).length).toBe(0);
  });

  it('searches RAG knowledge base and cites sources without inventing', () => {
    const results = knowledgeBase.search('escrow deal payment');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('rules');
    expect(results[0].source).toContain('Server Rules');

    const ragContext = knowledgeBase.formatRAGContext('escrow');
    expect(ragContext).toContain('[Source:');
  });
});
