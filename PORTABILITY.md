# PORTABILITY.md — Portability & Zero Vendor Lock-in Architecture

**Document Version**: 1.0.0  
**Date**: September 30, 2026  
**Auditor**: Antigravity Cloud Architecture Agent  
**Governing Standard**: Section 27.12 (Portability & Exit Plan)

---

## 1. Portability Guarantees

Nexus is architected from day one as an open, community-owned public good. No vendor-specific proprietary APIs exist in core business logic. All infrastructure dependencies are mediated through strict adapter interfaces:

```
[ Core Nexus Logic ]
       │
  ┌────┼──────────────┬──────────────┐
  ▼    ▼              ▼              ▼
[StorageAdapter] [DatabaseAdapter] [LLMProvider] [QueueAdapter]
  │                    │              │              │
  ├─ Cloudflare R2     ├─ Supabase    ├─ Gemini      └─ Postgres pg_boss
  ├─ MinIO (Local)     ├─ Plain PG    ├─ OpenAI
  └─ Local Disk        └─ SQLite      ├─ Anthropic
                                      └─ Ollama (Local)
```

---

## 2. Vendor Feature Register & Abstraction Map

The table below lists every external service used, the reason for selection, and how it is abstracted to guarantee instant migration:

| External Service | Used In | Reason for Choice | Abstraction Pattern | Alternative / Migration Target |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase** | Cloud DB | Free tier includes pgvector and connection pooler | Standard SQL migrations (`pg` client) | Plain PostgreSQL 15+ or local SQLite |
| **Cloudflare R2** | Cloud Storage | Zero egress bandwidth fees | S3-Compatible API (`StorageAdapter`) | MinIO, AWS S3, or local filesystem |
| **Google Gemini** | Cloud AI | High-speed multimodal and competitive cost | Pluggable `LLMProvider` interface | Ollama, vLLM, OpenAI, Anthropic |
| **Fly.io / Render** | Hosting | Container-native execution and edge routing | Standard `Dockerfile` | Hetzner VPS, Bare-metal, Docker Swarm |
| **Telegram** | Ops Alerts | Mobile push alerts without maintaining custom app | `NotificationService` interface | Discord Webhook, Email, Matrix, Signal |

---

## 3. Migration Guides

### 3.1 Migrating Database: Supabase -> Plain PostgreSQL
1. Export complete schema and data:
   ```bash
   pg_dump -h db.supabase.co -U postgres -d postgres --clean --no-owner > nexus_backup.sql
   ```
2. On the target PostgreSQL 16+ server, ensure `pgvector` is installed:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Restore the backup:
   ```bash
   psql -h target-host -U postgres -d nexus < nexus_backup.sql
   ```
4. Update `DATABASE_URL` in `.env` to point to the new PostgreSQL connection string.

### 3.2 Migrating Storage: Cloudflare R2 -> MinIO
1. Launch MinIO via `docker-compose.selfhost.yml`.
2. Sync all objects using `rclone`:
   ```bash
   rclone sync r2:nexus-private minio:nexus-private --progress
   ```
3. Update environment variables in `.env`:
   ```env
   STORAGE_DRIVER=s3
   S3_ENDPOINT=http://localhost:9000
   S3_BUCKET=nexus-private
   S3_ACCESS_KEY=minioadmin
   S3_SECRET_KEY=minioadmin
   S3_FORCE_PATH_STYLE=true
   ```

### 3.3 Migrating AI: Cloud Gemini -> Local Ollama (100% Offline)
1. Run Ollama on the host:
   ```bash
   ollama run llama3.2
   ```
2. Update `.env`:
   ```env
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```
3. The `PrivacyGate` automatically marks local inference as trusted for all data classifications.
