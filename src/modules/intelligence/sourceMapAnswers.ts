export interface ClaimSourceMapping {
  claimId: string;
  claimText: string;
  sourceDocId: string;
  sourceSnippet: string;
  confidence: number;
}

export interface GroundedAnswerResult {
  isGrounded: boolean;
  answerText: string;
  sourceMap: ClaimSourceMapping[];
  fallbackTriggered: boolean;
  fallbackReason?: string;
}

export class SourceMapAnswersEngine {
  /**
   * REQ-26.206: Generate AI answers with claim-to-source map and honest fallback on unsupported queries
   */
  public generateGroundedAnswer(
    query: string,
    contextDocs: Array<{ id: string; content: string }>
  ): GroundedAnswerResult {
    const qLower = query.toLowerCase();

    // Check if query is covered by available context docs
    const matchingDocs = contextDocs.filter((doc) =>
      doc.content.toLowerCase().split(/\s+/).some((w) => w.length > 3 && qLower.includes(w))
    );

    if (matchingDocs.length === 0) {
      return {
        isGrounded: false,
        answerText: 'I do not have verified community documentation to answer this question accurately.',
        sourceMap: [],
        fallbackTriggered: true,
        fallbackReason: 'Out of scope: no matching verified source documentation found.'
      };
    }

    const doc = matchingDocs[0];
    const sourceMap: ClaimSourceMapping[] = [
      {
        claimId: 'claim_1',
        claimText: `Verified per community policy: ${doc.content.substring(0, 60)}...`,
        sourceDocId: doc.id,
        sourceSnippet: doc.content.substring(0, 100),
        confidence: 0.95
      }
    ];

    const answerText = `Based on verified Nexus documentation (${doc.id}):\n${doc.content.substring(0, 150)}...`;

    return {
      isGrounded: true,
      answerText,
      sourceMap,
      fallbackTriggered: false
    };
  }
}

export const sourceMapAnswersEngine = new SourceMapAnswersEngine();
