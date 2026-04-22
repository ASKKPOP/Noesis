# Phase 10a: Ananke Drives (Inner Life, part 1) — Context

**Gathered:** 2026-04-22
**Status:** Ready for research/planning

<domain>
## Phase Boundary

Five drives — **hunger, curiosity, safety, boredom, loneliness** — run deterministically in the Brain. Only threshold crossings cross the Brain↔Grid boundary as the single hash-authoritative broadcast event `ananke.drive_crossed`. No numeric drive value ever crosses the wire. Ships DRIVE-01..05; adds exactly +1 allowlist slot (18 → 19).

**Out of scope** (do not drift): Bios needs (Phase 10b), Chronos subjective time (Phase 10b), Thymos categorical emotions (v2.3), drive → Telos / action coupling beyond advisory logging (Nous sovereignty preserved per PHILOSOPHY §6).

</domain>

<decisions>
## Implementation Decisions

### Satisfaction mechanism (user-selected gray area)
- **D-10a-01:** **Rise-only with passive baseline decay.** Drives monotonically rise via the deterministic `(seed, tick)` decay function per DRIVE-02, but each drive also passively relaxes toward a per-drive baseline so long simulation runs don't saturate all five at 1.0. No action-based reducers in 10a. No satisfaction plumbing in 10a. Phase 10b Bios will arrive as an elevator only (energy→hunger, sustenance→safety).
  - **Why:** Smallest 10a surface that still satisfies DRIVE-02 (literal "monotonic rise without satisfaction" in the absence of baseline pull) and keeps RIG-phase 10k-tick runs non-degenerate. Zero new cross-boundary semantics (no reducer deltas on the wire). Action-based reducers deferred to a later phase once Telos ↔ Ananke coupling is revisited.
  - **Baseline math:** Single closed-form function of `(seed, tick)` — both rise and baseline pull are a single deterministic update per tick. Replay must reproduce byte-identical drive traces (DRIVE-02). No stochastic relaxation. Specific curve shape is Claude's Discretion (see below), but the function MUST be expressible as `drive(seed, tick+1) = f(drive(seed, tick), seed, tick)` with no wall-clock input.
  - **Per-drive baselines:** Claude's Discretion; sensible defaults expected around `hunger=0.3, curiosity=0.5, safety=0.2, boredom=0.4, loneliness=0.4`. Planner locks exact constants.

### Claude's Discretion
The three additional gray areas surfaced in discuss-phase were dismissed by the user; resolution is delegated to research + planner within the following rails:

- **Threshold geometry** — bucket boundaries for `level ∈ {low, med, high}`. Default: **equal thirds** at 0.33 / 0.66 on `[0.0, 1.0]`. Planner may override to pressure-weighted or hysteresis-guarded bands if research surfaces audit-chattering risk; any override must come with a regression test that the same `(seed, tick)` trace produces the same crossing count at both tick rates (T-09-03).
- **Rise curve shape** — linear vs. exponential-approach-1.0 vs. per-drive. Default: **per-drive monotonic rise with passive pull toward baseline**; specific analytical form (linear, exponential, sigmoid) chosen by planner to satisfy: (a) byte-identical replay across tick rates, (b) no float underflow/overflow, (c) deterministic clamping at 0.0/1.0.
- **Initial drive state + Psyche coupling** — starting value for each drive at `bios.birth`. Default: **per-drive baseline** (same as passive-pull target). Psyche/Big Five coupling is **out of scope for 10a** — first-life drive vector is the baseline vector; personality-derived initial conditions deferred.

### Determinism / boundary invariants (inherited, locked)
- **D-10a-02:** Drive math lives entirely in `brain/src/noesis_brain/ananke/drives.py` (sibling of `psyche/`, `telos/`, `thymos/`) as pure Python, no external libraries (DRIVE-01). *Path normalized 2026-04-22 per RESEARCH §Open Questions Q1 resolution.*
- **D-10a-03:** Drive state never crosses the wire as a free field. `ananke.drive_crossed` payload is the closed-tuple `{did, tick, drive, level, direction}` enforced via `Object.keys(payload).sort()` strict equality at the sole-producer boundary (clone Phase 6 D-11 pattern).
- **D-10a-04:** Emission is threshold-crossing-only — never per tick. Audit-size ceiling regression: 1000 ticks × 5 drives × 1 Nous ≤ 50 entries.
- **D-10a-05:** Determinism source grep gate — `Date.now`, `performance.now`, `setInterval` forbidden in `grid/src/ananke/**` and `brain/src/noesis_brain/ananke/**`. Replay at `tickRateMs=1_000_000` vs `tickRateMs=1000` must produce byte-identical audit entries (T-09-03).
- **D-10a-06:** Drive → action coupling is advisory; Brain logs divergence ("high hunger, chose non-feeding action") to its private wiki. Grid never overrides or penalizes (PHILOSOPHY §6, DRIVE-04).
- **D-10a-07:** Privacy matrix skeleton — extend Phase 6 matrix with `DRIVE_FORBIDDEN_KEYS = {hunger, curiosity, safety, boredom, loneliness, drive_value}` across flat + nested render surfaces; three-tier grep (Grid emitter, Brain wire, Dashboard render). Bios (10b) will clone this skeleton without drift.
- **D-10a-08:** Allowlist addition is exactly one: `ananke.drive_crossed`. Running total 18 → 19. No `ananke.drive_raised` / `ananke.drive_saturated` / `ananke.drive_reset` siblings — closed-enum test attempting to emit siblings must fail at the allowlist gate.

</decisions>

<specifics>
## Specific Ideas

- Level bucketing mirrors Phase 9 H1-warmth tier naming discipline: operator sees `med → high (rising)` not `0.67 → 0.71`.
- Dashboard renders drive transitions as icons/arrows, never as raw floats (extends AgencyIndicator visual vocabulary from Phase 6).
- Brain subsystem layout follows the existing `brain/src/noesis_brain/{psyche,telos,thymos}/` sibling pattern — Ananke gets its own directory alongside them.
- Determinism story mirrors the Phase 9 relationship decay `weight × exp(-Δtick/τ)` pattern: computed lazily from `(seed, tick)`, zero wall-clock reads.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before research or planning.**

### Phase scope + success criteria
- `.planning/ROADMAP.md` §Phase 10a (lines 59–76) — goal, success criteria, risks, allowlist addition
- `.planning/REQUIREMENTS.md` DRIVE-01..05 (lines 14–18) — full requirement text

### Worldview & non-negotiables
- `PHILOSOPHY.md` §6 — Nous sovereignty (drives advisory, not coercive)
- `PHILOSOPHY.md` §1 — first-life promise (audit chain forever, no purge)

### Inherited discipline from prior phases
- `.planning/phases/archived/v2.1/06-operator-agency-h1-h4/06-PLAN.md` D-11 — closed-tuple payload `Object.keys(payload).sort()` strict-equality gate (clone for `ananke.drive_crossed`)
- `.planning/phases/archived/v2.1/06-operator-agency-h1-h4/` privacy matrix — three-tier grep skeleton (Grid emitter, Brain wire, Dashboard render); extend with `DRIVE_FORBIDDEN_KEYS`
- `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` D-9-01 — deterministic `(seed, tick)` decay pattern precedent; zero wall-clock reads discipline
- `.planning/phases/09-relationship-graph-derived-view/09-VERIFICATION.md` — sole-producer boundary enforcement pattern (apply to Grid-side `ananke.drive_crossed` emitter)

### Code analogs
- `brain/src/noesis_brain/psyche/` — existing Brain subsystem layout; Ananke follows the same `loader.py` + `types.py` skeleton
- `brain/src/noesis_brain/telos/` — goals subsystem; advisory coupling precedent (drives inform but do not coerce Telos)
- `brain/src/noesis_brain/thymos/` — emotions subsystem; closed-enum state space precedent

### Cross-phase dependencies
- `.planning/ROADMAP.md` §Phase 10b (lines 78–96) — Bios elevation contract: `energy→hunger, sustenance→safety` reuses `ananke.drive_crossed`; 10a privacy-matrix skeleton must be clonable by 10b without drift
- `.planning/ROADMAP.md` §Open Questions #2 — drive normalization: 3 levels × 5 drives = 243 broadcast states; planner validates against T-09-02 fingerprinting residual

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **Phase 6 privacy matrix infra** (`grid/test/privacy/**`) — clone skeleton for DRIVE forbidden keys; three-tier grep pattern is established
- **Phase 6 `appendOperatorEvent` sole-producer boundary** — producer-boundary discipline pattern for Grid-side `ananke.drive_crossed` emitter
- **Phase 9 relationship decay** (`grid/src/relationships/decay.ts`) — `f(seed, tick)` computed lazily at read time; zero wall-clock reads; this is the determinism pattern Ananke clones
- **Brain JSON-RPC bridge** (`brain/src/noesis_brain/rpc/`) — threshold-crossing events cross the wire via existing RPC; no new transport layer needed
- **Closed-tuple test helper** (`grid/test/audit/payload-shape.test.ts`) — `Object.keys(payload).sort()` strict equality assertion pattern

### Established patterns
- **Brain subsystem directory structure** — `brain/src/noesis_brain/{psyche,telos,thymos}/` with `loader.py` + `types.py`; Ananke gets `brain/src/noesis_brain/ananke/` as a sibling
- **Allowlist addition per phase** — explicit single-slot addition in the phase that introduces it (v2.1 invariant); never retroactive
- **Determinism grep gate** — `forbidden-keys-in-subsystem.test.ts` pattern for `Date.now`/`performance.now`/`setInterval` bans

### Integration points
- Grid-side Ananke module must live alongside `grid/src/relationships/` as a peer subsystem (not inside brain subtree — TS/Python boundary)
- Sole-producer boundary: Grid-side `appendAnankeDriveCrossed(payload)` is the ONLY function that appends `ananke.drive_crossed`; grep CI gate enforces
- Dashboard inspector gets a Drives panel analogous to Phase 6's Agency panel and Phase 7's Telos panel; renders bucketed levels only

</code_context>

<deferred>
## Deferred Ideas

- **Action-based drive reducers** — deferred; no canonical action→drive map in 10a. Revisit after Telos ↔ Ananke coupling is designed.
- **Psyche / Big Five-derived initial drive state** — deferred; 10a starts every Nous at per-drive baseline. Personality-conditioned inner life is a v2.3 candidate.
- **Hysteresis-guarded threshold bands** — deferred unless research surfaces audit-chattering; default is equal-thirds boundaries.
- **2-level (low/high) bucketing** — deferred; default is 3-level per ROADMAP Open Question #2. Planner may downgrade if privacy matrix coverage demands it.
- **Thymos categorical labels on drive crossings** — deferred to v2.3 (THYMOS-01) to avoid T-09-05 namespace collision.
- **Drive-conditioned memory retrieval salience** — that's Chronos (Phase 10b, CHRONOS-01..03), not 10a.

</deferred>

---

*Phase: 10a-ananke-drives-inner-life-part-1*
*Context gathered: 2026-04-22*
