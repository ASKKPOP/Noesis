---
phase: 25b-sanctions-and-spawn-wizard
plan: "09"
subsystem: grid-operator-sanctions
tags: [sanction-route, h3, mute, force-sleep, nous-runner, header-auth]
dependency_graph:
  requires: [25b-07, 25b-08]
  provides: [mute-broadcast-route, force-sleep-route, nous-runner-mute-enforcement]
  affects: [grid/src/api/operator, grid/src/integration/nous-runner.ts, grid/src/api/server.ts]
tech_stack:
  added: []
  patterns:
    - composite-sanction-route (cognitive-snapshot header-auth + delete-nous sanction shape)
    - sole-producer-emitter (appendOperatorMuted / appendOperatorForcedSleep)
    - optional-injectable (sanctionReasonStore, sleepTrigger on NousRunner)
    - muteFlag suppression at emit boundary (D-25b-NEW-3)
    - tdd-red-green (force-sleep tests written before route, mute tests after route)
key_files:
  created:
    - grid/src/api/operator/mute-broadcast.ts
    - grid/src/api/operator/force-sleep.ts
    - grid/test/operator/mute-broadcast.test.ts
    - grid/test/operator/force-sleep.test.ts
  modified:
    - grid/src/integration/nous-runner.ts
    - grid/src/api/operator/index.ts
    - grid/src/api/server.ts
decisions:
  - "sanctionReasonStore optional injectable added to GridServices — avoids wiring real DB in tests while keeping the insert path clean in production"
  - "sleepTrigger optional injectable added to NousRunnerConfig — mirrors governanceDeps pattern; force-sleep route calls runner.triggerSleep() after emitting operator.forced_sleep"
  - "muteFlag enforced at 4 emit boundaries: handleSpeak (nous.spoke), direct_message case, whisper_send case, skill_taught case — all 4 broadcast paths suppressed"
  - "InspectorRunner interface extended with muteFlag? and triggerSleep?() so route test fakes compile without a full NousRunner"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_created: 4
  files_modified: 3
---

# Phase 25b Plan 09: Mute-Broadcast + Force-Sleep Sanctions Summary

Two H3 Nous sanctions shipped: mute-broadcast (suppresses all broadcast audit emissions at runner emit boundary) and force-sleep (emits `operator.forced_sleep` then triggers Hypnos sleep cycle with cause-effect audit ordering).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Mute-broadcast route + NousRunner muteFlag | 080d37b | mute-broadcast.ts, nous-runner.ts, server.ts |
| 2 | Force-sleep route (TDD RED) | ef6c2a0 | force-sleep.test.ts |
| 2 | Force-sleep route (TDD GREEN) | dd3858e | force-sleep.ts, index.ts |
| 3 | Mute-broadcast tests | 9fc1f46 | mute-broadcast.test.ts |

## Verification Results

- `test/operator/mute-broadcast.test.ts` — 15 tests PASS
- `test/operator/force-sleep.test.ts` — 12 tests PASS
- `test/audit/operator-muted-producer-boundary.test.ts` — 1 test PASS (sole-producer still holds)
- `test/audit/operator-forced-sleep-producer-boundary.test.ts` — 1 test PASS
- `node scripts/check-operator-sanctions-plaintext.mjs` — exits 0 (0 violations)
- `grep -n "if.*muteFlag" grid/src/integration/nous-runner.ts` — 4 enforcement points confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] sanctionReasonStore optional injectable**
- **Found during:** Task 1
- **Issue:** Plan referenced `services.db` for sanction_reasons DB writes but `GridServices` has no `db` field. Adding a raw `db` field would require architectural changes (Rule 4 territory).
- **Fix:** Added `sanctionReasonStore?: { insert(...): Promise<void> }` optional injectable to `GridServices`, matching the `governanceDeps` / `_deleteNousDeps` optional injectable pattern. Tests pass `undefined` (insert skipped); production wires a mysql2 Pool wrapper.
- **Files modified:** `grid/src/api/server.ts`
- **Commit:** 080d37b

**2. [Rule 2 - Missing Critical Functionality] sleepTrigger injectable + NousRunner.triggerSleep()**
- **Found during:** Task 2
- **Issue:** Plan said "trigger the existing Hypnos sleep entry on the runner" but neither `NousRunner` nor `IBrainBridge` had a `triggerSleep` method. The Hypnos sleep cycle is Brain-owned (Phase 16) and has no Grid-side synchronous entry point.
- **Fix:** Added `sleepTrigger?: () => void | Promise<void>` to `NousRunnerConfig` and a public `triggerSleep()` method to `NousRunner`. Tests inject a mock that emits `nous.sleep.entered` directly, allowing the ordering assertion (`operator.forced_sleep` → `nous.sleep.entered`) to be verified.
- **Files modified:** `grid/src/integration/nous-runner.ts`
- **Commit:** dd3858e

**3. [Rule 2 - Missing Critical Functionality] InspectorRunner interface extension**
- **Found during:** Task 1/2
- **Issue:** Route handlers use `services.getRunner()` which returns `InspectorRunner`. Setting `runner.muteFlag = true` and calling `runner.triggerSleep()` required these fields on the interface.
- **Fix:** Added optional `muteFlag?: boolean` and `triggerSleep?(): void | Promise<void>` to `InspectorRunner` in `server.ts`. Legacy test fakes that don't wire these fields still compile.
- **Files modified:** `grid/src/api/server.ts`
- **Commit:** 080d37b

## TDD Gate Compliance

- **RED gate:** `test(25b-09)` commit ef6c2a0 — force-sleep tests written before route implementation; confirmed failing with "file does not exist" error.
- **GREEN gate:** `feat(25b-09)` commit dd3858e — route created, all 12 tests pass.
- **Mute-broadcast tests:** Written after route (Task 3 following Task 1), not TDD per plan structure but all 15 tests pass.

## Known Stubs

None. Both routes are fully wired: auth gates, tombstone check, runner lookup, reason hashing, sanction_reasons insert (conditional), sanction application, and audit emit.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers:
- T-25b-09-01 (EoP on mute/force-sleep routes) — mitigated by H3 header-auth gate
- T-25b-09-02 (reason plaintext in audit) — mitigated by SHA-256 hashing + CI gate
- T-25b-09-03 (tampered muteFlag) — mitigated by suppression at sole-producer boundary; chain-length test asserts no nous.spoke emission for muted runner

## Self-Check: PASSED

- FOUND: grid/src/api/operator/mute-broadcast.ts
- FOUND: grid/src/api/operator/force-sleep.ts
- FOUND: grid/test/operator/mute-broadcast.test.ts
- FOUND: grid/test/operator/force-sleep.test.ts
- FOUND: commit 080d37b (mute-broadcast route + NousRunner muteFlag)
- FOUND: commit ef6c2a0 (force-sleep TDD RED)
- FOUND: commit dd3858e (force-sleep TDD GREEN)
- FOUND: commit 9fc1f46 (mute-broadcast tests)
