# ARCHITECTURE.md — Nexus Cloud Reference Architecture

**Document Version**: 2.7.0  
**Date**: September 30, 2026  
**Auditor**: Antigravity Cloud Architecture Agent  
**Governing Standard**: Section 27.2 (Reference Architecture & Degradation Matrix)

---

## 1. System Topology & Data-Flow Diagram

```mermaid
flowchart TD
  subgraph External Clients & Platforms
    DU[Discord Users & Clients]
    DGW[Discord Gateway WebSocket]
    MU[Meta / Facebook Lead Webhook]
    GU[GitHub Webhook / Partner APIs]
    TO[Telegram Operations Private Channel]
  end

  subgraph Ingress & Compute Services
    BW["Bot Worker (Persistent Worker)
    - Discord.js Gateway Client
    - Rules Engine Pipeline
    - Mode A/S/H/C Guards
    - Event Handlers"]
    
    API["Web / API Service (Public HTTPS)
    - Admin & Member Dashboard
    - Inbound Webhook Handlers
    - HMAC Signature Verification
    - OAuth2 Callbacks"]
    
    JQ["Job Queue & Scheduler (Postgres-Backed)
    - Idempotent Job Execution
    - Exponential Backoff & DLQ
    - Scheduled Maintenance & Purges"]
  end

  subgraph Persistence & Storage Tier
    PG[("Supabase PostgreSQL
    - Relational Entities
    - pgvector Embeddings (HNSW)
    - Hash-Chained Audit Store
    - Tenant RLS Enforcement")]
    
    LS[("Lead Staging Schema
    - Ephemeral Ingestion
    - Separate Encryption Key
    - Strict TTL & Auto-Purge")]
    
    R2[("Cloudflare R2 Storage (S3 API)
    - private-media / public-assets
    - Encrypted Database Backups
    - Short-Lived Presigned URLs")]
  end

  subgraph Intelligence & External Layer
    PGATE["AI Privacy Gate & Redaction
    - PII & Secret Redaction
    - Tier Training-Use Barrier
    - Multimodal Injection Shield"]
    
    LLM["LLM Provider Adapter
    - Gemini 1.5 Flash (Paid Tier)
    - Local Ollama / vLLM Fallback
    - Token & Cost Metering"]
  end

  %% Connections
  DU <-->|WebSocket & Voice| DGW
  DGW <-->|Gateway Events| BW
  MU -->|Signed Webhook| API
  GU -->|Signed Webhook| API
  
  BW -->|Enqueue Task| JQ
  API -->|Enqueue Task| JQ
  JQ -->|Execute Work| BW
  
  BW <-->|Session SQL & Vectors| PG
  API <-->|Pooled SQL & Webhooks| PG
  API -->|Stage Inbound Leads| LS
  
  BW -->|Store Key & Get Presigned URL| R2
  API -->|Direct Upload Presigned URL| R2
  
  BW -->|Query AI (Redacted)| PGATE
  PGATE -->|Sanitized Prompt| LLM
  
  BW -.->|Ops Alerts (No PII)| TO
  JQ -.->|Failure & Quota Alerts| TO
```

---

## 2. Core Architectural Components

### 2.1 Bot Worker (Persistent Worker)
- **Role**: Maintains persistent WebSocket connection to Discord Gateway (`discord.js` v14).
- **Process Model**: Long-running background daemon process (1 per shard group; single-shard up to 2,500 guilds).
- **Statelessness**: Holds no local state on disk. All state resides in PostgreSQL or Cloudflare R2. Can be terminated and restarted safely; Gateway resumes via Discord session resume IDs without dropping queued events.
- **Internal Modules**: Rules Engine pipeline (Modes A/S/H/C), context exemption validators, dialect normalizer, command router, AI orchestration client.

### 2.2 Web / API Service (Stateless Web Service)
- **Role**: Serves member dashboard, administrative panel, OAuth2 authentication callbacks, and inbound webhooks (Meta Facebook leads, Stripe payment events, GitHub PR/issue notifications).
- **Security**: Public HTTPS endpoint. Every webhook handler cryptographically verifies HMAC signatures (e.g., `X-Hub-Signature-256`, Stripe signatures) with replay protection before processing payloads.
- **Isolation**: Runs in an independent container/process from the Bot Worker. Heavy web traffic cannot starve Gateway heartbeat threads.

### 2.3 Job Queue & Scheduler (PostgreSQL-Backed)
- **Implementation**: Utilizes PostgreSQL-backed job queuing (similar to `pg-boss` or custom transactional queue table `pg_job_queue`) to eliminate the operational overhead of maintaining a separate Redis cluster.
- **Idempotency**: All jobs carry a unique `idempotency_key`. Repeating a job payload results in a no-op.
- **Reliability**: Jobs feature exponential backoff retry policies (1s, 5s, 30s, 5m), automatic dead-letter queue (DLQ) promotion after 5 failed attempts, and crash recovery.
- **Scheduled Tasks**: Executes nightly database vacuuming, audit hash-chain integrity checks, lead staging TTL purges, and weekly executive digest generation.

### 2.4 Database Tier (Supabase PostgreSQL + pgvector)
- **Tenancy**: Every tenant-scoped table incorporates `tenant_id` and is guarded by native PostgreSQL Row-Level Security (RLS) policies set to default-deny.
- **Semantic Memory**: The `community_embeddings` table leverages `pgvector` with HNSW indices. Stores model identifiers, vector dimensions, and strictly enforces role-based channel visibility filtering *before* returning vector search results.
- **Lead Staging (Section 22)**: Isolated in a separate database schema (`lead_staging`) with dedicated cryptographic encryption keys, strict 7-day TTL expiration, and zero foreign keys into permanent member tables.
- **Audit Store (Chapter 191)**: Append-only hash-chained ledger (`audit_events_chain`) where application database roles have `INSERT` and `SELECT` rights only (`UPDATE` and `DELETE` revoked).

### 2.5 Object Storage (Cloudflare R2)
- **Privacy Standard**: Buckets are private by default (`private-media`, `backups`, `quarantine`). Public bucket access is restricted solely to explicitly approved showcase items (`public-assets`).
- **Access Control**: Database stores object keys, MIME types, and SHA-256 hashes—never permanent public URLs. Access is granted via short-lived (15-minute) SigV4 presigned URLs generated after checking member permissions.
- **Zero Egress**: Eliminates egress cost spikes during portfolio reviews and automated backup operations.

### 2.6 AI Layer (Google Gemini & Local Fallbacks)
- **Privacy Gate**: Intercepts all outgoing LLM requests. Audits the destination provider against `PRIVACY_AI.md`. Redacts PII, access tokens, and sensitive financial references.
- **Multimodal Pipeline**: Treats all image text and metadata as untrusted user input to defend against visual prompt injections.

### 2.7 Operations & Notification Layer (Telegram)
- **Role Boundary**: Telegram serves strictly as an operations monitoring channel and consent-based archive.
- **Data Minimization**: Never transmits raw member chat logs, message content, attachments, or PII. Messages consist strictly of severity badges, case IDs, and authenticated dashboard links.

---

## 3. Component Degradation Matrix (Failure Modes)

The system is designed with rigorous graceful degradation. If any dependency experiences an outage, core community safety remains functional:

| Component Outage | Impact on System | Surviving Capabilities | Fallback / Recovery Mechanism |
| :--- | :--- | :--- | :--- |
| **Gemini AI Outage** | AI reasoning, tutor agents, and semantic summaries unavailable. | **100% of Rules Engine Mode A rules remain active** (regex, wordlists, rate limits, phishing defense continue). | Inbound tasks queue in Postgres; non-essential AI features fall back to local models or return friendly "AI temporarily offline" notices. |
| **Cloudflare R2 Outage** | Image attachment previews and new file uploads fail. | Text chatting, onboarding, verification quizzes, deal logging, and rules enforcement continue normally. | File upload attempts receive a clean error: *"Storage temporarily unavailable. Please retry shortly."* No database corruption. |
| **Telegram API Outage** | Operations alerts to staff phones fail to deliver. | **All bot operations, Discord interactions, and database transactions continue without interruption.** | Failed alerts queue in `pg_job_queue` with exponential backoff. Flushed to Telegram upon API restoration. |
| **Supabase DB Outage** | Database reads and writes fail. | Bot detects disconnect and enters **Safe Read-Only Shadow Mode**. Gateway connection stays alive. | **Bot never guesses or hallucinates state.** Logs critical alerts to stderr and memory buffer; automatically reconnects when DB recovers. |
| **Meta / Webhook Ingress Down** | External lead webhooks fail to reach the server. | Existing Discord community operations, mentorship, and deals continue unaffected. | Meta retries webhook delivery with backoff; Web service processes queued leads upon recovery. |
| **Web Service Down** | Dashboard and webhooks inaccessible. | **Bot Worker continues running on Discord Gateway.** Chat moderation, skill tests, and commands remain fully active. | Rolling restart of web container; health-check probes restart container automatically. |
