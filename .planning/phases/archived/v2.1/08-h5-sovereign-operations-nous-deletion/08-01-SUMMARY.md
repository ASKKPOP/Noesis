---
phase: 08-h5-sovereign-operations-nous-deletion
plan: "01"
subsystem: grid-registry, grid-audit, brain-state-hash
tags: [tombstone, state-hash, rpc, agency-05, tdd]
dependency_graph:
  requires: []
  provides:
    - grid/src/registry/tombstone-check.ts (TombstonedDidError, tombstoneCheck)
    - grid/src/registry/registry.ts (tombstone, removeNous methods)
    - grid/src/registry/types.ts (status 'deleted' union, deletedAtTick field)
    - grid/src/space/map.ts (removeNous method)
    - grid/src/audit/state-hash.ts (combineStateHash, HEX64_RE, StateHashComponents)
    - brain/src/noesis_brain/state_hash.py (compute_pre_deletion_state_hash, 4 helpers)
    - brain/src/noesis_brain/rpc/handler.py (BrainHandler.hash_state method)
  affects:
    - Plan 02: delete route imports tombstoneCheck + combineStateHash
    - Plan 02: route calls registry.tombstone(did, tick, spatial)
    - Plan 02: Grid calls runner.bridge.hash_state() to get 4 hashes
tech_stack:
  added:
    - node:crypto createHash('sha256') for canonical state-hash composition
    - Python hashlib.sha256 + json.dumps(sort_keys=True) for component hashes
  patterns:
    - Soft-delete tombstone (record retained forever, status flips once)
    - Closed-tuple structural guard (LOCKED_KEY_ORDER, EXPECTED_KEYS)
    - Canonical JSON serialization with locked key order (D-07 invariant)
    - TDD RED-first per Noesis discipline (3 RED commits before 3 GREEN commits)
key_files:
  created:
    - grid/src/registry/tombstone-check.ts
    - grid/src/audit/state-hash.ts
    - brain/src/noesis_brain/state_hash.py
    - grid/test/registry/tombstone.test.ts
    - grid/test/audit/state-hash.test.ts
    - brain/test/test_state_hash.py
    - brain/test/test_rpc_hash_state.py
  modified:
    - grid/src/registry/types.ts (status union + deletedAtTick field)
    - grid/src/registry/registry.ts (tombstone, removeNous methods + spawn guard)
    - grid/src/registry/index.ts (re-exports tombstoneCheck, TombstonedDidError)
    - grid/src/space/map.ts (removeNous idempotent eviction)
    - brain/src/noesis_brain/rpc/handler.py (hash_state method + import)
decisions:
  - "tombstone(did, tick, spatial) takes SpatialMap as explicit arg (no DI required; avoids circular import between registry and space)"
  - "hash_psyche/thymos/telos/memory_stream take BrainHandler (not a Nous model) — Brain has no single Nous type; handler is the source of truth for all subsystem state"
  - "hash_memory_stream returns hash of empty list when handler.memory is None — valid sentinel, not an error; brain may run without persistence"
  - "LOCKED_KEY_ORDER hardcoded in canonicalSerialize as manual string concat — JSON.stringify insertion order not guaranteed across engines"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-21"
  tasks_completed: 3
  files_created: 7
  files_modified: 5
---

# Phase 8 Plan 01: Grid Tombstone + State-Hash Composer + Brain hash_state RPC Summary

**One-liner:** Tombstone soft-delete primitive (record retained forever, spatial evicted), locked-key-order SHA-256 composer for pre_deletion_state_hash, and Brain 4-component hash RPC method with D-03 sovereignty boundary enforced by pinned-hash test.

## Tasks Executed

| Task | Name | Commit (RED) | Commit (GREEN) | Tests |
|------|------|-------------|----------------|-------|
| 1 | Grid tombstone primitive | ddc89c9 | c1306fc | 16/16 |
| 2 | Grid state-hash composer | 48832be | f8802f1 | 14/14 |
| 3 | Brain state-hash + hash_state RPC | 2a11a83 | 36e12d5 | 15/15 |

## Files Changed

### Grid — Registry

**`grid/src/registry/types.ts`** (+3 lines delta)
- `NousRecord.status` union extended: `'active' | 'suspended' | 'exiled' | 'deleted'`
- `NousRecord.deletedAtTick?: number` added (stamped by tombstone())

**`grid/src/registry/registry.ts`** (+52 lines delta, now 229 total)
- Import added: `SpatialMap` from `../space/map.js`
- `spawn()` preflight check: rejects tombstoned DIDs with TypeError (D-04)
- `tombstone(did, tick, spatial)`: flips status, stamps tick, calls spatial.removeNous, retains record
- `removeNous(did)`: defensive no-op on tombstoned, throws on active (D-02 soft-delete only)

**`grid/src/registry/tombstone-check.ts`** (new, 37 lines)
- `TombstonedDidError extends Error` with `statusHint = 410`, `did`, `deletedAtTick`
- `tombstoneCheck(registry, did)`: throws TombstonedDidError for tombstoned DIDs; no-op for active/unknown

**`grid/src/registry/index.ts`** (+1 line)
- Re-exports `tombstoneCheck`, `TombstonedDidError`

### Grid — Space

**`grid/src/space/map.ts`** (+9 lines delta, now 142 total)
- `removeNous(nousDid)`: idempotent `positions.delete(nousDid)`; no throw if absent

### Grid — Audit

**`grid/src/audit/state-hash.ts`** (new, 87 lines)
- `HEX64_RE = /^[0-9a-f]{64}$/` exported
- `StateHashComponents` interface (4 readonly string fields in LOCKED order)
- `LOCKED_KEY_ORDER = ['psyche_hash', 'thymos_hash', 'telos_hash', 'memory_stream_hash']`
- `canonicalSerialize()`: manual string concat in locked order (engine-safe)
- `combineStateHash(components)`: type guard → closed-tuple check → per-key HEX64_RE → canonical JSON → SHA-256 → 64-hex

### Brain

**`brain/src/noesis_brain/state_hash.py`** (new, 154 lines)
- `_sha256_canonical(obj)`: JSON.dumps(sort_keys=True) → sha256 → hexdigest
- `hash_psyche(handler)`: personality profile + archetype + values + style
- `hash_thymos(handler)`: all 6 emotion intensities sorted by name
- `hash_telos(handler)`: active goals sorted by description
- `hash_memory_stream(handler)`: ordered entries with content hash; empty list if memory=None
- `compute_pre_deletion_state_hash(handler)`: returns EXACTLY 4-key dict (no 5th hash, D-03)

**`brain/src/noesis_brain/rpc/handler.py`** (+24 lines delta, now 582 total)
- Import added: `compute_pre_deletion_state_hash` from `noesis_brain.state_hash`
- `BrainHandler.hash_state(params)`: async method returning the 4-key dict

## Test Counts

| File | Tests | Status |
|------|-------|--------|
| `grid/test/registry/tombstone.test.ts` | 16 | All passing |
| `grid/test/audit/state-hash.test.ts` | 14 | All passing |
| `brain/test/test_state_hash.py` | 10 | All passing |
| `brain/test/test_rpc_hash_state.py` | 5 | All passing |
| **Total** | **45** | **45/45** |

## Key Test Assertions

- **KEY-ORDER LOCK (D-07):** `state-hash.test.ts` pins the exact SHA-256 digest against a pre-computed `EXPECTED_PINNED` value. Reordering `LOCKED_KEY_ORDER` or `canonicalSerialize()` changes the digest and fails this test.
- **D-03 invariant:** `test_no_state_hash_key_in_result` asserts Brain result has no `state_hash` or `pre_deletion_state_hash` key.
- **Orthogonality:** mutating `psyche.personality.openness` changes only `psyche_hash`; mutating a goal description changes only `telos_hash`.
- **DID reuse prevention (D-04):** `spawn()` rejects tombstoned DID with `TypeError` matching `/tombstoned|cannot.*reuse/i`.
- **Audit retention (D-02):** `registry.get(did)` returns the tombstoned record after tombstone().
- **Spatial eviction:** `getNousInRegion()` does not return tombstoned DID after tombstone().
- **HTTP 410 shape:** `TombstonedDidError.statusHint === 410`.

## Full Suite Regressions

- **Grid:** 615/615 tests passing (61 test files). Phase 6/7 allowlist, zero-diff, privacy, telos tests all green.
- **Brain:** 310/310 tests passing. Phase 7 dialogue, telos-refined, agency tests all green.

## Deviations from Plan

### Deviation 1 — tombstone() takes explicit SpatialMap parameter

**Found during:** Task 1 implementation.

**Issue:** The plan sketch showed `tombstone(did, tick)` as a 2-arg method. However, `NousRegistry` does not have a reference to `SpatialMap` in its constructor (the registry and spatial map are separate services in this codebase). Adding a `SpatialMap` field to the registry constructor would require updating all call sites and tests.

**Fix (Rule 1 — pragmatic adaptation):** Changed signature to `tombstone(did, tick, spatial)` — explicit argument. This matches how the existing codebase passes services at call sites (e.g., the delete route will have both `registry` and `spatial` available). The test fixture passes `spatial` explicitly.

**Files modified:** `registry.ts` (signature), `tombstone.test.ts` (fixture).

### Deviation 2 — Brain state_hash.py takes BrainHandler, not a Nous model

**Found during:** Task 3 research.

**Issue:** The plan assumes a `Nous` model as a single object. The Brain has no such unified type — `BrainHandler` holds the individual subsystem instances (`psyche`, `thymos`, `telos`, `memory`).

**Fix (Rule 1 — adapt to actual codebase):** `hash_psyche/thymos/telos/memory_stream` and `compute_pre_deletion_state_hash` accept `BrainHandler` directly. This is the natural host of all subsystem state. The 4-key contract and D-03 invariant are preserved identically.

**Files modified:** `state_hash.py` (interface), `test_state_hash.py` (fixture uses `_make_handler()`).

### Deviation 3 — hash_state RPC is a BrainHandler method, not a FastAPI HTTP route

**Found during:** Task 3 research.

**Issue:** The plan references `brain/src/noesis_brain/rpc.py` with a FastAPI `@router.post` route. The Brain uses JSON-RPC over Unix socket (`RPCServer`), not FastAPI. There is no FastAPI router in this codebase.

**Fix (Rule 1 — adapt to actual architecture):** `hash_state` is implemented as an async method on `BrainHandler` (alongside `on_message`, `on_tick`, `force_telos`, etc.). Plan 02's Grid-side delete route will call it via `runner.bridge` using the existing JSON-RPC pattern. The `test_rpc_hash_state.py` tests call the method directly (matching the existing test pattern in `test_handler_agency.py` and `test_rpc_handler.py`).

**Files modified:** `handler.py` (method added), `test_rpc_hash_state.py` (tests BrainHandler.hash_state directly).

## Cross-Boundary Invariant Checks

```
grep "state_hash|pre_deletion_state_hash" brain/src/noesis_brain/state_hash.py
  → Only in function name, docstring, and return key strings — no composition in Brain. CLEAN.

grep "combineStateHash" grid/src/
  → Exactly 1 definition in state-hash.ts. No consumers yet (Plan 02 adds them). CLEAN.

grep "records.set.*status.*'deleted'" grid/src/registry/registry.ts
  → Exactly 1 site: tombstone() method only. CLEAN.
```

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced in Plan 01. All new code is pure in-memory logic (registry mutation, JSON hashing). Threat flags: none.

## Hand-off Note to Plan 02

Plan 02 will compose all three primitives from this plan:

1. **Import `combineStateHash`** from `grid/src/audit/state-hash` — accepts 4-key `StateHashComponents` dict.
2. **Import `tombstoneCheck` + `TombstonedDidError`** from `grid/src/registry/tombstone-check` — call before any business logic on DID-resolving routes.
3. **Call `registry.tombstone(did, currentTick, spatial)`** inside the `POST /api/v1/operator/nous/:did/delete` route handler (step 9 of the D-10 order: after Brain RPC, before audit emit).
4. **Call `runner.bridge.hash_state({})`** (or equivalent) to get the 4-hash dict from Brain.
5. **Add `appendNousDeleted` producer-boundary helper** at `grid/src/audit/append-nous-deleted.ts` (sole-producer pattern symmetric to `appendTelosRefined`).
6. **Extend broadcast-allowlist.ts** from 17 to 18 with `'operator.nous_deleted'` at position 18.
7. **Doc-sync reconciliation** in the same task: `STATE.md` 17→18 allowlist count, `scripts/check-state-doc-sync.mjs` 17→18, `README.md` where referenced.

The `tombstone()` method signature is `tombstone(did: string, tick: number, spatial: SpatialMap)` — Plan 02's delete route will have all three values available (`services.registry`, `services.clock.currentTick`, `services.spatial`).

## Self-Check: PASSED

All created files exist on disk. All 6 commits found in git log.

| Check | Result |
|-------|--------|
| grid/src/registry/tombstone-check.ts | FOUND |
| grid/src/audit/state-hash.ts | FOUND |
| brain/src/noesis_brain/state_hash.py | FOUND |
| grid/test/registry/tombstone.test.ts | FOUND |
| grid/test/audit/state-hash.test.ts | FOUND |
| brain/test/test_state_hash.py | FOUND |
| brain/test/test_rpc_hash_state.py | FOUND |
| commit ddc89c9 (RED tombstone) | FOUND |
| commit c1306fc (GREEN tombstone) | FOUND |
| commit 48832be (RED state-hash) | FOUND |
| commit f8802f1 (GREEN state-hash) | FOUND |
| commit 2a11a83 (RED brain) | FOUND |
| commit 36e12d5 (GREEN brain) | FOUND |
