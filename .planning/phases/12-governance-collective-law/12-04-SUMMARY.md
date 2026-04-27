---
phase: 12
plan: 04
subsystem: governance-ci-dashboard
tags: [governance, ci-gates, dashboard, tdd, doc-sync, drift-detector]
dependency_graph:
  requires:
    - 12-03 (Wave 3 — governance routes + Brain modules)
    - dashboard/src/lib/protocol/governance-types.ts (Wave 0)
    - grid/src/governance/types.ts (Wave 0)
    - brain/src/noesis_brain/governance/types.py (Wave 0)
  provides:
    - scripts/check-governance-isolation.mjs (CI gate — VOTE-05 operator exclusion)
    - scripts/check-governance-plaintext.mjs (CI gate — T-09-12 body privacy)
    - scripts/check-governance-weight.mjs (CI gate — VOTE-06 no vote-weighting)
    - dashboard/src/app/grid/governance/ (page + components + hook)
    - dashboard/test/lib/governance-types.drift.test.ts (T-09-17)
    - Phase 12 doc-sync (STATE.md, ROADMAP.md, MILESTONES.md, README.md)
  affects:
    - package.json (pretest: three new CI gates added)
    - .planning/STATE.md (Phase 12 SHIPPED)
    - .planning/ROADMAP.md (Phase 12 complete, allowlist 22→26)
tech_stack:
  added:
    - scripts/check-governance-isolation.mjs (Node 20+ stdlib, no deps)
    - scripts/check-governance-plaintext.mjs (Node 20+ stdlib, no deps)
    - scripts/check-governance-weight.mjs (Node 20+ stdlib, no deps)
  patterns:
    - Clone of check-whisper-plaintext.mjs (fs.readdirSync + regex + filepath allowlist)
    - Clone of whisper-types.drift.test.ts (drift detector pattern)
    - Clone of relationships/page.tsx (Next.js server component + SWR pattern)
    - Native <dialog> element (D-08 project convention — no Radix/Headless)
    - vi.hoisted() + vi.mock() for mutable hook state in vitest
key_files:
  created:
    - scripts/check-governance-isolation.mjs
    - scripts/check-governance-plaintext.mjs
    - scripts/check-governance-weight.mjs
    - dashboard/src/app/grid/governance/page.tsx
    - dashboard/src/app/grid/governance/governance-dashboard.tsx
    - dashboard/src/app/grid/governance/voting-history-modal.tsx
    - dashboard/src/app/grid/governance/use-governance-proposals.ts
    - dashboard/test/components/governance-dashboard.test.tsx
    - dashboard/test/components/governance-voting-history.test.tsx
    - dashboard/test/lib/governance-types.drift.test.ts
  modified:
    - package.json (scripts: 3 new CI gates + pretest extension)
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/MILESTONES.md
    - README.md
decisions:
  - "PHILOSOPHY.md was already correct (26 events, governance invariants) from Wave 0 doc-sync — no edit needed in Wave 4"
  - "check-state-doc-sync.mjs was already at 26 events from Wave 0 — no edit needed in Wave 4"
  - "appendLawTriggered.ts allowlisted in plaintext gate: `description: law.description` is a Law DSL field, not proposal body text"
  - "replay.ts allowlisted in plaintext gate: body_text appears only in zero-diff test fixture strings, not in emitted payload"
  - "React import required in both component files and test files: oxc JSX transform does not auto-inject React in vitest test context"
  - "drift detector uses React.Fragment (not <>) so key prop can be placed on the fragment wrapper, eliminating React key warning"
  - "Python @dataclass regex extractor must handle triple-quoted docstrings with internal blank lines — simple \\n\\n terminator stops inside docstring"
  - "governance-types.ts already existed at dashboard/src/lib/protocol/governance-types.ts from Wave 0; drift test references that path (consistent with project protocol/ convention)"
metrics:
  duration: "~3 hours (continuation from previous context window)"
  completed: "2026-04-27"
  tasks: 4
  files_created: 10
  files_modified: 5
  tests_added: 35
  commits: 5
---

# Phase 12 Plan 04: Wave 4 — CI Gates + Dashboard Governance + Drift Detector + Doc-Sync Summary

**One-liner:** Three CI grep gates locking governance operator exclusion / body privacy / no-vote-weighting; TDD dashboard `/grid/governance` page with tier-aware proposals list + native `<dialog>` H5 voting history; governance type drift detector; Phase 12 doc-sync to SHIPPED state.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | W4-01..03: Three CI grep gates + package.json | d77f997 | scripts/check-governance-*.mjs, package.json |
| 2 (RED) | W4-04 RED: Governance dashboard + voting history tests | 3d7b499 | test/components/governance-dashboard.test.tsx, governance-voting-history.test.tsx |
| 2 (GREEN) | W4-04 GREEN: Governance dashboard + modal implementation | 5365864 | governance-dashboard.tsx, voting-history-modal.tsx, use-governance-proposals.ts, page.tsx |
| 3 | W4-05: Governance types drift detector | 02daab7 | test/lib/governance-types.drift.test.ts |
| 4 | W4-06: Atomic doc-sync — Phase 12 SHIPPED | 1ab2361 | STATE.md, ROADMAP.md, MILESTONES.md, README.md |

## Task Details

### Task 1: Three CI Grep Gates

**check-governance-isolation.mjs** (VOTE-05 / D-12-11):
- Walks `grid/src/governance/**` and `grid/src/api/governance/**`
- Forbidden: import of `operator-events.ts`, `audit.append('operator.*')` calls, import of `api/operator/governance-laws`
- Reverse guard: `operator-events.ts` MUST NOT import from `grid/src/governance/**`
- Exits 0 on clean tree; exits 1 with file:line:match on violation

**check-governance-plaintext.mjs** (T-09-12 / D-12-11):
- Walks governance source in grid + brain
- Property-key regex: `/(?:^|[^a-zA-Z0-9_])(?:text|body|content|description|rationale|proposal_text|law_text|body_text)\s*:/`
- ALLOWLISTED_PATHS (7 files): grid/src/db/schema.ts, grid/src/api/governance/routes.ts, grid/src/governance/store.ts, grid/src/governance/appendProposalOpened.ts, grid/src/governance/appendLawTriggered.ts, brain/src/noesis_brain/governance/proposer.py, grid/src/governance/replay.ts
- Key rationale: appendLawTriggered.ts uses `description: law.description` (Law DSL field); replay.ts has `body_text` in zero-diff test fixture strings

**check-governance-weight.mjs** (VOTE-06 / D-12-11):
- Walks same governance source trees
- Property-key regex: `/(?:^|[^a-zA-Z0-9_])(?:weight|reputation|relationship_score|ousia_weight)\s*:/`
- No allowlist exceptions in v2.2
- Allowlisted in code (but not in script): broadcast-allowlist.ts, governance/types.ts, dashboard governance-types.ts — these DECLARE the forbidden list, not use it as a payload key

**package.json changes:**
- Added: `check:governance:isolation`, `check:governance:plaintext`, `check:governance:weight`, `check:whisper-plaintext` (was missing)
- Extended pretest to include all three governance gates

**Scripts pre-updated in Wave 0:** `check-state-doc-sync.mjs` was already at 26 events with all four governance events. No edit needed. Confirmed by reading the file before Task 1.

### Task 2: Dashboard Governance Page (TDD — RED then GREEN)

**RED commit (3d7b499):** 17 failing tests across two files:
- `governance-dashboard.test.tsx`: 10 tests — tier matrix, VOTE-05 audit (no propose/commit/reveal), loading/error/empty states, proposal_id truncation, outcome display
- `governance-voting-history.test.tsx`: 7 tests — closed by default, open+fetch+render, 403 → "H5 required", close button, backdrop click, Esc key, unrevealed ballot

**GREEN commit (5365864):** All 17 tests pass. Key implementation decisions:
- `React import from 'react'` added to both component files AND test files (oxc JSX transform does not auto-inject React in vitest test context — this is the known project issue documented in whisper panel test comments)
- `React.Fragment key={p.proposal_id}` instead of `<>` on the map wrapper — key prop must be on the fragment, not on the inner `<tr>` (Rule 1 fix: React key warning)
- "View votes" button: `{tier >= 5 && (...)}` — completely absent from DOM for non-H5 (defense in depth; VOTE-05 requires no DOM node, not just disabled)
- VotingHistoryModal: native `<dialog>` with `showModal()`, Esc via `addEventListener('close')`, backdrop via `onClick` checking `ev.target === dialogRef.current`
- SWR: `refreshInterval: 2000, revalidateOnFocus: false` (T-09-16 mitigation, clone of relationships pattern)

### Task 3: Governance Types Drift Detector

**governance-types.drift.test.ts** (T-09-17):
- 18 tests: 8 KEYS array parity (4 × grid-vs-dashboard + 4 × grid-vs-brain), 5 interface key parity (4 TS + 1 Python dataclass), 1 BallotChoice union, 2 SYNC header checks, 2 forbidden-field guards
- Helper challenges:
  - `extractPyTuple`: must split by comma (not newline) to handle single-line Python tuples like `BALLOT_COMMITTED_KEYS = ("commit_hash", "proposal_id", "voter_did")`
  - `extractPyDataclassKeys`: must skip triple-quoted docstrings with internal blank lines; `\n\n`-terminated regex stops inside the docstring's paragraph break. Fixed with a line-by-line state machine that tracks `inDocstring` flag.

**Note:** `dashboard/src/lib/protocol/governance-types.ts` already existed from Wave 0. The drift test references that path (consistent with project convention of placing protocol mirrors in `protocol/`). The plan listed `dashboard/src/lib/governance-types.ts` but the Wave 0 agent correctly placed it in `protocol/`.

### Task 4: Atomic Doc-Sync

Files updated atomically in commit `1ab2361`:

**STATE.md:**
- Current Position: Phase 12 SHIPPED, Phase 13 next
- Broadcast allowlist section: updated header to "Phase 12 — post-ship, Plan 12-04", 22 events → 26 events, added entries 23-26
- Phase 12 accumulated context section added (before Phase 11 section per reverse-chronological convention)

**ROADMAP.md:**
- Phase 12 bullet: `[ ]` → `[x]` with shipped date and allowlist delta
- Plans: all 5 plans checked
- Progress table: 4/5 → 5/5, In Progress → Complete, date added
- Phase 14 plan section: corrected a pre-existing duplicate of Phase 12 plans (copy-paste error in original ROADMAP — replaced with `Plans: 5 plans (Wave 0–4) — TBD`)

**MILESTONES.md:**
- Phase 12 SHIPPED entry appended following canonical Phase 11 format
- Includes: key primitives, invariants sealed, allowlist delta, lessons learned

**README.md:**
- Phase 12 status paragraph added after Phase 11 entry
- Test coverage line updated (1147+ grid, 513+ brain)
- Milestone table updated to include Phase 12 and allowlist events #23–26

**PHILOSOPHY.md:** Already correct from Wave 0 doc-sync — contained "26 events" and the full governance paragraph. No edit needed in Wave 4.

**check-state-doc-sync.mjs:** Exits 0 after all edits.

## Verification Results

```
✅ check-governance-isolation.mjs  — exits 0 (0 violations)
✅ check-governance-plaintext.mjs  — exits 0 (0 violations outside allowlist)
✅ check-governance-weight.mjs     — exits 0 (0 violations)
✅ check-state-doc-sync.mjs        — exits 0 (26-event allowlist confirmed)
✅ Dashboard tests                 — 35/35 (10 dashboard + 7 voting history + 18 drift)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React not defined in component + test JSX**
- **Found during:** Task 2 GREEN (first test run)
- **Issue:** `ReferenceError: React is not defined` in both component files and test files. The oxc JSX transform with `runtime: 'automatic'` doesn't inject React in the vitest test context (known project issue documented in whisper panel test comments).
- **Fix:** Added `import React from 'react'` to governance-dashboard.tsx, voting-history-modal.tsx, governance-dashboard.test.tsx, governance-voting-history.test.tsx
- **Files modified:** 4 files
- **Commit:** 5365864

**2. [Rule 1 - Bug] React key warning on map fragment**
- **Found during:** Task 2 GREEN (console warning in test output)
- **Issue:** `key` prop was on `<tr>` inside `<>` fragment; React warns that the fragment itself needs the key, not a child
- **Fix:** Changed `<>` to `<React.Fragment key={p.proposal_id}>` on the map wrapper; removed redundant `key` from inner `<tr>` and body expansion `<tr>`
- **Files modified:** governance-dashboard.tsx
- **Commit:** 5365864

**3. [Rule 1 - Bug] Python tuple extraction fails for single-line tuples**
- **Found during:** Task 3 (first drift test run — 3 failures)
- **Issue:** `extractPyTuple` split by `\n` and got single elements like `"commit_hash', 'proposal_id', 'voter_did"` for single-line Python tuples
- **Fix:** Changed to split by comma; both single-line and multi-line forms now work
- **Files modified:** governance-types.drift.test.ts
- **Commit:** 02daab7

**4. [Rule 1 - Bug] Python @dataclass extractor terminates early inside docstring**
- **Found during:** Task 3 (second drift test run — 1 remaining failure on ProposalTalliedPayload)
- **Issue:** `ProposalTalliedPayload` docstring has an internal blank line (`\n\n`) that caused the regex to stop before reaching the field declarations
- **Fix:** Replaced regex-based extractor with a line-by-line state machine that tracks `inDocstring` + `docstringDone` flags, skipping content inside triple-quoted docstrings
- **Files modified:** governance-types.drift.test.ts
- **Commit:** 02daab7

**5. [Rule 2 - Missing critical functionality] check-state-doc-sync.mjs was NOT updated in Wave 0 for check:whisper-plaintext**
- **Found during:** Task 1 (reading package.json)
- **Issue:** `check:whisper-plaintext` script existed in scripts/ but was not registered in package.json. Added as part of the CI gate registration sweep.
- **Files modified:** package.json
- **Commit:** d77f997

### Pre-existing state (no edit needed)

- `scripts/check-state-doc-sync.mjs`: already asserted 26 events with all four governance events (updated in Wave 0, confirmed by reading before Task 1)
- `PHILOSOPHY.md`: already carried 26-event allowlist and governance invariant paragraphs (updated in Wave 0)
- `dashboard/src/lib/protocol/governance-types.ts`: already existed from Wave 0 at the correct path

## VOTE-05 Hand-Audit

Confirming: no propose/commit/reveal trigger DOM node exists in the Dashboard governance directory at any tier.

Files scanned: `dashboard/src/app/grid/governance/`
- `governance-dashboard.tsx`: renders "View body" (fetch only, no write) and conditionally `{tier >= 5 && <button>View votes</button>}` — no propose/commit/reveal button
- `voting-history-modal.tsx`: read-only ballot history display — no propose/commit/reveal button
- `use-governance-proposals.ts`: read-only SWR hook
- `page.tsx`: server wrapper, passes tier prop

Test confirmation: `governance-dashboard.test.tsx` test "VOTE-05: no propose/commit/reveal button at any tier (including H5)" — all tier renders checked via `document.body.textContent` for forbidden text.

## TDD Gate Compliance

RED gate: commit `3d7b499` — `test(12-04): W4-04 RED failing tests — governance dashboard + voting history modal`
GREEN gate: commit `5365864` — `feat(12-04): W4-04 GREEN governance dashboard + voting history modal implementation`

Both gates present in commit history. ✅

## Known Stubs

None. All UI components fetch from real API endpoints (no hardcoded empty data flowing to render). The `proposals: data ?? []` fallback is a loading-state default, not a stub.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes beyond what is in the plan's `<threat_model>`. All T-09-12, T-09-14, T-09-15, T-09-16, T-09-17 mitigations confirmed active.

## Self-Check: PASSED

All files verified present and all task commits verified in git history.

| Check | Result |
|-------|--------|
| scripts/check-governance-isolation.mjs | FOUND |
| scripts/check-governance-plaintext.mjs | FOUND |
| scripts/check-governance-weight.mjs | FOUND |
| dashboard/src/app/grid/governance/page.tsx | FOUND |
| dashboard/src/app/grid/governance/governance-dashboard.tsx | FOUND |
| dashboard/test/lib/governance-types.drift.test.ts | FOUND |
| Commit d77f997 (CI gates + package.json) | FOUND |
| Commit 3d7b499 (RED tests) | FOUND |
| Commit 5365864 (GREEN implementation) | FOUND |
| Commit 02daab7 (drift detector) | FOUND |
| Commit 1ab2361 (doc-sync) | FOUND |
