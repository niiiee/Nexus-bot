import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

export const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().default('123456789012345678'),
  DISCORD_CLIENT_SECRET: z.string().default('mock_secret'),
  DISCORD_REDIRECT_URI: z.string().url().default('http://localhost:3000/auth/discord/callback'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().default('mock_telegram_token'),
  TELEGRAM_BACKUP_CHANNEL_ID: z.string().default('-1001234567890'),

  // AI Providers
  LLM_PROVIDER: z.enum(['gemini', 'openai', 'anthropic', 'mock']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Database & Server
  DATABASE_URL: z.string().default(':memory:'),
  PORT: z.coerce.number().default(3000),
  SESSION_SECRET: z.string().min(16).default('development_super_secret_session_key_32_chars'),
  DASHBOARD_URL: z.string().url().default('http://localhost:3000'),

  // Security & Limits
  SANDBOX_TIMEOUT_MS: z.coerce.number().default(5000),
  MAX_CODE_MEMORY_MB: z.coerce.number().default(128),
  ENABLE_ANTI_RAID: z.coerce.boolean().default(true),

  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const missing = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error(`❌ [Config Error] Invalid environment configuration: ${missing}`);
  }
  // Provide safe fallback in test environment
  if (process.env.NODE_ENV === 'test') {
    parsedEnv = envSchema.parse({
      DISCORD_TOKEN: 'mock_test_token',
      DATABASE_URL: ':memory:',
      NODE_ENV: 'test',
    });
  } else {
    throw error;
  }
}

export const env = parsedEnv;
