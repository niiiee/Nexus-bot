-- 002_rls_policies.sql - Row-Level Security Policies for Strict Tenant Isolation

-- 1. Enable RLS on all tenant-scoped tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_cases_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events_chain ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_staging.temporary_leads ENABLE ROW LEVEL SECURITY;

-- 2. Default-Deny Policies (requires explicit tenant setting)
CREATE POLICY members_tenant_isolation ON members
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE POLICY cases_tenant_isolation ON moderation_cases_v2
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE POLICY configs_tenant_isolation ON guild_configs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE POLICY audit_tenant_isolation ON audit_events_chain
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE POLICY leads_tenant_isolation ON lead_staging.temporary_leads
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- 3. Prevent UPDATE and DELETE on Audit Events (Immutable Append-Only Ledger)
REVOKE UPDATE, DELETE ON audit_events_chain FROM PUBLIC;
