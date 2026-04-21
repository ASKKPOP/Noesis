---
phase: 7
slug: peer-dialogue-telos-refinement
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-21
reviewed_at: 2026-04-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 7 spans three runtimes (TypeScript Grid, Python Brain, Dashboard); this strategy addresses each with matched tooling + a cross-runtime determinism test.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Grid)** | vitest 1.x (existing `grid/package.json`) |
| **Framework (Brain)** | pytest 7.x (existing `brain/pyproject.toml`) |
| **Framework (Dashboard)** | vitest 4.1 (existing `dashboard/package.json`) |
| **Config file (Grid)** | `grid/vitest.config.ts` |
| **Config file (Brain)** | `brain/pyproject.toml` |
| **Config file (Dashboard)** | `dashboard/vitest.config.ts` |
| **Quick run command (Grid)** | `cd grid && pnpm test -- <pattern>` |
| **Quick run command (Brain)** | `cd brain && uv run pytest tests/unit/<file> -x -q` |
| **Quick run command (Dashboard)** | `cd dashboard && pnpm test -- <pattern>` |
| **Full suite command** | `make test` (runs Grid + Brain + Dashboard sequentially) |
| **Estimated runtime** | ~45 seconds (Grid 12s, Brain 18s, Dashboard 15s) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- <file>` for the runtime that changed (or `uv run pytest <file>` on Brain side).
- **After every plan wave:** Run per-runtime full suite (`cd grid && pnpm test` / `cd brain && uv run pytest` / `cd dashboard && pnpm test`).
- **Before `/gsd-verify-work`:** `make test` must be green + `grid/test/dialogue-zero-diff.test.ts` must be green (determinism gate).
- **Max feedback latency:** 30 seconds per runtime.

---

## Per-Task Verification Map

Populated from PLAN.md files 01-04. Every task has an `<automated>` verify command. Wave 0 dependencies indicate test files that must exist before the task's implementation can be verified — these are enumerated in the Wave 0 Requirements section below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-1 | 01 (Grid Aggregator) | 1 | DIALOG-01 | T-07-01..09 | Deterministic dialogue_id derivation (sha256(sortedDids\|channel\|windowStartTick).slice(0,16)); 64-hex DID regex; pause = clean boundary | unit + determinism | `cd grid && pnpm test -- dialogue/dialogue-id dialogue/aggregator --run` | ⬜ W0 | ⬜ pending |
| 1-2 | 01 (Grid Aggregator) | 1 | DIALOG-01 | T-07-01..09 | Bidirectional rolling window (windowTicks=5, minExchanges=2); drain-on-pause; ≤5 utterances + 200-char truncation | unit | `cd grid && pnpm test -- dialogue/aggregator dialogue-boundary --run` | ⬜ W0 | ⬜ pending |
| 1-3 | 01 (Grid Aggregator) | 1 | DIALOG-01 | T-07-01..09 | `dialogue_context` widening on Brain tick payload (additive, backward-compat); zero-diff determinism gate (0-vs-10 listeners byte-identical chain head) | unit + e2e | `cd grid && pnpm test -- dialogue-zero-diff --run && cd grid && pnpm test --run` | ⬜ W0 | ⬜ pending |
| 2-1 | 02 (Brain Telos Refined) | 2 | DIALOG-02 | T-07-10..13 | `ActionType.TELOS_REFINED` additive enum extension; `_build_refined_telos` clones handler.py:376 hash-before/hash-after ordering; closed 3-key metadata dict (before_goal_hash, after_goal_hash, triggered_by_dialogue_id); no-op silence when before==after; malformed dialogue_id silently dropped | unit | `cd brain && uv run pytest tests/unit/test_types.py tests/unit/test_telos_refined_action.py -x -q` | ⬜ W0 | ⬜ pending |
| 2-2 | 02 (Brain Telos Refined) | 2 | DIALOG-02 | T-07-14..16 | `on_tick` reads `params.get("dialogue_context")`; backward-compat NOOP path when empty/missing; non-matching context → NOOP; boundary 200-char utterance respected | unit | `cd brain && uv run pytest tests/unit/test_dialogue_context_consumption.py -x -q` | ⬜ W0 | ⬜ pending |
| 3-1 | 03 (Allowlist + Producer Boundary) | 3 | DIALOG-02 | T-07-20..26 | Allowlist grows 16→17 with `telos.refined` at position 17 (frozen); sole producer helper `appendTelosRefined` enforces 5-step validation (DID regex both sides + self-report + HEX64 + DIALOGUE_ID_RE + closed 4-key tuple); privacy matrix 1×8 (1 native pass + 7 forbidden-key drops + happy baseline) | unit + source-invariant | `cd grid && pnpm test -- allowlist-seventeen telos-refined-privacy telos-refined-producer-boundary --run` | ⬜ W0 | ⬜ pending |
| 3-2 | 03 (Allowlist + Producer Boundary) | 3 | DIALOG-02 | T-07-27..29 | NousRunner `case 'telos_refined'` reads metadata; `recentDialogueIds` rolling Set (N=100) forgery authority check; drops silently on miss; try/catch around `appendTelosRefined`; `did: this.nousDid` injected (not forwarded from Brain) | unit | `cd grid && pnpm test -- telos-refined-runner-branch --run` | ⬜ W0 | ⬜ pending |
| 3-3 | 03 (Allowlist + Producer Boundary) | 3 | DIALOG-02 | T-07-30 | Doc-sync triad per CLAUDE.md (2026-04-20): `scripts/check-state-doc-sync.mjs` count regex 16→17 + required-array append; `.planning/STATE.md` "16 events"→"17 events" + bullet append; `README.md` count update or explicit no-op note — all in same task/commit | integration | `node scripts/check-state-doc-sync.mjs` | ⬜ W0 | ⬜ pending |
| 4-1 | 04 (Inspector + Firehose Filter) | 4 | DIALOG-03 | T-07-40..44, 54 | Chip primitive gains `'dialogue'` variant (indigo-400 #818CF8, border 1px on #17181C); `useFirehoseFilter` regex-gates URL param to `DIALOGUE_ID_RE`; `useRefinedTelosHistory` derives over existing `useFirehose` (zero new RPC); malformed events silently dropped; useMemo reference stability | unit + source-invariant | `cd dashboard && pnpm test -- primitives.test use-firehose-filter use-refined-telos-history --run && pnpm tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 4-2 | 04 (Inspector + Firehose Filter) | 4 | DIALOG-03 | T-07-45..48, 52..54 | `<TelosRefinedBadge>` absent (no DOM) on refinedCount===0; click-through URL carries both `tab=firehose` AND `firehose_filter=dialogue_id:<lastId>`; aria-labels byte-match 07-UI-SPEC §Copywriting; `<FirehoseFilterChip>` renders literal `dialogue_id:` prefix + mono value + × clear button; source-invariant grep test asserts #818CF8 scoped to 7 allowlisted files only; no `new_goals`/`goal_description`/`utterance` in components | unit + source-invariant | `cd dashboard && pnpm test -- telos-refined-badge firehose-filter-chip --run && pnpm tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 4-3 | 04 (Inspector + Firehose Filter) | 4 | DIALOG-03 | T-07-49..53 | TelosSection threads `did` to badge; badge rendered at panel-level (outside any `[data-testid^="goal-"]`); empty-goals + refined-count coexist; Firehose dim-not-hide (matching rows full opacity, non-matching `opacity-40 pointer-events-none`); zero-diff when filter null; MILESTONES.md append per CLAUDE.md phase-ship trigger; end-to-end `make test` exit 0 | integration + e2e | `cd dashboard && pnpm test -- inspector-sections/telos firehose --run && pnpm tsc --noEmit && cd /Users/desirey/Programming/src/No\u0113sis && make test` | ⬜ W0 | ⬜ pending |

**Legend — File Exists column:** ⬜ W0 = Wave 0 must create the test file scaffold first. ✅ = file exists. **Status column:** ⬜ pending = not yet executed. ✅ = green. ❌ = red (blocks).

---

## Wave 0 Requirements

Wave 0 is the foundation — test scaffolding MUST exist before any Wave 1+ code is written. Per research (§Wave 0 Gap List), the following files must be created before any implementation task runs:

### Grid (TypeScript)
- [ ] `grid/test/dialogue/aggregator.test.ts` — unit tests for `DialogueAggregator` (window trigger, pair_key, bidirectional rule, drain-on-pause)
- [ ] `grid/test/dialogue/dialogue-id.test.ts` — deterministic `sha256(sortedDids|channel|windowStartTick)` derivation; both sides derive same id
- [ ] `grid/test/dialogue/producer-boundary.test.ts` — `appendTelosRefined` helper: drops `new_goals`, enforces 64-hex + 16-hex regex, closed 4-key payload
- [ ] `grid/test/dialogue-zero-diff.test.ts` — **determinism gate**: 100-tick simulation, 0 vs 10 listeners → byte-identical chain head
- [ ] `grid/test/dialogue-privacy.test.ts` — privacy invariant: broadcast payload never contains utterance content, goal string, or memory ref (grep-style assertion on serialized events)
- [ ] `grid/test/allowlist-seventeen.test.ts` — `ALLOWLIST_MEMBERS.length === 17` + position 17 = `telos.refined`
- [ ] `grid/test/dialogue-boundary.test.ts` — SC#5: varies `config.dialogue.windowTicks` (3, 5, 7) and asserts trigger fires/doesn't at each boundary
- [ ] `grid/test/telos-refined-runner-branch.test.ts` — Plan 03 Task 2: NousRunner `case 'telos_refined'` branch (recentDialogueIds miss → silent drop; match → appendTelosRefined called with did injection)

### Brain (Python)
- [ ] `brain/tests/unit/test_telos_refined_action.py` — `ActionType.TELOS_REFINED` emission, metadata shape, hash-before/hash-after computation
- [ ] `brain/tests/unit/test_dialogue_context_consumption.py` — Brain handler reads `dialogue_context` from tick payload; ≤5 utterances; 200-char truncation respected
- [ ] `brain/tests/fixtures/dialogue_contexts.py` — shared fixtures with sample `DialogueContext` payloads

### Dashboard (TypeScript/React)
- [ ] `dashboard/src/components/dialogue/telos-refined-badge.test.tsx` — badge visibility, testid hooks, panel-level attach, aria-label, click-through URL
- [ ] `dashboard/src/lib/hooks/use-refined-telos-history.test.ts` — client-side firehose filter; zero new RPC; returns `{lastRefinedDialogueId, refinedCount, refinedAfterHashes}`
- [ ] `dashboard/src/lib/hooks/use-firehose-filter.test.ts` — DIALOGUE_ID_RE regex gate; setFilter/clear router.push roundtrip
- [ ] `dashboard/src/app/grid/components/firehose-filter-chip.test.tsx` — filter chip visibility when `?firehose_filter=dialogue_id:<16-hex>` is active; × clears

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Brain LLM "decides to refine" | DIALOG-02 | LLM outputs vary per model revision; determinism not guaranteed at the prompt layer | Run `uv run python -m noesis_brain.simulate --dialogue --turns 50`; manually confirm at least one `telos.refined` action appears in the audit chain. Document as `.planning/phases/07-peer-dialogue-telos-refinement/07-MANUAL-VERIFY.md`. |
| Visual polish — indigo-400 badge reads as "informational" vs operator tier palette | DIALOG-03 | Color tone perception is subjective | Load dashboard with seeded `telos.refined` history; capture Playwright screenshot; eyeball against Phase 6 06-UI-SPEC.md palette table. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (13 files enumerated above — 12 from research gap list + `telos-refined-runner-branch.test.ts` added by Plan 03)
- [x] No watch-mode flags (`--watch` forbidden in automated commands)
- [x] Feedback latency < 30s per runtime
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Zero-diff determinism test (`grid/test/dialogue-zero-diff.test.ts`) is part of `make test` and must be green before /gsd-verify-work
- [x] Privacy invariant test (`grid/test/dialogue-privacy.test.ts` + per-runtime source-invariant tests in Plans 03 and 04) enforces hash-only boundary at three stack levels: Grid producer boundary, dashboard hook, dashboard component

**Approval:** populated by gsd-planner 2026-04-21; awaiting checker sign-off.
