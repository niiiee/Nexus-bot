import { cryptoRandomUUID } from '../../utils/crypto.js';
import { dbService } from '../../database/connection.js';

export interface AuditorSession {
  token: string;
  auditorName: string;
  organization: string;
  expiresAt: number;
  maskedPiiCount: number;
  queriesExecuted: number;
  isActive: boolean;
}

export class AuditorGateway {
  /**
   * REQ-26.276: Generate time-limited, sandboxed read-only gateway with automated PII masking
   */
  public createAuditorSession(params: {
    auditorName: string;
    organization: string;
    durationHours?: number;
  }): AuditorSession {
    const { auditorName, organization, durationHours = 24 } = params;
    const token = `audit_${cryptoRandomUUID()}`;
    const expiresAt = Date.now() + durationHours * 3600 * 1000;

    dbService.run(
      `INSERT INTO auditor_sessions (
         token, auditor_name, organization, expires_at, masked_pii_count,
         queries_executed, is_active, created_at
       ) VALUES (?, ?, ?, ?, 0, 0, 1, ?)`,
      token,
      auditorName,
      organization,
      expiresAt,
      Date.now()
    );

    return {
      token,
      auditorName,
      organization,
      expiresAt,
      maskedPiiCount: 0,
      queriesExecuted: 0,
      isActive: true
    };
  }

  /**
   * Execute read-only query through the gateway with automatic PII masking
   */
  public executeAuditorQuery(token: string, sqlQuery: string): { success: boolean; data?: unknown[]; error?: string } {
    // 1. Validate session
    const session = dbService.get<{
      token: string;
      expires_at: number;
      is_active: number;
      masked_pii_count: number;
      queries_executed: number;
    }>(`SELECT * FROM auditor_sessions WHERE token = ?`, token);

    if (!session || session.is_active === 0) {
      return { success: false, error: 'Unauthorized: Invalid or revoked auditor token.' };
    }

    if (Date.now() > session.expires_at) {
      return { success: false, error: 'Unauthorized: Auditor session token expired.' };
    }

    // 2. Strict read-only query check
    const trimmed = sqlQuery.trim().toLowerCase();
    if (!trimmed.startsWith('select')) {
      return { success: false, error: 'Forbidden: Auditor gateway only permits read-only SELECT queries.' };
    }

    // 3. Execute query
    try {
      const rows = dbService.all<Record<string, unknown>>(sqlQuery);
      let maskedCount = 0;

      // 4. Automated PII Masking
      const sanitizedRows = rows.map((row) => {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === 'string') {
            const masked = this.maskPii(value);
            if (masked.wasMasked) maskedCount++;
            sanitized[key] = masked.text;
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      });

      // Update session statistics
      dbService.run(
        `UPDATE auditor_sessions
         SET queries_executed = queries_executed + 1,
             masked_pii_count = masked_pii_count + ?
         WHERE token = ?`,
        maskedCount,
        token
      );

      return { success: true, data: sanitizedRows };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  public maskPii(text: string): { text: string; wasMasked: boolean } {
    let masked = text;
    let wasMasked = false;

    // Mask emails
    const emailRegex = /([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/g;
    if (emailRegex.test(masked)) {
      wasMasked = true;
      masked = masked.replace(emailRegex, (match, user, domain, ext) => {
        return `${user.substring(0, 1)}***@${domain}.${ext}`;
      });
    }

    // Mask phone numbers (e.g. +2010... or 010...)
    const phoneRegex = /(?:\+?20|0)?1[0125][0-9]{8}/g;
    if (phoneRegex.test(masked)) {
      wasMasked = true;
      masked = masked.replace(phoneRegex, (match) => {
        return match.substring(0, 4) + '****' + match.substring(match.length - 2);
      });
    }

    // Mask potential token/secret strings
    const secretRegex = /(?:key|token|secret|password|bearer)\s*[:=]\s*([a-zA-Z0-9_\-]{16,})/gi;
    if (secretRegex.test(masked)) {
      wasMasked = true;
      masked = masked.replace(secretRegex, '[REDACTED_SECRET]');
    }

    return { text: masked, wasMasked };
  }

  public revokeSession(token: string): boolean {
    dbService.run(`UPDATE auditor_sessions SET is_active = 0 WHERE token = ?`, token);
    return true;
  }
}

export const auditorGateway = new AuditorGateway();
