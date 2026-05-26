---
phase: 36
plan: "01"
subsystem: validation
tags: [tdd, wave-zero, allowlist-lock-in, visitor-did-split, red-tests]
depends_on: []
provides: [wave-0-test-infrastructure, allowlist-count-locked, nyquist-compliant]
affects: [plans-02-07-downstream]
tech_stack:
  added: []
  patterns: [sole-producer-triad, red-green-refactor, policy-coverage-gate, zero-diff-regression]
key_files:
  created:
    - grid/test/audit/append-portal-did-issued.test.ts
    - grid/test/audit/append-portal-did-revoked.test.ts
    - grid/test/audit/append-grid-recognition-granted.test.ts
    - grid/test/audit/append-grid-recognition-revoked.test.ts
    - grid/test/audit/append-portal-notification-dispatched.test.ts
    - grid/test/audit/firehose-hub-redaction.test.ts
    - grid/test/audit/firehose-hub-zero-diff.test.ts
    - grid/test/api/visitor-public-routes.test.ts
    - grid/test/api/visitor-audit-redaction.test.ts
    - grid/test/api/did-required-enforcement.test.ts
    - grid/test/api/did-revoked-behavior.test.ts
    - grid/test/api/policy-coverage.test.ts
    - grid/test/api/polis-bills-privacy.test.ts
    - dashboard/src/app/portal/page.test.tsx
    - dashboard/src/app/portal/civic-map/CivicMap.test.tsx
  modified:
    - grid/test/audit/broadcast-allowlist.test.ts
    - .planning/phases/36-visitor-did-read-write-split/36-VALIDATION.md
decisions:
  - "Allowlist count 56→60: portal.notification_dispatched excluded (D-36-19 private queue event)"
  - "R-31-01 zero-diff regression guard pins Date.now to fixed value for hash comparison"
  - "firehose-hub-zero-diff.test.ts is a regression guard (GREEN now, must stay GREEN after Plan 03)"
metrics:
  duration: "~9 minutes"
  completed: "2026-05-25"
  tasks_completed: 3
  files_count: 17
---

# Phase 36 Plan 01: Wave 0 Validation Infrastructure Summary

Wave 0 test infrastructure for the visitor/DID read-write split: 15 new test files + 2 amendments (broadcast-allowlist.test.ts and 36-VALIDATION.md). Every implementation plan (02-07) now has executable failing specifications it must satisfy.

## What Was Built

### Task 1 — 8 Audit-Layer Test Files

**7 new files, 1 updated:**

1. `grid/test/audit/append-portal-did-issued.test.ts` — 12 tests asserting the sole-producer triad for `portal.did_issued` (null/array/primitive payload, DID_RE, tick boundary, key-set structural checks, happy path).
2. `grid/test/audit/append-portal-did-revoked.test.ts` — 12 tests for `portal.did_revoked` (same 6 shapes, substituting `revoked_at_tick` + `revoker_portal_id`).
3. `grid/test/audit/append-grid-recognition-granted.test.ts` — 13 tests for `grid.recognition_granted` (keys: `grid_name, granted_at_tick, nous_did`; actor = `nous_did`).
4. `grid/test/audit/append-grid-recognition-revoked.test.ts` — 13 tests for `grid.recognition_revoked` (alphabetical keys: `grid_name, nous_did, revoked_at_tick`).
5. `grid/test/audit/append-portal-notification-dispatched.test.ts` — 13 tests + 1 allowlist-exclusion assertion (`ALLOWLIST_MEMBERS.includes('portal.notification_dispatched') === false`).
6. `grid/test/audit/firehose-hub-redaction.test.ts` — civic_member subscriber receives full frame; anonymous subscriber receives stripped `{tick, event_type, family}` only. RED (onConnect does not yet accept `didContext`).
7. `grid/test/audit/firehose-hub-zero-diff.test.ts` — R-31-01 regression guard. Pins `Date.now` to fixed value, verifies `chain.head` byte-identical across 0/1-anon/1+1-mixed subscriber scenarios. Currently GREEN (invariant holds without redaction); must stay GREEN after Plan 03 extends `onConnect`.
8. `grid/test/audit/broadcast-allowlist.test.ts` — Updated count assertion `56→60` + Phase 36 VIS-05 inclusion block + `portal.notification_dispatched` exclusion block (D-36-19).

**RED state:** 7 files fail (import errors on missing source modules + allowlist count mismatch). The zero-diff test passes (regression guard that verifies chain invariant holds).

### Task 2 — 6 API-Layer Test Files

All new files, all RED:

1. `grid/test/api/visitor-public-routes.test.ts` — 5 tests asserting 200 + shape for each of the 5 public routes under `/api/v1/`.
2. `grid/test/api/visitor-audit-redaction.test.ts` — 2 tests: anonymous tier sees family prefix; civic-member sees full `actor_did`.
3. `grid/test/api/did-required-enforcement.test.ts` — `it.each` over 5 write routes asserting `401 {error:'did_required'}` + OAuth 501 test.
4. `grid/test/api/did-revoked-behavior.test.ts` — 2-part D-36-09 assertion: revoked DID retains read (200) but loses write (401, NOT 403).
5. `grid/test/api/policy-coverage.test.ts` — imports `ROUTE_DID_POLICY` from `grid/src/api/policy.js` (module missing → import error); also asserts the 6-value policy enum shape.
6. `grid/test/api/polis-bills-privacy.test.ts` — VOTE-05 invariant: `ballots` field absent, tally present, `JSON.stringify(body)` does not match `/voter_did|ballots/`.

### Task 3 — 2 Dashboard Tests + VALIDATION.md Amendment

**New test files (both RED):**

1. `dashboard/src/app/portal/page.test.tsx` — 6 assertions: metadata title `'Noēsis · Polis'`, HERO_H1, hero subtitle, TOS line (D-36-22), anonymous banner, 'Sign up' CTA.
2. `dashboard/src/app/portal/civic-map/CivicMap.test.tsx` — 4 assertions: `querySelectorAll('polygon').length === 6`, all 6 D-V3-32 zone labels, `role="img"`, aria-label contains `'Civic Map'`.

**VALIDATION.md amendments:**
- Frontmatter: `nyquist_compliant: false → true`, `wave_0_complete: false → true`
- Added `### Wave 0 Allowlist-Count Decision (LOCKED)` section with rationale for count=60
- Open Question 1 marked `~~...~~ → RESOLVED to 60`
- Validation Sign-Off: all 6 `[ ]` → `[x]`; Approval updated to `approved 2026-05-25 (Wave 0 plan 36-01)`

## Allowlist Count Open Question — RESOLVED

**Decision: count = 60, NOT 61.**

`portal.notification_dispatched` is a personal-queue event (server-pushed to one operator-DID), not a broadcast city event (D-36-19). It enters the audit chain but does NOT enter `ALLOWLIST_MEMBERS`. The 4 additions for Phase 36 are: `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked`. Pre-phase: 56 → post-phase: 60.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zero-diff test non-deterministic Date.now comparison**
- **Found during:** Task 1
- **Issue:** The initial `firehose-hub-zero-diff.test.ts` used an incrementing `fakeNow` mock. `WsFirehoseHub.onConnect()` calls `Date.now()` for the hello frame `serverTime`, consuming increment values differently across scenarios (0-subscriber vs 1-subscriber). This caused `chainA.head !== chainB.head` before any Plan 03 changes.
- **Fix:** Changed to `vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)` — a fixed constant so all `Date.now()` calls return the same value, making `createdAt` deterministic across all three chain scenarios.
- **Files modified:** `grid/test/audit/firehose-hub-zero-diff.test.ts`
- **Commit:** `42eb7fd`

## Expected RED Count (Wave 0 Baseline)

Before any Plan 02-07 implementation:

| Suite | Files Failed | Tests Failed | Reason |
|-------|-------------|-------------|--------|
| `grid test/audit/append-portal-*` | 5 | ~60 | Import error — source modules missing |
| `grid test/audit/firehose-hub-redaction` | 1 | 1 | `onConnect` signature mismatch |
| `grid test/audit/firehose-hub-zero-diff` | 0 | 0 | Regression guard — passes now, stays green |
| `grid test/audit/broadcast-allowlist` | 1 | 3 | Count is 56, not 60; Phase 36 events missing |
| `grid test/api/visitor-public-routes` | 1 | 5 | Routes not registered |
| `grid test/api/visitor-audit-redaction` | 1 | 2 | Redaction not implemented |
| `grid test/api/did-required-enforcement` | 1 | 6 | preHandler not installed |
| `grid test/api/did-revoked-behavior` | 1 | 2 | Revoked DID fallthrough not implemented |
| `grid test/api/policy-coverage` | 1 | 2 | `policy.ts` missing |
| `grid test/api/polis-bills-privacy` | 1 | 1 | Polis bill route not registered |
| `dashboard page.test.tsx` | 1 | 6 | Component missing `tier` prop |
| `dashboard CivicMap.test.tsx` | 1 | 4 | Component doesn't exist |

Wave 0 is complete. Plans 02-07 may now proceed.

## Self-Check: PASSED

All 17 files found. All 3 task commits verified:
- `42eb7fd` — 8 audit-layer test files + allowlist count update
- `582f40e` — 6 API-layer test files
- `227ec74` — 2 dashboard tests + VALIDATION.md amendment
