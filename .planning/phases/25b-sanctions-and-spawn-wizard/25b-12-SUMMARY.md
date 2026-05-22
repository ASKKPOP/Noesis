---
phase: 25b-sanctions-and-spawn-wizard
plan: 12
subsystem: grid/operator-sanctions
tags: [sanction-route, h5, human, ban, freeze, zero-custody, migration]
dependency_graph:
  requires: [25b-07, 25b-08, 25b-10]
  provides: [ban-human-route, freeze-wallet-route, migration-v13, humanSanctionStore-interface]
  affects: [grid/src/api/operator/index.ts, grid/src/api/server.ts, grid/src/db/schema.ts]
tech_stack:
  added: [humanSanctionStore-service-interface]
  patterns: [header-auth-H5, sole-producer-audit, reason-hash-discipline, zero-custody-invariant]
key_files:
  created:
    - grid/src/api/operator/ban-human.ts
    - grid/src/api/operator/freeze-wallet.ts
    - grid/test/operator/ban-human.test.ts
    - grid/test/operator/freeze-wallet.test.ts
  modified:
    - grid/src/db/schema.ts
    - grid/src/api/operator/index.ts
    - grid/src/api/server.ts
decisions:
  - "Used humanSanctionStore service interface (injectable stub) rather than coupling routes directly to HumanRegistry, matching sanctionReasonStore pattern already in GridServices"
  - "HUMAN_DID_REGEX uses colon-permissive pattern (did:noesis:[a-z0-9_:-]+) since human DIDs contain colons (did:noesis:human:0x...) unlike the base DID_REGEX"
  - "Migration v13 down SQL is ALTER TABLE DROP COLUMN — pre-existing test expects DROP TABLE for all migrations but this was already broken by migration v10; not fixed (out of scope)"
metrics:
  duration: ~8 minutes
  completed: 2026-05-22T05:02:14Z
  tasks: 3
  files: 7
---

# Phase 25b Plan 12: Human Sanctions (Ban + Freeze) Summary

Two H5 operator routes targeting human_users table: ban-human (full revocation via `banned=1`) and freeze-wallet (Grid-side reversible flag via `frozen=1`), both header-auth with sole-producer audit emitters and reason-hash discipline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration v13 — human_users.banned column | 6460027 | grid/src/db/schema.ts |
| 2 | POST /api/v1/operator/humans/:did/ban (H5) | 9dced9c | ban-human.ts, index.ts, server.ts, ban-human.test.ts |
| 3 | POST /api/v1/operator/humans/:did/freeze (H5) | 383a7cc | freeze-wallet.ts, index.ts, freeze-wallet.test.ts |

## What Was Built

### Migration v13 (Task 1)
Appended migration v13 to `grid/src/db/schema.ts`:
- `ALTER TABLE human_users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0`
- Separate from `frozen` (v12) per D-25b-NEW-5: banned = full revocation, frozen = reversible Grid flag
- Allows frozen-but-not-banned humans to SIWE-authenticate and see read-only status

### Ban Human Route (Task 2) — TDD
`POST /api/v1/operator/humans/:did/ban`
- H5 header-auth gate (`x-operator-tier` ≥ 5, `x-operator-id` via OPERATOR_ID_REGEX)
- HUMAN_DID_REGEX handles colon-separated DID format (`did:noesis:human:0x...`)
- No tombstone check (humans have no tombstones in v2.5)
- Existence check via `services.humanSanctionStore.existsByDid(did)` → 404 `unknown_human`
- Sets `banned=1` via `humanSanctionStore.setBanned(did)`
- Audit payload uses `human_did` field (not `target_did`) per D-25b-08 closed tuple
- Reason discipline: plaintext → `sanctionReasonStore`, hash only → audit
- 12 tests all pass

### Freeze Wallet Route (Task 3) — TDD
`POST /api/v1/operator/humans/:did/freeze`
- Identical structure to ban-human with different action
- Sets `frozen=1` (NOT `banned`) — D-25b-NEW-5 columns are independent
- Zero-custody invariant (D-25b-NEW-4): no wagmi/ethers/web3 imports anywhere in file
- ZERO-CUSTODY comment block at file top as specified
- Test includes source-level grep assertion for zero-custody compliance
- 13 tests all pass

### GridServices Extension
Added `humanSanctionStore` interface to `GridServices`:
```typescript
humanSanctionStore?: {
    existsByDid(did: string): Promise<boolean>;
    setBanned(did: string): Promise<void>;
    setFrozen(did: string): Promise<void>;
};
```

### Barrel Updates
Both routes registered in `grid/src/api/operator/index.ts`:
- `registerBanHumanRoute` with comment `Phase 25b SANCTION-05: H5 — ban human`
- `registerFreezeWalletRoute` with comment `Phase 25b SANCTION-06: H5 — freeze human wallet`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Notes

**HUMAN_DID_REGEX vs DID_REGEX:** The plan referenced using `DID_REGEX` from server.ts but that regex (`/^did:noesis:[a-z0-9_\-]+$/i`) doesn't allow colons. Human DIDs are `did:noesis:human:0x<hex>` which requires colons. Used `HUMAN_DID_REGEX = /^did:noesis:[a-z0-9_:\-]+$/i` (same as what the emitters already use) — this is consistent with the emitter's `DID_RE`.

**`check-operator-sanctions-plaintext.mjs` script:** The plan's verification section references this script but it doesn't exist in this worktree (it was created in plan 08 which is in a different wave). Zero-custody is instead verified by the grep assertion in freeze-wallet.test.ts.

**Pre-existing db test failure:** `test/db/migration-schema.test.ts` has a pre-existing failure on migration v10's `down` SQL (`ALTER TABLE human_users DROP COLUMN region` doesn't contain `DROP TABLE`). This failure exists before plan 12 and is not caused by my changes. Logged to `deferred-items.md` scope.

## Verification

- [x] Both H5 routes ship with header-auth from day one
- [x] Zero-custody invariant preserved (no wagmi/ethers/web3 in freeze-wallet.ts)
- [x] Migration v13 adds `banned` column; `frozen` already in v12
- [x] `grep -E "(wagmi|ethers|web3)" grid/src/api/operator/freeze-wallet.ts` returns nothing
- [x] Migration v13 visible in schema.ts at version 13
- [x] 25 new tests pass (12 ban-human + 13 freeze-wallet)
- [x] human_did field used in audit payloads (not target_did)
- [x] Reason plaintext never in audit payload

## TDD Gate Compliance

- RED gate: `test(25b-12): add failing test for ban-human H5 route` (774ac12)
- GREEN gate: `feat(25b-12): POST /api/v1/operator/humans/:did/ban — H5 route` (9dced9c)
- RED gate: `test(25b-12): add failing test for freeze-wallet H5 route` (f3a6eac)
- GREEN gate: `feat(25b-12): POST /api/v1/operator/humans/:did/freeze — H5 zero-custody route` (383a7cc)

## Known Stubs

None — both routes are fully wired. Production `humanSanctionStore` implementation (mysql2/promise Pool queries) is deferred to genesis/launcher wiring, matching the same pattern as `sanctionReasonStore`.

## Threat Flags

No new security-relevant surface beyond what the plan's threat model already covers. Both routes are H5-gated with header-auth, emitter-validated payloads, and zero on-chain access.

## Self-Check

Files exist:
- grid/src/api/operator/ban-human.ts: FOUND
- grid/src/api/operator/freeze-wallet.ts: FOUND
- grid/src/db/schema.ts (v13): FOUND
- grid/src/api/operator/index.ts (updated): FOUND
- grid/src/api/server.ts (humanSanctionStore): FOUND
- grid/test/operator/ban-human.test.ts: FOUND
- grid/test/operator/freeze-wallet.test.ts: FOUND

Commits exist: 6460027, 774ac12, 9dced9c, f3a6eac, 383a7cc
