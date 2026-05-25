---
phase: 33
plan: "04"
subsystem: portal-auth
tags: [wiring, auth-ts, siwe, email-signup, email-signin, audit-producers, d-33-a4, d-33-a5, d-33-a6, d-33-e1]
dependency_graph:
  requires: [33-03]
  provides: [portal.auth.login-wired, portal.auth.register-wired, human.identified-wired]
  affects: [grid/src/api/portal/auth.ts, audit-chain-event-volume]
tech_stack:
  added: []
  patterns: [sole-producer-call-site-wiring, identity-hash-reuse, sha256-pii-barrier]
key_files:
  modified:
    - grid/src/api/portal/auth.ts
  created:
    - .planning/phases/33-portal-auth-producers/33-04-SUMMARY.md
decisions:
  - "SIWE identity_hash reuses eth_address_hash (byte-identical SHA-256) per D-33-A4 — no second createHash call"
  - "Email path computes email_hash = sha256(email.toLowerCase().trim()) once at wiring site per D-33-A5"
  - "Email signin emits portal.auth.login only — no human.identified or portal.auth.register per D-33-A6"
  - "All 4 wiring sites in single commit — auth.ts cannot be meaningfully partially wired"
  - "console.warn (L308-312) and console.error (L356) preserved byte-for-byte per D-33-E1"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-24"
  tasks_completed: 3
  files_modified: 1
  lines_added: 67
  lines_deleted: 0
---

# Phase 33 Plan 04: Portal Auth Producer Wiring Summary

Wire sole producers appendHumanIdentified, appendPortalAuthLogin, appendPortalAuthRegister into grid/src/api/portal/auth.ts at 4 call sites — SIWE first-connect, SIWE unconditional login, email signup, email signin.

## What Was Built

Three sole-producer imports and four wiring call sites were inserted into `grid/src/api/portal/auth.ts`. The file previously emitted only `human.joined` (SIWE first-connect). After this plan, every successful portal authentication emits the correct audit trail:

| Flow | Events emitted (in order) |
|------|---------------------------|
| SIWE first-connect (isNew === true) | human.joined → human.identified → portal.auth.register → portal.auth.login |
| SIWE repeat-connect (isNew === false) | portal.auth.login |
| Email signup | human.identified → portal.auth.register → portal.auth.login |
| Email signin (valid === true) | portal.auth.login |

## Wiring Details

### Imports added (line 24-26 of final file)
- `appendHumanIdentified` from `../../audit/append-human-identified.js`
- `appendPortalAuthLogin` from `../../audit/append-portal-auth-login.js`
- `appendPortalAuthRegister` from `../../audit/append-portal-auth-register.js`

### Site 1 — SIWE first-connect (inside `if (!human)` block)
- After existing `appendHumanJoined` call
- `appendHumanIdentified` with `identity_hash: eth_address_hash` (reuses the Phase 22 SHA-256 per D-33-A4) and `identity_method: 'siwe'`
- `appendPortalAuthRegister` with `method: 'siwe'`

### Site 2 — SIWE unconditional login (after `if (!human)` closes, before JWT issuance)
- `appendPortalAuthLogin` with `method: 'siwe'`
- Fires on BOTH first-connect and repeat-connect

### Site 3 — Email signup (after `createHuman`, before JWT issuance)
- Computes `email_hash = createHash('sha256').update(email.toLowerCase().trim()).digest('hex')` once
- `appendHumanIdentified` with `identity_hash: email_hash` and `identity_method: 'email'`
- `appendPortalAuthRegister` with `method: 'email'`
- `appendPortalAuthLogin` with `method: 'email'`
- No `human.joined` for email path (SIWE-only contract per D-33-A4/A7 preserved)

### Site 4 — Email signin (after `if (!valid) return` early exit, before JWT issuance)
- `appendPortalAuthLogin` with `method: 'email'`
- No `human.identified`, no `portal.auth.register` — identity stamped at signup (D-33-A6)

## Producer Call Counts

| Producer | Occurrences | Sites |
|----------|-------------|-------|
| `appendHumanIdentified(services.audit, {` | 2 | SIWE first-connect + email signup |
| `appendPortalAuthRegister(services.audit, {` | 2 | SIWE first-connect + email signup |
| `appendPortalAuthLogin(services.audit, {` | 3 | SIWE unconditional + email signup + email signin |
| **Total** | **7** | **4 sites** |

## Key Decisions

1. **identity_hash reuse for SIWE (D-33-A4):** The existing `eth_address_hash` variable (computed at SIWE first-connect for `appendHumanJoined`) is reused as `identity_hash` for `appendHumanIdentified`. No new `createHash` call for SIWE path. This preserves the byte-identical SHA-256 value, enabling consumer cross-reference between Phase 22 `human.joined` entries and Phase 33 `human.identified` entries for the same human.

2. **email_hash computed once (D-33-A5):** `sha256(email.toLowerCase().trim())` is computed immediately before the `appendHumanIdentified` call in the email signup route. Email plaintext never reaches any producer. `createHash` was already imported at line 17.

3. **Email signin emits login only (D-33-A6):** The email signin route does not compute `email_hash` and does not call `appendHumanIdentified` or `appendPortalAuthRegister`. These fired at signup. One login event per successful signin mirrors the SIWE repeat-connect pattern.

4. **console lines preserved (D-33-E1):** `console.warn` at the original L308-312 block (now L378 after insertions) and `console.error` at original L356 (now L423) are byte-for-byte unchanged. Diff shows zero deleted lines.

5. **Single atomic commit:** All 4 wiring sites committed together. `auth.ts` cannot be meaningfully shipped with some sites wired and others missing — partial wiring would produce inconsistent audit trails across flows.

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-33-WIRING-01 (login emits on failed auth) | Mitigated — Site 4 wiring is after `if (!valid) return` early exit |
| T-33-WIRING-02 (register without login or vice versa) | Mitigated — SIWE: register inside if block, login after; email: all 3 calls sequential |
| T-33-EMAIL-PII-01 (email plaintext in payload) | Mitigated — email_hash (SHA-256) used; email key never passed to producer |
| T-33-CONSOLE-01 (silent audit failure) | Accepted — producer throws propagate to Fastify 500 handler; no try/catch |
| T-33-LOGGER-01 (Pino logger picks up redacted secrets) | Accepted — no new logger calls added |

## Deviations from Plan

None. Plan executed exactly as written.

- Imports added at line 24-26 as specified.
- SIWE first-connect block: human.identified + portal.auth.register inserted inside `if (!human)` after appendHumanJoined.
- SIWE unconditional login inserted after `if (!human)` closes, before JWT issuance.
- Email signup: email_hash + 3 producers inserted after createHuman, before JWT issuance.
- Email signin: portal.auth.login inserted after `if (!valid) return`, before JWT issuance.
- console.warn and console.error untouched.
- TypeScript compiles clean.
- Git diff: 67 insertions, 0 deletions.

## Downstream Impact

Plan 33-05 (wiring tests) can now assert against live integration:
- SIWE first-connect: `chain.at(N).eventType` sequence = joined → identified → register → login (4 entries)
- SIWE repeat-connect: `chain.at(N).eventType` = login (1 entry)
- Email signup: `chain.at(N).eventType` sequence = identified → register → login (3 entries)
- Email signin: `chain.at(N).eventType` = login (1 entry)

The `/users` directory and `/humans/[did]/history siwe_sessions` consumers, which depend on `portal.auth.login` and `portal.auth.register` events, are now receiving data.

## Self-Check: PASSED

Files verified:
- `grid/src/api/portal/auth.ts` — FOUND (modified)
- `.planning/phases/33-portal-auth-producers/33-04-SUMMARY.md` — FOUND (this file)

Commits verified:
- `869f0e3` — FOUND (`feat(33-04): wire 3 sole producers into portal auth routes — 4 call sites`)

TypeScript: `cd grid && npx tsc --noEmit` — exits 0 (verified during execution)
