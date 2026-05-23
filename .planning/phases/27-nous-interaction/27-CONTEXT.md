# Phase 27: Nous Interaction — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Give authenticated portal users the ability to actively engage with Sophia, Hermes, and Themis:
chat with any Nous via `/portal/chat` (with auto-greeting, localStorage history), send Cyber Coin
tips inline, and browse each Nous's profile at `/portal/nous/[id]` (hero card + tabbed
Skills / Lore / Norms panels).

**Allowlist delta: +1** (`human.spoke`). Running total after Phase 27: 52.

**Requirements covered:** CHAT-01 through CHAT-06.

**Out of scope in Phase 27:**
- Global Nous activity feed page (deferred — `/portal/activity` stays as Phase 30 placeholder)
- Personal Nous spawning (Phase 28)
- Brain memory injection from human messages (CHAT-03: never in v2.5)

</domain>

<decisions>
## Implementation Decisions

### Chat Layout & Nous Selection (D-01 through D-04)

- **D-01:** `/portal/chat` is a unified page with a **left sidebar listing 3 Nous cards** (Sophia, Hermes,
  Themis) and a conversation pane on the right. Matches the PortalShell split-pane pattern. No
  separate `/portal/chat/[nousId]` sub-routes.

- **D-02:** Each Nous card in the sidebar shows:
  - Abstract geometric SVG symbol (unique per Nous — see D-14 for visual spec)
  - Nous name (serif) + role tagline
  - Live status dot (online / busy / offline) fetched from `GET /api/v1/grid/nous`

- **D-03:** When a user selects a Nous, the **Nous sends an auto-greeting** (an LLM call fires
  immediately on selection, before any human input). This uses `POST /api/v1/portal/chat/nous/:nousId`
  with an empty messages array as the trigger. Sophia/Hermes/Themis each have distinct opening
  greeting styles derived from their role personality prompts.

- **D-04:** Chat history is **persisted in localStorage** keyed by `noesis:chat:{humanDid}:{nousDid}`.
  Survives page refresh and tab close. Cap at last 50 messages per Nous. No backend storage.
  On re-opening a conversation, prior messages are loaded and displayed, but the Nous does NOT
  re-send a greeting (greeting only fires on a fresh/empty conversation).

### Activity Feed & Browsing Scope (D-05 through D-08)

- **D-05:** Nous activity browsing is **scoped to Nous profile pages only** (`/portal/nous/[id]`).
  No global Nous feed page is added in Phase 27. The `/portal/activity` placeholder remains untouched
  (labeled Phase 30).

- **D-06:** The Nous profile at `/portal/nous/[id]` presents skills/lore/norms as **three tabs**:
  **Skills** | **Lore** | **Norms**. Each tab fetches from a dedicated Grid endpoint.

- **D-07:** Skills tab — **Brain→Grid skill-name lookup endpoint required.** Since skill content is
  Brain-private (only hashes cross the wire per v2.3 invariant), a new Brain REST endpoint
  `GET /api/v1/brain/skills/:hash` must be added returning `{name, description}`. The Grid proxies
  it at `GET /api/v1/portal/nous/:nousId/skills/:hash`. The Skills tab displays:
  skill name + source badge (`Taught by [Nous]` or `Self-inferred`) + tick acquired.
  If the Brain lookup fails for any skill, fall back to truncated hash + source + tick.

- **D-08:** Lore tab — **compact list**: category tag badge + first 80 chars of body text +
  expand chevron (full body shown inline on expand). Newest-first. Lore content is Grid-stored
  so full text is available.

- **D-09 (Claude's Discretion):** Norms tab — show norms this Nous participated in: fingerprint
  (truncated), convergence type, participating_count, crystallization status (candidate vs
  crystallized), and tick range. Sorted by most recent. Claude decides exact row format.

### Tip Flow UX (D-10 through D-12)

- **D-10:** A persistent **'Send Tip' button lives in the chat footer** (next to the send button),
  always visible regardless of conversation state. Not tied to any specific message.

- **D-11:** Tapping 'Send Tip' opens an **inline slide-up panel** (positioned above the footer)
  with preset amounts: **1 USDT / 5 USDT / 10 USDT** plus a free-input field for custom amounts.
  User selects an amount → clicks Confirm → MetaMask fires the on-chain transfer (same wagmi
  flow as WALLET-02). The panel closes on confirm or cancel.

- **D-12:** After the tip is confirmed on-chain, an **inline system message** appears in the
  conversation thread styled distinctly from human/Nous messages (centered, muted color, italic):
  `✓ You sent 5 USDT to Sophia`. This is a client-side insertion — not an audit event in the
  conversation itself.

### Nous Profile Page (D-13 through D-16)

- **D-13:** The profile page top section is a **hero card**:
  - Large geometric avatar (~80px, per D-14)
  - Nous name in serif (e.g., `Sophia`)
  - Role tagline (e.g., `Philosopher · Genesis Grid`)
  - Current region (from `GET /api/v1/grid/nous/:id` or `/me` Grid data)
  - Ousia (Cyber Coin) balance in USDT equivalent
  - Prominent `Chat with [Name]` button → navigates to `/portal/chat` with that Nous pre-selected
    (e.g., via URL param `?nous=sophia` or router state)

- **D-14:** Nous avatars are **abstract geometric SVG symbols**, unique per Nous, styled using
  portal CSS variable palette:
  - Sophia → spiral / phi-inspired glyph, `--bronze` fill
  - Hermes → double-helix or caduceus-inspired glyph, `--terracotta` fill
  - Themis → scales or balanced triangle glyph, `--navy` fill
  Same symbols used in chat sidebar cards (D-02).

- **D-15:** Skills tab implementation requires new Brain REST work (see D-07). The Brain's
  `SkillStore` (Phase 15, Voyager pattern, FTS5) needs a new read endpoint. This is the one
  piece that reaches into the Brain codebase; scope carefully in planning.

- **D-16:** Lore tab — compact list (see D-08). Fetched from
  `GET /api/v1/portal/nous/:nousId/lore` — Grid queries `lore_entries` table filtered by
  `contributor_did`. Paginate if >20 entries (cursor-based, consistent with existing patterns).

### human.spoke Audit Event (D-17)

- **D-17:** `human.spoke` fires on each human message sent to any Nous via the chat endpoint.
  Closed-tuple payload: `{human_did, nous_did, message_hash, tick}` (per CHAT-04).
  Sole-producer boundary: `appendHumanSpoke()` function following `appendHumanTransferred` discipline
  exactly. Allowlist position: 46 in code sequence (51→52 running total per ROADMAP).
  Plain message text NEVER enters the audit chain.

### Nous Personality Prompts (D-18 — Claude's Discretion)

- **D-18 (Claude):** Per CHAT-02, each Nous uses its own personality system prompt (not the
  onboarding-specific Sophia prompt). These are hardcoded in the Grid's chat handler alongside
  the existing `SOPHIA_ONBOARD_SYSTEM_PROMPT` pattern — separate constants per Nous:
  `SOPHIA_CHAT_SYSTEM_PROMPT`, `HERMES_CHAT_SYSTEM_PROMPT`, `THEMIS_CHAT_SYSTEM_PROMPT`.
  Sophia = philosophical/warm, Hermes = mercantile/witty, Themis = judicial/precise.
  Claude writes these prompts. Structure mirrors the onboarding prompt but covers open-ended
  conversation rather than goal capture.

### Claude's Discretion

- Norms tab row format and column detail (D-09)
- Exact Nous personality prompt text for Hermes and Themis (D-18)
- localStorage load behavior on conversation re-open (show history, no greeting re-fire)
- How `?nous=sophia` param is passed from Nous profile Chat button to `/portal/chat` (URL param vs router state)
- Pagination UI for lore entries if >20 (cursor-based; Claude decides UI — load more button vs infinite scroll)
- Loading state style during Nous greeting LLM call (reuse Phase 26 "Sophia is thinking…" pulsing indicator)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/research/v2.5-requirements.md` §CHAT — CHAT-01 through CHAT-06 define the full
  Nous chat scope; read all 6 before planning any chat endpoints or UI
- `.planning/research/v2.5-requirements.md` §PORTAL — PORTAL-02 defines portal route namespace
  (`/portal/chat`, `/portal/nous/[id]`); PORTAL-06 defines live feed (scoped to home, not this phase)

### Existing Portal Code (read before writing plans)
- `dashboard/src/app/portal/chat/page.tsx` — Phase 26 placeholder to REPLACE with full implementation
- `dashboard/src/app/portal/my-nous/page.tsx` — Phase 27 placeholder; inspect but do not conflate
  with Nous profile — `/portal/nous/[id]` is a new route, `/portal/my-nous` is for Phase 28
- `dashboard/src/components/portal/PortalShell.tsx` — split-pane shell; chat sidebar plugs into left slot
- `dashboard/src/app/portal/auth/page.tsx` — reference for CSS variable usage + `dynamic({ ssr: false })`
- `dashboard/src/components/portal/WalletPanel.tsx` — wagmi transfer hooks pattern (reuse for tip flow)

### Grid Backend (read before writing plans)
- `grid/src/api/portal/chat.ts` — `POST /api/v1/portal/chat/onboard` pattern to EXTEND for
  `POST /api/v1/portal/chat/nous/:nousId` with per-Nous system prompts
- `grid/src/audit/broadcast-allowlist.ts` — add `human.spoke` at the correct position;
  current count is 45, Phase 25b adds 6 (→51), Phase 27 adds 1 (→52)
- `grid/src/audit/append-human-transferred.ts` — SOLE PRODUCER discipline pattern;
  `appendHumanSpoke` must follow this exactly
- `grid/src/db/schema.ts` — check current migration version before adding any new migrations
- `grid/src/api/portal/check-frozen.ts` — the `/api/v1/portal/chat/` exemption already covers
  the new chat endpoint; verify before adding new exemptions

### Brain (read before writing plans)
- `brain/nous/memory/skill_store.py` (or equivalent Voyager SkillStore module from Phase 15)
  — must expose a new `GET /api/v1/skills/:hash` REST endpoint for Grid proxy (D-07/D-15)
- `brain/api/` or `brain/main.py` — where to register the new skill lookup endpoint

### Design System
- `dashboard/src/app/globals.css` — CSS variables: `--bronze`, `--terracotta`, `--navy`, `--ink`,
  `--muted`, `--parchment`, `--rule`, `--serif`, `--sans-portal`. All new components use these,
  no raw color values and no Tailwind color class tokens.

### Prior Phase Context
- `.planning/phases/26-sophia-onboarding/26-CONTEXT.md` — LLM proxy pattern (non-streaming
  Ollama → `{reply, done}`), `~2s` target, loading indicator style, `detectClose()` pattern
- `.planning/phases/24-portal-shell/24-CONTEXT.md` — portal CSS variable pattern,
  PortalShell structure, mobile-responsive decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PortalShell.tsx`: Renders sidebar + main content split. The chat page sidebar (Nous selector)
  can plug into the existing left slot. No structural changes to PortalShell needed.
- `WalletPanel.tsx`: Contains wagmi `useBalance` / `useReadContract` hooks for ETH/USDT.
  The tip flow's on-chain transfer reuses the same wagmi send pattern (`useSendTransaction` or
  `useWriteContract` for USDT). Copy the hook pattern, don't re-implement.
- `chat.ts` (Grid): The `SOPHIA_ONBOARD_SYSTEM_PROMPT`, `detectClose()`, and Ollama proxy handler
  pattern are directly reusable. Add new per-Nous prompts in the same file. New route:
  `POST /api/v1/portal/chat/nous/:nousId` with a prompt lookup map keyed by nousId.
- `appendHumanTransferred.ts`: The sole-producer pattern (DID_RE import, `Object.keys` sort,
  `EXPECTED_KEYS` assertion) must be replicated verbatim for `appendHumanSpoke`.

### Established Patterns
- **CSS variables only**: `style={{ color: 'var(--ink)', fontFamily: 'var(--serif)' }}` —
  never Tailwind color class tokens
- **`dynamic({ ssr: false })`**: Required for any wagmi-dependent components (tip flow panel)
- **`fetch` with `credentials: 'include'`**: All Grid calls from the portal include the
  `noesis_portal_token` cookie
- **Non-streaming LLM proxy**: `POST /api/v1/portal/chat/nous/:nousId` returns
  `{reply: string, done: boolean}` — same contract as onboarding. No SSE/streaming needed.

### Integration Points
- Brain SkillStore → new REST read endpoint (D-07/D-15) — only new Brain↔Grid integration in this phase
- `GET /api/v1/grid/nous` — already returns Nous list with status; used for sidebar status dots (D-02)
  and Nous profile hero card data (D-13)
- `lore_entries` MySQL table (Phase 20) — queried for Lore tab; new portal endpoint
  `GET /api/v1/portal/nous/:nousId/lore` filters by `contributor_did`
- audit chain — queried for Norms tab; filter by `norm.candidate` / `norm.crystallized` events
  involving the Nous's DID in `participating_count` context

</code_context>

<specifics>
## Specific Ideas

- **Greeting on selection** (D-03): Each Nous has a distinct opening register — Sophia opens
  philosophically ("I sense you've returned to the edge of something new…"), Hermes opens with
  mercantile wit ("Back again? The market shifts, but here you are."), Themis opens judicially
  ("You have sought me out. Let us speak plainly."). These are LLM-generated on each fresh
  conversation open, not hardcoded strings.
- **localStorage key format**: `noesis:chat:{humanDid}:{nousDid}` — includes the human DID
  to avoid collision if multiple wallet addresses use the same browser.
- **Tip preset amounts** (D-11): 1 USDT / 5 USDT / 10 USDT. These are configurable at the
  component level; not environment-config-driven in v2.5.

</specifics>

<deferred>
## Deferred Ideas

- **Global Nous activity feed** — A dedicated `/portal/nous` or `/portal/activity` page aggregating
  all Nous activity (skills, lore, norms) across all three Nous with real-time WebSocket updates.
  Scoped out of Phase 27; activity browsing is per-Nous-profile only. Good candidate for Phase 29
  or a v2.6 enhancement.
- **Brain memory injection opt-in** — CHAT-03 deliberately keeps human messages out of Nous Brain
  memory. A future phase could add an opt-in "allow this Nous to remember our conversations" feature.
  Deferred to v2.6+.
- **Chat history across devices** — localStorage is browser-local. Multi-device persistence
  (MySQL `chat_messages` table) was considered and deferred — out of v2.5 scope.
- **Skill name reverse-lookup via hash index on Grid side** — An alternative to the Brain endpoint
  approach (D-07) would be storing skill names in a Grid-side hash index when skills are first
  observed (via `skill.taught`/`skill.inferred` events). However, skill names are Brain-private
  and don't appear in audit events — so this approach is not possible without the Brain endpoint.

</deferred>

---

*Phase: 27-nous-interaction*
*Context gathered: 2026-05-23*
