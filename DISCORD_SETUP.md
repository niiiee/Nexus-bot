# DISCORD_SETUP.md — Discord Application & Bot Deployment Guide

**Document Version**: 2.7.0  
**Date**: September 30, 2026  
**Auditor**: Antigravity Cloud Architecture Agent  
**Governing Standard**: Section 27.7 (Discord Application Configuration & Least-Privilege Permissions)

---

## 1. Application Isolation (Three-Tier Strategy)

To ensure staging tests never impact live community members, maintain three distinct Discord Applications:

| Tier | Application Name | Purpose | Guild Scope |
| :--- | :--- | :--- | :--- |
| **Development** | `Nexus-Dev` | Local developer testing & sandbox drills | Developer personal test guild only |
| **Staging** | `Nexus-Staging` | Automated CI integration tests & load soak drills | Dedicated staging test guild |
| **Production** | `Nexus` | Live community operations & member management | Official Nexus community guilds |

---

## 2. Privileged Gateway Intents Policy

Request only the minimum intents strictly required for community safety:

1. **`MESSAGE CONTENT INTENT`**: **ENABLED (Mandatory)**
   - *Justification*: Required to evaluate messages against the 50 community rules (R01–R50), detect credential leaks in code snippets, intercept predatory patterns near protected minors, and filter malicious phishing URLs.
2. **`SERVER MEMBERS INTENT`**: **ENABLED (Mandatory)**
   - *Justification*: Required to trigger the conversational onboarding intake when new members join, assign verified roles upon passing skill assessments, and manage moderation timeouts.
3. **`PRESENCE INTENT`**: **DISABLED (Default-Deny)**
   - *Justification*: Nexus does not track member gaming or client presence. Disabling this intent respects member privacy and reduces gateway network bandwidth.

*Scale Verification Note*: When the bot reaches **100 guilds**, submit Discord Bot Verification with the justifications documented above.

---

## 3. Least-Privilege Permission Integer

In accordance with Section 27.7, **NEVER assign the `ADMINISTRATOR` permission (Bit 8 = 0x8)**.

The exact permission integer is computed below:

| Permission Name | Bit Value | Hex | Operational Justification in Nexus |
| :--- | :--- | :--- | :--- |
| `KICK_MEMBERS` | 2 | `0x2` | Mode S/H severe infraction enforcement (dual-mod confirmation) |
| `BAN_MEMBERS` | 4 | `0x4` | Mode H severe permanent ban enforcement (dual-mod confirmation) |
| `MANAGE_CHANNELS` | 16 | `0x10` | Provisioning private `#verify-<user>` onboarding threads |
| `ADD_REACTIONS` | 64 | `0x40` | Adding confirmation checkmarks and voting emojis |
| `VIEW_CHANNEL` | 1024 | `0x400` | Viewing assigned operational and public channels |
| `SEND_MESSAGES` | 2048 | `0x800` | Responding to commands and posting community digests |
| `MANAGE_MESSAGES` | 8192 | `0x2000` | Deleting rule-violating messages (Rules Engine Mode A/S) |
| `EMBED_LINKS` | 16384 | `0x4000` | Posting structured cards, skill rubrics, and model cards |
| `ATTACH_FILES` | 32768 | `0x8000` | Uploading generated certificates and discussion guides |
| `READ_MESSAGE_HISTORY` | 65536 | `0x10000` | Reading discussion threads for quiz generation and audit trails |
| `USE_EXTERNAL_EMOJIS` | 262144 | `0x40000` | Displaying community tier badges and status indicators |
| `MANAGE_ROLES` | 268435456 | `0x10000000` | Assigning `Verified` or `Restricted` roles based on assessments |
| `MODERATE_MEMBERS` | 1099511627776 | `0x10000000000` | Applying automated timeouts (Mode A max 1 hour) |

### Calculated Permission Integer:
$$\text{Permission Integer} = 1099780447414$$

OAuth2 Invite URL template:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1099780447414&scope=bot%20applications.commands
```

---

## 4. Slash Command Registration Strategy

1. **Development & Staging**: Commands are registered per-guild (`guildId`) for instantaneous updates during automated CI tests.
2. **Production**: Commands are registered globally (`Routes.applicationCommands(clientId)`). Updates propagate within Discord edge caches within 2 to 5 minutes.
3. **Command Versioning**: Commands declare explicit version hashes. The bot startup sequence verifies that Discord API registered commands match runtime code declarations, preventing doc drift.

---

## 5. Token Protection & Rotation Runbook

1. **Storage**: `DISCORD_TOKEN` resides exclusively in platform secret stores (Fly.io Secrets / Render Environment Secrets). Never committed to Git or written to log files.
2. **Leak Detection**:
   - In chat: Rule R20 detects Discord tokens posted in messages, instantly deletes the message, alerts staff, and advises immediate token regeneration.
   - In CI: GitHub secret scanning prevents committing token patterns.
3. **Emergency Rotation**:
   - Access Discord Developer Portal -> Bot -> **Reset Token**.
   - Update secret in Fly.io: `fly secrets set DISCORD_TOKEN=new_token`.
   - Update secret in Render: `render secrets update DISCORD_TOKEN=new_token`.
   - The worker automatically restarts with the new token with zero database migration needed.
