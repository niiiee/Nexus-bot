import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface EncryptedPayload {
  iv: string; // hex
  tag: string; // hex
  data: string; // hex
}

export class LeadCrypto {
  private stagingKey: Buffer;
  private registryKey: Buffer;
  private salt: string;

  constructor() {
    // Derive secure 256-bit keys from environment or generated master secrets
    const baseSecret = env.SESSION_SECRET || 'nexus_secure_lead_staging_default_secret_32_bytes_min!';
    this.salt = crypto.createHash('sha256').update(baseSecret + '_salt').digest('hex').slice(0, 16);
    this.stagingKey = crypto.scryptSync(baseSecret + '_staging', this.salt, 32);
    this.registryKey = crypto.scryptSync(baseSecret + '_registry', this.salt, 32);
  }

  /**
   * Set custom staging encryption key (for key rotation or test isolation)
   */
  public setStagingKey(keyHexOrSecret: string): void {
    if (keyHexOrSecret.length === 64) {
      this.stagingKey = Buffer.from(keyHexOrSecret, 'hex');
    } else {
      this.stagingKey = crypto.scryptSync(keyHexOrSecret, this.salt, 32);
    }
  }

  /**
   * Salted SHA-256 hash for deduplication and audit logging without storing raw PII
   */
  public hashIdentifier(identifier: string): string {
    return crypto
      .createHmac('sha256', this.salt)
      .update(identifier.trim().toLowerCase())
      .digest('hex');
  }

  /**
   * Encrypt text using AES-256-GCM with random IV and authentication tag
   */
  public encrypt(plainText: string, keyType: 'staging' | 'registry' = 'staging'): string {
    const key = keyType === 'staging' ? this.stagingKey : this.registryKey;
    const iv = crypto.randomBytes(12); // 96-bit standard IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex'),
    };

    return JSON.stringify(payload);
  }

  /**
   * Decrypt AES-256-GCM encrypted payload
   */
  public decrypt(cipherJson: string, keyType: 'staging' | 'registry' = 'staging'): string {
    try {
      const payload: EncryptedPayload = JSON.parse(cipherJson);
      const key = keyType === 'staging' ? this.stagingKey : this.registryKey;
      const iv = Buffer.from(payload.iv, 'hex');
      const tag = Buffer.from(payload.tag, 'hex');
      const encryptedData = Buffer.from(payload.data, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (err) {
      logger.error('[LeadCrypto] Decryption failed (invalid key or corrupted tag):', err);
      throw new Error('Decryption failed: cryptographic integrity check failure.');
    }
  }

  /**
   * Rotate encryption key: re-encrypts ciphertext with new key
   */
  public rotateCiphertext(cipherJson: string, oldKeySecret: string, newKeySecret: string): string {
    const oldKey = oldKeySecret.length === 64
      ? Buffer.from(oldKeySecret, 'hex')
      : crypto.scryptSync(oldKeySecret, this.salt, 32);

    const newKey = newKeySecret.length === 64
      ? Buffer.from(newKeySecret, 'hex')
      : crypto.scryptSync(newKeySecret, this.salt, 32);

    // Decrypt with old key
    const payload: EncryptedPayload = JSON.parse(cipherJson);
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    const encryptedData = Buffer.from(payload.data, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', oldKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');

    // Re-encrypt with new key
    const newIv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', newKey, newIv);
    const reEncrypted = Buffer.concat([cipher.update(decrypted, 'utf8'), cipher.final()]);
    const newTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: newIv.toString('hex'),
      tag: newTag.toString('hex'),
      data: reEncrypted.toString('hex'),
    });
  }
}

export const leadCrypto = new LeadCrypto();
