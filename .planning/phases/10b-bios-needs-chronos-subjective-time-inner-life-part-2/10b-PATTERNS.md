# Phase 10b: Bios Needs + Chronos Subjective Time (Inner Life, part 2) — Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 28 new + 4 modified
**Analogs found:** 28 / 28 (100% — Phase 10b is a disciplined clone of Phase 10a; every pattern exists)

---

## File Classification

### Brain (Python) — new module `brain/src/noesis_brain/bios/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `brain/src/noesis_brain/bios/__init__.py` | package init / public API | re-export | `brain/src/noesis_brain/ananke/__init__.py` | exact |
| `brain/src/noesis_brain/bios/types.py` | enums + dataclasses (NeedName, NeedState, NeedCrossing) | pure-value | `brain/src/noesis_brain/ananke/types.py` | exact |
| `brain/src/noesis_brain/bios/config.py` | NEED_BASELINES, NEED_RISE_RATES, DECAY_FACTOR, thresholds | pure-value | `brain/src/noesis_brain/ananke/config.py` | exact |
| `brain/src/noesis_brain/bios/needs.py` | `step()`, `bucket()`, `detect_crossing()`, `initial_state()` | deterministic transform | `brain/src/noesis_brain/ananke/drives.py` | exact |
| `brain/src/noesis_brain/bios/runtime.py` | `BiosRuntime`: `on_tick()`, `drain_crossings()`, `drain_death()` | tick-driven state machine | `brain/src/noesis_brain/ananke/runtime.py` | role-match (adds death-pending + elevator) |
| `brain/src/noesis_brain/bios/loader.py` | `BiosLoader.build(*, seed, birth_tick)` factory | file-I/O → object graph | `brain/src/noesis_brain/ananke/loader.py` | exact |

### Brain (Python) — new module `brain/src/noesis_brain/chronos/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `brain/src/noesis_brain/chronos/__init__.py` | package init | re-export | `brain/src/noesis_brain/ananke/__init__.py` | exact |
| `brain/src/noesis_brain/chronos/types.py` | `ChronosState(multiplier, birth_tick)` | pure-value | `brain/src/noesis_brain/ananke/types.py` | role-match |
| `brain/src/noesis_brain/chronos/subjective_time.py` | `compute_multiplier(drive_levels)`, `tick_recency(memory, tick, decay_rate)` | deterministic transform | `brain/src/noesis_brain/ananke/drives.py` (math pattern) | role-match |

### Brain (Python) — modified

| Modified File | Role | Change | Analog |
|---|---|---|---|
| `brain/src/noesis_brain/rpc/handler.py` | BrainHandler tick integration | add `_get_or_create_bios()`, `_bios_runtimes`, `birth_tick` attribute; on_tick calls BiosRuntime; starvation → BIOS_DEATH action | `_get_or_create_ananke()` (handler.py:228-241) |
| `brain/src/noesis_brain/memory/retrieval.py` | RetrievalScorer | add `recency_score_by_tick(memory, current_tick)` + `score_with_chronos(...)` | `recency_score()` (retrieval.py:32-40) |
| `brain/src/noesis_brain/memory/types.py` | Memory dataclass | add `audit_tick: int = 0` field (Wave 0 prerequisite) | `Memory.tick` field (types.py:39) |
| `brain/src/noesis_brain/prompts/system.py` | build_system_prompt | widen `_context_section()` to accept `epoch_since_spawn: int`; inject "You are {N} ticks old" | `_context_section(location)` (system.py:57-59) |

### Brain (Python) tests — new directories `brain/test/bios/` and `brain/test/chronos/`

| New Test File | Role | Closest Analog |
|---|---|---|
| `brain/test/bios/__init__.py` | test-pkg marker | `brain/test/__init__.py` |
| `brain/test/bios/test_needs_determinism.py` | monotonic rise, clamping, byte-identical replay | `brain/test/ananke/test_determinism.py` |
| `brain/test/bios/test_needs_elevator.py` | once-per-crossing elevation; no-op at HIGH | `brain/test/ananke/test_level_bucketing.py` |
| `brain/test/bios/test_epoch_since_spawn.py` | birth_tick memoization, O(1) re-query | `brain/test/ananke/test_closed_enum.py` (pattern) |
| `brain/test/chronos/test_subjective_time.py` | formula at all bucket combinations, clamp bounds | `brain/test/ananke/test_monotonic_rise.py` |
| `brain/test/chronos/test_retrieval_with_chronos.py` | tick-based recency + multiplier integration | `brain/test/ananke/test_drive_crossed_action.py` |
| `brain/test/test_bios_no_walltime.py` | grep gate: no wall-clock in bios/** + chronos/** | `brain/test/ananke/test_determinism.py` grep-gate portion |

### Grid (TypeScript) — new module `grid/src/bios/`

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/bios/types.ts` | `BiosBirthPayload`, `BiosDeathPayload`, `BIOS_CAUSE_VALUES` | value-only | `grid/src/ananke/types.ts` | exact |
| `grid/src/bios/appendBiosBirth.ts` | SOLE producer for `bios.birth` (3-key closed tuple) | request-response (audit append) | `grid/src/ananke/append-drive-crossed.ts` | **exact** (primary template) |
| `grid/src/bios/appendBiosDeath.ts` | SOLE producer for `bios.death` (4-key closed tuple) | request-response (audit append) | `grid/src/ananke/append-drive-crossed.ts` + `grid/src/audit/append-nous-deleted.ts` | **exact** |
| `grid/src/bios/index.ts` | barrel export | — | `grid/src/ananke/index.ts` |

### Grid (TypeScript) — modified

| Modified File | Change | Analog Section |
|---|---|---|
| `grid/src/audit/broadcast-allowlist.ts` | append `bios.birth` (pos 20) + `bios.death` (pos 21); extend `FORBIDDEN_KEY_PATTERN` with BIOS + CHRONOS forbidden keys; add `BIOS_FORBIDDEN_KEYS` + `CHRONOS_FORBIDDEN_KEYS` exports | this file itself, lines 42-75, 110-127 |
| `grid/src/api/operator/delete-nous.ts` | D-30 ORDER extended: step 6c split → 6c `appendBiosDeath({cause: 'operator_h5'})` + 6d `appendNousDeleted(...)` | this file itself, lines 145-162 |
| `grid/src/genesis/launcher.ts` | emit `appendBiosBirth` immediately after `audit.append('nous.spawned', ...)` in `spawnNous()` | this file itself, lines 172, 297 |

### Grid (TypeScript) tests — new

| New Test File | Role | Analog |
|---|---|---|
| `grid/test/audit/allowlist-twenty-one.test.ts` | pin frozen 21-tuple; bios.birth at pos 20, bios.death at pos 21 | `grid/test/ananke/allowlist-nineteen.test.ts` (verbatim, extend) |
| `grid/test/bios/appendBiosBirth.test.ts` | 3-key closed tuple; DID_RE; HEX64_RE psyche_hash | `grid/test/ananke/append-drive-crossed-closed-tuple.test.ts` |
| `grid/test/bios/appendBiosDeath.test.ts` | 4-key closed tuple; cause enum; post-death rejection | `grid/test/ananke/append-drive-crossed-closed-tuple.test.ts` + `grid/test/audit/nous-deleted-privacy.test.ts` |
| `grid/test/bios/bios-producer-boundary.test.ts` | sole-producer grep gate (2 files) | `grid/test/ananke/drive-crossed-producer-boundary.test.ts` (verbatim, swap strings) |
| `grid/test/audit/zero-diff-bios.test.ts` | 100-tick run; audit_tick - system_tick = 0 for all Nous | `grid/test/ananke/determinism-source.test.ts` (structure) |
| `grid/test/ci/bios-no-walltime.test.ts` | grep gate: no Date.now/performance.now in `grid/src/bios/**` | `grid/test/ananke/determinism-source.test.ts` (verbatim, swap path) |
| `grid/test/audit/audit-size-ceiling-bios.test.ts` | 1000 ticks × 2 needs × 1 Nous ≤ N entries | `grid/test/ananke/audit-ceiling.test.ts` (swap 5 drives → 2 needs) |

### Dashboard (TypeScript/TSX) — new

| New File | Role | Data Flow | Analog | Match Quality |
|---|---|---|---|---|
| `dashboard/src/app/grid/components/inspector-sections/bios.tsx` | BiosSection — 2 need rows × level glyphs | read-only projection from firehose | `dashboard/src/app/grid/components/inspector-sections/ananke.tsx` | **exact** (primary template) |
| `dashboard/src/app/grid/components/inspector-sections/bios.test.tsx` | 18-case aria matrix + baseline-first-paint + transition + no-numeric | Vitest + testing-library | `dashboard/src/app/grid/components/inspector-sections/ananke.test.tsx` | exact |
| `dashboard/src/lib/hooks/use-bios-levels.ts` | derived selector over `useFirehose()` filtering `ananke.drive_crossed` for hunger/safety | firehose read + useMemo | `dashboard/src/lib/hooks/use-ananke-levels.ts` | **exact** |
| `dashboard/src/lib/protocol/bios-types.ts` | SYNC mirror: `NeedName`, `NEED_ORDER`, `NEED_GLYPH`, `NEED_TO_DRIVE`, `NEED_BASELINE_LEVEL` | value-only | `dashboard/src/lib/protocol/ananke-types.ts` | exact |
| `dashboard/test/lib/bios-types.drift.test.ts` | fs-parse Brain `bios/config.py` → assert bucketed mirror matches | fs + regex | `dashboard/test/lib/ananke-types.drift.test.ts` | exact |
| `dashboard/test/privacy/bios-forbidden-keys-dashboard.test.tsx` | three-tier privacy grep for BIOS + CHRONOS forbidden keys | grep | `grid/test/privacy/drive-forbidden-keys.test.ts` | exact |

### Dashboard — modified

| Modified File | Change |
|---|---|
| `dashboard/src/app/grid/components/inspector.tsx` | one JSX line added in Overview tabpanel, between `<AnankeSection>` and `<TelosSection>`: `<BiosSection did={selectedDid} />` |

---

## Pattern Assignments

### `brain/src/noesis_brain/bios/types.py` (enum + dataclass module)

**Analog:** `brain/src/noesis_brain/ananke/types.py` (lines 1-88) — verbatim clone, rename DriveName→NeedName.

**Imports + enum pattern** (ananke/types.py:1-26):

```python
"""Ananke types — closed 5-drive enum, bucketed levels, crossing event."""

from __future__ import annotations
from dataclasses import dataclass
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

class Direction(str, Enum):
    RISING = "rising"
    FALLING = "falling"
```

**Apply to Bios:** `NeedName(str, Enum)` with exactly 2 members (`ENERGY = "energy"`, `SUSTENANCE = "sustenance"`). `DriveLevel` and `Direction` are **imported from `noesis_brain.ananke.types`** (not duplicated — Bios elevation maps onto the same bucket vocabulary). `NeedState` mirrors `DriveState` exactly (frozen dataclass with `values: dict[NeedName, float]` + `levels: dict[NeedName, DriveLevel]`). `NeedCrossing` mirrors `CrossingEvent` exactly.

---

### `brain/src/noesis_brain/bios/config.py` (constants module)

**Analog:** `brain/src/noesis_brain/ananke/config.py` (lines 1-49) — verbatim clone, rename identifiers.

**Full template** (ananke/config.py:1-49):

```python
"""Ananke configuration — per-drive baselines, rise rates, thresholds."""
from __future__ import annotations
import math
from noesis_brain.ananke.types import DriveName

DRIVE_BASELINES: dict[DriveName, float] = {
    DriveName.HUNGER: 0.3,
    DriveName.CURIOSITY: 0.5,
    DriveName.SAFETY: 0.2,
    DriveName.BOREDOM: 0.4,
    DriveName.LONELINESS: 0.4,
}
DRIVE_RISE_RATES: dict[DriveName, float] = {
    DriveName.HUNGER: 0.0003,
    ...
}
THRESHOLD_LOW: float = 0.33
THRESHOLD_HIGH: float = 0.66
HYSTERESIS_BAND: float = 0.02
TAU: int = 500
DECAY_FACTOR: float = math.exp(-1.0 / TAU)  # ONE call at module load
```

**Apply to Bios:**

```python
from noesis_brain.bios.types import NeedName

NEED_BASELINES: dict[NeedName, float] = {
    NeedName.ENERGY:     0.3,   # D-10b-03 default (planner locks)
    NeedName.SUSTENANCE: 0.3,
}
NEED_RISE_RATES: dict[NeedName, float] = {
    NeedName.ENERGY:     0.0003,   # mirrors hunger rise rate (D-10b-03 + A5)
    NeedName.SUSTENANCE: 0.0001,   # mirrors safety rise rate
}
THRESHOLD_LOW: float = 0.33    # clone verbatim
THRESHOLD_HIGH: float = 0.66
HYSTERESIS_BAND: float = 0.02
TAU: int = 500
DECAY_FACTOR: float = math.exp(-1.0 / TAU)
```

Critical: `math.exp` MUST appear only here, never in `needs.py` hot path.

---

### `brain/src/noesis_brain/bios/needs.py` (pure update functions)

**Analog:** `brain/src/noesis_brain/ananke/drives.py` (lines 1-157) — verbatim clone, rename `DriveName`→`NeedName`, `DRIVE_*`→`NEED_*`.

**Core `step()` function** (drives.py:35-71):

```python
def step(state: DriveState, seed: int, tick: int) -> DriveState:
    """Pure, deterministic per-tick update (D-10a-01 / D-10b-03 mirrors)."""
    del seed, tick  # reserved; signature locked
    new_values: dict[DriveName, float] = {}
    for drive in DRIVE_NAMES:
        prev = state.values[drive]
        baseline = DRIVE_BASELINES[drive]
        if prev < baseline:
            nxt = baseline + (prev - baseline) * DECAY_FACTOR
        else:
            nxt = prev + DRIVE_RISE_RATES[drive]
        new_values[drive] = max(0.0, min(1.0, nxt))
    new_levels = {d: state.levels[d] for d in DRIVE_NAMES}
    return DriveState(values=new_values, levels=new_levels)
```

**`detect_crossing()` function** (drives.py:113-142) — clone verbatim. The crossing-only discipline (D-10b-02 clones D-10a-04) is baked into `detect_crossing`: emit a `NeedCrossing` ONLY when `new_level != old_level`.

**`bucket()` function** (drives.py:74-110) — clone verbatim. Hysteresis guard logic is identical.

**`initial_state()` function** (drives.py:145-157) — clone; returns `NeedState` with both needs at their baseline, bucketed from `DriveLevel.LOW`.

**Starvation detection** (new, no analog — pure addition):

```python
def is_terminal(state: NeedState) -> bool:
    """Return True if any need has reached 1.0 — starvation trigger (D-10b-04)."""
    return any(v >= 1.0 for v in state.values.values())
```

---

### `brain/src/noesis_brain/bios/runtime.py` (tick state machine)

**Analog:** `brain/src/noesis_brain/ananke/runtime.py` (lines 1-76) — clone with two additions: Bios→Ananke one-shot elevator + starvation death signal.

**AnankeRuntime structure to clone** (runtime.py:17-76):

```python
@dataclass
class AnankeRuntime:
    seed: int
    state: DriveState = field(default_factory=initial_state)
    _crossings: list[CrossingEvent] = field(default_factory=list)

    def on_tick(self, tick: int) -> None:
        stepped = step(self.state, self.seed, tick)
        self.state, new_crossings = detect_crossing(stepped)
        if new_crossings:
            self._crossings.extend(new_crossings)

    def drain_crossings(self) -> list[CrossingEvent]:
        out = self._crossings
        self._crossings = []
        return out
```

**BiosRuntime additions on top of the clone:**

```python
@dataclass
class BiosRuntime:
    seed: int
    birth_tick: int               # passed from spawner (D-10b-07, A2)
    state: NeedState = field(default_factory=initial_state)
    _crossings: list[NeedCrossing] = field(default_factory=list)
    _death_pending: bool = False

    def on_tick(self, tick: int, ananke_runtime: AnankeRuntime) -> None:
        stepped = step(self.state, self.seed, tick)
        self.state, new_crossings = detect_crossing(stepped)
        if new_crossings:
            self._crossings.extend(new_crossings)
            for crossing in new_crossings:
                drive = NEED_TO_DRIVE.get(crossing.need)
                if drive is not None:
                    ananke_runtime.elevate_drive(drive)  # D-10b-02: new method
        if is_terminal(self.state):
            self._death_pending = True

    def drain_crossings(self) -> list[NeedCrossing]: ...  # same as Ananke

    def drain_death(self) -> bool:
        """Return and clear the pending-death flag. True = starvation emit."""
        out = self._death_pending
        self._death_pending = False
        return out

    def epoch_since_spawn(self, current_tick: int) -> int:
        return current_tick - self.birth_tick
```

**`AnankeRuntime.elevate_drive()` — new method on the existing `AnankeRuntime`:**

```python
def elevate_drive(self, drive: DriveName) -> None:
    """Raise drive level by one bucket (LOW→MED or MED→HIGH); no-op at HIGH.

    Direct in-memory mutation — does NOT append to _crossings, does NOT emit
    audit. The elevated level is picked up by detect_crossing on the NEXT
    on_tick() call, which then emits ananke.drive_crossed normally (D-10b-02).
    """
    current = self.state.levels[drive]
    if current == DriveLevel.LOW:
        new_levels = {**self.state.levels, drive: DriveLevel.MED}
        self.state = DriveState(values=self.state.values, levels=new_levels)
    elif current == DriveLevel.MED:
        new_levels = {**self.state.levels, drive: DriveLevel.HIGH}
        self.state = DriveState(values=self.state.values, levels=new_levels)
    # HIGH: no-op
```

---

### `brain/src/noesis_brain/bios/loader.py` (factory)

**Analog:** `brain/src/noesis_brain/ananke/loader.py` (lines 1-49) — exact clone.

```python
@dataclass
class AnankeLoader:
    def build(self, *, seed: int) -> AnankeRuntime:
        return AnankeRuntime(seed=seed)
```

**Apply to Bios:**

```python
@dataclass
class BiosLoader:
    def build(self, *, seed: int, birth_tick: int) -> BiosRuntime:
        return BiosRuntime(seed=seed, birth_tick=birth_tick)
```

---

### `brain/src/noesis_brain/chronos/subjective_time.py` (pure transform)

**Analog:** `brain/src/noesis_brain/ananke/drives.py` — math-only module shape. No direct behavioral analog; formula from RESEARCH.md §Pattern 5.

**Pattern from RESEARCH.md §Code Examples (D-10b-05):**

```python
from noesis_brain.ananke.types import DriveLevel, DriveName

CURIOSITY_BOOST: dict[DriveLevel, float] = {
    DriveLevel.LOW: 0.0, DriveLevel.MED: 1.0, DriveLevel.HIGH: 3.0,
}
BOREDOM_PENALTY: dict[DriveLevel, float] = {
    DriveLevel.LOW: 0.0, DriveLevel.MED: 0.3, DriveLevel.HIGH: 0.75,
}
MULTIPLIER_MIN: float = 0.25
MULTIPLIER_MAX: float = 4.0

def compute_multiplier(drive_levels: dict[DriveName, DriveLevel]) -> float:
    """Brain-local ONLY. Never crosses wire. No audit event (D-10b-05, D-10b-11)."""
    curiosity_level = drive_levels.get(DriveName.CURIOSITY, DriveLevel.LOW)
    boredom_level = drive_levels.get(DriveName.BOREDOM, DriveLevel.LOW)
    raw = 1.0 + CURIOSITY_BOOST[curiosity_level] - BOREDOM_PENALTY[boredom_level]
    return max(MULTIPLIER_MIN, min(MULTIPLIER_MAX, raw))

def tick_recency(memory_audit_tick: int, current_tick: int, decay_rate: float = 0.99) -> float:
    """Tick-based recency (replaces datetime.now for determinism, CHRONOS-02)."""
    ticks_ago = max(0, current_tick - memory_audit_tick)
    return decay_rate ** ticks_ago
```

---

### `brain/src/noesis_brain/memory/retrieval.py` (modified — wall-clock replacement)

**Analog:** `retrieval.py` itself, lines 32-40 — the existing `recency_score()` is the mutation target.

**Current (wall-clock, MUST REPLACE)** (retrieval.py:32-40):

```python
def recency_score(self, memory: Memory, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)  # ← wall-clock violation (D-10b-09)
    mem_time = memory.created_at
    if mem_time.tzinfo is None:
        mem_time = mem_time.replace(tzinfo=timezone.utc)
    hours_ago = (now - mem_time).total_seconds() / 3600.0
    return self._decay_rate ** max(0, hours_ago)
```

**New methods to add:**

```python
def recency_score_by_tick(self, memory: Memory, current_tick: int) -> float:
    """Tick-based recency — replaces wall-clock for Chronos (D-10b-09, CHRONOS-02)."""
    ticks_ago = max(0, current_tick - memory.audit_tick)
    return self._decay_rate ** ticks_ago

def score_with_chronos(
    self,
    memory: Memory,
    query: str,
    current_tick: int,
    chronos_multiplier: float = 1.0,
) -> float:
    """Full Stanford score with subjective-time recency modulation (D-10b-06)."""
    r = self.recency_score_by_tick(memory, current_tick)
    r_scaled = max(0.0, min(1.0, r * chronos_multiplier))
    i = self.importance_score(memory)
    rel = self.relevance_score(memory, query)
    return r_scaled * i * rel
```

**Wave 0 prerequisite:** `memory.audit_tick` does not exist on `Memory` dataclass. Add to `brain/src/noesis_brain/memory/types.py`:

```python
# Current Memory dataclass (types.py:31-53):
tick: int = 0  # Grid tick when it happened — already present!
```

`Memory.tick` (line 39) already carries the Grid tick at write time. The `audit_tick` for Chronos can alias `memory.tick` — confirm with planner. If so, `memory.audit_tick` → `memory.tick` directly, no new field needed.

---

### `brain/src/noesis_brain/rpc/handler.py` (modified — Bios integration)

**Analog:** `handler.py:228-241` (`_get_or_create_ananke`) — clone for Bios.

**Pattern to clone** (handler.py:228-241):

```python
def _get_or_create_ananke(self, did: str) -> AnankeRuntime:
    if did not in self._ananke_runtimes:
        seed = int.from_bytes(
            hashlib.sha256(did.encode("utf-8")).digest()[:8], "big"
        )
        self._ananke_runtimes[did] = self._ananke_loader.build(seed=seed)
    return self._ananke_runtimes[did]
```

**Apply to Bios** (adds `birth_tick` parameter per A2 resolution):

```python
def _get_or_create_bios(self, did: str, birth_tick: int = 0) -> BiosRuntime:
    if did not in self._bios_runtimes:
        seed = int.from_bytes(
            hashlib.sha256(did.encode("utf-8")).digest()[:8], "big"
        )
        self._bios_runtimes[did] = self._bios_loader.build(
            seed=seed, birth_tick=birth_tick
        )
    return self._bios_runtimes[did]
```

**On-tick Chronos integration pattern** — from handler.py:156-164 (Ananke tick block):

```python
runtime = self._get_or_create_ananke(self.did)
runtime.on_tick(tick)
for xing in runtime.drain_crossings():
    actions.append(Action(action_type=ActionType.DRIVE_CROSSED, ...))
```

**Bios tick block (new, same rhythm):**

```python
bios = self._get_or_create_bios(self.did, birth_tick=self._birth_tick)
ananke = self._get_or_create_ananke(self.did)
bios.on_tick(tick, ananke)          # elevates Ananke level in-memory
if bios.drain_death():
    actions.append(Action(action_type=ActionType.BIOS_DEATH, ...))
```

**Chronos multiplier + prompt injection:**

```python
multiplier = compute_multiplier(ananke.state.levels)
epoch = bios.epoch_since_spawn(tick)
# inject into build_system_prompt context
```

---

### `brain/src/noesis_brain/prompts/system.py` (modified — epoch injection)

**Analog:** `system.py:57-59` (`_context_section`) — additive widening.

**Current** (system.py:57-59):

```python
def _context_section(location: str) -> str:
    return f"""## Current Context
- Location: {location}"""
```

**Extended** (additive widening, no callers broken if `epoch_since_spawn` defaults to `None`):

```python
def _context_section(location: str, epoch_since_spawn: int | None = None) -> str:
    lines = [f"- Location: {location}"]
    if epoch_since_spawn is not None:
        lines.append(f"- You are {epoch_since_spawn} ticks old")
    return "## Current Context\n" + "\n".join(lines)
```

---

### `grid/src/bios/appendBiosBirth.ts` (SOLE producer for `bios.birth`)

**Analog:** `grid/src/ananke/append-drive-crossed.ts` (lines 1-134) — **primary template, clone line-for-line.**

**Full 8-step pattern** (append-drive-crossed.ts:59-133):

```typescript
export function appendAnankeDriveCrossed(
    audit: AuditChain,
    actorDid: string,
    payload: AnankeDriveCrossedPayload,
): AuditEntry {
    // 1. DID_RE guards on actorDid + payload.did
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) { throw ... }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) { throw ... }
    // 2. Self-report invariant
    if (payload.did !== actorDid) { throw ... }
    // 3. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) { throw ... }
    // 4. Closed-enum gates (drive / level / direction)
    if (!DRIVE_NAME_SET.has(payload.drive)) { throw ... }
    // 5. Closed-tuple: Object.keys(payload).sort() === EXPECTED_KEYS
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length || !actualKeys.every(...)) { throw ... }
    // 6. Explicit reconstruction (no spread)
    const cleanPayload = { did: payload.did, tick: payload.tick, ... };
    // 7. payloadPrivacyCheck belt-and-suspenders
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) { throw ... }
    // 8. audit.append('ananke.drive_crossed', actorDid, cleanPayload)
    return audit.append('ananke.drive_crossed', actorDid, cleanPayload);
}
```

**Apply to `appendBiosBirth`:**

- `EXPECTED_BIRTH_KEYS = ['did', 'psyche_hash', 'tick'] as const` (3 keys, alphabetical)
- Step 4 variant: `HEX64_RE` guard on `payload.psyche_hash` (same regex from `append-nous-deleted.ts:26`)
- `cleanPayload = { did: payload.did, tick: payload.tick, psyche_hash: payload.psyche_hash }`
- `audit.append('bios.birth', actorDid, cleanPayload)`

**`HEX64_RE` pattern** (append-nous-deleted.ts:26):

```typescript
export const HEX64_RE = /^[0-9a-f]{64}$/;
```

---

### `grid/src/bios/appendBiosDeath.ts` (SOLE producer for `bios.death`)

**Analog:** `grid/src/ananke/append-drive-crossed.ts` (8-step) + `grid/src/audit/append-nous-deleted.ts` (literal-guard step 3 pattern).

**4-key payload + cause literal guard:**

```typescript
const EXPECTED_DEATH_KEYS = ['cause', 'did', 'final_state_hash', 'tick'] as const;
const CAUSE_VALUES = new Set(['starvation', 'operator_h5', 'replay_boundary'] as const);

export function appendBiosDeath(
    audit: AuditChain,
    actorDid: string,
    payload: BiosDeathPayload,
): AuditEntry {
    // 1. DID_RE + self-report (same as appendBiosBirth)
    // 2. tick non-negative integer
    // 3. Cause literal guard (mirrors literal-guard pattern from append-nous-deleted.ts:78-87)
    if (!CAUSE_VALUES.has(payload.cause)) {
        throw new TypeError(`appendBiosDeath: unknown cause ${JSON.stringify(payload.cause)}`);
    }
    // 4. HEX64_RE on final_state_hash
    if (!HEX64_RE.test(payload.final_state_hash)) { throw ... }
    // 5. Closed-tuple: EXPECTED_DEATH_KEYS
    // 6. Explicit reconstruction
    const cleanPayload = {
        did: payload.did,
        tick: payload.tick,
        cause: payload.cause,
        final_state_hash: payload.final_state_hash,
    };
    // 7. payloadPrivacyCheck
    // 8. audit.append('bios.death', actorDid, cleanPayload)
    return audit.append('bios.death', actorDid, cleanPayload);
}
```

**Literal-guard pattern from append-nous-deleted.ts:78-87:**

```typescript
if ((payload as { tier?: unknown }).tier !== 'H5') {
    throw new TypeError(`appendNousDeleted: tier must be literal 'H5', got ...`);
}
```

---

### `grid/src/audit/broadcast-allowlist.ts` (modified — 19 → 21)

**Analog:** the file itself, lines 42-75 (ALLOWLIST_MEMBERS) + lines 110-127 (forbidden keys).

**Append after `'ananke.drive_crossed'` (before `] as const`):**

```typescript
// Phase 10b (BIOS-02): bodily need lifecycle — birth.
// Closed 3-key payload: {did, tick, psyche_hash}.
// Emitted ONLY via appendBiosBirth() (grid/src/bios/appendBiosBirth.ts).
'bios.birth',
// Phase 10b (BIOS-02, BIOS-03): bodily need lifecycle — death.
// Closed 4-key payload: {did, tick, cause, final_state_hash}.
// cause ∈ {starvation, operator_h5, replay_boundary}.
// Emitted ONLY via appendBiosDeath() (grid/src/bios/appendBiosDeath.ts).
'bios.death',
```

**Extend FORBIDDEN_KEY_PATTERN** (current: line 127):

```typescript
// Current (Phase 10a):
export const FORBIDDEN_KEY_PATTERN =
    /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value/i;

// Extended (Phase 10b):
export const FORBIDDEN_KEY_PATTERN =
    /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick/i;
```

**New exports (append after `DRIVE_FORBIDDEN_KEYS`):**

```typescript
export const BIOS_FORBIDDEN_KEYS = [
    'energy', 'sustenance', 'need_value', 'bios_value',
] as const;

export const CHRONOS_FORBIDDEN_KEYS = [
    'subjective_multiplier', 'chronos_multiplier', 'subjective_tick',
] as const;
```

---

### `grid/src/api/operator/delete-nous.ts` (modified — D-30 ORDER extended)

**Analog:** the file itself, lines 145-162 (the D-30 ORDER block).

**Current D-30 ORDER** (delete-nous.ts:145-162):

```typescript
// 6a. Tombstone in registry
registry.tombstone(targetDid, currentTick, resolvedDeps.space);
// 6b. Despawn from coordinator
resolvedDeps.coordinator.despawnNous(targetDid);
// 6c. Emit operator.nous_deleted audit event (sole producer path)
appendNousDeleted(services.audit, v.operator_id, {
    tier: 'H5',
    action: 'delete',
    operator_id: v.operator_id,
    target_did: targetDid,
    pre_deletion_state_hash: stateHash,
});
```

**Extended D-30 ORDER (Phase 10b):**

```typescript
// 6a. Tombstone in registry (unchanged)
registry.tombstone(targetDid, currentTick, resolvedDeps.space);
// 6b. Despawn from coordinator (unchanged)
resolvedDeps.coordinator.despawnNous(targetDid);
// 6c. Bios lifecycle layer — must precede operator audit event
appendBiosDeath(services.audit, targetDid, {
    did: targetDid,
    tick: currentTick,
    cause: 'operator_h5',
    final_state_hash: stateHash,  // reuse hash already fetched (SC#3)
});
// 6d. Operator audit event (preserved unchanged at same position)
appendNousDeleted(services.audit, v.operator_id, {
    tier: 'H5',
    action: 'delete',
    operator_id: v.operator_id,
    target_did: targetDid,
    pre_deletion_state_hash: stateHash,
});
```

**Key rule:** `stateHash` computed at step 5 (Brain RPC, before tombstone per SC#3) is reused by BOTH `appendBiosDeath` and `appendNousDeleted`. No second Brain RPC needed.

---

### `grid/src/genesis/launcher.ts` (modified — bios.birth emission)

**Analog:** the file itself, lines 172 and 297 (`audit.append('nous.spawned', ...)` calls).

**Current spawn sequence** (launcher.ts:171-172):

```typescript
// Audit the spawn
this.audit.append('nous.spawned', record.did, { ... });
```

**Extended spawn sequence:**

```typescript
// Audit the spawn
this.audit.append('nous.spawned', record.did, { ... });
// Phase 10b BIOS-02: lifecycle layer — bios.birth immediately after nous.spawned
appendBiosBirth(this.audit, record.did, {
    did: record.did,
    tick: currentTick,
    psyche_hash: computePsycheHash(record),   // SHA-256 of Psyche init vector
});
```

**`computePsycheHash` pattern** — from `grid/src/audit/state-hash.ts` `combineStateHash` pattern (Phase 8). New utility `computePsycheHash(record): string` uses same SHA-256 + canonical JSON approach.

---

### `grid/test/audit/allowlist-twenty-one.test.ts`

**Analog:** Phase 10a `grid/test/ananke/allowlist-nineteen.test.ts` — verbatim clone, extend tuple by 2.

**Pattern from allowlist-nineteen.test.ts** (derived from Phase 8 allowlist-eighteen template):

```typescript
const EXPECTED_ORDER = [
    'nous.spawned', ... , 'ananke.drive_crossed',  // positions 1-19
    'bios.birth',    // position 20
    'bios.death',    // position 21
] as const;

describe('broadcast allowlist — Phase 10b invariant (BIOS-02 D-10b-01)', () => {
    it('contains exactly 21 members', () => {
        expect(ALLOWLIST.size).toBe(21);
    });
    it('bios.birth at position 20, bios.death at position 21', () => {
        const arr = [...ALLOWLIST];
        expect(arr[19]).toBe('bios.birth');
        expect(arr[20]).toBe('bios.death');
    });
    it('preserves full order', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
    });
    it('is frozen — mutation attempts throw', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('chronos.time_slipped'))
            .toThrow(TypeError);
    });
    it('chronos.time_slipped is NOT allowlisted (D-10b-11)', () => {
        expect(ALLOWLIST.has('chronos.time_slipped')).toBe(false);
    });
});
```

---

### `grid/test/bios/bios-producer-boundary.test.ts`

**Analog:** `grid/test/ananke/drive-crossed-producer-boundary.test.ts` — verbatim clone, swap 2 strings.

**Clone template** (drive-crossed-producer-boundary.test.ts):

```typescript
const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'ananke/append-drive-crossed.ts';

// ... walk() function identical ...

describe('ananke.drive_crossed — sole producer boundary', () => {
    it('no file in grid/src/ except append-drive-crossed.ts directly emits', () => {
        const pattern = /\b(audit|chain)\.append[^;]{0,200}['"]ananke\.drive_crossed['"]/s;
        // assert offenders === []
    });
});
```

**Apply to Bios — two sole-producer checks:**

```typescript
// Check 1: bios.birth
const BIRTH_PRODUCER = 'bios/appendBiosBirth.ts';
const BIRTH_PATTERN = /\b(audit|chain)\.append[^;]{0,200}['"]bios\.birth['"]/s;

// Check 2: bios.death
const DEATH_PRODUCER = 'bios/appendBiosDeath.ts';
const DEATH_PATTERN = /\b(audit|chain)\.append[^;]{0,200}['"]bios\.death['"]/s;
```

---

### `dashboard/src/app/grid/components/inspector-sections/bios.tsx` (BiosSection)

**Analog:** `dashboard/src/app/grid/components/inspector-sections/ananke.tsx` (lines 1-128) — **primary template, clone line-for-line, rename `drive`→`need`.**

**Full ananke.tsx structure to clone** (lines 57-128):

```tsx
export function AnankeSection({ did }: AnankeSectionProps): React.ReactElement {
    const levels = useAnankeLevels(did);
    return (
        <section data-testid="section-ananke" aria-labelledby="section-ananke-title" className="mb-4">
            <h3 id="section-ananke-title" className="mb-2 text-sm font-semibold text-neutral-100">
                Drives
            </h3>
            <ul role="list" aria-label="Current drive pressure levels" className="flex flex-col gap-1">
                {DRIVE_ORDER.map((drive) => {
                    const entry = levels.get(drive)!;
                    const { level, direction } = entry;
                    const ariaLabel = direction
                        ? `${drive} level ${level}, ${direction}`
                        : `${drive} level ${level}`;
                    return (
                        <li
                            key={drive}
                            data-testid={`drive-row-${drive}`}
                            data-drive={drive}
                            data-level={level}
                            data-direction={direction ?? 'stable'}
                            className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                        >
                            <span data-testid={`drive-dot-${drive}`} aria-hidden="true"
                                className={`inline-block h-2 w-2 rounded-full ${LEVEL_STYLE[level].dotClass}`} />
                            <span data-testid={`drive-glyph-${drive}`} aria-hidden="true"
                                className="text-sm leading-none text-neutral-200">
                                {DRIVE_GLYPH[drive]}
                            </span>
                            <span className="flex-1 text-xs text-neutral-200">{drive}</span>
                            <span data-testid={`drive-level-${drive}`}
                                className={`text-xs ${LEVEL_STYLE[level].textClass}`}
                                aria-label={ariaLabel}>
                                {level}
                            </span>
                            {direction && (
                                <span data-testid={`drive-direction-${drive}`} aria-hidden="true"
                                    className={`text-xs tabular-nums ${LEVEL_STYLE[level].textClass}`}>
                                    {DIRECTION_GLYPH[direction]}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
```

**Apply to Bios** (renames + 2-item NEED_ORDER, NEED_GLYPH from bios-types.ts):

- `DRIVE_ORDER` → `NEED_ORDER = ['energy', 'sustenance']`
- `useAnankeLevels(did)` → `useBiosLevels(did)`
- `DRIVE_GLYPH` → `NEED_GLYPH = { energy: '\u26A1', sustenance: '\u2B21' }`
- `LEVEL_STYLE` — **import from ananke.tsx or re-declare identically** (planner decides; zero divergence)
- `DIRECTION_GLYPH` — same import/re-declare decision
- section `data-testid` → `"section-bios"`, `aria-labelledby` → `"section-bios-title"`
- heading text: `"Needs"` (not "Bios")
- `<ul aria-label="Current bodily need levels">`
- all `data-drive` → `data-need`; `data-testid="drive-row-{drive}"` → `data-testid="need-row-{need}"`

---

### `dashboard/src/lib/hooks/use-bios-levels.ts`

**Analog:** `dashboard/src/lib/hooks/use-ananke-levels.ts` (lines 1-84) — **primary template, clone line-for-line.**

**Full use-ananke-levels.ts to clone** (lines 22-84):

```typescript
const ANANKE_DRIVE_CROSSED = 'ananke.drive_crossed';

function baselineMap(): Map<DriveName, AnankeLevelEntry> {
    const map = new Map<DriveName, AnankeLevelEntry>();
    for (const drive of DRIVE_ORDER) {
        map.set(drive, { level: DRIVE_BASELINE_LEVEL[drive], direction: null });
    }
    return map;
}

function isAnankeCrossingPayload(p: unknown, targetDid: string): p is AnankeDriveCrossedPayload {
    if (typeof p !== 'object' || p === null) return false;
    const r = p as Record<string, unknown>;
    if (r.did !== targetDid) return false;
    if (typeof r.drive !== 'string') return false;
    if (!DRIVE_ORDER.includes(r.drive as DriveName)) return false;
    if (r.level !== 'low' && r.level !== 'med' && r.level !== 'high') return false;
    if (r.direction !== 'rising' && r.direction !== 'falling') return false;
    if (typeof r.tick !== 'number') return false;
    return true;
}

export function useAnankeLevels(did: string | null): Map<DriveName, AnankeLevelEntry> {
    const snap = useFirehose();
    return useMemo<Map<DriveName, AnankeLevelEntry>>(() => {
        const map = baselineMap();
        if (!did) return map;
        for (const entry of snap.entries) {
            if (entry.eventType !== ANANKE_DRIVE_CROSSED) continue;
            if (entry.actorDid !== did) continue;
            if (!isAnankeCrossingPayload(entry.payload, did)) continue;
            map.set(entry.payload.drive, { level: entry.payload.level, direction: entry.payload.direction });
        }
        return map;
    }, [snap.entries, did]);
}
```

**Apply to Bios** (key difference: filter by `drive ∈ {hunger, safety}` via NEED_TO_DRIVE mapping):

```typescript
const ANANKE_DRIVE_CROSSED = 'ananke.drive_crossed';
// NEED_TO_DRIVE from bios-types.ts: { energy: 'hunger', sustenance: 'safety' }
// Invert for hook: { hunger: 'energy', safety: 'sustenance' }
const DRIVE_TO_NEED: Record<string, NeedName> = { hunger: 'energy', safety: 'sustenance' };

export function useBiosLevels(did: string | null): Map<NeedName, NeedLevelEntry> {
    const snap = useFirehose();
    return useMemo<Map<NeedName, NeedLevelEntry>>(() => {
        const map = baselineMap();  // energy→low, sustenance→low, both direction=null
        if (!did) return map;
        for (const entry of snap.entries) {
            if (entry.eventType !== ANANKE_DRIVE_CROSSED) continue;
            if (entry.actorDid !== did) continue;
            const p = entry.payload;
            if (!isAnankeCrossingPayload(p, did)) continue;
            // Only process drives that map to a Bios need
            const need = DRIVE_TO_NEED[p.drive];
            if (!need) continue;
            map.set(need, { level: p.level, direction: p.direction });
        }
        return map;
    }, [snap.entries, did]);
}
```

---

### `dashboard/src/lib/protocol/bios-types.ts` (SYNC mirror)

**Analog:** `dashboard/src/lib/protocol/ananke-types.ts` (lines 1-66) — exact clone, rename identifiers.

**SYNC-header pattern** (ananke-types.ts:1-20):

```typescript
/**
 * SYNC: mirrors brain/src/noesis_brain/ananke/types.py
 * SYNC: mirrors brain/src/noesis_brain/ananke/config.py (DRIVE_BASELINES)
 * SYNC: mirrors grid/src/ananke/types.ts
 *
 * Drift is detected by dashboard/test/lib/ananke-types.drift.test.ts,
 * which reads the Python source and fails if enum or baseline values diverge.
 */
```

**Apply to Bios:**

```typescript
/**
 * SYNC: mirrors brain/src/noesis_brain/bios/types.py
 * SYNC: mirrors brain/src/noesis_brain/bios/config.py (NEED_BASELINES, thresholds)
 * SYNC: mirrors grid/src/bios/types.ts
 *
 * Drift is detected by dashboard/test/lib/bios-types.drift.test.ts.
 *
 * PRIVACY — BIOS_FORBIDDEN_KEYS (D-10b-10):
 *   Need floats (energy=0.3, sustenance=0.3) NEVER enter this file.
 *   Only the bucketed DriveLevel enum is mirrored.
 */

export type NeedName = 'energy' | 'sustenance';
export const NEED_ORDER: NeedName[] = ['energy', 'sustenance'];

export const NEED_GLYPH: Record<NeedName, string> = {
    energy:     '\u26A1',   // ⚡ U+26A1 HIGH VOLTAGE SIGN
    sustenance: '\u2B21',   // ⬡ U+2B21 WHITE HEXAGON
};

export const NEED_TO_DRIVE: Record<NeedName, DriveName> = {
    energy:     'hunger',
    sustenance: 'safety',
};

// DriveLevel and direction types imported from ananke-types.ts (shared vocabulary)
export const NEED_BASELINE_LEVEL: Record<NeedName, DriveLevel> = {
    energy:     'low',   // brain baseline 0.3 bucketed from LOW at threshold 0.33
    sustenance: 'low',   // brain baseline 0.3 bucketed from LOW at threshold 0.33
};
```

---

### `dashboard/src/app/grid/components/inspector.tsx` (modified)

**Analog:** the file itself. Current pattern (lines ~370-400, derived from Phase 10a):

```tsx
<AnankeSection did={selectedDid} />
<TelosSection did={selectedDid} />
```

**Extended:**

```tsx
<AnankeSection did={selectedDid} />
<BiosSection did={selectedDid} />    {/* Phase 10b — between Ananke and Telos */}
<TelosSection did={selectedDid} />
```

---

## Shared Patterns

### Pattern: 8-step sole-producer validation (all emitters)

**Source:** `grid/src/ananke/append-drive-crossed.ts` (lines 59-133)
**Apply to:** `grid/src/bios/appendBiosBirth.ts`, `grid/src/bios/appendBiosDeath.ts`

All 8 steps are mandatory — omitting any creates a regression:
1. DID_RE on actorDid
2. DID_RE on payload.did
3. Self-report invariant (`payload.did === actorDid`)
4. tick non-negative integer
5. Per-field closed-enum or regex guard (HEX64_RE, CAUSE_VALUES Set)
6. Closed-tuple: `Object.keys(payload).sort()` strict equality to EXPECTED_KEYS
7. Explicit reconstruction (no spread)
8. `payloadPrivacyCheck` → `audit.append`

---

### Pattern: HEX64_RE for hash field guards

**Source:** `grid/src/audit/append-nous-deleted.ts:26`
**Apply to:** `appendBiosBirth.ts` (psyche_hash), `appendBiosDeath.ts` (final_state_hash)

```typescript
export const HEX64_RE = /^[0-9a-f]{64}$/;
```

---

### Pattern: CAUSE_VALUES closed-Set literal guard

**Source:** `grid/src/audit/append-nous-deleted.ts:78-87` (literal-guard pattern — tier === 'H5')
**Apply to:** `appendBiosDeath.ts` (cause ∈ {starvation, operator_h5, replay_boundary})

```typescript
const CAUSE_VALUES = new Set(['starvation', 'operator_h5', 'replay_boundary'] as const);
if (!CAUSE_VALUES.has(payload.cause)) {
    throw new TypeError(`appendBiosDeath: unknown cause ${JSON.stringify(payload.cause)}`);
}
```

---

### Pattern: Piecewise deterministic recurrence (Brain Python)

**Source:** `brain/src/noesis_brain/ananke/drives.py:35-71`
**Apply to:** `brain/src/noesis_brain/bios/needs.py` (step function)

```python
if prev < baseline:
    nxt = baseline + (prev - baseline) * DECAY_FACTOR   # relax toward baseline
else:
    nxt = prev + RISE_RATE[need]                        # monotonic rise above baseline
new_values[need] = max(0.0, min(1.0, nxt))              # clamp
```

No `math.exp` on hot path — `DECAY_FACTOR = math.exp(-1.0 / TAU)` computed once in config.py.

---

### Pattern: _get_or_create lazy memoization (Brain handler)

**Source:** `brain/src/noesis_brain/rpc/handler.py:228-241`
**Apply to:** `handler.py` Bios integration (`_get_or_create_bios`)

```python
def _get_or_create_ananke(self, did: str) -> AnankeRuntime:
    if did not in self._ananke_runtimes:
        seed = int.from_bytes(hashlib.sha256(did.encode("utf-8")).digest()[:8], "big")
        self._ananke_runtimes[did] = self._ananke_loader.build(seed=seed)
    return self._ananke_runtimes[did]
```

---

### Pattern: SYNC-header drift detector

**Source:** `dashboard/src/lib/protocol/ananke-types.ts:1-20` (header) + `dashboard/test/lib/ananke-types.drift.test.ts` (test)
**Apply to:** `bios-types.ts` + `dashboard/test/lib/bios-types.drift.test.ts`

```typescript
/**
 * SYNC: mirrors brain/src/noesis_brain/bios/config.py (NEED_BASELINES)
 * Drift is detected by dashboard/test/lib/bios-types.drift.test.ts
 */
```

Test reads `brain/src/noesis_brain/bios/config.py` via `fs.readFileSync`, regex-extracts `NEED_BASELINES` floats, buckets them at `THRESHOLD_LOW=0.33`, asserts result matches `NEED_BASELINE_LEVEL`. Exact test structure from Phase 10a `ananke-types.drift.test.ts`.

---

### Pattern: Wall-clock ban grep gate

**Source:** `grid/test/ananke/determinism-source.test.ts` (verbatim)
**Apply to:** `grid/test/ci/bios-no-walltime.test.ts` (swap path to `../../src/bios`)

```typescript
const WALL_CLOCK_PATTERN = /\b(?:Date\.now|performance\.now|setInterval|setTimeout|Math\.random)\b/;
// walk subtree, readFileSync each .ts, assert toEqual([])
```

Python-side gate (from Phase 10a cross-language extension pattern):

```typescript
const PY_WALL_CLOCK_PATTERN = /\b(?:time\.time|time\.monotonic|datetime\.now|random\.random)\b/;
// cover brain/src/noesis_brain/bios/** and brain/src/noesis_brain/chronos/**
```

---

### Pattern: Firehose hook with silent-drop validation

**Source:** `dashboard/src/lib/hooks/use-ananke-levels.ts` (lines 45-60)
**Apply to:** `dashboard/src/lib/hooks/use-bios-levels.ts`

Payload guard function with silent drop at boundary — malformed events never reach the map:

```typescript
function isAnankeCrossingPayload(p: unknown, targetDid: string): p is AnankeDriveCrossedPayload {
    if (typeof p !== 'object' || p === null) return false;
    const r = p as Record<string, unknown>;
    if (r.did !== targetDid) return false;
    if (typeof r.drive !== 'string') return false;
    if (!DRIVE_ORDER.includes(r.drive as DriveName)) return false;
    if (r.level !== 'low' && r.level !== 'med' && r.level !== 'high') return false;
    if (r.direction !== 'rising' && r.direction !== 'falling') return false;
    if (typeof r.tick !== 'number') return false;
    return true;
}
```

---

### Pattern: Section shell (Inspector drawer)

**Source:** `dashboard/src/app/grid/components/inspector-sections/ananke.tsx:58-70`
**Apply to:** `bios.tsx`

```tsx
<section
    data-testid="section-bios"
    aria-labelledby="section-bios-title"
    className="mb-4"
>
    <h3 id="section-bios-title" className="mb-2 text-sm font-semibold text-neutral-100">
        Needs
    </h3>
    <ul role="list" aria-label="Current bodily need levels" className="flex flex-col gap-1">
        {/* 2 rows */}
    </ul>
</section>
```

---

### Pattern: Three-bucket level palette (no new tokens)

**Source:** `dashboard/src/app/grid/components/inspector-sections/ananke.tsx:41-51`
**Apply to:** `bios.tsx` — either import from ananke.tsx or re-declare identically

```typescript
const LEVEL_STYLE: Record<DriveLevel, { dotClass: string; textClass: string }> = {
    low:  { dotClass: 'bg-neutral-400', textClass: 'text-neutral-400' },
    med:  { dotClass: 'bg-amber-400',   textClass: 'text-amber-400' },
    high: { dotClass: 'bg-rose-400',    textClass: 'text-rose-400' },
};

const DIRECTION_GLYPH = {
    rising:  '\u2191',  // ↑
    falling: '\u2193',  // ↓
} as const;
```

---

## No Analog Found

No files are without a close match. Phase 10b is pure composition of Phase 10a patterns applied to a 2-need subset. The only novel element is `compute_multiplier()` in Chronos — but its math-only module shape is covered by `ananke/drives.py` and the formula is fully specified in RESEARCH.md §Pattern 5.

| File | Role | Reason | Fallback source |
|---|---|---|---|
| `brain/src/noesis_brain/chronos/subjective_time.py` | deterministic transform | No prior Brain-side cognitive multiplier; math-only module with no state | RESEARCH.md §Pattern 5 (D-10b-05) specifies the formula verbatim; `ananke/drives.py` provides module structure |
| `brain/src/noesis_brain/bios/runtime.py` (death + elevator additions) | tick-driven state machine with novel death signal | `AnankeRuntime` has no death concept or cross-subsystem elevation | `ananke/runtime.py` covers 90% of the shape; D-10b-04 death trigger + D-10b-02 elevator pattern are additive |

---

## Critical Research Findings for Planner

1. **`Memory.tick` already exists** (`brain/src/noesis_brain/memory/types.py:39`). The `audit_tick` field needed by Chronos can alias `memory.tick` directly — no new field required. Planner should use `memory.tick` in `recency_score_by_tick()`.

2. **`retrieval.py:34` calls `datetime.now(timezone.utc)`** — verified wall-clock use. Must be replaced with `recency_score_by_tick(memory, current_tick)`. The old `recency_score(now=datetime)` may remain deprecated for non-Chronos callers.

3. **`delete-nous.ts` D-30 ORDER is locked at lines 145-162.** `stateHash` is computed at step 5 (Brain RPC, before tombstone). Phase 10b inserts `appendBiosDeath` as new step 6c before the existing `appendNousDeleted` (step 6d). The `stateHash` value at line 123 is reused — no second RPC.

4. **`birth_tick` for `epoch_since_spawn`** is simplest as a constructor parameter on `BiosRuntime` (resolves assumption A2 from RESEARCH.md). The handler stores it at `_bios_birth_ticks: dict[str, int]` and populates it at Nous spawn time (same tick as `appendBiosBirth`).

5. **`launcher.ts` has two spawn call sites** (lines 172 and 297). Both must emit `appendBiosBirth`. The executor must extend both sites.

6. **`AnankeRuntime.elevate_drive()` does NOT exist yet** — must be added to `brain/src/noesis_brain/ananke/runtime.py` in the same wave as `BiosRuntime.on_tick()`. It mutates `state.levels` in-memory without appending to `_crossings`.

---

## Metadata

**Analog search scope:**
- `brain/src/noesis_brain/ananke/` — direct clone surface (types, config, drives, runtime, loader)
- `brain/src/noesis_brain/rpc/handler.py` — `_get_or_create_ananke` memoization template
- `brain/src/noesis_brain/prompts/system.py` — `_context_section` injection point
- `brain/src/noesis_brain/memory/{types.py, retrieval.py}` — Chronos mutation targets
- `grid/src/ananke/` — sole-producer emitter templates + types
- `grid/src/audit/{append-nous-deleted.ts, broadcast-allowlist.ts}` — literal-guard + forbidden-key patterns
- `grid/src/api/operator/delete-nous.ts` — D-30 ORDER extension point
- `grid/src/genesis/launcher.ts` — spawn sequence extension point
- `dashboard/src/app/grid/components/inspector-sections/ananke.tsx` — BiosSection template
- `dashboard/src/lib/hooks/use-ananke-levels.ts` — useBiosLevels template
- `dashboard/src/lib/protocol/ananke-types.ts` — bios-types.ts template

**Files read (non-overlapping):**
- `brain/src/noesis_brain/ananke/{types.py, config.py, drives.py, runtime.py, loader.py}` (full)
- `brain/src/noesis_brain/rpc/handler.py` (grep: lines 56-241)
- `brain/src/noesis_brain/memory/{types.py, retrieval.py}` (full)
- `brain/src/noesis_brain/prompts/system.py:1-79` (full)
- `grid/src/ananke/{types.ts, append-drive-crossed.ts}` (full)
- `grid/src/audit/{append-nous-deleted.ts, broadcast-allowlist.ts}` (full)
- `grid/src/api/operator/delete-nous.ts` (full)
- `grid/src/genesis/launcher.ts` (grep: lines 130-297)
- `dashboard/src/app/grid/components/inspector-sections/ananke.tsx` (full)
- `dashboard/src/lib/hooks/use-ananke-levels.ts` (full)
- `dashboard/src/lib/protocol/ananke-types.ts` (full)
- `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-PATTERNS.md` (full reference)
- `10b-CONTEXT.md`, `10b-RESEARCH.md`, `10b-UI-SPEC.md` (full)

**Pattern extraction date:** 2026-04-22
