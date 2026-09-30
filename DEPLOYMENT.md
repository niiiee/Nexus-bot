# DEPLOYMENT.md — Step-by-Step Production Deployment Guide

**Document Version**: 2.7.0  
**Date**: September 30, 2026  
**Auditor**: Antigravity Cloud Architecture Agent  
**Governing Standard**: Section 27.3 & Section 27.14 (Screenshot-free, command-based checklists)

---

## 1. Pre-Deployment Prerequisites

Ensure the following tools are installed locally:
- Node.js (v20.0.0+) & npm
- Docker & Docker Compose
- `flyctl` (for Fly.io) or Render CLI
- Discord Bot Token with privileged intents enabled (`DISCORD_SETUP.md`)

---

## 2. Option A: Deployment to Fly.io (Recommended Cloud Target)

Fly.io provides independent scaling for the persistent Gateway worker and the public Web service:

### Step 1: Authentication & App Launch
```bash
# Login to Fly.io
fly auth login

# Launch app using the reference fly.toml configuration
fly launch --no-deploy --copy-config
```

### Step 2: Configure Production Secrets
Set all required platform secrets in Fly's encrypted store:
```bash
fly secrets set \
  NODE_ENV="production" \
  DISCORD_TOKEN="your_discord_token" \
  DISCORD_CLIENT_ID="your_client_id" \
  DISCORD_CLIENT_SECRET="your_client_secret" \
  DATABASE_URL="postgres://postgres.xxx:xxx@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  DIRECT_DATABASE_URL="postgres://postgres:xxx@db.xxx.supabase.co:5432/postgres" \
  STORAGE_DRIVER="s3" \
  S3_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com" \
  S3_BUCKET="nexus-private" \
  S3_ACCESS_KEY="<r2_access_key>" \
  S3_SECRET_KEY="<r2_secret_key>" \
  LLM_PROVIDER="gemini" \
  GEMINI_API_KEY="AIzaSy..." \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  TELEGRAM_BOT_TOKEN="your_telegram_bot_token" \
  TELEGRAM_BACKUP_CHANNEL_ID="-1001234567890"
```

### Step 3: Run Database Migrations
```bash
# Execute initial schema and RLS policies against the production database
npm run migrate:pg
```

### Step 4: Deploy Multi-Process Application
```bash
# Deploys both 'app' (web service) and 'worker' (Discord Gateway) defined in fly.toml
fly deploy --ha=false
```

### Step 5: Verify Deployment Status
```bash
fly status
fly logs
```

---

## 3. Option B: Deployment to Render

### Step 1: Push Configuration
Render uses `render.yaml` infrastructure-as-code:
1. Connect your GitHub repository to Render.
2. In the Render Dashboard, click **New** -> **Blueprint**.
3. Select the repository containing `render.yaml`.

### Step 2: Set Secret Environment Variables
In the Render Blueprint sync view, populate the required secret environment variables:
- `DISCORD_TOKEN`
- `DATABASE_URL`
- `GEMINI_API_KEY`
- `S3_ACCESS_KEY` & `S3_SECRET_KEY`
- `SESSION_SECRET`

### Step 3: Trigger Blueprint Deployment
Render will build the Docker container and spin up:
- `nexus-web`: Web Service (Dashboard + Webhooks)
- `nexus-worker`: Background Worker (Always-On Gateway connection)

---

## 4. Option C: Self-Hosted Profile (Zero Cloud Dependencies)

Run the entire Nexus operating system locally or on a private VPS using `docker-compose.selfhost.yml`:

### Step 1: Clone & Configure Environment
```bash
cp .env.example .env
```
Edit `.env` to set:
```env
DATABASE_URL=postgres://nexus_user:nexus_password@localhost:5432/nexus_db
STORAGE_DRIVER=s3
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=nexus-private
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```

### Step 2: Launch Self-Host Infrastructure
```bash
docker compose -f docker-compose.selfhost.yml up -d
```

This single command brings up:
- PostgreSQL 16 with `pgvector` pre-configured
- MinIO Object Storage (S3-compatible API) with bucket auto-initialization
- Ollama local AI server with `llama3.2` model
- Nexus Web Service (Port 3000)
- Nexus Bot Worker (Discord Gateway client)

### Step 3: Verify Health
Access the dashboard at `http://localhost:3000/health` or execute:
```bash
curl http://localhost:3000/api/health
```
