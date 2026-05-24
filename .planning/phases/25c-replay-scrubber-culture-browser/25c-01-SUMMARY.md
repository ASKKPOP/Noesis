---
phase: 25c
plan: 01
subsystem: grid/operator-routes
tags: [header-auth-migration, sanction-wiring, spawn-deps]
dependency_graph:
  requires: [25b-operator-routes]
  provides: [D-01-complete, D-02-complete, D-03-complete]
  affects: [relationships.ts, main.ts, ban-human, freeze-wallet, spawn-system-nous]
tech_stack:
  added: []
  patterns: [header-auth x-operator-tier, dbConn-conditional-store, escape-hatch-injection]
key_files:
  created: []
  modified:
    - grid/src/api/operator/relationships.ts
    - grid/src/main.ts
    - grid/test/api/relationships-privacy.test.ts
    - grid/test/operator/ban-human.test.ts
    - grid/test/operator/freeze-wallet.test.ts
decisions:
  - "D-01: Replaced validateTierBody (body-trust) and query-param tier in relationships.ts with server-trusted x-operator-tier header reads (H2 gate: tierNum < 2, H5 gate: tierNum < 5)"
  - "D-02: humanSanctionStore constructed inline in main.ts conditioned on dbConn; not extracted to a separate class (simplicity per CLAUDE.md rule 2)"
  - "D-03: spawnNousDeps injected via _spawnNousDeps escape hatch cast; operator/index.ts call site unchanged"
  - "Rule 1: Fixed missing getFlags in ban-human + freeze-wallet test stubs; updated empty-reason tests to expect 400 reason_required (route now enforces minLength 10)"
metrics:
  duration: "13 minutes"
  completed: "2026-05-22T19:29:25Z"
  tasks: 2
  files_modified: 5
---

# Phase 25c Plan 01: Wave-0 Cleanup — Header-Auth Migration + Dependency Wiring Summary

**One-liner:** Migrated relationships.ts H2/H5 routes from body/query auth to server-trusted header auth; wired humanSanctionStore and SpawnNousDeps into main.ts so ban/freeze/spawn routes no longer return 503.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing header-auth tests for relationships routes | 400d558 | grid/test/api/relationships-privacy.test.ts |
| 1 (GREEN) | Migrate relationships.ts H2 + H5 to header-auth (D-01) | 3ff62f3 | grid/src/api/operator/relationships.ts, grid/test/api/relationships-privacy.test.ts |
| 2 | Wire humanSanctionStore + SpawnNousDeps in main.ts (D-02, D-03) | a020c4b | grid/src/main.ts, grid/test/operator/ban-human.test.ts, grid/test/operator/freeze-wallet.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing getFlags in humanSanctionStore test stubs**
- **Found during:** Task 2 — ban-human and freeze-wallet test stubs used `as unknown as GridServices['humanSanctionStore']` to bypass type checking, so getFlags was absent. Route step 3b calls `getFlags` for idempotency check → TypeError 500.
- **Fix:** Added `getFlags` implementation to both stubs returning `{ frozen, banned }` integers.
- **Files modified:** grid/test/operator/ban-human.test.ts, grid/test/operator/freeze-wallet.test.ts
- **Commit:** a020c4b

**2. [Rule 1 - Bug] Updated tests expecting empty-reason success to expect 400 reason_required**
- **Found during:** Task 2 — ban-human and freeze-wallet routes enforce `reasonPlain.length >= 10` (WR-02 fix from a prior phase), but tests expected empty-reason to produce 200 with sha256('') in audit.
- **Fix:** Updated "uses empty-string reason" test → "returns 400 reason_required"; added valid 10+ char reason to tests that sent no body.
- **Files modified:** grid/test/operator/ban-human.test.ts, grid/test/operator/freeze-wallet.test.ts
- **Commit:** a020c4b

### Pre-existing Infrastructure Issue (Out of Scope)

The `test/api/relationships-privacy.test.ts` suite has a pre-existing WebSocket server teardown error (`The server is not running`) that marks all 19 existing tests + 8 new header-auth tests as "failed" even though all assertions pass. This cascades from afterEach cleanup calling `fixture.app.close()` after the WebSocket server has already stopped. This is NOT caused by this plan's changes (the same error appears in test/api/server.cors.test.ts). Filed to deferred-items.md.

## Success Criteria Verification

1. **relationships.ts has zero validateTierBody call sites** — `grep "validateTierBody" relationships.ts` → 0 matches ✓
2. **Both routes use x-operator-tier / x-operator-id header pattern** — `grep -c "x-operator-tier" relationships.ts` → 5 matches ✓
3. **main.ts constructs humanSanctionStore conditioned on dbConn** — `const humanSanctionStore = dbConn ?` ✓
4. **main.ts spreads humanSanctionStore into buildServer** — `...(humanSanctionStore ? { humanSanctionStore } : {})` ✓
5. **main.ts constructs spawnNousDeps and injects via _spawnNousDeps escape hatch** — 4 references in main.ts ✓
6. **ban-human.test.ts, freeze-wallet.test.ts, spawn-system-nous.test.ts all pass** — 40/40 tests pass ✓

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The changes REMOVE body/query trust surfaces (T-25c-01-01, T-25c-01-02 mitigated per threat register). The humanSanctionStore SQL uses parameterized queries only (T-25c-01-03 mitigated).

## Self-Check: PASSED

- `grid/src/api/operator/relationships.ts` — exists and has 0 validateTierBody references ✓
- `grid/src/main.ts` — exists with humanSanctionStore and spawnNousDeps ✓
- Commits 400d558, 3ff62f3, a020c4b — all exist in git log ✓
- ban-human/freeze-wallet/spawn tests: 40/40 pass ✓
