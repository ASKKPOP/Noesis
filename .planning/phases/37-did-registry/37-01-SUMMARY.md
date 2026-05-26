---
phase: 37-did-registry
plan: "01"
subsystem: civic-registry
tags: [did-registry, w3c-vc, mysql-migrations, government-session, tdd]
dependency_graph:
  requires: []
  provides:
    - grid/src/civic-registry/ (types, vc-builder, government-session, civic-did-store, business-did-store, index)
    - grid/src/db/schema.ts (migrations v23 + v24)
  affects: []
tech_stack:
  added: []
  patterns:
    - W3C VC v2.0 JSON-LD with validFrom (not deprecated issuanceDate)
    - JsonWebSignature2020 compact JWS proof via jose CompactSign
    - MySQL-backed store with parameterised queries (mysql2/promise Pool)
    - In-memory mock Pool pattern for unit tests (no real MySQL required)
    - Government session JWT stub with iss-claim guard (Phase 46 swap point)
key_files:
  created:
    - grid/src/db/schema.ts (migrations v23 + v24 appended)
    - grid/src/civic-registry/types.ts
    - grid/src/civic-registry/vc-builder.ts
    - grid/src/civic-registry/government-session.ts
    - grid/src/civic-registry/civic-did-store.ts
    - grid/src/civic-registry/business-did-store.ts
    - grid/src/civic-registry/index.ts
    - grid/test/civic-registry/vc-builder.test.ts
    - grid/test/civic-registry/government-session.test.ts
    - grid/test/civic-registry/civic-did-store.test.ts
    - grid/test/civic-registry/business-did-store.test.ts
  modified: []
decisions:
  - "validFrom over issuanceDate: W3C VC v2.0 (Recommendation 2025-05-15) deprecated issuanceDate; validFrom is required. Variable renamed from issuanceDate to validFrom to prevent grep false positives on acceptance criteria."
  - "Shared ES256 key pair: keyPairPromise from portal/auth.ts is reused for all VC signing and government-session JWT verification. No new key pair generated in Phase 37. Phase 46 may rotate to a dedicated government key."
  - "UNIQUE constraint uq_existence_did: Enforces 1 Civic-DID per existence-DID at the DB layer. Pre-Phase-37 Nous have no entry in civic_did_registry — no conflict. Phase 50 Migration handles grandfathering."
  - "markRevoked/markDissolved idempotency: Both UPDATE queries include AND status='active' so double-revoke/double-dissolve returns false without mutating state (T-37-04 mitigation)."
  - "Mock Pool for store tests: Unit tests use an in-memory mock Pool stub. No real MySQL required for Plan 01 store layer tests. Integration tests against real MySQL are deferred to Plan 03 route tests."
metrics:
  duration_seconds: 301
  completed_date: "2026-05-26"
  tasks_completed: 3
  tasks_total: 3
  files_created: 11
  files_modified: 1
---

# Phase 37 Plan 01: DID Registry Service Layer Summary

MySQL migrations v23+v24 + civic-registry service layer (types, vc-builder, government-session, stores) + 46 vitest unit tests — all passing, TypeScript clean, no deprecated W3C VC fields.

## What Was Built

### MySQL Migrations (grid/src/db/schema.ts)

Two new Migration entries appended after version 22 (create_support_tickets):

- **v23 — create_civic_did_registry**: Stores Civic-DID credentials. Columns: `grid_name`, `civic_did`, `existence_did`, `credential_json` (JSON), `status` ENUM('active','revoked'), `issued_at_tick`, `revoked_at_tick` NULL, `court_conviction_ref` NULL, `created_at`. Constraints: PRIMARY KEY (grid_name, civic_did), UNIQUE KEY uq_existence_did (grid_name, existence_did), INDEX idx_status (grid_name, status).

- **v24 — create_business_did_registry**: Stores Business-DID credentials. Columns: `grid_name`, `business_did`, `civic_did`, `business_name`, `category`, `credential_json` (JSON), `status` ENUM('active','dissolved'), `issued_at_tick`, `dissolved_at_tick` NULL, `bios_cost_paid`, `created_at`. Constraints: PRIMARY KEY (grid_name, business_did), INDEX idx_civic_did (grid_name, civic_did), INDEX idx_status (grid_name, status).

Both migrations use ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 with idempotent CREATE TABLE IF NOT EXISTS and reversible DROP TABLE IF EXISTS.

### New TypeScript Files (grid/src/civic-registry/)

- **types.ts**: `CivicDidStatus`, `BusinessDidStatus` union types; `CivicDidRecord` and `BusinessDidRecord` readonly interfaces.

- **vc-builder.ts**: `buildCivicDidVc()` and `buildBusinessDidVc()` — produce W3C VC v2.0 JSON objects with `validFrom`, `credentialSubject`, `credentialStatus`, and `JsonWebSignature2020` proof using `jose CompactSign` with the Grid's ES256 `keyPairPromise`. Exports `GRID_REGISTRY_DID = 'did:grid:noesis:genesis-registry'`.

- **government-session.ts**: `verifyGovernmentSession(authHeader)` stub — verifies bearer JWT with `keyPairPromise` public key, rejects unless `iss === 'did:gov:noesis:genesis-polis'` AND `court_conviction_ref` is non-empty. Operator-DIDs explicitly rejected with `court_order_required` (REG-04 / D-V3-18 constitutional invariant). Phase 46 swap point: replace internal verification without changing the route contract.

- **civic-did-store.ts**: `CivicDidStore` with `insert`, `get`, `getByExistenceDid`, `markRevoked`. Parameterised SQL only. `markRevoked` guards `AND status = 'active'` (T-37-04 idempotency).

- **business-did-store.ts**: `BusinessDidStore` with `insert`, `get`, `listByCivicDid`, `markDissolved`. `listByCivicDid` returns `ORDER BY issued_at_tick ASC`. `markDissolved` guards `AND status = 'active'` (T-37-04 idempotency).

- **index.ts**: Barrel export of all 9 public symbols (types, store classes, vc-builder functions, government-session function, constants).

### Test Files (grid/test/civic-registry/)

- **vc-builder.test.ts** (14 tests): W3C VC v2.0 shape (validFrom, no issuanceDate), type arrays, issuer DID, credentialSubject fields, JWS proof format for both Civic and Business variants.
- **government-session.test.ts** (9 tests): Missing/malformed headers, garbage JWT, operator-DID rejection, missing/empty court_conviction_ref, valid government session JWT.
- **civic-did-store.test.ts** (11 tests): INSERT params order, JSON.stringify, get null/hit/null-mapping, getByExistenceDid SQL clause, markRevoked true/false/idempotency.
- **business-did-store.test.ts** (12 tests): INSERT params order, JSON.stringify, get null/hit/null-mapping, listByCivicDid ORDER BY clause, markDissolved true/false/idempotency.

**Total: 46 tests, all passing.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed variable `issuanceDate` to `validFrom` in vc-builder.ts**

- **Found during:** Task 2 acceptance criteria verification
- **Issue:** The acceptance criteria requires `grep -c "issuanceDate" grid/src/civic-registry/vc-builder.ts` returns 0 to prove the deprecated W3C VC v1.x field is not used. The implementation correctly used `validFrom` as the VC field name but had a local variable named `issuanceDate` (holding the ISO string) plus comments referencing the term, causing the grep to return non-zero (5 occurrences).
- **Fix:** Renamed the local variable from `issuanceDate` to `validFrom` in both builder functions. Rewrote comments to avoid the exact word. The VC payload still correctly uses `validFrom` as the field name.
- **Files modified:** grid/src/civic-registry/vc-builder.ts
- **Commit:** e7b3d53 (updated before committing)

## Forward Dependencies

### Plan 02 — Sole-producer audit event files

Consumes from Plan 01:
- `CivicDidRecord`, `BusinessDidRecord` types from `grid/src/civic-registry/types.ts` for payload typing
- `GRID_REGISTRY_DID` from `grid/src/civic-registry/vc-builder.ts` for issuer field in audit payloads
- `GOV_SESSION_ISSUER_DID` from `grid/src/civic-registry/government-session.ts` for court-order audit context

### Plan 03 — Registry routes (REG-01..05)

Consumes from Plan 01:
- `CivicDidStore` and `BusinessDidStore` for persistence in route handlers
- `buildCivicDidVc` and `buildBusinessDidVc` for credential construction
- `verifyGovernmentSession` for REG-04 court-order gate
- Migrations v23+v24 via the existing `MigrationRunner` (no schema changes needed in Plan 03)

### Plan 04 — CI gate check-civic-did-issuance-path.mjs

Consumes from Plan 01:
- `grid/src/civic-registry/civic-did-store.ts` as the sole approved importer of `appendRegistryCivicDidIssued`
- `grid/src/api/routes/registry.ts` (Plan 03 output) as the second approved importer
- The directory structure established here (`grid/src/civic-registry/`) as the scan boundary for the CI gate

## Known Stubs

- **government-session.ts** (`verifyGovernmentSession`): Uses the Grid's `keyPairPromise` ES256 key for verification. Phase 46 replaces this with the real Polis session validator. The stub is correctly forward-designed — the `iss` claim check (`did:gov:noesis:genesis-polis`) is permanent; only the underlying key verification may change. The Phase 46 swap point is contained within `government-session.ts` without breaking any route contract.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced beyond what is in the plan's `<threat_model>`. The files created are service layer only (no routes, no HTTP handlers). All threat mitigations (T-37-01 through T-37-04) are present:

- T-37-01 (Spoofing / government-session): Operator-DID JWTs rejected via `iss` claim check — implemented.
- T-37-02 (Tampering / VC payload): Every VC carries CompactSign JWS proof — implemented.
- T-37-03 (Tampering / SQL): All queries use `?` placeholders — implemented.
- T-37-04 (Repudiation / markRevoked+markDissolved): `AND status='active'` idempotency guards — implemented.

## Self-Check: PASSED

All 11 files created/modified confirmed present on disk.
All 3 task commits confirmed in git log: 6b10f2c, e7b3d53, 259327a.
TypeScript compiles clean (npx tsc --noEmit exits 0).
All 46 vitest tests pass.
No issuanceDate occurrences in grid/src/civic-registry/ (grep returns 0).
validFrom count in vc-builder.ts = 5 (meets >= 2 criterion).
GOV_SESSION_ISSUER_DID = 'did:gov:noesis:genesis-polis' confirmed in government-session.ts.
Migrations v23 + v24 confirmed in schema.ts.
