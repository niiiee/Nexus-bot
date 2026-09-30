import { BaseLLMProvider, LLMMessage, LLMOptions, LLMResponse } from './baseProvider.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('OpenAIProvider');

export class OpenAIProvider implements BaseLLMProvider {
  public name = 'openai';
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = env.OPENAI_API_KEY;
  }

  public isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 5 && !this.apiKey.startsWith('mock_');
  }

  public async generateText(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key is not configured or invalid');
    }

    const payload = {
      model: 'gpt-4o-mini',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
      response_format: options?.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('OpenAI API request failed', { status: response.status, body: errText });
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      provider: 'openai',
      model: data.model || 'gpt-4o-mini',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  public async generateJSON<T = Record<string, unknown>>(messages: LLMMessage[], options?: LLMOptions): Promise<T> {
    const res = await this.generateText(messages, { ...options, responseFormat: 'json' });
    try {
      return JSON.parse(res.content) as T;
    } catch (e) {
      const match = res.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]) as T;
      throw new Error(`Failed to parse JSON response from OpenAI: ${(e as Error).message}`);
    }
  }
}
