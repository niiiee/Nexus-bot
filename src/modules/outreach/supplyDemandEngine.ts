import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export const SKILL_CATEGORIES = [
  'web_dev',
  'mobile_dev',
  'bots_automation',
  'ui_ux',
  'graphic_design',
  'video_editing',
  'motion_graphics',
  'copywriting',
  'translation',
  'data_ai',
] as const;

export type SkillCategory = typeof SKILL_CATEGORIES[number];

export interface SkillGapMetrics {
  category: SkillCategory;
  demandIndex: number;
  effectiveSupply: number;
  gapScore: number;
  confidence: number;
  trend: 'rising' | 'stable' | 'falling';
  topUnmetSkills: string[];
  recommendedAction: string;
}

export interface GapAlert {
  category: SkillCategory;
  gapScore: number;
  trend: string;
  summary: string;
  actionSuggestions: string[];
}

export class SupplyDemandEngine {
  private alertThreshold: number = 1.8; // Gap score threshold triggering alerts

  public setAlertThreshold(threshold: number): void {
    this.alertThreshold = threshold;
  }

  /**
   * Measure demand index for a category
   */
  public computeDemandIndex(guildId: string, category: SkillCategory): number {
    try {
      // 1. Job posts in category
      const jobRows = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM jobs WHERE guild_id = ? AND required_skills LIKE ? AND status = 'open'`,
        guildId,
        `%${category}%`
      );
      const jobsCount = jobRows?.count || 0;

      // 2. Deals in category
      const dealRows = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM deals WHERE guild_id = ? AND title LIKE ?`,
        guildId,
        `%${category}%`
      );
      const dealsCount = dealRows?.count || 0;

      // 3. Unanswered tasks or questions in category
      const taskRows = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM daily_tasks WHERE field LIKE ?`,
        `%${category}%`
      );
      const tasksCount = taskRows?.count || 0;

      // Synthetic baseline + weighted demand
      return 10 + (jobsCount * 5) + (dealsCount * 4) + (tasksCount * 2);
    } catch {
      return 15; // default fallback
    }
  }

  /**
   * Measure effective supply for a category
   */
  public computeEffectiveSupply(guildId: string, category: SkillCategory): number {
    try {
      // Verified members matching field
      const memberRows = dbService.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM members WHERE guild_id = ? AND field LIKE ? AND is_restricted = 0`,
        guildId,
        `%${category}%`
      );
      const rawCount = memberRows?.count || 0;

      // Active workload (members currently engaged in deals)
      const busyRows = dbService.get<{ count: number }>(
        `SELECT COUNT(DISTINCT freelancer_id) as count FROM deals WHERE guild_id = ? AND status IN ('funded', 'in_progress')`,
        guildId
      );
      const busyCount = busyRows?.count || 0;

      const availableMembers = Math.max(1, rawCount - (busyCount * 0.5));
      return availableMembers * 2.5; // effective supply capacity
    } catch {
      return 5;
    }
  }

  /**
   * Compute weekly gap score for a category
   */
  public calculateCategoryGap(guildId: string, category: SkillCategory): SkillGapMetrics {
    const demandIndex = this.computeDemandIndex(guildId, category);
    const effectiveSupply = this.computeEffectiveSupply(guildId, category);
    const rawGap = demandIndex / effectiveSupply;

    // Seasonality adjustment (e.g. Q4 or start-of-month client hiring spikes)
    const month = new Date().getMonth();
    const seasonalityWeight = (month === 8 || month === 9 || month === 0) ? 1.15 : 1.0;
    const gapScore = Math.round(rawGap * seasonalityWeight * 100) / 100;

    // Trend calculation by checking past gap in DB
    let trend: 'rising' | 'stable' | 'falling' = 'stable';
    try {
      const past = dbService.get<{ gap_score: number }>(
        `SELECT gap_score FROM outreach_gaps WHERE guild_id = ? AND category = ? ORDER BY timestamp DESC LIMIT 1`,
        guildId,
        category
      );
      if (past) {
        if (gapScore > past.gap_score * 1.1) trend = 'rising';
        else if (gapScore < past.gap_score * 0.9) trend = 'falling';
      }
    } catch {
      // ignore
    }

    const confidence = Math.min(0.98, Math.max(0.70, 0.75 + (effectiveSupply / 50)));

    let recommendedAction = 'Maintain standard community engagement.';
    if (gapScore > 2.5) {
      recommendedAction = `Critical skill shortage: Launch targeted outreach and run a ${category} bounty challenge.`;
    } else if (gapScore > this.alertThreshold) {
      recommendedAction = `Moderate deficit: Recruit specialists via community outreach in ${category}.`;
    } else if (gapScore < 0.8) {
      recommendedAction = `Surplus talent: Stimulate external client job postings in ${category}.`;
    }

    const unmetSkillsMap: Record<SkillCategory, string[]> = {
      web_dev: ['Next.js 15 App Router', 'PostgreSQL Optimization', 'WebSockets'],
      mobile_dev: ['Flutter Clean Architecture', 'React Native TurboModules', 'SwiftUI'],
      bots_automation: ['Discord.js v14', 'Telegram grammY', 'n8n Workflows'],
      ui_ux: ['Figma Design Systems', 'WCAG AAA Accessibility', 'Mobile Micro-Interactions'],
      graphic_design: ['Brand Identity Guidelines', 'Vector Typography', 'Social Media Kits'],
      video_editing: ['DaVinci Resolve Color Grading', 'Premiere Pro Dynamic Links', 'Shorts Pacing'],
      motion_graphics: ['After Effects Lottie Animations', 'Blender 3D Modeling', 'Rive Runtime'],
      copywriting: ['SaaS Landing Page Copy', 'Cold Outreach Email Sequences', 'SEO Tech Articles'],
      translation: ['English to Egyptian Arabic Technical Localization', 'Legal NDA Translation'],
      data_ai: ['RAG Pipeline Optimization', 'Vector Database Search', 'PyTorch Fine-Tuning'],
    };

    const metrics: SkillGapMetrics = {
      category,
      demandIndex,
      effectiveSupply,
      gapScore,
      confidence,
      trend,
      topUnmetSkills: unmetSkillsMap[category] || [],
      recommendedAction,
    };

    // Save history in database
    try {
      dbService.run(
        `INSERT INTO outreach_gaps (id, guild_id, category, demand_index, effective_supply, gap_score, confidence, trend, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        cryptoRandomUUID(),
        guildId,
        category,
        demandIndex,
        effectiveSupply,
        gapScore,
        confidence,
        trend,
        Date.now()
      );
    } catch {
      // ignore in tests
    }

    return metrics;
  }

  /**
   * Generates full gap heatmap across all 10 categories
   */
  public generateFullHeatmap(guildId: string): SkillGapMetrics[] {
    return SKILL_CATEGORIES.map(category => this.calculateCategoryGap(guildId, category));
  }

  /**
   * Checks for critical gap alerts
   */
  public evaluateAlerts(guildId: string): GapAlert[] {
    const gaps = this.generateFullHeatmap(guildId);
    const alerts: GapAlert[] = [];

    for (const g of gaps) {
      if (g.gapScore >= this.alertThreshold || (g.trend === 'rising' && g.gapScore > 1.5)) {
        alerts.push({
          category: g.category,
          gapScore: g.gapScore,
          trend: g.trend,
          summary: `High skill demand deficit detected in "${g.category}" (Gap Score: ${g.gapScore}, Trend: ${g.trend}).`,
          actionSuggestions: [
            `Launch external community outreach for ${g.category}`,
            `Post community hackathon / challenge in ${g.category}`,
            `Adjust job matching role pings for active members`,
          ],
        });
      }
    }

    return alerts;
  }
}

export const supplyDemandEngine = new SupplyDemandEngine();
