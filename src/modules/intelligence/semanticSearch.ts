export interface SearchableKnowledgeDoc {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  requiredPermissionRole?: string;
  language: 'en' | 'ar' | 'mixed';
}

export interface SearchResultItem {
  docId: string;
  title: string;
  snippet: string;
  sourceUrl: string;
  relevanceScore: number;
}

export class SemanticCommunitySearch {
  private knowledgeDocs: SearchableKnowledgeDoc[] = [];

  constructor() {
    this.seedDefaultKnowledge();
  }

  private seedDefaultKnowledge(): void {
    this.addDocument({
      id: 'KB-01',
      title: 'Nexus Escrow & Milestone Guidelines',
      content: 'All verified freelance transactions require external milestone confirmation and cryptographic agreement hashing.',
      sourceUrl: 'https://nexus.community/docs/escrow',
      language: 'en'
    });

    this.addDocument({
      id: 'KB-02',
      title: 'دليل ميثاق وقواعد مجتمع نيكسس',
      content: 'يضمن ميثاق نيكسس المساواة التامة بين الأعضاء والمشرفين وأصحاب السيرفر، مع حظر دائم للتحيز واستثناء أزمات الصحة النفسية.',
      sourceUrl: 'https://nexus.community/docs/charter',
      language: 'ar'
    });

    this.addDocument({
      id: 'KB-STAFF',
      title: 'Internal Staff Moderation Escalation Playbook',
      content: 'Mode S and Mode H cases require dual moderator consensus for bans.',
      sourceUrl: 'https://nexus.community/staff/playbook',
      requiredPermissionRole: 'staff',
      language: 'en'
    });
  }

  public addDocument(doc: SearchableKnowledgeDoc): void {
    this.knowledgeDocs.push(doc);
  }

  /**
   * REQ-26.205: Cross-language permission-aware semantic search over approved knowledge
   */
  public search(query: string, userRoles: string[] = []): SearchResultItem[] {
    const qTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results: SearchResultItem[] = [];

    for (const doc of this.knowledgeDocs) {
      // Permission Gate
      if (doc.requiredPermissionRole && !userRoles.includes(doc.requiredPermissionRole)) {
        continue;
      }

      const text = `${doc.title} ${doc.content}`.toLowerCase();
      let matchCount = 0;
      for (const term of qTerms) {
        if (text.includes(term)) matchCount++;
      }

      if (matchCount > 0) {
        const relevanceScore = Math.min(1.0, Math.round((matchCount / qTerms.length) * 100) / 100);
        results.push({
          docId: doc.id,
          title: doc.title,
          snippet: doc.content.substring(0, 120) + '...',
          sourceUrl: doc.sourceUrl,
          relevanceScore
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

export const semanticCommunitySearch = new SemanticCommunitySearch();
