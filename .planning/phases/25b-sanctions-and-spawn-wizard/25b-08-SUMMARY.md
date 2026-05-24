---
phase: 25b-sanctions-and-spawn-wizard
plan: "08"
subsystem: audit-ci-gates
tags: [ci-gate, producer-boundary, plaintext-gate, sanctions]
dependency_graph:
  requires: [25b-07]
  provides: [plaintext-gate-operator-sanctions, producer-boundary-tests-6-events]
  affects: [grid/test/audit, scripts, package.json]
tech_stack:
  added: []
  patterns: [sole-producer-boundary-test, plaintext-grep-gate, ci-script-clone-pattern]
key_files:
  created:
    - scripts/check-operator-sanctions-plaintext.mjs
    - grid/test/audit/operator-muted-producer-boundary.test.ts
    - grid/test/audit/operator-slashed-producer-boundary.test.ts
    - grid/test/audit/operator-quarantined-producer-boundary.test.ts
    - grid/test/audit/operator-forced-sleep-producer-boundary.test.ts
    - grid/test/audit/operator-human-banned-producer-boundary.test.ts
    - grid/test/audit/operator-human-frozen-producer-boundary.test.ts
  modified:
    - package.json
decisions:
  - "Cloned check-cognitive-snapshot-plaintext.mjs pattern verbatim; changed only FORBIDDEN_KEYS and scanned scopes"
  - "Added check:operator-sanctions-plaintext to pretest pipeline in package.json"
  - "TDD tests written as GREEN (emitters already exist from plan 07); no RED-then-GREEN cycle needed since plan dependency is fulfilled"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  files_created: 7
  files_modified: 1
---

# Phase 25b Plan 08: Operator-Sanctions CI Gate + Producer-Boundary Tests Summary

One-liner: Static CI gate forbidding reason-plaintext field names in sanction source + 6 sole-producer-boundary tests locking the audit.append invariant for each new sanction event.

## What Was Built

### Task 1: CI Plaintext Gate (900565a)

`scripts/check-operator-sanctions-plaintext.mjs` — cloned from the `check-cognitive-snapshot-plaintext.mjs` pattern (D-25a-05).

Changed from the clone target:
- **FORBIDDEN_KEYS**: `reason_text`, `reason_plaintext`, `reason_body`, `plaintext_reason`
- **Scanned scopes**:
  - `grid/src/audit/append-operator-*.ts` (emitter files)
  - `grid/src/api/operator/{mute-broadcast,slash-coin,quarantine,force-sleep,ban-human,freeze-wallet,spawn-system-nous}.ts` (route files)
  - `grid/test/operator/` files matching `/(sanction|mute|slash|quarantine|ban|freeze)/`
- **Exempt paths**: `broadcast-allowlist.ts`, the script itself
- **Header comment**: renamed to operator-sanctions, references D-25b-11

`package.json` — added `check:operator-sanctions-plaintext` script and appended it to `pretest`.

Verification: `node scripts/check-operator-sanctions-plaintext.mjs` exits 0.

### Task 2: 6 Producer-Boundary Tests (26ceee0)

Six test files, each asserting the sole-producer invariant for one event:

| Test file | Event | Allowed emitter |
|-----------|-------|-----------------|
| operator-muted-producer-boundary.test.ts | `operator.muted` | append-operator-muted.ts |
| operator-slashed-producer-boundary.test.ts | `operator.slashed` | append-operator-slashed.ts |
| operator-quarantined-producer-boundary.test.ts | `operator.quarantined` | append-operator-quarantined.ts |
| operator-forced-sleep-producer-boundary.test.ts | `operator.forced_sleep` | append-operator-forced-sleep.ts |
| operator-human-banned-producer-boundary.test.ts | `operator.human_banned` | append-operator-human-banned.ts |
| operator-human-frozen-producer-boundary.test.ts | `operator.human_frozen` | append-operator-human-frozen.ts |

Pattern: walk `grid/src/**/*.ts`, grep for `.(append)\s*\(['"]operator\.<event>['"]`, assert exactly 1 match pointing to the expected emitter file. All 6 pass.

## Deviations from Plan

None — plan executed exactly as written.

Note on TDD: Task 2 had `tdd="true"` but the emitter files were already created by plan 07 (dependency). Tests were written and immediately passed (GREEN). No false-RED situation — this is the correct behavior when the implementation dependency is fulfilled by an upstream plan.

## Verification Results

```
node scripts/check-operator-sanctions-plaintext.mjs
✅ check-operator-sanctions-plaintext: clean (0 violations across all scopes)

npm --prefix grid run test -- run test/audit/operator-*-producer-boundary.test.ts
Test Files  6 passed (6)
     Tests  6 passed (6)
```

## Threat Mitigations Applied

| Threat ID | Status |
|-----------|--------|
| T-25b-08-01 Tampering — Producer-boundary | Mitigated: 6 per-event tests fail on any non-sole-producer call |
| T-25b-08-02 Information Disclosure — Plaintext fields | Mitigated: CI gate fails on FORBIDDEN_KEYS in scoped source files |

## Self-Check: PASSED

- scripts/check-operator-sanctions-plaintext.mjs: FOUND
- grid/test/audit/operator-muted-producer-boundary.test.ts: FOUND
- grid/test/audit/operator-slashed-producer-boundary.test.ts: FOUND
- grid/test/audit/operator-quarantined-producer-boundary.test.ts: FOUND
- grid/test/audit/operator-forced-sleep-producer-boundary.test.ts: FOUND
- grid/test/audit/operator-human-banned-producer-boundary.test.ts: FOUND
- grid/test/audit/operator-human-frozen-producer-boundary.test.ts: FOUND
- Commit 900565a: FOUND
- Commit 26ceee0: FOUND
