export interface ModelCard {
  featureId: string;
  featureName: string;
  modelArchitecture: string;
  primaryIntendedUse: string;
  outOfScopeUses: string[];
  dialectsSupported: string[];
  ethicalGuardrails: string[];
  fallbackPolicy: string;
  humanReviewRequirement: string;
  evaluationMetrics: {
    precision: number;
    recall: number;
    latencyP95Ms: number;
  };
}

export class ModelCardsRegistry {
  private cards: Map<string, ModelCard> = new Map();

  constructor() {
    this.seedDefaultModelCards();
  }

  private seedDefaultModelCards(): void {
    this.registerCard({
      featureId: 'ai_vetting_evaluator',
      featureName: 'Adaptive Vetting & Authenticity Evaluator',
      modelArchitecture: 'Gemini 1.5 Flash / Local LLM Orchestrator with Deterministic Heuristics',
      primaryIntendedUse: 'Generate adaptive technical questions and evaluate candidate responses during onboarding.',
      outOfScopeUses: [
        'Automated banning or permanent exclusion without staff escalation',
        'Psychometric or clinical personality profiling',
        'Evaluating non-technical or personal attributes'
      ],
      dialectsSupported: ['Egyptian Arabic', 'Gulf Arabic', 'Levantine Arabic', 'Modern Standard Arabic', 'English'],
      ethicalGuardrails: [
        'Zero penalties for typing speed, dyslexia, or non-native phrasing',
        'Dialect parity filter to prevent linguistic discrimination',
        'Strict isolation: answers never exported to external training sets'
      ],
      fallbackPolicy: 'If AI provider times out or errors, fall back to pre-calibrated static rubric questions.',
      humanReviewRequirement: 'Scores with high suspicion (suspicion_score > 0.65) route to human staff review before any action.',
      evaluationMetrics: {
        precision: 0.94,
        recall: 0.91,
        latencyP95Ms: 185
      }
    });

    this.registerCard({
      featureId: 'ai_moderation_assistant',
      featureName: 'Rules Engine & Context Assistant',
      modelArchitecture: 'Rule-Based Semantic Parser + Lightweight Embedding Classifier',
      primaryIntendedUse: 'Detect violations of R01-R50 with contextual exemptions for quotes, code blocks, and educational queries.',
      outOfScopeUses: [
        'Automated permanent guild bans (requires dual human moderators)',
        'Punitive action on mental health distress (strictly routes to Care Exception R24)',
        'Private DM monitoring without affirmative ticket submission'
      ],
      dialectsSupported: ['Egyptian Arabic', 'Arabizi', 'Modern Standard Arabic', 'English'],
      ethicalGuardrails: [
        'Charter Equal Access: Server owners and newcomers receive identical decisions',
        'Lowest effective action principle: first S1 violation is reminder with 0 points'
      ],
      fallbackPolicy: 'Default to conservative Mode S (staff review) on ambiguity.',
      humanReviewRequirement: 'All Mode S and Mode H cases require human moderator adjudication.',
      evaluationMetrics: {
        precision: 0.96,
        recall: 0.93,
        latencyP95Ms: 45
      }
    });
  }

  public registerCard(card: ModelCard): void {
    this.cards.set(card.featureId.toLowerCase(), card);
  }

  public getCard(featureId: string): ModelCard | null {
    return this.cards.get(featureId.toLowerCase()) || null;
  }

  public listCards(): ModelCard[] {
    return Array.from(this.cards.values());
  }

  public exportMarkdown(featureId: string): string {
    const card = this.getCard(featureId);
    if (!card) return 'Model card not found.';

    return `# Model Card: ${card.featureName} (\`${card.featureId}\`)

- **Architecture**: ${card.modelArchitecture}
- **Primary Use**: ${card.primaryIntendedUse}
- **Precision / Recall / p95**: ${card.evaluationMetrics.precision} / ${card.evaluationMetrics.recall} / ${card.evaluationMetrics.latencyP95Ms}ms

### Out-of-Scope & Prohibited Uses
${card.outOfScopeUses.map((u) => `- ❌ ${u}`).join('\n')}

### Supported Dialects
${card.dialectsSupported.map((d) => `- 🌐 ${d}`).join('\n')}

### Ethical Guardrails
${card.ethicalGuardrails.map((g) => `- 🛡️ ${g}`).join('\n')}

### Fallback & Human Governance
- **Fallback**: ${card.fallbackPolicy}
- **Human Oversight**: ${card.humanReviewRequirement}
`;
  }
}

export const modelCardsRegistry = new ModelCardsRegistry();
