---
phase: "08"
plan: "03"
subsystem: dashboard
tags: [tdd, agency, h5, deletion, irreversibility, inspector, firehose, dialog]
depends_on: ["08-01", "08-02"]
provides: ["AGENCY-05-dashboard"]
affects: ["dashboard/src/app/grid/components/inspector.tsx", "dashboard/src/app/grid/components/firehose-row.tsx", "dashboard/src/components/agency/irreversibility-dialog.tsx"]
tech-stack:
  added: ["IrreversibilityDialog (native <dialog>, paste-suppressed, exact-match gate)"]
  patterns: ["TDD RED→GREEN per task", "closure-capture race-safety (D-07/D-22)", "conditional rendering unmount", "auto-downgrade H5→H1 on all close paths", "toast auto-dismiss via useEffect cleanup"]
key-files:
  created:
    - dashboard/src/components/agency/irreversibility-dialog.tsx
    - dashboard/src/components/agency/irreversibility-dialog.test.tsx
    - dashboard/test/integration/delete-flow.test.tsx
  modified:
    - dashboard/src/lib/api/introspect.ts
    - dashboard/src/lib/api/introspect.test.ts
    - dashboard/src/lib/api/operator.ts
    - dashboard/src/lib/api/operator.test.ts
    - dashboard/src/components/agency/elevation-dialog.tsx
    - dashboard/src/components/agency/elevation-dialog.test.tsx
    - dashboard/src/lib/stores/agency-store.test.ts
    - dashboard/src/app/grid/components/inspector.tsx
    - dashboard/src/app/grid/components/inspector.test.tsx
    - dashboard/src/app/grid/components/firehose-row.tsx
    - dashboard/src/app/grid/components/firehose-row.test.tsx
    - .planning/STATE.md
    - README.md
decisions:
  - "D-31: H5 default-ON behind IrreversibilityDialog — no feature flag; the dialog itself is the irreversibility gate"
  - "IrreversibilityDialog copy frozen verbatim (D-04/D-05): WARNING_COPY, TITLE_COPY, DELETE_LABEL, CANCEL_LABEL, DID label pinned by test assertions"
  - "Closure-capture D-22 applied to IrreversibilityDialog: capturedDidRef.current = targetDid at showModal() time"
  - "Conditional rendering {irrevOpen && <IrreversibilityDialog/>} — fully unmounts on close, queryByTestId returns null"
  - "AllElevatedTier = Exclude<HumanAgencyTier, 'H1'> (includes H5 for ElevationDialog) vs backward-compat ElevatedTier (H2/H3/H4 only for useElevatedAction hook)"
  - "inlineError only rendered when inlineError && irrevOpen — prevents stale error text leaking after dialog close"
metrics:
  duration_minutes: 90
  completed_date: "2026-04-21"
  tasks_completed: 3
  files_modified: 14
requirements: [AGENCY-05]
---

# Phase 08 Plan 03: H5 Dashboard Delete Flow Summary

Dashboard TDD for AGENCY-05: deleteNous API wrapper + IrreversibilityDialog primitive + Inspector two-stage H5 delete orchestration (State A/B/C) + firehose destructive styling for `operator.nous_deleted`.

## One-liner

Two-stage H5 Inspector delete flow with paste-suppressed IrreversibilityDialog, State A/B/C transitions, and firehose destructive red styling for `operator.nous_deleted`.

## Tasks Completed

| Task | Type | Description | Commit |
|------|------|-------------|--------|
| 1 RED | test | deleteNous + 410 nous_deleted kind + H5 ElevationDialog + D-21 H5 hydration rejection pin | `780e19a` |
| 1 GREEN | feat | deleteNous wrapper + nous_deleted FetchError kind + H5 elevation option + D-21 hydration guard confirmed | `f1d3725` |
| 2 RED | test | IrreversibilityDialog primitive (24 tests: copy, paste, exact-match, close paths, onConfirm, ARIA) | `3626443` |
| 2 GREEN | feat | IrreversibilityDialog implementation | `2bf57fc` |
| 3 RED | test | Inspector H5 flow + firehose destructive styling + delete-flow integration (9+4+3 tests) | `009b200` |
| 3 GREEN | feat | Inspector two-stage flow + State A/B/C + firehose styling + doc-sync STATE.md + README.md | `66431e9` |

## Key Deliverables

### Task 1 — API Layer + ElevationDialog H5

**`dashboard/src/lib/api/introspect.ts`**
- Extended `FetchError.kind` union with `'nous_deleted'`
- `STATUS_TO_KIND` maps HTTP 410 → `'nous_deleted'`
- `NousStateResponse` gains optional `status?` and `deleted_at_tick?` fields

**`dashboard/src/lib/api/operator.ts`**
- `OperatorErrorKind` gains `'invalid_did'` and `'nous_deleted'`
- `STATUS_TO_KIND_DELETE` maps 400/404/410/503
- `deleteNous(did, baseUrl, signal?)` export — POST to `/api/operator/nous/:did/delete`

**`dashboard/src/components/agency/elevation-dialog.tsx`**
- `AllElevatedTier = Exclude<HumanAgencyTier, 'H1'>` (H2/H3/H4/H5) — new export for `ElevationDialogProps.targetTier`
- Backward-compat `ElevatedTier = Exclude<HumanAgencyTier, 'H1' | 'H5'>` preserved for `useElevatedAction` hook callers
- H5 entry in `CONFIRM_FILL` with `'bg-red-700 text-neutral-50 font-bold'`

**D-21 regression pin** — `agencyStore.hydrateFromStorage()` already rejects H5 (whitelist `{H1,H2,H3,H4}` from Phase 6). 4 tests confirm existing behavior. Tests passed at RED (confirming Phase 6 whitelist is strict).

### Task 2 — IrreversibilityDialog Primitive

**`dashboard/src/components/agency/irreversibility-dialog.tsx`**
- Native `<HTMLDialogElement>.showModal()` — no Radix/portal (per D-08)
- `capturedDidRef.current = targetDid` at open time (closure-capture D-22 race safety)
- `onPaste={(e) => e.preventDefault()}` on DID input (paste suppression)
- Enter key blocked on DID input (`onKeyDown` guard)
- autoFocus on "Keep this Nous" cancel button (safe default)
- `close` event listener routes all close paths to `onCancel`
- Backdrop click guard: `if (e.target === dialogRef.current) dlg.close()`
- Copy constants frozen verbatim: `WARNING_COPY`, `TITLE_COPY`, `DELETE_LABEL = 'Delete forever'`, `CANCEL_LABEL = 'Keep this Nous'`
- testids: `irrev-dialog`, `irrev-warning`, `irrev-did-label`, `irrev-input-label`, `irrev-did-input`, `irrev-delete`, `irrev-cancel`, `irrev-hint`

**`dashboard/src/components/agency/irreversibility-dialog.test.tsx`** — 24 tests:
- Verbatim copy assertions (6)
- Paste suppression (2)
- Exact-match gate / enable/disable (4)
- autoFocus (1)
- Close paths: cancel, ESC, backdrop, close event (4)
- `onConfirm` triggers + payload (2)
- Closure-capture (1)
- ARIA roles (3)
- Focus restoration (1)

### Task 3 — Inspector Two-Stage Flow + Firehose Styling

**`dashboard/src/app/grid/components/inspector.tsx`** — complete rewrite of H5 section:
- State: `elevationOpen`, `irrevOpen`, `inlineError`, `toast: {message, id} | null`
- Ref: `deleteButtonRef` → `IrreversibilityDialog` `openerRef` for focus restoration
- `onH5DeleteClick()` — guards `state.status === 'ok' && data.status === 'active'`
- `onElevationConfirm()` — sets H5 tier, opens `irrevOpen`
- `onIrrevConfirm()` — awaits `deleteNous()`, dispatches: 200 → toast + refetch + State B, 503 → inline error, 410 → race toast + refetch
- `onIrrevCancel()` — clears `irrevOpen` + auto-downgrades H5 → H1
- `showToast(message)` — 4s auto-dismiss via `useEffect([toast])` cleanup
- `isStateB = state.status === 'ok' && state.data.status === 'deleted'`
- Conditional rendering: `{irrevOpen && <IrreversibilityDialog/>}` + `{elevationOpen && <ElevationDialog/>}`
- testids: `inspector-h5-delete`, `inspector-tombstone-caption`, `inspector-tombstone-firehose`, `inspector-toast`, `inspector-inline-error`
- `ERR_COPY.nous_deleted` entry added (required by exhaustive FetchError.kind coverage)

**`dashboard/src/app/grid/components/firehose-row.tsx`** — destructive styling:
- `isDeleted = entry.eventType === 'operator.nous_deleted'`
- Row: `border-l-2 border-rose-900` left accent when deleted
- Badge: `bg-rose-900/20 text-rose-300` when deleted (vs normal `CATEGORY_BADGE[category]`)
- Actor: `text-red-400 line-through` when deleted
- `data-testid="firehose-actor"` added to actor span

**`dashboard/test/integration/delete-flow.test.tsx`** — 3 integration scenarios:
- Happy path: H5 elevation → type DID → confirm → POST 200 → toast "Nous deleted." → State B tombstoned
- 503 brain_unavailable: dialog stays open, inline error "Brain unavailable. Try again."
- 410 race: info toast "This Nous was already deleted." + refetch shows State B

## Test Counts

| File | Tests Added | Total |
|------|-------------|-------|
| introspect.test.ts | +2 | — |
| operator.test.ts | +9 | — |
| elevation-dialog.test.tsx | +3 | — |
| agency-store.test.ts | +4 (D-21 regression pins) | — |
| irreversibility-dialog.test.tsx | +24 (new file) | 24 |
| inspector.test.tsx | +9 | — |
| firehose-row.test.tsx | +4 | — |
| delete-flow.test.tsx | +3 (new file) | 3 |
| **Dashboard total** | **+58** | **404/404** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ElevatedTier backward-compatibility conflict**
- **Found during:** Task 1 GREEN
- **Issue:** Changing `ElevatedTier` to include H5 broke `use-elevated-action.test.tsx` which imports `ElevatedTier` from elevation-dialog and passes it to `useElevatedAction` (which only accepts H2/H3/H4)
- **Fix:** Kept `ElevatedTier = Exclude<HumanAgencyTier, 'H1' | 'H5'>` as backward-compat export; added new `AllElevatedTier = Exclude<HumanAgencyTier, 'H1'>` for `ElevationDialogProps.targetTier`
- **Files modified:** `elevation-dialog.tsx`
- **Commit:** `f1d3725`

**2. [Rule 2 - Missing] ERR_COPY incomplete after FetchError.kind extension**
- **Found during:** Task 3 GREEN
- **Issue:** TypeScript exhaustive check on `ERR_COPY` failed after `nous_deleted` was added to `FetchError.kind` in Task 1
- **Fix:** Added `nous_deleted` entry to `ERR_COPY` record in inspector.tsx
- **Files modified:** `inspector.tsx`
- **Commit:** `66431e9`

**3. [Rule 1 - Bug] operator.test.ts tuple indexing type error**
- **Found during:** Task 1 GREEN
- **Issue:** `vi.fn(async () => ...)` without explicit param types caused TypeScript to see `mock.calls[0]` as empty tuple `[]`
- **Fix:** Typed mock as `vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(...))`
- **Files modified:** `operator.test.ts`
- **Commit:** `f1d3725`

**4. [Rule 1 - Bug] ClipboardEvent not defined in jsdom**
- **Found during:** Task 2 RED
- **Issue:** `new ClipboardEvent('paste', { clipboardData: ... })` threw in jsdom
- **Fix:** Used `fireEvent.paste(input, { clipboardData: { getData: () => '...' } })` instead
- **Files modified:** `irreversibility-dialog.test.tsx`
- **Commit:** `3626443`

**5. [Rule 1 - Bug] IrreversibilityDialog still in DOM after cancel**
- **Found during:** Task 2 RED/GREEN
- **Issue:** Native `<dialog>` element stays in DOM even when `open=false`; `queryByTestId('irrev-dialog')` returned non-null after cancel
- **Fix:** Conditional rendering `{irrevOpen && <IrreversibilityDialog/>}` — element fully unmounts on close
- **Files modified:** `inspector.tsx` (conditional render), `irreversibility-dialog.test.tsx` (test expectation updated)
- **Commit:** `2bf57fc` / `66431e9`

**6. [Rule 1 - Confirmation] D-21 H5 hydration rejection already implemented**
- **Found during:** Task 1 RED
- **Issue:** Plan specified "implement" D-21 H5 hydration rejection. The tests passed immediately at RED, confirming Phase 6 already implements the `{H1,H2,H3,H4}` whitelist in `hydrateFromStorage()`
- **Fix:** Tests became regression pins confirming existing behavior, not new implementation. Documented in GREEN commit.
- **Commit:** `780e19a` (RED passed), `f1d3725` (confirmed, no hydration code change needed)

## Known Stubs

None. All data flows wired: `deleteNous()` → real POST, `fetchNousState()` → real GET for refetch, toast/inline error driven by actual response shapes.

## Threat Flags

None new beyond plan's threat model. `deleteNous()` is authenticated via the operator tier/session context established in Phase 6. The `IrreversibilityDialog` typed-DID gate is an additional human-intent confirmation (not a crypto auth barrier — that's the HTTP endpoint's responsibility on the grid side, covered in 08-02).

## Self-Check: PASSED

All created files exist on disk. All 6 task commits found in git history (`780e19a`, `f1d3725`, `3626443`, `2bf57fc`, `009b200`, `66431e9`). Dashboard test suite: 404/404.
