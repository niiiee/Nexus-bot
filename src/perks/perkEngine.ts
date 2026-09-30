import { perkRepo, MemberPerkRecord } from '../database/repositories/perkRepo.js';
import { memberRepo } from '../database/repositories/memberRepo.js';
import { economyRepo } from '../database/repositories/economyRepo.js';
import { auditRepo } from '../database/repositories/auditRepo.js';
import { ALL_195_PERKS, PerkMetadata } from './catalog.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PerkEngine');

export interface PurchaseResult {
  success: boolean;
  perk?: PerkMetadata;
  memberPerk?: MemberPerkRecord;
  remainingCredits: number;
  message: string;
}

export class PerkEngine {
  constructor() {
    this.seedCatalogToDatabase();
  }

  public seedCatalogToDatabase(): void {
    logger.info(`Seeding all ${ALL_195_PERKS.length} perks into database catalog...`);
    for (const perk of ALL_195_PERKS) {
      perkRepo.upsertDefinition(perk);
    }
    logger.info('Perk catalog seeding complete.');
  }

  public getPerk(perkId: string): PerkMetadata | undefined {
    return ALL_195_PERKS.find(p => p.id === perkId);
  }

  public listCatalog(category?: string): PerkMetadata[] {
    if (category) {
      return ALL_195_PERKS.filter(p => p.category.toLowerCase() === category.toLowerCase() && p.is_active === 1);
    }
    return ALL_195_PERKS.filter(p => p.is_active === 1);
  }

  public purchasePerk(params: {
    userId: string;
    guildId: string;
    perkId: string;
  }): PurchaseResult {
    const perk = this.getPerk(params.perkId);
    if (!perk) {
      return { success: false, remainingCredits: 0, message: `Perk "${params.perkId}" not found in catalog.` };
    }

    if (perk.is_active !== 1) {
      return { success: false, remainingCredits: 0, message: `Perk "${perk.name}" is currently disabled.` };
    }

    const member = memberRepo.getOrCreate(params.userId, params.guildId, 'Member');

    // 1. Balance check
    if (member.credits_balance < perk.credit_price) {
      return {
        success: false,
        remainingCredits: member.credits_balance,
        message: `Insufficient credits. Required: ${perk.credit_price}, Current balance: ${member.credits_balance}.`,
      };
    }

    // 2. Check for stock if limited
    if (perk.stock === 0) {
      return { success: false, remainingCredits: member.credits_balance, message: `Perk "${perk.name}" is out of stock.` };
    }

    // 3. Deduct credits via economy ledger transaction
    const tx = economyRepo.addTransaction({
      user_id: params.userId,
      guild_id: params.guildId,
      amount: -perk.credit_price,
      source: 'perk_purchase',
      description: `Purchased perk: ${perk.name} (${perk.id})`,
    });

    // 4. Grant perk to member
    const memberPerk = perkRepo.grantPerk(params.userId, params.guildId, perk.id, perk.duration_seconds);

    // 5. Audit log
    auditRepo.log({
      guild_id: params.guildId,
      action_type: 'perk_purchased',
      actor_id: params.userId,
      target_id: params.userId,
      details: { perkId: perk.id, price: perk.credit_price, durationSeconds: perk.duration_seconds },
      reasoning: `Member purchased ${perk.name} for ${perk.credit_price} credits.`,
      reversible: true,
    });

    logger.info(`User ${params.userId} successfully purchased perk ${perk.id}`);

    return {
      success: true,
      perk,
      memberPerk,
      remainingCredits: tx.balance_after,
      message: `Successfully acquired perk "${perk.name}"!`,
    };
  }

  public hasPerk(userId: string, perkId: string): boolean {
    return perkRepo.hasActivePerk(userId, perkId);
  }
}

export const perkEngine = new PerkEngine();
