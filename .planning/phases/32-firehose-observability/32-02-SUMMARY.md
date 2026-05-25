---
phase: 32
plan: 02
subsystem: grid/audit
tags: [observability, firehose, regression, r-32-03]
requirements: [OBS-05]

dependency_graph:
  requires:
    - Plan 01 (WsFirehoseHub.stats() + ClientConnection.trySend with D-32-A3 placement)
  provides:
    - R-32-03 regression test pinning counter placement contract
    - T-32-03 threat mitigation (tampering via silent counter regression)
  affects:
    - grid/test/firehose-send-throws.test.ts (new — regression pin)

tech_stack:
  added: []
  patterns:
    - Pin-by-test discipline (mirrors Phase 31 audit-reconcile.test.ts pattern)
    - Self-contained FakeSocket with throwOnSend flag (no shared helpers)
    - three-test regression structure: zero-count, multi-client isolation, panic safety

key_files:
  modified: []
  created:
    - grid/test/firehose-send-throws.test.ts

decisions:
  - "hello frame (direct socket.send in onConnect, not trySend) correctly excluded from frames_sent_total counter — test 2 assertion is frames_sent_total===1 (one event via good client trySend), not 2 as plan description suggested (plan description counted hello as a trySend, which is wrong)"
  - "FakeSocket is self-contained (copied verbatim pattern, not imported) — matches existing firehose-hub.test.ts convention (D-32-D2)"
  - "Three test cases cover all three R-32-03 regression scenarios: (1) single bad client counter stays 0, (2) multi-client isolation with correct counter, (3) 50-event panic safety"

metrics:
  duration: ~6 minutes
  completed: "2026-05-25T00:20:00Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 0
  files_created: 1
---

# Phase 32 Plan 02: R-32-03 Send-Throws Regression Test Summary

Dedicated regression file `grid/test/firehose-send-throws.test.ts` pinning the D-32-A3 counter placement contract: `frames_sent_total++` AFTER `socket.send` succeeds, BEFORE the catch — a throwing socket never increments the counter.

## What Was Built

**`grid/test/firehose-send-throws.test.ts` — created**

Three vitest test cases (all pass GREEN):

1. **Single bad client — counter stays 0**: `throwOnSend = true` client connects (hello via direct `socket.send` throws but hub swallows). One allowlisted `nous.moved` event appended — `ClientConnection.trySend` throws inside its try block, catch swallows, counter never reached. `frames_sent_total === 0` throughout.

2. **Multi-client isolation**: bad + good client connected. Good client receives hello (direct `socket.send`, not counted) and the broadcast event (via `trySend`, counted). Bad client's `trySend` throws — swallowed. Counter is exactly 1 (one successful `trySend` to good client). `client_count === 2` (bad client stays in set until close event fires). Good client's `sent.length` increments; bad client's stays at 0.

3. **50-event panic safety**: single `throwOnSend = true` client survives 50 sequential `audit.append` calls — no thrown errors, no unhandled rejections. `frames_sent_total === 0`, `client_count === 1` (client remains until socket fires close).

## Counter Placement Contract Pinned (R-32-03)

The tests enforce: if a future refactor moves `incrementSent()` to BEFORE `socket.send` (or outside the try/catch entirely), Test 1 and Test 2 turn RED immediately. This is the T-32-03 threat mitigation.

```
trySend():
  try {
    socket.send(...)       ← if this throws → catch runs → counter unreachable
    incrementSent()        ← D-32-A3: ONLY after successful send
    touchLastFrame()
  } catch {
    // swallow
  }
```

## hello Frame Exclusion Confirmed

The hello frame in `onConnect` is sent via direct `socket.send(...)` (not via `ClientConnection.trySend`), so it does NOT increment `frames_sent_total`. This is confirmed in Plan 01 decisions and verified by the test structure: `frames_sent_total === 0` immediately after `hub.onConnect(goodSock)` (good hello succeeded but counter not incremented by the hello path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 2 counter expectation corrected: hello excluded, final count is 1 not 2**

- **Found during:** Task 1 (reading Plan 01 SUMMARY before writing)
- **Issue:** The plan's `<behavior>` block for Test 2 said: "good client gets 2 successful sends (hello + event) → total `frames_sent_total === 2`". The plan also showed `expect(hub.stats().frames_sent_total).toBe(1)` after `hub.onConnect(goodSock)`. Both are wrong — the hello frame goes through direct `socket.send` in `onConnect` (not `ClientConnection.trySend`), so it does NOT increment the counter. Confirmed by Plan 01 SUMMARY "decisions" section: "hello frame (direct socket.send in onConnect) is NOT routed through trySend — frames_sent_total starts at 0 after connect".
- **Fix:** Test 2 asserts `frames_sent_total === 0` after both connects, and `frames_sent_total === 1` after the broadcast event (only the good client's event goes through `trySend`). This is the correct counter semantics per D-32-A3.
- **Files modified:** `grid/test/firehose-send-throws.test.ts`
- **Commit:** 6a9db2c (same task commit — discovered before writing, not after)

## Verification Results

```
cd grid && npx vitest run test/firehose-send-throws.test.ts    ✓ 3/3 pass

Acceptance criteria:
  File exists                                                   ✓
  'R-32-03 send-throws regression' exactly once                ✓ (count=1)
  test description 'frames_sent_total stays 0...' exactly once ✓ (count=1)
  test description 'other clients continue...' exactly once    ✓ (count=1)
  test description 'hub survives 50 sequential...' exactly once ✓ (count=1)
  throwOnSend = true (at least 3 occurrences)                  ✓ (count=3)
  not.toThrow() (at least 3 occurrences)                       ✓ (count=3)
```

## Known Stubs

None — test file is complete with all three R-32-03 regression cases wired to real `AuditChain` and `WsFirehoseHub`.

## Threat Flags

None — no new production code, no new network endpoints or trust boundaries introduced. Test file only.

## Self-Check: PASSED

- FOUND: grid/test/firehose-send-throws.test.ts
- FOUND: commit 6a9db2c (test(32-02): add R-32-03 regression — send-throws counter placement pin)
