# VENDORS.md — Third-Party Vendor Register & Data Governance

**Document Version**: 1.0.0  
**Date**: September 30, 2026  
**Auditor**: Antigravity Cloud Architecture Agent  
**Governing Standard**: Section 27.11 (Vendor Register & Exit Strategies)

---

## 1. Third-Party Vendor Register

| Vendor & Service | Data Shared | Primary Purpose | Retention Policy | Region | Data Processing Terms | Exit Plan / Portability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Fly.io** (Compute) | Ephemeral application memory, network IP traffic | Hosts containerized worker and web processes | Zero persistent storage unless volumes attached | Global (`iad`, `fra`) | GDPR DPA standard terms | Re-deploy standard Docker image to Render, Hetzner VPS, or local server in < 15 minutes. |
| **Render** (Alternative Compute) | Ephemeral application memory, build artifacts | Backup hosting provider for worker & API | Zero persistent storage on worker containers | Oregon (US), Frankfurt (EU) | GDPR DPA standard terms | Switch DNS records to Fly.io or self-hosted Docker container. |
| **Supabase** (PostgreSQL Database) | Member profiles, hashed audit events, skill test records, vector embeddings | Relational database persistence and semantic search | Retained until member deletion or lifecycle purge | Frankfurt (EU) / AWS | Standard Cloud DPA; customer owns all data | Run `pg_dump` and restore into any standard PostgreSQL 15+ instance with `pgvector`. |
| **Cloudflare R2** (Object Storage) | Showcase images, encrypted DB snapshots, bug reports | S3-compatible object storage | Lifecycle rules auto-purge bugs after 30d; backups rotated | Global Edge (Egress free) | GDPR compliant DPA | Use `rclone` or S3 API sync to move buckets to MinIO or AWS S3 with zero egress penalty. |
| **Google AI Studio / Gemini API (Paid Tier)** | Redacted prompt text, code snippets (Zero PII, Zero secret tokens) | Conversational vetting, skill evaluation, dialect normalization | No model training on paid tier; ephemeral inference buffers | US / Global | Google Cloud / API Terms of Service (Paid) | Switch adapter `LLM_PROVIDER=ollama` to run completely offline on self-hosted hardware. |
| **Discord Inc.** (Chat Platform) | Moderation commands, channel IDs, Discord user IDs, bot responses | Primary community interaction interface | Subject to Discord terms & member privacy settings | Global | Discord Developer Terms of Service | In the event of platform migration, community data exports and Matrix bridge allow migration. |
| **Telegram Messenger** | Alert summaries, case IDs, dashboard links (Strictly zero member chat logs or PII) | Emergency operations alerts for community founders | 30-day rolling channel history | Global | Telegram Terms of Service | Alerts can be re-routed to Discord staff channel, Signal, or standard email webhooks. |
| **GitHub Inc.** (CI/CD & Source) | Application source code, test suites, non-secret build environment variables | Source control, pull request review, automated regression CI | Governed by repository lifecycle | Global | GitHub Terms of Service | Git repository is fully distributed; clone to GitLab, Gitea, or self-hosted Forgejo instance. |

---

## 2. Privacy & Data Minimization Commitments

1. **Zero Model Training**: Nexus never authorizes third-party model training on member communications.
2. **Zero PII in Alerts**: Operations alerts sent to Telegram or external logging gateways are scrubbed of usernames, emails, and Discord snowflakes.
3. **Right to Be Forgotten**: Member account deletion triggers automated cascading deletions across PostgreSQL, vector indices, and Cloudflare R2 object storage.
