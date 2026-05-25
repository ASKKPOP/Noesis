---
phase: 33
plan: "05"
subsystem: portal-auth / audit
tags: [tests, producer-discipline, forbidden-keys, wiring, perf-benchmark, r-33-01, r-33-02, r-33-03]
requirements: [OBS-08, OBS-09, OBS-08b, OBS-10]

dependency-graph:
  requires:
    - 33-03 (sole-producer files: appendPortalAuthLogin, appendPortalAuthRegister, appendHumanIdentified)
    - 33-04 (wiring into portal/auth.ts — call sequences mirrored by portal-auth-wiring.test.ts)
  provides:
    - Test coverage for all Phase 33 producer discipline invariants
    - R-33-01 word-boundary regression suite (33 cases)
    - R-33-02 soft-log perf benchmark (100k seed, guarded)
    - R-33-03 register vs login asymmetry pinned
  affects:
    - CI: all 6 test files run in vitest run (non-watch)
    - Future planners: compound-form pass-through behavior is now pinned; any regex tightening must update these tests

tech-stack:
  added: []
  patterns:
    - Direct producer invocation against in-process AuditChain (no Fastify, no HTTP)
    - NOESIS_RUN_PERF env-var gate for heavy benchmark (100k seed)
    - it.each() for parameterized sweep across 6 word-bounded and 7 short keys
    - Soft-log perf (performance.now, console.log, no expect().toBeLessThan()) per D-33-C1

key-files:
  created:
    - grid/test/human-identified.test.ts
    - grid/test/portal-auth-forbidden-keys.test.ts
    - grid/test/portal-auth-wiring.test.ts
    - grid/src/__tests__/audit-query-perf.test.ts
  modified: []

decisions:
  - "Corrected D-33-B4 false claim: CONTEXT.md originally claimed \\buser_agent\\b would match user_agent_version. It does not — JS regex \\b requires a \\W boundary, and _ is \\w. Compound forms (user_agent_version, ip_address_v6, session_id_legacy, jwt_issuer, device_fingerprint_id) all PASS the regex. This is pinned in portal-auth-forbidden-keys.test.ts as pass-through assertions."
  - "Corrected plan spec for email/nonce: the plan's forbidden-keys test originally asserted payloadPrivacyCheck({ email }).ok === false. That is wrong — email is NOT in FORBIDDEN_KEY_PATTERN (excluded per D-33-B4 over-match rationale). The test correctly pins email/nonce/signature/ip/ua/token/cookie as ALLOWED by the regex layer (caught only at the producer closed-tuple boundary instead)."
  - "Wiring test uses direct producer invocation, not Fastify boot. D-33-A4/A5/A6 require emit-count and emit-order discipline, not HTTP-layer integration. SIWE crypto is covered by Phase 22 tests."
  - "Perf benchmark gated by NOESIS_RUN_PERF=1 env var — skips by default in CI per feedback_parallel_worktrees_vitest.md + T-33-TEST-PERF-01."

metrics:
  duration: "~10 minutes"
  completed: "2026-05-24"
  tasks: 4
  files: 4
---

# Phase 33 Plan 05: Producer-Discipline Test Suite Summary

Continuation agent executed the remaining 4 test files after the prior agent created `portal-auth-login.test.ts` and `portal-auth-register.test.ts` (already committed at `22caa5d`).

## One-liner

74 tests across 6 files lock Phase 33 producer discipline, forbidden-key word-boundary semantics, D-33-A4/A5/A6 emit-count/order via direct producer invocation, and soft-log perf benchmark — all with two factual corrections to the plan's original test spec.

## What Shipped

### Task 1 (continuation): grid/test/human-identified.test.ts — 12 tests

Sole-producer discipline for `appendHumanIdentified` (OBS-08b). Happy path × 2 (SIWE + email), IDENTITY_METHOD_ENUM check, plus 9 guard-rejection cases:

- Invalid DID (regex guard)
- Non-HEX64 identity_hash — too short (63 chars)
- Non-HEX64 identity_hash — non-hex character ('g')
- Invalid identity_method enum ('passkey' rejected)
- Empty grid_name
- Negative tick
- Extra key (closed-tuple structural check)
- Missing key (identity_hash absent)
- Null payload (type guard)

### Task 2: grid/test/portal-auth-forbidden-keys.test.ts — 33 tests

R-33-01 mitigation. 33 test cases covering:

**6 word-bounded keys** (rejected by FORBIDDEN_KEY_PATTERN regex):
- `ip_address`, `user_agent`, `session_id`, `jwt`, `password_hash`, `device_fingerprint`

**7 short keys** (NOT in FORBIDDEN_KEY_PATTERN — caught at closed-tuple producer boundary):
- `email`, `nonce`, `signature`, `ip`, `ua`, `token`, `cookie`
- Pinned as ALLOWED by the regex layer (deviation from plan spec — see Deviations section)

**Compound-form pass-through pins** (JS `\b` semantics — `_` is `\w`, no boundary fires):
- `user_agent_version` → ALLOWED
- `ip_address_v6` → ALLOWED
- `session_id_legacy` → ALLOWED
- `jwt_issuer` → ALLOWED
- `device_fingerprint_id` → ALLOWED

**Nested walker cases**: object depth 1, array, 3-level deep nesting.

**PORTAL_AUTH_FORBIDDEN_KEYS sweep**: 13-key count assertion + content assertion.

### Task 3: grid/test/portal-auth-wiring.test.ts — 8 tests

D-33-A4/A5/A6 emit-count + emit-order via direct producer invocation (NO Fastify, NO HTTP, NO SIWE crypto):

- **SIWE first-connect**: chain.length === 4; order: joined → identified → register → login
- **D-33-A4 correlation**: identity_hash byte-identical to eth_address_hash
- **SIWE repeat-connect**: chain.length === 1; only `portal.auth.login`
- **Email signup**: chain.length === 3; order: identified → register → login
- **Email identity_hash**: sha256(email.toLowerCase().trim()) pinned
- **Email signin**: chain.length === 1; only `portal.auth.login`
- **R-33-03 first-connect**: BOTH register AND login present
- **R-33-03 repeat-connect**: ONLY login, zero registers

### Task 4: grid/src/__tests__/audit-query-perf.test.ts — 1 test (guarded)

R-33-02 soft-log perf benchmark:
- Seeds 100,000 entries across 5 event types × 3 actor DIDs
- Runs 100 `chain.query({ eventType, actorDid })` calls
- Computes and logs p50/p95/p99 via `console.log` only
- **Zero** `expect().toBeLessThan()` calls — D-33-C1 invariant preserved
- Guarded by `NOESIS_RUN_PERF=1` env var; skips in CI by default
- 60s timeout for slow machines

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected email/nonce test assertions in portal-auth-forbidden-keys.test.ts**

- **Found during:** Task 2 — ran `node -e "..."` to verify actual regex behavior
- **Issue:** The plan spec asserted `payloadPrivacyCheck({ email: 'user@example.com' }).ok === false` and `payloadPrivacyCheck({ nonce: 'abc' }).ok === false`. Runtime testing confirmed both return `ok: true` — neither `email` nor `nonce` are in `FORBIDDEN_KEY_PATTERN` (they were intentionally excluded per D-33-B4 to avoid over-matching `email_hash`, `nonce_hash`, etc.).
- **Fix:** Rewrote these tests to assert `ok === true` and added an explanatory comment documenting that these keys are caught at the producer closed-tuple boundary instead. Also confirmed `signature`, `ip`, `ua`, `token`, `cookie` are similarly ALLOWED at the regex layer.
- **Also fixed:** Added a `it.each` covering all 7 short keys to pin the behavior, and changed the plan's `it.each(PORTAL_AUTH_FORBIDDEN_KEYS)` which would have incorrectly asserted all 13 keys fail the regex check — instead, split into two separate `it.each` blocks (6 word-bounded + 7 short keys).
- **Files modified:** `grid/test/portal-auth-forbidden-keys.test.ts`
- **Commit:** `76a47c6`

**2. [Rule 1 - Bug] D-33-B4 compound-form claim corrected**

- **Found during:** Task 2 (runtime verification)
- **Issue:** The original CONTEXT.md D-33-B4 spec (as quoted in the plan) claimed `\buser_agent\b` would match `user_agent_version`. This is factually wrong — JS regex `\b` does not fire between word characters, and `_` is `\w`. `node -e "console.log(/\b(?:user_agent)\b/i.test('user_agent_version'))"` returns `false`.
- **Fix:** Tests assert compound forms as ALLOWED (pass-through), pinning the correct JS regex semantics. Added comments explaining the corrected understanding.
- **This matches** the plan's note under Task 2 "Important correctness note (corrected during revision iter 1)" — the correction was already acknowledged in the plan, so tests needed to reflect it accurately.
- **Files modified:** `grid/test/portal-auth-forbidden-keys.test.ts`
- **Commit:** `76a47c6`

## Known Stubs

None. All test files use real `new AuditChain()` instances with no mocks, no hardcoded empty return values, and no placeholder data. The perf test early-returns via env-var guard (not a stub — the guard is intentional and documented).

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes. All files are test-only.

---

## Self-Check: PASSED

Files created:
- FOUND: grid/test/human-identified.test.ts
- FOUND: grid/test/portal-auth-forbidden-keys.test.ts
- FOUND: grid/test/portal-auth-wiring.test.ts
- FOUND: grid/src/__tests__/audit-query-perf.test.ts

Commits verified:
- FOUND: 22caa5d (prior agent — login + register tests)
- FOUND: 76a47c6 (this agent — 4 remaining test files)

Test results: 74 tests across 6 files, all passing under `vitest run`.

Acceptance criteria verified:
- human-identified.test.ts: 127 lines (target 100-160) ✓, 12 tests ✓
- portal-auth-forbidden-keys.test.ts: 145 lines (target 80-220) ✓, 33 tests ✓
- portal-auth-wiring.test.ts: 172 lines (target 120-220) ✓, 8 tests ✓
- audit-query-perf.test.ts: 70 lines (target 30+) ✓, NOESIS_RUN_PERF guard ✓
- No `expect(...).toBeLessThan(...)` assertion calls in perf file ✓
- No Fastify/buildServerWithHub/app.inject in wiring file ✓
- No vi.fn() mocks for AuditChain (all use real instances) ✓
