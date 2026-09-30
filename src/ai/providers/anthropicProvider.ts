import { BaseLLMProvider, LLMMessage, LLMOptions, LLMResponse } from './baseProvider.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('AnthropicProvider');

export class AnthropicProvider implements BaseLLMProvider {
  public name = 'anthropic';
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = env.ANTHROPIC_API_KEY;
  }

  public isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 5 && !this.apiKey.startsWith('mock_');
  }

  public async generateText(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key is not configured or invalid');
    }

    const systemPrompt = messages.find(m => m.role === 'system')?.content;
    const conversation = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const payload = {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      system: systemPrompt,
      messages: conversation,
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Anthropic API request failed', { status: response.status, body: errText });
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as any;
    const content = data.content?.[0]?.text || '';

    return {
      content,
      provider: 'anthropic',
      model: data.model || 'claude-3-5-haiku',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }

  public async generateJSON<T = Record<string, unknown>>(messages: LLMMessage[], options?: LLMOptions): Promise<T> {
    const res = await this.generateText(messages, options);
    try {
      return JSON.parse(res.content) as T;
    } catch (e) {
      const match = res.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]) as T;
      throw new Error(`Failed to parse JSON response from Anthropic: ${(e as Error).message}`);
    }
  }
}
