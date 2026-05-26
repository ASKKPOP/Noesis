---
phase: 37-did-registry
plan: "02"
subsystem: audit
tags: [audit, sole-producer, allowlist, did-registry, civic-did, business-did, tdd]
dependency_graph:
  requires: []
  provides:
    - appendRegistryCivicDidIssued
    - appendRegistryCivicDidRevoked
    - appendRegistryBusinessDidRegistered
    - appendRegistryBusinessDidDissolved
    - ALLOWLIST_MEMBERS[60..63] (positions 61-64)
  affects:
    - grid/src/audit/broadcast-allowlist.ts
    - scripts/check-sole-producer-discipline.mjs (now sees 47 files)
tech_stack:
  added: []
  patterns:
    - 8-step sole-producer discipline (type guard → regex guards → non-empty string → integer → closed-tuple → explicit reconstruction → privacy gate → chain commit)
    - Local DID regex constants (CIVIC_DID_RE, EXISTENCE_DID_RE, BIZ_DID_RE, HEX64_RE) — no DID_RE import
    - TDD RED/GREEN pattern
key_files:
  created:
    - grid/src/audit/append-registry-civic-did-issued.ts
    - grid/src/audit/append-registry-civic-did-revoked.ts
    - grid/src/audit/append-registry-business-did-registered.ts
    - grid/src/audit/append-registry-business-did-dissolved.ts
    - grid/test/audit/append-registry-civic-did-issued.test.ts
    - grid/test/audit/append-registry-civic-did-revoked.test.ts
    - grid/test/audit/append-registry-business-did-registered.test.ts
    - grid/test/audit/append-registry-business-did-dissolved.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/test/audit/broadcast-allowlist.test.ts
decisions:
  - "Local DID regex constants (CIVIC_DID_RE, BIZ_DID_RE, EXISTENCE_DID_RE) defined in each sole-producer file — no import from append-human-joined.ts — because DID_RE only covers did:noesis:* and would reject Phase 37 did:civic:* and did:biz:* families."
  - "Missing-key test cases use toThrow(TypeError) rather than toThrow(/unexpected key set/) because individual field guards (steps 2-4) fire before the closed-tuple check (step 5) when a field is absent, which is the correct 8-step behavior."
metrics:
  duration: "8m"
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 8
  files_modified: 2
---

# Phase 37 Plan 02: Registry Audit Sole-Producers + Allowlist Growth Summary

4 sole-producer audit files added for DID Registry lifecycle events (positions 61-64); broadcast allowlist grown from 60 to 64 entries with privacy discipline (HEX64 hash for court conviction ref, business_name/category excluded from audit).

## What Was Built

### Task 1: 4 Sole-Producer Audit Files (REG-06)

All 4 files follow the 8-step discipline enforced by `scripts/check-sole-producer-discipline.mjs`:

**`grid/src/audit/append-registry-civic-did-issued.ts`** (allowlist position 61)
- Payload: `{ civic_did, existence_did, grid_name, issued_at_tick }` (4-key closed tuple, alphabetical)
- Guards: CIVIC_DID_RE, EXISTENCE_DID_RE (both local constants), non-empty grid_name, non-negative integer tick
- Actor: `civic_did`

**`grid/src/audit/append-registry-civic-did-revoked.ts`** (allowlist position 62)
- Payload: `{ civic_did, court_conviction_ref_hash, grid_name, revoked_at_tick }` (4-key closed tuple, alphabetical)
- Privacy: `court_conviction_ref_hash` is HEX64 SHA-256 — plaintext `court_conviction_ref` NEVER in audit (lives in MySQL only)
- Guards: CIVIC_DID_RE, HEX64_RE (both local), non-empty grid_name, non-negative integer tick
- Actor: `civic_did`

**`grid/src/audit/append-registry-business-did-registered.ts`** (allowlist position 63)
- Payload: `{ business_did, civic_did, grid_name, registered_at_tick }` (4-key closed tuple, alphabetical)
- Privacy: `business_name`, `category`, `bios_cost_paid` are NOT in payload (DB only)
- Guards: BIZ_DID_RE, CIVIC_DID_RE (both local), non-empty grid_name, non-negative integer tick
- Actor: `business_did`

**`grid/src/audit/append-registry-business-did-dissolved.ts`** (allowlist position 64)
- Payload: `{ business_did, civic_did, dissolved_at_tick, grid_name }` (4-key closed tuple, alphabetical — note `dissolved_at_tick` sorts before `grid_name`)
- Guards: BIZ_DID_RE, CIVIC_DID_RE (both local), non-negative integer tick, non-empty grid_name
- Actor: `business_did`

### Task 2: Broadcast Allowlist 60 → 64

Updated `grid/src/audit/broadcast-allowlist.ts`:
- Header comment: "exactly these 60 event types" → "exactly these 64 event types", added Phase 37 bullet
- 4 new entries at positions 61-64 with per-event documentation
- Phase 37 review comment added (court_conviction_ref_hash is HEX64 hash only; business_name/category in DB)
- Updated `grid/test/audit/broadcast-allowlist.test.ts`: size/length assertions 60 → 64, added Phase 36 position assertions (indices 56-59), added Phase 37 position assertions (indices 60-63)

### Task 3: 4 Vitest Test Files

Each test file covers:
- Type guard rejects (null, array, primitive)
- Domain-specific DID regex rejects (CIVIC_DID_RE, EXISTENCE_DID_RE, BIZ_DID_RE, HEX64_RE)
- Non-empty string guard rejects (grid_name)
- Non-negative integer guard rejects (negative, float)
- Closed-tuple extra key rejection
- Missing key rejection (TypeError at the first failing guard)
- Happy path: valid payload appends to AuditChain with correct eventType and actorDid

## Test Results

- 4 sole-producer test files: **54 passing tests**
- 1 broadcast-allowlist test file: **80 passing tests**
- Total new: **134 passing tests**
- `scripts/check-sole-producer-discipline.mjs`: **47 files pass** (43 existing + 4 new)
- `cd grid && npx tsc --noEmit`: **exits 0**

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 3a9def8 | test | RED: failing tests for 4 registry audit sole-producers |
| 9057923 | feat | GREEN: 4 sole-producer source files + test corrections |
| 4cef207 | test | RED: broadcast-allowlist test updated to expect 64 members |
| 522a54e | feat | GREEN: broadcast-allowlist.ts grown 60 → 64 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectations for missing-key case were incorrect**
- **Found during:** Task 3 GREEN phase (tests failing after source created)
- **Issue:** 4 tests used `toThrow(/unexpected key set/)` for the "missing key" case. When a key is deleted, the individual field guard at steps 2-4 fires BEFORE the closed-tuple structural check at step 5. For example, deleting `grid_name` triggers "grid_name must be a non-empty string" at step 3, not "unexpected key set" at step 5.
- **Fix:** Changed the 4 "missing key" tests to `toThrow(TypeError)` — still tests that a missing key throws, just not constraining to the specific message at the closed-tuple step.
- **Files modified:** All 4 test files
- **Commit:** 9057923

### Pre-existing Out-of-Scope Test Failures

8 tests in 7 files were failing before Phase 37 and remain failing (they hardcode old allowlist sizes from Phases 12-24):
- `allowlist-twenty-six.test.ts`: expects 43 members
- `allowlist-twenty-two.test.ts`: expects 43 members
- `allowlist-forty-five.test.ts`: expects 45 members
- `append-human-spoke.test.ts`: expects ALLOWLIST_MEMBERS.length === 56
- `operator-exported-allowlist.test.ts`: expects allowlist size === 43
- `skill-allowlist.test.ts`: expects 43 events
- `firehose-hub.test.ts`: 2 tests referencing old allowlist counts

These are pre-existing failures outside Plan 02 scope. Logged to deferred-items.

## Privacy Discipline Preserved

| Invariant | Enforcement |
|-----------|-------------|
| `court_conviction_ref` plaintext never in audit | HEX64_RE guard at step 2b; closed-tuple excludes any `court_conviction_ref` key (only `court_conviction_ref_hash` allowed) |
| `business_name` / `category` never in audit | Closed-tuple EXPECTED_KEYS has no slot for those keys; extra-key guard rejects them |
| `bios_cost_paid` never in audit | Same closed-tuple discipline |
| All 4 payloads pass `payloadPrivacyCheck` | No key matches FORBIDDEN_KEY_PATTERN |

## Forward Dependencies

- **Plan 03** (registry route handlers): All 4 producers must be called from `grid/src/api/routes/registry.ts` — including `appendRegistryBusinessDidDissolved` for the dissolution route
- **Plan 04** (CI gate): `scripts/check-civic-did-issuance-path.mjs` will lock the importer set for `appendRegistryCivicDidIssued` to approved-only paths (D-V3-33 Portal-gating invariant)

## Self-Check: PASSED

Files verified to exist:
- `grid/src/audit/append-registry-civic-did-issued.ts` — FOUND
- `grid/src/audit/append-registry-civic-did-revoked.ts` — FOUND
- `grid/src/audit/append-registry-business-did-registered.ts` — FOUND
- `grid/src/audit/append-registry-business-did-dissolved.ts` — FOUND
- `grid/test/audit/append-registry-civic-did-issued.test.ts` — FOUND
- `grid/test/audit/append-registry-civic-did-revoked.test.ts` — FOUND
- `grid/test/audit/append-registry-business-did-registered.test.ts` — FOUND
- `grid/test/audit/append-registry-business-did-dissolved.test.ts` — FOUND

Commits verified to exist:
- 3a9def8 — FOUND
- 9057923 — FOUND
- 4cef207 — FOUND
- 522a54e — FOUND
