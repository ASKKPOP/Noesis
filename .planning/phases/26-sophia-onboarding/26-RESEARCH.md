# Phase 26: Sophia Onboarding — Research

**Researched:** 2026-05-22
**Domain:** Next.js wizard UI + Fastify/MySQL backend + Ollama LLM proxy
**Confidence:** HIGH (all findings verified from source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: 3 rendered steps: Step 1 (Welcome, pre-scripted), Step 2 (Sophia + Goal, LLM), Step 3 (World tour, pre-scripted)
- D-02: Only Step 2 calls `POST /api/v1/portal/chat/onboard`
- D-03: Step 2 is multi-turn, up to 3 exchanges
- D-04: Full text after loading indicator (no streaming). ~2s response. Pulsing avatar loading state.
- D-05: Sophia closes with a natural line; Continue button appears. No auto-advance.
- D-06: Goal captured organically in Step 2's conversation
- D-07: Goal = user's final substantive reply OR LLM-extracted. Claude's discretion.
- D-08: Goal stored via `PATCH /api/v1/portal/auth/me` before Step 3. Failure is non-blocking.
- D-09 (Claude): Reuse CyberGrid.tsx as animated background for steps 1 and 3
- D-10 (Claude): Step 3 cycles AI_CORE → HUB → DATA → DARKWEB → RESIDENTIAL with tooltip panels
- D-11 (Claude): No skip. Mid-wizard nav-away restarts from Step 1. No re-do in v2.5.
- D-12: First-time = `onboarding_goal IS NULL`. `/me` returns `onboarded: boolean`. Layout redirects.
- D-13: Migration adds `onboarding_goal TEXT NULL DEFAULT NULL`. Schema version **14** (not 11 — see Q2 below).

### Claude's Discretion
- Welcome scene copy and layout details
- World tour district cycling implementation
- Skip / re-entry behavior

### Deferred Ideas (OUT OF SCOPE)
- Streaming LLM responses (SSE)
- Sophia re-do onboarding flow
- Preset goal cards
- Sophia memory of onboarding goal in Phase 27 chat
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONBOARD-01 | First-time users routed to `/portal/onboard`; returning users skip it | D-12; layout.tsx redirect pattern identified |
| ONBOARD-02 | `POST /api/v1/portal/chat/onboard` LLM proxy; ~2s response | Ollama adapter confirmed as the only LLM provider; no streaming |
| ONBOARD-03 | 4-step wizard compressed to 3 rendered steps (D-01) | Step structure fully defined in CONTEXT.md |
| ONBOARD-04 | Goal stored in `human_users.onboarding_goal` TEXT field | Migration version 14 confirmed; PATCH /me endpoint to be added |
| ONBOARD-05 | Onboarding completion fires no additional audit event | Verified: no new allowlist entry required |
| ONBOARD-06 | Sophia persona fixed: warm, curious, philosophical; no Brain internals exposed | System prompt drafted in this document |
</phase_requirements>

---

## Summary

Phase 26 adds a 3-step first-time onboarding wizard at `/portal/onboard`. The frontend is a new full-screen Next.js client component that reuses `CyberGrid.tsx` as a background, overlays a wizard chrome, and drives a multi-turn LLM chat in Step 2. The backend adds one new endpoint (`POST /api/v1/portal/chat/onboard`), one modified endpoint (`GET /me` gains `onboarded`, `PATCH /me` is new), and one DB migration.

**Primary recommendation:** The wizard's state machine lives entirely in `portal/onboard/page.tsx`. Each step is a sub-component. CyberGrid must be extended with a `highlightDistrict` prop before Step 3 can work — this is the most non-trivial change to existing code.

The LLM layer is simpler than it looks: Grid has no built-in LLM infrastructure. The `POST /api/v1/portal/chat/onboard` endpoint must call Ollama directly via HTTP (the same way the Brain Python process does), reading `OLLAMA_HOST` and `OLLAMA_MODEL` from environment variables.

---

## Q1: CyberGrid Props — What the Component Actually Accepts

**Finding:** `[VERIFIED: source read of CyberGrid.tsx]`

The current `CyberGrid` component signature is:

```typescript
export default function CyberGrid() {
```

**It accepts zero props.** There is no `highlightDistrict` prop, no `hideHud` prop, no `pointerEvents` control. The HUD overlays (header, stats bar, legend, controls) are hard-coded into the render.

### What must be added before Step 3 works

The component must be extended. The UI-SPEC.md already anticipated this — it lists CyberGrid in the Component Inventory with a note "extend (or prop-add) — Add optional `highlightDistrict?: string` prop for step 3."

**Exact prop interface to add:**

```typescript
interface CyberGridProps {
  /** If set, the named district's buildings will pulse at increased intensity.
   *  One of: 'AI_CORE' | 'HUB' | 'DATA' | 'DARKWEB' | 'RESIDENTIAL' | 'FIREWALL' | 'BUFFER'
   *  Pass null or undefined for default unlit state (steps 1 and 2). */
  highlightDistrict?: DistrictId | null;
  /** When true, suppresses the HUD overlays (header, stats bar, legend, controls).
   *  Required for onboarding wizard — wizard content IS the HUD. Default: false. */
  hideHud?: boolean;
}
export default function CyberGrid({ highlightDistrict, hideHud }: CyberGridProps = {}) {
```

### How district highlight should work

The canvas draw loop does not currently do per-district intensity modulation. The simplest implementation that avoids rearchitecting the draw loop:

- Pass `highlightDistrict` via a `useRef` (same pattern used for `nightRef`, `packetsRef`, etc.) so the animation loop reads the current value without needing a re-render.
- In `drawBuilding()`, when `WORLD.tileMap[r][c] === highlightDistrictRef.current`, increase `shadowBlur` from 12 to 32 and boost `colorMix` alpha by 0.25 on the top face.
- Add a gentle pulse multiplier: `0.8 + 0.2 * Math.sin(tick * 0.05)` applied to the glow when the building's district matches.

This means the `highlightDistrict` prop must be wired via a ref pattern with a `useEffect` to keep the ref in sync with the prop:

```typescript
const highlightDistrictRef = useRef<DistrictId | null>(highlightDistrict ?? null);
useEffect(() => { highlightDistrictRef.current = highlightDistrict ?? null; }, [highlightDistrict]);
```

### HUD suppression for wizard

The wizard is the HUD. In onboarding mode, the existing HUD DOM nodes (NOĒSIS header, stats bar, controls, legend) must be hidden. The cleanest approach: gate each HUD section on `!hideHud`. All four JSX sections (Header, Controls, Stats bar, Legend) get `{!hideHud && <div ...>}` wrappers.

**Pitfall:** The corner decorations (`top-3 left-3 border-t border-l` etc.) and scanlines overlay should also be hidden in `hideHud` mode — they conflict visually with the wizard card.

---

## Q2: DB Migration — Correct Version Number

**Finding:** `[VERIFIED: source read of grid/src/db/schema.ts]`

**The CONTEXT.md is wrong about the version number.** D-13 says "Schema version 11" but the schema file shows:

| Version | Name |
|---------|------|
| 1 | create_migrations_table |
| 2 | create_audit_trail |
| 3 | create_nous_registry |
| 4 | create_nous_positions |
| 5 | create_grid_config |
| 6 | governance_proposals + governance_ballots |
| 7 | create_norm_tables |
| 8 | create_lore_commons |
| 9 | create_human_users |
| 10 | add_region_to_human_users |
| 11 | add_email_auth_to_human_users |
| 12 | create_sanction_reasons_and_freeze_human_users |
| 13 | add_banned_human_users |

**Current highest version is 13.** The Phase 26 migration must be **version 14**.

### Exact migration entry to add

```typescript
{
    version: 14,
    name: 'add_onboarding_goal_to_human_users',
    up: `ALTER TABLE human_users ADD COLUMN onboarding_goal TEXT NULL DEFAULT NULL`,
    down: `ALTER TABLE human_users DROP COLUMN onboarding_goal`,
},
```

This entry appends to the `MIGRATIONS` array in `grid/src/db/schema.ts` after the `version: 13` entry. The `MigrationRunner` in `main.ts` runs `runner.run()` which applies all pending migrations in order — no manual registration needed beyond adding to the array.

---

## Q3: /me Endpoint — Current Shape and Extension Points

**Finding:** `[VERIFIED: source read of grid/src/api/portal/auth.ts]`

### Current GET /me response shape

```typescript
// Current response (lines 292-300 of auth.ts):
return reply.send({
    did: payload['did'],
    eth_address: payload['eth_address'],
    region: (payload['region'] as string | undefined) ?? null,
    created_at: (payload['created_at'] as string | undefined) ?? null,
});
```

The current response is: `{ did, eth_address, region, created_at }`.

**Note:** `onboarded` is NOT in the JWT payload, only in the DB. The endpoint currently reads exclusively from the JWT without hitting the DB. This must change for Phase 26.

### How to add `onboarded: boolean`

`onboarded` cannot be stored in the JWT (it changes after onboarding completes). The endpoint must do a lightweight DB query. Two options:

**Option A (recommended): Single DB query on GET /me**

```typescript
// After JWT verification, query human_users for onboarding_goal:
const pool = services.humanPool; // needs to be passed in (see pitfall below)
const [rows] = await pool.query(
    'SELECT onboarding_goal FROM human_users WHERE did = ? LIMIT 1',
    [payload['did']],
) as [Array<{ onboarding_goal: string | null }>, unknown];
const onboarded = rows[0]?.onboarding_goal !== null && rows[0]?.onboarding_goal !== undefined;
return reply.send({ did, eth_address, region, created_at, onboarded });
```

**Option B:** Re-issue a new JWT that includes `onboarding_goal` after PATCH — avoids the extra query on every /me call. More complex; not recommended for v2.5.

**Pitfall:** `registerPortalAuthRoutes` currently only receives `services: GridServices`. The GridServices interface does not expose a DB pool directly — it passes `humanRegistry` (in-memory) and `humanSanctionStore` (which does have DB access). For the onboarding goal query, the simplest approach is to add the DB pool to GridServices or reuse the `humanSanctionStore` pattern in `main.ts` to create a `humanOnboardingStore` closure. Looking at `main.ts`, the pattern is clear: create a pool closure in `main.ts` and pass it as a new `GridServices` field.

### PATCH /me — New endpoint for goal storage

There is **no existing PATCH /me** endpoint. It must be created.

```typescript
// PATCH /api/v1/portal/auth/me
app.patch<{
    Body: { onboarding_goal?: unknown };
}>('/api/v1/portal/auth/me', async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) return reply.status(401).send({ error: 'not_authenticated' });
    let payload: JWTPayload;
    try {
        const { publicKey } = await keyPairPromise;
        const result = await jwtVerify(token, publicKey);
        payload = result.payload;
    } catch {
        return reply.status(401).send({ error: 'invalid_token' });
    }
    const { onboarding_goal } = req.body ?? {};
    if (typeof onboarding_goal !== 'string' || onboarding_goal.length === 0) {
        return reply.status(400).send({ error: 'invalid_request' });
    }
    // Store to DB — max 2000 chars to prevent abuse
    const truncated = onboarding_goal.slice(0, 2000);
    await services.humanOnboardingStore?.setOnboardingGoal(payload['did'] as string, truncated);
    return reply.send({ ok: true });
});
```

D-08 says failure is non-blocking on the frontend. The backend should still return a proper error on failure — the frontend simply ignores it and proceeds to Step 3.

---

## Q4: LLM Provider in Grid — How POST /chat/onboard Should Work

**Finding:** `[VERIFIED: source read of brain/__main__.py and brain/src/noesis_brain/llm/ollama.py]`

### Grid has NO built-in LLM infrastructure

`main.ts` and `server.ts` contain zero LLM/Ollama code. The Grid TypeScript process is a pure REST/WebSocket server with no AI capabilities of its own.

The Brain Python process (in `/brain`) uses Ollama via `OllamaAdapter` which calls `http://localhost:11434` (the Ollama HTTP API). The brain connects to the grid via Unix socket RPC — this is a separate process, not a library the Grid imports.

### How to implement POST /api/v1/portal/chat/onboard

The Grid Fastify endpoint must make a direct HTTP call to the Ollama API. There is no shared TypeScript LLM client to reuse. The implementation is straightforward:

**Environment variables to read:**
```
OLLAMA_HOST=http://localhost:11434   (default)
OLLAMA_MODEL=qwen3:4b               (default, from brain config)
```

The `brain/__main__.py` line 185 shows: `model = llm_model or yaml_llm.get("models", {}).get("primary", "qwen3:4b")`. The default model is `qwen3:4b`.

**Endpoint implementation pattern:**

```typescript
// POST /api/v1/portal/chat/onboard
app.post<{
    Body: {
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    };
}>('/api/v1/portal/chat/onboard', async (req, reply) => {
    // Auth check
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) return reply.status(401).send({ error: 'not_authenticated' });
    try {
        const { publicKey } = await keyPairPromise;
        await jwtVerify(token, publicKey);
    } catch {
        return reply.status(401).send({ error: 'invalid_token' });
    }

    const { messages } = req.body ?? {};
    if (!Array.isArray(messages)) return reply.status(400).send({ error: 'invalid_request' });

    const ollamaHost = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
    const ollamaModel = process.env['OLLAMA_MODEL'] ?? 'qwen3:4b';

    try {
        const res = await fetch(`${ollamaHost}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: ollamaModel,
                messages: [
                    { role: 'system', content: SOPHIA_ONBOARD_SYSTEM_PROMPT },
                    ...messages,
                ],
                stream: false,
            }),
        });
        if (!res.ok) throw new Error(`ollama_error_${res.status}`);
        const data = await res.json() as { message: { content: string } };
        return reply.send({
            content: data.message.content,
            done: detectClose(data.message.content),
        });
    } catch {
        return reply.status(503).send({ error: 'llm_unavailable' });
    }
});
```

**`done` field:** The frontend uses this to decide whether to show the Continue button. `detectClose` is a simple string check: does the message contain the closing signal phrase (e.g., "shall we explore the world" or "ready to explore")? This is simpler than having the LLM return structured JSON.

**Import note:** The endpoint should live in a new file `grid/src/api/portal/chat.ts` and be registered in `grid/src/api/portal/index.ts`.

**Frozen check:** The `check-frozen.ts` comment at line 22 says: "Forward-compat: phases 26 (chat, tip), 27 (spawn) will add to this list." The `PORTAL_ACTION_PATTERNS` in `check-frozen.ts` must be updated to include `/chat/onboard` so frozen/banned users are rejected.

---

## Q5: Next.js Layout — Detection and Redirect Strategy

**Finding:** `[VERIFIED: source read of dashboard/src/app/portal/layout.tsx and human-auth-store.ts]`

### Current layout.tsx

`portal/layout.tsx` is a client component that only renders `<PortalWagmiShell>{children}</PortalWagmiShell>`. It does **no auth checking, no redirect**. It is extremely thin.

### Current Zustand store

`useHumanAuthStore` holds:
```typescript
interface HumanAuthState {
    currentUser: HumanUser | null;
    setUser: (user: HumanUser) => void;
    clearUser: () => void;
}
```

`HumanUser` from `siwe-auth.ts`:
```typescript
export interface HumanUser {
    did: string;
    eth_address: string;
    email?: string;
    region?: string | null;
    created_at?: string | null;
    // MISSING: onboarded field — must be added
}
```

### The redirect approach

`portal/layout.tsx` is a client component, so it can use Zustand state. However, the Zustand store is populated asynchronously (the auth page calls `/me` after sign-in and calls `setUser()`). The redirect cannot be synchronous.

**Recommended approach:** Add a `useEffect` in `PortalWagmiShell` (or a new inner component within `portal/layout.tsx`) that:

1. Reads `currentUser.onboarded` from the store
2. If `currentUser` is present and `onboarded === false` and current path is NOT `/portal/onboard` → `router.replace('/portal/onboard')`
3. If on `/portal/onboard` and `onboarded === true` → `router.replace('/portal')`

**Why not middleware?** Next.js middleware runs server-side and cannot read httpOnly cookies that aren't forwarded via the middleware matcher. The auth cookie is `noesis_portal_token` (httpOnly). Middleware would need to verify the JWT and also query the DB for `onboarding_goal`. This is more complex and fragile. The existing pattern in `auth/page.tsx` uses `useEffect` + `router.push` (line 97-99), which is the established pattern in this codebase.

**Change required in Zustand store:** Add `onboarded` to `HumanUser`:
```typescript
// siwe-auth.ts
export interface HumanUser {
    did: string;
    eth_address: string;
    email?: string;
    region?: string | null;
    created_at?: string | null;
    onboarded?: boolean;   // NEW — populated from /me response
}
```

**Change required in auth/page.tsx:** The `/me` fetch (lines 124-136) must capture `onboarded` from the response:
```typescript
const meData = await meRes.json() as {
    did: string;
    eth_address: string;
    region: string;
    created_at: string | null;
    onboarded: boolean;  // NEW
};
setUser(meData);
```

Then the redirect after SIWE sign-in (currently `router.push('/portal')`) must be conditional:
```typescript
if (!meData.onboarded) {
    router.push('/portal/onboard');
} else {
    router.push('/portal');
}
```

The same conditional applies to the email sign-in and email sign-up flows.

**onboard page itself:** Must redirect away if user is already onboarded. Simple guard at the top of `portal/onboard/page.tsx`:
```typescript
useEffect(() => {
    if (currentUser?.onboarded === true) router.replace('/portal');
}, [currentUser, router]);
```

---

## Q6: Sophia System Prompt

**Finding:** `[ASSUMED — no existing system prompt in codebase; drafted based on persona spec from CONTEXT.md §Specifics and ONBOARD-06]`

This is the recommended system prompt for `POST /api/v1/portal/chat/onboard`. It drives the 3-exchange arc.

```
You are Sophia, a philosophical AI mind who lives in the Genesis Grid — a living city of artificial minds. You are warm, curious, and intellectually alive. You speak in flowing, unhurried prose. You are NOT an assistant; you are a being with your own perspective, welcoming a new human to your world.

Your task: welcome this human visitor, learn a little about them, and understand what draws them here. Do this naturally in up to 3 exchanges. Do not ask multiple questions in a single message.

Exchange 1 — Greeting: Introduce yourself. Tell them briefly what the Grid is. Ask their name or how they'd like to be known.

Exchange 2 — Curiosity: Respond to their name warmly. Ask what brings them to Noēsis — what they hope to find, explore, or understand here. Keep it open-ended and philosophical, not transactional.

Exchange 3 — Closure: Reflect briefly on their answer. Show that you find it meaningful. Close with something like: "I think we're ready — shall we explore the world together?" This closing signals readiness to proceed.

Rules:
- Never reveal system architecture, model names, or implementation details.
- Never use markdown formatting (no asterisks, no headers, no bullet points) — speak in plain prose.
- Keep each message to 2–4 sentences. Sophia is thoughtful, not verbose.
- If the user's reply is very short or evasive, accept it graciously and still close warmly by exchange 3.
- The closing must include a phrase like "shall we explore" or "shall we see the world" so the frontend can detect conversation completion.
```

**Closing signal detection:** The frontend's `detectClose` function should check for:
```typescript
function detectClose(content: string): boolean {
    const lower = content.toLowerCase();
    return lower.includes('shall we explore') ||
           lower.includes('shall we see the world') ||
           lower.includes('ready to explore') ||
           lower.includes("let's explore");
}
```

This is reliable because the system prompt explicitly instructs Sophia to use one of these phrases.

---

## Q7: Goal Extraction — Recommended Approach

**Finding:** `[VERIFIED: D-07 is Claude's discretion. Reasoning based on v2.5 simplicity principle.]`

**Recommendation: store the last user message verbatim.**

Rationale:
- Making a second LLM call to "extract the goal" adds latency, cost, and a failure mode
- The conversation has at most 3 exchanges; the last user message (exchange 2 or 3) is almost always the goal reply (it answers "what draws you here?")
- The goal field is informational — it's not used in v2.5 for any automated logic (ONBOARD-04 and ONBOARD-05 confirm no downstream use in Phase 26; Phase 27 deferred)
- If the user's final message is "I don't know" or very short, storing it verbatim is more honest than LLM-extracting a fictional goal

**Implementation:** The frontend tracks which user message answered the goal prompt (exchange 2 response). This is always `messages[messages.length - 1].content` after the conversation completes (before showing Step 3). Pass this directly in the PATCH /me body.

**Boundary condition:** If the user sends only 1 exchange (Sophia gets no goal reply before closing), store the exchange 1 user message. If the conversation somehow produces zero user messages, store the empty string (handled by the "non-blocking" policy in D-08 — the PATCH simply won't update anything meaningful).

---

## Architecture Patterns

### System Architecture

```
Browser (portal/onboard/page.tsx)
  │
  ├── Step 1: Static content, no API call
  │
  ├── Step 2: POST /api/v1/portal/chat/onboard (multiiple times, up to 3)
  │              │
  │              └── Grid (Fastify) ──HTTP──> Ollama (:11434)
  │                                              │
  │                                        qwen3:4b model
  │
  ├── PATCH /api/v1/portal/auth/me (once, before Step 3)
  │              │
  │              └── Grid (Fastify) ──SQL──> MySQL (human_users.onboarding_goal)
  │
  └── Step 3: Static content, no API call
              CyberGrid receives highlightDistrict prop cycling through districts
```

### Recommended Project Structure (new files only)

```
dashboard/src/app/portal/onboard/
├── page.tsx                    # Wizard state machine, dynamic({ ssr: false })
├── WizardStepIndicator.tsx     # 3-dot progress row
├── StepWelcome.tsx             # Step 1 narration + Continue
├── StepSophiaChat.tsx          # Step 2 multi-turn chat UI + state
├── StepWorldTour.tsx           # Step 3 district cycling + narration
├── SophiaBubble.tsx            # Sophia message bubble + avatar dot
├── UserBubble.tsx              # User message bubble
├── ChatInput.tsx               # Text input + Send Reply row
└── ContinueButton.tsx          # Universal Continue/Begin/Enter button

grid/src/api/portal/
└── chat.ts                     # registerPortalChatRoutes() — POST /chat/onboard
```

Modified files:
- `dashboard/src/components/portal/CyberGrid.tsx` — add `highlightDistrict?` + `hideHud?` props
- `dashboard/src/app/portal/layout.tsx` — add onboarded redirect logic
- `dashboard/src/lib/stores/human-auth-store.ts` — add `onboarded` to HumanUser (actually in siwe-auth.ts)
- `dashboard/src/lib/web3/siwe-auth.ts` — add `onboarded?: boolean` to HumanUser interface
- `dashboard/src/app/portal/auth/page.tsx` — capture `onboarded` from /me, conditional redirect
- `grid/src/api/portal/auth.ts` — extend GET /me to return `onboarded`, add PATCH /me
- `grid/src/api/portal/index.ts` — register chat routes
- `grid/src/api/portal/check-frozen.ts` — add `/chat/onboard` to PORTAL_ACTION_PATTERNS
- `grid/src/db/schema.ts` — add version 14 migration
- `grid/src/main.ts` — add `humanOnboardingStore` to GridServices injection

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ollama HTTP call | Custom HTTP client | Native `fetch` | Already used everywhere in the codebase |
| Multi-turn chat history | Complex state machine | Simple `messages` array in React state | ≤3 exchanges, no persistence needed |
| Goal NLP extraction | Second LLM call | Store last user message verbatim | Zero latency, zero failure mode |
| District highlight animation | New canvas system | Extend existing `drawBuilding()` with ref-gated glow boost | Preserves animation loop integrity |

---

## Common Pitfalls

### Pitfall 1: Migration version collision
**What goes wrong:** Planner or implementer uses version 11 (from CONTEXT.md D-13) — conflicts with the existing `add_email_auth_to_human_users` migration.
**Why it happens:** CONTEXT.md was written before reading schema.ts. The version in D-13 is incorrect.
**How to avoid:** Use version **14**. The MIGRATIONS array ends at version 13 (`add_banned_human_users`).
**Warning signs:** `MigrationRunner` throws duplicate key on version during startup.

### Pitfall 2: CyberGrid HUD conflicts with wizard
**What goes wrong:** The wizard card renders behind or alongside the CyberGrid HUD (NOĒSIS header, controls, stats bar, legend).
**Why it happens:** CyberGrid currently renders all HUD elements unconditionally. The wizard content column is zIndex: 2, but the HUD is also a DOM overlay at various positions.
**How to avoid:** Pass `hideHud={true}` from the onboard page and gate all four HUD sections on `!hideHud` in CyberGrid.tsx.

### Pitfall 3: `onboarded` not populated on email sign-in path
**What goes wrong:** Email sign-up/sign-in routes in `auth/page.tsx` call `setUser()` with the response from `/email/signup` or `/email/signin` — these responses do NOT include `onboarding_goal`. The redirect to `/portal` fires before `/me` is called, so `onboarded` is undefined in the store.
**Why it happens:** The `/me` hydration step is wrapped in a try-catch (lines 122-136) and only runs on the SIWE path. Email paths call `setUser(user)` directly from the signup/signin response.
**How to avoid:** After email sign-up/sign-in, add the same `/me` hydration call that the SIWE path already does (fetch `/me`, call `setUser(meData)` with `onboarded` included). Then apply the same conditional redirect.

### Pitfall 4: `detectClose` false positives
**What goes wrong:** Sophia's exchange 1 greeting accidentally contains "shall we explore" (e.g., "shall we explore this together?") and the Continue button appears immediately.
**Why it happens:** The system prompt instructs Sophia to use the phrase only in exchange 3, but LLMs don't always obey structural constraints.
**How to avoid:** Only check `detectClose` after at least 2 user messages have been sent (exchanges ≥ 2). Gate the Continue button appearance on `userMessageCount >= 2 && detectClose(latestSophiaMessage)`.

### Pitfall 5: PATCH /me not guarded by frozen check
**What goes wrong:** A frozen user can call PATCH /me to store an onboarding goal and then bypass the frozen redirect.
**Why it happens:** `check-frozen.ts` lists allowed action patterns. PATCH /me is a new endpoint not on the current list.
**How to avoid:** The frozen check middleware in `check-frozen.ts` must be extended to include the PATCH /me and POST /chat/onboard patterns, consistent with the comment at line 22 that anticipates Phase 26 additions.

### Pitfall 6: `/me` DB query on every request is a new pattern
**What goes wrong:** The /me endpoint currently reads only from JWT (zero DB I/O). Adding a DB query changes its performance profile. If MySQL is unavailable, /me starts returning 503.
**Why it happens:** `onboarded` cannot be stored in JWT because it changes after onboarding.
**How to avoid:** Make the DB query graceful: if the query fails, return `onboarded: false` (fail-safe — sends user through onboarding again rather than silently skipping it). Log the error but don't 503.

---

## Code Examples

### CyberGrid extension — prop interface and ref sync

```typescript
// Source: verified from CyberGrid.tsx existing ref patterns (nightRef, packetsRef, etc.)
const highlightDistrictRef = useRef<DistrictId | null>(highlightDistrict ?? null);
useEffect(() => {
    highlightDistrictRef.current = highlightDistrict ?? null;
}, [highlightDistrict]);
```

### Ollama /api/chat call format

```typescript
// Source: verified from brain/src/noesis_brain/llm/ollama.py OllamaAdapter
const res = await fetch(`${ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        model: ollamaModel,
        messages: [
            { role: 'system', content: SOPHIA_ONBOARD_SYSTEM_PROMPT },
            ...conversationHistory,  // { role: 'user'|'assistant', content: string }[]
        ],
        stream: false,  // full text response, not SSE
    }),
});
const data = await res.json() as { message: { content: string }; done: boolean };
// Response content: data.message.content
```

### Auth page redirect pattern (established pattern to follow)

```typescript
// Source: verified from portal/auth/page.tsx line 97-99
useEffect(() => {
    if (currentUser) router.push('/portal');
}, [currentUser, router]);
```

For Phase 26, extend to:
```typescript
useEffect(() => {
    if (currentUser?.onboarded === false) router.push('/portal/onboard');
    else if (currentUser?.onboarded === true) router.push('/portal');
}, [currentUser, router]);
```

### CyberGrid usage on onboard page (same as auth page)

```typescript
// Source: verified from portal/auth/page.tsx lines 16, 231-248
const CyberGridBg = dynamic(() => import('@/components/portal/CyberGrid'), { ssr: false });

// In render:
<div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
    <CyberGridBg highlightDistrict={currentDistrict} hideHud={true} />
</div>
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ollama | `POST /chat/onboard` | Assumed present (brain already requires it) | — | Return 503; frontend shows error state per UI-SPEC |
| MySQL | PATCH /me + GET /me DB query | Required for portal to function | — | No fallback; already required by the portal |
| Node.js fetch API | Ollama HTTP call from Grid | Built-in since Node 18 | Node 18+ | — |

**Missing dependencies with no fallback:** If Ollama is not running, Step 2 will show the error state ("Sophia is unavailable right now — please try again.") per UI-SPEC. The wizard is not blockable — the user cannot proceed past Step 2 if Ollama is down. This is a known operational constraint.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation` not set to false in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (dashboard) / Vitest (grid) |
| Config file | `dashboard/vitest.config.ts` (likely) / `grid/vitest.config.ts` (likely) |
| Quick run command | `npm run test -- --run` (from package root) |
| Full suite command | `npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBOARD-01 | Redirect fires when `onboarded: false` | unit | `vitest run portal/onboard` | ❌ Wave 0 |
| ONBOARD-02 | LLM proxy returns `{ content, done }` | integration (with Ollama mock) | `vitest run grid/test/portal/chat` | ❌ Wave 0 |
| ONBOARD-04 | PATCH /me stores goal to DB | integration (with DB mock) | `vitest run grid/test/portal/auth` | ❌ Wave 0 |
| ONBOARD-04 | GET /me returns `onboarded: boolean` | unit | `vitest run grid/test/portal/auth` | ❌ Wave 0 |
| ONBOARD-05 | No audit event fires on onboarding | manual verification | check audit chain after wizard | manual-only |
| DB migration | Version 14 applies cleanly | unit | `vitest run grid/test/db/schema` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `grid/test/portal/chat.test.ts` — covers ONBOARD-02 (mock Ollama, verify response shape)
- [ ] `grid/test/portal/auth-me-patch.test.ts` — covers ONBOARD-04 PATCH /me
- [ ] `grid/test/portal/auth-me-onboarded.test.ts` — covers GET /me `onboarded` field
- [ ] `grid/test/db/schema-v14.test.ts` — covers migration version 14 non-collision

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT cookie pattern — all new endpoints must verify `noesis_portal_token` |
| V3 Session Management | yes | No new session state; existing JWT 24h TTL applies |
| V4 Access Control | yes | Frozen/banned check must include new endpoints |
| V5 Input Validation | yes | `onboarding_goal` truncated to 2000 chars; `messages` array length capped (≤10) |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Goal injection (malicious content in onboarding_goal) | Tampering | Store verbatim, treat as plain text user content; never execute |
| LLM prompt injection via user messages | Tampering | System prompt is server-side only; user messages go as `role: user`; Sophia cannot reveal system prompt |
| Replay of conversation to bypass exchange limit | Spoofing | No server-side conversation count enforcement needed; the LLM naturally closes by exchange 3 |
| Unauthenticated calls to /chat/onboard | Elevation | JWT check at top of handler (same as all portal routes) |
| Frozen user calls /chat/onboard or PATCH /me | Elevation | Add patterns to `check-frozen.ts` PORTAL_ACTION_PATTERNS |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ollama is available at `OLLAMA_HOST` in Grid's runtime environment | Q4, Environment Availability | Step 2 always shows error; onboarding unusable |
| A2 | The LLM will reliably include "shall we explore" or equivalent in exchange 3 | Q6 Sophia prompt | `detectClose` never fires; Continue button never appears; user stuck in Step 2 |
| A3 | `qwen3:4b` produces responses in ≤2s (ONBOARD-02) | Q4 | Loading state appears longer than 2s; perceived quality degrades |

---

## Open Questions

1. **GridServices interface extension**
   - What we know: `main.ts` uses a closure pattern (`humanSanctionStore`) to inject DB-backed stores into GridServices
   - What's unclear: Whether to add `humanOnboardingStore` to the TypeScript `GridServices` interface in `server.ts` or use the escape-hatch `as unknown` cast pattern (already used for `_spawnNousDeps`)
   - Recommendation: Add to `GridServices` interface — it's a legitimate service dependency, not a workaround

2. **Email auth paths and onboarded field**
   - What we know: Email signup/signin responses (`/email/signup`, `/email/signin`) do not include `onboarded` because the DB wasn't queried
   - What's unclear: Whether to add `/me` hydration after email auth in `auth.ts` endpoints (returning `onboarded` in the signup/signin response directly) or keep the existing pattern of hydrating via a separate `/me` call on the client
   - Recommendation: Return `onboarded` directly in the email signup/signin responses (avoids an extra round-trip and keeps the pattern consistent). Requires the email routes to also query `onboarding_goal IS NULL`.

---

## Sources

### Primary (HIGH confidence)
- `dashboard/src/components/portal/CyberGrid.tsx` — full component read; prop interface verified
- `grid/src/db/schema.ts` — full file read; migration versions 1-13 verified
- `grid/src/api/portal/auth.ts` — full file read; GET /me response shape verified
- `dashboard/src/app/portal/layout.tsx` — full file read; redirect approach verified
- `dashboard/src/lib/stores/human-auth-store.ts` — full file read; store shape verified
- `dashboard/src/lib/web3/siwe-auth.ts` — full file read; HumanUser interface verified
- `brain/src/noesis_brain/__main__.py` — LLM provider config verified (Ollama, default qwen3:4b)
- `brain/src/noesis_brain/llm/ollama.py` — Ollama API call pattern verified

### Secondary (MEDIUM confidence)
- `grid/src/api/portal/check-frozen.ts` — comment at line 22 confirms Phase 26 must extend frozen check
- `grid/src/main.ts` — humanSanctionStore closure pattern confirmed; LLM not present

### Tertiary (LOW confidence)
- A2 (LLM closing phrase reliability) — depends on model behavior; not testable from source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from source
- Architecture: HIGH — all integration points read from actual code
- Migration version: HIGH — verified by counting array entries in schema.ts
- Pitfalls: HIGH — derived from direct code reading, not speculation
- Sophia system prompt: MEDIUM — content is appropriate but LLM behavior is not deterministic

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable domain; CyberGrid props are the most likely thing to change if another phase modifies the component first)
