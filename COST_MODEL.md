# COST_MODEL.md — Infrastructure Cost Model & Projections

**Document Version**: 1.0.0  
**Date**: September 30, 2026  
**Auditor**: Antigravity Cloud Architecture Agent  
**Standard**: Section 27.1 (Facts Before Design & Objective Reporting)

---

## 1. Verified Unit Prices (Official Benchmarks)

| Service Component | Provider | Unit Metric | Verified Unit Price | Official Pricing URL |
| :--- | :--- | :--- | :--- | :--- |
| **Worker Compute** | Fly.io | shared-cpu-1x (256MB RAM) | **$0.0027/hour (~$1.94/mo)** | [fly.io/pricing](https://fly.io/docs/about/pricing/) |
| **Web Compute** | Fly.io | shared-cpu-1x (with autostop) | **~$0.0010/hour (~$0.72/mo)** | [fly.io/pricing](https://fly.io/docs/about/pricing/) |
| **Alternative Compute** | Render | Background Worker (Starter) | **$7.00/month flat** | [render.com/pricing](https://render.com/pricing) |
| **Database (Free)** | Supabase | Up to 500 MB storage | **$0.00/month** (paused at 7d idle) | [supabase.com/pricing](https://supabase.com/pricing) |
| **Database (Pro)** | Supabase | 8 GB storage + unpaused + PITR | **$25.00/month flat** | [supabase.com/pricing](https://supabase.com/pricing) |
| **Object Storage Base** | Cloudflare R2 | First 10 GB storage | **$0.00/month** | [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2/pricing/) |
| **Object Storage Overage** | Cloudflare R2 | Per GB above 10 GB | **$0.015 / GB-month** | [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2/pricing/) |
| **Storage Class A Ops** | Cloudflare R2 | 1M free, then per 1M | **$4.50 / 1,000,000 ops** | [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2/pricing/) |
| **Storage Class B Ops** | Cloudflare R2 | 10M free, then per 1M | **$0.36 / 1,000,000 ops** | [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2/pricing/) |
| **Egress Bandwidth** | Cloudflare R2 | Outbound data transfer | **$0.00 (Zero egress fees)** | [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2/pricing/) |
| **AI LLM Input** | Gemini 1.5 Flash | Pay-as-you-go (Paid Tier) | **$0.075 / 1,000,000 tokens** | [ai.google.dev/pricing](https://ai.google.dev/pricing) |
| **AI LLM Output** | Gemini 1.5 Flash | Pay-as-you-go (Paid Tier) | **$0.300 / 1,000,000 tokens** | [ai.google.dev/pricing](https://ai.google.dev/pricing) |
| **Operations Telegram** | Telegram | Bot API broadcasts & alerts | **$0.00 (Free)** | [core.telegram.org/bots](https://core.telegram.org/bots/api) |
| **CI / CD Pipeline** | GitHub Actions | 2,000 build minutes/month | **$0.00 (Free tier)** | [docs.github.com/billing](https://docs.github.com/en/billing) |

---

## 2. Monthly Cost Scale Projections

Projections evaluate ongoing community sizes: **100 members**, **1,000 members**, **5,000 members**, and **10,000 members**.

| Community Scale | Compute (Fly.io) | Database (Supabase) | Storage (Cloudflare R2) | AI (Gemini Paid) | Total Monthly Cost | Cost Per Member/Mo |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **100 Members** | $2.66 | $0.00 (Free tier) | $0.00 (Within 10GB free) | $0.08 | **$2.74 / mo** | $0.027 |
| **1,000 Members** | $2.66 | $0.00 (Free tier) | $0.00 (Within 10GB free) | $0.75 | **$3.41 / mo** | $0.003 |
| **5,000 Members** | $4.85 | $25.00 (Pro unpaused) | $0.15 (20 GB storage) | $3.50 | **$33.50 / mo** | $0.007 |
| **10,000 Members** | $6.80 | $25.00 (Pro unpaused) | $0.45 (40 GB storage) | $9.00 | **$41.25 / mo** | $0.004 |

*Alternative Compute (Render)*:
- If deployed on Render instead of Fly.io: Add $7.00/mo for Background Worker Starter instance. Total cost is ~$7.08/mo (100 members), ~$7.75/mo (1,000 members), ~$38.65/mo (5,000 members), and ~$47.45/mo (10,000 members).

---

## 3. Assumptions Register

Every assumption used in the calculations is documented below with its verification status:

| Assumption ID | Parameter | Value Assumed | Verification Status | Operational Rationale |
| :--- | :--- | :--- | :---: | :--- |
| **ASSUME-01** | Messages per active member/day | 5 messages | `UNVERIFIED` | Based on standard developer community activity ratios. |
| **ASSUME-02** | Moderation scan ratio | 100% evaluated by A-mode regex; 8% escalated to LLM | `UNVERIFIED` | S1-S4 Rules Engine mode guards filter trivial messages locally without calling AI. |
| **ASSUME-03** | Image attachment uploads | 0.05 uploads/member/day, avg 400 KB | `UNVERIFIED` | Design showcases, code screenshots, and bug reports. |
| **ASSUME-04** | Webhook intake frequency | 2 webhooks/member/month | `UNVERIFIED` | Meta lead intake, GitHub repository webhooks, and payment notifications. |
| **ASSUME-05** | Supabase free-tier idle queries | Heartbeat runs daily | `VERIFIED` | Heartbeat scheduled job in bot worker prevents the 7-day inactivity pause on Free tier. |
| **ASSUME-06** | Gemini data-use policy | Paid tier strictly required for private content | `VERIFIED` | Official Google AI Studio terms state free tier prompts may be used for model training and reviewed by humans. |

---

## 4. Cost Protection Invariants & Hard Caps

1. **AI Circuit Breaker**: Hard monthly spend cap set to **$25.00/month** in Google Cloud billing. At 80% ($20.00), Telegram operations receives an alert. At 95% ($23.75), non-essential AI services (e.g. video storyboarding, brand tone optimization) pause, falling back to local deterministic Rules Engine Mode A.
2. **Database Space Watchdog**: Automated nightly audit verifies PostgreSQL disk usage. At 400 MB (80% of Supabase Free 500 MB), an automated snapshot purge archives inactive channel transcripts to Cloudflare R2.
3. **Storage Lifecycle Expiry**: Bug reports and ephemeral screenshots automatically expire and delete after 30 days via Cloudflare R2 lifecycle rules, preventing unbounded storage accumulation.
