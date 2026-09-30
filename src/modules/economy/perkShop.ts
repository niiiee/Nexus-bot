import { PerkEngine, PurchaseResult } from '../../perks/perkEngine.js';
import { ALL_195_PERKS, PerkMetadata } from '../../perks/catalog.js';
import { creditLedgerService } from './creditLedger.js';
import { logger } from '../../utils/logger.js';

export interface ShopFilter {
  category?: string;
  minLevel?: number;
  maxPrice?: number;
  search?: string;
}

export class PerkShopService {
  private perkEngine: PerkEngine;

  constructor() {
    this.perkEngine = new PerkEngine();
  }

  /**
   * Lists available perks in the shop with optional filtering.
   */
  public browseShop(filter?: ShopFilter): PerkMetadata[] {
    let perks = ALL_195_PERKS.filter(p => p.is_active === 1);

    if (filter?.category) {
      perks = perks.filter(p => p.category.toLowerCase() === filter.category!.toLowerCase());
    }

    if (filter?.minLevel !== undefined) {
      perks = perks.filter(p => p.level_requirement <= filter.minLevel!);
    }

    if (filter?.maxPrice !== undefined) {
      perks = perks.filter(p => p.credit_price <= filter.maxPrice!);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      perks = perks.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }

    return perks;
  }

  /**
   * Formats a paginated bilingual shop catalog view for Discord embeds.
   */
  public formatShopPage(params: {
    category?: string;
    page: number;
    pageSize?: number;
    locale: 'ar' | 'en';
  }): { text: string; totalPages: number; currentPage: number; totalItems: number } {
    const pageSize = params.pageSize || 6;
    const allFiltered = this.browseShop({ category: params.category });
    const totalItems = allFiltered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.max(1, Math.min(totalPages, params.page));

    const startIndex = (page - 1) * pageSize;
    const pageItems = allFiltered.slice(startIndex, startIndex + pageSize);

    const isAr = params.locale === 'ar';
    const title = isAr
      ? `🛒 **متجر المزايا والترقيات (Senior Progg Perks)**`
      : `🛒 **Senior Progg Perk Shop & Upgrades**`;

    const categoryText = params.category
      ? (isAr ? `القسم: **${params.category}**` : `Category: **${params.category}**`)
      : (isAr ? `جميع الأقسام` : `All Categories`);

    const lines: string[] = [
      title,
      `${categoryText} | ${isAr ? 'الصفحة' : 'Page'} ${page}/${totalPages} (${totalItems} ${isAr ? 'ميزة' : 'perks'})\n`,
    ];

    for (const perk of pageItems) {
      const priceText = isAr ? `🪙 **${perk.credit_price} نقطة**` : `🪙 **${perk.credit_price} credits**`;
      const levelText = perk.level_requirement > 1
        ? (isAr ? ` | المستوى الأدنى: Lv.${perk.level_requirement}` : ` | Req: Lv.${perk.level_requirement}`)
        : '';
      const days = perk.duration_seconds > 0 ? Math.round(perk.duration_seconds / 86400) : 0;
      const durationText = days > 0
        ? (isAr ? ` (${days} يوم)` : ` (${days}d)`)
        : (isAr ? ' (دائم)' : ' (Permanent)');

      lines.push(`• **${perk.name}** (\`${perk.id}\`) — ${priceText}${levelText}${durationText}`);
      lines.push(`  *${perk.description}*`);
    }

    lines.push(
      isAr
        ? `\n💡 للشراء استخدم: \`/buy <perk_id>\` | لمعاينة تفاصيل الميزة: \`/perk-info <perk_id>\``
        : `\n💡 To purchase, use: \`/buy <perk_id>\` | Inspect perk details: \`/perk-info <perk_id>\``
    );

    return {
      text: lines.join('\n'),
      totalPages,
      currentPage: page,
      totalItems,
    };
  }

  /**
   * Executes a purchase of a perk.
   */
  public purchase(userId: string, guildId: string, perkId: string): PurchaseResult {
    return this.perkEngine.purchasePerk({
      userId,
      guildId,
      perkId,
    });
  }
}

export const perkShopService = new PerkShopService();
