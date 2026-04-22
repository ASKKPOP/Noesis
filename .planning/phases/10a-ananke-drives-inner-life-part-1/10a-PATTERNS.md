# Phase 10a: Ananke Drives (Inner Life, part 1) — Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 23 new + 3 modified
**Analogs found:** 23 / 23 (100% coverage — Phase 10a is pure composition of v2.1 and Phase 9 patterns)

---

## File Classification

### Brain (Python) — new module `brain/src/noesis_brain/ananke/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `brain/src/noesis_brain/ananke/__init__.py` | package init / public API | re-export | `brain/src/noesis_brain/psyche/__init__.py` | exact |
| `brain/src/noesis_brain/ananke/types.py` | enums + dataclasses (DriveName, DriveLevel, DriveDirection, DriveState, DriveConfig, DriveCrossing) | pure-value | `brain/src/noesis_brain/thymos/types.py` + `psyche/types.py` | exact |
| `brain/src/noesis_brain/ananke/drives.py` | pure `update(state, seed, tick, config)` function — closed-form recurrence | transform (deterministic) | **no direct analog** — closest shape is Phase 9 `grid/src/relationships/canonical.ts::decayedWeight` (different language) | cross-language analog only |
| `brain/src/noesis_brain/ananke/runtime.py` | stateful wrapper holding `prev_levels: dict[DriveName, DriveLevel]`; detects crossings | tick-driven state machine | `brain/src/noesis_brain/thymos/tracker.py` (class owning mutable state + `feel/decay/reset` methods) | role-match |
| `brain/src/noesis_brain/ananke/loader.py` | YAML → `AnankeRuntime` constructor | file I/O → object graph | `brain/src/noesis_brain/psyche/loader.py` | exact |

### Brain (Python) — modified

| Modified File | Role | Change | Analog |
|---------------|------|--------|--------|
| `brain/src/noesis_brain/rpc/types.py` | RPC action enum | additive widening — add `ActionType.DRIVE_CROSSED = "drive_crossed"` | Phase 7 `TELOS_REFINED = "telos_refined"` (lines 17) |
| `brain/src/noesis_brain/rpc/handler.py` | BrainHandler.on_tick | add `crossings = self.ananke_runtime.tick(seed, tick)` → emit `Action(DRIVE_CROSSED, metadata={drive, level, direction})` per crossing | `_build_refined_telos` helper (handler.py:472–530) |

### Brain (Python) tests — new directory `brain/test/ananke/`

| New Test File | Role | Data Flow | Closest Analog |
|---------------|------|-----------|----------------|
| `brain/test/ananke/__init__.py` | test-pkg marker | — | `brain/test/__init__.py` |
| `brain/test/ananke/test_determinism.py` | same-seed-same-tick → byte-identical trace | deterministic recurrence check | `brain/test/test_telos_refined_action.py` (parametric + closed-tuple style) |
| `brain/test/ananke/test_monotonic_rise.py` | sub-baseline → baseline; above-baseline → saturates | algebraic invariant | `brain/test/test_thymos.py::TestEmotionState::test_clamp_*` |
| `brain/test/ananke/test_level_bucketing.py` | 0.33/0.66 boundary + hysteresis band | enum bucketing | `brain/test/test_psyche.py::TestPersonalityProfile::test_get_numeric` |
| `brain/test/ananke/test_closed_enum.py` | `DriveName` has exactly 5 members + frozen | enum-closure regression | `brain/test/test_rpc_types.py` (ActionType enum-value assertions) |
| `brain/test/ananke/test_drive_crossed_action.py` | Brain returns `ActionType.DRIVE_CROSSED` with 3-key metadata `{drive, level, direction}` | closed-tuple + plaintext ban | `brain/test/test_telos_refined_action.py` (EXCELLENT direct analog) |

### Grid (TypeScript) — new module `grid/src/ananke/`

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `grid/src/ananke/types.ts` | frozen enums — `DRIVE_NAMES`, `DRIVE_LEVELS`, `DRIVE_DIRECTIONS`, regex | value-only | `grid/src/relationships/types.ts` + `grid/src/relationships/config.ts` | exact |
| `grid/src/ananke/append-drive-crossed.ts` | **SOLE-PRODUCER** emitter — closed 5-key tuple `{did, tick, drive, level, direction}` | request-response (audit append) | `grid/src/audit/append-telos-refined.ts` | **exact** (primary template) |
| `grid/src/ananke/index.ts` | barrel export | — | `grid/src/relationships/index.ts` |

### Grid (TypeScript) — modified

| Modified File | Change | Analog Section |
|---------------|--------|----------------|
| `grid/src/audit/broadcast-allowlist.ts` | `ALLOWLIST_MEMBERS` 18 → 19: add `'ananke.drive_crossed'` at position 19; extend `FORBIDDEN_KEY_PATTERN` regex with `hunger\|curiosity\|safety\|boredom\|loneliness\|drive_value` | this file itself, lines 24–66, 100 |
| `grid/src/integration/types.ts` | add `DriveCrossedAction` variant to `BrainAction` discriminated union | `TelosRefinedAction` (lines 70–80) |
| `grid/src/integration/nous-runner.ts` | add `case 'drive_crossed':` dispatcher → `appendAnankeDriveCrossed(this.audit, this.nousDid, {did, tick, drive, level, direction})` | `case 'telos_refined':` (nous-runner.ts:326–368) |

### Grid (TypeScript) tests — new

| New Test File | Role | Analog |
|---------------|------|--------|
| `grid/test/ananke/append-drive-crossed-closed-tuple.test.ts` | 5-key closed-tuple + regex guards + happy path | `grid/test/audit/telos-refined-privacy.test.ts` + `nous-deleted-privacy.test.ts` |
| `grid/test/ananke/determinism-source.test.ts` | wall-clock ban on `grid/src/ananke/**` | `grid/test/relationships/determinism-source.test.ts` (verbatim, swap path) |
| `grid/test/ananke/allowlist-nineteen.test.ts` | pin frozen 19-tuple incl. `ananke.drive_crossed` at position 19 | `grid/test/audit/allowlist-eighteen.test.ts` (verbatim, extend) |
| `grid/test/ananke/audit-ceiling.test.ts` | D-10a-04 regression: 1000 ticks × 5 drives ≤ 50 entries | no direct analog — closest is `grid/test/relationships/perf-10k.test.ts` |
| `grid/test/ananke/closed-enum-siblings.test.ts` | attempt to append `ananke.drive_raised` / `.drive_saturated` / `.drive_reset` → fails allowlist | `grid/test/audit/allowlist-eighteen.test.ts::'is frozen'` block |
| `grid/test/audit/ananke-drive-crossed-privacy.test.ts` | 5 drives × 3 levels × 2 directions matrix + forbidden-keys cases | `grid/test/audit/telos-refined-privacy.test.ts` (exact template) |
| `grid/test/audit/ananke-drive-crossed-producer-boundary.test.ts` | grep — only `grid/src/ananke/append-drive-crossed.ts` calls `audit.append('ananke.drive_crossed', …)` | `grid/test/audit/telos-refined-producer-boundary.test.ts` (verbatim, swap strings) |
| `grid/test/privacy/drive-forbidden-keys.test.ts` | three-tier grep (Grid emitter, Brain wire payload, Dashboard render output) for `DRIVE_FORBIDDEN_KEYS` | `grid/test/audit/operator-payload-privacy.test.ts` (nearest existing privacy-matrix test) |
| `grid/test/ci/ananke-no-walltime.test.ts` | expand determinism-source ban to cover `brain/src/noesis_brain/ananke/**` via fs grep | `grid/test/relationships/determinism-source.test.ts` (swap directory constant) |

### Dashboard (TypeScript/TSX) — new

| New File | Role | Data Flow | Analog | Match Quality |
|----------|------|-----------|--------|---------------|
| `dashboard/src/app/grid/components/inspector-sections/ananke.tsx` | Drives section component (5 rows × level glyphs) | read-only projection from firehose | `dashboard/src/app/grid/components/inspector-sections/thymos.tsx` (section shell) + `relationships.tsx` H1 branch (per-row dot + text + bucket) | exact |
| `dashboard/src/app/grid/components/inspector-sections/ananke.test.tsx` | 45-case aria-label matrix + baseline-first-paint + transition + no-numeric grep | Vitest + testing-library | `dashboard/src/app/grid/components/inspector-sections/telos.test.tsx` + `relationships.test.tsx` |
| `dashboard/src/lib/hooks/use-ananke-levels.ts` | derived selector over `useFirehose()` → `Map<drive, {level, direction}>` | firehose read + useMemo | `dashboard/src/lib/hooks/use-refined-telos-history.ts` | **exact** (primary template) |
| `dashboard/src/lib/hooks/use-ananke-levels.test.ts` | hook unit tests (malformed events dropped, most-recent-wins per (did,drive)) | — | `dashboard/src/lib/hooks/use-refined-telos-history.test.ts` (sibling) |
| `dashboard/src/lib/protocol/ananke-types.ts` | SYNC-mirror of Brain `DRIVE_BASELINES` → `DRIVE_BASELINE_LEVEL`, `DriveName`, `DriveLevel`, `DriveDirection` types | value-only | `dashboard/src/lib/protocol/agency-types.ts` (SYNC-header pattern) | exact |
| `dashboard/test/lib/ananke-types.drift.test.ts` | `fs.readFileSync(brain/.../config.py)` → parse baselines → assert dashboard mirror bucket matches | fs + regex | `grid/test/relationships/determinism-source.test.ts` (fs+grep pattern) + any existing drift-detector test (planner confirms exact analog) |

### Dashboard — modified

| Modified File | Change |
|---------------|--------|
| `dashboard/src/app/grid/components/inspector.tsx` | one JSX line added in Overview tabpanel, between `<ThymosSection>` and `<TelosSection>`: `<AnankeSection did={selectedDid} />` |

---

## Pattern Assignments

### `brain/src/noesis_brain/ananke/__init__.py` (package init, re-export)

**Analog:** `brain/src/noesis_brain/psyche/__init__.py`

**Copy pattern verbatim — shape:**

```python
"""Ananke — Deterministic drive system (DRIVE-01)."""

from noesis_brain.ananke.types import (
    DriveName,
    DriveLevel,
    DriveDirection,
    DriveState,
    DriveConfig,
    DriveCrossing,
)
from noesis_brain.ananke.runtime import AnankeRuntime
from noesis_brain.ananke.loader import load_ananke

__all__ = [
    "DriveName",
    "DriveLevel",
    "DriveDirection",
    "DriveState",
    "DriveConfig",
    "DriveCrossing",
    "AnankeRuntime",
    "load_ananke",
]
```

Source excerpt that drives the shape (`psyche/__init__.py:1-17`):

```python
"""Psyche — Identity and personality system."""

from noesis_brain.psyche.types import (
    PersonalityDimension,
    PersonalityProfile,
    CommunicationStyle,
    Psyche,
)
from noesis_brain.psyche.loader import load_psyche

__all__ = [
    "PersonalityDimension",
    "PersonalityProfile",
    "CommunicationStyle",
    "Psyche",
    "load_psyche",
]
```

---

### `brain/src/noesis_brain/ananke/types.py` (enum + dataclass module)

**Analog:** `brain/src/noesis_brain/thymos/types.py` (Enum + dataclass with post-init default-fill) + `psyche/types.py` (str Enum pattern).

**Imports + enum pattern** (`thymos/types.py:1-18`):

```python
"""Thymos types — emotions, mood, and emotional state."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Emotion(str, Enum):
    """Six core emotions."""

    JOY = "joy"
    SADNESS = "sadness"
    ANGER = "anger"
    FEAR = "fear"
    TRUST = "trust"
    CURIOSITY = "curiosity"
```

**Dataclass with default-fill pattern** (`thymos/types.py:32-44`):

```python
@dataclass
class MoodState:
    emotions: dict[Emotion, EmotionState] = field(default_factory=dict)
    baseline_mood: str = "neutral"
    emotional_intensity: str = "medium"

    def __post_init__(self) -> None:
        # Ensure all emotions exist
        for e in Emotion:
            if e not in self.emotions:
                self.emotions[e] = EmotionState(emotion=e)
```

**Clamp idiom** (`thymos/types.py:28-29`):

```python
def clamp(self) -> None:
    self.intensity = max(0.0, min(1.0, self.intensity))
```

**Apply to Ananke:** `DriveName` + `DriveLevel` + `DriveDirection` are all `(str, Enum)` with exactly 5/3/2 members respectively. `DriveState` is a dataclass with `dict[DriveName, float]`, default-filled in `__post_init__` from config baselines. `DriveConfig` is `@dataclass(frozen=True)` carrying per-drive `baseline/rise_rate/tau/decay_factor`.

---

### `brain/src/noesis_brain/ananke/drives.py` (pure update function)

**Analog (cross-language shape):** `grid/src/relationships/canonical.ts::decayedWeight` (lines 32-36) — the exp-decay determinism pattern.

```typescript
export function decayedWeight(edge: Edge, currentTick: number, tau: number): number {
    if (currentTick <= edge.recency_tick) return edge.weight;  // guard against paused-tick
    const delta = currentTick - edge.recency_tick;
    return edge.weight * Math.exp(-delta / tau);
}
```

**Python translation pattern** — pre-compute `decay_factor = math.exp(-1/tau)` at config load time, use pure `+/-/*/max/min` in the hot path. RESEARCH.md §Pattern 1 (lines 253-285) specifies the exact recurrence; use that as literal pseudocode.

**Anti-pattern to avoid** — DO NOT put `math.exp` in the per-tick hot path; compute it once and cache in `DriveConfig.decay_factor` (RESEARCH.md Anti-Patterns, line 340).

---

### `brain/src/noesis_brain/ananke/runtime.py` (tick state machine)

**Analog:** `brain/src/noesis_brain/thymos/tracker.py` — class wrapping mutable state, exposing tick-style mutation methods.

**Class shell + constructor** (`thymos/tracker.py:20-32`):

```python
class ThymosTracker:
    """Tracks and updates the emotional state of a Nous."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        config = config or {}
        self.mood = MoodState(
            baseline_mood=config.get("baseline_mood", "neutral"),
            emotional_intensity=config.get("emotional_intensity", "medium"),
        )
        self._triggers: dict[str, list[str]] = config.get("triggers", {})
        self._multiplier = INTENSITY_MULTIPLIER.get(
            self.mood.emotional_intensity, 1.0
        )
```

**Mutation method pattern** (`thymos/tracker.py:46-49`):

```python
def decay(self) -> None:
    """Decay all emotions toward zero (called each cycle)."""
    for state in self.mood.emotions.values():
        state.intensity = max(0.0, state.intensity - DECAY_RATE)
```

**Apply to Ananke:** `AnankeRuntime.__init__(self, config: DriveConfig)` initializes `self.state: DriveState` from baselines and `self._prev_levels: dict[DriveName, DriveLevel]`. The core method is:

```python
def tick(self, seed: bytes, tick: int) -> list[DriveCrossing]:
    new_state = drives.update(self.state, seed, tick, self._config)
    crossings: list[DriveCrossing] = []
    for drive in DriveName:
        new_level = bucket_with_hysteresis(
            new_state.values[drive],
            self._prev_levels[drive],
            self._config,
        )
        if new_level != self._prev_levels[drive]:
            direction = DriveDirection.RISING if ... else DriveDirection.FALLING
            crossings.append(DriveCrossing(drive=drive, level=new_level, direction=direction))
            self._prev_levels[drive] = new_level
    self.state = new_state
    return crossings
```

The `prev_levels` cache is **MANDATORY** — re-deriving level from value alone breaks hysteresis (RESEARCH.md Pitfall 3, line 414).

---

### `brain/src/noesis_brain/ananke/loader.py` (YAML → runtime)

**Analog:** `brain/src/noesis_brain/psyche/loader.py` (entire file, lines 1-47) — exact template.

Copy the `load_psyche(config_path | data)` signature, the `yaml.safe_load`, the `from_yaml` construction, and the try/except for enum coercion. Apply to `DriveConfig` fields with per-drive baselines+rise_rate+tau.

---

### `brain/src/noesis_brain/rpc/types.py` (ActionType widening)

**Analog:** `brain/src/noesis_brain/rpc/types.py:10-18` — the existing ActionType enum. This is an **additive widening**, not a new file.

Current state (lines 10-18):

```python
class ActionType(str, Enum):
    """Actions the brain can tell the protocol layer to execute."""

    SPEAK = "speak"
    DIRECT_MESSAGE = "direct_message"
    MOVE = "move"
    TRADE_REQUEST = "trade_request"
    TELOS_REFINED = "telos_refined"  # Phase 7 DIALOG-02
    NOOP = "noop"
```

**Change:** add `DRIVE_CROSSED = "drive_crossed"  # Phase 10a DRIVE-03` immediately after `TELOS_REFINED`. Mirrors Phase 7's pattern exactly — preserve ordering of prior members (regression test `test_action_type_enum_value_on_wire` in `test_telos_refined_action.py:211-219` is the pattern to clone for `test_drive_crossed_action.py`).

---

### `brain/src/noesis_brain/rpc/handler.py` (on_tick integration)

**Analog:** `_build_refined_telos` (handler.py:472-530) — the Phase 7 template for "Brain returns an Action when a condition is met."

**Pattern to copy — Action construction** (handler.py:520-530):

```python
return Action(
    action_type=ActionType.TELOS_REFINED,
    channel="",
    text="",
    metadata={
        "before_goal_hash": telos_hash_before,
        "after_goal_hash": telos_hash_after,
        "triggered_by_dialogue_id": dialogue_id,
    },
)
```

**Apply to Ananke:** inside `on_tick`, after existing telos/thymos updates, iterate crossings returned by `self.ananke_runtime.tick(seed, tick)`. For each crossing:

```python
Action(
    action_type=ActionType.DRIVE_CROSSED,
    channel="",
    text="",
    metadata={
        "drive": crossing.drive.value,        # str — one of 5 enum values
        "level": crossing.level.value,        # str — one of 'low'/'med'/'high'
        "direction": crossing.direction.value, # str — 'rising' or 'falling'
    },
)
```

**3-keys-not-5 invariant** (RESEARCH.md §Pattern 4, line 336): `did` and `tick` are Grid-known quantities; Brain must not send them back. Mirrors the Phase 7 3-key metadata rule.

---

### `grid/src/ananke/append-drive-crossed.ts` (SOLE producer)

**Analog:** `grid/src/audit/append-telos-refined.ts` — **primary template, clone line-for-line.**

**Complete analog structure to clone** (`append-telos-refined.ts:49-104`):

```typescript
export function appendTelosRefined(
    audit: AuditChain,
    actorDid: string,
    payload: TelosRefinedPayload,
): AuditEntry {
    // 1. Regex guards — reject malformed inputs before ANY side effect.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendTelosRefined: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`);
    }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(`appendTelosRefined: invalid payload.did (DID_RE failed)`);
    }
    if (payload.did !== actorDid) {
        throw new TypeError(`appendTelosRefined: payload.did must equal actorDid (self-report invariant)`);
    }
    // ... per-field regex guards ...

    // 2. Closed-tuple check — any extra key = contract drift, refuse to emit.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendTelosRefined: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 3. Explicit object reconstruction — guarantees no prototype pollution.
    const cleanPayload = {
        did: payload.did,
        before_goal_hash: payload.before_goal_hash,
        after_goal_hash: payload.after_goal_hash,
        triggered_by_dialogue_id: payload.triggered_by_dialogue_id,
    };

    // 4. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendTelosRefined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 5. Commit to the chain.
    return audit.append('telos.refined', actorDid, cleanPayload);
}
```

**Apply to Ananke:**

- Function: `appendAnankeDriveCrossed(audit, actorDid, payload: DriveCrossedPayload): AuditEntry`
- `EXPECTED_KEYS = ['did', 'direction', 'drive', 'level', 'tick'] as const` (5 keys, alphabetical)
- Per-field guards:
  - `actorDid` and `payload.did` — `DID_RE` (reuse from telos-refined.ts line 30)
  - `payload.did === actorDid` self-report invariant
  - `payload.tick` — non-negative integer: `Number.isInteger(tick) && tick >= 0`
  - `payload.drive` — `DRIVE_NAMES.has(payload.drive)` (frozen Set from `grid/src/ananke/types.ts`)
  - `payload.level` — `DRIVE_LEVELS.has(payload.level)`
  - `payload.direction` — `DRIVE_DIRECTIONS.has(payload.direction)`
- `cleanPayload` explicit reconstruction with exactly the 5 keys
- `audit.append('ananke.drive_crossed', actorDid, cleanPayload)`

**DID_RE reuse** — already locked at 4 entry points (Phase 6 × 3 + Phase 7); Phase 8 file `append-nous-deleted.ts:32` notes "locked at 4 entry points project-wide". Ananke becomes the 5th. The regex itself: `/^did:noesis:[a-z0-9_\-]+$/i` (`append-telos-refined.ts:30`).

**Secondary reference for 8-step defense depth:** `grid/src/audit/append-nous-deleted.ts:60-133` uses literal guards (tier === 'H5', action === 'delete') — not applicable to Ananke (no literal-constant fields) but shows the defense-in-depth rhythm.

---

### `grid/src/ananke/types.ts` (frozen enums)

**Analog:** `grid/src/relationships/config.ts` (frozen-object-as-const pattern) + `grid/src/audit/broadcast-allowlist.ts:78-89` (frozen Set with overridden mutation methods).

**Frozen-object pattern** (`grid/src/relationships/config.ts:29-44`):

```typescript
export const DEFAULT_RELATIONSHIP_CONFIG: RelationshipConfig = Object.freeze({
    tau: 1000,
    bumpSpokeValence: 0.01,
    // ...
    warmthColdMax: 0.20,
    warmthWarmMax: 0.60,
} as const);
```

**Apply to Ananke:** export frozen Sets:

```typescript
export const DRIVE_NAMES: ReadonlySet<string> = Object.freeze(
    new Set(['hunger', 'curiosity', 'safety', 'boredom', 'loneliness'] as const)
);
export const DRIVE_LEVELS: ReadonlySet<string> = Object.freeze(
    new Set(['low', 'med', 'high'] as const)
);
export const DRIVE_DIRECTIONS: ReadonlySet<string> = Object.freeze(
    new Set(['rising', 'falling'] as const)
);
```

For hard-frozen Sets (mutation throws), use the `buildFrozenAllowlist` helper pattern in `broadcast-allowlist.ts:78-89` if the test suite will attempt `.add()` to verify frozen-ness.

---

### `grid/src/integration/types.ts` (BrainAction union widening)

**Analog:** `TelosRefinedAction` interface + its inclusion in `BrainAction` union (`types.ts:70-88`):

```typescript
export interface TelosRefinedAction {
    action_type: 'telos_refined';
    channel: string;
    text: string;
    metadata: {
        before_goal_hash: string;
        after_goal_hash: string;
        triggered_by_dialogue_id: string;
        [key: string]: unknown;
    };
}

export type BrainAction =
    | SpeakAction
    | DirectMessageAction
    | MoveAction
    | NoopAction
    | TradeRequestAction
    | TelosRefinedAction;
```

**Apply to Ananke:** add `DriveCrossedAction` with `action_type: 'drive_crossed'` and `metadata: { drive: string; level: string; direction: string; [key: string]: unknown }`. Extend `BrainAction` union.

---

### `grid/src/integration/nous-runner.ts` (case dispatcher)

**Analog:** `case 'telos_refined':` (nous-runner.ts:326-368) — the primary template.

**Full block to clone structurally** (nous-runner.ts:326-368):

```typescript
case 'telos_refined': {
    // Phase 7 DIALOG-02 (D-16 validation, D-17 sole producer path, D-31 self-report).
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    const dialogueId = typeof md['triggered_by_dialogue_id'] === 'string'
        ? (md['triggered_by_dialogue_id'] as string) : '';
    const beforeHash = typeof md['before_goal_hash'] === 'string'
        ? (md['before_goal_hash'] as string) : '';
    const afterHash = typeof md['after_goal_hash'] === 'string'
        ? (md['after_goal_hash'] as string) : '';

    if (!this.recentDialogueIds.has(dialogueId)) {
        break;  // D-16: unknown dialogue id → drop silently
    }

    try {
        appendTelosRefined(this.audit, this.nousDid, {
            did: this.nousDid,           // self-report — matches actorDid per D-31
            before_goal_hash: beforeHash,
            after_goal_hash: afterHash,
            triggered_by_dialogue_id: dialogueId,
        });
    } catch {
        // Producer-boundary rejection → drop silently
    }
    break;
}
```

**Apply to Ananke (`case 'drive_crossed':`):**

```typescript
case 'drive_crossed': {
    // Phase 10a DRIVE-03 sole producer path.
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    const drive = typeof md['drive'] === 'string' ? md['drive'] as string : '';
    const level = typeof md['level'] === 'string' ? md['level'] as string : '';
    const direction = typeof md['direction'] === 'string' ? md['direction'] as string : '';

    try {
        appendAnankeDriveCrossed(this.audit, this.nousDid, {
            did: this.nousDid,
            tick: tick,        // injected by runner (Grid owns WorldClock)
            drive,
            level,
            direction,
        });
    } catch {
        // Producer-boundary rejection → drop silently
    }
    break;
}
```

**Critical:** `tick` is passed in from the runner's tick context (Grid-side), NOT from the Brain metadata (RESEARCH.md §Pattern 4, 3-keys-not-5 invariant). The runner currently has `tick` in scope at the dispatcher level; confirm during planning.

---

### `grid/src/audit/broadcast-allowlist.ts` (modified — 18 → 19)

**Analog:** the file itself, lines 37-66 (the `ALLOWLIST_MEMBERS` tuple) and line 100 (`FORBIDDEN_KEY_PATTERN`).

**Current tuple tail** (lines 62-66):

```typescript
// Phase 8 (AGENCY-05) — H5 Sovereign Operations. Closed 5-key payload:
// {tier: 'H5', action: 'delete', operator_id, target_did, pre_deletion_state_hash}.
// Emitted ONLY via appendNousDeleted() (grid/src/audit/append-nous-deleted.ts).
'operator.nous_deleted',
] as const;
```

**Change — append position 19 immediately before `] as const`:**

```typescript
// Phase 10a (DRIVE-03) — threshold crossing for the 5 Ananke drives.
// Closed 5-key payload: {did, tick, drive, level, direction} — NO numeric drive_value
// crosses the wire (DRIVE-05). Emitted ONLY via appendAnankeDriveCrossed()
// (grid/src/ananke/append-drive-crossed.ts).
'ananke.drive_crossed',
```

**Current `FORBIDDEN_KEY_PATTERN`** (line 100):

```typescript
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta/i;
```

**Change — extend to cover DRIVE_FORBIDDEN_KEYS (D-10a-07):**

```typescript
export const FORBIDDEN_KEY_PATTERN =
    /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value/i;
```

**Caveat:** `curiosity` and `safety` are also semantic words. The regex is a substring match on **payload keys only** (see `payloadPrivacyCheck` walker at lines 116-146 — iterates `Object.keys(node)`). Planner must verify no existing allowlisted payload uses `curiosity`/`safety` as a legitimate key (none found in Phase 6 telos/operator payloads or Phase 7 telos.refined 4-key tuple; confirm with grep in planning).

---

### `grid/test/audit/ananke-drive-crossed-privacy.test.ts` (privacy matrix)

**Analog:** `grid/test/audit/telos-refined-privacy.test.ts` (verbatim structure, swap event type and payload).

**Full template** (telos-refined-privacy.test.ts:21-66):

```typescript
const happy = {
    did: 'did:noesis:alpha',
    before_goal_hash: 'a'.repeat(64),
    after_goal_hash: 'b'.repeat(64),
    triggered_by_dialogue_id: 'c'.repeat(16),
};

const FORBIDDEN_CASES: Array<[string, Record<string, unknown>]> = [
    ['prompt',          { ...happy, prompt: 'leak' }],
    ['response',        { ...happy, response: 'leak' }],
    ['wiki',            { ...happy, wiki: 'leak' }],
    ['reflection',      { ...happy, reflection: 'leak' }],
    ['thought',         { ...happy, thought: 'leak' }],
    ['emotion_delta',   { ...happy, emotion_delta: 0.5 }],
    ['nested.prompt',   { ...happy, meta: { prompt: 'leak deep' } }],
];

describe('telos.refined — privacy matrix (D-21, D-22)', () => {
    it('allowlist enumeration includes telos.refined (coverage assertion)', () => {
        expect(ALLOWLIST.has('telos.refined')).toBe(true);
    });

    it('happy baseline — well-formed payload appends successfully', () => {
        expect(() => appendTelosRefined(chain, happy.did, happy)).not.toThrow();
        // ...
    });

    it.each(FORBIDDEN_CASES)('rejects payload with forbidden key %s', (_label, bad) => {
        expect(() => appendTelosRefined(chain, happy.did, bad as typeof happy))
            .toThrow(/unexpected key|privacy violation/i);
    });
});
```

**Apply to Ananke:** `happy = { did, tick: 42, drive: 'hunger', level: 'med', direction: 'rising' }`. Extend `FORBIDDEN_CASES` to cover the 6 inherited forbidden keys PLUS the 6 new DRIVE_FORBIDDEN_KEYS (hunger/curiosity/safety/boredom/loneliness/drive_value) — though most of these are also legitimate drive enum values; test them as **keys** not values: `{ ...happy, hunger: 0.7 }` should fail (adds extra key AND trips extended FORBIDDEN_KEY_PATTERN).

Additionally, parametrize across the 5 drives × 3 levels × 2 directions = 30 happy cases to cover D-10a-08 closed-enum coverage.

---

### `grid/test/audit/ananke-drive-crossed-producer-boundary.test.ts`

**Analog:** `grid/test/audit/telos-refined-producer-boundary.test.ts` (verbatim).

**Full file to clone** (telos-refined-producer-boundary.test.ts:1-47):

```typescript
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-telos-refined.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('telos.refined — sole producer boundary (D-31)', () => {
    it('no file in grid/src/ except append-telos-refined.ts directly emits telos.refined', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]telos\.refined['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });
    // ...
});
```

**Apply to Ananke:** swap two strings:
- `SOLE_PRODUCER_FILE = 'ananke/append-drive-crossed.ts'`
- pattern: `['"]ananke\.drive_crossed['"]`
- test description: `'ananke.drive_crossed — sole producer boundary (D-10a-03)'`

---

### `grid/test/ananke/determinism-source.test.ts` (wall-clock ban)

**Analog:** `grid/test/relationships/determinism-source.test.ts` (verbatim, lines 1-45).

Swap `GRID_SRC = join(__dirname, '../../src/relationships')` → `join(__dirname, '../../src/ananke')`. The pattern regex stays identical:

```typescript
const WALL_CLOCK_PATTERN = /\b(?:Date\.now|performance\.now|setInterval|setTimeout|Math\.random)\b/;
```

---

### `grid/test/ci/ananke-no-walltime.test.ts` (cross-language determinism gate)

**Analog:** same `determinism-source.test.ts` shape, but expand the walk to include `brain/src/noesis_brain/ananke/**`. The `brain/` path is relative from `grid/test/` as `../../brain/src/noesis_brain/ananke`. The pattern for Python is slightly different — ban `time.time`, `time.monotonic`, `datetime.now`, `random.random`:

```typescript
const PY_WALL_CLOCK_PATTERN = /\b(?:time\.time|time\.monotonic|datetime\.now|random\.random|random\.Random)\b/;
```

This is an extension pattern, not a direct clone; planner locks the exact regex. The `readFileSync + walk` infrastructure from determinism-source.test.ts transfers unchanged.

---

### `grid/test/ananke/allowlist-nineteen.test.ts`

**Analog:** `grid/test/audit/allowlist-eighteen.test.ts` (verbatim, extend tuple by one).

**Full pattern** (allowlist-eighteen.test.ts:14-53):

```typescript
const EXPECTED_ORDER = [
    'nous.spawned',
    // ... 17 entries ...
    'operator.nous_deleted',  // position 18
] as const;

describe('broadcast allowlist — Phase 8 invariant (AGENCY-05 D-23/D-24)', () => {
    it('contains exactly 18 members', () => {
        expect(ALLOWLIST.size).toBe(18);
    });

    it('includes operator.nous_deleted', () => {
        expect(ALLOWLIST.has('operator.nous_deleted')).toBe(true);
    });

    it('preserves Phase 6/7 order and appends operator.nous_deleted last', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
    });

    it('is frozen — mutation attempts throw', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('malicious.event')).toThrow(TypeError);
    });
});
```

**Apply to Ananke:** extend `EXPECTED_ORDER` with `'ananke.drive_crossed'` at position 19, assert `.size === 19`, and **delete or rename** `allowlist-eighteen.test.ts` so the two tests don't conflict. (Plan 10a_XX must document the rename — this follows Phase 8's precedent of superseding Phase 7's `allowlist-seventeen.test.ts`.)

---

### `dashboard/src/app/grid/components/inspector-sections/ananke.tsx`

**Primary analog:** `thymos.tsx` (section shell, lines 18-46) for the `<section data-testid="section-X" aria-labelledby="section-X-title">` shell.

**Secondary analog:** `relationships.tsx` H1 branch (lines 236-279) for the per-row pattern `<li> dot + glyph + name + bucket label`.

**Section shell to clone** (thymos.tsx:22-45):

```tsx
<section
    data-testid="section-thymos"
    aria-labelledby="section-thymos-title"
    className="mb-4"
>
    <h3
        id="section-thymos-title"
        className="mb-2 text-sm font-semibold text-neutral-100"
    >
        Thymos
    </h3>
    {/* ... rows ... */}
</section>
```

**Row pattern — H1 warmth rendering** (relationships.tsx:242-277):

```tsx
{edges.slice(0, 5).map((edge, i) => {
    const bucket = edge.warmth_bucket;
    return (
        <li
            key={edge.edge_hash || i}
            data-testid={`relationship-row-${i}`}
            className="flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
        >
            <div className="flex items-center gap-2">
                <span
                    data-testid={`relationship-warmth-dot-${i}`}
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 rounded-full ${WARMTH_DOT_CLASS[bucket]}`}
                />
                <code
                    data-testid={`relationship-counterparty-${i}`}
                    className="font-mono text-xs text-neutral-400"
                >
                    {edge.counterparty_did}
                </code>
                <span
                    data-testid={`relationship-bucket-${i}`}
                    className={`ml-auto text-xs ${WARMTH_TEXT_CLASS[bucket]}`}
                    aria-label={bucket}
                >
                    {bucket}
                </span>
            </div>
        </li>
    );
})}
```

**Palette constants** (relationships.tsx:41-57):

```tsx
const WARMTH_DOT_CLASS: Record<'cold' | 'warm' | 'hot', string> = {
    cold: 'bg-neutral-400',
    warm: 'bg-amber-400',
    hot: 'bg-rose-400',
};

const WARMTH_TEXT_CLASS: Record<'cold' | 'warm' | 'hot', string> = {
    cold: 'text-neutral-400',
    warm: 'text-amber-400',
    hot: 'text-rose-400',
};
```

**Apply to Ananke** (exact JSX contract already specified in `10a-UI-SPEC.md:142-196`):

- 5 rows keyed by `DRIVE_ORDER = ['hunger', 'curiosity', 'safety', 'boredom', 'loneliness']` (from `ananke-types.ts`).
- `LEVEL_STYLE[level].dotClass` = `bg-neutral-400 | bg-amber-400 | bg-rose-400` (direct clone of `WARMTH_DOT_CLASS` rebucketed as `low|med|high`).
- `LEVEL_STYLE[level].textClass` = `text-neutral-400 | text-amber-400 | text-rose-400` (direct clone of `WARMTH_TEXT_CLASS`).
- Per-row data attrs: `data-drive`, `data-level`, `data-direction` (all enum strings, never floats — D-10a-07).
- `aria-label` on the level span: template `` `${drive} level ${level}${direction ? `, ${direction}` : ''}` `` (UI-SPEC §Accessibility Matrix).
- Props: `{ did: string | null }`; use `useAnankeLevels(did)` hook to read `Map<drive, {level, direction|null}>`; baseline fallback when no event has landed.

---

### `dashboard/src/lib/hooks/use-ananke-levels.ts`

**Analog:** `dashboard/src/lib/hooks/use-refined-telos-history.ts` — **primary template, clone line-for-line.**

**Full template** (use-refined-telos-history.ts:24-83):

```typescript
import { useMemo } from 'react';
import { useFirehose } from '@/app/grid/hooks';

const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;

interface TelosRefinedPayload {
    did: string;
    before_goal_hash: string;
    after_goal_hash: string;
    triggered_by_dialogue_id: string;
}

function isValidPayload(p: unknown, targetDid: string): p is TelosRefinedPayload {
    if (typeof p !== 'object' || p === null) return false;
    const r = p as Record<string, unknown>;
    return (
        r.did === targetDid &&
        typeof r.triggered_by_dialogue_id === 'string' &&
        DIALOGUE_ID_RE.test(r.triggered_by_dialogue_id) &&
        // ...
    );
}

export function useRefinedTelosHistory(did: string | null): RefinedTelosHistory {
    const snap = useFirehose();
    return useMemo<RefinedTelosHistory>(() => {
        if (!did) return EMPTY;
        const matches = snap.entries.filter(
            (e) => e.eventType === 'telos.refined' && isValidPayload(e.payload, did),
        );
        if (matches.length === 0) return EMPTY;
        const last = matches[matches.length - 1]!;
        // ... reduce into summary ...
    }, [did, snap.entries]);
}
```

**Apply to Ananke:**

```typescript
import { useMemo } from 'react';
import { useFirehose } from '@/app/grid/hooks';
import { DRIVE_BASELINE_LEVEL, type DriveName, type DriveLevel, type DriveDirection } from '@/lib/protocol/ananke-types';

const DRIVES: readonly DriveName[] = ['hunger', 'curiosity', 'safety', 'boredom', 'loneliness'];
const LEVELS = new Set(['low', 'med', 'high']);
const DIRECTIONS = new Set(['rising', 'falling']);

interface DriveCrossedPayload {
    did: string;
    tick: number;
    drive: DriveName;
    level: DriveLevel;
    direction: DriveDirection;
}

function isValidPayload(p: unknown, targetDid: string): p is DriveCrossedPayload {
    if (typeof p !== 'object' || p === null) return false;
    const r = p as Record<string, unknown>;
    return (
        r.did === targetDid &&
        typeof r.tick === 'number' && Number.isInteger(r.tick) && r.tick >= 0 &&
        typeof r.drive === 'string' && DRIVES.includes(r.drive as DriveName) &&
        typeof r.level === 'string' && LEVELS.has(r.level as string) &&
        typeof r.direction === 'string' && DIRECTIONS.has(r.direction as string)
    );
}

export interface AnankeLevelsSnapshot {
    readonly levels: ReadonlyMap<DriveName, { level: DriveLevel; direction: DriveDirection | null }>;
}

export function useAnankeLevels(did: string | null): AnankeLevelsSnapshot {
    const snap = useFirehose();
    return useMemo<AnankeLevelsSnapshot>(() => {
        // Start from baseline for all 5 drives
        const levels = new Map<DriveName, { level: DriveLevel; direction: DriveDirection | null }>();
        for (const d of DRIVES) {
            levels.set(d, { level: DRIVE_BASELINE_LEVEL[d], direction: null });
        }
        if (!did) return { levels };
        // Walk firehose; most-recent-wins per (did, drive)
        for (const e of snap.entries) {
            if (e.eventType !== 'ananke.drive_crossed') continue;
            if (!isValidPayload(e.payload, did)) continue;
            const p = e.payload;
            levels.set(p.drive, { level: p.level, direction: p.direction });
        }
        return { levels };
    }, [did, snap.entries]);
}
```

**Silent-drop at hook boundary** — matches `use-refined-telos-history.ts` comment at line 13 ("Malformed events silently dropped — matches 07-UI-SPEC §State Contract").

---

### `dashboard/src/lib/protocol/ananke-types.ts` (SYNC mirror)

**Analog:** `dashboard/src/lib/protocol/agency-types.ts` (lines 1-21, SYNC-header pattern).

**Full template** (agency-types.ts:1-21):

```typescript
/**
 * SYNC: grid/src/api/types.ts (Phase 6 tier types)
 *
 * Two-source copy intentional — Grid and dashboard are separate packages.
 * If one side changes, update the other in the same commit.
 */

export type HumanAgencyTier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export const TIER_NAME: Record<HumanAgencyTier, string> = {
    H1: 'Observer',
    // ...
};
```

**Apply to Ananke** (per UI-SPEC §Baseline lines 322-333):

```typescript
/**
 * SYNC: brain/src/noesis_brain/ananke/config.py DRIVE_BASELINES
 * (or wherever planner places the Brain-side constant).
 *
 * Drift is detected by dashboard/test/lib/ananke-types.drift.test.ts
 * which reads the Python source and fails if values diverge.
 */

export type DriveName = 'hunger' | 'curiosity' | 'safety' | 'boredom' | 'loneliness';
export type DriveLevel = 'low' | 'med' | 'high';
export type DriveDirection = 'rising' | 'falling';

export const DRIVE_BASELINE_LEVEL: Record<DriveName, DriveLevel> = {
    hunger: 'low',       // mirrors baseline 0.3 bucketed
    curiosity: 'med',    // mirrors baseline 0.5 bucketed
    safety: 'low',       // mirrors baseline 0.2 bucketed
    boredom: 'med',      // mirrors baseline 0.4 bucketed
    loneliness: 'med',   // mirrors baseline 0.4 bucketed
};
```

Exact numeric baselines are planner's decision (CONTEXT §Claude's Discretion). Dashboard stores only the bucketed level, **never the float** (D-10a-07 enforcement at the mirror boundary).

---

## Shared Patterns

### Pattern: Regex-locked DID + self-report invariant

**Source:** `grid/src/audit/append-telos-refined.ts:30, 55-64`
**Apply to:** `grid/src/ananke/append-drive-crossed.ts`

```typescript
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

// In the emitter:
if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) throw new TypeError(...);
if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) throw new TypeError(...);
if (payload.did !== actorDid) throw new TypeError('... self-report invariant');
```

### Pattern: Closed-tuple structural check

**Source:** `grid/src/audit/append-telos-refined.ts:40-82` (D-11 pattern, Phase 6)
**Apply to:** `grid/src/ananke/append-drive-crossed.ts`

```typescript
const EXPECTED_KEYS = ['did', 'direction', 'drive', 'level', 'tick'] as const;

const actualKeys = Object.keys(payload).sort();
if (actualKeys.length !== EXPECTED_KEYS.length
    || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
    throw new TypeError(`appendAnankeDriveCrossed: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
}
```

### Pattern: Belt-and-suspenders privacy gate

**Source:** `grid/src/audit/append-telos-refined.ts:93-100` + `broadcast-allowlist.ts:116-146` walker
**Apply to:** every emitter (always call `payloadPrivacyCheck(cleanPayload)` as last step before `audit.append`)

```typescript
const privacy = payloadPrivacyCheck(cleanPayload);
if (!privacy.ok) {
    throw new TypeError(
        `appendAnankeDriveCrossed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
    );
}
return audit.append('ananke.drive_crossed', actorDid, cleanPayload);
```

### Pattern: Explicit payload reconstruction

**Source:** `grid/src/audit/append-telos-refined.ts:85-91`
**Apply to:** all emitters

```typescript
// NEVER use spread on caller-supplied payload — prototype pollution risk
const cleanPayload = {
    did: payload.did,
    tick: payload.tick,
    drive: payload.drive,
    level: payload.level,
    direction: payload.direction,
};
```

### Pattern: Wall-clock ban grep gate

**Source:** `grid/test/relationships/determinism-source.test.ts` (full file, 45 lines)
**Apply to:**
- `grid/test/ananke/determinism-source.test.ts` (TS side — verbatim, swap path)
- `grid/test/ci/ananke-no-walltime.test.ts` (cross-language extension — cover Brain Python side)

```typescript
const WALL_CLOCK_PATTERN = /\b(?:Date\.now|performance\.now|setInterval|setTimeout|Math\.random)\b/;
// walk subtree, readFileSync each .ts, assert toEqual([])
```

### Pattern: Allowlist position-locked tuple

**Source:** `grid/test/audit/allowlist-eighteen.test.ts`
**Apply to:** `grid/test/ananke/allowlist-nineteen.test.ts` (supersedes the eighteen test)

The `.size === N` assertion + `[...ALLOWLIST] === [...EXPECTED_ORDER]` array-equality is the regression fence against silent allowlist drift.

### Pattern: Brain Action construction (3-keys-not-5)

**Source:** `brain/src/noesis_brain/rpc/handler.py:520-530` (`_build_refined_telos` return statement)
**Apply to:** `brain/src/noesis_brain/rpc/handler.py` — ananke tick block

Brain metadata carries ONLY the fields Grid cannot know locally. `did` and `tick` are Grid-side (WorldClock + Nous registry), so Ananke metadata is exactly `{drive, level, direction}`.

### Pattern: Firehose-derived hook with silent-drop validation

**Source:** `dashboard/src/lib/hooks/use-refined-telos-history.ts` (full file)
**Apply to:** `dashboard/src/lib/hooks/use-ananke-levels.ts`

- `useFirehose()` → `snap.entries`
- `useMemo` over `[did, snap.entries]`
- Inline payload shape guard (regex or Set-membership) — malformed events silently dropped
- Stable reference return (freeze the outer container if reducing to a `ReadonlyMap`)

### Pattern: SYNC-header drift detector for cross-package protocol mirrors

**Source:** `dashboard/src/lib/protocol/agency-types.ts` header (lines 1-7) + Phase 6 Plan 06-02 STATE.md note
**Apply to:** `dashboard/src/lib/protocol/ananke-types.ts` + `dashboard/test/lib/ananke-types.drift.test.ts`

Hand-copied mirror with an `fs.readFileSync` drift test that parses the Brain-side source of truth and fails on divergence. Planner confirms exact Brain file path for `DRIVE_BASELINES`.

### Pattern: Section shell (Inspector drawer)

**Source:** `dashboard/src/app/grid/components/inspector-sections/thymos.tsx:22-45`
**Apply to:** `ananke.tsx`

All sibling sections share: `<section data-testid="section-X" aria-labelledby="section-X-title" className="mb-4">`, `<h3 id="section-X-title" className="mb-2 text-sm font-semibold text-neutral-100">`, row container. No new primitives.

### Pattern: Three-bucket warmth palette (re-used as three-bucket level palette)

**Source:** `dashboard/src/app/grid/components/inspector-sections/relationships.tsx:41-57` (`WARMTH_DOT_CLASS` + `WARMTH_TEXT_CLASS`)
**Apply to:** `ananke.tsx` as `LEVEL_STYLE`

Direct palette re-use is deliberate (UI-SPEC §Level Bucket Color Encoding) — both scales are three-bucket ordinal over a derived inner-state dimension in the same drawer.

### Pattern: Frozen config via Object.freeze(... as const)

**Source:** `grid/src/relationships/config.ts:29-44`
**Apply to:** `grid/src/ananke/types.ts` (frozen DRIVE_NAMES/LEVELS/DIRECTIONS Sets) and `brain/src/noesis_brain/ananke/types.py` (DriveConfig as `@dataclass(frozen=True)`)

---

## No Analog Found

One file has no close match; planner falls back to RESEARCH.md §Code Examples for the shape.

| File | Role | Data Flow | Reason | Fallback source |
|------|------|-----------|--------|-----------------|
| `brain/src/noesis_brain/ananke/drives.py` | pure closed-form `update(state, seed, tick, config)` | deterministic transform | No existing pure-Python `f(seed, tick)` recurrence in Brain; the closest shape is Phase 9's TS `decayedWeight` (cross-language) | RESEARCH.md §Pattern 1 (lines 253-285) provides literal pseudocode — planner transliterates to Python |
| `grid/test/ananke/audit-ceiling.test.ts` | 1000-tick × 5-drives × 1-Nous ≤ 50 entries regression | performance + correctness | No existing audit-ceiling test in the repo; closest is `grid/test/relationships/perf-10k.test.ts` (throughput, not ceiling) | RESEARCH.md §Validation Architecture — planner writes from scratch using `AuditChain` + a fake `AnankeRuntime` loop |
| `grid/test/ci/ananke-no-walltime.test.ts` (Python regex half) | wall-clock ban on `brain/src/noesis_brain/ananke/**` | cross-language fs grep | Existing `determinism-source.test.ts` is TS-only (reads `.ts` files, TS-specific regex) | RESEARCH.md §Pitfalls Pitfall 1 + CONTEXT D-10a-05 — planner locks Python-specific regex |

---

## Metadata

**Analog search scope:**
- `brain/src/noesis_brain/` (psyche, telos, thymos, rpc) — direct sibling analogs
- `grid/src/audit/` — sole-producer emitter templates (telos-refined, nous-deleted)
- `grid/src/relationships/` — deterministic `(seed, tick)` precedent + config-freeze pattern
- `grid/src/integration/` — BrainAction union + case dispatcher precedent
- `grid/test/audit/` + `grid/test/relationships/` — producer-boundary, privacy-matrix, allowlist-freeze, determinism-source test shapes
- `dashboard/src/app/grid/components/inspector-sections/` — section-shell + row-rendering precedent (psyche, thymos, telos, relationships)
- `dashboard/src/lib/hooks/` — firehose-derived hook precedent (use-refined-telos-history)
- `dashboard/src/lib/protocol/` — SYNC-header cross-package mirror (agency-types)

**Files Read (non-overlapping):**
- `brain/src/noesis_brain/psyche/{__init__.py, types.py, loader.py}` (full)
- `brain/src/noesis_brain/thymos/{__init__.py, types.py, tracker.py}` (full)
- `brain/src/noesis_brain/telos/{__init__.py, manager.py#1-60}` (partial)
- `brain/src/noesis_brain/rpc/{types.py, handler.py#460-540}` (targeted)
- `brain/test/{test_thymos.py, test_psyche.py#1-60, test_telos_refined_action.py}` (full / partial)
- `grid/src/audit/{append-telos-refined.ts, append-nous-deleted.ts, broadcast-allowlist.ts, chain.ts#1-40}`
- `grid/src/relationships/{canonical.ts, config.ts}`
- `grid/src/integration/{types.ts, nous-runner.ts#300-380}`
- `grid/test/audit/{telos-refined-privacy.test.ts, telos-refined-producer-boundary.test.ts, allowlist-eighteen.test.ts, nous-deleted-privacy.test.ts#1-80}`
- `grid/test/relationships/determinism-source.test.ts`
- `dashboard/src/app/grid/components/inspector-sections/{thymos.tsx, psyche.tsx, telos.tsx, telos.test.tsx, relationships.tsx}`
- `dashboard/src/app/grid/{hooks.ts, components/inspector.tsx#1-80, 370-400}`
- `dashboard/src/lib/hooks/use-refined-telos-history.ts`
- `dashboard/src/lib/protocol/agency-types.ts`

**Pattern extraction date:** 2026-04-21
