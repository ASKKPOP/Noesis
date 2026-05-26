---
phase: 36
plan: "04"
subsystem: audit-producers
tags: [audit-producers, allowlist-extension, sole-producer-discipline, forbidden-keys, vis-05]
depends_on: [36-01]
provides: [append-portal-did-issued, append-portal-did-revoked, append-grid-recognition-granted, append-grid-recognition-revoked, append-portal-notification-dispatched, allowlist-count-60]
affects: [broadcast-allowlist, plans-05-07-downstream]
tech_stack:
  added: []
  patterns: [phase-33-8-step-triad, closed-tuple-payload, payload-privacy-check, sole-producer-boundary]
key_files:
  created:
    - grid/src/audit/append-portal-did-issued.ts
    - grid/src/audit/append-portal-did-revoked.ts
    - grid/src/audit/append-grid-recognition-granted.ts
    - grid/src/audit/append-grid-recognition-revoked.ts
    - grid/src/audit/append-portal-notification-dispatched.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
decisions:
  - "EXPECTED_KEYS for grid.recognition_granted is ['granted_at_tick', 'grid_name', 'nous_did'] (true alphabetical) — plan doc listed wrong order; code/test agree on sorted order"
  - "notification-dispatched uses PORTAL_DID_RE (accepts did:noesis:* and did:civic:*) because operator_did in Portal context uses v3.0 Civic-DID format; DID_RE from append-human-joined.ts only covers did:noesis:*"
  - "ALLOWLIST_MEMBERS count is exactly 60 (56 + 4 VIS-05 events); portal.notification_dispatched intentionally excluded per D-36-19"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  files_count: 6
---

# Phase 36 Plan 04: VIS-05 Sole Producers + Allowlist Extension Summary

5 new sole-producer audit functions following the Phase 33 8-step triad pattern, extending `ALLOWLIST_MEMBERS` from 56 to 60 entries; `portal.notification_dispatched` intentionally omitted from the allowlist as a private personal-queue event per D-36-19.

## What Was Built

### Task 1 — 4 Broadcast-Allowlisted Sole Producers

1. `grid/src/audit/append-portal-did-issued.ts` — sole producer for `portal.did_issued` (allowlist pos 57). Keys (alphabetical sorted): `human_or_nous_did, issued_at_tick, issuer_portal_id`. Actor = `human_or_nous_did`.
2. `grid/src/audit/append-portal-did-revoked.ts` — sole producer for `portal.did_revoked` (allowlist pos 58). Keys: `human_or_nous_did, revoked_at_tick, revoker_portal_id`. Actor = `human_or_nous_did`.
3. `grid/src/audit/append-grid-recognition-granted.ts` — sole producer for `grid.recognition_granted` (allowlist pos 59). Keys (true alphabetical): `granted_at_tick, grid_name, nous_did`. Actor = `nous_did`.
4. `grid/src/audit/append-grid-recognition-revoked.ts` — sole producer for `grid.recognition_revoked` (allowlist pos 60). Keys: `grid_name, nous_did, revoked_at_tick`. Actor = `nous_did`.

All 4 files import `payloadPrivacyCheck` from `./broadcast-allowlist.js` and `DID_RE` from `./append-human-joined.js`. All 4 follow the 8-step triad verbatim. No spread operators. No input mutation.

### Task 2 — Private-Queue Producer + Allowlist Extension

5. `grid/src/audit/append-portal-notification-dispatched.ts` — sole producer for `portal.notification_dispatched`. Keys: `dispatched_at_tick, notification_type, operator_did`. Actor = `operator_did`. Uses local `PORTAL_DID_RE` (accepts both `did:noesis:*` and `did:civic:*`). Contains docblock explicitly stating: "PRIVATE QUEUE EVENT — NOT on broadcast allowlist per D-36-19."

`grid/src/audit/broadcast-allowlist.ts` — Extended `ALLOWLIST_MEMBERS` with 4 new entries:
- Position 57: `portal.did_issued`
- Position 58: `portal.did_revoked`
- Position 59: `grid.recognition_granted`
- Position 60: `grid.recognition_revoked`

Includes Phase 36 comment block (D-36-17 / VIS-05) explicitly documenting that `portal.notification_dispatched` is intentionally NOT included (count=60, NOT 61), with cross-reference to `36-VALIDATION.md` Wave 0 Allowlist-Count Decision.

Also added Phase 36 review comment above `PORTAL_AUTH_FORBIDDEN_KEYS` confirming the 13-key set is preserved and none of the 5 new VIS-05 payloads contain forbidden keys.

## Why portal.notification_dispatched is OFF the Allowlist

Per D-36-19, `portal.notification_dispatched` is a **personal-queue event** — it is dispatched to a single operator's notification queue (delivered via REST poll at `GET /portal/api/v1/notifications`, Plan 05), not broadcast to all WS subscribers. The WS firehose carries civic city events observable by all; personal notifications are explicitly out of that scope.

Including it in `ALLOWLIST_MEMBERS` would violate the intent of the allowlist (civic observability events) and potentially leak personal notification metadata to all WS subscribers. Allowlist count is therefore 60, not 61.

## PORTAL_AUTH_FORBIDDEN_KEYS — Still at 13 Keys

The 13-key set declared in `broadcast-allowlist.ts` under `PORTAL_AUTH_FORBIDDEN_KEYS` is preserved exactly. None of the 5 new VIS-05 payload fields (`human_or_nous_did`, `issued_at_tick`, `issuer_portal_id`, `revoked_at_tick`, `revoker_portal_id`, `granted_at_tick`, `grid_name`, `nous_did`, `revoked_at_tick`, `dispatched_at_tick`, `notification_type`, `operator_did`) match the 13 forbidden keys. A review comment was added to `broadcast-allowlist.ts` confirming this.

## Tests Turned GREEN by This Plan

All 6 audit-layer Phase 36 Wave 0 tests now pass (150 tests total):

| Test File | Tests | Status |
|-----------|-------|--------|
| `grid/test/audit/append-portal-did-issued.test.ts` | 14 | GREEN |
| `grid/test/audit/append-portal-did-revoked.test.ts` | 14 | GREEN |
| `grid/test/audit/append-grid-recognition-granted.test.ts` | 15 | GREEN |
| `grid/test/audit/append-grid-recognition-revoked.test.ts` | 15 | GREEN |
| `grid/test/audit/append-portal-notification-dispatched.test.ts` | 15 | GREEN |
| `grid/test/audit/broadcast-allowlist.test.ts` | 77 | GREEN |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect EXPECTED_KEYS alphabetical order for grid.recognition_granted**
- **Found during:** Task 1 test run
- **Issue:** The plan (and test file comment header) listed the keys for `grid.recognition_granted` as `[grid_name, granted_at_tick, nous_did]`. However, the structural check uses `Object.keys(payload).sort()` which sorts true ASCII-alphabetically. `granted_at_tick` sorts BEFORE `grid_name` because `grant...` < `grid...` (ASCII 'a' < 'i'). The initial implementation used `['grid_name', 'granted_at_tick', 'nous_did']` which caused the happy-path test to throw (sorted keys were `['granted_at_tick', 'grid_name', 'nous_did']`).
- **Fix:** Changed `EXPECTED_KEYS` in `append-grid-recognition-granted.ts` to `['granted_at_tick', 'grid_name', 'nous_did']` (true alphabetical). The test's happy path now passes. The test itself was written with the correct expected behavior — it just didn't explicitly state the sorted order in the comment.
- **Files modified:** `grid/src/audit/append-grid-recognition-granted.ts`
- **Commit:** `dc86a92`

**2. [Rule 2 - Missing Critical Functionality] Used PORTAL_DID_RE instead of DID_RE for notification-dispatched operator_did**
- **Found during:** Task 2 analysis
- **Issue:** The test `append-portal-notification-dispatched.test.ts` uses `'did:civic:noesis:gen-001'` as the happy-path `operator_did`. The imported `DID_RE` from `append-human-joined.ts` only accepts `did:noesis:*` format (v2.x DID format). v3.0 operator accounts use Civic-DID format (`did:civic:*`). Using `DID_RE` would make the happy-path test fail.
- **Fix:** Created local `PORTAL_DID_RE = /^did:(?:noesis|civic):[a-z0-9_:\-]+$/i` in `append-portal-notification-dispatched.ts`. Phase 37 will add a canonical `CIVIC_DID_RE` export; for Phase 36 this local broader regex is the minimum viable guard. The other 4 producers (for Portal DID lifecycle and Grid recognition) correctly use the imported `DID_RE` because their DIDs are standard `did:noesis:*` format.
- **Files modified:** `grid/src/audit/append-portal-notification-dispatched.ts`
- **Commit:** `305df5d`

## Self-Check: PASSED

All 5 producer files found:
- `grid/src/audit/append-portal-did-issued.ts` FOUND
- `grid/src/audit/append-portal-did-revoked.ts` FOUND
- `grid/src/audit/append-grid-recognition-granted.ts` FOUND
- `grid/src/audit/append-grid-recognition-revoked.ts` FOUND
- `grid/src/audit/append-portal-notification-dispatched.ts` FOUND

Both task commits verified:
- `dc86a92` — 4 broadcast-allowlisted sole producers
- `305df5d` — notification producer + allowlist extension 56→60
