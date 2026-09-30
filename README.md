# Senior Progg (سينيور بروج)

> **Production-grade, fully autonomous, AI-driven Discord server-management and community architect bot for freelancer ecosystems (programming + design), paired with a Telegram companion bot, an owner web dashboard, and a central AI brain.**
> 
> *Bilingual by design: Authentic Egyptian Arabic (casual, tech slang: "يا باشا", "كود نظيف", "تسليم على مية بيضا") and Professional English, automatically detected per user.*

---

## 🏛️ System Architecture

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │               Senior Progg AI Orchestrator             │
                                    │    (Gemini 2.5 Flash / OpenAI GPT-4o / Claude 3.5)    │
                                    │    • Circuit Breaker Failover • RAG Knowledge Base     │
                                    │    • Safety Shield & Anti-Prompt-Injection             │
                                    └───────────────────────────┬────────────────────────────┘
                                                                │
                    ┌───────────────────────────────────────────┼───────────────────────────────────────────┐
                    │                                           │                                           │
                    ▼                                           ▼                                           ▼
       ┌─────────────────────────┐                 ┌─────────────────────────┐                 ┌─────────────────────────┐
       │       Discord Bot       │                 │  Telegram Companion Bot │                 │   Owner Web Dashboard   │
       │    (Discord.js v14)     │                 │      (grammY v1)        │                 │    (Express + SSE)      │
       ├─────────────────────────┤                 ├─────────────────────────┤                 ├─────────────────────────┤
       │ • Onboarding & Vetting  │                 │ • Off-platform work sync│                 │ • Discord OAuth2 Login  │
       │ • Live Skill Sandbox    │                 │ • Consent-gated archive │                 │ • RTL/LTR Dual Support  │
       │ • 48 Freelancer Modules │                 │ • SHA-256 deduplication │                 │ • Real-time Live Feed   │
       │ • Non-Custodial Escrow  │                 │ • Channel broadcasts    │                 │ • Visual Config & AI    │
       │ • 195 Perks & Economy   │                 │                         │                 │ • Escrow Dispute Admin  │
       └────────────┬────────────┘                 └────────────┬────────────┘                 └────────────┬────────────┘
                    │                                           │                                           │
                    └───────────────────────────────────────────┼───────────────────────────────────────────┘
                                                                │
                                                                ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │               SQLite Persistence Layer                 │
                                    │                (Node.js 22 DatabaseSync)               │
                                    │  • Guild Configs  • Members & Profiles  • Credit Ledger│
                                    │  • Escrow Deals   • 195 Perk Catalog    • Audit Logs   │
                                    └────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: `v22.0.0+` (utilizes native built-in `node:sqlite` for high-performance zero-dependency database access).
- **npm**: `v10+`.
- **Docker & Docker Compose** (optional for containerized deployment).

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/senior-progg-bot.git
cd senior-progg-bot
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Key environment variables:
| Variable | Description | Default / Example |
|---|---|---|
| `DISCORD_TOKEN` | Discord Bot Token from Developer Portal | `your_bot_token` |
| `DISCORD_CLIENT_ID` | Discord Application Client ID | `123456789012345678` |
| `DISCORD_CLIENT_SECRET` | Discord Application Secret (for Dashboard OAuth2) | `your_client_secret` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token from @BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_BACKUP_CHANNEL_ID` | Target Telegram channel/group ID for backups | `-1001234567890` |
| `LLM_PROVIDER` | Primary AI provider (`gemini`, `openai`, `anthropic`, `mock`) | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `DATABASE_URL` | SQLite database file location | `data/senior_progg.db` |
| `PORT` | Owner Dashboard HTTP server port | `3000` |

### 3. Build & Run Locally
```bash
# Build TypeScript
npm run build

# Start bot, dashboard, and background workers
npm start

# Run full automated test suite (22 suites, 147 tests)
npm test
```

### 4. Run with Docker Compose
```bash
# Build container and start in background with persistent SQLite volume
docker-compose up -d --build

# View real-time logs
docker-compose logs -f
```

---

## 🤖 Discord Application Setup & Permissions

### Required Gateway Intents
In the [Discord Developer Portal](https://discord.com/developers/applications):
1. Navigate to **Bot** -> **Privileged Gateway Intents**.
2. Enable:
   - ✅ **Server Members Intent** (`GuildMembers`): For onboarding, seniority roles, and lifecycle monitoring.
   - ✅ **Message Content Intent** (`MessageContent`): For AI code reviews, auto-replies, and spam detection.
   - ✅ **Presence Intent** (optional, recommended for Pomodoro focus and voice activity).

### Required Bot Permissions Bitfield
When inviting the bot to your guild, grant integer permissions `534723950656` (Administrator or granular permissions):
- `Manage Channels` (Creates `#verify-<user>`, `#escrow-<deal>`, and category rooms)
- `Manage Roles` (Assigns `Larper`, `Verified Freelancer`, and Seniority Roles)
- `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Add Reactions`
- `Manage Messages` (Enforces quiet hours, deletes credential leaks and phishing links)
- `Read Message History`

### Automated Server Setup (`/setup`)
Once the bot joins your server, simply run:
```
/setup language:العربية
```
The automated setup wizard will:
1. Provision all recommended categories and channels:
   - `📌-welcome-and-rules`
   - `🎨-portfolio-showcase`
   - `💡-tech-and-design-help`
   - `📚-recorded-courses`
   - `🎪-community-events`
   - `🤝-escrow-deals`
   - `🛡️-staff-review`
   - `📜-audit-logs`
2. Configure all needed security and vanity roles (`Larper (Restricted)`, `Verified Freelancer`, `Verified Middleman`, `Staff Moderator`).
3. Store channel/role bindings in `guild_configs`.
4. Issue a direct, pre-authenticated link to your **Owner Web Dashboard**.

---

## 🌐 Owner Web Dashboard

The web dashboard is an Egyptian-themed, responsive Single-Page Application (SPA) designed exclusively for server owners and administrators:
- **Direct Local URL**: `http://localhost:3000`
- **Authentication**: Discord OAuth2 with pre-authenticated secret seed token fallback.
- **Bilingual Interface**: Seamless 1-click toggle between **Arabic (RTL)** and **English (LTR)**.
- **Key Views**:
  - 📊 **Overview KPI Metrics**: Live member counts, circulating server credits, active escrow deals, and weekly community health scores.
  - 👥 **Member Directory**: Search members, inspect full verification transcripts, manually override seniority roles, freeze suspicious accounts, or grant/deduct credits.
  - 🤝 **Escrow Management**: Inspect all active and closed escrow deals, review open disputes, and execute owner emergency override releases.
  - 🧠 **AI Brain Control Panel**: Live temperature and persona adjustment, and a real-time prompt testing console with instant explainability breakdown.
  - ⚡ **Real-Time Live SSE Stream**: Live server activity feed of joins, task submissions, escrow updates, and moderation warnings.

---

## 💼 48 Freelancer Add-On Modules

Senior Progg includes 48 dedicated modules spanning 7 core freelancer operational categories:

### Category A: Jobs & Clients (Modules 1-6)
- **1. Job Board (`jobBoard.ts`)**: Structured job postings with auto-formatting and expiration.
- **2. Smart Job Matching (`jobMatcher.ts`)**: Alerts opted-in freelancers based on skills and seniority.
- **3. Client Verification & Scam Shield (`clientVerification.ts`)**: Filters unpaid tests and off-platform coercion.
- **4. Proposal Coach (`proposalCoach.ts`)**: AI rewrite of bids for clarity and winning value proposition.
- **5. Client Red-Flag Checker (`clientChecker.ts`)**: Scans client briefs for scope creep and ambiguous milestones.
- **6. Direct Hire Requests (`hireRequests.ts`)**: Private 1-on-1 client hiring invites without public chatter.

### Category B: Portfolio & Reputation (Modules 7-12)
- **7. Portfolio Gallery (`portfolioGallery.ts`)**: Rich showcase embeds with tags and asset attachments.
- **8. Portfolio Review Queue (`portfolioReviewQueue.ts`)**: Structured peer and AI feedback scoring rubric.
- **9. Transparent Reputation Formula (`reputationCalculator.ts`)**: Multi-factor scoring (deals, tasks, endorsements).
- **10. Skill Endorsements (`endorsementEngine.ts`)**: Peer endorsements with circular ring detection.
- **11. Badges & Milestones (`milestoneTracker.ts`)**: Automated badge awards for streaks and verified work.
- **12. Case Study Generator (`caseStudyGenerator.ts`)**: Formats project notes into a portfolio case study.

### Category C: Business Tools (Modules 13-20)
- **13. Rate Calculator (`rateCalculator.ts`)**: Hourly & fixed rates calibrated for Egypt, MENA, and Global markets.
- **14. Invoice Template Generator (`invoiceGenerator.ts`)**: Professional printable quotes and invoices with legal disclaimers.
- **15. Scope of Work Builder (`sowBuilder.ts`)**: Formats deliverables, acceptance criteria, and revision caps.
- **16. Contract Clause Explainer (`clauseExplainer.ts`)**: Explains IP assignment, kill fees, and indemnification in Egyptian Arabic.
- **17. Project Time Tracker (`timeTracker.ts`)**: `/track start`, `/track stop`, and weekly productivity breakdowns.
- **18. Payment Reminders (`paymentReminders.ts`)**: Friendly, professional reminder templates for overdue invoices.
- **19. Earnings Dashboard (`earningsTracker.ts`)**: Monthly income tracking and visual progress toward earnings goals.
- **20. Freelance Tax Reference (`taxGuide.ts`)**: Informational guidance on Egyptian banking and freelance compliance.

### Category D: Learning & Growth (Modules 21-28)
- **21. Skill Roadmaps (`skillRoadmaps.ts`)**: Step-by-step tracks for Frontend, Backend, UI/UX, and Mobile.
- **22. Mock Client Negotiation (`clientSimulator.ts`)**: Tough client AI roleplay to practice pricing and boundaries.
- **23. Mock Technical Interview (`interviewSimulator.ts`)**: 45-minute live technical simulation with scored rubrics.
- **24. Speed Code Review (`codeReviewEngine.ts`)**: Instant Senior Progg architectural reviews under 60 seconds.
- **25. Design Critique Bot (`designCritique.ts`)**: Visual critique on layout, typography, contrast, and accessibility.
- **26. Weekly Freelance Challenge (`weeklyChallenge.ts`)**: Collaborative challenges with prize credit pools.
- **27. Pair Programming Matcher (`pairMatcher.ts`)**: Pairs designers and developers for collaborative side-projects.
- **28. Curated Resource Vault (`resourceVault.ts`)**: Searchable index of cheatsheets, tools, and UI kits.

### Category E: Community & Collaboration (Modules 29-35)
- **29. Freelancer Squads (`squadEngine.ts`)**: Micro-agencies and squads competing on collaborative leaderboards.
- **30. Community Mini-Hacks (`miniHackathon.ts`)**: 48-hour weekend community hackathons.
- **31. Mentorship Pairing (`mentorPairing.ts`)**: Matches verified veterans with eager junior apprentices.
- **32. Live AMA Session Host (`amaHost.ts`)**: Stage queue manager and question voting for guest speakers.
- **33. Collaboration Board (`collabBoard.ts`)**: Find co-founders, design partners, or backend specialists.
- **34. Daily Accountability Check-in (`accountabilityBot.ts`)**: Morning goal setting and evening check-ins.
- **35. Freelancer Wins Wall (`winsWall.ts`)**: Celebrate client acquisitions, project deliveries, and milestones.

### Category F: Safety, Escrow & Disputes (Modules 36-40)
- **36. Middleman Escrow Broker (`escrowEngine.ts`)**: Multi-step non-custodial milestone broker.
- **37. Dispute Arbitrator (`disputeArbitrator.ts`)**: AI synthesis of deal chat history with staff mediation.
- **38. Scam & Impersonation Alert (`scamDetector.ts`)**: Real-time warning against fake staff and phishing.
- **39. Freelancer Rating & Feedback (`ratingEngine.ts`)**: Two-way verified ratings after completed escrow deals.
- **40. Confidentiality & NDA Helper (`ndaHelper.ts`)**: Standard bilingual mutual NDA and confidentiality agreements.

### Category G: Owner Toolkit (Modules 41-48)
- **41. Visual Configuration Editor (`configEditor.ts`)**: No-code management of bot thresholds and bindings.
- **42. Server Analytics & Growth Metrics (`analyticsDashboard.ts`)**: Conversion funnels, retention, and churn.
- **43. Audit Log Inspector (`auditLogViewer.ts`)**: Chronological ledger of all staff and moderation actions.
- **44. Automated Database Backup (`backupManager.ts`)**: Scheduled encrypted snapshots and restore procedures.
- **45. Automated Announcement Scheduler (`announcementScheduler.ts`)**: Scheduled community news and alerts.
- **46. Role & Permission Manager (`roleManager.ts`)**: Audit role permissions to eliminate dangerous privileges.
- **47. Bot Health & Telemetry (`botHealthMonitor.ts`)**: Latency, memory, token usage, and circuit breaker status.
- **48. AI Moderation & Auto-Mod Assist (`autoModAssist.ts`)**: Credential leak redaction and toxicity detection.

---

## 🤝 Non-Custodial Middleman Escrow System

Senior Progg acts as a trusted **information broker and milestone coordinator** for client-freelancer transactions:
1. **Zero Financial Custody**: Senior Progg and server owners never hold, touch, or process client funds. Deals specify off-platform payment rails (InstaPay, Vodafone Cash, Bank Transfer, PayPal, Crypto).
2. **Deal Lifecycle**:
   - `/deal create` -> Specifies client, freelancer, milestones, amount, currency, and agreement text.
   - Agreement text is hashed using **SHA-256**; deal progresses only when both parties digitally confirm the agreement.
   - A dedicated private channel `#deal-<dealId>` is provisioned for proofs and delivery.
   - Middleman verifies receipt of funds in the external provider, marks milestone approved, and freelancer releases deliverable.
3. **Dispute Resolution Ladder**:
   - Milestone 1: Neutral AI summary synthesizing chat history, missed deadlines, and deliverable quality.
   - Milestone 2: Human Middleman mediation.
   - Milestone 3: Server Owner emergency override release via Discord command or Web Dashboard.

---

## 🎁 Complete 195 Perks Catalog

Every single perk is uniquely implemented, verified in database migrations, and purchasable in the `/shop` via server credits:

### Category 1: XP & Progression Accelerators (Perks 1-25)
| ID | Perk Name | Description | Price | Level |
|---|---|---|---|---|
| `xp_boost_10` | 10% XP Booster (24h) | Boosts all XP earned from tasks and chat by 10% for 24 hours. | 100 | 1 |
| `xp_boost_25` | 25% XP Booster (24h) | Boosts all XP earned by 25% for 24 hours. | 220 | 2 |
| `xp_boost_50` | 50% XP Booster (48h) | Accelerates progression by 50% for 48 hours. | 450 | 3 |
| `xp_boost_100` | Double XP Weekend Pass | 100% XP bonus for a full 48-hour weekend period. | 800 | 5 |
| `streak_freeze_1` | Daily Streak Freeze (1 Day) | Protects daily activity streak from resetting if you miss one day. | 150 | 1 |
| `streak_freeze_3` | Triple Streak Shield | Protects your streak for up to 3 missed days. | 380 | 3 |
| `streak_repair` | Retroactive Streak Restorer | Restores a lost streak if used within 48 hours of expiration. | 500 | 4 |
| `double_task_credits` | Double Daily Task Reward | Doubles credits earned from completing today's daily technical task. | 200 | 2 |
| `task_reroll_token` | Daily Task Reroll Token | Rerolls current daily task for an alternative topic in your domain. | 80 | 1 |
| `triple_task_xp` | Task XP Overdrive | Triples XP earned on the next completed task submission. | 250 | 2 |
| `instant_level_pass` | Fast-Track Progression Pass | Grants 500 XP directly toward the next seniority milestone. | 600 | 3 |
| `squad_xp_share` | Squad XP Multiplier | Grants a 15% XP bonus to all squad members for 12 hours. | 750 | 4 |
| `bonus_milestone_claim` | Milestone Claim Booster | Adds +25% bonus credits when claiming any career milestone. | 400 | 3 |
| `reputation_shield` | Reputation Protection Buffer | Prevents reputation score loss from one dispute or warning. | 900 | 5 |
| `xp_overflow_bank` | XP Overflow Vault | Saves excess XP earned past level cap to be applied next season. | 1100 | 6 |
| `mentor_xp_tether` | Mentorship Synergy Pass | Earn 20% bonus XP when pair coding or reviewing an apprentice. | 350 | 3 |
| `weekly_quest_unlock` | High-Roller Quest Slot | Unlocks a second weekly elite quest with substantial rewards. | 300 | 2 |
| `code_review_xp_double` | Reviewer XP Multiplier | Doubles XP earned from reviewing peer submissions in `#code-review`. | 280 | 2 |
| `first_work_xp_boost` | Portfolio Debut Bonus | Earn +50% XP on your first verified portfolio project. | 320 | 1 |
| `hackathon_xp_pass` | Hackathon Veteran Pass | Grants +30% bonus points in seasonal community hackathons. | 500 | 3 |
| `squad_quest_accelerator` | Squad Task Turbo | Doubles point contributions toward squad leaderboard for 24h. | 650 | 4 |
| `daily_login_multiplier` | Check-in Multiplier | Doubles credit earnings from daily `/checkin` for 7 days. | 420 | 2 |
| `trivia_double_down` | Trivia Double-Down Ticket | Doubles rewards for correct answers during tech trivia events. | 120 | 1 |
| `mastery_badge_xp` | Skill Mastery XP Surge | Grants 1,000 XP upon earning any specialized skill badge. | 850 | 5 |
| `prestige_token_minor` | Season Point Accelerator | Grants a 10% bonus toward seasonal prestige badge progress. | 1000 | 6 |

*(Categories 2 through 8 continue below with all 195 individual perks implemented and purchasable)*

### Category 2: Showcase, Exposure & Badges (Perks 26-55)
`showcase_pin_24h` (Pin in showcase), `showcase_pin_7d` (Week spotlight), `badge_early_adopter`, `badge_clean_coder`, `badge_design_maestro`, `badge_bug_hunter`, `badge_algo_expert`, `badge_sql_wizard`, `badge_ui_virtuoso`, `badge_security_auditor`, `badge_mentor_heart`, `badge_hackathon_champ`, `badge_speedy_builder`, `badge_reliable_freelancer`, `badge_open_source_hero`, `badge_problem_solver`, `badge_squad_mvp`, `badge_top_reviewer`, `badge_streak_legend`, `badge_senior_progg_certified`, `portfolio_header_custom`, `portfolio_card_glow`, `showcase_banner_slot`, `verified_freelancer_flair`, `featured_profile_sidebar`, `custom_badge_slot`, `hall_of_fame_nomination`, `portfolio_pdf_export_watermark`, `spotlight_interview_feature`, `showcase_gallery_embed`.

### Category 3: Personal Cosmetics & Custom Styling (Perks 56-85)
`color_neon_cyan`, `color_gold_luxury`, `color_plasma_orange`, `color_matrix_green`, `color_cyber_pink`, `color_emerald_green`, `color_amethyst_purple`, `color_sunset_orange`, `color_crimson_red`, `color_matte_black`, `color_pure_white`, `color_pastel_lavender`, `color_custom_hex`, `role_vanity_name`, `role_vanity_icon`, `color_gradient_shift`, `color_mint_fresh`, `color_ice_blue`, `color_ruby_glow`, `color_amber_flame`, `color_midnight_navy`, `role_vip_supporter`, `role_alumni`, `color_rose_gold`, `color_titanium`, `color_matrix_green_alt`, `role_tag_custom`.

### Category 4: Priority Help & Queue Skips (Perks 86-110)
`priority_help_pass`, `priority_code_review`, `priority_design_critique`, `pin_question_slot`, `fast_middleman_triage`, `skip_vetting_cooldown`, `priority_job_ping`, `portfolio_spotlight_pass`, `priority_live_stage`, `urgent_ticket_bump`, `priority_mentor_pairing`, `extended_help_thread`, `proposal_fast_review`, `client_check_priority`, `dispute_fast_summary`, `instant_contract_gen`, `exclusive_help_voice`, `code_diff_analysis`, `design_asset_audit`, `priority_ama_question`, `live_review_slot`, `extended_voice_time`, `priority_squad_invite`, `instant_quiz_retry`, `direct_staff_consult`.

### Category 5: Private Review Slots & Mentorship (Perks 111-135)
`private_portfolio_teardown`, `mock_technical_interview`, `mock_behavioral_interview`, `resume_rewrite_session`, `github_audit_pass`, `behance_dribbble_audit`, `architecture_review_slot`, `pricing_strategy_session`, `contract_terms_audit`, `mentor_session_month`, `career_roadmap_consult`, `pitch_deck_review`, `linkedin_headline_pass`, `upwork_profile_audit`, `arabic_english_trans`, `case_study_doctor`, `cold_outreach_coaching`, `pair_prog_senior_progg`, `security_vuln_audit`, `ui_accessibility_audit`, `performance_profiling`, `database_query_tuning`, `api_design_critique`, `junior_to_mid_eval`, `mid_to_senior_eval`.

### Category 6: Resource Library & Premium Unlocks (Perks 136-160)
`resource_contract_bundle`, `resource_invoice_templates`, `resource_figma_starter_kit`, `resource_design_pattern_ebook`, `resource_freelance_pricing_guide`, `resource_proposal_vault`, `resource_clean_code_cheatsheet`, `resource_docker_k8s_recipes`, `resource_seo_checklist`, `resource_scope_creep_defense`, `resource_arabic_typography`, `resource_backend_roadmap`, `resource_frontend_roadmap`, `resource_uiux_heuristics`, `resource_interview_questions_500`, `resource_freelance_tax_sheet`, `resource_tailwind_cheatsheet`, `resource_database_migration_kit`, `resource_prompt_eng_pack`, `resource_git_disaster_recovery`, `resource_cold_pitch_templates`, `resource_app_security_checklist`, `resource_color_palette_vault`, `resource_client_onboarding_form`, `resource_recorded_masterclass`.

### Category 7: Community Privileges & Custom Slots (Perks 161-180)
`slot_custom_emoji`, `slot_custom_sticker`, `slot_custom_sound`, `privilege_nickname_change`, `privilege_thread_creator`, `privilege_external_emojis`, `privilege_embed_links`, `privilege_attach_files`, `privilege_voice_stage_speaker`, `privilege_channel_topic`, `privilege_poll_creator`, `privilege_quote_poster`, `privilege_custom_command`, `privilege_hall_of_fame`, `privilege_create_squad`, `privilege_squad_channel`, `privilege_squad_voice`, `privilege_custom_bot_reaction`, `privilege_banter_immunity`, `privilege_banter_roast_me`.

### Category 8: Event & Tournament Perks (Perks 181-195)
`event_early_hackathon`, `event_vip_seat`, `event_team_captain`, `event_judge_vote`, `event_custom_jam`, `event_showcase_shoutout`, `event_ama_host_assistant`, `event_ticket_raffle_2x`, `event_pair_swap_leader`, `event_trophy_case`, `event_season_pass_gold`, `event_exclusive_swag_roll`, `event_alumni_network`, `event_founder_circle`, `event_immortal_legend`.

---

## 📖 Section A: Member Usage Guide

### 1. Onboarding & Vetting
- When joining the server, Senior Progg greets you in `#welcome` and provisions a private thread `#verify-<username>`.
- The bot conducts an adaptive technical interview in your chosen language (Egyptian Arabic or English).
- If claiming 3+ years experience, a 30-minute sandbox coding test is generated with automated rubric grading.
- Upon passing, you receive verified member status and seniority roles (`Junior`, `Mid`, `Senior`).

### 2. Earning & Spending Server Credits
- **Earn**:
  - Complete AI-generated daily tasks (`/tasks`).
  - Answer technical queries in `#help`.
  - Successfully complete escrow deals without disputes.
  - Invite fellow developers (`/referral`).
- **Spend**:
  - Open the interactive shop: `/shop`.
  - Filter perks by category or max price: `/shop category:cosmetics`.
  - Purchase items instantly: `/buy perk_id:xp_boost_25`.

### 3. Freelancing & Escrows
- **Find Jobs**: View listings in `#job-board` or get DM matching alerts.
- **Coach Your Bid**: Submit a draft proposal via `/coach-proposal` for AI optimization.
- **Escrow Transactions**: Create a deal via `/deal create` specifying terms and milestone amounts.
- **Data Privacy**: Export all your stored data anytime with `/mydata export` or request permanent deletion with `/mydata delete`.

---

## 🛠️ Section B: Owner Customization Guide

### 1. Server Configuration Panel
Owners and administrators can configure all runtime parameters via Discord command or the Web Dashboard:
- Adjust suspicion threshold (e.g. from 0.65 to 0.75).
- Configure quiet hours (e.g., suppress all event pings between 22:00 and 06:00 UTC).
- Calibrate AI Egyptian slang intensity (`mild`, `medium`, `full_baladi`).
- Set anti-raid auto-lockdown thresholds.

### 2. Dispute Resolution Protocol
When a client or freelancer files a dispute (`/dispute`):
1. Senior Progg automatically compiles an **AI Briefing Card** summarizing chat agreements, deliverables, and timestamps.
2. An assigned Middleman facilitates mutual agreement.
3. If deadlocked, the server owner can review evidence on the Web Dashboard and trigger an emergency override payout to either party with full audit logging.

---

## 🌐 Section 21: Supply/Demand Intelligence & Disclosed Community Outreach Engine

### 1. Architectural Philosophy: Help First & Radical Transparency
Nexus is a community for every freelancer and client who values competence, learning, and belonging. Rather than relying on cold advertisements or uninvited messages, the Nexus Outreach Engine monitors where server skill supply falls short of demand, finds real public threads with unsolved technical problems, provides genuine, stand-alone solutions, and invites authors to Nexus within strict platform rules.

### 2. Non-Negotiable Hard-Coded Guardrails (`rulesGuard.ts`)
1. **100% Mandatory Disclosure**: Every outbound draft enforces the disclosure line:
   - *English*: `"I'm the Nexus community helper, an AI-assisted account run by our team."`
   - *Casual Egyptian Arabic*: `"أنا المساعد الذكي لمجتمع Nexus، حساب مدعوم بالذكاء الاصطناعي يُدار بواسطة فريقنا."`
2. **Official Single Account per Platform**: Only authorized handles (`u/NexusCommunityHelper`, `nexus-community-helper`, `nexus_helper`) may publish.
3. **Facebook Manual-Only Submission**: Automated scraping of Facebook groups is strictly blocked; only manual ambassador submissions or written admin permissions are ingested.
4. **Human Ambassador Approval Gate**: Zero automated publishing without explicit Community Ambassador sign-off in Discord or the Web Dashboard.
5. **Help-First Stand-Alone Value**: Solutions must be completely helpful on their own even if the recipient never clicks the invite.
6. **Zero Unsolicited DMs**: All interactions occur in public threads. DMs are only allowed if explicitly initiated by the user.
7. **Permanent Stoplist**: Immediate and permanent stoplist addition on hostility, opt-out requests, or moderator signals.
8. **Privacy Data Minimization**: Post URL, summary, and category are stored; zero personal profiling data is retained.
9. **Emergency Kill Switch**: Instant toggle halts all discovery, drafting, and queueing across the entire system.

### 3. Supply & Demand Gap Calculation (`supplyDemandEngine.ts`)
- **10 Core Categories**: `web_dev`, `mobile_dev`, `bots_automation`, `ui_ux`, `graphic_design`, `video_editing`, `motion_graphics`, `copywriting`, `translation`, `data_ai`.
- **Demand Index**: Weighted signals from open `/jobs`, deal volumes, external skill test requests, and unfulfilled client search queries.
- **Effective Supply**: Verified active members with relevant skill tags, available capacity, and response speed.
- **Weekly Gap Score**: $\text{Gap Score} = \frac{\text{Demand Index}}{\text{Effective Supply}} \times \text{Seasonality Weight}$.
- **Proactive Alerts**: Triggers warnings to server staff when Gap Score crosses $\ge 1.8$ or spikes rapidly.

### 4. 4-Part Reply Architecture (`replyComposer.ts`)
- **Part 1: Greeting + Disclosure**: Warm, conversational greeting in the author's language with the mandatory AI disclosure line.
- **Part 2: Verified Solution**: Complete technical breakdown. For programming, Node.js code snippets must pass execution tests in `codeSandbox.ts`; unverified code is tagged `[UNTESTED SNIPPET]`.
- **Part 3: About Nexus**: Concise description of relevant server channels and peer reviews (**strictly omitted** if the source forbids promotion).
- **Part 4: Tracked Link + Onboarding Intro**: Unique invite URL (`https://discord.gg/nexus?src=campaign_code`) with guidance on onboarding (**strictly omitted** if links or promo are forbidden).

---

## 📋 Section C: Outreach Owner Operations Guide

### 1. Review Queue Workflow (`#outreach-review` & Dashboard)
Community Ambassadors and server owners review all prospective outbound posts in Discord `#outreach-review` or via `/api/outreach/reviews`:
- **Approve**: Validates rate limits and publishes the verified reply.
- **Edit**: Allows fine-tuning phrasing while cryptographically verifying the mandatory disclosure line is retained. Edits are recorded into the learning dataset.
- **Reject**: Dismisses the candidate with a logged rationale (e.g., "Already answered by OP").
- **Mark Do-Not-Post**: Rejects the post and adds the entire subreddit/community to the permanent stoplist.

### 2. Emergency Kill Switch Controls
- **Via Web Dashboard**: Toggle `POST /api/outreach/kill-switch` with `{ "active": true, "reason": "Audit" }`.
- **Instant Behavior**: Halts all scheduled tasks, clears active outbound queues, and blocks any manual publish attempts with an explanatory audit log.

### 3. Moderator Communication Protocol & Auto-Pause
- When a moderator issues a warning or removes a comment, `attributionFunnelService.handleModeratorSignal` immediately auto-pauses all outreach to that community.
- The server owner is immediately alerted in `#staff-alerts`.
- Outreach to that community remains locked until the owner conducts dialogue with the moderation team and manually unpauses the community rule profile.

### 4. REST API Reference for Outreach Dashboard
- `GET /api/outreach/gaps`: Visual gap heatmap and active alerts across all 10 categories.
- `GET /api/outreach/reviews`: Pending items in the human review queue.
- `POST /api/outreach/reviews/:id/approve`: Approve and dispatch post.
- `POST /api/outreach/reviews/:id/edit`: Edit text, verify disclosure, and dispatch post.
- `POST /api/outreach/reviews/:id/reject`: Reject review item.
- `POST /api/outreach/reviews/:id/do-not-post`: Mark community as do-not-post and stoplist.
- `GET /api/outreach/stats`: Real-time funnel metrics (Clicks, Joins, Verified, 30d Active).
- `GET /api/outreach/report`: Weekly intelligence digest in English and Casual Egyptian Arabic.
- `GET /api/outreach/stoplist`: Inspect all stoplisted users and communities.

---

## 🛡️ Section D: Lead Staging & Client Confirmation Pipeline (Section 22)

The Nexus Lead Staging Pipeline manages incoming prospective clients who engage through official Meta channels (Facebook Page Messenger, Page Comments, Lead Ads, Web Forms). The architecture ensures that prospective customer data is held strictly in temporary, encrypted quarantine until either explicit confirmation evidence promotes them to the permanent client registry or scheduled purge jobs permanently wipe the records.

```
                           [Inbound Meta Channel]
                      (Messenger / Comment / Lead Ad)
                                    │
                                    ▼
                ┌────────────────────────────────────────┐
                │        LeadRulesGuard & Redactor       │
                │  - Lawful Source Verification          │
                │  - Luhn Payment Card Masking           │
                │  - Password & Gov ID Masking           │
                │  - Initial Transparency Notice Sent    │
                └───────────────────┬────────────────────┘
                                    │
                                    ▼
                ┌────────────────────────────────────────┐
                │          lead_staging (Encrypted)      │
                │  - AES-256-GCM Authenticated Enc       │
                │  - Salted HMAC SHA-256 Dedup Index     │
                │  - Configurable TTL (7 to 90 Days)     │
                │  - Max 2 Follow-Ups (24-Hr Window)     │
                │  - Single Extension (Hard 90d Max)     │
                └───────┬────────────────────────┬───────┘
                        │                        │
         [Confirmation Evidence]       [Expiry / Decline / "DELETE"]
         (Deal / Contract / Pay)                 │
                        │                        ▼
                        ▼             ┌─────────────────────┐
             ┌─────────────────────┐  │   LeadPurgeEngine   │
             │ LeadPromotionService│  │ - Hourly Hard Wipe  │
             │ - Atomic Copy/Delete│  │ - 0-Leftover Verif  │
             │ - Raw Chats Excluded│  │ - 24-Hr Deletion Res│
             └──────────┬──────────┘  └─────────────────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │   client_registry   │
             │ (Permanent Storage) │
             └─────────────────────┘
```

### 1. Two Physically Separate Stores (`lead_staging` vs `client_registry`)
- **`lead_staging`**: Zero foreign keys into permanent tables. Encrypted with dedicated staging key. Rows enforce strict row-level TTL expiration.
- **`client_registry`**: Permanent store populated exclusively via atomic transactions with verifiable evidence. Raw chat transcripts are excluded by default.

### 2. Non-Negotiable Hard-Coded Safeguards (`leadRulesGuard.ts` & `leadRedactor.ts`)
1. **Lawful Sources Only**: Only official Meta webhooks (`page_messenger`, `page_comment`, `lead_ad`, `web_form`, `manual_entry`). Group scraping or profile harvesting is blocked by hard policy.
2. **Sensitive Data Redaction**: Automatic Luhn algorithm validation masks credit card numbers to `[PAYMENT_CARD_REDACTED]`. Passwords and Egyptian National IDs / SSNs are masked with security warnings returned to the sender.
3. **Initial Transparency Notice**: First reply provides a clear privacy notice in English or Egyptian Arabic detailing the temporary retention window and the right to reply "DELETE" at any time.
4. **Time-Boxed Retention with Hard 90-Day Ceiling**: Staging records expire after a default 30 days (configurable between 7 and 90 days). Single extension allowed, strictly capped at a hard maximum of 90 days from lead creation.
5. **Rights on Request**: Incoming triggers ("delete", "stop", "unsubscribe", "امسح", "احذف", "مش عايز") initiate immediate hard deletion across all stores within 24 hours.
6. **Meta 24-Hour Messaging Window**: Outbound messages and follow-ups are restricted to the 24-hour window following user interaction, capped at a maximum of 2 follow-ups.

### 3. Confirmed Client Criteria (`confirmationRules.ts`)
Promotion requires verified proof of at least one of four conditions:
1. **Middleman Deal Confirmed**: Completed or active deal reference in Nexus Escrow (Section 12).
2. **Signed Agreement / Quote**: Document reference or formal quote acceptance on file.
3. **Payment Confirmed**: Verified escrow transaction ID signed off by an approved Middleman.
4. **Explicit Consent**: Logged affirmative opt-in consent ("yes, keep my details", "نعم احفظ بياناتي").
*Autonomous AI cannot promote leads unless auto-promotion is explicitly enabled by the owner for conditions 1 and 3.*

---

## 📋 Section E: Lead Staging Owner Operations Guide & Runbooks

### 1. Runbook 1: Purge Failure Investigation & Zero-Leftover Recovery
**Trigger**: Hourly purge job returns `verifiedClean: false` or `leftoverCount > 0` in application alerts.
1. **Access Audit Ledger**: Navigate to Web Dashboard `/api/leads/audit` or query:
   ```sql
   SELECT * FROM lead_audit_ledger WHERE event_type LIKE '%PURGE%' ORDER BY timestamp DESC LIMIT 20;
   ```
2. **Identify Lingering Rows**: Run verification query to pinpoint stuck rows:
   ```sql
   SELECT id, state, expires_at, declined_at FROM lead_staging
   WHERE expires_at <= unixepoch('now') * 1000
      OR (state = 'DECLINED' AND declined_at <= (unixepoch('now') - 7*86400) * 1000)
      OR state = 'DELETED_ON_REQUEST';
   ```
3. **Inspect Derived Artifacts**:
   ```sql
   SELECT * FROM lead_derived_artifacts WHERE lead_id NOT IN (SELECT id FROM lead_staging);
   ```
4. **Execute Forced Manual Purge**: Send POST request to `/api/leads/purge` with Owner Bearer Token.
5. **Verify Clean Slate**: Ensure `leftoverCount: 0` and `verifiedClean: true`.

### 2. Runbook 2: Suspected Data Leak or Breach Protocol
**Trigger**: Suspected credential leak or unauthorized access to staging environment.
1. **Trigger Immediate Purge**: Wipe all staging data immediately via Owner command or script:
   ```ts
   await leadPurgeEngine.executePurge();
   ```
2. **Review Access Ledger**: Check all read and DSAR export events:
   ```sql
   SELECT * FROM lead_audit_ledger WHERE event_type IN ('DSAR_EXPORT_GENERATED', 'PROMOTED') ORDER BY timestamp DESC;
   ```
3. **Rotate Master Encryption Secret**: Follow Runbook 3 immediately to invalidate old keys.
4. **Revoke Meta Webhook Tokens**: Regenerate `META_APP_SECRET` and update `meta_verify_token` in `lead_staging_config`.

### 3. Runbook 3: Cryptographic Key Rotation Runbook
**Purpose**: Rotate AES-256-GCM encryption secrets without corrupting historical records.
1. **Generate New 32-Byte Secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Execute Re-Encryption Pipeline**:
   ```ts
   import { leadCrypto } from './src/modules/leads/leadCrypto.js';
   // Decrypts records with old key and re-encrypts with new key:
   const rotated = leadCrypto.rotateCiphertext(oldCipher, oldKeySecret, newKeySecret);
   ```
3. **Update Staging Key**: Call `leadCrypto.setStagingKey(newKeySecret)` and update `SESSION_SECRET` in `.env`.
4. **Run Unit Tests**: Validate integrity with `npx vitest run tests/unit/leadStaging.test.ts`.

### 4. Runbook 4: Meta App Permissions & Webhook Verification Setup
1. **Meta Developer App Setup**:
   - Create App in Meta Developer Portal -> Add Messenger and Webhooks products.
   - Configure Webhook Callback URL: `https://your-domain.com/api/leads/meta-webhook`.
   - Set Verification Token to match `meta_verify_token` in `lead_staging_config`.
2. **Configure App Secret & Signature Verification**:
   - Copy Meta App Secret into `.env` as `META_APP_SECRET`.
   - The bot verifies every inbound event via HMAC SHA-256 `X-Hub-Signature-256`.
3. **Data Deletion Callback Compliance (GDPR/Meta Policy)**:
   - In Meta App Dashboard -> Basic Settings -> User Data Deletion:
   - Select **Data Deletion Request URL**: `https://your-domain.com/api/leads/meta-deletion-callback`.
   - Meta will send deletion notifications and verify the return URL containing `confirmation_code`.

### 5. Lead Dashboard REST API Reference (`/api/leads/*`)
- `GET /api/leads/pipeline`: Real-time pipeline counts, age distribution (<7d, 7-14d, 14-30d, >30d), and impending expirations.
- `GET /api/leads/staging`: Filterable and paginated staged leads list with decrypted display names.
- `GET /api/leads/:id`: Full details of a staged lead.
- `POST /api/leads/:id/promote`: Promote lead with evidence (`middleman_deal`, `signed_agreement`, `payment_confirmed`, `explicit_consent`).
- `POST /api/leads/:id/decline`: Transition lead to `DECLINED` with reason.
- `POST /api/leads/:id/extend`: Extend TTL once by additional days (enforces 90-day hard ceiling).
- `POST /api/leads/:id/follow-up`: Send follow-up (enforces Meta 24-hr window and max 2 cap).
- `DELETE /api/leads/:id`: Manual deletion request (right to be forgotten).
- `GET /api/leads/:id/dsar`: Single-lead Data Subject Access Request (DSAR) export package.
- `POST /api/leads/purge`: Manual trigger for hourly purge cycle.
- `GET /api/leads/audit`: Immutable audit log query.
- `GET /api/leads/config` & `POST /api/leads/config`: Lead staging parameters and TTL limits.
- `GET /api/leads/meta-webhook`: Meta challenge verification.
- `POST /api/leads/meta-webhook`: Meta event receiver.
- `POST /api/leads/meta-deletion-callback`: Meta data deletion compliance callback.
- `GET /api/leads/meta-deletion-status/:code`: Meta data deletion status confirmation.

---

---

## 🏢 Section 23: Thirty Chapters Commercial Operating Platform

Nexus has evolved from a standalone Discord community bot into a commercial-grade, multi-tenant community operating platform.

### 1. Commercial Pricing Tiers & Entitlements
| Tier | Price | Active Members | AI Calls / Month | Cloud Storage | Rate Limit | Key Features |
|---|---|---|---|---|---|---|
| **Free** | $0/mo | 150 | 250 | 500 MB | 60 req/min | Core moderation, member matching, basic perks |
| **Pro** | $49/mo | 1,000 | 10,000 | 5 GB | 300 req/min | Custom branding, webhooks, priority support |
| **Business** | $199/mo | 5,000 | 50,000 | 25 GB | 1,200 req/min | White-label, plugin runtime, custom domain, no "Powered by Nexus" |
| **Enterprise** | $799/mo | 25,000 | 250,000 | 100 GB | 6,000 req/min | SAML/SSO, SCIM, CMEK encryption, data residency (MENA), custom SLAs |

*Metered overages: $0.005 per extra AI request, $0.10 per extra GB cloud storage.*

### 2. Thirty Chapters Matrix Overview
- **Wave 1 Foundations**:
  - Chapter 1: Multi-Tenant Architecture & Sales Sandbox Demo Seeder (`src/modules/platform/tenantManager.ts`)
  - Chapter 2: Subscriptions, Plans & Usage Billing with Stripe Webhook idempotency (`src/modules/billing/subscriptionEngine.ts`)
  - Chapter 5: Visual Workflow Automation Builder with Dry-Run Simulator & Loop Guard (`src/modules/automation/workflowEngine.ts`)
  - Chapter 6: Public REST API, Outbound Webhooks with HMAC signing & TypeScript SDK (`src/modules/api/publicApi.ts`)
  - Chapter 7: "Ask Nexus" Command Center with 1-Hour Reversible Undo (`src/modules/intelligence/askNexus.ts`)
  - Chapter 24: Nexus Brain Community Knowledge Engine with Permission-Aware Retrieval (`src/modules/labs/nexusBrain.ts`)
  - Chapter 29: Trust & Fraud Intelligence Center with Graph-Based Collusion Detection (`src/modules/trust/fraudIntelligence.ts`)
- **Wave 2 Marketplace & Talent**:
  - Chapter 3: Custom Branding & White-Labeling (`src/modules/platform/brandingManager.ts`)
  - Chapter 4: Plugin & Integration Marketplace with Capability Sandboxing (`src/modules/plugins/pluginMarketplace.ts`)
  - Chapter 10: Dynamic Talent Graph & Reputation Portability (`src/modules/talent/talentGraph.ts`)
  - Chapter 11: Verifiable Credentials & On-Chain / Cryptographic Badges (`src/modules/credentials/verifiableCredentials.ts`)
  - Chapter 13: AI Project Manager for Community Deals (`src/modules/deals/aiProjectManager.ts`)
  - Chapter 18: Community Moderation 2.0 Restorative Justice & Appeals (`src/modules/moderation/restorativeModeration.ts`)
  - Chapter 19: Real-Time Community Sentiment & Vibe Radar (`src/modules/sentiment/sentimentRadar.ts`)
  - Chapter 25: Nexus Code Lab Interactive Coding Arena with Plagiarism Detection (`src/modules/labs/codeLab.ts`)
  - Chapter 26: Nexus Design Lab Visual Critique Studio with WCAG 2.1 Contrast Scoring (`src/modules/labs/designLab.ts`)
- **Wave 3 Academy, Governance & Enterprise**:
  - Chapter 14: Adaptive Learning Academy with Skill Paths & Automated Graduation (`src/modules/academy/adaptiveAcademy.ts`)
  - Chapter 15: AI-Powered Mentorship & 1-on-1 Office Hours (`src/modules/mentorship/aiMentorship.ts`)
  - Chapters 9 & 12: Micro-Community Pods & DAO-Lite Bounty Board with Quadratic Voting (`src/modules/governance/bountyAndPods.ts`)
  - Chapters 16 & 17: Multi-Currency Escrow & Sponsor Marketplace (`src/modules/payments/multiCurrencySettlement.ts`)
  - Chapters 8, 20 & 23: Multi-Platform Sync, Churn & Burnout Predictor, Global Search (`src/modules/intelligence/communityAnalyticsEngine.ts`)
  - Chapters 21, 22, 27 & 28: Gamification 2.0, Stage Co-Pilot, Content Lab & Autonomous Marketing (`src/modules/marketing/marketingStudio.ts`)
  - Chapter 30: Enterprise Guild Solutions (SSO/SCIM/CMEK/Data Residency) (`src/modules/enterprise/enterpriseGateway.ts`)

### 3. Member & Owner Guide (Section 23 Features)
- **For Community Members**:
  - `/talent passport`: Export your portable cryptographic reputation and deal history JSON.
  - `/academy browse`: Enroll in interactive skill courses with adaptive quizzes and verifiable diploma badges.
  - `/mentor plan`: Receive your personalized weekly roadmap and asynchronous code clinic reviews.
  - `/codelab challenge`: Solve timed programming challenges and climb the global guild leaderboard.
  - `/design critique`: Submit Figma URLs or screenshots for automated WCAG accessibility analysis.
  - `/bounties`: Vote quadratically on community feature proposals or claim milestone bounties.
- **For Guild Owners & Admins**:
  - `/ask-nexus [query]`: Query community statistics using plain English or casual Egyptian Arabic.
  - `/branding`: Customize embed themes, brand colors, and choose AI communication tones.
  - `/plugins`: Install sandboxed integrations from the marketplace with granular capability permissions.
  - `/workflows`: Automate cross-platform events using the visual node-based automation builder.
  - `/audit`: Stream SIEM audit events and configure data residency compliance.

### 4. Interactive Commercial Documents & Sales Sandbox
- **Commercial Documents**:
  - [`PRICING.md`](PRICING.md): Detailed pricing tiers, add-ons, unit economics, and COGS breakdown.
  - [`GTM.md`](GTM.md): Go-to-Market launch strategy, 20% affiliate program, and customer acquisition channels.
  - [`METRICS.md`](METRICS.md): North Star metrics (WAEM, GDVT, MRR), retention funnels, and telemetry schemas.
  - [`LEGAL-PACK.md`](LEGAL-PACK.md): Production Terms of Service, Privacy Policy, DPA, and Acceptable Use Policy.
- **Sales Demo Sandbox**:
  - Pre-seeded tenant `guild_demo_sandbox_001` with realistic knowledge articles, deals, and courses.
  - One-click reset via `tenantManager.resetDemoSandbox()` for recurring prospect demonstrations.

---

## 📜 Section 24: The Nexus Charter & Merit Governance (Chapters 31 to 90)

The **Nexus Charter** establishes the foundational ethos: **The core platform is 100% free for everyone, forever.** Extras (cosmetics, convenience quotas) are earned strictly through effort and community contribution, never purchased.

### 1. Charter Principles & Non-Negotiables
- **Universal Fair-Use & Resource Guard**: Replaces commercial paywalls with universal 50,000-member quotas and zero upsell prompts.
- **Free White-Labeling**: Custom branding and badge removal are free for all communities.
- **Community Plugin Commons**: 0% platform cuts, open-source plugins, and cryptographically verified manifests.
- **Continuous Equal Access Auditing**: Real-time scanner `EqualAccessAuditor` verifies no feature flag or route permits wealth gating.

### 2. Sixty Chapters Architecture (Chapters 31-90)
- **Part A: Merit, Fairness & Governance (31-40)**:
  - Effort & Contribution scoring with anti-farming diminishing returns and duplicate penalties.
  - Unlockables Vault for cosmetic profile themes, animated badges, and extra study rooms.
  - Append-only cryptographic Contribution Ledger with member privacy controls.
  - Peer Kudos with graph-based collusion detection.
  - Time Bank (1:1 teaching hours exchange) strictly non-transferable for money.
  - Sybil-resistant Community Council voting and transparent moderation audit logs.
  - Full Accessibility Suite (screen-reader markdown, dyslexia font, high-contrast, low-bandwidth mode).
- **Part B: Open Distribution & Community Ownership (41-50)**:
  - One-command installer, self-host health center, community edition shared hosting.
  - Reusable server blueprints with visual diff and safe-apply rollback.
  - Interactive tutorials, documentation portal, and sandbox playground.
  - Bilingual localization (Egyptian casual Arabic + English) with full RTL support.
  - Public roadmap, changelog, open governance kit, and donation transparency dashboard.
- **Part C: Skills, Learning & Practice Labs (51-60)**:
  - Interactive Skill Tree Atlas across Frontend, Backend, Mobile, UI/UX, and Data.
  - Study Squads (3-5 member cohorts) with streak tracking and async standups.
  - Course Commons (free to learn, earned contributor status to publish).
  - Interview Prep Gym (coding, system design, behavioral) with AI-assisted feedback.
  - Kata & Sprint Arena with Jaccard similarity plagiarism checks.
  - Peer Review Exchange, Open Project Incubator, and Impact Bounties for non-profits.
- **Part D: Intelligence & Growth Assistance (61-70)**:
  - Private Personal Growth Dashboard with "Next Best Action" guidance.
  - Smart Digest with one-click opt-out and frequency caps.
  - Expert Help Router, Question Quality Coach, and Explain-My-Error stack trace parser.
  - Project Auto-Documentation with human approval gates.
  - Specialist Review Council (multi-agent security, performance, a11y, architecture audit).
  - AI Literacy Lab covering prompt engineering, hallucination auditing, and ethical disclosure.
- **Part E: Safety, Wellbeing & Community Care (71-80)**:
  - Opt-in Wellbeing Nudges and ergonomic break reminders.
  - Conflict Mediation Assistant with de-escalation cool-downs.
  - Scam Radar Feed embedded directly into job cards.
  - Safe Reporting Channel with encrypted incident tracking.
  - Privacy Vault with self-service JSON data export and GDPR/CCPA hard purge.
  - Transparent AI Ledger logging all AI evaluation decisions.
  - Youth Safety Mode (unmonitored DM restrictions) and Verified Human Badge (anti-impersonation).
  - Crisis-Aware Response Layer routing immediately to international crisis hotlines.
- **Part F: Culture, Traditions & Longevity (81-90)**:
  - Onboarding Quest Worlds and Seasonal Festivals (Ramadan hours, holiday schedules).
  - Member Journey Timelines and Success Wall for client testimonials.
  - Community Radio & Recap Studio with bilingual English & Egyptian Arabic scripts.
  - Learning Mini-Games (regex golf, CSS battle trivia, debugging races).
  - Alliance Network for cross-server federated challenges.
  - Alumni Give-Back program, Public Annual Impact Report, Regional Chapters (Cairo, Riyadh, Amman), and Longevity Succession Runbooks.

---

## 🏆 Section 25: Reliability, AI Depth, Careers, Collaboration & Community Fund (Chapters 91 to 180)

Section 25 completes the platform with enterprise-grade reliability, cutting-edge AI evaluation, full career toolkits, team productivity, and the voluntary **Community Fund & Skill Competitions** engine.

### 1. Community Fund & Competitions Principles (Section 25.0)
- **100% Voluntary Giving**: Max 1 gentle, passive mention per month; copywriting linter blocks guilt or urgency phrasing.
- **Strict Zero-Custody**: The bot never touches or deposits money. Licensed external providers (Stripe, Open Collective, GitHub Sponsors) process contributions.
- **Zero Donor Advantages**: Donors receive **ZERO** perks, roles, badges, votes, or score boosts. Gated privileges for money are hard-blocked.
- **Skill-Based Competitions**: Free to enter ($0 entry fee), funded by the community prize pool bucket. Blind judging with multi-judge rubrics, conflict-of-interest exclusion, 48-hour public appeal challenge window, and dual-human cryptographic sign-off on payouts.
- **Transparent Public Ledger**: Real-time append-only cryptographic hash chain logging all donations, bucket allocations, and disbursements.

### 2. Ninety Chapters Architecture (Chapters 91-180)
- **Part G: Reliability & Engineering Excellence (91-100)**:
  - Chaos Drills with synthetic fault injection in staging.
  - Feature Flag Console with automated rollback triggers.
  - Zero-downtime blue/green upgrades and active job draining.
  - Performance budgets (<100ms commands, <10 DB queries) and admin diagnostic profiler.
  - Real-time Cost Observatory with automated token budget caps.
  - Resilient multi-region options with graceful degradation matrices.
  - Synthetic member journey simulator running end-to-end tests every 5 minutes.
  - Self-diagnosing support assistant and public status page.
- **Part H: AI Depth & Evaluation (101-110)**:
  - Quality-aware model router with automatic multi-provider failover.
  - Double-blind model comparison arena.
  - Consent-based retrieval personalization with strict memory isolation.
  - Local model gateway (Ollama, vLLM) with automated cloud fallback.
  - Multimodal image parsing with prompt injection sanitization.
  - Whole-project long-context code analysis with file/line refactoring advice.
  - Fact & citation verifier and decision bias monitor across dialects.
  - Git-backed prompt version control and continuous red-team adversarial agent.
- **Part I: Freelancer Career & Professional Growth (111-120)**:
  - Personal brand kit builder, content planner (manual publishing rule), case study converter.
  - Pricing & negotiation coach with value-based pricing simulator.
  - Client communication coach (optimizing professional tone in English and Egyptian Arabic).
  - Verified testimonial collector, portfolio ordering optimizer, and certification prep tracks.
  - Private job search tracker and free resource opportunity finder.
- **Part J: Team Collaboration & Productivity (121-130)**:
  - In-Discord Kanban boards with two-way GitHub/Trello synchronization.
  - Shared markdown wiki with peer-reviewed edit proposals.
  - Community asset vault with license tagging and redistribution verification.
  - Timezone-smart meeting scheduler and milestone deadline risk guard.
  - Asynchronous daily stand-ups, sprint retrospectives, and designer-developer handoff checklists.
  - Structured issue triage templates and bilingual release notes generator.
- **Part K: Community Intelligence & Culture (131-140)**:
  - Semantic topic clustering identifying member pain points for workshop ideas.
  - Buddy system 2.0 with mentor safeguarding and workload caps.
  - Shy-friendly anonymous questions and lurker-to-contributor milestone ladder.
  - Multi-region cultural calendar, public knowledge forum sync, and safe humor mode.
  - Scheduled time capsules and regional ambassador program.
- **Part L: Trust, Legal Hygiene & Openness (141-150)**:
  - Central consent registry with one-click cascade revocation and automated purge.
  - Declarative data retention and geographic data residency routing.
  - Legal document drafting assistant (contracts, NDAs, licenses) with attorney disclaimers.
  - Creative Commons license manager and DMCA copyright complaint workflow.
  - Age and regional compliance profiles (COPPA, GDPR-K).
  - Community security recognition (Hall of Fame) and open REST API for free communities.
  - Research mode with k-anonymity (k>=5) and quarterly charter conformance reviews.
- **Part M: Community Fund & Competitions (151-180)**:
  - Community fund charter with strict permitted buckets (Infrastructure, Dev, Events, Prizes, Learning, Access Grants, Reserve).
  - Signed webhook donation intake with zero payment card handling.
  - Public transparency ledger with CSV export and minimum 3-month reserve protection.
  - Participatory budgeting with 1-member-1-vote proposals.
  - Gentle giving frequency cap and copywriting linter.
  - Automated refund and chargeback ledger adjustments.
  - Comprehensive competition framework with plagiarism defense and AI-disclosure auditing.
  - Non-custodial payout authorizations with dual-human administrative sign-off.
  - Development bounty fund, confidential needs-based access grants, anti-fraud anomaly monitors, and constitutional sunset plans.

---

## 💎 Valuation & Replacement Cost Report (Annex A)

As detailed in [`VALUE_REPORT.md`](VALUE_REPORT.md), Nexus is released as an open gift to the freelancer and open-source community:
- **Engineering Replacement Cost**: **$93,100** (980 engineering hours across 180 chapters at $95/hr standard market rate).
- **Equivalent Commercial SaaS Cost**: **$4,811.28/year** (combining MEE6 Pro, Circle.so Enterprise, HackerEarth, Thinkific, HoneyBook, and PagerDuty).
- **Community Self-Hosting TCO**: **$23.70/month** (VPS + SQLite + lightweight LLM routing for a community of 500 members).
- **Public License**: **GNU AGPLv3 + Nexus Charter Rider** (guaranteeing that core features remain 100% free and open forever).

---

## 🔮 Future Customization Roadmap

1. **Multi-Server Multi-Tenancy**: Federated cross-server freelancer guilds with global reputation bridging.
2. **Local LLM Sidecar Integration**: Optional local Ollama / vLLM container for zero-cloud token inference.
3. **Crypto Escrow Smart Contracts**: Automated EVM multi-sig escrow contracts bridging USDC/USDT on Arbitrum/Base.
4. **Voice Agent Live Coding**: Real-time WebRTC audio channel bot that speaks Egyptian Arabic to pair-program on voice.

---

## 📜 License & Compliance

Licensed under the **GNU Affero General Public License v3.0 (AGPLv3)** with the **Nexus Charter Rider**. 
- Core capabilities are 100% free for all users and communities in perpetuity.
- Built in strict compliance with the **Discord Developer Terms of Service**, **Telegram Bot Platform Guidelines**, and **Meta Platform Terms**.
- Non-custodial escrow broker and Community Fund operate strictly as informational milestone and authorization coordinators without financial custody.

