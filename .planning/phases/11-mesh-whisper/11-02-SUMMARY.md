---
phase: "11"
plan: "02"
subsystem: whisper
tags: [whisper, sole-producer, rate-limit, pending-store, router, nous-runner]
dependency_graph:
  requires:
    - "11-01: libsodium Envelope crypto"
    - "10b-07: bios.death lifecycle events"
    - "audit/broadcast-allowlist.ts: nous.whispered allowlisted"
  provides:
    - "appendNousWhispered.ts: sole producer for nous.whispered"
    - "TickRateLimiter: tick-indexed per-sender rate limiter"
    - "PendingStore: in-memory recipient queue with bios.death GC"
    - "WhisperRouter: locked 5-step side-effect orchestrator"
    - "nous-runner.ts: whisper_send case handler"
  affects:
    - "grid/src/integration/nous-runner.ts"
    - "grid/src/integration/types.ts"
    - "grid/test/bios/bios-producer-boundary.test.ts"
tech_stack:
  added:
    - "appendNousWhispered.ts (sole-producer pattern, 8+3 step validation)"
    - "TickRateLimiter (Map<string, number[]> tick-history, window pruning)"
    - "PendingStore (Map<string,Envelope[]>, onAppend bios.death subscription)"
    - "WhisperRouter (locked 5-step side-effect order per D-30)"
  patterns:
    - "Sole-producer boundary enforced via grep test (3-describe clone of bios pattern)"
    - "Closed-tuple validation (exact 4-key set, no extras allowed)"
    - "Tombstone silent-drop (D-11-18: no audit, no log, no 410)"
    - "whisperPrivacyCheck: exact-key matching avoids ciphertext_hash/text substring collision"
key_files:
  created:
    - grid/src/whisper/appendNousWhispered.ts
    - grid/src/whisper/rate-limit.ts
    - grid/src/whisper/pending-store.ts
    - grid/src/whisper/router.ts
    - grid/test/whisper/whisper-wire-format.test.ts
    - grid/test/whisper/whisper-rate-limit.test.ts
    - grid/test/whisper/whisper-router.test.ts
    - grid/test/whisper/whisper-tombstone.test.ts
  modified:
    - grid/src/whisper/types.ts (envelope_id field added)
    - grid/src/integration/types.ts (BrainActionWhisperSend + union)
    - grid/src/integration/nous-runner.ts (whisperRouter injection + case handler)
    - grid/test/bios/bios-producer-boundary.test.ts (KNOWN_CONSUMERS_DEATH whitelist)
decisions:
  - "whisperPrivacyCheck uses exact-key matching (not substring) to avoid false-positive on ciphertext_hash containing 'text'"
  - "Closed-tuple check runs second (after actorDid DID_RE, before individual field DID checks) to give correct error for missing keys"
  - "envelope_id added to Envelope type as Rule 2 fix — required for PendingStore.ackDelete dedup"
  - "PendingStore evictDid on bios.death: clears recipient queue AND scrubs from_did across all queues"
  - "whisperRouter injected optionally into NousRunnerConfig (mirrors reviewer pattern)"
metrics:
  duration: "~90 min"
  completed: "2026-04-23"
  tasks_completed: 6
  files_created: 8
  files_modified: 4
---

# Phase 11 Plan 02: Emitter + Router Summary

**One-liner:** Grid-side whisper production pipeline: sole-producer emitter with 8+3 validation, tick-indexed rate limiter, in-memory PendingStore with bios.death GC, WhisperRouter with locked 5-step side-effect order, whisper_send dispatch in NousRunner.

## What Was Built

### Task 1 — appendNousWhispered.ts (sole producer)

Commit: `305ee2c`

`grid/src/whisper/appendNousWhispered.ts` implements the ONLY file allowed to call `audit.append('nous.whispered', ...)`. Clones the `appendBiosBirth.ts` discipline with 8+3 validation steps:

1. actorDid DID_RE check
2. Closed-tuple check (exactly the 4 keys: from_did, to_did, tick, ciphertext_hash)
3. from_did DID_RE
4. to_did DID_RE
5. Self-report check (actorDid must equal from_did)
6. Self-whisper check (from_did != to_did)
7. tick >= 1
8. ciphertext_hash HEX64_RE
9. Explicit cleanPayload construction (4 keys only)
10. whisperPrivacyCheck (exact-key matching against WHISPER_FORBIDDEN_KEYS)
11. audit.append

Flipped `whisper-wire-format.test.ts` from RED stub to 19-test GREEN.

### Task 2 — TickRateLimiter (tick-indexed rate limit)

Commit: `2c4017f`

`grid/src/whisper/rate-limit.ts` implements `TickRateLimiter` with `Map<senderDid, number[]>` history. `tryConsume(senderDid, currentTick)` prunes entries where `t <= currentTick - rateWindowTicks`, then rejects if count >= budget. Default config: B=10/N=100. Zero wall-clock access.

Flipped `whisper-rate-limit.test.ts` from RED stub to 17-test GREEN (complete replacement — original stub used incompatible `check/record` API).

### Task 3 — PendingStore (in-memory queue with bios.death GC)

Commit: `c6ad444`

`grid/src/whisper/pending-store.ts` implements in-memory `Map<recipientDid, Envelope[]>`. Constructor subscribes to `audit.onAppend`; on `bios.death` calls `evictDid(entry.payload.did)`. `evictDid` clears the recipient queue AND scrubs `from_did` across all queues (cross-recipient sender GC). Zero persistence dependencies.

### Task 4 — WhisperRouter (locked side-effect order)

Commit: `522e570`

`grid/src/whisper/router.ts` implements the locked 5-step order (D-30):

1. Validate DIDs (throws on failure)
2. Tombstone-check sender (silent drop → false)
3. Tombstone-check recipient (silent drop → false)
4. Rate-limit check (silent drop → false)
5. audit.append via appendNousWhispered → pendingStore.enqueue

Created `whisper-router.test.ts` (7 tests: happy path with invocationCallOrder verification, rate-limit drop, validation throws, PendingStore round-trip) and `whisper-tombstone.test.ts` (10 tests: sender tombstoned, recipient tombstoned, bios.death GC, post-death whisper — all asserting zero `nous.whispered` events and zero console output on silent drop).

### Task 5 — BrainActionWhisperSend + NousRunner dispatch

Commit: `81f1350`

Added `BrainActionWhisperSend` interface to `grid/src/integration/types.ts` and extended the `BrainAction` union. Added optional `whisperRouter?: WhisperRouter` to `NousRunnerConfig` with injection into `executeActions`. The `case 'whisper_send':` handler calls `router.route(action.envelope, tick)` and logs validation errors via `console.error` (structured JSON).

### Task 6 — Integration sweep + bios.death consumer whitelist

Commit: `19a3ced`

`bios-producer-boundary.test.ts` was failing because `pending-store.ts` references the literal `'bios.death'` string for its event listener. Fixed by adding `KNOWN_CONSUMERS_DEATH = ['whisper/pending-store.ts']` to the test's allowlist.

Full suite: 113 test files, 1059 tests — all pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] envelope_id added to Envelope type**
- **Found during:** Task 3 (PendingStore.ackDelete design)
- **Issue:** `PendingStore.ackDelete` requires per-envelope dedup ID but `Envelope` type had no `envelope_id` field
- **Fix:** Added `readonly envelope_id: string` to `grid/src/whisper/types.ts`
- **Files modified:** `grid/src/whisper/types.ts`
- **Commit:** `305ee2c`

**2. [Rule 1 - Bug] whisperPrivacyCheck uses exact-key matching**
- **Found during:** Task 1 test development
- **Issue:** Global `FORBIDDEN_KEY_PATTERN` uses substring matching; `ciphertext_hash` key contains `text` which matched the forbidden `text` pattern, causing a false positive that blocked all valid whisper payloads
- **Fix:** Created `whisperPrivacyCheck` function using exact key matching against `WHISPER_FORBIDDEN_KEYS` array
- **Files modified:** `grid/src/whisper/appendNousWhispered.ts`
- **Commit:** `305ee2c`

**3. [Rule 1 - Bug] Closed-tuple check ordering**
- **Found during:** Task 1 test development
- **Issue:** Individual field DID checks ran before the closed-tuple check, so missing keys gave "invalid DID" error instead of "unexpected key set" error
- **Fix:** Moved closed-tuple check to run second (after actorDid DID_RE, before individual field checks)
- **Files modified:** `grid/src/whisper/appendNousWhispered.ts`
- **Commit:** `305ee2c`

**4. [Rule 3 - Blocking] Rate-limit RED stub API mismatch**
- **Found during:** Task 2
- **Issue:** Existing `whisper-rate-limit.test.ts` RED stub expected `RateLimiter` class with `check()/record()` API; new implementation uses `TickRateLimiter` with `tryConsume()/reset()` API — incompatible
- **Fix:** Replaced RED stub entirely with new 17-test GREEN suite matching the `TickRateLimiter` API
- **Files modified:** `grid/test/whisper/whisper-rate-limit.test.ts`
- **Commit:** `2c4017f`

**5. [Rule 1 - Bug] bios.death sole-producer test false positive**
- **Found during:** Task 6 (integration sweep)
- **Issue:** `bios-producer-boundary.test.ts` found `whisper/pending-store.ts` as an unexpected `bios.death` string occurrence — it references the event name for filtering but never emits it
- **Fix:** Added `KNOWN_CONSUMERS_DEATH = ['whisper/pending-store.ts']` whitelist with explanatory comment
- **Files modified:** `grid/test/bios/bios-producer-boundary.test.ts`
- **Commit:** `19a3ced`

## Test Results

| Test File | Tests | Status |
|-----------|-------|--------|
| whisper-wire-format.test.ts | 19 | GREEN |
| whisper-rate-limit.test.ts | 17 | GREEN |
| whisper-producer-boundary.test.ts | 4 | GREEN |
| whisper-router.test.ts | 7 | GREEN |
| whisper-tombstone.test.ts | 10 | GREEN |
| whisper-crypto.test.ts | 30 | GREEN (pre-existing) |
| whisper-keyring.test.ts | 9 | GREEN (pre-existing) |
| **All grid tests** | **1059** | **GREEN** |

## Known Stubs

None. All whisper production code is wired end-to-end. The `whisperRouter` field in `NousRunnerConfig` is optional (undefined in deployments that haven't wired it yet) — this is intentional, not a stub.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: sole-producer | grid/src/whisper/appendNousWhispered.ts | New audit event path for nous.whispered — covered by producer-boundary grep test |
| threat_flag: silent-drop | grid/src/whisper/router.ts | Tombstone silent-drop on sender/recipient — D-11-18 compliant, no liveness leak |

## Self-Check: PASSED

- `grid/src/whisper/appendNousWhispered.ts` — FOUND
- `grid/src/whisper/rate-limit.ts` — FOUND
- `grid/src/whisper/pending-store.ts` — FOUND
- `grid/src/whisper/router.ts` — FOUND
- `grid/src/integration/nous-runner.ts` — FOUND (whisper_send case)
- `grid/src/integration/types.ts` — FOUND (BrainActionWhisperSend)
- All 1059 tests GREEN (verified via `npm test`)
- Commits: 305ee2c, 2c4017f, c6ad444, 522e570, 81f1350, 19a3ced
