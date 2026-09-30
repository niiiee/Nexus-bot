import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface SOWInput {
  projectTitle: string;
  clientRequirements: string;
  estimatedTimeline: string;
  totalBudget: string;
}

export interface GeneratedSOW {
  projectTitle: string;
  documentMarkdown: string;
  milestones: Array<{ title: string; percentage: number; deliverable: string }>;
  revisionCap: number;
}

export class SOWBuilderService {
  public async buildScopeOfWork(input: SOWInput, lang: 'en' | 'ar' = 'en'): Promise<GeneratedSOW> {
    const isAr = lang === 'ar';
    const prompt = `You are Senior Progg, a principal solutions architect. Create a bulletproof Scope of Work (SOW) from these client requirements:

Project: "${input.projectTitle}"
Requirements: "${input.clientRequirements}"
Timeline: "${input.estimatedTimeline}"
Budget: "${input.totalBudget}"

Language: ${isAr ? 'Egyptian Arabic (formal yet practical)' : 'English (clear, professional, contract-ready)'}

Must include:
1. Executive Summary & Core Objectives
2. Detailed Milestone Deliverables & Acceptance Criteria (3 distinct milestones)
3. Explicit "Out of Scope" Exclusions (vital to stop scope creep)
4. Revision Limit: Maximum 2 rounds of minor revisions per milestone
5. Client Feedback Turnaround Time (e.g. 3 business days)`;

    const aiRes = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'sow_builder',
      guildId: 'global',
      context: 'sow_generation',
    });

    const documentMarkdown = aiRes.text.trim();
    logger.info('SOWBuilder', `Generated Scope of Work for "${input.projectTitle}"`);

    return {
      projectTitle: input.projectTitle,
      documentMarkdown,
      milestones: [
        { title: isAr ? 'المرحلة 1: التصميم والنواة' : 'Milestone 1: Architecture & UI Prototype', percentage: 30, deliverable: isAr ? 'هيكل النظام والتصميم' : 'Core models and UI wireframes' },
        { title: isAr ? 'المرحلة 2: التطوير والتكامل' : 'Milestone 2: Functional Features & API Integration', percentage: 40, deliverable: isAr ? 'البرمجة وربط الواجهات' : 'Core APIs and screens' },
        { title: isAr ? 'المرحلة 3: الاختبار والتسليم' : 'Milestone 3: QA, Deployment & Final Handover', percentage: 30, deliverable: isAr ? 'النشر النهائي والتوثيق' : 'Production deployment and documentation' },
      ],
      revisionCap: 2,
    };
  }
}

export const sowBuilderService = new SOWBuilderService();
