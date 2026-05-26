---
phase: 38
plan: "38-01"
subsystem: brain-wire, grid-token-store
tags: [wire-protocol, brain, grid, jwt, token-rotation, WIRE-02]
dependency_graph:
  requires: []
  provides:
    - brain/src/noesis_brain/wire/__init__.py
    - brain/src/noesis_brain/wire/token_manager.py
    - grid/src/db/schema.ts (migration v25 brain_tokens)
    - grid/src/db/stores/brain-token-store.ts
    - grid/src/api/routes/brain-token.ts
    - ROUTE_DID_POLICY entries for /api/v1/brain/token/{register,revoke}
  affects:
    - brain/pyproject.toml
    - grid/src/db/schema.ts
    - grid/src/api/policy.ts
    - grid/src/api/server.ts
tech_stack:
  added:
    - PyJWT[crypto]>=2.8 (Brain — EdDSA JWT encoding)
    - websockets>=12.0 (Brain — declared here, consumed in 38-04)
  patterns:
    - PyNaCl SigningKey → Ed25519PrivateKey (cryptography) → PEM → PyJWT EdDSA encoding
    - Node.js crypto.verify(null, msg, keyObject, sig) for Ed25519 JWK verification
    - INSERT IGNORE (insert) + ON DUPLICATE KEY UPDATE (upsert) for BrainTokenStore
    - existence-key signature gate on public route (mirrors Phase 37 REG-01)
key_files:
  created:
    - brain/src/noesis_brain/wire/__init__.py
    - brain/src/noesis_brain/wire/token_manager.py
    - brain/test/wire/__init__.py
    - brain/test/wire/test_token_manager.py
    - grid/src/db/stores/brain-token-store.ts
    - grid/src/api/routes/brain-token.ts
    - grid/test/api/brain-token.test.ts
  modified:
    - brain/pyproject.toml (added PyJWT[crypto]>=2.8 + websockets>=12.0)
    - grid/src/db/schema.ts (appended migration v25)
    - grid/src/api/policy.ts (appended 2 ROUTE_DID_POLICY entries)
    - grid/src/api/server.ts (import + brainTokenStore field + route registration)
decisions:
  - "D-38-A4 (confirmed): existence-DID Ed25519 key is the operator signing key for Bearer JWTs in Phase 38. JWT iss = existence-DID, sub = civic-DID, alg = EdDSA."
  - "upsert clears revoked flag on key rotation — intentional and documented in BrainTokenStore"
  - "Ed25519 JWK verification uses Node.js built-in crypto (not jose/tweetnacl) to keep stdlib-only on Grid side"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-26"
  tasks_completed: 3
  files_created: 7
  files_modified: 4
---

# Phase 38 Plan 01: Brain token manager + Grid brain_tokens store Summary

**One-liner:** EdDSA JWT signing via PyNaCl→PyJWT[crypto] on Brain + MySQL brain_tokens store with upsert/revoke on Grid + existence-key signature-gated register route.

## What Was Built

### Task 1: Brain TokenManager (commit 45718be)

- Created `brain/src/noesis_brain/wire/` package
- `TokenManager` class: creates 24h EdDSA JWTs signed with the operator's PyNaCl `SigningKey`
- `get_valid_token()` proactively rotates at 23h mark (1h before expiry); both old and new tokens verify during the overlap since they use the same Ed25519 public key
- `public_jwk()` returns `{kty:"OKP", crv:"Ed25519", x:"<b64url>", alg:"EdDSA"}` for Grid registration
- Added `PyJWT[crypto]>=2.8` and `websockets>=12.0` to `brain/pyproject.toml`
- 5/5 pytest tests pass

### Task 2: Grid migration v25 + BrainTokenStore (commit 266ea41)

- Appended migration v25 `create_brain_tokens` to `grid/src/db/schema.ts` (v24 was last)
- `BrainTokenStore` class with `insert` (INSERT IGNORE), `upsert` (rotation path — clears revocation), `getByDid`, `revoke`, `isRevoked`
- Key invariant: `upsert()` is the rotation path; it clears `revoked=0` and `revoked_at_tick=NULL` so a Brain that was revoked but presents a new key is re-admitted

### Task 3: Routes + policy + server wiring + tests (commit f854349)

- `registerBrainTokenRoutes(app, services)` with two POST endpoints
- `POST /api/v1/brain/token/register` (PUBLIC): validates shape, checks civic_did is active, verifies Ed25519 signature via Node.js `crypto.verify(null, msg, keyObject, sig)`, calls `upsert`
- `POST /api/v1/brain/token/revoke` (government_only): uses existing `verifyGovernmentSession` hook, calls `revoke`, returns 404 on unknown DID
- Canonical message for signature: `JSON.stringify({brain_did, civic_did, public_key_jwk, issued_at, expires_at})` (fixed key order)
- `ROUTE_DID_POLICY` extended: `register → public`, `revoke → government_only`
- `GridServices.brainTokenStore` field added (optional, 503 when absent)
- `check-did-policy-coverage.mjs` exits 0 (43 inline routes, 113 policy entries, 0 violations)
- `tsc --noEmit` exits 0
- 8/8 vitest tests pass

## Tests Added

| File | Count | What's Tested |
|------|-------|----------------|
| `brain/test/wire/test_token_manager.py` | 5 | JWT creation, 24h TTL, 23h rotation, proactive rotation, JWK shape |
| `grid/test/api/brain-token.test.ts` | 8 | register happy path, invalid signature, civic_did not active, malformed body, revoke no auth, revoke with gov session, register-revoke-re-register cycle, ROUTE_DID_POLICY entries |

## Deviations from Plan

None — plan executed exactly as written.

Implementation notes (not deviations):
- Used `crypto.verify(null, msg, keyObject, sig)` with `createPublicKey({ key: jwkObj, format: 'jwk' })` for Ed25519 verification (Node 15+ built-in, TypeScript required `as unknown as JsonWebKeyInput` cast for the overload)
- Plan said `POST /api/v1/brain/token/revoke` returns `{ok:true, brain_did, revoked:true}` — implemented exactly; 404 on unknown DID as specified

## Carry-Forward to Plan 38-02

Plan 38-02 extends `tryDid` (`grid/src/api/preHandlers/tryDid.ts`) to verify Brain JWTs:
- When JWT `iss` matches `did:noesis:nous:*`, resolve public key via `brainTokenStore.getByDid(iss).publicKeyJwk`
- Use `jose.importJWK(jwk)` then `jwtVerify(token, key)` — exact same pattern as existing ES256 verification
- Short-circuit on `isRevoked(iss)` → downgrade to visitor tier (same D-36-09 pattern as Civic-DID revocation)
- Map `sub` (civic-DID) → `civic_member` tier in `req.didContext`
- No further schema work required

## Known Stubs

None — all data paths are wired. The `brainTokenStore` field on `GridServices` is optional (503 when absent), which is the standard pattern for all stores in this codebase.

## Threat Flags

None — no new network endpoints beyond those in the plan's design. Both new routes follow the established signature-gate (register) and government_only (revoke) patterns from Phase 37.

## Self-Check: PASSED

Files exist:
- `brain/src/noesis_brain/wire/__init__.py` — FOUND
- `brain/src/noesis_brain/wire/token_manager.py` — FOUND
- `grid/src/db/stores/brain-token-store.ts` — FOUND
- `grid/src/api/routes/brain-token.ts` — FOUND
- `grid/test/api/brain-token.test.ts` — FOUND

Commits exist:
- `45718be` feat(brain/38-01) — FOUND
- `266ea41` feat(grid/38-01) — FOUND
- `f854349` feat(grid/38-01) — FOUND

All 3 success criteria checks passed:
1. `pytest test/wire/test_token_manager.py` → 5/5
2. `vitest run test/api/brain-token.test.ts` → 8/8
3. `check-did-policy-coverage.mjs` → OK (0 violations)
4. `tsc --noEmit` → clean
5. Migration v25 appears exactly once in schema.ts
6. `PyJWT[crypto]` and `websockets` in pyproject.toml
