import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface TranslationResult {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

export class TranslationEngineService {
  public async translateText(
    text: string,
    targetLanguage?: 'ar' | 'en'
  ): Promise<TranslationResult> {
    // Detect Arabic characters
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    const sourceLang = hasArabic ? 'ar' : 'en';
    const targetLang = targetLanguage || (hasArabic ? 'en' : 'ar');

    const prompt = `Translate this text from ${sourceLang === 'ar' ? 'Arabic' : 'English'} to ${targetLang === 'ar' ? 'Egyptian/Modern Standard Arabic (natural tech tone)' : 'English'}.
Preserve all code blocks, backticks, URLs, Discord mentions (<@...>), and technical terms accurately. Do NOT translate programming keywords or variable names.

Text:
${text}`;

    const res = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'translator_bot',
      guildId: 'global',
      context: 'translation',
    });

    logger.info('TranslationEngine', `Translated message (${sourceLang} -> ${targetLang})`);

    return {
      sourceText: text,
      translatedText: res.text.trim(),
      sourceLang,
      targetLang,
    };
  }
}

export const translationEngineService = new TranslationEngineService();
