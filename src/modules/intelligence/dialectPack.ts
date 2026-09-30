export type ArabicDialect = 'egyptian' | 'gulf' | 'levantine' | 'maghrebi' | 'msa' | 'unknown';

export interface DialectAnalysisResult {
  detectedDialect: ArabicDialect;
  confidence: number;
  normalizedText: string;
  dialectMarkersFound: string[];
}

export class ArabicDialectUnderstandingPack {
  private dialectMarkers: Record<ArabicDialect, string[]> = {
    egyptian: ['عاوز', 'عايز', 'ازيك', 'كده', 'برضه', 'ملهاش', 'انهاردة', 'دلوقتي', 'ايه'],
    gulf: ['ابي', 'شلونك', 'وايد', 'يا ليت', 'سحب علي', 'الحين', 'يبيلك', 'مب'],
    levantine: ['بدي', 'كيفك', 'شو', 'عم جرب', 'كتير', 'هيدا', 'هلأ', 'شلونك'],
    maghrebi: ['باش', 'ديال', 'كيعطيني', 'خاصني', 'واخا', 'بزاف', 'مزيان', 'فين'],
    msa: ['أرغب', 'كيفية', 'لذلك', 'حيث', 'نظراً', 'بشأن', 'يرجى', 'يتعين'],
    unknown: []
  };

  /**
   * REQ-26.209: Analyze and normalize text across 5 major Arabic dialect families
   */
  public analyzeDialect(text: string): DialectAnalysisResult {
    const lower = text.toLowerCase();
    const scores: Record<ArabicDialect, { count: number; markers: string[] }> = {
      egyptian: { count: 0, markers: [] },
      gulf: { count: 0, markers: [] },
      levantine: { count: 0, markers: [] },
      maghrebi: { count: 0, markers: [] },
      msa: { count: 0, markers: [] },
      unknown: { count: 0, markers: [] }
    };

    const dialects = Object.keys(this.dialectMarkers) as ArabicDialect[];

    for (const d of dialects) {
      if (d === 'unknown') continue;
      for (const marker of this.dialectMarkers[d]) {
        if (lower.includes(marker)) {
          scores[d].count++;
          scores[d].markers.push(marker);
        }
      }
    }

    let bestDialect: ArabicDialect = 'msa';
    let highestCount = 0;

    for (const d of dialects) {
      if (scores[d].count > highestCount) {
        highestCount = scores[d].count;
        bestDialect = d;
      }
    }

    const confidence = highestCount > 0 ? Math.min(1.0, 0.6 + highestCount * 0.15) : 0.5;

    // Normalization: clean diacritics & alefs
    const normalizedText = lower
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .trim();

    return {
      detectedDialect: bestDialect,
      confidence,
      normalizedText,
      dialectMarkersFound: scores[bestDialect].markers
    };
  }
}

export const arabicDialectUnderstandingPack = new ArabicDialectUnderstandingPack();
