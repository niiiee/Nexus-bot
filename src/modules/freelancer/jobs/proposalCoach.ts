import { aiOrchestrator } from '../../../ai/orchestrator.js';
import { logger } from '../../../utils/logger.js';

export interface ProposalCritique {
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  clarityScore: number; // 0 to 100
  optimizedRewrite: string;
}

export class ProposalCoachService {
  public async coachProposal(
    draftProposal: string,
    jobContext?: string,
    lang: 'en' | 'ar' = 'en'
  ): Promise<ProposalCritique> {
    const isAr = lang === 'ar';
    const weaknesses: string[] = [];
    const redFlags: string[] = [];
    const strengths: string[] = [];

    // Rule-based heuristic checks
    if (draftProposal.length < 80) {
      weaknesses.push(isAr ? 'العرض قصير جداً ويفتقد للتفاصيل التقنية وخطة العمل' : 'Proposal is too brief and lacks technical details or milestones');
    } else {
      strengths.push(isAr ? 'الطول العام للعرض مناسب' : 'Overall length is sufficient');
    }

    if (/i am the cheapest|lowest price|will work for cheap|أرخص سعر|شغل رخيص/i.test(draftProposal)) {
      redFlags.push(isAr ? 'التركيز على رخص السعر يقلل من قيمتك السوقية واحترافيتك' : 'Competing solely on being the cheapest damages your perceived professionalism and market value');
    }

    if (!/(timeline|deadline|days|weeks|deliver|أيام|أسابيع|تسليم|خطة زمنية)/i.test(draftProposal)) {
      weaknesses.push(isAr ? 'لم تذكر جدولاً زمنياً أو مراحل تسليم محددة' : 'No timeline, milestones, or estimated delivery schedule mentioned');
    } else {
      strengths.push(isAr ? 'ذكرت إطاراً زمنياً للتسليم' : 'Included delivery timeframe');
    }

    if (/(experience|portfolio|previous work|github|behance|سابقة أعمال|مشاريع سابقة)/i.test(draftProposal)) {
      strengths.push(isAr ? 'أشرت لسابقة أعمالك وخبرتك السابقة' : 'Referenced past experience or portfolio');
    } else {
      weaknesses.push(isAr ? 'لم ترفق روابط لأعمال سابقة ذات صلة بالمشروع' : 'Missing links to relevant portfolio case studies or repos');
    }

    let clarityScore = 80;
    clarityScore -= weaknesses.length * 15;
    clarityScore -= redFlags.length * 25;
    clarityScore = Math.max(20, Math.min(95, clarityScore));

    // Generate AI rewrite
    const prompt = `You are Senior Progg, a senior full-stack freelancer coach.
Review this draft proposal submitted by a freelancer:
"${draftProposal}"

${jobContext ? `Target Job Description: "${jobContext}"` : ''}

Language: ${isAr ? 'Egyptian Arabic (professional yet friendly)' : 'English (professional and confident)'}

Provide an optimized, high-converting rewrite that:
1. Opens with a strong value proposition addressing the client's problem directly.
2. Outlines a concise 3-phase execution plan.
3. Mentions relevant experience/deliverables without sounding boastful.
4. Closes with a clear call to action to discuss on Discord.`;

    const aiResponse = await aiOrchestrator.generateResponse({
      prompt,
      userId: 'coach_system',
      guildId: 'global',
      context: 'proposal_coaching',
    });

    const optimizedRewrite = aiResponse.text.trim();
    logger.info('ProposalCoach', `Critiqued proposal: score=${clarityScore}, weaknesses=${weaknesses.length}`);

    return {
      strengths: strengths.length > 0 ? strengths : [isAr ? 'بداية جيدة' : 'Solid starting foundation'],
      weaknesses: weaknesses.length > 0 ? weaknesses : [isAr ? 'لا توجد ملاحظات جوهرية' : 'No major weaknesses found'],
      redFlags,
      clarityScore,
      optimizedRewrite,
    };
  }
}

export const proposalCoachService = new ProposalCoachService();
