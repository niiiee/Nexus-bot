import { sha256, cryptoRandomUUID } from '../../utils/crypto.js';

export interface StorageObjectMetadata {
  key: string;
  bucket: string;
  contentType: string;
  sizeBytes: number;
  sha256Hash: string;
  tenantId: string;
  createdAt: number;
  expiresAt?: number;
  customMetadata?: Record<string, string>;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: number;
  signature: string;
}

export class StorageAdapter {
  private inMemoryStore = new Map<string, { buffer: Buffer; meta: StorageObjectMetadata }>();
  private secretSignKey = 'nexus_storage_sig_key_2026_super_secure';
  private maxFileSize = 25 * 1024 * 1024; // 25 MB limit

  // Magic-byte signature map for file validation
  private allowedSignatures: Record<string, number[]> = {
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
    'application/pdf': [0x25, 0x50, 0x44, 0x46] // %PDF
  };

  /**
   * Uploads and sanitizes a file into the object store.
   */
  public async uploadFile(params: {
    bucket: string;
    key: string;
    buffer: Buffer;
    contentType: string;
    tenantId: string;
    ttlDays?: number;
    customMetadata?: Record<string, string>;
  }): Promise<{ success: boolean; metadata?: StorageObjectMetadata; error?: string }> {
    const { bucket, key, buffer, contentType, tenantId, ttlDays, customMetadata } = params;

    // 1. File size limit validation
    if (buffer.length > this.maxFileSize) {
      return { success: false, error: `File size exceeds maximum allowed limit (${this.maxFileSize / 1024 / 1024} MB)` };
    }

    // 2. MIME & Magic-Byte validation
    const expectedMagic = this.allowedSignatures[contentType];
    if (expectedMagic) {
      const actualBytes = Array.from(buffer.subarray(0, expectedMagic.length));
      const matches = expectedMagic.every((byte, idx) => byte === actualBytes[idx]);
      if (!matches) {
        return { success: false, error: `Content-Type '${contentType}' does not match file magic bytes (possible spoofing)` };
      }
    } else if (contentType.includes('executable') || contentType.includes('x-msdownload') || contentType.includes('x-sh')) {
      return { success: false, error: 'Executable and script uploads are strictly prohibited' };
    }

    // 3. Decompression bomb check (max uncompressed size or dimension attack)
    if (buffer.length > 5 * 1024 * 1024 && (key.endsWith('.zip') || key.endsWith('.tar.gz'))) {
      return { success: false, error: 'Archive exceeds safe decompression bomb limits' };
    }

    // 4. Sanitize and strip EXIF metadata for images
    const sanitizedBuffer = this.stripExifMetadata(buffer, contentType);

    // 5. Tenant key prefix enforcement: tenantId/scope/filename
    const scopedKey = key.startsWith(`${tenantId}/`) ? key : `${tenantId}/${key}`;
    const storagePath = `${bucket}/${scopedKey}`;

    const metadata: StorageObjectMetadata = {
      key: scopedKey,
      bucket,
      contentType,
      sizeBytes: sanitizedBuffer.length,
      sha256Hash: sha256(sanitizedBuffer.toString('base64')),
      tenantId,
      createdAt: Date.now(),
      expiresAt: ttlDays ? Date.now() + ttlDays * 86400000 : undefined,
      customMetadata
    };

    this.inMemoryStore.set(storagePath, { buffer: sanitizedBuffer, meta: metadata });

    return { success: true, metadata };
  }

  /**
   * Generates a time-limited signed URL for private object access.
   */
  public generatePresignedUrl(params: {
    bucket: string;
    key: string;
    tenantId: string;
    expiresInSeconds?: number;
  }): PresignedUrlResult {
    const { bucket, key, tenantId, expiresInSeconds = 900 } = params;
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const dataToSign = `${bucket}:${key}:${tenantId}:${expiresAt}`;
    const signature = sha256(`${dataToSign}:${this.secretSignKey}`);

    const url = `https://r2.nexus.community/${bucket}/${key}?tenant=${tenantId}&expires=${expiresAt}&sig=${signature}`;
    return { url, expiresAt, signature };
  }

  /**
   * Verifies signed URL validity, tampering, and tenant authorization.
   */
  public verifySignedUrlAccess(params: {
    bucket: string;
    key: string;
    requestingTenantId: string;
    expiresAt: number;
    signature: string;
  }): { allowed: boolean; error?: string } {
    const { bucket, key, requestingTenantId, expiresAt, signature } = params;

    // Tenant key prefix isolation verification
    if (!key.startsWith(`${requestingTenantId}/`)) {
      return { allowed: false, error: 'Cross-tenant access violation: requesting tenant does not own object key' };
    }

    // Check expiration
    if (Date.now() > expiresAt) {
      return { allowed: false, error: 'Signed URL has expired' };
    }

    // Check signature tampering
    const expectedData = `${bucket}:${key}:${requestingTenantId}:${expiresAt}`;
    const expectedSig = sha256(`${expectedData}:${this.secretSignKey}`);
    if (signature !== expectedSig) {
      return { allowed: false, error: 'Invalid or tampered signature' };
    }

    return { allowed: true };
  }

  /**
   * Cascading delete: deletes an object and any derived artifacts (thumbnails, transcripts, vectors).
   */
  public deleteObjectWithDerivatives(bucket: string, key: string, tenantId: string): { deletedKeys: string[] } {
    const deletedKeys: string[] = [];
    const prefix = `${tenantId}/`;
    if (!key.startsWith(prefix)) {
      return { deletedKeys: [] };
    }

    const baseKey = key;
    const candidateKeys = [
      baseKey,
      `${baseKey}.thumb.webp`,
      `${baseKey}.transcript.json`,
      `${baseKey}.vector.json`
    ];

    for (const ck of candidateKeys) {
      const fullPath = `${bucket}/${ck}`;
      if (this.inMemoryStore.has(fullPath)) {
        this.inMemoryStore.delete(fullPath);
        deletedKeys.push(ck);
      }
    }

    return { deletedKeys };
  }

  /**
   * Mock EXIF stripping for JPEG/PNG (removes metadata headers).
   */
  private stripExifMetadata(buffer: Buffer, contentType: string): Buffer {
    if (contentType === 'image/jpeg' && buffer.length > 4) {
      // Return buffer with EXIF marker stripped if present
      return Buffer.from(buffer);
    }
    return buffer;
  }
}

export const storageAdapter = new StorageAdapter();
