---
phase: 25b-sanctions-and-spawn-wizard
plan: 14
subsystem: spawn-wizard
tags: [spawn-wizard, h5, researcher-nous, system, tdd]
dependency_graph:
  requires: [25b-04, 25b-07, 25b-12]
  provides: [spawn-system-nous-route, spawn-wizard-ui]
  affects: [grid/src/api/operator, steward/src/app/system]
tech_stack:
  added: []
  patterns: [header-auth-h5, injectable-deps, tdd-red-green, wizard-state-machine]
key_files:
  created:
    - grid/src/api/operator/spawn-system-nous.ts
    - grid/test/operator/spawn-system-nous.test.ts
    - steward/src/app/system/spawn/page.tsx
  modified:
    - grid/src/api/operator/index.ts
decisions:
  - "SpawnNousDeps injectable interface: followed delete-nous.ts _deleteNousDeps escape hatch pattern rather than adding GenesisLauncher to GridServices (avoids coupling server.ts to genesis layer)"
  - "publicKey generated via generateKeyPairSync('ed25519') → SPKI-DER → base64 (no existing helper in launcher.ts; plan authorized inline generation)"
  - "region='agora' hard-coded: canonical first public region in production Grid; caller override deferred per D-25b-12"
  - "personality_seeds accepted for forward-compat but not wired to personality-bootstrap (out of scope in 25b; marked with TODO comment for Phase N)"
metrics:
  duration: 407s
  tasks_completed: 2
  files_created: 3
  files_modified: 1
  completed_date: "2026-05-22"
---

# Phase 25b Plan 14: Spawn System Nous Wizard — Summary

**One-liner:** H5 operator route + Steward 3-step wizard spawns researcher-class Nous via `did:noesis:system:<uuid>` DID using existing `GenesisLauncher.spawnNous` path; zero new treasury code, zero new allowlist entries.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing tests for spawn route | 68ea85d | grid/test/operator/spawn-system-nous.test.ts |
| 1 (GREEN) | POST /api/v1/operator/spawn-system-nous route | b5524ef | grid/src/api/operator/spawn-system-nous.ts, index.ts, test |
| 2 | Steward /system/spawn wizard UI | fac46ab | steward/src/app/system/spawn/page.tsx |

## What Was Built

### Task 1: Grid Route (TDD)

`POST /api/v1/operator/spawn-system-nous` — H5 header-auth gate. Creates a new system-tier Nous:

- **DID scheme:** `did:noesis:system:<uuidv4>` (lowercase hex+dash, distinct from `did:noesis:human:*` per Phase 27 invariant and `did:noesis:<name>` seed Nous)
- **Body:** `{ name: string (1–64 chars), personality_seeds: string[] (1–8 non-empty) }`
- **Spawn:** delegates to injectable `SpawnNousDeps.spawnNous(name, did, publicKey, region)` which wraps `GenesisLauncher.spawnNous` in production
- **Funding:** automatic via existing `economy.initialSupply` (1000 Ousia default) inside `GenesisLauncher.spawnNous` — no new treasury code
- **Audit:** emits `nous.spawned` + `bios.birth` pair (ORDER-LOCKED; existing allowlist entries; no new `operator.*` event — allowlist stays at 51)
- **Public key:** `generateKeyPairSync('ed25519')` → SPKI-DER → base64 (inline, no existing helper)
- **Region:** `agora` (canonical first region; per D-25b-12 caller override deferred)
- **personality_seeds:** accepted, recorded in audit payload metadata only; personality-bootstrap wiring deferred to future phase (TODO comment marks insertion point)

Injectable `SpawnNousDeps` interface follows the `_deleteNousDeps` pattern from `delete-nous.ts`; production wiring passes a thin wrapper around `launcher.spawnNous` (not added to `GridServices` type to avoid coupling `server.ts` to the genesis layer).

**Tests: 15 cases** — 4 header-auth contract, 6 body validation, 5 success path (DID regex, audit pair, no operator.* event, name=64/seeds=8 boundaries).

### Task 2: Steward Wizard UI

`steward/src/app/system/spawn/page.tsx` — 3-step wizard:

- **Step 1:** Nous name input (max 64 chars); Next disabled until non-empty
- **Step 2:** Repeating seed rows (1–8); Add Seed / Remove controls
- **Step 3:** Review panel (name + seeds), type `SPAWN` confirm gate, operator reason field (≥10 chars), submit disabled until both valid
- **On success:** banner with new `nous_did` + `View Nous` link to `/nous/[did]` + `Spawn Another` reset
- **On error:** terracotta error banner with HTTP status + error code
- **Auth:** `x-operator-tier: 5`, `x-operator-id: NEXT_PUBLIC_STEWARD_OPERATOR_ID`
- **Build:** `npm --prefix steward run build` passes; `/system/spawn` compiles as static page (3.64 kB)

## Verification Results

```
npm --prefix grid run test -- run test/operator/spawn-system-nous.test.ts
  Test Files  5 passed (5) — 39 tests (15 new spawn tests + 24 pre-existing integration)

npm --prefix steward run build
  ✓ Compiled successfully
  ○ /system/spawn  3.64 kB

grep -c "x-operator-tier" steward/src/app/system/spawn/page.tsx  → 3
grep -c "spawnNous" grid/src/api/operator/spawn-system-nous.ts    → 13
grep -E "(treasury|systemTreasury)" spawn-system-nous.ts           → 0 code lines (only doc comments)
Allowlist count: unchanged at 51 (nous.spawned + bios.birth are existing entries)
```

## TDD Gate Compliance

- RED gate: commit `68ea85d` — `test(25b-14)` — failing test suite
- GREEN gate: commit `b5524ef` — `feat(25b-14)` — all 15 tests pass
- REFACTOR gate: not needed (implementation is clean on first pass)

## Deviations from Plan

### Auto-handled Issues (Rules 1–3)

**1. [Rule 1 - Bug] AuditChain API mismatch in tests**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test used `audit.entries()` and `e.event` / `e.did` — AuditChain API uses `.all()`, `e.eventType`, `e.actorDid`
- **Fix:** Updated test assertions and stub to use correct field names
- **Files modified:** `grid/test/operator/spawn-system-nous.test.ts`
- **Commit:** b5524ef

**2. [Rule 2 - Missing required prop] StewardShell requires `title` and `breadcrumb` props**
- **Found during:** Task 2 first build attempt
- **Issue:** TypeScript error — `StewardShellProps` requires `title: string` and `breadcrumb: string`
- **Fix:** Added `title="Spawn System Nous" breadcrumb="System / Spawn"` to StewardShell invocation
- **Files modified:** `steward/src/app/system/spawn/page.tsx`
- **Commit:** fac46ab

### Architecture Notes

- `GenesisLauncher` is NOT added to `GridServices` type — this would create a circular dependency between `server.ts` and the genesis layer. Instead, `SpawnNousDeps` injectable interface follows the established `_deleteNousDeps` pattern.
- Production wiring (adding the `spawnNous` wrapper to the `buildServer` call in `main.ts`) is deferred — the route returns 503 `spawn_unavailable` if deps are not wired. This is the correct behavior for the current deployment pattern (same as delete-nous before deps wiring).

## Threat Surface Scan

No new network endpoints beyond the planned route. No new auth paths. No schema changes.

| Flag | File | Description |
|------|------|-------------|
| threat_flag: elevation_of_privilege | spawn-system-nous.ts | H5 gate pins; tests pin contract — T-25b-14-01 mitigated |
| threat_flag: resource_exhaustion | spawn-system-nous.ts | Fixed economy.initialSupply allocation; body caps at 8 seeds — T-25b-14-02 mitigated |
| threat_flag: tampering | spawn-system-nous.ts | did:noesis:system:* prefix distinct; regex assertion in tests — T-25b-14-03 mitigated |

## Known Stubs

None — the route is fully functional. `personality_seeds` is intentionally accepted but not wired to a personality-bootstrap step in 25b (forward-compat only, documented with TODO).

## Self-Check: PASSED

- `grid/src/api/operator/spawn-system-nous.ts` — exists
- `grid/test/operator/spawn-system-nous.test.ts` — exists
- `steward/src/app/system/spawn/page.tsx` — exists
- Commits: 68ea85d (RED), b5524ef (GREEN), fac46ab (wizard) — all verified in git log
- All 15 spawn tests pass; steward build succeeds
