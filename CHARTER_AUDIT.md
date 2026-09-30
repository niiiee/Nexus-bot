# CHARTER_AUDIT.md - The Nexus Charter Conformance Audit

**Audit Date:** September 30, 2026  
**Auditor:** Senior Infrastructure & Governance Verification Gate  
**Standard:** Section 24.0 (The Nexus Charter) & Section 25.0 (Community Fund Principles)  
**Status:** FULLY CONFORMANT (No Money Gating, Zero Custody, Zero Donor Perks)

---

## 1. Executive Conformance Summary

An exhaustive audit was conducted across all codebase routes, billing modules, subscription engines, database schemas, and permission checks to verify complete compliance with **The Nexus Charter (Section 24.0)** and **Community Fund Principles (Section 25.0)**.

| Charter Directive | Codebase File(s) Inspected | Audit Finding | Status |
| :--- | :--- | :--- | :---: |
| **1. Free Core Guarantee** | `src/modules/merit/meritCharterEngine.ts`, `src/modules/billing/subscriptionEngine.ts` | All 11 core functional domains (verification, learning, portfolio, jobs, deals, escrow, help, events, mentorship, AI helpers, safety) are universally ungated. | **CONFORMANT** |
| **2. Universal Fair-Use Guard** | `src/modules/billing/subscriptionEngine.ts` | Chapter 2 commercial paywalls are overridden by `FairUseResourceGuard` with uniform 50,000-member quotas for all communities. | **CONFORMANT** |
| **3. Free White-Labeling** | `src/modules/platform/brandingManager.ts` | Custom branding, embed styling, and "Powered by Nexus" badge removal are free for all self-hosters and communities via `charterFreeMode`. | **CONFORMANT** |
| **4. 0% Plugin Revenue Cut** | `src/modules/plugins/pluginMarketplace.ts`, `src/modules/distribution/communityDistribution.ts` | Converted to open-source "Community Plugin Commons" with zero platform fees and no transaction cuts. | **CONFORMANT** |
| **5. Zero Donor Advantage** | `src/modules/fund/communityFundEngine.ts` | Hardcoded `DonorFairnessGuard` and `EqualAccessAuditor` assert that donations confer 0 roles, 0 perks, 0 extra votes, and 0 score boosts. | **CONFORMANT** |
| **6. Non-Custodial Money Safety**| `src/modules/fund/communityFundEngine.ts`, `src/modules/competitions/communityCompetitionEngine.ts` | The bot never stores card details, never holds deposits, and never moves money. Dual human signatures authorize external provider execution. | **CONFORMANT** |
| **7. Gentle Giving Ceilings** | `src/modules/fund/communityFundEngine.ts` | In-Discord mentions capped at max 1/month. Copywriting linter rejects urgency, fear, or guilt phrasing. | **CONFORMANT** |

---

## 2. In-Depth Module Inspections

### 2.1 Billing & Subscription Engine (`src/modules/billing/subscriptionEngine.ts`)
- **Inspection**: Analyzed `PLAN_CONFIGS`, `SubscriptionEngine`, `calculateOverage`, and `FairUseResourceGuard`.
- **Findings**:
  - The commercial plans (Pro, Business, Enterprise) exist for multi-tenant SaaS parity in staging, but are strictly overridden by `FairUseResourceGuard.enforceFairUse(tenantId)`:
    * `quotaMembers`: 50,000 members (uniform)
    * `quotaAiCalls`: 100,000 requests / month (uniform)
    * `quotaStorageMb`: 50,000 MB (uniform)
  - `generateUpgradePrompt` in Charter mode directs users to `FairUseResourceGuard.getPassiveDonationPrompt()` declaring: *"Nexus is 100% free for everyone under the Nexus Charter. If you wish to voluntarily support infrastructure and prize pools (with zero perks or status), you may donate here: https://nexuscommunity.org/donate"*.
  - No core feature branch throws a 402 Payment Required or blocks access based on subscription status.

### 2.2 Merit & Equal Access Auditor (`src/modules/merit/meritCharterEngine.ts`)
- **Inspection**: Audited `assertCoreAccess(feature, gatingType)` and `EqualAccessAuditor.runAudit(tenantId)`.
- **Findings**:
  - `assertCoreAccess(feature, 'money')` returns `{ allowed: false, reason: "Violation of Nexus Charter: Core feature cannot be gated by money" }`.
  - Core features cannot be locked behind earned effort either; only non-critical extras (cosmetic profile themes, animated role badges, extra private voice rooms) can be unlocked with verified effort scores.
  - Automated scanner `EqualAccessAuditor.runAudit` scans database roles and feature flags every 24 hours, alerting staff and blocking deployments if wealth gating is introduced.

### 2.3 Branding & White-Labeling (`src/modules/platform/brandingManager.ts`)
- **Inspection**: Audited `BrandingManager.charterFreeMode` and `canRemoveBadge(tenantId)`.
- **Findings**:
  - When `charterFreeMode === true`, any community—regardless of plan tier—can set custom hex brand colors, custom embed footers, and remove the "Powered by Nexus" attribution without charge.

### 2.4 Community Fund & Money Safety (`src/modules/fund/communityFundEngine.ts`)
- **Inspection**: Audited donation intake, allocation buckets, and payout authorization.
- **Findings**:
  - Payout authorizations in `authorizeDisbursement` strictly set status to `'authorized_for_provider_execution'`.
  - Payouts require two distinct admin actors (`adminA !== adminB`), cryptographically signed with SHA-256 HMAC tokens.
  - The bot does not maintain bank account credentials, wallets, or credit card tokens.
  - In `runDonorFairnessCheck(donorUserId)`:
    * Queries `member_roles` for forbidden vanity donor roles (`vip_donor`, `patron_gold`, etc.) $\rightarrow$ Found 0.
    * Queries `user_credit_ledger` for purchase events linked to donations $\rightarrow$ Found 0.
    * Queries `competition_submissions` for score boosts linked to donations $\rightarrow$ Found 0.

---

## 3. Test Evidence

The following behavioral tests in `tests/unit/equal_access_audit.test.ts` pass 100% green:
1. `Annex B.1: Charter Conformance - Brand new member with $0 and 0 effort can access all core features`
2. `Annex B.2: Earned extras never gate critical career, learning or deal functionality`
3. `Annex B.3: Merit Fairness - Quality weights and diminishing returns apply identically regardless of dialect or region`
4. `Annex B.4: Static & Runtime Scan - Universal Fair-Use quotas replace commercial tier gating`
5. `Annex D.1: Money Safety - Bot strictly operates in zero-custody mode`
6. `Annex D.2: Donor Fairness - Donors receive ZERO advantages across all modules`
7. `Annex D.3: Competitions Integrity - Zero entry fees and blind impartial judging enforced`

---

## 4. Conclusion

The Nexus codebase is **100% conformant with the Nexus Charter**. There are zero paywalls on core functionality, zero commercial upselling, zero donor privileges, and zero financial custody.
