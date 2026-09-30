import { logger } from '../../../utils/logger.js';

export interface RateCalculationInput {
  monthlyTargetIncome: number;
  currency: 'USD' | 'EGP' | 'EUR' | 'SAR' | 'AED';
  billableHoursPerWeek: number; // typically 20-25 hrs
  vacationWeeksPerYear: number; // e.g. 4 weeks
  overheadBufferPercent?: number; // e.g. 25% for taxes, software licenses, equipment
  region: 'egypt' | 'mena' | 'global';
  skillLevel: 'Junior' | 'Mid' | 'Senior' | 'Specialist';
}

export interface RateCalculationResult {
  baseHourlyRate: number;
  minimumFloorRate: number;
  recommendedProjectRateDaily: number;
  marketBenchmark: {
    low: number;
    median: number;
    high: number;
  };
  explanation: string;
}

export class RateCalculatorService {
  // Regional hourly benchmarks in USD
  private benchmarksUSD: Record<string, Record<string, { low: number; median: number; high: number }>> = {
    egypt: {
      Junior: { low: 8, median: 15, high: 22 },
      Mid: { low: 20, median: 32, high: 45 },
      Senior: { low: 35, median: 55, high: 80 },
      Specialist: { low: 50, median: 85, high: 140 },
    },
    mena: {
      Junior: { low: 15, median: 25, high: 35 },
      Mid: { low: 30, median: 50, high: 70 },
      Senior: { low: 55, median: 85, high: 120 },
      Specialist: { low: 80, median: 130, high: 200 },
    },
    global: {
      Junior: { low: 25, median: 40, high: 60 },
      Mid: { low: 50, median: 80, high: 110 },
      Senior: { low: 85, median: 130, high: 180 },
      Specialist: { low: 120, median: 190, high: 300 },
    },
  };

  public calculateRate(input: RateCalculationInput, lang: 'en' | 'ar' = 'en'): RateCalculationResult {
    const isAr = lang === 'ar';
    const overhead = (input.overheadBufferPercent ?? 25) / 100;
    const workingWeeks = Math.max(1, 52 - input.vacationWeeksPerYear);
    const annualTarget = input.monthlyTargetIncome * 12;
    const grossTarget = annualTarget * (1 + overhead);

    const totalBillableHoursPerYear = Math.max(1, workingWeeks * input.billableHoursPerWeek);
    const calculatedHourly = Math.round(grossTarget / totalBillableHoursPerYear);

    const baseHourlyRate = Math.max(5, calculatedHourly);
    const minimumFloorRate = Math.round(baseHourlyRate * 0.8);
    const recommendedProjectRateDaily = baseHourlyRate * 6; // 6 productive billable hours per day

    const benchmark = this.benchmarksUSD[input.region]?.[input.skillLevel] || { low: 15, median: 35, high: 60 };

    const explanation = isAr
      ? `حاسبة تسعير الفريلانسر:\n` +
        `• الدخل الشهري المستهدف: ${input.monthlyTargetIncome} ${input.currency}\n` +
        `• ساعات العمل الفعلية الفاتورة أسبوعياً: ${input.billableHoursPerWeek} ساعة (${workingWeeks} أسبوع سنوياً)\n` +
        `• هامش الضرائب والأدوات (${(overhead * 100).toFixed(0)}%): مضاف للحساب\n` +
        `• الحد الأدنى للساعة (Floor Rate): ${minimumFloorRate} ${input.currency}\n` +
        `• السعر المقترح للساعة: ${baseHourlyRate} ${input.currency}\n` +
        `• اليومية المقترحة (6 ساعات إنتاجية): ${recommendedProjectRateDaily} ${input.currency}`
      : `Freelancer Rate Calculation:\n` +
        `• Monthly Net Target: ${input.monthlyTargetIncome} ${input.currency}\n` +
        `• Billable Hours/Week: ${input.billableHoursPerWeek} hrs (${workingWeeks} active weeks/yr)\n` +
        `• Overhead Buffer (${(overhead * 100).toFixed(0)}%): Included for taxes/software/hardware\n` +
        `• Minimum Floor Rate: ${minimumFloorRate} ${input.currency}/hr\n` +
        `• Recommended Base Rate: ${baseHourlyRate} ${input.currency}/hr\n` +
        `• Day Rate (6 billable hrs): ${recommendedProjectRateDaily} ${input.currency}/day`;

    logger.info('RateCalculator', `Calculated rate for ${input.skillLevel} in ${input.region}: ${baseHourlyRate} ${input.currency}/hr`);

    return {
      baseHourlyRate,
      minimumFloorRate,
      recommendedProjectRateDaily,
      marketBenchmark: benchmark,
      explanation,
    };
  }
}

export const rateCalculatorService = new RateCalculatorService();
