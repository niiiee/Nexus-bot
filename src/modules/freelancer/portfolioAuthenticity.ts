import { logger } from '../../utils/logger.js';

export interface PortfolioItem {
  id: string;
  userId: string;
  url: string;
  title: string;
  authorClaim: string;
}

export interface AuthenticityAdvisoryReport {
  itemId: string;
  userId: string;
  similarityScore: number; // 0.0 to 1.0
  isSuspectDuplicate: boolean;
  matchedOriginUrl?: string;
  isStaffAdvisoryOpened: boolean;
  publicAccusationIssued: boolean;
}

export class PortfolioAuthenticityAdvisor {
  private knownPublicRepos: Array<{ url: string; originalAuthor: string }> = [
    { url: 'https://github.com/facebook/react', originalAuthor: 'Meta' },
    { url: 'https://github.com/vercel/next.js', originalAuthor: 'Vercel' }
  ];

  /**
   * REQ-26.229: Screen portfolio provenance and open private staff advisory case WITHOUT public accusations
   */
  public screenPortfolio(item: PortfolioItem): AuthenticityAdvisoryReport {
    let similarityScore = 0.05;
    let matchedOriginUrl: string | undefined;

    for (const repo of this.knownPublicRepos) {
      if (item.url.toLowerCase().includes(repo.url.toLowerCase())) {
        similarityScore = 0.95;
        matchedOriginUrl = repo.url;
        break;
      }
    }

    const isSuspectDuplicate = similarityScore > 0.70;
    const isStaffAdvisoryOpened = isSuspectDuplicate;

    if (isStaffAdvisoryOpened) {
      logger.info('Private staff advisory opened for portfolio review', {
        userId: item.userId,
        similarityScore,
        matchedOriginUrl
      });
    }

    return {
      itemId: item.id,
      userId: item.userId,
      similarityScore,
      isSuspectDuplicate,
      matchedOriginUrl,
      isStaffAdvisoryOpened,
      // Inviolable guarantee: NO public accusations or public shaming
      publicAccusationIssued: false
    };
  }
}

export const portfolioAuthenticityAdvisor = new PortfolioAuthenticityAdvisor();
