import { BaseLLMProvider, LLMMessage, LLMOptions, LLMResponse } from './baseProvider.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('GeminiProvider');

export class GeminiProvider implements BaseLLMProvider {
  public name = 'gemini';
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = env.GEMINI_API_KEY;
  }

  public isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 5 && !this.apiKey.startsWith('mock_');
  }

  public async generateText(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured or invalid');
    }

    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
    const payload = {
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 1024,
        responseMimeType: options?.responseFormat === 'json' ? 'application/json' : 'text/plain',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Gemini API request failed', { status: response.status, body: errText });
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as any;
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';

    return {
      content: text,
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  public async generateJSON<T = Record<string, unknown>>(messages: LLMMessage[], options?: LLMOptions): Promise<T> {
    const res = await this.generateText(messages, { ...options, responseFormat: 'json' });
    try {
      return JSON.parse(res.content) as T;
    } catch (e) {
      // Attempt clean regex parse if markdown block returned
      const match = res.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        return JSON.parse(match[1]) as T;
      }
      throw new Error(`Failed to parse JSON response from Gemini: ${(e as Error).message}`);
    }
  }
}
