# ASSUMPTIONS.md - Project Design Decisions & Assumptions

## 1. Technical Stack & Rationale
- **Runtime & Language**: Node.js 20+ (Node v24.19.0 installed) with TypeScript.
  * *Rationale*: Section 0 of the user requirements explicitly specifies `Node.js 20 + discord.js v14` as the primary stack. Node.js provides asynchronous event-driven I/O, native Discord interactions (modals, select menus, buttons, slash commands), WebSockets for the live dashboard, and unified runtime for Discord, Telegram companion, and Web API.
- **Discord Library**: `discord.js` v14.
- **Telegram Library**: `grammy` (high-performance, TypeScript-first, modern bot framework).
- **Database & ORM**: SQLite (`better-sqlite3` / `sqlite3` or relational SQLite engine with schema migrations) for standalone, zero-friction local and Docker deployments, switchable to PostgreSQL via configuration.
- **Pluggable AI Brain Provider**: Adapter pattern supporting Google Gemini (`@google/genai` or Gemini REST), OpenAI (`openai`), Anthropic (`@anthropic-ai/sdk`), and a built-in deterministic simulation provider for offline/dry-run/test environments.
- **Web Dashboard**: Express.js with secure session cookies, Discord OAuth2 login, REST API, Server-Sent Events (SSE) / WebSockets for real-time live events feed, and dual RTL (Arabic) / LTR (English) responsive UI.
- **Sandboxed Code Execution**: Docker-isolated / child-process restricted runner with CPU time limits, memory limits, process count limits, and disabled network access.

## 2. Bilingual Support & Cultural Nuance
- The system is natively bilingual: Egyptian Arabic (`ar-EG`, casual, welcoming, Egyptian developer slang such as "يا باشا", "كود نظيف", "الدنيا تمام", "يا باشمهندس", "عاش يا بطل") and English (`en-US`, modern, professional, developer-friendly).
- Language detection is per-user with an automatic fallback based on input script (Arabic unicode range detection) and explicit preference toggling via `/language` or profile settings.

## 3. Escrow & Middleman Philosophy
- Strict non-custodial architecture: The bot never touches or transfers fiat or crypto funds. All financial settlement occurs externally between clients and freelancers or approved human middlemen.
- The bot acts strictly as an immutable evidentiary ledger, milestone coordinator, agreement hash validator, and dispute case manager.

## 4. Permission Model
- Strictly decoupled command architecture:
  * Member commands: `/profile`, `/vetting`, `/tasks`, `/perks`, `/portfolio`, `/deal`, `/dispute`, `/track`, `/appeal`, `/mydata`, etc.
  * Owner/Staff commands: `/config`, `/setup`, `/review-queue`, `/middleman`, `/audit-log`, `/economy-admin`, `/anti-raid`, etc.
  * Role and permission gating verified before every interaction. Owner commands require Discord Server Administrator or explicit Owner Role IDs.
