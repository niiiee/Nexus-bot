import { dbService } from '../../../database/connection.js';
import { economyRepo } from '../../../database/repositories/economyRepo.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface PortfolioReview {
  id: string;
  portfolioId: string;
  reviewerId: string;
  feedback: string;
  rating: number; // 1 to 5
  createdAt: number;
}

export class PortfolioReviewQueueService {
  public submitReview(params: {
    portfolioId: string;
    reviewerId: string;
    guildId: string;
    feedback: string;
    rating: number;
  }): { success: boolean; reviewId?: string; creditsAwarded: number; message: string } {
    if (params.feedback.length < 30) {
      return {
        success: false,
        creditsAwarded: 0,
        message: 'Feedback must be constructive and at least 30 characters long.',
      };
    }

    const clampedRating = Math.max(1, Math.min(5, Math.round(params.rating)));
    const id = `rev_${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO portfolio_reviews (id, portfolio_id, reviewer_id, feedback, rating, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      params.portfolioId,
      params.reviewerId,
      params.feedback,
      clampedRating,
      now
    );

    // Reward the reviewer for constructive community feedback
    const creditsAwarded = 25;
    economyRepo.addCredits(
      params.reviewerId,
      params.guildId,
      creditsAwarded,
      'portfolio_review',
      `Constructive review on portfolio item ${params.portfolioId}`
    );

    logger.info('PortfolioReviewQueue', `Review ${id} submitted by ${params.reviewerId}. Awarded ${creditsAwarded} credits.`);

    return {
      success: true,
      reviewId: id,
      creditsAwarded,
      message: `Review submitted! You earned ${creditsAwarded} credits for helping a fellow freelancer.`,
    };
  }

  public getReviewsForItem(portfolioId: string): PortfolioReview[] {
    const rows = dbService.all<{
      id: string;
      portfolio_id: string;
      reviewer_id: string;
      feedback: string;
      rating: number;
      created_at: number;
    }>(
      `SELECT * FROM portfolio_reviews WHERE portfolio_id = ? ORDER BY created_at DESC`,
      portfolioId
    );

    return rows.map((r) => ({
      id: r.id,
      portfolioId: r.portfolio_id,
      reviewerId: r.reviewer_id,
      feedback: r.feedback,
      rating: r.rating,
      createdAt: r.created_at,
    }));
  }
}

export const portfolioReviewQueueService = new PortfolioReviewQueueService();
