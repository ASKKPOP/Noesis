---
phase: 10b
slug: bios-needs-chronos-subjective-time-inner-life-part-2
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 10b — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Grid/Dashboard: vitest 1.x (existing). Brain: pytest 7.x (existing). |
| **Config file** | `grid/vitest.config.ts`, `brain/pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `cd grid && bun test --run <filter>` / `cd brain && uv run pytest <path> -q` |
| **Full suite command** | `cd grid && bun test --run && cd ../brain && uv run pytest` |
| **Estimated runtime** | ~60 seconds (grid vitest ~30s + brain pytest ~30s) |

---

## Sampling Rate

- **After every task commit:** Run the relevant package's quick test
- **After every plan wave:** Run the full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled by planner during plan creation. Each task row maps to the plan that produces it.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10b-00-XX | 00 | 0 | Wave 0 scaffolding | T-09-04 / T-09-05 | privacy/determinism/zero-diff stubs green | unit | `bun test grid/test/bios && bun test grid/test/chronos` | ❌ W0 | ⬜ pending |
| 10b-01-XX | 01 | 1 | BIOS-01, BIOS-02, BIOS-03 | T-09-03 | allowlist 19→21; closed-tuple payload strict-eq | unit | `bun test grid/test/audit/allowlist-twenty-one && bun test grid/test/bios/append-bios-birth-boundary && bun test grid/test/bios/append-bios-death-boundary` | ❌ W0 | ⬜ pending |
| 10b-02-XX | 02 | 1 | BIOS-01, BIOS-04 | T-09-03 | brain bios rise-only + baseline; deterministic | unit | `uv run pytest brain/tests/bios -q` | ❌ W0 | ⬜ pending |
| 10b-03-XX | 03 | 2 | CHRONOS-01, CHRONOS-02 | T-09-04 | subjective multiplier Brain-local; audit_tick == system_tick | unit | `uv run pytest brain/tests/chronos -q && bun test grid/test/chronos/no-wire-test` | ❌ W0 | ⬜ pending |
| 10b-04-XX | 04 | 2 | BIOS-03 (H5 cause) | T-09-03 | delete-nous extension appends bios.death in same tick | integration | `bun test grid/test/api/operator/delete-nous-bios-death` | ❌ W0 | ⬜ pending |
| 10b-05-XX | 05 | 2 | CHRONOS-03 | — | epoch_since_spawn derived read; no new RPC/event | unit | `uv run pytest brain/tests/chronos/test_epoch_since_spawn.py` | ❌ W0 | ⬜ pending |
| 10b-06-XX | 06 | 3 | BIOS-01, BIOS-04 | — | dashboard bios panel renders bucket-only, no numeric | e2e | `bun test dashboard/tests/bios-panel` | ❌ W0 | ⬜ pending |
| 10b-07-XX | 07 | 4 | all 10b REQs | T-09-04 | pause/resume zero-diff audit; audit-size ceiling; grep gates; doc-sync | regression | `bun test grid/test/regression/pause-resume-10b && bun test grid/test/ananke/audit-size-ceiling && scripts/check-wallclock-forbidden.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/bios/append-bios-birth-boundary.test.ts` — stubs for BIOS-02 closed-tuple payload + sole-producer gate
- [ ] `grid/test/bios/append-bios-death-boundary.test.ts` — stubs for BIOS-03 closed-tuple payload + cause enum + post-death rejection
- [ ] `grid/test/audit/allowlist-twenty-one.test.ts` — stub asserting 21-event membership (renamed from allowlist-nineteen.test.ts)
- [ ] `grid/test/audit/closed-enum-bios-lifecycle.test.ts` — stub attempting bios.resurrect / bios.migrate / bios.transfer (must fail)
- [ ] `grid/test/privacy/bios-forbidden-keys.test.ts` — stub for BIOS_FORBIDDEN_KEYS privacy matrix (flat + nested)
- [ ] `grid/test/privacy/chronos-forbidden-keys.test.ts` — stub for CHRONOS_FORBIDDEN_KEYS privacy matrix
- [ ] `grid/test/chronos/no-wire-test.ts` — stub asserting no chronos.* allowlist membership + no subjective_multiplier leaks
- [ ] `grid/test/regression/pause-resume-10b.test.ts` — stub cloning `c7c49f49…` hash template for 10b code paths
- [ ] `grid/test/ananke/audit-size-ceiling-10b.test.ts` — extend 10a 1000×5≤50 ceiling to include bios.* events (≤ new budget)
- [ ] `grid/test/api/operator/delete-nous-bios-death.test.ts` — stub for H5 cause → bios.death pair emission
- [ ] `brain/tests/bios/test_needs_determinism.py` — stub for (seed, tick) → byte-identical bios trace
- [ ] `brain/tests/bios/test_needs_baseline.py` — stub for rise-only + passive baseline decay
- [ ] `brain/tests/chronos/test_subjective_multiplier.py` — stub for drive→multiplier formula (D-10b-05)
- [ ] `brain/tests/chronos/test_epoch_since_spawn.py` — stub for derived read over AuditChain cache

*14 Wave 0 stubs total. All stubs RED at Wave 0 completion; plans (Waves 1–4) turn them GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard Bios panel visual polish | BIOS-01 | Visual quality cannot be automated beyond snapshot diff | Open dashboard, spawn Nous, confirm Bios panel shows energy/sustenance as bucket glyphs (not floats), matches 10a DriveIndicator vocabulary. |
| PHILOSOPHY §1 body↔mood separation copy | T-09-05 | Prose quality / editorial review | Read updated PHILOSOPHY.md §1; confirm fatigue framed as physical (Bios), mood-as-Thymos explicitly out of scope in v2.2. |
| ROADMAP §Phase 10b correction visible | D-10b-01 | Reviewer reads diff for intent | Confirm ROADMAP §Phase 10b shows `Allowlist additions: +2 (bios.birth, bios.death)` and `Running total: 21`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (14 stubs)
- [ ] No watch-mode flags (all commands use `--run` / `-q`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
