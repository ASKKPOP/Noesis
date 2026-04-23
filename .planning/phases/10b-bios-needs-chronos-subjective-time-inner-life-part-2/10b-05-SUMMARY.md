---
phase: 10b
plan: 05
subsystem: grid/api/operator
tags: [bios, audit, delete-nous, d30-order, tdd-green, operator-h5]
requires:
  - appendBiosDeath sole-producer (plan 10b-03)
  - B6 fix: caller-owned tombstone (plan 10b-03)
  - delete-nous Phase 8 D-30 ORDER
provides:
  - bios.death emission on operator H5 delete (cause='operator_h5')
  - D-30 ORDER extended: tombstone → despawn → bios.death → nous.deleted
affects:
  - grid/src/api/operator/delete-nous.ts
tech-stack:
  added: []
  patterns: [caller-owned tombstone, snake_case wire payload, D-30 ORDER extension]
key-files:
  created: []
  modified:
    - grid/src/api/operator/delete-nous.ts
decisions:
  - appendBiosDeath is called with targetDid as actorDid (self-report invariant — the Nous being deleted is the actor for the bios.death audit event)
  - stateHash computed at step 5 (Brain RPC pre-tombstone per SC#3) is reused by both appendBiosDeath and appendNousDeleted — no second RPC
  - Tombstone at step 6a was already caller-owned (Phase 8 code); B6 fix means appendBiosDeath does not need to tombstone again
  - currentTick captured once (clock.state.tick) and shared across tombstone, appendBiosDeath, and appendNousDeleted (audit_tick=system_tick invariant)
metrics:
  duration: ~15 minutes
  completed: 2026-04-22
  commits:
    - 1f92f4c feat(10b-05): extend H5 delete-nous with appendBiosDeath before appendNousDeleted
---

# Phase 10b Plan 05: Grid Delete-Nous H5 Cause Summary

Extends the operator H5 delete-nous endpoint (Phase 8 D-30) to emit `bios.death` with `cause='operator_h5'` immediately before the existing `appendNousDeleted` call, preserving the locked D-30 ORDER: tombstone → despawn → bios.death → nous.deleted. Turns Wave 0 RED stub `test/api/operator/delete-nous-bios-death.test.ts` GREEN (3/3 tests).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Insert tombstone + appendBiosDeath into D-30 ORDER before appendNousDeleted | 1f92f4c | grid/src/api/operator/delete-nous.ts |

## Verification — ALL GREEN

```
bun test test/api/operator/delete-nous-bios-death.test.ts --run

 3 pass
 0 fail
 13 expect() calls
Ran 3 tests across 1 file. [90.00ms]
```

Grep verification:
- `rg "appendBiosDeath" grid/src/api/operator/delete-nous.ts` — 1 import + 1 call site
- `rg "registry\.tombstone" grid/src/api/operator/delete-nous.ts` — caller-owned tombstone at step 6a
- `rg "operator_h5" grid/src/api/operator/delete-nous.ts` — cause literal present (tombstone comment + bios.death cause + nous.deleted reason)
- `rg "final_state_hash:" grid/src/api/operator/delete-nous.ts` — snake_case wire key at appendBiosDeath call site
- `rg "finalStateHash:" grid/src/api/operator/delete-nous.ts` — zero matches (no camelCase leak)

## Deviations from Plan

None — plan executed exactly as written.

The existing `registry.tombstone(targetDid, currentTick, resolvedDeps.space)` at step 6a already satisfied the B6 caller-owned tombstone requirement. The plan's interface description used a different API shape (`{ cause, tick }` object) but the actual registry API takes positional args — the existing call at 6a is the correct tombstone regardless. The `appendBiosDeath` tombstone gate (step 7 in the emitter) uses `isTombstoned()` which is satisfied by the existing 6a call.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. The change adds one audit emission within an existing authenticated operator endpoint. The existing Phase 8 operator auth guard (H5 tier check) is unchanged.

## Self-Check

Modified file:
- FOUND: grid/src/api/operator/delete-nous.ts

Commits:
- FOUND: 1f92f4c

## Self-Check: PASSED
