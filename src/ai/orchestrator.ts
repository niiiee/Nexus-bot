import { BaseLLMProvider, LLMMessage, LLMOptions, LLMResponse } from './providers/baseProvider.js';
import { GeminiProvider } from './providers/geminiProvider.js';
import { OpenAIProvider } from './providers/openaiProvider.js';
import { AnthropicProvider } from './providers/anthropicProvider.js';
import { MockLLMProvider } from './providers/mockProvider.js';
import { CircuitBreaker } from '../utils/circuitBreaker.js';
import { createLogger } from '../utils/logger.js';
import { env } from '../config/env.js';

const logger = createLogger('AIOrchestrator');

export type AIIntent =
  | 'technical_question'
  | 'general_chat'
  | 'playful_banter'
  | 'onboarding_interview'
  | 'vetting_eval'
  | 'test_grading'
  | 'dispute_resolution'
  | 'moderation_check';

export class AIOrchestrator {
  private providers: Map<string, BaseLLMProvider> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private primaryProviderName: string;

  public getActiveProviderName(): string {
    return this.primaryProviderName;
  }

  public setActiveProvider(name: string): void {
    if (this.providers.has(name)) {
      this.primaryProviderName = name;
    }
  }

  constructor() {
    this.primaryProviderName = env.LLM_PROVIDER;

    const gemini = new GeminiProvider();
    const openai = new OpenAIProvider();
    const anthropic = new AnthropicProvider();
    const mock = new MockLLMProvider();

    this.providers.set('gemini', gemini);
    this.providers.set('openai', openai);
    this.providers.set('anthropic', anthropic);
    this.providers.set('mock', mock);

    for (const [name] of this.providers) {
      this.circuitBreakers.set(name, new CircuitBreaker(`LLM_${name}`, { failureThreshold: 3, recoveryTimeMs: 15000 }));
    }

    logger.info(`AI Orchestrator initialized. Primary provider: ${this.primaryProviderName}`);
  }

  public classifyIntent(text: string): { intent: AIIntent; confidence: number } {
    const lower = text.toLowerCase();

    if (lower.includes('roast') || lower.includes('banter') || lower.includes('هزار') || lower.includes('روست')) {
      return { intent: 'playful_banter', confidence: 0.95 };
    }
    if (lower.includes('dispute') || lower.includes('نزاع') || lower.includes('مشكلة في الصفقة')) {
      return { intent: 'dispute_resolution', confidence: 0.88 };
    }
    if (lower.includes('spit') || lower.includes('scam') || lower.includes('free money') || lower.includes('pay to start')) {
      return { intent: 'moderation_check', confidence: 0.92 };
    }
    if (lower.includes('debug') || lower.includes('bug') || lower.includes('error') || lower.includes('code') || lower.includes('function') || lower.includes('typescript') || lower.includes('python')) {
      return { intent: 'technical_question', confidence: 0.9 };
    }

    return { intent: 'general_chat', confidence: 0.75 };
  }

  public async generateText(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const candidates = this.getProviderCandidates();

    for (const provider of candidates) {
      if (!provider.isAvailable()) continue;
      const cb = this.circuitBreakers.get(provider.name)!;

      try {
        return await cb.execute(() => provider.generateText(messages, options));
      } catch (err) {
        logger.warn(`Provider ${provider.name} failed text generation: ${(err as Error).message}. Attempting failover.`);
      }
    }

    // Ultimate fallback: Mock provider always succeeds
    logger.warn('All external LLM providers unavailable. Falling back to deterministic Mock Provider.');
    const mock = this.providers.get('mock')!;
    return mock.generateText(messages, options);
  }

  public async generateJSON<T = Record<string, unknown>>(messages: LLMMessage[], options?: LLMOptions): Promise<T> {
    const candidates = this.getProviderCandidates();

    for (const provider of candidates) {
      if (!provider.isAvailable()) continue;
      const cb = this.circuitBreakers.get(provider.name)!;

      try {
        return await cb.execute(() => provider.generateJSON<T>(messages, options));
      } catch (err) {
        logger.warn(`Provider ${provider.name} failed JSON generation: ${(err as Error).message}. Attempting failover.`);
      }
    }

    logger.warn('All external LLM providers unavailable for JSON. Falling back to Mock Provider.');
    const mock = this.providers.get('mock')!;
    return mock.generateJSON<T>(messages, options);
  }

  public async generateResponse(params: {
    prompt: string;
    userId?: string;
    guildId?: string;
    context?: string;
    options?: LLMOptions;
  }): Promise<{ text: string }> {
    const res = await this.generateText(
      [{ role: 'user', content: params.prompt }],
      params.options
    );
    return { text: res.content };
  }

  private getProviderCandidates(): BaseLLMProvider[] {
    const primary = this.providers.get(this.primaryProviderName);
    const result: BaseLLMProvider[] = [];

    if (primary && primary.isAvailable()) {
      result.push(primary);
    }

    // Add others in priority order
    for (const [name, p] of this.providers) {
      if (name !== this.primaryProviderName && name !== 'mock' && p.isAvailable()) {
        result.push(p);
      }
    }

    result.push(this.providers.get('mock')!);
    return result;
  }
}

export const aiOrchestrator = new AIOrchestrator();
