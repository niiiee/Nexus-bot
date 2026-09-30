import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { creditLedgerService } from './creditLedger.js';

export interface MarketplaceListing {
  id: string;
  guildId: string;
  sellerId: string;
  title: string;
  description: string;
  priceCredits: number;
  status: 'active' | 'in_progress' | 'delivered' | 'completed' | 'cancelled';
  createdAt: number;
  buyerId?: string;
}

export class MicroMarketplaceService {
  /**
   * Posts a new micro-service listing.
   */
  public createListing(params: {
    guildId: string;
    sellerId: string;
    title: string;
    description: string;
    priceCredits: number;
  }): { success: boolean; listing?: MarketplaceListing; error?: string } {
    if (params.priceCredits <= 0) {
      return { success: false, error: 'Price must be greater than zero credits' };
    }

    const id = cryptoRandomUUID();
    const createdAt = Date.now();

    dbService.run(
      `INSERT INTO marketplace_listings (id, guild_id, seller_id, title, description, price_credits, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      id,
      params.guildId,
      params.sellerId,
      params.title,
      params.description,
      params.priceCredits,
      createdAt
    );

    logger.info(`[MicroMarketplace] User ${params.sellerId} listed service "${params.title}" for ${params.priceCredits} credits`);

    return {
      success: true,
      listing: {
        id,
        guildId: params.guildId,
        sellerId: params.sellerId,
        title: params.title,
        description: params.description,
        priceCredits: params.priceCredits,
        status: 'active',
        createdAt,
      },
    };
  }

  /**
   * Searches active marketplace listings.
   */
  public searchListings(guildId: string, query?: string): MarketplaceListing[] {
    let sql = `SELECT id, guild_id, seller_id, title, description, price_credits, status, created_at 
               FROM marketplace_listings WHERE guild_id = ? AND status = 'active'`;
    const params: (string | number)[] = [guildId];

    if (query) {
      sql += ` AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)`;
      params.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`);
    }

    sql += ` ORDER BY created_at DESC LIMIT 20`;

    const rows = dbService.all<{
      id: string;
      guild_id: string;
      seller_id: string;
      title: string;
      description: string;
      price_credits: number;
      status: 'active' | 'in_progress' | 'delivered' | 'completed' | 'cancelled';
      created_at: number;
    }>(sql, ...params);

    return rows.map(r => ({
      id: r.id,
      guildId: r.guild_id,
      sellerId: r.seller_id,
      title: r.title,
      description: r.description,
      priceCredits: r.price_credits,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  /**
   * Initiates purchase of a listing, locking buyer credits in escrow.
   */
  public purchaseListing(buyerId: string, listingId: string): { success: boolean; error?: string } {
    const listing = dbService.get<{
      id: string;
      guild_id: string;
      seller_id: string;
      title: string;
      price_credits: number;
      status: string;
    }>(`SELECT * FROM marketplace_listings WHERE id = ?`, listingId);

    if (!listing) return { success: false, error: 'Listing not found' };
    if (listing.status !== 'active') return { success: false, error: 'Listing is no longer active' };
    if (listing.seller_id === buyerId) return { success: false, error: 'Cannot purchase your own listing' };

    // Escrow hold debit from buyer
    const debit = creditLedgerService.recordTransaction({
      userId: buyerId,
      guildId: listing.guild_id,
      amount: -listing.price_credits,
      type: 'marketplace_escrow',
      description: `Escrow hold for marketplace listing: ${listing.title}`,
      bypassCap: true,
    });

    if (!debit.success) {
      return { success: false, error: debit.error || 'Insufficient credits' };
    }

    dbService.run(
      `UPDATE marketplace_listings SET status = 'in_progress' WHERE id = ?`,
      listingId
    );

    logger.info(`[MicroMarketplace] Buyer ${buyerId} purchased listing ${listingId}. Held ${listing.price_credits} credits in escrow.`);
    return { success: true };
  }

  /**
   * Confirms delivery and releases held credits to the seller.
   */
  public completeOrder(listingId: string, buyerId: string): { success: boolean; error?: string } {
    const listing = dbService.get<{
      id: string;
      guild_id: string;
      seller_id: string;
      title: string;
      price_credits: number;
      status: string;
    }>(`SELECT * FROM marketplace_listings WHERE id = ?`, listingId);

    if (!listing) return { success: false, error: 'Listing not found' };
    if (listing.status !== 'in_progress' && listing.status !== 'delivered') {
      return { success: false, error: 'Listing is not in progress or delivered' };
    }

    // Payout seller
    const payout = creditLedgerService.recordTransaction({
      userId: listing.seller_id,
      guildId: listing.guild_id,
      amount: listing.price_credits,
      type: 'marketplace_payout',
      description: `Payout for marketplace listing: ${listing.title}`,
      bypassCap: true,
    });

    if (!payout.success) {
      return { success: false, error: 'Failed to release payout' };
    }

    dbService.run(`UPDATE marketplace_listings SET status = 'completed' WHERE id = ?`, listingId);
    logger.info(`[MicroMarketplace] Order ${listingId} completed. Released ${listing.price_credits} credits to seller ${listing.seller_id}`);

    return { success: true };
  }
}

export const microMarketplaceService = new MicroMarketplaceService();
