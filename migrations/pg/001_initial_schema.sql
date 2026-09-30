-- 001_initial_schema.sql - Nexus Cloud Schema with Multi-Tenancy & Lead Staging Isolation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 1. Ephemeral Lead Staging Schema (Section 22 Isolation)
-- -------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS lead_staging;

CREATE TABLE IF NOT EXISTS lead_staging.temporary_leads (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  encrypted_contact_payload TEXT NOT NULL,
  ttl_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'staged',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 2. Core Operational Entities with Strict Tenancy
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guild_configs (
  tenant_id TEXT PRIMARY KEY,
  welcome_channel_id TEXT,
  staff_review_channel_id TEXT,
  showcase_channel_id TEXT,
  help_channel_id TEXT,
  audit_logs_channel_id TEXT,
  verified_role_id TEXT,
  restricted_role_id TEXT,
  anti_raid_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  username TEXT NOT NULL,
  seniority_level TEXT DEFAULT 'Junior',
  reputation_score INT DEFAULT 100,
  is_restricted BOOLEAN DEFAULT FALSE,
  opt_in_job_matching BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS moderation_cases_v2 (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  action_applied TEXT NOT NULL,
  points_assigned INT DEFAULT 0,
  is_appealed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events_chain (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  prev_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
