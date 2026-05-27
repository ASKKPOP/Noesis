---
phase: 41
slug: sleep-cycle-away-presence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Grid)** | Vitest (run via `npm test` in `grid/`) |
| **Framework (Brain)** | pytest + pytest-asyncio |
| **Config file (Grid)** | `grid/package.json` — `"test": "vitest run"` |
| **Config file (Brain)** | `brain/pyproject.toml` |
| **Quick run command** | `cd grid && npm test 2>&1 \| tail -5` (~10s) |
| **Full suite command** | `cd grid && npm test && cd ../brain && python -m pytest test/` |
| **Estimated runtime** | ~30 seconds (Grid) + ~15 seconds (Brain) |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npm test 2>&1 | tail -5`
- **After every plan wave:** Run full suite (`cd grid && npm test && cd ../brain && python -m pytest test/`)
- **Before `/gsd-verify-work`:** Full suite must be green + all CI gates pass
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 1 | SLEEP-01 | T-41-01 | Brain JWT required on heartbeat; no unauthenticated status flip | unit (Grid) | `cd grid && npm test -- test/api/civic-presence.test.ts` | ❌ Wave 0 | ⬜ pending |
| 41-01-02 | 01 | 1 | SLEEP-01 | T-41-03 | Grace timer uses refcount; 2nd disconnect doesn't reset until both gone | unit (Grid) | `cd grid && npm test -- test/civic-presence/grace-timer.test.ts` | ❌ Wave 0 | ⬜ pending |
| 41-02-01 | 02 | 1 | SLEEP-02 | T-41-02 | Queue depth capped at 1000; 1001st message → 429 | unit (Grid) | `cd grid && npm test -- test/api/civic-inbox.test.ts` | ❌ Wave 0 | ⬜ pending |
| 41-02-02 | 02 | 1 | SLEEP-03 | — | GET /inbox?since=N returns messages + queue_depth | unit (Grid) | same | ❌ Wave 0 | ⬜ pending |
| 41-02-03 | 02 | 1 | SLEEP-03 | — | PATCH /inbox/ack marks delivered | unit (Grid) | same | ❌ Wave 0 | ⬜ pending |
| 41-03-01 | 03 | 1 | SLEEP-03 | — | WssSubscriber reconnects with ?since=<tick> in URL | unit (Brain) | `cd brain && python -m pytest test/test_wire_subscriber_since.py -x` | ❌ Wave 0 | ⬜ pending |
| 41-03-02 | 03 | 1 | SLEEP-03 | — | post_presence_heartbeat updates last_seen_tick in SQLite | unit (Brain) | `cd brain && python -m pytest test/test_wire_client_heartbeat.py -x` | ❌ Wave 0 | ⬜ pending |
| 41-03-03 | 03 | 1 | SLEEP-03 | — | last_seen_tick KV get/set roundtrip | unit (Brain) | `cd brain && python -m pytest test/test_wire_queue_kv.py -x` | ❌ Wave 0 | ⬜ pending |
| 41-04-01 | 04 | 2 | SLEEP-04 | T-41-03 | Clock fast-forward 31d → status = absent | unit (Grid) | `cd grid && npm test -- test/civic-presence/escalation.test.ts` | ❌ Wave 0 | ⬜ pending |
| 41-04-02 | 04 | 2 | SLEEP-05 | T-41-04 | Clock fast-forward 1y → 409 on Civic-DID action | unit (Grid) | same | ❌ Wave 0 | ⬜ pending |
| 41-04-03 | 04 | 2 | SLEEP-05 | — | Business-DID dissolved on presumed_departed | unit (Grid) | same | ❌ Wave 0 | ⬜ pending |
| 41-05-01 | 05 | 2 | SLEEP-01 | — | Civic Map presence polling returns 4-state JSON | unit (Grid) | `cd grid && npm test -- test/api/civic-presence.test.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/civic-presence/` — new test subdirectory
- [ ] `grid/test/civic-presence/grace-timer.test.ts` — stubs for SLEEP-01 grace timer logic
- [ ] `grid/test/civic-presence/escalation.test.ts` — stubs for SLEEP-04/05 threshold checks
- [ ] `grid/test/api/civic-presence.test.ts` — stubs for POST/GET /civic/presence routes
- [ ] `grid/test/api/civic-inbox.test.ts` — stubs for GET /inbox, PATCH /ack, POST /message
- [ ] `brain/test/test_wire_client_heartbeat.py` — stubs for post_presence_heartbeat()
- [ ] `brain/test/test_wire_subscriber_since.py` — stubs for ?since= on WSS reconnect
- [ ] `brain/test/test_wire_queue_kv.py` — stubs for last_seen_tick get/set

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Civic Map avatar renders dimmed (opacity 0.4 + grayscale) | SLEEP-01 | Visual CSS property — not unit-testable | Load Portal Civic Map; Brain offline >5min; inspect avatar element; verify computed style has `opacity: 0.4` and `filter: grayscale(100%)` |
| Steward Console Section 4 queue depth display | SLEEP-02 | React component render — integration/E2E | Log into Steward Console as Tier-2; navigate to /system/operators; verify Section 4 "Message Queue Depth" visible with per-operator counts |
| absent charter revocation stub | SLEEP-04 | Phase 49 not shipped — actual processing deferred | Confirm a self-message is written to civic_message_queue from "system" sender when absent escalation fires; actual charter action is no-op |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
