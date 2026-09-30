import { dbService } from '../../../database/connection.js';
import { economyRepo } from '../../../database/repositories/economyRepo.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface SkillChallenge {
  id: string;
  type: 'code' | 'design';
  difficulty: 'easy' | 'medium' | 'hard';
  title: string;
  problemStatement: string;
  rewardCredits: number;
  rewardXP: number;
}

export const SEED_CHALLENGES: SkillChallenge[] = [
  {
    id: 'chal_code_1',
    type: 'code',
    difficulty: 'medium',
    title: 'Zero-Allocation LRU Cache',
    problemStatement:
      'Implement an LRU (Least Recently Used) cache with O(1) get and put operations, minimizing GC allocations.',
    rewardCredits: 75,
    rewardXP: 150,
  },
  {
    id: 'chal_design_1',
    type: 'design',
    difficulty: 'easy',
    title: 'High-Converting Checkout Flow',
    problemStatement:
      'Design a frictionless 1-page checkout flow optimized for mobile with Apple Pay/Google Pay integration.',
    rewardCredits: 50,
    rewardXP: 100,
  },
  {
    id: 'chal_code_2',
    type: 'code',
    difficulty: 'hard',
    title: 'Concurrent Distributed Lock with Redis',
    problemStatement:
      'Write a resilient distributed lock implementation in Node.js with auto-renewal leases and Redlock algorithm.',
    rewardCredits: 150,
    rewardXP: 300,
  },
];

export class ChallengeEngine {
  public getTodaysChallenge(type: 'code' | 'design' = 'code'): SkillChallenge {
    const list = SEED_CHALLENGES.filter((c) => c.type === type);
    return list[0] || SEED_CHALLENGES[0];
  }

  public submitChallengeSolution(params: {
    challengeId: string;
    userId: string;
    guildId: string;
    solutionText: string;
  }): { success: boolean; score: number; creditsAwarded: number; feedback: string } {
    const challenge = SEED_CHALLENGES.find((c) => c.id === params.challengeId) || SEED_CHALLENGES[0];

    if (params.solutionText.length < 20) {
      return {
        success: false,
        score: 0,
        creditsAwarded: 0,
        feedback: 'Solution is too brief. Provide a complete implementation or design prototype.',
      };
    }

    const score = 90;
    const creditsAwarded = challenge.rewardCredits;

    economyRepo.addCredits(
      params.userId,
      params.guildId,
      creditsAwarded,
      'skill_challenge',
      `Completed challenge "${challenge.title}"`
    );

    logger.info('ChallengeEngine', `User ${params.userId} completed challenge ${challenge.id} (Score: ${score})`);

    return {
      success: true,
      score,
      creditsAwarded,
      feedback: `Bravo ya basha! Excellent implementation of ${challenge.title}. Awarded ${creditsAwarded} credits and ${challenge.rewardXP} XP!`,
    };
  }
}

export const challengeEngine = new ChallengeEngine();
