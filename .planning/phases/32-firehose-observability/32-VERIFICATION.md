---
phase: 32-firehose-observability
verified: 2026-05-25T17:45:00Z
status: human_needed
score: 13/13 automated must-haves verified
overrides_applied: 1
overrides:
  - must_have: "HealthWatchdog is a readonly field on GenesisLauncher with explicit stop() in launcher.stop()"
    reason: "CONTEXT.md D-32-B1 (pure-pull design, no setInterval) + D-32-G2 (one-shot-settable via attachHealthWatchdog) intentionally deviate from the ROADMAP R-32-02 literal wording. HealthWatchdog has no timer, so stop() would be a no-op. R-32-02 CI gate is satisfied trivially: zero setInterval calls exist in scanned dirs. CONTEXT.md explicitly documents this deviation as accepted (D-32-G2 trade-off). The set-once-throw-on-second-call semantics preserve immutability intent without the readonly keyword."
    accepted_by: "design-phase (32-CONTEXT.md D-32-B1 + D-32-G2)"
    accepted_at: "2026-05-24T00:00:00Z"
human_verification:
  - test: "Execute 32-HUMAN-UAT.md Steps 0-5 against a rebuilt Docker Grid container"
    expected: "All 6 sign-off rows checked [x]: Step 0 audit_reconcile_ok heartbeat fires, Step 1 /health/detailed returns full 5-key OBS-06 payload with status=ok, Step 2 frames_sent_total strictly increases across two 5s-apart polls with a connected client, Step 3 ws.terminate() half-close increments frames_dropped_total without frames_sent_total advancing on the offending client, Step 4 docker stop noesis-mysql flips status to degraded within 60s and recovery returns to ok within 60s with health_status_changed log lines, Step 5 ab p95 <50ms over 1000 requests"
    why_human: "Live WorldClock cadence, real Docker compose MySQL lifecycle, real HTTP stack p95 latency, and WebSocket half-close socket behavior cannot be reliably exercised inside vitest. These are production-environment verifications requiring the deployed Docker container."
---

# Phase 32: Firehose Observability Verification Report

**Phase Goal:** Make "tick advances but zero frames delivered" impossible to go unnoticed for >60 seconds. Add frame counters to WsFirehoseHub, expose pipeline health via GET /health/detailed, ship a pure-pull HealthWatchdog.
**Verified:** 2026-05-25T17:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | WsFirehoseHub.stats() returns FirehoseStats with all 5 fields populated | VERIFIED | `grid/src/audit/firehose-hub.ts` exports `FirehoseStats` interface with 5 readonly fields; `stats()` method at line 188 returns snapshot from private `metrics` object |
| 2 | frames_sent_total increments AFTER socket.send, BEFORE catch (R-32-03) | VERIFIED | `trySend()` at lines 83-93: `socket.send()` line 86, then `this.metrics.incrementSent()` line 87, then `this.metrics.touchLastFrame()` line 88, then `catch` block line 89 |
| 3 | frames_dropped_total increments only in enqueue() size===capacity check, never from tryDrain | VERIFIED | `enqueue()` lines 115-117: `if (this.buffer.size === this.buffer.capacity) this.metrics.incrementDropped()`. `awk '/tryDrain/,/^    }/' ... | grep -c "incrementDropped"` returns 0 |
| 4 | last_frame_at updates on every successful send; null until first send | VERIFIED | `touchLastFrame: () => { this.metrics.last_frame_at = Date.now(); }` at line 218; initialized to `null as number | null` at line 167 |
| 5 | GET /health/detailed registered at top level of buildServerWithHub, NOT inside WS app.register scope | VERIFIED | `registerHealthDetailedRoute(app, services, launcher)` at server.ts line 608; nearest `app.register(async (instance) =>` WS scope begins at line 622 — route is before the WS scope |
| 6 | Existing /health route unchanged (Docker healthcheck SLA) | VERIFIED | `app.get('/health', async () => { return { status: 'ok', timestamp: Date.now() }; })` at server.ts line 293 — unchanged |
| 7 | HealthWatchdog is pure-pull — zero setInterval, zero clock.onTick | VERIFIED | `grep -n "setInterval\|clock\.onTick" grid/src/diagnostics/health-watchdog.ts` returns zero matches; file is 289 lines |
| 8 | HEALTH_THRESHOLDS frozen export with exactly 4 locked values | VERIFIED | `Object.freeze({ DIVERGENCE_DEGRADED: 10, DIVERGENCE_CRITICAL: 100, STALE_FRAME_MS: 60_000, RECONCILE_STALE_MULTIPLIER: 5 } as const)` at line 39 |
| 9 | Cold-start grace window: tick < 60 returns status=ok with null audit timestamps | VERIFIED | `const gracePeriodActive = clock.tick < 60` at line 210; grace path returns null divergence, null last_persist_attempt_at. Covered by test "cold-start grace: tick<60 returns ok with audit timestamps null" |
| 10 | attachFirehoseStats is idempotent — throws on second call | VERIFIED | `if (this._firehoseStatsFn !== null) throw new Error('HealthWatchdog.attachFirehoseStats already attached')` at lines 194-196 |
| 11 | CI gate R-32-01 (no-todo) and R-32-02 (interval-lifecycle) in rig-invariants.yml after OBS-03 | VERIFIED | rig-invariants.yml lines 30-34: OBS-R-32-01 at line 30 and OBS-R-32-02 at line 33, both after OBS-03 at line 27; both gate scripts run and exit 0 |
| 12 | 32-HUMAN-UAT.md exists with Step 0 (docker rebuild) and Steps 1-5 covering OBS-05/06/07 | VERIFIED | File exists at 258 lines; contains Step 0 (docker compose build grid), Steps 1-5, sign-off table with 6 rows |
| 13 | All 4 Phase 32 test files pass GREEN (29 tests total) | VERIFIED | `npx vitest run test/firehose-frame-counters.test.ts test/firehose-send-throws.test.ts test/health-watchdog-transitions.test.ts test/health-detailed-route.test.ts` — 4 files, 29 tests, all pass |

**Score:** 13/13 automated truths verified (plus 1 override applied)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `grid/src/audit/firehose-hub.ts` | HubMetricsSink + FirehoseStats interfaces, stats() method, counter wiring | VERIFIED | Exports both interfaces; `stats()` at line 188; `incrementSent()` at line 87 (inside try, after send); `incrementDropped()` at line 116 (enqueue size===capacity only) |
| `grid/test/firehose-frame-counters.test.ts` | 4 unit tests for frame counter semantics | VERIFIED | 4 it() blocks all GREEN; includes Pitfall 3 enforcement test |
| `grid/test/firehose-send-throws.test.ts` | R-32-03 regression pin — 3 tests | VERIFIED | 3 it() blocks all GREEN; pins counter-stays-0 when socket.send throws |
| `grid/src/diagnostics/health-watchdog.ts` | HealthWatchdog class, HEALTH_THRESHOLDS, computeStatus, HealthDetailedPayload | VERIFIED | 289 lines; all 4 exports present; zero setInterval/onTick |
| `grid/test/health-watchdog-transitions.test.ts` | 16 tests for thresholds, transitions, grace, idempotency | VERIFIED | 16 it() blocks all GREEN |
| `grid/src/api/routes/health-detailed.ts` | registerHealthDetailedRoute with 503 guard | VERIFIED | `app.get('/health/detailed')` with `launcher.healthWatchdog` null-check returning 503 |
| `grid/src/genesis/launcher.ts` | _healthWatchdog field, healthWatchdog getter, attachHealthWatchdog, attachFirehoseHub | VERIFIED | Private field at line 132; getter at line 302; both attach methods with throw-on-second-call |
| `grid/src/api/server.ts` | GridServices.launcher type extended; buildServerWithHub wiring block | VERIFIED | HealthWatchdog import at line 33; registerHealthDetailedRoute import at line 34; wiring block at lines 586-609; launcher type extended at lines 234-246 |
| `grid/test/health-detailed-route.test.ts` | 6 integration tests including shape + p95 + 503 | VERIFIED | 6 it() blocks all GREEN; p95 < 100ms asserted |
| `scripts/check-observability-no-todo.mjs` | R-32-01 CI gate with ENOENT tolerance | VERIFIED | File exists, executable; exits 0 on current codebase |
| `scripts/check-interval-lifecycle.mjs` | R-32-02 CI gate with ENOENT tolerance | VERIFIED | File exists, executable; exits 0 on current codebase |
| `.github/workflows/rig-invariants.yml` | Two new steps after OBS-03, before Vitest suite | VERIFIED | OBS-R-32-01 at line 30, OBS-R-32-02 at line 33, sandwiched between OBS-03 (line 27) and Fast Vitest suite (line 36) |
| `scripts/uat-half-close-socket.mjs` | UAT Step 3 half-close harness | VERIFIED | File exists, executable; contains `ws.terminate()` and `frame.type === 'hello'` guard |
| `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md` | Operator playbook with Steps 0-5, sign-off table | VERIFIED | 258 lines; all steps present; sign-off table has 6 unfilled rows (operator UAT not yet run) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| ClientConnection.trySend | WsFirehoseHub.metrics.frames_sent_total | metrics.incrementSent() inside try block AFTER socket.send | VERIFIED | Lines 86-88: send then incrementSent then touchLastFrame — counter is after send, before catch |
| ClientConnection.enqueue | WsFirehoseHub.metrics.frames_dropped_total | size===capacity pre-check before buffer.push | VERIFIED | Lines 115-117: `if (this.buffer.size === this.buffer.capacity) this.metrics.incrementDropped()` |
| WsFirehoseHub.onConnect | ClientConnection constructor 4th argument | Closure callbacks binding hub.metrics fields | VERIFIED | Lines 210-219: `new ClientConnection(socket, watermarkBytes, bufferCapacity, { incrementSent: ..., incrementDropped: ..., touchLastFrame: ... })` |
| buildServerWithHub | launcher.attachHealthWatchdog + launcher.attachFirehoseHub | Imperative wiring sequence after firehoseHub construction | VERIFIED | server.ts lines 586-609: guard → new HealthWatchdog → attachHealthWatchdog → attachFirehoseHub → registerHealthDetailedRoute |
| launcher.attachFirehoseHub | healthWatchdog.attachFirehoseStats | Internal callback | VERIFIED | launcher.ts line 331: `this._healthWatchdog?.attachFirehoseStats(() => hub.stats())` |
| GET /health/detailed | launcher.healthWatchdog.snapshot() | One-liner route handler | VERIFIED | health-detailed.ts line 32: `return launcher.healthWatchdog.snapshot()` with 503 guard |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|--------------|--------|-------------------|--------|
| `health-detailed.ts` | `launcher.healthWatchdog.snapshot()` | `HealthWatchdog.snapshot()` reads `auditReconcile.{lastReconcileAt, persistedMaxId, lastPersistError}` + `firehoseHub.stats()` + `clock.currentTick` + `Date.now()` | Yes — in-process getters reading live reconcile state, live hub counters, live clock tick | FLOWING |
| `firehose-hub.ts stats()` | `metrics.frames_sent_total` | `ClientConnection.trySend()` increments via `HubMetricsSink` closure after successful `socket.send()` | Yes — real WebSocket send success increments the counter | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---------|---------|--------|--------|
| R-32-01 CI gate exits 0 | `node scripts/check-observability-no-todo.mjs` | `[check-observability-no-todo] OK` | PASS |
| R-32-02 CI gate exits 0 | `node scripts/check-interval-lifecycle.mjs` | `[check-interval-lifecycle] OK` | PASS |
| OBS-03 Phase 31 gate still passes (regression) | `node scripts/check-no-silent-catch.mjs` | `[check-no-silent-catch] OK` | PASS |
| All 29 Phase 32 tests GREEN | `npx vitest run test/firehose-frame-counters.test.ts test/firehose-send-throws.test.ts test/health-watchdog-transitions.test.ts test/health-detailed-route.test.ts` | 4 files, 29 tests, 0 failures | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|------------|-------------|-------------|--------|---------|
| OBS-05 | 32-01, 32-02 | WsFirehoseHub exposes stats() with 5-field shape; frames_sent_total increments AFTER successful socket.send; frames_dropped_total on ring-buffer overflow | SATISFIED | `firehose-hub.ts`: stats() method, HubMetricsSink callbacks, counter placement in trySend/enqueue. 7 regression tests (4 in frame-counters.test + 3 in send-throws.test) pin the invariants |
| OBS-06 | 32-04 | GET /health/detailed returns { status, timestamp, audit, firehose, clock }; degraded on divergence >10 or stale frames; critical on divergence >100 or persist_error+divergence>0; never blocks on DB | SATISFIED | `health-detailed.ts` route registered at top-level; `HealthWatchdog.snapshot()` reads only cached in-process state; 6 integration tests in health-detailed-route.test.ts cover shape + p95 + 503 guard + degraded/ok paths |
| OBS-07 | 32-03, 32-04 | HealthWatchdog at grid/src/diagnostics/health-watchdog.ts; surfaces degraded if last_reconcile_at > 5×snapshotCadenceMs; pure-pull (no timer); HEALTH_THRESHOLDS frozen | SATISFIED (override applied) | `health-watchdog.ts` exists with zero setInterval/onTick; `HEALTH_THRESHOLDS` frozen const with 4 locked values; 16 tests in health-watchdog-transitions.test.ts cover all threshold + transition + grace + idempotency cases. CONTEXT.md D-32-B1/G2 documents the intentional readonly/stop() deviation from REQUIREMENTS.md wording |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| None found | — | All Phase 32 observability files pass check-observability-no-todo.mjs (R-32-01) — zero TODO/FIXME/XXX near observability keywords | — | — |

### Human Verification Required

#### 1. Operator UAT — Full 32-HUMAN-UAT.md Execution

**Test:** Execute all steps in `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md` after running `docker compose build grid && docker compose up -d grid`:

- **Step 0:** Rebuild Grid Docker image, restart container, wait 60s, confirm Phase 31 `audit_reconcile_ok` heartbeat is firing in logs.
- **Step 1:** `curl -s http://localhost:8080/health/detailed | jq .` — verify full OBS-06 payload shape with exactly 5 top-level keys, `status: "ok"`, `audit.divergence === 0`, `clock.tick >= 60`, `firehose.frames_dropped_total === 0`.
- **Step 2:** With a connected WebSocket client (Steward firehose tab or wscat), poll `/health/detailed` twice 5 seconds apart and verify `frames_sent_total` strictly increases and `last_frame_at` is recent.
- **Step 3:** Run `node scripts/uat-half-close-socket.mjs`, wait 10s, verify `frames_dropped_total` increased without other clients losing reception, grid container did not restart.
- **Step 4:** `docker stop noesis-mysql`, wait 60s, verify `status: "degraded"` with `last_persist_error` populated. `docker start noesis-mysql`, wait 45s, verify `status: "ok"`. Confirm `health_status_changed` log lines fired.
- **Step 5:** `ab -n 1000 -c 10 http://localhost:8080/health/detailed` — verify p95 < 50ms (or < 100ms on resource-constrained machine).

**Expected:** All 6 sign-off rows in the table are `[x]`. The filled-in UAT is committed: `git add .planning/phases/32-firehose-observability/32-HUMAN-UAT.md && git commit -m "test(32): operator UAT complete — Phase 32 firehose observability verified"`.

**Why human:** Live WorldClock tick cadence, real Docker-compose MySQL stop/start lifecycle, real HTTP stack p95 latency over 1000 requests, and WebSocket half-close socket behavior (ws.terminate()) cannot be exercised inside vitest. These require the deployed Docker container with Phase 31 baseline already healthy.

### Gaps Summary

No automated gaps found. All 13 automated must-haves verified. The one override applied (OBS-07 readonly/stop() literal wording) was explicitly resolved in CONTEXT.md D-32-B1 and D-32-G2 during the design phase — the pure-pull design satisfies R-32-02 trivially because there is no setInterval to stop.

The only remaining gate is the operator UAT (Plan 06 Task 3 blocking checkpoint). The sign-off table in `32-HUMAN-UAT.md` has all 6 rows unfilled `[ ]`. Phase 32 close-out in STATE.md is blocked until the operator completes the UAT and commits the filled-in document.

---

_Verified: 2026-05-25T17:45:00Z_
_Verifier: Claude (gsd-verifier)_
