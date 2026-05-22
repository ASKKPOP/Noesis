---
phase: 25c
plan: 05
type: execute
wave: 5
depends_on: [25c-04]
files_modified:
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/MILESTONES.md
autonomous: true
requirements: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11]

must_haves:
  truths:
    - "Grid vitest suite green (no regressions from Wave-0 changes)"
    - "Dashboard vitest suite green (replay-client.test.tsx green)"
    - "Allowlist count unchanged — grep confirms 0 new audit.append calls in 25c files"
    - "Zero charting library imports in steward/src/app/culture/ files"
    - "ROADMAP.md marks Phase 25c complete"
    - "STATE.md updated to Phase 25c done"
  artifacts:
    - path: ".planning/ROADMAP.md"
      provides: "Phase 25c marked complete"
      contains: "25c ✓"
    - path: ".planning/STATE.md"
      provides: "State updated to 25c complete"
      contains: "Phase 25c"
  key_links:
    - from: ".planning/STATE.md"
      to: ".planning/ROADMAP.md"
      via: "Phase completion cross-reference"
      pattern: "25c"
---

<objective>
Regression verification + doc-sync. Run full test suites to confirm Wave-0 changes did not
break Grid or Dashboard. Run grep gates to confirm allowlist delta 0 and charting-lib invariant.
Update ROADMAP, STATE, and MILESTONES to reflect Phase 25c complete.

Purpose: Close the phase cleanly with verified invariants and accurate project documentation.
Output: Modified planning docs; confirmation of all grep gates passing.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/MILESTONES.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-CONTEXT.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-04-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full regression gate + invariant grep checks</name>
  <files></files>
  <read_first>
    - .planning/STATE.md (current state — read allowlist count and check-state-doc-sync references)
    - .planning/phases/25c-replay-scrubber-culture-browser/25c-VALIDATION.md (per-task verification map)
  </read_first>
  <action>
Run all automated regression gates in sequence. Report results. Fix any failures before proceeding to Task 2.

GATE 1 — Grid vitest suite:
```bash
cd grid && npx vitest run --reporter=dot
```
Expected: all existing tests pass. If any fail, diagnose and fix before continuing (the Wave-0 changes to relationships.ts and main.ts are the only Grid files modified).

GATE 2 — Dashboard vitest suite:
```bash
cd dashboard && npx vitest run --reporter=dot
```
Expected: all tests pass including replay-client.test.tsx. If replay-client tests still fail, return to Plan 02 and fix.

GATE 3 — Allowlist delta 0 grep gate (Phase 25c must add 0 new audit events):
```bash
grep -rn "audit\.append\|chain\.append" \
    steward/src/app/replay/ \
    steward/src/app/culture/ \
    grid/src/api/operator/relationships.ts \
    2>/dev/null
```
Expected: 0 matches. If any match, it means a new emit was accidentally added — remove it.

GATE 4 — Raw-SVG invariant (D-9-08 / D-10 — no charting libraries in culture):
```bash
grep -rn "from 'd3\|from \"d3\|from 'recharts\|from 'react-flow\|from 'cytoscape\|import.*recharts\|import.*react-flow\|import.*cytoscape\|import.*d3'" \
    steward/src/app/culture/ \
    2>/dev/null
```
Expected: 0 matches.

GATE 5 — Header-auth migration completeness (D-01 — no body-trust in relationships.ts):
```bash
grep -n "validateTierBody" grid/src/api/operator/relationships.ts
```
Expected: 0 matches.

GATE 6 — humanSanctionStore wiring (D-02):
```bash
grep -n "humanSanctionStore" grid/src/main.ts
```
Expected: at least 2 matches (construction + buildServer spread).

GATE 7 — SpawnNousDeps wiring (D-03):
```bash
grep -n "spawnNousDeps\|_spawnNousDeps" grid/src/main.ts
```
Expected: at least 2 matches.

GATE 8 — Observatory nav present (D-04):
```bash
grep -n "Observatory\|/replay\|/culture" steward/src/components/StewardShell.tsx
```
Expected: at least 3 matches.

GATE 9 — Culture fetches not proxied (D-09 + RESEARCH Pitfall 3):
```bash
grep -n "/api/operator" steward/src/app/culture/page.tsx
```
Expected: 0 matches.

GATE 10 — Replay listing uses direct Grid fetch (not proxied):
```bash
grep -n "audit/trail" steward/src/app/replay/page.tsx
```
Expected: 1 match (direct GRID_ORIGIN fetch).

Report all gate results. All 10 must pass before proceeding to doc-sync.
  </action>
  <verify>
    <automated>cd /Users/desirey/Programming/src/Noesis/grid && npx vitest run --reporter=dot && cd ../dashboard && npx vitest run --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - Grid vitest exits 0
    - Dashboard vitest exits 0
    - All 10 grep gates return expected results (see action above for each expected output)
  </acceptance_criteria>
  <done>All test suites green. All 10 invariant grep gates pass.</done>
</task>

<task type="auto">
  <name>Task 2: Atomic doc-sync — ROADMAP + STATE + MILESTONES</name>
  <files>.planning/ROADMAP.md, .planning/STATE.md, .planning/MILESTONES.md</files>
  <read_first>
    - .planning/ROADMAP.md (read Phase 25 section — find "25c ☐" marker to update)
    - .planning/STATE.md (read fully — update Current Position, progress, last activity)
    - .planning/MILESTONES.md (read — append Phase 25c completion entry)
  </read_first>
  <action>
ROADMAP.md update:
Find the Phase 25 entry. Change the status marker for 25c from ☐ to ✓:
- Before: `**25a ✓ 25b ✓ 25c ☐ (replay scrubber + culture browser, pending)**`
- After: `**25a ✓ 25b ✓ 25c ✓ (replay scrubber + culture browser)**`

Add plan list for 25c under Phase 25 (below existing 25a/25b plan lists):
```markdown
  Phase 25c plans:
  - [x] 25c-01-PLAN.md — Wave 0: relationships.ts header-auth + humanSanctionStore + SpawnNousDeps wiring
  - [x] 25c-02-PLAN.md — Wave 1: D-07 replay-client.test.tsx RED→GREEN + @vitejs/plugin-react fix
  - [x] 25c-03-PLAN.md — Wave 2-3: StewardShell Observatory nav + /replay listing page + scrubber modal
  - [x] 25c-04-PLAN.md — Wave 4: /culture page + NousFilterBar + three raw-SVG culture components
  - [x] 25c-05-PLAN.md — Wave 5: regression gates + doc-sync
```

STATE.md update:
- `stopped_at`: "Phase 25c complete"
- `last_updated`: today's date (2026-05-22T...)
- `last_activity`: "2026-05-22"
- `status`: "executing"
- `Current Position` section: update Phase from "25b" to "25c", Status to "Phase 25c complete"
- Progress bar: update completed_phases if 25c closure bumps the count

MILESTONES.md update:
Append a Phase 25c entry in the milestone log format used by prior phases. Include:
- Phase: 25c
- Date completed: 2026-05-22
- Summary: "Replay scrubber + culture browser. Two read-only StewardShell surfaces: /replay (operator export listing + tick scrubber modal, H3+ gate, H4 redaction) and /culture (Skill Lineage, Norm Timeline, Lore Graph SVGs with per-Nous filter). Wave-0: relationships.ts header-auth migration, humanSanctionStore wiring, SpawnNousDeps wiring. Phase 13 REPLAY-05 RED→GREEN. Allowlist delta: 0."
- Tests added/modified: replay-client.test.tsx GREEN (was RED)
- Files created: 7 new (5 steward pages + 2 steward components)
- Files modified: 3 (relationships.ts, main.ts, StewardShell.tsx)
  </action>
  <verify>
    <automated>grep -n "25c ✓\|25c-01-PLAN\|25c-05-PLAN" /Users/desirey/Programming/src/Noesis/.planning/ROADMAP.md 2>/dev/null</automated>
  </verify>
  <acceptance_criteria>
    - `grep "25c ✓" .planning/ROADMAP.md` → 1 match
    - `grep "25c-01-PLAN.md" .planning/ROADMAP.md` → 1 match
    - `grep "25c-05-PLAN.md" .planning/ROADMAP.md` → 1 match
    - `grep "Phase 25c" .planning/STATE.md` → at least 1 match
    - `grep "Phase 25c\|replay scrubber\|culture browser" .planning/MILESTONES.md` → at least 1 match
  </acceptance_criteria>
  <done>ROADMAP.md marks 25c complete. STATE.md updated. MILESTONES.md has Phase 25c completion entry.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| planning docs | Read-write by Claude only; no external data flows |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25c-05-01 | Tampering | Phase 25c allowlist delta | mitigate | Grep gate 3 confirms 0 new audit.append calls across all 25c-modified files |
| T-25c-05-02 | Tampering | D-9-08 SVG invariant | mitigate | Grep gate 4 confirms 0 charting library imports in steward/src/app/culture/ |
| T-25c-05-03 | Repudiation | doc-sync accuracy | mitigate | ROADMAP, STATE, MILESTONES updated atomically in same commit; grep gates confirm content |
</threat_model>

<verification>
Full verification checklist:
- [ ] `cd grid && npx vitest run --reporter=dot` exits 0
- [ ] `cd dashboard && npx vitest run --reporter=dot` exits 0
- [ ] `grep -rn "audit\.append\|chain\.append" steward/src/app/replay/ steward/src/app/culture/ grid/src/api/operator/relationships.ts` → 0 matches
- [ ] `grep -rn "from 'd3\|recharts\|react-flow\|cytoscape" steward/src/app/culture/` → 0 matches
- [ ] `grep "validateTierBody" grid/src/api/operator/relationships.ts` → 0 matches
- [ ] `grep "humanSanctionStore" grid/src/main.ts` → 2+ matches
- [ ] `grep "Observatory" steward/src/components/StewardShell.tsx` → 1 match
- [ ] `grep "25c ✓" .planning/ROADMAP.md` → 1 match
</verification>

<success_criteria>
1. Grid and Dashboard test suites both green with no new failures
2. All 10 invariant grep gates pass
3. ROADMAP.md shows Phase 25c complete
4. STATE.md reflects Phase 25c done
5. MILESTONES.md has 25c entry
</success_criteria>

<output>
After completion, create `.planning/phases/25c-replay-scrubber-culture-browser/25c-05-SUMMARY.md`
</output>
