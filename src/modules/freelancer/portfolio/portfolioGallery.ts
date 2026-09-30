import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface PortfolioItem {
  id: string;
  userId: string;
  guildId: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  upvotes: number;
  createdAt: number;
}

export class PortfolioGalleryService {
  public addPortfolioItem(params: {
    userId: string;
    guildId: string;
    title: string;
    description: string;
    url: string;
    tags: string[];
  }): PortfolioItem {
    const id = `port_${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO portfolio_items (id, user_id, guild_id, title, description, url, tags, upvotes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      id,
      params.userId,
      params.guildId,
      params.title,
      params.description,
      params.url,
      JSON.stringify(params.tags),
      now
    );

    logger.info('PortfolioGallery', `Added portfolio item ${id} for user ${params.userId}`);

    return {
      id,
      userId: params.userId,
      guildId: params.guildId,
      title: params.title,
      description: params.description,
      url: params.url,
      tags: params.tags,
      upvotes: 0,
      createdAt: now,
    };
  }

  public getMemberItems(userId: string, guildId: string): PortfolioItem[] {
    const rows = dbService.all<{
      id: string;
      user_id: string;
      guild_id: string;
      title: string;
      description: string;
      url: string;
      tags: string;
      upvotes: number;
      created_at: number;
    }>(
      `SELECT * FROM portfolio_items WHERE user_id = ? AND guild_id = ? ORDER BY upvotes DESC, created_at DESC`,
      userId,
      guildId
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      guildId: r.guild_id,
      title: r.title,
      description: r.description,
      url: r.url,
      tags: JSON.parse(r.tags || '[]'),
      upvotes: r.upvotes,
      createdAt: r.created_at,
    }));
  }

  public upvoteItem(itemId: string, voterId: string): { success: boolean; newUpvotes: number } {
    const item = dbService.get<{ upvotes: number; user_id: string }>(
      `SELECT upvotes, user_id FROM portfolio_items WHERE id = ?`,
      itemId
    );

    if (!item) return { success: false, newUpvotes: 0 };
    if (item.user_id === voterId) return { success: false, newUpvotes: item.upvotes }; // prevent self-upvote

    const newUpvotes = item.upvotes + 1;
    dbService.run(`UPDATE portfolio_items SET upvotes = ? WHERE id = ?`, newUpvotes, itemId);

    return { success: true, newUpvotes };
  }

  public generateShowcaseEmbed(item: PortfolioItem, username: string, lang: 'en' | 'ar' = 'en') {
    const isAr = lang === 'ar';
    return {
      title: `🎨 ${item.title}`,
      description: item.description,
      url: item.url,
      color: 0x8b5cf6,
      author: {
        name: isAr ? `معرض أعمال: ${username}` : `Portfolio Showcase: ${username}`,
      },
      fields: [
        {
          name: isAr ? '🔗 الرابط' : '🔗 Link',
          value: item.url,
          inline: false,
        },
        {
          name: isAr ? '🏷 التصنيفات' : '🏷 Tags',
          value: item.tags.map((t) => `\`${t}\``).join(' ') || (isAr ? 'عام' : 'General'),
          inline: true,
        },
        {
          name: isAr ? '⭐ الإعجابات' : '⭐ Upvotes',
          value: `${item.upvotes}`,
          inline: true,
        },
      ],
      footer: {
        text: `ID: ${item.id}`,
      },
    };
  }
}

export const portfolioGalleryService = new PortfolioGalleryService();
