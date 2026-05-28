---
phase: 42
plan: 02
subsystem: p2p-infrastructure
tags: [p2p, civic-did, migration, public-key, webrtc, turn, sdp]
dependency_graph:
  requires: [42-01]
  provides: [migration-v32, p2p-peer-store, sdp-inbox-store, turn-credentials, public-key-gap-closed]
  affects: [civic-did-registry, vc-builder, civic-did-store, registry-route]
tech_stack:
  added: [grid/src/p2p/types.ts, grid/src/p2p/p2p-peer-store.ts, grid/src/p2p/sdp-inbox-store.ts, grid/src/p2p/turn-credentials.ts]
  patterns: [tdd-red-green, hmac-sha1-coturn, in-memory-ttl-map, conditional-spread-vc]
key_files:
  created:
    - grid/src/p2p/types.ts
    - grid/src/p2p/p2p-peer-store.ts
    - grid/src/p2p/sdp-inbox-store.ts
    - grid/src/p2p/turn-credentials.ts
  modified:
    - grid/src/db/schema.ts (migration v32 added)
    - grid/src/civic-registry/vc-builder.ts (existencePublicKeyJwk param)
    - grid/src/civic-registry/civic-did-store.ts (insert + getPublicKey + rowToRecord)
    - grid/src/civic-registry/types.ts (CivicDidRecord extended)
    - grid/src/api/routes/registry.ts (OKP JWK validation + persistence)
    - grid/test/registry/vc-builder-public-key.test.ts (4 stubs unskipped)
    - grid/test/p2p/p2p-peer-store.test.ts (6 stubs unskipped)
    - grid/test/p2p/sdp-inbox-store.test.ts (5 stubs unskipped)
    - grid/test/p2p/turn-credentials.test.ts (7 stubs unskipped)
decisions:
  - OKP/Ed25519 JWK validation is backward-compatible — non-OKP keys store null (P2P unavailable) rather than returning 400
  - getPublicKey(gridName, civicDid) added to CivicDidStore to support Plan 04 route
  - SdpInboxStore.computeExpiresAt() static helper exposes 60s TTL to Plan 04 routes
metrics:
  duration: 12 minutes
  completed: "2026-05-27"
  tasks_completed: 3
  files_changed: 13
---

# Phase 42 Plan 02: Migration v32 + P2P Data Primitives Summary

One-liner: Migration v32 adds `existence_public_key_jwk` JSON column to close the public-key gap blocking D-42-05 SDP encryption; 4 new P2P data files ship the in-memory primitives (peer store, SDP inbox, TURN credentials) that Plan 04 will wire into HTTP routes.

## Tasks Completed

### Task 1: Migration v32 + public-key persistence (TDD GREEN)

**Commits:** `24baea5`

**Files modified:**
- `grid/src/db/schema.ts` — migration v32 appended after v31
- `grid/src/civic-registry/vc-builder.ts` — `existencePublicKeyJwk?: object | null` param + conditional spread in credentialSubject
- `grid/src/civic-registry/civic-did-store.ts` — `insert()` extended; `getPublicKey()` added; `rowToRecord` parses column
- `grid/src/civic-registry/types.ts` — `CivicDidRecord` extended with `existencePublicKeyJwk?: object | null`
- `grid/src/api/routes/registry.ts` — OKP/Ed25519 validation + pass-through to `buildCivicDidVc` and `store.insert`
- `grid/test/registry/vc-builder-public-key.test.ts` — 4 stubs unskipped and passing

**Migration v32 SQL:**
```sql
ALTER TABLE civic_did_registry
  ADD COLUMN existence_public_key_jwk JSON NULL
```

**DESCRIBE output (post-migration):**
```
existence_public_key_jwk   json   YES   NULL
```
Column confirmed present in live MySQL (`noesis_grid.civic_did_registry`).

**Test counts:** 4 stubs → 4 passing

**Backward compatibility:** Phase 37 rows retain NULL in `existence_public_key_jwk`. Callers sending non-OKP signing keys (ES256) continue to work — the JWK is accepted for signature verification but not stored as P2P key (NULL stored). This matches Phase 37 behavior exactly.

### Task 2: P2P data primitives (TDD GREEN)

**Commits:** `07f60d7`

**Files created:**
- `grid/src/p2p/types.ts` — `P2P_PEER_TTL_MS=5*60*1000`, `SDP_INBOX_ENTRY_TTL_MS=60*1000`, `TURN_TTL_SECONDS=3600`, `TURN_REALM='noesis.grid'`, `PeerEntry`, `PeerStatus`, `InboxEntry`, `TurnCredentials`, `P2PService` interfaces
- `grid/src/p2p/p2p-peer-store.ts` — `P2PPeerStore`: `announce()`/`getStatus()`/`cleanup()`/`size()`
- `grid/src/p2p/sdp-inbox-store.ts` — `SdpInboxStore`: `push()`/`drain()`/`static computeExpiresAt()`
- `grid/src/p2p/turn-credentials.ts` — `generateTurnCredentials()` using `createHmac('sha1', ...)`

**Test counts:**
- `p2p-peer-store.test.ts`: 6 stubs → 6 passing
- `sdp-inbox-store.test.ts`: 5 stubs → 5 passing
- `turn-credentials.test.ts`: 7 stubs → 7 passing

**Total P2P tests:** 18 passing

### Task 3 [BLOCKING]: Migration v32 applied to live MySQL

Migration applied automatically on Grid container restart (hand-written migrations runner). Confirmed via:

```sql
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name='civic_did_registry' AND column_name='existence_public_key_jwk';
-- Returns: 1
```

Existing row count: 0 (no data loss; pre-Phase-42 DID registrations will be re-registered by operators).

## JWK Flow Confirmation

```
POST /registry/civic-did/request
  body.existence_public_key_jwk (OKP/Ed25519)
    → validate kty='OKP', crv='Ed25519', x: string
    → buildCivicDidVc({ existencePublicKeyJwk })
      → credentialSubject.existencePublicKeyJwk = { kty, crv, x }  (conditional spread)
    → store.insert({ existencePublicKeyJwk })
      → INSERT ... existence_public_key_jwk = JSON.stringify(jwk)

GET /registry/civic-did/:did
  → rowToRecord() parses existence_public_key_jwk JSON column
  → credentialJson.credentialSubject.existencePublicKeyJwk = parsed JWK

Plan 05 BrainP2PClient:
  → GET /registry/civic-did/<B-did>
  → response.credential.credentialSubject.existencePublicKeyJwk  ← non-null for v42+ registrations
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backward-compatible JWK validation in registry route**
- **Found during:** Task 1 (regression check)
- **Issue:** Initial validation returned 400 for non-OKP keys, breaking existing registry-routes.test.ts (Phase 37 tests send ES256 signing key as `existence_public_key_jwk`)
- **Fix:** Changed validation to accept all key types for signature verification; only store OKP/Ed25519 keys as P2P JWK (store null for non-OKP keys). No 400 returned for ES256 keys.
- **Files modified:** `grid/src/api/routes/registry.ts`
- **Commit:** `07f60d7`

## Pre-existing Test Failures (Out of Scope)

67 test files with 136 failing tests existed BEFORE this plan's changes (confirmed via git stash verification). These failures involve WebSocket teardown ("The server is not running") and unrelated API tests. None are caused by Plan 02 changes. Logged as pre-existing.

## Known Stubs

None — all 4 new P2P source files are fully implemented. Plan 04 will wire the data primitives into HTTP routes.

## Threat Flags

None — all surfaces introduced in this plan were accounted for in the plan's `<threat_model>` (T-42-02-01 through T-42-02-06).

## Self-Check: PASSED

Files confirmed present:
- grid/src/p2p/types.ts: EXISTS
- grid/src/p2p/p2p-peer-store.ts: EXISTS
- grid/src/p2p/sdp-inbox-store.ts: EXISTS
- grid/src/p2p/turn-credentials.ts: EXISTS
- grid/src/db/schema.ts (v32): 1 match for "version: 32"
- civic_did_registry.existence_public_key_jwk column: PRESENT in live MySQL

Commits confirmed:
- 24baea5: feat(42-02): migration v32 + public-key persistence in civic-did-store
- 07f60d7: feat(42-02): P2P data primitives — types, peer store, SDP inbox, TURN credentials
