---
phase: 7
slug: peer-dialogue-telos-refinement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
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

*Populated by gsd-planner in PLAN.md files. Each task's `<automated>` block lists the exact test command. This table will be filled in after planning completes.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *TBD after planning* | — | — | DIALOG-01/02/03 | T-07-01 (allowlist leak) | Hash-only producer boundary; no plaintext crosses Grid | unit + e2e | `cd grid && pnpm test -- dialogue` | ⬜ W0 | ⬜ pending |

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

### Brain (Python)
- [ ] `brain/tests/unit/test_telos_refined_action.py` — `ActionType.TELOS_REFINED` emission, metadata shape, hash-before/hash-after computation
- [ ] `brain/tests/unit/test_dialogue_context_consumption.py` — Brain handler reads `dialogue_context` from tick payload; ≤5 utterances; 200-char truncation respected
- [ ] `brain/tests/fixtures/dialogue_contexts.py` — shared fixtures with sample `DialogueContext` payloads

### Dashboard (TypeScript/React)
- [ ] `dashboard/src/components/dialogue/telos-refined-badge.test.tsx` — badge visibility, testid hooks, panel-level attach, aria-label, click-through URL
- [ ] `dashboard/src/lib/hooks/use-refined-telos-history.test.ts` — client-side firehose filter; zero new RPC; returns `{lastRefinedDialogueId, refinedCount, refinedAfterHashes}`
- [ ] `dashboard/src/app/grid/components/firehose-filter-chip.test.tsx` — filter chip visibility when `?firehose_filter=dialogue_id:<16-hex>` is active; × clears

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Brain LLM "decides to refine" | DIALOG-02 | LLM outputs vary per model revision; determinism not guaranteed at the prompt layer | Run `uv run python -m noesis_brain.simulate --dialogue --turns 50`; manually confirm at least one `telos.refined` action appears in the audit chain. Document as `.planning/phases/07-peer-dialogue-telos-refinement/07-MANUAL-VERIFY.md`. |
| Visual polish — indigo-400 badge reads as "informational" vs operator tier palette | DIALOG-03 | Color tone perception is subjective | Load dashboard with seeded `telos.refined` history; capture Playwright screenshot; eyeball against Phase 6 06-UI-SPEC.md palette table. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (12 files enumerated above)
- [ ] No watch-mode flags (`--watch` forbidden in automated commands)
- [ ] Feedback latency < 30s per runtime
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills in task-level verify table
- [ ] Zero-diff determinism test (`grid/test/dialogue-zero-diff.test.ts`) is part of `make test` and passes
- [ ] Privacy invariant test (`grid/test/dialogue-privacy.test.ts`) passes — grep assertion on all serialized broadcast payloads

**Approval:** pending (awaiting planner to populate per-task verification map)
