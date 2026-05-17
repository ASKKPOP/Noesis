---
phase: 5
slug: reviewernous-objective-only-pre-commit-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution of ReviewerNous (objective-only pre-commit review).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Grid)** | vitest (from `grid/package.json` per RESEARCH §RQ10) |
| **Framework (Brain)** | pytest (from `brain/pyproject.toml`) |
| **Config file (Grid)** | `grid/vitest.config.ts` |
| **Config file (Brain)** | `brain/pyproject.toml` (pytest config) |
| **Quick run command** | `cd grid && npx vitest run test/review test/audit` |
| **Full suite command** | `npm test && (cd brain && pytest test/ -q)` |
| **Estimated runtime** | Grid ~12s, Brain ~18s, combined ~30s |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npx vitest run test/review test/audit` (targeted — finishes < 5s)
- **After every plan wave:** Run `npm test` (Grid 346+ tests + Phase 5 additions)
- **Before `/gsd-verify-work`:** Full suite must be green (grid + brain)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*Populated by the planner. The table below is the schema the planner MUST fill as tasks are written.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | REV-02 | — | Reviewer reason codes are closed enum; union exhaustiveness check | unit | `cd grid && npx vitest run test/review/codes.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | REV-01 | — | Each of 5 checks has a distinct handler registered in CHECKS | unit | `cd grid && npx vitest run test/review/checks.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 0 | REV-04 | — | Subjective-keyword contract test fails if handler source contains `fairness\|wisdom\|taste\|quality\|novelty\|good\|bad\|should` | unit | `cd grid && npx vitest run test/review/contract.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | REV-03 | — | Reviewer singleton — second construction throws `'already constructed'` | unit | `cd grid && npx vitest run test/review/reviewer.singleton.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | REV-01 | — | First-fail-wins — reviewer returns first failing check; payload `failed_check` from closed enum | unit | `cd grid && npx vitest run test/review/reviewer.first-fail.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 1 | REV-01 | — | Happy path — all 5 checks pass → verdict "pass" | unit | `cd grid && npx vitest run test/review/reviewer.pass.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | REV-01 | — | Brain emits `memoryRefs: list[str]` + `telosHash: str` in trade_request action payload | unit (pytest) | `cd brain && pytest test/test_trade_request_shape.py` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 2 | REV-01/02 | — | 3-event correlation: trade.proposed → trade.reviewed → trade.settled on pass | integration | `cd grid && npx vitest run test/integration/trade-review-flow.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 2 | REV-02 | — | On verdict fail: trade.reviewed{fail} emitted; NO trade.settled emitted | integration | `cd grid && npx vitest run test/integration/trade-review-abort.test.ts` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 3 | REV-02 | — | `trade.reviewed` added to allowlist; frozen-set mutation still throws | unit | `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts` | ✅ (append cases) | ⬜ pending |
| 5-04-02 | 04 | 3 | REV-02 | — | `trade.reviewed` payload passes FORBIDDEN_KEY_PATTERN privacy check (D-12) | unit | `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts` | ✅ (append cases) | ⬜ pending |
| 5-04-03 | 04 | 3 | (all REV) | — | Zero-diff invariant (D-13): 100-tick sim with fake timers; chain tuples identical except for `trade.reviewed` entries | integration | `cd grid && npx vitest run test/review/zero-diff.test.ts` | ❌ W0 | ⬜ pending |
| 5-05-01 | 05 | 3 | — | — | STATE.md allowlist count = 11; `trade.countered` absent; `nous.direct_message` present (D-11) | doc assert | `node scripts/check-state-doc-sync.mjs` (new) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/src/review/` directory created with `codes.ts`, `checks.ts`, `Reviewer.ts`, `index.ts` stubs
- [ ] `grid/test/review/` directory created — mirrors `grid/test/audit/` conventions
- [ ] `grid/test/review/codes.test.ts` — stub asserting `ReviewFailureCode` union has 5 members (compile-time via type test)
- [ ] `grid/test/review/checks.test.ts` — stub enumerating registered checks
- [ ] `grid/test/review/contract.test.ts` — stub for subjective-keyword regex grep (D-10)
- [ ] `grid/test/review/reviewer.singleton.test.ts` — stub (constructs once, asserts second throws)
- [ ] `grid/test/review/reviewer.first-fail.test.ts` — stub (first failing check wins)
- [ ] `grid/test/review/reviewer.pass.test.ts` — stub (happy path)
- [ ] `grid/test/integration/trade-review-flow.test.ts` — stub (3-event correlation)
- [ ] `grid/test/integration/trade-review-abort.test.ts` — stub (fail path — no settled)
- [ ] `grid/test/review/zero-diff.test.ts` — stub using `vi.useFakeTimers()` + `vi.setSystemTime()` pattern from `launcher.tick-audit.test.ts`
- [ ] `brain/test/test_trade_request_shape.py` — stub asserting trade_request payload includes `memoryRefs` and `telosHash`
- [ ] `scripts/check-state-doc-sync.mjs` — new script that greps STATE.md for the 11-event allowlist assertion + absence of phantom `trade.countered`

*Framework already installed — no install task needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual confirmation of 3-event flow in Dashboard firehose | REV-02 | Dashboard firehose is a rendered real-time stream — hard to assert in pure unit test; automated integration test above covers correlation deterministically | Launch Genesis Grid, spawn 2 Nous, trigger one trade, watch firehose for `trade.proposed` → `trade.reviewed` → `trade.settled`. Repeat with injected reviewer failure. |

*All functional correctness has automated verification — manual step is presentation-layer only.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter
- [ ] Planner to promote `wave_0_complete: true` once plan 01 tasks are defined

**Approval:** pending
