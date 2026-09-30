import { dbService } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface ResourceItem {
  id: string;
  guildId: string;
  title: string;
  category: 'code' | 'design' | 'freelance' | 'security';
  url: string;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  suggestedBy: string;
  createdAt: number;
}

export class ResourceLibraryService {
  public suggestResource(params: {
    guildId: string;
    title: string;
    category: 'code' | 'design' | 'freelance' | 'security';
    url: string;
    tags: string[];
    suggestedBy: string;
  }): ResourceItem {
    const id = `res_${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    dbService.run(
      `INSERT INTO resources (id, guild_id, title, category, url, tags, status, suggested_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      id,
      params.guildId,
      params.title,
      params.category,
      params.url,
      JSON.stringify(params.tags),
      params.suggestedBy,
      now
    );

    logger.info('ResourceLibrary', `Resource ${id} suggested by ${params.suggestedBy}: "${params.title}"`);

    return {
      id,
      guildId: params.guildId,
      title: params.title,
      category: params.category,
      url: params.url,
      tags: params.tags,
      status: 'pending',
      suggestedBy: params.suggestedBy,
      createdAt: now,
    };
  }

  public approveResource(resourceId: string): boolean {
    const res = dbService.run(`UPDATE resources SET status = 'approved' WHERE id = ?`, resourceId);
    return res.changes > 0;
  }

  public searchResources(guildId: string, query?: string, category?: string): ResourceItem[] {
    let sql = `SELECT * FROM resources WHERE guild_id = ? AND status = 'approved'`;
    const params: (string | number)[] = [guildId];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    const rows = dbService.all<{
      id: string;
      guild_id: string;
      title: string;
      category: 'code' | 'design' | 'freelance' | 'security';
      url: string;
      tags: string;
      status: 'pending' | 'approved' | 'rejected';
      suggested_by: string;
      created_at: number;
    }>(sql, ...params);

    const items: ResourceItem[] = rows.map((r) => ({
      id: r.id,
      guildId: r.guild_id,
      title: r.title,
      category: r.category,
      url: r.url,
      tags: JSON.parse(r.tags || '[]'),
      status: r.status,
      suggestedBy: r.suggested_by,
      createdAt: r.created_at,
    }));

    if (query) {
      const q = query.toLowerCase();
      return items.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return items;
  }

  public seedInitialResources(guildId: string): void {
    const count = dbService.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM resources WHERE guild_id = ?`,
      guildId
    )?.count || 0;

    if (count > 0) return;

    const initial: Array<Omit<ResourceItem, 'id' | 'createdAt' | 'status'>> = [
      {
        guildId,
        title: 'Modern Full-Stack Architecture Handbook',
        category: 'code',
        url: 'https://roadmap.sh/full-stack',
        tags: ['nextjs', 'node', 'architecture', 'react'],
        suggestedBy: 'system',
      },
      {
        guildId,
        title: 'Refactoring UI & Color Palettes',
        category: 'design',
        url: 'https://www.refactoringui.com',
        tags: ['figma', 'uiux', 'typography', 'colors'],
        suggestedBy: 'system',
      },
      {
        guildId,
        title: 'OWASP Top 10 Web Application Security',
        category: 'security',
        url: 'https://owasp.org/www-project-top-ten/',
        tags: ['security', 'owasp', 'vulnerabilities'],
        suggestedBy: 'system',
      },
    ];

    for (const item of initial) {
      const id = `res_${randomUUID().slice(0, 8)}`;
      dbService.run(
        `INSERT INTO resources (id, guild_id, title, category, url, tags, status, suggested_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?)`,
        id,
        guildId,
        item.title,
        item.category,
        item.url,
        JSON.stringify(item.tags),
        item.suggestedBy,
        Date.now()
      );
    }
  }
}

export const resourceLibraryService = new ResourceLibraryService();
