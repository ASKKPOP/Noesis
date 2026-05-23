---
phase: 28-personal-nous
plan: "03"
subsystem: grid/api/portal
tags: [grid, api, portal, spawn, chat, tdd-green, wave-2]
dependency_graph:
  requires:
    - 28-01 (append-nous-spawned-by-human.ts, launcher.spawnNous personalitySeed, migrations v15+v16)
    - 28-02 (RED tests: spawn-nous.test.ts + append-nous-spawned-by-human.test.ts + broadcast-allowlist.test.ts)
  provides:
    - POST /api/v1/portal/nous/spawn (payment confirm + DID gen + spawn + audit)
    - GET  /api/v1/portal/nous/spawn/status/:txHash (EVM RPC poll)
    - GET  /api/v1/portal/nous/spawn/config (cost_usdt + treasury_address)
    - GET  /api/v1/portal/nous/spawn/check-name?name= (name uniqueness)
    - GET  /api/v1/portal/human/me/nous (owned Nous or null)
    - Personal-Nous dynamic system prompt in POST /api/v1/portal/chat/nous/:nousId
    - Migration v17: UNIQUE KEY uq_human_owner on nous_registry
    - Extended DID_RE to allow colons for did:noesis:human:* and did:noesis:human-nous:* schemes
  affects:
    - grid/src/api/portal/index.ts (spawn route registration)
    - grid/src/api/server.ts (GridServices: launcher + evmConfirmTx fields)
    - grid/src/db/schema.ts (migration v17)
    - grid/src/audit/append-human-joined.ts (DID_RE extended)
    - Plans 04+05 (dashboard UI consumes these API routes)
tech_stack:
  added: []
  patterns:
    - Injectable SpawnHumanNousDeps deps pattern with optional audit/currentTick/gridName
    - DID prefix gate before DB query (T-28-07: prevents arbitrary nous_registry lookup)
    - INSERT IGNORE for idempotent payment recording
    - Dynamic system prompt via SEED_PERSONALITY_DESC map + buildPersonalNousPrompt helper
key_files:
  created:
    - grid/src/api/portal/spawn.ts
  modified:
    - grid/src/api/portal/index.ts
    - grid/src/api/portal/chat.ts
    - grid/src/api/server.ts
    - grid/src/db/schema.ts
    - grid/src/audit/append-human-joined.ts
decisions:
  - "SpawnHumanNousDeps has audit/currentTick/gridName as optional fields — tests don't provide them, production wiring in index.ts does. This avoids requiring AuditChain in test stub without a separate registerSpawnRoutes overload."
  - "DID_RE extended from /^did:noesis:[a-z0-9_-]+$/i to /^did:noesis:[a-z0-9_:-]+$/i — colons required for did:noesis:human:* and did:noesis:human-nous:* schemes. Negative cases (did:other:foo, not-a-did, empty) still rejected."
  - "appendNousSpawnedByHuman skipped in tests (audit field absent) — tests assert 200 + spawnNous call, not audit emission. Production wiring includes audit."
  - "Migration v17 added — uq_human_owner unique constraint on nous_registry for T-28-04 race condition mitigation."
  - "humanPool uses query() (not execute()) — matches existing GridServices.humanPool interface (Phase 26 pattern)."
  - "EVM RPC confirmTxPaid deferred to evmConfirmTx optional service field — decouples viem/ethers wiring from route layer. Production genesis/main.ts wires this with actual RPC client."
metrics:
  duration: "~25 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 5
---

# Phase 28 Plan 03: Portal Spawn API + Personal-Nous Chat Summary

Five portal spawn routes + chat endpoint personal-Nous fallback via seed-derived dynamic system prompt; turns Plan 02 RED tests GREEN.

## What Was Built

### Task 1: grid/src/api/portal/spawn.ts — Five Spawn Routes

**Route signatures:**

| Method | Path | Success | Key error codes |
|--------|------|---------|-----------------|
| POST | /api/v1/portal/nous/spawn | 200 { ok: true, nous_did } | 503 spawn_not_enabled, 401 not_authenticated/invalid_token, 400 invalid_body/payment_not_confirmed, 409 already_owns_nous/name_taken/payment_already_claimed |
| GET | /api/v1/portal/nous/spawn/status/:txHash | 200 { confirmed } | 401, 400 invalid_body |
| GET | /api/v1/portal/nous/spawn/config | 200 { cost_usdt, treasury_address } | 401 |
| GET | /api/v1/portal/nous/spawn/check-name?name= | 200 { available } | 401, 400 invalid_body |
| GET | /api/v1/portal/human/me/nous | 200 { nous: NousRecord | null } | 401 |

**POST /spawn handler order (matches test assertions):**
1. Env gate (`ALLOW_HUMAN_SPAWNED_NOUS`)
2. JWT auth (cookie → ES256 verify → `did:noesis:human:*` prefix)
3. Body validation (NAME_RE + SEED_ENUM + region + TX_HASH_RE)
4. Payment replay guard (`isPaymentClaimed` — 409 before other checks)
5. One-Nous cap (`queryHasNous` — 409)
6. Name uniqueness (`queryNameTaken` — 409)
7. Payment confirmation (`confirmTxPaid` — 400 if unconfirmed)
8. DID derivation: `did:noesis:human-nous:<first 6 hex chars of ETH addr>-<lowercased name>`
9. Ed25519 public key generation (SPKI-DER → base64)
10. `deps.spawnNous(name, nousDid, publicKey, region, humanOwner, seed)`
11. `deps.recordPayment(txHash, humanDid, nousDid)` (INSERT IGNORE — idempotent)
12. `appendNousSpawnedByHuman` (only when `deps.audit` is present — skipped in tests)
13. Return `{ ok: true, nous_did }`

### Deps Wiring Location (grid/src/api/portal/index.ts)

| Deps method | SQL / service |
|-------------|---------------|
| spawnNous | `services.launcher?.spawnNous(...)` (optional service field) |
| queryHasNous | `SELECT 1 FROM nous_registry WHERE human_owner = ? LIMIT 1` via humanPool.query |
| confirmTxPaid | `services.evmConfirmTx(txHash)` (optional service field, returns { confirmed: false } when absent) |
| recordPayment | `INSERT IGNORE INTO spawn_payments (tx_hash, human_did, nous_did, confirmed) VALUES (?, ?, ?, 1)` |
| isPaymentClaimed | `SELECT 1 FROM spawn_payments WHERE tx_hash = ? AND nous_did IS NOT NULL LIMIT 1` |
| queryNameTaken | `SELECT 1 FROM nous_registry WHERE name = ? LIMIT 1` |
| getOwnedNous | `SELECT did, name, region, personality_seed, spawned_at_tick, ousia FROM nous_registry WHERE human_owner = ? LIMIT 1` |
| audit | `services.audit` |
| currentTick | `() => services.clock.state.tick` |
| gridName | `() => services.gridName` |

### Migration v17 (uq_human_owner)

Migration v17 was **added** (did not already exist):
- UP: `ALTER TABLE nous_registry ADD UNIQUE KEY uq_human_owner (human_owner)`
- DOWN: `ALTER TABLE nous_registry DROP INDEX uq_human_owner`

This enforces the T-28-04 race condition constraint at DB layer — concurrent spawns both passing `queryHasNous=false` will have the second INSERT fail at the unique key constraint, returning 409 `already_owns_nous`.

### EVM RPC Client Location

`confirmTxPaid` is wired through `services.evmConfirmTx` — an optional function field on `GridServices`. This decouples the viem/ethers client from the route layer. Production `genesis/main.ts` must wire this field with a function that:
1. Gets the tx receipt from `GRID_EVM_RPC_URL`
2. Verifies `to === GRID_TREASURY_ADDRESS` (lowercased)
3. Decodes USDT `transfer(to, amount)` calldata and checks `amount >= parseUnits(SPAWN_COST_USDT, 6)`
4. Returns `{ confirmed: boolean, amountUsdt?, from? }`

When absent (tests, legacy Grid instances), `confirmTxPaid` returns `{ confirmed: false }`.

### Task 2: grid/src/api/portal/chat.ts — Personal-Nous Dynamic Prompt

Added above `registerPortalChatRoutes`:

```typescript
const SEED_PERSONALITY_DESC: Record<string, string> = {
    Explorer: 'curious, adventurous, open to new ideas...',
    Scholar:  'analytical, methodical, intellectually precise...',
    Merchant: 'pragmatic, socially adroit, commercially minded...',
    Guardian: 'principled, protective, steadfast, warm and dependable...',
};

function buildPersonalNousPrompt(name: string, seed: string): string { ... }
```

Modified the nousId lookup in POST `/api/v1/portal/chat/nous/:nousId`:
1. Static map check (genesis Nous: sophia/hermes/themis) — unchanged behavior
2. **DID prefix gate** (T-28-07): `nousId.startsWith('did:noesis:human-nous:')` — non-human-nous DIDs short-circuit to 404
3. DB query: `SELECT personality_seed, name FROM nous_registry WHERE did = ? LIMIT 1`
4. `buildPersonalNousPrompt(row.name, row.personality_seed ?? 'Explorer')` → systemPrompt

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DID_RE too restrictive for human-nous DID scheme**
- **Found during:** Task 1 verification — `append-nous-spawned-by-human.test.ts` happy path tests failing
- **Issue:** `DID_RE = /^did:noesis:[a-z0-9_-]+$/i` in `append-human-joined.ts` does not allow colons. Both `did:noesis:human:0x...` and `did:noesis:human-nous:abcdef-eidolon` contain colons after the segment and fail this regex.
- **Fix:** Extended to `/^did:noesis:[a-z0-9_:-]+$/i` — adds `:` to the allowed character class. Negative cases (`did:other:foo`, `not-a-did`, `''`, `did:noesis:`) all still rejected.
- **Files modified:** grid/src/audit/append-human-joined.ts
- **Commit:** 80337d7

**2. [Rule 2 - Missing critical functionality] SpawnHumanNousDeps interface mismatch**
- **Found during:** Task 1 design — plan template included `audit`, `currentTick`, `gridName` as required fields, but test `makeStubDeps()` only stubs 7 data methods
- **Fix:** Made `audit`, `currentTick`, `gridName` optional in `SpawnHumanNousDeps`. `appendNousSpawnedByHuman` is called only when `deps.audit` is defined. Production wiring in `index.ts` provides all three.
- **Impact:** No test changes needed; production behavior preserved
- **Commit:** 80337d7

**3. [Rule 2 - Missing critical functionality] GridServices missing launcher + evmConfirmTx fields**
- **Found during:** Task 1 wiring in index.ts — `services.launcher` and `services.evmConfirmTx` needed but not in `GridServices`
- **Fix:** Added optional `launcher` and `evmConfirmTx` fields to `GridServices` in `server.ts`. Both are optional (absent → no-op / `confirmed: false`) so legacy tests without Phase 28 wiring still compile.
- **Commit:** 80337d7

## Known Stubs

**`confirmTxPaid` production EVM client** — `services.evmConfirmTx` is optional on `GridServices`. When absent (all current test harnesses), `confirmTxPaid` returns `{ confirmed: false }`. Genesis `main.ts` must wire a real EVM RPC client to this field for production payment verification. This is documented in the output spec above.

## Threat Flags

None — all five new routes and the chat extension implement mitigations from the plan's threat register (T-28-02 through T-28-08). No new trust boundaries introduced beyond those specified in the plan.

## Commits

| Commit | Description |
|--------|-------------|
| `80337d7` | feat(28-03): add portal spawn routes + migration v17 + DID_RE colon fix |
| `39551ed` | feat(28-03): extend chat.ts for personal-Nous dynamic system prompt (D-02) |

## Self-Check: PASSED

- [x] `grid/src/api/portal/spawn.ts` — FOUND
- [x] `grid/src/api/portal/index.ts` — contains `registerSpawnRoutes`
- [x] `grid/src/api/portal/chat.ts` — contains `buildPersonalNousPrompt`, `SEED_PERSONALITY_DESC`
- [x] `grid/src/api/server.ts` — contains `launcher` + `evmConfirmTx` optional fields
- [x] `grid/src/db/schema.ts` — contains migration v17 `uq_human_owner`
- [x] `grid/src/audit/append-human-joined.ts` — DID_RE extended to `[a-z0-9_:-]+`
- [x] Commits: 80337d7, 39551ed — present in git log
- [x] `npx vitest run test/portal/spawn-nous.test.ts` — 30/30 pass
- [x] `npx vitest run test/audit/append-nous-spawned-by-human.test.ts` — 25/25 pass
- [x] `npx vitest run test/audit/broadcast-allowlist.test.ts` — 68/68 pass
- [x] `npx vitest run test/portal/chat.test.ts` — 10/10 tests pass (pre-existing WS teardown error in test runner is not a test failure)
- [x] `grep -rn "audit.append('nous.spawned_by_human'" grid/src/ | wc -l` → 1 (sole producer)
- [x] No modifications to STATE.md or ROADMAP.md
