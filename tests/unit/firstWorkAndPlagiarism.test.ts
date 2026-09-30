import { describe, it, expect } from 'vitest';
import { plagiarismDetector } from '../../src/ai/evaluators/plagiarismDetector.js';
import { workEvaluator } from '../../src/ai/evaluators/workEvaluator.js';
import { memberRepo } from '../../src/database/repositories/memberRepo.js';

describe('Phase 2: First-Work Documentation & Plagiarism Shield (Section 4)', () => {
  const guildId = 'guild_work_1';
  const userId = 'user_work_1';

  it('detects stock template signatures and generic tutorial projects', async () => {
    const report1 = await plagiarismDetector.evaluateSubmission({
      urlOrAsset: 'https://github.com/someone/todo-app',
      description: 'Standard create-react-app template with lorem ipsum dolor sit amet sample cards.',
    });

    expect(report1.isFlagged).toBe(true);
    expect(report1.suspicionSignals.length).toBeGreaterThan(0);

    const report2 = await plagiarismDetector.evaluateSubmission({
      urlOrAsset: 'https://github.com/myteam/custom-distributed-indexer',
      description: 'Custom B-Tree indexer and Raft consensus engine implemented from scratch in Rust.',
      codeSnippet: 'pub struct RaftNode { pub state: NodeState }',
    });

    expect(report2.isFlagged).toBe(false);
  });

  it('evaluates submitted work, awards constructive feedback, and assigns seniority role', async () => {
    memberRepo.getOrCreate(userId, guildId, 'DevBuilder');

    const result = await workEvaluator.evaluateFirstWork({
      userId,
      guildId,
      field: 'development',
      claimedYears: 3,
      urlOrAsset: 'https://github.com/DevBuilder/saas-billing-orchestrator',
      description: 'Production multi-tenant billing engine with Stripe webhook idempotency, tests, and CI/CD.',
    });

    expect(result.submissionId).toBeDefined();
    expect(result.assignedRole).toBeDefined();
    expect(result.feedback).toBeDefined();
    expect(result.status).toBe('approved');

    // Verify member record was upgraded in database
    const member = memberRepo.get(userId);
    expect(member?.lifecycle_stage).toBe('Active');
    expect(member?.credits_balance).toBeGreaterThan(50); // Rewarded first work bonus
  });
});
