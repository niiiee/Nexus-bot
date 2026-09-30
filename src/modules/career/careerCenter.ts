import { logger } from '../../utils/logger.js';

export interface ResumeAuditResult {
  score: number; // 0 - 100
  grade: 'Excellent' | 'Competitive' | 'Needs Improvement' | 'Critical Overhaul';
  actionVerbsFound: string[];
  weakPhrasesFound: string[];
  hasMetrics: boolean;
  suggestions: string[];
}

export interface LinkedInFeedback {
  headlineScore: number;
  summaryFeedback: string;
  recommendedHeadline: string;
  keySkillsToHighlight: string[];
}

export class CareerCenterService {
  private strongVerbs = [
    'architected', 'spearheaded', 'refactored', 'optimized', 'engineered',
    'deployed', 'designed', 'mentored', 'scaled', 'implemented', 'built',
    'صممت', 'طورت', 'أعدت هيكلة', 'حسّنت', 'بنيت', 'أشرفت', 'أطلقت'
  ];

  private weakPhrases = [
    'worked on', 'helped with', 'responsible for', 'assisted in', 'handled tasks',
    'كنت شغال على', 'مسؤول عن', 'ساعدت في'
  ];

  /**
   * Audits a developer or designer resume text for impact, metrics, and strong verbs.
   */
  public auditResume(resumeText: string): ResumeAuditResult {
    const lower = resumeText.toLowerCase();

    // 1. Check strong verbs
    const foundStrong = this.strongVerbs.filter(v => lower.includes(v.toLowerCase()));

    // 2. Check weak phrases
    const foundWeak = this.weakPhrases.filter(w => lower.includes(w.toLowerCase()));

    // 3. Check for quantified metrics (numbers, %, $, x speedup)
    const metricsRegex = /(\d+%|\$\d+|\b\d+x\b|\b\d+k?\s*(users|clients|projects|ms|seconds|hours|dollars|مستخدم|مشروع))/i;
    const hasMetrics = metricsRegex.test(resumeText);

    // Scoring calculation
    let score = 50; // base score
    score += Math.min(25, foundStrong.length * 5);
    score -= Math.min(20, foundWeak.length * 5);
    if (hasMetrics) score += 25;
    score = Math.max(10, Math.min(100, score));

    const suggestions: string[] = [];

    if (foundWeak.length > 0) {
      suggestions.push(`Replace passive phrases like "${foundWeak.join(', ')}" with proactive action verbs (e.g. "Architected", "Engineered", "Optimized").`);
    }

    if (!hasMetrics) {
      suggestions.push('Add quantifiable business metrics to your bullet points (e.g. "reduced latency by 35%", "scaled to 50k users", "saved $10,000/yr").');
    }

    if (foundStrong.length < 3) {
      suggestions.push('Lead each bullet point with a decisive technical verb showing ownership and engineering leadership.');
    }

    if (suggestions.length === 0) {
      suggestions.push('Strong, metrics-driven resume presentation! Ready for senior contractor and remote roles.');
    }

    let grade: ResumeAuditResult['grade'] = 'Needs Improvement';
    if (score >= 85) grade = 'Excellent';
    else if (score >= 70) grade = 'Competitive';
    else if (score >= 50) grade = 'Needs Improvement';
    else grade = 'Critical Overhaul';

    return {
      score,
      grade,
      actionVerbsFound: foundStrong,
      weakPhrasesFound: foundWeak,
      hasMetrics,
      suggestions,
    };
  }

  /**
   * Generates LinkedIn profile optimization feedback.
   */
  public reviewLinkedIn(headline: string, summary: string, primaryStack: string[]): LinkedInFeedback {
    const headlineWords = headline.split(/\s+/).length;
    let headlineScore = 60;

    if (headline.includes('|') || headline.includes('•')) headlineScore += 20;
    if (primaryStack.some(tech => headline.toLowerCase().includes(tech.toLowerCase()))) headlineScore += 20;
    headlineScore = Math.min(100, headlineScore);

    const recommendedHeadline = `Senior ${primaryStack.slice(0, 2).join(' & ')} Engineer | Building Scalable Web & AI Systems | Open to Select High-Impact Contracts`;

    const summaryFeedback = summary.length < 150
      ? 'Your About section is too brief. Highlight your engineering philosophy, top 3 commercial wins, and the exact problems you solve for clients.'
      : 'Comprehensive About section. Ensure you have clear contact call-to-actions at the bottom.';

    return {
      headlineScore,
      summaryFeedback,
      recommendedHeadline,
      keySkillsToHighlight: primaryStack,
    };
  }

  /**
   * Generates a tailored cover letter matching candidate skills with a job opening.
   */
  public generateCoverLetter(params: {
    candidateName: string;
    jobTitle: string;
    clientOrCompany: string;
    keySkills: string[];
    yearsExperience: number;
    locale: 'ar' | 'en';
  }): string {
    const isAr = params.locale === 'ar';

    if (isAr) {
      return [
        `تحياتي لفريق **${params.clientOrCompany}**،`,
        `\nأتقدم إليكم باهتمام كبير بفرصة **${params.jobTitle}**. بخبرة تفوق **${params.yearsExperience} سنوات** في بناء وتطوير الأنظمة البرمجية باستخدام (${params.keySkills.join('، ')})، واثق من قدرتي على تقديم إضافة نوعية ومباشرة لمشروعكم.`,
        `\nخلال مسيرتي، ركزت دائماً على الكود النظيف، الأداء العالي، وحل المشكلات المعقدة بأبسط الطرق وأكثرها استدامة. يسعدني الاطلاع على تفاصيل التحدي التقني ومناقشة كيف يمكننا تحويل أهدافكم إلى منتج واقعي بأعلى معايير الجودة.`,
        `\nشاكر لوقتكم ومتحمس للتواصل والبدء في العمل معاً!`,
        `\nخالص التقدير،`,
        `**${params.candidateName}**`,
      ].join('\n');
    }

    return [
      `Dear **${params.clientOrCompany}** Hiring Team,`,
      `\nI am writing to express my strong interest in the **${params.jobTitle}** role. With over **${params.yearsExperience} years** of hands-on experience architecting robust software with ${params.keySkills.join(', ')}, I am confident in my ability to deliver immediate value to your project.`,
      `\nThroughout my career, I have prioritized clean architecture, rigorous testing, and measurable business impact. I welcome the opportunity to discuss your technical roadmap and how we can turn your objectives into scalable, high-performance reality.`,
      `\nThank you for your time and consideration. I look forward to connecting soon.`,
      `\nBest regards,`,
      `**${params.candidateName}**`,
    ].join('\n');
  }
}

export const careerCenterService = new CareerCenterService();
