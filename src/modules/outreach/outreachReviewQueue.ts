import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { outreachRulesGuard } from './rulesGuard.js';
import { DraftedReply } from './replyComposer.js';
import { CandidateOpportunity } from './opportunityDiscovery.js';
import { attributionFunnelService } from './attributionFunnel.js';

export interface ReviewItem {
  id: string;
  candidateId: string;
  postUrl: string;
  platform: string;
  community: string;
  category: string;
  draftedReply: string;
  sandboxResult?: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'do_not_post';
  reviewerId?: string;
  humanEditedReply?: string;
  decisionReason?: string;
  reviewedAt?: number;
  publishedAt?: number;
  createdAt: number;
}

export interface PublishResult {
  success: boolean;
  publishedText?: string;
  error?: string;
  postId?: string;
}

export class OutreachReviewQueue {
  private dailyPlatformCaps: Map<string, number> = new Map([
    ['reddit', 10],
    ['stackoverflow', 5],
    ['hackernews', 5],
    ['devto', 8],
    ['facebook', 5],
  ]);

  /**
   * Queue a drafted reply for human ambassador review
   */
  public queueForReview(candidate: CandidateOpportunity, draft: DraftedReply, sandboxNote?: string): ReviewItem {
    // REQ-21.6.3: Stand-Alone Value Gate Check
    if (!draft.part2Solution || draft.part2Solution.trim().length < 50) {
      throw new Error('Value Gate Failed: Solution is incomplete or lacks standalone value.');
    }

    const reviewId = cryptoRandomUUID();
    const item: ReviewItem = {
      id: reviewId,
      candidateId: candidate.id,
      postUrl: candidate.postUrl,
      platform: candidate.platform,
      community: candidate.community,
      category: candidate.category,
      draftedReply: draft.fullText,
      sandboxResult: sandboxNote,
      confidence: draft.confidence ?? 0.85,
      status: 'pending',
      createdAt: Date.now(),
    };

    try {
      dbService.run(
        `INSERT OR IGNORE INTO outreach_candidates (
          id, source_platform, source_community, post_url, problem_summary,
          category, language, author_id, score, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_review', ?)`,
        candidate.id,
        candidate.platform,
        candidate.community,
        candidate.postUrl,
        candidate.problemSummary,
        candidate.category,
        candidate.language || 'en',
        candidate.authorId || 'unknown',
        candidate.score || 0.8,
        Date.now()
      );
      dbService.run(
        `INSERT INTO outreach_reviews (id, candidate_id, drafted_reply, sandbox_result, confidence, status, reviewed_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        item.id,
        item.candidateId,
        item.draftedReply,
        item.sandboxResult || null,
        item.confidence ?? 0.85,
        Date.now()
      );
      logger.info(`[ReviewQueue] Queued candidate ${candidate.id} for human review (Review ID: ${item.id})`);
    } catch (err) {
      logger.error('[ReviewQueue] Error inserting into outreach_reviews:', err);
    }

    return item;
  }

  /**
   * Fetch pending review items
   */
  public getPendingReviews(limit: number = 20): ReviewItem[] {
    try {
      const rows = dbService.all<{
        id: string;
        candidate_id: string;
        drafted_reply: string;
        sandbox_result: string;
        confidence: number;
        status: string;
        reviewer_id: string;
        human_edited_reply: string;
        decision_reason: string;
        reviewed_at: number;
        published_at: number;
        post_url: string;
        platform: string;
        community: string;
        category: string;
        created_at: number;
      }>(
        `SELECT r.*,
          COALESCE(c.post_url, '') as post_url,
          COALESCE(c.source_platform, 'general') as platform,
          COALESCE(c.source_community, 'general') as community,
          COALESCE(c.category, 'web_dev') as category,
          COALESCE(c.created_at, r.reviewed_at, 0) as created_at
         FROM outreach_reviews r
         LEFT JOIN outreach_candidates c ON r.candidate_id = c.id
         WHERE r.status = 'pending'
         ORDER BY r.reviewed_at DESC LIMIT ?`,
        limit
      );

      return rows.map(r => ({
        id: r.id,
        candidateId: r.candidate_id,
        postUrl: (r as unknown as { post_url: string }).post_url,
        platform: (r as unknown as { platform: string }).platform,
        community: (r as unknown as { community: string }).community,
        category: (r as unknown as { category: string }).category,
        draftedReply: r.drafted_reply,
        sandboxResult: r.sandbox_result,
        confidence: r.confidence,
        status: 'pending',
        createdAt: (r as unknown as { created_at: number }).created_at || Date.now(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Approve and publish draft
   */
  public async approve(reviewId: string, reviewerId: string): Promise<PublishResult> {
    const item = this.getReviewById(reviewId);
    if (!item) return { success: false, error: 'Review item not found' };

    // Rate limits & cooldown verification (REQ-21.6.2)
    const rateCheck = this.checkRateLimits(item.platform, item.community);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.reason };
    }

    // Outbound safety validation (REQ-21.0.1, REQ-21.0.4, REQ-21.0.6, REQ-21.0.7)
    const validation = outreachRulesGuard.validateOutboundPublish({
      text: item.draftedReply,
      platform: item.platform,
      community: item.community,
      targetUser: item.candidateId,
      isHumanApproved: true,
      channelType: 'public_thread',
    });

    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    const postId = `pub_${item.platform}_${Date.now().toString(36)}`;
    const now = Date.now();

    try {
      dbService.run(
        `UPDATE outreach_reviews SET status = 'approved', reviewer_id = ?, reviewed_at = ?, published_at = ?, post_id = ? WHERE id = ?`,
        reviewerId,
        now,
        now,
        postId,
        reviewId
      );
      dbService.run(
        `UPDATE outreach_candidates SET status = 'published' WHERE id = ?`,
        item.candidateId
      );
      logger.info(`[ReviewQueue] Review ${reviewId} APPROVED by ${reviewerId}. Published post: ${postId}`);
    } catch (err) {
      logger.error('[ReviewQueue] Error recording approval:', err);
    }

    return {
      success: true,
      publishedText: item.draftedReply,
      postId,
    };
  }

  /**
   * Edit and publish draft
   */
  public async edit(reviewId: string, editedReply: string, reviewerId: string): Promise<PublishResult> {
    const item = this.getReviewById(reviewId);
    if (!item) return { success: false, error: 'Review item not found' };

    // Verify disclosure is maintained in human-edited text
    if (!outreachRulesGuard.verifyDisclosure(editedReply)) {
      return { success: false, error: 'Edited reply must retain the mandatory Nexus disclosure line.' };
    }

    const validation = outreachRulesGuard.validateOutboundPublish({
      text: editedReply,
      platform: item.platform,
      community: item.community,
      targetUser: item.candidateId,
      isHumanApproved: true,
      channelType: 'public_thread',
    });

    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    const postId = `pub_${item.platform}_${Date.now().toString(36)}`;
    const now = Date.now();

    try {
      dbService.run(
        `UPDATE outreach_reviews SET status = 'approved', human_edited_reply = ?, reviewer_id = ?, reviewed_at = ?, published_at = ?, post_id = ? WHERE id = ?`,
        editedReply,
        reviewerId,
        now,
        now,
        postId,
        reviewId
      );
      dbService.run(
        `UPDATE outreach_candidates SET status = 'published' WHERE id = ?`,
        item.candidateId
      );
      attributionFunnelService.recordAmbassadorEdit({
        reviewId,
        originalDraft: item.draftedReply,
        editedReply,
        category: item.category,
        platform: item.platform,
        reason: 'Ambassador manual edit prior to approval',
      });
      logger.info(`[ReviewQueue] Review ${reviewId} EDITED & APPROVED by ${reviewerId}`);
    } catch (err) {
      logger.error('[ReviewQueue] Error recording edit approval:', err);
    }

    return {
      success: true,
      publishedText: editedReply,
      postId,
    };
  }

  /**
   * Reject candidate
   */
  public reject(
    reviewId: string,
    reviewerIdOrReason: string = 'dashboard-owner',
    reasonOrReviewerId: string = 'Rejected by ambassador'
  ): { success: boolean; reviewId: string; status: string } {
    let reviewerId = reviewerIdOrReason;
    let reason = reasonOrReviewerId;
    if (reviewerIdOrReason.includes(' ') && !reasonOrReviewerId.includes(' ')) {
      reason = reviewerIdOrReason;
      reviewerId = reasonOrReviewerId;
    }
    const now = Date.now();
    try {
      dbService.run(
        `UPDATE outreach_reviews SET status = 'rejected', decision_reason = ?, reviewer_id = ?, reviewed_at = ? WHERE id = ?`,
        reason,
        reviewerId,
        now,
        reviewId
      );
      logger.info(`[ReviewQueue] Review ${reviewId} REJECTED by ${reviewerId}: ${reason}`);
      return { success: true, reviewId, status: 'rejected' };
    } catch (err) {
      logger.error('[ReviewQueue] Error recording rejection:', err);
      return { success: false, reviewId, status: 'error' };
    }
  }

  /**
   * Mark source community as Do-Not-Post
   */
  public markDoNotPost(
    reviewId: string,
    reviewerIdOrReason: string = 'dashboard-owner',
    reasonOrReviewerId: string = 'Community marked do not post'
  ): { success: boolean; reviewId: string; status: string } {
    const item = this.getReviewById(reviewId);
    let reviewerId = reviewerIdOrReason;
    let reason = reasonOrReviewerId;
    if (reviewerIdOrReason.includes(' ') && !reasonOrReviewerId.includes(' ')) {
      reason = reviewerIdOrReason;
      reviewerId = reasonOrReviewerId;
    }
    if (!item) return { success: false, reviewId, status: 'not_found' };

    this.reject(reviewId, reviewerId, `Marked source community do-not-post: ${reason}`);
    outreachRulesGuard.addToStoplist(item.community, item.platform, reason);
    logger.warn(`[ReviewQueue] Community ${item.platform}/${item.community} marked DO-NOT-POST by ${reviewerId}`);
    return { success: true, reviewId, status: 'do_not_post' };
  }

  public checkRateLimits(platform: string, community: string): { allowed: boolean; reason?: string } {
    const cap = this.dailyPlatformCaps.get(platform.toLowerCase()) || 5;
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    try {
      const row = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM outreach_reviews WHERE published_at > ?`,
        oneDayAgo
      );
      if (row && row.count >= cap) {
        return { allowed: false, reason: `Daily rate limit reached for platform ${platform} (${row.count}/${cap})` };
      }
    } catch {
      // ignore
    }

    return { allowed: true };
  }

  private getReviewById(id: string): ReviewItem | null {
    try {
      const r = dbService.get<{
        id: string;
        candidate_id: string;
        drafted_reply: string;
        sandbox_result: string;
        confidence: number;
        status: string;
        post_url: string;
        source_platform: string;
        source_community: string;
        category: string;
        created_at: number;
      }>(
        `SELECT r.*,
          COALESCE(c.post_url, '') as post_url,
          COALESCE(c.source_platform, 'general') as source_platform,
          COALESCE(c.source_community, 'general') as source_community,
          COALESCE(c.category, 'web_dev') as category,
          COALESCE(c.created_at, r.reviewed_at, 0) as created_at
         FROM outreach_reviews r
         LEFT JOIN outreach_candidates c ON r.candidate_id = c.id
         WHERE r.id = ?`,
        id
      );

      if (!r) return null;
      return {
        id: r.id,
        candidateId: r.candidate_id,
        postUrl: r.post_url,
        platform: r.source_platform,
        community: r.source_community,
        category: r.category,
        draftedReply: r.drafted_reply,
        sandboxResult: r.sandbox_result,
        confidence: r.confidence,
        status: r.status as 'pending' | 'approved' | 'rejected' | 'do_not_post',
        createdAt: r.created_at || Date.now(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Returns summary counts of review queue statuses
   */
  public getQueueStats(): { pending: number; approved: number; rejected: number; doNotPost: number } {
    const counts = { pending: 0, approved: 0, rejected: 0, doNotPost: 0 };
    try {
      const rows = dbService.all<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count FROM outreach_reviews GROUP BY status`
      );
      for (const r of rows) {
        if (r.status === 'pending') counts.pending = r.count;
        if (r.status === 'approved') counts.approved = r.count;
        if (r.status === 'rejected') counts.rejected = r.count;
        if (r.status === 'do_not_post') counts.doNotPost = r.count;
      }
    } catch {
      // ignore
    }
    return counts;
  }
}

export const outreachReviewQueue = new OutreachReviewQueue();
