import { dbService } from '../../database/connection.js';
import { dealRepo } from '../../database/repositories/dealRepo.js';
import { logger } from '../../utils/logger.js';
import { createHash, randomUUID } from 'crypto';

export interface MilestoneItem {
  id: string;
  title: string;
  amount: number;
  status: 'pending' | 'submitted' | 'approved' | 'disputed';
  submissionUrl?: string;
}

export interface DealAgreement {
  dealId: string;
  scope: string;
  deliverables: string[];
  milestones: MilestoneItem[];
  currency: string;
  totalAmount: number;
  deadline: string;
  revisionCap: number;
  cancellationTerms: string;
}

export class DealLifecycleService {
  public createDealDraft(params: {
    guildId: string;
    channelId: string;
    clientId: string;
    freelancerId: string;
    middlemanId: string;
    title: string;
    amount: number;
    currency?: string;
    agreement: DealAgreement;
  }) {
    const agreementJson = JSON.stringify(params.agreement);
    const agreementSha256 = createHash('sha256').update(agreementJson).digest('hex');

    const deal = dealRepo.createDeal({
      guildId: params.guildId,
      channelId: params.channelId,
      clientId: params.clientId,
      freelancerId: params.freelancerId,
      middlemanId: params.middlemanId,
      title: params.title,
      amount: params.amount,
      currency: params.currency || 'USD',
      agreementText: agreementJson,
      agreementSha256,
    });

    // Save milestones
    for (const m of params.agreement.milestones) {
      const mid = m.id || `m_${randomUUID().slice(0, 8)}`;
      dbService.run(
        `INSERT INTO deal_milestones (id, deal_id, title, amount, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        mid,
        deal.id,
        m.title,
        m.amount
      );
    }

    logger.info('DealLifecycle', `Deal created: ${deal.id} (Locked Hash: ${agreementSha256})`);
    return deal;
  }

  public confirmAgreement(dealId: string, party: 'client' | 'freelancer'): { success: boolean; isFullyConfirmed: boolean; message: string } {
    const deal = dealRepo.getDealById(dealId);
    if (!deal) return { success: false, isFullyConfirmed: false, message: 'Deal not found.' };

    const updateField = party === 'client' ? 'client_confirmed = 1' : 'freelancer_confirmed = 1';
    dbService.run(`UPDATE deals SET ${updateField} WHERE id = ?`, dealId);

    const updated = dealRepo.getDealById(dealId)!;
    const isFullyConfirmed = Boolean(updated.client_confirmed && updated.freelancer_confirmed);

    if (isFullyConfirmed && updated.status === 'draft') {
      dealRepo.updateStatus(dealId, 'agreed');
      logger.info('DealLifecycle', `Deal ${dealId} agreement locked and fully confirmed by both parties.`);
    }

    return {
      success: true,
      isFullyConfirmed,
      message: `${party === 'client' ? 'Client' : 'Freelancer'} has signed the agreement!`,
    };
  }

  public confirmFundingByMiddleman(
    dealId: string,
    middlemanId: string,
    proofAttachmentUrl: string
  ): { success: boolean; message: string } {
    const deal = dealRepo.getDealById(dealId);
    if (!deal) return { success: false, message: 'Deal not found.' };
    if (deal.middleman_id !== middlemanId) {
      return { success: false, message: 'Only the assigned middleman can confirm funds verification.' };
    }
    if (!proofAttachmentUrl) {
      return { success: false, message: 'Proof attachment URL is required for external funds audit.' };
    }

    dbService.run(
      `UPDATE deals SET middleman_funds_verified = 1, proof_attachment_url = ?, status = 'funded' WHERE id = ?`,
      proofAttachmentUrl,
      dealId
    );

    logger.info('DealLifecycle', `Middleman ${middlemanId} verified external funding for deal ${dealId}`);
    return {
      success: true,
      message: 'External funds receipt verified by Middleman! Work may now officially commence.',
    };
  }

  public submitMilestoneDelivery(dealId: string, milestoneId: string, submissionUrl: string): boolean {
    const now = Date.now();
    const res = dbService.run(
      `UPDATE deal_milestones SET status = 'submitted', submission_url = ?, submitted_at = ? WHERE id = ? AND deal_id = ?`,
      submissionUrl,
      now,
      milestoneId,
      dealId
    );
    logger.info('DealLifecycle', `Milestone ${milestoneId} submitted for deal ${dealId}`);
    return res.changes > 0;
  }

  public approveMilestone(dealId: string, milestoneId: string): boolean {
    const now = Date.now();
    const res = dbService.run(
      `UPDATE deal_milestones SET status = 'approved', approved_at = ? WHERE id = ? AND deal_id = ?`,
      now,
      milestoneId,
      dealId
    );
    logger.info('DealLifecycle', `Milestone ${milestoneId} approved for deal ${dealId}`);
    return res.changes > 0;
  }

  public closeDealCompleted(dealId: string, middlemanId: string): { success: boolean; message: string } {
    const deal = dealRepo.getDealById(dealId);
    if (!deal) return { success: false, message: 'Deal not found.' };
    if (deal.middleman_id !== middlemanId) {
      return { success: false, message: 'Only the assigned middleman can authorize completion release.' };
    }

    dealRepo.updateStatus(dealId, 'completed');
    dbService.run(`UPDATE deals SET closed_at = ? WHERE id = ?`, Date.now(), dealId);

    // Increment middleman completed count
    dbService.run(
      `UPDATE middlemen SET completed_deals = completed_deals + 1 WHERE user_id = ?`,
      middlemanId
    );

    logger.info('DealLifecycle', `Deal ${dealId} closed as COMPLETED by middleman ${middlemanId}`);
    return {
      success: true,
      message: 'Deal marked as completed! Middleman released payout externally. Mutual ratings unlocked.',
    };
  }
}

export const dealLifecycleService = new DealLifecycleService();
