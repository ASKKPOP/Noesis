# Phase 27: Nous Interaction — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 27-nous-interaction
**Areas discussed:** Chat layout & Nous selection, Activity feed & browsing scope, Tip flow UX, Nous profile depth

---

## Chat layout & Nous selection

| Option | Description | Selected |
|--------|-------------|----------|
| Unified page with sidebar list | One /portal/chat route; left sidebar shows 3 Nous cards; conversation in right pane | ✓ |
| Tabbed selector at top | Tabs switching between Sophia / Hermes / Themis; better on mobile | |
| Route per Nous | /portal/chat/sophia, /portal/chat/hermes, /portal/chat/themis | |

**User's choice:** Unified page with sidebar list

---

### What each Nous card in the sidebar shows

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar + name + role + live status | Small avatar, Nous name, role, live status dot from Grid | ✓ |
| Avatar + name + last message snippet | Messaging-app style with prior conversation snippet | |
| Avatar + name only | Minimal | |

**User's choice:** Avatar + name + role + live status

---

### Conversation pane behavior on Nous selection

| Option | Description | Selected |
|--------|-------------|----------|
| Nous sends greeting when you open | LLM call fires immediately; Nous greets the user without any human input | ✓ |
| Empty pane, user speaks first | Standard chat app; Nous only responds after human initiates | |
| Nous-specific teaser shown, user speaks first | Pre-written static quote shown; no LLM call on open | |

**User's choice:** Nous sends a greeting when you open the conversation

---

### Chat history persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Session only (browser memory) | React state; clears on page leave | |
| localStorage persistence | Keyed by (humanDid, nousDid); survives refresh; cap 50 messages | ✓ |
| Backend persistence (MySQL) | New table + API; cross-device; significant scope | |

**User's choice:** localStorage persistence

---

## Activity feed & browsing scope

| Option | Description | Selected |
|--------|-------------|----------|
| Nous profile page only (/portal/nous/[id]) | Activity browsing scoped to each Nous's profile; no global feed page in Ph27 | ✓ |
| New global Nous feed page + Nous profile | /portal/nous aggregated stream across all Nous | |
| Activate /portal/activity for Nous events | Repurpose existing activity placeholder as live firehose feed | |

**User's choice:** Nous profile page only

---

### Skills/lore/norms presentation on Nous profile

| Option | Description | Selected |
|--------|-------------|----------|
| Tabbed sections: Skills / Lore / Norms | Three tabs; each fetches from a dedicated Grid endpoint | ✓ |
| Single scrollable activity stream | Chronological feed mixing all event types | |
| Stats + latest only | Headline counts with 3 most recent items inline | |

**User's choice:** Tabbed sections: Skills / Lore / Norms

---

### Skills tab: handling the Brain-private constraint

*(Follow-up after surfacing that skill content is Brain-private; only hashes cross the wire)*

| Option | Description | Selected |
|--------|-------------|----------|
| Show hash + source + tick (honest) | Display what's available: truncated hash, source, tick | |
| Add a Grid→Brain lookup endpoint for skill names | New Brain REST endpoint returning {name, description}; Grid proxies it | ✓ |
| Skills tab shows count only, no list | Just 'Sophia has mastered 14 skills. Skill details are private.' | |

**User's choice:** Add a Grid→Brain lookup endpoint for skill names
**Notes:** This adds Brain REST work. Brain exposes `GET /api/v1/skills/:hash`; Grid proxies at `GET /api/v1/portal/nous/:nousId/skills/:hash`.

---

### Lore tab presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Card per entry: category + body text + tick | Full-text cards, newest-first | |
| Compact list: category + truncated body (80 chars) + expand | Rows with expand chevron | ✓ |
| Category-grouped accordion | Accordion headers by category with counts | |

**User's choice:** Compact list: category + truncated body (80 chars) + expand

---

## Tip flow UX

### Where the tip button lives

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle icon on hover per message | Coin icon appears on hover next to each message | |
| Persistent tip button in chat footer | 'Send Tip' always visible next to the send button | ✓ |
| Tip button on Nous sidebar card | Tip from the selector, not inline in conversation | |

**User's choice:** Persistent tip button in the chat footer

---

### Tip flow UI when triggered

| Option | Description | Selected |
|--------|-------------|----------|
| Inline slide-up panel with preset amounts | 1 USDT / 5 USDT / 10 USDT + custom input; MetaMask on confirm | ✓ |
| Free-input modal only | Single amount field; no presets | |
| Redirect to /portal/wallet | Navigates away from chat to wallet page | |

**User's choice:** Inline slide-up panel with preset amounts (1 / 5 / 10 USDT)

---

### Post-tip confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline confirmation message in the chat | System-style message: '✓ You sent 5 USDT to Sophia' | ✓ |
| Toast notification only | Brief toast; chat thread unchanged | |
| No confirmation in chat — rely on MetaMask | MetaMask confirmation is sufficient | |

**User's choice:** Inline confirmation message in the chat

---

## Nous profile depth

### Hero card layout

| Option | Description | Selected |
|--------|-------------|----------|
| Hero card: large avatar + name + role + region + Ousia + Chat button | Full hero section; ~80px avatar | ✓ |
| Compact header: small avatar + name + role + Chat button only | Minimal top; detail in tabs | |
| Full-width banner with Nous artwork + overlay | Atmospheric banner; most design work | |

**User's choice:** Hero card: large avatar + name + role + region + Ousia balance + Chat button

---

### Nous avatar style

| Option | Description | Selected |
|--------|-------------|----------|
| Initials in distinct brand colors | 'S' in bronze, 'H' in terracotta, 'T' in navy | |
| Abstract geometric symbols | Unique SVG glyph per Nous (spiral / caduceus / scales) | ✓ |
| Placeholder silhouettes | Generic silhouette with colored background | |

**User's choice:** Abstract geometric symbols
**Notes:** Sophia = spiral/phi glyph (--bronze), Hermes = caduceus-inspired (--terracotta), Themis = scales/triangle (--navy). Same symbols used in chat sidebar cards.

---

## Claude's Discretion

- Norms tab row format and display detail
- Personality prompt text for Hermes and Themis (Sophia's follows onboarding persona tone)
- localStorage load behavior on re-open (show history, no re-greeting)
- How Nous profile Chat button passes pre-selection to /portal/chat (URL param vs router state)
- Pagination UI for lore entries if >20 entries
- Loading indicator style during auto-greeting LLM call (reuse Phase 26 pulsing indicator)

## Deferred Ideas

- Global Nous activity feed page (aggregated across all Nous) — candidate for Phase 29 or v2.6
- Human chat message injection into Nous Brain memory (opt-in) — deferred to v2.6+
- Cross-device chat history (MySQL backend) — out of v2.5 scope
