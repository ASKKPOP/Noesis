---
phase: 22-web3-identity
plan: "01"
subsystem: grid/human
tags: [web3, identity, human-registry, migration, mysql]
dependency_graph:
  requires: []
  provides: [HumanRegistry, human_users-migration]
  affects: [grid/src/index.ts, grid/src/db/schema.ts]
tech_stack:
  added: []
  patterns: [map-based-in-memory-registry, migration-array-extension]
key_files:
  created:
    - grid/src/human/types.ts
    - grid/src/human/HumanRegistry.ts
    - grid/src/human/index.ts
  modified:
    - grid/src/db/schema.ts
    - grid/src/index.ts
decisions:
  - "In-memory HumanRegistry (no DB adapter) — persistence deferred to Plan 22-02 auth route layer (mirrors NousRegistry pattern)"
  - "eth_address always lowercased before storage and DID construction — prevents case-collision duplicate registrations (T-22-01-01)"
  - "HUMAN_DID_RE regex /^did:noesis:human:0x[0-9a-f]{40}$/i — narrowed prefix from base WEB3-05 DID_RE"
metrics:
  duration_seconds: 131
  completed_date: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 22 Plan 01: Human Users Migration and HumanRegistry Summary

## One-Liner

MySQL migration v9 for `human_users` table plus in-memory `HumanRegistry` with createHuman/findByAddress/findByDid keyed on Ethereum address, DID format `did:noesis:human:<lowercased-eth-address>`.

## What Was Built

### Task 1 — human_users migration (version 9)

Appended migration version 9 to `MIGRATIONS` array in `grid/src/db/schema.ts`. The `human_users` table stores `id`, `grid_name`, `did`, `eth_address`, and `created_at`. Unique keys on `(grid_name, did)` and `(grid_name, eth_address)` enforce one identity per address per grid at the DB layer. Existing migrations 1–8 are untouched.

### Task 2 — HumanRegistry service

Three new files created under `grid/src/human/`:

- `types.ts` — `HumanRecord` (readonly did, eth_address, grid_name, created_at) and `CreateHumanParams` interfaces
- `HumanRegistry.ts` — Map-based in-memory registry with:
  - `createHuman(params)` — lowercases address, constructs DID, throws on duplicate per grid
  - `findByAddress(gridName, address)` — case-insensitive lookup
  - `findByDid(gridName, did)` — exact DID lookup
  - `listByGrid(gridName)` — enumerate all records for a grid (test utility)
  - `HUMAN_DID_RE` export — `/^did:noesis:human:0x[0-9a-f]{40}$/i`
- `index.ts` — barrel export for the human/ directory

`grid/src/index.ts` updated to re-export `HumanRegistry` and types directly after the `NousRegistry` export block, following the established pattern.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3bcf9b6 | feat(22-01): add human_users migration (version 9) to schema.ts |
| 2 | 2c416db | feat(22-01): create HumanRegistry service and wire into grid index |

## Decisions Made

1. **In-memory only for Plan 22-01** — DB persistence (INSERT/SELECT against `human_users`) is deferred to the auth route layer in Plan 22-02. This mirrors the exact NousRegistry pattern where the registry is in-process and a store adapter handles persistence separately.
2. **eth_address always lowercased** — Prevents case-collision duplicates where `0xABC` and `0xabc` would collide in the DID key space. Both storage and DID construction lowercase unconditionally (T-22-01-01 mitigated).
3. **HUMAN_DID_RE narrowed to human prefix** — The base WEB3-05 DID regex `/^did:noesis:[a-z0-9_\-]+$/i` is intentionally broad. `HUMAN_DID_RE` adds `human:0x[0-9a-f]{40}` to enforce the exact 40-hex-char Ethereum address format.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-22-01-01 Tampering (case-collision) | `eth_address` lowercased before storage and DID construction | Implemented |
| T-22-01-02 Info Disclosure (eth_address) | eth_address is public blockchain identifier; no PII stored | Accepted (as planned) |
| T-22-01-03 EoP (duplicate address) | `createHuman` throws before creating second record for same address per grid | Implemented |

## Self-Check: PASSED

- `grid/src/human/types.ts` exists: FOUND
- `grid/src/human/HumanRegistry.ts` exists: FOUND
- `grid/src/human/index.ts` exists: FOUND
- `grid/src/db/schema.ts` contains `version: 9`: FOUND (line 196)
- `grid/src/db/schema.ts` contains `human_users`: FOUND (lines 199, 210)
- `grid/src/index.ts` contains `HumanRegistry`: FOUND (line 26)
- Commit 3bcf9b6: FOUND
- Commit 2c416db: FOUND
- `npx tsc --noEmit` exits 0: VERIFIED
