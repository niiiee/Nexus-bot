export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  timeoutMs?: number;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface BaseLLMProvider {
  name: string;
  isAvailable(): boolean;
  generateText(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  generateJSON<T = Record<string, unknown>>(messages: LLMMessage[], options?: LLMOptions): Promise<T>;
}
