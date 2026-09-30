import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { createHash } from 'node:crypto';

export interface CertificateRecord {
  id: string;
  userId: string;
  title: string;
  issuer: string;
  verificationSha256: string;
  issuedAt: number;
}

export class CourseCertificatesService {
  private salt = 'SeniorProgg_Academy_Verification_Salt_2026';

  /**
   * Issues a cryptographically verifiable certificate of completion.
   */
  public issueCertificate(params: {
    userId: string;
    title: string;
    issuer?: string;
  }): CertificateRecord {
    const id = cryptoRandomUUID();
    const issuedAt = Date.now();
    const issuer = params.issuer || 'Senior Progg Academy';

    // Compute deterministic verification hash
    const rawData = `${id}:${params.userId}:${params.title}:${issuer}:${issuedAt}:${this.salt}`;
    const verificationSha256 = createHash('sha256').update(rawData).digest('hex');

    dbService.run(
      `INSERT INTO certificates (id, user_id, title, issuer, verification_sha256, issued_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      params.userId,
      params.title,
      issuer,
      verificationSha256,
      issuedAt
    );

    logger.info(`[CourseCertificates] Certificate issued to ${params.userId}: "${params.title}" (Hash: ${verificationSha256.slice(0, 16)}...)`);

    return {
      id,
      userId: params.userId,
      title: params.title,
      issuer,
      verificationSha256,
      issuedAt,
    };
  }

  /**
   * Verifies the authenticity of a certificate using its SHA-256 hash or ID.
   */
  public verifyCertificate(hashOrId: string): {
    isValid: boolean;
    certificate?: CertificateRecord;
    message: string;
  } {
    const cert = dbService.get<{
      id: string;
      user_id: string;
      title: string;
      issuer: string;
      verification_sha256: string;
      issued_at: number;
    }>(
      `SELECT id, user_id, title, issuer, verification_sha256, issued_at FROM certificates 
       WHERE id = ? OR verification_sha256 = ?`,
      hashOrId,
      hashOrId
    );

    if (!cert) {
      return { isValid: false, message: 'Certificate not found or unverified.' };
    }

    // Verify hash integrity
    const rawData = `${cert.id}:${cert.user_id}:${cert.title}:${cert.issuer}:${cert.issued_at}:${this.salt}`;
    const expectedHash = createHash('sha256').update(rawData).digest('hex');

    if (expectedHash !== cert.verification_sha256) {
      return { isValid: false, message: 'Cryptographic hash mismatch. Certificate may have been tampered with.' };
    }

    return {
      isValid: true,
      certificate: {
        id: cert.id,
        userId: cert.user_id,
        title: cert.title,
        issuer: cert.issuer,
        verificationSha256: cert.verification_sha256,
        issuedAt: cert.issued_at,
      },
      message: 'Certificate is authentic and validly issued by Senior Progg Academy.',
    };
  }

  /**
   * Lists all certificates earned by a user.
   */
  public getUserCertificates(userId: string): CertificateRecord[] {
    const rows = dbService.all<{
      id: string;
      user_id: string;
      title: string;
      issuer: string;
      verification_sha256: string;
      issued_at: number;
    }>(`SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at DESC`, userId);

    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      issuer: r.issuer,
      verificationSha256: r.verification_sha256,
      issuedAt: r.issued_at,
    }));
  }

  /**
   * Formats a bilingual certificate card for Discord or LinkedIn sharing.
   */
  public formatCertificateCard(cert: CertificateRecord, locale: 'ar' | 'en' = 'ar'): string {
    const isAr = locale === 'ar';
    const dateStr = new Date(cert.issuedAt).toISOString().split('T')[0];

    if (isAr) {
      return [
        `🎓 **شهادة إتمام معتمدة — Senior Progg Academy**`,
        `تُشهد الأكاديمية بأن الزميل/ة <@${cert.userId}> قد أتم بنجاح متطلبات:`,
        `📜 **${cert.title}**`,
        `\n🏛️ جهة الاعتماد: **${cert.issuer}**`,
        `📅 تاريخ الإصدار: \`${dateStr}\``,
        `🔒 التوقيع الرقمي (SHA-256): \`${cert.verificationSha256.slice(0, 24)}...\``,
        `✅ رابط التحقق الفوري: \`/verify-cert ${cert.id}\``,
      ].join('\n');
    }

    return [
      `🎓 **Verified Certificate of Completion — Senior Progg Academy**`,
      `This certifies that <@${cert.userId}> has successfully fulfilled all criteria for:`,
      `📜 **${cert.title}**`,
      `\n🏛️ Issued by: **${cert.issuer}**`,
      `📅 Date: \`${dateStr}\``,
      `🔒 Verification Hash (SHA-256): \`${cert.verificationSha256.slice(0, 24)}...\``,
      `✅ Instant Verification: \`/verify-cert ${cert.id}\``,
    ].join('\n');
  }
}

export const courseCertificatesService = new CourseCertificatesService();
