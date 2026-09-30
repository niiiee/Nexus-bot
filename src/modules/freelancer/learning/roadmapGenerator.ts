import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface RoadmapWeek {
  weekNumber: number;
  topic: string;
  projectExercise: string;
  recommendedResource: string;
  milestoneCheckpoint: string;
}

export interface GeneratedRoadmap {
  specialization: string;
  seniorityLevel: string;
  durationWeeks: number;
  weeks: RoadmapWeek[];
  introMarkdown: string;
}

export class RoadmapGeneratorService {
  public async generateRoadmap(params: {
    specialization: string; // e.g. "Fullstack Next.js & Node", "UI/UX Figma System", "Mobile Flutter"
    currentLevel: 'Junior' | 'Mid' | 'Senior';
    durationWeeks?: number;
    lang?: 'en' | 'ar';
  }): Promise<GeneratedRoadmap> {
    const durationWeeks = params.durationWeeks || 6;
    const lang = params.lang || 'en';
    const isAr = lang === 'ar';

    const prompt = `You are Senior Progg, a principal tech mentor.
Generate an actionable ${durationWeeks}-week skill roadmap for a ${params.currentLevel} developer aiming to master "${params.specialization}".

Language: ${isAr ? 'Egyptian Arabic (inspiring, practical, tech-fluent)' : 'English (pragmatic, structured)'}

Format requirements:
Intro summary explaining the transformation path.
For each week from 1 to ${durationWeeks}:
- Week Number
- Core Focus Topic
- Hands-on Project Exercise (must build something real)
- Curated Resource to study
- Mastery Checkpoint to prove competence`;

    const aiRes = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'roadmap_generator',
      guildId: 'global',
      context: 'roadmap_generation',
    });

    const weeks: RoadmapWeek[] = [];
    for (let i = 1; i <= durationWeeks; i++) {
      weeks.push({
        weekNumber: i,
        topic: isAr ? `الأسبوع ${i}: تعميق المفاهيم في ${params.specialization}` : `Week ${i}: Core Foundations in ${params.specialization}`,
        projectExercise: isAr ? `بناء نموذج عملي ومشاركته في قناة #showcase` : `Build a production-ready module and submit to #showcase`,
        recommendedResource: isAr ? `مستودعات ووثائق مفتوحة المصدر مجانية` : `Official docs and open-source reference implementations`,
        milestoneCheckpoint: isAr ? `اختبار كود نظيف بدون أخطاء linting` : `Clean code passing unit tests and lint audits`,
      });
    }

    logger.info('RoadmapGenerator', `Generated ${durationWeeks}-week roadmap for ${params.specialization} (${params.currentLevel})`);

    return {
      specialization: params.specialization,
      seniorityLevel: params.currentLevel,
      durationWeeks,
      weeks,
      introMarkdown: aiRes.text.trim(),
    };
  }
}

export const roadmapGeneratorService = new RoadmapGeneratorService();
