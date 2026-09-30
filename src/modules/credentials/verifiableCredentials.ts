import crypto from 'node:crypto';
import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface VerifiableCredentialRecord {
  id: string;
  tenant_id: string;
  recipient_id: string;
  credential_type: string;
  claims_json: string;
  signature_hex: string;
  issuer_did: string;
  issued_at: number;
  expires_at: number | null;
  is_revoked: number;
  revocation_reason: string | null;
}

export interface IssueCredentialOptions {
  recipientId: string;
  credentialType: 'skill_badge' | 'academy_diploma' | 'verified_freelancer' | 'escrow_champion';
  claims: Record<string, any>;
  expiresInDays?: number;
  issuerSecret?: string;
}

export interface VerificationResult {
  valid: boolean;
  isRevoked: boolean;
  isExpired: boolean;
  signatureMatch: boolean;
  credential?: {
    id: string;
    issuerDid: string;
    recipientId: string;
    type: string;
    claims: Record<string, any>;
    issuedAt: number;
    expiresAt: number | null;
  };
  error?: string;
}

export class VerifiableCredentialsService {
  private defaultIssuerSecret: string;

  constructor(defaultIssuerSecret = 'vc_nexus_issuer_master_key_99341') {
    this.defaultIssuerSecret = defaultIssuerSecret;
  }

  /**
   * REQ-23.11.1 & REQ-23.11.2: Issue cryptographically signed W3C-aligned Verifiable Credential
   */
  public issueCredential(
    tenantId: string,
    options: IssueCredentialOptions
  ): VerifiableCredentialRecord {
    const id = `urn:uuid:${cryptoRandomUUID()}`;
    const issuerDid = `did:nexus:tenant:${tenantId}`;
    const now = Date.now();
    const expiresAt = options.expiresInDays
      ? now + options.expiresInDays * 24 * 60 * 60 * 1000
      : null;

    // Canonical payload to sign
    const canonicalPayload = JSON.stringify({
      id,
      issuer: issuerDid,
      recipient: options.recipientId,
      type: options.credentialType,
      claims: options.claims,
      issuedAt: now,
      expiresAt
    });

    const secret = options.issuerSecret || this.defaultIssuerSecret;
    const signatureHex = crypto
      .createHmac('sha256', secret)
      .update(canonicalPayload)
      .digest('hex');

    const record: VerifiableCredentialRecord = {
      id,
      tenant_id: tenantId,
      recipient_id: options.recipientId,
      credential_type: options.credentialType,
      claims_json: JSON.stringify(options.claims),
      signature_hex: signatureHex,
      issuer_did: issuerDid,
      issued_at: now,
      expires_at: expiresAt,
      is_revoked: 0,
      revocation_reason: null
    };

    dbService.run(
      `INSERT INTO verifiable_credentials (
         id, tenant_id, recipient_id, credential_type, claims_json,
         signature_hex, issuer_did, issued_at, expires_at, is_revoked, revocation_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      record.id,
      record.tenant_id,
      record.recipient_id,
      record.credential_type,
      record.claims_json,
      record.signature_hex,
      record.issuer_did,
      record.issued_at,
      record.expires_at
    );

    return record;
  }

  /**
   * REQ-23.11.4: Verify credential integrity, signature, expiration, and revocation status
   */
  public verifyCredential(
    credentialId: string,
    issuerSecret?: string
  ): VerificationResult {
    const record = dbService.get<VerifiableCredentialRecord>(
      `SELECT * FROM verifiable_credentials WHERE id = ?`,
      credentialId
    );

    if (!record) {
      return {
        valid: false,
        isRevoked: false,
        isExpired: false,
        signatureMatch: false,
        error: 'Credential not found'
      };
    }

    const isRevoked = record.is_revoked === 1;
    const now = Date.now();
    const isExpired = record.expires_at !== null && now > record.expires_at;

    // Reconstruct canonical payload to verify signature
    const canonicalPayload = JSON.stringify({
      id: record.id,
      issuer: record.issuer_did,
      recipient: record.recipient_id,
      type: record.credential_type,
      claims: JSON.parse(record.claims_json),
      issuedAt: record.issued_at,
      expiresAt: record.expires_at
    });

    const secret = issuerSecret || this.defaultIssuerSecret;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(canonicalPayload)
      .digest('hex');

    const signatureMatch = record.signature_hex === expectedSig;
    const valid = !isRevoked && !isExpired && signatureMatch;

    return {
      valid,
      isRevoked,
      isExpired,
      signatureMatch,
      credential: {
        id: record.id,
        issuerDid: record.issuer_did,
        recipientId: record.recipient_id,
        type: record.credential_type,
        claims: JSON.parse(record.claims_json),
        issuedAt: record.issued_at,
        expiresAt: record.expires_at
      }
    };
  }

  /**
   * REQ-23.11.3: Revoke a credential and record reason in registry
   */
  public revokeCredential(
    credentialId: string,
    reason: string
  ): boolean {
    const res = dbService.run(
      `UPDATE verifiable_credentials
       SET is_revoked = 1, revocation_reason = ?
       WHERE id = ?`,
      reason,
      credentialId
    );
    return Number(res.changes) > 0;
  }

  /**
   * List credentials for a recipient
   */
  public getRecipientCredentials(tenantId: string, recipientId: string): VerifiableCredentialRecord[] {
    return dbService.all<VerifiableCredentialRecord>(
      `SELECT * FROM verifiable_credentials WHERE tenant_id = ? AND recipient_id = ? ORDER BY issued_at DESC`,
      tenantId,
      recipientId
    );
  }
}

export const verifiableCredentials = new VerifiableCredentialsService();
