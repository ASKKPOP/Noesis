---
phase: 33
plan: 03
subsystem: grid/audit
tags: [sole-producer, append-files, closed-enum, portal-auth, d-33-a3, d-33-b1, d-33-b2, obs-08, obs-09, obs-08b, obs-10]
dependency_graph:
  requires: [33-02]
  provides: [appendPortalAuthLogin, appendPortalAuthRegister, appendHumanIdentified]
  affects: [grid/src/audit/broadcast-allowlist.ts, grid/src/api/portal/auth.ts (Plan 33-04)]
tech_stack:
  added: []
  patterns: [sole-producer, closed-enum-guard, closed-tuple-structural-check, payload-privacy-check]
key_files:
  created:
    - grid/src/audit/append-portal-auth-login.ts
    - grid/src/audit/append-portal-auth-register.ts
    - grid/src/audit/append-human-identified.ts
  modified: []
decisions:
  - "LOGIN_METHOD_ENUM and REGISTER_METHOD_ENUM = ['email', 'siwe'] as const — alphabetical, exactly 2 values per D-33-B1"
  - "IDENTITY_METHOD_ENUM = ['email', 'siwe'] as const — same 2 values per D-33-A2"
  - "DID_RE and HEX64_RE imported from append-human-joined.js — single source of truth per D-33-B2, not redeclared"
  - "Guard order for 3-key files: type → DID_RE → enum → tick → closed-tuple → reconstruct → privacy → append (8 steps)"
  - "Guard order for 5-key file: type → DID_RE → HEX64 → enum → grid_name → tick → closed-tuple → reconstruct → privacy → append (10 steps)"
  - "JSDoc 'appendPortalAuthLogin' reference in register sibling rephrased to avoid cross-contamination grep false positive"
metrics:
  duration: "2m 53s"
  completed: "2026-05-25T04:48:35Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
  lines_added: 365
---

# Phase 33 Plan 03: Portal Auth Producers Summary

**One-liner:** Three sole-producer files with closed-enum guards land for `portal.auth.login`, `portal.auth.register`, and `human.identified` — Phase 33's new audit pattern before any call site exists.

## What Shipped

### Task 1 — `grid/src/audit/append-portal-auth-login.ts` (commit `0d3b023`)

Sole producer for `portal.auth.login` at allowlist position 54. 112 lines.

- Closed 3-key payload `{human_did, method, tick}`.
- `LOGIN_METHOD_ENUM = ['email', 'siwe'] as const` — closed-enum guard at step 3.
- `DID_RE` imported from `./append-human-joined.js`.
- 8-step guard sequence: type → DID_RE → enum → tick → closed-tuple → reconstruct → privacy → append.
- Full `payloadPrivacyCheck` before `audit.append('portal.auth.login', ...)`.

### Task 2 — `grid/src/audit/append-portal-auth-register.ts` (commit `3bb61ba`)

Sole producer for `portal.auth.register` at allowlist position 55. 112 lines.

- Same closed 3-key payload shape as login sibling; `REGISTER_METHOD_ENUM = ['email', 'siwe'] as const`.
- Zero cross-contamination: `grep -c "portal.auth.login'"` = 0; `grep -c "appendPortalAuthLogin"` = 0; `grep -c "LOGIN_METHOD_ENUM"` = 0.
- `DID_RE` imported from `./append-human-joined.js`.

### Task 3 — `grid/src/audit/append-human-identified.ts` (commit `6cb1106`)

Sole producer for `human.identified` at allowlist position 56. 141 lines.

- Closed 5-key payload `{grid_name, human_did, identity_hash, identity_method, tick}`.
- `IDENTITY_METHOD_ENUM = ['email', 'siwe'] as const` — closed-enum guard at step 4 (between HEX64 and grid_name guards).
- `DID_RE` + `HEX64_RE` both imported from `./append-human-joined.js`.
- 10-step guard sequence: type → DID_RE → HEX64 → enum → grid_name → tick → closed-tuple → reconstruct → privacy → append.
- Universal identity-stamp coexisting with Phase 22 `human.joined` (SIWE-only, preserved per PHILOSOPHY §1).

## Pattern Introduced

**Closed-enum guard** — Phase 33's new pattern. No existing sole-producer in `grid/src/audit/` prior to this plan used `const ENUM = [...] as const + ENUM.includes(...)`. The guard is inserted after regex guards and before non-empty-string guards in the canonical numbered-step ordering established by `append-human-joined.ts`.

## Downstream Impact

- **Plan 33-04** (call-site wiring in `grid/src/api/portal/auth.ts`) now has concrete import targets.
- **Plan 33-05** (tests) now has producer functions to test against — enum rejection, extra-key rejection, HEX64 rejection.
- **Plan 33-06** (CI gate) now has 3 files to enforce the `audit.append` sole-producer discipline against.
- **No call sites** exist yet: `grep -rn "appendPortalAuthLogin\|appendPortalAuthRegister\|appendHumanIdentified" grid/src/api/` returns zero matches — wave-ordering discipline confirmed.

## OBS-10 Traceability

Each producer calls `payloadPrivacyCheck(cleanPayload)` before `audit.append`. `payloadPrivacyCheck` reads `FORBIDDEN_KEY_PATTERN` (updated with word-boundary clause in Plan 33-02) at runtime, so these producers operationally enforce OBS-10's PII boundary even though the regex literal lives in `broadcast-allowlist.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc cross-contamination in append-portal-auth-register.ts**

- **Found during:** Task 2 verification
- **Issue:** The plan's Task 2 action section specified writing the JSDoc phrase "Discipline mirrors appendPortalAuthLogin exactly (sibling file, same shape):" — but the acceptance criteria simultaneously required `grep -c "appendPortalAuthLogin" grid/src/audit/append-portal-auth-register.ts` to return `0`. Contradiction in plan specification.
- **Fix:** Rephrased JSDoc to "Discipline mirrors the login sibling file exactly (same 3-key shape):" — preserves the semantic intent without the string literal that would fail the acceptance criterion.
- **Files modified:** `grid/src/audit/append-portal-auth-register.ts`
- **Commit:** `3bb61ba`

## Known Stubs

None. All three producers are complete, self-contained, and validated by `tsc --noEmit`. No hardcoded empty values, no placeholder text, no unconnected data sources. Call-site wiring is intentionally deferred to Plan 33-04 (wave-ordering discipline).

## Threat Flags

None. The three new files introduce no new network endpoints, no new auth paths, no new file access patterns, and no schema changes at trust boundaries. They are pure producer functions that call an existing chain API (`audit.append`) already guarded by `payloadPrivacyCheck`.

## Self-Check

Files created:
- `grid/src/audit/append-portal-auth-login.ts` — FOUND
- `grid/src/audit/append-portal-auth-register.ts` — FOUND
- `grid/src/audit/append-human-identified.ts` — FOUND

Commits:
- `0d3b023` — feat(33-03): add appendPortalAuthLogin
- `3bb61ba` — feat(33-03): add appendPortalAuthRegister
- `6cb1106` — feat(33-03): add appendHumanIdentified

TypeScript: `cd grid && npx tsc --noEmit` exits 0 after all three files land.

## Self-Check: PASSED
