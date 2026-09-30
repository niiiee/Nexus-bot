export interface WhyCardData {
  decisionType: 'vetting_suspicion' | 'test_grading' | 'moderation_action' | 'dispute_recommendation';
  targetUserId: string;
  verdict: string;
  confidenceScore: number;
  signalsDetected: string[];
  evidenceExcerpts: string[];
  reasoning: string;
  suggestedStaffAction: string;
}

export class ExplainabilityCard {
  public static renderCard(data: WhyCardData): string {
    const lines = [
      `📋 **[AI DECISION EXPLAINABILITY CARD]**`,
      `**Decision Type:** \`${data.decisionType}\``,
      `**Target Member:** <@${data.targetUserId}> (\`${data.targetUserId}\`)`,
      `**Outcome / Verdict:** **${data.verdict}** (Confidence: ${(data.confidenceScore * 100).toFixed(1)}%)`,
      ``,
      `🔍 **Signals Detected:**`,
      ...data.signalsDetected.map(s => `  • ${s}`),
      ``,
      `📝 **Evidence Excerpts:**`,
      ...data.evidenceExcerpts.map(e => `  > "${e.replace(/\n/g, ' ')}"`),
      ``,
      `💡 **AI Reasoning:** ${data.reasoning}`,
      `⚡ **Suggested Staff Action:** **${data.suggestedStaffAction}**`,
    ];

    return lines.join('\n');
  }
}
