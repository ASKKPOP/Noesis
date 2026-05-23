---
phase: 28-personal-nous
plan: "02"
subsystem: grid/tests
tags: [grid, tests, tdd, wave-1, spawn, audit, allowlist]
dependency_graph:
  requires: []
  provides:
    - "grid/test/portal/spawn-nous.test.ts — RED contract tests for spawn API (SPAWN-01..06)"
    - "grid/test/audit/append-nous-spawned-by-human.test.ts — RED sole-producer invariant tests (SPAWN-04)"
    - "grid/test/audit/broadcast-allowlist.test.ts — allowlist 53-member assertions"
  affects:
    - "Plan 01 (append-nous-spawned-by-human.ts must satisfy test contracts)"
    - "Plan 03 (spawn.ts must satisfy SpawnHumanNousDeps interface + route contracts)"
tech_stack:
  added: []
  patterns:
    - "Injectable SpawnHumanNousDeps deps pattern (mirrors SpawnNousDeps in spawn-system-nous.ts)"
    - "Fastify buildApp helper with @fastify/cookie + registerSpawnRoutes"
    - "makeToken() helper using keyPairPromise + ES256 (matching auth.ts algorithm)"
    - "makeStubDeps() factory with vi.fn() overrides per test case"
key_files:
  created:
    - grid/test/portal/spawn-nous.test.ts
    - grid/test/audit/append-nous-spawned-by-human.test.ts
  modified:
    - grid/test/audit/broadcast-allowlist.test.ts
decisions:
  - "Used ES256 (not EdDSA) for makeToken() — matches actual auth.ts keyPairPromise algorithm; plan template had EdDSA which would have generated unverifiable tokens"
  - "AuditChain constructor called as new AuditChain() (no args) — matches actual chain.ts signature; plan suggested 'new AuditChain(grid-name)' which is incorrect"
  - "ALLOWLIST_MEMBERS imported alongside ALLOWLIST for position-based assertions — required adding to import statement in broadcast-allowlist.test.ts"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-23"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 28 Plan 02: TDD RED Scaffolds (Wave 1 Test Files) Summary

Wave 0/1 RED test scaffold — three test files covering SPAWN-01..06 contracts, sole-producer invariants, and allowlist length gate. All tests fail until Plans 01 and 03 ship implementations.

## What Was Built

### Task 1: grid/test/portal/spawn-nous.test.ts (26 it() cases)

Covers all SPAWN-01..06 contracts via injectable `SpawnHumanNousDeps` stubs. No live MySQL, no RPC, no real wagmi.

**Final test count:** 26 `it()` cases across 9 describe blocks:

| Describe block | Cases |
|----------------|-------|
| POST /api/v1/portal/nous/spawn | 3 (env gate, auth) |
| name validation (SPAWN-02) | 5 |
| seed enum validation (SPAWN-02) | 5 (1 reject + 4 accept) |
| payment confirmation (SPAWN-01) | 4 |
| one-Nous cap (SPAWN-06) | 1 |
| name uniqueness | 1 |
| DID scheme (SPAWN-02) | 2 |
| GET /spawn/status/:txHash | 2 |
| GET /spawn/config | 1 |
| GET /spawn/check-name | 2 |
| GET /portal/human/me/nous (SPAWN-05) | 3 |

**RED state:** `Error: Failed to load url ../../src/api/portal/spawn.js` — module does not exist until Plan 03.

### Task 2: grid/test/audit/append-nous-spawned-by-human.test.ts (21 it() cases)

Sole-producer invariants for `appendNousSpawnedByHuman`. Covers all guard layers Plan 01 must implement.

**Final test count:** 21 `it()` cases across 6 describe blocks:

| Describe block | Cases |
|----------------|-------|
| happy path | 5 |
| type guards | 4 |
| DID validation | 6 |
| field guards | 5 |
| closed-tuple invariant | 3 |
| privacy guard | 2 |

**RED state:** `Error: Failed to load url ../../src/audit/append-nous-spawned-by-human.js` — module does not exist until Plan 01.

### Task 3: grid/test/audit/broadcast-allowlist.test.ts (updated)

Added `ALLOWLIST_MEMBERS` to imports. Updated 52 → 53 in size/mutation assertions. Added `nous.spawned_by_human` to the `it.each` membership list. Added 2 new assertions:

- `ALLOWLIST_MEMBERS.includes('nous.spawned_by_human')` is true  
- `ALLOWLIST_MEMBERS[52]` equals `'nous.spawned_by_human'`
- `ALLOWLIST.has('nous.spawned_by_human')` is true

**RED state:** 6 assertions fail — `nous.spawned_by_human` is not in `broadcast-allowlist.ts` until Plan 01.

## SpawnHumanNousDeps Interface (Plan 03 Must Match Exactly)

```typescript
export interface SpawnHumanNousDeps {
    spawnNous(name: string, did: string, publicKey: string, region: string, humanOwner: string, personalitySeed: string): void;
    queryHasNous(humanDid: string): Promise<boolean>;
    confirmTxPaid(txHash: string): Promise<{ confirmed: boolean; amountUsdt?: string; from?: string; }>;
    recordPayment(txHash: string, humanDid: string, nousDid: string): Promise<void>;
    isPaymentClaimed(txHash: string): Promise<boolean>;
    queryNameTaken(name: string): Promise<boolean>;
    getOwnedNous(humanDid: string): Promise<NousRecord | null>;
}

export interface NousRecord {
    did: string;
    name: string;
    region: string;
    personality_seed: string;
    spawned_at_tick: number;
}

export function registerSpawnRoutes(app: FastifyInstance, deps: SpawnHumanNousDeps): Promise<void>;
```

## NousSpawnedByHumanPayload Interface (Plan 01 Must Match Exactly)

```typescript
export interface NousSpawnedByHumanPayload {
    readonly grid_name: string;
    readonly nous_did: string;
    readonly owner_human_did: string;
    readonly tick: number;
}

export function appendNousSpawnedByHuman(
    audit: AuditChain,
    payload: NousSpawnedByHumanPayload,
): AuditEntry;
// EXPECTED_KEYS (alphabetical) = ['grid_name', 'nous_did', 'owner_human_did', 'tick']
// actorDid must be payload.nous_did (sole-producer invariant)
// eventType must be 'nous.spawned_by_human'
```

## Contract Questions Plan 03 Must Resolve

1. **DID scheme format tested:** `/^did:noesis:human-nous:[a-f0-9]{6,8}-eidolon$/` — the prefix is the first 6-8 hex chars of the human ETH address (lowercased). Plan 03 must use this derivation pattern.
2. **Seed enum tested:** `['Explorer', 'Scholar', 'Merchant', 'Guardian']` — Plan 03 must validate exactly these 4 values.
3. **Name regex tested:** `/^[a-zA-Z0-9_]{3,32}$/` — no hyphens, no spaces, 3-32 chars.
4. **`spawnNous` arg order tested:** `(name, did, publicKey, region, humanOwner, personalitySeed)` — 6 params; Plan 03 must call with this signature.
5. **`recordPayment` args tested:** `(txHash, humanDid, nousDid)` — called after successful spawn.
6. **GET /spawn/config** reads `process.env.SPAWN_COST_USDT` and `process.env.GRID_TREASURY_ADDRESS`.
7. **GET /spawn/check-name** reads `?name=` query param and calls `queryNameTaken`.
8. **Freeze gate check ordering:** Payment-already-claimed check happens before payment confirmation (to guard replay attacks first).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong JWT algorithm in makeToken() helper**
- **Found during:** Task 1 implementation
- **Issue:** Plan template specified `.setProtectedHeader({ alg: 'EdDSA' })` but `grid/src/api/portal/auth.ts` uses `generateKeyPair('ES256')` — EdDSA tokens would be rejected by `jwtVerify` in the spawn route's auth middleware.
- **Fix:** Used `alg: 'ES256'` to match the actual key pair algorithm. Verified by reviewing `auth.ts` lines 50, 142.
- **Files modified:** grid/test/portal/spawn-nous.test.ts
- **Commit:** 05751f2

**2. [Rule 2 - Missing critical functionality] AuditChain constructor signature**
- **Found during:** Task 2 implementation
- **Issue:** Plan template suggested `new AuditChain('test-grid')` with a grid name arg. Actual `grid/src/audit/chain.ts` takes no constructor args.
- **Fix:** Used `new AuditChain()` (no args) to match actual constructor.
- **Files modified:** grid/test/audit/append-nous-spawned-by-human.test.ts
- **Commit:** 2940ede

## Known Stubs

None — this plan creates test scaffolds only. No production code stubs were introduced.

## Threat Flags

None — test files only; no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- [x] `grid/test/portal/spawn-nous.test.ts` exists
- [x] `grid/test/audit/append-nous-spawned-by-human.test.ts` exists
- [x] `grid/test/audit/broadcast-allowlist.test.ts` modified
- [x] Commits: 05751f2, 2940ede, 280cfe0
- [x] All three files exit non-zero (RED state confirmed)
- [x] No modifications to STATE.md or ROADMAP.md
