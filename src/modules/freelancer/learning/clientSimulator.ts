import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface NegotiationScenario {
  id: string;
  title: string;
  clientMessage: string;
  clientMessageAr: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const NEGOTIATION_SCENARIOS: NegotiationScenario[] = [
  {
    id: 'discount_pusher',
    title: 'The Low-Baller / Discount Pusher',
    clientMessage:
      'Look, your quote of $1,500 is way too high. A guy on another platform said he could do the exact same system for $400. Can you match $500 or should I go with him?',
    clientMessageAr:
      'بص يا باشمهندس، عرضك بـ 50 ألف جنيه غالي جداً! فيه واحد تاني قالي هيعمل نفس السيستم بالضبط بـ 15 ألف. تقدر تعملهالي بـ 18 ألف ولا أروح معاه؟',
    difficulty: 'medium',
  },
  {
    id: 'creeping_scope',
    title: 'The Scope Creeper',
    clientMessage:
      'Hey! Since you are already building the user login, could you just quickly add Stripe subscriptions and a full admin analytics dashboard? It should only take you an extra hour or two right?',
    clientMessageAr:
      'يا هندسة، بما إنك شغال في شاشة الدخول، بالمرة كده ضيفلي نظام اشتراكات الدفع وبوابة فواتير ولوحة تحكم كاملة للمشرفين! دي مش هتاخد منك ساعتين صح؟',
    difficulty: 'hard',
  },
  {
    id: 'asap_rush',
    title: 'The Midnight Emergency Rush',
    clientMessage:
      'Our investor meeting got moved up! I need the entire mobile app redesigned and deployed by 8:00 AM tomorrow morning. Please pull an all-nighter for us!',
    clientMessageAr:
      'المستثمر طلب الاجتماع بكرة الصبح بدري! محتاج التطبيق كله يتعاد تصميمه وينزل لايف قبل الساعة 8 صباحاً. معلش اسهر عليه الليلة ضروري!',
    difficulty: 'hard',
  },
];

export interface NegotiationEvaluation {
  score: number; // 0 to 100
  firmnessRating: 'pushover' | 'diplomatic_and_firm' | 'overly_aggressive';
  feedbackEn: string;
  feedbackAr: string;
  suggestedIdealResponse: string;
}

export class ClientSimulatorService {
  public getRandomScenario(): NegotiationScenario {
    const idx = Math.floor(Math.random() * NEGOTIATION_SCENARIOS.length);
    return NEGOTIATION_SCENARIOS[idx];
  }

  public async evaluateResponse(
    scenario: NegotiationScenario,
    freelancerReply: string,
    lang: 'en' | 'ar' = 'en'
  ): Promise<NegotiationEvaluation> {
    const isAr = lang === 'ar';
    const prompt = `You are Senior Progg, a seasoned freelancer mentor. Evaluate how well this freelancer handled a difficult client negotiation.

Client Scenario: "${scenario.clientMessage}"
Freelancer's Reply: "${freelancerReply}"

Evaluate:
1. Did they stand their ground without caving to unrealistic demands?
2. Were they polite, professional, and solutions-oriented?
3. Did they protect their boundaries or suggest a realistic alternative?

Score from 0 to 100.
Determine Firmness: "pushover" (if they gave in), "diplomatic_and_firm" (ideal balance), or "overly_aggressive" (rude).
Provide constructive feedback and an ideal response in ${isAr ? 'Egyptian Arabic' : 'English'}.`;

    const aiRes = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'simulator_bot',
      guildId: 'global',
      context: 'negotiation_eval',
    });

    let firmnessRating: NegotiationEvaluation['firmnessRating'] = 'diplomatic_and_firm';
    let score = 85;

    if (/caved|gave in|too soft|ضعيف|تنازل/i.test(aiRes.text)) {
      firmnessRating = 'pushover';
      score = 45;
    } else if (/rude|aggressive|harsh|عدواني|غير لائق/i.test(aiRes.text)) {
      firmnessRating = 'overly_aggressive';
      score = 55;
    }

    logger.info('ClientSimulator', `Evaluated negotiation response: score=${score}, firmness=${firmnessRating}`);

    return {
      score,
      firmnessRating,
      feedbackEn: aiRes.text.trim(),
      feedbackAr: aiRes.text.trim(),
      suggestedIdealResponse: isAr
        ? 'يا فندم مقدر موقفك جداً، لكن الجودة والاستقرار والأمان تتطلب وقتاً ومجهوداً دقيقاً. أقدر أنفذ المطلوب بالكامل وفق المواصفات وبضمان 30 يوماً بالسعر المذكور، أو نقدر نقلل بعض الميزات لتناسب ميزانيتك.'
        : 'I appreciate your perspective. However, high-quality, secure code requires dedicated time and architectural rigor. I stand by my estimate for this full scope, or we can adjust non-essential features to align with a lower budget.',
    };
  }
}

export const clientSimulatorService = new ClientSimulatorService();
