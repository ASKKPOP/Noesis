---
phase: 33
plan: "02"
subsystem: audit/allowlist
tags: [allowlist, forbidden-keys, word-boundary-regex, d-33-a1, d-33-b3, d-33-b4, obs-08, obs-09, obs-08b, obs-10]
dependency-graph:
  requires: [33-01]
  provides: [allowlist-positions-54-55-56, PORTAL_AUTH_FORBIDDEN_KEYS, FORBIDDEN_KEY_PATTERN-phase-33-extension]
  affects: [33-03-producers, 33-04-wiring, 33-05-tests, 33-06-ci-gates]
tech-stack:
  added: []
  patterns: [frozen-Object.freeze-const, word-boundary-regex-alternation, sole-producer-allowlist-discipline]
key-files:
  created: []
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/test/audit/broadcast-allowlist.test.ts
decisions:
  - "D-33-A1: ALLOWLIST_MEMBERS extended from 53 to 56; positions 54/55/56 are portal.auth.login, portal.auth.register, human.identified"
  - "D-33-B3: PORTAL_AUTH_FORBIDDEN_KEYS exported as Object.freeze([...] as const) with exactly 13 keys"
  - "D-33-B4: FORBIDDEN_KEY_PATTERN extended with word-boundary clause \\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\\b — FIRST use of \\b in this regex"
  - "Rule 1 deviation: broadcast-allowlist.test.ts updated to reflect count 53→56 (broken tests are auto-fixed)"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-25"
  tasks-completed: 3
  files-modified: 2
---

# Phase 33 Plan 02: Allowlist Expansion + PORTAL_AUTH_FORBIDDEN_KEYS + Regex Extension Summary

**One-liner:** ALLOWLIST_MEMBERS 53→56 with portal.auth.login/register + human.identified; PORTAL_AUTH_FORBIDDEN_KEYS 13-key frozen export; FORBIDDEN_KEY_PATTERN extended with first-ever word-boundary alternation for 6 PII collision-risk keys.

## What Was Done

### Task 1 — Append ALLOWLIST_MEMBERS positions 54/55/56 (commit e60208d)

Inserted 3 new allowlist entries immediately before `] as const;` at the end of `ALLOWLIST_MEMBERS`, following the Phase 28 pattern. The block includes the canonical comment convention (sole-producer file reference, payload shape, behavioral note).

- Position 54: `'portal.auth.login'` — closed 3-key payload `{human_did, method, tick}`
- Position 55: `'portal.auth.register'` — closed 3-key payload `{human_did, method, tick}`
- Position 56: `'human.identified'` — closed 5-key payload `{grid_name, human_did, identity_hash, identity_method, tick}`

Verified: `awk` count = 56; positions 53→56 appear in ascending line order; `buildFrozenAllowlist`, `ALLOWLIST`, and `isAllowlisted` untouched; TypeScript clean.

### Task 2 — Export PORTAL_AUTH_FORBIDDEN_KEYS (commit 7c13167)

Inserted a new `Object.freeze([...] as const)` export immediately after `WHISPER_FORBIDDEN_KEYS`, preserving the blank-line-between-exports convention. JSDoc references D-33-B3, OBS-10, and the "exactly 13 keys" invariant.

Keys (exactly 13): `ip_address`, `ip`, `user_agent`, `ua`, `session_id`, `token`, `jwt`, `cookie`, `email`, `password_hash`, `nonce`, `signature`, `device_fingerprint`.

Verified: 1 export declaration; awk-scoped key count = 13; D-33-B3 and "exactly 13 keys" present; GOVERNANCE_FORBIDDEN_KEYS and WHISPER_FORBIDDEN_KEYS unchanged; TypeScript clean.

### Task 3 — Extend FORBIDDEN_KEY_PATTERN with word-boundary alternation (commit 162dbdf)

Appended `|\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b` to the FORBIDDEN_KEY_PATTERN regex tail (before `/i`). Added Phase 33 JSDoc paragraph documenting:
- This is the FIRST use of `\b...\b` in this regex
- Word-boundary rationale: `ip_country` passes, `ip_address` blocked; `agent_version` passes, `user_agent` blocked
- Why `user_agent_version` passes: `_` is `\w`, so no boundary fires between `user_agent` and `_version`
- Why 7 short keys (email, ip, ua, token, cookie, nonce, signature) are NOT in the pattern — they over-match; enforced at closed-tuple structural boundary instead

Verified: regex line contains `|\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b/i`; D-33-B4, "FIRST use of", and "does NOT match `user_agent_version`" all present; TypeScript clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated broadcast-allowlist.test.ts to reflect count 53→56**

- **Found during:** Task 3 verification
- **Issue:** Existing tests hardcoded `ALLOWLIST.size` and `ALLOWLIST_MEMBERS.length` as `53`; adding 3 entries caused 3 test failures (`expect(56).toBe(53)`).
- **Fix:** Updated count literals from 53 to 56 in 3 assertions (size check, length check, frozen mutation check); added Phase 33 entries to `it.each` membership list; added 4 new tests (position 54/55/56 index checks + ordering test).
- **Files modified:** `grid/test/audit/broadcast-allowlist.test.ts`
- **Commit:** 162dbdf (bundled with Task 3 commit per single-file surgical discipline)
- **Tests:** 75 passing (was 68 before Phase 33 additions)

## Self-Check

### Created files exist
- `.planning/phases/33-portal-auth-producers/33-02-SUMMARY.md` — this file

### Commits exist

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e60208d | ALLOWLIST_MEMBERS positions 54/55/56 |
| 2 | 7c13167 | PORTAL_AUTH_FORBIDDEN_KEYS 13-key frozen sibling |
| 3 | 162dbdf | FORBIDDEN_KEY_PATTERN word-boundary extension + test update |

### Success criteria verification

| Criterion | Status |
|-----------|--------|
| ALLOWLIST_MEMBERS has exactly 56 entries | PASS (awk count = 56) |
| Position 54 = 'portal.auth.login' | PASS (ALLOWLIST_MEMBERS[53]) |
| Position 55 = 'portal.auth.register' | PASS (ALLOWLIST_MEMBERS[54]) |
| Position 56 = 'human.identified' | PASS (ALLOWLIST_MEMBERS[55]) |
| PORTAL_AUTH_FORBIDDEN_KEYS has exactly 13 entries | PASS (awk-scoped count = 13) |
| FORBIDDEN_KEY_PATTERN word-boundary clause present | PASS (grep confirmed) |
| Positions 1-53 unchanged | PASS (no deletions; grep -c 'nous.spawned_by_human' = 1) |
| TypeScript compiles clean | PASS (tsc --noEmit: no output) |
| Existing tests pass | PASS (75/75) |

## Self-Check: PASSED

All commits present. All files exist. All success criteria met.

## Known Stubs

None. This plan only modifies allowlist constants — no producer code, no UI rendering, no data wiring.

## Threat Flags

None. The changes are purely additive to an existing internal constants file. No new network endpoints, auth paths, or trust boundary crossings introduced in this plan. PORTAL_AUTH_FORBIDDEN_KEYS and the regex extension are defensive additions (reducing surface, not expanding it).
