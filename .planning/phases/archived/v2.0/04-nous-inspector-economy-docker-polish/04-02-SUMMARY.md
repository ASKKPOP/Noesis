---
phase: 04-nous-inspector-economy-docker-polish
plan: 02
subsystem: brain
tags: [python, rpc, json-rpc, introspection, dashboard, psyche, thymos, telos, episodic-memory, did]

requires:
  - phase: 01-wave-0-foundations
    provides: "EpisodicMemoryStream with recent(limit=...) accessor"
  - phase: 01-wave-0-foundations
    provides: "Psyche / Thymos / Telos dataclasses + managers"
provides:
  - "Widened BrainHandler.get_state() RPC payload: strict superset of the legacy shape, locking the Inspector contract for plans 03 and 05"
  - "BrainHandler constructor now accepts memory + did keyword args (A-1 prerequisite resolved)"
  - "create_brain_app constructs an in-memory MemoryStream and derives did:noesis:<slug(nous_name)> (or honours NOUS_DID)"
affects: [plan-04-03, plan-04-05, plan-04-06, dashboard-inspector, grid-api-v1-nous-did-state]

tech-stack:
  added: []
  patterns:
    - "Additive RPC shape evolution (new keys only; legacy keys preserved byte-for-byte)"
    - "sha256(description)[:12] stable id synthesis when a dataclass lacks a primary-key attribute"
    - "Normalised memory-entry shape {timestamp, kind, summary} at the RPC boundary"

key-files:
  created:
    - "brain/test/test_get_state_widening.py"
  modified:
    - "brain/src/noesis_brain/rpc/handler.py"
    - "brain/src/noesis_brain/__main__.py"
    - "brain/test/test_main.py"

key-decisions:
  - "neuroticism is synthesised as (1.0 - resilience) because Psyche has no neuroticism attribute; both resilience and ambition are also exposed additively to preserve in-tree fidelity (A-3 executor discretion)."
  - "Memory store is in-memory SQLite (:memory:) for Phase 4 — Phase 4 does not add persistence; MemoryStore on a real file path is a future-phase decision."
  - "did defaults to did:noesis:<slug(nous_name)> when NOUS_DID is unset; slug = re.sub(r'[^a-z0-9_-]+', '-', name.lower()).strip('-')."
  - "The plan references brain/src/noesis_brain/main.py but the actual entry-point module is __main__.py. Changes landed in __main__.py (verified via `python -m noesis_brain` and existing test_main.py)."

patterns-established:
  - "RPC shape evolution: when a field's shape must change (emotions: str -> dict[str, float]), keep the legacy key at the top level and introduce a new structured key under a sub-dict — both callers (old and new) read independently."
  - "Executor prerequisite ordering: when get_state() references self.memory and self.did, widen __init__ first so the references resolve during the same commit as the shape change (A-1 enforced)."

requirements-completed: [NOUS-01, NOUS-02]

duration: 18min
completed: 2026-04-18
---

# Phase 04 Plan 02: Widen Brain get_state Summary

**BrainHandler.get_state() now returns a strict superset carrying Big-Five floats, structured Thymos, goal records with stable ids, and up-to-5 normalised memory highlights — unblocking the dashboard Inspector (NOUS-01 + NOUS-02) without breaking any legacy caller.**

## Outcome

The dashboard Inspector needs four sub-panels of introspective data; every byte flows through a single RPC call. This plan landed the widened shape and its A-1 prerequisite (plumbing `memory` and `did` through `BrainHandler.__init__`) in a single wave so Plan 03's REST proxy has a stable contract to pass through.

Two tasks, both TDD-driven, both green with zero regressions across the 262-test brain suite.

## Final Locked Shape

An actual sample of `get_state()` output for a freshly-booted Sophia (no memories recorded yet):

```json
{
  "name": "Sophia",
  "archetype": "The Philosopher",
  "mood": "curious",
  "emotions": "Mood: curious (calm, no strong emotions)",
  "active_goals": [
    "Learn about the Grid",
    "Become foremost philosopher"
  ],
  "location": "Agora Central",
  "did": "did:noesis:sophia",
  "grid_name": "genesis",
  "psyche": {
    "openness": 0.8,
    "conscientiousness": 0.5,
    "extraversion": 0.5,
    "agreeableness": 0.8,
    "neuroticism": 0.5,
    "resilience": 0.5,
    "ambition": 0.8,
    "archetype": "The Philosopher"
  },
  "thymos": {
    "mood": "curious",
    "emotions": {
      "joy": 0.0,
      "sadness": 0.0,
      "anger": 0.0,
      "fear": 0.0,
      "trust": 0.0,
      "curiosity": 0.0
    }
  },
  "telos": {
    "active_goals": [
      {
        "id": "1c7660092b56",
        "description": "Learn about the Grid",
        "priority": 0.8
      },
      {
        "id": "36ed176f88df",
        "description": "Become foremost philosopher",
        "priority": 0.3
      }
    ]
  },
  "memory_highlights": []
}
```

### Contract Details

- **Legacy keys (unchanged):** `name`, `archetype`, `mood`, `emotions` (natural-language string), `active_goals` (list of description strings), `location`. Pre-existing callers (e.g. `test_rpc_handler.py::TestGetState`) keep working without modification.
- **New top-level keys:** `did`, `grid_name`, `psyche`, `thymos`, `telos`, `memory_highlights`.
- **`psyche`:** Five canonical Big-Five floats (0.0–1.0) plus additive `resilience`, `ambition`, `archetype`. Floats derived via `PersonalityProfile.get_numeric(...)` which maps the in-tree string levels (low/medium/high → 0.2/0.5/0.8). `neuroticism` synthesised as `max(0.0, min(1.0, 1.0 - resilience))` (executor deviation from the must_have names, see A-3).
- **`thymos`:** `{ mood: str, emotions: dict[str, float] }`. `mood` is the dominant emotion label (or the baseline when all intensities are <0.2). `emotions` is keyed by the six `Emotion` enum values (`joy`, `sadness`, `anger`, `fear`, `trust`, `curiosity`), values clamped to [0, 1].
- **`telos.active_goals`:** List of `{id, description, priority}`. `id` is `sha256(description)[:12]` when the `Goal` dataclass lacks an `id` (it currently does); `priority` is cast to `float`.
- **`memory_highlights`:** Up to 5 most recent entries in the order the memory accessor returned them (`MemoryStream.recent(limit=5)` = newest-first). Each entry is `{timestamp, kind, summary}`:
  - `timestamp` = `created_at.isoformat()` (JSON-safe, no raw datetime)
  - `kind` = `memory_type.value` (`observation` | `conversation` | `reflection` | `event`)
  - `summary` = raw `content` field (NOT truncated — downstream UI is responsible for `-webkit-line-clamp`)
- **Empty/None handling:** `memory is None` → `memory_highlights == []`; `did` unset → `""` (both exercised by tests).

## Memory Accessor Used

`MemoryStream.recent(limit: int, memory_type: MemoryType | None = None)` at
`brain/src/noesis_brain/memory/stream.py:86` — delegates to `MemoryStore.recent_memories()`.
Returns `list[Memory]` newest-first. No new method added to the memory module (A-2).

Adapter is defensive: if `self.memory.recent(...)` raises, `_memory_snapshot` logs a warning
and returns `[]` rather than propagating to the RPC caller. Duck-typing also accepts dicts
with `{created_at | timestamp, memory_type | kind, content | summary}` keys — so a future
swap to a different memory backend does not require another handler change.

## DID Slug Logic

When `NOUS_DID` is not set in the environment, `create_brain_app` composes:

```python
did = f"did:noesis:{re.sub(r'[^a-z0-9_-]+', '-', nous_name.lower()).strip('-')}"
```

- `"sophia"` → `"did:noesis:sophia"`
- `"Sophia Alpha!"` → `"did:noesis:sophia-alpha"` (spaces + punctuation collapse to `-`, trailing `-` stripped)
- `"---hermes---"` → `"did:noesis:hermes"` (leading/trailing `-` trimmed)

If `NOUS_DID` is present, it wins verbatim — letting operators pin a specific DID in
multi-shard deployments without touching the Nous name.

## Deviations from Plan

### Scope-compliant executor discretion

**1. [Rule 2 - Missing Schema Key] `neuroticism` synthesised from resilience**
- **Found during:** Task 1 (Psyche snapshot implementation)
- **Issue:** The plan's must_haves lock the five Big-Five keys as `openness / conscientiousness / extraversion / agreeableness / neuroticism`, but in-tree `PersonalityProfile` has `resilience` and `ambition` instead of `neuroticism`. The plan's behavior clause ("whatever attribute names the existing Psyche class uses — do NOT rename them") conflicts with its must_haves.
- **Fix:** Emit the contract-required `neuroticism = 1.0 - resilience` (resilience and neuroticism are inversely related in Big-Five literature), AND additively expose the original `resilience` and `ambition` floats so no in-tree information is lost. A-3 in PATTERNS.md explicitly grants executor discretion here.
- **Files modified:** `brain/src/noesis_brain/rpc/handler.py`
- **Commit:** a1daa84

**2. [Rule 3 - File Path Correction] Edits land in `__main__.py`, not `main.py`**
- **Found during:** Task 2 pre-implementation scan
- **Issue:** Plan text refers to `brain/src/noesis_brain/main.py`; actual module is `brain/src/noesis_brain/__main__.py` (the `python -m noesis_brain` entry point). No `main.py` exists.
- **Fix:** Applied all Task 2 changes to `__main__.py` — `create_brain_app` is the target function. Existing `test_main.py` already imports from `noesis_brain.__main__`, confirming this is the correct target.
- **Commit:** 40e2bc2

**3. [Rule 2 - Test Import] `sqlite_store` direct import**
- **Found during:** Task 1 test fixture
- **Issue:** `MemoryStream` requires an underlying `MemoryStore`; the plan suggested a `FakeMemory` class but the real `MemoryStream` is simple enough to use directly (SQLite `:memory:`), giving the test more signal than a hand-rolled fake.
- **Fix:** Fixture uses `MemoryStream(MemoryStore(":memory:"))` directly — tests the actual code path the production handler runs.
- **Files modified:** `brain/test/test_get_state_widening.py`
- **Commit:** d5bcbb1

### None — Rule 4 (architectural)

No architectural changes required.

## Tasks

| Task | Name                                                                 | Commits                 |
| ---- | -------------------------------------------------------------------- | ----------------------- |
| 1    | Widen BrainHandler.get_state + plumb memory/did into __init__ (TDD)  | d5bcbb1 (RED), a1daa84 (GREEN) |
| 2    | Wire memory + did through create_brain_app (TDD)                     | 22db912 (RED), 40e2bc2 (GREEN) |

## Verification

- **Targeted:** `cd brain && uv run pytest -q test/test_get_state_widening.py test/test_rpc_handler.py` → 26 passed
- **Full brain suite:** `cd brain && uv run pytest -q` → **262 passed** (257 prior + 5 new in Task 2; Task 1 added 9 new tests across 2 test files)
- **Acceptance criteria greps (Task 1):**
  - `grep -n "memory: Any = None" brain/src/noesis_brain/rpc/handler.py` → 1 match (line 42)
  - `grep -n "did: str =" brain/src/noesis_brain/rpc/handler.py` → 1 match (line 43)
  - `grep -c "memory_highlights" brain/src/noesis_brain/rpc/handler.py` → 4 (≥ 2)
  - `grep -c "_psyche_snapshot\|_memory_snapshot" brain/src/noesis_brain/rpc/handler.py` → 4 (≥ 4)
  - `grep -c "def test_" brain/test/test_get_state_widening.py` → 9 (≥ 5)
  - `grep -c "active_goals" brain/src/noesis_brain/rpc/handler.py` → 4 (≥ 2)
- **Acceptance criteria greps (Task 2):**
  - `grep -n "memory=" brain/src/noesis_brain/__main__.py` → 1 match (line 175)
  - `grep -n "did=" brain/src/noesis_brain/__main__.py` → 1 match (line 176)
  - `grep -c "BrainHandler(" brain/src/noesis_brain/__main__.py` → 1 (unique construction site)

## Threat Compliance

All register entries mitigated as planned:

| ID       | Mitigation Delivered                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| T-04-07  | Accept (scope) — no change. Dashboard is operator-only per CONTEXT D9.                |
| T-04-08  | Legacy keys covered by backward-compat test + untouched test_rpc_handler.py::TestGetState. |
| T-04-09  | `_memory_snapshot` hard-codes `limit=5`; accessor is never called without a limit.    |
| T-04-10  | Goal ids synthesised deterministically (sha256 prefix); stability test passes.        |

## Known Stubs

None. Every new field has a real producer:
- `psyche.*` ← `PersonalityProfile.get_numeric`
- `thymos.*` ← `ThymosTracker.mood.emotions` (the live mood state)
- `telos.active_goals` ← `TelosManager.active_goals()`
- `memory_highlights` ← `MemoryStream.recent(limit=5)`
- `did` ← env var override or slugified nous_name
- `grid_name` ← existing `BrainHandler.grid_name` (unchanged)

Memory is in-memory-only for Phase 4 (no persistence); this matches CONTEXT scope ("minimal shop registry, in-memory, no DB writes" pattern applies here too). Plans consuming memory persistence across restarts are deferred beyond Phase 4.

## Self-Check: PASSED

- **Files created:** `brain/test/test_get_state_widening.py` → FOUND
- **Files modified:** `brain/src/noesis_brain/rpc/handler.py` → FOUND, `brain/src/noesis_brain/__main__.py` → FOUND, `brain/test/test_main.py` → FOUND
- **Commits verified via `git log --oneline`:**
  - d5bcbb1 (test RED task 1) → FOUND
  - a1daa84 (feat GREEN task 1) → FOUND
  - 22db912 (test RED task 2) → FOUND
  - 40e2bc2 (feat GREEN task 2) → FOUND
- **Brain suite:** `pytest --collect-only` → 262 tests collected; `pytest -q` → 262 passed, 0 failed. New tests authored this plan: 9 (in new file `test_get_state_widening.py`) + 5 (added to existing `test_main.py::TestHandlerMemoryAndDidWiring`) = 14 new tests.
- **Acceptance criteria:** all 9 `grep`-based checks from both tasks pass (see sections above).
