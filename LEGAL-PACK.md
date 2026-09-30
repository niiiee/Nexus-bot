# Nexus Commercial Legal Pack & Draft Agreements (LEGAL-PACK.md)

> [!CAUTION]
> **LEGAL NOTICE**: The documents contained herein are draft templates provided for operational guidance and architecture planning. They do not constitute formal legal advice. Community owners and platform operators must have these agreements reviewed and tailored by qualified legal counsel in their respective operating jurisdictions.

---

## 1. Terms of Service (ToS) Draft Summary
**Key Clauses**:
1. **Platform Nature**: Nexus provides community operating software, automation engines, AI-assisted tooling, and non-custodial deal milestone coordination.
2. **No Financial Custody**: Nexus is not a bank, escrow agent, or financial institution. The platform never holds, transmits, or custodies member funds. All financial settlement occurs through external licensed payment gateways (e.g., Stripe, bank transfer, crypto networks).
3. **AI Transparency**: Certain features utilize large language models and automated agents. While Nexus incorporates verification and sandbox testing, members acknowledge AI outputs are generated recommendations and must be exercised with human discretion.
4. **Account Responsibilities**: Tenants and members are responsible for maintaining Discord account security and adhering to platform rules.

---

## 2. Privacy Policy Draft Summary
**Key Principles**:
1. **Data Minimization**: Nexus collects only platform-scoped identifiers, display names, and member-volunteered portfolio/profile details necessary to perform community services.
2. **Zero Profiling & Selling**: Member personal data is never sold, leased, or transmitted to third-party data brokers or ad networks.
3. **Rights on Request (GDPR / CCPA / Regional Laws)**:
   - *Right of Access*: Full DSAR export via `/mydata` or the owner dashboard.
   - *Right to Erasure*: Immediate purge across active tables and derived artifacts within 24 hours of receiving "DELETE", "STOP", or dashboard deletion requests.
4. **Retention Windows**: Temporary lead staging expires within 7–90 days (default 30 days). Inactive member records purge according to tenant configuration.

---

## 3. Data Processing Agreement (DPA) Template
**Scope of Processing**:
- **Data Processor**: Nexus Platform Operations.
- **Data Controller**: The Community Tenant Owner (Discord Server Operator).
- **Subject Matter**: Processing Discord usernames, IDs, submitted code/design files, deal milestone states, and verification logs solely on behalf of the Tenant.
- **Security Measures**: AES-256-GCM encryption at rest, TLS 1.3 in transit, salted HMAC deduplication, role-based access control, and automated tamper-evident audit logging.
- **Sub-processors**: Cloud infrastructure providers (GCP/AWS), licensed AI inference providers (Google Gemini / Anthropic / OpenAI under zero-data-retention agreements), and licensed payment gateways (Stripe).

---

## 4. Acceptable Use Policy (AUP)
**Prohibited Activities**:
1. Coordinated spamming, mass unsolicited DMs, or scraped marketing campaigns.
2. Running fraudulent escrow milestones, phishing schemes, or identity impersonation.
3. Attempting sandbox escape, prompt injection against system boundaries, or reverse engineering client credentials.
4. Harassment, hate speech, or deploying automated raid bots against community servers.
Violation of the AUP results in immediate tenant suspension, blacklisting of platform-scoped IDs, and termination of subscription services without refund.
