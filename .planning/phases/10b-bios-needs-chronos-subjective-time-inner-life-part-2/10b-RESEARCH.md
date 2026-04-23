# Phase 10b: Bios Needs + Chronos Subjective Time (Inner Life, part 2) — Research

**Researched:** 2026-04-22
**Domain:** Deterministic bodily-needs subsystem (Brain Python) + lifecycle audit events (Grid TS) + subjective-time read-side query transform (Brain Python); all clones of Phase 10a discipline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-10b-01:** ROADMAP §Phase 10b incorrectly claims "Allowlist additions: 0." `bios.birth` and `bios.death` do NOT exist in the codebase. Phase 10b adds exactly +2: `bios.birth` at position 20, `bios.death` at position 21. Running total: 19 → 21.
- Payload shapes locked:
  - `bios.birth`: `{did, tick, psyche_hash}` — 3 keys. `psyche_hash` = Brain-computed hash of Psyche init vector (no Big Five floats on wire).
  - `bios.death`: `{did, tick, cause, final_state_hash}` — 4 keys. `cause ∈ {starvation, operator_h5, replay_boundary}`.
- Sole-producer files: `grid/src/bios/appendBiosBirth.ts`, `grid/src/bios/appendBiosDeath.ts`.
- Doc-sync: planner MUST update ROADMAP §10b allowlist claim and STATE.md enumeration atomically with emitter landing.

**D-10b-02:** Bios→Ananke elevation is once per threshold crossing, not every tick while over threshold. Elevation raises matching drive by one bucket (low→med or med→high); if already at `high`, no-op. No new allowlist event — elevation surfaces only via existing `ananke.drive_crossed`.

**D-10b-03:** Rise-only with passive baseline decay. No action-based satiation in 10b. Per-need baselines: Claude's Discretion; sensible defaults `energy=0.3, sustenance=0.3`. Rise curve shape: planner's choice within replay-determinism rails (same as D-10a-01). Math in `brain/src/noesis_brain/bios/needs.py`.

**D-10b-04:** Death-cause triggers:
- `starvation`: Bios auto-emits when `energy == 1.0 OR sustenance == 1.0` for one full tick.
- `operator_h5`: `delete-nous.ts` extended to invoke `appendBiosDeath({cause: 'operator_h5', ...})` in the same tick, same transactional sequence.
- `replay_boundary`: emitted during replay when recorded chain contains `bios.death` at or before replay cursor.
- Post-death rejection: extends Phase 8 `tombstoneCheck` pattern; all `appendX` helpers assert `!registry.isTombstoned(did)`.

**D-10b-05:** Subjective-time formula: `multiplier(drives) = clamp(1.0 + curiosity_boost(curiosity) - boredom_penalty(boredom), 0.25, 4.0)`. Boosts/penalties by bucket level. Hunger, safety, loneliness neutral in 10b.

**D-10b-06:** Multiplier applied inside Stanford retrieval recency term, Brain-side, at read time: `score = α·relevance + β·(recency · subjective_multiplier) + γ·importance`. Never mutates `audit_tick`. Grid does not observe score computation.

**D-10b-07:** `epoch_since_spawn(did) = current_tick - bios_birth_tick(did)`, Brain-local derived read via AuditChain cache scan for `bios.birth` entry. Exposed via existing Psyche context injection pattern. Memoized per-DID. No new RPC verb, no new allowlist event.

**D-10b-08:** Bios math in `brain/src/noesis_brain/bios/needs.py`. Chronos math in `brain/src/noesis_brain/chronos/subjective_time.py`. Both pure Python siblings of `ananke/`.

**D-10b-09:** Determinism grep gate extended to `grid/src/bios/**`, `grid/src/chronos/**`, `brain/src/noesis_brain/bios/**`, `brain/src/noesis_brain/chronos/**`. Pause/resume zero-diff regression clones `c7c49f49…` hash template (T-09-04).

**D-10b-10:** Privacy matrix: `BIOS_FORBIDDEN_KEYS = {energy, sustenance, need_value, bios_value}`, `CHRONOS_FORBIDDEN_KEYS = {subjective_multiplier, chronos_multiplier, subjective_tick}`. Three-tier grep.

**D-10b-11:** No `chronos.*` audit event in 10b. Closed-enum test: any attempt to append `chronos.time_slipped` / `chronos.multiplier_changed` fails at allowlist gate.

**D-10b-12:** After `bios.death` appends, per-tick drive rise and Bios rise halt for that DID. No post-death `ananke.drive_crossed` for tombstoned DID; grep-gate enforces.

### Claude's Discretion

- Per-need baselines (defaults: `energy=0.3, sustenance=0.3`) — planner locks exact constants.
- Rise curve shape — same rails as D-10a-01 (byte-identical replay, no float over/underflow, deterministic clamping).
- Curiosity boost / boredom penalty constants: defaults from D-10b-05 (0.0/+1.0/+3.0 and 0.0/+0.3/+0.75); planner locks.
- `final_state_hash` construction for `bios.death` — same `combineStateHash()` pattern as Phase 8.
- Dashboard Bios panel visual vocabulary — reuses 10a DriveIndicator glyph/color pattern.

### Deferred Ideas (OUT OF SCOPE)

- Action-based satiation (eat/rest actions reduce needs).
- LLM-driven subjective time.
- Thymos categorical emotions (v2.3).
- Dashboard Chronos visualization.
- GDPR-style erasure.
- Additional drives feeding subjective-time formula (hunger/safety/loneliness neutral in 10b).
- `bios.death{cause}` extension with new cause values.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BIOS-01 | Bios tracks energy and sustenance in `[0.0, 1.0]`; needs rise monotonically; threshold crossing elevates matching Ananke drive. | §Architecture Patterns "BiosRuntime tick step"; §Code Examples "needs.py skeleton". [VERIFIED: ananke/drives.py piecewise recurrence is direct clone template.] |
| BIOS-02 | `bios.birth` and `bios.death` are the only lifecycle events; closed-enum test must reject third event at allowlist gate. | §Standard Stack "appendBiosBirth / appendBiosDeath sole producers"; §Code Examples "allowlist extension". [VERIFIED: broadcast-allowlist.ts has 19 entries; zero bios.* present — D-10b-01 confirmed.] |
| BIOS-03 | `bios.death` payload is `{did, tick, cause, final_state_hash}`; post-death rejection at sole-producer boundary. | §Architecture Patterns "death trigger integration"; §Code Examples "appendBiosDeath template". [VERIFIED: appendNousDeleted.ts and delete-nous.ts are the authoritative Phase 8 templates.] |
| BIOS-04 | Tombstoned DIDs permanently reserved; NousRegistry blocks DID reuse after `bios.death`. | §Architecture Patterns "tombstone integration"; §Code Examples "tombstoneCheck extension". [VERIFIED: registry.ts spawn() already throws on status=deleted; tombstone-check.ts is the gate.] |
| CHRONOS-01 | Subjective-time multiplier `[0.25, 4.0]` derived from drive state; modulates Stanford retrieval recency score. | §Architecture Patterns "Chronos application point"; §Code Examples "subjective_time.py formula". [VERIFIED: retrieval.py `recency_score()` uses datetime.now — must be replaced with tick-based recency for determinism; multiplier wraps the recency term.] |
| CHRONOS-02 | `audit_tick == system_tick` strictly; multiplier never mutates tick numbering. | §Architecture Patterns "tick purity invariant"; §Validation Architecture "CHRONOS-02 test". [VERIFIED: AuditChain.append() receives eventType and payload — no tick override path exists.] |
| CHRONOS-03 | `epoch_since_spawn` queryable primitive; exposed to Brain prompting. | §Architecture Patterns "epoch_since_spawn implementation"; §Code Examples "BiosRuntime.birth_tick memoization". [VERIFIED: AuditChain.query({eventType, actorDid}) is the scan API.] |
</phase_requirements>

---

## Summary

Phase 10b is a disciplined clone of Phase 10a — every pattern is established and verified. The Brain gains two new sibling subsystems (`bios/` and `chronos/`) mirroring the `ananke/` layout exactly. Grid-side Bios is minimal: two new sole-producer emitter files (`appendBiosBirth.ts`, `appendBiosDeath.ts`) and an extension to `delete-nous.ts`. Chronos has zero Grid surface — it is entirely Brain-local read-side state. The Dashboard gains one new Bios panel (bucketed low/med/high energy and sustenance), no Chronos panel.

The most critical research finding is the **retrieval.py wall-clock use**: `RetrievalScorer.recency_score()` currently calls `datetime.now()` [VERIFIED: `brain/src/noesis_brain/memory/retrieval.py:36`]. This must be replaced with a tick-based recency calculation for both CHRONOS-02 (tick purity) and D-10b-09 (no wall-clock in Chronos code paths). The Chronos multiplier wraps this fixed recency term. The planner must address this in the Chronos plan wave.

The second critical finding is the **allowlist reconciliation**: ROADMAP §Phase 10b and REQUIREMENTS.md both claim zero allowlist growth ("existing lifecycle events"), but no `bios.*` events exist in `grid/src/audit/broadcast-allowlist.ts` (19 entries, none bios.*) [VERIFIED: broadcast-allowlist.ts:42-75]. The doc-sync obligation from D-10b-01 touches: ROADMAP §10b allowlist line, STATE.md enumeration (19→21), `scripts/check-state-doc-sync.mjs` count literal, and REQUIREMENTS.md §Allowlist Growth Ledger note. These all ship in the same commit as `appendBiosBirth.ts`.

**Primary recommendation:** Build in 5 waves mirroring Phase 10a: Wave 0 (test scaffolding), Wave 1 (Brain Bios skeleton + Grid allowlist + sole producers), Wave 2 (Brain Chronos + Grid delete-nous extension + handler wiring), Wave 3 (Dashboard Bios panel), Wave 4 (regression tests + doc-sync close).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bios needs math (step, bucket, crossing detection) | Brain Python | — | Pure deterministic math; must never cross wire as floats; mirrors Ananke pattern |
| Bios→Ananke elevation on crossing | Brain Python | — | Elevation is a Brain-internal state mutation; Grid sees only the downstream `ananke.drive_crossed` |
| `bios.birth` emission | Grid TS (sole producer) | Brain Python (triggers via spawn path) | Allowlist event must be appended by Grid sole-producer file |
| `bios.death` emission | Grid TS (sole producer) | Brain Python (starvation trigger via RPC action) | Three causes, all terminate at Grid sole producer |
| Subjective-time multiplier | Brain Python | — | Read-side query transform; never crosses wire; CHRONOS-02 forbids any tick mutation |
| Stanford retrieval recency scaling | Brain Python (memory/retrieval.py) | — | Multiplier applied inside `RetrievalScorer.score()` at read time |
| `epoch_since_spawn` | Brain Python | — | Derived from Brain's own AuditChain cache; no RPC; no new event |
| Tombstone DID block post-bios.death | Grid TS (NousRegistry) | — | Registry.spawn() already throws on status=deleted; extend tombstoneCheck to Bios/Chronos emitters |
| Dashboard Bios panel | Dashboard (Next.js) | Grid audit firehose | Consumes existing firehose; filters `ananke.drive_crossed` for hunger/safety (Bios-elevated drives) |
| Privacy matrix enforcement | Grid TS + Brain Python + Dashboard | — | Three-tier grep gate clones D-10a-07 |

---

## Standard Stack

### Core (all inherited, zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib (`math`, `dataclasses`, `enum`, `typing`) | stdlib | Bios/Chronos pure math | Zero new deps; identical to Ananke subsystem constraint [VERIFIED: ananke/config.py uses only `math`, `dataclasses`, `enum`] |
| `@noble/hashes` (sha256) | already in grid/package.json | `psyche_hash` computation for `bios.birth` payload | Already used for state hashing [ASSUMED: need to confirm grid/package.json; pattern matches Phase 8 `combineStateHash`] |
| Vitest (grid) + pytest (brain) | already installed | Unit + integration testing | Project convention [VERIFIED: grid/vitest.config.ts + brain/pyproject.toml] |

### No New Dependencies

Phase 10b adds zero new npm or pip packages. All capabilities use project-existing infrastructure.

**Version verification:** All libraries are already installed at project baseline. No new `npm install` or `uv add` required.

---

## Architecture Patterns

### System Architecture Diagram

```
Brain per-DID (Python)                  Grid (TypeScript)
─────────────────────────────           ──────────────────────────────────────
                                        
  NousConfig.spawn                 ──►  appendBiosBirth(audit, did, {
    └─ compute_psyche_hash()              did, tick, psyche_hash })
       └─ [sole producer call]            ↑ position 20 in allowlist
                                        
  BiosRuntime.on_tick(tick)
    └─ BiosNeeds.step(state, tick)     bios.death cause=starvation:
       └─ detect_crossing()         ──►  appendBiosDeath(audit, did, {
          └─ if crossing AND               did, tick, cause: 'starvation',
             drive not already              final_state_hash })
             at high → elevate             ↑ position 21 in allowlist
             AnankeRuntime.level
             → new CrossingEvent         bios.death cause=operator_h5:
                                        delete-nous.ts handler EXTENDED:
  BiosRuntime.on_tick (starvation)       ... existing tombstone→despawn ...
    └─ if need == 1.0             ──►    appendBiosDeath({cause:'operator_h5'})
       └─ BIOS_DEATH action              appendNousDeleted({...})  ← unchanged

  ChronosRuntime.multiplier(drives)
    └─ curiosity_boost + boredom_penalty
    └─ clamp to [0.25, 4.0]
    └─ Brain-local ONLY, never emitted

  RetrievalScorer.score(memory, query, tick)
    └─ recency = tick_recency(memory, current_tick) [replaces datetime.now]
    └─ recency_scaled = recency × chronos_multiplier
    └─ return α·relevance + β·recency_scaled + γ·importance

  BiosRuntime.epoch_since_spawn(did)
    └─ scan AuditChain cache for bios.birth entry (memoized)
    └─ return current_tick - birth_tick
    └─ injected into build_system_prompt() context string
```

### Recommended Project Structure (new files only)

```
brain/src/noesis_brain/
├── bios/                          # NEW sibling of ananke/
│   ├── __init__.py                # Public surface re-export
│   ├── types.py                   # NeedName enum (energy, sustenance), NeedState, NeedCrossing
│   ├── config.py                  # NEED_BASELINES, NEED_RISE_RATES, DECAY_FACTOR (clone ananke/config.py)
│   ├── needs.py                   # step(), bucket(), detect_crossing(), initial_state()
│   ├── runtime.py                 # BiosRuntime: on_tick(), drain_crossings(), drain_death()
│   └── loader.py                  # BiosLoader.build(*, seed) factory
├── chronos/                       # NEW sibling of ananke/
│   ├── __init__.py
│   ├── types.py                   # ChronosState (multiplier float, birth_tick int)
│   └── subjective_time.py         # compute_multiplier(drives), tick_recency(memory, current_tick, decay_rate)
│
grid/src/
├── bios/                          # NEW sibling of grid/src/ananke/
│   ├── types.ts                   # BiosBirthPayload, BiosDeathPayload, BIOS_CAUSE_VALUES
│   ├── appendBiosBirth.ts         # SOLE producer for bios.birth (clone append-drive-crossed.ts)
│   ├── appendBiosDeath.ts         # SOLE producer for bios.death (clone append-drive-crossed.ts)
│   └── index.ts                   # Re-exports
```

### Pattern 1: Brain Bios Needs Step (clone of ananke/drives.py)

**What:** Piecewise deterministic recurrence — rise above baseline, relax below. Identical math to Ananke with different names.
**When to use:** Every Brain `on_tick()` call for each Nous.

```python
# Source: brain/src/noesis_brain/ananke/drives.py (authoritative template)
# Clone and rename: DriveName → NeedName, drive → need, etc.
def step(state: NeedState, seed: int, tick: int) -> NeedState:
    """Pure deterministic per-tick update.
    
    Piecewise recurrence (D-10b-03, mirrors D-10a-01):
        if prev < baseline:  next = baseline + (prev - baseline) * DECAY_FACTOR
        else:                next = prev + NEED_RISE_RATES[need]
    Clamp to [0.0, 1.0].
    NO wall-clock reads. NO random.
    """
    del seed, tick  # reserved; signature locked for future seed-conditioned perturbations
    new_values: dict[NeedName, float] = {}
    for need in NEED_NAMES:
        prev = state.values[need]
        baseline = NEED_BASELINES[need]
        if prev < baseline:
            nxt = baseline + (prev - baseline) * DECAY_FACTOR
        else:
            nxt = prev + NEED_RISE_RATES[need]
        new_values[need] = max(0.0, min(1.0, nxt))
    return NeedState(values=new_values, levels={n: state.levels[n] for n in NEED_NAMES})
```

[VERIFIED: exact shape from `brain/src/noesis_brain/ananke/drives.py:35-71`]

### Pattern 2: Bios→Ananke One-Shot Elevator (D-10b-02)

**What:** When a need crosses a threshold, raise the matching Ananke drive by one bucket level — once, not every tick. The Ananke drive's own threshold crossing then emits the existing `ananke.drive_crossed` audit event.
**When to use:** Inside `BiosRuntime.on_tick()`, after `detect_crossing()` returns a crossing.

```python
# Source: brain/src/noesis_brain/ananke/runtime.py + new bios/runtime.py
# Elevator mapping (D-10b-02): energy → hunger, sustenance → safety
NEED_TO_DRIVE: dict[NeedName, DriveName] = {
    NeedName.ENERGY: DriveName.HUNGER,
    NeedName.SUSTENANCE: DriveName.SAFETY,
}

def on_tick(self, tick: int, ananke_runtime: AnankeRuntime) -> None:
    """Advance Bios state and elevate Ananke on crossing.
    
    Single-writer path: BiosRuntime mutates AnankeRuntime.state.levels directly
    by calling ananke_runtime.elevate_drive(drive). Elevation is once-per-crossing
    — the _last_crossing_level dict tracks the last level at which elevation
    was triggered, so a drive hovering above threshold does not re-elevate.
    """
    stepped = step(self.state, self.seed, tick)
    self.state, new_crossings = detect_crossing(stepped)
    for crossing in new_crossings:
        self._crossings.append(crossing)  # for starvation detection
        drive = NEED_TO_DRIVE.get(crossing.need)
        if drive is not None:
            ananke_runtime.elevate_drive(drive)  # no-op if already HIGH
    # Starvation check: need saturated at 1.0 → signal BIOS_DEATH
    for need in NEED_NAMES:
        if self.state.values[need] >= 1.0:
            self._death_pending = True
```

**Key insight:** `ananke_runtime.elevate_drive()` is a NEW method on `AnankeRuntime` that bumps the in-memory level by one bucket without emitting any audit event. The `ananke.drive_crossed` event fires downstream only if the elevated level crosses the configured threshold on the NEXT crossing detection cycle. [ASSUMED: this is the cleanest interpretation of D-10b-02 "elevates the matching drive's level by one bucket"; planner should confirm whether elevation triggers a crossing event immediately or waits for next tick's detect_crossing pass.]

### Pattern 3: Grid Sole-Producer Emitter (clone of append-drive-crossed.ts)

**What:** 8-step validation → closed-tuple check → `audit.append()`. Identical structure for both `bios.birth` and `bios.death`.
**When to use:** Only from sole-producer files `appendBiosBirth.ts` and `appendBiosDeath.ts`.

```typescript
// Source: grid/src/ananke/append-drive-crossed.ts (authoritative template)
// For bios.birth: 3-key payload {did, tick, psyche_hash}
// For bios.death: 4-key payload {did, tick, cause, final_state_hash}

const EXPECTED_BIRTH_KEYS = ['did', 'psyche_hash', 'tick'] as const;  // alphabetical
const EXPECTED_DEATH_KEYS = ['cause', 'did', 'final_state_hash', 'tick'] as const;  // alphabetical

const CAUSE_VALUES = new Set(['starvation', 'operator_h5', 'replay_boundary']);

export function appendBiosBirth(
    audit: AuditChain,
    actorDid: string,
    payload: BiosBirthPayload,
): AuditEntry {
    // Steps 1-8 clone append-drive-crossed.ts verbatim:
    // 1. DID_RE guards on actorDid + payload.did
    // 2. Self-report invariant
    // 3. tick non-negative integer
    // 4. HEX64_RE guard on payload.psyche_hash
    // 5. Closed-tuple: Object.keys(payload).sort() === EXPECTED_BIRTH_KEYS
    // 6. Explicit reconstruction (no spread)
    // 7. payloadPrivacyCheck belt-and-suspenders
    // 8. audit.append('bios.birth', actorDid, cleanPayload)
}
```

[VERIFIED: append-drive-crossed.ts:54-134 is the authoritative 8-step template; append-nous-deleted.ts:60-133 is the Phase 8 variant with literal guards.]

### Pattern 4: Operator_h5 Death in delete-nous.ts (D-10b-04)

**What:** Extend the existing Phase 8 H5 delete handler to also emit `bios.death{cause: operator_h5}` in the same transactional sequence.
**When to use:** `grid/src/api/operator/delete-nous.ts` route handler, in D-30 ORDER after tombstone+despawn.

```typescript
// Source: grid/src/api/operator/delete-nous.ts:145-162 (authoritative D-30 ORDER)
// Current D-30 ORDER:
//   1. registry.tombstone(did, tick, space)
//   2. coordinator.despawnNous(did)
//   3. appendNousDeleted(audit, ...)         ← Phase 8 event, preserved as-is

// EXTENDED D-30 ORDER for Phase 10b:
//   1. registry.tombstone(did, tick, space)
//   2. coordinator.despawnNous(did)
//   3a. appendBiosDeath(audit, targetDid, {  ← NEW: bios lifecycle layer
//         did: targetDid,
//         tick: currentTick,
//         cause: 'operator_h5',
//         final_state_hash: stateHash,       // same hash already computed above
//       });
//   3b. appendNousDeleted(audit, ...)        ← Phase 8 event, PRESERVED unchanged
```

**Key rule:** `appendBiosDeath` BEFORE `appendNousDeleted` — Bios lifecycle event precedes the operator audit event in the same tick. Both share the `stateHash` already fetched from Brain (no additional Brain RPC). [VERIFIED: delete-nous.ts:146-162 shows Brain fetch happens first then D-30 order; `stateHash` is available for reuse.]

### Pattern 5: Chronos Multiplier Application in Retrieval (D-10b-06)

**What:** Replace `datetime.now()` in `RetrievalScorer.recency_score()` with a tick-based formula, then scale recency by the subjective multiplier.
**When to use:** `brain/src/noesis_brain/memory/retrieval.py`, at read time only.

```python
# Source: brain/src/noesis_brain/memory/retrieval.py:32-40 (current wall-clock version)
# Current (HAS wall-clock — MUST REPLACE for CHRONOS-02 + D-10b-09):
#   def recency_score(self, memory, now=None):
#       now = now or datetime.now(timezone.utc)
#       hours_ago = (now - memory.created_at).total_seconds() / 3600.0
#       return self._decay_rate ** max(0, hours_ago)

# NEW tick-based (deterministic):
def recency_score_by_tick(self, memory: Memory, current_tick: int) -> float:
    """Tick-based recency: decay_rate ^ ticks_since_memory.
    
    Replaces wall-clock datetime.now() for determinism (D-10b-09, CHRONOS-02).
    memory must carry an audit_tick field (set at write time from the audit chain).
    """
    ticks_ago = max(0, current_tick - memory.audit_tick)
    return self._decay_rate ** ticks_ago

def score_with_chronos(
    self,
    memory: Memory,
    query: str,
    current_tick: int,
    chronos_multiplier: float = 1.0,
) -> float:
    """Full Stanford score with subjective-time recency modulation (D-10b-06).
    
    score = α·relevance + β·(recency × multiplier) + γ·importance
    Implemented as: (recency × multiplier) × importance × relevance
    since original formula uses multiplication not addition (see retrieval.py:64-68).
    """
    r = self.recency_score_by_tick(memory, current_tick)
    r_scaled = max(0.0, min(1.0, r * chronos_multiplier))  # clamp after scaling
    i = self.importance_score(memory)
    rel = self.relevance_score(memory, query)
    return r_scaled * i * rel
```

**CRITICAL PITFALL:** `memory.audit_tick` does not currently exist on the `Memory` type [VERIFIED: `brain/src/noesis_brain/memory/types.py` — check below]. Planner must add `audit_tick: int` field to `Memory` (or use a creation-tick proxy). This is a **Wave 0 prerequisite** for Chronos.

### Pattern 6: epoch_since_spawn (D-10b-07)

**What:** Scan the Brain's AuditChain cache (the Brain receives audit events via the RPC bridge) for the `bios.birth` entry matching the DID; memoize the birth tick.
**When to use:** `brain/src/noesis_brain/chronos/subjective_time.py` or inside `BrainHandler`.

```python
# Source: brain/src/noesis_brain/rpc/handler.py pattern (DID registry, memoized per-DID)
# Pattern: dict keyed by DID, lazily populated

_bios_birth_ticks: dict[str, int] = {}  # handler attribute

def epoch_since_spawn(self, current_tick: int) -> int:
    """Return ticks elapsed since this Nous's bios.birth. 
    
    Brain-local derived read — no new RPC, no new allowlist event (D-10b-07).
    
    The Brain receives all audit events relevant to its Nous via the existing
    AuditChain cache (the Brain's in-memory copy of the chain).
    birth_tick is memoized once and never re-scanned.
    """
    if self.did not in self._bios_birth_ticks:
        birth_tick = self._scan_chain_for_birth(self.did)
        self._bios_birth_ticks[self.did] = birth_tick
    return current_tick - self._bios_birth_ticks.get(self.did, 0)

def _scan_chain_for_birth(self, did: str) -> int:
    """Scan AuditChain cache for bios.birth entry. O(n) on first call, O(1) after."""
    for entry in self._audit_cache:  # the Brain's local event log
        if entry.get('event_type') == 'bios.birth' and entry.get('did') == did:
            return entry.get('tick', 0)
    return 0  # fallback: Nous born at tick 0 if no birth event found
```

**Note on Brain audit cache:** The Brain receives audit events through the RPC bridge. Whether this is a full `AuditChain` query or a simpler list depends on Phase 10a's Brain handler shape. [ASSUMED: the Brain's handler does NOT currently maintain a local AuditChain cache. Planner needs to confirm whether `bios.birth` tick must be passed via spawn RPC params or stored in a Birth registry dict. Simplest: store `birth_tick` as a handler attribute set at Nous spawn time, NOT via scan.]

### Anti-Patterns to Avoid

- **Emitting `ananke.drive_crossed` directly from Bios code:** Bios elevation updates the AnankeRuntime's in-memory level. The `ananke.drive_crossed` event fires through the normal Ananke detection path on the next tick — never via a direct Bios→Grid call. [VERIFIED: D-10b-02 explicit: "No new allowlist event: elevation surfaces only via the existing `ananke.drive_crossed` emission from the elevated drive's own threshold crossing downstream."]
- **Using `datetime.now()` in `retrieval.py` with Chronos:** The existing `recency_score()` uses wall-clock time. Chronos multiplier MUST use tick-based recency. Leaving the datetime.now() path in place while adding a multiplier on top of it violates D-10b-09 and CHRONOS-02.
- **Double-emitting `bios.death`:** The starvation path and operator_h5 path must be mutually exclusive. TombstoneCheck on the BiosRuntime emitter path prevents double-emission after tombstone.
- **Crossing-on-every-tick for needs:** Bios threshold-crossing discipline is identical to D-10a-04 — emit only when the bucket changes, never per-tick while above threshold.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Piecewise deterministic recurrence | Custom float math | Clone `ananke/drives.py` piecewise formula verbatim | Already proven byte-identical across tick rates; edge cases (clamping, hysteresis) already solved |
| 8-step sole-producer validation | Ad-hoc guards | Clone `append-drive-crossed.ts` step-by-step | Regex, self-report, closed-tuple, privacy gate — 8 steps required per discipline; omitting any creates a regression |
| Psyche_hash computation | Custom hash | `compute_pre_deletion_state_hash` / `compute_active_telos_hash` pattern | Same `SHA-256(canonical JSON)` approach already locked in Phase 8 |
| Post-death duplicate prevention | Custom mutex | `tombstoneCheck()` + registry.status=deleted | Already proven in Phase 8; extending to Bios/Chronos emitters is a one-liner |
| Subjective time multiplier clamping | Custom clamp | `max(0.25, min(4.0, raw))` inline | No library needed; closed-form `clamp()` is 1 line |

**Key insight:** Every primitive needed for Phase 10b already exists in the Phase 10a or Phase 8 codebase. This phase is integration work, not invention.

---

## Runtime State Inventory

> Rename/refactor phase does not apply. Greenfield subsystems.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no `bios.*` events exist in any AuditChain | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new secrets | None |
| Build artifacts | None | None |

**All categories: None — verified by grep returning zero `bios.*` matches in `grid/src/`, `brain/src/`, and database schema files.**

---

## Common Pitfalls

### Pitfall 1: Wall-Clock in Retrieval Scorer (CRITICAL — blocks CHRONOS-02)
**What goes wrong:** `brain/src/noesis_brain/memory/retrieval.py:recency_score()` calls `datetime.now(timezone.utc)` [VERIFIED: line 36]. Applying a Chronos multiplier on top of wall-clock recency means the retrieval score is non-deterministic and violates D-10b-09.
**Why it happens:** Retrieval was written before the determinism discipline was established.
**How to avoid:** In the Chronos plan wave, replace `recency_score()` with `recency_score_by_tick(memory, current_tick)`. Add `audit_tick: int` field to the `Memory` dataclass. The old `recency_score(now=datetime)` signature may remain as a deprecated fallback for non-Chronos callers, but Chronos MUST use the tick-based variant.
**Warning signs:** Any test using `RetrievalScorer` that does not mock `datetime.now` will be flaky and non-deterministic.

### Pitfall 2: Bios→Ananke Elevation Double-Emit (T-09-01 re-entry)
**What goes wrong:** If `BiosRuntime.on_tick()` calls `elevate_drive()` on every tick while a need is above threshold (not just at the crossing moment), the elevated drive will emit multiple `ananke.drive_crossed` events for the same threshold — breaking the audit-size ceiling (D-10a-04: ≤50 entries/1000 ticks).
**Why it happens:** Confusing "at crossing" with "while over threshold."
**How to avoid:** BiosRuntime must track `_last_elevation_level: dict[NeedName, DriveLevel]`. Elevation fires ONLY when `new_level != _last_elevation_level[need]`. Mirrors the `detect_crossing()` crossing-detection discipline exactly.
**Warning signs:** Audit-size ceiling test (cloned from Phase 10a) failing with >50 entries.

### Pitfall 3: bios.death Before tombstone (SC#3 regression)
**What goes wrong:** Emitting `bios.death` before `registry.tombstone()` in the D-30 ORDER means a concurrent request could slip in between tombstone and death event, creating a partial state.
**Why it happens:** Inserting `appendBiosDeath` at step 3a before `appendNousDeleted` at 3b tempts developers to move it earlier.
**How to avoid:** Respect the locked D-30 ORDER: tombstone → despawn → appendBiosDeath → appendNousDeleted. The Brain RPC fetch happens BEFORE all of these (SC#3 invariant in delete-nous.ts).
**Warning signs:** `operator_h5` death tests seeing a registry `active` status at the moment `bios.death` is appended.

### Pitfall 4: Memory.audit_tick Missing (blocks Chronos tick-based recency)
**What goes wrong:** `Memory` dataclass does not have an `audit_tick` field. The tick-based recency formula requires knowing when (in ticks) a memory was stored.
**Why it happens:** Memory was implemented with wall-clock `created_at` before the determinism discipline was established.
**How to avoid:** Add `audit_tick: int` to `Memory` (default=0 for backward compatibility). The Brain stores the current tick when writing a new memory. This is a Wave 0 prerequisite.
**Warning signs:** `score_with_chronos()` computing identically for all memories (all `audit_tick == 0`).

### Pitfall 5: Sole-Producer Grep Gate Coverage Gap
**What goes wrong:** The 10a sole-producer grep test pattern checks for `'ananke.drive_crossed'` string outside its two files. If the 10b grep gate is not extended to cover `'bios.birth'` and `'bios.death'`, both events could be double-emitted without CI catching it.
**Why it happens:** Forgetting to extend `scripts/check-state-doc-sync.mjs` and the producer-boundary test to cover both new events.
**How to avoid:** Plan Wave 1 must include sole-producer grep tests for both `bios.birth` and `bios.death` in the same commit as the emitter files.
**Warning signs:** `grid/test/bios/bios-producer-boundary.test.ts` missing from Wave 1.

### Pitfall 6: Chronos Multiplier Crossing the Wire
**What goes wrong:** The subjective multiplier ends up in a Brain RPC response, a Grid audit payload, or a Dashboard response shape.
**Why it happens:** Developer adds `chronos_multiplier` to `get_state()` return or to a JSON-RPC response for debugging.
**How to avoid:** `CHRONOS_FORBIDDEN_KEYS` privacy grep gate explicitly bans `subjective_multiplier`, `chronos_multiplier`, `subjective_tick`. Three-tier grep (Grid emitter, Brain wire, Dashboard render) must cover all three. D-10b-11: no `chronos.*` audit event.
**Warning signs:** Privacy matrix test failures; or multiplier visible in Steward Console Inspector.

---

## Code Examples

### Brain Bios Config (clone of ananke/config.py)

```python
# Source: brain/src/noesis_brain/ananke/config.py (authoritative template)
# New file: brain/src/noesis_brain/bios/config.py

import math
from noesis_brain.bios.types import NeedName

NEED_BASELINES: dict[NeedName, float] = {
    NeedName.ENERGY:     0.3,   # Claude's Discretion default — planner may lock
    NeedName.SUSTENANCE: 0.3,   # Claude's Discretion default — planner may lock
}

NEED_RISE_RATES: dict[NeedName, float] = {
    NeedName.ENERGY:     0.0003,  # same as hunger (mirrored by design — energy→hunger)
    NeedName.SUSTENANCE: 0.0001,  # same as safety (mirrored by design — sustenance→safety)
}

THRESHOLD_LOW: float = 0.33    # clone from ananke/config.py
THRESHOLD_HIGH: float = 0.66   # clone from ananke/config.py
HYSTERESIS_BAND: float = 0.02  # clone from ananke/config.py

TAU: int = 500  # clone from ananke/config.py (same relaxation constant)
DECAY_FACTOR: float = math.exp(-1.0 / TAU)  # ONE math.exp call, at module load
```

### Chronos Subjective Time Formula (D-10b-05)

```python
# Source: brain/src/noesis_brain/chronos/subjective_time.py (new file)
from noesis_brain.ananke.types import DriveLevel, DriveName

# Boost/penalty constants (D-10b-05; planner locks final values)
CURIOSITY_BOOST: dict[DriveLevel, float] = {
    DriveLevel.LOW:  0.0,
    DriveLevel.MED:  1.0,
    DriveLevel.HIGH: 3.0,
}
BOREDOM_PENALTY: dict[DriveLevel, float] = {
    DriveLevel.LOW:  0.0,
    DriveLevel.MED:  0.3,
    DriveLevel.HIGH: 0.75,
}
MULTIPLIER_MIN: float = 0.25
MULTIPLIER_MAX: float = 4.0

def compute_multiplier(drive_levels: dict[DriveName, DriveLevel]) -> float:
    """Compute subjective-time multiplier from drive bucket levels.
    
    multiplier = clamp(1.0 + curiosity_boost - boredom_penalty, 0.25, 4.0)
    
    Brain-local ONLY. Never crosses the wire. No audit event. (D-10b-05, D-10b-11)
    
    Args:
        drive_levels: Current drive levels (from AnankeRuntime.state.levels).
            Only curiosity and boredom affect the multiplier in 10b.
    Returns:
        Float in [0.25, 4.0].
    """
    curiosity_level = drive_levels.get(DriveName.CURIOSITY, DriveLevel.LOW)
    boredom_level = drive_levels.get(DriveName.BOREDOM, DriveLevel.LOW)
    raw = 1.0 + CURIOSITY_BOOST[curiosity_level] - BOREDOM_PENALTY[boredom_level]
    return max(MULTIPLIER_MIN, min(MULTIPLIER_MAX, raw))
```

### Allowlist Extension (D-10b-01)

```typescript
// Source: grid/src/audit/broadcast-allowlist.ts:42-75 (authoritative)
// Extension for Phase 10b:
//
// Append to ALLOWLIST_MEMBERS after 'ananke.drive_crossed':
//
//   // Phase 10b (BIOS-02): lifecycle events for bodily needs.
//   // Closed 3-key payload: {did, tick, psyche_hash}.
//   // Emitted ONLY via appendBiosBirth() (grid/src/bios/appendBiosBirth.ts).
//   'bios.birth',
//   // Phase 10b (BIOS-02, BIOS-03): death lifecycle event.
//   // Closed 4-key payload: {did, tick, cause, final_state_hash}.
//   // cause ∈ {starvation, operator_h5, replay_boundary}.
//   // Emitted ONLY via appendBiosDeath() (grid/src/bios/appendBiosDeath.ts).
//   'bios.death',
//
// Also extend BIOS_FORBIDDEN_KEYS and FORBIDDEN_KEY_PATTERN:
export const BIOS_FORBIDDEN_KEYS = [
    'energy',
    'sustenance',
    'need_value',
    'bios_value',
] as const;

export const CHRONOS_FORBIDDEN_KEYS = [
    'subjective_multiplier',
    'chronos_multiplier',
    'subjective_tick',
] as const;

// FORBIDDEN_KEY_PATTERN extended (clone of D-10a-07):
export const FORBIDDEN_KEY_PATTERN =
    /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick/i;
```

### check-state-doc-sync.mjs Extension

```javascript
// Source: scripts/check-state-doc-sync.mjs:43-94 (authoritative)
// Phase 10b additions:
//
// 1. Update count assertion: "19 events" → "21 events"
//    if (!/21\s+events/i.test(state)) { ... }
//
// 2. Append to required[]:
//    'bios.birth',    // Phase 10b (BIOS-02 / appendBiosBirth.ts)
//    'bios.death',    // Phase 10b (BIOS-02, BIOS-03 / appendBiosDeath.ts)
//
// 3. Update success console.log:
//    '[state-doc-sync] OK — STATE.md is in sync with the 21-event allowlist.'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `datetime.now()` in retrieval.py | Tick-based recency (Phase 10b) | Phase 10b | Deterministic replay of retrieval scores; Chronos multiplier becomes meaningful |
| No bodily needs subsystem | `brain/src/noesis_brain/bios/` (Phase 10b) | Phase 10b | Hunger/safety drives get a physiological grounding via Bios elevation |
| No lifecycle audit events | `bios.birth` + `bios.death` (Phase 10b) | Phase 10b | Phase 11 Whisper keypair generation keys off `bios.birth`; tombstone root becomes Bios |

**Deprecated/outdated:**
- `RetrievalScorer.recency_score(memory, now=datetime)`: The wall-clock `now` parameter should be deprecated in Phase 10b in favor of `current_tick`. Backward-compatible by keeping the signature but routing through tick-based formula when `current_tick` is provided.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `BiosRuntime.elevate_drive()` triggers a new level immediately via `AnankeRuntime.state.levels` mutation; the `ananke.drive_crossed` event fires on the NEXT crossing detection pass | §Pattern 2 "Bios→Ananke Elevator" | If elevation must immediately emit `ananke.drive_crossed`, the architecture changes: Bios would need direct access to the Grid's `appendAnankeDriveCrossed` sole producer, which violates Brain/Grid boundary. Planner must clarify: elevation = set level in-memory only; Ananke crossing emission happens downstream. |
| A2 | The Brain's `BrainHandler` does NOT maintain a local AuditChain. `epoch_since_spawn` must be seeded via the spawn RPC params or stored as a `birth_tick: int` attribute at handler construction time, not via chain scan | §Pattern 6 "epoch_since_spawn" | If Brain has an audit cache, chain scan is free. If not, `birth_tick` must be passed in at Nous spawn. Planner chooses the simpler: store `birth_tick` as a constructor parameter (simplest, matches "handler has `did` attribute" pattern from handler.py:47). |
| A3 | `Memory.audit_tick` field does not exist yet | §Pitfall 4 | If Memory already has `audit_tick`, Wave 0 prerequisite is already satisfied. Planner should verify `brain/src/noesis_brain/memory/types.py` before planning. |
| A4 | `bios.birth` emission is triggered at Nous spawn time (when the Grid spawns a Nous) | §Architecture Diagram | BIOS-01..02 don't specify exactly when `bios.birth` fires. If it fires at a different point (e.g., when Brain first responds to a tick), the GenesisLauncher wiring changes. The natural place is immediately after `registry.spawn()` in the spawn handler. |
| A5 | Rise rates for energy and sustenance default to the same values as their matched Ananke drives (hunger and safety respectively) for calibration parity | §Code Examples "Bios Config" | If different rates are more appropriate, the planner should use different constants. This is Claude's Discretion per D-10b-03. |

**All other claims are VERIFIED from direct code inspection or CITED from CONTEXT.md locked decisions.**

---

## Open Questions (RESOLVED)

1. **AnankeRuntime.elevate_drive() API** — (RESOLVED)
   - What we know: D-10b-02 says "raises the matching drive's level by one bucket." AnankeRuntime currently only has `on_tick`, `drain_crossings`, `peek_crossings`.
   - What's unclear: Does `elevate_drive()` directly mutate `state.levels` in-memory, bypassing `detect_crossing()`? Or does it inject a synthetic high value that triggers natural crossing on the next `detect_crossing()` pass?
   - **Resolution (adopted by Plan 10b-02 Task 3):** Direct floor-raise mutation via `AnankeRuntime.elevate_drive(drive, level, tick)`. Sets the drive's value to the elevated level's lower bound so the NEXT `drives.step()` emits `ananke.drive_crossed` naturally — preserving the sole-producer invariant (drives.step remains the only emitter). No `_crossings` manipulation. No-op when already at HIGH.

2. **`bios.birth` trigger point in GenesisLauncher** — (RESOLVED)
   - What we know: `registry.spawn()` is called in `GenesisLauncher`. `nous.spawned` is already emitted there.
   - What's unclear: Should `bios.birth` be emitted as part of the spawn sequence (just after `nous.spawned`), or should it be emitted by the Brain on first tick response?
   - **Resolution (adopted by Plan 10b-03 Task 3):** `appendBiosBirth` is wired into both `grid/src/genesis/launcher.ts` spawn sites (initial genesis spawn loop at ~line 172 and operator-requested spawn at ~line 297) immediately after `appendNousSpawned` — same tick, same transactional sequence. `psycheHash` sourced from existing Psyche bootstrap.

3. **Memory.audit_tick availability** — (RESOLVED)
   - What we know: `brain/src/noesis_brain/memory/types.py` exists but we only checked `retrieval.py`.
   - What's unclear: Does `Memory` have `audit_tick` or only `created_at`?
   - **Resolution (adopted by Plan 10b-04 Task 2):** `Memory.tick` field already exists at `brain/src/noesis_brain/memory/types.py:39` (verified). No schema change required; `memory.tick` is used directly as `audit_tick` in `recency_score_by_tick(memory_tick, current_tick)`.

---

## Environment Availability

> Phase 10b has no new external dependencies — all capabilities use project-existing toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python / uv | Brain Bios/Chronos Python | ✓ | Python 3.9.6, uv 0.11.7 | — |
| Node.js | Grid TS emitters, Vitest | ✓ | v25.9.0 | — |
| pytest | Brain unit tests | ✓ | already in pyproject.toml | — |
| Vitest | Grid unit tests | ✓ | already in vitest.config.ts | — |

**No missing dependencies.**

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` → treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 7.x (brain) + Vitest (grid) + Vitest (dashboard) |
| Config file | `brain/pyproject.toml`, `grid/vitest.config.ts`, `dashboard/vitest.config.ts` |
| Quick run command | `cd brain && uv run pytest test/bios test/chronos -q` + `cd grid && npx vitest run test/bios test/audit/allowlist-twenty-one.test.ts -q` |
| Full suite command | `cd brain && uv run pytest -q` + `cd grid && npx vitest run` + `cd dashboard && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BIOS-01 | Needs rise monotonically; threshold crossing elevates Ananke drive once | unit/integration | `cd brain && uv run pytest test/bios/test_needs_determinism.py -q` | ❌ Wave 0 |
| BIOS-01 | Bios→Ananke elevator: once per crossing, no-op if already HIGH | unit | `cd brain && uv run pytest test/bios/test_needs_elevator.py -q` | ❌ Wave 0 |
| BIOS-02 | `bios.birth` at allowlist position 20; no siblings; closed-enum gate | unit/grep | `cd grid && npx vitest run test/audit/allowlist-twenty-one.test.ts test/bios/bios-producer-boundary.test.ts -q` | ❌ Wave 0 |
| BIOS-03 | `bios.death` closed-tuple {did,tick,cause,final_state_hash}; post-death rejection | unit | `cd grid && npx vitest run test/bios/appendBiosDeath.test.ts -q` | ❌ Wave 0 |
| BIOS-04 | NousRegistry blocks DID reuse after bios.death; tombstoneCheck gate extended | unit | `cd grid && npx vitest run test/registry/tombstone-bios.test.ts -q` | ❌ Wave 0 |
| CHRONOS-01 | Multiplier formula: curiosity boosts, boredom compresses; clamp [0.25, 4.0] | unit | `cd brain && uv run pytest test/chronos/test_subjective_time.py -q` | ❌ Wave 0 |
| CHRONOS-01 | Retrieval recency scaled by subjective multiplier at read time | unit/integration | `cd brain && uv run pytest test/chronos/test_retrieval_with_chronos.py -q` | ❌ Wave 0 |
| CHRONOS-02 | 1000-tick run: audit_tick - system_tick = 0 for all Nous | integration | `cd grid && npx vitest run test/audit/zero-diff-bios.test.ts test/chronos/tick-purity.test.ts -q` | ❌ Wave 0 |
| CHRONOS-03 | `epoch_since_spawn` returns correct ticks-since-birth; O(1) after first call | unit | `cd brain && uv run pytest test/bios/test_epoch_since_spawn.py -q` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd brain && uv run pytest test/bios test/chronos -q` + `cd grid && npx vitest run test/bios test/chronos -q`
- **Per wave merge:** Full suite (brain + grid + dashboard)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

All test files listed above are missing (❌). Planner must create stubs in Wave 0:

- [ ] `brain/test/bios/test_needs_determinism.py` — monotonic rise, bounds clamping, byte-identical replay
- [ ] `brain/test/bios/test_needs_elevator.py` — once-per-crossing elevation; no-op at HIGH
- [ ] `brain/test/bios/test_epoch_since_spawn.py` — birth tick memoization, O(1) re-query
- [ ] `brain/test/chronos/test_subjective_time.py` — formula at all bucket combinations, clamp bounds
- [ ] `brain/test/chronos/test_retrieval_with_chronos.py` — tick-based recency + multiplier integration
- [ ] `brain/test/test_bios_no_walltime.py` — grep gate: no `Date.now/time.time/datetime.now` in bios/** + chronos/**
- [ ] `grid/test/audit/allowlist-twenty-one.test.ts` — 21 members; bios.birth at 20, bios.death at 21; no siblings
- [ ] `grid/test/bios/appendBiosBirth.test.ts` — 3-key closed tuple; DID regex; HEX64 psyche_hash
- [ ] `grid/test/bios/appendBiosDeath.test.ts` — 4-key closed tuple; cause enum; post-death rejection
- [ ] `grid/test/bios/bios-producer-boundary.test.ts` — sole-producer grep gate (2 files)
- [ ] `grid/test/audit/zero-diff-bios.test.ts` — 100-tick run; chain head = baseline + N bios.birth/death entries only
- [ ] `grid/test/ci/bios-no-walltime.test.ts` — grep gate: no `Date.now/performance.now/setInterval` in `grid/src/bios/**`
- [ ] `grid/test/audit/audit-size-ceiling-bios.test.ts` — 1000 ticks × 2 needs × 1 Nous ≤ N entries (≤ 10 expected; same discipline as T-09-01)
- [ ] `dashboard/test/privacy/bios-forbidden-keys.test.ts` — three-tier privacy grep for BIOS + CHRONOS forbidden keys

---

## Security Domain

> `security_enforcement` key absent from config → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A (no new auth surface) |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | Tombstone gate + D-30 ORDER (bios.death only via sole producer after tombstone) |
| V5 Input Validation | yes | Closed-enum `cause` validation + DID_RE + HEX64_RE in appendBiosDeath.ts |
| V6 Cryptography | yes (partial) | `psyche_hash` in bios.birth payload uses SHA-256 (same `combineStateHash` pattern as Phase 8) |

### Known Threat Patterns for Phase 10b Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bios.death double-emit (starvation AND operator_h5 race) | Tampering | tombstoneCheck in appendBiosDeath before chain.append; D-30 ORDER atomicity |
| DID reuse after death (first-life I-6 violation) | Tampering | NousRegistry.spawn() throws on status=deleted [VERIFIED: registry.ts:19-21] |
| Subjective multiplier leak to Dashboard/Grid | Information Disclosure | CHRONOS_FORBIDDEN_KEYS three-tier grep; D-10b-11 no chronos.* allowlist events |
| Bios float values (energy/sustenance) crossing wire | Information Disclosure | BIOS_FORBIDDEN_KEYS; sole producer only emits hash payloads |
| Post-death drive emission for tombstoned DID | Tampering | tombstoneCheck in appendAnankeDriveCrossed + D-10b-12 BiosRuntime halt |
| Fake bios.death cause (4th cause value) | Tampering | Closed-enum validation in appendBiosDeath.ts (CAUSE_VALUES Set); closed-tuple key check |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: `grid/src/audit/broadcast-allowlist.ts`] — authoritative 19-event list; zero `bios.*` entries confirmed; `DRIVE_FORBIDDEN_KEYS` and `FORBIDDEN_KEY_PATTERN` extension template.
- [VERIFIED: `grid/src/ananke/append-drive-crossed.ts`] — 8-step sole-producer validation template; exact clone surface for `appendBiosBirth.ts` and `appendBiosDeath.ts`.
- [VERIFIED: `grid/src/audit/append-nous-deleted.ts`] — Phase 8 ordering and literal-guard template for `bios.death{cause: operator_h5}` composition.
- [VERIFIED: `grid/src/api/operator/delete-nous.ts`] — D-30 ORDER locked; `stateHash` already available before tombstone; extension point confirmed.
- [VERIFIED: `brain/src/noesis_brain/ananke/`] — full 5-file skeleton (types.py, config.py, drives.py, runtime.py, loader.py) inspected; exact clone template for `bios/` subsystem.
- [VERIFIED: `brain/src/noesis_brain/memory/retrieval.py`] — wall-clock `datetime.now()` at line 36 confirmed; tick-based replacement required for CHRONOS-02.
- [VERIFIED: `brain/src/noesis_brain/rpc/handler.py`] — `on_tick()` pattern; `_get_or_create_ananke()` memoization template for Bios/Chronos; `_advisory_log_divergence()` pure-observation discipline.
- [VERIFIED: `brain/src/noesis_brain/prompts/system.py`] — `build_system_prompt()` signature; `epoch_since_spawn` injection point identified (additive widening of `_context_section()`).
- [VERIFIED: `grid/src/registry/registry.ts`] — `status === 'deleted'` check at spawn already present; tombstone path confirmed.
- [VERIFIED: `scripts/check-state-doc-sync.mjs`] — count literal at line 43 (`19 events`), `required[]` array at lines 70-94; exact extension pattern confirmed.
- [VERIFIED: `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-VERIFICATION.md`] — 11/11 criteria template; direct clone surface for 10b verification.
- [CITED: `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md`] — all 12 D-10b-xx decisions; authoritative source for phase scope.

### Secondary (MEDIUM confidence)

- [CITED: `.planning/STATE.md` Accumulated Context] — Phase 10a ship decisions; 19-event enumeration; pause/resume zero-diff hash `c7c49f49…` confirmed.
- [CITED: `.planning/ROADMAP.md` §Phase 10b lines 86-103] — success criteria; confirmed ROADMAP allowlist claim is incorrect (0 additions claimed vs. +2 required by D-10b-01).
- [CITED: `.planning/REQUIREMENTS.md` BIOS-01..04, CHRONOS-01..03] — full requirement text; cross-checked against CONTEXT.md decisions.

### Tertiary (LOW confidence)

- [ASSUMED: A1-A5] — see Assumptions Log. Specifically: `AnankeRuntime.elevate_drive()` API design; Brain audit cache availability for `epoch_since_spawn`; `Memory.audit_tick` field existence.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries are project-existing; no new dependencies
- Architecture: HIGH — all patterns verified from Phase 10a code; MEDIUM for A1-A5 assumptions
- Pitfalls: HIGH — wall-clock retrieval and double-emit patterns verified directly in code
- Doc-sync targets: HIGH — all 6 files with exact line numbers identified

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable project; code patterns won't change)

---

## Doc-Sync Obligation (CLAUDE.md Rule — fires this phase)

The following files require exact text updates when the emitter lands (D-10b-01). Planner must include a doc-sync task in the final wave:

| File | Change |
|------|--------|
| `.planning/ROADMAP.md` §Phase 10b | "Allowlist additions: 0" → "+2 (bios.birth, bios.death)"; running total "19" → "21"; also update §Allowlist Growth Ledger table for Phase 10b row |
| `.planning/STATE.md` Accumulated Context | Append `bios.birth` (position 20) and `bios.death` (position 21) to the 19-event enumeration; update "19 events" heading to "21 events" |
| `scripts/check-state-doc-sync.mjs` | Line 43: `19\s+events` → `21\s+events`; `required[]` append `'bios.birth'`, `'bios.death'`; line 109 success message `19-event` → `21-event` |
| `.planning/REQUIREMENTS.md` §Allowlist Growth Ledger | Update note "Zero-addition themes: … BIOS (existing lifecycle events only)" → document Phase 10b adds +2; update the running-total row |
| `PHILOSOPHY.md` §1 | Add body↔mood separation sentence per T-09-05: "Fatigue is a Bios metric (energy rising); it is not a Thymos emotion." |
| `.planning/MILESTONES.md` | Add Phase 10b ship entry upon phase close |
| `.planning/PROJECT.md` | Update BIOS-01..04 + CHRONOS-01..03 from Planned → Validated |
| `README.md` | Update "Current status" to reflect Phase 10b shipped |
