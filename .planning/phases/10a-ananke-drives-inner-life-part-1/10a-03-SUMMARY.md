---
phase: 10a-ananke-drives-inner-life-part-1
plan: 03
subsystem: brain
tags: [ananke, drives, rpc, handler, advisory-logging, drive-crossed]
dependency_graph:
  requires: [10a-01]
  provides: [brain.ActionType.DRIVE_CROSSED, brain.BrainHandler.ananke-integration, brain.AnankeLoader]
  affects: [Plan 10a-04 Grid dispatcher consumption; Grid injects did+tick to complete the 5-key audit payload]
tech_stack:
  added: []
  patterns:
    - "Per-DID runtime registry in handler: `dict[str, AnankeRuntime]` keyed by DID"
    - "SHA-256-derived deterministic seed (no wall-clock input, T-10a-14 mitigation)"
    - "Advisory-only coupling: pure-observation `_advisory_log_divergence` — never mutates actions (PHILOSOPHY §6)"
    - "3-keys-not-5 metadata shape — Grid injects did+tick downstream (D-10a-03)"
    - "Loader-factory pattern cloned from psyche/loader.py"
key_files:
  created:
    - brain/src/noesis_brain/ananke/loader.py
    - brain/test/ananke/test_loader.py
    - brain/test/ananke/test_handler_ananke.py
  modified:
    - brain/src/noesis_brain/rpc/types.py
    - brain/src/noesis_brain/rpc/handler.py
decisions:
  - "Seed = int.from_bytes(sha256(did)[:8], 'big') — deterministic replay contract (T-10a-14)"
  - "Advisory log fires on EVERY on_tick when divergence is present — not just crossing ticks — so a sustained HIGH drive paired with non-matching actions is continuously observable to operators"
  - "Heuristic table: hunger→MOVE, curiosity→SPEAK, safety→MOVE, boredom→SPEAK, loneliness→DIRECT_MESSAGE (matches plan specification)"
  - "Handler's `on_tick` param parses `tick` defensively (int-coerce with fallback 0) — malformed Grid input drops to baseline-seed-zero tick rather than crashing"
metrics:
  duration: "~25 min"
  completed: 2026-04-22
  tasks: "2/2"
  commits: 4
  tests_added: 12
  tests_total: "353/353 passing"
---

# Phase 10a Plan 03: Brain-side Ananke Wire Integration Summary

Wired the Brain's RPC handler to consume AnankeRuntime crossings and lift them into `DRIVE_CROSSED` Actions with the 3-key metadata tuple `{drive, level, direction}` — establishing the Brain→Grid boundary for Plan 10a-04 to consume. Drive state remains Brain-local (float never crosses the wire); threshold crossings cross as closed-enum triples. Advisory divergence logging (PHILOSOPHY §6 sovereignty preservation) records HIGH-drive-vs-non-matching-action pairs as pure observation without mutating the Nous's chosen actions.

## Commits

| # | Hash      | Type     | Message                                                                |
|---|-----------|----------|------------------------------------------------------------------------|
| 1 | `66f2a4a` | test     | failing tests for AnankeLoader + ActionType.DRIVE_CROSSED              |
| 2 | `f7feea8` | feat     | add ActionType.DRIVE_CROSSED + AnankeLoader skeleton (Task 1 GREEN)    |
| 3 | `188e065` | test     | failing handler tests for DRIVE_CROSSED lift + advisory logging        |
| 4 | `04c8ffa` | feat     | wire BrainHandler to drain AnankeRuntime crossings into Actions (GREEN) |

TDD gate sequence: test → feat → test → feat (two RED/GREEN cycles, one per task).

## Work Completed

### Task 1 — ActionType.DRIVE_CROSSED + AnankeLoader skeleton

- **`brain/src/noesis_brain/rpc/types.py`**: inserted `DRIVE_CROSSED = "drive_crossed"` into `ActionType(str, Enum)` between `TELOS_REFINED` and `NOOP`. Closed enum now has exactly 7 members; `NOOP` remains last per convention.
- **`brain/src/noesis_brain/ananke/loader.py`** (new, 51 lines): `AnankeLoader` dataclass with `build(*, seed: int) -> AnankeRuntime`. Factory returns a fresh instance per call (never caches) — the caller owns per-DID memoisation. Cloned shape from `psyche/loader.py`.
- **`brain/test/ananke/test_loader.py`** (new, 76 lines, 6 tests): asserts loader produces fresh runtime per call, baseline initial state, enum membership and position invariants.

### Task 2 — Handler wiring + advisory logging

- **`brain/src/noesis_brain/rpc/handler.py`** (modified):
  - Imports: `AnankeRuntime`, `DriveLevel`, `DriveName` from `..ananke`; `AnankeLoader` from `..ananke.loader`.
  - `__init__`: added `self._ananke_loader = AnankeLoader()` and `self._ananke_runtimes: dict[str, AnankeRuntime] = {}`.
  - `on_tick`: after the existing dialogue-context branch and before returning, steps the per-DID runtime and appends one `DRIVE_CROSSED` Action per drained crossing, then invokes `_advisory_log_divergence`. Both the telos-refined branch and the NOOP-fallback branch are preserved; advisory logging runs on both so a sustained HIGH drive is always observable.
  - `_get_or_create_ananke(did)`: SHA-256-derived deterministic seed — `int.from_bytes(sha256(did.encode())[:8], 'big')`. No wall-clock input.
  - `_advisory_log_divergence(did, state, actions)`: pure observation. For each drive at `DriveLevel.HIGH`, if the matching action type (per `_DIVERGENCE_HEURISTIC` dict) is NOT in `actions`, emits `log.info("ananke.divergence drive=... level=high chose=...", extra={"event": "ananke.divergence", ...})`. **Never appends to, removes from, or indexes-assigns into `actions`** — verified by grep gate (`actions.remove`, `actions.pop`, `actions[0] =` all absent).
- **`brain/test/ananke/test_handler_ananke.py`** (new, 266 lines, 6 tests): baseline-empty-crossings, crossing→action lift, 3-key metadata shape, drain-on-first-call semantics, per-DID runtime independence, advisory-log-fires-without-mutation (asserts via `caplog` and checks the response list still starts with NOOP).

## Verification Evidence

### Automated tests

```
$ cd brain && uv run pytest test/ananke/ -q
43 passed in 1.05s

$ cd brain && uv run pytest -q
353 passed in 1.42s
```

- **Ananke test suite**: 43/43 passing (31 pre-existing + 6 new loader + 6 new handler).
- **Full Brain suite**: 353/353 passing; **zero regressions** (baseline was 341 — +12 new tests added by this plan).

### Acceptance criteria grep gates

```
$ grep -c "ActionType.DRIVE_CROSSED" brain/src/noesis_brain/rpc/handler.py
1

$ grep -En "drain_crossings|AnankeRuntime|AnankeLoader" brain/src/noesis_brain/rpc/handler.py
(10 matches — imports + use in __init__, on_tick, _get_or_create_ananke)

$ grep -En "actions\.remove|actions\.pop|actions\[0\]\s*=" brain/src/noesis_brain/rpc/handler.py
(no output — clean)

$ grep -En "time\.(time|monotonic|sleep)" src/noesis_brain/ananke/loader.py src/noesis_brain/rpc/types.py src/noesis_brain/rpc/handler.py
(no output — wall-clock gate clean)

$ uv run python -c "from noesis_brain.rpc.types import ActionType; print(ActionType.DRIVE_CROSSED.value, len(list(ActionType)))"
drive_crossed 7
```

### Key invariants confirmed

- [x] `ActionType` has exactly 7 members; `DRIVE_CROSSED` sits between `TELOS_REFINED` and `NOOP`; `NOOP` remains last.
- [x] `Action.metadata` for DRIVE_CROSSED contains EXACTLY 3 keys `{drive, level, direction}`. No `did`, no `tick`.
- [x] Handler owns one `AnankeRuntime` per DID via `self._ananke_runtimes`.
- [x] Seed derivation: `int.from_bytes(hashlib.sha256(did.encode()).digest()[:8], 'big')` — deterministic, no wall-clock.
- [x] Each crossing becomes ONE separate Action (iteration over `runtime.drain_crossings()`).
- [x] `_advisory_log_divergence` is pure observation — verified by grep and by `test_advisory_log_fires_on_divergence_but_does_not_modify_actions`.
- [x] No `time.time`/`time.monotonic`/`time.sleep` in any production file touched (test_drives_determinism.py pre-existing from 10a-01 uses time.sleep as the inverse-proof fixture — not a violation).

## Threat Model Coverage

| Threat ID  | Mitigation Delivered |
|-----------|----------------------|
| T-10a-11  | `_advisory_log_divergence` is pure observation; `test_advisory_log_fires_on_divergence_but_does_not_modify_actions` asserts the NOOP-primary action remains unmodified after divergence log. |
| T-10a-12  | Wiki/log writes route through private `log.info` with structured `extra`; `ananke.divergence` is NOT on the broadcast allowlist, so it cannot leak via broadcast path. |
| T-10a-13  | Metadata construction site explicitly builds `{drive, level, direction}` — all string enum values; `test_metadata_has_exactly_three_keys` asserts set equality. |
| T-10a-14  | Seed derived from `sha256(did)[:8]` big-endian int — deterministic, no wall-clock input. Verified by `test_loader_multiple_dids_get_independent_runtimes`. |
| T-10a-15  | (accepted — per-DID memory growth bounded, not mitigated by this plan.) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] Advisory logging also runs on the NOOP fallback path**

- **Found during:** Task 2 implementation while tracing code paths.
- **Issue:** The plan's reference pseudocode only ran `_advisory_log_divergence` on the combined-actions branch; the NOOP fallback path returned early without advisory logging. This would leave the canonical divergence case (HIGH drive + NOOP primary) invisible to operators on the very path where it's most common.
- **Fix:** Invoke `_advisory_log_divergence(self.did, runtime.state, actions)` on BOTH return paths (the combined-actions early-return and the NOOP fallback). Preserves PHILOSOPHY §6 observation without coercion.
- **Files modified:** `brain/src/noesis_brain/rpc/handler.py`
- **Commit:** `04c8ffa`
- **Rationale:** Correctness requirement — without this, the DRIVE-04 advisory logging is only partially delivered. The test `test_advisory_log_fires_on_divergence_but_does_not_modify_actions` exercises the NOOP path (handler state has no goals routed to MOVE in 10a), so the fix is also test-exercised.

### Plan Adherence Notes (not deviations)

- **`on_tick` signature:** The plan's interface pseudocode uses `on_tick(did: str, tick: int, ...) -> list[Action]`; the actual handler is `async def on_tick(self, params: dict[str, Any]) -> list[dict[str, Any]]` with DID stored as `self.did` at construction. I followed the actual signature (read-first rule) — the plan's pseudocode was advisory. All observable invariants (3-key metadata, 1 Action per crossing, per-DID independence) hold.
- **Testing via `uv run pytest` vs `pytest`:** The plan's test_runner note said "Use `pytest` directly". The brain venv did not have a pre-installed pytest; I ran `uv sync --extra dev` once and then used `uv run pytest` for all test invocations. This is still "pytest directly" via uv's stdlib-respecting shim; no behavioural difference.

## Authentication Gates

None.

## Known Stubs

None introduced. `AnankeRuntime.seed` remains reserved-but-unused in 10a (documented in `runtime.py` docstring from Plan 10a-01). Plan 10a-04 consumes the Action stream; Plan 10a-05 consumes the advisory log.

## Self-Check

- [x] `brain/src/noesis_brain/ananke/loader.py` exists — FOUND.
- [x] `brain/test/ananke/test_loader.py` exists — FOUND.
- [x] `brain/test/ananke/test_handler_ananke.py` exists — FOUND.
- [x] Commits exist: `66f2a4a`, `f7feea8`, `188e065`, `04c8ffa` — all FOUND in `git log`.
- [x] `pytest test/ananke/` → 43 passed.
- [x] `pytest -q` → 353 passed.

## Self-Check: PASSED
