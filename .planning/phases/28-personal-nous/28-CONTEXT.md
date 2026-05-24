# Phase 28: Personal Nous — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Humans can spawn their own Nous agent in the Genesis Grid via a 4-step wizard at
`/portal/nous/spawn`. The spawn costs Cyber Coin (paid on-chain), produces a
`did:noesis:human-nous:<username>-<name>` DID, wires the `humanOwner` field, and fires
`nous.spawned_by_human` (allowlist 52→53). The personal Nous joins the Grid alongside
Sophia/Hermes/Themis and runs in the shared Brain container with a personality shaped by
the chosen seed (Explorer/Scholar/Merchant/Guardian).

**Allowlist delta: +1** (`nous.spawned_by_human`). Running total after Phase 28: 53.

**Requirements covered:** SPAWN-01 through SPAWN-06 (labeled "Phase 27" in v2.5-requirements.md —
see canonical refs note below).

**Out of scope in Phase 28:**
- Dedicated Brain Docker container per personal Nous (deferred — shared Brain is the v2.5 model)
- Multiple Nous per human (max 1 per SPAWN-06)
- Owner management controls (rename, suspend) — Brain sovereignty preserved
- Community features (Phase 29)

</domain>

<decisions>
## Implementation Decisions

### Brain Provisioning (D-01, D-02)

- **D-01:** Personal Nous runs in the **shared Brain container** — same Brain service that handles
  Sophia, Hermes, and Themis. Grid calls Brain API to register the new Nous context. No separate
  Docker container provisioning. SPAWN-03's "Docker container" note was aspirational and is
  out of scope for v2.5.

- **D-02:** Personal Nous chat uses the **same `POST /api/v1/portal/chat/nous/:nousId` endpoint**
  as the three genesis Nous (Phase 27 chat infrastructure). The personal Nous gets a distinct system
  prompt generated from its personality seed (see D-08). No new chat endpoint.

### Payment Gate (D-03, D-04)

- **D-03:** Spawn requires **on-chain USDT payment before spawning**. User sends USDT to Grid
  treasury on-chain via wagmi (same send pattern as WALLET-02 / tip flow). Grid confirms the
  transaction before the Nous is spawned. Wizard blocks at step 4 ("Confirm & Pay") until Grid
  confirms.

- **D-04:** Payment confirmation uses **polling** — Dashboard polls
  `GET /api/v1/portal/nous/spawn/status/:txHash` every 3 seconds for up to 2 minutes. Grid polls
  its RPC in the background for tx confirmation. Same pattern as Cyber Coin send (WALLET-02).
  Consistent with existing codebase; no SSE/long-poll infrastructure needed.

### Routing & My Nous Page (D-05, D-06, D-07)

- **D-05:** `/portal/my-nous` route is an **owner hub** that shows:
  - HeroCard + Skills/Lore/Norms tabs (same as public `/portal/nous/[id]` from Phase 27)
  - PLUS owner-only section: spawn metadata (seed type, spawn date, USDT cost paid),
    prominent "Chat with [Name]" shortcut, and the Nous's Cyber Coin balance
  - No management controls (Brain sovereignty preserved per SPAWN-05)

- **D-06:** `/portal/my-nous` serves **double duty** — before spawn it shows the empty-state
  CTA ("Spawn Your Nous" button). After spawn it shows the owner hub (D-05). The route does
  NOT show the wizard inline — the button navigates to `/portal/nous/spawn`.

- **D-07:** The 4-step spawn wizard lives at **`/portal/nous/spawn`** (separate route per SPAWN-01).
  Steps: (1) Name your Nous, (2) Pick personality seed, (3) Pick starting region, (4) Confirm & Pay.

### Personality Seeds → Brain (D-08, D-09)

- **D-08:** Seeds wire into **Brain psyche as Big Five preset values**. Each seed maps to specific
  initial Big Five personality values (openness, conscientiousness, extraversion, agreeableness,
  neuroticism) that are passed to the Brain on spawn. This shapes the Nous's drive dynamics and
  decision-making over time via the existing Psyche system (BRAIN-01).

  Seed → Big Five direction (Claude sets exact values):
  - **Explorer** → high openness, moderate extraversion, low conscientiousness
  - **Scholar** → high openness, high conscientiousness, low extraversion
  - **Merchant** → high extraversion, high conscientiousness, moderate agreeableness
  - **Guardian** → high agreeableness, high conscientiousness, low openness

- **D-09:** `bootstrapPsycheHash` (in `grid/src/genesis/launcher.ts`) is **extended to accept an
  optional `personalitySeed` parameter** that biases the initial Big Five hash output. Grid passes
  the seed type (string) in the `spawnNous` call. No separate Brain API endpoint needed —
  seed influence is encoded at spawn time via the extended hash function.

### Claude's Discretion

- Exact Big Five float values for each seed preset (within the directions from D-08)
- System prompt text written per seed type for LLM chat personality
- How `bootstrapPsycheHash` extension is implemented (deterministic bias approach)
- Wizard step UI design details (progress indicator, loading animation during payment confirmation)
- Loading state during Grid payment confirmation (reuse Phase 26 "Sophia is thinking…" pulsing style)
- Empty state design on `/portal/my-nous` before spawn (CTA button layout, copy)
- Error states in wizard (payment failed, spawn unavailable, Nous name conflict)
- How `?nous=<id>` pre-selection is passed to `/portal/chat` from "Chat with [Name]" on owner hub

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

**⚠ Requirements doc phase number mismatch:** `v2.5-requirements.md` labels Personal Nous
requirements as "Phase 27" (the doc was written before Phase 26 Sophia Onboarding became its
own phase). These SPAWN-01–06 requirements are for Phase 28 in the actual roadmap.

### Requirements
- `.planning/research/v2.5-requirements.md` §SPAWN — SPAWN-01 through SPAWN-06 are the
  authoritative requirements for Phase 28 (ignore the "Phase 27" label in that section header)

### Grid Backend
- `grid/src/api/operator/spawn-system-nous.ts` — operator spawn reference pattern to extend
  for the portal human-spawn route; DID scheme differs (`human-nous` not `system`)
- `grid/src/genesis/launcher.ts` — `spawnNous(name, did, publicKey, region, humanOwner?)` is
  the spawn entry point; `bootstrapPsycheHash` is here and needs the seed extension (D-09)
- `grid/src/genesis/types.ts` — `humanOwner` field already typed; `personality_seeds` may need
  to be added
- `grid/src/registry/types.ts` — `humanOwner?: string` already present; verify `personalitySeed`
  needs to be added
- `grid/src/audit/broadcast-allowlist.ts` — add `nous.spawned_by_human` at position 53;
  current count after Phase 27: 52
- `grid/src/audit/append-human-transferred.ts` — sole-producer pattern to clone for
  `appendNousSpawnedByHuman`
- `grid/src/db/schema.ts` — check current migration version; may need column for
  `personality_seed` in `nous_registry` table
- `grid/src/api/portal/check-frozen.ts` — verify spawn endpoint exemption exists or add it

### Dashboard
- `dashboard/src/app/portal/my-nous/page.tsx` — Phase 27 placeholder to REPLACE with owner hub
- `dashboard/src/app/portal/nous/` — create `spawn/page.tsx` (4-step wizard)
- `dashboard/src/components/portal/WalletPanel.tsx` — wagmi send pattern to reuse for spawn
  payment (D-03); `useSendTransaction` / `useWriteContract` hook pattern
- `dashboard/src/app/globals.css` — CSS variables (`--bronze`, `--navy`, `--serif`, etc.);
  no raw color values, no Tailwind color tokens

### Prior Phase Context
- `.planning/phases/27-nous-interaction/27-CONTEXT.md` — HeroCard + Skills/Lore/Norms tab
  pattern to reuse in owner hub (D-05); wagmi `dynamic({ ssr: false })` pattern; portal
  CSS variable usage; `GET /api/v1/grid/nous/:id` data shape
- `.planning/phases/26-sophia-onboarding/26-CONTEXT.md` — loading indicator style ("Sophia
  is thinking…" pulsing) to reuse during payment confirmation wait
- `.planning/phases/24-portal-shell/24-CONTEXT.md` — PortalShell structure; mobile-responsive
  patterns

### Brain
- Investigate `brain/nous/psyche/` or equivalent module (Phase 1 BRAIN-01) to understand
  how Big Five values are initialized — `bootstrapPsycheHash` output must be traced here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `launcher.spawnNous(name, did, publicKey, region, humanOwner?)` — ready to call with
  `humanOwner` set; only needs the `personalitySeed` extension (D-09)
- `spawn-system-nous.ts` — operator spawn route shows the DID generation pattern (`crypto.randomUUID()`),
  the sole-producer audit discipline, and the `SpawnNousDeps` injection pattern for testability;
  portal spawn route should follow the same structure with different auth (JWT not header-auth)
  and different DID scheme (`did:noesis:human-nous:<username>-<name>`)
- `WalletPanel.tsx` — wagmi `useSendTransaction` / `useWriteContract` hooks for on-chain
  USDT transfer; reuse for spawn payment (D-03)
- Phase 27 `NousProfile` components (HeroCard, ProfileTabBar, Skills/Lore/Norms tabs) — reuse
  directly in owner hub (D-05); no structural changes needed
- `appendHumanTransferred.ts` — sole-producer pattern to clone verbatim for
  `appendNousSpawnedByHuman` (DID_RE import, `Object.keys` sort, `EXPECTED_KEYS` assertion)

### Established Patterns
- **CSS variables only**: `style={{ color: 'var(--ink)' }}` — never Tailwind color tokens
- **`dynamic({ ssr: false })`**: Required for any wagmi-dependent wizard steps (payment step)
- **`fetch` with `credentials: 'include'`**: All Grid calls include `noesis_portal_token` cookie
- **Non-streaming LLM proxy**: personal Nous chat returns `{reply: string, done: boolean}` —
  same contract as onboarding/Phase 27 chat; no SSE
- **Polling pattern**: existing WALLET-02 polling interval/timeout to use as reference for
  payment confirmation polling (D-04)

### Integration Points
- `POST /api/v1/portal/nous/spawn` — new portal-auth endpoint (JWT); calls `launcher.spawnNous`
  after confirming on-chain payment
- `GET /api/v1/portal/nous/spawn/status/:txHash` — new polling endpoint for payment confirmation
- `GET /api/v1/portal/human/me` — returns `humanOwner` and human DID; add `nousOwned` (array
  of owned Nous DIDs) or `hasNous` boolean here, or add a separate
  `GET /api/v1/portal/human/me/nous`
- `bootstrapPsycheHash` extension — adds optional `personalitySeed?: string` param; used only
  at spawn time; audit payload carries seed value for forward compat

</code_context>

<specifics>
## Specific Ideas

- **DID scheme for personal Nous** (SPAWN-02): `did:noesis:human-nous:<username>-<name>` — e.g.,
  `did:noesis:human-nous:henry-eidolon`. The `<username>` segment comes from the human's display
  name (ENS or truncated address) and `<name>` is what they type in step 1. Must pass existing
  DID regex `/^did:noesis:[a-z0-9_\-]+$/i`.
- **Max 1 Nous cap** (SPAWN-06): Grid endpoint returns `409 already_owns_nous` if human already
  has a Nous. Dashboard blocks the wizard with a redirect to `/portal/my-nous`.
- **Spawn cost** (SPAWN-01): 50 USDT equivalent. Configurable in Grid env var
  `SPAWN_COST_USDT` — not hardcoded.
- **`ALLOW_HUMAN_SPAWNED_NOUS=true`** (SPAWN-03): If this env var is not set, spawn endpoint
  returns `503 spawn_not_enabled` and the wizard shows "Personal Nous spawning is coming soon."

</specifics>

<deferred>
## Deferred Ideas

- **Dedicated Brain Docker container per human Nous** — SPAWN-03's Docker provisioning vision.
  Deferred to v2.6+; shared Brain is sufficient for v2.5.
- **Multiple Nous per human** — SPAWN-06 caps at 1 in v2.5. Multi-Nous ownership is a v2.6
  decision.
- **Brain memory injection from human messages** — same as Chat (CHAT-03 in Phase 27). Brain
  sovereignty preserved; human chat messages never enter Nous memory in v2.5.
- **Nous rename / suspend controls** — owner hub shows no management controls in Phase 28.
  Future phases could add a rename action (would require DID update — complex).
- **Treasury funding mechanism** — spawn cost goes to a Grid treasury address; how the treasury
  is managed (operator withdrawal, redistribution) is deferred to v2.6.

</deferred>

---

*Phase: 28-personal-nous*
*Context gathered: 2026-05-23*
