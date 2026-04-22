---
phase: 10a
slug: ananke-drives-inner-life-part-1
status: final
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-21
updated: 2026-04-22
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
| 10a-01-01 | 01 | 1 | DRIVE-01, DRIVE-02 | T-09-01 / T-09-03 | Pure-Python drive math with closed enum; zero wall-clock reads | unit/property | `cd brain && pytest test/ananke/ -q --no-header 2>&1 \| head -30` | ❌ W0 | ⬜ pending |
| 10a-01-02 | 01 | 1 | DRIVE-02 | T-09-03 | Byte-identical replay at tickRateMs=1000 vs 1_000_000; monotonic rise + baseline pull | unit/integration | `cd brain && pytest test/ananke/ -q` | ❌ W0 | ⬜ pending |
| 10a-02-01 | 02 | 1 | DRIVE-03, DRIVE-05 | T-09-02 | Allowlist exactly 19 slots incl. `ananke.drive_crossed`; forbidden siblings rejected | unit/grep | `cd grid && pnpm vitest run test/audit/allowlist-nineteen.test.ts test/privacy/drive-forbidden-keys.test.ts -q` | ❌ W0 | ⬜ pending |
| 10a-02-02 | 02 | 1 | DRIVE-03, DRIVE-05 | T-09-02 | Sole-producer `appendAnankeDriveCrossed`; closed-tuple payload strict equality | unit/integration | `cd grid && pnpm vitest run src/ananke test/ananke -q` | ❌ W0 | ⬜ pending |
| 10a-03-01 | 03 | 2 | DRIVE-02 | T-09-03 | AnankeLoader yields deterministic config; seed+tick wired through signature | unit | `cd brain && pytest test/ananke/test_loader.py -q` | ❌ W0 | ⬜ pending |
| 10a-03-02 | 03 | 2 | DRIVE-02, DRIVE-04 | T-09-03 / — | RPC handler emits `ActionType.DRIVE_CROSSED`; advisory divergence logged privately, not coercive | integration | `cd brain && pytest test/ananke/test_handler_ananke.py -q` | ❌ W0 | ⬜ pending |
| 10a-04-01 | 04 | 2 | DRIVE-03 | T-09-02 | Grid `BrainActionDriveCrossed` variant + `case 'drive_crossed'` dispatcher branch type-safe | unit | `cd grid && pnpm tsc --noEmit 2>&1 \| head -30` | ❌ W0 | ⬜ pending |
| 10a-04-02 | 04 | 2 | DRIVE-03, DRIVE-05 | T-09-02 | End-to-end: Brain DRIVE_CROSSED action → Grid dispatcher → sole-producer append → audit entry | integration | `cd grid && pnpm vitest run test/integration/nous-runner-ananke.test.ts test/integration/brain-action-to-audit.test.ts -q` | ❌ W0 | ⬜ pending |
| 10a-05-01 | 05 | 3 | DRIVE-05 | T-09-02 | SYNC-mirrored threshold config; drift detector fails on Brain/Dashboard divergence | unit | `cd dashboard && pnpm vitest run src/lib/hooks/use-ananke-levels.test.ts test/lib/ananke-types.drift.test.ts -q` | ❌ W0 | ⬜ pending |
| 10a-05-02 | 05 | 3 | DRIVE-05 | T-09-02 | Drives panel renders icons only (no numeric floats); 45-state aria matrix; privacy grep on render surface | unit/grep | `cd dashboard && pnpm vitest run src/app/grid/components/inspector-sections/ananke.test.tsx test/privacy/drive-forbidden-keys-dashboard.test.ts -q` | ❌ W0 | ⬜ pending |
| 10a-06-01 | 06 | 4 | DRIVE-01..05 | T-09-01 / T-09-02 / T-09-03 | Zero-diff regression + 1000×5×1 ≤ 50 audit entries + wall-clock grep gates (Brain + Grid) | integration/grep | `cd grid && npx vitest run test/audit/zero-diff-ananke.test.ts test/audit/audit-size-ceiling-ananke.test.ts test/ci/ananke-no-walltime.test.ts && cd ../brain && pytest test/test_ananke_no_walltime.py` | ❌ W0 | ⬜ pending |
| 10a-06-02 | 06 | 4 | DRIVE-01..05 | — | Human-verify checkpoint: all gates green, manual smoke on Drives panel | checkpoint | *gate:blocking — manual per plan 10a-06* | N/A | ⬜ pending |
| 10a-06-03 | 06 | 4 | DRIVE-01..05 | — | Doc-sync: ROADMAP/MILESTONES/STATE/PROJECT/README reflect phase completion | grep/integration | `node scripts/check-state-doc-sync.mjs && grep -c "10a-06-PLAN.md" .planning/ROADMAP.md && grep -c "ananke.drive_crossed" .planning/STATE.md && grep -c "Phase 10a — Ananke Drives" .planning/MILESTONES.md && grep -c "v2.2 Phase 10a — Ananke Drives — SHIPPED" README.md` | ❌ W0 | ⬜ pending |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (13/13 tasks mapped)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only 10a-06-02 is checkpoint; flanked by automated 10a-06-01 and 10a-06-03)
- [x] Wave 0 covers all MISSING references (per §Wave 0 Requirements above)
- [x] No watch-mode flags (all commands use `-q` / `vitest run` / `pytest -q`)
- [x] Feedback latency < 60s quick / < 6min full (pytest -q ~12s, vitest run ~18s, full suite ~6min)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-22
