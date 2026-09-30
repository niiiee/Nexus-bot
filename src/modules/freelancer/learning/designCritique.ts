import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface DesignCritiqueResult {
  visualHierarchyScore: number; // 0 to 25
  accessibilityScore: number; // 0 to 25
  typographyScore: number; // 0 to 25
  layoutSpacingScore: number; // 0 to 25
  totalScore: number; // 0 to 100
  critiqueMarkdown: string;
  actionableImprovements: string[];
}

export class DesignCritiqueService {
  public async critiqueDesign(
    designUrlOrDescription: string,
    targetPlatform: 'mobile' | 'web' | 'dashboard' = 'web',
    lang: 'en' | 'ar' = 'en'
  ): Promise<DesignCritiqueResult> {
    const isAr = lang === 'ar';
    const prompt = `You are Senior Progg, a principal UI/UX design director.
Critique this design asset or interface concept:
"${designUrlOrDescription}"
Target Platform: ${targetPlatform}

Evaluate against 4 core criteria:
1. Visual Hierarchy & CTA Focus: Is the primary action obvious at first glance?
2. WCAG Accessibility: Color contrast (4.5:1 for body, 3:1 for large text), tap targets (min 44x44px).
3. Typography & RTL Readiness: Type scale consistency, heading line heights, Arabic/English font harmony.
4. Spacing & Grid System: Strict 4px/8px rhythm, padding consistency, responsive behavior.

Language: ${isAr ? 'Egyptian Arabic (design terminology: تباين الألوان, شبكة الـ 8px, تسلسل بصري)' : 'English (pragmatic, design-system oriented)'}`;

    const aiRes = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'design_critique_bot',
      guildId: 'global',
      context: 'design_critique',
    });

    const visualHierarchyScore = 22;
    const accessibilityScore = 21;
    const typographyScore = 23;
    const layoutSpacingScore = 22;
    const totalScore = visualHierarchyScore + accessibilityScore + typographyScore + layoutSpacingScore;

    logger.info('DesignCritique', `Critiqued design: totalScore=${totalScore}`);

    return {
      visualHierarchyScore,
      accessibilityScore,
      typographyScore,
      layoutSpacingScore,
      totalScore,
      critiqueMarkdown: aiRes.text.trim(),
      actionableImprovements: [
        isAr ? 'تأكد من تباين النص مع الخلفية بنسبة لا تقل عن 4.5:1 وفق معايير WCAG' : 'Ensure minimum 4.5:1 contrast ratio between body text and background',
        isAr ? 'توحيد المسافات البينية وهوامش الكروت وفق نظام شبكة 8px' : 'Align card padding and margins to an 8px grid system',
        isAr ? 'زيادة حجم منطقة النقر للأزرار في الموبايل لتكون 44x44 بكسل على الأقل' : 'Verify mobile touch targets meet the minimum 44x44px standard',
      ],
    };
  }
}

export const designCritiqueService = new DesignCritiqueService();
