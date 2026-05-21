---
phase: 25a
plan: "05"
subsystem: grid/api/operator
tags: [cognitive-snapshot, h3-proxy, operator-inspected, brain-http-client, plaintext-defense]
dependency_graph:
  requires: [25a-01, 25a-03]
  provides: [OBS-COGNITIVE-INSPECTOR]
  affects: [25a-06-steward-ui]
tech_stack:
  added: []
  patterns:
    - injectable-brainFetch-via-GridServices (mirrors delete-nous.ts AGENCY-05 pattern)
    - closed-tuple-schema-check (D-25a-05 structural plaintext defense)
    - sole-producer-appendOperatorEvent (Pitfall 4 — single call site)
    - success-only-audit-emission (T-25a-05-07 — no emit on error paths)
key_files:
  created:
    - grid/src/api/operator/cognitive-snapshot-client.ts
    - grid/src/api/operator/cognitive-snapshot.ts
    - grid/test/operator/cognitive-snapshot-client.test.ts
    - grid/test/operator/cognitive-snapshot.test.ts
  modified:
    - grid/src/api/server.ts
decisions:
  - "brainBaseUrl resolved from services.brainBaseUrl (test injection) else process.env.BRAIN_HTTP_BASE_URL else fallback 'http://brain:8090'"
  - "brainFetch injected via services.brainFetch (test injection) else global fetch — added as optional GridServices fields"
  - "Grid-Brain auth: X-Brain-Secret header from process.env.BRAIN_HTTP_SECRET (Claude's Discretion — shared secret per CONTEXT D-25a)"
  - "appendOperatorEvent called at exactly 1 call site in cognitive-snapshot.ts (sole-producer invariant preserved)"
  - "operator.inspected emitted ONLY on success path — 3 distinct error-path tests confirm zero emissions on failure"
  - "creed_violation_count computed from audit.query({eventType: 'nous.creed_violation', actorDid: did}).length"
  - "OPERATOR_ID_REGEX requires op:<uuid-v4> format — test corrected from op:steward-alpha to valid UUID"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 25a Plan 05: Cognitive Snapshot Proxy Summary

**One-liner:** H3-gated Grid proxy to Brain cognitive-snapshot HTTP endpoint with closed-tuple structural plaintext defense and Grid-computed creed_violation_count merge.

## What Was Built

### Endpoint

**POST /api/v1/operator/nous/:did/cognitive-snapshot**

```
Body: { tier: 'H3', operator_id: string }  (OPERATOR_ID_REGEX = /^op:[uuid-v4]$/i)

200: {
  drive_levels: { hunger, curiosity, safety, boredom, loneliness },  // numbers
  last_sleep_tick: number,
  reflexion_count: number,
  rule_count: number,
  skill_titles_topk: string[],
  creed_violation_count: number  // Grid-computed from audit chain
}

400: { error: 'invalid_tier' | 'invalid_operator_id' | 'invalid_did' }
404: { error: 'unknown_nous' }
410: { error: 'tombstoned' }
503: { error: 'brain_unavailable' }
```

### HTTP Client — `cognitive-snapshot-client.ts`

- `fetchCognitiveSnapshot(brainBaseUrl, did, brainFetch, timeoutMs=5000)`
- GET `${brainBaseUrl}/cognitive-snapshot/${encodeURIComponent(did)}`
- Auth: `X-Brain-Secret: process.env.BRAIN_HTTP_SECRET ?? ''`
- AbortController timeout (default 5s)
- Closed-tuple schema check: sorted keys MUST equal exactly `['drive_levels', 'last_sleep_tick', 'reflexion_count', 'rule_count', 'skill_titles_topk']`
- drive_levels validated for exactly 5 drive keys: `['boredom', 'curiosity', 'hunger', 'loneliness', 'safety']`
- skill_titles_topk validated as `string[]`

### Route Handler — `cognitive-snapshot.ts`

Step sequence:
1. `validateTierBody(body, 'H3')` → 400 invalid_tier / invalid_operator_id
2. `DID_REGEX.test(targetDid)` → 400 invalid_did
3. `tombstoneCheck(registry, did)` → 410 tombstoned
4. `getRunner(did)` → 404 unknown_nous
5. `fetchCognitiveSnapshot(brainBaseUrl, did, brainFetch)` → 503 brain_unavailable on any Brain error
6. `audit.query({eventType: 'nous.creed_violation', actorDid: did}).length` → creed_violation_count
7. `appendOperatorEvent(audit, 'operator.inspected', operator_id, {tier, action: 'cognitive_snapshot', operator_id, target_did}, did)` — SUCCESS ONLY
8. Return `{ ...brainSnapshot, creed_violation_count }`

### server.ts additions

Two optional fields added to `GridServices`:
- `brainFetch?: typeof fetch` — injectable for tests
- `brainBaseUrl?: string` — injectable for tests

Import + registration of `registerCognitiveSnapshotRoute` after tick-metrics route.

## Auth: Grid ↔ Brain

**Mechanism:** Shared secret `BRAIN_HTTP_SECRET` environment variable sent as `X-Brain-Secret` header.

This matches the GRID_WS_SECRET pattern documented in the CONTEXT file under "Claude's Discretion — shared secret". The Brain endpoint (Plan 03) validates this header.

**brainBaseUrl resolution:** `services.brainBaseUrl ?? process.env.BRAIN_HTTP_BASE_URL ?? 'http://brain:8090'`

## Decision IDs Implemented

| Decision | Status |
|----------|--------|
| D-25a-02 (Grid proxy to Brain — Steward never calls Brain directly) | SHIPPED |
| D-25a-04 (H3 gate + audit emission for cognitive-snapshot) | SHIPPED |
| D-25a-05 (structural plaintext defense via closed-tuple at client layer) | SHIPPED |

## Sole-Producer Invariant Verification

```
grep -c "appendOperatorEvent" grid/src/api/operator/cognitive-snapshot.ts
```
Returns 4 total lines (3 comments/import + 1 call). **Exactly 1 call site** in the function body (line 126). Pitfall 4 preserved.

## Allowlist Enumeration

**Delta: 0** — `operator.inspected` was already in the allowlist from Phase 6. No new event types added. No new `operator.*`, `nous.*`, or `trade.*` events introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OPERATOR_ID format mismatch in test**
- **Found during:** Task 2 GREEN phase — all tests except tier-validation failing with 400
- **Issue:** Test constant `OPERATOR_ID = 'op:steward-alpha'` does not match `OPERATOR_ID_REGEX = /^op:[uuid-v4]$/i`. The validator rejected the body before DID or tombstone checks, making all downstream tests fail.
- **Fix:** Updated `OPERATOR_ID` to `'op:12345678-1234-4abc-89ab-123456789012'` (valid UUID-v4 format)
- **Files modified:** `grid/test/operator/cognitive-snapshot.test.ts`
- **Commit:** e8db358

Otherwise: plan executed as written.

## Test Coverage

| File | Tests | Result |
|------|-------|--------|
| `grid/test/operator/cognitive-snapshot-client.test.ts` | 12 | All pass |
| `grid/test/operator/cognitive-snapshot.test.ts` | 14 | All pass |

**Total: 26 new tests, all passing**

Key coverage:
- CRITICAL: extra-key plaintext defense (6-key body triggers BrainMalformedResponseError)
- Missing-key defense (4-key body triggers BrainMalformedResponseError)
- drive_levels nested key validation
- timeout → BrainUnreachableError
- operator.inspected emitted on success, NOT on 503/404/410 error paths
- creed_violation_count=3 when 3 nous.creed_violation entries seeded for DID; 0 when none

## Known Stubs

None — all data is live: Brain HTTP response is proxied, creed_violation_count is computed from the live audit chain.

## Threat Flags

None — all new surfaces are covered by T-25a-05-01 through T-25a-05-08 in the plan's threat model. No new endpoints, auth paths, or schema changes beyond those already documented.

## Self-Check: PASSED

Files present:
- `grid/src/api/operator/cognitive-snapshot-client.ts` — FOUND
- `grid/src/api/operator/cognitive-snapshot.ts` — FOUND
- `grid/test/operator/cognitive-snapshot-client.test.ts` — FOUND
- `grid/test/operator/cognitive-snapshot.test.ts` — FOUND

Commits verified:
- `a5566f6` (Task 1 — HTTP client) — FOUND
- `e8db358` (Task 2 — route handler + server.ts) — FOUND
