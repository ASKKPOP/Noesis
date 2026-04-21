---
phase: 05-reviewernous-objective-only-pre-commit-review
plan: 05
subsystem: planning-governance
tags: [doc-sync, regression-gate, state-reconciliation, phase-ship]
requires: [05-01, 05-02, 05-03, 05-04]
provides:
  - scripts/check-state-doc-sync.mjs
  - D-11 reconciled STATE.md
  - Phase 5 ship-time doc-sync completed per CLAUDE.md rule
affects:
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/MILESTONES.md
  - .planning/PROJECT.md
  - README.md
tech-stack:
  added: [node-esm-script]
  patterns: [regex-context-window-check, greppable-doc-sync]
key-files:
  created:
    - scripts/check-state-doc-sync.mjs
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/MILESTONES.md
    - .planning/PROJECT.md
    - README.md
decisions:
  - "Regression gate uses ±200 char context window around `trade.countered` to distinguish phantom/deferred mentions from live-event claims"
  - "Ship-time doc sync committed in two atomic commits (Task 1: STATE + script; Task 2: ROADMAP + MILESTONES + PROJECT + README) rather than one combined commit — keeps the CI-gate addition separable from the status bookkeeping"
  - "PROJECT.md keeps a placeholder comment in Active section noting the REV-01..04 move, preserving traceability across the section boundary"
metrics:
  duration: ~3m
  completed: 2026-04-21
  tasks: 2
  commits: 2
---

# Phase 5 Plan 05: STATE Reconciliation + Doc-Sync Regression Gate — Summary

**One-liner:** Close Phase 5 by reconciling D-11 STATE.md drift, shipping a zero-dep Node ESM regression gate against future allowlist/doc drift, and executing the CLAUDE.md 2026-04-20 Documentation Sync Rule across ROADMAP + MILESTONES + PROJECT + README in the same turn.

## What Shipped

### Task 1 — STATE.md D-11 reconciliation + `scripts/check-state-doc-sync.mjs` (commit `130338b`)

**STATE.md line-range diff summary:**
- Frontmatter (lines 2-14): `stopped_at` → Phase 5 complete; `completed_phases` 0→1; `completed_plans` 3→5; `percent` 60→100
- Project Reference (line 25): `Current focus` → Phase 05 shipped
- Current Position (lines 29-34): Phase status → COMPLETE; progress bar → 100%
- Accumulated Context (line 43): v2.0 baseline clarified as 10 events; historical drift note reframed (phantom `trade.countered` never in code — drift corrected per D-11)
- v2.1 allowlist additions (line 54): Phase 5 `trade.reviewed` marked ✅ shipped
- NEW section (lines 63-77): "Broadcast allowlist (Phase 5 — post-ship)" with explicit 11-event enumeration in code-tuple order + phantom clarification + regression-gate pointer
- NEW section (lines 89-93): "Phase 5 ship decisions (D-01..D-13)" referencing 05-CONTEXT.md; D-11/D-12/D-13 summarized inline
- Open questions (line 97): Q1 (ReviewerNous deployment placement) struck through — resolved in Phase 5
- Session Continuity (lines 101-104): timestamps + next action advanced to Phase 6 planning

**`scripts/check-state-doc-sync.mjs` full source:**

```js
#!/usr/bin/env node
/**
 * STATE.md doc-sync regression gate (Phase 5 / D-11).
 *
 * Asserts the .planning/STATE.md Accumulated Context stays in sync with the
 * frozen broadcast allowlist invariant from grid/src/audit/broadcast-allowlist.ts.
 *
 * Exits 0 when STATE.md is in sync.
 * Exits 1 with a diagnostic when drift is detected.
 *
 * Invariants enforced:
 *   1. STATE.md mentions "11 events" (the Phase-5 post-ship count).
 *   2. All 11 allowlist members appear textually in STATE.md.
 *   3. The phantom `trade.countered` only appears inside a deferred/phantom/never-emitted
 *      context block — never as a live/allowlisted event.
 *
 * If broader allowlist-doc-sync becomes needed (e.g. after Phase 6 adds 5 operator.*
 * events), update the `required` array below and the "11 events" count literal.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const statePath = resolve(repoRoot, '.planning/STATE.md');

if (!existsSync(statePath)) {
  console.error(`[state-doc-sync] FAIL: ${statePath} not found`);
  process.exit(1);
}

const state = readFileSync(statePath, 'utf8');
const failures = [];

// 1. Canonical "11 events" assertion must appear at least once in Accumulated Context.
if (!/11\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "11 events" — Phase 5 allowlist count assertion missing.');
}

// 2. Phantom `trade.countered` must NOT appear as a live/shipped event.
//    It is allowed inside a "deferred" / "future" / "phantom" / "never emitted" context window (±200 chars).
const phantomRegex = /trade\.countered/g;
const phantomMatches = [...state.matchAll(phantomRegex)];
for (const m of phantomMatches) {
  const start = Math.max(0, m.index - 200);
  const end = Math.min(state.length, m.index + 200);
  const ctx = state.slice(start, end).toLowerCase();
  const isMarkedDeferred =
    ctx.includes('deferred') ||
    ctx.includes('future') ||
    ctx.includes('phantom') ||
    ctx.includes('never emitted') ||
    ctx.includes('not emitted') ||
    ctx.includes('not allowlisted');
  if (!isMarkedDeferred) {
    failures.push(
      `STATE.md mentions \`trade.countered\` at index ${m.index} without deferred/phantom qualifier — remove or annotate.`
    );
  }
}

// 3. Every allowlist member MUST appear textually in STATE.md.
const required = [
  'nous.spawned',
  'nous.moved',
  'nous.spoke',
  'nous.direct_message',
  'trade.proposed',
  'trade.reviewed',
  'trade.settled',
  'law.triggered',
  'tick',
  'grid.started',
  'grid.stopped',
];
for (const event of required) {
  const pattern = new RegExp(event.replace(/\./g, '\\.'));
  if (!pattern.test(state)) {
    failures.push(`STATE.md is missing allowlist member \`${event}\` in the Accumulated Context enumeration.`);
  }
}

if (failures.length > 0) {
  console.error('[state-doc-sync] FAIL — doc drift detected:');
  for (const f of failures) console.error('  • ' + f);
  console.error('\nFix: edit .planning/STATE.md to restore the Phase 5 reconciliation (see 05-CONTEXT.md §D-11).');
  process.exit(1);
}

console.log('[state-doc-sync] OK — STATE.md is in sync with the 11-event allowlist.');
process.exit(0);
```

**Break/revert sanity check output (executed during Task 1):**

```
--- break test ---        (after `sed -i '' 's/11 events/10 events/g' .planning/STATE.md`)
[state-doc-sync] FAIL — doc drift detected:
  • STATE.md does not mention "11 events" — Phase 5 allowlist count assertion missing.

Fix: edit .planning/STATE.md to restore the Phase 5 reconciliation (see 05-CONTEXT.md §D-11).
exit: 1

--- revert test ---       (after restoring STATE.md from backup)
[state-doc-sync] OK — STATE.md is in sync with the 11-event allowlist.
exit: 0
```

Regression gate works as specified — exit 1 on drift with clear diagnostic; exit 0 on clean.

### Task 2 — Ship-time doc sync per CLAUDE.md rule (commit `cb7e501`)

**ROADMAP.md changes:**
- Phase 5 section heading: `- [ ]` → `- [x] ... ✅ Complete (2026-04-21)`
- Plan checklist: 05-04 and 05-05 both checked (all 5/5 shipped)
- Progress table row for Phase 5: `2/5 | In progress | —` → `5/5 | ✅ Complete | 2026-04-21`; Phase 6 status `Not started` → `Next up`

**MILESTONES.md changes:**
- Appended new "Sprint 15 / v2.1 — Phase 5 SHIPPED" subsection under the v2.1 milestone with:
  - Ship date 2026-04-21
  - REV-01..04 all closed
  - 5/5 plans listed
  - Key artifacts: `grid/src/review/` module, 5 check handlers, closed-enum `ReviewFailureCode`, REV-04 lint gate, reviewer singleton, 3-event audit flow, schema extension, 11-event allowlist, D-12 privacy regression, D-13 zero-diff regression, D-11 reconciliation, `scripts/check-state-doc-sync.mjs`
  - Key decisions D-01..D-13 pointer
  - Next up: Phase 6

**PROJECT.md changes — REV-01..04 moved from Active to Validated:**

Exact validated wordings added (with `→ Validated in Phase 5` pointer under each):
- `✓ **REV-01**: ReviewerNous validates proposed trades against objective invariants before settlement — v2.1 Phase 5 (shipped 2026-04-21)`
- `✓ **REV-02**: `trade.reviewed` audit event (allowlisted) records review outcome + rejection reason — v2.1 Phase 5 (shipped 2026-04-21)`
- `✓ **REV-03**: ReviewerNous deployed as system singleton (opt-in peer review deferred) — v2.1 Phase 5 (shipped 2026-04-21)`
- `✓ **REV-04**: Reviewer never makes subjective judgments — enforced via closed-enum reason codes + subjective-keyword lint gate — v2.1 Phase 5 (shipped 2026-04-21)`

Active section now has a placeholder comment `<!-- REV-01..04 shipped in Phase 5 (2026-04-21) — moved to Validated above. -->` preserving section-boundary traceability.

**README.md changes:**
- Added a new "v2.1 Phase 5 — ReviewerNous — SHIPPED (2026-04-21)" paragraph in the Project Status section after the "IN PROGRESS" paragraph, stating the public invariant: every `trade.proposed` passes through a deterministic objective-invariant review before settlement; reviewer is a singleton; subjective judgment prohibited by closed-enum reason codes; `memoryRefs` + `telosHash` required brain-side but never leak to broadcast.
- Left the "v2.1 Steward Console — IN PROGRESS" line intact (the milestone itself is still in progress — only Phase 5 of 4 phases has shipped).

## Verification

All verification commands ran green:

```
$ node scripts/check-state-doc-sync.mjs
[state-doc-sync] OK — STATE.md is in sync with the 11-event allowlist.

$ grep -c "REV-01\|REV-02\|REV-03\|REV-04" .planning/PROJECT.md
5   (4 validated + 1 Active-section placeholder comment)

$ grep -c "trade.countered" .planning/STATE.md
3   (all within phantom/historical context — verified by the regression script)

$ grep -c "nous.direct_message" .planning/STATE.md
3

$ grep -c "trade.reviewed" .planning/STATE.md
4
```

Phase 5 full-suite run deferred to the Phase-5-complete verification step (invoked by the wave orchestrator) — this plan only touched docs + one new script; no code paths were modified, so Phase 5 tests from plans 01-04 are unaffected by definition.

## Deviations from Plan

**None.** Plan executed exactly as written.

The plan anticipated the parallel-execution edge case with 05-04 (explicit guidance in the spawn prompt: "proceed with the planned final state — master will converge once both plans commit"). At commit time 05-04's allowlist-addition commit (`c7c9c6c feat(05-04): add trade.reviewed to frozen broadcast allowlist (GREEN)`) was already on master, so the "11 events including trade.reviewed" end state in STATE.md is consistent with both the code (post-05-04 `ALLOWLIST_MEMBERS` tuple) and the docs (this plan's reconciliation).

## CLAUDE.md Discipline Compliance

The user-mandated 2026-04-20 Documentation Sync Rule specifies, for "Phase ships":

> ROADMAP (mark complete), MILESTONES (append), PROJECT (move REQs to Validated), STATE (reset focus), README (update Current status section)

All five files were updated:
- STATE.md ✅ (Task 1)
- ROADMAP.md ✅ (Task 2)
- MILESTONES.md ✅ (Task 2)
- PROJECT.md ✅ (Task 2)
- README.md ✅ (Task 2)

PHILOSOPHY.md intentionally untouched — no worldview-level invariant changed in Phase 5 (the allowlist-freeze-except-by-explicit-addition rule was already frozen in v2.0 and Phase 5 merely exercised its addition mechanism).

Commit grouping: Task 1 and Task 2 shipped in two atomic commits rather than one combined. Rationale: Task 1 introduces a new CI gate (`scripts/check-state-doc-sync.mjs`) that needs to be visibly separable from the status-bookkeeping-only changes of Task 2. Both commits use the `docs(05-05):` prefix so they're clearly grouped as the Phase 5 ship-time ceremony.

## Self-Check: PASSED

- `scripts/check-state-doc-sync.mjs` — FOUND
- `.planning/STATE.md` — FOUND (modified)
- `.planning/ROADMAP.md` — FOUND (modified)
- `.planning/MILESTONES.md` — FOUND (modified)
- `.planning/PROJECT.md` — FOUND (modified)
- `README.md` — FOUND (modified)
- Commit `130338b` — FOUND on master
- Commit `cb7e501` — FOUND on master
