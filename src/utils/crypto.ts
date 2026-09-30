import { randomUUID, createHash } from 'node:crypto';

export function cryptoRandomUUID(): string {
  return randomUUID();
}

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}
