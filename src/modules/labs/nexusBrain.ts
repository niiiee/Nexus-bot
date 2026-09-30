import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface KnowledgeArticleRecord {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  category: string;
  source_channel_id: string | null;
  access_role_id: string | null;
  contributor_id: string;
  upvotes: number;
  is_verified: number;
  created_at: number;
  updated_at: number;
}

export interface KnowledgeCitation {
  articleId: string;
  title: string;
  category: string;
  contributorId: string;
  sourceChannelId: string | null;
  url: string;
}

export interface KnowledgeAnswer {
  question: string;
  answer: string;
  confidence: number;
  citations: KnowledgeCitation[];
  hasPrivateDataFiltered: boolean;
}

export class NexusBrainKnowledgeEngine {
  private static readonly RESTRICTED_CHANNEL_PATTERNS = [
    /admin/i,
    /staff/i,
    /mod/i,
    /private/i,
    /internal/i,
    /audit/i
  ];

  /**
   * REQ-23.24.1: Index verified answer, thread, or document
   */
  public indexArticle(
    tenantId: string,
    title: string,
    content: string,
    category: string,
    contributorId: string,
    sourceChannelId?: string,
    accessRoleId?: string,
    isVerified = 1
  ): KnowledgeArticleRecord {
    const id = cryptoRandomUUID();
    const now = Date.now();

    dbService.run(
      `INSERT INTO knowledge_articles (
         id, tenant_id, title, content, category, source_channel_id,
         access_role_id, contributor_id, upvotes, is_verified, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      id,
      tenantId,
      title,
      content,
      category,
      sourceChannelId || null,
      accessRoleId || null,
      contributorId,
      isVerified,
      now,
      now
    );

    return {
      id,
      tenant_id: tenantId,
      title,
      content,
      category,
      source_channel_id: sourceChannelId || null,
      access_role_id: accessRoleId || null,
      contributor_id: contributorId,
      upvotes: 0,
      is_verified: isVerified,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * REQ-23.24.3: Check if a channel is restricted/private to prevent leaks
   */
  public isChannelRestricted(channelNameOrId: string): boolean {
    return NexusBrainKnowledgeEngine.RESTRICTED_CHANNEL_PATTERNS.some(pat => pat.test(channelNameOrId));
  }

  /**
   * REQ-23.24.2 & REQ-23.24.3: Cited Q&A response generator with permission-aware filtering
   */
  public queryKnowledge(
    tenantId: string,
    question: string,
    userRoleIds: string[] = [],
    restrictedChannelNames: string[] = []
  ): KnowledgeAnswer {
    const articles = dbService.all<KnowledgeArticleRecord>(
      `SELECT * FROM knowledge_articles WHERE tenant_id = ? AND is_verified = 1`,
      tenantId
    );

    let filteredCount = 0;
    const tokens = question.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    const scoredArticles: Array<{ article: KnowledgeArticleRecord; score: number }> = [];

    for (const art of articles) {
      // REQ-23.24.3: Permission check on access_role_id
      if (art.access_role_id && !userRoleIds.includes(art.access_role_id)) {
        filteredCount++;
        continue;
      }

      // Check if source channel matches restricted list
      if (art.source_channel_id && restrictedChannelNames.includes(art.source_channel_id)) {
        filteredCount++;
        continue;
      }

      // Score relevance by token matching in title and content
      const text = `${art.title} ${art.content} ${art.category}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (text.includes(t)) {
          score += 1;
        }
      }

      if (score > 0) {
        // Boost verified and upvoted articles
        score += (art.upvotes * 0.1);
        scoredArticles.push({ article: art, score });
      }
    }

    scoredArticles.sort((a, b) => b.score - a.score);

    if (scoredArticles.length === 0) {
      return {
        question,
        answer: 'No verified community knowledge articles found matching your query.',
        confidence: 0.0,
        citations: [],
        hasPrivateDataFiltered: filteredCount > 0
      };
    }

    const topMatches = scoredArticles.slice(0, 3);
    const citations: KnowledgeCitation[] = topMatches.map(m => ({
      articleId: m.article.id,
      title: m.article.title,
      category: m.article.category,
      contributorId: m.article.contributor_id,
      sourceChannelId: m.article.source_channel_id,
      url: `https://discord.com/channels/${tenantId}/${m.article.source_channel_id || 'kb'}/${m.article.id}`
    }));

    const primaryArticle = topMatches[0].article;
    const answer = `Based on verified community solution "${primaryArticle.title}":\n\n` +
      `${primaryArticle.content}\n\n` +
      `Sources:\n` +
      citations.map(c => `• [${c.title}](${c.url}) by <@${c.contributorId}> in #${c.category}`).join('\n');

    return {
      question,
      answer,
      confidence: Math.min(1.0, topMatches[0].score / (tokens.length || 1)),
      citations,
      hasPrivateDataFiltered: filteredCount > 0
    };
  }

  /**
   * REQ-23.24.4: Community Wiki generator synthesizing articles into structured Markdown
   */
  public generateWikiMarkdown(tenantId: string): string {
    const articles = dbService.all<KnowledgeArticleRecord>(
      `SELECT * FROM knowledge_articles WHERE tenant_id = ? AND is_verified = 1 ORDER BY category ASC, upvotes DESC`,
      tenantId
    );

    if (articles.length === 0) {
      return `# Community Knowledge Wiki\n\n*No published knowledge articles yet.*`;
    }

    // Group by category
    const categorized = new Map<string, KnowledgeArticleRecord[]>();
    for (const art of articles) {
      const list = categorized.get(art.category) || [];
      list.push(art);
      categorized.set(art.category, list);
    }

    let md = `# 📚 Community Knowledge Wiki\n\n`;
    md += `*Generated automatically by Nexus Brain Knowledge Engine*\n\n`;
    md += `## Table of Contents\n`;

    for (const cat of categorized.keys()) {
      md += `- [${cat}](#${cat.toLowerCase().replace(/\s+/g, '-')})\n`;
    }
    md += `\n---\n\n`;

    for (const [category, items] of categorized.entries()) {
      md += `### ${category}\n\n`;
      for (const item of items) {
        md += `#### ${item.title} ${item.is_verified ? '✅' : ''}\n\n`;
        md += `${item.content}\n\n`;
        md += `> **Contributor:** <@${item.contributor_id}> | **Upvotes:** ${item.upvotes} | **Updated:** ${new Date(item.updated_at).toLocaleDateString()}\n\n`;
      }
    }

    return md;
  }

  /**
   * REQ-23.24.5: Public SEO portal generation option for white-label tenants
   */
  public generatePublicPortalHtml(tenantId: string, brandName = 'Nexus Knowledge Hub'): string {
    const articles = dbService.all<KnowledgeArticleRecord>(
      `SELECT * FROM knowledge_articles WHERE tenant_id = ? AND access_role_id IS NULL AND is_verified = 1 ORDER BY upvotes DESC`,
      tenantId
    );

    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: articles.map(art => ({
        '@type': 'Question',
        name: art.title,
        acceptedAnswer: {
          '@type': 'Answer',
          text: art.content
        }
      }))
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName} - Public Knowledge Base & Docs</title>
  <meta name="description" content="Official community knowledge base, verified tutorials, and technical solutions for ${brandName}.">
  <meta property="og:title" content="${brandName} Knowledge Hub">
  <meta property="og:description" content="Discover verified answers and guides.">
  <script type="application/ld+json">
    ${JSON.stringify(faqJsonLd)}
  </script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #38bdf8; font-size: 2.2rem; }
    .article-card { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
    .article-title { font-size: 1.3rem; color: #f1f5f9; margin-top: 0; }
    .article-content { line-height: 1.6; color: #94a3b8; }
    .tag { display: inline-block; background: #0369a1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${brandName} Documentation</h1>
    <p>Explore community solutions, guides, and technical tutorials.</p>
    ${articles
      .map(
        a => `
      <div class="article-card">
        <span class="tag">${a.category}</span>
        <h2 class="article-title">${a.title}</h2>
        <div class="article-content">${a.content}</div>
      </div>
    `
      )
      .join('')}
  </div>
</body>
</html>`;
  }
}

export const nexusBrain = new NexusBrainKnowledgeEngine();
