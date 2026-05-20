---
phase: 22-web3-identity
plan: "02"
subsystem: grid/api/portal
tags: [web3, siwe, jwt, auth, audit, allowlist]
dependency_graph:
  requires: [22-01]
  provides: [registerPortalAuthRoutes, appendHumanJoined, human.joined-allowlist-entry]
  affects: [grid/src/api/server.ts, grid/src/audit/broadcast-allowlist.ts]
tech_stack:
  added: [jose, siwe, "@fastify/cookie"]
  patterns: [sole-producer-emitter, es256-jwt-cookie, siwe-nonce-verify, closed-payload-tuple]
key_files:
  created:
    - grid/src/audit/append-human-joined.ts
    - grid/src/api/portal/auth.ts
    - grid/src/api/portal/index.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/api/server.ts
decisions:
  - "In-memory nonceMap with 5-min TTL (WEB3-01) — Redis deferred per T-22-02-05 accept disposition"
  - "ES256 key pair generated at module load — single process, in-memory; rotation deferred to later phase"
  - "ETH address SHA-256 hashed before audit append (WEB3-04) — raw address never in audit chain"
  - "human.joined fires on isNew===true only, guarded by findByAddress before createHuman (WEB3-06)"
  - "humanRegistry optional in GridServices — 503 guard when absent; legacy tests unaffected"
  - "fastifyCookie registered before portal routes in buildServerWithHub"
metrics:
  duration_seconds: 480
  completed_date: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 22 Plan 02: SIWE Portal Auth Routes and JWT Issuance Summary

## One-Liner

Four SIWE auth endpoints under `/api/v1/portal/auth/` with ES256 JWT httpOnly cookies, `human.joined` audit event on first connect (SHA-256 hashed ETH address), allowlist grown from 43 to 44 entries.

## What Was Built

### Task 1 — allowlist entry 44 + appendHumanJoined emitter

`grid/src/audit/broadcast-allowlist.ts` gained one new entry: `'human.joined'` at position 44 with the payload comment `// (44) {human_did, eth_address_hash, grid_name, tick}`. No other lines were modified.

`grid/src/audit/append-human-joined.ts` created as the sole-producer boundary for `human.joined`, mirroring `append-nous-deleted.ts` discipline exactly:

- Validates `human_did` against `DID_RE` (`/^did:noesis:[a-z0-9_\-]+$/i`)
- Validates `eth_address_hash` against `HEX64_RE` (`/^[0-9a-f]{64}$/`) — SHA-256 of lowercased ETH address, never the raw address
- Validates `grid_name` is a non-empty string
- Validates `tick` is a non-negative integer
- Closed 4-key tuple check (alphabetical: `eth_address_hash`, `grid_name`, `human_did`, `tick`)
- Explicit reconstruction (no spread)
- `payloadPrivacyCheck` gate before `audit.append`

Privacy gate verification: `eth_address_hash` does NOT match `FORBIDDEN_KEY_PATTERN` — the pattern forbids `address` as a standalone term but the regex `content(?!_hash)` pattern shows the same lookahead discipline is applied; `address` itself is not in the pattern at all, confirming `eth_address_hash` is safe.

### Task 2 — SIWE auth routes, portal barrel, server wiring

**`grid/src/api/portal/auth.ts`** — `registerPortalAuthRoutes` implementing:

- `GET /api/v1/portal/auth/nonce` — generates `crypto.randomUUID()`, stores in `nonceMap` with timestamp, returns `{ nonce }`
- `POST /api/v1/portal/auth/verify` — validates body, creates `SiweMessage`, checks nonce existence + TTL (5 min), calls `siweMessage.verify({ signature, nonce })`, finds-or-creates human via `humanRegistry`, fires `appendHumanJoined` on first creation only, issues ES256 JWT in httpOnly `noesis_portal_token` cookie (24h), returns `{ did, eth_address, is_new }`
- `POST /api/v1/portal/auth/logout` — clears cookie, returns `{ ok: true }`
- `GET /api/v1/portal/auth/me` — reads JWT cookie, verifies with public key, returns `{ did, eth_address }` or 401

**`grid/src/api/portal/index.ts`** — `registerPortalRoutes` barrel following `operator/index.ts` pattern exactly.

**`grid/src/api/server.ts`** — Three changes:
1. Added imports: `registerPortalRoutes`, `HumanRegistry`, `fastifyCookie`
2. Added `humanRegistry?: HumanRegistry` to `GridServices` interface (optional — legacy tests unaffected)
3. Registered `fastifyCookie` plugin at start of `buildServerWithHub`
4. Called `registerPortalRoutes(app, services)` after `registerOperatorRoutes`

**Dependencies installed:** `jose@^6.2.3`, `siwe@^3.0.0`, `@fastify/cookie@^11.0.2` added to `grid/package.json`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | d705081 | feat(22-02): add human.joined to allowlist (entry 44) and create appendHumanJoined emitter |
| 2 | 9a44c3f | feat(22-02): implement SIWE portal auth routes and wire into server |

## Decisions Made

1. **In-memory nonceMap** — 5-min TTL, no Redis. T-22-02-05 accepted: low-volume Portal usage in v2.5; nonce expiry is enforced at verify time.
2. **ES256 key pair at module load** — `generateKeyPair('ES256')` called once; stored as a module-level promise. Key rotation deferred to a later phase.
3. **ETH address SHA-256 hashed** — `createHash('sha256').update(address.toLowerCase()).digest('hex')` before `appendHumanJoined`. Raw address never enters audit chain (WEB3-04 / T-22-02-03 mitigated).
4. **human.joined once only** — `findByAddress` check before `createHuman`; `appendHumanJoined` called only when `isNew === true` (WEB3-06 / T-22-02-06 mitigated).
5. **humanRegistry optional** — Returns 503 `human_registry_unavailable` when absent. Keeps all existing tests compiling without changes.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-22-02-01 Spoofing (verify endpoint) | `SiweMessage.verify` cryptographically validates secp256k1 signature | Implemented |
| T-22-02-02 Tampering (nonce replay) | Nonce deleted from map immediately after first use; 5-min TTL enforced | Implemented |
| T-22-02-03 Info Disclosure (audit payload) | ETH address SHA-256 hashed; key is `eth_address_hash` not `eth_address` | Implemented |
| T-22-02-04 EoP (JWT cookie) | httpOnly + sameSite:strict + ES256 asymmetric key | Implemented |
| T-22-02-05 DoS (nonceMap growth) | Accepted — low volume v2.5; Redis deferred | Accepted |
| T-22-02-06 Repudiation (double-fire) | findByAddress before createHuman; appendHumanJoined on isNew only | Implemented |

## Known Stubs

None — all four routes are fully wired with real logic.

## Self-Check: PASSED

- `grid/src/audit/append-human-joined.ts` exists: FOUND
- `grid/src/api/portal/auth.ts` exists: FOUND
- `grid/src/api/portal/index.ts` exists: FOUND
- `broadcast-allowlist.ts` contains `human.joined`: FOUND (line 178)
- `server.ts` contains `humanRegistry`: FOUND (line 81)
- `server.ts` contains `registerPortalRoutes`: FOUND (lines 28, 377)
- Commit d705081: FOUND
- Commit 9a44c3f: FOUND
- `npx tsc --noEmit` exits 0: VERIFIED
