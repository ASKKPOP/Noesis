---
phase: 6
plan: "06-05"
subsystem: operator-agency
tags: [agency-02, agency-03, h2-reviewer, h4-driver, privacy, sovereignty]
requires:
  - 06-01  # appendOperatorEvent producer boundary
  - 06-02  # H3 clock pause/resume handler pattern
  - 06-04  # governance-laws handler + validateTierBody
depends-on-commits:
  - ecbc157  # Bridge + brain handlers (Task 1)
  - 5361f56  # Fastify routes (Task 2)
  - 3f6d0ad  # Privacy matrix (Task 3)
provides:
  - H2 Reviewer memory-query endpoint
  - H4 Driver telos-force endpoint
  - brain.queryMemory / brain.forceTelos RPC contract
  - 40-case D-12 privacy enumerator across all operator.* events
affects:
  - audit chain (two new operator.* event emitters)
  - broadcast allowlist (no new members — existing slots filled)
tech-stack:
  added:
    - none
  patterns:
    - producer-boundary audit wrapper (appendOperatorEvent from Plan 01)
    - closed payload tuple (structural privacy invariant)
    - hash-only cross-boundary contract (D-19)
    - Fastify error ladder (400 → 404 → 503, no 500s)
    - matrix-enumeration testing (5 events × 8 cases = 40)
key-files:
  created:
    - grid/src/api/operator/memory-query.ts
    - grid/src/api/operator/telos-force.ts
    - grid/test/api/operator/memory.test.ts
    - grid/test/api/operator/telos.test.ts
    - brain/test/test_handler_agency.py
  modified:
    - protocol/src/noesis/bridge/types.ts
    - protocol/src/noesis/bridge/brain-bridge.ts
    - grid/src/integration/types.ts
    - grid/src/integration/nous-runner.ts
    - grid/src/api/server.ts
    - grid/src/api/operator/index.ts
    - grid/test/audit/operator-payload-privacy.test.ts
    - brain/src/noesis_brain/rpc/handler.py
    - brain/src/noesis_brain/__main__.py
decisions:
  - D-11 closed payload for operator.inspected {tier, action, operator_id, target_did}
  - D-19 hash-only payload for operator.telos_forced {+telos_hash_before, telos_hash_after}
  - 503 + no-audit-emit on Brain-unavailable / RPC throw (only successful inspects/forces are logged)
  - contract-drift guard: 64-hex validation on returned hashes at grid boundary
metrics:
  duration: ~40 min
  completed: 2026-04-20
  tasks_completed: 3
  commits: 3
  new_tests: 48 (8 brain + 40 grid; privacy matrix rewrite added net +35)
---

# Phase 6 Plan 05: H2 Reviewer + H4 Driver — memory-query + telos-force Summary

Wires the final two operator-agency endpoints (H2 memory inspection, H4 Telos override) through the Plan 01 producer boundary and closes the structural privacy invariants: memory content never enters the audit chain (rides back in HTTP body only), and plaintext Telos never crosses the RPC or audit boundary (only SHA-256 hashes do).

## Objectives

| Objective | Status |
|---|---|
| Extend `BrainBridge` + `IBrainBridge` with `queryMemory` + `forceTelos` | Met |
| Add Python `brain.queryMemory` + `brain.forceTelos` RPC handlers | Met |
| Register `POST /api/v1/operator/nous/:did/memory/query` (H2) | Met |
| Register `POST /api/v1/operator/nous/:did/telos/force` (H4) | Met |
| Enforce D-11 closed payload for `operator.inspected` | Met |
| Enforce D-19 hash-only payload for `operator.telos_forced` | Met |
| Implement 400 → 404 → 503 error ladder (no 500s) | Met |
| 503 and 400/404 paths emit NO audit events | Met |
| Extend D-12 privacy enumerator to 40-case matrix (5 events × 8 cases) | Met |

## Commits

| Task | Commit | Scope |
|---|---|---|
| 1 | `ecbc157` | Protocol bridge + brain handler + Python tests (8 new pytest cases) |
| 2 | `5361f56` | Fastify routes + vitest handler tests (19 new cases) |
| 3 | `3f6d0ad` | Payload-privacy matrix rewrite (net +35 cases, 41 total) |

## Changes by Layer

### protocol

- `bridge/types.ts` — new `MemoryEntry` interface (`{timestamp, kind, summary}`).
- `bridge/brain-bridge.ts` — new `queryMemory()` and `forceTelos()` methods on `BrainBridge`. `forceTelos` wraps `new_telos` into the Python-side `{new_telos: ...}` params.

### grid

- `integration/types.ts` — local `MemoryEntry` (no compile-time dep on `@noesis/protocol`) and extended `IBrainBridge` with the two new methods.
- `integration/nous-runner.ts` — thin passthroughs for `queryMemory` / `forceTelos`. NO caching, NO audit writes — producer boundary stays at Fastify handlers.
- `api/server.ts` — new `InspectorMemoryEntry` + optional `queryMemory?`/`forceTelos?` on `InspectorRunner` so legacy test fakes still compile.
- `api/operator/memory-query.ts` (new) — H2 handler. Validates tier/operator_id (`validateTierBody('H2')`), DID shape, `query` (required string) and `limit` (optional number). On success, calls `runner.queryMemory`, emits `operator.inspected` via `appendOperatorEvent`, returns normalized entries in the HTTP body.
- `api/operator/telos-force.ts` (new) — H4 handler. Validates tier/operator_id (`validateTierBody('H4')`), DID, `new_telos` (required object, not array). Calls `runner.forceTelos`, enforces 64-hex regex on returned hashes (contract-drift guard), emits `operator.telos_forced` with the closed tuple, returns the hashes in the HTTP body.
- `api/operator/index.ts` — registers the two new routes.

### brain

- `rpc/handler.py` — new `query_memory(params)` and `force_telos(params)` coroutines on `BrainHandler`.
  - `query_memory`: clamps `limit` to `[1, 100]` (defaults 20), over-fetches from `memory.recent`, filters by case-insensitive substring, returns normalized entries via the existing `_normalise_memory_entry` helper (drops importance/source_did/location/tick at the boundary).
  - `force_telos`: snapshots the current hash via `compute_active_telos_hash` (sole hash authority per `hashing.py`), rebuilds `TelosManager` via `TelosManager.from_yaml(...)`, snapshots the new hash, returns `{telos_hash_before, telos_hash_after}` — NO goal contents.
- `__main__.py` — registers `brain.queryMemory` and `brain.forceTelos` RPC methods alongside the existing four.

### Tests (per phase requirement: matching grid vitest + brain pytest)

- `brain/test/test_handler_agency.py` (new, 8 cases) — H2 normalisation shape, case-insensitive filter, limit clamping, missing-memory path; H4 hash-only payload shape, 64-hex format, round-trip hash equality, empty-payload replacement.
- `grid/test/api/operator/memory.test.ts` (new, 7 cases) — full error ladder + happy path, explicit `Object.keys` structural assertion on the audit payload (catches any key drift).
- `grid/test/api/operator/telos.test.ts` (new, 12 cases) — full error ladder, structural key-set assertion, plaintext-leak guard (serialized payload cannot contain goal descriptions or `short_term`/`long_term` markers), contract-drift guard on non-hex64 hashes.
- `grid/test/audit/operator-payload-privacy.test.ts` (rewritten, 41 cases) — 5 events × (6 forbidden keys + 1 nested + 1 happy) = 40 enumerated cases + 1 coverage assertion that `EVENT_SPECS` matches the broadcast allowlist membership. Atomicity invariant asserted per rejected case (chain.head and chain.length unchanged).

## Test Summary

| Suite | Before | After |
|---|---|---|
| `grid` (vitest) | 491 passing | **538 passing** (+47) |
| `brain` (pytest) | 269 passing | **277 passing** (+8) |

All tests green. No skipped, no `.only`, no flake.

## Invariant Closures

| Invariant | How Closed |
|---|---|
| D-11 closed payload (`operator.inspected`) | Handler literal; Plan 01 privacy gate blocks extra keys; `memory.test.ts::Test 1` asserts key set. |
| D-19 hash-only (`operator.telos_forced`) | Python handler returns hashes only; grid handler literal mirrors the D-19 tuple; `telos.test.ts::Test 2` asserts key set; `Test 3` asserts serialized payload contains no goal descriptions. |
| T-6-06 (Telos plaintext leak) | Three-way enforcement: Python return shape + grid payload literal + privacy matrix `operator.telos_forced::rejects "*"` cases. |
| T-6-03 (broadcast privacy leak) | 40-case matrix enumerates every forbidden keyword × every event type. |
| Error ladder (no 500s) | Fastify handlers branch explicitly on 400/404/503; no `throw` leaks to Fastify's default 500 path. All error branches tested. |
| 503 must not audit | Both handlers return BEFORE `appendOperatorEvent` on 503; `memory.test.ts::Test 6/7` and `telos.test.ts::Test 10/11/12` assert audit length is 0. |
| Contract drift at RPC boundary | 64-hex regex guard in `telos-force.ts`; `telos.test.ts::Test 12` covers. |

## Deviations from Plan

### None that affected scope.

Two plan-snippet inconsistencies were reconciled against the existing codebase:

1. **Plan referenced `INousRunner` but the actual type is `InspectorRunner`** (introduced in Plan 04-03 for the Inspector proxy). The Plan 05 handlers extend `InspectorRunner` with optional `queryMemory?` / `forceTelos?` methods, keeping legacy test fakes backward-compatible — no existing test had to be modified to add the new methods. Tracked as a harmless plan/code drift, not a functional deviation.
2. **Plan referenced `brain/tests/...` (plural); actual pytest convention is `brain/test/...` (singular)** per `pyproject.toml` `testpaths = ["test"]`. Used the correct directory.

### Rule 2 auto-adds

- **Contract-drift guard on hash shape (`telos-force.ts`)**: plan did not specify this, but returning a malformed hash from the Brain would silently corrupt the audit chain. Added a 64-hex regex check at the grid boundary; a failing hash returns 503 + no audit emit. Closes a latent bug mode that would otherwise only surface on an adversarial Brain.
- **Array-shaped `new_telos` → 400 invalid_new_telos**: `typeof [] === 'object'` in JS, so without `Array.isArray(x)` check, arrays would pass through to Python. Added explicit guard; tested in `telos.test.ts::Test 8`.

## Known Stubs

None.

## Deferred Issues

None. All brain + grid tests green. No lint or type warnings introduced (TS compiles cleanly across all 538 grid tests).

## Threat Flags

None. All new surface is covered by the D-10 allowlist members (`operator.inspected`, `operator.telos_forced`) already frozen in Plan 01. No new broadcast event types introduced.

## Follow-ups for 06-06

- Dashboard UI for H2 Reviewer memory query (operator UI surface).
- Dashboard UI for H4 Driver telos force (with irreversibility confirmation).
- STATE.md + README.md reconciliation for completed Phase 6 work.
- Human-test checklist for the two new endpoints (curl commands, expected audit entries, privacy-leak negative cases).

## Self-Check

- File presence:
  - `grid/src/api/operator/memory-query.ts` FOUND
  - `grid/src/api/operator/telos-force.ts` FOUND
  - `grid/test/api/operator/memory.test.ts` FOUND
  - `grid/test/api/operator/telos.test.ts` FOUND
  - `brain/test/test_handler_agency.py` FOUND
- Commit presence:
  - `ecbc157` FOUND
  - `5361f56` FOUND
  - `3f6d0ad` FOUND

## Self-Check: PASSED
