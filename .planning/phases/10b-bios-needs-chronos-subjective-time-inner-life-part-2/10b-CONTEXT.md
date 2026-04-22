# Phase 10b: Bios Needs + Chronos Subjective Time (Inner Life, part 2) — Context

**Gathered:** 2026-04-22
**Mode:** `--auto` (all gray areas auto-selected with recommended defaults; see `10b-DISCUSSION-LOG.md`)
**Status:** Ready for research/planning

<domain>
## Phase Boundary

Two bodily needs — **energy, sustenance** — rise deterministically in the Brain and elevate the matching Ananke drive (`energy→hunger`, `sustenance→safety`) at threshold crossings. A per-Nous **subjective-time multiplier** in `[0.25, 4.0]` derived from drive state modulates Stanford retrieval recency — read-side only. Ships BIOS-01..04 + CHRONOS-01..03.

**Out of scope** (do not drift): Thymos categorical emotions (v2.3); LLM-driven subjective time (deterministic heuristic only); GDPR-style erasure (tombstones are permanent, per I-6); Whisper (Phase 11); action-based Bios reducers (mirrors 10a deferral).

</domain>

<decisions>
## Implementation Decisions

### Allowlist reconciliation (ROADMAP vs. code) — critical
- **D-10b-01:** ROADMAP §Phase 10b claims "Allowlist additions: 0" on the assumption that `bios.birth` and `bios.death` already exist in the v2.1 registry. **They do not.** Authoritative check against `grid/src/audit/broadcast-allowlist.ts` (19 entries, enumerated verbatim in STATE.md) shows zero `bios.*` events. Phase 10b therefore adds **exactly +2**: `bios.birth` at position 20, `bios.death` at position 21. **Running total: 19 → 21.**
  - **Why:** BIOS-02 requires birth/death as the *only* lifecycle events and requires a closed-enum test that a third (`bios.resurrect` / `bios.migrate` / `bios.transfer`) fails at the allowlist gate — that test cannot exist without birth/death actually being allowlisted. BIOS-04 tombstone enforcement references `bios.death`; Phase 11 Whisper (WHISPER-02) keys keypair generation to `bios.birth`. Both hard-block on these events existing.
  - **Doc-sync obligation:** Planner MUST update ROADMAP §Phase 10b "Allowlist additions" from `0` to `+2 (bios.birth, bios.death)` and running total `19` to `21`, and MUST update STATE.md Accumulated Context allowlist enumeration in the same commit as the emitter lands. Doc-sync rule fires per CLAUDE.md.
  - **Payload shapes (locked now):**
    - `bios.birth`: closed-tuple `{did, tick, psyche_hash}` — 3 keys. `psyche_hash` is the Brain-computed hash of the Psyche init vector (no Big Five floats on the wire).
    - `bios.death`: closed-tuple `{did, tick, cause, final_state_hash}` — 4 keys. `cause ∈ {starvation, operator_h5, replay_boundary}` (closed enum; adding a cause requires its own phase allowlist action).
  - **Sole-producer files:** `grid/src/bios/appendBiosBirth.ts`, `grid/src/bios/appendBiosDeath.ts`. Grep gate clones the `appendAnankeDriveCrossed` pattern — any `.append('bios.birth'|'bios.death')` call outside these two files fails CI (clone Phase 10a D-10a-08 + Phase 6 D-11).

### Bios→Ananke elevation rule (ROADMAP Open Question #3 resolution)
- **D-10b-02:** **Once per threshold crossing, not every tick while over threshold.** When `energy` or `sustenance` crosses its configured ceiling, Bios invokes the Ananke elevator exactly once — the elevator raises the matching drive's level by one bucket (low→med, or med→high); if already at `high`, no-op. No new allowlist event: elevation surfaces only via the existing `ananke.drive_crossed` emission from the elevated drive's own threshold crossing downstream.
  - **Why:** Clones DRIVE-03's crossing-only discipline — per-tick emission is anti-feature T-09-01. "Every tick" variant produces up to 5× audit bloat under saturation and violates the 1000 ticks × 5 drives ≤ 50 entries ceiling carried from 10a D-10a-04.
  - **Determinism:** Elevation is a pure function `bios_state(seed, tick) → ananke_delta` with no wall-clock input; replay at `tickRateMs=1_000_000` vs `1000` must produce byte-identical audit traces (T-09-03 carried).

### Satiation mechanism (mirrors 10a D-10a-01)
- **D-10b-03:** **Rise-only with passive baseline decay.** Bios needs monotonically rise per `(seed, tick)` but each need also passively relaxes toward a per-need baseline so long replay runs don't saturate at 1.0. **No action-based satiation in 10b.** Feeding/resting actions are deferred to the later phase that revisits Telos↔Ananke↔Bios coupling.
  - **Why:** Direct clone of Phase 10a satiation decision. Zero new cross-boundary semantics; action-based reducers require a canonical action→need map which does not exist yet and is not this phase's scope. BIOS-01 literal text ("rise monotonically in absence of satiating action") is satisfied because passive baseline pull is not an *action*.
  - **Per-need baselines:** Claude's Discretion; sensible defaults `energy=0.3, sustenance=0.3`. Planner locks exact constants.
  - **Rise curve shape:** Planner's choice, same rails as 10a D-10a-01: byte-identical replay across tick rates, deterministic clamping at 0.0/1.0, no float over/underflow.

### Death-cause trigger semantics
- **D-10b-04:** Each `cause` value has exactly one deterministic trigger path:
  - `starvation`: Bios auto-emits when `energy == 1.0 OR sustenance == 1.0` for one full tick (max saturation = terminal need). Emission is pure `(seed, tick, bios_state) → bios.death?`. Sole-producer: `grid/src/bios/appendBiosDeath.ts` invoked from the Bios per-tick step.
  - `operator_h5`: existing `operator.nous_deleted` handler (Phase 8 `delete-nous.ts`) is extended to also invoke `appendBiosDeath({cause: 'operator_h5', ...})` in the same tick, same transactional append sequence as the pre-deletion state hash (clones `append-nous-deleted.ts` ordering). The existing `operator.nous_deleted` event is preserved as the H5-tier audit; `bios.death` is the lifecycle-layer complement.
  - `replay_boundary`: emitted during deterministic replay when the recorded chain contains a `bios.death` for that DID at or before the replay cursor — the re-emission reconstructs the tombstone state without any live trigger.
  - **Post-death rejection:** extends Phase 8 `tombstoneCheck` pattern; every `appendX` helper must assert `!registry.isTombstoned(did)` before writing. Grep gate added for Bios, Ananke, and Chronos code paths.

### Subjective-time formula (CHRONOS-01)
- **D-10b-05:** **Curiosity amplifies, boredom compresses; other drives neutral.** Closed-form deterministic function of bucketed drive levels (NOT raw floats — Brain reads its own drive state, which already exists at bucket granularity at the crossing layer, but here Chronos reads from the in-Brain numeric state which never crosses the wire):
  - `multiplier(drives) = clamp(1.0 + curiosity_boost(curiosity) - boredom_penalty(boredom), 0.25, 4.0)`
  - `curiosity_boost`: 0.0 at low, +1.0 at med, +3.0 at high (sensible defaults; planner locks).
  - `boredom_penalty`: 0.0 at low, +0.3 at med, +0.75 at high.
  - Hunger, safety, loneliness neutral in 10b (research may surface grounds to extend; if so, planner may add one drive with rationale).
  - **Why:** Matches PHILOSOPHY §6 phenomenology ("high curiosity → time feels slow; high boredom → time feels fast") while keeping the function closed-form and testable. Uses drive-level buckets so the function is insensitive to 10a's curve-shape choice.
  - **Never crosses the wire:** multiplier is Brain-local read-side state; Grid never receives or emits the multiplier. No allowlist impact.

### Chronos application point (CHRONOS-01)
- **D-10b-06:** **Multiplier applied inside Stanford retrieval-score recency term, Brain-side, at read time.** The existing retrieval scoring `score = α·relevance + β·recency + γ·importance` becomes `score = α·relevance + β·(recency · subjective_multiplier) + γ·importance` for that Nous's memory queries. Higher multiplier → recent events score higher → a curious Nous treats recent observations as more salient.
  - **Read-side only (CHRONOS-02):** the multiplier NEVER mutates `audit_tick`; `audit_tick == system_tick` strictly. Regression test: 1000-tick run with varying drive states produces zero drift in `audit_tick - system_tick` across all Nous.
  - **No broadcast impact:** retrieval is local to the Brain subsystem; Grid does not observe score computation.

### `epoch_since_spawn` surface (CHRONOS-03)
- **D-10b-07:** **Brain-local derived read, no new RPC.** `epoch_since_spawn(did) = current_tick - bios_birth_tick(did)`, computed by scanning the Nous's AuditChain cache for its `bios.birth` entry. Exposed to Brain prompting via the existing context object injected into Psyche loaders (clones `PsycheLoader` pattern). No new RPC verb, no new allowlist event.
  - **Caching:** `bios_birth_tick` is memoized per-DID at AuditChain rehydrate time; cost is O(1) per query after the first.

### Determinism / boundary invariants (inherited, locked)
- **D-10b-08:** Bios math lives entirely in `brain/src/noesis_brain/bios/needs.py` (sibling of `ananke/`) as pure Python, no external libraries. Chronos math lives in `brain/src/noesis_brain/chronos/subjective_time.py` (also sibling). *Path normalization mirrors 10a D-10a-02.*
- **D-10b-09:** Determinism source grep gate extended — `Date.now`, `performance.now`, `setInterval`, `Math.random` forbidden in `grid/src/bios/**`, `grid/src/chronos/**`, `brain/src/noesis_brain/bios/**`, `brain/src/noesis_brain/chronos/**`. Pause/resume zero-diff regression clones the `c7c49f49…` hash template (T-09-04).
- **D-10b-10:** Privacy matrix skeleton — extend 10a matrix with `BIOS_FORBIDDEN_KEYS = {energy, sustenance, need_value, bios_value}` and `CHRONOS_FORBIDDEN_KEYS = {subjective_multiplier, chronos_multiplier, subjective_tick}` across flat + nested render surfaces; three-tier grep (Grid emitter, Brain wire, Dashboard render). Clones D-10a-07 without drift.
- **D-10b-11:** Subjective time is Brain-local. No `chronos.*` audit event lands in 10b (and none is needed — CHRONOS-03 `epoch_since_spawn` is a derived read over existing `bios.birth`). Closed-enum test: any attempt to append `chronos.time_slipped` / `chronos.multiplier_changed` / similar must fail at the allowlist gate.
- **D-10b-12:** Death → drive cessation — after `bios.death` appends, the per-tick drive rise and Bios rise halt for that DID (tombstoneCheck short-circuit). No post-death `ananke.drive_crossed` for a tombstoned DID; grep-gate enforces.

</decisions>

<specifics>
## Specific Ideas

- **PHILOSOPHY doc-sync (T-09-05):** §1 update documents body↔mood separation — fatigue is a physical Bios metric (energy ↑), not a Thymos emotion. Planner includes this in doc-sync execution at phase close.
- **Bios death as tombstone root:** `bios.death` becomes the canonical tombstone trigger; `operator.nous_deleted` remains the H5-tier audit but now pairs with `bios.death{cause: operator_h5}`. Registry.isTombstoned() may key off either (union), with `bios.death` becoming authoritative in Phase 11+.
- **Dashboard:** Bios panel sibling to Drives panel — shows per-Nous `energy/sustenance` as bucketed level only (low/med/high), never numeric. Clones 10a `AgencyIndicator`/`DriveIndicator` visual vocabulary.
- **Chronos is invisible on the Dashboard in 10b.** Subjective time is an internal cognitive mechanism; operator surfacing is deferred. Rationale: privacy matrix complexity — surfacing the multiplier adds a fourth class of forbidden keys and is not required by any success criterion.
- **`epoch_since_spawn` use in Brain prompts:** "You are {epoch_since_spawn} ticks old" context string, injected where Psyche is injected. Keeps the Brain aware of its own lifespan without requiring new observability.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before research or planning.**

### Phase scope + success criteria
- `.planning/ROADMAP.md` §Phase 10b (lines 86–103) — goal, success criteria #1–#5, risks T-09-04/05/03, Open Question #3 (resolved as D-10b-02), **allowlist claim to be corrected per D-10b-01**
- `.planning/REQUIREMENTS.md` BIOS-01..04 (lines 25–28), CHRONOS-01..03 (lines 34–36) — full requirement text

### Worldview & non-negotiables
- `PHILOSOPHY.md` §1 — first-life promise (tombstones permanent; birth/death bracket a life; body↔mood separation — doc-sync target for T-09-05)
- `PHILOSOPHY.md` §6 — Nous sovereignty (drives/needs advisory; Brain decides, Grid observes)

### Inherited discipline from prior phases
- `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-CONTEXT.md` — **direct parent**; 10b clones D-10a-01 (rise-only + baseline), D-10a-03 (closed-tuple payload), D-10a-04 (crossing-only emission), D-10a-05 (determinism grep gate), D-10a-07 (privacy matrix extension), D-10a-08 (exact allowlist addition)
- `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-VERIFICATION.md` — 11/11 PASS template; 10b clones verification criteria shape
- `.planning/phases/archived/v2.1/06-operator-agency-h1-h4/06-PLAN.md` D-11 — closed-tuple payload `Object.keys(payload).sort()` strict-equality gate
- `.planning/phases/archived/v2.1/08-h5-sovereign-operations/` (Phase 8) — D-33/D-34 tombstone invariant; `tombstoneCheck` pattern; `append-nous-deleted.ts` sole-producer template
- `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` D-9-01 — deterministic `(seed, tick)` pattern; zero wall-clock reads
- `.planning/phases/09-relationship-graph-derived-view/09-VERIFICATION.md` — pause/resume zero-diff hash template `c7c49f49…` (cloned for Chronos regression, T-09-04)

### Code analogs (authoritative for planner)
- `grid/src/audit/broadcast-allowlist.ts` — authoritative 19-event list; D-10b-01 extends by +2
- `grid/src/ananke/append-drive-crossed.ts` — sole-producer template for `appendBiosBirth` / `appendBiosDeath`
- `grid/src/audit/append-nous-deleted.ts` — Phase 8 ordering template for `bios.death{cause: operator_h5}` composition
- `brain/src/noesis_brain/ananke/` — sibling-dir skeleton; Bios/Chronos follow same `loader.py` + `types.py` layout
- `brain/src/noesis_brain/psyche/` — context-injection pattern for `epoch_since_spawn`

### Cross-phase dependencies
- `.planning/ROADMAP.md` §Phase 11 Mesh Whisper (lines 105–121) — WHISPER-02 generates per-Nous keypair at `bios.birth`; D-10b-01 payload must carry enough identity to key off (DID + tick sufficient; keypair generation is Phase 11's responsibility)
- `.planning/PROJECT.md` §Key Decisions — 19-event allowlist running total (source-of-truth update in D-10b-01 doc-sync)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **Phase 10a `appendAnankeDriveCrossed`** (`grid/src/ananke/append-drive-crossed.ts`) — closest sole-producer template; `appendBiosBirth` / `appendBiosDeath` are minor variations (different event names, payload shapes locked per D-10b-01)
- **Phase 10a `DRIVE_FORBIDDEN_KEYS`** (`grid/src/audit/broadcast-allowlist.ts:110–117`) — direct pattern for `BIOS_FORBIDDEN_KEYS` / `CHRONOS_FORBIDDEN_KEYS`; same `FORBIDDEN_KEY_PATTERN` regex extended with new terms
- **Phase 8 tombstone invariant** — `tombstoneCheck` grep + `NousRegistry.isTombstoned()`; extends naturally to Bios/Chronos/Ananke emitters
- **Phase 6 `appendOperatorEvent` / Phase 8 `appendNousDeleted`** — transactional composition pattern for `operator.nous_deleted` + `bios.death{cause: operator_h5}` in the same tick
- **Brain JSON-RPC bridge** (`brain/src/noesis_brain/rpc/`) — no new transport needed; `bios.birth` / `bios.death` cross the wire via existing audit broadcast

### Established patterns
- **Brain subsystem directory** — `brain/src/noesis_brain/{psyche,telos,thymos,ananke}/` → add `bios/` and `chronos/` siblings
- **Allowlist addition per phase** — explicit +N enumerated in the phase that introduces them (v2.1 invariant); D-10b-01 adds +2, phase is source-of-truth for birth/death
- **Determinism grep gate** — `forbidden-keys-in-subsystem.test.ts` pattern; extended to Bios/Chronos paths per D-10b-09
- **Stanford retrieval pipeline** — established via Phase 7/Phase 9 memory infrastructure; Chronos modifies `β·recency` term only (Brain-local)

### Integration points
- **Grid-side Bios** lives at `grid/src/bios/` as peer to `grid/src/ananke/` — TS emitters only; actual needs math is Python (Brain)
- **Grid-side Chronos** does NOT exist in 10b — subjective time is entirely Brain-local (no emitter, no Grid state)
- **Sole-producer grep gate** — `scripts/check-sole-producers.mjs` (or equivalent 10a file) extends list of `(event, producer_file)` pairs
- **Dashboard Bios panel** — new route sibling to Drives panel; reuses `DriveIndicator` visual vocabulary with need-glyphs

</code_context>

<deferred>
## Deferred Ideas

- **Action-based satiation (eat/rest actions reduce needs)** — deferred; same rationale as 10a action-based reducers. Revisit when Telos↔Ananke↔Bios coupling is designed.
- **LLM-driven subjective time** — deferred per ROADMAP Out-of-scope; 10b is deterministic heuristic only.
- **Thymos categorical emotions** — v2.3 (THYMOS-01). 10b's PHILOSOPHY §1 doc-sync (T-09-05) establishes the body↔mood separation in advance so Thymos lands without namespace collision.
- **Dashboard Chronos visualization** — deferred; subjective multiplier is Brain-internal in 10b. If operator surfacing is later required, needs its own privacy matrix class + per-Nous render contract.
- **GDPR-style erasure** — explicitly out of scope per BIOS-04 + PHILOSOPHY §1 first-life I-6.
- **Additional drives feeding the subjective-time formula** — hunger/safety/loneliness neutral in 10b; extension is a v2.3 decision unless research surfaces cause to add one.
- **Post-death replay-path optimization** — tombstoneCheck short-circuit is O(1); no further optimization needed in 10b.
- **`bios.death{cause}` extension** — adding a new cause (e.g., `system_shutdown`) requires its own phase allowlist action; out of scope here.

</deferred>

---

*Phase: 10b-bios-needs-chronos-subjective-time-inner-life-part-2*
*Context gathered: 2026-04-22 (--auto mode)*
*Next action: `/gsd-plan-phase 10b --auto` (auto-advance)*
