import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { courseCertificatesService, CertificateRecord } from './courseCertificates.js';

export interface CertificationTrack {
  id: string;
  title: string;
  description: string;
  category: 'fullstack' | 'design' | 'escrow';
  prerequisites: {
    minApprovedTasks?: number;
    minPortfolioItems?: number;
    minCompletedDeals?: number;
    minReputation: number;
  };
}

export class CertificationTracksService {
  public readonly TRACKS: CertificationTrack[] = [
    {
      id: 'track_fullstack_senior',
      title: 'Certified Senior Full-Stack Engineer',
      description: 'Mastery over Node.js, TypeScript, SQLite, Clean Architecture, and Algorithmic Efficiency.',
      category: 'fullstack',
      prerequisites: {
        minApprovedTasks: 5,
        minReputation: 100,
      },
    },
    {
      id: 'track_arabic_uiux',
      title: 'Certified Arabic UI/UX Architect',
      description: 'Mastery over Design Systems, Arabic RTL Typography, 8pt Grid, and WCAG AAA Accessibility.',
      category: 'design',
      prerequisites: {
        minPortfolioItems: 2,
        minReputation: 80,
      },
    },
    {
      id: 'track_escrow_middleman',
      title: 'Certified Middleman & Escrow Arbiter',
      description: 'Mastery of neutral dispute resolution, scam detection, and non-custodial milestone releases.',
      category: 'escrow',
      prerequisites: {
        minCompletedDeals: 3,
        minReputation: 120,
      },
    },
  ];

  /**
   * Checks candidate eligibility for a given track.
   */
  public evaluateEligibility(userId: string, guildId: string, trackId: string): {
    track?: CertificationTrack;
    isEligible: boolean;
    missingRequirements: string[];
  } {
    const track = this.TRACKS.find(t => t.id === trackId);
    if (!track) {
      return { isEligible: false, missingRequirements: ['Track not found'] };
    }

    const missing: string[] = [];

    // Check member reputation
    const member = dbService.get<{ reputation_score: number }>(
      `SELECT reputation_score FROM members WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );

    const rep = member?.reputation_score || 0;
    if (rep < track.prerequisites.minReputation) {
      missing.push(`Requires ${track.prerequisites.minReputation} reputation (current: ${rep})`);
    }

    // Check approved tasks if required
    if (track.prerequisites.minApprovedTasks) {
      const taskCount = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM task_submissions WHERE user_id = ? AND status = 'approved'`,
        userId
      )?.count || 0;

      if (taskCount < track.prerequisites.minApprovedTasks) {
        missing.push(`Requires ${track.prerequisites.minApprovedTasks} approved tasks (current: ${taskCount})`);
      }
    }

    // Check portfolio items if required
    if (track.prerequisites.minPortfolioItems) {
      const portCount = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM portfolio_items WHERE user_id = ?`,
        userId
      )?.count || 0;

      if (portCount < track.prerequisites.minPortfolioItems) {
        missing.push(`Requires ${track.prerequisites.minPortfolioItems} portfolio showcase pieces (current: ${portCount})`);
      }
    }

    // Check completed deals if required
    if (track.prerequisites.minCompletedDeals) {
      const dealsCount = dbService.get<{ completed_deals: number }>(
        `SELECT completed_deals FROM middlemen WHERE user_id = ?`,
        userId
      )?.completed_deals || 0;

      if (dealsCount < track.prerequisites.minCompletedDeals) {
        missing.push(`Requires ${track.prerequisites.minCompletedDeals} completed escrow deals (current: ${dealsCount})`);
      }
    }

    return {
      track,
      isEligible: missing.length === 0,
      missingRequirements: missing,
    };
  }

  /**
   * Completes certification and automatically issues a cryptographic certificate.
   */
  public graduateTrack(userId: string, guildId: string, trackId: string): {
    success: boolean;
    certificate?: CertificateRecord;
    error?: string;
  } {
    const evalResult = this.evaluateEligibility(userId, guildId, trackId);
    if (!evalResult.isEligible || !evalResult.track) {
      return {
        success: false,
        error: `Ineligible: ${evalResult.missingRequirements.join(', ')}`,
      };
    }

    const cert = courseCertificatesService.issueCertificate({
      userId,
      title: evalResult.track.title,
      issuer: 'Senior Progg Certification Board',
    });

    logger.info(`[CertificationTracks] User ${userId} graduated track "${evalResult.track.title}"! Certificate ID: ${cert.id}`);

    return {
      success: true,
      certificate: cert,
    };
  }
}

export const certificationTracksService = new CertificationTracksService();
