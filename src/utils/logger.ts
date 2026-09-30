import { env } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Patterns for redacting sensitive credentials and PII
const SENSITIVE_PATTERNS = [
  /([a-zA-Z0-9_-]{24,}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,})/g, // Discord Bot Token
  /(AIzaSy[a-zA-Z0-9_-]{33})/g,                                    // Google Gemini API Key
  /(sk-[a-zA-Z0-9]{32,})/g,                                        // OpenAI API Key
  /(sk-ant-[a-zA-Z0-9_-]{32,})/g,                                  // Anthropic Key
  /("?(password|secret|token|apiKey)"?\s*[:=]\s*"?[^"'\s,]+"?)/gi,
];

export function redactSensitiveData(input: string): string {
  let sanitized = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }
  return sanitized;
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    const currentWeight = LEVEL_WEIGHTS[env.LOG_LEVEL as LogLevel] || LEVEL_WEIGHTS.info;
    return LEVEL_WEIGHTS[level] >= currentWeight;
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...(meta ? { meta } : {}),
    };

    const rawString = JSON.stringify(payload);
    return redactSensitiveData(rawString);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      const errorMeta = {
        ...meta,
        ...(error instanceof Error
          ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
          : { error }),
      };
      console.error(this.formatMessage('error', message, errorMeta));
    }
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}

export const logger = {
  debug: (contextOrMsg: string, message?: unknown, meta?: Record<string, unknown>) =>
    message !== undefined
      ? createLogger(contextOrMsg).debug(String(message), meta)
      : createLogger('App').debug(contextOrMsg),
  info: (contextOrMsg: string, message?: unknown, meta?: Record<string, unknown>) =>
    message !== undefined
      ? createLogger(contextOrMsg).info(String(message), meta)
      : createLogger('App').info(contextOrMsg),
  warn: (contextOrMsg: string, message?: unknown, meta?: Record<string, unknown>) =>
    message !== undefined
      ? createLogger(contextOrMsg).warn(String(message), meta)
      : createLogger('App').warn(contextOrMsg),
  error: (contextOrMsg: string, messageOrErr?: unknown, error?: unknown, meta?: Record<string, unknown>) => {
    if (typeof messageOrErr === 'string') {
      return createLogger(contextOrMsg).error(messageOrErr, error, meta);
    }
    return createLogger('App').error(contextOrMsg, messageOrErr, meta);
  },
};
