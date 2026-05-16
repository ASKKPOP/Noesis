---
phase: 19
slug: norm-crystallization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Grid TypeScript) + pytest (Brain Python) |
| **Config file** | `grid/vitest.config.ts` (existing) |
| **Quick run command** | `cd grid && npx vitest run test/norms/` |
| **Full suite command** | `cd grid && npx vitest run && cd ../brain && python -m pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npx vitest run test/norms/`
- **After every plan wave:** Run `cd grid && npx vitest run && cd ../brain && python -m pytest`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 0 | NORM-01 | — | FORBIDDEN_KEY_PATTERN extended | Unit | `cd grid && npx vitest run test/audit/` | ✅ existing | ⬜ pending |
| 19-01-02 | 01 | 0 | NORM-01 | — | ALLOWLIST_MEMBERS.length === 39 pre-norm | Unit | `cd grid && npx vitest run test/audit/` | ✅ existing | ⬜ pending |
| 19-01-03 | 01 | 0 | D-19-03 | — | Brain fingerprint deterministic | Unit | `cd brain && python -m pytest tests/learning/test_rules.py -k fingerprint -x` | ❌ Wave 0 | ⬜ pending |
| 19-01-04 | 01 | 0 | NORM-01 | — | Zero-diff pure-observer gate | Integration | `cd grid && npx vitest run test/norms/zero-diff.test.ts` | ❌ Wave 0 | ⬜ pending |
| 19-01-05 | 01 | 0 | NORM-01 | — | Sole-producer grep gate | Grep | `cd grid && npx vitest run test/norms/norm-producer-boundary.test.ts` | ❌ Wave 0 | ⬜ pending |
| 19-02-01 | 02 | 1 | NORM-01 | — | norm_candidates migration runs | Integration | `cd grid && npx vitest run test/norms/norm-migration.test.ts` | ❌ Wave 1 | ⬜ pending |
| 19-02-02 | 02 | 1 | NORM-03 | — | norm_registry migration runs | Integration | `cd grid && npx vitest run test/norms/norm-migration.test.ts` | ❌ Wave 1 | ⬜ pending |
| 19-03-01 | 03 | 2 | NORM-01 | SPOOFING | appendNormCandidate 10-step validation | Unit | `cd grid && npx vitest run test/norms/appendNormCandidate.test.ts` | ❌ Wave 2 | ⬜ pending |
| 19-03-02 | 03 | 2 | NORM-03 | SPOOFING | appendNormCrystallized 10-step validation | Unit | `cd grid && npx vitest run test/norms/appendNormCrystallized.test.ts` | ❌ Wave 2 | ⬜ pending |
| 19-03-03 | 03 | 2 | NORM-01 | TAMPER | NormDetector sliding window fires at N≥3 distinct DIDs | Unit | `cd grid && npx vitest run test/norms/norm-detector.test.ts` | ❌ Wave 2 | ⬜ pending |
| 19-03-04 | 03 | 2 | NORM-01 | TAMPER | Single-Nous inflation impossible (Set deduplication) | Unit | `cd grid && npx vitest run test/norms/norm-detector.test.ts` | ❌ Wave 2 | ⬜ pending |
| 19-03-05 | 03 | 2 | NORM-01 | INFO-DISC | did:noesis:grid passes DID_RE | Unit | `cd grid && npx vitest run test/norms/appendNormCandidate.test.ts` | ❌ Wave 2 | ⬜ pending |
| 19-04-01 | 04 | 3 | NORM-02 | — | convergence_type emergent when weight>0 edge exists | Unit | `cd grid && npx vitest run test/norms/norm-detector.test.ts` | ❌ Wave 3 | ⬜ pending |
| 19-04-02 | 04 | 3 | NORM-02 | — | convergence_type coincidental when no edge | Unit | `cd grid && npx vitest run test/norms/norm-detector.test.ts` | ❌ Wave 3 | ⬜ pending |
| 19-04-03 | 04 | 3 | NORM-01 | — | GET /api/v1/grid/norms returns crystallized only | Integration | `cd grid && npx vitest run test/norms/norms-api.test.ts` | ❌ Wave 3 | ⬜ pending |
| 19-05-01 | 05 | 4 | NORM-03 | — | Startup rebuild idempotent (same candidateMap) | Integration | `cd grid && npx vitest run test/norms/norm-startup-rebuild.test.ts` | ❌ Wave 4 | ⬜ pending |
| 19-05-02 | 05 | 4 | NORM-01 | — | Full suite green after all phases | Integration | `cd grid && npx vitest run && cd ../brain && python -m pytest` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/norms/zero-diff.test.ts` — covers NORM-01 pure-observer gate
- [ ] `grid/test/norms/norm-producer-boundary.test.ts` — sole-producer grep gate
- [ ] `brain/tests/learning/test_rules.py` — add fingerprint determinism tests (D-19-03)
- Frameworks already installed from prior phases; no new setup needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator can see norm.candidate events in audit firehose WebSocket | NORM-01 | WebSocket streaming requires live runtime | Start Grid, trigger N≥3 Nous to write matching rules, observe norm.candidate in firehose |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
