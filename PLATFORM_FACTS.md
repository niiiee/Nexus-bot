# PLATFORM_FACTS.md — Cloud Platform Facts & Specifications

**Date Checked**: September 30, 2026  
**Auditor**: Antigravity Cloud Architecture Agent  
**Governing Rule**: Section 27.1 (Facts Before Design). All facts verified against official documentation and pricing pages. Unverified assumptions are explicitly marked `UNVERIFIED`.

---

## 1. Render

- **Worker Types**: Background Workers run continuously and do not receive HTTP traffic. They are designed for queue workers, Discord bots, and scheduled event listeners.
- **Free Tier Availability**: Render does **NOT** offer a free tier for Background Workers. Background workers are paid-only (Starter tier begins at $7.00/month for 512 MB RAM, 0.5 CPU). Free tier is restricted to static sites and spin-down web services.
- **Sleep & Spin-Down Behavior**: Free web services spin down after 15 minutes of inactivity (taking ~30–50s to cold-start). Paid services and Background Workers are always-on and never spin down.
- **Regions**: Oregon (US West), Ohio (US East), Frankfurt (Germany, EU), Singapore (Asia Southeast).
- **Deployment & Signal Handling**: Supports zero-downtime rolling deploys for web services. Sends `SIGTERM` with a 30-second default grace period before `SIGKILL`, allowing workers to drain queues and disconnect from Discord Gateway cleanly.
- **Official Documentation URLs**:
  - Pricing: [https://render.com/pricing](https://render.com/pricing)
  - Background Workers: [https://render.com/docs/background-workers](https://render.com/docs/background-workers)
  - Free Tier Limitations: [https://render.com/docs/free](https://render.com/docs/free)

---

## 2. Fly.io

- **Pricing Model**: Switched in October 2024 to pure Pay-As-You-Go for all new organizations. Legacy free allowances (3 shared-cpu-1x VMs) are only retained for legacy accounts created prior to October 7, 2024. Invoices under $5/mo may be waived at Fly.io discretion as a billing courtesy, but cannot be relied upon as a guaranteed SLA.
- **Machine Types & Pricing**: `shared-cpu-1x` (256 MB RAM) starts at ~$1.94/mo continuously running; `shared-cpu-1x` (512 MB RAM) is ~$3.19/mo.
- **Autostop & Autostart Behavior**: Controlled via `fly.toml` under `auto_stop_machines` and `auto_start_machines`. Web services can suspend when idle, but a persistent Gateway Discord bot worker **must** set `auto_stop_machines = false` (or run without an HTTP service definition) to prevent disconnection from Discord WebSocket Gateway.
- **Persistent Storage**: Fly Volumes cost $0.15/GB per month. Stopped machines continue to accrue root filesystem storage charges ($0.15/GB-mo).
- **Regions**: 35+ global edge regions (including `iad` Ashburn, `fra` Frankfurt, `ams` Amsterdam, `sin` Singapore).
- **Official Documentation URLs**:
  - Pricing: [https://fly.io/docs/about/pricing/](https://fly.io/docs/about/pricing/)
  - Machines Autostop: [https://fly.io/docs/machines/guides-examples/auto-stop-start-machines/](https://fly.io/docs/machines/guides-examples/auto-stop-start-machines/)
  - Billing Overview: [https://fly.io/docs/about/billing/](https://fly.io/docs/about/billing/)

---

## 3. Supabase (Managed PostgreSQL & pgvector)

- **Free Tier Limits**:
  - Database Storage: 500 MB included per organization across up to 2 active free projects.
  - Egress: 5 GB/month database egress + 5 GB cached egress.
  - API Requests: Unlimited.
  - Storage: 1 GB included.
  - Monthly Active Users (Auth): Up to 50,000.
- **Inactivity Pausing**: Free-tier projects are paused after **7 consecutive days of inactivity** (measured by SQL query execution, not API visits). Cold-start unpause takes ~30 seconds. Production deployments require either periodic health queries or upgrade to Pro tier ($25/mo) which disables pausing.
- **Connection Pooling**: Uses **Supavisor** (multi-tenant connection pooler) supporting Transaction mode (port 6543) for stateless serverless functions/jobs and Session mode (port 5432) for persistent workers and migrations.
- **pgvector Support**: Built-in `pgvector` extension enabled via `CREATE EXTENSION IF NOT EXISTS vector;`. Supports `hnsw` (hierarchical navigable small world) and `ivfflat` index types.
- **Row-Level Security (RLS)**: Native PostgreSQL RLS enforced per table. `anon` and `authenticated` keys enforce RLS policies; `service_role` key bypasses RLS and is strictly server-side only.
- **Backups**: Daily automatic backups retained for 7 days on free/pro; Point-In-Time Recovery (PITR) available on Pro with add-on.
- **Official Documentation URLs**:
  - Pricing: [https://supabase.com/pricing](https://supabase.com/pricing)
  - Pausing Policy: [https://supabase.com/docs/guides/platform/pausing](https://supabase.com/docs/guides/platform/pausing)
  - Connection Pooler (Supavisor): [https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
  - pgvector Guide: [https://supabase.com/docs/guides/ai](https://supabase.com/docs/guides/ai)

---

## 4. Cloudflare R2 (S3-Compatible Object Storage)

- **Free Tier Limits**:
  - Storage: 10 GB-months free.
  - Class A Operations (Writes, Lists, Bucket creation): 1,000,000 requests/month free.
  - Class B Operations (Reads, GetObject, HeadObject): 10,000,000 requests/month free.
  - Egress Bandwidth: **$0.00 / Zero egress fees worldwide** regardless of volume.
- **Overage Pricing**:
  - Storage: $0.015 / GB-month (Standard).
  - Class A Operations: $4.50 / 1,000,000 operations.
  - Class B Operations: $0.36 / 1,000,000 operations.
- **Access Control & Presigned URLs**: Supports S3 API SigV4 presigned URLs with configurable expiration (up to 7 days). Private buckets by default; public bucket URLs can be enabled per bucket or bound to custom domains.
- **Object Size Limits**: Single upload limit up to 5 GB (up to 5 TB with multipart upload).
- **Lifecycle Rules**: Automatic object expiration and transition supported natively via bucket lifecycle management.
- **Official Documentation URLs**:
  - Pricing: [https://developers.cloudflare.com/r2/pricing/](https://developers.cloudflare.com/r2/pricing/)
  - API & Presigned URLs: [https://developers.cloudflare.com/r2/api/s3/presigned-urls/](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
  - Limits: [https://developers.cloudflare.com/r2/platform/limits/](https://developers.cloudflare.com/r2/platform/limits/)

---

## 5. Google AI Studio & Gemini API

- **Available Models**: `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`.
- **DATA-USE POLICY (CRITICAL DISTINCTION)**:
  - **Free Tier ("Unpaid Service")**: Google's terms explicitly state that content submitted (prompts, inputs, system instructions, files) and generated outputs **may be used to improve Google products, services, and machine learning models**, and **may be reviewed and annotated by human reviewers**. Google advises users not to submit sensitive, confidential, or personally identifiable information on the free tier.
  - **Paid Tier ("Pay-As-You-Go" via Google Cloud / Vertex AI)**: Customer prompts and generated responses are **NOT** used to train Google models and are not reviewed by humans.
  - **Zero-Retention / Enterprise**: Vertex AI provides enterprise data confidentiality and compliance SLAs.
- **Rate Limits**:
  - Free Tier: `gemini-1.5-flash` allows up to 15 RPM (Requests Per Minute), 1 million TPM (Tokens Per Minute), and 1,500 RPD (Requests Per Day).
  - Paid Tier: Higher concurrency with per-token billing ($0.075 / 1M input tokens for Flash <= 128k context; $0.30 / 1M output tokens).
- **Official Documentation URLs**:
  - Terms of Service: [https://ai.google.dev/terms](https://ai.google.dev/terms)
  - Privacy and Data Governance: [https://ai.google.dev/gemini-api/terms#data-use](https://ai.google.dev/gemini-api/terms#data-use)
  - Pricing: [https://ai.google.dev/pricing](https://ai.google.dev/pricing)

---

## 6. Discord Developer Platform

- **Privileged Gateway Intents**:
  - `Message Content Intent`: Required to read non-mentioned chat messages for the Rules Engine (R01–R50), credential leak detection, and moderation safety filters.
  - `Server Members Intent`: Required to track member join/leaves, onboarding flows, and automated role provisioning.
  - `Presence Intent`: Not strictly required for core operations; should remain disabled unless explicitly needed.
- **Verification & Approval Thresholds**: Bots in **100 or more guilds** require Discord Bot Verification (government ID/business registration) and explicit approval for privileged gateway intents.
- **Gateway Sharding**: Discord recommends 1 shard per 1,000 guilds and strictly requires gateway sharding at **2,500 guilds**.
- **Slash Commands Limits**: Maximum of 100 global chat input commands, 25 options per command, 25 choices per option. Guild-specific commands update instantly; global commands update across all guilds within a few minutes.
- **Rate Limits**: 50 requests per second per bot token globally, with individual bucket limits per REST route and 120 gateway messages per 60 seconds per gateway connection.
- **Official Documentation URLs**:
  - Gateway & Sharding: [https://discord.com/developers/docs/topics/gateway](https://discord.com/developers/docs/topics/gateway)
  - Privileged Intents: [https://discord.com/developers/docs/topics/gateway#privileged-intents](https://discord.com/developers/docs/topics/gateway#privileged-intents)
  - Rate Limits: [https://discord.com/developers/docs/topics/rate-limits](https://discord.com/developers/docs/topics/rate-limits)

---

## 7. Telegram Bot API

- **Rate Limits**: Maximum 30 messages/second globally across all chats; maximum 1 message/second inside a single chat/channel.
- **Message Size Limits**: Text messages max 4,096 UTF-8 characters; captions max 1,024 characters. Files max 50 MB for standard Bot API upload.
- **Privacy Mode**: Enabled by default; bots in groups only receive commands, replies, and mentions unless added as an Administrator.
- **Official Documentation URLs**:
  - Bot API Limits: [https://core.telegram.org/bots/api#broadcasting-to-users](https://core.telegram.org/bots/api#broadcasting-to-users)
  - Bot FAQ: [https://core.telegram.org/bots/faq](https://core.telegram.org/bots/faq)

---

## 8. GitHub Actions & Security

- **Actions Free Minutes**: 2,000 minutes/month for free accounts on private repositories; unlimited for public repositories.
- **Secret Scanning & Push Protection**: Built-in for public repos; free push protection and secret scanning available for private repos across standard organizations.
- **Branch Protection**: Requires Pro/Team plan for private repos or public repo status. Enforces pull request reviews, status check passes, and signed commits.
- **Official Documentation URLs**:
  - Billing for Actions: [https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
  - Secret Scanning: [https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
