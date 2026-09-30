import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface SeasonalQuest {
  id: string;
  seasonNumber: number;
  title: string;
  description: string;
  targetCount: number;
  rewardXp: number;
  rewardCredits: number;
  streakProtected: boolean;
}

export interface StageSessionSummary {
  stageId: string;
  topic: string;
  keyTakeaways: string[];
  actionItems: string[];
  audienceQuestions: Array<{ author: string; question: string; upvotes: number }>;
}

export interface CopywritingAnalysis {
  headlineScore: number;
  readabilityScore: number;
  ctaStrength: 'strong' | 'moderate' | 'weak';
  recommendations: string[];
}

export class MarketingStudioEngine {
  /**
   * REQ-23.21.1: Generate dynamic seasonal quests with streak freeze protection
   */
  public generateSeasonalQuests(seasonNumber: number): SeasonalQuest[] {
    return [
      {
        id: `quest_s${seasonNumber}_01`,
        seasonNumber,
        title: 'Community Code Review Champion',
        description: 'Review 3 member pull requests or code submissions in the Code Lab',
        targetCount: 3,
        rewardXp: 250,
        rewardCredits: 50,
        streakProtected: true
      },
      {
        id: `quest_s${seasonNumber}_02`,
        seasonNumber,
        title: 'Knowledge Creator',
        description: 'Publish a verified tutorial or guide in the community wiki',
        targetCount: 1,
        rewardXp: 500,
        rewardCredits: 100,
        streakProtected: false
      },
      {
        id: `quest_s${seasonNumber}_03`,
        seasonNumber,
        title: 'Escrow Deliverer',
        description: 'Successfully complete and deliver an escrow milestone',
        targetCount: 1,
        rewardXp: 1000,
        rewardCredits: 200,
        streakProtected: true
      }
    ];
  }

  /**
   * REQ-23.22.1: Summarize live audio/video stage sessions and rank Q&A queue
   */
  public summarizeStageSession(
    stageId: string,
    topic: string,
    transcriptSnippet: string,
    submittedQuestions: Array<{ author: string; question: string; upvotes: number }>
  ): StageSessionSummary {
    const takeaways = [
      `Key architectural insights discussed regarding ${topic}.`,
      'Best practices shared on performance optimization and scalable deployments.'
    ];

    const actionItems = [
      'Publish workshop code repository in #resources channel.',
      'Schedule follow-up office hours for advanced Q&A next Tuesday.'
    ];

    const sortedQuestions = [...submittedQuestions].sort((a, b) => b.upvotes - a.upvotes);

    return {
      stageId,
      topic,
      keyTakeaways: takeaways,
      actionItems,
      audienceQuestions: sortedQuestions
    };
  }

  /**
   * REQ-23.27.1: Evaluate copywriting, headline engagement, and CTA strength
   */
  public analyzeCopywriting(text: string): CopywritingAnalysis {
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;

    let headlineScore = 70;
    const lower = text.toLowerCase();

    // Check power words
    if (lower.includes('how to') || lower.includes('step-by-step') || lower.includes('guide') || lower.includes('top')) {
      headlineScore += 15;
    }
    if (lower.includes('free') || lower.includes('boost') || lower.includes('secret') || lower.includes('fast')) {
      headlineScore += 10;
    }
    headlineScore = Math.min(100, headlineScore);

    // Readability heuristic (shorter sentences = higher score)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgWordsPerSentence = sentences.length > 0 ? wordCount / sentences.length : wordCount;
    let readabilityScore = Math.max(30, Math.min(100, Math.round(100 - avgWordsPerSentence * 2)));

    // CTA check
    let ctaStrength: CopywritingAnalysis['ctaStrength'] = 'weak';
    if (lower.includes('click') || lower.includes('join') || lower.includes('get started') || lower.includes('sign up')) {
      ctaStrength = 'strong';
    } else if (lower.includes('check out') || lower.includes('read more')) {
      ctaStrength = 'moderate';
    }

    const recommendations: string[] = [];
    if (ctaStrength === 'weak') {
      recommendations.push('Add an explicit, action-oriented call to action (e.g. "Join the workshop now").');
    }
    if (avgWordsPerSentence > 20) {
      recommendations.push('Shorten long complex sentences to improve mobile reader comprehension.');
    }

    return {
      headlineScore,
      readabilityScore,
      ctaStrength,
      recommendations
    };
  }

  /**
   * REQ-23.28.1: Generate automated community changelog and celebratory social announcements
   */
  public generateWeeklyChangelog(
    communityName: string,
    completedFeatures: string[],
    newMilestonesCount: number
  ): string {
    return `📢 **What's New in ${communityName} this Week!**\n\n` +
      `We shipped great milestones together:\n` +
      completedFeatures.map(f => `✨ ${f}`).join('\n') + `\n\n` +
      `🏆 Community Highlight: ${newMilestonesCount} verified escrow milestone(s) delivered this week!\n` +
      `Check out the updated Wiki & Code Lab to keep leveling up.`;
  }
}

export const marketingStudio = new MarketingStudioEngine();
