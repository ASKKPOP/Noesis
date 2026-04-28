---
phase: 14-researcher-rigs
plan: "04"
subsystem: researcher-rigs
tags: [ci, bench-runner, nightly, rig-invariants, rIG-04, RIG-05]
dependency_graph:
  requires: [14-01, 14-02, 14-03]
  provides: [rig-bench-runner, nightly-ci-workflow, per-commit-ci-gate]
  affects: [scripts/rig.mjs, scripts/check-rig-invariants.mjs]
tech_stack:
  added: [GitHub Actions, MySQL 8 service container]
  patterns: [subprocess-wrapper, skipIf-gating, SCAN_TARGETS-extensibility]
key_files:
  created:
    - scripts/rig-bench-runner.mjs
    - grid/test/rig/rig-bench.test.ts
    - .github/workflows/rig-invariants.yml
    - .github/workflows/nightly-rig-bench.yml
  modified:
    - scripts/rig.mjs
    - scripts/check-rig-invariants.mjs
decisions:
  - "Added final JSON stdout line to rig.mjs to fulfil the D-14-08 interface contract (chronos.rig_closed payload reachable by bench runner without touching broadcast bus)"
  - "SCAN_TARGETS array in check-rig-invariants.mjs makes the grep-gate scope declarative and extensible without logic changes"
  - "describe.skipIf on NOESIS_RUN_NIGHTLY gates the 50×10k smoke so per-commit feedback stays <1s for that file"
  - "beforeAll shared result avoids triple-running the 50×10k bench within a single Vitest invocation"
  - "nightly workflow runs both Path A (direct rig.mjs) and Path B (Vitest wrapper) for belt-and-suspenders coverage"
metrics:
  duration: ~12 minutes
  completed: "2026-04-28"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
---

# Phase 14 Plan 04: CI Workflows & Bench Runner Summary

Lock down the RIG-04 performance contract (50 Nous × 10000 ticks, <60 min wall-clock) and the RIG-05 observability contract (chronos.rig_closed 5-key tuple) with a subprocess bench runner, NOESIS_RUN_NIGHTLY-gated Vitest smoke test, per-commit invariants CI gate, and nightly MySQL-backed benchmark workflow.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | rig-bench-runner subprocess wrapper + stdout JSON contract + invariants gate extension | ded9a72 | scripts/rig-bench-runner.mjs, scripts/rig.mjs (+4 lines), scripts/check-rig-invariants.mjs (SCAN_TARGETS) |
| 2 | rig-bench.test.ts — NOESIS_RUN_NIGHTLY-gated 50×10k Vitest smoke | e227668 | grid/test/rig/rig-bench.test.ts |
| 3 | CI workflows — per-commit invariants gate + nightly RIG-04 bench | e9a904e | .github/workflows/rig-invariants.yml, .github/workflows/nightly-rig-bench.yml |

## Nightly Run Evidence

The nightly workflow has not yet run (first run occurs after merge, triggered by cron or `gh workflow run nightly-rig-bench.yml`). The plan's output section calls for:

- First observed wall-clock (sub-60min)
- Exact chronos.rig_closed payload (seed, tick=10000, exit_reason, chain_entry_count, chain_tail_hash)
- sha256 of the bench-50 tarball

This evidence will be captured by Plan 14-05 (doc-sync) after the first nightly run. The nightly workflow uploads both `rig-bench-50-tarball` and `rig-bench-50-logs` artifacts (`if: always()`) for forensics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added final JSON stdout line to scripts/rig.mjs**

- **Found during:** Task 1 — the plan's interface contract specifies `{"event":"rig_closed","payload":{...}}` as the final stdout line, but the existing rig.mjs emitted only a human-readable string at that position
- **Issue:** `rig-bench-runner.mjs` depends on parsing the last non-empty stdout line as JSON; without the JSON line the bench runner would always fail to extract the payload
- **Fix:** Added `console.log(JSON.stringify({ event: 'rig_closed', payload: rigClosedPayload }))` immediately after the human-readable tarball log line in `scripts/rig.mjs`, before `process.exit(0)`
- **Files modified:** scripts/rig.mjs (+4 lines)
- **Commit:** ded9a72 (bundled with Task 1 changes)
- **D-14-08 compliance:** The JSON payload is `rigClosedPayload` — the same struct already built from the rig's isolated AuditChain, not from any broadcast bus

**2. [Rule 2 - Missing functionality] Extended check-rig-invariants.mjs with SCAN_TARGETS array**

- **Found during:** Task 1 — the plan specifies appending `'scripts/rig-bench-runner.mjs'` to a `SCAN_TARGETS` array, but the original file had no such array; it used a single hardcoded `RIG_SCRIPT` constant
- **Fix:** Introduced `const SCAN_TARGETS = [RIG_SCRIPT, RIG_BENCH_RUNNER]` and replaced the single-file scan block with a loop over `SCAN_TARGETS`. Existing semantics unchanged; both files now get both T-10-12 and T-10-13 rules applied. The `walkDir(RIG_SRC_DIR)` path is unchanged (T-10-13 only for grid/src/rig/**)
- **Files modified:** scripts/check-rig-invariants.mjs
- **Commit:** ded9a72

## Post-Task Verification Results

```
node scripts/check-rig-invariants.mjs
[check-rig-invariants] OK — no violations.

cd grid && npx vitest run test/rig/
Test Files  9 passed | 2 skipped (11)
Tests  27 passed | 6 skipped (33)
Duration  576ms
```

Allowlist count regression check:
```
node scripts/check-state-doc-sync.mjs
[state-doc-sync] OK — STATE.md is in sync with the 27-event allowlist.
```

## Known Stubs

None. The bench runner and workflow are fully wired. The nightly first-run evidence (wall-clock, chain_tail_hash, tarball sha256) is deferred to Plan 14-05 by design — it requires an actual nightly CI run after merge.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced at trust boundaries. The GitHub Actions workflow surfaces described in the plan's threat model (T-14-04-01 through T-14-04-06) are mitigated as designed:

- T-14-04-01 (stdout tampering): last-line-only parsing + exact 5-key sort comparison in rig-bench-runner.mjs
- T-14-04-04 (GITHUB_TOKEN scope): `permissions: contents: read` on both workflows
- T-14-04-06 (repudiation): `if: always()` on both artifact upload steps

## Self-Check: PASSED
