import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface CaseStudyInput {
  projectTitle: string;
  clientIndustry: string;
  problemStatement: string;
  solutionAndTech: string;
  measuredOutcomes: string;
}

export interface GeneratedCaseStudy {
  title: string;
  markdown: string;
  summary: string;
}

export class CaseStudyGeneratorService {
  public async generateCaseStudy(
    input: CaseStudyInput,
    lang: 'en' | 'ar' = 'en'
  ): Promise<GeneratedCaseStudy> {
    const isAr = lang === 'ar';
    const prompt = `You are Senior Progg, an expert tech consultant. Transform these raw project details into an impressive, enterprise-grade portfolio Case Study.

Project Title: ${input.projectTitle}
Client Industry: ${input.clientIndustry}
Core Problem: ${input.problemStatement}
Technical Solution & Tech Stack: ${input.solutionAndTech}
Results & Metrics: ${input.measuredOutcomes}

Language: ${isAr ? 'Egyptian Arabic (professional engineering polish)' : 'English (polished, persuasive, metrics-focused)'}

Format requirements:
# ${input.projectTitle} - Case Study
## 1. The Challenge & Context
## 2. Technical Architecture & Implementation
## 3. Measurable Business Impact & Metrics
## 4. Key Learnings & Stack`;

    const aiRes = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'case_study_bot',
      guildId: 'global',
      context: 'case_study_generation',
    });

    const markdown = aiRes.text.trim();
    const summary = isAr
      ? `دراسة حالة لمشروع ${input.projectTitle} في قطاع ${input.clientIndustry}.`
      : `Case study for ${input.projectTitle} in ${input.clientIndustry}.`;

    logger.info('CaseStudyGenerator', `Generated case study for "${input.projectTitle}"`);

    return {
      title: input.projectTitle,
      markdown,
      summary,
    };
  }
}

export const caseStudyGeneratorService = new CaseStudyGeneratorService();
