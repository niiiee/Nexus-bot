export class DataInsightsEngine {
  // Chapter 301: Open Aggregated Data Portal
  public aggregateMetrics(dataPoints: number[], kAnonymityThreshold = 5): { count: number; mean: number; isSuppressed: boolean } {
    if (dataPoints.length < kAnonymityThreshold) {
      return { count: dataPoints.length, mean: 0, isSuppressed: true };
    }
    const sum = dataPoints.reduce((acc, v) => acc + v, 0);
    return {
      count: dataPoints.length,
      mean: Math.round((sum / dataPoints.length) * 100) / 100,
      isSuppressed: false
    };
  }

  // Chapter 302: Cohort Explorer
  public analyzeCohortRetention(cohortMonth: string, totalJoined: number, activeAfter30Days: number): {
    cohort: string;
    retentionRate: number;
    healthStatus: 'healthy' | 'at_risk';
  } {
    const rate = Math.round((activeAfter30Days / (totalJoined || 1)) * 100) / 100;
    return {
      cohort: cohortMonth,
      retentionRate: rate,
      healthStatus: rate >= 0.4 ? 'healthy' : 'at_risk'
    };
  }

  // Chapter 303: Skill Supply Forecasts
  public forecastSkillGap(currentSupply: number, projectedDemand: number): {
    gap: number;
    deficitRatio: number;
    recommendedTrainingSlots: number;
  } {
    const gap = projectedDemand - currentSupply;
    const deficitRatio = Math.max(0, Math.round((gap / (projectedDemand || 1)) * 100) / 100);
    return {
      gap,
      deficitRatio,
      recommendedTrainingSlots: Math.max(0, gap)
    };
  }

  // Chapter 304: Churn Reason Analysis
  public analyzeExitSurveys(surveys: Array<{ reason: string }>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of surveys) {
      counts[s.reason] = (counts[s.reason] || 0) + 1;
    }
    return counts;
  }

  // Chapter 305: Ethical Experiment Platform
  public validateExperimentSafety(params: { featureName: string; modifiesModeration: boolean; modifiesAccessGating: boolean }): {
    isPermitted: boolean;
    error?: string;
  } {
    // Invariant: Experiments cannot touch safety/moderation or gate core server access
    if (params.modifiesModeration || params.modifiesAccessGating) {
      return {
        isPermitted: false,
        error: 'Charter Protection: A/B experiments are prohibited from altering disciplinary rules or gating access.'
      };
    }
    return { isPermitted: true };
  }

  // Chapter 306: Annual State of Freelancing Report
  public compileAnnualMarketSummary(dealsCount: number, medianRate: number): {
    dealsCount: number;
    medianRate: number;
    reportYear: number;
  } {
    return {
      dealsCount,
      medianRate,
      reportYear: new Date().getFullYear()
    };
  }

  // Chapter 307: Rate Transparency Reports (Differential Privacy)
  public addDifferentialPrivacyNoise(actualValue: number, epsilon = 1.0): number {
    // Laplace-like simulated perturbation scaled by 1/epsilon
    const noise = (Math.sin(actualValue) * 2) / epsilon;
    return Math.round((actualValue + noise) * 10) / 10;
  }

  // Chapter 308: Job Market Trends from Public Sources
  public ingestVerifiedJobs(postings: Array<{ id: string; verifiedEmployer: boolean }>): number {
    const verified = postings.filter((p) => p.verifiedEmployer);
    return verified.length;
  }

  // Chapter 309: Dialect-Aware Sentiment Explorer
  public evaluateCommunitySentiment(text: string, dialect: string): { sentimentScore: number; dialectDetected: string } {
    const positiveWords = ['جامد', 'ممتاز', 'عاش', 'كفو', 'روعة', 'awesome', 'great'];
    const isPositive = positiveWords.some((w) => text.includes(w));
    return {
      sentimentScore: isPositive ? 0.8 : 0.0,
      dialectDetected: dialect
    };
  }

  // Chapter 310: Impact Measurement Framework
  public calculateCommunityImpact(metrics: {
    hoursMentored: number;
    dealsFacilitatedUsd: number;
    openSourceProjectsShipped: number;
  }): { totalScore: number; verifiedSummary: string } {
    const totalScore = metrics.hoursMentored * 10 + metrics.openSourceProjectsShipped * 50;
    return {
      totalScore,
      verifiedSummary: `${metrics.hoursMentored}h mentoring, \$${metrics.dealsFacilitatedUsd} volume, ${metrics.openSourceProjectsShipped} OSS projects`
    };
  }

  // Chapter 311: Member Journey Maps
  public traceMemberProgression(stage: 'Onboarding' | 'Verified' | 'ActiveContributor' | 'Mentor'): {
    currentStage: string;
    nextMilestone: string;
  } {
    const milestones: Record<string, string> = {
      'Onboarding': 'Complete profile & values orientation',
      'Verified': 'Submit first project or pass skill assessment',
      'ActiveContributor': 'Complete 3 peer code reviews',
      'Mentor': 'Guide apprentice through live cohort'
    };
    return {
      currentStage: stage,
      nextMilestone: milestones[stage] || 'Continue community engagement'
    };
  }

  // Chapter 312: Anomaly Explainer
  public explainTrafficAnomaly(currentRate: number, baselineRate: number): { isAnomaly: boolean; causeAttribution: string } {
    const ratio = currentRate / (baselineRate || 1);
    if (ratio > 2.5) {
      return { isAnomaly: true, causeAttribution: 'Sudden external workshop mention or viral social campaign' };
    }
    return { isAnomaly: false, causeAttribution: 'Normal distribution fluctuations' };
  }

  // Chapter 313: Weekly Executive Brief
  public generateWeeklyExecutiveBrief(activeCount: number, resolvedTickets: number): {
    summary: string;
    actionItem: string;
  } {
    return {
      summary: `Active members: ${activeCount}, Help tickets resolved: ${resolvedTickets}.`,
      actionItem: activeCount > 100 ? 'Maintain current volunteer rotation capacity.' : 'Promote upcoming community workshop.'
    };
  }

  // Chapter 314: Data Quality Monitor
  public auditDataQuality(records: Array<{ id: string; email?: string }>): { duplicatesCount: number; validCount: number } {
    const seen = new Set<string>();
    let duplicatesCount = 0;
    for (const r of records) {
      if (seen.has(r.id)) duplicatesCount++;
      else seen.add(r.id);
    }
    return { duplicatesCount, validCount: seen.size };
  }

  // Chapter 315: Privacy-Preserving Analytics
  public enforceDifferencingDefense(query1Count: number, query2Count: number): { isQueryPermitted: boolean } {
    // If difference between two queries reveals an individual (count difference == 1), reject
    const diff = Math.abs(query1Count - query2Count);
    return { isQueryPermitted: diff !== 1 };
  }
}

export const dataInsightsEngine = new DataInsightsEngine();
