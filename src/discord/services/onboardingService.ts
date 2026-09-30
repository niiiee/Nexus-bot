import { memberRepo } from '../../database/repositories/memberRepo.js';
import { guildRepo } from '../../database/repositories/guildRepo.js';
import { vettingRepo } from '../../database/repositories/vettingRepo.js';
import { questionGenerator } from '../../ai/generators/questionGenerator.js';
import { testGenerator } from '../../ai/generators/testGenerator.js';
import { authenticityAnalyzer } from '../../ai/evaluators/authenticityAnalyzer.js';
import { escalationService } from './escalationService.js';
import { restrictionService } from './restrictionService.js';
import { detectLanguage, SupportedLanguage, t } from '../../utils/i18n.js';
import { SENIOR_PROGG_PERSONA } from '../../config/constants.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('OnboardingService');

export interface OnboardingState {
  userId: string;
  guildId: string;
  step: 'awaiting_field' | 'awaiting_experience' | 'awaiting_tools' | 'awaiting_goals' | 'vetting_questions' | 'skill_test' | 'completed';
  field?: string;
  experienceYears?: number;
  tools?: string;
  goals?: string;
  language: SupportedLanguage;
  vettingSessionId?: string;
  currentQuestionIndex: number;
  vettingQuestions: string[];
  collectedAnswers: string[];
  startedAt: number;
}

export class OnboardingService {
  private activeOnboardings: Map<string, OnboardingState> = new Map();

  public getWelcomeEmbed(username: string, lang: SupportedLanguage = 'en'): {
    title: string;
    description: string;
    fields: Array<{ name: string; value: string }>;
    color: number;
  } {
    const greetings = lang === 'ar' ? SENIOR_PROGG_PERSONA.GREETINGS_AR : SENIOR_PROGG_PERSONA.GREETINGS_EN;
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

    return {
      title: t(lang, 'welcome_title'),
      description: `${randomGreeting}\n\n${t(lang, 'welcome_body', { username })}`,
      fields: [
        { name: lang === 'ar' ? 'قواعد السيرفر باختصار' : 'Server Rules Summary', value: t(lang, 'rules_summary') },
        { name: lang === 'ar' ? 'الخطوة القادمة' : 'Next Step', value: lang === 'ar' ? 'توجه للروم الخاص بيك لبدء التوثيق' : 'Check your private #verify thread to begin onboarding' },
      ],
      color: 0x00f0ff, // Electric Cyan
    };
  }

  public startOnboarding(userId: string, guildId: string, username: string, initialLang: SupportedLanguage = 'en'): OnboardingState {
    memberRepo.getOrCreate(userId, guildId, username);

    const state: OnboardingState = {
      userId,
      guildId,
      step: 'awaiting_field',
      language: initialLang,
      currentQuestionIndex: 0,
      vettingQuestions: [],
      collectedAnswers: [],
      startedAt: Date.now(),
    };

    this.activeOnboardings.set(userId, state);
    logger.info(`Started onboarding interview for user ${userId} (${username})`);
    return state;
  }

  public getState(userId: string): OnboardingState | undefined {
    return this.activeOnboardings.get(userId);
  }

  public async processAnswer(userId: string, answer: string): Promise<{ reply: string; isComplete: boolean; requiresTest?: boolean; testId?: string }> {
    const state = this.activeOnboardings.get(userId);
    if (!state) {
      return { reply: 'No active onboarding session found. Please join or ask staff.', isComplete: false };
    }

    // Adapt language dynamically based on answer script
    if (detectLanguage(answer) === 'ar') {
      state.language = 'ar';
      memberRepo.update(userId, { language: 'ar' });
    }

    switch (state.step) {
      case 'awaiting_field': {
        const lower = answer.toLowerCase();
        state.field = (lower.includes('design') || lower.includes('تصميم') || lower.includes('ui') || lower.includes('ux'))
          ? 'design'
          : 'development';
        state.step = 'awaiting_experience';
        return {
          reply: state.language === 'ar'
            ? `تمام يا باشمهندس، سجلنا مجالك: **${state.field === 'design' ? 'تصميم UI/UX' : 'برمجة وتطوير'}**. عندك كام سنة خبرة في الشغل؟ (اكتب رقم السنين)`
            : `Awesome! Field recorded as **${state.field}**. How many years of professional or freelance experience do you have?`,
          isComplete: false,
        };
      }

      case 'awaiting_experience': {
        const parsedYears = parseFloat(answer.replace(/[^0-9.]/g, '')) || 1;
        state.experienceYears = parsedYears;
        memberRepo.update(userId, { claimed_experience_years: parsedYears });
        state.step = 'awaiting_tools';
        return {
          reply: state.language === 'ar'
            ? `حلو جداً، ${parsedYears} سنين. إيه أهم الأدوات واللغات والفريموركس اللي بتستعملها في شغلك؟`
            : `Great, ${parsedYears} years recorded. What are your primary tools, languages, and frameworks?`,
          isComplete: false,
        };
      }

      case 'awaiting_tools': {
        state.tools = answer;
        memberRepo.update(userId, { tools: answer });
        state.step = 'awaiting_goals';
        return {
          reply: state.language === 'ar'
            ? 'ممتاز. إيه هدفك الأساسي من السيرفر؟ (شغل وتيمات / تعليم وكورسات / مراجعة بورتفوليو)'
            : 'Noted. What is your primary goal here? (Finding freelance gigs, learning, peer review, hiring)',
          isComplete: false,
        };
      }

      case 'awaiting_goals': {
        state.goals = answer;
        memberRepo.update(userId, { goals: answer, field: state.field });

        // If candidate claims 3+ years experience, trigger live skill test!
        if ((state.experienceYears ?? 0) >= 3) {
          state.step = 'skill_test';
          const test = await testGenerator.generateLiveTest({
            userId,
            guildId: state.guildId,
            field: state.field || 'development',
            claimedYears: state.experienceYears || 3,
            tools: state.tools || 'General',
            language: state.language,
          });

          return {
            reply: state.language === 'ar'
              ? `يا باشا ما دام خبرتك ${state.experienceYears} سنين فما فوق، نظام السيرفر بيولدلك اختبار عملي مباشر وفريد لاختبار قدراتك في معمارية النظم وحل المشكلات.\nمعاك ${test.timebox_minutes} دقيقة للإجابة. معرف الاختبار: \`${test.id}\`.\nالسؤال الأول: ${JSON.parse(test.questions_json)[0]?.prompt}`
              : `Since you claimed ${state.experienceYears}+ years of experience, a live skill test has been generated on the spot to verify your architecture and debugging depth.\nTimebox: ${test.timebox_minutes} minutes. Test ID: \`${test.id}\`.\nQuestion 1: ${JSON.parse(test.questions_json)[0]?.prompt}`,
            isComplete: false,
            requiresTest: true,
            testId: test.id,
          };
        }

        // Otherwise generate standard scenario vetting questions
        const questions = await questionGenerator.generateQuestions({
          userId,
          field: state.field || 'development',
          claimedYears: state.experienceYears || 1,
          tools: state.tools || 'General',
          language: state.language,
        });

        const qPrompts = questions.map(q => q.prompt);
        const session = vettingRepo.create({
          user_id: userId,
          guild_id: state.guildId,
          field: state.field || 'development',
          claimed_years: state.experienceYears || 1,
          initial_questions: qPrompts,
        });

        state.vettingSessionId = session.id;
        state.vettingQuestions = qPrompts;
        state.currentQuestionIndex = 0;
        state.step = 'vetting_questions';

        return {
          reply: `${state.language === 'ar' ? 'يلا بينا على أسئلة التوثيق العملية:' : 'Let us proceed to your practical vetting questions:'}\n\n**1. ${qPrompts[0]}**`,
          isComplete: false,
        };
      }

      case 'vetting_questions': {
        state.collectedAnswers.push(answer);
        state.currentQuestionIndex++;

        // If more questions exist, ask next
        if (state.currentQuestionIndex < state.vettingQuestions.length) {
          const nextQ = state.vettingQuestions[state.currentQuestionIndex];
          return {
            reply: `**${state.currentQuestionIndex + 1}. ${nextQ}**`,
            isComplete: false,
          };
        }

        // All questions answered -> analyze authenticity and finalize
        const report = await authenticityAnalyzer.analyzeAnswers({
          claimedYears: state.experienceYears || 1,
          field: state.field || 'development',
          questions: state.vettingQuestions,
          answers: state.collectedAnswers,
        });

        vettingRepo.update(state.vettingSessionId!, {
          answers_json: JSON.stringify(state.collectedAnswers),
          suspicion_score: report.suspicionScore,
          status: report.suspicionScore > 0.65 ? 'needs_human_review' : 'passed',
          completed_at: Date.now(),
        });

        if (report.suspicionScore > 0.65) {
          escalationService.createCase({
            guildId: state.guildId,
            userId,
            username: 'Member',
            field: state.field || 'development',
            claimedYears: state.experienceYears || 1,
            report,
          });

          state.step = 'completed';
          this.activeOnboardings.delete(userId);

          return {
            reply: state.language === 'ar'
              ? 'شكراً على إجاباتك يا باشمهندس. إجاباتك تحت مراجعة الإدارة وهنبلغك بالنتيجة فوراً.'
              : 'Thank you for your responses. Your profile has been queued for standard staff review.',
            isComplete: true,
          };
        }

        // Passed onboarding vetting!
        memberRepo.update(userId, { lifecycle_stage: 'Active' });
        state.step = 'completed';
        this.activeOnboardings.delete(userId);

        return {
          reply: state.language === 'ar'
            ? 'ألف مبروك يا فنان! تم اجتياز التوثيق بنجاح ورتبتك المبدئية اتسجلت. تقدر تشارك شغلك الأول في روم #showcase.'
            : 'Congratulations! You have passed the vetting check. Your initial role has been assigned, and you can now post your first work in #showcase.',
          isComplete: true,
        };
      }

      default:
        return { reply: 'Onboarding completed.', isComplete: true };
    }
  }
}

export const onboardingService = new OnboardingService();
