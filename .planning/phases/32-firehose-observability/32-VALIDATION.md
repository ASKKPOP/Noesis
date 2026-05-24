---
phase: 32
slug: firehose-observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.0.0 |
| **Config file** | None — grid uses `vitest run` from `grid/` (no vitest.config.ts) |
| **Quick run command** | `cd grid && npx vitest run test/firehose-frame-counters.test.ts test/firehose-send-throws.test.ts test/health-detailed-route.test.ts test/health-watchdog-transitions.test.ts` |
| **Full suite command** | `cd grid && npm test` (= `vitest run`) |
| **Estimated runtime** | Quick: ~5s · Full: ~25s |

---

## Sampling Rate

- **After every task commit:** Run quick command (4 Phase-32 tests, ~5s)
- **After every plan wave:** Run full suite (`cd grid && npm test`)
- **Before `/gsd-verify-work`:** Full suite green + both CI gates (`scripts/check-observability-no-todo.mjs`, `scripts/check-interval-lifecycle.mjs`) green + `.github/workflows/rig-invariants.yml` passes locally via `act` or remote
- **Max feedback latency:** 25s (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-* | 01 | 1 | OBS-05 | R-32-03 | `frames_sent_total` only increments on successful `socket.send`; `frames_dropped_total` only on ring-buffer-at-capacity (NOT on `tryDrain` re-queue path) | unit | `cd grid && npx vitest run test/firehose-frame-counters.test.ts` | ❌ W0 | ⬜ pending |
| 32-02-* | 02 | 1 | OBS-05 | R-32-03 | send-throwing client: `frames_sent_total === 0`, hub does not panic, other clients keep receiving | unit | `cd grid && npx vitest run test/firehose-send-throws.test.ts` | ❌ W0 | ⬜ pending |
| 32-03-* | 03 | 2 | OBS-07 | — | `HealthWatchdog.snapshot()` returns ok/cold-start-ok/degraded/critical correctly across the threshold matrix; pure-pull (zero `setInterval`) | unit | `cd grid && npx vitest run test/health-watchdog-transitions.test.ts` | ❌ W0 | ⬜ pending |
| 32-04-* | 04 | 3 | OBS-06 | — | `GET /health/detailed` returns full payload, exact-shape match, p95 <50ms over 100 calls | integration | `cd grid && npx vitest run test/health-detailed-route.test.ts` | ❌ W0 | ⬜ pending |
| 32-05-* | 05 | 4 | OBS-05/06/07 | R-32-01 | CI gate fails on TODO/FIXME/XXX within 50 chars of observability keywords in `grid/src/{diagnostics,audit,db}/` | ci | `node scripts/check-observability-no-todo.mjs` | ❌ W0 | ⬜ pending |
| 32-05-* | 05 | 4 | OBS-07 | R-32-02 | CI gate asserts every `setInterval(` in scanned dirs is stored in a class field | ci | `node scripts/check-interval-lifecycle.mjs` | ❌ W0 | ⬜ pending |
| 32-06-* | 06 | 4 | OBS-05/06/07 | — | 32-HUMAN-UAT.md ships with operator cutover steps (build/deploy/curl/jq/half-close/MySQL-stop/ab load) | manual | UAT steps 1–5 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan IDs above are placeholders; final task IDs assigned by planner.*

---

## Wave 0 Requirements

- [ ] `grid/src/diagnostics/` — directory does not exist yet; first task in Plan 03 must create it
- [ ] `grid/src/diagnostics/health-watchdog.ts` — covers OBS-07 (class + HEALTH_THRESHOLDS + computeStatus + HealthDetailedPayload interface)
- [ ] `grid/src/api/routes/health-detailed.ts` — covers OBS-06 (registerHealthDetailedRoute)
- [ ] `grid/test/firehose-frame-counters.test.ts` — covers OBS-05 (frames_sent/dropped/last_frame_at)
- [ ] `grid/test/firehose-send-throws.test.ts` — covers OBS-05 R-32-03 regression
- [ ] `grid/test/health-detailed-route.test.ts` — covers OBS-06 (route + p95 + payload shape)
- [ ] `grid/test/health-watchdog-transitions.test.ts` — covers OBS-07 (warn-log on state change only)
- [ ] `scripts/check-observability-no-todo.mjs` — CI gate R-32-01
- [ ] `scripts/check-interval-lifecycle.mjs` — CI gate R-32-02
- [ ] `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md` — operator UAT
- [ ] `scripts/uat-half-close-socket.mjs` — (planner's call per D-32-D3 Discretion) optional UAT step 3 harness

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `frames_sent_total` increments at least once per tick under live load (success #2) | OBS-05 | Requires real running Grid + connected client + actual tick cadence — would be flaky as an integration test | 32-HUMAN-UAT.md Step 2: open Steward `/firehose` tab; `curl /health/detailed` twice 5s apart; assert `frames_sent_total` strictly greater + `last_frame_at` within window |
| MySQL stop → `status: 'degraded'` within 60s; restart → `status: 'ok'` within 60s (success #4) | OBS-06 | Requires actual MySQL container lifecycle + reconcile-loop interaction across real wall-clock — operator must drive | 32-HUMAN-UAT.md Step 4: `docker stop noesis-mysql`; poll endpoint; verify degraded with `audit.divergence > 0` + `audit.last_persist_error` populated; `docker start noesis-mysql`; wait one reconcile cycle (~30s); verify ok |
| ab load test p95 <50ms over 1000 requests (success #5, end-to-end) | OBS-06 | CI vitest p95 covers in-process timing; ab covers HTTP-layer + Fastify stack + real network localhost overhead | 32-HUMAN-UAT.md Step 5: `ab -n 1000 -c 10 http://localhost:8080/health/detailed`; assert p95 in report `< 50ms` |
| Half-closed socket induces `frames_dropped_total` increment without `frames_sent_total` increment AND other clients keep receiving | OBS-05 R-32-03 | Reproducing half-closed socket state programmatically is fragile in unit tests; UAT script is more reliable | 32-HUMAN-UAT.md Step 3: run `node scripts/uat-half-close-socket.mjs --grid genesis` (if planner ships script) OR use `wscat` + Ctrl-C (operator action documented); poll `/health/detailed` before/after; verify counter delta on offending socket only |

---

## Validation Sign-Off

- [ ] All Phase 32 tasks have automated verify command OR Wave 0 dependency on file creation
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Plan 06 UAT manual; all others automated)
- [ ] Wave 0 covers all MISSING references (grid/src/diagnostics/, 4 test files, 2 CI scripts, UAT.md, optional half-close script)
- [ ] No watch-mode flags (`vitest run` only, never `vitest` or `vitest --watch` per project memory `feedback_test_execution_rules.md`)
- [ ] Feedback latency < 25s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 completes

**Approval:** pending
