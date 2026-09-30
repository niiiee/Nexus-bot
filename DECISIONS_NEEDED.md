# DECISIONS_NEEDED & CHARTER RESOLUTIONS

This document records architectural decisions, interpretations, and safety resolutions for Sections 24 and 25 of the Nexus platform.

## Charter Interpretation Directives (Hardcoded & Inviolable)

### 1. Commercialization vs. Full Freedom Errata
- **Question**: Section 23 introduced commercial subscription tiers (Free, Pro, Business, Enterprise) and Stripe billing. Section 24.0 explicitly overrides earlier monetization: "Nexus is a fully free community. There is NO class system tied to money."
- **Resolution**:
  - The core Nexus platform operates as a **100% free community operating system**.
  - All paywalls, plan gates, and upsell prompts in Chapter 2 are replaced with a uniform **Fair-Use & Resource Guard** where resource limits are identical across all tenants and members for infrastructure protection.
  - White-label features (Chapter 3) and Plugin Commons (Chapter 4) are completely free for all self-hosters and communities.
  - In `subscriptionEngine.ts`, commercial tier gates are disabled in favor of fair-use quotas, and only voluntary, passive donation links are exposed.

### 2. Money Handling and Bot Custody
- **Question**: Chapter 152 and Chapter 167 describe donations and competition prize payouts. Does the bot ever hold, deposit, transfer, or custody fiat or cryptocurrency?
- **Resolution**:
  - **Zero-Custody Guarantee**: The bot **never** holds or moves funds. All financial transactions are managed entirely by external licensed payment providers (Stripe, Open Collective) or registered fiscal hosts.
  - The bot consumes verified webhook events, updates an append-only transparency ledger, and facilitates a dual-human approval workflow for authorizations. Payouts must be executed externally by the payment provider/fiscal host.

### 3. Donor Advantage Elimination
- **Question**: Could donors receive cosmetic badges, priority in review queues, or voting weight in community competitions?
- **Resolution**:
  - **Zero Advantage Rule**: Donating confers **zero** mechanical advantages, zero roles, zero badges, zero queue priority, zero extra votes, and zero influence on moderation or contest judging.
  - A donor's name may only appear on an opt-in, unranked public thank-you list that carries no special status.
  - The automated `DonorFairnessGuard` (Chapter 161) runs adversarial checks to verify that donation events never alter user permissions, ranks, or scores.

### 4. Voluntary Giving and Notification Ceilings
- **Question**: How frequently can the community fund or donation requests be surfaced to members?
- **Resolution**:
  - Passive donation links only; active prompts are capped at **maximum 1 mention per member per month**.
  - A copy linter rejects any guilt-inducing or manipulative language.
  - Members have a 1-click preference to permanently opt out of all donation notifications.

### 5. Section 26: Rule Enforcement Mode Guards & Dual Human Bans
- **Question**: Can automated moderation ever permanently ban a user or issue long timeouts?
- **Resolution**:
  - **Mode Guards Hardcoded in Code**: Mode A automated actions are physically restricted to: delete message, reminder, warning, and timeout of at most 1 hour.
  - Mode S (Supervisory) can only hide content and open a case for human staff review.
  - Mode H (Hold) can only collect evidence, apply a protective hold, and notify moderators.
  - **Permanent Bans**: Strictly forbidden for bots or automated logic. A permanent ban requires explicit action by a human moderator, confirmed by a second human moderator.

### 6. Section 26: Mental Health Care Exception (R24)
- **Question**: If a message expresses distress, depression, or self-harm, should it trigger spam or conduct penalties?
- **Resolution**:
  - **Care Exception (Mode C)**: Strictly **0 points** and zero punitive actions. The user receives compassionate private resources and verified helpline contacts, and a designated trained care moderator is discreetly alerted.

### 7. Section 26: Objective Reporting & Valuation Policy
- **Question**: How should project valuation, test counts, and progress be presented?
- **Resolution**:
  - Never use subjective or marketing claims ("certified", "worth $X").
  - Report exact measured lines of code, passing behavioral test counts, realistic developer hour ranges, and official pricing page URLs with access dates.
  - Any unverified assumption or limitation must be explicitly highlighted.
