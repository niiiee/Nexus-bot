export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id TEXT PRIMARY KEY,
  welcome_channel_id TEXT,
  staff_review_channel_id TEXT,
  showcase_channel_id TEXT,
  help_channel_id TEXT,
  courses_channel_id TEXT,
  deals_category_id TEXT,
  events_channel_id TEXT,
  audit_logs_channel_id TEXT,
  larper_role_id TEXT,
  verified_role_id TEXT,
  staff_role_id TEXT,
  owner_role_id TEXT,
  suspicion_threshold REAL DEFAULT 0.65,
  passing_score INTEGER DEFAULT 50,
  min_restriction_hours INTEGER DEFAULT 12,
  max_restriction_hours INTEGER DEFAULT 168,
  quiet_hours_start INTEGER DEFAULT 22,
  quiet_hours_end INTEGER DEFAULT 6,
  ai_tone_intensity REAL DEFAULT 1.0,
  anti_raid_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  user_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  username TEXT NOT NULL,
  field TEXT,
  seniority_level TEXT DEFAULT 'Junior',
  claimed_experience_years REAL DEFAULT 0,
  tools TEXT,
  goals TEXT,
  language TEXT DEFAULT 'en',
  reputation_score INTEGER DEFAULT 100,
  credits_balance INTEGER DEFAULT 50,
  credits INTEGER DEFAULT 50,
  xp INTEGER DEFAULT 0,
  lifecycle_stage TEXT DEFAULT 'Newcomer',
  is_restricted INTEGER DEFAULT 0,
  restriction_expires_at INTEGER,
  opt_in_events INTEGER DEFAULT 1,
  opt_in_job_matching INTEGER DEFAULT 1,
  opt_in_telegram_backup INTEGER DEFAULT 0,
  opt_in_banter INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  last_task_date TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vetting_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  field TEXT NOT NULL,
  claimed_years REAL NOT NULL,
  questions_json TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  suspicion_score REAL DEFAULT 0.0,
  status TEXT DEFAULT 'in_progress',
  escalation_case_id TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS skill_tests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  field TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  hidden_rubric_json TEXT NOT NULL,
  timebox_minutes INTEGER DEFAULT 30,
  expires_at INTEGER NOT NULL,
  submitted_answers_json TEXT,
  score INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  feedback_markdown TEXT,
  created_at INTEGER NOT NULL,
  graded_at INTEGER
);

CREATE TABLE IF NOT EXISTS work_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  url_or_asset TEXT NOT NULL,
  description TEXT NOT NULL,
  ai_evaluation_json TEXT,
  plagiarism_score REAL DEFAULT 0.0,
  assigned_role TEXT,
  status TEXT DEFAULT 'pending',
  telegram_synced INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  freelancer_id TEXT NOT NULL,
  middleman_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  agreement_text TEXT NOT NULL,
  agreement_sha256 TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  client_confirmed INTEGER DEFAULT 0,
  freelancer_confirmed INTEGER DEFAULT 0,
  middleman_funds_verified INTEGER DEFAULT 0,
  proof_attachment_url TEXT,
  dispute_reason TEXT,
  client_rating INTEGER,
  freelancer_rating INTEGER,
  created_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  reversible INTEGER DEFAULT 1,
  reversed INTEGER DEFAULT 0,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS perk_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  credit_price INTEGER DEFAULT 100,
  level_requirement INTEGER DEFAULT 1,
  stock INTEGER DEFAULT -1,
  duration_seconds INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS member_perks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  perk_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  source TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fact_key TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS appeals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  case_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewer_id TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  poster_id TEXT NOT NULL,
  title TEXT NOT NULL,
  budget_range TEXT NOT NULL,
  deadline TEXT NOT NULL,
  required_skills TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_tasks (
  id TEXT PRIMARY KEY,
  field TEXT NOT NULL,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  criteria_json TEXT NOT NULL,
  reward_credits INTEGER DEFAULT 50,
  reward_xp INTEGER DEFAULT 100,
  date_str TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  submission_text TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  feedback TEXT,
  status TEXT DEFAULT 'approved',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS squads (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  leader_id TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  channel_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS squad_members (
  squad_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (squad_id, user_id)
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  summary TEXT NOT NULL,
  timeline_json TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  tags TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_reviews (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  feedback TEXT NOT NULL,
  rating INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS endorsements (
  id TEXT PRIMARY KEY,
  giver_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS member_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  granted_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration_seconds INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS earnings_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  source TEXT NOT NULL,
  date_str TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  message TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  is_sent INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS middlemen (
  user_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  tier TEXT DEFAULT 'Trainee',
  max_deal_size REAL DEFAULT 500,
  completed_deals INTEGER DEFAULT 0,
  disputed_deals INTEGER DEFAULT 0,
  rating REAL DEFAULT 5.0,
  is_suspended INTEGER DEFAULT 0,
  fee_percentage REAL DEFAULT 3.0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS deal_milestones (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  submission_url TEXT,
  submitted_at INTEGER,
  approved_at INTEGER
);

CREATE TABLE IF NOT EXISTS deal_disputes (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  initiator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  ai_summary TEXT,
  ladder_level TEXT DEFAULT 'middleman',
  status TEXT DEFAULT 'open',
  resolution_notes TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_urls TEXT,
  status TEXT DEFAULT 'pending',
  staff_action TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS mentorship_pairings (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  mentee_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  last_checkin INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hackathons (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  theme TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT DEFAULT 'upcoming',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  url TEXT NOT NULL,
  tags TEXT NOT NULL,
  status TEXT DEFAULT 'approved',
  suggested_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS role_rules (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  target_role_id TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  code TEXT NOT NULL,
  inviter_id TEXT NOT NULL,
  uses INTEGER DEFAULT 0,
  source_campaign TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  referrer_id TEXT NOT NULL,
  referred_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reward_credits INTEGER DEFAULT 50,
  created_at INTEGER NOT NULL,
  rewarded_at INTEGER
);

CREATE TABLE IF NOT EXISTS onboarding_quests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  quest_name TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS pulse_surveys (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  feedback TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  variant_a_views INTEGER DEFAULT 0,
  variant_a_conversions INTEGER DEFAULT 0,
  variant_b_views INTEGER DEFAULT 0,
  variant_b_conversions INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  theme TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  title_unlocked TEXT,
  unlocked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_credits INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workshops (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  host_id TEXT NOT NULL,
  scheduled_time INTEGER NOT NULL,
  attendees_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'scheduled',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  issuer TEXT DEFAULT 'Senior Progg Academy',
  verification_sha256 TEXT NOT NULL,
  issued_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_gaps (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  category TEXT NOT NULL,
  demand_index REAL NOT NULL,
  effective_supply REAL NOT NULL,
  gap_score REAL NOT NULL,
  confidence REAL NOT NULL,
  trend TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_candidates (
  id TEXT PRIMARY KEY,
  source_platform TEXT NOT NULL,
  source_community TEXT NOT NULL,
  post_url TEXT NOT NULL,
  problem_summary TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  author_id TEXT,
  score REAL NOT NULL,
  status TEXT DEFAULT 'discovered',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_reviews (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  drafted_reply TEXT NOT NULL,
  sandbox_result TEXT,
  confidence REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewer_id TEXT,
  human_edited_reply TEXT,
  decision_reason TEXT,
  reviewed_at INTEGER,
  published_at INTEGER,
  post_id TEXT
);

CREATE TABLE IF NOT EXISTS outreach_stoplist (
  id TEXT PRIMARY KEY,
  target_identifier TEXT NOT NULL,
  platform TEXT NOT NULL,
  reason TEXT NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_community_rules (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  community_name TEXT NOT NULL,
  allows_bots INTEGER DEFAULT 0,
  allows_promo INTEGER DEFAULT 0,
  allows_links INTEGER DEFAULT 0,
  allows_unsolicited_help INTEGER DEFAULT 1,
  is_paused INTEGER DEFAULT 0,
  pause_reason TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_attributions (
  id TEXT PRIMARY KEY,
  campaign_code TEXT NOT NULL,
  platform TEXT NOT NULL,
  community TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  joins INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  active_30d INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_staging (
  id TEXT PRIMARY KEY,
  psid_hash TEXT NOT NULL UNIQUE,
  encrypted_psid TEXT NOT NULL,
  encrypted_name TEXT NOT NULL,
  encrypted_message TEXT NOT NULL,
  service_requested TEXT,
  source_channel TEXT NOT NULL,
  source_reference TEXT,
  language TEXT DEFAULT 'en',
  state TEXT DEFAULT 'NEW',
  consent_notice_sent INTEGER DEFAULT 0,
  follow_up_count INTEGER DEFAULT 0,
  last_interaction_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  extended_once INTEGER DEFAULT 0,
  declined_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS client_registry (
  id TEXT PRIMARY KEY,
  client_psid_hash TEXT NOT NULL UNIQUE,
  encrypted_name TEXT NOT NULL,
  contact_channel TEXT NOT NULL,
  services_purchased_json TEXT DEFAULT '[]',
  deal_references_json TEXT DEFAULT '[]',
  consent_record_json TEXT NOT NULL,
  summary_notes TEXT,
  promoted_by TEXT NOT NULL,
  promoted_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  retention_expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_audit_ledger (
  id TEXT PRIMARY KEY,
  lead_id_hash TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}',
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_staging_config (
  guild_id TEXT PRIMARY KEY,
  staging_ttl_days INTEGER DEFAULT 30,
  registry_retention_months INTEGER DEFAULT 24,
  max_follow_ups INTEGER DEFAULT 2,
  auto_promotion_enabled INTEGER DEFAULT 0,
  meta_verify_token TEXT,
  meta_app_secret TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_derived_artifacts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  content_ref TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- =========================================================================
-- SECTION 23: THIRTY CHAPTERS COMMERCIAL PLATFORM SCHEMA
-- =========================================================================

-- Chapter 1 & 2: Multi-Tenant Core & Subscriptions
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  template TEXT DEFAULT 'freelancer_hub',
  plan_tier TEXT DEFAULT 'free',
  custom_domain TEXT,
  status TEXT DEFAULT 'active',
  quota_members INTEGER DEFAULT 150,
  quota_ai_calls INTEGER DEFAULT 250,
  quota_storage_mb INTEGER DEFAULT 500,
  encryption_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  month_key TEXT NOT NULL,
  ai_calls_count INTEGER DEFAULT 0,
  ai_tokens_count INTEGER DEFAULT 0,
  storage_bytes INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(tenant_id, month_key)
);

CREATE TABLE IF NOT EXISTS tenant_audit_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  details_json TEXT DEFAULT '{}',
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_tier TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Chapter 3 & 4: Branding & Plugin Marketplace
CREATE TABLE IF NOT EXISTS brand_kits (
  tenant_id TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  primary_color TEXT DEFAULT '#5865F2',
  secondary_color TEXT DEFAULT '#57F287',
  font_family TEXT DEFAULT 'Inter, sans-serif',
  logo_url TEXT,
  tone_preset TEXT DEFAULT 'friendly_professional',
  custom_embed_theme_json TEXT DEFAULT '{}',
  powered_by_badge INTEGER DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  author_id TEXT NOT NULL,
  description TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  status TEXT DEFAULT 'approved',
  rating REAL DEFAULT 5.0,
  install_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_plugins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  config_json TEXT DEFAULT '{}',
  is_enabled INTEGER DEFAULT 1,
  installed_at INTEGER NOT NULL,
  UNIQUE(tenant_id, plugin_id)
);

-- Chapter 5: Visual Workflow Automation Builder
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config_json TEXT DEFAULT '{}',
  conditions_json TEXT DEFAULT '[]',
  actions_json TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger_payload_json TEXT DEFAULT '{}',
  execution_logs_json TEXT DEFAULT '[]',
  error_message TEXT,
  execution_time_ms INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Chapter 6: Public API & Webhooks
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  rate_limit_per_min INTEGER DEFAULT 60,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  event_types_json TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  response_status INTEGER,
  attempts INTEGER DEFAULT 1,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Chapter 10 & 11: Talent Graph & Verifiable Credentials
CREATE TABLE IF NOT EXISTS talent_nodes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  skills_json TEXT DEFAULT '[]',
  verified_deals_count INTEGER DEFAULT 0,
  rating_score REAL DEFAULT 5.0,
  availability_status TEXT DEFAULT 'available',
  hourly_rate_estimate REAL,
  timezone TEXT DEFAULT 'UTC',
  languages_json TEXT DEFAULT '["en"]',
  updated_at INTEGER NOT NULL,
  UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS verifiable_credentials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  claims_json TEXT NOT NULL,
  signature_hex TEXT NOT NULL,
  issuer_did TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER,
  is_revoked INTEGER DEFAULT 0,
  revocation_reason TEXT
);

-- Chapter 13 & 14: AI PM for Deals & Adaptive Academy
CREATE TABLE IF NOT EXISTS deal_project_plans (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  milestones_json TEXT NOT NULL,
  risk_score REAL DEFAULT 0.0,
  scope_creep_flags_json TEXT DEFAULT '[]',
  last_checkin_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  lessons_json TEXT NOT NULL,
  price_cents INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  progress_percentage REAL DEFAULT 0.0,
  quiz_scores_json TEXT DEFAULT '{}',
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(course_id, user_id)
);

-- Chapter 15 & 18 & 19: Mentorship, Moderation 2.0 & Sentiment
CREATE TABLE IF NOT EXISTS ai_mentorships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  goals_json TEXT DEFAULT '[]',
  weekly_plan_json TEXT DEFAULT '{}',
  preferences_json TEXT DEFAULT '{}',
  last_checkin_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS moderation_incidents_v2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  context_snippet TEXT NOT NULL,
  explanation TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  is_appealed INTEGER DEFAULT 0,
  appeal_status TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_sentiment_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  score REAL NOT NULL,
  topics_json TEXT DEFAULT '[]',
  conflict_risk REAL DEFAULT 0.0,
  isolated_members_count INTEGER DEFAULT 0,
  timestamp INTEGER NOT NULL
);

-- Chapter 24 & 25 & 26: Knowledge Engine, Code Lab & Design Lab
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  source_channel_id TEXT,
  access_role_id TEXT,
  contributor_id TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS code_challenges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  test_cases_json TEXT NOT NULL,
  rubric_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS code_submissions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  code_snippet TEXT NOT NULL,
  passed_tests INTEGER NOT NULL,
  total_tests INTEGER NOT NULL,
  execution_time_ms INTEGER DEFAULT 0,
  similarity_score REAL DEFAULT 0.0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS design_critiques (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  media_url TEXT NOT NULL,
  wcag_score REAL DEFAULT 100.0,
  feedback_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Chapter 29 & 30: Fraud Intelligence & Enterprise
CREATE TABLE IF NOT EXISTS collusion_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ring_type TEXT NOT NULL,
  user_ids_json TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  evidence_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending_review',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_verifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  verification_id TEXT NOT NULL,
  status TEXT NOT NULL,
  verified_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scam_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  scammer_identifier TEXT NOT NULL,
  platform TEXT NOT NULL,
  pattern_description TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  status TEXT DEFAULT 'confirmed',
  is_globally_shared INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enterprise_configs (
  tenant_id TEXT PRIMARY KEY,
  sso_provider TEXT,
  sso_metadata_url TEXT,
  scim_endpoint TEXT,
  audit_stream_url TEXT,
  cmek_key_id TEXT,
  data_residency_region TEXT DEFAULT 'us-central1',
  retention_days INTEGER DEFAULT 730,
  updated_at INTEGER NOT NULL
);

-- ============================================================================
-- SECTION 24: THE NEXUS CHARTER & MERIT-BASED COMMUNITY OPERATING SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS merit_charter_clauses (
  id TEXT PRIMARY KEY,
  clause_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  is_immutable INTEGER DEFAULT 1,
  allowed_earnable INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS member_contributions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  contribution_type TEXT NOT NULL,
  quality_weight REAL NOT NULL,
  evidence_url TEXT,
  verified_by TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS member_unlockables (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  unlockable_key TEXT NOT NULL,
  category TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS equal_access_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  component TEXT NOT NULL,
  check_type TEXT NOT NULL,
  passed INTEGER NOT NULL,
  violation_details TEXT,
  audited_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contribution_ledger_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details_json TEXT NOT NULL,
  entry_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS peer_kudos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  date_str TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS time_bank_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  balance_hours REAL DEFAULT 0.0,
  lifetime_taught REAL DEFAULT 0.0,
  lifetime_learned REAL DEFAULT 0.0,
  updated_at INTEGER NOT NULL,
  UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS time_bank_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  duration_hours REAL NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_council_proposals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_council_votes (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transparent_moderation_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  category TEXT NOT NULL,
  anonymized_target_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  overturn_status TEXT DEFAULT 'upheld',
  appeal_duration_hours REAL DEFAULT 0.0,
  language TEXT DEFAULT 'en',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS server_blueprints_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  author_id TEXT NOT NULL,
  blueprint_json TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_tree_nodes (
  id TEXT PRIMARY KEY,
  discipline TEXT NOT NULL,
  node_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  prerequisites_json TEXT DEFAULT '[]',
  resources_json TEXT DEFAULT '[]',
  milestones_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS study_squads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  discipline TEXT NOT NULL,
  member_ids_json TEXT NOT NULL,
  timezone TEXT NOT NULL,
  streak_weeks INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS course_commons_lessons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  quizzes_json TEXT DEFAULT '[]',
  review_status TEXT DEFAULT 'published',
  quality_badge TEXT DEFAULT 'standard',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS peer_reviews_v2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  category TEXT NOT NULL,
  score REAL NOT NULL,
  feedback TEXT NOT NULL,
  quality_score REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS incubator_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pitch TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  team_roles_json TEXT DEFAULT '[]',
  milestones_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'ideation',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS impact_bounties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  cause_type TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT NOT NULL,
  proof_url TEXT,
  verified_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_growth_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  goals_json TEXT DEFAULT '[]',
  competencies_json TEXT DEFAULT '[]',
  weekly_reflection TEXT,
  next_action TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS expert_help_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ask_user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  matched_expert_id TEXT,
  status TEXT DEFAULT 'pending',
  cooldown_until INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS specialist_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  security_score REAL NOT NULL,
  perf_score REAL NOT NULL,
  a11y_score REAL NOT NULL,
  arch_score REAL NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wellbeing_nudges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nudge_type TEXT NOT NULL,
  active_session_mins INTEGER NOT NULL,
  dismissed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scam_radar_entries (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  keyword_patterns_json TEXT NOT NULL,
  warning_advice TEXT NOT NULL,
  source_community TEXT DEFAULT 'global',
  reported_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS privacy_vault_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transparent_ai_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  input_summary TEXT NOT NULL,
  plain_language_reason TEXT NOT NULL,
  is_contested INTEGER DEFAULT 0,
  human_reviewer_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crisis_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  detected_signal TEXT NOT NULL,
  hotline_info_sent INTEGER DEFAULT 1,
  moderator_notified INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS onboarding_quests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  track TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_traditions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  season_tag TEXT NOT NULL,
  schedule_rules_json TEXT NOT NULL,
  active_hours_utc TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_games_scores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  season TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS regional_chapters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  region_name TEXT NOT NULL,
  city TEXT NOT NULL,
  lead_ambassador_id TEXT,
  timezone TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- ============================================================================
-- SECTION 25: RELIABILITY, AI DEPTH, COLLABORATION, COMMUNITY FUND & CONTESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS chaos_experiments (
  id TEXT PRIMARY KEY,
  experiment_type TEXT NOT NULL,
  target_system TEXT NOT NULL,
  injection_params_json TEXT NOT NULL,
  recovery_time_ms INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags_v2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  flag_key TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 1,
  rollout_percentage INTEGER DEFAULT 100,
  error_threshold_percent REAL DEFAULT 5.0,
  auto_rollback_triggered INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_observatory_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  storage_bytes INTEGER DEFAULT 0,
  compute_ms INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0.0,
  recorded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS model_routing_benchmarks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  measured_latency_ms INTEGER NOT NULL,
  quality_rating REAL NOT NULL,
  cost_per_1k_tokens REAL NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  prompt_key TEXT NOT NULL,
  version TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  rubric_json TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  git_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS red_team_logs (
  id TEXT PRIMARY KEY,
  test_suite TEXT NOT NULL,
  attack_vector TEXT NOT NULL,
  prompt_payload TEXT NOT NULL,
  bypassed INTEGER NOT NULL,
  mitigation_note TEXT,
  run_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS client_testimonials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  freelancer_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  project_title TEXT NOT NULL,
  rating INTEGER NOT NULL,
  testimonial_text TEXT NOT NULL,
  is_verified INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collaboration_kanban_boards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  columns_json TEXT NOT NULL,
  cards_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_vault_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  uploader_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  license_type TEXT NOT NULL,
  attribution_text TEXT NOT NULL,
  is_shareable INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS async_standups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  yesterday_text TEXT NOT NULL,
  today_text TEXT NOT NULL,
  blockers_text TEXT NOT NULL,
  date_str TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_topic_clusters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  topic_label TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  sentiment_trend REAL DEFAULT 0.0,
  pain_point_summary TEXT,
  identified_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_consent_registry (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  consent_scope TEXT NOT NULL,
  is_granted INTEGER DEFAULT 1,
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS retention_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  data_category TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  auto_purge INTEGER DEFAULT 1,
  last_purged_at INTEGER
);

CREATE TABLE IF NOT EXISTS copyright_takedown_cases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  target_content_url TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending_review',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_fund_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  bucket TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  reference_description TEXT NOT NULL,
  receipt_url TEXT,
  entry_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fund_donations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  donor_identifier TEXT NOT NULL,
  is_anonymous INTEGER DEFAULT 0,
  opt_in_public_list INTEGER DEFAULT 0,
  amount_usd REAL NOT NULL,
  status TEXT DEFAULT 'succeeded',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fund_allocation_buckets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  balance_usd REAL NOT NULL,
  target_percentage REAL NOT NULL,
  min_reserve_usd REAL DEFAULT 0.0,
  updated_at INTEGER NOT NULL,
  UNIQUE(tenant_id, bucket_name)
);

CREATE TABLE IF NOT EXISTS participatory_budget_proposals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  proposer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  requested_amount_usd REAL NOT NULL,
  target_bucket TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'voting',
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS competitions_v2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  rules_text TEXT NOT NULL,
  rubric_json TEXT NOT NULL,
  prize_pool_reserved_usd REAL NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS competition_submissions_v2 (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  entrant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  submission_url TEXT NOT NULL,
  proof_of_work_json TEXT NOT NULL,
  similarity_score REAL DEFAULT 0.0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS competition_judging_v2 (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  judge_id TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  total_score REAL NOT NULL,
  feedback TEXT NOT NULL,
  is_outlier INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payout_authorizations (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  winner_id TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  external_payout_ref TEXT,
  approver_1_id TEXT NOT NULL,
  approver_2_id TEXT,
  status TEXT DEFAULT 'pending_dual_approval',
  executed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  need_category TEXT NOT NULL,
  requested_item TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  status TEXT DEFAULT 'pending_review',
  approved_by TEXT,
  granted_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_rules (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  mode TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  decay_days INTEGER DEFAULT 30,
  auto_max_action TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS member_rule_points (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  case_id TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS moderation_cases_v2 (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  mode TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  content_excerpt TEXT,
  context_reason TEXT,
  language TEXT DEFAULT 'en',
  points_issued INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  reviewer_id TEXT,
  secondary_reviewer_id TEXT,
  is_shadow INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS moderation_appeals_v2 (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  appellant_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  assigned_reviewer_id TEXT,
  decision TEXT DEFAULT 'pending',
  decision_reason TEXT,
  decided_by TEXT,
  decided_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS restore_drill_records (
  drill_id TEXT PRIMARY KEY,
  snapshot_hash TEXT NOT NULL,
  restored_hash TEXT NOT NULL,
  is_valid INTEGER NOT NULL,
  table_count INTEGER NOT NULL,
  record_count INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  executed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS config_lint_results (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  suggested_fix TEXT NOT NULL,
  detected_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shadow_action_logs (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  would_be_action TEXT NOT NULL,
  context_snippet TEXT,
  evaluated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS privacy_assessments (
  module_id TEXT PRIMARY KEY,
  module_name TEXT NOT NULL,
  data_categories_json TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  risk_score REAL NOT NULL,
  mitigations_json TEXT NOT NULL,
  status TEXT DEFAULT 'approved',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auditor_sessions (
  token TEXT PRIMARY KEY,
  auditor_name TEXT NOT NULL,
  organization TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  masked_pii_count INTEGER DEFAULT 0,
  queries_executed INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_health_checks (
  service_name TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  quota_remaining REAL,
  consecutive_failures INTEGER DEFAULT 0,
  last_checked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS institutional_memory_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  approved_decision TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agentic_plan_records (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  title TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending_approval',
  approved_by TEXT,
  executed_at INTEGER,
  rollback_snapshot_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_bank_items (
  id TEXT PRIMARY KEY,
  field TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_text TEXT NOT NULL,
  rubric_json TEXT NOT NULL,
  exposure_count INTEGER DEFAULT 0,
  is_leaked INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_certifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_title TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  blind_panel_json TEXT NOT NULL,
  final_score REAL DEFAULT 0,
  status TEXT DEFAULT 'under_review',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS job_matching_recommendations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  match_score REAL NOT NULL,
  reason_codes_json TEXT NOT NULL,
  is_newcomer_quota INTEGER DEFAULT 0,
  matched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rule_amendment_proposals (
  id TEXT PRIMARY KEY,
  proposer_id TEXT NOT NULL,
  target_rule_id TEXT NOT NULL,
  proposed_text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS whistleblower_reports (
  id TEXT PRIMARY KEY,
  encrypted_payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending_audit',
  review_notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS federated_blocklist_entries (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  originating_community TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS apprenticeships (
  id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  apprentice_id TEXT NOT NULL,
  is_minor INTEGER DEFAULT 0,
  channel_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS micro_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  criteria TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  is_revoked INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_bids (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  members_json TEXT NOT NULL,
  shares_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending_all_consent',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subcontract_agreements (
  id TEXT PRIMARY KEY,
  parent_deal_id TEXT NOT NULL,
  contractor_id TEXT NOT NULL,
  subcontractor_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS client_feedback_records (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comments TEXT NOT NULL,
  is_retaliatory INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS design_gallery_submissions (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  votes_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meetup_events (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  date_timestamp INTEGER NOT NULL,
  safety_checklist_completed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS volunteer_hours_ledger (
  id TEXT PRIMARY KEY,
  volunteer_id TEXT NOT NULL,
  activity TEXT NOT NULL,
  hours_logged REAL NOT NULL,
  logged_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_jobs (
  id TEXT PRIMARY KEY,
  source_bot TEXT NOT NULL,
  dry_run INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events_chain (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS council_elections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  term TEXT NOT NULL,
  status TEXT NOT NULL,
  votes_cast INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS legal_holds (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  reason TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS federated_peers (
  id TEXT PRIMARY KEY,
  peer_name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  trust_score REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL
);
`;
