# Nexus Telemetry & Key Performance Metrics (METRICS.md)

## 1. North Star Metrics
To measure the true economic value delivered to server owners and members, Nexus monitors three core North Star indicators:

1. **WAEM (Weekly Active Economic Members)**: The count of unique server members who engaged in verifiable value creation within 7 days (submitted work, completed a quiz, verified a skill, funded/delivered an escrow milestone, or reviewed a peer).
2. **GDVT (Gross Deal Volume Tracked)**: The aggregate monthly monetary value of freelance projects, contracts, and gigs coordinated through Nexus Middleman Escrow milestones.
3. **Platform MRR (Monthly Recurring Revenue)**: Total recurring revenue from Pro, Business, and Enterprise tier subscriptions and metered add-ons.

---

## 2. Community Activation Funnel

The activation funnel tracks a newly joined member's journey into a productive, trusted community participant:

```
[Server Join]
     │ (100%)
     ▼
[Step 1: Private Verification Thread] ────────> Target: 75% within 24 Hours
     │
     ▼
[Step 2: Adaptive Vetting / Skill Assessment] > Target: 50% within 48 Hours
     │
     ▼
[Step 3: First Work Approved or Junior Role] ─> Target: 35% within 7 Days
     │
     ▼
[Step 4: Active Economic Participant] ────────> Target: 25% Active at Day 30
     (Applied to Job / Took Deal / Earned Credits)
```

---

## 3. Retention & Engagement Targets

| Metric | Target | Measurement Method | Alert Trigger |
|---|---|---|---|
| **D1 Retention** | $\ge 60\%$ | % of new members active 24h after join | $< 45\%$ |
| **D7 Retention** | $\ge 40\%$ | % of members active on Day 7 | $< 30\%$ |
| **D30 Retention** | $\ge 25\%$ | % of members active on Day 30 | $< 18\%$ |
| **Tenant Net Churn** | $< 2.5\%$ / mo | Monthly cancelled subscriptions minus upgrades | $> 4.0\%$ / mo |
| **Escrow Dispute Rate**| $< 3.0\%$ | Disputed deals vs. completed escrow milestones | $> 5.0\%$ |
| **AI Fallback Rate** | $< 0.5\%$ | Fallbacks to mock/offline when LLM errors | $> 1.0\%$ |

---

## 4. Telemetry Schema & Dashboard Telemetry
All telemetry adheres to strict privacy minimization (no message content or raw PII recorded):

```json
{
  "event_id": "evt_7d8e9f2a",
  "tenant_id": "guild_884920194829102",
  "event_type": "DEAL_MILESTONE_DELIVERED",
  "user_id_hash": "a4f8902b...e3",
  "metric_values": {
    "milestone_index": 2,
    "amount_usd": 450,
    "hours_to_delivery": 72
  },
  "timestamp": 1727632800000
}
```
