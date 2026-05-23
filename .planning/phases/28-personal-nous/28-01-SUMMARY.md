---
phase: 28-personal-nous
plan: "01"
subsystem: grid
tags: [grid, audit, allowlist, migration, foundation, launcher]
dependency_graph:
  requires: []
  provides:
    - nous.spawned_by_human audit emitter (sole-producer, position 53)
    - bootstrapPsycheHash personalitySeed extension
    - launcher.spawnNous personalitySeed parameter
    - Migration v15 (personality_seed column on nous_registry)
    - Migration v16 (spawn_payments table)
    - Freeze gate covering POST /api/v1/portal/nous/spawn
  affects:
    - grid/src/audit/broadcast-allowlist.ts (53 entries)
    - grid/src/genesis/launcher.ts (spawnNous + bootstrapPsycheHash)
    - grid/src/registry/types.ts (SpawnRequest.personalitySeed)
    - grid/src/db/schema.ts (migrations v15 + v16)
    - grid/src/api/portal/check-frozen.ts (spawn route gated)
tech_stack:
  added: []
  patterns:
    - Sole-producer audit emitter (closed 4-key tuple, DID_RE guards, explicit reconstruction)
    - Append-only DB migration pattern
    - Regex-anchored freeze gate pattern ($-terminated route match)
key_files:
  created:
    - grid/src/audit/append-nous-spawned-by-human.ts
    - grid/test/audit/append-nous-spawned-by-human.test.ts
    - grid/test/genesis/launcher-personality-seed.test.ts
    - grid/test/db/schema-v15-v16.test.ts
    - grid/test/portal/check-frozen-spawn.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/audit/index.ts
    - grid/src/genesis/launcher.ts
    - grid/src/genesis/types.ts
    - grid/src/registry/types.ts
    - grid/src/db/schema.ts
    - grid/src/api/portal/check-frozen.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/audit/allowlist-forty-five.test.ts
    - grid/test/audit/allowlist-twenty-two.test.ts
    - grid/test/audit/allowlist-twenty-six.test.ts
    - grid/test/audit/operator-exported-allowlist.test.ts
    - grid/test/audit/skill-allowlist.test.ts
    - grid/test/audit/append-human-spoke.test.ts
    - grid/test/db/schema-v14.test.ts
decisions:
  - registry.ts (RegistryStore SQL store) not updated — NousRegistry is in-memory; RegistryStore.upsert() persists records after spawn but personalitySeed is not yet in NousRecord; deferred to Plan 02 when the portal spawn API populates the column directly via SQL
  - DID_RE pattern /^did:noesis:[a-z0-9_-]+$/i does not allow colons; test DIDs use hyphenated segments (did:noesis:human-nous-henry-eidolon)
metrics:
  duration: "~20 minutes"
  completed_date: "2026-05-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 15
---

# Phase 28 Plan 01: Grid Foundation — Audit + Schema + Launcher Summary

One-liner: Sole-producer `nous.spawned_by_human` emitter at allowlist position 53, `bootstrapPsycheHash` personalitySeed bias extension, migrations v15/v16, and freeze gate covering the spawn POST route.

## What Was Built

### Task 1: nous.spawned_by_human Audit Emitter

Created `grid/src/audit/append-nous-spawned-by-human.ts` — the sole-producer boundary for `nous.spawned_by_human` audit events. Follows the same discipline as `appendHumanTransferred`:

- Closed 4-key payload: `{grid_name, nous_did, owner_human_did, tick}` (alphabetical)
- DID_RE guards on both `nous_did` and `owner_human_did`
- Non-empty string guard on `grid_name`
- Non-negative integer guard on `tick`
- Explicit reconstruction (no spread operator)
- `payloadPrivacyCheck` before `audit.append`

Added `'nous.spawned_by_human'` at position 53 in `broadcast-allowlist.ts`. Updated 7 size-pinning test files from 52 → 53.

Exported from `grid/src/audit/index.ts` barrel.

**Sole-producer invariant:** `grep -rn "audit.append('nous.spawned_by_human'" grid/src/` returns exactly 1 line.

### Task 2: Launcher + Registry + Schema Extensions

**`bootstrapPsycheHash` extension** (launcher.ts line 41):
- Now accepts optional `personalitySeed?: string`
- With seed: `SHA-256(did|pk|tick|seed)` — deterministically distinct per seed type
- Without seed: `SHA-256(did|pk|tick)` — backward-compatible

**`spawnNous` extension** (launcher.ts line 452):
- New signature: `spawnNous(name, did, publicKey, region, humanOwner?, personalitySeed?)`
- Passes `personalitySeed` into `registry.spawn()` (line 462) and `bootstrapPsycheHash()` (line 478)

**`SpawnRequest` type** (registry/types.ts): added `personalitySeed?: string`

**`SeedNous` type** (genesis/types.ts): added `personalitySeed?: string` for forward-compatibility

**Migration v15** (schema.ts): `ALTER TABLE nous_registry ADD COLUMN personality_seed VARCHAR(32) NULL DEFAULT NULL`

**Migration v16** (schema.ts): Creates `spawn_payments` table with `tx_hash CHAR(66) PRIMARY KEY` and `idx_spawn_payments_human` index on `human_did`.

### Task 3: Freeze Gate for Spawn Route

Added `/^\/api\/v1\/portal\/nous\/spawn$/` to `PORTAL_ACTION_PATTERNS` in `check-frozen.ts`.

The `$` anchor ensures:
- `POST /api/v1/portal/nous/spawn` → blocked for frozen/banned humans (403)
- `GET /api/v1/portal/nous/spawn/status/:txHash` → NOT blocked (poll-able while frozen)
- `GET /api/v1/portal/nous/spawn/config` → NOT blocked
- `GET /api/v1/portal/nous/spawn/check-name` → NOT blocked

## Verification

- `npx vitest run test/audit/ test/portal/check-frozen.test.ts test/portal/check-frozen-spawn.test.ts test/genesis/launcher-personality-seed.test.ts test/db/schema-v15-v16.test.ts` → 421 tests pass
- `grep -rn "audit.append('nous.spawned_by_human'" grid/src/` → 1 line (sole producer)
- `ALLOWLIST_MEMBERS.length === 53`; `ALLOWLIST_MEMBERS[52] === 'nous.spawned_by_human'`
- Migration versions are sequential 1..16, no duplicates

## Commits

| Commit | Description |
|--------|-------------|
| `87a26e6` | feat(28-01): add nous.spawned_by_human emitter + allowlist entry + barrel export |
| `13ddcd1` | feat(28-01): extend launcher + registry types for personalitySeed; add migrations v15+v16 |
| `d3e5aa8` | feat(28-01): extend check-frozen.ts to gate POST /api/v1/portal/nous/spawn |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Deviations Noted

**1. [Rule 2 - Deviation] RegistryStore.upsert() not updated with personality_seed column**

- **Found during:** Task 2
- **Issue:** The plan's action 3 instructed updating `registry.ts` INSERT statement. However, `NousRegistry` is an in-memory Map (not SQL). The SQL persistence layer is `grid/src/db/stores/registry-store.ts` which has a static INSERT/SELECT that does not include `personality_seed`. However, `NousRecord` interface also does not have `personalitySeed` — the seed goes into the DB column via Plan 02's portal spawn API which will write directly to MySQL (not through the in-memory registry). Adding `personalitySeed` to `NousRecord` and `RegistryStore.upsert()` would be the Plan 02 responsibility.
- **Decision:** Left `RegistryStore` and `NousRecord` unchanged. `SpawnRequest.personalitySeed` is accepted by the in-memory registry's `spawn()` method (it ignores unknown fields) and will be wired to the DB column when Plan 02 creates the portal spawn API endpoint that calls the SQL INSERT directly.

**2. [Rule 1 - Bug] Test VALID_PAYLOAD DID used colon in human-nous DID**

- **Found during:** Task 1 GREEN phase
- **Issue:** Test used `did:noesis:human-nous:henry-eidolon` which fails `DID_RE = /^did:noesis:[a-z0-9_-]+$/i` because colon is not in the character class.
- **Fix:** Changed test DID to `did:noesis:human-nous-henry-eidolon` (hyphen separator instead of colon). The actual DID scheme for Plan 02 portal spawn API will need to handle this — the CONTEXT.md DID scheme `did:noesis:human-nous:<username>-<name>` may need the DID_RE to be extended, or use hyphens only.

**3. [Pre-existing, out of scope] migration-schema.test.ts `DROP TABLE` assertion**

- The test at `test/db/migration-schema.test.ts:72` asserts all migration DOWN SQL contains `DROP TABLE`. This was already failing before Phase 28 (v9/v13/v14 use `ALTER TABLE ... DROP COLUMN`). Not introduced by our changes; logged as deferred.

## Known Stubs

None — all code paths are implemented, no placeholder values or TODO returns.

## Threat Flags

None — no new network endpoints introduced in this plan. The audit emitter, schema migrations, and freeze gate all follow existing security patterns.

## Self-Check: PASSED

- `grid/src/audit/append-nous-spawned-by-human.ts` — FOUND
- `grid/src/audit/broadcast-allowlist.ts` (contains position 53 entry) — FOUND
- `grid/src/db/schema.ts` (contains v15, v16) — FOUND
- `grid/src/genesis/launcher.ts` (contains personalitySeed param) — FOUND
- `grid/src/api/portal/check-frozen.ts` (contains spawn pattern) — FOUND
- Commits `87a26e6`, `13ddcd1`, `d3e5aa8` — all present in git log
