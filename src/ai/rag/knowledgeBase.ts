export interface KnowledgeDoc {
  id: string;
  category: 'rules' | 'courses' | 'faq' | 'resources';
  title: string;
  content: string;
  source: string;
}

export class KnowledgeBase {
  private documents: Map<string, KnowledgeDoc> = new Map();

  constructor() {
    this.seedDefaultKnowledge();
  }

  private seedDefaultKnowledge(): void {
    this.addDocument({
      id: 'rule_escrow_01',
      category: 'rules',
      title: 'Server Escrow & Middleman Policy',
      content: 'All freelance deals initiated inside the server must use the verified middleman system (/deal create). The bot tracks milestones and agreements. Payments are never custodied by the bot; middlemen confirm external transactions.',
      source: 'Server Rules Section 4',
    });

    this.addDocument({
      id: 'rule_onboarding_02',
      category: 'rules',
      title: 'Vetting and Skill Testing',
      content: 'Members claiming 3+ years experience undergo a live-generated problem-solving and architecture test. Scoring below 50% assigns the temporary Larper role with a restriction period appealable via /appeal.',
      source: 'Server Rules Section 2',
    });

    this.addDocument({
      id: 'faq_credits_01',
      category: 'faq',
      title: 'How to Earn Server Credits',
      content: 'Server credits are earned by completing daily tasks, submitting verified work, reviewing peer portfolios, participating in hackathons, and maintaining activity streaks. Credits can be spent in the /shop on 195+ modular perks.',
      source: 'Community Guidebook',
    });

    this.addDocument({
      id: 'course_web_01',
      category: 'courses',
      title: 'Recorded Courses: Full-Stack Architecture',
      content: 'Access course recordings in #recorded-courses. Use /courses-live to start a synchronized watch-party session with session controls and progress tracking.',
      source: 'Course Catalog Index',
    });
  }

  public addDocument(doc: KnowledgeDoc): void {
    this.documents.set(doc.id, doc);
  }

  public removeDocument(docId: string): boolean {
    return this.documents.delete(docId);
  }

  public search(query: string, maxResults: number = 3): KnowledgeDoc[] {
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTokens.length === 0) return [];

    const scored: Array<{ doc: KnowledgeDoc; score: number }> = [];

    for (const doc of this.documents.values()) {
      let score = 0;
      const haystack = `${doc.title} ${doc.content}`.toLowerCase();

      for (const token of queryTokens) {
        if (haystack.includes(token)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ doc, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(s => s.doc);
  }

  public formatRAGContext(query: string): string {
    const hits = this.search(query);
    if (hits.length === 0) {
      return 'No verified server documentation found for this query. If unsure, state "I do not have verified server records for this topic."';
    }

    return hits
      .map(h => `[Source: ${h.source} | Title: ${h.title}]\n${h.content}`)
      .join('\n\n');
  }
}

export const knowledgeBase = new KnowledgeBase();
