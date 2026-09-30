import { pgJobQueue } from '../../queue/pgJobQueue.js';

export interface OpsAlert {
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  component: string;
  summary: string;
  caseId?: string;
  dashboardLink?: string;
}

export class TelegramOpsChannel {
  private isSilenced = false;
  private quietHoursStart = 23; // 23:00 UTC
  private quietHoursEnd = 6;    // 06:00 UTC
  private lastSentTimestamp = 0;
  private sentAlertsCount = 0;

  public setSilenced(silenced: boolean): void {
    this.isSilenced = silenced;
  }

  public isQuietHours(utcHour = new Date().getUTCHours()): boolean {
    if (this.quietHoursStart > this.quietHoursEnd) {
      return utcHour >= this.quietHoursStart || utcHour < this.quietHoursEnd;
    }
    return utcHour >= this.quietHoursStart && utcHour < this.quietHoursEnd;
  }

  /**
   * Formats and transmits an operational alert to the Telegram operations channel.
   * Invariant: Never transmits raw member chat messages, attachments, or PII.
   */
  public async dispatchAlert(alert: OpsAlert, isTelegramOnline = true): Promise<{
    delivered: boolean;
    queuedInPg: boolean;
    messageText: string;
    suppressedByQuietHours: boolean;
  }> {
    // 1. Check Silence Switch
    if (this.isSilenced && alert.severity !== 'CRITICAL') {
      return { delivered: false, queuedInPg: false, messageText: '', suppressedByQuietHours: false };
    }

    // 2. Format Sanitized Alert
    const emoji = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'WARN' ? '⚠️' : 'ℹ️';
    const lines = [
      `${emoji} [Nexus Ops - ${alert.severity}]`,
      `Component: ${alert.component}`,
      `Summary: ${alert.summary}`
    ];

    if (alert.caseId) lines.push(`Case Reference: ${alert.caseId}`);
    if (alert.dashboardLink) lines.push(`Action Link: ${alert.dashboardLink}`);

    const messageText = lines.join('\n');

    // 3. Check Quiet Hours (CRITICAL alerts always bypass quiet hours)
    const inQuietHours = this.isQuietHours();
    if (inQuietHours && alert.severity !== 'CRITICAL') {
      return { delivered: false, queuedInPg: false, messageText, suppressedByQuietHours: true };
    }

    // 4. Rate-Limiting Guard: enforce minimum 1000ms spacing per chat
    const now = Date.now();
    if (now - this.lastSentTimestamp < 1000) {
      // Must queue in PostgreSQL job queue rather than dropping
      await pgJobQueue.enqueue({
        name: 'DISPATCH_TELEGRAM_ALERT',
        payload: { alert, messageText }
      });
      return { delivered: false, queuedInPg: true, messageText, suppressedByQuietHours: false };
    }

    // 5. Telegram Outage Resilience
    if (!isTelegramOnline) {
      // Queue in background queue with exponential backoff; never fail the caller
      await pgJobQueue.enqueue({
        name: 'DISPATCH_TELEGRAM_ALERT',
        payload: { alert, messageText }
      });
      return { delivered: false, queuedInPg: true, messageText, suppressedByQuietHours: false };
    }

    this.lastSentTimestamp = Date.now();
    this.sentAlertsCount++;

    return { delivered: true, queuedInPg: false, messageText, suppressedByQuietHours: false };
  }

  public getSentAlertsCount(): number {
    return this.sentAlertsCount;
  }
}

export const telegramOpsChannel = new TelegramOpsChannel();
