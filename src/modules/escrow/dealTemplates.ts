import { DealAgreement } from './dealLifecycle.js';

export interface DealTemplateDefinition {
  type: 'logo_branding' | 'web_landing' | 'discord_bot' | 'mobile_app';
  title: string;
  defaultScope: string;
  defaultDeliverables: string[];
  suggestedMilestones: Array<{ title: string; percentage: number }>;
  defaultRevisionCap: number;
}

export const DEAL_TEMPLATES: Record<string, DealTemplateDefinition> = {
  logo_branding: {
    type: 'logo_branding',
    title: 'Brand Identity & Logo Package',
    defaultScope: 'Full visual identity creation including primary logo, secondary mark, typography rules, and color palette.',
    defaultDeliverables: [
      'Vector master files (SVG, EPS, AI)',
      'High-res PNG exports with transparent backgrounds',
      'PDF Brand Style Guidelines document',
    ],
    suggestedMilestones: [
      { title: 'Moodboard & 3 Initial Concepts', percentage: 40 },
      { title: 'Final Refinement & Vector Asset Handoff', percentage: 60 },
    ],
    defaultRevisionCap: 2,
  },
  web_landing: {
    type: 'web_landing',
    title: 'Responsive High-Converting Landing Page',
    defaultScope: 'Modern 1-page responsive web landing page built with Next.js/React, Tailwind CSS, SEO tags, and lead capture form.',
    defaultDeliverables: [
      'Git repository source code with clean architecture',
      'Fully responsive UI across mobile, tablet, and desktop',
      'Vercel or custom Docker deployment setup',
    ],
    suggestedMilestones: [
      { title: 'UI/UX Wireframes & Component Design', percentage: 30 },
      { title: 'Frontend Implementation & Form Integration', percentage: 40 },
      { title: 'Testing, Speed Optimization & Production Launch', percentage: 30 },
    ],
    defaultRevisionCap: 2,
  },
  discord_bot: {
    type: 'discord_bot',
    title: 'Custom Production Discord Bot',
    defaultScope: 'Automated Discord bot using Discord.js v14 or Python, slash commands, persistent database, and Docker containerization.',
    defaultDeliverables: [
      'Clean TypeScript/Python codebase with zero stubbed logic',
      'Automated slash command registration',
      'Dockerfile and docker-compose.yml for 24/7 hosting',
    ],
    suggestedMilestones: [
      { title: 'Command Architecture & Database Setup', percentage: 40 },
      { title: 'Complete Feature Implementation & Handover', percentage: 60 },
    ],
    defaultRevisionCap: 2,
  },
  mobile_app: {
    type: 'mobile_app',
    title: 'Cross-Platform Mobile App MVP',
    defaultScope: 'Flutter or React Native application featuring 5 core screens, user authentication, and backend REST API integration.',
    defaultDeliverables: [
      'Cross-platform mobile source code (iOS & Android)',
      'API integration and local storage persistence',
      'APK/TestFlight build handoff',
    ],
    suggestedMilestones: [
      { title: 'Architecture, UI Screens & Navigation', percentage: 35 },
      { title: 'API Integration & Authentication', percentage: 35 },
      { title: 'QA, Store Build Packaging & Documentation', percentage: 30 },
    ],
    defaultRevisionCap: 2,
  },
};

export class DealTemplatesService {
  public getTemplate(type: string): DealTemplateDefinition {
    return DEAL_TEMPLATES[type] || DEAL_TEMPLATES.web_landing;
  }

  public populateAgreementFromTemplate(params: {
    templateType: string;
    dealId: string;
    totalAmount: number;
    currency?: string;
    deadline: string;
  }): DealAgreement {
    const tmpl = this.getTemplate(params.templateType);
    const currency = params.currency || 'USD';

    const milestones = tmpl.suggestedMilestones.map((m, idx) => ({
      id: `m_${idx + 1}`,
      title: m.title,
      amount: Math.round((m.percentage / 100) * params.totalAmount),
      status: 'pending' as const,
    }));

    return {
      dealId: params.dealId,
      scope: tmpl.defaultScope,
      deliverables: tmpl.defaultDeliverables,
      milestones,
      currency,
      totalAmount: params.totalAmount,
      deadline: params.deadline,
      revisionCap: tmpl.defaultRevisionCap,
      cancellationTerms: 'Pro-rata payout for approved milestones; 20% cancellation fee on remaining balance upon mutual middleman sign-off.',
    };
  }
}

export const dealTemplatesService = new DealTemplatesService();
