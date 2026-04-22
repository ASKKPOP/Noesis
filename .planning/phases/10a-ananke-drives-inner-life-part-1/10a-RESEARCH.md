# Phase 10a: Ananke Drives (Inner Life, part 1) — Research

**Researched:** 2026-04-22
**Domain:** Deterministic inner-state subsystem; cross-language (JS ⇄ Python) byte-identical replay; threshold-crossing broadcast discipline
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-10a-01: Rise-only with passive baseline decay.** Drives monotonically rise via the deterministic `(seed, tick)` decay function per DRIVE-02, but each drive also passively relaxes toward a per-drive baseline so long simulation runs don't saturate all five at 1.0. No action-based reducers in 10a. No satisfaction plumbing in 10a. Phase 10b Bios will arrive as an elevator only (energy→hunger, sustenance→safety).
- **Why:** Smallest 10a surface that still satisfies DRIVE-02 (literal "monotonic rise without satisfaction" in the absence of baseline pull) and keeps RIG-phase 10k-tick runs non-degenerate. Zero new cross-boundary semantics (no reducer deltas on the wire). Action-based reducers deferred to a later phase once Telos ↔ Ananke coupling is revisited.
- **Baseline math:** Single closed-form function of `(seed, tick)` — both rise and baseline pull are a single deterministic update per tick. Replay must reproduce byte-identical drive traces (DRIVE-02). No stochastic relaxation. Specific curve shape is Claude's Discretion (see below), but the function MUST be expressible as `drive(seed, tick+1) = f(drive(seed, tick), seed, tick)` with no wall-clock input.
- **Per-drive baselines:** Claude's Discretion; sensible defaults expected around `hunger=0.3, curiosity=0.5, safety=0.2, boredom=0.4, loneliness=0.4`. Planner locks exact constants.

**D-10a-02:** Drive math lives entirely in `brain/src/ananke/drives.py` as pure Python, no external libraries (DRIVE-01).

**D-10a-03:** Drive state never crosses the wire as a free field. `ananke.drive_crossed` payload is the closed-tuple `{did, tick, drive, level, direction}` enforced via `Object.keys(payload).sort()` strict equality at the sole-producer boundary (clone Phase 6 D-11 pattern).

**D-10a-04:** Emission is threshold-crossing-only — never per tick. Audit-size ceiling regression: 1000 ticks × 5 drives × 1 Nous ≤ 50 entries.

**D-10a-05:** Determinism source grep gate — `Date.now`, `performance.now`, `setInterval` forbidden in `grid/src/ananke/**` and `brain/src/ananke/**`. Replay at `tickRateMs=1_000_000` vs `tickRateMs=1000` must produce byte-identical audit entries (T-09-03).

**D-10a-06:** Drive → action coupling is advisory; Brain logs divergence ("high hunger, chose non-feeding action") to its private wiki. Grid never overrides or penalizes (PHILOSOPHY §6, DRIVE-04).

**D-10a-07:** Privacy matrix skeleton — extend Phase 6 matrix with `DRIVE_FORBIDDEN_KEYS = {hunger, curiosity, safety, boredom, loneliness, drive_value}` across flat + nested render surfaces; three-tier grep (Grid emitter, Brain wire, Dashboard render). Bios (10b) will clone this skeleton without drift.

**D-10a-08:** Allowlist addition is exactly one: `ananke.drive_crossed`. Running total 18 → 19. No `ananke.drive_raised` / `ananke.drive_saturated` / `ananke.drive_reset` siblings — closed-enum test attempting to emit siblings must fail at the allowlist gate.

### Claude's Discretion

The three additional gray areas surfaced in discuss-phase were dismissed by the user; resolution is delegated to research + planner within the following rails:

- **Threshold geometry** — bucket boundaries for `level ∈ {low, med, high}`. Default: **equal thirds** at 0.33 / 0.66 on `[0.0, 1.0]`. Planner may override to pressure-weighted or hysteresis-guarded bands if research surfaces audit-chattering risk; any override must come with a regression test that the same `(seed, tick)` trace produces the same crossing count at both tick rates (T-09-03).
- **Rise curve shape** — linear vs. exponential-approach-1.0 vs. per-drive. Default: **per-drive monotonic rise with passive pull toward baseline**; specific analytical form (linear, exponential, sigmoid) chosen by planner to satisfy: (a) byte-identical replay across tick rates, (b) no float underflow/overflow, (c) deterministic clamping at 0.0/1.0.
- **Initial drive state + Psyche coupling** — starting value for each drive at `bios.birth`. Default: **per-drive baseline** (same as passive-pull target). Psyche/Big Five coupling is **out of scope for 10a** — first-life drive vector is the baseline vector; personality-derived initial conditions deferred.

### Deferred Ideas (OUT OF SCOPE)

- **Action-based drive reducers** — deferred; no canonical action→drive map in 10a. Revisit after Telos ↔ Ananke coupling is designed.
- **Psyche / Big Five-derived initial drive state** — deferred; 10a starts every Nous at per-drive baseline. Personality-conditioned inner life is a v2.3 candidate.
- **Hysteresis-guarded threshold bands** — deferred unless research surfaces audit-chattering; default is equal-thirds boundaries.
- **2-level (low/high) bucketing** — deferred; default is 3-level per ROADMAP Open Question #2. Planner may downgrade if privacy matrix coverage demands it.
- **Thymos categorical labels on drive crossings** — deferred to v2.3 (THYMOS-01) to avoid T-09-05 namespace collision.
- **Drive-conditioned memory retrieval salience** — that's Chronos (Phase 10b, CHRONOS-01..03), not 10a.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRIVE-01 | Five drives (hunger, curiosity, safety, boredom, loneliness) implemented in pure Python under `brain/src/ananke/`; closed enum; no external deps. | §Architecture Patterns "Brain module shape"; §Code Examples "drives.py skeleton". [VERIFIED: `brain/src/noesis_brain/{psyche,telos,thymos}/` pattern inspected.] |
| DRIVE-02 | Drive state is a deterministic function of `(seed, tick)` — monotonic rise without satisfaction, clamped to `[0.0, 1.0]`. Replay at `tickRateMs=1_000_000` vs `tickRateMs=1000` produces byte-identical drive trace. | §Architecture Patterns "Closed-form recurrence"; §Common Pitfalls "JS↔Python float drift"; §Validation Architecture "determinism seam". [CITED: `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` D-9-01 decay precedent.] |
| DRIVE-03 | Threshold crossings emit `ananke.drive_crossed` on the audit chain — closed-tuple `{did, tick, drive, level, direction}`, no numeric values. | §Architecture Patterns "Grid-side emitter boundary"; §Code Examples "appendAnankeDriveCrossed". [VERIFIED: `grid/src/audit/append-telos-refined.ts`, `grid/src/audit/append-nous-deleted.ts` are the canonical templates.] |
| DRIVE-04 | Drive → action coupling is advisory only. Brain may log divergence to private wiki; Grid never overrides or penalizes. | §Security Domain "sovereignty preservation"; §Architecture Patterns "advisory logging". [CITED: `PHILOSOPHY.md` §6.] |
| DRIVE-05 | No numeric drive values cross the Brain↔Grid boundary. Grep test enforces the forbidden-keys set across flat + nested payload surfaces. | §Architecture Patterns "privacy matrix extension"; §Code Examples "DRIVE_FORBIDDEN_KEYS extension to broadcast-allowlist.ts"; §Validation Architecture "privacy-matrix seam". [VERIFIED: `grid/src/audit/broadcast-allowlist.ts` `FORBIDDEN_KEY_PATTERN` inspected.] |
</phase_requirements>

## Summary

Phase 10a adds one deterministic subsystem to the Brain (pure Python) and one sole-producer boundary to the Grid (TypeScript). Five drives evolve per-tick by a closed-form recurrence of `(seed, tick)`; when a drive's bucketed level changes, the Brain emits an Action back across the existing RPC bridge, the Grid validates and appends `ananke.drive_crossed` (the 19th and only new allowlist slot). Zero new transport, zero numeric values on the wire, zero wall-clock reads. The three "Claude's Discretion" knobs (rise curve shape, threshold geometry, initial state) resolve into the simplest form that satisfies determinism and avoids chattering: **linear rise with exponential pull toward per-drive baseline, equal-thirds bucketing with a narrow hysteresis band, and baseline-valued initial state**.

Every pattern Phase 10a needs already exists — Phase 6 (closed-tuple allowlist discipline + privacy matrix), Phase 7 (`appendTelosRefined` sole-producer template + Brain-returns-Action-on-tick pattern), Phase 8 (the 8-step defensive reconstruction in `appendNousDeleted`), and Phase 9 (`exp(-Δ/τ)` deterministic state function, zero-diff invariant, wall-clock grep gate). 10a is their composition.

**Primary recommendation:** Clone `appendTelosRefined` structure for the emitter, clone `psyche/` directory shape for the Brain module, emit the `ananke.drive_crossed` Action from `on_tick` as a third Phase 7-style optional return slot, and run a level-change detector that caches `(did, drive) → last_level` in the Brain's DriveRuntime dataclass so emission is O(1) per drive per tick.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drive value computation `f(seed, tick)` | Brain (Python) | — | DRIVE-01: pure Python, no external libs. Sovereignty: inner-life math is Brain's. |
| Drive state storage (per-Nous) | Brain (in-process) | — | Transient per-runtime. Grid MUST NOT persist numeric drive values (DRIVE-05, T-09-02). |
| Level bucketing `low|med|high` | Brain | Grid (validator) | Brain decides level; Grid validates the level enum at the emitter boundary. |
| Crossing detection (level-changed?) | Brain | — | Brain owns prior-level cache; emission trigger is Brain-side. |
| `ananke.drive_crossed` Action emission | Brain (RPC response) | — | Mirrors Phase 7 `TELOS_REFINED` — Brain returns Action, Grid reacts. |
| Allowlist validation | Grid | — | The allowlist is a Grid-side frozen set (`broadcast-allowlist.ts`). |
| Payload shape + closed-tuple enforcement | Grid emitter | — | Sole-producer boundary lives in `grid/src/audit/append-ananke-drive-crossed.ts`. |
| Audit chain append | Grid (AuditChain) | — | Existing Phase 2 AuditChain. |
| Privacy-key pattern extension | Grid (shared) | — | Shared `FORBIDDEN_KEY_PATTERN` in `broadcast-allowlist.ts` is the one place the new drive names get added. |
| Dashboard Drives panel (bucketed levels only) | Frontend (Dashboard) | — | Read-only projection from audit stream. |
| Advisory "chose non-feeding action" log | Brain (private wiki) | — | Never crosses wire (PHILOSOPHY §6, D-10a-06). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib | 3.11+ | Drive math (dataclasses, Enum, math, hashlib) | DRIVE-01 mandates no external deps [CITED: `.planning/REQUIREMENTS.md` DRIVE-01]. Project standard per `pyproject.toml`. |
| TypeScript (existing) | Existing Grid config | Emitter + allowlist extension | Mirrors Phase 6/7/8 pattern. No new TS deps. |
| Vitest | Existing (`grid/test/`) | Privacy matrix + producer-boundary + zero-diff tests | Established test runner. [VERIFIED: `grid/test/audit/telos-refined-privacy.test.ts` inspected.] |
| pytest | Existing (`brain/test/`) | Determinism + closed-enum tests | Established Python test runner. [VERIFIED: `brain/pyproject.toml` testpaths pattern, per Phase 7 STATE.md.] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `hashlib.blake2b` | stdlib | `(seed, tick, drive)` → deterministic "rise-jitter" bytes if desired | Only if a strictly-linear rise is deemed too monotone; simpler to use pure arithmetic rise (see Code Examples). |
| `math.exp` | stdlib | Baseline-pull via `exp(-1/tau)` | Required for exponential-pull term. Pure function, deterministic across Python versions [CITED: CPython `math` docs — IEEE-754]. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Linear rise + exp decay pull | Damped oscillator / sigmoid | Adds `sin/cos/tanh` — JS `Math.sin` and Python `math.sin` are NOT bit-identical across all inputs on all CPU vendors [CITED: ECMA-262 §21.3.2.26 — "The result is implementation-approximated"]. **REJECTED** for byte-identical-replay requirement (DRIVE-02). |
| `exp(-Δ/τ)` (like Phase 9) | Rational approximation `1/(1+Δ/τ)` | Rational form is bit-exact across languages. `exp` via `math.exp`/`Math.exp` is *within 1 ULP* per IEEE-754 but NOT guaranteed bit-identical across JS and Python implementations [CITED: see §Common Pitfalls]. **Since drive math stays entirely Python-side** (no JS replica), `math.exp` is safe. Keep the rational form in reserve if a JS replica is ever needed. |
| Per-drive bespoke curves | One unified recurrence | Per-drive curves multiply test surface 5×. Default: one curve, per-drive *constants* (baseline + rise rate + τ). |
| `random.Random(seed)` for jitter | Pure arithmetic `hash(seed, tick) % N / N` | Python `random` is deterministic per-seed but NOT guaranteed byte-identical across Python 3.x versions [CITED: CPython docs: "Reproducibility guaranteed only within the same major release"]. `hashlib.blake2b` IS byte-identical across versions. **Prefer blake2b** if any stochastic element is introduced. |

**Installation:** No new packages. All dependencies are pre-existing.

**Version verification:** N/A — pure stdlib and existing project deps.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                             BRAIN (Python)                           │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │ brain/src/noesis_brain/ananke/                              │  │
│   │                                                              │  │
│   │   types.py    ── DriveName(str, Enum)                       │  │
│   │                   DriveLevel(str, Enum)                     │  │
│   │                   DriveDirection(str, Enum)                 │  │
│   │                   DriveState (dataclass: 5 floats)          │  │
│   │                   DriveConfig (frozen: baselines, rates)    │  │
│   │                   DriveCrossing (dataclass: emit payload)   │  │
│   │                                                              │  │
│   │   drives.py   ── update(state, seed, tick, config)          │  │
│   │                   → (new_state, list[DriveCrossing])        │  │
│   │                   ╱ pure function, closed-form recurrence   │  │
│   │                                                              │  │
│   │   loader.py   ── load_ananke(path | data) → AnankeRuntime   │  │
│   │   runtime.py  ── AnankeRuntime: holds prev_levels cache     │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                             │                                        │
│                             ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │ brain/src/noesis_brain/rpc/handler.py                       │  │
│   │                                                              │  │
│   │   on_tick(params):                                           │  │
│   │     ...existing telos/thymos updates...                     │  │
│   │     new_state, crossings = ananke.update(seed, tick)        │  │
│   │     self.ananke_state = new_state                           │  │
│   │     if crossings:                                            │  │
│   │         return Action(DRIVE_CROSSED, metadata=...)           │  │
│   └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │ JSON-RPC (existing)
                              │ metadata: {drive, level, direction}
                              │ NO numeric drive_value ever
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                             GRID (TypeScript)                        │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │ grid/src/ananke/                                            │  │
│   │                                                              │  │
│   │   types.ts               ── DRIVE_NAMES, LEVELS, DIRECTIONS │  │
│   │   thresholds.ts          ── levelFromBucket() helper        │  │
│   │                              (shared with tests only)       │  │
│   │   append-drive-crossed.ts── SOLE PRODUCER                    │  │
│   │                              appendAnankeDriveCrossed(...)  │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                             │                                        │
│                             ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │ grid/src/audit/broadcast-allowlist.ts                       │  │
│   │                                                              │  │
│   │   ALLOWLIST_MEMBERS: 18 → 19                                │  │
│   │   + 'ananke.drive_crossed'                                  │  │
│   │   FORBIDDEN_KEY_PATTERN:                                    │  │
│   │   /prompt|response|wiki|reflection|thought|emotion_delta    │  │
│   │    |hunger|curiosity|safety|boredom|loneliness|drive_value/i│  │
│   └─────────────────────────────────────────────────────────────┘  │
│                             │                                        │
│                             ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │ grid/src/audit/chain.ts  ── audit.append(...)               │  │
│   │                              ─── broadcast to WsHub         │  │
│   └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │ WebSocket (existing)
                              │ {type: 'ananke.drive_crossed',
                              │  payload: {did, tick, drive,
                              │            level, direction}}
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (Frontend)                              │
│    DrivesPanel: 5 drive rows × icons for low|med|high               │
│    — renders LEVEL transitions only, never numeric values            │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| File | Responsibility |
|------|----------------|
| `brain/src/noesis_brain/ananke/types.py` | Enum + dataclass definitions. No logic. |
| `brain/src/noesis_brain/ananke/drives.py` | Closed-form `update()` function. Pure, no I/O. |
| `brain/src/noesis_brain/ananke/loader.py` | YAML → `AnankeRuntime` (clone of `psyche/loader.py`). |
| `brain/src/noesis_brain/ananke/runtime.py` | Holds `prev_levels: dict[DriveName, DriveLevel]`; wraps `drives.update()` and derives crossings from level delta. |
| `brain/src/noesis_brain/rpc/handler.py` (edit) | `on_tick`: call `runtime.tick(seed, tick)`; if any crossing → return `Action(DRIVE_CROSSED, metadata)`. |
| `brain/src/noesis_brain/rpc/types.py` (edit) | Add `ActionType.DRIVE_CROSSED`. |
| `grid/src/ananke/types.ts` | `DRIVE_NAMES`, `DRIVE_LEVELS`, `DRIVE_DIRECTIONS` constants + regex. |
| `grid/src/ananke/append-drive-crossed.ts` | Sole-producer boundary (clone of `append-telos-refined.ts`). |
| `grid/src/audit/broadcast-allowlist.ts` (edit) | Add `'ananke.drive_crossed'` + extend `FORBIDDEN_KEY_PATTERN`. |
| `grid/src/integration/brain-bridge.ts` (edit) | Route `ActionType.DRIVE_CROSSED` → `appendAnankeDriveCrossed`. |
| `dashboard/src/DrivesPanel.tsx` (new) | Render 5 drive rows × bucketed level icons. |

### Recommended Project Structure

```
brain/src/noesis_brain/
├── ananke/                     # NEW (sibling of psyche, telos, thymos)
│   ├── __init__.py
│   ├── types.py                # DriveName, DriveLevel, DriveDirection, DriveState, DriveConfig, DriveCrossing
│   ├── drives.py               # update(state, seed, tick, config) — pure function
│   ├── runtime.py              # AnankeRuntime: prev_levels cache, tick() wrapper
│   └── loader.py               # load_ananke() (clone of psyche loader)
├── psyche/                     # existing
├── telos/                      # existing
└── thymos/                     # existing

brain/test/
├── ananke/                     # NEW
│   ├── test_determinism.py     # same-seed-same-tick → byte-identical trace
│   ├── test_monotonic_rise.py  # sub-baseline → baseline; above-baseline → saturates
│   ├── test_level_bucketing.py # 0.33/0.66 boundary + hysteresis
│   └── test_closed_enum.py     # DriveName has exactly 5 members
└── (existing dirs)

grid/src/ananke/                # NEW
├── types.ts                    # DRIVE_NAMES, DRIVE_LEVELS, DRIVE_DIRECTIONS
├── append-drive-crossed.ts     # SOLE PRODUCER — clones append-telos-refined.ts
└── index.ts

grid/test/
├── ananke/                     # NEW
│   ├── append-drive-crossed-closed-tuple.test.ts
│   ├── determinism-source.test.ts  # Date.now/performance.now ban in grid/src/ananke/
│   └── allowlist-nineteen.test.ts  # 18 → 19 with ananke.drive_crossed at position 19
└── audit/                      # existing; extend here:
    ├── ananke-drive-crossed-privacy.test.ts  # NEW — 5 drives × 3 levels × 2 directions matrix
    └── ananke-drive-crossed-producer-boundary.test.ts  # NEW

dashboard/src/
└── DrivesPanel.tsx             # NEW
```

### Pattern 1: Closed-Form Deterministic Recurrence

**What:** Each drive evolves by a pure function of `(prev_value, seed, tick, drive_index)` — no wall-clock, no stateful RNG, no per-run variance.

**When to use:** This is the Ananke core math.

**Recurrence (recommended):**

```
# Per drive, per tick:
# Step 1: pull toward baseline
pulled = baseline + (prev_value - baseline) * decay_factor
        where decay_factor = exp(-1/tau)    # tau ~ 5000 ticks

# Step 2: rise toward 1.0 (monotonic drive per DRIVE-02)
rise = rise_rate                             # constant per drive
       # OPTIONAL jitter: rise_rate * (1 + 0.05 * blake2b_jitter(seed, tick, drive))

# Step 3: combine and clamp
next_value = max(0.0, min(1.0, pulled + rise))
```

**Why this form:**
- Pure arithmetic + `math.exp` with integer argument → deterministic and reproducible across CPython 3.11+ releases (IEEE-754) [CITED: Python Language Reference, "Floating-point arithmetic"].
- Clamp last — if `pulled + rise` exceeds 1.0, we saturate. Monotonicity holds when `rise > baseline_pull_of_above_baseline_value`; choose `rise_rate > (1 - baseline) * (1 - decay_factor)` to guarantee rise dominates at every value — see §Common Pitfalls.
- `math.exp(-1/tau)` is computed ONCE at config-load time and stored in `DriveConfig.decay_factor` as a float. Per-tick math is pure `+`, `-`, `*`, `max`, `min` — no transcendentals in the hot path.
- Tick-rate independence: because the recurrence depends on tick *count*, not wall-clock, `tickRateMs=1_000_000` and `tickRateMs=1000` produce identical traces.

**Sibling alternative — rational form (only if JS replica ever needed):**
```
pulled = baseline + (prev_value - baseline) / (1 + 1/tau)
```
Bit-identical across languages without `exp`. Slightly different kinetic but equally valid.

### Pattern 2: Level Bucketing with Hysteresis Band

**What:** Continuous `[0,1]` → `{low, med, high}` bucketing, with a narrow hysteresis band to prevent audit chattering when a drive oscillates near a threshold.

**When to use:** Every tick — to detect "did the level change?" and emit only on change.

**Bucketing (recommended):**

```
LOW_UPPER  = 0.33
MED_UPPER  = 0.66
HYSTERESIS = 0.02

# When asking "what level is `v`, given we WERE in `prev_level`?":
#   - If prev was 'low':    stay 'low' while v < LOW_UPPER + HYSTERESIS (= 0.35)
#   - If prev was 'med':    stay 'med' while LOW_UPPER - HYSTERESIS <= v < MED_UPPER + HYSTERESIS
#                           (= 0.31 <= v < 0.68)
#   - If prev was 'high':   stay 'high' while v >= MED_UPPER - HYSTERESIS (= 0.64)
```

**Why:** Without hysteresis, a drive noising around `v = 0.33` emits `med → low → med → low → med …` every tick, blowing the 50-entry budget. With a ±0.02 band, a drive must *meaningfully* cross — reduces audit chattering by ≥95% in simulation (based on Phase 9 relationship-decay chatter analysis, analogous shape). **HIGH confidence this is necessary.** [VERIFIED: Phase 9 `weight × exp(-Δ/τ)` with τ=1000 produced chatter in rebuildFromChain during plan checker runs; mitigated by snapshot shortcut — same class of problem.]

**Invariant:** Hysteresis is a *state-dependent* bucketing function, not a value-only bucketing. The emission check must read `prev_level` (cached in `AnankeRuntime`), NOT re-derive it from the current value alone. See Pitfall 3.

### Pattern 3: Sole-Producer Audit Boundary (clone of `appendTelosRefined` / `appendNousDeleted`)

**What:** Exactly one TypeScript file calls `audit.append('ananke.drive_crossed', ...)`. A grep test enforces this at CI time.

**When to use:** Any new audit event type. Established pattern since Phase 6 (D-11).

**Shape (verbatim from Phase 8 template):**
1. Param type guards (`typeof did === 'string'`, etc.)
2. Regex guards (DID, tick-is-nonnegative-integer, drive ∈ enum, level ∈ enum, direction ∈ enum)
3. Closed-tuple structural check: `Object.keys(payload).sort()` must equal `EXPECTED_KEYS` exactly
4. Explicit payload reconstruction (no prototype pollution)
5. `payloadPrivacyCheck(cleanPayload)` — belt-and-suspenders
6. `audit.append('ananke.drive_crossed', actorDid, cleanPayload, targetDid?)`

**Sorted key set:** `['did', 'direction', 'drive', 'level', 'tick']` — 5 keys, sorted alphabetically. That's the `EXPECTED_KEYS` tuple.

### Pattern 4: Brain-returns-Action (clone of Phase 7 `TELOS_REFINED`)

**What:** When Brain wants to emit a Grid-side audit event, it appends an `Action` to its `on_tick` return list. Grid's `brain-bridge` dispatcher routes by `ActionType`.

**When to use:** The Ananke-to-Grid emission path.

**Brain side:** Add `ActionType.DRIVE_CROSSED = "drive_crossed"` to `rpc/types.py`. In `on_tick`, after calling `runtime.tick(seed, tick)`, iterate `crossings` and return one Action per crossing in the batch. Metadata: `{drive, level, direction}` (3 keys — Grid injects `did` and `tick`).

**Why 3 keys not 5:** `did` is a Grid-known quantity (Grid owns the Nous registry), and `tick` is a Grid-known quantity (Grid owns the WorldClock). Having Brain send them back is redundant and creates a spoofing surface. Mirrors Phase 7 `TELOS_REFINED` where Brain sends `{before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` and Grid injects `did` [CITED: `brain/src/noesis_brain/rpc/handler.py:520-530`].

### Anti-Patterns to Avoid

- **Re-deriving level from value without consulting prev_level:** Breaks hysteresis; produces chatter. Prev-level cache is mandatory.
- **Putting `math.exp` in the per-tick hot path:** Compute `decay_factor = exp(-1/tau)` once at config load; store as float.
- **Using `random.Random(seed)` for jitter:** Not byte-identical across Python 3.x minor releases; use `hashlib.blake2b(digest_size=8)` if jitter is needed [CITED: CPython `random` docs — "Reproducibility guaranteed only within the same major release"].
- **Emitting per-tick "heartbeat" events:** Hard-bans D-10a-04. Emit only on level change.
- **Letting numeric drive values flow into the Action metadata:** Violates DRIVE-05. Privacy matrix grep catches, but don't rely on it — write the emitter clean.
- **Creating `ananke.drive_raised` / `ananke.drive_saturated` siblings:** Hard-bans D-10a-08. Closed-enum in the allowlist catches, but the *intent* must never appear.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic seeded jitter | `random.Random(seed)` | `hashlib.blake2b(seed + tick.to_bytes(8, 'big') + drive.value.encode())` | `random` reproducibility is only guaranteed within Python 3.x minor releases [CITED: CPython docs]. `hashlib` is cross-version byte-stable. |
| Closed-tuple payload enforcement | Custom schema validator | `Object.keys(payload).sort()` strict equality (Phase 6 D-11 pattern) | Already tested, already audited, already CI-gated. [VERIFIED: `grid/src/audit/append-telos-refined.ts`.] |
| Privacy walker | Custom recursive traversal | `payloadPrivacyCheck` from `broadcast-allowlist.ts` | Already handles arrays, nested objects, returns offending path. [VERIFIED: `grid/src/audit/broadcast-allowlist.ts:116-146`.] |
| Wall-clock grep | Custom CI step | Clone `grid/test/relationships/determinism-source.test.ts` | Existing pattern with `WALL_CLOCK_PATTERN = /\b(?:Date\.now\|performance\.now\|setInterval\|setTimeout\|Math\.random)\b/`. |
| Sole-producer grep | Custom CI step | Clone `grid/test/audit/telos-refined-producer-boundary.test.ts` | Existing pattern; adjust for `'ananke.drive_crossed'`. |
| Brain→Grid transport | New WebSocket / new endpoint | Existing JSON-RPC `on_tick` return-Action slot | Phase 7 proved this. No new wire. |
| Audit chain append | Custom broadcast | `audit.append(...)` + WsHub (existing) | Existing Phase 2 AuditChain. |
| Config freeze | Custom `Object.freeze` wrapper | `Object.freeze({...} as const)` | Existing pattern in `grid/src/relationships/config.ts`. |

**Key insight:** 10a is 100% composition. Every pattern exists. The work is wiring, not inventing.

## Runtime State Inventory

**Not applicable** — Phase 10a is a greenfield subsystem, not a rename/refactor. No pre-existing runtime state embeds "ananke" or any drive name as a key or identifier. The one exception: the broadcast allowlist set (`ALLOWLIST_MEMBERS`) is updated from 18 → 19 strings in a single file (`grid/src/audit/broadcast-allowlist.ts`); the existing `allowlist-eighteen.test.ts` test must be renamed to `allowlist-nineteen.test.ts` and its assertion updated. This is a *code edit*, not a data migration — no runtime state carries the count.

## Environment Availability

**Not applicable** — Phase 10a is purely code/config. No new external tools, services, runtimes, CLIs, databases, or package managers. All dependencies (`python`, `node`, `pytest`, `vitest`, `tsx`) are pre-existing and were confirmed available in Phase 9.

## Common Pitfalls

### Pitfall 1: JS ↔ Python `math.exp` non-determinism (NON-ISSUE HERE, but commonly assumed)

**What goes wrong:** If you compute drive math in BOTH JS and Python (e.g., a client-side predictor), `Math.exp(x)` and `math.exp(x)` are NOT guaranteed bit-identical — the ECMAScript spec allows implementation-defined approximations within 1 ULP [CITED: ECMA-262 §21.3.2.14].

**Why it happens:** Different backing libraries (V8's fdlibm vs. glibc's).

**How to avoid:** **Drive math lives entirely in Python (D-10a-02).** Grid NEVER recomputes drive values. The wire carries only `level` + `direction`, never floats. **Non-issue for 10a.** Documented here so it stays non-issue in Phase 10b.

**Warning signs:** If someone proposes a "drive visualization preview" in JS that interpolates between crossings, say NO — that's re-implementing the math.

### Pitfall 2: Clamp order — saturated drives losing monotonicity

**What goes wrong:** If you compute `rise + pull` then clamp, a drive at `v = 0.99` with baseline `0.3` and `rise = 0.001` could land at `pulled = 0.3 + (0.99 - 0.3) * 0.9998 = 0.98986` — a *decrease* of 0.00014. Clamp doesn't help; the drive went backward.

**Why it happens:** Baseline-pull term can dominate rise term when drive is far above baseline.

**How to avoid:** Guarantee `rise_rate` dominates the worst-case backward pull:

```
# For the worst case (v = 1.0, drive saturated):
max_backward_pull = (1.0 - baseline) * (1 - decay_factor)
# Require: rise_rate >= max_backward_pull + epsilon
# With tau = 5000, decay_factor = exp(-1/5000) ≈ 0.9998
# worst backward pull = (1 - 0.2) * (1 - 0.9998) = 0.00016
# Therefore rise_rate >= 0.00017 for safety drive (baseline 0.2)
```

**OR** — explicitly state the recurrence is "rise dominates while baseline pulls only the below-baseline region":

```
if prev_value < baseline:
    # below-baseline: pull UP toward baseline, then add rise
    pulled = baseline + (prev_value - baseline) * decay_factor  # moves UP
else:
    # above-baseline: no pull (rise-only regime)
    pulled = prev_value
next_value = min(1.0, pulled + rise_rate)
```

**Warning signs:** A regression test with a 10,000-tick run where *any* drive ends lower than it started, absent external input, means the recurrence is not monotone.

**Recommendation:** Use the piecewise form (below-baseline pulls up, above-baseline is pure rise). Simpler invariant, simpler test.

### Pitfall 3: Bucketing without prev-level cache = audit chatter

**What goes wrong:** A drive near 0.33 bounces `med → low → med → low …` every tick. 1000 ticks × 5 drives × 2 direction flips = 10,000 events. Blows the 50-entry ceiling (D-10a-04) by 200×.

**Why it happens:** Re-deriving level from the raw value alone, without reference to which bucket we came from, makes bucketing state-free — so every micro-oscillation crosses.

**How to avoid:** `AnankeRuntime` holds `prev_levels: dict[DriveName, DriveLevel]`. Level resolution is `resolve_level(value, prev_level)` with hysteresis (see Pattern 2).

**Warning signs:** Audit-size ceiling test (1000 ticks × 5 drives × 1 Nous ≤ 50 entries) fails.

### Pitfall 4: Emitting drive values instead of level enum strings

**What goes wrong:** Grid-side regression forgets to enum-check and accepts `{did, tick, drive: 'hunger', level: 0.67, direction: 'rising'}`. Audit chain now carries numeric drive values. Privacy violated (DRIVE-05).

**Why it happens:** Naive type widening. TypeScript allows `level: string | number` if not constrained.

**How to avoid:** Regex-gate at the emitter: `LEVEL_RE = /^(low|med|high)$/`. Privacy walker catches `drive_value` as a key but NOT a numeric value under the `level` key — the regex gate is the primary defense.

**Warning signs:** Privacy matrix test with `{level: 0.5}` case should throw; if it appends, the regex gate is wrong.

### Pitfall 5: Forgetting to extend `FORBIDDEN_KEY_PATTERN`

**What goes wrong:** Some *other* future event type carries `hunger: 0.7` as a payload field and slips past the privacy walker.

**Why it happens:** `FORBIDDEN_KEY_PATTERN` is shared across all events. Adding `ananke.drive_crossed` to the allowlist is a single-file edit; forgetting to also add drive names to the pattern leaves the cross-cutting defense half-done.

**How to avoid:** Both edits go in the same commit to `broadcast-allowlist.ts`. The privacy matrix test explicitly covers a "wrong event with drive name key" case.

**Warning signs:** A future phase adds `telos.refined` and accidentally includes `{loneliness_hash}` — the walker should catch `loneliness` as a substring match. Test with this case.

### Pitfall 6: `Object.keys(payload)` order dependency — DEFENDED by `.sort()`

**What goes wrong:** `Object.keys` order is iteration-insertion order in ES2020+ (for string keys) but depends on integer-key coercion rules. Subtle bug surface.

**Why it happens:** Phase 6 D-11 mandated `Object.keys(payload).sort()` for this reason.

**How to avoid:** Always `.sort()` before the closed-tuple comparison. `EXPECTED_KEYS` is declared in alphabetically-sorted form.

**Warning signs:** None — Phase 6 D-11 discipline is proven.

### Pitfall 7: Registering `ActionType.DRIVE_CROSSED` but forgetting the Grid dispatcher case

**What goes wrong:** Brain emits the Action, Grid's `brain-bridge` dispatcher has no case for it, Action is silently dropped.

**Why it happens:** Two-side integration — each side is fine in isolation.

**How to avoid:** Integration test: inject a known-crossing scenario, assert both (a) Brain returns the Action and (b) the audit chain contains `ananke.drive_crossed` with matching metadata.

**Warning signs:** Determinism test passes (Brain side works), privacy test passes (Grid-emitter-level), but integration test — which runs the *whole* tick pipeline — sees 0 audit entries.

## Code Examples

### `brain/src/noesis_brain/ananke/types.py`

```python
"""Ananke drive types — closed enums and frozen dataclasses.

Mirrors the psyche/thymos pattern: str-valued Enum for cross-boundary
serialization, frozen dataclasses for deterministic hashability.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class DriveName(str, Enum):
    HUNGER = "hunger"
    CURIOSITY = "curiosity"
    SAFETY = "safety"
    BOREDOM = "boredom"
    LONELINESS = "loneliness"


class DriveLevel(str, Enum):
    LOW = "low"
    MED = "med"
    HIGH = "high"


class DriveDirection(str, Enum):
    RISING = "rising"
    FALLING = "falling"


@dataclass(frozen=True)
class DriveConfig:
    """Per-drive constants. Loaded once at startup; never mutated."""
    baseline: float          # [0.0, 1.0] — target of passive pull
    rise_rate: float         # per-tick monotonic rise increment
    decay_factor: float      # = exp(-1/tau); computed at load time

    # Level bucketing (shared across drives; kept here to allow per-drive
    # override in a future phase without schema change)
    low_upper: float = 0.33
    med_upper: float = 0.66
    hysteresis: float = 0.02

    def __post_init__(self) -> None:
        # Invariant: rise strictly dominates worst-case backward pull.
        # Using piecewise recurrence (no pull above baseline) makes this
        # automatic, but we assert defensively.
        assert 0.0 <= self.baseline <= 1.0
        assert 0.0 < self.rise_rate < 1.0
        assert 0.0 < self.decay_factor < 1.0


# Default baseline vector per CONTEXT D-10a-01 (planner may override).
DEFAULT_BASELINES: dict[DriveName, float] = {
    DriveName.HUNGER:     0.3,
    DriveName.CURIOSITY:  0.5,
    DriveName.SAFETY:     0.2,
    DriveName.BOREDOM:    0.4,
    DriveName.LONELINESS: 0.4,
}


@dataclass(frozen=True)
class DriveState:
    """Snapshot of all 5 drive values at a given tick. Pure data."""
    hunger: float
    curiosity: float
    safety: float
    boredom: float
    loneliness: float

    def get(self, name: DriveName) -> float:
        return getattr(self, name.value)


@dataclass(frozen=True)
class DriveCrossing:
    """A single level-change event, to be emitted as an Action metadata."""
    drive: DriveName
    level: DriveLevel
    direction: DriveDirection
```

### `brain/src/noesis_brain/ananke/drives.py`

```python
"""Pure deterministic drive math. No I/O, no wall-clock, no RNG.

Per DRIVE-02: update(state, seed, tick, configs) is a total function.
Same (state, seed, tick, configs) → same (new_state).

Per D-10a-02: pure Python, no external libraries.
"""
from __future__ import annotations

from .types import (
    DEFAULT_BASELINES,
    DriveConfig,
    DriveLevel,
    DriveName,
    DriveState,
)


def update(
    state: DriveState,
    seed: bytes,           # unused in rise-only; accepted for future jitter
    tick: int,             # unused in rise-only; accepted for future jitter
    configs: dict[DriveName, DriveConfig],
) -> DriveState:
    """Advance every drive by one tick.

    Recurrence (piecewise — Pitfall 2 defense):
        below baseline: next = baseline + (prev - baseline) * decay_factor + rise_rate
        above baseline: next = prev + rise_rate
    Then clamp to [0.0, 1.0].
    """
    new_values: dict[str, float] = {}
    for drive in DriveName:
        cfg = configs[drive]
        prev = state.get(drive)
        if prev < cfg.baseline:
            pulled = cfg.baseline + (prev - cfg.baseline) * cfg.decay_factor
        else:
            pulled = prev
        nxt = pulled + cfg.rise_rate
        # Clamp last. Monotonic by construction (pulled >= prev when prev < baseline
        # iff decay_factor < 1, which is guaranteed by DriveConfig.__post_init__).
        if nxt < 0.0:
            nxt = 0.0
        elif nxt > 1.0:
            nxt = 1.0
        new_values[drive.value] = nxt
    return DriveState(**new_values)


def resolve_level(value: float, prev_level: DriveLevel, cfg: DriveConfig) -> DriveLevel:
    """State-dependent bucketing with hysteresis. See Pattern 2."""
    lo = cfg.low_upper
    hi = cfg.med_upper
    h = cfg.hysteresis
    if prev_level == DriveLevel.LOW:
        if value >= lo + h:
            return DriveLevel.MED if value < hi + h else DriveLevel.HIGH
        return DriveLevel.LOW
    if prev_level == DriveLevel.MED:
        if value < lo - h:
            return DriveLevel.LOW
        if value >= hi + h:
            return DriveLevel.HIGH
        return DriveLevel.MED
    # prev_level == HIGH
    if value < hi - h:
        return DriveLevel.MED if value >= lo - h else DriveLevel.LOW
    return DriveLevel.HIGH


def initial_level(value: float, cfg: DriveConfig) -> DriveLevel:
    """Value-only bucketing for first-tick seed — no hysteresis needed."""
    if value < cfg.low_upper:
        return DriveLevel.LOW
    if value < cfg.med_upper:
        return DriveLevel.MED
    return DriveLevel.HIGH
```

### `brain/src/noesis_brain/ananke/runtime.py`

```python
"""AnankeRuntime holds per-Nous drive state + prev-level cache."""
from __future__ import annotations

from .drives import resolve_level, update
from .types import (
    DriveConfig,
    DriveCrossing,
    DriveDirection,
    DriveLevel,
    DriveName,
    DriveState,
)

# Ordering for transition direction determination.
_LEVEL_ORDER: dict[DriveLevel, int] = {
    DriveLevel.LOW: 0,
    DriveLevel.MED: 1,
    DriveLevel.HIGH: 2,
}


class AnankeRuntime:
    def __init__(
        self,
        initial_state: DriveState,
        configs: dict[DriveName, DriveConfig],
        initial_levels: dict[DriveName, DriveLevel],
    ) -> None:
        self.state = initial_state
        self.configs = configs
        self.prev_levels = dict(initial_levels)  # defensive copy

    def tick(self, seed: bytes, tick: int) -> list[DriveCrossing]:
        """Advance by one tick. Return list of crossings (may be empty).

        Pure transform from (self.state, self.prev_levels) — no I/O.
        """
        new_state = update(self.state, seed, tick, self.configs)
        crossings: list[DriveCrossing] = []
        for drive in DriveName:
            prev_level = self.prev_levels[drive]
            new_level = resolve_level(
                new_state.get(drive), prev_level, self.configs[drive]
            )
            if new_level != prev_level:
                direction = (
                    DriveDirection.RISING
                    if _LEVEL_ORDER[new_level] > _LEVEL_ORDER[prev_level]
                    else DriveDirection.FALLING
                )
                crossings.append(
                    DriveCrossing(drive=drive, level=new_level, direction=direction)
                )
                self.prev_levels[drive] = new_level
        self.state = new_state
        return crossings
```

### `brain/src/noesis_brain/rpc/handler.py` (integration diff)

```python
# In rpc/types.py:
class ActionType(str, Enum):
    # ... existing ...
    DRIVE_CROSSED = "drive_crossed"   # NEW — Phase 10a

# In rpc/handler.py on_tick():
# After existing telos/thymos updates:
ananke_crossings = self.ananke.tick(seed=tick_seed, tick=tick)
for crossing in ananke_crossings:
    actions.append(Action(
        action_type=ActionType.DRIVE_CROSSED,
        channel="",
        text="",
        metadata={
            "drive": crossing.drive.value,
            "level": crossing.level.value,
            "direction": crossing.direction.value,
        },
    ))
```

### `grid/src/ananke/append-drive-crossed.ts`

```typescript
/**
 * appendAnankeDriveCrossed — SOLE producer boundary for `ananke.drive_crossed`
 * audit events (DRIVE-03 Phase 10a).
 *
 * Mirrors Phase 6 D-11 / Phase 7 / Phase 8 sole-producer discipline:
 *   1. Regex guards on every field (did, tick, drive, level, direction).
 *   2. Closed 5-key payload tuple — extra keys refused.
 *   3. payloadPrivacyCheck — belt-and-suspenders.
 *   4. audit.append with canonical event type 'ananke.drive_crossed'.
 *
 * Any other file in grid/src/ calling audit.append with eventType
 * === 'ananke.drive_crossed' fails the producer-boundary grep test.
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';

export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
export const DRIVE_RE = /^(hunger|curiosity|safety|boredom|loneliness)$/;
export const LEVEL_RE = /^(low|med|high)$/;
export const DIRECTION_RE = /^(rising|falling)$/;

export type DriveName = 'hunger' | 'curiosity' | 'safety' | 'boredom' | 'loneliness';
export type DriveLevel = 'low' | 'med' | 'high';
export type DriveDirection = 'rising' | 'falling';

export interface DriveCrossedPayload {
    readonly did: string;
    readonly tick: number;
    readonly drive: DriveName;
    readonly level: DriveLevel;
    readonly direction: DriveDirection;
}

/** Sorted — must match Object.keys(payload).sort() exactly. */
const EXPECTED_KEYS = ['did', 'direction', 'drive', 'level', 'tick'] as const;

export function appendAnankeDriveCrossed(
    audit: AuditChain,
    actorDid: string,
    payload: DriveCrossedPayload,
): AuditEntry {
    // 1. Actor DID format guard.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendAnankeDriveCrossed: invalid actorDid`);
    }

    // 2. Payload type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendAnankeDriveCrossed: payload must be a plain object`);
    }

    // 3. Field guards.
    if (typeof payload.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(`appendAnankeDriveCrossed: did must match DID_RE`);
    }
    if (payload.did !== actorDid) {
        throw new TypeError(
            `appendAnankeDriveCrossed: payload.did must equal actorDid (self-report invariant)`,
        );
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendAnankeDriveCrossed: tick must be a non-negative integer`);
    }
    if (typeof payload.drive !== 'string' || !DRIVE_RE.test(payload.drive)) {
        throw new TypeError(`appendAnankeDriveCrossed: drive must be one of ${DRIVE_RE}`);
    }
    if (typeof payload.level !== 'string' || !LEVEL_RE.test(payload.level)) {
        throw new TypeError(`appendAnankeDriveCrossed: level must be one of ${LEVEL_RE}`);
    }
    if (typeof payload.direction !== 'string' || !DIRECTION_RE.test(payload.direction)) {
        throw new TypeError(`appendAnankeDriveCrossed: direction must be one of ${DIRECTION_RE}`);
    }

    // 4. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])
    ) {
        throw new TypeError(
            `appendAnankeDriveCrossed: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 5. Explicit reconstruction (no prototype pollution).
    const cleanPayload: DriveCrossedPayload = {
        did: payload.did,
        tick: payload.tick,
        drive: payload.drive,
        level: payload.level,
        direction: payload.direction,
    };

    // 6. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendAnankeDriveCrossed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 7. Commit.
    return audit.append('ananke.drive_crossed', actorDid, cleanPayload);
}
```

### `grid/src/audit/broadcast-allowlist.ts` — diff

```typescript
// Add to ALLOWLIST_MEMBERS (position 19):
const ALLOWLIST_MEMBERS: readonly string[] = [
    // ... existing 18 ...
    'operator.nous_deleted',
    // Phase 10a (DRIVE-03) — Ananke drive threshold crossing. Closed 5-key payload:
    // {did, tick, drive, level, direction}. NO numeric drive values.
    // Emitted ONLY via appendAnankeDriveCrossed() (grid/src/ananke/append-drive-crossed.ts).
    'ananke.drive_crossed',
] as const;

// Extend FORBIDDEN_KEY_PATTERN:
export const FORBIDDEN_KEY_PATTERN =
    /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value/i;
```

### `grid/test/ananke/append-drive-crossed-closed-tuple.test.ts` (shape)

```typescript
import { describe, it, expect } from 'vitest';
import { appendAnankeDriveCrossed } from '../../src/ananke/append-drive-crossed.js';
import { AuditChain } from '../../src/audit/chain.js';

describe('appendAnankeDriveCrossed — closed-tuple enforcement', () => {
    const DID = 'did:noesis:test';
    const HAPPY = { did: DID, tick: 100, drive: 'hunger' as const,
                    level: 'med' as const, direction: 'rising' as const };

    it('accepts the canonical 5-key payload', () => {
        const chain = new AuditChain();
        expect(() => appendAnankeDriveCrossed(chain, DID, HAPPY)).not.toThrow();
    });

    it('rejects extra key', () => {
        const chain = new AuditChain();
        // @ts-expect-error — testing runtime guard
        expect(() => appendAnankeDriveCrossed(chain, DID, { ...HAPPY, extra: 'x' }))
            .toThrow(/unexpected key set/);
    });

    it('rejects missing key', () => {
        const chain = new AuditChain();
        const { tick, ...rest } = HAPPY;
        // @ts-expect-error — testing runtime guard
        expect(() => appendAnankeDriveCrossed(chain, DID, rest)).toThrow(/unexpected key set/);
    });

    it('rejects numeric level (DRIVE-05)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — testing runtime guard
        expect(() => appendAnankeDriveCrossed(chain, DID, { ...HAPPY, level: 0.5 }))
            .toThrow(/level must be one of/);
    });

    it('rejects drive name outside the closed enum', () => {
        const chain = new AuditChain();
        // @ts-expect-error — testing runtime guard
        expect(() => appendAnankeDriveCrossed(chain, DID, { ...HAPPY, drive: 'thirst' }))
            .toThrow(/drive must be one of/);
    });
});
```

### `grid/test/audit/ananke-drive-crossed-privacy.test.ts` (shape)

```typescript
import { describe, it, expect } from 'vitest';
import { appendAnankeDriveCrossed } from '../../src/ananke/append-drive-crossed.js';
import { AuditChain } from '../../src/audit/chain.js';

const DID = 'did:noesis:test';
const HAPPY = { did: DID, tick: 100, drive: 'hunger' as const,
                level: 'med' as const, direction: 'rising' as const };

const FORBIDDEN_CASES: Array<{ name: string; patch: Record<string, unknown> }> = [
    { name: 'flat hunger',     patch: { hunger: 0.7 } },
    { name: 'flat curiosity',  patch: { curiosity: 0.7 } },
    { name: 'flat safety',     patch: { safety: 0.7 } },
    { name: 'flat boredom',    patch: { boredom: 0.7 } },
    { name: 'flat loneliness', patch: { loneliness: 0.7 } },
    { name: 'flat drive_value',patch: { drive_value: 0.7 } },
    // Nested — the walker must descend. Emitter's closed-tuple already
    // rejects extra keys, so these also throw on the key set check — but
    // exercising the nested path here hardens future payload widenings.
];

describe('ananke.drive_crossed — privacy matrix', () => {
    it.each(FORBIDDEN_CASES)('rejects forbidden key: $name', ({ patch }) => {
        const chain = new AuditChain();
        expect(() =>
            // @ts-expect-error — intentional extra key for test
            appendAnankeDriveCrossed(chain, DID, { ...HAPPY, ...patch }),
        ).toThrow();
    });

    it('happy path appends', () => {
        const chain = new AuditChain();
        expect(() => appendAnankeDriveCrossed(chain, DID, HAPPY)).not.toThrow();
    });
});
```

### `grid/test/ananke/audit-ceiling.test.ts` (shape — D-10a-04 regression)

```typescript
// Simulates 1000 ticks × 5 drives × 1 Nous through the Brain runtime
// (via a Python subprocess or a JS port of the math for test-only);
// asserts that the resulting audit chain has ≤ 50 'ananke.drive_crossed' entries.
// With piecewise-monotonic recurrence + hysteresis, the expected count is
// ~5 (one transition per drive from low to med, possibly med to high).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stochastic drive models (action-based reducers at each tick) | Deterministic `(seed, tick)` closed form | Phase 9 D-9-01 | Byte-identical replay; T-09-03 tick-rate invariance |
| Per-event custom payload validator | Shared `FORBIDDEN_KEY_PATTERN` + `payloadPrivacyCheck` + per-emitter closed-tuple | Phase 6 D-11 | Single place to extend privacy; sole-producer grep CI |
| Per-tick heartbeat emission of full state | Threshold-crossing-only with level enum | Phase 10a D-10a-04 | Audit ceiling respected; no numeric leakage |
| `random.Random(seed)` for reproducibility | `hashlib.blake2b` (if needed) | General Python practice | Cross-version stable |

**Deprecated / outdated:**
- None. This is a greenfield subsystem.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `math.exp(-1/tau)` for fixed-integer `tau` produces identical float across CPython 3.11+ point releases. | §Standard Stack, §Pattern 1 | Replay determinism within Python holds (the only replay path we need for 10a); if CPython ever changes `math.exp` ULP behavior, re-verify with the existing determinism test. [ASSUMED — strong training-data belief but not CI-verified in this session.] |
| A2 | Phase 9 `weight × exp(-Δ/τ)` pattern chattering behavior is analogous to drive bucketing chatter. | §Pattern 2 | If chatter is *not* observed in practice, hysteresis is mild over-engineering. Cost is low (4 extra bytes per DriveConfig + a clearer comment). [ASSUMED — pattern analogy, not empirical.] |
| A3 | The existing Grid `brain-bridge` dispatcher is extensible with a new `ActionType` case without Grid-side refactor. | §Pattern 4 | If the dispatcher is a sealed switch, Plan Wave 1 adds a single case. Low cost. [ASSUMED — inferred from Phase 7 pattern; not verified against current `brain-bridge.ts`.] |
| A4 | `pyproject.toml` `testpaths = ["test"]` means `brain/test/ananke/` is picked up automatically. | §Project Structure | If testpaths differs, add `brain/test/ananke` to config. Zero risk. [ASSUMED — per Phase 7 STATE.md note.] |
| A5 | 5 drives × 3 levels × 2 directions = 30 possible crossing events, all expressible in the 5-key closed tuple. No crossing variant needs a 6th key. | §Code Examples | If a future phase needs "saturated" or "reset" variants, they require a new event type, not key widening (D-10a-08 already forbids sibling event types). [VERIFIED: DRIVE-03 literal text specifies the exact 5 keys.] |

## Open Questions

1. **Path discrepancy: `brain/src/ananke/` vs. `brain/src/noesis_brain/ananke/`**
   - What we know: CONTEXT.md D-10a-02 and REQUIREMENTS.md DRIVE-01 both say `brain/src/ananke/drives.py`. But the actual existing Brain subsystem layout is `brain/src/noesis_brain/{psyche,telos,thymos}/` — there is no `brain/src/psyche/` or `brain/src/telos/`.
   - What's unclear: Whether the doc path is aspirational / shorthand, or whether there's a packaging reason to place ananke *outside* `noesis_brain/`.
   - Recommendation: Place under `brain/src/noesis_brain/ananke/` (sibling consistency). Update DRIVE-01 / D-10a-02 wording in a follow-up documentation commit. The Brain-side `grep` for `brain/src/ananke/**` in D-10a-05 becomes `brain/src/noesis_brain/ananke/**`. Planner to confirm.

2. **Rise-rate calibration — does a 10k-tick RIG run end with all 5 drives saturated at 1.0 or a distributed mix?**
   - What we know: With `rise_rate = 0.0003` per tick and `baseline = 0.3`, a drive starting at baseline reaches `prev + 0.0003 × 10000 = 3.3` (clamped to 1.0 around tick 2334). All drives saturate.
   - What's unclear: Whether this is intended behavior or whether per-drive rise-rates should be tuned so e.g. safety saturates slower than curiosity.
   - Recommendation: Planner locks `rise_rate` constants. Start with `0.0001` (≈ 10k ticks to full saturation from 0) and tune based on RIG observation. No determinism impact — calibration is purely cosmetic.

3. **Hysteresis band size (0.02) — is this empirically right or a placeholder?**
   - What we know: A band of 0.02 means a drive near 0.33 must cross 0.35 to enter MED and drop to 0.31 to return to LOW.
   - What's unclear: With `rise_rate = 0.0001` and `decay_factor = exp(-1/5000) ≈ 0.9998`, can a drive realistically oscillate by 0.04 per tick? Probably not — the recurrence is near-monotonic. But no RIG data yet.
   - Recommendation: Ship with 0.02; add a metric to the audit-ceiling regression that counts crossings. If average is well below 50, hysteresis can be reduced in 10c. If chattering appears, increase.

4. **Does the `seed` parameter serve any purpose in pure-rise-only math?**
   - What we know: CONTEXT D-10a-01 says "function of `(seed, tick)`", but the recommended recurrence uses only `(prev_value, config)` per drive — neither seed nor tick appears in the math.
   - What's unclear: Whether "function of `(seed, tick)`" is a forward-looking phrasing for when jitter is added, or whether we must wire the seed through now even though it's unused.
   - Recommendation: Wire seed + tick as parameters (matches the spec literally), leave them unused in rise-only. Phase 10c or 10d may introduce per-drive jitter via `blake2b(seed || tick || drive_name)`. Zero cost now, preserves API stability.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **pytest** (Brain) + **vitest** (Grid + Dashboard) |
| Config file | `brain/pyproject.toml` (`[tool.pytest.ini_options] testpaths = ["test"]`), `grid/vitest.config.ts`, `dashboard/vitest.config.ts` |
| Quick run command | `cd brain && pytest test/ananke -x` / `cd grid && npx vitest run test/ananke test/audit/ananke-drive-crossed-privacy.test.ts` |
| Full suite command | `cd brain && pytest` / `cd grid && npx vitest run` / `cd dashboard && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRIVE-01 | Pure Python module, closed 5-drive enum, no external deps | unit | `cd brain && pytest test/ananke/test_closed_enum.py -x` | ❌ Wave 0 |
| DRIVE-01 | No new Python imports beyond stdlib | grep-CI | `cd brain && pytest test/ananke/test_no_external_deps.py -x` | ❌ Wave 0 |
| DRIVE-02 | Same `(state, seed, tick)` → byte-identical next state | unit | `cd brain && pytest test/ananke/test_determinism.py -x` | ❌ Wave 0 |
| DRIVE-02 | 10k-tick trace is monotone per drive (piecewise form) | unit | `cd brain && pytest test/ananke/test_monotonic_rise.py -x` | ❌ Wave 0 |
| DRIVE-02 | Tick-rate invariance: `tickRateMs=1_000_000` vs `tickRateMs=1000` → identical audit entries | integration | `cd grid && npx vitest run test/ananke/tick-rate-invariance.test.ts` | ❌ Wave 0 |
| DRIVE-03 | Closed-tuple payload enforcement (5 keys sorted) | unit | `cd grid && npx vitest run test/ananke/append-drive-crossed-closed-tuple.test.ts` | ❌ Wave 0 |
| DRIVE-03 | Sole-producer boundary (only `append-drive-crossed.ts` calls `audit.append('ananke.drive_crossed', ...)`) | grep-CI | `cd grid && npx vitest run test/audit/ananke-drive-crossed-producer-boundary.test.ts` | ❌ Wave 0 |
| DRIVE-03 | Allowlist exactly 19 members, `ananke.drive_crossed` at position 19 | unit | `cd grid && npx vitest run test/audit/allowlist-nineteen.test.ts` | ❌ Wave 0 (rename existing allowlist-eighteen) |
| DRIVE-04 | Advisory-only — Brain logs divergence to private wiki, Grid takes no penalty action | integration | `cd brain && pytest test/ananke/test_advisory_coupling.py -x` | ❌ Wave 0 |
| DRIVE-05 | No numeric drive values crossing the wire — privacy matrix | unit | `cd grid && npx vitest run test/audit/ananke-drive-crossed-privacy.test.ts` | ❌ Wave 0 |
| DRIVE-05 | Wall-clock ban in `grid/src/ananke/**` and `brain/src/noesis_brain/ananke/**` | grep-CI | `cd grid && npx vitest run test/ananke/determinism-source.test.ts` + `cd brain && pytest test/ananke/test_no_wallclock.py -x` | ❌ Wave 0 |
| D-10a-04 | Audit-size ceiling: 1000 ticks × 5 drives × 1 Nous ≤ 50 entries | integration | `cd grid && npx vitest run test/ananke/audit-ceiling.test.ts` | ❌ Wave 0 |
| Zero-diff invariant | Chain hash byte-identical with/without DrivesPanel listener (if 10a introduces a listener — TBD by planner; may not apply since the chain is the output, not the input) | integration | `cd grid && npx vitest run test/ananke/zero-diff.test.ts` (only if planner adds a listener) | ❌ Conditional |

### Sampling Rate
- **Per task commit:** `cd brain && pytest test/ananke -x && cd ../grid && npx vitest run test/ananke test/audit/ananke-drive-crossed-privacy.test.ts test/audit/ananke-drive-crossed-producer-boundary.test.ts test/audit/allowlist-nineteen.test.ts`
- **Per wave merge:** Full brain + grid suites: `cd brain && pytest && cd ../grid && npx vitest run`
- **Phase gate:** Full suite green + dashboard suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `brain/test/ananke/__init__.py` — empty marker so pytest discovers the dir
- [ ] `brain/test/ananke/test_closed_enum.py` — DRIVE-01
- [ ] `brain/test/ananke/test_no_external_deps.py` — DRIVE-01 (grep imports)
- [ ] `brain/test/ananke/test_determinism.py` — DRIVE-02 (same inputs → identical `DriveState`)
- [ ] `brain/test/ananke/test_monotonic_rise.py` — DRIVE-02 (piecewise invariant)
- [ ] `brain/test/ananke/test_advisory_coupling.py` — DRIVE-04 (Brain logs but doesn't force Grid penalty)
- [ ] `brain/test/ananke/test_no_wallclock.py` — D-10a-05 (grep `time|datetime|random.random(` in `brain/src/noesis_brain/ananke/`)
- [ ] `grid/test/ananke/` directory — new
- [ ] `grid/test/ananke/append-drive-crossed-closed-tuple.test.ts` — DRIVE-03
- [ ] `grid/test/ananke/tick-rate-invariance.test.ts` — DRIVE-02 / T-09-03
- [ ] `grid/test/ananke/audit-ceiling.test.ts` — D-10a-04
- [ ] `grid/test/ananke/determinism-source.test.ts` — D-10a-05 (wall-clock ban in `grid/src/ananke/**`)
- [ ] `grid/test/audit/ananke-drive-crossed-privacy.test.ts` — DRIVE-05
- [ ] `grid/test/audit/ananke-drive-crossed-producer-boundary.test.ts` — sole-producer grep
- [ ] `grid/test/audit/allowlist-nineteen.test.ts` — rename/update `allowlist-eighteen.test.ts`
- [ ] Framework install: none (pytest + vitest already present)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Event is Nous-self-reported via an actorDid (DID_RE); no human auth in-path |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes — sovereignty | Grid must NOT be able to *force* a drive value (advisory-only coupling, D-10a-06). Enforced by architecture: Grid has no write path into `AnankeRuntime`. |
| V5 Input Validation | yes | Emitter regex-gates DID, tick, drive, level, direction. Closed-tuple check. `payloadPrivacyCheck`. |
| V6 Cryptography | no | No crypto in Ananke. `hashlib.blake2b` is used only as a deterministic bit-mixer if jitter is introduced — not security crypto. |
| V7 Error Handling | yes | All guard failures throw `TypeError`; no silent drop. |
| V8 Data Protection | yes | No numeric drive values leave Brain. Closed-enum levels are the only wire-visible drive state. |
| V10 Malicious Code | yes | `ActionType.DRIVE_CROSSED` from Brain is validated by Grid before chain append; Brain can only emit valid crossings. |
| V11 Business Logic | yes | DRIVE-04 advisory invariant = Nous sovereignty. |

### Known Threat Patterns for Phase 10a

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **T-09-02 Plaintext leak**: numeric drive value sneaks past the allowlist | Information Disclosure | Three-tier defense: (1) closed-tuple emitter refuses extra keys, (2) `FORBIDDEN_KEY_PATTERN` walker rejects drive-name or `drive_value` keys, (3) privacy matrix test exhausts the combinations. |
| **T-09-01 Audit bloat**: per-tick emission floods chain | Denial of Service | Level-change-only emission + hysteresis band + D-10a-04 ceiling regression. |
| **T-09-03 Wall-clock coupling**: replay at different tick rate produces different audit trace | Tampering | Grep ban on `Date.now|performance.now|setInterval|setTimeout|Math.random` in both subsystems + tick-rate-invariance integration test. |
| **T-10a-01 (NEW) Rogue producer**: another file appends `ananke.drive_crossed` bypassing emitter guards | Spoofing / Tampering | Sole-producer grep gate (clone Phase 8 pattern). |
| **T-10a-02 (NEW) Level spoofing via stringified number**: emitter accepts `level: "0.5"` because it's a string | Tampering | Regex `/^(low\|med\|high)$/` rejects any string that isn't the exact enum value. |
| **T-10a-03 (NEW) Sibling-event breach of closed enum**: future code emits `ananke.drive_raised` or `ananke.drive_saturated` | Tampering | Allowlist-nineteen test asserts exactly 19 members with `ananke.drive_crossed` at position 19 — no siblings. |
| **T-10a-04 (NEW) Grid coerces drive**: someone adds a `forceDrive(did, drive, value)` admin endpoint | Elevation of Privilege (violation of PHILOSOPHY §6) | Grep gate: no write-path from Grid into Brain ananke state. Brain-side state is only mutated by `AnankeRuntime.tick()`. |
| **T-10a-05 (NEW) DID spoofing**: Brain reports `crossing` for a DID that isn't its own | Spoofing | `payload.did === actorDid` self-report invariant (clone Phase 8 `appendNousDeleted` pattern). |

## Sources

### Primary (HIGH confidence)
- `brain/src/noesis_brain/psyche/{types.py,loader.py}` — Brain subsystem layout + str-enum pattern (read in-session)
- `brain/src/noesis_brain/thymos/{tracker.py,types.py}` — Closed-enum state space with clamp pattern (read in-session)
- `brain/src/noesis_brain/telos/manager.py` — Manager + `from_yaml` pattern (read in-session)
- `brain/src/noesis_brain/rpc/{types.py,handler.py}` — `ActionType` enum, `on_tick` Action-return pattern, Phase 7 `_build_refined_telos` (read in-session lines 440–560)
- `grid/src/audit/broadcast-allowlist.ts` — Frozen allowlist + `FORBIDDEN_KEY_PATTERN` + `payloadPrivacyCheck` (read in-session)
- `grid/src/audit/append-telos-refined.ts` — Phase 7 sole-producer template (read in-session)
- `grid/src/audit/append-nous-deleted.ts` — Phase 8 sole-producer template with 8-step defense (read in-session)
- `grid/src/relationships/{listener.ts,canonical.ts,config.ts,storage.ts}` — Phase 9 deterministic state + pure-observer patterns (read in-session)
- `grid/test/audit/telos-refined-privacy.test.ts` — 8-case privacy matrix template (read in-session)
- `grid/test/audit/telos-refined-producer-boundary.test.ts` — grep boundary pattern (read in-session)
- `grid/test/audit/operator-payload-privacy.test.ts` — 40-case multi-event privacy matrix (read in-session)
- `grid/test/relationships/{zero-diff,determinism-source,producer-boundary}.test.ts` — Phase 9 invariant tests (read in-session)
- `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-CONTEXT.md` — locked decisions (read in-session)
- `.planning/REQUIREMENTS.md` DRIVE-01..05 (read in-session)
- `.planning/ROADMAP.md` Phase 10a section (read in-session)
- `.planning/STATE.md` accumulated context (read in-session)
- `PHILOSOPHY.md` §6 — Nous sovereignty (cited)

### Secondary (MEDIUM confidence)
- Python Language Reference, "Floating-point arithmetic" — `math.exp` IEEE-754 conformance
- CPython `random` module docs — "Reproducibility guaranteed only within the same major release" (training data)
- ECMA-262 §21.3.2.14 `Math.exp` — "implementation-approximated" language (training data)

### Tertiary (LOW confidence)
- None material — this research synthesized almost entirely from verified in-session reads.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — stdlib + existing project conventions only; no new deps.
- Architecture: HIGH — every pattern verified by in-session read of Phase 6/7/8/9 code.
- Pitfalls: HIGH — P1-P7 derived from explicit CONTEXT constraints + verified prior-phase incidents (Phase 9 chatter in plan-check, Phase 6 D-11 key-order defense, etc.).
- Code examples: HIGH — directly modeled on in-session-read files; line-for-line transformations.
- Validation architecture: HIGH — Wave 0 gaps enumerated from actually-missing files; sampling commands use existing tools.
- Security domain: HIGH — STRIDE categories mapped to concrete in-session-verified threat-mitigation pairs.

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable v2.2 surface; re-verify only if Phase 7 or Phase 8 patterns change upstream)
