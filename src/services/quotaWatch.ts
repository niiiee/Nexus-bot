export interface QuotaStatus {
  dbStorageMb: number;
  dbStorageMaxMb: number;
  aiMonthlySpendUsd: number;
  aiSpendCapUsd: number;
  is80PercentWarningTriggered: boolean;
  isDegradationActive: boolean;
  circuitBreakerTripped: boolean;
}

export class QuotaWatch {
  private dbStorageMb = 50;
  private dbStorageMaxMb = 500; // 500 MB Supabase Free Tier limit
  private aiMonthlySpendUsd = 0.50;
  private aiSpendCapUsd = 25.00; // $25 hard budget cap

  public setDbStorage(mb: number): void {
    this.dbStorageMb = mb;
  }

  public reset(): void {
    this.dbStorageMb = 50;
    this.aiMonthlySpendUsd = 0.50;
  }

  public recordAiCost(usd: number): void {
    this.aiMonthlySpendUsd += usd;
  }

  public evaluateQuotaHealth(): QuotaStatus {
    const dbUtilization = this.dbStorageMb / this.dbStorageMaxMb;
    const aiUtilization = this.aiMonthlySpendUsd / this.aiSpendCapUsd;

    const maxUtilization = Math.max(dbUtilization, aiUtilization);
    const is80PercentWarningTriggered = maxUtilization >= 0.80;
    const isDegradationActive = maxUtilization >= 0.95;
    const circuitBreakerTripped = this.aiMonthlySpendUsd >= this.aiSpendCapUsd;

    return {
      dbStorageMb: this.dbStorageMb,
      dbStorageMaxMb: this.dbStorageMaxMb,
      aiMonthlySpendUsd: Math.round(this.aiMonthlySpendUsd * 100) / 100,
      aiSpendCapUsd: this.aiSpendCapUsd,
      is80PercentWarningTriggered,
      isDegradationActive,
      circuitBreakerTripped
    };
  }

  public isAiCallAllowed(estimatedCostUsd: number): { allowed: boolean; reason?: string } {
    if (this.aiMonthlySpendUsd + estimatedCostUsd > this.aiSpendCapUsd) {
      return {
        allowed: false,
        reason: 'Cost Cap Protection: Monthly AI spend budget limit reached ($25.00). Runaway loop intercepted.'
      };
    }
    return { allowed: true };
  }
}

export const quotaWatch = new QuotaWatch();
