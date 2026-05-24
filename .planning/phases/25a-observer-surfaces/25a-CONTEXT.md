# Phase 25a: Observer Surfaces — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Source:** Extracted from `.planning/phases/25-steward-console-expansion-humans-sanctions-cognitive-inspect/25-CONTEXT.md` (decisions D-01..D-06, D-14..D-19 — observer surfaces only)

<domain>
## Phase Boundary

Ship read-only operator-facing observability surfaces in the Steward Console. Five surfaces, zero new audit events, zero write actions:

1. **Live firehose** — new `/firehose` WebSocket-tailed page distinct from `/audit`, tuned for density (1-line color-coded rows).
2. **Cognitive inspector** — per-Nous cognitive observability backed by a NEW Brain HTTP endpoint `GET /brain/<did>/cognitive-snapshot` (H3+ gated, scrubbed metadata + skill TITLES only).
3. **Brain health metrics** — per-Nous metrics page surfacing four metric families derived from existing allowlisted audit events.
4. **Allowlist monitor** — static reference of allowlisted events + a runtime drift detector that catches non-allowlisted emissions.
5. **Humans profile + history** — new `/humans/[did]` drill-down page (KYC-ish profile + transaction history + per-human Nous roster).

**Explicitly out of scope for 25a:**
- All sanctions UI (mute, slash, quarantine, force-sleep, ban-human, freeze-wallet) → 25b
- Spawn-Nous wizard → 25b
- Replay scrubber → 25c
- Culture browser → 25c
- Any sanction buttons on `/humans/[did]` (those bolt on in 25b)

</domain>

<decisions>
## Implementation Decisions

### Cognitive inspector (NEW Brain endpoint — 25a's biggest move)

- **D-25a-02:** Cognitive inspector exposes hashes + counts + drive/sleep/iris snapshots derived from existing audit events, **plus** a new Brain-side read-only HTTP endpoint `GET /brain/<did>/cognitive-snapshot` that returns scrubbed cognitive metadata. This is a new Brain API surface — the FIRST read endpoint outside the tick RPC contract.
- **D-25a-03:** Brain `cognitive-snapshot` endpoint contract returns:
  ```
  {
    reflexion_count: int,
    rule_count: int,
    skill_titles_topk: string[],        // titles only, never bodies — top K by recency or salience
    drive_levels: { ananke: float, eros: float, logos: float, ... },
    last_sleep_tick: int,
    creed_violation_count: int
  }
  ```
  Skill titles (not bodies) are the one piece of Brain-internal text exposed; titles appear ONLY at this endpoint, never on the broadcast wire — hashes still travel in normal audit emissions.
- **D-25a-04:** Steward access to the Brain endpoint is **H3+ gated**. Steward backend proxies through Grid → Brain (no direct Brain access from steward frontend). Every cognitive-snapshot query emits `operator.inspected` to the audit chain (reuses existing event, **no allowlist delta**).
- **D-25a-05:** Brain endpoint must be grep-gated for plaintext fields. The FORBIDDEN_KEY_PATTERN list is extended to forbid emission of `reflexion_text`, `rule_text`, `creed_text`, `skill_body`, `lore_body`, `whisper_plaintext` from this endpoint. Only `skill_title` is exempt — by explicit allowance in the endpoint spec. A new CI grep gate `scripts/check-cognitive-snapshot-plaintext.mjs` enforces the forbidden list against the endpoint response shape and tests.
- **Brain endpoint authentication** (Claude's Discretion): planner picks the mechanism aligned with existing Grid↔Brain auth (shared secret, mTLS, or signed-request). MUST be documented in PLAN and CONTEXT-continuation.

### Brain health (25a)

- **D-25a-06:** Brain health page surfaces four metric families per Nous, ALL sourced from existing allowlisted events — zero new events:
  1. **Tick latency p50/p95 + queue depth** — Grid-side instrumentation, no Brain coupling. Reuses existing tick metrics if present; otherwise adds Grid-side timing without new audit events.
  2. **Reflexion buffer fill, skill store size, rule count** — counts from audit event aggregation (`nous.reflexion`, `nous.skill_taught`, `nous.rule_emitted`, etc.).
  3. **Drive levels from last `ananke.drive_crossed` + sleep cadence from `nous.sleep.entered` / `nous.sleep.completed` deltas.**
  4. **Coherence violations from `nous.creed_violation` count.**

### Live firehose (25a)

- **D-25a-14:** Live firehose is a **new `/firehose` route** distinct from `/audit`: WebSocket tail, no filters, no JSON expand, color-coded by event family (operator / nous / trade / law / iris / skill / norm / lore). Tunes for density (1-line rows). New Grid endpoint `GET /audit/firehose` (WebSocket upgrade).
- **D-25a-15:** `/audit` remains unchanged — paginated history with filters and JSON expand. Two routes, different jobs. **Component sharing between `/audit` and `/firehose` is a non-goal for 25a** (lean implementation; refactor later if drift causes maintenance pain).
- **WebSocket reconnection / backpressure** (Claude's Discretion): planner picks reconnect strategy and overflow handling.

### Allowlist monitor (25a)

- **D-25a-16:** Allowlist monitor shows static reference (event name, payload schema, sole-producer file path) **plus** runtime drift detection: a Grid-side hook on `AuditChain.append` catches non-allowlisted `event_type` emissions and surfaces them in a red alert panel. Defense-in-depth against allowlist violations — currently CI-only via grep gate.
- **D-25a-17:** Static reference data sourced from `grid/src/audit/broadcast-allowlist.ts` at Steward build time (no runtime parsing of TypeScript). Runtime drift detector is a new Grid endpoint `GET /audit/drift-alerts` reading from a Grid-side ring buffer. Ring buffer size and retention policy: planner picks (Claude's Discretion), with default ≥256 entries / ≥1h retention.

### Humans expansion (25a slice only — read-only)

- **D-25a-18:** Humans gets `/humans/[did]` (25a, read-only):
  - **KYC-ish profile pane**: wallet, joined-at, region, last-active, Nous count, coin balance
  - **Transaction history**: SIWE sessions, Cyber Coin transfers in/out, whispers sent, regions visited
  - **Per-human Nous roster**: humans's owned Nous (`humanOwner` field — currently mostly empty; useful when Phase 27 ships)

  Sanction controls (ban-human, freeze-wallet) are **explicitly out of scope** for 25a and bolt on in 25b on the same page.
- **D-25a-19:** Existing `/users` route in steward (basic roster from `portal.auth` audit events) is retained for the index view. `/humans/[did]` is the drill-down. The `/users` row click target may be wired to deep-link into `/humans/[did]` (Claude's Discretion).

### Inherited from Phase 25 umbrella

- **D-25a-01 (from 25 D-01):** This is sub-phase 25a of the Phase 25 umbrella split. 25a ships first, sequentially before 25b (sanctions + spawn) and 25c (replay + culture). Each sub-phase has its own CONTEXT, PLAN, VERIFICATION. **Allowlist delta for 25a = 0** (deltas concentrated in 25b: +6 events).

### Claude's Discretion

- Visual styling, layout, color palettes for new pages — follow existing StewardShell patterns (commit `becc6e7`).
- WebSocket reconnection / backpressure behavior for `/firehose` tail.
- Brain endpoint authentication mechanism (shared secret, mTLS, signed request) — planner decides based on existing Grid↔Brain auth pattern.
- Ring buffer size + retention for `GET /audit/drift-alerts`.
- Color palette for event-family color coding on `/firehose`.
- `/users` ↔ `/humans/[did]` deep-link wiring detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 25a substrate

- `.planning/ROADMAP.md` §"Phase 25a: Observer surfaces" — phase title + scope
- `.planning/phases/25-steward-console-expansion-humans-sanctions-cognitive-inspect/25-CONTEXT.md` — parent Phase 25 context (decisions D-01..D-24, this CONTEXT extracts the 25a subset)
- `.planning/STATE.md` — current allowlist enumeration (positions 1-41), v2.5 budget (43→47), v2.4 invariants block
- `.planning/PROJECT.md` — worldview, Brain-private invariant, first-life promise
- `CLAUDE.md` (project root) — doc-sync rule, working principles

### Existing Steward Console (foundation for the expansion)

- `steward/src/components/StewardShell.tsx` — shared sidebar/header layout (commit `becc6e7`)
- `steward/src/app/page.tsx` — Dashboard (uses StewardShell)
- `steward/src/app/audit/page.tsx` — current `/audit` history page with filters + expand (pattern reference for `/firehose` row rendering)
- `steward/src/app/users/page.tsx` — current users-from-audit-events roster (pattern reference for `/humans/[did]`; entry-point to deep-link)
- `steward/src/app/nous/[id]/page.tsx` — existing Nous detail (pattern reference for `/humans/[did]` drill-down layout, AND for where the cognitive inspector card mounts)
- `steward/src/app/system/page.tsx` — clock pause/resume (existing H3 operator UI pattern; reference for where brain health and allowlist monitor cards mount)

### Brain-private + allowlist invariants

- `grid/src/audit/broadcast-allowlist.ts` — authoritative `ALLOWLIST_MEMBERS` source. **25a does NOT extend this** (delta = 0).
- `scripts/check-state-doc-sync.mjs` — 41-event invariant gate (no changes in 25a).
- `scripts/check-whisper-plaintext.mjs` — pattern reused for new Brain endpoint's plaintext gate (D-25a-05). Plan a new `scripts/check-cognitive-snapshot-plaintext.mjs` that mirrors the pattern.
- `grid/src/audit/forbidden-keys.ts` (or equivalent) — `FORBIDDEN_KEY_PATTERN`. Extend with: `reflexion_text|rule_text|creed_text|skill_body|lore_body|whisper_plaintext` enforced against the new Brain endpoint (`skill_title` is the exempt field, NEVER add it to the forbidden list).

### Brain interface (NEW endpoint in 25a — biggest architectural addition)

- `brain/src/noesis_brain/` — existing tick RPC contract; new cognitive-snapshot endpoint must coexist without coupling to tick path. Identify the existing HTTP/RPC layer to extend.
- `brain/src/noesis_brain/skills/` — SkillStore (FTS5) — source of `skill_titles_topk`. Identify the read API.
- `brain/src/noesis_brain/coherence_gate.py` (or equivalent) — creed text stays Brain-private, never returns from endpoint.
- Existing Grid↔Brain auth pattern (Claude's Discretion to identify and reuse).

### Existing operator agency primitives (background — 25a does not extend)

- `grid/src/operators/` — existing `operator.inspected` emitter (reused by cognitive inspector queries). Sole-producer pattern.

### Replay/culture/Phase 21 (out of scope for 25a, listed only as 25c precursor — do NOT plan against these in 25a)

- `.planning/phases/21-culture-dashboard/` — deferred to 25c
- `.planning/phases/13-operator-replay-export/` — deferred to 25c

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (25a)

- **StewardShell** (`steward/src/components/StewardShell.tsx`) — wraps every new page for consistent sidebar nav. New routes for 25a: `/firehose`, `/humans/[did]`, plus inline sections/cards on `/nous/[id]` (cognitive inspector + brain health) and `/system` (allowlist monitor card group).
- **`/audit` page expand+filter components** — pattern for `/firehose` row rendering (strip filters/expand for density; reuse color-coding utilities if any).
- **`/system` clock pause/resume** — pattern for H3 gating (cognitive inspector is H3+, same auth pattern even though it's read-only).
- **`/nous/[id]` existing detail card structure** — mount point for cognitive inspector and brain health metric cards.

### Established Patterns

- **Sole-producer audit emitters** — 25a emits ONLY existing events. The cognitive-snapshot query reuses `operator.inspected` (existing emitter, do not duplicate).
- **CI grep gates** — `scripts/check-*.mjs` pattern. 25a adds `scripts/check-cognitive-snapshot-plaintext.mjs` for plaintext leak prevention.
- **Steward backend proxies to Grid; Grid optionally proxies to Brain** — extend this for `cognitive-snapshot` endpoint. Steward never talks directly to Brain.
- **Brain-private hash discipline** — 25a Brain endpoint is the FIRST place skill titles (not bodies) cross out of Brain. Locked as an explicit, audited exception.
- **WebSocket-on-existing-HTTP-server** — confirm pattern Grid uses (Node `ws`, Bun built-in, etc.) before planning `/audit/firehose`.

### Integration Points (25a)

- **New Steward routes** (under `steward/src/app/`): `/firehose`, `/humans/[did]`
- **New Steward inline sections / cards** (mounted on existing pages):
  - On `/nous/[id]`: cognitive inspector panel + brain health metric cards
  - On `/system`: allowlist monitor card group (static reference + runtime drift alert panel)
- **New Grid endpoints:**
  - `GET /audit/firehose` (WebSocket upgrade for `/firehose` tail)
  - `GET /audit/drift-alerts` (allowlist runtime drift detector ring buffer reader)
  - `GET /steward/cognitive-snapshot/<did>` (H3+ proxy to Brain — Steward never calls Brain directly)
- **New Brain endpoint:**
  - `GET /brain/<did>/cognitive-snapshot` (Grid-only caller, H3+ gated via Grid)
- **Steward backend new proxy routes** for all of the above.
- **AuditChain runtime hook** (Grid-side): non-allowlisted `event_type` emission detector populating the drift-alerts ring buffer.

</code_context>

<specifics>
## Specific Ideas

- Cognitive inspector card layout: hash row + counts row + drive bars + sleep/creed metadata. Skill titles render as a top-K list (5-10 entries).
- `/firehose` tunes for **density**: 1-line rows, color-coded by event family. Not forensics — that's `/audit`'s job. Auto-scroll with pause-on-hover.
- Allowlist monitor uses **red alert panel** for runtime drift — visually distinct from normal data tables. Each drift entry: `event_type`, `emitter_file_path` (if detectable), `tick`, `caller_did`.
- `/humans/[did]` follows the same drill-down spine as `/nous/[id]`: header card + tabbed sections (profile / transactions / Nous roster).
- Brain endpoint authentication: prefer reusing existing Grid↔Brain auth pattern (do not invent new).
- `scripts/check-cognitive-snapshot-plaintext.mjs` greps both endpoint implementation AND its tests for forbidden plaintext keys.

</specifics>

<deferred>
## Deferred Ideas

- **Inline replay scrubber on `/audit` rows** — deferred to 25c (modal UX wins; not 25a's scope).
- **CI report card on allowlist monitor** — deferred. Runtime drift + static reference is enough for 25a. CI reporting is a separate observability surface.
- **Component sharing between `/audit` and `/firehose`** — non-goal for 25a (lean first; refactor only if drift causes maintenance pain).
- **Sanction controls on `/humans/[did]`** — explicit 25b bolt-on; 25a leaves stub or scaffolds the section header only if it helps 25b land cleanly (Claude's Discretion — preferred: no stubs).
- **Time-window slider on `/culture`** — irrelevant to 25a (Phase 25c).
- **Always-on `/replay` route** — irrelevant to 25a (Phase 25c modal-only).

</deferred>

---

*Phase: 25a-observer-surfaces*
*Context extracted: 2026-05-21 from 25-CONTEXT.md (decisions D-01..D-06, D-14..D-19)*
*Sequential sub-phase plan: 25a (this) → 25b → 25c*
