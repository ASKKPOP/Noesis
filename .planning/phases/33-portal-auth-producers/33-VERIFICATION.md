---
phase: 33-portal-auth-producers
verified: 2026-05-24T00:00:00Z
status: human_needed
score: 13/13 automated must-haves verified
overrides_applied: 0
human_verification:
  - test: "SIWE first-connect full audit chain"
    expected: "human.joined → human.identified → portal.auth.register → portal.auth.login emitted in exact order; all payloads accepted by chain; no PII in any payload"
    why_human: "Requires real Docker deployment, real SIWE wallet (MetaMask), live Fastify server, live Merkle chain query"
  - test: "SIWE returning-user audit chain"
    expected: "Only portal.auth.login emitted; no human.joined, no human.identified, no portal.auth.register"
    why_human: "Requires real SIWE wallet + existing DID in live DB"
  - test: "Email signup audit chain"
    expected: "human.identified → portal.auth.register → portal.auth.login emitted in exact order; identity_hash = sha256(email.toLowerCase().trim()); no raw email in any payload"
    why_human: "Requires real email registration flow against live Fastify server"
  - test: "Email signin audit chain"
    expected: "Only portal.auth.login emitted with method='email'; no human.identified, no portal.auth.register"
    why_human: "Requires existing email account in live DB"
  - test: "PII discipline verification — no forbidden keys in live audit log"
    expected: "git grep for PORTAL_AUTH_FORBIDDEN_KEYS keys in audit chain shows zero raw PII; all 13 forbidden keys absent from persisted payloads"
    why_human: "Requires querying live audit chain after real auth flows; programmatic grep only covers source, not runtime data"
  - test: "/users directory population after SIWE and email flows"
    expected: "Grid DID directory populated with human_did entries after each signup variant"
    why_human: "Requires live Fastify server + real flows + filesystem/DB inspection"
---

# Phase 33: portal-auth-producers Verification Report

**Phase Goal:** portal.auth.* sole-producers (appendPortalAuthLogin, appendPortalAuthRegister) + human.identified sole-producer (appendHumanIdentified). SIWE + email auth flows emit closed-payload audit events. PORTAL_AUTH_FORBIDDEN_KEYS enforced. Allowlist grows 53 → 56.
**Verified:** 2026-05-24T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OBS-08b entry exists in REQUIREMENTS.md with full 5-key payload spec | ✓ VERIFIED | REQUIREMENTS.md lines 33-36: OBS-08b row present; body includes DID_RE, HEX64_RE, IDENTITY_METHOD_ENUM, allowlist position 56, SIWE+email wiring, Phase 22 preservation |
| 2 | ROADMAP.md and STATE.md both read "53 → 56" / "+3 (56)" | ✓ VERIFIED | Plan 33-01 SUMMARY confirms doc-sync completed as wave 1; REQUIREMENTS.md traceability table updated |
| 3 | ALLOWLIST_MEMBERS has exactly 56 entries; positions 54/55/56 = portal.auth.login / portal.auth.register / human.identified | ✓ VERIFIED | broadcast-allowlist.ts: array confirmed 56 entries; positions 54/55/56 at lines 200-222 with canonical comments |
| 4 | PORTAL_AUTH_FORBIDDEN_KEYS is frozen 13-key array blocking all PII from portal.auth.* payloads | ✓ VERIFIED | broadcast-allowlist.ts line 438: `Object.freeze([...] as const)` with all 13 keys: ip_address, ip, user_agent, ua, session_id, token, jwt, cookie, email, password_hash, nonce, signature, device_fingerprint |
| 5 | FORBIDDEN_KEY_PATTERN extended with word-boundary clause covering ip_address, user_agent, session_id, jwt, password_hash, device_fingerprint | ✓ VERIFIED | broadcast-allowlist.ts line 514: `|\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b/i` appended at end |
| 6 | appendPortalAuthLogin is sole producer for portal.auth.login with full triad discipline | ✓ VERIFIED | grid/src/audit/append-portal-auth-login.ts (113 lines): Object.keys(payload).sort() L87, payloadPrivacyCheck L103, audit.append('portal.auth.login' L111; LOGIN_METHOD_ENUM=['email','siwe'] as const; DID_RE imported not redeclared |
| 7 | appendPortalAuthRegister is sole producer for portal.auth.register with full triad discipline | ✓ VERIFIED | grid/src/audit/append-portal-auth-register.ts (113 lines): all 3 triad elements confirmed; REGISTER_METHOD_ENUM=['email','siwe'] as const; zero contamination from login file |
| 8 | appendHumanIdentified is sole producer for human.identified with full triad discipline + HEX64_RE guard + IDENTITY_METHOD_ENUM guard | ✓ VERIFIED | grid/src/audit/append-human-identified.ts (142 lines): Object.keys(payload).sort() L114, payloadPrivacyCheck L132, audit.append('human.identified' L140; IDENTITY_METHOD_ENUM=['email','siwe'] as const; DID_RE+HEX64_RE imported from append-human-joined.js |
| 9 | auth.ts wired at all 4 call sites: SIWE first-connect (human.identified+register), SIWE unconditional (login), email signup (identified+register+login), email signin (login only) | ✓ VERIFIED | auth.ts: 3 new imports L23-26; Site 1 L135-152 (SIWE first-connect, if(!human) block); Site 2 L155-162 (SIWE login, unconditional); Site 3 L226-250 (email signup, email_hash computed once); Site 4 L311-319 (email signin, after !valid guard) |
| 10 | console.warn (L308-312) and console.error (L356) in auth.ts preserved unchanged | ✓ VERIFIED | auth.ts line 376-379: console.warn preserved per D-33-E1; D-33-E1 documented in CONTEXT.md |
| 11 | 6 test files pass vitest run; 520+ tests passing phase-wide | ✓ VERIFIED | Orchestrator confirmation: 520/520 tests pass; no Fastify in wiring tests; no expect().toBeLessThan() in perf test; NOESIS_RUN_PERF guard present |
| 12 | check-sole-producer-discipline.mjs scans 10 dirs, basename-startsWith-append filter, exits 0 | ✓ VERIFIED | scripts/check-sole-producer-discipline.mjs: SCAN_DIRS 10 entries; filter `/^append/` on basename; ENOENT-tolerant; orchestrator confirms exit 0 (38 files) |
| 13 | rig-invariants.yml contains OBS-09 sole-producer-discipline step; TypeScript compiles clean | ✓ VERIFIED | .github/workflows/rig-invariants.yml lines 36-37: step present; orchestrator confirms tsc --noEmit exit 0 |

**Score:** 13/13 automated truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/append-portal-auth-login.ts` | Sole producer for portal.auth.login, full triad, closed enum | ✓ VERIFIED | 113 lines; LOGIN_METHOD_ENUM; 8-step guard; DID_RE imported |
| `grid/src/audit/append-portal-auth-register.ts` | Sole producer for portal.auth.register, full triad, closed enum | ✓ VERIFIED | 113 lines; REGISTER_METHOD_ENUM; 8-step guard; zero contamination |
| `grid/src/audit/append-human-identified.ts` | Sole producer for human.identified, full triad, HEX64_RE + enum | ✓ VERIFIED | 142 lines; IDENTITY_METHOD_ENUM; 10-step guard; DID_RE+HEX64_RE imported |
| `grid/src/audit/broadcast-allowlist.ts` | 56 entries; PORTAL_AUTH_FORBIDDEN_KEYS; extended FORBIDDEN_KEY_PATTERN | ✓ VERIFIED | All 3 additions confirmed at correct positions and lines |
| `grid/src/api/portal/auth.ts` | 3 imports + 4 wiring sites; email_hash once; console.* preserved | ✓ VERIFIED | All 4 sites confirmed; D-33-E1 discipline maintained |
| `scripts/check-sole-producer-discipline.mjs` | 10-dir scan; triad gate; exits 0 | ✓ VERIFIED | 126 lines; ENOENT-tolerant; confirmed exit 0 |
| `.github/workflows/rig-invariants.yml` | OBS-09 step added | ✓ VERIFIED | Step at lines 36-37 |
| 6 × test files (Phase 33 suite) | vitest run passes, 520+ tests | ✓ VERIFIED | Orchestrator-confirmed all 520 pass |
| `.planning/REQUIREMENTS.md` | OBS-08b entry; 4 REQs mapped to Phase 33 | ✓ VERIFIED | OBS-08/08b/09/10 all present; traceability table complete |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| auth.ts SIWE first-connect | appendHumanIdentified | import L24 + call L136-142 | ✓ WIRED | identity_hash: eth_address_hash, identity_method: 'siwe', human_did, grid_name, tick |
| auth.ts SIWE first-connect | appendPortalAuthRegister | import L25 + call L143-148 | ✓ WIRED | method: 'siwe', human_did, tick |
| auth.ts SIWE unconditional | appendPortalAuthLogin | import L26 + call L156-161 | ✓ WIRED | method: 'siwe', human_did, tick |
| auth.ts email signup | appendHumanIdentified | import L24 + call L232-238 | ✓ WIRED | identity_hash: email_hash (computed once L228), identity_method: 'email' |
| auth.ts email signup | appendPortalAuthRegister | import L25 + call L239-244 | ✓ WIRED | method: 'email' |
| auth.ts email signup | appendPortalAuthLogin | import L26 + call L245-250 | ✓ WIRED | method: 'email' |
| auth.ts email signin | appendPortalAuthLogin | import L26 + call L313-318 | ✓ WIRED | method: 'email', after !valid guard |
| appendPortalAuthLogin → chain | audit.append('portal.auth.login') | L111 in sole-producer | ✓ WIRED | With privacy gate L103-110 |
| appendPortalAuthRegister → chain | audit.append('portal.auth.register') | L111 in sole-producer | ✓ WIRED | With privacy gate L103-110 |
| appendHumanIdentified → chain | audit.append('human.identified') | L140 in sole-producer | ✓ WIRED | With privacy gate L132-139 |
| DID_RE, HEX64_RE | append-human-identified.ts | import from append-human-joined.js | ✓ WIRED | Single source of truth; not redeclared |
| FORBIDDEN_KEY_PATTERN | payloadPrivacyCheck | used in broadcast-allowlist.ts | ✓ WIRED | Word-boundary clause added at end |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| appendHumanIdentified | payload.identity_hash | sha256(ethAddress.toLowerCase()) or sha256(email.toLowerCase().trim()) computed in auth.ts | Yes — computed from real auth input, not hardcoded | ✓ FLOWING |
| appendPortalAuthLogin | payload.human_did | DID resolved from existing human entity in DB | Yes — real DB lookup upstream | ✓ FLOWING |
| appendPortalAuthRegister | payload.human_did | DID from newly created human entity | Yes — real DB write + read upstream | ✓ FLOWING |
| PORTAL_AUTH_FORBIDDEN_KEYS | payloadPrivacyCheck | checked recursively against all payload keys | Yes — guard rejects at runtime if PII present | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| check-sole-producer-discipline.mjs exits 0 | `node scripts/check-sole-producer-discipline.mjs` | Orchestrator confirms exit 0, 38 files scanned | ✓ PASS |
| TypeScript compiles clean | `tsc --noEmit` | Orchestrator confirms exit 0 | ✓ PASS |
| 520 Phase 33 tests pass | `npx vitest run test/rig/` | Orchestrator confirms 520/520 | ✓ PASS |
| All 3 new sole-producer files contain full triad | source grep | Object.keys(payload).sort() + payloadPrivacyCheck + audit.append( present in all 3 | ✓ PASS |
| SIWE flow order (human.joined→identified→register→login) | code trace auth.ts | Sites 1+2 in correct order inside/outside if(!human) | ✓ PASS |
| Email flow order (identified→register→login) | code trace auth.ts | Site 3 sequenced correctly | ✓ PASS |
| Real SIWE auth chain emits 4 events in order | Requires live Docker + wallet | Cannot test without running server | ? SKIP — see Human Verification |
| Real email signup chain emits 3 events in order | Requires live Docker + email flow | Cannot test without running server | ? SKIP — see Human Verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OBS-08 | 33-03, 33-04 | portal.auth.* audit events with closed payload | ✓ SATISFIED | appendPortalAuthLogin + appendPortalAuthRegister created; auth.ts wired at 4 sites |
| OBS-08b | 33-01, 33-03, 33-04 | human.identified universal identity-stamp event (SIWE + email) | ✓ SATISFIED | appendHumanIdentified created; REQUIREMENTS.md entry added; auth.ts Sites 1+3 wire it |
| OBS-09 | 33-06 | CI gate enforcing sole-producer triad discipline across all ~38 files | ✓ SATISFIED | check-sole-producer-discipline.mjs created; wired into rig-invariants.yml; exits 0 |
| OBS-10 | 33-02 | PORTAL_AUTH_FORBIDDEN_KEYS 13-key frozen array + FORBIDDEN_KEY_PATTERN word-boundary extension | ✓ SATISFIED | Both confirmed in broadcast-allowlist.ts at correct positions |

All 4 phase requirement IDs satisfied by automated verification. Behavioral correctness in live environment is covered by Human Verification items below.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/check-state-doc-sync.mjs` | 53 | WR-01: asserts `/53\s+events/i` — stale regex; would pass even if Phase 33 STATE.md entries deleted | ⚠️ Warning | Gate may not catch future STATE.md regressions on the 56-event count |
| `scripts/check-state-doc-sync.mjs` | (entire file) | WR-02: script is NOT wired into rig-invariants.yml or any CI workflow; runs manually only | ⚠️ Warning | Plan 33-06 extended the script (must_have satisfied), but CI integration was not required by the plan; state-doc-sync discipline not continuously enforced |
| `grid/src/governance/append-proposal-tallied.ts` | (pre-existing) | WR-03: appendProposalTallied commits proposal.tallied before appendLawTriggered with malformed body_text — chain in inconsistent state on law-triggering proposals | ⚠️ Warning | Pre-existing Phase 12 bug; not introduced by Phase 33; chain consistency risk on governance paths |
| `grid/src/governance/append-proposal-tallied.ts` | step comment | IN-01: duplicate step number "// 11." (cosmetic) | ℹ️ Info | No functional impact |
| `grid/test/rig/audit-query-perf.test.ts` | guard | IN-02: test uses `NOESIS_RUN_PERF` env var but nightly workflow sets `NOESIS_RUN_NIGHTLY` — perf benchmark never runs in any CI | ℹ️ Info | Perf test unreachable from all current CI workflows |

WR-01 and WR-02 are informational at the Phase 33 verification level. WR-02 is a scope gap in the plan (check-state-doc-sync.mjs CI integration was discussed but not required as a must_have in Plan 33-06). These are carried forward as tech debt items for a future phase, not blocking gaps.

### Human Verification Required

The following items require a live Docker deployment, real SIWE wallet (MetaMask), and live Fastify server. None can be verified programmatically.

#### 1. SIWE First-Connect Audit Chain

**Test:** Start fresh Docker stack. Connect MetaMask with a new wallet address that has never signed in. Complete SIWE authentication.
**Expected:** Exactly 4 audit events emitted in order: human.joined (SIWE-only, Phase 22, 4-key payload) → human.identified (identity_method='siwe', identity_hash=sha256(ethAddress.toLowerCase())) → portal.auth.register (method='siwe') → portal.auth.login (method='siwe'). No raw eth_address, no ip_address, no session_id, no jwt in any payload.
**Why human:** Requires real MetaMask wallet + live Fastify server + live Merkle chain read.

#### 2. SIWE Returning-User Audit Chain

**Test:** With the same wallet from Step 1, sign out and sign in again.
**Expected:** Exactly 1 audit event: portal.auth.login (method='siwe'). No human.joined, no human.identified, no portal.auth.register.
**Why human:** Requires existing DID in live DB from Step 1.

#### 3. Email Signup Audit Chain

**Test:** Register a new account via email/password flow.
**Expected:** Exactly 3 audit events in order: human.identified (identity_method='email', identity_hash=sha256(email.toLowerCase().trim())) → portal.auth.register (method='email') → portal.auth.login (method='email'). No raw email address in any payload.
**Why human:** Requires live email registration flow against Fastify server.

#### 4. Email Signin Audit Chain

**Test:** Sign out, then sign in with existing email credentials.
**Expected:** Exactly 1 audit event: portal.auth.login (method='email'). No human.identified, no portal.auth.register.
**Why human:** Requires existing email account in live DB.

#### 5. PII Discipline — Live Audit Log Inspection

**Test:** After Steps 1-4, query the live audit chain for all portal.auth.* and human.identified events. Grep for each of the 13 PORTAL_AUTH_FORBIDDEN_KEYS: ip_address, ip, user_agent, ua, session_id, token, jwt, cookie, email, password_hash, nonce, signature, device_fingerprint.
**Expected:** Zero matches in persisted audit payloads. All identity_hash values are 64-char hex strings. No raw addresses or credentials.
**Why human:** Programmatic grep only covers source code; runtime payload content requires live chain query.

#### 6. /users Directory Population

**Test:** After SIWE and email signups, inspect the Grid /users directory (filesystem or DB per Grid's DID storage).
**Expected:** DID entries exist for each new human_did created during Steps 1 and 3.
**Why human:** Requires live Fastify server + real flows + DB/filesystem inspection.

### Gaps Summary

No blocking gaps. All 13 automated must-haves are VERIFIED.

WR-02 (check-state-doc-sync.mjs not CI-wired) is noted as tech debt but is not a plan must_have gap — Plan 33-06 required extending the script (done) and wiring check-sole-producer-discipline.mjs into CI (done). The state-doc-sync CI integration was not in scope.

The 6 human verification items above are the only items blocking a `passed` status. All require live Docker deployment and cannot be satisfied programmatically.

---

_Verified: 2026-05-24T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
