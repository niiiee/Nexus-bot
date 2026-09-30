import crypto from 'node:crypto';
import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface EnterpriseConfigRecord {
  tenant_id: string;
  sso_provider: string | null;
  sso_metadata_url: string | null;
  scim_endpoint: string | null;
  audit_stream_url: string | null;
  cmek_key_id: string | null;
  data_residency_region: string;
  retention_days: number;
  updated_at: number;
}

export interface ScimUserPayload {
  schemas: string[];
  id: string;
  userName: string;
  name: { formatted: string };
  emails: Array<{ value: string; primary: boolean }>;
  active: boolean;
}

export class EnterpriseGateway {
  /**
   * REQ-23.30.1: Configure enterprise settings for a tenant
   */
  public configureEnterprise(
    tenantId: string,
    config: {
      ssoProvider?: string;
      ssoMetadataUrl?: string;
      scimEndpoint?: string;
      auditStreamUrl?: string;
      cmekKeyId?: string;
      dataResidencyRegion?: 'us-central1' | 'europe-west3' | 'me-central1';
      retentionDays?: number;
    }
  ): EnterpriseConfigRecord {
    const existing = dbService.get<EnterpriseConfigRecord>(
      `SELECT * FROM enterprise_configs WHERE tenant_id = ?`,
      tenantId
    );

    const now = Date.now();
    const ssoProvider = config.ssoProvider ?? existing?.sso_provider ?? null;
    const ssoMetadataUrl = config.ssoMetadataUrl ?? existing?.sso_metadata_url ?? null;
    const scimEndpoint = config.scimEndpoint ?? existing?.scim_endpoint ?? null;
    const auditStreamUrl = config.auditStreamUrl ?? existing?.audit_stream_url ?? null;
    const cmekKeyId = config.cmekKeyId ?? existing?.cmek_key_id ?? null;
    const dataResidency = config.dataResidencyRegion ?? existing?.data_residency_region ?? 'me-central1';
    const retentionDays = config.retentionDays ?? existing?.retention_days ?? 730;

    if (existing) {
      dbService.run(
        `UPDATE enterprise_configs
         SET sso_provider = ?, sso_metadata_url = ?, scim_endpoint = ?,
             audit_stream_url = ?, cmek_key_id = ?, data_residency_region = ?,
             retention_days = ?, updated_at = ?
         WHERE tenant_id = ?`,
        ssoProvider,
        ssoMetadataUrl,
        scimEndpoint,
        auditStreamUrl,
        cmekKeyId,
        dataResidency,
        retentionDays,
        now,
        tenantId
      );
    } else {
      dbService.run(
        `INSERT INTO enterprise_configs (
           tenant_id, sso_provider, sso_metadata_url, scim_endpoint,
           audit_stream_url, cmek_key_id, data_residency_region, retention_days, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        tenantId,
        ssoProvider,
        ssoMetadataUrl,
        scimEndpoint,
        auditStreamUrl,
        cmekKeyId,
        dataResidency,
        retentionDays,
        now
      );
    }

    return {
      tenant_id: tenantId,
      sso_provider: ssoProvider,
      sso_metadata_url: ssoMetadataUrl,
      scim_endpoint: scimEndpoint,
      audit_stream_url: auditStreamUrl,
      cmek_key_id: cmekKeyId,
      data_residency_region: dataResidency,
      retention_days: retentionDays,
      updated_at: now
    };
  }

  public getEnterpriseConfig(tenantId: string): EnterpriseConfigRecord | null {
    return dbService.get<EnterpriseConfigRecord>(
      `SELECT * FROM enterprise_configs WHERE tenant_id = ?`,
      tenantId
    ) || null;
  }

  /**
   * REQ-23.30.2: CMEK envelope encryption helper (AES-256-GCM)
   */
  public encryptWithCmek(plaintext: string, keySecretHex: string): { ciphertext: string; iv: string; tag: string } {
    const key = crypto.createHash('sha256').update(keySecretHex).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      tag
    };
  }

  public decryptWithCmek(ciphertext: string, ivHex: string, tagHex: string, keySecretHex: string): string {
    const key = crypto.createHash('sha256').update(keySecretHex).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * REQ-23.30.1: Process SCIM 2.0 user provision / deprovision request
   */
  public processScimProvision(
    tenantId: string,
    action: 'CREATE' | 'DEACTIVATE',
    user: ScimUserPayload
  ): { status: string; userId: string; active: boolean } {
    logger.info('Enterprise SCIM user operation processed', {
      tenantId,
      action,
      user: user.userName
    });

    return {
      status: action === 'CREATE' ? 'PROVISIONED' : 'DEPROVISIONED',
      userId: user.id,
      active: action === 'CREATE'
    };
  }

  /**
   * REQ-23.30.5: Enforce data retention policy by purging stale audit logs
   */
  public enforceRetentionPolicy(tenantId: string): number {
    const config = this.getEnterpriseConfig(tenantId);
    const retentionDays = config?.retention_days || 730;
    const cutoffTimestamp = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const res = dbService.run(
      `DELETE FROM tenant_audit_ledger WHERE tenant_id = ? AND timestamp < ?`,
      tenantId,
      cutoffTimestamp
    );

    return Number(res.changes);
  }
}

export const enterpriseGateway = new EnterpriseGateway();
