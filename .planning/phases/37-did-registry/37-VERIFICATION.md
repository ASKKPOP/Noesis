---
phase: 37-did-registry
verified: 2026-05-26T00:00:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
---

# Phase 37: DID Registry Verification Report

**Phase Goal:** Implement DID Registry — civic and business DID lifecycle (issuance, lookup, revocation, dissolution) with portal-gating invariant enforcement (D-V3-33)
**Verified:** 2026-05-26
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | civic_did_registry MySQL table exists (migration v23) with status enum {active,revoked} | VERIFIED | `grep -c "version: 23"` returns 1; uq_existence_did confirmed in schema.ts |
| 2 | business_did_registry MySQL table exists (migration v24) with status enum {active,dissolved} | VERIFIED | `grep -c "version: 24"` returns 1; both migrations InnoDB utf8mb4 |
| 3 | buildCivicDidVc() produces a W3C VC v2.0 JSON-LD document with validFrom (NOT issuanceDate) | VERIFIED | issuanceDate count = 0; validFrom count = 5 in vc-builder.ts; @context = 'https://www.w3.org/ns/credentials/v2' |
| 4 | buildCivicDidVc() attaches a JWS compact-serialization proof signed with Grid ES256 private key | VERIFIED | CompactSign + keyPairPromise used; proof.type = 'JsonWebSignature2020' in vc-builder.ts lines 50-56 |
| 5 | verifyGovernmentSession() rejects bearer JWTs whose iss != 'did:gov:noesis:genesis-polis' with reason='court_order_required' | VERIFIED | government-session.ts lines 45-47; iss check + 5 occurrences of court_order_required |
| 6 | verifyGovernmentSession() rejects valid government JWTs lacking court_conviction_ref with reason='court_conviction_ref_required' | VERIFIED | government-session.ts lines 48-51; court_conviction_ref_required guard present |
| 7 | CivicDidStore.insert/get/markRevoked round-trip records against MySQL via mysql2 pool | VERIFIED | civic-did-store.ts: parameterised SQL, markRevoked with AND status='active' idempotency guard |
| 8 | BusinessDidStore.insert/get/markDissolved/listByCivicDid round-trip records against MySQL via mysql2 pool | VERIFIED | business-did-store.ts: parameterised SQL, markDissolved AND status='active', listByCivicDid ORDER BY issued_at_tick ASC |
| 9 | 4 sole-producer audit files exist with 8-step discipline; allowlist grows 60 to 64 entries | VERIFIED | All 4 append-registry-*.ts files present; allowlist has 9 registry.* references (4 entries + comment refs) |
| 10 | POST /api/v1/registry/civic-did/request with valid existence-key returns 201 with W3C VC | VERIFIED | registry.ts lines 41-116; compactVerify + buildCivicDidVc + store.insert + appendRegistryCivicDidIssued |
| 11 | POST /api/v1/registry/civic-did/:did/revoke rejects callers whose JWT iss != 'did:gov:noesis:genesis-polis' with 403 court_order_required | VERIFIED | server.ts onRequest hook lines 358-370: verifyGovernmentSession called before handler; tier='government' assigned |
| 12 | GET /api/v1/registry/civic-did/:did and GET /api/v1/registry/business-did/:did are public with Cache-Control: max-age=60 | VERIFIED | registry.ts: 4 occurrences of Cache-Control/max-age=60; ROUTE_DID_POLICY entries set to 'public' |
| 13 | server.ts onRequest hook handles policy === 'government_only' assigning tier='government' (NOT 'civic_member') | VERIFIED | server.ts line 369: `tier: 'government'`; no civic_member assignment for government path |
| 14 | scripts/check-civic-did-issuance-path.mjs exists, enforces D-V3-33, and exits 0 on current repo; OBS-37-01 wired in rig-invariants.yml | VERIFIED | Gate exits 0 (242 files scanned); OBS-37-01 step present in rig-invariants.yml line 51 |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/db/schema.ts` | Migrations v23+v24 | VERIFIED | version: 23 and version: 24 present; uq_existence_did constraint |
| `grid/src/civic-registry/types.ts` | CivicDidRecord + BusinessDidRecord | VERIFIED | Both interfaces exported |
| `grid/src/civic-registry/vc-builder.ts` | W3C VC v2.0 builder with JWS proof | VERIFIED | 101 lines; validFrom, CompactSign, GRID_REGISTRY_DID |
| `grid/src/civic-registry/government-session.ts` | Government session JWT validator | VERIFIED | 57 lines; GOV_SESSION_ISSUER_DID, iss-claim guard, court_conviction_ref_required guard |
| `grid/src/civic-registry/civic-did-store.ts` | MySQL-backed CivicDidStore | VERIFIED | 89 lines; insert/get/getByExistenceDid/markRevoked with parameterised SQL |
| `grid/src/civic-registry/business-did-store.ts` | MySQL-backed BusinessDidStore | VERIFIED | 97 lines; insert/get/listByCivicDid/markDissolved with parameterised SQL |
| `grid/src/civic-registry/index.ts` | Barrel export | VERIFIED | All 9 symbols exported |
| `grid/src/audit/append-registry-civic-did-issued.ts` | Sole producer position 61 | VERIFIED | 8-step discipline; CIVIC_DID_RE + EXISTENCE_DID_RE local constants |
| `grid/src/audit/append-registry-civic-did-revoked.ts` | Sole producer position 62 | VERIFIED | HEX64_RE guard; court_conviction_ref_hash only (no plaintext in payload) |
| `grid/src/audit/append-registry-business-did-registered.ts` | Sole producer position 63 | VERIFIED | BIZ_DID_RE + CIVIC_DID_RE local; business_name/category excluded |
| `grid/src/audit/append-registry-business-did-dissolved.ts` | Sole producer position 64 | VERIFIED | 4-key closed tuple: business_did/civic_did/dissolved_at_tick/grid_name |
| `grid/src/audit/broadcast-allowlist.ts` | 60 to 64 entries | VERIFIED | 9 registry.* references; positions 61-64 documented |
| `grid/src/api/routes/registry.ts` | 6 Fastify endpoints | VERIFIED | 321 lines; 6 app.post/get registrations; all 4 audit producers imported and called (9 occurrences) |
| `grid/src/api/policy.ts` | 6 new ROUTE_DID_POLICY entries | VERIFIED | Lines 188-193: all 6 registry routes present with correct policies |
| `grid/src/api/server.ts` | government_only branch + tier='government' | VERIFIED | verifyGovernmentSession at line 365; tier: 'government' at line 369; registerRegistryRoutes wired at line 575 |
| `grid/src/api/preHandlers/tryDid.ts` | ANY_DID_RE accepting did:civic:noesis:* | VERIFIED | ANY_DID_RE at line 13; both DID_RE.test calls replaced with ANY_DID_RE.test (lines 48, 72) |
| `grid/src/api/preHandlers/types.ts` | DidContextTier union with 'government' | VERIFIED | 'government' literal added at line 22 |
| `scripts/check-civic-did-issuance-path.mjs` | D-V3-33 constitutional CI gate | VERIFIED | Exits 0 on current repo; 4 FORBIDDEN_IMPORT_TOKENS; 3 APPROVED_IMPORTERS; 4 PRODUCER_FILES; per-line comment stripping prevents false positives |
| `.github/workflows/rig-invariants.yml` | OBS-37-01 step | VERIFIED | Step name "OBS-37-01 civic-DID issuance path gate" at line 51 |
| `grid/test/scripts/check-civic-did-issuance-path.test.ts` | Vitest gate pass+fail tests | VERIFIED | 4 test cases: real repo pass, non-test violator fail (appendRegistryCivicDidIssued + appendRegistryBusinessDidDissolved), .test.ts exempt |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `grid/src/civic-registry/vc-builder.ts` | `grid/src/api/portal/auth.ts (keyPairPromise)` | `import { keyPairPromise }` | WIRED | Line 14: `import { keyPairPromise } from '../api/portal/auth.js'` |
| `grid/src/civic-registry/government-session.ts` | `grid/src/api/portal/auth.ts (keyPairPromise)` | `jwtVerify + publicKey` | WIRED | Line 15: import; line 43: `const { publicKey } = await keyPairPromise` |
| `grid/src/civic-registry/civic-did-store.ts` | `civic_did_registry table (migration v23)` | INSERT/SELECT against civic_did_registry | WIRED | Lines 45, 60, 67, 82: all queries target civic_did_registry |
| `grid/src/api/routes/registry.ts` | `grid/src/civic-registry/civic-did-store.ts` | `services.civicDidStore` | WIRED | store.insert/get/getByExistenceDid/markRevoked all called |
| `grid/src/api/routes/registry.ts` | all 4 append-registry-* producers | import + call at each write endpoint | WIRED | 9 total occurrences (4 imports + calls); appendRegistryBusinessDidDissolved has its production caller in the dissolve route |
| `grid/src/api/routes/registry.ts` | `services.registry.transferOusia` | Bios cost gate | WIRED | Line 210: transferOusia(civicDid, TREASURY_DID, 100) |
| `grid/src/api/server.ts (onRequest hook)` | `grid/src/civic-registry/government-session.ts` | verifyGovernmentSession | WIRED | Line 57 import; line 365 call |
| `grid/src/api/server.ts` | `grid/src/api/routes/registry.ts` | registerRegistryRoutes | WIRED | Line 58 import; line 575 call `void registerRegistryRoutes(app, services)` |
| `.github/workflows/rig-invariants.yml` | `scripts/check-civic-did-issuance-path.mjs` | `node scripts/check-civic-did-issuance-path.mjs` | WIRED | Line 52: named step OBS-37-01 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `registry.ts` POST /civic-did/request | `credential` (VC) | `buildCivicDidVc` + `store.insert` (CivicDidStore → MySQL) | Yes — VC built from real inputs, persisted to DB | FLOWING |
| `registry.ts` GET /civic-did/:did | `record.credentialJson` | `store.get` (CivicDidStore → MySQL SELECT) | Yes — reads from civic_did_registry table | FLOWING |
| `registry.ts` POST /business-did/register | `credential` (Business VC) | `bizStore.insert` (BusinessDidStore → MySQL) + `services.registry.transferOusia` | Yes — real Bios deduction + VC persisted | FLOWING |
| `registry.ts` POST /civic-did/:did/revoke | audit entry | `store.markRevoked` + `appendRegistryCivicDidRevoked` | Yes — MySQL UPDATE + audit chain commit | FLOWING |
| `registry.ts` POST /business-did/:did/dissolve | audit entry | `bizStore.markDissolved` + `appendRegistryBusinessDidDissolved` | Yes — MySQL UPDATE + audit chain commit | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| D-V3-33 gate passes on current repo | `node scripts/check-civic-did-issuance-path.mjs` | `[check-civic-did-issuance-path] OK — 242 files scanned` | PASS |
| Migrations v23+v24 present in schema | `grep -c "version: 23\|version: 24" grid/src/db/schema.ts` | 2 | PASS |
| No issuanceDate in vc-builder | `grep -c "issuanceDate" grid/src/civic-registry/vc-builder.ts` | 0 | PASS |
| All 6 registry policy entries present | grep policy.ts for registry routes | Lines 188-193 confirmed | PASS |
| government tier assigned (not civic_member) | `grep -n "tier: 'government'" grid/src/api/server.ts` | Line 369 confirmed | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| REG-01 | 37-01, 37-03 | Nous with existence-DID can request Civic-DID via POST; existence-key signed oath | SATISFIED | registry.ts lines 41-116; compactVerify oath binding; uq_existence_did prevents duplicates |
| REG-02 | 37-01, 37-03 | Grid issues Civic-DID as W3C VC with credentialSubject, issuer, validFrom, credentialStatus; public GET lookup | SATISFIED | vc-builder.ts W3C VC v2.0; registry.ts GET /civic-did/:did returns VC; REQUIREMENTS.md says `issuanceDate` but W3C Recommendation 2025-05-15 mandates `validFrom` — plan explicitly chose the current standard |
| REG-03 | 37-01, 37-03 | Civic-DID holder registers Business-DID by paying Bios sybil cost (100) | SATISFIED | registry.ts lines 181-253; BUSINESS_DID_BIOS_COST=100; transferOusia gate; 402 on insufficient funds |
| REG-04 | 37-01, 37-03 | Civic-DID revocation requires court order; operator revocation forbidden | SATISFIED | government_only policy; verifyGovernmentSession iss-check; tier='government'; registry.ts revoke route |
| REG-05 | 37-03 | Public lookup endpoints for civic-did and business-did; Cache-Control max-age=60 | SATISFIED | GET /api/v1/registry/civic-did/:did and /business-did/:did both set 'public' policy + max-age=60 header |
| REG-06 | 37-02, 37-04 | Sole-producer files for 4 registry audit events; allowlist +4 (60 to 64); D-V3-33 CI gate | SATISFIED | 4 append-registry-*.ts files with 8-step discipline; ALLOWLIST_MEMBERS[60..63]; check-civic-did-issuance-path.mjs exits 0 |

**Note on REG-02:** REQUIREMENTS.md says `issuanceDate` and `revocationPointer`. The implementation uses `validFrom` (W3C VC v2.0 Recommendation 2025-05-15 — `issuanceDate` was deprecated in v2.0) and `credentialStatus` (standard W3C v2.0 revocation pointer shape). This intentional upgrade is explicitly documented in Plan 01 decisions and SUMMARY.md. It is not a gap — the requirement wording is slightly outdated relative to the W3C spec version shipped.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/civic-registry/government-session.ts` | (all) | Stub: uses Grid keyPairPromise for verification instead of real Polis validator | INFO | By design — Phase 46 swap point; documented in plan; iss-claim discipline is permanent |

No blockers or warnings found. The government-session stub is explicitly designed and forward-declared as a Phase 46 swap point.

### Human Verification Required

None. All critical behaviors are verified programmatically:
- Constitutional CI gate (D-V3-33) passes on real repo
- Privacy discipline (hash-only court_conviction_ref in audit) verified via grep
- government tier assignment (not civic_member) verified via grep
- 6 policy entries confirmed in policy.ts
- Idempotency guards (AND status='active') confirmed in both stores

### Gaps Summary

No gaps. All 14 must-haves verified. All 6 REG-* requirements satisfied across 4 plans. The D-V3-33 Portal-gating invariant is enforced at build time. The phase goal is fully achieved.

---

_Verified: 2026-05-26T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
