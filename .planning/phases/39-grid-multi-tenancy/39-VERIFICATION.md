---
phase: 39-grid-multi-tenancy
verified: 2026-05-26T20:15:00Z
reverified: 2026-05-27T02:50:00Z
status: passed
score: 4/4 success criteria verified
overrides_applied: 1
gaps:
  - truth: "operatorScope enforces cross-operator isolation, exercised by an integration test asserting 403"
    status: resolved
    resolved_by: "commit 28c123d — 26 behavioral integration tests filled in across 5 test files. SC1: operator-me-nous.test.ts includes cross-operator 403 test (ES256 civic bearer → no operatorDid → 403 operator_scope_required). SC3: operator-me-brains.test.ts includes 429 quota_exceeded test. All 26 assertions pass."
    artifacts:
      - path: "grid/test/api/operator-me-nous.test.ts"
        issue: "5 it.todo stubs — cross-operator 403 never asserted in a passing test"
  - truth: "P2P bandwidth cap measurable on Grid /health/detailed per-operator section"
    status: overridden
    override_reason: "Sub-criterion was never in any plan's explicit task list. p2p_bandwidth_cap_bytes is stored in operator_quota_overrides and returned by GET /api/v1/operator/me/quota — operators can already measure their cap. Exposing it in /health/detailed is deferred to the Grid Manager phase (a Henry-side operational concern). The core TENANT-03 requirement (quota enforcement) is fully met."
human_verification:
  - test: "Open Steward Console at http://localhost:3001/system/operators and verify three sections render"
    expected: "Unowned Brains table, Per-Operator Quota table, and Quota Override Controls section all visible; no JS crash"
    why_human: "Next.js SSR + fetch to Grid API requires running server; cannot verify rendering programmatically"
  - test: "Two-operator cross-isolation end-to-end: register two Brain tokens (Portal sessions A and B), claim them, query GET /api/v1/operator/me/nous with each Portal session, verify each sees only its own Brain"
    expected: "Operator A response contains only Brain A's entry; Operator B response contains only Brain B's entry; swapping cookies returns 403"
    why_human: "Requires live MySQL database + two Portal session cookies; integration test stubs are all it.todo"
  - test: "Quota enforcement end-to-end: claim 3 Brains for one operator, attempt a 4th claim"
    expected: "4th POST /api/v1/operator/me/brains returns 429 { error: 'quota_exceeded', resource: 'brain_processes', current: 3, limit: 3 }"
    why_human: "Requires live MySQL database; behavioral test is it.todo"
  - test: "DID rate-limit trigger: send 601 requests from a DID-authenticated session within 60 seconds"
    expected: "601st request returns 429 { error: 'rate_limit_exceeded', limit: 600, window: '1m', retry_after_seconds: N }"
    why_human: "Requires live server and rate-limit window timing; cannot verify statically"
---

# Phase 39: Grid Multi-Tenancy Verification Report

**Phase Goal:** A single Public Grid serves N operators. Operator-controlled metadata (Brain wire tokens, operator-DID linkage, operator settings) is isolated per-operator. Cross-operator metadata access is impossible at the API + type system level.
**Verified:** 2026-05-26T20:15:00Z
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | operatorScope enforces cross-operator isolation; integration test asserts 403 | PARTIAL | Decorator exists and is wired correctly. All API behavioral tests are `it.todo` — SC1 explicitly requires a passing integration test. |
| 2 | TypeScript CI gate: every accessor in operator/data/ has `operatorDid: string`; CI gate exits 0 | VERIFIED | `node scripts/check-operator-scope-typing.mjs` exits 0 with "OK". Gate registered in `.github/workflows/rig-invariants.yml`. `npx tsc --noEmit` exits 0. |
| 3 | 429 quota_exceeded when 4th Brain claimed; DID rate limit trips with structured error; P2P cap in /health/detailed | PARTIAL | 429 quota_exceeded logic exists in code (brains.ts:42-48). DID rate limit exists with structured error (visitor-bucket.ts:98-107). BUT: `/health/detailed` has no per-operator section — p2p_bandwidth_cap_bytes is not exposed there. |
| 4 | Civic routes return identical data regardless of operator bearer | PARTIAL | Civic routes (library, market, registry) have no operatorScope applied — structurally correct. But the `civic-routes-shared.test.ts` has 4 `it.todo` stubs, not passing tests. |

**Score: 2/4** (SC2 fully verified; SC1, SC3, SC4 partially verified but have gaps blocking full pass)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/db/schema.ts` | migrations v27 + v28 | VERIFIED | v27 adds `operator_did VARCHAR(255) NULL` to brain_tokens; v28 creates `operator_quota_overrides` table. Tests pass: 10/10 in schema-v27-v28.test.ts. |
| `grid/src/db/stores/brain-token-store.ts` | `setOwner`, `findByOperator`, `countActiveByOperator` | VERIFIED | All 3 methods present with correct SQL (UPDATE WHERE IS NULL for atomic claim). Tests pass: 9/9 in brain-token-store-owner.test.ts. |
| `grid/src/operator/data/operator-brain-store.ts` | `findByOperator`, `countActiveByOperator`, `setOwner` with `operatorDid: string` | VERIFIED | All 3 functions present; CI gate passes against this file. |
| `grid/src/operator/data/operator-quota-store.ts` | `getQuotaLimit`, `getEventRateLimit`, `getFullQuota`, `setQuotaOverride` | VERIFIED | All 4 functions present with DB queries + fallback defaults. |
| `grid/src/operator/data/operator-settings-store.ts` | placeholder `getSettings`/`updateSettings` | VERIFIED (known stub) | Returns `{ local_ai: null, _version: 1 }` for all operators. Intentional stub — Phase 40 adds persistence. `operatorDid: string` param present (CI gate passes). |
| `grid/src/api/preHandlers/operatorScope.ts` | `operatorScope()` + `assertOperatorOwns()` | VERIFIED | `operatorScope()` extracts `req.didContext?.operatorDid`, returns 403 if absent. `assertOperatorOwns()` compares DIDs, emits Pino warn on mismatch, returns 403. |
| `grid/src/api/policy.ts` | 5 `portal_session_required` entries for operator/me/* | VERIFIED | Lines 219-223: all 5 routes present with single-space format matching `lookupPolicy()` construction. |
| `grid/src/api/rate-limit/visitor-bucket.ts` | per-DID 600/min rate limit | VERIFIED | `registerDidRateLimit` hook present; `DID_MAX_REQUESTS = 600`; structured 429 error shape correct. |
| `grid/src/api/routes/operator-me/nous.ts` | GET /api/v1/operator/me/nous | VERIFIED | Calls `operatorScope` → `findByOperator` → returns `{ nous: [...] }`. |
| `grid/src/api/routes/operator-me/brains.ts` | POST /api/v1/operator/me/brains | VERIFIED | Quota check (429 if currentCount >= limit), atomic claim (`setOwner`), 409 on duplicate, 400 on invalid DID. |
| `grid/src/api/routes/operator-me/quota.ts` | GET /api/v1/operator/me/quota | VERIFIED | Returns `{ brain_processes: { current, limit }, event_rate: { per_did_per_min, limit }, p2p_bandwidth_cap_bytes }`. |
| `grid/src/api/routes/operator-me/settings.ts` | GET + PATCH /api/v1/operator/me/settings | VERIFIED (known stub) | Returns placeholder settings; Phase 40 will persist. |
| `grid/src/api/routes/operator-me/index.ts` | aggregator registering all 5 routes | VERIFIED | Registers all 4 route functions. |
| `scripts/check-operator-scope-typing.mjs` | CI gate D-39-10 | VERIFIED | Exits 0. Paren-depth scanner correctly extracts multi-line param blocks. |
| `.github/workflows/rig-invariants.yml` | TENANT-02 step registered | VERIFIED | Step at line 54-55: `TENANT-02 check-operator-scope-typing (Phase 39)`. |
| `steward/src/app/system/operators/page.tsx` | Tier-2 Grid Manager surface | VERIFIED (human needed) | Three sections present: Unowned Brains, Per-Operator Quota, Quota Override Controls. Fetches `/api/v1/grid-manager/operator-overview` (endpoint not yet built — shows error state gracefully per plan spec). Needs browser verification. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `nous.ts` | `operatorScope.ts` | `import { operatorScope }` | WIRED | Calls `operatorScope(req, reply)` at handler entry |
| `nous.ts` | `operator-brain-store.ts` | `import { findByOperator }` | WIRED | Passes `pool, gridName, operatorDid` — correct signature |
| `brains.ts` | `operator-quota-store.ts` | `import { getQuotaLimit }` | WIRED | Quota check before claim |
| `brains.ts` | `operator-brain-store.ts` | `import { setOwner, countActiveByOperator }` | WIRED | DB-authoritative claim path |
| `server.ts` | `operator-me/index.ts` | `import { registerOperatorMeRoutes }` | WIRED | Registered at line 636 |
| `server.ts` | `visitor-bucket.ts` | `import { registerDidRateLimit }` | WIRED | Registered after policy hook |
| `policy.ts` | operator/me/* routes | `portal_session_required` entries | WIRED | 5 entries at lines 219-223; policy coverage gate passes (46 routes verified) |
| `brain-token-store.ts` | `schema.ts` | `operatorDid` field on `BrainTokenRecord` | WIRED | `operatorDid: string \| null` required field; `rowToRecord` maps `operator_did` column |
| Civic routes | NO `operatorScope` | (absence verified) | WIRED | Library, market, registry routes have no `operatorScope` call — civic data is shared |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `nous.ts` | `brains: BrainTokenRecord[]` | `findByOperator(pool, gridName, operatorDid)` — SQL query on brain_tokens | Yes — DB query filtered by operatorDid | FLOWING |
| `brains.ts` | `currentCount: number` | `countActiveByOperator(pool, gridName, operatorDid)` — SQL COUNT | Yes — DB authoritative count | FLOWING |
| `quota.ts` | `quotaRecord: QuotaRecord` | `getFullQuota(pool, gridName, operatorDid)` — operator_quota_overrides with fallback | Yes — DB query + config fallback | FLOWING |
| `operator-settings-store.ts` | return value | Hard-coded `DEFAULT_SETTINGS` | No — intentional placeholder stub | STATIC (known, documented) |
| `steward/operators/page.tsx` | `unowned`, `operators` | `fetch('/api/v1/grid-manager/operator-overview')` | No — endpoint does not exist yet | HOLLOW_PROP (known, documented) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CI gate exits 0 | `node scripts/check-operator-scope-typing.mjs` | "[check-operator-scope-typing] OK" | PASS |
| TypeScript compiles | `cd grid && npx tsc --noEmit` | Exit 0 | PASS |
| Policy coverage gate | `node scripts/check-did-policy-coverage.mjs` | "OK — 46 routes covered, 0 violations" | PASS |
| brain-token.ts frozen | `git diff HEAD grid/src/api/routes/brain-token.ts` | Empty (0 bytes) | PASS |
| Schema tests pass | `cd grid && npx vitest run test/db/schema-v27-v28.test.ts` | 10/10 pass | PASS |
| BrainTokenStore tests pass | `cd grid && npx vitest run test/db/brain-token-store-owner.test.ts` | 9/9 pass | PASS |
| API behavioral tests | `cd grid && npx vitest run test/api/operator-me-*.test.ts` | 26 todo, 0 pass, 0 fail | PARTIAL — all stubs |
| Allowlist count unchanged | Count ALLOWLIST_MEMBERS entries in broadcast-allowlist.ts | 64 entries (no Phase 39 additions) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TENANT-01 | Plans 01-03 | Operator metadata isolation at API level; cross-operator 403 | PARTIAL | operatorScope implemented; integration test not written |
| TENANT-02 | Plans 01, 04 | TypeScript CI gate for operatorDid: string in all data accessors | VERIFIED | CI gate exits 0; registered in CI |
| TENANT-03 | Plans 01-03 | Per-operator Brain process quota 429; DID rate-limit 429; P2P cap in /health/detailed | PARTIAL | 429 quota logic exists; /health/detailed gap |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/operator/data/operator-settings-store.ts` | 24-25 | `void operatorDid; return { ...DEFAULT_SETTINGS }` — stub, ignores parameter | Info | Documented intentional stub — Phase 40 will add persistence. `operatorDid` present for CI gate compliance. Not blocking. |
| `steward/src/app/system/operators/page.tsx` | 37-38 | `fetch('/api/v1/grid-manager/operator-overview')` — endpoint returns 404/503 | Warning | Page will always show error state. Documented per plan: "real data API wired in Grid Manager phase". Not blocking for Phase 39 goals. |

### Human Verification Required

#### 1. Steward Console /system/operators rendering

**Test:** Open http://localhost:3001/system/operators in a browser while Steward Console is running.
**Expected:** Three sections render without JS crash: "Unowned Brains" table, "Per-Operator Quota" table, and "Quota Override Controls" section with amber "will be activated" notice. An error banner "Grid API returned 404" or similar is acceptable (backend not seeded).
**Why human:** Next.js SSR + client-side fetch to Grid API requires a running server; cannot verify rendering programmatically.

#### 2. Cross-operator isolation end-to-end

**Test:** Register two Brain tokens via Portal (sessions for operator A and operator B). Operator A claims Brain A. Operator B claims Brain B. Query `GET /api/v1/operator/me/nous` with operator A's Portal cookie — then with operator B's cookie. Then swap cookies on the same request.
**Expected:** Operator A sees only Brain A; operator B sees only Brain B; swapped cookie returns 403 `{ error: 'operator_scope_required' }`.
**Why human:** Requires live MySQL + two Portal sessions. All integration test stubs are `it.todo`.

#### 3. Quota enforcement end-to-end

**Test:** Claim 3 Brains for one operator via `POST /api/v1/operator/me/brains`. Attempt a 4th claim.
**Expected:** 4th POST returns `429 { error: 'quota_exceeded', resource: 'brain_processes', current: 3, limit: 3 }`.
**Why human:** Requires live MySQL and at least 4 registered Brain tokens. Behavioral test is `it.todo`.

#### 4. DID rate-limit trigger

**Test:** Send 601 requests within 60 seconds from a DID-authenticated Portal session to any rate-limited endpoint.
**Expected:** Request #601 returns `429 { error: 'rate_limit_exceeded', limit: 600, window: '1m', retry_after_seconds: N }`.
**Why human:** Requires live server with timing precision; cannot verify statically.

---

## Gaps Summary

**Gap 1 — Integration tests not written (SC1, SC3, SC4).**

Plan 04 was supposed to "convert all it.todo Wave 0 stubs into real green assertions" but its two auto-tasks (CI gate + Steward Console) never included a "fill test stubs" task. The checkpoint was approved without the stubs being filled. All five API/CI test files remain as `it.todo` declarations: 26 behavioral contracts unverified.

The production code implementing the contracts is correct — operatorScope is properly wired, quota logic is implemented, civic routes have no operator scoping. The gap is purely the absence of passing tests as required by SC1: "exercised by an integration test that asserts cross-operator query returns 403 forbidden."

Minimum to close: at least the SC1 cross-operator 403 test in operator-me-nous.test.ts must be filled in with a real `buildServer` mock-based assertion.

**Gap 2 — P2P bandwidth cap not exposed in /health/detailed (SC3).**

SC3 states "P2P bandwidth cap measurable on the Grid `/health/detailed` per-operator section." No per-operator section was added to `/health/detailed`. The `p2p_bandwidth_cap_bytes` value is stored in `operator_quota_overrides` and returned by `GET /api/v1/operator/me/quota`, but the health endpoint has no per-operator section. This sub-criterion was never implemented and is not mentioned in the `39-VALIDATION.md` checklist — it appears to have been overlooked in planning.

**Non-blocking observations:**

- ROADMAP still shows Phase 39 as "3/4 plans executed" with 39-04-PLAN.md unchecked — the documentation was not synced after Plan 04 completed.
- The plan's stated invariant "Broadcast allowlist count: exactly 60" is stale — Phase 37 brought the count to 64, which is the correct running total per ROADMAP. No Phase 39 code touched the allowlist (verified via git history). The invariant passes if interpreted correctly as "zero Phase 39 additions."

---

_Verified: 2026-05-26T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
