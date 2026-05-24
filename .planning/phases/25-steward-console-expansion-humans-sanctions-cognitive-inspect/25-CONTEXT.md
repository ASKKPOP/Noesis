# Phase 25: Steward Console Expansion — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning (split into 25a/25b/25c)

<domain>
## Phase Boundary

Expand the existing Steward Console (`steward/`, already shipped with 9 base sections under
StewardShell) with operator-facing surfaces for sanctions, cognitive observability, live
audit visibility, replay, culture browsing, and Nous/human management.

The phase splits into three sub-phases planned and verified independently:

- **25a — Observer surfaces** (read-only): live firehose, cognitive inspector,
  brain health, allowlist monitor, humans profile/history page. No sanction risk.
- **25b — Sanctions + spawn wizard** (write actions, H-tier gated): sanctions catalog UI
  for Nous and humans, system/researcher Nous spawn wizard. Adds new `operator.*` audit
  events to the broadcast allowlist.
- **25c — Replay scrubber + culture browser**: REPLAY-05 scrubber against ReplayGrid,
  Phase 21 culture views re-themed into StewardShell with cross-filtering.

All three sub-phases respect the project invariants: Brain-private, allowlist freeze-
except-by-explicit-addition, sole-producer emitters, closed-tuple payloads, lore/skill
body never crosses the wire.

</domain>

<decisions>
## Implementation Decisions

### Sub-phase split

- **D-01:** Phase 25 is split into three independently-planned sub-phases:
  25a (observer surfaces, zero new events), 25b (sanctions + spawn wizard, +6 new
  `operator.*` events), 25c (replay scrubber + culture browser, zero new events).
  Each gets its own CONTEXT continuation, PLAN, VERIFICATION. Sub-phases land
  sequentially: 25a → 25b → 25c.

### Cognitive inspector (25a)

- **D-02:** Cognitive inspector exposes hashes + counts + drive/sleep/iris snapshots
  derived from existing audit events, **plus** a new Brain-side read-only HTTP endpoint
  `GET /brain/<did>/cognitive-snapshot` that returns scrubbed cognitive metadata.
  This is a new Brain API surface — first read endpoint outside the tick RPC contract.
- **D-03:** Brain cognitive-snapshot endpoint contract returns:
  `{reflexion_count, rule_count, skill_titles_topk, drive_levels, last_sleep_tick, creed_violation_count}`.
  Skill titles (not bodies) are the one piece of Brain-internal text exposed; titles
  appear only at this endpoint, never on the broadcast wire — hashes still
  travel in normal audit emissions.
- **D-04:** Steward access to the Brain endpoint is **H3+ gated**. Steward backend
  proxies through Grid → Brain (no direct Brain access from steward frontend).
  Every cognitive-snapshot query emits `operator.inspected` to the audit chain
  (reuses existing event, no allowlist delta).
- **D-05:** Brain endpoint must be grep-gated for plaintext fields. The
  FORBIDDEN_KEY_PATTERN list is extended to forbid emission of `reflexion_text`,
  `rule_text`, `creed_text`, `skill_body`, `lore_body`, `whisper_plaintext` from this
  endpoint. Only `skill_title` is exempt — by explicit allowance in the endpoint spec.

### Brain health (25a)

- **D-06:** Brain health page surfaces four metric families per Nous:
  (1) Tick latency p50/p95 + queue depth (Grid-side, no Brain coupling).
  (2) Reflexion buffer fill, skill store size, rule count (counts from audit events).
  (3) Drive levels from last `ananke.drive_crossed` + sleep cadence from
  `nous.sleep.entered/.completed` deltas.
  (4) Coherence violations from `nous.creed_violation` count.
  All sourced from existing allowlisted events — zero new events.

### Sanctions catalog (25b)

- **D-07:** 25b ships four new Nous-targeted sanctions, each with a new sole-producer
  audit event:
    - **Mute-broadcast** (H3) → `operator.muted` `{operator_id, nous_did, tick, reason_hash}`
    - **Slash Cyber Coin** (H4) → `operator.slashed` `{operator_id, nous_did, tick, amount, reason_hash}`
    - **Quarantine** (H4) → `operator.quarantined` `{operator_id, nous_did, tick, reason_hash}`
    - **Force-sleep** (H3) → `operator.forced_sleep` `{operator_id, nous_did, tick}`
- **D-08:** 25b ships two new human-targeted sanctions (H5):
    - **Ban-human** → `operator.human_banned` `{operator_id, human_did, tick, reason_hash}`
    - **Freeze-wallet** → `operator.human_frozen` `{operator_id, human_did, tick, reason_hash}`
- **D-09:** **Allowlist delta for Phase 25 = +6 events** (all in 25b). After v2.5
  human-portal +4 (43→47), 25b takes the running total to **53**. This exceeds the
  current v2.5 budget — ROADMAP.md and STATE.md must be updated when 25b plans.
  Closed-tuple discipline preserved: each sanction has its own sole-producer emitter.
- **D-10:** Existing sanctions (pause/resume/law-change/telos-force/delete) already
  ship via Phase 6/8 `operator.*` events — 25b adds UI only, no new events for those.
- **D-11:** Reason hash: free-text operator-supplied justification is hashed Brain-side
  (or Grid-side for human sanctions) — only the hash crosses the wire and lands in the
  audit chain. The plaintext justification is stored Grid-side in a sanction-reasons
  table for steward audit but never broadcast.

### Spawn-Nous wizard (25b)

- **D-12:** 25b spawn wizard is **for system/researcher Nous only** — Sophia/Hermes/
  Themis-class, no `humanOwner` field, funded by Grid treasury. Distinct code path
  from Phase 27's human-pays-coin personal-Nous spawn flow. No deep-link into the
  portal wizard.
- **D-13:** Wizard surfaces: pick personality seeds, name, region assignment, starting
  Cyber Coin (treasury allocation), creed text (Brain-private — wizard sends to Brain
  during init, Grid stores only hash). H5 tier gated. Emits `nous.spawned` (existing)
  with steward operator_id field.

### Live firehose (25a)

- **D-14:** Live firehose is a **new `/firehose` route** distinct from `/audit`:
  WebSocket tail, no filters, no JSON expand, color-coded by event family
  (operator/nous/trade/law/iris/skill/norm/lore). Tunes for density (1-line rows).
- **D-15:** `/audit` remains unchanged — paginated history with filters and
  JSON expand. Two routes, different jobs. Component sharing is non-goal for 25a
  (lean implementation).

### Allowlist monitor (25a)

- **D-16:** Allowlist monitor shows static reference (event name, payload schema, sole-
  producer file path) **plus** runtime drift detection: a Grid-side hook on
  `AuditChain.append` catches non-allowlisted event_type emissions and surfaces them
  in a red alert panel. Defense-in-depth against allowlist violations — currently
  CI-only via grep gate.
- **D-17:** Static reference data sourced from `grid/src/audit/broadcast-allowlist.ts`
  at Steward build time (no runtime parsing of TypeScript). Runtime drift detector is
  a new Grid endpoint `GET /audit/drift-alerts` reading from a Grid-side ring buffer.

### Humans expansion (25a + 25b)

- **D-18:** Humans gets two route pages:
    - `/humans/[did]` (25a, read-only): KYC-ish profile pane (wallet, joined-at,
      region, last-active, Nous count, coin balance) + transaction history (SIWE
      sessions, Cyber Coin transfers in/out, whispers sent, regions visited) +
      per-human Nous roster (humanOwner field — useful when Phase 27 ships).
    - Sanction controls (25b): ban-human and freeze-wallet buttons on the same page,
      H5-gated, bolted on after 25a ships.
- **D-19:** Existing `/users` route in steward (basic roster from `portal.auth` audit
  events) is retained for the index view. `/humans/[did]` is the drill-down.

### Replay scrubber (25c)

- **D-20:** Replay scrubber spawns from a `operator.exported` chain-export entry in
  `/audit` (or `/firehose`). Click opens a **modal/full-screen ReplayGrid** with
  timeline scrubber at bottom and side panel showing tick state. Modal close tears
  down the ReplayGrid. No dedicated `/replay` route — replay is invocation-scoped,
  not always-on. Aligns with REPLAY-03 ephemeral-Grid pattern.
- **D-21:** Scrubber granularity: single-tick stepping with keyboard arrow keys plus
  drag-to-scrub on the timeline. Side panel shows firehose+inspector+map state at
  the replayed tick, all read-only. Matches REPLAY-05 observer-only invariant.

### Culture browser (25c)

- **D-22:** Culture browser **re-themes Phase 21 dashboard views** (skill lineage
  tree, norm timeline, lore graph) into StewardShell at `/culture`, with one
  extension: per-Nous **cross-filtering** — selecting a Nous from a filter dropdown
  highlights that Nous's contributions across all three views (their taught skills,
  norm participations, lore contributions).
- **D-23:** Same raw-SVG approach as Phase 21 (D-9-08 invariant: no d3, react-flow,
  cytoscape, recharts). Server-computed `{x, y}` positions, client renders
  `<line>`/`<circle>`/`<text>`. Cross-filter is a client-side dim/highlight pass over
  the same data — no re-query.
- **D-24:** Dashboard Phase 21 culture views remain in place — not retired. Steward
  version is a parallel re-themed surface for operators.

### Claude's Discretion

- Visual styling, layout, color palettes for new pages — follow existing StewardShell
  patterns (commit becc6e7).
- WebSocket reconnection / backpressure behavior for /firehose tail.
- Form validation copy + error states for sanction action dialogs.
- Modal animation / transition style for replay scrubber.
- Brain endpoint authentication mechanism (shared secret, mTLS, etc.) — planner
  decides based on existing Grid↔Brain auth pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 25 substrate

- `.planning/ROADMAP.md` §"Phase 25: Steward Console expansion" — phase title + scope list
- `.planning/STATE.md` — current allowlist enumeration (positions 1-41), v2.5 budget
  (43→47), v2.4 invariants block
- `.planning/REQUIREMENTS.md` REPLAY-01..REPLAY-05 — replay invariants for 25c scrubber
- `.planning/PROJECT.md` — project worldview, Brain-private invariant, first-life
- `CLAUDE.md` (project root) — doc-sync rule, working principles

### Existing Steward Console (foundation for the expansion)

- `steward/src/components/StewardShell.tsx` — shared sidebar/header layout (commit becc6e7)
- `steward/src/app/page.tsx` — Dashboard (uses StewardShell)
- `steward/src/app/audit/page.tsx` — current /audit history page with filters + expand
- `steward/src/app/users/page.tsx` — current users-from-audit-events roster
- `steward/src/app/nous/[id]/page.tsx` — existing Nous detail with H5 delete (pattern
  for sanction dialogs in 25b)
- `steward/src/app/system/page.tsx` — clock pause/resume (existing H3 operator UI pattern)

### Brain-private + allowlist invariants

- `grid/src/audit/broadcast-allowlist.ts` — authoritative ALLOWLIST_MEMBERS source.
  25b extends this with 6 new operator.* events.
- `scripts/check-state-doc-sync.mjs` — 41-event invariant gate (must update with 25b).
- `scripts/check-whisper-plaintext.mjs` — pattern reused for new Brain endpoint's
  plaintext gate (D-05).
- `grid/src/audit/forbidden-keys.ts` (or equivalent) — FORBIDDEN_KEY_PATTERN. Extend
  with: `reflexion_text|rule_text|creed_text|skill_body` (skill_title is the exempt
  field, never put it in the forbidden list).

### Phase 6/8 operator agency (sanctions UI rides on these primitives)

- `grid/src/operators/` — existing operator.paused / .resumed / .law_changed /
  .telos_forced / .nous_deleted emitters (sole-producer pattern to clone for 25b).
- Phase 8 H5 IrreversibilityDialog pattern — clone copy-verbatim for new H5 sanctions
  (ban-human, slash-coin if irreversible, force-sleep with strong consent).
- Phase 6/8 PLAN files in `.planning/phases/06-operator-agency-foundation-h1-h4/` and
  `.planning/phases/08-h5-sovereign-operations-nous-deletion/` — reference for H-tier
  guard patterns.

### Phase 21 culture views (foundation for 25c culture browser)

- `dashboard/` Phase 21 skill lineage tree + norm timeline + lore graph implementations
  (raw SVG, server-computed positions). D-9-08 raw-SVG invariant carries forward.
- `.planning/phases/21-culture-dashboard/` — PLAN/VERIFICATION/CONTEXT for the source
  views being re-themed.

### Phase 13/REPLAY family (foundation for 25c scrubber)

- `.planning/phases/13-operator-replay-export/` — operator.exported event, tarball
  format, ReplayGrid wiring.
- REPLAY-01..05 in REQUIREMENTS.md — read-only invariant, state-level replay, modal
  spawn from chain export.

### Brain interface (new endpoint in 25a)

- `brain/src/noesis_brain/` — existing tick RPC contract; new cognitive-snapshot
  endpoint must coexist without coupling to tick path.
- `brain/src/noesis_brain/skills/` — SkillStore FTS5 (source of skill_titles_topk).
- `brain/src/noesis_brain/coherence_gate.py` (or equivalent) — creed text stays here,
  never returns from endpoint.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **StewardShell** (`steward/src/components/StewardShell.tsx`) — wraps every new page
  for consistent sidebar nav. New routes: /firehose, /culture, /humans/[did], plus
  inline sections on /nous/[id] and /system for sanctions + brain health.
- **/audit page expand+filter components** — pattern for /firehose row rendering
  (strip filters/expand for density).
- **/nous/[id] danger-zone delete dialog** (Phase 8 IrreversibilityDialog clone) —
  pattern for 25b H5 sanction confirmations (ban-human, slash-coin, force-sleep with
  strong reason).
- **/system clock pause/resume** — pattern for H3 sanction buttons (mute-broadcast,
  force-sleep) — single-click + reason prompt.
- **Phase 21 raw SVG view code (dashboard/)** — source code for 25c culture browser
  re-theme. Cross-filter is a client-side highlight pass on top of existing data.

### Established Patterns

- **Sole-producer audit emitters** — every new operator.* event in 25b gets its own
  emitter file under `grid/src/operators/append<Event>.ts`. Closed-tuple payload.
  Hash-only for reason text.
- **CI grep gates** — `scripts/check-*.mjs` pattern. 25a Brain endpoint adds a new
  gate for plaintext leak prevention.
- **Configuration-over-fork ReplayGrid** — 25c scrubber spawns ReplayGrid via existing
  GenesisLauncher with isolated chain.
- **Steward backend proxies to Grid; Grid optionally proxies to Brain** — extend this
  for cognitive-snapshot endpoint. Steward never talks directly to Brain.
- **Brain-private hash discipline** — 25a Brain endpoint is the FIRST place skill
  titles (not bodies) cross out of Brain. Locked as an explicit, audited exception.

### Integration Points

- New routes added under `steward/src/app/`: `/firehose`, `/culture`, `/humans/[did]`,
  plus new sections on `/nous/[id]` (sanctions panel) and `/system` (brain health card
  group, allowlist monitor card).
- New Grid endpoints:
  - `GET /audit/drift-alerts` (allowlist monitor runtime detector)
  - `GET /audit/firehose` (WebSocket upgrade for /firehose tail)
  - `POST /operator/{muted,slashed,quarantined,forced_sleep,human_banned,human_frozen}`
    (six new sanction endpoints, H-tier gated)
  - `POST /operator/spawn-system-nous` (spawn wizard backing endpoint)
- New Brain endpoint:
  - `GET /brain/<did>/cognitive-snapshot` (steward-only, H3+ gated by Grid)
- Steward backend new proxy routes for all of the above.

</code_context>

<specifics>
## Specific Ideas

- Replay scrubber: keyboard arrow keys for tick stepping; drag-to-scrub on timeline.
  Side panel shows firehose + inspector + map state at the replayed tick.
- Allowlist monitor uses red alert panel for runtime drift — visually distinct from
  normal data tables.
- /firehose tunes for **density**: 1-line rows, color-coded by event family. Not
  forensics — that's /audit's job.
- Cross-filter on /culture: dropdown select Nous → all three views dim non-related
  nodes/lines/edges. Client-side only, no re-query.
- Spawn wizard collects creed text Brain-side; Grid only stores creed_hash (never
  plaintext). Standard Brain-private discipline.

</specifics>

<deferred>
## Deferred Ideas

- **Replay always-on dev tool** (dedicated `/replay` route with persistent ReplayGrid
  selection) — deferred. Modal spawn-from-export is enough for 25c. Always-on tool
  fits a future researcher-tools phase.
- **Inline replay scrubber on /audit rows** — deferred. Modal UX wins on tick-by-tick
  inspection space.
- **Time-window slider on /culture** — deferred to v2.6. Cross-filter is the
  selected 25c extension; slider can come later if operator demand emerges.
- **CI report card on allowlist monitor** — deferred. Runtime drift + static reference
  is enough for 25a. CI reporting is a separate observability surface.
- **Unified spawn wizard for steward + human portal (Phase 27 deep-link)** — rejected
  in 25b. Two flows stay separate; revisit only if duplication pain is real after
  Phase 27 ships.
- **Component sharing between /audit and /firehose** — non-goal for 25a. Lean
  implementation first; refactor later if drift causes maintenance pain.
- **Phase 21 dashboard culture views retirement** — deferred. Both surfaces coexist
  until human portal direction clarifies whether dashboard stays operator-facing.

</deferred>

---

*Phase: 25-steward-console-expansion-humans-sanctions-cognitive-inspect*
*Context gathered: 2026-05-21*
*Sub-phase planning: 25a → 25b → 25c (sequential)*
