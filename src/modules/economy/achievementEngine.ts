import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: 'coding' | 'design' | 'freelancing' | 'escrow' | 'community' | 'moderation' | 'secret';
  titleUnlocked?: string;
  isHidden?: boolean;
}

// Generate comprehensive 100+ achievements catalog
export const ALL_ACHIEVEMENTS: AchievementDefinition[] = [
  // Coding (20)
  { id: 'code_first_task', name: 'First Line of Code', description: 'Submit your very first programming task.', category: 'coding', titleUnlocked: 'Novice Coder' },
  { id: 'code_five_tasks', name: 'Algorithmic Apprentice', description: 'Submit 5 approved programming tasks.', category: 'coding', titleUnlocked: 'Apprentice Developer' },
  { id: 'code_ten_tasks', name: 'Code Artisan', description: 'Complete 10 approved programming tasks.', category: 'coding', titleUnlocked: 'Code Artisan' },
  { id: 'code_twenty_five', name: 'Software Craftsman', description: 'Complete 25 approved programming tasks.', category: 'coding', titleUnlocked: 'Software Craftsman' },
  { id: 'code_fifty_tasks', name: 'System Architect', description: 'Complete 50 approved programming tasks.', category: 'coding', titleUnlocked: 'System Architect' },
  { id: 'code_hundred_tasks', name: 'Code Wizard', description: 'Complete 100 approved programming tasks.', category: 'coding', titleUnlocked: 'Code Wizard' },
  { id: 'code_zero_bug', name: 'Defect Slayer', description: 'Score a flawless 100/100 on code review rubric.', category: 'coding', titleUnlocked: 'Bug Hunter' },
  { id: 'code_speed_demon', name: 'Speed Daemon', description: 'Complete a live coding sandbox challenge in under 10 minutes.', category: 'coding', titleUnlocked: 'Speed Demon' },
  { id: 'code_polyglot_3', name: 'Tricolor Polyglot', description: 'Complete tasks in 3 distinct programming languages.', category: 'coding', titleUnlocked: 'Polyglot' },
  { id: 'code_polyglot_5', name: 'Language Grandmaster', description: 'Complete tasks in 5 distinct programming languages.', category: 'coding', titleUnlocked: 'Universal Polyglot' },
  { id: 'code_big_o_king', name: 'Complexity Conqueror', description: 'Optimize code from O(n^2) to O(n) or better.', category: 'coding', titleUnlocked: 'Big-O Master' },
  { id: 'code_owasp_shield', name: 'Security Sentinel', description: 'Fix an OWASP Top 10 vulnerability in a review.', category: 'coding', titleUnlocked: 'Security Auditor' },
  { id: 'code_refactor_pro', name: 'Clean Architecture Pioneer', description: 'Successfully refactor a legacy code block with zero regressions.', category: 'coding', titleUnlocked: 'Clean Architect' },
  { id: 'code_unit_tester', name: 'Test Coverage Fanatic', description: 'Achieve 100% test coverage in a sandbox challenge.', category: 'coding', titleUnlocked: 'TDD Champion' },
  { id: 'code_async_master', name: 'Concurrency Commander', description: 'Master complex asynchronous promises and thread pools.', category: 'coding' },
  { id: 'code_regex_guru', name: 'Regex Alchemist', description: 'Solve a pattern matching challenge using advanced regex.', category: 'coding' },
  { id: 'code_sql_wizard', name: 'Database Sorcerer', description: 'Write an optimized recursive CTE SQL query.', category: 'coding', titleUnlocked: 'SQL Alchemist' },
  { id: 'code_api_builder', name: 'API Architect', description: 'Build and document a full REST/GraphQL API specification.', category: 'coding' },
  { id: 'code_ci_cd_hero', name: 'DevOps Vanguard', description: 'Automate build and deployment pipelines.', category: 'coding' },
  { id: 'code_senior_eval', name: 'Evaluated Senior', description: 'Pass the 3+ years experience live vetting with flying colors.', category: 'coding', titleUnlocked: 'Senior Engineer' },

  // Design (18)
  { id: 'des_first_review', name: 'First Critique', description: 'Submit your first UI/UX piece for critique.', category: 'design', titleUnlocked: 'Visual Apprentice' },
  { id: 'des_contrast_king', name: 'WCAG AAA Champion', description: 'Pass an accessibility audit with AAA color contrast rating.', category: 'design', titleUnlocked: 'Accessibility Hero' },
  { id: 'des_8px_grid', name: 'Rhythm of the Grid', description: 'Adhere flawlessly to the 8pt spatial system in UI critique.', category: 'design', titleUnlocked: 'Grid Master' },
  { id: 'des_rtl_master', name: 'Arabic Typography Maestro', description: 'Design a seamless RTL Arabic typography layout.', category: 'design', titleUnlocked: 'Arabic Typographer' },
  { id: 'des_design_system', name: 'Component Architect', description: 'Build a reusable 12-component atomic design system.', category: 'design', titleUnlocked: 'Design Systems Lead' },
  { id: 'des_five_reviews', name: 'Aesthetic Eye', description: 'Receive 5 community reviews on design work.', category: 'design' },
  { id: 'des_ten_reviews', name: 'Visual Perfectionist', description: 'Receive 10 community reviews on design work.', category: 'design', titleUnlocked: 'Pixel Perfect' },
  { id: 'des_wireframe_whiz', name: 'UX Strategist', description: 'Complete a full user flow wireframe with edge cases.', category: 'design', titleUnlocked: 'UX Strategist' },
  { id: 'des_mobile_first', name: 'Responsive Virtuoso', description: 'Design adaptive views for mobile, tablet, and widescreen desktop.', category: 'design' },
  { id: 'des_micro_motion', name: 'Motion Specialist', description: 'Create smooth micro-interactions and transitions.', category: 'design' },
  { id: 'des_brand_identity', name: 'Brand Storyteller', description: 'Complete a comprehensive brand guidelines deck.', category: 'design' },
  { id: 'des_icon_crafter', name: 'Iconographer', description: 'Craft a custom 16-icon vector glyph set.', category: 'design' },
  { id: 'des_dark_mode_pro', name: 'Nocturnal Stylist', description: 'Perfect a balanced Dark Mode color palette.', category: 'design' },
  { id: 'des_portfolio_showcase', name: 'Gallery Star', description: 'Get 25+ upvotes on a portfolio showcase piece.', category: 'design', titleUnlocked: 'Gallery Luminary' },
  { id: 'des_heuristic_eval', name: 'Heuristic Inspector', description: 'Conduct a thorough Nielsen-Norman heuristic evaluation.', category: 'design' },
  { id: 'des_prototype_ace', name: 'Interactive Wizard', description: 'Deliver a high-fidelity clickable prototype.', category: 'design' },
  { id: 'des_user_researcher', name: 'Empathetic Explorer', description: 'Synthesize insights from 5 user persona interviews.', category: 'design' },
  { id: 'des_senior_designer', name: 'Creative Director', description: 'Attain Senior Designer rank in community vetting.', category: 'design', titleUnlocked: 'Creative Director' },

  // Freelancing & Business (18)
  { id: 'free_first_invoice', name: 'Paper Trail', description: 'Generate your first PDF freelance invoice.', category: 'freelancing' },
  { id: 'free_five_invoices', name: 'Billing Pro', description: 'Generate 5 freelance invoices through the portal.', category: 'freelancing', titleUnlocked: 'Invoicing Pro' },
  { id: 'free_first_proposal', name: 'Pitch Starter', description: 'Generate a tailored proposal using the proposal coach.', category: 'freelancing' },
  { id: 'free_won_deal', name: 'Contract Sealed', description: 'Successfully close and complete a freelance client deal.', category: 'freelancing', titleUnlocked: 'Deal Closer' },
  { id: 'free_five_deals', name: 'Reputable Contractor', description: 'Complete 5 client contracts with positive reviews.', category: 'freelancing', titleUnlocked: 'Veteran Contractor' },
  { id: 'free_ten_deals', name: 'Top Tier Freelancer', description: 'Complete 10 client contracts with positive reviews.', category: 'freelancing', titleUnlocked: 'Elite Freelancer' },
  { id: 'free_rate_optimizer', name: 'Value Realizer', description: 'Calculate and increase your hourly rate using the Rate Calculator.', category: 'freelancing' },
  { id: 'free_sow_creator', name: 'Scope Defender', description: 'Create an iron-clad Statement of Work with milestone revision caps.', category: 'freelancing', titleUnlocked: 'Scope Master' },
  { id: 'free_clause_decoder', name: 'Contract Scholar', description: 'Analyze complex freelance contract clauses with AI.', category: 'freelancing' },
  { id: 'free_time_tracker_10', name: 'Clockwork Focus', description: 'Log 10 focused hours in the project time tracker.', category: 'freelancing' },
  { id: 'free_time_tracker_50', name: 'Deep Work Champion', description: 'Log 50 focused hours in the project time tracker.', category: 'freelancing', titleUnlocked: 'Deep Work Master' },
  { id: 'free_earnings_ledger', name: 'Financial Discipline', description: 'Track income securely with encrypted earnings ledger.', category: 'freelancing' },
  { id: 'free_repeat_client', name: 'Client Whisperer', description: 'Secure a follow-up contract from a satisfied repeat client.', category: 'freelancing', titleUnlocked: 'Client Whisperer' },
  { id: 'free_five_star_streak', name: 'Flawless Reputation', description: 'Maintain a 5.0 rating across 3 consecutive projects.', category: 'freelancing', titleUnlocked: 'Five-Star Legend' },
  { id: 'free_international_client', name: 'Cross-Border Operator', description: 'Close a contract with an international client in foreign currency.', category: 'freelancing' },
  { id: 'free_retainer_secured', name: 'Predictable Revenue', description: 'Sign an ongoing monthly retainer agreement.', category: 'freelancing' },
  { id: 'free_client_sim_ace', name: 'Tough Negotiator', description: 'Score 90%+ in the Difficult Client AI Roleplay Simulator.', category: 'freelancing', titleUnlocked: 'Master Negotiator' },
  { id: 'free_tax_master', name: 'Fiscal Steward', description: 'Calculate taxes and currency conversions for international revenue.', category: 'freelancing' },

  // Escrow & Middleman (14)
  { id: 'esc_first_deal', name: 'Safe Transaction', description: 'Complete your first deal through verified middleman escrow.', category: 'escrow' },
  { id: 'esc_three_deals', name: 'Escrow Habitual', description: 'Complete 3 middleman escrow deals without disputes.', category: 'escrow' },
  { id: 'esc_zero_dispute_10', name: 'Flawless Settlement', description: 'Close 10 middleman deals with zero disputes.', category: 'escrow', titleUnlocked: 'Dispute-Free Veteran' },
  { id: 'esc_middleman_trainee', name: 'Sworn Middleman', description: 'Qualify and register as a Trainee Middleman.', category: 'escrow', titleUnlocked: 'Trusted Arbiter' },
  { id: 'esc_middleman_verified', name: 'Verified Middleman', description: 'Advance to Verified Middleman tier handling $2,500+ deals.', category: 'escrow', titleUnlocked: 'Verified Middleman' },
  { id: 'esc_middleman_elite', name: 'Senior Broker', description: 'Attain Senior Middleman tier handling $10,000+ deals.', category: 'escrow', titleUnlocked: 'Senior Broker' },
  { id: 'esc_fraud_shield_catch', name: 'Hawk Eye', description: 'Detect an invalid transaction hash or spoofed payment proof.', category: 'escrow', titleUnlocked: 'Fraud Hunter' },
  { id: 'esc_rapid_release', name: 'Prompt Payer', description: 'Approve and release milestone payment within 2 hours of delivery.', category: 'escrow' },
  { id: 'esc_team_split', name: 'Syndicate Paymaster', description: 'Execute a multi-party team payout split successfully.', category: 'escrow' },
  { id: 'esc_dispute_resolved', name: 'Peacemaker', description: 'Resolve a client dispute amicably through neutral mediation.', category: 'escrow', titleUnlocked: 'Peacemaker' },
  { id: 'esc_high_roller', name: 'Whale Deal', description: 'Successfully close an escrow transaction exceeding $5,000.', category: 'escrow', titleUnlocked: 'Whale Broker' },
  { id: 'esc_template_user', name: 'Standard of Excellence', description: 'Draft a contract using an official verified deal template.', category: 'escrow' },
  { id: 'esc_fast_middleman', name: 'Lightning Arbiter', description: 'Facilitate a deal from drafting to completion in under 24 hours.', category: 'escrow' },
  { id: 'esc_community_trust', name: 'Pillar of Integrity', description: 'Attain a 5.0 middleman rating across 20+ transactions.', category: 'escrow', titleUnlocked: 'Pillar of Integrity' },

  // Community & Social (18)
  { id: 'com_welcome', name: 'Welcome Aboard', description: 'Complete onboarding interview and join the server.', category: 'community' },
  { id: 'com_first_endorsement', name: 'Peer Recognition', description: 'Receive your first skill endorsement from a peer.', category: 'community' },
  { id: 'com_five_endorsements', name: 'Respected Voice', description: 'Accumulate 5 endorsements across programming or design.', category: 'community' },
  { id: 'com_ten_endorsements', name: 'Community Beacon', description: 'Accumulate 10 legitimate peer endorsements.', category: 'community', titleUnlocked: 'Community Beacon' },
  { id: 'com_first_invite', name: 'Ambassador', description: 'Invite a verified developer or designer to the community.', category: 'community' },
  { id: 'com_five_invites', name: 'Community Builder', description: 'Bring 5 active members into the community.', category: 'community', titleUnlocked: 'Community Builder' },
  { id: 'com_squad_join', name: 'Squad Up', description: 'Join or found a competitive community squad.', category: 'community' },
  { id: 'com_squad_win', name: 'Squad Victory', description: 'Lead or participate in a squad topping the weekly leaderboard.', category: 'community', titleUnlocked: 'Squad Champion' },
  { id: 'com_mentor_pair', name: 'Guiding Light', description: 'Register as an official mentor and complete 3 bi-weekly check-ins.', category: 'community', titleUnlocked: 'Trusted Mentor' },
  { id: 'com_mentee_graduate', name: 'Mentee Graduate', description: 'Successfully complete a 3-month mentorship cycle.', category: 'community', titleUnlocked: 'Mentee Graduate' },
  { id: 'com_hackathon_entrant', name: 'Hackathon Contender', description: 'Submit a project to an official community hackathon.', category: 'community' },
  { id: 'com_hackathon_podium', name: 'Hackathon Laureate', description: 'Win 1st, 2nd, or 3rd place in a community hackathon.', category: 'community', titleUnlocked: 'Hackathon Laureate' },
  { id: 'com_streak_7', name: 'Weekly Habit', description: 'Maintain a 7-day activity streak in the server.', category: 'community' },
  { id: 'com_streak_30', name: 'Iron Discipline', description: 'Maintain an uninterrupted 30-day activity streak.', category: 'community', titleUnlocked: 'Streak Champion' },
  { id: 'com_streak_100', name: 'Centurion of Consistency', description: 'Reach a 100-day daily task or chat streak.', category: 'community', titleUnlocked: 'Centurion' },
  { id: 'com_ama_speaker', name: 'Spotlight Speaker', description: 'Host or speak at a community AMA session.', category: 'community', titleUnlocked: 'Featured Speaker' },
  { id: 'com_resource_sharer', name: 'Knowledge Curator', description: 'Contribute 3 approved high-quality resources to the library.', category: 'community' },
  { id: 'com_pair_coder', name: 'Collaborative Mind', description: 'Complete a live pair-programming session.', category: 'community' },

  // Moderation & Governance (8)
  { id: 'mod_report_verified', name: 'Civic Duty', description: 'Submit a verified scam or rule-violation report.', category: 'moderation' },
  { id: 'mod_ticket_closed', name: 'Support Pillar', description: 'Staff member who successfully resolves 10 support tickets.', category: 'moderation', titleUnlocked: 'Support Specialist' },
  { id: 'mod_clean_record_6m', name: 'Model Citizen', description: 'Maintain 6 continuous months in the server without warnings or mutes.', category: 'moderation', titleUnlocked: 'Model Citizen' },
  { id: 'mod_appeal_successful', name: 'Redemption Arc', description: 'Successfully appeal an automated warning with evidence.', category: 'moderation' },
  { id: 'mod_scam_detector', name: 'Trap Springer', description: 'Report an unsolicited DM scam attempt to server staff.', category: 'moderation' },
  { id: 'mod_staff_mvp', name: 'Guardian of the Realm', description: 'Awarded to top performing staff member of the month.', category: 'moderation', titleUnlocked: 'Grand Guardian' },
  { id: 'mod_ai_feedback', name: 'Tuning Assistant', description: 'Provide helpful thumbs-up/down feedback to improve bot accuracy.', category: 'moderation' },
  { id: 'mod_hall_of_fame_staff', name: 'Staff Legend', description: 'Inducted into the Community Hall of Fame for outstanding service.', category: 'moderation', titleUnlocked: 'Living Legend' },

  // Secret / Easter Eggs (6)
  { id: 'sec_night_owl', name: 'Cairo Midnight Oil', description: 'Submit a clean code PR at exactly 03:00 AM Cairo time.', category: 'secret', titleUnlocked: 'Night Owl', isHidden: true },
  { id: 'sec_konami_code', name: 'Easter Egg Hunter', description: 'Trigger an undisclosed retro easter egg command.', category: 'secret', titleUnlocked: 'Easter Egg Hunter', isHidden: true },
  { id: 'sec_progg_whisperer', name: 'Senior Progg Friend', description: 'Have a 20-message technical dialogue with Senior Progg in Egyptian Arabic.', category: 'secret', titleUnlocked: 'Progg Whisperer', isHidden: true },
  { id: 'sec_perfect_quiz', name: 'Brainiac', description: 'Score 100% on a workshop live quiz on the first try.', category: 'secret', isHidden: true },
  { id: 'sec_escrow_speedrun', name: 'Escrow Speedrun', description: 'Sign, fund, deliver, and release a project in under 60 minutes.', category: 'secret', isHidden: true },
  { id: 'sec_all_rounder', name: 'The Renaissance Dev', description: 'Unlock at least 5 achievements in Coding, Design, AND Freelancing.', category: 'secret', titleUnlocked: 'Renaissance Master', isHidden: true },
];

export class AchievementEngineService {
  /**
   * Retrieves all achievements catalog, optionally filtered.
   */
  public listAchievements(category?: string, showHidden = false): AchievementDefinition[] {
    let list = ALL_ACHIEVEMENTS;
    if (category) {
      list = list.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }
    if (!showHidden) {
      list = list.filter(a => !a.isHidden);
    }
    return list;
  }

  /**
   * Unlocks an achievement for a user if not already earned.
   */
  public unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string
  ): { newlyUnlocked: boolean; achievement?: AchievementDefinition } {
    const ach = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!ach) return { newlyUnlocked: false };

    const existing = dbService.get<{ achievement_id: string }>(
      `SELECT achievement_id FROM achievements WHERE user_id = ? AND guild_id = ? AND achievement_id = ?`,
      userId,
      guildId,
      achievementId
    );

    if (existing) {
      return { newlyUnlocked: false, achievement: ach };
    }

    const now = Date.now();

    dbService.run(
      `INSERT INTO achievements (user_id, guild_id, achievement_id, title_unlocked, unlocked_at)
       VALUES (?, ?, ?, ?, ?)`,
      userId,
      guildId,
      achievementId,
      ach.titleUnlocked || null,
      now
    );

    // If there is a title or badge, grant badge record too
    dbService.run(
      `INSERT INTO member_badges (id, user_id, guild_id, badge_id, badge_name, granted_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      cryptoRandomUUID(),
      userId,
      guildId,
      `badge_${ach.id}`,
      ach.name,
      now
    );

    logger.info(`[AchievementEngine] User ${userId} unlocked achievement: "${ach.name}" (${ach.titleUnlocked || 'No title'})`);

    return { newlyUnlocked: true, achievement: ach };
  }

  /**
   * Returns all achievements unlocked by a user.
   */
  public getUserAchievements(userId: string, guildId: string): Array<AchievementDefinition & { unlockedAt: number }> {
    const unlockedRows = dbService.all<{ achievement_id: string; unlocked_at: number }>(
      `SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ? AND guild_id = ?`,
      userId,
      guildId
    );

    const unlockedMap = new Map<string, number>();
    unlockedRows.forEach(r => unlockedMap.set(r.achievement_id, r.unlocked_at));

    return ALL_ACHIEVEMENTS
      .filter(a => unlockedMap.has(a.id))
      .map(a => ({
        ...a,
        unlockedAt: unlockedMap.get(a.id)!,
      }));
  }
}

export const achievementEngineService = new AchievementEngineService();
