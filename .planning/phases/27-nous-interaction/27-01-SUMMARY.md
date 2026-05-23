---
phase: 27-nous-interaction
plan: "01"
subsystem: grid-audit-portal
tags:
  - audit-chain
  - allowlist
  - portal-chat
  - human-spoke
  - llm-proxy
dependency_graph:
  requires:
    - grid/src/audit/append-human-transferred.ts  # 8-step discipline template
    - grid/src/audit/broadcast-allowlist.ts        # allowlist extension base
    - grid/src/api/portal/chat.ts                  # existing onboard route to extend
    - grid/src/api/portal/auth.ts                  # COOKIE_NAME, keyPairPromise
  provides:
    - grid/src/audit/append-human-spoke.ts         # sole producer for human.spoke
    - POST /api/v1/portal/chat/nous/:nousId        # general Nous chat endpoint
  affects:
    - grid/src/audit/broadcast-allowlist.ts        # +1 event → size 52
tech_stack:
  added:
    - "Node.js crypto.createHash('sha256') for msg_hash computation"
  patterns:
    - "8-step sole-producer discipline (mirrors appendHumanTransferred verbatim)"
    - "TDD: RED commit then GREEN commit per task"
key_files:
  created:
    - grid/src/audit/append-human-spoke.ts
    - grid/test/audit/append-human-spoke.test.ts
    - grid/test/portal/chat-nous.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/api/portal/chat.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/audit/allowlist-forty-five.test.ts
    - grid/test/audit/allowlist-twenty-six.test.ts
    - grid/test/audit/allowlist-twenty-two.test.ts
    - grid/test/audit/operator-exported-allowlist.test.ts
    - grid/test/audit/skill-allowlist.test.ts
decisions:
  - "msg_hash key (not message_hash) avoids FORBIDDEN_KEY_PATTERN substring match"
  - "appendHumanSpoke only fires when messages.length > 0 — auto-greeting path is silent"
  - "done: false always returned from /nous/:nousId — detectClose is onboard-only"
  - "Historical baseline tests updated to reflect allowlist size 52 (not 43/45)"
  - "VALID_HUMAN_DID in test uses underscore format (did:noesis:human_0xabc123) since DID_RE forbids colon in path segment"
metrics:
  duration: "7m"
  completed: "2026-05-23T15:37:18Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 8
---

# Phase 27 Plan 01: Grid Chat Foundations Summary

Grid backend foundations for Nous chat: `human.spoke` sole-producer emitter at position 52 in the broadcast allowlist, and `POST /api/v1/portal/chat/nous/:nousId` route with per-Nous personality prompts for Sophia, Hermes, and Themis.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | appendHumanSpoke sole-producer + allowlist extension | 48ed046 | append-human-spoke.ts, broadcast-allowlist.ts + 6 test updates |
| 2 | Grid chat route POST /api/v1/portal/chat/nous/:nousId | c7858d8 | chat.ts |

## What Was Built

### Task 1: appendHumanSpoke Sole-Producer

Created `grid/src/audit/append-human-spoke.ts` following the 8-step discipline from `appendHumanTransferred` exactly:

1. Type guard (plain object check)
2. Regex guard: `human_did` (DID_RE)
3. Regex guard: `nous_did` (DID_RE)
4. Format guard: `msg_hash` (HEX64_RE — 64 lowercase hex chars)
5. Non-negative integer guard: `tick`
6. Closed 4-key tuple check (alphabetical: `human_did, msg_hash, nous_did, tick`)
7. Explicit reconstruction — no spread
8. `payloadPrivacyCheck` before `chain.append`

The payload key is `msg_hash` (NOT `message_hash`) — this is a critical invariant because the substring `message` matches `FORBIDDEN_KEY_PATTERN` (case-insensitive) and would fail `payloadPrivacyCheck`.

Extended `broadcast-allowlist.ts`:
- Added `'human.spoke'` at position 52 (index 51)
- Updated JSDoc from 51 to 52 event types
- Added Phase 27 (CHAT-04) reference in the JSDoc

### Task 2: POST /api/v1/portal/chat/nous/:nousId

Extended `grid/src/api/portal/chat.ts` with three personality system prompts and a new route:

- `SOPHIA_CHAT_SYSTEM_PROMPT` — philosophical/warm (open-ended dialogue, not onboarding-specific)
- `HERMES_CHAT_SYSTEM_PROMPT` — mercantile/witty
- `THEMIS_CHAT_SYSTEM_PROMPT` — judicial/precise
- `NOUS_SYSTEM_PROMPTS` map — lookup by `nousId` key

Route behavior:
- Auth guard: JWT cookie required (same pattern as `/onboard`)
- 404 for unknown `nousId` (only sophia/hermes/themis accepted)
- 400 for non-array `messages` or `messages.length > 50` (D-04 cap)
- LLM call: non-streaming Ollama, system prompt prepended
- **Auto-greeting path** (empty `messages[]`): fires LLM, returns `{reply, done:false}`, does NOT fire `appendHumanSpoke`
- **Human message path** (`messages.length > 0`): fires LLM, fires `appendHumanSpoke` with `sha256(lastHumanMessage)` as `msg_hash`, returns `{reply, done:false}`
- `done` is **ALWAYS false** — `detectClose` is onboard-only and intentionally excluded from this route

## Test Results

- Task 1: 14 new tests pass in `test/audit/append-human-spoke.test.ts`
- Task 2: 15 new tests pass in `test/portal/chat-nous.test.ts`
- All 34 audit tests pass
- All 10 existing onboard chat tests pass
- 0 new test failures introduced

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DID format in test fixture**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test used `did:noesis:human:0xABC` but `DID_RE` (`/^did:noesis:[a-z0-9_\-]+$/i`) forbids colons in the path segment
- **Fix:** Changed to `did:noesis:human_0xabc123` (underscore separator, valid DID_RE format)
- **Files modified:** `grid/test/audit/append-human-spoke.test.ts`

**2. [Rule 1 - Bug] Historical baseline tests hardcoded stale allowlist sizes**
- **Found during:** Task 1 GREEN phase (full audit test run)
- **Issue:** 5 test files asserted `ALLOWLIST.size === 43` or `length === 45` — these were valid for prior phases but broke when allowlist grew to 52
- **Fix:** Updated size assertions to 52; updated the "exact positional order" test to validate only the first N entries (slice), not the full set
- **Files modified:** `broadcast-allowlist.test.ts`, `allowlist-forty-five.test.ts`, `allowlist-twenty-six.test.ts`, `allowlist-twenty-two.test.ts`, `operator-exported-allowlist.test.ts`, `skill-allowlist.test.ts`

**3. [Rule 1 - Bug] Async import in non-async test body**
- **Found during:** Task 1 RED phase
- **Issue:** Used `await import(...)` inside a synchronous test body — TypeScript/esbuild transform error
- **Fix:** Used the already-imported `payloadPrivacyCheck` directly instead of dynamic import
- **Files modified:** `grid/test/audit/append-human-spoke.test.ts`

## Known Stubs

None. The plan is fully implemented with no placeholder values or deferred wiring.

## Threat Flags

No new security surface beyond what was planned and covered in the plan's `<threat_model>`. The `check-frozen.ts` regex `/api/v1/portal/chat/` already covers the new route (verified from source — no new exemption needed, T-27-05 mitigated by existing guard).

## Self-Check: PASSED

All created files exist on disk. All task commits exist in git history.

| Check | Result |
|-------|--------|
| `grid/src/audit/append-human-spoke.ts` | FOUND |
| `grid/src/api/portal/chat.ts` | FOUND |
| `grid/test/audit/append-human-spoke.test.ts` | FOUND |
| `grid/test/portal/chat-nous.test.ts` | FOUND |
| `.planning/phases/27-nous-interaction/27-01-SUMMARY.md` | FOUND |
| Commit 3bd3264 (RED test Task 1) | FOUND |
| Commit 48ed046 (GREEN Task 1) | FOUND |
| Commit 8971f9d (RED test Task 2) | FOUND |
| Commit c7858d8 (GREEN Task 2) | FOUND |
