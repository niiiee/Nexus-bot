import crypto from 'node:crypto';
import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export type SupportedCurrency = 'USD' | 'EUR' | 'EGP' | 'AED' | 'USDC' | 'SOL';

export interface SponsorPackage {
  id: string;
  name: string;
  priceUsd: number;
  durationDays: number;
  perks: string[];
}

export interface MultiCurrencyQuote {
  baseAmountUsd: number;
  targetCurrency: SupportedCurrency;
  convertedAmount: number;
  exchangeRate: number;
  quotedAt: number;
}

export interface NonCustodialEscrowAuthorization {
  dealId: string;
  milestoneId: string;
  amountUsd: number;
  currency: SupportedCurrency;
  releaseToken: string;
  signatureHex: string;
  authorizedAt: number;
  isDisputed: boolean;
}

export class MultiCurrencySettlementService {
  private static readonly RATES_TO_USD: Record<SupportedCurrency, number> = {
    USD: 1.0,
    EUR: 1.08,     // 1 EUR = 1.08 USD
    EGP: 0.021,    // 1 EGP = 0.021 USD (~48 EGP/USD)
    AED: 0.272,    // 1 AED = 0.272 USD (3.67 AED/USD)
    USDC: 1.0,     // 1 USDC = 1.0 USD
    SOL: 145.0     // 1 SOL = 145.0 USD
  };

  /**
   * REQ-23.17.1: Convert base USD amount to target fiat/crypto currency
   */
  public convertCurrency(
    amountUsd: number,
    targetCurrency: SupportedCurrency
  ): MultiCurrencyQuote {
    const rateToUsd = MultiCurrencySettlementService.RATES_TO_USD[targetCurrency];
    const converted = Number((amountUsd / rateToUsd).toFixed(targetCurrency === 'SOL' ? 4 : 2));

    return {
      baseAmountUsd: amountUsd,
      targetCurrency,
      convertedAmount: converted,
      exchangeRate: Number((1 / rateToUsd).toFixed(4)),
      quotedAt: Date.now()
    };
  }

  /**
   * REQ-23.16.1: Sponsor package catalog and checkout link generator
   */
  public getSponsorPackages(): SponsorPackage[] {
    return [
      {
        id: 'sponsor_bronze',
        name: 'Community Supporter',
        priceUsd: 150,
        durationDays: 30,
        perks: ['Logo on dashboard', 'Sponsor role & badge']
      },
      {
        id: 'sponsor_silver',
        name: 'Workshop Partner',
        priceUsd: 450,
        durationDays: 30,
        perks: ['Host 1 sponsored workshop', 'Pinned forum post', 'Bronze perks']
      },
      {
        id: 'sponsor_gold',
        name: 'Guild Headline Sponsor',
        priceUsd: 1200,
        durationDays: 30,
        perks: ['Monthly community broadcast', 'Featured banner on SEO wiki', 'Silver perks']
      }
    ];
  }

  public generateSponsorCheckoutUrl(tenantId: string, packageId: string): string {
    return `https://checkout.nexus.platform/sponsor?tenant=${tenantId}&package=${packageId}`;
  }

  /**
   * REQ-23.17.2: Non-custodial milestone release authorization token generator
   * (Strict non-custodial: generates cryptographic instruction payload for third-party rails)
   */
  public authorizeMilestoneRelease(
    dealId: string,
    milestoneId: string,
    amountUsd: number,
    currency: SupportedCurrency = 'USDC',
    mediatorSecret = 'escrow_non_custodial_secret_772'
  ): NonCustodialEscrowAuthorization {
    const releaseToken = `rel_${cryptoRandomUUID()}`;
    const now = Date.now();

    const payload = `${dealId}:${milestoneId}:${amountUsd}:${currency}:${releaseToken}:${now}`;
    const signatureHex = crypto.createHmac('sha256', mediatorSecret).update(payload).digest('hex');

    return {
      dealId,
      milestoneId,
      amountUsd,
      currency,
      releaseToken,
      signatureHex,
      authorizedAt: now,
      isDisputed: false
    };
  }

  /**
   * REQ-23.17.3: Lock milestone release in case of dispute
   */
  public lockDisputedMilestone(
    auth: NonCustodialEscrowAuthorization,
    disputeReason: string
  ): NonCustodialEscrowAuthorization {
    logger.warn('Non-custodial milestone release locked due to dispute', {
      dealId: auth.dealId,
      disputeReason
    });
    return {
      ...auth,
      isDisputed: true
    };
  }
}

export const multiCurrencySettlement = new MultiCurrencySettlementService();
