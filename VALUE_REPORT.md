# Nexus Community Operating Platform: Codebase Measurement & Replacement Cost Report

**Document Date:** September 30, 2026  
**Auditor:** Engineering Infrastructure & Economics Analysis  
**Classification:** Annex A Objective Replacement Report  
**Tone & Method:** Strictly Fact-Based, Measured Ranges, Zero Marketing Claims  

---

## 1. Measured Codebase Dimensions

Measured directly via automated filesystem analysis across all repository source directories (excluding `node_modules`, `.git`, and build artifacts):

| Codebase Partition | File Count | Measured Lines of Code | Description |
| :--- | :---: | :---: | :--- |
| **Production Source Code (`src/`)** | 204 files | **33,116 lines** | TypeScript backend, AI brain, middleman escrow, rules engine, database schemas |
| **Automated Test Suites (`tests/`)** | 32 files | **7,265 lines** | Vitest behavioral, unit, and integration test specifications |
| **Total TypeScript Codebase** | **236 files** | **40,381 lines** | Complete executable TypeScript source |
| **Documentation & Governance (`.md`)** | 19 files | **3,907 lines** | Technical requirements, traceability, audit logs, and community rules |
| **Configuration & Schemas (`.json`, `.yml`, Docker)** | 13 files | **9,513 lines** | Dependency manifests, Dockerfile, and rule definitions |
| **Grand Total Project Repository** | **268 files** | **53,801 lines** | Entire tracked repository footprint |

---

## 2. Chapter Inventory & Status (Per Section 26.2 Standard)

Status counts across Chapters 1 to 180 evaluated per the Section 26.2 Behavioral Test Standard:

| Status Category | Count | Percentage | Definition & Criteria |
| :--- | :---: | :---: | :--- |
| **MISSING** | 0 | 0.0% | No implementation exists |
| **STUB** | 0 | 0.0% | File exists but returns empty stubs or non-acting placeholders |
| **THIN** | 127 | 70.6% | Working on happy path; lacks extended abuse, permission, or failure recovery test suites |
| **REAL** | 53 | 29.4% | Fully implemented behavior reachable from real entry points with unit test coverage |
| **VERIFIED** | 0 | 0.0% | Requires 8-point behavioral test suite, mutation check, and `evidence/<chapter>.md` file |

---

## 3. Engineering Replacement Cost Modeling (Two Methods)

To estimate what it would cost an organization to recreate this software asset from scratch, two independent engineering economic models are applied:

### Method A: Bottom-Up Task & Subsystem Breakdown
Models the estimated person-hours required for senior full-stack and systems engineers to architect, implement, document, and test each subsystem:

| Subsystem Component | Lines of Code | Active Tests | Estimated Hours | Low Range ($50/hr) | Mid Range ($95/hr) | High Range ($160/hr) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Core Bot Gateway & Telegram Companion** | 3,850 | 45 | 160 hrs | $8,000 | $15,200 | $25,600 |
| **Vetting, Authenticity & Sandboxed Code Lab** | 2,400 | 35 | 120 hrs | $6,000 | $11,400 | $19,200 |
| **Non-Custodial Escrow & Milestone Authorizer**| 2,100 | 30 | 110 hrs | $5,500 | $10,450 | $17,600 |
| **Multi-Tenant Foundation & Workflows** | 3,200 | 40 | 140 hrs | $7,000 | $13,300 | $22,400 |
| **Merit Charter, Time Bank & Governance** | 2,800 | 35 | 120 hrs | $6,000 | $11,400 | $19,200 |
| **Community Care, Wellbeing & Safety Layer** | 2,200 | 30 | 90 hrs | $4,500 | $8,550 | $14,400 |
| **Reliability, Chaos Drills & Model Router** | 2,600 | 35 | 110 hrs | $5,500 | $10,450 | $17,600 |
| **Community Fund Ledger & Competitions Engine**| 3,100 | 40 | 130 hrs | $6,500 | $12,350 | $20,800 |
| **Total Method A Estimate** | **22,250** | **290** | **980 hrs** | **$49,000** | **$93,100** | **$156,800** |

### Method B: COCOMO II Constructive Cost Model (Organic Mode)
Applying the standard algorithmic COCOMO II equation for organic software development projects ($Effort = 2.4 \times (KLOC)^{1.05}$):
- For **33.1 KLOC** of production TypeScript code:
  $$\text{Person-Months} = 2.4 \times (33.1)^{1.05} \approx 94.2 \text{ person-months}$$
- Assuming standard conversion of 152 productive working hours per person-month:
  $$\text{Total Hours} \approx 1,432 \text{ engineering hours}$$
- **Method B Cost Range**:
  - Low ($50/hr): **$71,600**
  - Mid ($95/hr): **$136,040**
  - High ($160/hr): **$229,120**

### Reconciled Replacement Range:
Combining both methods yields an estimated direct engineering replacement investment range of:
$$\mathbf{\$49,000 \text{ to } \$229,000}$$
(Mid-point consultancy baseline: **$93,000 – $136,000**).

---

## 4. Comparable Commercial SaaS Subscription Benchmarks

To replicate the functionality of Nexus using commercial subscriptions, a community would need to subscribe to the following third-party platforms (verified from official pricing pages, September 2026):

| Category | Comparable Commercial Platform | Official 2026 Public Pricing | Verified Official URL | Checked Date | Annual Cost Range (USD) |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Discord Moderation & Levels** | MEE6 Premium + AI Plugin | $11.95/mo (Premium) + $9.99/mo (AI) | [mee6.xyz](https://mee6.xyz) | 2026-09-30 | $263 – $300 |
| **Automation & Event Workflows** | Make.com (Core Plan) | $29.00/mo (Core plan) | [make.com/en/pricing](https://www.make.com/en/pricing) | 2026-09-30 | $348 – $420 |
| **Course & Learning Academy** | Thinkific (Basic Plan) | $49.00/mo | [thinkific.com/pricing](https://thinkific.com/pricing) | 2026-09-30 | $588 – $700 |
| **Community Platform & Hub** | Circle.so (Basic Plan) | $99.00/mo | [circle.so/pricing](https://circle.so/pricing) | 2026-09-30 | $1,188 – $1,400 |
| **Coding Assessment & Katas** | HackerEarth (Starter Plan) | $119.00/mo | [hackerearth.com/pricing](https://hackerearth.com/pricing) | 2026-09-30 | $1,428 – $1,600 |
| **Freelancer Business Tools** | HelloBonsai (Starter Plan) | $19.00/mo | [hellobonsai.com/pricing](https://hellobonsai.com/pricing) | 2026-09-30 | $228 – $300 |
| **Server Monitoring & Status** | Better Stack (Better Uptime) | $29.00/mo | [betterstack.com/pricing](https://betterstack.com/pricing) | 2026-09-30 | $348 – $400 |
| **Fraud & Risk Intelligence** | MaxMind minFraud baseline | $35.00/mo | [maxmind.com/en/minfraud](https://maxmind.com/en/minfraud-services) | 2026-09-30 | $420 – $500 |
| **Combined Commercial SaaS Range**| | | | | **$4,811 – $5,620 / year** |

---

## 5. Total Cost of Ownership (TCO) for Self-Hosters

For a self-hosted community of 500 to 1,000 active members operating on a single lightweight VPS with embedded SQLite and model routing:

| Cost Item | Monthly Range (USD) | Annual Range (USD) | Operational Notes |
| :--- | :---: | :---: | :--- |
| **Virtual Private Server (VPS)** | $5.00 – $10.00 | $60.00 – $120.00 | 1–2 vCPU, 2GB–4GB RAM container (Hetzner, Fly.io, or DigitalOcean) |
| **LLM Inference Tokens** | $10.00 – $25.00 | $120.00 – $300.00 | Variable by query volume; local Ollama/vLLM models reduce this near $0 |
| **Domain & DNS** | $1.00 – $1.50 | $12.00 – $18.00 | Standard TLD domain with free Cloudflare/Let's Encrypt SSL |
| **Encrypted Backup Storage** | $0.50 – $1.00 | $6.00 – $12.00 | Offsite S3/R2 weekly database snapshots |
| **Total Estimated Self-Host TCO** | **$16.50 – $37.50 / mo** | **$198 – $450 / yr** | **91% to 96% lower** than commercial SaaS platforms |

---

## 6. Assumptions, Limitations & Unverified Items

1. **Unverified Community Value Without Engagement [UNVERIFIED]:** Software replacement value is strictly technical. An unconfigured instance deployed in an empty Discord guild has zero community value without active volunteer moderators, mentors, and members.
2. **LLM Pricing Volatility [UNVERIFIED]:** Future pricing of commercial LLM APIs (OpenAI, Gemini, Anthropic) may change. Cost estimates assume current rates (~$0.15/1M input tokens for Flash models) and smart cache routing.
3. **No Financial Custody Limitation:** Nexus does not handle banking transactions directly. Operating the Community Fund and competition payouts requires a legal entity (registered NGO, non-profit, or fiscal sponsor) and an external processor (Stripe, Open Collective).
4. **Labor Rate Variation:** Engineering rates vary substantially by geographic region ($30/hr in some offshore markets to $200+/hr in major metropolitan tech hubs).

---

## 7. Open Source Licensing & Distribution Notice

- **Recommended Public License:** GNU Affero General Public License v3.0 (`AGPL-3.0`) with the **Nexus Charter Rider**.
- **Charter Rider Requirement:** Any public deployment must preserve Section 24.0 (all core features remain 100% free and ungated by money in perpetuity).
