import { describe, it, expect } from 'vitest';
import { envSchema } from '../../src/config/env.js';

describe('Config & Environment Parsing', () => {
  it('parses valid environment variables with defaults', () => {
    const parsed = envSchema.parse({
      DISCORD_TOKEN: 'test_token_123',
    });

    expect(parsed.DISCORD_TOKEN).toBe('test_token_123');
    expect(parsed.LLM_PROVIDER).toBe('mock');
    expect(parsed.PORT).toBe(3000);
    expect(parsed.SANDBOX_TIMEOUT_MS).toBe(5000);
    expect(parsed.DATABASE_URL).toBe(':memory:');
  });

  it('fails when DISCORD_TOKEN is missing', () => {
    expect(() => envSchema.parse({})).toThrow();
  });
});
