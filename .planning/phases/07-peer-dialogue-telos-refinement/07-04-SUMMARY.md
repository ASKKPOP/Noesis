---
phase: 07-peer-dialogue-telos-refinement
plan: 04
subsystem: ui
tags: [dashboard, react, nextjs, vitest, inspector, firehose, telos, dialogue]

# Dependency graph
requires:
  - phase: 07-peer-dialogue-telos-refinement
    provides: "telos.refined audit event with closed-tuple payload + 17-event allowlist + producer boundary (Plan 07-03); nous-runner recentDialogueIds authority (Plan 07-02); PeerDialogueMemory + TelosRefinementEngine (Plan 07-01)"
  - phase: 06-operator-agency-foundation-h1-h4
    provides: "tier-palette precedent (H1 neutral, H2 blue, H3 amber, H4 red, H5 muted) — Phase 7 indigo-400 slot chosen to avoid all operator tiers"
  - phase: 04-nous-inspector-economy-docker-polish
    provides: "Inspector drawer + TelosSection scaffolding + Chip primitive (TelosSection Plan 04-05; Chip primitive Plan 04-04)"
  - phase: 03-dashboard-firehose-heartbeat-region-map
    provides: "Firehose panel + FirehoseRow + useFirehose store (consumed by useRefinedTelosHistory as a derived selector)"
provides:
  - "`'dialogue'` Chip variant — indigo-400 #818CF8 on #17181C (6.4:1 contrast)"
  - "useFirehoseFilter URL-param hook (firehose_filter=dialogue_id:<16-hex>)"
  - "useRefinedTelosHistory derived selector (zero new RPC)"
  - "TelosRefinedBadge panel-level on Inspector (D-27/D-30)"
  - "FirehoseFilterChip (self-conditional)"
  - "Firehose dim-not-hide behavior + empty-match heading"
affects: ["phase-08", "v2.2-operator-inspection-flows", "any-future-phase-touching-firehose", "any-future-phase-touching-inspector"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-selector hook pattern over existing useFirehose() — zero new RPC/WS"
    - "URL-param filter with regex gate at hook boundary (DIALOGUE_ID_RE) — malformed → filter:null, chip not mounted"
    - "Panel-level badge (D-27/D-30) — not per-goal — because compute_active_telos_hash covers whole goal set"
    - "Dim-not-hide firehose filter (AC-4-3-3) — preserves temporal debugging context"
    - "Zero-diff regression guard (AC-4-3-4) — new surface must render byte-identical to pre-phase output when filter null"
    - "Cross-file color-scope invariant via node:fs readdirSync walker (no glob dep)"
    - "Plaintext-never source invariant enforced via grep in test body (no new_goals/goal_description/utterance in dashboard)"

key-files:
  created:
    - dashboard/src/lib/hooks/use-firehose-filter.ts
    - dashboard/src/lib/hooks/use-firehose-filter.test.ts
    - dashboard/src/lib/hooks/use-refined-telos-history.ts
    - dashboard/src/lib/hooks/use-refined-telos-history.test.ts
    - dashboard/src/components/dialogue/telos-refined-badge.tsx
    - dashboard/src/components/dialogue/telos-refined-badge.test.tsx
    - dashboard/src/app/grid/components/firehose-filter-chip.tsx
    - dashboard/src/app/grid/components/firehose-filter-chip.test.tsx
  modified:
    - dashboard/src/components/primitives/chip.tsx
    - dashboard/src/components/primitives/primitives.test.tsx
    - dashboard/src/app/grid/components/inspector-sections/telos.tsx
    - dashboard/src/app/grid/components/inspector-sections/telos.test.tsx
    - dashboard/src/app/grid/components/inspector.tsx
    - dashboard/src/app/grid/components/inspector.test.tsx
    - dashboard/src/app/grid/components/firehose.tsx
    - dashboard/src/app/grid/components/firehose.test.tsx
    - dashboard/src/app/grid/components/firehose-row.tsx
    - .planning/MILESTONES.md

key-decisions:
  - "D-27 Panel-level refinement badge, not per-goal — active Telos hash covers whole goal set so placing the badge inside any goal-li misrepresents provenance"
  - "D-30 Empty-goals + badge coexist — refinement history is independent of current goal set (Brain may refine goals back to empty)"
  - "AC-4-3-3 Dim-not-hide — firehose is a debugger's surface; hiding breaks temporal context"
  - "AC-4-3-4 Zero-diff when filter null — Phase 7 must not leak dim-styling into unfiltered firehose path"
  - "Indigo-400 #818CF8 color-scope — confined to 8 allowlisted files (cross-file walker enforces)"
  - "Plaintext-never source invariant (PHILOSOPHY §1) — badge source grep'd for new_goals/goal_description/utterance"
  - "Derived selector pattern for useRefinedTelosHistory — consumes useFirehose() snap, no new WebSocket / RPC"
  - "DIALOGUE_ID_RE at hook boundary — malformed → filter null, chip not mounted (no render path for invalid ids)"

patterns-established:
  - "URL-param filter hook gates on regex at boundary — mirror of grid/src/audit/append-telos-refined.ts:DIALOGUE_ID_RE"
  - "Derived selector over store snapshot — O(n) filter + Set dedup with useMemo"
  - "Self-conditional chip/badge — component returns null when its hook returns null (no parent gating)"
  - "Reference-stable EMPTY object via Object.freeze for hook 'no data' return"
  - "Heading-row right-slot flex-justify-between pattern for section-level badges"
  - "Source-invariant tests via node:fs + grep — prevents drift even when no one ships new source code"

requirements-completed: [DIALOG-03]

# Metrics
duration: ~95min (incl. cross-session continuation)
completed: 2026-04-21
---

# Phase 7 Plan 04: Peer Dialogue UI Surface Summary

**Inspector panel-level ↻ refined via dialogue badge, URL-param dialogue_id filter, dim-not-hide firehose — closing DIALOG-03 with zero new RPC and the indigo-400 color-scope invariant locked.**

## Performance

- **Duration:** ~95 min (including context-compaction continuation)
- **Started:** 2026-04-21T01:45:00Z (approx, prior session)
- **Completed:** 2026-04-21T02:36:00Z
- **Tasks:** 3
- **Files created:** 8
- **Files modified:** 10

## Accomplishments

- **DIALOG-03 closed.** The Inspector's TelosSection now exposes a panel-level `↻ refined via dialogue (N)` badge when peer dialogue has mutated the focused Nous's goal hash — click routes to `/grid?tab=firehose&firehose_filter=dialogue_id:<16-hex>` preserving pre-existing query params.
- **Dim-not-hide firehose filter.** `FirehoseFilterChip` mounts above the event list when filter active; matching rows render at full opacity, non-matching rows dim to `opacity-40 pointer-events-none`. Empty-match heading `"No matching events for dialogue_id <value>. Press × to clear."` shows when filter active but zero rows match. AC-4-3-3 preserves temporal debugging context; AC-4-3-4 guarantees zero-diff when filter is null.
- **Zero new RPC, zero new WebSocket subscription.** `useRefinedTelosHistory` is a derived selector over the existing `useFirehose()` store snapshot — the entire DIALOG-03 UI surface is client-side computed from the already-allowlisted `telos.refined` audit events Plan 07-03 emits.
- **Indigo-400 #818CF8 color-scope locked.** New `'dialogue'` Chip variant extends the shared primitive; cross-file `node:fs` walker in `telos-refined-badge.test.tsx` asserts the literal appears in exactly 8 allowlisted files (hook sources + tests, chip source + primitive tests, badge source + tests, chip component + tests). Phase 7 indigo slot chosen to avoid Phase 6's operator tier palette (H1 neutral, H2 blue, H3 amber, H4 red, H5 muted).
- **Plaintext-never source invariant enforced.** Grep-based test in `telos-refined-badge.test.tsx` asserts no `new_goals`, `goal_description`, or `utterance` strings in dashboard sources (PHILOSOPHY §1).

## Task Commits

Each TDD cycle was committed atomically — RED before GREEN, each gate separately.

### Task 1: Chip 'dialogue' variant + useFirehoseFilter + useRefinedTelosHistory

1. **RED:** `6b4c333` (test) — chip 'dialogue' variant expected class + color-scope test scaffolding
2. **GREEN:** `37c514d` (feat) — chip 'dialogue' variant lands (indigo-400 on #17181C); hook sources + tests added in same cycle (per-test RED/GREEN per hook fused into one task as planned)

### Task 2: TelosRefinedBadge + FirehoseFilterChip

3. **RED:** `220ff45` (test) — badge locked testids, aria-label copy locks, click-through URL contract, cross-file color-scope walker, plaintext-never invariant
4. **GREEN:** `3820e70` (feat) — both components land; badge panel-level (self-conditional by `did` null-check + `refinedCount === 0` null-return); chip self-conditional via `filter === null`

### Task 3: Wire Inspector + firehose dim-not-hide + MILESTONES.md append

5. **RED:** `b20764e` (test) — TelosSection `did` prop contract + panel-level badge placement + empty-goals+badge coexistence
6. **GREEN:** `870e35c` (feat) — TelosSection accepts `did`, wraps heading in flex-justify-between, Inspector threads `selectedDid`; inspector.test.tsx gets useRefinedTelosHistory + next/navigation mocks so the harness without StoresProvider doesn't crash
7. **RED:** `327f687` (test) — Firehose dim-not-hide F-5/F-6/F-7 (matching full-opacity, non-matching `opacity-40`, empty-match heading, zero-diff when filter null)
8. **GREEN:** `6f64ee2` (feat) — Firehose imports useFirehoseFilter + FirehoseFilterChip; `showEmptyMatchHeading` branch renders override copy; FirehoseRow accepts `dialogueFilter` prop and appends `opacity-40 pointer-events-none` on non-match

## Files Created/Modified

### Created

- `dashboard/src/lib/hooks/use-firehose-filter.ts` — exports `DIALOGUE_ID_RE` (`/^[0-9a-f]{16}$/`), `FirehoseFilter` interface, `useFirehoseFilter` hook (parses `firehose_filter=<key>:<value>` from URLSearchParams, gates on regex, setFilter/clear preserve other params via router.push)
- `dashboard/src/lib/hooks/use-firehose-filter.test.ts` — 8 cases: no-param, valid, non-hex, wrong-length, unknown-key, setFilter-preserves, clear-removes-only-filter
- `dashboard/src/lib/hooks/use-refined-telos-history.ts` — derived selector over useFirehose(). Filters on `eventType === 'telos.refined'` + `payload.did === did` + HEX64/DIALOGUE_ID regex guards; returns `{refinedCount, lastRefinedDialogueId, refinedAfterHashes}`. Uses `Object.freeze(EMPTY)` for reference-stable no-data case
- `dashboard/src/lib/hooks/use-refined-telos-history.test.ts` — 8 cases: null-did, empty, 3-match, mixed alice/bob filter, malformed drops, non-telos.refined ignored, reference stability
- `dashboard/src/components/dialogue/telos-refined-badge.tsx` — outer `<span data-testid="telos-refined-badge">` wrapping inner `<button data-testid="telos-refined-badge-trigger">` + Chip color=dialogue. Click builds new URLSearchParams preserving existing params, adds `tab=firehose&firehose_filter=dialogue_id:<lastId>`, calls `router.push`. Label `↻ refined via dialogue` (N=1) or `↻ refined via dialogue (${N})` (N>1)
- `dashboard/src/components/dialogue/telos-refined-badge.test.tsx` — 11 cases: render-gating (did=null, refinedCount=0), label+aria copy locks (N=1, N=3), click-through URL contract, preserves pre-existing params, keyboard Enter, source-invariant plaintext-never, cross-file color-scope walker
- `dashboard/src/app/grid/components/firehose-filter-chip.tsx` — self-conditional on filter===null; `role="status"`, `aria-live="polite"`; displays `dialogue_id: <mono-value>` + × clear button with literal aria-label `"Clear dialogue filter. Show all firehose events."`
- `dashboard/src/app/grid/components/firehose-filter-chip.test.tsx` — 7 cases: render gating, testid + mono-span presence, role/aria-live, click invokes clear, keyboard Enter, aria-label literal

### Modified

- `dashboard/src/components/primitives/chip.tsx` — added `'dialogue'` to ChipColor union and `COLOR_CLASSES` (bg-[#17181C] border-[#818CF8] text-[#818CF8])
- `dashboard/src/components/primitives/primitives.test.tsx` — added dialogue-variant className assertion
- `dashboard/src/app/grid/components/inspector-sections/telos.tsx` — added `did: string | null` prop; imports TelosRefinedBadge; wraps heading in `flex items-center justify-between`; renders `<TelosRefinedBadge did={did} />` at heading-row right
- `dashboard/src/app/grid/components/inspector-sections/telos.test.tsx` — added vi.mocks for useRefinedTelosHistory + next/navigation; updated existing cases with `did={null}`; added 3 new Phase 7 cases (panel-level placement, did=null → no badge, empty-goals+badge coexist)
- `dashboard/src/app/grid/components/inspector.tsx` — threads `selectedDid` from useSelection() into `<TelosSection did={selectedDid} />`
- `dashboard/src/app/grid/components/inspector.test.tsx` — added vi.mocks for useRefinedTelosHistory + next/navigation (the Harness has no StoresProvider so the badge's hook chain would throw otherwise)
- `dashboard/src/app/grid/components/firehose.tsx` — imports useFirehoseFilter + FirehoseFilterChip; `rowMatchesDialogueFilter` predicate; `hasDialogueMatch` + `showEmptyMatchHeading` computed state; renders override heading when filter active and no matches; passes `dialogueFilter` to each FirehoseRow
- `dashboard/src/app/grid/components/firehose.test.tsx` — added vi.mock for useFirehoseFilter (mutable per-case); added F-5/F-6/F-7 Phase 7 cases (dim-not-hide, empty-match, zero-diff)
- `dashboard/src/app/grid/components/firehose-row.tsx` — added optional `dialogueFilter` prop defaulting to null (zero-diff for all pre-Phase-7 callers); `isMatch` predicate mirrors Firehose's; appends `opacity-40 pointer-events-none` to className on non-match
- `.planning/MILESTONES.md` — appended Sprint 17 / Phase 7 entry (and retroactively appended Sprint 16 / Phase 6 entry which had been shipped but not logged — Rule 2 deviation, see below)

## Decisions Made

- **D-27 (Plan-level):** Badge at panel level, not per-goal — active Telos hash covers the whole goal set; a per-goal badge would misrepresent provenance (single refinement affects N goals collectively).
- **D-30 (Plan-level):** Empty-goals EmptyState coexists with TelosRefinedBadge — refinement history is an audit-log property independent of the current goal snapshot.
- **AC-4-3-3 (Contract):** Dim-not-hide preserves temporal context on a debugger surface. Both matching and non-matching `<li>` nodes remain in `firehose-list`; only non-matching rows carry the dim class.
- **AC-4-3-4 (Contract):** Zero-diff when filter null — unfiltered firehose renders byte-identical to pre-Phase-7 output. FirehoseRow's optional prop defaults to `null`; Firehose mounts FirehoseFilterChip unconditionally but the chip is self-conditional on `filter === null` (returns null).
- **Color-scope (D-26):** `#818CF8` confined to 8 allowlisted files. Chose `'dialogue'` as the Chip variant name (not `'indigo'`) to encode the semantic rather than the pixel — future phases wanting indigo would use this variant or declare a new semantic slot.
- **Hook boundary regex (Plan 07-03 parity):** `DIALOGUE_ID_RE` in `use-firehose-filter.ts` mirrors `grid/src/audit/append-telos-refined.ts` producer-boundary regex. Malformed query param → filter null at hook boundary → chip not mounted → firehose renders unfiltered. No render path for invalid ids.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inspector tests broke due to new hook subtree without StoresProvider**
- **Found during:** Task 3, Step 2 GREEN verification (after wiring `did={selectedDid}` into TelosSection)
- **Issue:** The inspector.test.tsx Harness renders `<Inspector />` standalone without `<StoresProvider>`. Once TelosSection started mounting `<TelosRefinedBadge>`, the badge's `useRefinedTelosHistory` → `useFirehose` → `useStores` chain threw `"useStores must be called inside a <StoresProvider>"`, breaking 4 pre-existing Inspector tests (opens drawer, renders sections, ESC clear, Tab wrap).
- **Fix:** Added two vi.mocks to inspector.test.tsx — `@/lib/hooks/use-refined-telos-history` returning empty history, and `next/navigation` returning stub router/searchParams. This isolates the badge subtree from the test harness, mirroring the pattern already used in telos.test.tsx.
- **Files modified:** `dashboard/src/app/grid/components/inspector.test.tsx`
- **Verification:** `pnpm exec vitest run src/app/grid/components/inspector-sections/telos src/app/grid/components/inspector` — 27/27 pass
- **Committed in:** `870e35c` (Task 3 Step 2 GREEN commit — bundled with the wiring change)

**2. [Rule 2 - Missing Critical Doc-Sync] Retroactively added Phase 6 entry to MILESTONES.md**
- **Found during:** Task 3 Step 5 (MILESTONES.md append)
- **Issue:** CLAUDE.md Documentation Sync Rule mandates MILESTONES.md append when a phase ships. Phase 6 (shipped 2026-04-20, fully VERIFIED) had not been appended — only Phase 5 was logged. Appending only Phase 7 on top of a stale doc would leave a gap.
- **Fix:** Appended both Sprint 16 / Phase 6 entry and Sprint 17 / Phase 7 entry. Phase 6 entry reflects its verification report (5/5 SCs, AGENCY-02 partial per D-09a deferred allowlist-mutate item, 16-event allowlist, elevation-dialog + use-elevated-action + closure-capture discipline, H5 placeholder only).
- **Files modified:** `.planning/MILESTONES.md`
- **Verification:** Manual read — chronological ordering preserved, trailer updated to `2026-04-21 — Phase 7 shipped`
- **Committed in:** final metadata commit

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing-critical-doc-sync)
**Impact on plan:** Both fixes necessary — Rule 1 restored existing test contract after a prop change cascade; Rule 2 discharged a documented project invariant (CLAUDE.md Documentation Sync Rule). No scope creep: Phase 6 retroactive entry is doc-only, cites verification report already on disk.

## Issues Encountered

- **`npm test` from repo root failed** with `Missing packageManager field in package.json` — pre-existing turbo config issue, not introduced by this plan. Verified via individual package suites: `cd dashboard && pnpm exec vitest run` → 348/348 pass; `cd grid && npm test` → 585/585 pass.
- **PreToolUse READ-BEFORE-EDIT reminders** fired repeatedly on files already read in-session; spurious hook false positives, edits succeeded per tool responses.
- **F-7 passed at RED time** because "filter null → zero-diff" was already true in pre-Phase-7 firehose. F-5 + F-6 correctly failed until GREEN landed — RED signal still valid.

## User Setup Required

None — no external service configuration required. All DIALOG-03 surfaces are derived from existing `telos.refined` audit events already flowing through the WS hub (Plan 07-03's producer boundary + allowlist).

## Next Phase Readiness

- **Phase 7 v2.1 milestone complete** — DIALOG-01, DIALOG-02, DIALOG-03 all closed. `.planning/ROADMAP.md` and `.planning/STATE.md` should be updated by the verification agent after human smoke test confirms the indigo badge, click-through navigation, and dim-not-hide behavior in the live dashboard.
- **Ready for verification:** Plan 07-04 VERIFICATION report should check: (a) badge renders panel-level not per-goal, (b) click-through preserves existing query params, (c) dim-not-hide (both rows present, only non-match dimmed), (d) color-scope invariant still holds (grep for `#818CF8` returns exactly 8 files), (e) plaintext-never invariant holds (grep for `new_goals` returns zero hits in dashboard/src).
- **Next up:** v2.2 milestone planning OR Phase 8 (AGENCY-05 Sovereign Nous deletion). Phase 8 is pre-scoped: unhide the disabled H5 affordance behind the Phase 6 "requires Phase 8" tooltip, wire the consent + irreversibility dialog, add `operator.nous_deleted` to allowlist (making it 18 members).

## Known Stubs

None — all render paths wire real data. TelosRefinedBadge reads from live firehose store; FirehoseFilterChip reads from live URL; Firehose dim class reflects real payload match against real filter value.

## Threat Flags

No net-new security-relevant surfaces introduced by this plan. The dashboard only consumes already-sanitized broadcast events (Plan 07-03's producer boundary is authoritative on plaintext scrubbing). `firehose_filter=dialogue_id:<value>` URL param is gated by DIALOGUE_ID_RE at the hook boundary — malformed → filter null, no injection path into router.push or downstream rendering (value is rendered as text inside a `<span>`, never interpolated into className or dangerouslySetInnerHTML).

## Self-Check: PASSED

Verified 2026-04-21:

- All 8 created files present on disk: `use-firehose-filter.ts{.test,}`, `use-refined-telos-history.ts{.test,}`, `telos-refined-badge.tsx{.test,}`, `firehose-filter-chip.tsx{.test,}`
- SUMMARY.md present at `.planning/phases/07-peer-dialogue-telos-refinement/07-04-SUMMARY.md`
- All 8 task commits resolvable in `git log --all`: `6b4c333` (T1 RED), `37c514d` (T1 GREEN), `220ff45` (T2 RED), `3820e70` (T2 GREEN), `b20764e` (T3 RED telos), `870e35c` (T3 GREEN inspector), `327f687` (T3 RED firehose), `6f64ee2` (T3 GREEN firehose)
- Final metadata commit `eef5fe2` captures SUMMARY + STATE + MILESTONES
- Test suites: dashboard 348/348 pass; grid 585/585 pass; `tsc --noEmit` clean

---
*Phase: 07-peer-dialogue-telos-refinement*
*Plan: 04*
*Completed: 2026-04-21*
