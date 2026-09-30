import { CandidateOpportunity, CommunityRuleProfile } from './opportunityDiscovery.js';
import { SpecialistSolution } from './solutionEngine.js';
import { MANDATORY_DISCLOSURE_EN, MANDATORY_DISCLOSURE_AR, outreachRulesGuard } from './rulesGuard.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface DraftedReply {
  id: string;
  candidateId: string;
  platform: string;
  community: string;
  language: 'en' | 'ar';
  hasPromo: boolean;
  hasLink: boolean;
  disclosurePresent: boolean;
  fullText: string;
  part1Greeting: string;
  part2Solution: string;
  part3AboutNexus?: string;
  part4LinkAndIntro?: string;
  part4Link?: string;
  campaignCode: string;
  confidence: number;
}

export class ReplyComposer {
  /**
   * Compose the 4-part outreach reply respecting community rules & dialect
   */
  public composeReply(params: {
    candidate: CandidateOpportunity;
    solution: SpecialistSolution;
    campaignCode?: string;
    rules?: CommunityRuleProfile;
    language?: 'en' | 'ar';
  }): DraftedReply {
    const { candidate, solution } = params;
    const isAr = (params.language || candidate.language) === 'ar';
    const campaignCode = params.campaignCode || `camp_${candidate.platform}_${candidate.category}_${Date.now().toString(36)}`;

    // Community rules override
    const allowsPromo = params.rules !== undefined ? params.rules.allowsPromo : candidate.allowsPromo;
    const allowsLinks = params.rules !== undefined ? params.rules.allowsLinks : candidate.allowsLinks;

    // Part 1: Greeting + Problem Restatement + Mandatory Disclosure
    const part1Greeting = this.buildPart1(candidate, isAr);

    // Part 2: Verified Solution + Recommendations
    const part2Solution = this.buildPart2(solution, isAr);

    // Part 3: About Nexus (Strictly omitted if promotion is disallowed)
    const part3AboutNexus = allowsPromo ? this.buildPart3(candidate.category, isAr) : undefined;

    // Part 4: Tracked Link + Onboarding Intro (Strictly omitted if links or promo disallowed)
    const canIncludeLink = allowsPromo && allowsLinks;
    const part4LinkAndIntro = canIncludeLink ? this.buildPart4(candidate, campaignCode, isAr) : undefined;

    // Combine sections
    const sections = [part1Greeting, part2Solution];
    if (part3AboutNexus) sections.push(part3AboutNexus);
    if (part4LinkAndIntro) sections.push(part4LinkAndIntro);

    const fullText = sections.join('\n\n');

    // Hard-coded safety assertion: disclosure must be present
    if (!outreachRulesGuard.verifyDisclosure(fullText)) {
      throw new Error('Fatal: Generated reply does not contain the mandatory AI disclosure line.');
    }

    return {
      id: cryptoRandomUUID(),
      candidateId: candidate.id,
      platform: candidate.platform,
      community: candidate.community,
      language: isAr ? 'ar' : 'en',
      hasPromo: !!part3AboutNexus,
      hasLink: !!part4LinkAndIntro,
      disclosurePresent: true,
      fullText,
      part1Greeting,
      part2Solution,
      part3AboutNexus,
      part4LinkAndIntro,
      part4Link: part4LinkAndIntro,
      campaignCode,
      confidence: solution.confidence,
    };
  }

  private buildPart1(candidate: CandidateOpportunity, isAr: boolean): string {
    const topic = candidate.title || candidate.problemSummary.slice(0, 50) || 'this challenge';

    if (isAr) {
      const greetings = [
        `أهلاً يا باشا! بخصوص سؤالك عن "${topic}": ${MANDATORY_DISCLOSURE_AR} ده فحص للمشكلة والحل المقترح:`,
        `تحياتي يا فنان! شفت استفسارك بخصوص "${topic}". ${MANDATORY_DISCLOSURE_AR} حبيت أشاركك الحل والخطوات لتجاوزها:`,
        `أهلاً بك! قرأت تفاصيل المشكلة في "${topic}". ${MANDATORY_DISCLOSURE_AR} إليك التشخيص والحل العملي:`,
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    const greetings = [
      `Hi there! Regarding your question on "${topic}": ${MANDATORY_DISCLOSURE_EN} Here is an actionable breakdown and tested fix:`,
      `Hello! I saw you were running into an obstacle with "${topic}". ${MANDATORY_DISCLOSURE_EN} Below is the root-cause diagnosis and recommended resolution:`,
      `Hey! Looking into your issue with "${topic}": ${MANDATORY_DISCLOSURE_EN} Hope this concrete walkthrough helps you solve it:`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  private buildPart2(solution: SpecialistSolution, isAr: boolean): string {
    const lines = [solution.coreSolution];

    if (solution.recommendations && solution.recommendations.length > 0) {
      lines.push(isAr ? '\n💡 نصائح إضافية لمنع تكرار المشكلة:' : '\n💡 Pro-Tips for Long-term Resilience:');
      for (const rec of solution.recommendations) {
        lines.push(`• ${rec}`);
      }
    }

    if (solution.nextSteps && solution.nextSteps.length > 0) {
      lines.push(isAr ? '\n🚀 الخطوة التالية المقترحة:' : '\n🚀 Next Diagnostic Step:');
      for (const step of solution.nextSteps) {
        lines.push(`• ${step}`);
      }
    }

    return lines.join('\n');
  }

  private buildPart3(category: string, isAr: boolean): string {
    if (isAr) {
      return `لو حابب تناقش تفاصيل أكتر وتراجع الكود مع مبرمجين ومصممين فريلانسرز، في مجتمعنا "Nexus" عندنا قنوات مخصصة للـ Peer Review وتحديات برمجية بتساعدك تتطور وتلاقي مشاريع وفرص عمل حقيقية.`;
    }

    return `If you find these kinds of in-depth discussions helpful, you might enjoy "Nexus"—a collaborative community for freelancers, developers, and designers who value technical competence, peer reviews, and verified skill sharing.`;
  }

  private buildPart4(candidate: CandidateOpportunity, campaignCode: string, isAr: boolean): string {
    const inviteUrl = `https://discord.gg/nexus?src=${campaignCode}`;

    if (isAr) {
      return `تقدر تشرفنا على الديسكورد من الرابط ده: ${inviteUrl}\nأول ما تدخل، عرف نفسك للبوت في روم #welcome وهيفتحلك الرول الخاص بمجال ${candidate.category} فوراً! بالتوفيق يا رب.`;
    }

    return `You're welcome to jump in via this invite: ${inviteUrl}\nOnce inside, introduce yourself in #welcome, and our bot will instantly configure your ${candidate.category} workspace channels and roles! Happy coding.`;
  }
}

export const replyComposer = new ReplyComposer();
