---
phase: 16
slug: hypnos-consolidating-memory
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Brain framework** | pytest + pytest-asyncio |
| **Grid framework** | vitest ^2.0.0 |
| **Brain config** | `brain/pyproject.toml` |
| **Grid config** | `grid/vitest.config.ts` |
| **Quick Brain run** | `cd brain && pytest test/hypnos/ -x -q` |
| **Quick Grid run** | `cd grid && vitest run grid/test/sleep/` |
| **Full suite (Brain)** | `cd brain && pytest test/ -q` |
| **Full suite (Grid)** | `cd grid && npm test` |
| **Estimated runtime** | ~30 seconds (Brain unit + Grid vitest) |

---

## Sampling Rate

- **After every task commit:** Run `cd brain && pytest test/hypnos/ -x -q` / `cd grid && vitest run grid/test/sleep/`
- **After every plan wave:** Run full suite: `cd brain && pytest test/ -q` + `cd grid && npm test`
- **Before `/gsd-verify-work`:** Full Brain + Grid suites must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 0 | HYP-04 | T-16-01 | Allowlist positions 31-32 carry `{nous_did, tick, ltm_snapshot_hash}` | unit | `cd grid && npm test` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 0 | HYP-01..05 | — | Red test stubs exist for all requirements | unit | `cd brain && pytest test/hypnos/ -x -q` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | HYP-01 | — | WorkingMemory(maxlen=7): 8 inserts → 7 retained | unit | `pytest brain/test/hypnos/test_working_memory.py -x` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | HYP-01 | T-16-03 | WorkingMemory deterministic given (seed, tick) | unit | `pytest brain/test/hypnos/test_working_memory.py::test_determinism -x` | ❌ W0 | ⬜ pending |
| 16-02-03 | 02 | 1 | HYP-02 | T-16-03 | LtmStore: fixed (seed, episodes, η) → byte-identical graph replay | unit | `pytest brain/test/hypnos/test_ltm_determinism.py -x` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 2 | HYP-03 | — | SHY boundedness: 100 cycles → max_weight ≤ η/(1−σ) + ε (≤ 0.21) | unit | `pytest brain/test/hypnos/test_shy_boundedness.py -x` | ❌ W0 | ⬜ pending |
| 16-03-02 | 03 | 2 | HYP-05 | — | LTM retrieval SQL GROUP BY < 10ms p95 on 1000-node graph | perf | `pytest brain/test/hypnos/test_ltm_retrieval_perf.py -x` | ❌ W0 | ⬜ pending |
| 16-03-03 | 03 | 2 | HYP-04 | T-16-02 | Sleep trigger uses asyncio.create_task — never await in on_tick | unit | `pytest brain/test/hypnos/test_sleep_trigger.py -x` | ❌ W0 | ⬜ pending |
| 16-04-01 | 04 | 3 | HYP-04 | T-16-01 | sole-producer emitter closed-tuple: `{nous_did, tick, ltm_snapshot_hash}` | unit | `vitest run grid/test/sleep/sleep-producer-boundary.test.ts` | ❌ W0 | ⬜ pending |
| 16-04-02 | 04 | 3 | HYP-04 | T-16-01 | Privacy: no ltm_content/concept_text/graph_data in emitter payloads | grep | `vitest run grid/test/sleep/sleep-privacy.test.ts` | ❌ W0 | ⬜ pending |
| 16-04-03 | 04 | 3 | HYP-04 | T-16-04 | Zero-diff: 100-tick sim hypnos enabled/disabled → byte-identical chain except sleep.* | integration | `pytest brain/test/hypnos/test_zero_diff.py -x` | ❌ W0 | ⬜ pending |
| 16-05-01 | 05 | 4 | D-16-10 | T-16-03 | CI grep: no wall-clock in brain/src/noesis_brain/hypnos/** | grep gate | `pytest brain/test/test_hypnos_no_walltime.py -x` | ❌ W0 | ⬜ pending |
| 16-05-02 | 05 | 4 | D-16-10 | T-16-01 | CI grep three-tier: no forbidden LTM keys in Grid/Brain/Dashboard | grep gate | `vitest run grid/test/sleep/sleep-privacy.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `brain/test/hypnos/` directory with `__init__.py`
- [ ] `brain/test/hypnos/test_working_memory.py` — HYP-01 stubs
- [ ] `brain/test/hypnos/test_ltm_determinism.py` — HYP-02 stub
- [ ] `brain/test/hypnos/test_shy_boundedness.py` — HYP-03 stub
- [ ] `brain/test/hypnos/test_zero_diff.py` — HYP-04 stub
- [ ] `brain/test/hypnos/test_ltm_retrieval_perf.py` — HYP-05 stub
- [ ] `brain/test/test_hypnos_no_walltime.py` — D-16-10 wall-clock grep gate
- [ ] `grid/test/sleep/sleep-producer-boundary.test.ts` — HYP-04 sole-producer stubs
- [ ] `grid/test/sleep/sleep-privacy.test.ts` — D-16-10 privacy grep gate stubs
- [ ] `grid/src/sleep/` directory with `appendNousSleepEntered.ts`, `appendNousSleepCompleted.ts`, `types.ts`, `index.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Grid ticks continue during sleep (async isolation) | HYP-04 (T-16-02) | Requires runtime observation of tick cadence under sleep load | Run `docker-compose up`, trigger sleep cycle, confirm tick events continue in firehose while sleep is in progress |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
