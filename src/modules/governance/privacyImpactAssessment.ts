import { dbService } from '../../database/connection.js';

export interface DataCategoryItem {
  category: 'public_profile' | 'behavioral_telemetry' | 'direct_messages' | 'payment_metadata' | 'sensitive_pii';
  purpose: string;
  retentionDays: number;
  isConsentRequired: boolean;
  isThirdPartyShared: boolean;
}

export interface PrivacyAssessmentResult {
  moduleId: string;
  moduleName: string;
  dataCategories: DataCategoryItem[];
  retentionDays: number;
  riskScore: number; // 0 to 10
  isApproved: boolean;
  complianceFlags: string[];
  mitigations: string[];
}

export class PrivacyImpactAssessmentEngine {
  /**
   * REQ-26.273: Generate and audit Privacy Impact Assessment (PIA) for modules before deployment
   */
  public conductAssessment(params: {
    moduleId: string;
    moduleName: string;
    dataCategories: DataCategoryItem[];
    intendedRetentionDays: number;
  }): PrivacyAssessmentResult {
    const { moduleId, moduleName, dataCategories, intendedRetentionDays } = params;
    const complianceFlags: string[] = [];
    const mitigations: string[] = [];

    let riskScore = 1.0;

    for (const item of dataCategories) {
      if (item.category === 'sensitive_pii') {
        riskScore += 4.0;
        complianceFlags.push('Sensitive PII detected: Mandatory explicit affirmative consent checkbox required.');
        mitigations.push('Apply client-side hashing or masking before persistence.');
      } else if (item.category === 'payment_metadata') {
        riskScore += 2.5;
        complianceFlags.push('Financial metadata present: Enforce strict non-custodial external processor policy.');
        mitigations.push('Ensure PAN/CVV are never stored in bot database.');
      } else if (item.category === 'direct_messages') {
        riskScore += 3.0;
        complianceFlags.push('Direct Message access: Strict privacy boundaries prevent training AI on private DMs.');
        mitigations.push('Restrict processing to explicit opt-in tickets.');
      }

      if (item.retentionDays > 365) {
        riskScore += 1.5;
        complianceFlags.push(`Retention period (${item.retentionDays} days) exceeds 1-year data minimization guideline.`);
        mitigations.push('Implement automated scheduled purge job.');
      }

      if (item.isThirdPartyShared) {
        riskScore += 2.0;
        complianceFlags.push('Third-party sharing flagged: Vendor Data Protection Agreement (DPA) required.');
      }
    }

    const isApproved = riskScore <= 7.0 && !dataCategories.some((d) => d.category === 'sensitive_pii' && !d.isConsentRequired);

    // Persist into database
    dbService.run(
      `INSERT OR REPLACE INTO privacy_assessments (
         module_id, module_name, data_categories_json, retention_days, risk_score,
         mitigations_json, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      moduleId,
      moduleName,
      JSON.stringify(dataCategories),
      intendedRetentionDays,
      Math.min(10, Math.round(riskScore * 10) / 10),
      JSON.stringify(mitigations),
      isApproved ? 'approved' : 'blocked',
      Date.now()
    );

    return {
      moduleId,
      moduleName,
      dataCategories,
      retentionDays: intendedRetentionDays,
      riskScore: Math.min(10, Math.round(riskScore * 10) / 10),
      isApproved,
      complianceFlags,
      mitigations
    };
  }
}

export const privacyImpactAssessmentEngine = new PrivacyImpactAssessmentEngine();
