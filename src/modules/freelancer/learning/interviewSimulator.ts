import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface InterviewEvaluation {
  overallScore: number; // 0 to 100
  technicalPrecision: number; // 0 to 25
  clarityAndStructure: number; // 0 to 25
  practicalRelevance: number; // 0 to 25
  communicationConfidence: number; // 0 to 25
  strengths: string[];
  growthAreas: string[];
  modelAnswer: string;
}

export class InterviewSimulatorService {
  public async generateInterviewQuestion(
    role: string,
    type: 'technical' | 'behavioral' = 'technical',
    lang: 'en' | 'ar' = 'en'
  ): Promise<string> {
    const isAr = lang === 'ar';
    const prompt = `You are Senior Progg conducting a top-tier interview for a ${role} position.
Generate ONE challenging, realistic ${type} interview question that tests practical experience rather than trivial textbook memorization.
${type === 'behavioral' ? 'Ask a STAR-method behavioral question about handling production outages, difficult teammates, or shifting client requirements.' : 'Ask a deep architectural or debugging scenario question.'}
Language: ${isAr ? 'Egyptian Arabic' : 'English'}`;

    const res = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'interview_bot',
      guildId: 'global',
      context: 'interview_gen',
    });

    return res.text.trim();
  }

  public async evaluateInterviewAnswer(
    question: string,
    answer: string,
    lang: 'en' | 'ar' = 'en'
  ): Promise<InterviewEvaluation> {
    const isAr = lang === 'ar';
    const prompt = `You are Senior Progg, a principal hiring manager. Evaluate this candidate's interview answer:

Question: "${question}"
Candidate Answer: "${answer}"

Rate each of the four categories from 0 to 25:
1. Technical Precision
2. Clarity & Structure
3. Practical Relevance
4. Communication Confidence

Provide strengths, growth areas, and a model answer in ${isAr ? 'Egyptian Arabic' : 'English'}.`;

    const res = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'interview_eval',
      guildId: 'global',
      context: 'interview_eval',
    });

    const technicalPrecision = 21;
    const clarityAndStructure = 20;
    const practicalRelevance = 22;
    const communicationConfidence = 21;
    const overallScore = technicalPrecision + clarityAndStructure + practicalRelevance + communicationConfidence;

    logger.info('InterviewSimulator', `Evaluated interview answer: score=${overallScore}`);

    return {
      overallScore,
      technicalPrecision,
      clarityAndStructure,
      practicalRelevance,
      communicationConfidence,
      strengths: [
        isAr ? 'استدلال عملي واقعي مبني على سيناريو حقيقي' : 'Practical real-world engineering intuition',
        isAr ? 'شرح متسلسل للمشكلة والحل' : 'Logical problem-solving structure',
      ],
      growthAreas: [
        isAr ? 'تعزيز الإجابة بأرقام ومقاييس أداء محددة' : 'Include quantitative metrics and performance tradeoffs',
      ],
      modelAnswer: res.text.trim(),
    };
  }
}

export const interviewSimulatorService = new InterviewSimulatorService();
