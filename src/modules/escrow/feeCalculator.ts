import { logger } from '../../utils/logger.js';

export type FeeModel = 'percentage' | 'flat' | 'tiered';
export type PayerAllocation = 'client' | 'freelancer' | 'split_50_50';

export interface FeeCalculationResult {
  dealAmount: number;
  currency: string;
  totalFee: number;
  clientPortion: number;
  freelancerPortion: number;
  netPayoutToFreelancer: number;
  grossAmountPaidByClient: number;
  feeModelUsed: FeeModel;
  payerAllocation: PayerAllocation;
  transparencyNote: string;
}

export class FeeCalculatorService {
  public calculateFee(params: {
    dealAmount: number;
    currency?: string;
    model?: FeeModel;
    payerAllocation?: PayerAllocation;
    customPercentage?: number;
    flatFeeAmount?: number;
  }): FeeCalculationResult {
    const currency = params.currency || 'USD';
    const model = params.model || 'tiered';
    const payerAllocation = params.payerAllocation || 'split_50_50';

    let totalFee = 0;

    if (model === 'flat') {
      totalFee = params.flatFeeAmount ?? 15;
    } else if (model === 'percentage') {
      const pct = (params.customPercentage ?? 3.5) / 100;
      totalFee = Math.round(params.dealAmount * pct);
    } else {
      // Tiered default:
      // < 500 -> 5%
      // 500 - 2000 -> 3.5%
      // > 2000 -> 2%
      if (params.dealAmount < 500) {
        totalFee = Math.round(params.dealAmount * 0.05);
      } else if (params.dealAmount <= 2000) {
        totalFee = Math.round(params.dealAmount * 0.035);
      } else {
        totalFee = Math.round(params.dealAmount * 0.02);
      }
    }

    totalFee = Math.max(5, totalFee); // minimum $5 fee for middleman time

    let clientPortion = 0;
    let freelancerPortion = 0;

    if (payerAllocation === 'client') {
      clientPortion = totalFee;
      freelancerPortion = 0;
    } else if (payerAllocation === 'freelancer') {
      clientPortion = 0;
      freelancerPortion = totalFee;
    } else {
      // 50/50 split
      clientPortion = Math.round(totalFee / 2);
      freelancerPortion = totalFee - clientPortion;
    }

    const grossAmountPaidByClient = params.dealAmount + clientPortion;
    const netPayoutToFreelancer = params.dealAmount - freelancerPortion;

    const transparencyNote =
      `Fee breakdown: Deal Base = ${params.dealAmount} ${currency}, Middleman Fee = ${totalFee} ${currency} (${model} model). ` +
      `Client pays: ${grossAmountPaidByClient} ${currency}. Freelancer receives: ${netPayoutToFreelancer} ${currency}. ` +
      `Note: The bot never collects or holds these fees; middleman handles accounting externally.`;

    logger.info('FeeCalculator', `Calculated fee for ${params.dealAmount} ${currency}: totalFee=${totalFee} (${payerAllocation})`);

    return {
      dealAmount: params.dealAmount,
      currency,
      totalFee,
      clientPortion,
      freelancerPortion,
      netPayoutToFreelancer,
      grossAmountPaidByClient,
      feeModelUsed: model,
      payerAllocation,
      transparencyNote,
    };
  }
}

export const feeCalculatorService = new FeeCalculatorService();
