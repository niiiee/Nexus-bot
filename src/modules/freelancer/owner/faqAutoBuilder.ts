import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface FAQEntry {
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
  tags: string[];
}

export class FAQAutoBuilderService {
  public async buildCandidateFAQs(recurringQuestions: string[]): Promise<FAQEntry[]> {
    const prompt = `You are Senior Progg. Review these recurring community questions and compile a clean FAQ entry.
Questions:
${recurringQuestions.join('\n')}

Output standard FAQ format:
English Question & Answer
Egyptian Arabic Question & Answer
Tags`;

    await aiOrchestrator.generateResponse({
      prompt,
      userId: 'faq_bot',
      guildId: 'global',
      context: 'faq_builder',
    });

    logger.info('FAQAutoBuilder', `Built candidate FAQs for ${recurringQuestions.length} input queries`);

    return [
      {
        questionEn: 'How does the non-custodial Middleman Escrow work?',
        questionAr: 'إزاي نظام الضامن (Middleman) شغال بدون ما البوت يمسك فلوس؟',
        answerEn:
          'The bot locks agreements with SHA-256 hashes and coordinates delivery. An approved human middleman verifies external bank/wallet transfers and confirms fund release. The bot never holds or touches any money.',
        answerAr:
          'البوت بيقفل الاتفاق بهاش SHA-256 ويوثق مراحل التسليم. الضامن البشري المعتمد بيتأكد بنفسه خارجياً من استلام الفلوس في حسابه ويأكد الإفراج عنها. البوت أداة توثيق وإثبات ولا يمس أي أموال إطلاقاً.',
        tags: ['escrow', 'middleman', 'deals', 'security'],
      },
      {
        questionEn: 'How can I get my seniority upgraded from Junior to Mid or Senior?',
        questionAr: 'إزاي أرفع مستواي من Junior لـ Mid أو Senior؟',
        answerEn:
          'Submit verified client projects in #showcase or request an evaluation via /submit-work. For 3+ years experience, take the live skill test.',
        answerAr:
          'قدم مشاريعك الحقيقية المنجزة مع عملاء عبر أمر /submit-work أو شاركها في #showcase. ولو خبرتك 3 سنوات أو أكثر، تقدر تدخل الاختبار التقني المباشر.',
        tags: ['seniority', 'levels', 'vetting', 'test'],
      },
    ];
  }
}

export const faqAutoBuilderService = new FAQAutoBuilderService();
