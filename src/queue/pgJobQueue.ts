import { dbService } from '../database/connection.js';
import { cryptoRandomUUID } from '../utils/crypto.js';

export interface JobRecord<T = Record<string, unknown>> {
  id: string;
  name: string;
  payload: T;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'dead_letter';
  attempts: number;
  maxAttempts: number;
  idempotencyKey?: string;
  scheduledAt: number;
  createdAt: number;
  lastError?: string;
}

export class PgJobQueue {
  private inMemoryQueue: Map<string, JobRecord> = new Map();
  private idempotencyRegistry: Set<string> = new Set();
  private isDraining = false;

  public async enqueue<T extends Record<string, unknown>>(params: {
    name: string;
    payload: T;
    idempotencyKey?: string;
    delayMs?: number;
    maxAttempts?: number;
  }): Promise<{ enqueued: boolean; jobId: string; isDuplicate: boolean }> {
    const { name, payload, idempotencyKey, delayMs = 0, maxAttempts = 5 } = params;

    // 1. Idempotency Check
    if (idempotencyKey) {
      if (this.idempotencyRegistry.has(idempotencyKey)) {
        return { enqueued: false, jobId: '', isDuplicate: true };
      }
      this.idempotencyRegistry.add(idempotencyKey);
    }

    const id = `job_${cryptoRandomUUID().substring(0, 8)}`;
    const job: JobRecord = {
      id,
      name,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      idempotencyKey,
      scheduledAt: Date.now() + delayMs,
      createdAt: Date.now()
    };

    this.inMemoryQueue.set(id, job);

    return { enqueued: true, jobId: id, isDuplicate: false };
  }

  public async processNext(
    handler: (job: JobRecord) => Promise<boolean>
  ): Promise<{ processed: boolean; status?: string; error?: string }> {
    if (this.isDraining) {
      return { processed: false, error: 'Queue is draining for graceful shutdown' };
    }

    const now = Date.now();
    let eligibleJob: JobRecord | undefined;

    for (const job of this.inMemoryQueue.values()) {
      if (job.status === 'pending' && job.scheduledAt <= now) {
        eligibleJob = job;
        break;
      }
    }

    if (!eligibleJob) {
      return { processed: false };
    }

    eligibleJob.status = 'running';
    eligibleJob.attempts++;

    try {
      const success = await handler(eligibleJob);
      if (success) {
        eligibleJob.status = 'completed';
        return { processed: true, status: 'completed' };
      } else {
        throw new Error('Handler returned failure status');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      eligibleJob.lastError = errMsg;

      if (eligibleJob.attempts >= eligibleJob.maxAttempts) {
        eligibleJob.status = 'dead_letter';
        return { processed: true, status: 'dead_letter', error: errMsg };
      } else {
        // Exponential backoff: 2^(attempts) * 1000ms
        const backoffMs = Math.pow(2, eligibleJob.attempts) * 1000;
        eligibleJob.status = 'pending';
        eligibleJob.scheduledAt = Date.now() + backoffMs;
        return { processed: true, status: 'retry_scheduled', error: errMsg };
      }
    }
  }

  public startDrain(): void {
    this.isDraining = true;
  }

  public getJob(jobId: string): JobRecord | undefined {
    return this.inMemoryQueue.get(jobId);
  }

  public getQueueDepth(): { pending: number; running: number; deadLetter: number } {
    let pending = 0;
    let running = 0;
    let deadLetter = 0;

    for (const j of this.inMemoryQueue.values()) {
      if (j.status === 'pending') pending++;
      else if (j.status === 'running') running++;
      else if (j.status === 'dead_letter') deadLetter++;
    }

    return { pending, running, deadLetter };
  }
}

export const pgJobQueue = new PgJobQueue();
