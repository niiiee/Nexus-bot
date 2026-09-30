# Nexus Platform Pricing & Commercialization Strategy (PRICING.md)

## 1. Plan Tiers & Entitlement Matrix

| Dimension | Free (Starter) | Pro (Community Hub) | Business (Academy/Agency) | Enterprise (Scale) |
|---|---|---|---|---|
| **Target Audience** | Early stage servers, side projects | Independent creators, dev groups (up to 1k members) | Bootcamps, design studios, agencies | Multi-server networks, venture bootcamps |
| **Monthly Price (USD)** | **\$0** / month | **\$49** / month | **\$199** / month | **Custom** (from \$699/mo) |
| **Annual Price (20% Off)** | \$0 | **\$39** / mo (\$468 billed annually) | **\$159** / mo (\$1,908 billed annually) | Custom annual contract |
| **Tracked Members** | Up to 150 | Up to 1,500 | Up to 10,000 | Unlimited |
| **AI Invocations / Mo** | 250 calls | 5,000 calls | 30,000 calls | Custom allocation / pooled |
| **Storage (Transcripts/Media)** | 500 MB | 10 GB | 100 GB | 1 TB+ Dedicated GCS/S3 |
| **Multi-Tenancy** | Single server | Up to 2 servers | Up to 5 servers | Unlimited federated tenants |
| **Workflow Automations** | 3 active workflows | 20 active workflows | Unlimited workflows | Unlimited + custom code steps |
| **Custom Branding / White-Label** | Nexus branded | Embed colors & name | Full white-label + custom domain | Dedicated bot instance + custom domain |
| **Plugin Marketplace** | Free plugins only | Free + paid plugins | Free + paid + private plugins | Private internal registry |
| **Ask Nexus Conversational Analytics** | Standard metrics | Full text-to-query | Full text-to-query + CSV export | Dedicated data warehouse connector |
| **Talent Graph & Smart Matching** | Basic search | AI smart matching | Smart matching + team assembly | Custom matching algorithms + API |
| **Verifiable Credentials** | Standard badge | Signed credentials (QR) | Custom templates + verification portal | Portable W3C-compliant credentials |
| **Support & SLA** | Community Discord | Email & Discord (24h) | Priority Discord & Zoom (4h) | 99.95% SLA + dedicated TAM |

---

## 2. Usage-Based Metered Add-ons

For communities scaling past their included plan allocations, optional transparent overages are billed via Stripe without interrupting live server operations:

| Add-on Resource | Unit | Price (USD) |
|---|---|---|
| **AI Inference Overages** | Additional 1,000 tokens (Gemini / Claude / OpenAI) | \$0.015 / 1k tokens |
| **Cloud Storage** | Additional 10 GB SSD storage | \$2.50 / month |
| **Additional Tenant Server** | Per connected Discord guild | \$25 / guild / month |
| **Outbound Webhook Delivery** | 100,000 webhook events | \$5.00 / month |
| **Verified Credential Batch** | 500 signed tamper-evident credentials | \$10.00 / batch |

---

## 3. Unit Economics & Gross Margin Targets

### A. Cost Structure per Active Member (Monthly)
Based on standard community activity benchmarks (averaging 15 message turns, 2 AI queries, 1 verification attempt per active member per month):

- **LLM Inference**:
  - Blended model mix: Gemini 1.5 Flash (80% routine tasks) + Gemini 1.5 Pro / Claude 3.5 Sonnet (20% code review & talent match).
  - Average tokens per active member: ~12,000 tokens/mo.
  - Blended cost: **\$0.014 per member / month**.
- **Database & Compute Infrastructure** (SQLite / NVMe / Redis cache):
  - Container compute and memory footprint: **\$0.006 per member / month**.
- **Network Egress & Webhooks**:
  - **\$0.002 per member / month**.
- **Total Direct COGS per Active Member**: **\$0.022 / month**.

### B. Gross Margin by Plan (At Typical Capacity)
1. **Pro Tier (\$49/mo)**:
   - Typical active members: ~500.
   - Total Monthly COGS: $500 \times \$0.022 = \$11.00$.
   - Payment Gateway Fee (Stripe 2.9% + \$0.30): \$1.72.
   - Net Contribution: $\$49 - \$12.72 = \$36.28$.
   - **Gross Margin**: **74.0%**.

2. **Business Tier (\$199/mo)**:
   - Typical active members: ~3,000.
   - Total Monthly COGS: $3,000 \times \$0.022 = \$66.00$.
   - Payment Gateway Fee (Stripe 2.9% + \$0.30): \$6.07.
   - Net Contribution: $\$199 - \$72.07 = \$126.93$.
   - **Gross Margin**: **63.8%** (scales to **75.4%** with annual contracts and volume caching).

3. **Break-Even Analysis**:
   - Fixed Monthly Infrastructure Cost (Core VM cluster, Redis, Domain, CI/CD): **\$240 / month**.
   - Break-even is reached at **5 Pro customers** or **2 Business customers**.
