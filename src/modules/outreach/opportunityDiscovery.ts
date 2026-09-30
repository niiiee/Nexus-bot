import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { outreachRulesGuard } from './rulesGuard.js';
import { SkillCategory } from './supplyDemandEngine.js';

export interface RawDiscoveredPost {
  platform: 'reddit' | 'stackoverflow' | 'hackernews' | 'devto' | 'facebook';
  community: string;
  postUrl: string;
  title: string;
  content: string;
  authorId: string;
  timestamp: number;
  isManualSubmission?: boolean;
  hasWrittenAdminPermission?: boolean;
}

export interface CandidateOpportunity {
  id: string;
  platform: string;
  community: string;
  postUrl: string;
  title: string;
  problemSummary: string;
  category: SkillCategory;
  language: 'en' | 'ar';
  authorId: string;
  score: number;
  relevance: number;
  urgency: number;
  solvability: number;
  communityFit: number;
  allowsPromo: boolean;
  allowsLinks: boolean;
  status: 'discovered' | 'in_review' | 'approved' | 'rejected' | 'published';
  createdAt: number;
}

export interface CommunityRuleProfile {
  platform: string;
  communityName: string;
  allowsBots: boolean;
  allowsPromo: boolean;
  allowsLinks: boolean;
  allowsUnsolicitedHelp: boolean;
  isPaused: boolean;
  pauseReason?: string;
}

export class OpportunityDiscoveryService {
  private allowedSubreddits = new Set(['reactjs', 'webdev', 'frontend', 'freelance', 'uidesign', 'node', 'nextjs', 'learnprogramming']);
  private minCandidateScore = 0.65;

  /**
   * Fetches or initializes rule profile for a community
   */
  public getCommunityRules(platform: string, community: string): CommunityRuleProfile {
    try {
      const row = dbService.get<{
        allows_bots: number;
        allows_promo: number;
        allows_links: number;
        allows_unsolicited_help: number;
        is_paused: number;
        pause_reason: string;
      }>(
        `SELECT * FROM outreach_community_rules WHERE platform = ? AND community_name = ? ORDER BY updated_at DESC LIMIT 1`,
        platform,
        community
      );

      if (row) {
        return {
          platform,
          communityName: community,
          allowsBots: row.allows_bots === 1,
          allowsPromo: row.allows_promo === 1,
          allowsLinks: row.allows_links === 1,
          allowsUnsolicitedHelp: row.allows_unsolicited_help === 1,
          isPaused: row.is_paused === 1,
          pauseReason: row.pause_reason,
        };
      }
    } catch {
      // ignore
    }

    // Default conservative rule profile
    const defaultAllowsPromo = platform === 'hackernews' ? false : true;
    const defaultAllowsLinks = platform === 'stackoverflow' ? false : true;

    return {
      platform,
      communityName: community,
      allowsBots: true,
      allowsPromo: defaultAllowsPromo,
      allowsLinks: defaultAllowsLinks,
      allowsUnsolicitedHelp: true,
      isPaused: false,
    };
  }

  /**
   * Save or update community rules
   */
  public setCommunityRules(rules: CommunityRuleProfile): void {
    try {
      const existing = dbService.get<{ id: string }>(
        `SELECT id FROM outreach_community_rules WHERE platform = ? AND community_name = ?`,
        rules.platform,
        rules.communityName
      );

      if (existing) {
        dbService.run(
          `UPDATE outreach_community_rules SET
            allows_bots = ?, allows_promo = ?, allows_links = ?,
            allows_unsolicited_help = ?, is_paused = ?, pause_reason = ?, updated_at = ?
           WHERE id = ?`,
          rules.allowsBots ? 1 : 0,
          rules.allowsPromo ? 1 : 0,
          rules.allowsLinks ? 1 : 0,
          rules.allowsUnsolicitedHelp ? 1 : 0,
          rules.isPaused ? 1 : 0,
          rules.pauseReason || null,
          Date.now(),
          existing.id
        );
      } else {
        dbService.run(
          `INSERT INTO outreach_community_rules (
            id, platform, community_name, allows_bots, allows_promo, allows_links,
            allows_unsolicited_help, is_paused, pause_reason, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          cryptoRandomUUID(),
          rules.platform,
          rules.communityName,
          rules.allowsBots ? 1 : 0,
          rules.allowsPromo ? 1 : 0,
          rules.allowsLinks ? 1 : 0,
          rules.allowsUnsolicitedHelp ? 1 : 0,
          rules.isPaused ? 1 : 0,
          rules.pauseReason || null,
          Date.now()
        );
      }
      logger.info(`[Discovery] Updated rules for ${rules.platform}/${rules.communityName} (Paused: ${rules.isPaused})`);
    } catch (err) {
      logger.error('[Discovery] Failed to save community rules:', err);
    }
  }

  /**
   * Pauses a community automatically upon moderator warning or removal
   */
  public pauseCommunity(platform: string, community: string, reason: string): void {
    const existing = this.getCommunityRules(platform, community);
    existing.isPaused = true;
    existing.pauseReason = reason;
    this.setCommunityRules(existing);
    logger.warn(`[Discovery] Community ${platform}/${community} paused: ${reason}`);
  }

  /**
   * Scores candidate post based on relevance, urgency, solvability, and community fit
   */
  public scoreCandidate(post: {
    title: string;
    body?: string;
    content?: string;
    platform?: string;
    community?: string;
    category?: string;
  }): number {
    const fullText = `${post.title}\n${post.body || post.content || ''}`;
    const category = (post.category as SkillCategory) || 'web_dev';
    const rules = (post.platform && post.community) 
      ? this.getCommunityRules(post.platform, post.community)
      : { allowsUnsolicitedHelp: true };

    const relevance = this.calculateRelevance(fullText, category);
    const urgency = fullText.includes('urgent') || fullText.includes('deadline') || fullText.includes('help please') || fullText.includes('immediately') ? 0.9 : 0.6;
    const solvability = fullText.length > 50 && (fullText.includes('how to') || fullText.includes('error') || fullText.includes('issue') || fullText.includes('crashing')) ? 0.85 : 0.45;
    const communityFit = rules.allowsUnsolicitedHelp ? 0.8 : 0.4;

    return Math.round(((relevance * 0.35) + (urgency * 0.25) + (solvability * 0.25) + (communityFit * 0.15)) * 100) / 100;
  }

  /**
   * Ingest and discover candidates from sample or live stream of posts
   */
  public discoverOpportunities(params: {
    platform: string;
    community: string;
    category: SkillCategory;
    samplePosts?: Array<{
      id?: string;
      title: string;
      body?: string;
      content?: string;
      authorId?: string;
      postUrl?: string;
      timestamp?: number;
      isManualSubmission?: boolean;
      hasWrittenAdminPermission?: boolean;
    }>;
  }): CandidateOpportunity[] {
    const results: CandidateOpportunity[] = [];
    const posts = params.samplePosts || [];

    for (const p of posts) {
      const raw: RawDiscoveredPost = {
        platform: params.platform as any,
        community: params.community,
        postUrl: p.postUrl || `https://${params.platform}.com/${params.community}/${p.id || Date.now()}`,
        title: p.title,
        content: p.body || p.content || '',
        authorId: p.authorId || 'anon_author',
        timestamp: p.timestamp || Date.now(),
        isManualSubmission: p.isManualSubmission,
        hasWrittenAdminPermission: p.hasWrittenAdminPermission,
      };

      const evaluated = this.evaluateCandidate(raw, params.category);
      if (evaluated.candidate) {
        if (p.id) evaluated.candidate.id = p.id;
        results.push(evaluated.candidate);
      }
    }

    return results;
  }

  /**
   * Evaluate and score candidate post
   */
  public evaluateCandidate(raw: RawDiscoveredPost, category: SkillCategory): { candidate?: CandidateOpportunity; skippedReason?: string } {
    // 1. Kill switch check
    if (outreachRulesGuard.isKillSwitchActive()) {
      return { skippedReason: 'Outreach kill switch is currently active' };
    }

    // 2. Platform ingestion check (Facebook manual submission enforcement)
    const platformCheck = outreachRulesGuard.validatePlatformIngestion({
      platform: raw.platform,
      isManualSubmission: raw.isManualSubmission,
      hasWrittenAdminPermission: raw.hasWrittenAdminPermission,
    });
    if (!platformCheck.allowed) {
      return { skippedReason: platformCheck.reason };
    }

    // 3. Reddit allowlist check
    if (raw.platform === 'reddit' && !this.allowedSubreddits.has(raw.community.replace(/^r\//, '').toLowerCase())) {
      return { skippedReason: `Subreddit ${raw.community} is not on the approved allowlist` };
    }

    // 4. Community paused or banned check
    const rules = this.getCommunityRules(raw.platform, raw.community);
    if (rules.isPaused) {
      return { skippedReason: `Community ${raw.platform}/${raw.community} is currently paused (${rules.pauseReason})` };
    }

    // 5. Permanent stoplist check
    if (outreachRulesGuard.isStopped(raw.authorId, raw.platform) || outreachRulesGuard.isStopped(raw.community, raw.platform)) {
      return { skippedReason: `Author ${raw.authorId} or community ${raw.community} is on the stoplist` };
    }

    // 6. Sensitive topic check
    const fullText = `${raw.title}\n${raw.content}`;
    const sensitiveCheck = outreachRulesGuard.isSensitiveTopic(fullText);
    if (sensitiveCheck.isSensitive) {
      return { skippedReason: `Post skipped due to sensitive topic filter: ${sensitiveCheck.reason}` };
    }

    // 7. Freshness check (skip posts older than 48h)
    const ageHours = (Date.now() - raw.timestamp) / (1000 * 60 * 60);
    if (ageHours > 48) {
      return { skippedReason: `Post is stale (${Math.round(ageHours)} hours old)` };
    }

    // 8. Intent & scoring calculation
    const relevance = this.calculateRelevance(fullText, category);
    const urgency = fullText.includes('urgent') || fullText.includes('deadline') || fullText.includes('help please') || fullText.includes('immediately') ? 0.9 : 0.6;
    const solvability = fullText.length > 50 && (fullText.includes('how to') || fullText.includes('error') || fullText.includes('issue') || fullText.includes('crashing')) ? 0.85 : 0.45;
    const communityFit = rules.allowsUnsolicitedHelp ? 0.8 : 0.4;

    const totalScore = Math.round(((relevance * 0.35) + (urgency * 0.25) + (solvability * 0.25) + (communityFit * 0.15)) * 100) / 100;

    if (totalScore < this.minCandidateScore) {
      return { skippedReason: `Candidate score ${totalScore} below threshold ${this.minCandidateScore}` };
    }

    // 9. Language detection
    const isArabic = /[\u0600-\u06FF]/.test(fullText);
    const language = isArabic ? 'ar' : 'en';

    const candidate: CandidateOpportunity = {
      id: cryptoRandomUUID(),
      platform: raw.platform,
      community: raw.community,
      postUrl: raw.postUrl,
      title: raw.title,
      problemSummary: raw.content.slice(0, 200),
      category,
      language,
      authorId: raw.authorId,
      score: totalScore,
      relevance,
      urgency,
      solvability,
      communityFit,
      allowsPromo: rules.allowsPromo,
      allowsLinks: rules.allowsLinks,
      status: 'discovered',
      createdAt: Date.now(),
    };

    // Store candidate sanitized in database
    try {
      dbService.run(
        `INSERT INTO outreach_candidates (id, source_platform, source_community, post_url, problem_summary, category, language, author_id, score, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        candidate.id,
        candidate.platform,
        candidate.community,
        candidate.postUrl,
        candidate.problemSummary,
        candidate.category,
        candidate.language,
        candidate.authorId,
        candidate.score,
        candidate.status,
        candidate.createdAt
      );
    } catch {
      // ignore
    }

    return { candidate };
  }

  private calculateRelevance(text: string, category: SkillCategory): number {
    const keywords: Record<SkillCategory, string[]> = {
      web_dev: ['react', 'next.js', 'typescript', 'javascript', 'css', 'html', 'node', 'tailwind', 'api'],
      mobile_dev: ['flutter', 'react native', 'ios', 'android', 'swift', 'kotlin'],
      bots_automation: ['discord bot', 'telegram bot', 'automation', 'webhook', 'cron', 'crawler', 'python'],
      ui_ux: ['figma', 'ui design', 'ux', 'wireframe', 'prototype', 'typography', 'user flow'],
      graphic_design: ['logo', 'branding', 'vector', 'photoshop', 'illustrator'],
      video_editing: ['premiere', 'davinci', 'timeline', 'render', 'color grade', 'keyframes'],
      motion_graphics: ['after effects', 'animation', 'lottie', 'motion design'],
      copywriting: ['copy', 'landing page', 'newsletter', 'headline', 'writing'],
      translation: ['translate', 'localization', 'arabic', 'english', 'subtitles'],
      data_ai: ['python', 'llm', 'machine learning', 'pytorch', 'pandas', 'prompt engineering'],
    };

    const targetWords = keywords[category] || [];
    const lower = text.toLowerCase();
    let hits = 0;
    for (const w of targetWords) {
      if (lower.includes(w)) hits++;
    }

    return Math.min(1.0, 0.4 + (hits * 0.15));
  }
}

export const opportunityDiscoveryService = new OpportunityDiscoveryService();
