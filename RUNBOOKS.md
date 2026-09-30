# RUNBOOKS.md — Operational Incident Runbooks

**Document Version**: 1.0.0  
**Date**: September 30, 2026  
**Auditor**: Antigravity Cloud Architecture Agent  
**Governing Standard**: Section 27.11 (Security & Compliance Runbooks)

---

## 1. Incident Runbook: Discord Bot Token Leak (P0)

### Trigger
A token matching `/([a-zA-Z0-9_-]{24}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27})/` is spotted in a public repository, chat log, or commit.

### Execution Steps
1. **Immediate Revocation (< 2 minutes)**:
   - Log into the [Discord Developer Portal](https://discord.com/developers/applications).
   - Select the affected Application -> Navigate to **Bot**.
   - Click **Reset Token**. Copy the newly generated token.
2. **Platform Secret Update**:
   - On Fly.io: `fly secrets set DISCORD_TOKEN="<new_token>"`
   - On Render: Update the `DISCORD_TOKEN` environment variable in the dashboard.
   - For local/self-host: Update the `.env` file and execute `docker compose restart worker`.
3. **Audit Active Gateway Sessions**:
   - Check Discord Developer Portal audit log for unexpected bot IP connections or authorization grants.
4. **Post-Incident Review**:
   - Trace the leak vector. If committed to Git, rotate git credentials and execute `git filter-repo` to scrub history.

---

## 2. Incident Runbook: Database Credential Leak (P0)

### Trigger
`DATABASE_URL` or Supabase service-role key is exposed in external telemetry, logs, or public forum.

### Execution Steps
1. **Supabase Key Rotation**:
   - Log into Supabase Dashboard -> **Project Settings** -> **API**.
   - Click **Generate New API Keys** for the service-role key.
   - For database password: Go to **Database Settings** -> **Reset Database Password**.
2. **Platform Secret Deployment**:
   - Update `DATABASE_URL` across worker and web platforms (`fly secrets set DATABASE_URL=...`).
3. **Audit Active Connections**:
   - Query PostgreSQL active connections:
     ```sql
     SELECT pid, usename, client_addr, state, query 
     FROM pg_stat_activity 
     WHERE state != 'idle';
     ```
   - Terminate suspicious external connection PIDs via `SELECT pg_terminate_backend(pid);`.
4. **Audit Hash Chains**:
   - Run audit verification script `npm run qa-gate` to confirm `audit_events_chain` hash integrity was not tampered with.

---

## 3. Incident Runbook: Object Storage Exposure (P1)

### Trigger
Private member files or backup archives in Cloudflare R2 become reachable via a public URL without a signed signature.

### Execution Steps
1. **Lock Down Bucket Policy (< 1 minute)**:
   - Access Cloudflare Dashboard -> **R2** -> Select `private-media` or `backups`.
   - Under **Settings** -> **Public Access**, click **Disable Public Access** immediately.
2. **Revoke API Access Tokens**:
   - Go to Cloudflare R2 API Tokens -> Revoke the active `R2_ACCESS_KEY_ID`.
   - Issue a new token with bucket-scoped permissions only.
3. **Audit Access Logs**:
   - Review Cloudflare access logs to identify objects downloaded during the exposure window.
   - If member PII was downloaded, initiate notification per GDPR/Law 151 compliance playbooks.

---

## 4. Incident Runbook: AI Data-Use Policy Violation (P1)

### Trigger
Private member conversations or lead staging data were transmitted to an unapproved AI tier (e.g. Gemini Free Tier where training is allowed).

### Execution Steps
1. **Engage AI Circuit Breaker**:
   - Instantly switch `LLM_PROVIDER=mock` or toggle `PRIVACY_GATE_STRICT=true` via platform secrets.
2. **Isolate Leaked Content Scope**:
   - Check `audit_events_chain` where `event_type = 'AI_QUERY_DISPATCHED'` to trace the exact prompts sent.
3. **Submit Data Deletion Request**:
   - If required by privacy regulations, contact provider support with the request correlation IDs to request deletion of training buffers.
4. **Switch to Paid Tier or Local Model**:
   - Verify that Google Cloud billing is active and provision a paid API key or deploy local `ollama` container before re-enabling AI services.

---

## 5. Incident Runbook: Provider Outage Containment (P2)

### Trigger
Supabase, Gemini API, Cloudflare R2, or Telegram becomes unreachable.

### Execution Steps
1. **Supabase Down**:
   - Bot automatically switches to **Safe Read-Only Shadow Mode**.
   - No disciplinary actions, financial deal changes, or point modifications are executed.
   - Bot responds to commands with: *"Database maintenance in progress. Actions queued."*
2. **Gemini API Down**:
   - Bot falls back to local regex-based Rules Engine Mode A.
   - Non-essential AI features (storyboard assistant, tone optimizer) return a polite maintenance notice.
3. **Cloudflare R2 Down**:
   - File uploads return: *"Storage temporarily unavailable. Please retry in a few moments."*
   - Text messaging, onboarding, and quizzes continue without disruption.
4. **Telegram Down**:
   - Outbound alerts queue in `pg_job_queue` with exponential backoff.
   - Core Discord bot operations proceed completely unaffected.

---

## 6. Incident Runbook: Server Raid Attack (P0)

### Trigger
An influx of >15 accounts joining per minute, or coordinated spam patterns across multiple channels.

### Execution Steps
1. **Automatic Anti-Raid Engagement**:
   - Rules Engine intercepts join flood and locks down onboarding invites.
   - Newcomers are quarantined in a restricted role with zero channel read/write access.
2. **Enable Global Slowmode**:
   - Apply 30-second slowmode on all public chat channels.
3. **Dispatch Staff Alert**:
   - Send high-priority alert to the Telegram operations channel and `#staff-review` with the raid account IDs.
4. **Dual-Moderator Purge**:
   - Moderators issue a mass-kick or ban confirmation for all accounts matching the raid fingerprint.

---

## 7. Operational Drill: Secret Rotation Procedure

Execute every 90 days as part of routine maintenance:

```bash
# Step 1: Generate new session secret
NEW_SESSION_SECRET=$(openssl rand -hex 32)

# Step 2: Deploy to staging first and run health checks
fly secrets set SESSION_SECRET="$NEW_SESSION_SECRET" --app nexus-staging
npm run test:deploy

# Step 3: Deploy to production with zero-downtime rolling restart
fly secrets set SESSION_SECRET="$NEW_SESSION_SECRET" --app nexus-prod
```
