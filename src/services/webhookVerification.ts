import crypto from 'crypto';

export class WebhookVerificationService {
  /**
   * Verifies Meta / Facebook Lead Webhook (SHA-256 HMAC).
   */
  public verifyMetaSignature(payload: string, signatureHeader: string, secret: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }
    const signature = signatureHeader.substring(7);
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }

  /**
   * Verifies GitHub Webhook (SHA-256 HMAC).
   */
  public verifyGitHubSignature(payload: string, signatureHeader: string, secret: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }
    const signature = signatureHeader.substring(7);
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }

  /**
   * Verifies Payment Webhook (e.g. Stripe) with timestamp replay protection.
   */
  public verifyPaymentSignatureWithReplayProtection(params: {
    payload: string;
    signatureHeader: string;
    secret: string;
    toleranceSeconds?: number;
  }): { valid: boolean; error?: string } {
    const { payload, signatureHeader, secret, toleranceSeconds = 300 } = params;

    // Header format: t=1612345678,v1=abcdef...
    const parts = signatureHeader.split(',');
    let timestampStr = '';
    let signatureStr = '';

    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k === 't') timestampStr = v;
      if (k === 'v1') signatureStr = v;
    }

    if (!timestampStr || !signatureStr) {
      return { valid: false, error: 'Malformed signature header: missing t or v1 component' };
    }

    const timestampSec = parseInt(timestampStr, 10);
    const nowSec = Math.floor(Date.now() / 1000);

    // Replay attack defense: reject if timestamp is older than tolerance (5 min)
    if (Math.abs(nowSec - timestampSec) > toleranceSeconds) {
      return { valid: false, error: 'Webhook rejected: timestamp outside allowed replay tolerance window' };
    }

    const signedPayload = `${timestampStr}.${payload}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    const isValid = crypto.timingSafeEqual(Buffer.from(signatureStr, 'hex'), Buffer.from(expected, 'hex'));
    return { valid: isValid, error: isValid ? undefined : 'HMAC signature mismatch' };
  }
}

export const webhookVerificationService = new WebhookVerificationService();
