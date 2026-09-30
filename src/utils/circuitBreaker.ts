import { createLogger } from './logger.js';

const logger = createLogger('CircuitBreaker');

export interface CircuitBreakerOptions {
  failureThreshold?: number; // consecutive failures before opening
  recoveryTimeMs?: number;   // ms before attempting half-open state
  timeoutMs?: number;        // max call execution time
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private name: string;
  private failureThreshold: number;
  private recoveryTimeMs: number;
  private timeoutMs: number;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: CircuitState = 'CLOSED';

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeMs = options.recoveryTimeMs ?? 30000; // 30s
    this.timeoutMs = options.timeoutMs ?? 10000;          // 10s
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.recoveryTimeMs) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit ${this.name} transitioned to HALF_OPEN`);
      }
    }
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      logger.warn(`Circuit ${this.name} is OPEN. Rejecting execution.`);
      if (fallback) {
        return fallback();
      }
      throw new Error(`Circuit ${this.name} is OPEN: service temporarily unavailable`);
    }

    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Execution timed out after ${this.timeoutMs}ms on circuit ${this.name}`));
        }, this.timeoutMs);
      });

      const result = await Promise.race([action(), timeoutPromise]);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      if (fallback) {
        logger.info(`Invoking fallback for circuit ${this.name}`);
        return fallback();
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info(`Circuit ${this.name} recovered to CLOSED state.`);
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(err: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    logger.warn(`Circuit ${this.name} failure #${this.failureCount}: ${(err as Error).message}`);

    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.error(`Circuit ${this.name} tripped to OPEN state!`);
    }
  }

  public reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}
