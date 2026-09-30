import { dbService } from '../../database/connection.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface PanelEvaluation {
  reviewerId: string;
  codeQualityScore: number; // 0-25
  testCoverageScore: number; // 0-25
  architectureScore: number; // 0-25
  documentationScore: number; // 0-25
  comments: string;
}

export interface ProjectCertificationRecord {
  id: string;
  userId: string;
  projectTitle: string;
  repositoryUrl: string;
  panelReviews: PanelEvaluation[];
  finalScore: number;
  status: 'under_review' | 'certified' | 'revision_requested' | 'rejected';
}

export class ProjectCertificationEngine {
  /**
   * REQ-26.212: Submit project for blind panel review with conflict-of-interest exclusion
   */
  public submitProject(params: {
    userId: string;
    projectTitle: string;
    repositoryUrl: string;
  }): ProjectCertificationRecord {
    const id = `cert_${cryptoRandomUUID().substring(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO project_certifications (
         id, user_id, project_title, repository_url, blind_panel_json, final_score, status, created_at
       ) VALUES (?, ?, ?, ?, '[]', 0, 'under_review', ?)`,
      id,
      params.userId,
      params.projectTitle,
      params.repositoryUrl,
      now
    );

    return {
      id,
      userId: params.userId,
      projectTitle: params.projectTitle,
      repositoryUrl: params.repositoryUrl,
      panelReviews: [],
      finalScore: 0,
      status: 'under_review'
    };
  }

  public addPanelEvaluation(params: {
    certId: string;
    reviewerId: string;
    codeQualityScore: number;
    testCoverageScore: number;
    architectureScore: number;
    documentationScore: number;
    comments: string;
  }): { success: boolean; message: string; record?: ProjectCertificationRecord } {
    const cert = dbService.get<{
      id: string;
      user_id: string;
      project_title: string;
      repository_url: string;
      blind_panel_json: string;
      final_score: number;
      status: string;
    }>(`SELECT * FROM project_certifications WHERE id = ?`, params.certId);

    if (!cert) return { success: false, message: 'Certification project not found.' };

    // Conflict of interest: Reviewer cannot be author
    if (cert.user_id === params.reviewerId) {
      return { success: false, message: 'Conflict of interest: Authors cannot grade their own projects.' };
    }

    const reviews: PanelEvaluation[] = JSON.parse(cert.blind_panel_json || '[]');
    reviews.push({
      reviewerId: params.reviewerId,
      codeQualityScore: params.codeQualityScore,
      testCoverageScore: params.testCoverageScore,
      architectureScore: params.architectureScore,
      documentationScore: params.documentationScore,
      comments: params.comments
    });

    const sumTotal = reviews.reduce(
      (sum, r) => sum + r.codeQualityScore + r.testCoverageScore + r.architectureScore + r.documentationScore,
      0
    );
    const avgScore = Math.round((sumTotal / reviews.length) * 10) / 10;
    const status = avgScore >= 75 && reviews.length >= 2 ? 'certified' : 'under_review';

    dbService.run(
      `UPDATE project_certifications
       SET blind_panel_json = ?, final_score = ?, status = ?
       WHERE id = ?`,
      JSON.stringify(reviews),
      avgScore,
      status,
      params.certId
    );

    return {
      success: true,
      message: 'Evaluation submitted successfully.',
      record: {
        id: cert.id,
        userId: cert.user_id,
        projectTitle: cert.project_title,
        repositoryUrl: cert.repository_url,
        panelReviews: reviews,
        finalScore: avgScore,
        status: status as ProjectCertificationRecord['status']
      }
    };
  }
}

export const projectCertificationEngine = new ProjectCertificationEngine();
