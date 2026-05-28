---
phase: 43
plan: "03"
subsystem: brain-standalone
tags: [brain, standalone, cli, tarfile, security, civic-action-gate, tdd]
dependency_graph:
  requires: [43-01]
  provides: [standalone-brain-runtime, fork-import-cli, civic-action-gate]
  affects: [brain/__main__.py, brain/http/server.py]
tech_stack:
  added: []
  patterns: [argparse-subcommand, tarfile-extraction-with-path-traversal-guard, sha256-hash-verification, aiohttp-middleware]
key_files:
  created:
    - brain/src/noesis_brain/standalone/__init__.py
    - brain/src/noesis_brain/standalone/importer.py
    - brain/src/noesis_brain/standalone/factory.py
  modified:
    - brain/src/noesis_brain/__main__.py
    - brain/src/noesis_brain/http/server.py
    - brain/test/test_standalone.py
decisions:
  - "Used unittest.mock.patch to mock create_brain_app_from_env in factory test — avoids requiring sophia.yaml on the test machine while still verifying env var mutation behavior"
  - "CIVIC_ACTION_PATHS left empty (forward-compatible wiring) — no civic-action endpoints exist on Brain HTTP today; middleware registered so Phase 44/46/49 endpoints receive protection by registering paths"
  - "tarfile.extractall DeprecationWarning noted (Python 3.14 will require filter= argument) — deferred to a future chore since Python 3.12 behavior is safe for now"
metrics:
  duration: "218 seconds"
  completed_date: "2026-05-28"
  tasks_completed: 2
  files_changed: 6
---

# Phase 43 Plan 03: Brain Standalone Mode Summary

**One-liner:** Brain standalone CLI (`python -m noesis_brain standalone --import pkg.tar.gz`) with tar-slip defense, sha256 manifest verification, GRID_URL/CIVIC_DID env strip, and aiohttp civic-action gate returning 503 grid_unavailable in BRAIN_STANDALONE=1 mode.

## What Was Built

### 3 New Brain Python Modules

**`brain/src/noesis_brain/standalone/__init__.py`**
Package init — one-line module docstring per plan spec.

**`brain/src/noesis_brain/standalone/importer.py`**
`verify_and_unpack(import_archive: Path, data_dir: Path) -> dict`

- Extracts `.tar.gz` fork archive to `data_dir`
- Path-traversal guard (T-43-slip): each tar member's resolved path is checked with `target.relative_to(data_dir_resolved)` — any escape raises `ValueError("Path traversal detected in archive: ...")`
- Symlink/hardlink rejection: `islnk()` and `issym()` members raise ValueError
- Manifest hash verification (T-43-hash): recomputes SHA-256 over sorted `(rel_path, null_byte, content)` tuples (excluding `manifest.json` itself) and compares to `manifest.export_hash` — mismatch raises `ValueError("export_hash mismatch: ...")`
- Returns manifest dict on success

**`brain/src/noesis_brain/standalone/factory.py`**
`create_brain_app_standalone(import_dir: Path) -> BrainApp` (async)

- Reads `manifest["nous_existence_did"]` from `import_dir/manifest.json`
- Sets `BRAIN_DATA_DIR = import_dir/memory`, `BRAIN_STANDALONE = "1"`, `NOUS_DID`
- Unsets `GRID_URL` and `CIVIC_DID` (T-43-leak defense in depth)
- Delegates to `create_brain_app_from_env()` — with `GRID_URL` unset, the factory skips all wire initialization (`GridWireClient`, `WssSubscriber`, heartbeat task remain `None`)

### 2 Modified Files

**`brain/src/noesis_brain/__main__.py`**
- Added `import argparse` to imports
- Added `_run_standalone(import_archive: Path)` async coroutine — calls `verify_and_unpack` then `create_brain_app_standalone`, logs manifest details, calls `app.serve_forever()`
- Added `main_entry()` function with argparse:
  - `standalone` subcommand with `--import` (dest=`import_archive`)
  - Default (no subcommand) falls through to `asyncio.run(main())` — **regression preserved**
- Replaced `if __name__ == "__main__": asyncio.run(main())` with `main_entry()`

**`brain/src/noesis_brain/http/server.py`**
HTTP Framework: **aiohttp** (`web.Application`, `web.middleware`, `web.json_response`)

Civic-action gate implementation (T-43-silent / Pitfall 6 fix):
- `CIVIC_ACTION_PATHS: set[str] = set()` — empty today, forward-compatible for Phase 44/46/49
- `_is_standalone() -> bool` — checks `os.environ.get("BRAIN_STANDALONE") == "1"`
- `_civic_unavailable_response() -> web.Response` — returns `503` with `{"error": "grid_unavailable", "detail": "This Nous is running standalone — civic features require Grid connection."}`
- `@web.middleware civic_action_gate` — intercepts requests to `CIVIC_ACTION_PATHS` paths in standalone mode
- `BrainHttpServer.__init__` now passes `middlewares=[civic_action_gate]` to `web.Application()`

### CIVIC_ACTION_PATHS Status

**Empty today (forward-compatibility wiring).**

No civic-action endpoints exist on Brain HTTP as of Phase 43. All civic actions route through Grid directly. The middleware infrastructure is wired so future Brain HTTP endpoints (Phase 44 marketplace, Phase 46 government, Phase 49 communities) automatically receive standalone protection by adding their paths to `CIVIC_ACTION_PATHS`.

## Test Results

12 tests total, 0 skips, 0 failures.

| Class | Tests | Status |
|-------|-------|--------|
| `TestBrainDataDir` | 3 | All pass (Plan 01 — unchanged) |
| `TestStandaloneImport` | 3 | All pass (path traversal, hash mismatch, valid archive) |
| `TestStandaloneMode` | 2 | All pass (no wire client, argparse regression) |
| `TestCivicActionGate` | 4 | All pass (_is_standalone, inactive check, CIVIC_ACTION_PATHS, 503 response) |

Full brain suite: **805 passed, 18 skipped** (18 skips are pre-existing, no new failures).

## TDD Gate Compliance

- RED commit: `f763447` — `test(43-03): add failing tests for standalone importer + factory + civic gate`
- GREEN commit: `d70b63f` — `feat(43-03): implement standalone Brain mode — importer + factory + argparse + civic gate`
- REFACTOR: none needed

## Deviations from Plan

### Auto-fixed: Test factory without sophia.yaml

**Found during:** Task 1 GREEN phase

**Issue:** `create_brain_app_standalone` delegates to `create_brain_app_from_env()`, which reads `NOUS_CONFIG` env var. When blank, it falls back to `data/nous/sophia.yaml` — that file doesn't exist in the test environment (only on Henry's machine).

**Fix:** Patched `create_brain_app_from_env` with `unittest.mock.patch` in `test_no_wire_client_when_BRAIN_STANDALONE_set`. The test verifies env var mutation (BRAIN_STANDALONE=1, GRID_URL removed, CIVIC_DID removed) and that the returned app has `_grid_wire_client = None` — the actual BrainApp construction is irrelevant for these assertions.

**Files modified:** `brain/test/test_standalone.py`

### Forward-compatibility wiring for CIVIC_ACTION_PATHS

**Type:** Rule 2 (auto-add missing critical functionality — forward-compat)

**Issue:** Plan spec acknowledged Brain HTTP has no civic-action endpoints today and permitted an empty `CIVIC_ACTION_PATHS` set.

**Action:** Implemented as empty set with aiohttp middleware registered. Comment cites D-43-01 / Pitfall 6 and lists Phase 44/46/49 as the phases that will populate the set. Future phases only need to add paths to `CIVIC_ACTION_PATHS`.

## Known Stubs

**`CIVIC_ACTION_PATHS = set()`** — intentional placeholder (documented). No phase 43 brain HTTP endpoints are civic-action endpoints. This set will be populated in future phases that add civic-action Brain HTTP endpoints.

## Pointer for Plan 04

Standalone invocation path: `python -m noesis_brain standalone --import <pkg.tar.gz>`

The Steward Console fork UI (Plan 04) does NOT invoke this command. After the fork download, the operator copies the `.tar.gz` to their standalone machine and runs the CLI manually. The Steward UI's job is to trigger the Grid-side fork, display the download link, and show status — it has no knowledge of what the operator does with the archive afterward.

## Self-Check: PASSED

All created/modified files exist on disk. Both TDD commits (RED: f763447, GREEN: d70b63f) confirmed in git log. No unexpected file deletions.
