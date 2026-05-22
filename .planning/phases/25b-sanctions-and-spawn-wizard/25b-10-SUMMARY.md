---
phase: 25b-sanctions-and-spawn-wizard
plan: 10
subsystem: grid/operator-sanctions
tags: [sanction-route, h4, quarantine, slash, nous, tdd]
dependency_graph:
  requires: [25b-07, 25b-08, 25b-09]
  provides: [quarantine-route, slash-route, registry-quarantine-filter]
  affects: [grid/src/api/operator, grid/src/registry, grid/test/operator]
tech_stack:
  added: []
  patterns: [header-auth-born, reason-discipline, sole-producer-invariant, tdd-red-green]
key_files:
  created:
    - grid/src/api/operator/quarantine.ts
    - grid/src/api/operator/slash-coin.ts
    - grid/test/operator/quarantine.test.ts
    - grid/test/operator/slash-coin.test.ts
  modified:
    - grid/src/api/operator/index.ts
    - grid/src/registry/types.ts
    - grid/src/registry/registry.ts
decisions:
  - "Slash balance debit clamped to 0 on insufficient funds (no 409) — slash is punitive; blocking on insufficient balance would allow a Nous to evade sanctions by pre-spending"
  - "quarantineFlag stored on NousRecord (types.ts) as optional boolean; inRegion() filters it"
  - "Operator-side active()/all() not filtered — only peer-discovery (inRegion) excludes quarantined"
metrics:
  duration: ~15min
  completed: 2026-05-21
  tasks_completed: 3
  files_changed: 7
---

# Phase 25b Plan 10: Quarantine + Slash-Coin Sanctions Summary

One-liner: H4 quarantine route hides Nous from peer-discovery via registry flag; H4 slash route debits ousia balance with clamp-to-zero, both born header-auth.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Quarantine route + registry filter | b93b511 | quarantine.ts, registry.ts, types.ts, quarantine.test.ts, index.ts |
| 2 (TDD RED) | Slash-coin failing tests | d18f727 | slash-coin.test.ts |
| 2 (TDD GREEN) | Slash-coin route implementation | 161ebfb | slash-coin.ts, index.ts |
| 3 | Quarantine tests (written in Task 1) | b93b511 | quarantine.test.ts |

## What Was Built

### POST /api/v1/operator/nous/:did/quarantine (H4)

- H4 header-auth gate (x-operator-tier >= 4)
- Sets `quarantineFlag = true` on NousRecord in registry
- `NousRegistry.inRegion()` now filters `quarantineFlag=true` records from peer-discovery
- Operator-side `active()` and `all()` still return quarantined records
- `appendOperatorQuarantined` emitted on success only (sole-producer invariant)
- `sanction_reasons` row inserted with plaintext; only `reason_hash` in audit payload
- 16 tests covering header-auth, success, reason discipline, peer-discovery filter, operator visibility

### POST /api/v1/operator/nous/:did/slash (H4)

- H4 header-auth gate (x-operator-tier >= 4)
- `amount` validated as positive integer; non-positive/float/string/missing → 400 `invalid_amount`
- `NousRecord.ousia` debited by amount; clamped to 0 on insufficient funds (no 409)
- `appendOperatorSlashed` emitted on success with `amount` field in payload
- `sanction_reasons` row inserted with plaintext; only `reason_hash` in audit payload
- 18 tests covering header-auth, DID/runner gates, amount validation, balance debit, clamp behavior, reason discipline

### Registry Changes

- `NousRecord.quarantineFlag?: boolean` added to `grid/src/registry/types.ts`
- `NousRegistry.inRegion()` updated to exclude quarantined records from peer-discovery

### Barrel Updates

- `grid/src/api/operator/index.ts`: `registerQuarantineRoute` and `registerSlashCoinRoute` registered

## Deviations from Plan

### Auto-fixed Issues

None.

### Deliberate Choices

**1. Task ordering: quarantine tests written in Task 1, not Task 3**

Task 1's verify step required `quarantine.test.ts` to exist. Task 3 was the TDD spec for writing those tests. I wrote the tests as part of completing Task 1 (co-committed in b93b511) and treated Task 3 as the verification step. No functionality change.

**2. quarantineFlag applied via record mutation in route handler**

The plan suggested either `record.quarantineFlag = true` or `registry.setQuarantineFlag(targetDid, true)`. No `setQuarantineFlag` method existed on NousRegistry. Applied mutation directly to the record reference returned by `registry.get(targetDid)` — same pattern used by `mute-broadcast.ts` for `muteFlag`. This is minimal and correct.

## TDD Gate Compliance

Task 2 (slash-coin):
1. `test(25b-10)` commit d18f727 — RED gate (import fails, 0 tests run)
2. `feat(25b-10)` commit 161ebfb — GREEN gate (18 tests pass)

## Verification Results

- `npm run test -- run test/operator/quarantine.test.ts` → 16/16 pass
- `npm run test -- run test/operator/slash-coin.test.ts` → 18/18 pass
- `node scripts/check-operator-sanctions-plaintext.mjs` → clean (0 violations)
- `grep -n "quarantineFlag" grid/src/registry/registry.ts` → field + filter usage confirmed
- `grep -n "quarantineFlag" grid/src/registry/types.ts` → field declaration confirmed

## Known Stubs

None. Both routes are fully wired: audit emitters, sanction_reasons store, registry mutations all connected.

## Threat Flags

No new threat surface beyond what was planned in the STRIDE register.

## Self-Check: PASSED

- grid/src/api/operator/quarantine.ts — exists
- grid/src/api/operator/slash-coin.ts — exists
- grid/src/registry/types.ts — quarantineFlag field present
- grid/src/registry/registry.ts — quarantineFlag filter in inRegion()
- grid/test/operator/quarantine.test.ts — exists, 16 tests
- grid/test/operator/slash-coin.test.ts — exists, 18 tests
- Commits b93b511, d18f727, 161ebfb — confirmed in git log
