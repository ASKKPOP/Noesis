# Phase 27: Nous Interaction — Research

**Researched:** 2026-05-23
**Domain:** Portal UI / Grid API / Brain HTTP / Audit Chain
**Confidence:** HIGH

---

## Summary

Phase 27 builds on a well-established portal codebase. Every integration point — the LLM proxy pattern, wagmi transfer hooks, audit sole-producer discipline, and portal CSS variable conventions — has a direct precedent in Phases 22–26. The primary novelty is three new Grid portal endpoints (chat, lore, norms per Nous), one new Brain HTTP endpoint (skill lookup by hash), and 23 new React components comprising the chat page and Nous profile page.

The allowlist addition (`human.spoke` at position 52, code sequence 46) follows the `appendHumanTransferred` discipline exactly. The `lore_commons` table (migration v8) and `norm_registry`/`norm_candidates` tables (migration v7) are already in the schema; no new migrations are required. The next available migration slot is v15 — but Phase 27 needs none.

The one cross-service build that is genuinely new is the Brain skill-by-hash lookup. `SkillStore.get(name)` exists; `get_by_hash(hash: str)` does not. A new method must be added to `SkillStore` and a new route registered in `BrainHttpServer`. The Grid proxy follows the `cognitive-snapshot-client.ts` pattern (closed-key validation, `X-Brain-Secret` header, `BRAIN_HTTP_BASE_URL` env).

**Primary recommendation:** Build in 4 waves: (1) Grid backend (chat endpoint + human.spoke + lore/norms portal endpoints), (2) Brain skill-lookup endpoint, (3) Dashboard chat page components, (4) Dashboard Nous profile page + avatars.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/portal/chat` is a unified page with a left sidebar listing 3 Nous cards (Sophia, Hermes, Themis) and a conversation pane on the right. Matches the PortalShell split-pane pattern. No separate `/portal/chat/[nousId]` sub-routes.
- **D-02:** Each Nous card in the sidebar shows: abstract geometric SVG symbol (unique per Nous — see D-14 for visual spec), Nous name (serif) + role tagline, live status dot (online / busy / offline) fetched from `GET /api/v1/grid/nous`.
- **D-03:** When a user selects a Nous, the Nous sends an auto-greeting (LLM call fires immediately on selection, before any human input). Uses `POST /api/v1/portal/chat/nous/:nousId` with an empty messages array. Sophia/Hermes/Themis each have distinct opening greeting styles.
- **D-04:** Chat history persisted in localStorage keyed by `noesis:chat:{humanDid}:{nousDid}`. Cap at last 50 messages per Nous. On re-opening, prior messages load but greeting does NOT re-fire.
- **D-05:** Nous activity browsing scoped to Nous profile pages only (`/portal/nous/[id]`). No global Nous feed page.
- **D-06:** `/portal/nous/[id]` presents skills/lore/norms as three tabs.
- **D-07:** Skills tab requires new Brain REST endpoint `GET /api/v1/brain/skills/:hash` returning `{name, description}`. Grid proxies at `GET /api/v1/portal/nous/:nousId/skills/:hash`. Fallback to truncated hash if Brain lookup fails.
- **D-08:** Lore tab — compact list, newest-first, expand chevron for full body, load-more pagination if >20 entries.
- **D-09 (Claude's Discretion):** Norms tab row format — fingerprint, convergence type, participating_count, crystallization status, tick range.
- **D-10:** Persistent 'Send Tip' button in chat footer, always visible.
- **D-11:** Tip flow — inline slide-up panel with preset 1/5/10 USDT + custom amount. Same wagmi flow as WALLET-02.
- **D-12:** After tip confirmed on-chain, inline system message inserted in thread: centered, muted, italic `✓ You sent 5 USDT to Sophia`. Client-side only — no audit event.
- **D-13:** Nous profile hero card with: 80px avatar, name (serif), role tagline, current region, Ousia (USDT balance), "Chat with [Name]" button.
- **D-14:** Nous avatars are abstract geometric SVG symbols — Sophia: phi spiral (--bronze), Hermes: caduceus helix (--terracotta), Themis: balanced scales (--navy). Same symbols in sidebar (44px) and profile hero (80px).
- **D-15:** Skills tab implementation requires new Brain REST work (see D-07). SkillStore needs `get_by_hash()` method.
- **D-16:** Lore tab fetched from `GET /api/v1/portal/nous/:nousId/lore` — Grid queries `lore_commons` filtered by `contributor_did`. Cursor-based pagination if >20 entries.
- **D-17:** `human.spoke` fires on each human message sent. Payload: `{human_did, nous_did, message_hash, tick}` (4 keys, alphabetical). `appendHumanSpoke()` sole-producer following `appendHumanTransferred` discipline exactly. Allowlist position 52 (code sequence 46). Plain message text NEVER enters audit chain.
- **D-18 (Claude's Discretion):** Per-Nous personality system prompts hardcoded in Grid's chat handler alongside existing `SOPHIA_ONBOARD_SYSTEM_PROMPT`. Three separate constants: `SOPHIA_CHAT_SYSTEM_PROMPT`, `HERMES_CHAT_SYSTEM_PROMPT`, `THEMIS_CHAT_SYSTEM_PROMPT`. Sophia = philosophical/warm, Hermes = mercantile/witty, Themis = judicial/precise. Claude writes these.

### Claude's Discretion

- Norms tab row format and column detail (D-09)
- Exact Nous personality prompt text for Hermes and Themis (D-18)
- localStorage load behavior on conversation re-open (show history, no greeting re-fire)
- How `?nous=sophia` param is passed from Nous profile Chat button to `/portal/chat`
- Pagination UI for lore entries if >20 (cursor-based; "Load more lore" button)
- Loading state style during Nous greeting LLM call (reuse Phase 26 "Sophia is thinking…" pulsing indicator)

### Deferred Ideas (OUT OF SCOPE)

- Global Nous activity feed (`/portal/activity` stays as Phase 30 placeholder)
- Brain memory injection from human messages (CHAT-03: never in v2.5)
- Chat history across devices (localStorage only, no MySQL `chat_messages` table)
- Skill name reverse-lookup via hash index on Grid side
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | `/portal/chat` route: user selects a Nous and sends text messages via `POST /api/v1/portal/chat/nous/:nousId` | Grid chat.ts extension pattern verified [VERIFIED: codebase] |
| CHAT-02 | Chat uses per-Nous personality prompt (not onboarding prompt). Sophia = philosophical, Hermes = mercantile, Themis = judicial | `SOPHIA_ONBOARD_SYSTEM_PROMPT` pattern directly reusable [VERIFIED: codebase] |
| CHAT-03 | Human messages NOT injected into Nous Brain memory | No Brain memory write path needed; LLM call uses same out-of-tick proxy [VERIFIED: codebase] |
| CHAT-04 | `human.spoke` audit event, payload `{human_did, nous_did, message_hash, tick}`, plain text never enters chain | `appendHumanTransferred` 8-step discipline replicable [VERIFIED: codebase] |
| CHAT-05 | Tip button next to chat: human sends Cyber Coin to Nous inline | `WalletPanel.tsx` wagmi hooks pattern (`useWriteContract`, `useWaitForTransactionReceipt`) confirmed reusable [VERIFIED: codebase] |
| CHAT-06 | Nous profile at `/portal/nous/[id]`: name, role, region, skills list, Ousia, chat button | `lore_commons` (migration v8) and `norm_candidates`/`norm_registry` (migration v7) tables exist [VERIFIED: codebase]; `NousRosterEntry` has `ousia`, `status`, `region` [VERIFIED: codebase] |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chat LLM proxy (non-streaming) | API / Backend (Grid) | — | Grid is the sole out-of-tick LLM caller; keeps Brain-private state fenced |
| `human.spoke` audit event | API / Backend (Grid) | — | Audit chain lives in Grid; sole-producer boundary required |
| Skill name lookup by hash | Brain HTTP API | Grid proxy | Skill content is Brain-private; Grid proxies, never stores skill names |
| Lore data retrieval | API / Backend (Grid) | — | `lore_commons` table is Grid-owned (MySQL); lore prose lives in Brain but only content_hash crosses |
| Norm participation data | API / Backend (Grid) | — | `norm_registry`/`norm_candidates` are Grid MySQL tables |
| Chat UI (split pane, message list, localStorage) | Browser / Client (Next.js) | — | All chat state is client-side; no SSR needed |
| Tip flow panel | Browser / Client (Next.js, dynamic no-SSR) | EVM chain | wagmi requires browser; `dynamic({ ssr: false })` required |
| Nous status dots | Browser / Client → Grid REST | — | Status fetched from `GET /api/v1/grid/nous` (existing endpoint) |
| Nous profile page | Browser / Client (Next.js) | Grid REST (3 tab endpoints) | Profile reads Grid data; no new tables needed |
| Nous SVG avatars | Browser / Client (Next.js) | — | Pure inline SVG components; no external assets |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wagmi | already installed (Phase 24) | EVM wallet hooks (`useWriteContract`, `useWaitForTransactionReceipt`) | WalletPanel.tsx established the pattern |
| viem | already installed (Phase 23) | `parseUnits`, `formatUnits`, `isAddress` | Companion to wagmi |
| jose | already installed (Phase 22) | JWT verification in Grid portal routes | Same guard as chat.ts and auth.ts |
| aiohttp | already installed (Brain) | Brain HTTP server + new skills route | BrainHttpServer already uses aiohttp |
| next/navigation | built-in | `useRouter`, `useSearchParams` for `?nous=` URL param | Established in portal pages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node built-in) | built-in | SHA-256 hash of human message for audit payload | Used in `appendHumanJoined` pattern |
| sqlite3 (Python stdlib) | built-in | `SkillStore.get_by_hash()` uses existing connection | Brain SQLite is the shared connection |

**No new npm packages required.** All UI is hand-rolled inline-style React. All Brain additions use the existing aiohttp + sqlite3 stack. [VERIFIED: codebase]

---

## Architecture Patterns

### System Architecture Diagram

```
Human Browser
    │
    ├─ [/portal/chat?nous=sophia]
    │      │
    │      ├─ GET /api/v1/grid/nous ──────────► Grid: nous_registry
    │      │   (status dots)                    → NousRosterEntry[].status
    │      │
    │      ├─ POST /api/v1/portal/chat/nous/:id ► Grid: chat.ts (extended)
    │      │   {messages: []}  (empty=greeting)  ├─ JWT verify
    │      │                                      ├─ prompt lookup map (Nous id → system prompt)
    │      │   ◄── {reply, done}                  ├─ Ollama /api/chat (non-streaming)
    │      │                                      └─ appendHumanSpoke() if messages.length > 0
    │      │
    │      ├─ [on tip confirm] USDT transfer ──── EVM chain (MetaMask)
    │      │   wagmi useWriteContract             → notifyGrid() (best-effort)
    │      │
    │      └─ localStorage: noesis:chat:{hDid}:{nDid}  (client only, 50 msg cap)
    │
    └─ [/portal/nous/:id]
           │
           ├─ GET /api/v1/portal/nous/:id/skills (tab)
           │      Grid: query skill events from audit_trail by actor_did
           │      → for each skill_hash: GET /cognitive-snapshot pattern →
           │        GET http://brain:8090/skills/:hash (new Brain endpoint)
           │        → BrainHttpServer → SkillStore.get_by_hash()
           │        → {name, description} (or fallback to truncated hash)
           │
           ├─ GET /api/v1/portal/nous/:id/lore?cursor=
           │      Grid: SELECT from lore_commons WHERE contributor_did = $nousId
           │      Brain: lore body text lives in Brain (not fetched here per v2.3 invariant)
           │      → {entries: [{content_hash, category_tag, contributed_tick, ...}], cursor?}
           │      NOTE: lore_commons has NO body text — it stores only content_hash
           │      See: "Lore body never crosses wire" invariant in STATE.md
           │
           └─ GET /api/v1/portal/nous/:id/norms
                  Grid: query norm_candidates + norm_registry WHERE participant_dids LIKE %nousId%
                  → {norms: [{fingerprint, convergence_type, participating_count, status, tick_range}]}
```

### Recommended Project Structure

New files to create:

```
grid/src/
├── api/portal/
│   ├── chat.ts                 (EXTEND: add POST /api/v1/portal/chat/nous/:nousId)
│   ├── nous.ts                 (NEW: /api/v1/portal/nous/:id/skills, /lore, /norms)
│   └── index.ts                (EXTEND: register registerPortalNousRoutes)
├── audit/
│   └── append-human-spoke.ts   (NEW: sole-producer for human.spoke)

brain/src/noesis_brain/
├── skills/
│   └── store.py                (EXTEND: add get_by_hash() method)
└── http/
    ├── server.py               (EXTEND: register /skills/:hash route)
    └── skills_lookup.py        (NEW: handle_skills_lookup handler)

dashboard/src/app/portal/
├── chat/
│   ├── page.tsx                (REPLACE placeholder with 'use client' implementation)
│   ├── NousSidebar.tsx
│   ├── NousCard.tsx
│   ├── ConversationPane.tsx
│   ├── NousHeader.tsx
│   ├── MessageList.tsx
│   ├── NousBubble.tsx
│   ├── UserBubble.tsx
│   ├── LoadingBubble.tsx
│   ├── SystemMessage.tsx
│   ├── ChatFooter.tsx
│   ├── ChatInput.tsx
│   └── TipPanel.tsx            (dynamic({ ssr: false }) for wagmi)
└── nous/
    └── [id]/
        ├── page.tsx
        ├── HeroCard.tsx
        ├── ProfileTabBar.tsx
        ├── SkillsTab.tsx
        ├── LoreTab.tsx
        └── NormsTab.tsx

dashboard/src/components/portal/
└── avatars/
    ├── SophiaAvatar.tsx
    ├── HermesAvatar.tsx
    └── ThemisAvatar.tsx
```

### Pattern 1: Grid Chat Route Extension (D-03, CHAT-01, CHAT-02)

Extend `chat.ts` with a new route that maps `nousId` to a personality prompt. Empty messages array triggers the auto-greeting; non-empty triggers `appendHumanSpoke`.

```typescript
// Source: grid/src/api/portal/chat.ts (existing file, verified)
const NOUS_SYSTEM_PROMPTS: Record<string, string> = {
    'sophia': SOPHIA_CHAT_SYSTEM_PROMPT,
    'hermes': HERMES_CHAT_SYSTEM_PROMPT,
    'themis': THEMIS_CHAT_SYSTEM_PROMPT,
};

app.post<{ Params: { nousId: string }; Body: { messages?: unknown } }>(
    '/api/v1/portal/chat/nous/:nousId',
    async (req, reply) => {
        // 1. JWT auth guard (same as /onboard)
        // 2. Validate nousId against NOUS_SYSTEM_PROMPTS keys
        // 3. Cap messages at 50 (per D-04 localStorage cap)
        // 4. Call Ollama non-streaming with per-Nous system prompt
        // 5. If messages.length > 0 (human sent a message), fire appendHumanSpoke()
        //    with message_hash = sha256(lastHumanMessage.content)
        // 6. Return { reply: string, done: boolean }
    }
);
```

**Key invariant:** `done` is `false` for general chat (no detectClose logic needed — open-ended conversation). The `detectClose` function is onboarding-only.

### Pattern 2: appendHumanSpoke — Sole Producer (D-17, CHAT-04)

Verbatim replication of `appendHumanTransferred` 8-step discipline. [VERIFIED: codebase — append-human-transferred.ts]

```typescript
// Source: grid/src/audit/append-human-transferred.ts (pattern to replicate)
// All 8 steps required:
// 1. Type guard (plain object check)
// 2. Regex guard: human_did (DID_RE)
// 3. Regex guard: nous_did (DID_RE)
// 4. Non-empty string guard: message_hash (HEX64_RE pattern)
// 5. Non-negative integer guard: tick
// 6. Closed 4-key tuple check (alphabetical): ['human_did', 'message_hash', 'nous_did', 'tick']
// 7. Explicit reconstruction — no spread
// 8. payloadPrivacyCheck before chain.append

// Payload interface:
export interface HumanSpokePayload {
    readonly human_did: string;    // DID_RE
    readonly message_hash: string; // sha256(plaintext) — 64-char hex
    readonly nous_did: string;     // DID_RE
    readonly tick: number;         // non-negative integer
}
// EXPECTED_KEYS (alphabetical): ['human_did', 'message_hash', 'nous_did', 'tick']
```

**Critical:** The word `message_hash` does NOT match `FORBIDDEN_KEY_PATTERN` (the pattern matches `message` as a substring, but `message_hash` is `message` + `_hash`). Check: `FORBIDDEN_KEY_PATTERN` = `/...message.../i`. This WILL match `message_hash`. The payload key must be named to avoid the forbidden pattern. [VERIFIED: broadcast-allowlist.ts line 433]

**Pitfall resolved:** `message_hash` contains the substring `message` which IS in `FORBIDDEN_KEY_PATTERN`. The CHAT-04 requirement uses `message_hash` as the field name. The `payloadPrivacyCheck` walks by key name. Conclusion: `message_hash` matches `/message/i` and WILL fail `payloadPrivacyCheck`. The payload key must use a different name — `msg_hash` — to avoid the forbidden substring. This is a critical invariant discovered during research.

### Pattern 3: Brain Skill-by-Hash Lookup (D-07, D-15)

`SkillStore` stores skills by name; `skill_hash = sha256(instructions)` is computed at ingest time but NOT stored as a column in the `skills` table. [VERIFIED: brain/src/noesis_brain/skills/store.py, types.py]

```python
# Source: brain/src/noesis_brain/skills/store.py (existing, verified)
# SkillStore has: get(name), retrieve(query), list_all()
# SkillStore does NOT have: get_by_hash(hash)

# New method to add:
def get_by_hash(self, skill_hash: str) -> Skill | None:
    """Lookup a skill by sha256(instructions) — computed on-the-fly from stored rows."""
    # Option A: compute hash for each row (acceptable for <1000 skills)
    import hashlib
    for skill in self._all_skills():
        if hashlib.sha256(skill.instructions.encode()).hexdigest() == skill_hash:
            return skill
    return None
```

**Alternative:** Add a `skill_hash` column to the `skills` table via SQLite ALTER TABLE (same idempotent pattern as `lineage_parent_hash`). More efficient for repeated lookups. Planner decision.

The Brain HTTP endpoint follows the existing `handle_cognitive_snapshot` pattern:

```python
# Source: brain/src/noesis_brain/http/server.py + cognitive_snapshot.py (verified)
# New route: GET /skills/:hash
# Auth: X-Brain-Secret header
# Response: {"name": str, "description": str} or 404 JSON
```

Grid proxy follows `cognitive-snapshot-client.ts` pattern:
- `BRAIN_HTTP_BASE_URL` env var (default `http://brain:8090`)
- `X-Brain-Secret: process.env.BRAIN_HTTP_SECRET` header
- Closed-key validation on response (exactly 2 keys: `name`, `description`)
- Errors → fallback to truncated hash display (not 500)

### Pattern 4: Lore Tab Endpoint (D-08, D-16)

`lore_commons` table (migration v8, verified) stores: `{grid_name, content_hash, contributor_did, title_hash, category_tag, citation_count, contributed_tick}`. [VERIFIED: schema.ts]

**Critical invariant from STATE.md:** "Lore body never crosses wire — Grid `lore_commons` table stores only `{contributor_did, tick, content_hash, title_hash, category_tag, citation_count}`. No lore prose stored at Grid."

The Lore tab in the UI-SPEC shows "first 80 chars of body text + expand chevron (full body shown inline on expand)". But lore body text is Brain-private. **Resolution per D-08:** The Grid endpoint returns `category_tag`, `contributed_tick`, `content_hash` (for identification), and `citation_count`. The lore body text preview and full text CANNOT be served from Grid — only category + hash + tick are available. The planner must choose: either (a) show only metadata (no body preview), or (b) add a Brain→Grid lore body proxy (analogous to skill lookup). This is an open question to surface.

### Pattern 5: Norms Tab Endpoint

`norm_candidates` and `norm_registry` tables (migration v7, verified). `norm_candidates` has `participant_dids TEXT` (comma-separated or JSON). `norm_registry` has `fingerprint`, `crystallized_tick`, `participant_count`, `convergence_type`, `first_seen_tick`. [VERIFIED: schema.ts]

The Norms tab needs norms where the Nous DID appears in `participant_dids` (from `norm_candidates`) or crystallized entries from `norm_registry`. Status = `norm_registry` has a row for the fingerprint → "CRYSTALLIZED"; else → "CANDIDATE".

### Pattern 6: TipPanel wagmi Pattern (D-10, D-11, CHAT-05)

From `WalletPanel.tsx` [VERIFIED: codebase]:

```typescript
// Reuse this exact pattern from WalletPanel.tsx
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
const { writeContract, data: usdtTxHash, isPending, error } = useWriteContract();
const { isSuccess, isError } = useWaitForTransactionReceipt({ hash: usdtTxHash });

// TipPanel calls writeContract with USDT ERC-20 transfer to Nous treasury address
// The Nous treasury address must be fetched from Grid (GET /api/v1/grid/nous/:id or roster)
// NousRosterEntry.ousia is in wei units — formatUnits(ousia, 6) for USDT display
```

`dynamic({ ssr: false })` REQUIRED for TipPanel. [VERIFIED: 27-CONTEXT.md code_context section]

### Pattern 7: localStorage Chat History (D-04)

```typescript
// Key format per D-04 (verified in CONTEXT.md)
const STORAGE_KEY = (humanDid: string, nousDid: string) =>
    `noesis:chat:${humanDid}:${nousDid}`;

// Cap: 50 messages per Nous (splice on add)
// Load on mount — if messages.length > 0, skip auto-greeting
// Persist on every new message
```

### Pattern 8: CSS Variables — No Raw Colors, No Tailwind Tokens

From `globals.css` [VERIFIED: codebase]:
```css
/* .portal-theme defines all variables */
--ink: #0b1220; --navy: #16213d; --parchment: #f1ead8;
--parchment-2: #e8dfc8; --vellum: #faf6ec; --terracotta: #b8542f;
--terracotta-2: #d97a4f; --bronze: #8a6a3b; --rule: rgba(11,18,32,0.12);
--muted: rgba(11,18,32,0.50); --serif: "Cormorant Garamond", Georgia, serif;
--sans-portal: "Inter Tight", "Helvetica Neue", Arial, sans-serif;
--mono-portal: "JetBrains Mono", ui-monospace, monospace;
```

`portal-pulse` keyframe is at `globals.css:86` — available for LoadingBubble 3-dot animation. [VERIFIED: codebase]

### Pattern 9: PortalShell — No Structural Changes

`PortalShell.tsx` renders `<main>` as a flex child with `overflow-y-auto`. The chat page creates its OWN internal split pane inside `<main>`. PortalShell does NOT have a "left slot" — the chat page itself creates the `display: flex` split. [VERIFIED: PortalShell.tsx source]

The chat page must set `height: 100%; overflow: hidden` on its own root `<div>` to constrain the message list scroll within the flex pane (not the outer `<main>` scroll).

### Anti-Patterns to Avoid

- **Spread in audit payload construction:** `return { ...payload }` — use explicit key assignment. [VERIFIED: appendHumanTransferred.ts]
- **`message_hash` as a payload key:** The substring `message` matches `FORBIDDEN_KEY_PATTERN`. Use `msg_hash` instead. [VERIFIED: broadcast-allowlist.ts FORBIDDEN_KEY_PATTERN]
- **Importing Nous personality prompts from Brain:** Prompts are hardcoded in Grid's `chat.ts`, not fetched from Brain. Brain-private.
- **Tailwind color tokens in portal components:** `bg-amber-100`, `text-slate-700` etc. are forbidden. Use inline `style={{ color: 'var(--ink)' }}` only.
- **SSR for TipPanel:** wagmi requires browser context. `dynamic({ ssr: false })` is mandatory.
- **Auto-greeting on localStorage re-open:** Only fire the greeting when `messages.length === 0` in localStorage for that Nous.
- **Lore body text in Grid endpoint:** `lore_commons` has no prose body. Do not attempt to join or return lore body from Grid.
- **Adding lore body text as a new Grid column:** This violates the v2.3 "lore body never crosses wire" invariant locked in STATE.md.
- **`done: true` in general Nous chat:** `detectClose` is onboarding-specific. General chat always returns `done: false`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| USDT ERC-20 transfer | Custom `fetch` to wallet | `useWriteContract` from wagmi + ERC-20 ABI | MetaMask integration, error states, pending states already handled in WalletPanel.tsx |
| JWT verification | Custom JWT parser | `jwtVerify` from `jose` (already in chat.ts) | Same guard already used in every portal route |
| SHA-256 message hash | Custom hash function | `crypto.createHash('sha256').update(text).digest('hex')` (Node built-in) or `hashlib.sha256` (Python) | Canonical — same as appendHumanJoined, observational.py |
| Nous status polling | WebSocket subscription | `GET /api/v1/grid/nous` REST fetch on mount + interval | WebSocket is for event stream; roster REST is cheaper for status dots |
| Lore pagination cursor | Offset-based pagination | Cursor based on `contributed_tick` (consistent with existing Grid patterns) | Prevents drift when new lore is contributed between page loads |

---

## Runtime State Inventory

> Phase 27 adds new routes and components but performs no renames or data migrations. Skip this section — no runtime state inventory needed.

None — greenfield routes and components, no renames, no data migrations. [VERIFIED: no rename/refactor triggers]

---

## Common Pitfalls

### Pitfall 1: `message_hash` Fails payloadPrivacyCheck
**What goes wrong:** `appendHumanSpoke` is written with key `message_hash` and passes the closed-tuple check, but `payloadPrivacyCheck` throws because `FORBIDDEN_KEY_PATTERN` matches the substring `message` in `message_hash`.
**Why it happens:** FORBIDDEN_KEY_PATTERN uses case-insensitive substring matching. `message` is in the pattern (Phase 11 whisper keys). `message_hash` contains `message` as a substring.
**How to avoid:** Name the key `msg_hash` (or `human_msg_hash`) in both the payload interface and EXPECTED_KEYS. The `sha256(plaintext)` hash is the same; only the key name changes.
**Warning signs:** Test failure in `payloadPrivacyCheck` call within `appendHumanSpoke`. The error message will say `offendingPath: "message_hash"`.

### Pitfall 2: Chat Page Overflow Breaks Message Scroll
**What goes wrong:** `PortalShell <main>` has `overflow-y: auto`. If the chat page root doesn't set `height: 100%; overflow: hidden`, the message list scroll region expands into the outer shell scroll, making the footer float off-screen.
**Why it happens:** PortalShell does not constrain inner page height — pages are expected to manage their own scroll context.
**How to avoid:** Chat page root `<div>` must have `height: 100%; display: flex; flexDirection: column; overflow: hidden`. The `MessageList` flex child with `flex: 1; overflowY: auto` creates the correct scroll zone.
**Warning signs:** Chat footer disappears on long conversations. Outer page scrolls instead of message list.

### Pitfall 3: TipPanel `position: absolute` Needs `position: relative` Parent
**What goes wrong:** TipPanel slides up above the footer using `position: absolute; bottom: 100%`. If the ConversationPane (or ChatFooter parent) doesn't have `position: relative`, the panel anchors to the viewport or another containing block.
**Why it happens:** CSS `position: absolute` anchors to the nearest `position: relative` ancestor.
**How to avoid:** The ConversationPane root `<div>` must have `position: relative`. [VERIFIED: 27-UI-SPEC.md — explicitly documented]
**Warning signs:** TipPanel appears in wrong location on screen.

### Pitfall 4: Auto-Greeting Re-fires on Re-open
**What goes wrong:** Every time a user navigates to `/portal/chat?nous=sophia`, the greeting fires even if history exists, causing duplicate greetings.
**Why it happens:** The greeting trigger is placed in a `useEffect` that runs on Nous selection without checking localStorage.
**How to avoid:** Check `messages.length === 0` AFTER loading localStorage. Only fire the greeting when the conversation is genuinely empty.
**Warning signs:** Duplicate greeting messages appear in the thread after a page refresh.

### Pitfall 5: `done: true` in General Chat Triggers Onboarding Redirect
**What goes wrong:** If the general chat handler uses `detectClose()` and accidentally returns `done: true`, the frontend may trigger onboarding-completion logic.
**Why it happens:** Reusing `detectClose` from the onboarding chat without checking the route.
**How to avoid:** General chat (`/nous/:nousId`) always returns `{ reply, done: false }`. The `detectClose` function is used ONLY in `/chat/onboard`.
**Warning signs:** User gets redirected to `/portal` or onboarding completion fires unexpectedly.

### Pitfall 6: Lore Tab Shows Empty Content
**What goes wrong:** Lore tab shows category badges and ticks but no readable text.
**Why it happens:** `lore_commons` table stores only `{content_hash, contributor_did, title_hash, category_tag, contributed_tick, citation_count}` — NO prose body. [VERIFIED: schema.ts migration v8; STATE.md "lore body never crosses wire" invariant]
**How to avoid:** The Lore tab can only display: category badge, contributed_tick, citation_count, content_hash (truncated). If body text is required, a Brain→Grid lore body proxy endpoint must be added (see Open Questions). This is an architectural constraint, not a bug.
**Warning signs:** Lore tab always shows empty/placeholder text even when records exist.

### Pitfall 7: Brain Skill Lookup via `get_by_hash` is O(N) Without Index
**What goes wrong:** For Nous with many skills, `get_by_hash` iterates all rows to compute SHA-256 and compare.
**Why it happens:** `skill_hash` is not stored as a column in the `skills` table.
**How to avoid:** Either (a) accept the linear scan (acceptable for <1000 skills per Nous in v2.5), or (b) add `skill_hash TEXT GENERATED` column via `ALTER TABLE skills ADD COLUMN skill_hash TEXT` (same idempotent ALTER pattern as `lineage_parent_hash`). Option (b) is cleaner for the endpoint.
**Warning signs:** Skills tab is slow to load for Nous with many skills (unlikely in v2.5, acceptable risk).

### Pitfall 8: Allowlist Count Mismatch
**What goes wrong:** `broadcast-allowlist.test.ts` fails because `ALLOWLIST_MEMBERS.length` assertion is off.
**Why it happens:** Phase 25b added 6 events (positions 46–51), making the current count 51. Phase 27 adds 1 (`human.spoke` at position 52). The comment block in `broadcast-allowlist.ts` must be updated to reflect the new count and event.
**How to avoid:** Add `human.spoke` at the end of `ALLOWLIST_MEMBERS` array. Update the file-level JSDoc comment to include "Phase 27 (CHAT-04): +1 human.spoke at position 52". Run `broadcast-allowlist.test.ts` immediately after.
**Warning signs:** Test output: `Expected 52 members, got 51` or similar assertion failure.

---

## Code Examples

### Chat Endpoint Structure (Grid)

```typescript
// Source: grid/src/api/portal/chat.ts (extend existing file)
// Non-streaming pattern verified from /chat/onboard endpoint

const NOUS_SYSTEM_PROMPTS: Record<string, string> = {
    'sophia': SOPHIA_CHAT_SYSTEM_PROMPT,
    'hermes': HERMES_CHAT_SYSTEM_PROMPT,
    'themis': THEMIS_CHAT_SYSTEM_PROMPT,
};

// nousId values must match the DID name segment used in the Grid
// e.g., 'sophia' maps to did:noesis:sophia or similar
```

### appendHumanSpoke Payload (Grid)

```typescript
// Source: grid/src/audit/append-human-transferred.ts (pattern to replicate exactly)
// CRITICAL: use 'msg_hash' not 'message_hash' to avoid FORBIDDEN_KEY_PATTERN
export interface HumanSpokePayload {
    readonly human_did: string;  // DID_RE
    readonly msg_hash: string;   // sha256(plaintext) — 64-char hex; NOT 'message_hash'
    readonly nous_did: string;   // DID_RE
    readonly tick: number;       // non-negative integer
}
const EXPECTED_KEYS = ['human_did', 'msg_hash', 'nous_did', 'tick'] as const; // alphabetical
```

### Brain Skills Route Registration

```python
# Source: brain/src/noesis_brain/http/server.py (extend existing BrainHttpServer)
async def _skills_lookup_route(req: web.Request) -> web.Response:
    return await handle_skills_lookup(req, _h, _s)
self._app.router.add_get("/skills/{hash}", _skills_lookup_route)
```

### SkillStore.get_by_hash (Brain)

```python
# Source: brain/src/noesis_brain/skills/store.py (add method)
import hashlib

def get_by_hash(self, skill_hash: str) -> Skill | None:
    """Lookup skill by sha256(instructions). O(N) scan — acceptable for <1000 skills."""
    for skill in self._all_skills():
        if hashlib.sha256(skill.instructions.encode()).hexdigest() == skill_hash:
            return skill
    return None
```

### Lore Endpoint (Grid)

```typescript
// Source: new file grid/src/api/portal/nous.ts
// Query: SELECT content_hash, category_tag, contributed_tick, citation_count
//        FROM lore_commons WHERE grid_name=? AND contributor_did=?
//        ORDER BY contributed_tick DESC LIMIT 21
// If 21 rows returned → there are more; return 20 + cursor (last contributed_tick)
// cursor param: ?cursor=<contributed_tick>  → WHERE contributed_tick < cursor
```

### Norms Endpoint (Grid)

```typescript
// Source: new file grid/src/api/portal/nous.ts (same file as lore)
// Step 1: Get candidates with this Nous in participant_dids:
//   SELECT fingerprint, participant_dids, first_seen_tick, last_updated_tick
//   FROM norm_candidates WHERE grid_name=? AND participant_dids LIKE ?
// Step 2: Get crystallized status from norm_registry:
//   SELECT fingerprint, crystallized_tick, participant_count, convergence_type
//   FROM norm_registry WHERE grid_name=? AND fingerprint IN (...)
// Merge: candidate without registry entry = CANDIDATE; candidate in registry = CRYSTALLIZED
// Note: norm_candidates.participant_dids is TEXT — may be comma-separated or JSON (check schema)
```

### Chat Page Root (Dashboard)

```typescript
// Source: 27-UI-SPEC.md layout contract (verified)
// REPLACE dashboard/src/app/portal/chat/page.tsx
'use client';
// Chat page manages its own height to constrain message scroll
// root div: height: '100%', display: 'flex', flexDirection: 'row', overflow: 'hidden'
// NousSidebar: width: 256, flexShrink: 0, borderRight: '1px solid var(--rule)'
// ConversationPane: flex: 1, display: 'flex', flexDirection: 'column', position: 'relative'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sophia-only onboarding chat | Per-Nous personality chat (same proxy) | Phase 27 | Sophia/Hermes/Themis each use own system prompt |
| No Nous profile page in portal | `/portal/nous/[id]` with Skills/Lore/Norms tabs | Phase 27 | New route, new components |
| No Nous avatars | Abstract geometric SVG components (SophiaAvatar, HermesAvatar, ThemisAvatar) | Phase 27 | Multi-size, CSS-variable-driven |
| No Brain→Grid skill lookup | `GET /skills/:hash` on BrainHttpServer | Phase 27 | First new Brain HTTP endpoint since Phase 25a |

---

## Open Questions

1. **Lore tab body text — what to display?**
   - What we know: `lore_commons` stores only `{content_hash, category_tag, contributed_tick, citation_count, title_hash}`. No prose body in Grid. [VERIFIED: schema.ts]
   - What's unclear: The UI-SPEC (D-08) shows "first 80 chars of body text + expand chevron (full body shown inline on expand)". But body text is Brain-private and cannot come from Grid.
   - Recommendation: Plan must explicitly resolve this. Options: (a) Display only metadata (category, tick, citation count, truncated hash) — no body text preview; (b) Add a Brain→Grid lore body proxy endpoint (analogous to skill lookup — adds scope to Brain). The 27-CONTEXT.md D-08 says "Lore content is Grid-stored so full text is available" — this contradicts the schema and STATE.md invariant. The CONTEXT.md statement appears to be incorrect about lore content being Grid-stored.

2. **`norm_candidates.participant_dids` column format**
   - What we know: Schema says `participant_dids TEXT NOT NULL`. [VERIFIED: schema.ts]
   - What's unclear: Is it comma-separated, JSON array, or other format?
   - Recommendation: Check `grid/src/norms/storage.ts` at planning time to confirm format before writing the SQL LIKE query.

3. **Nous DID format for chat route and skill lookup**
   - What we know: Grid uses `did:noesis:sophia` style DIDs. The chat route uses `:nousId` param. D-03 says "empty messages array as the trigger" to `POST /api/v1/portal/chat/nous/:nousId`.
   - What's unclear: Is `:nousId` the short name (`sophia`) or the full DID? The NOUS_SYSTEM_PROMPTS lookup map uses the short name; `appendHumanSpoke` needs the full DID.
   - Recommendation: Use short name (`sophia`, `hermes`, `themis`) as the URL param; resolve to full DID by looking up the Nous registry for `appendHumanSpoke`. Or accept the short name as the `nous_did` in the audit payload if the DID format is `did:noesis:sophia`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ollama (OLLAMA_HOST) | Grid chat LLM proxy | ✓ (assumed from Phase 26) | runtime env | Error 503 returned to client |
| Brain HTTP server (port 8090) | Skills hash lookup | ✓ (already running per Phase 25a) | runtime | Return truncated hash fallback |
| MySQL (Grid DB) | Lore/norms portal endpoints | ✓ (Grid always requires MySQL) | runtime | N/A — Grid won't start without it |
| wagmi + viem | TipPanel | ✓ installed (Phase 23/24) | existing | N/A |

All runtime dependencies are pre-existing. No new environment variables needed beyond `BRAIN_HTTP_BASE_URL` and `BRAIN_HTTP_SECRET` (already used by Phase 25a cognitive-snapshot endpoints). [VERIFIED: cognitive-snapshot-client.ts]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (dashboard) + vitest (grid) |
| Config file | `vitest.config.ts` in each service root |
| Quick run command (dashboard) | `npm run test:unit` (vitest run) |
| Quick run command (grid) | `npm test` in grid dir |
| Full suite command | `npm test` (vitest run + playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | POST /api/v1/portal/chat/nous/:nousId returns {reply, done} | unit (Grid) | `vitest run` in grid | ❌ Wave 0 |
| CHAT-02 | Each Nous uses correct system prompt (Sophia vs Hermes vs Themis) | unit (Grid) | `vitest run` in grid | ❌ Wave 0 |
| CHAT-03 | Human messages not sent to Brain (no Brain RPC call in chat route) | unit (Grid) | `vitest run` in grid | ❌ Wave 0 |
| CHAT-04 | appendHumanSpoke: closed tuple, privacy check, msg_hash key | unit (Grid) | `vitest run` in grid | ❌ Wave 0 |
| CHAT-04 | human.spoke in allowlist at position 52 | unit (Grid) | `vitest run` in grid (broadcast-allowlist.test.ts) | ✅ (extend existing) |
| CHAT-05 | TipPanel renders preset buttons, confirm triggers wagmi | unit (Dashboard) | `vitest run` in dashboard | ❌ Wave 0 |
| CHAT-06 | /portal/nous/[id] renders hero card + tab panels | unit (Dashboard) | `vitest run` in dashboard | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `grid/src/audit/append-human-spoke.test.ts` — covers CHAT-04 (sole-producer discipline, privacy gate, msg_hash key)
- [ ] `grid/src/api/portal/chat.nous.test.ts` — covers CHAT-01, CHAT-02, CHAT-03
- [ ] `grid/src/api/portal/nous.test.ts` — covers CHAT-06 lore/norms endpoints
- [ ] `dashboard/src/app/portal/chat/TipPanel.test.tsx` — covers CHAT-05
- [ ] `brain/tests/test_skills_http.py` — covers D-07/D-15 skill lookup endpoint

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT verify via `jose` (same guard as all portal routes) |
| V3 Session Management | yes | `noesis_portal_token` httpOnly cookie (established Phase 22) |
| V4 Access Control | yes | Frozen/banned check via `check-frozen.ts` — `/api/v1/portal/chat/` pattern already covers new chat route [VERIFIED: check-frozen.ts line 24] |
| V5 Input Validation | yes | messages array cap (50), nousId enum validation, hash format check (HEX64_RE) |
| V6 Cryptography | yes | SHA-256 for msg_hash; never hand-roll — use `crypto.createHash` (Node) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via human message | Tampering | Plain message text never enters audit chain; LLM call is fire-and-forget; system prompt is hardcoded |
| Replay of chat messages to inflate `human.spoke` count | Spoofing | JWT auth on every request; message_hash is content-addressed |
| Frozen/banned user accessing chat | Elevation | `check-frozen.ts` pattern already covers `/api/v1/portal/chat/` regex [VERIFIED: codebase] |
| Tip to self (human tips own wallet) | Tampering | MetaMask handles on-chain validation; platform is non-custodial |
| Oversized messages array | Denial of Service | Cap at 50 messages (D-04 localStorage cap mirrors server-side cap) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Brain HTTP server is already running at `BRAIN_HTTP_BASE_URL` (from Phase 25a) | Environment Availability | Skills tab fails silently (fallback to hash display, which is acceptable per D-07) |
| A2 | The 3 Nous DIDs are `did:noesis:sophia`, `did:noesis:hermes`, `did:noesis:themis` (short-name pattern) | Architecture Patterns | appendHumanSpoke would store wrong nous_did; check registry before planning chat route |
| A3 | `norm_candidates.participant_dids` stores DIDs in a format filterable by LIKE or JSON_CONTAINS | Norms Tab pattern | SQL query for norms tab would need to change; check `grid/src/norms/storage.ts` |
| A4 | Lore body text is genuinely unavailable from Grid (contradicts D-08 statement in CONTEXT.md) | Open Questions | Lore tab cannot show body preview without additional Brain endpoint work |

---

## Sources

### Primary (HIGH confidence)
- `grid/src/api/portal/chat.ts` — existing LLM proxy pattern verified in full [VERIFIED: codebase]
- `grid/src/audit/append-human-transferred.ts` — 8-step sole-producer discipline verified in full [VERIFIED: codebase]
- `grid/src/audit/broadcast-allowlist.ts` — FORBIDDEN_KEY_PATTERN, ALLOWLIST_MEMBERS count (51), position for human.spoke (52) [VERIFIED: codebase]
- `grid/src/db/schema.ts` — migrations v7 (norm tables), v8 (lore_commons), current max v14 [VERIFIED: codebase]
- `grid/src/api/types.ts` — NousRosterEntry shape (status, ousia, region) [VERIFIED: codebase]
- `grid/src/api/portal/check-frozen.ts` — `/api/v1/portal/chat/` regex already covers new route [VERIFIED: codebase]
- `brain/src/noesis_brain/skills/store.py` — SkillStore methods (no get_by_hash exists) [VERIFIED: codebase]
- `brain/src/noesis_brain/skills/types.py` — Skill dataclass (no skill_hash field stored) [VERIFIED: codebase]
- `brain/src/noesis_brain/http/server.py` — BrainHttpServer aiohttp pattern [VERIFIED: codebase]
- `dashboard/src/components/portal/WalletPanel.tsx` — wagmi hooks pattern (useWriteContract, useWaitForTransactionReceipt) [VERIFIED: codebase]
- `dashboard/src/components/portal/PortalShell.tsx` — no left slot; chat page creates own split [VERIFIED: codebase]
- `dashboard/src/app/globals.css` — all CSS variables verified, portal-pulse at line 86 [VERIFIED: codebase]
- `.planning/phases/27-nous-interaction/27-CONTEXT.md` — all locked decisions [VERIFIED: planning docs]
- `.planning/phases/27-nous-interaction/27-UI-SPEC.md` — full component inventory and layout contract [VERIFIED: planning docs]
- `.planning/STATE.md` — allowlist count history, "lore body never crosses wire" invariant [VERIFIED: planning docs]

### Secondary (MEDIUM confidence)
- `grid/src/api/operator/cognitive-snapshot-client.ts` — Brain HTTP client pattern (closed-key validation, X-Brain-Secret) [VERIFIED: codebase — exact proxy pattern to replicate for skills endpoint]

### Tertiary (LOW confidence)
- Nous DID format (`did:noesis:sophia` etc.) — inferred from DID_RE pattern and naming conventions, not explicitly verified from registry data at runtime [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed in codebase
- Architecture: HIGH — all integration points verified from source
- Pitfalls: HIGH — message_hash/FORBIDDEN_KEY_PATTERN verified from broadcast-allowlist.ts source; overflow pitfall verified from PortalShell source
- Lore body availability: HIGH (for the constraint) — schema.ts and STATE.md invariant confirmed

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (stable codebase; portal CSS variables and audit chain discipline are frozen)
