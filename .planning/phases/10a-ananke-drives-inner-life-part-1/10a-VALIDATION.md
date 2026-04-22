---
phase: 10a
slug: ananke-drives-inner-life-part-1
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 10a — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated from RESEARCH.md §Validation Architecture; planner locks Per-Task Verification Map after plans are written.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (brain/) + vitest (grid/) |
| **Config file** | brain/pyproject.toml, grid/vitest.config.ts |
| **Quick run command** | `cd brain && pytest src/noesis_brain/ananke -q` + `cd grid && pnpm vitest run src/ananke test/ananke test/privacy` |
| **Full suite command** | `cd brain && pytest -q` + `cd grid && pnpm test` |
| **Estimated runtime** | ~45 seconds quick, ~6 minutes full |

---

## Sampling Rate

- **After every task commit:** Run quick run command (phase-scoped tests)
- **After every plan wave:** Run full suite command (regression check)
- **Before `/gsd-verify-work`:** Full suite must be green + grep gates pass + zero-diff fixture green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

*Planner fills this table after PLAN.md tasks are locked. Every task MUST map to either an automated command, a Wave 0 install, or a manual-only entry with justification.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10a-XX-YY | XX | Y | DRIVE-ZZ | T-09-0Z / — | {filled by planner} | unit/integration/grep/property | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Populated by planner if any test seams are missing at phase start. Based on RESEARCH.md, the following are expected:*

- [ ] `brain/src/noesis_brain/ananke/__init__.py` — package skeleton
- [ ] `brain/tests/ananke/conftest.py` — shared fixtures (drive config loader, rng stub)
- [ ] `brain/tests/ananke/test_drives_determinism.py` — replay-at-two-tick-rates harness
- [ ] `brain/tests/ananke/test_drives_bounds.py` — clamping at 0.0/1.0 property tests
- [ ] `grid/test/ananke/append-drive-crossed.test.ts` — closed-tuple + threshold-only + sole-producer
- [ ] `grid/test/privacy/drive-forbidden-keys.test.ts` — three-tier grep (emitter/wire/dashboard) extending Phase 6 matrix
- [ ] `grid/test/audit/zero-diff-ananke.test.ts` — chain head = baseline + N ananke.drive_crossed
- [ ] `grid/test/ci/ananke-no-walltime.test.ts` — grep gate forbidding Date.now / performance.now / setInterval in `grid/src/ananke/**`
- [ ] `brain/tests/ci/ananke-no-walltime.test.py` — grep gate for `time.time`, `time.monotonic`, `time.sleep` in `brain/src/noesis_brain/ananke/**`
- [ ] `grid/test/audit/audit-size-ceiling.test.ts` — 1000-tick × 5-drive × 1-Nous ≤ 50-entries regression

*Planner confirms exact file names match project convention before locking.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard Drives panel renders icons (not floats) | DRIVE-05 render surface | Visual verification; screenshots/snapshot tests can still be automated | Load dashboard, open Nous inspector, confirm 5 drive rows each render as tier icon; confirm no numeric drive values appear in any visible DOM text node |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s quick / < 6min full
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
