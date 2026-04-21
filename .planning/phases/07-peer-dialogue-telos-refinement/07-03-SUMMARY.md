---
phase: 07
plan: 03
subsystem: grid/audit + grid/integration
tags: [allowlist, producer-boundary, telos-refined, authority-check, doc-sync, zero-diff, privacy-matrix]
requires:
  - 07-01 (Grid DialogueAggregator + recentDialogueIds seam)
  - 07-02 (Brain ActionType.TELOS_REFINED emission)
provides:
  - telos.refined (17th broadcast allowlist event)
  - appendTelosRefined (sole-producer boundary)
  - NousRunner case 'telos_refined' (authority-checked audit emit)
  - 17-event allowlist invariant (check-state-doc-sync.mjs)
affects:
  - grid/src/audit/broadcast-allowlist.ts (16→17)
  - grid/src/audit/index.ts (re-exports)
  - grid/src/integration/nous-runner.ts (case branch)
  - .planning/STATE.md (allowlist enumeration)
  - README.md (Phase 7 ship callout)
  - scripts/check-state-doc-sync.mjs (count bump)
tech-stack:
  added: []
  patterns:
    - Phase-6 appendOperatorEvent clone (sole producer boundary)
    - Closed N-key payload tuple with Object.keys().sort() check
    - Regex guards (DID_RE / HEX64_RE / DIALOGUE_ID_RE) at producer entry
    - Silent-drop at runner boundary (transport-layer rejection)
    - payloadPrivacyCheck belt-and-suspenders regression gate
key-files:
  created:
    - grid/src/audit/append-telos-refined.ts (105 lines)
    - grid/test/audit/allowlist-seventeen.test.ts (4 tests)
    - grid/test/audit/telos-refined-privacy.test.ts (10 tests)
    - grid/test/audit/telos-refined-producer-boundary.test.ts (2 tests)
    - grid/test/integration/telos-refined-runner-branch.test.ts (6 tests)
  modified:
    - grid/src/audit/broadcast-allowlist.ts (+telos.refined, header)
    - grid/src/audit/index.ts (appendTelosRefined + regex re-exports)
    - grid/src/integration/nous-runner.ts (case 'telos_refined' + import)
    - grid/test/audit/broadcast-allowlist.test.ts (16→17, Rule 1)
    - scripts/check-state-doc-sync.mjs (16→17 + header + required)
    - .planning/STATE.md (allowlist enumeration + Plan 07-03 context)
    - README.md (Phase 7 callout + test coverage line)
decisions:
  - D-31 producer-boundary clone (Phase 6 appendOperatorEvent pattern)
  - Authority check via recentDialogueIds (T-07-20 forgery guard)
  - Closed 4-key payload {did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}
  - Self-report invariant payload.did === actorDid enforced at producer
  - Silent-drop discipline at runner boundary (no logger)
  - Atomic doc-sync commit (CLAUDE.md Documentation Sync Rule 2026-04-20)
metrics:
  duration: ~2h (across session including pre-compaction setup)
  completed: 2026-04-21
  task_count: 3
  tests_added: 23 (4 + 10 + 2 + 6 + 1 allowlist bump)
---

# Phase 7 Plan 03: Grid Producer Boundary + Allowlist 16→17 Summary

Grid-side DIALOG-02 ships — sole-producer helper `appendTelosRefined` wraps the 17th broadcast allowlist event `telos.refined`, `NousRunner` gains an authority-checked `case 'telos_refined':` branch, and all three source-of-truth documents (check-state-doc-sync.mjs + STATE.md + README.md) are reconciled in one atomic commit per the CLAUDE.md Documentation Sync Rule.

## One-liner

Hash-only autonomous Telos refinement from peer dialogue — Brain emits `telos_refined` action, Grid runner verifies dialogue_id authority via 100-cap `recentDialogueIds` Set, sole-producer `appendTelosRefined` writes the 17th allowlist event with a closed 4-key payload; plaintext goals never cross the wire.

## What shipped

### Task 1 — Allowlist 17 + sole-producer helper (TDD)

- **RED** (`8f916a2`): 3 new test files authored, all failing with missing-module / `.toBe(16)≠17` errors.
- **GREEN** (`449cba8`): `broadcast-allowlist.ts` bumped 16→17 with `'telos.refined'` at position 17; `appendTelosRefined` implemented with 5-stage validation (regex guards → self-report invariant → closed-tuple check → explicit reconstruction → privacy gate → append); `index.ts` re-exports `appendTelosRefined`, `TelosRefinedPayload`, `DIALOGUE_ID_RE`, `TELOS_REFINED_DID_RE`, `TELOS_REFINED_HEX64_RE`.
- **Rule 1 auto-fix**: pre-existing `broadcast-allowlist.test.ts` had two Phase-6 assertions (`expect(ALLOWLIST.size).toBe(16)`) — both bumped to `17` and `'telos.refined'` appended to the `it.each` allowlist enumeration.

### Task 2 — NousRunner `case 'telos_refined'` branch (TDD)

- **RED** (`6350676`): integration test `telos-refined-runner-branch.test.ts` (6 scenarios) authored against full `NousRunner` + real `AuditChain` + fake `IBrainBridge`; private-field seam documented via type assertion `(runner as unknown as {recentDialogueIds: Set<string>}).recentDialogueIds.add(id)`.
- **GREEN** (`97040b9`): `case 'telos_refined':` branch added between existing cases in `NousRunner.executeActions`. Authority check rejects unknown `triggered_by_dialogue_id`; successful path routes through `appendTelosRefined`; malformed hashes / missing keys / leaky Brain metadata (e.g. `new_goals`, `prompt`) drop silently — only the 3 canonical metadata keys reach the producer.

### Task 3 — Atomic doc-sync (`1855b70`)

- `scripts/check-state-doc-sync.mjs`: header comment extended with Phase 7 / DIALOG-02 citation; `/16\s+events/i → /17\s+events/i`; `required` array gains `'telos.refined'` (17th entry); final log message reads "17-event allowlist".
- `.planning/STATE.md`: frontmatter (`stopped_at`, `completed_plans: 13→14`, `percent: 87→93`); Current Position advanced (Plan 3→4, Wave 3 complete); Broadcast allowlist section bumped to 17 + Phase 7 annotation; regression-gate sentence bumped; full Plan 07-03 Accumulated Context appended (producer-boundary discipline, closed tuple, self-report invariant, regex lockdown, authority check, silent-drop discipline, zero-diff preservation).
- `README.md`: "Phase 7 pending" → "Plans 01–03 ✅, Plan 04 pending"; new **v2.1 Phase 7 — Peer Dialogue Memory — IN PROGRESS** callout after Phase 6; test coverage line bumped (grid 538→585, brain 277→295).

## Test counts

| Suite | Baseline | After 07-03 | Delta |
|-------|---------:|------------:|------:|
| Grid | 562 | 585 | +23 |
| Brain | 295 | 295 | 0 |
| Dashboard | 274 | 307 | +33 (organic Phase-6/07 incidental) |

New Grid tests (23 total):

- `allowlist-seventeen.test.ts` — 4 tests (frozen-17 invariant, exact-tuple order, `telos.refined` position-17 membership)
- `telos-refined-privacy.test.ts` — 10 tests (happy path + 6 forbidden-key matrix + nested + leaky + self-report mismatch)
- `telos-refined-producer-boundary.test.ts` — 2 tests (grep-style walk of `grid/src/` + sole-caller invariant)
- `telos-refined-runner-branch.test.ts` — 6 tests (valid emit + unknown dialogue_id + malformed before/after hashes + missing metadata + leaky metadata)
- `broadcast-allowlist.test.ts` — 1 existing test bumped (Rule 1 auto-fix to `.toBe(17)` + enumeration row)

## Self-Check: PASSED

- Files created — all present:
  - `grid/src/audit/append-telos-refined.ts` ✓
  - `grid/test/audit/allowlist-seventeen.test.ts` ✓
  - `grid/test/audit/telos-refined-privacy.test.ts` ✓
  - `grid/test/audit/telos-refined-producer-boundary.test.ts` ✓
  - `grid/test/integration/telos-refined-runner-branch.test.ts` ✓
- Commits present in git log:
  - `8f916a2` (Task 1 RED) ✓
  - `449cba8` (Task 1 GREEN) ✓
  - `6350676` (Task 2 RED) ✓
  - `97040b9` (Task 2 GREEN) ✓
  - `1855b70` (Task 3 atomic doc-sync) ✓
- Test suites — all green:
  - Grid: 585/585 (59 files) ✓
  - Brain: 295/295 ✓
  - Dashboard: 307/307 (39 files) ✓
- Doc-sync regression gate: `node scripts/check-state-doc-sync.mjs` → `[state-doc-sync] OK — STATE.md is in sync with the 17-event allowlist.` ✓

## TDD Gate Compliance

Plan 07-03 had `type: tdd` at plan level. Both TDD tasks (Tasks 1 and 2) followed strict RED → GREEN discipline:

- Task 1: `8f916a2` (test) → `449cba8` (feat) ✓
- Task 2: `6350676` (test) → `97040b9` (feat) ✓
- No REFACTOR commit needed — implementation was minimal-to-pass and already at intended discipline.

## Deviations from Plan

### Rule 1 — Auto-fixed bugs

**1. [Rule 1 - Bug] Pre-existing `broadcast-allowlist.test.ts` asserts `.toBe(16)` after allowlist bump**
- **Found during:** Task 1 GREEN (running full audit suite after implementing allowlist 17).
- **Issue:** Two Phase-6 assertions hard-coded `expect(ALLOWLIST.size).toBe(16)` — would fail loudly after `449cba8` bumped the tuple.
- **Fix:** Both literals updated to `17`; `'telos.refined'` appended to `it.each` enumeration (Phase 7 test coverage); test-title comment extended to "Phase 5+Phase 6+Phase 7 event types".
- **Files modified:** `grid/test/audit/broadcast-allowlist.test.ts`
- **Commit:** `449cba8` (folded into the Task 1 GREEN commit — auto-fix scope-bounded to "changes caused by THIS task's bump").

### Rule 3 — Blocking issues auto-fixed

**2. [Rule 3 - Blocker] Plan specified `pnpm test` — project uses npm workspaces + turbo**
- **Found during:** Test-runner invocation attempts throughout all 3 tasks.
- **Issue:** Plan instructions used `pnpm test --run -- <pattern>`; `pnpm` is not installed and `package.json` does not declare it. Root uses npm workspaces + turbo.
- **Fix:** Switched to `cd grid && npx vitest run <pattern>` (direct Vitest invocation — default config globs `**/*.test.ts`). No project-config change needed.
- **Commit:** N/A (test-run command, not code change).

**3. [Rule 3 - Blocker] Plan test snippets used incorrect AuditChain API**
- **Found during:** Task 1 RED authoring.
- **Issue:** Plan snippets referenced `chain.entries` (private) and `event_type` (wrong — the public shape uses camelCase `eventType`, and the query API is `chain.query({eventType}) / chain.all()`).
- **Fix:** Rewrote test-file snippets to use `chain.all()` for full enumeration and `chain.query({eventType: 'telos.refined'})` for filtered queries; asserted `entry.eventType === 'telos.refined'` (camelCase).
- **Files affected:** `telos-refined-privacy.test.ts`, `telos-refined-runner-branch.test.ts`.
- **Commits:** `8f916a2` (Task 1 RED), `6350676` (Task 2 RED).

**4. [Rule 3 - Blocker] Fake `IBrainBridge` missing required interface methods**
- **Found during:** Task 2 RED authoring.
- **Issue:** `IBrainBridge` interface requires `queryMemory` and `forceTelos` methods (added in Phase 6). Initial test fixture omitted them, causing TypeScript errors.
- **Fix:** Added stubs — `queryMemory` returns `{entries: []}`, `forceTelos` returns zero-hash `{telos_hash_before, telos_hash_after}`.
- **Files modified:** `grid/test/integration/telos-refined-runner-branch.test.ts` `makeBridge` helper.
- **Commit:** `6350676`.

### Rule 2 — Missing critical functionality

**5. [Rule 2 - Missing Silent-Drop Discipline] Plan snippet used `log.warn(...)` but nous-runner.ts has no logger**
- **Found during:** Task 2 GREEN implementation.
- **Issue:** Plan snippet for the `case 'telos_refined':` branch called `log.warn(...)` on malformed actions; the runner module imports no logger (Phase 5/6 convention is silent transport-layer rejection, not logging).
- **Fix:** Replaced with `try { appendTelosRefined(...) } catch { /* silent drop */ }`. Rationale: the producer boundary's `TypeError` throws are regression-test signal (they should NEVER fire in shipped code); logging would add noise without actionable operator signal. Matches Phase 5 (trade reviewer) and Phase 6 (operator endpoint validation) precedent.
- **Files modified:** `grid/src/integration/nous-runner.ts` `case 'telos_refined':`.
- **Commit:** `97040b9`.

## Producer-Boundary Proof

`telos-refined-producer-boundary.test.ts` walks every file under `grid/src/**` scanning for the pattern `(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]telos\.refined['"]`. The only file that matches: `grid/src/audit/append-telos-refined.ts`. Verified at both GREEN stages and still green after Task 2 — `nous-runner.ts` calls `appendTelosRefined(this.audit, ...)` not `this.audit.append('telos.refined', ...)`.

## Follow-ups for Plan 07-04

- End-to-end simulation: 2 Nous exchange ≥2 utterances → DialogueAggregator delivers context → Brain emits `telos_refined` → Grid produces `telos.refined` audit entry (full wire path).
- Dashboard audit-viewer surface for `telos.refined` (new event-type filter + row rendering).
- Human-verify checkpoint: run the genesis stack, observe a `telos.refined` entry in the live audit stream.
- Phase 7 closure: move REQ DIALOG-02 to Validated, archive phase directory if applicable, advance STATE → Phase 8.

## Known Stubs

None. Every surface ships functional and wired. The `deferred-items.md` entries (pre-existing tsc errors in `grid/src/db/connection.ts` and `grid/src/main.ts`) remain out-of-scope per scope-boundary rule and are tracked for a future maintenance plan.

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| `8f916a2` | `test(phase-07-plan-03): RED — allowlist 17 + appendTelosRefined privacy + producer boundary` | 3 test files (16 new failing tests) |
| `449cba8` | `feat(phase-07-plan-03): GREEN — allowlist +telos.refined + appendTelosRefined sole producer` | broadcast-allowlist.ts, append-telos-refined.ts, index.ts, broadcast-allowlist.test.ts (Rule 1) |
| `6350676` | `test(phase-07-plan-03): RED — nous-runner telos_refined branch` | telos-refined-runner-branch.test.ts |
| `97040b9` | `feat(phase-07-plan-03): GREEN — nous-runner telos_refined branch + recentDialogueIds authority` | nous-runner.ts |
| `1855b70` | `chore(phase-07-plan-03): doc-sync — allowlist 16→17 across check-script + STATE + README` | check-state-doc-sync.mjs, STATE.md, README.md |

## Authentication gates

None. No external credentials required; test suite runs locally via `npx vitest run` and `uv run pytest`.
