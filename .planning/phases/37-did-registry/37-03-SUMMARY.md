---
phase: 37-did-registry
plan: "03"
subsystem: api
tags: [fastify, jose, vitest, did, civic-did, business-did, registry, jwt, government, audit]

requires:
  - phase: 37-01
    provides: CivicDidStore, BusinessDidStore, verifyGovernmentSession, GOV_SESSION_ISSUER_DID, buildCivicDidVc, buildBusinessDidVc
  - phase: 37-02
    provides: appendRegistryCivicDidIssued, appendRegistryCivicDidRevoked, appendRegistryBusinessDidRegistered, appendRegistryBusinessDidDissolved

provides:
  - "5 vitest test files covering 51 test cases for all 6 DID Registry endpoints"
  - "Security regression suite asserting government_only enforcement (court_order_required 403)"
  - "Privacy regression suite asserting court_conviction_ref stays out of audit payloads"
  - "Closed-tuple audit payload assertions for business dissolution (4-key set)"
  - "Audit tier assertion: government sessions get tier='government', not 'civic_member'"

affects: [37-04, ci-gates, audit-discipline]

tech-stack:
  added: []
  patterns:
    - "In-memory Map-backed mock stores passed as GridServices injections for Fastify app.inject() tests"
    - "keyPairPromise (ES256) re-used for minting government JWTs + civic bearer JWTs in tests"
    - "Vitest describe/beforeAll/afterAll lifecycle — each describe block manages its own app.close()"
    - "Separate 503-guard describe blocks to avoid in-test app instantiation (avoids WS cleanup error)"

key-files:
  created:
    - grid/test/api/registry-routes.test.ts
    - grid/test/api/registry-lookup.test.ts
    - grid/test/api/registry-business.test.ts
    - grid/test/api/registry-revocation.test.ts
    - grid/test/api/registry-dissolution.test.ts
  modified: []

key-decisions:
  - "Operator-DID JWT (did:noesis:human:*) does NOT match ANY_DID_RE — tryDid returns null → requireDid returns 401 (not 403 from handler). Test updated to reflect actual enforcement path."
  - "Government DID (did:gov:noesis:genesis-polis) DOES match ANY_DID_RE — tryDid returns civic_member, but route handler rejects it via CIVIC_DID_RE check → 403 civic_did_required_caller. Added explicit test for this path."
  - "Pre-existing WS cleanup error (Error: The server is not running in afterAll) affects all tests in codebase — not a test regression, all 51 test cases pass."
  - "503 tests require separate describe blocks with beforeAll/afterAll lifecycle — inline app.close() inside a test triggers the WS error mid-suite."

patterns-established:
  - "Security test pattern: separate describe block per endpoint family, each with its own app instance + audit chain"
  - "Government JWT minting: SignJWT({ court_conviction_ref }).setIssuer(GOV_SESSION_ISSUER_DID).sign(privateKey from keyPairPromise)"
  - "Civic bearer JWT minting: SignJWT({ sub: civicDid }) — no iss claim, no court_conviction_ref"
  - "Closed-tuple assertion: Object.keys(auditEntry.payload).sort() === exact expected array"

requirements-completed:
  - REG-01
  - REG-02
  - REG-03
  - REG-04
  - REG-05
  - REG-06

duration: 35min
completed: 2026-05-26
---

# Phase 37 Plan 03: DID Registry Route Tests Summary

**51 vitest tests covering 6 DID Registry endpoints with security/privacy regression assertions for government_only enforcement, closed-tuple audit discipline, and civic-DID lifecycle correctness**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-26T13:00:00Z
- **Completed:** 2026-05-26T13:35:00Z
- **Tasks:** 1 (Task 2b — 5 test files)
- **Files modified:** 5 created

## Accomplishments

- 51 test cases across 5 files, all passing
- Security-critical government_only enforcement: operators and civic members cannot revoke/dissolve (REG-04)
- Privacy-critical audit assertions: court_conviction_ref plaintext stays out of audit chain; only SHA-256 hash in revocation events; dissolution events omit ref entirely
- Closed-tuple payload assertions for `registry.business_did_dissolved` (exactly `['business_did','civic_did','dissolved_at_tick','grid_name']`)
- Audit civic_did ownership assertion: dissolution audit payload carries OWNER DID, not government caller DID

## Task Commits

1. **Task 2b: 5 API test files** - `fed4c5f` (test)

## Files Created/Modified

- `grid/test/api/registry-routes.test.ts` — POST /civic-did/request: 400 validation, 401 signature, 201 happy path, 409 duplicate, 503 store absent, audit event
- `grid/test/api/registry-lookup.test.ts` — GET civic/business lookup: 200 + Cache-Control, 404, 503, public (no-auth) access
- `grid/test/api/registry-business.test.ts` — POST /business-did/register: 401 no-auth, 403 wrong caller, 400 validation, 404 not-found, 402 insufficient, 201 happy path, 503, audit 4-key
- `grid/test/api/registry-revocation.test.ts` — POST /civic-did/:did/revoke (SECURITY CRITICAL): 403 court_order, 403 civic-bearer rejected, 403 operator rejected, 400 body-missing-ref, 200 happy path, audit hash not plaintext
- `grid/test/api/registry-dissolution.test.ts` — POST /business-did/:did/dissolve (SECURITY CRITICAL): same 403 suite, 400 invalid DID, 404/409 state guards, 200 happy path, store status verified, closed-tuple audit

## Decisions Made

- Operator-DID JWT (`did:noesis:human:*`) does not match `ANY_DID_RE` — it resolves to 401 at the `requireDid` boundary, not 403 at the handler. Test updated to reflect the actual enforcement path rather than the expected-but-wrong 403.
- Government DID (`did:gov:noesis:genesis-polis`) matches `ANY_DID_RE` and is treated as `civic_member` by `tryDid`, but the business-register handler rejects it via `CIVIC_DID_RE.test(ctx.did)` → 403 `civic_did_required_caller`. Added test for this path.
- 503 tests use separate `describe` blocks with proper `beforeAll`/`afterAll` lifecycle to avoid triggering the pre-existing WS cleanup error when `app.close()` is called inside a test body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected operator-DID enforcement path in business registration test**
- **Found during:** Task 2b (registry-business.test.ts)
- **Issue:** Test expected 403 for `did:noesis:human:*` caller, but `ANY_DID_RE` requires `did:X:noesis:Y` format (two namespace components). `did:noesis:human:0xabc` doesn't match, so `tryDid` returns null, and `requireDid` returns 401.
- **Fix:** Updated test to expect 401 for operator-DID callers; added separate test using `did:gov:noesis:genesis-polis` (which matches ANY_DID_RE) to verify the 403 handler path.
- **Files modified:** grid/test/api/registry-business.test.ts
- **Verification:** All 51 tests pass
- **Committed in:** fed4c5f

**2. [Rule 3 - Blocking] Fixed key pair mismatch in 409 duplicate test**
- **Found during:** Task 2b (registry-routes.test.ts)
- **Issue:** Original code used `pk2` from one `generateKeyPair` call and `pub2.publicKey` from a different `generateKeyPair` call — mismatched key pair caused the JWS signature to fail with 401 instead of 201.
- **Fix:** Changed to a single `generateKeyPair` call, using both `.privateKey` and `.publicKey` from the same result.
- **Files modified:** grid/test/api/registry-routes.test.ts
- **Verification:** 201 returned on first request, 409 on second.
- **Committed in:** fed4c5f

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered

- Pre-existing WS cleanup error (`Error: The server is not running`) in `afterAll` affects all tests in this codebase. All 51 test cases pass — the error is in the Fastify/ws teardown sequence, not test logic. Confirmed pre-existing on `economy-shops.test.ts` and `did-required-enforcement.test.ts` before any registry test changes.

## Self-Check

### Files exist
- `/Users/desirey/Programming/src/Noesis/grid/test/api/registry-routes.test.ts` — FOUND
- `/Users/desirey/Programming/src/Noesis/grid/test/api/registry-lookup.test.ts` — FOUND
- `/Users/desirey/Programming/src/Noesis/grid/test/api/registry-business.test.ts` — FOUND
- `/Users/desirey/Programming/src/Noesis/grid/test/api/registry-revocation.test.ts` — FOUND
- `/Users/desirey/Programming/src/Noesis/grid/test/api/registry-dissolution.test.ts` — FOUND

### Commits exist
- `fed4c5f` — test(37-03): add registry route vitest tests — FOUND

### Test results
- 51/51 test cases pass
- TypeScript: `npx tsc --noEmit` exits 0

## Self-Check: PASSED

## Next Phase Readiness

- Plan 04 (CI gate locking importer set of `append-registry-*` producers) can proceed — registry.ts is the sole production caller for all 4 audit producers
- All 6 endpoints exercised by tests; security/privacy invariants documented as regression tests
- Forward: Phase 38 will add biz-DID bearer JWT flows; `ANY_DID_RE` already accepts `did:biz:noesis:*` subjects

---
*Phase: 37-did-registry*
*Completed: 2026-05-26*
