---
phase: 14
slug: researcher-rigs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x (grid) + pytest (brain) |
| **Config file** | package.json `"test": "vitest run"` (grid); pyproject.toml (brain) |
| **Quick run command** | `cd grid && npx vitest run test/rig/` |
| **Full suite command** | `cd grid && npx vitest run` + `cd brain && pytest` |
| **Estimated runtime** | ~60s (grid unit), ~30s (brain unit) |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npx vitest run test/rig/`
- **After every plan wave:** Run `cd grid && npx vitest run` + `cd brain && pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-W0-01 | Wave 0 | 0 | RIG-01 | T-10-12 | rig.mjs has no httpServer.listen or wsHub | CI grep | `node scripts/check-rig-invariants.mjs` | ❌ Wave 0 | ⬜ pending |
| 14-W0-02 | Wave 0 | 0 | RIG-01 | — | TOML config parses to GenesisConfig correctly | unit | `cd grid && npx vitest run test/rig/toml-config.test.ts -x` | ❌ Wave 0 | ⬜ pending |
| 14-W0-03 | Wave 0 | 0 | RIG-02 | — | Schema name matches `rig_{name}_{seed8}` pattern | unit | `cd grid && npx vitest run test/rig/schema-name.test.ts -x` | ❌ Wave 0 | ⬜ pending |
| 14-W0-04 | Wave 0 | 0 | RIG-02 | — | Nested Rig rejected when NOESIS_RIG_PARENT set | unit | `cd grid && npx vitest run test/rig/nested-rejection.test.ts -x` | ❌ Wave 0 | ⬜ pending |
| 14-W0-05 | Wave 0 | 0 | RIG-03 | — | FixtureBrainAdapter serves JSONL record by key | unit (Python) | `cd brain && pytest test/test_fixture_adapter.py -x` | ❌ Wave 0 | ⬜ pending |
| 14-W0-06 | Wave 0 | 0 | RIG-03 | — | Strict cache-miss raises fatal; --permissive returns stub | unit (Python) | `cd brain && pytest test/test_fixture_adapter.py::test_cache_miss -x` | ❌ Wave 0 | ⬜ pending |
| 14-W0-07 | Wave 0 | 0 | RIG-03 | T-10-13 | No network call path when NOESIS_FIXTURE_MODE=1 | CI grep | `node scripts/check-rig-invariants.mjs` | ❌ Wave 0 | ⬜ pending |
| 14-W0-08 | Wave 0 | 0 | RIG-05 | — | chronos.rig_closed has exactly 5 keys; exit_reason in enum | unit | `cd grid && npx vitest run test/rig/rig-closed-event.test.ts -x` | ❌ Wave 0 | ⬜ pending |
| 14-W0-09 | Wave 0 | 0 | RIG-05 | — | chronos.rig_closed NOT in production allowlist (27 stays 27) | CI grep | `node scripts/check-state-doc-sync.mjs` | ✅ existing gate | ⬜ pending |
| 14-W1-01 | Wave 1 | 1 | RIG-04 | T-10-15 | p99 emit latency <1ms for audit.append() | microbenchmark | `cd grid && npx vitest run test/rig/producer-bench.test.ts -x` | ❌ Wave 1 | ⬜ pending |
| 14-W1-02 | Wave 1 | 1 | RIG-05 | T-10-14 | Tarball hash matches replay-verify output | integration | `cd grid && npx vitest run test/rig/tarball-integrity.test.ts -x` | ❌ Wave 1 | ⬜ pending |
| 14-W2-01 | Wave 2 | 2 | RIG-04 | — | 50 Nous × 10k ticks completes in <60 min | smoke (nightly) | `cd grid && npx vitest run test/rig/rig-bench.test.ts -x` | ❌ Wave 2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/rig/toml-config.test.ts` — stubs for RIG-01 TOML→GenesisConfig mapping
- [ ] `grid/test/rig/schema-name.test.ts` — stubs for RIG-02 deterministic schema naming
- [ ] `grid/test/rig/nested-rejection.test.ts` — stubs for RIG-02 NOESIS_RIG_PARENT guard
- [ ] `grid/test/rig/rig-closed-event.test.ts` — stubs for RIG-05 chronos.rig_closed shape
- [ ] `brain/test/test_fixture_adapter.py` — stubs for RIG-03 FixtureBrainAdapter
- [ ] `scripts/check-rig-invariants.mjs` — CI gate for T-10-12 + T-10-13 grep gates
- [ ] `npm install smol-toml` — TOML parsing dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 50 Nous × 10k ticks <60 min on researcher laptop | RIG-04 | Nightly CI only (too slow for per-commit); requires real MySQL | Run `scripts/rig.mjs config/rigs/bench-50.toml` and check wall-clock time |
| `--full-state` consent prompt verbatim display | RIG-05 (T-10-16) | Terminal UX requires visual inspection | Run with `--full-state`, verify copy matches frozen verbatim string in test |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
