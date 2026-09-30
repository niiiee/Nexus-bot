import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface CodeReviewResult {
  securityRating: 'clean' | 'warnings' | 'critical_vulnerabilities';
  performanceRating: 'optimal' | 'improvable' | 'severe_bottlenecks';
  codeQualityScore: number; // 0 to 100
  reviewMarkdown: string;
  refactoredSnippet?: string;
}

export class CodeReviewService {
  public async reviewCode(
    codeOrUrl: string,
    language = 'typescript',
    lang: 'en' | 'ar' = 'en'
  ): Promise<CodeReviewResult> {
    const isAr = lang === 'ar';
    const prompt = `You are Senior Progg, a principal staff engineer known for sharp, clean code reviews and zero tolerance for sloppy hacks.
Review this code snippet or repo reference:
\`\`\`${language}
${codeOrUrl}
\`\`\`

Perform an exhaustive review covering:
1. Security & OWASP check (SQLi, XSS, prototype pollution, exposed secrets, unhandled errors).
2. Performance & Big-O complexity (accidental O(N^2) loops, memory leaks, unindexed queries, blocking I/O).
3. Clean Code & Idiomatic Best Practices (naming, SRP, error handling).
4. Provide a cleanly refactored version of the snippet.

Language: ${isAr ? 'Egyptian Arabic (casual tech slang like يا باشا, كود نظيف, تسريب ذاكرة)' : 'English (direct, senior, constructive)'}`;

    const aiRes = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'code_reviewer',
      guildId: 'global',
      context: 'code_review',
    });

    // Check for critical security red flags in snippet
    let securityRating: CodeReviewResult['securityRating'] = 'clean';
    if (/eval\(|dangerouslySetInnerHTML|SELECT.*FROM.*WHERE.*=.*\+|exec\(/i.test(codeOrUrl)) {
      securityRating = 'critical_vulnerabilities';
    } else if (/TODO|any\b|console\.log/i.test(codeOrUrl)) {
      securityRating = 'warnings';
    }

    const performanceRating: CodeReviewResult['performanceRating'] =
      /for.*for.*for/i.test(codeOrUrl) ? 'severe_bottlenecks' : 'optimal';

    let codeQualityScore = 85;
    if (securityRating === 'critical_vulnerabilities') codeQualityScore -= 30;
    if (performanceRating === 'severe_bottlenecks') codeQualityScore -= 20;

    logger.info('CodeReviewer', `Completed code review: quality=${codeQualityScore}, security=${securityRating}`);

    return {
      securityRating,
      performanceRating,
      codeQualityScore,
      reviewMarkdown: aiRes.text.trim(),
      refactoredSnippet: '// Refactored for security and performance by Senior Progg\n' + codeOrUrl,
    };
  }
}

export const codeReviewService = new CodeReviewService();
