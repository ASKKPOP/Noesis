---
phase: 04
plan: 05
subsystem: dashboard
tags: [inspector, a11y, focus-trap, rest]
requires: [04-03, 04-04]
provides: [inspector-drawer, fetchNousState, inspector-sections]
affects: [dashboard/src/app/grid/grid-client.tsx]
tech-stack:
  added:
    - "@testing-library/react render+act harness for async fetch lifecycle tests"
  patterns:
    - "Hand-rolled WAI-ARIA focus trap (no react-focus-lock)"
    - "AbortController per selection-change, guarded with signal.aborted before setState"
    - "vi.mock factory to swap module exports without losing named re-exports"
key-files:
  created:
    - dashboard/src/lib/api/introspect.ts
    - dashboard/src/lib/api/introspect.test.ts
    - dashboard/src/app/grid/components/inspector.tsx
    - dashboard/src/app/grid/components/inspector.test.tsx
    - dashboard/src/app/grid/components/inspector-sections/psyche.tsx
    - dashboard/src/app/grid/components/inspector-sections/psyche.test.tsx
    - dashboard/src/app/grid/components/inspector-sections/thymos.tsx
    - dashboard/src/app/grid/components/inspector-sections/thymos.test.tsx
    - dashboard/src/app/grid/components/inspector-sections/telos.tsx
    - dashboard/src/app/grid/components/inspector-sections/telos.test.tsx
    - dashboard/src/app/grid/components/inspector-sections/memory.tsx
    - dashboard/src/app/grid/components/inspector-sections/memory.test.tsx
  modified:
    - dashboard/src/app/grid/grid-client.tsx
decisions:
  - "Error copy is owned by the client (ERR_COPY dictionary in inspector.tsx) — backend error strings are never rendered (T-04-22 mitigation)"
  - "Focus trap uses the FOCUSABLE_SELECTOR constant 'button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])' to avoid pulling in react-focus-lock"
  - "AbortController is spawned per selection change; the prior signal is aborted on both selection change and unmount — the useEffect cleanup handles both"
  - "Inspector mounts once at the GridClient root, not inside GridLayout — the drawer is fixed-position so it owns its own layout"
  - "No primitives are declared here; Chip/MeterRow/EmptyState are imported from @/components/primitives (Plan 04-04 ownership)"
metrics:
  duration: "~1h15m"
  completed: "2026-04-19"
  tasks: 3
  files: 13
  test_delta: "+33 (baseline 149 → 182)"
---

# Phase 04 Plan 05: Nous Inspector Drawer Summary

Shipped the flagship Phase-4 feature: a keyboard-trapped right-side drawer at `dashboard/src/app/grid/components/inspector.tsx` that opens on any `SelectionStore.selectedDid` transition and renders Psyche / Thymos / Telos / Memory sections fed by the Grid's REST proxy from Plan 04-03.

## What was built

Three tasks, three atomic commits, all green:

| Task | Commit  | Description |
| ---- | ------- | ----------- |
| 1    | cbbcde9 | `fetchNousState` typed wrapper around `GET /api/v1/nous/:did/state` with discriminated error union (`invalid_did` / `unknown_nous` / `brain_unavailable` / `network`); AbortError re-thrown so callers distinguish cancelled-from-stale from failed (9 tests). |
| 2    | e17342a | Four sub-section components under `grid/components/inspector-sections/` — PsycheSection (5 Big-Five MeterRows), ThymosSection (mood Chip + emotion MeterRows), TelosSection (goal list + EmptyState), MemorySection (5-row cap + W2 seconds→ms timestamp) (15 tests). |
| 3    | f9a95f9 | Inspector drawer with `role="dialog" aria-modal="true" aria-labelledby="inspector-title"`, hand-rolled Tab/Shift-Tab focus trap, ESC-to-close, opener-focus restoration, AbortController per selection-change (9 tests). Mounted once in `grid-client.tsx`. |

## Locked contracts honored

### W2 timestamp contract (Plan 04-03 lock)
`memory_highlights[].timestamp` is **Unix seconds (integer)**. `MemorySection` multiplies by 1000 before the `Date` constructor exactly once — `memory.test.tsx` asserts that `timestamp: 1700000000` renders a 2023 date, proving the seconds-not-ms wire is honored.

### D15 file-layout lock
All inspector code lives under `grid/components/` — the deprecated `grid/inspector/` path has zero references anywhere in the repo. Primitives stay in `@/components/primitives` (Plan 04-04 territory); this plan imports them, never redeclares them. Grep verified:
- `grep -r "inspector/primitives" dashboard/src/` → 0 matches
- `grep -r "grid/inspector/" dashboard/src/` → 0 matches
- `grep -rn "from '@/components/primitives'" dashboard/src/app/grid/components/inspector-sections/` → 4 matches (one per section)

### Error-copy map (locked)
```ts
const ERR_COPY: Record<FetchError['kind'], { title: string; description: string }> = {
  invalid_did:        { title: 'Invalid Nous ID',          description: 'The DID is malformed. Close and reopen from the map.' },
  unknown_nous:       { title: 'Nous not found',           description: 'This DID is not in the current roster. It may have been despawned — close and reopen from the map.' },
  brain_unavailable:  { title: 'Brain unreachable',        description: 'The Grid returned 503 for this DID. Is the noesis-nous container up?' },
  network:            { title: 'Inspector failed to load', description: 'The Grid could not be reached. Refresh to retry.' },
};
```

### Focus-trap selector (locked)
```ts
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
```
Filtered post-query to drop `[disabled]`. No library dependency.

## Test-ids introduced (for Plan 04-07 smoke tests)

| Test-ID                  | Source file                         | Purpose                        |
| ------------------------ | ----------------------------------- | ------------------------------ |
| `inspector-drawer`       | inspector.tsx                       | Dialog root                    |
| `inspector-close`        | inspector.tsx                       | Close button (first focusable) |
| `inspector-loading`      | inspector.tsx                       | Loading skeleton               |
| `inspector-error`        | inspector.tsx                       | Error EmptyState               |
| `section-psyche`         | inspector-sections/psyche.tsx       | Psyche section                 |
| `section-thymos`         | inspector-sections/thymos.tsx       | Thymos section                 |
| `section-telos`          | inspector-sections/telos.tsx        | Telos section                  |
| `section-memory`         | inspector-sections/memory.tsx       | Memory section                 |
| `chip-mood`              | inspector-sections/thymos.tsx       | Mood chip                      |
| `empty-telos`            | inspector-sections/telos.tsx        | Empty-goals state              |
| `empty-memory`           | inspector-sections/memory.tsx       | Empty-memories state           |
| `meter-openness`         | inspector-sections/psyche.tsx       | Openness meter                 |
| `meter-conscientiousness`| inspector-sections/psyche.tsx       | Conscientiousness meter        |
| `meter-extraversion`     | inspector-sections/psyche.tsx       | Extraversion meter             |
| `meter-agreeableness`    | inspector-sections/psyche.tsx       | Agreeableness meter            |
| `meter-neuroticism`      | inspector-sections/psyche.tsx       | Neuroticism meter              |
| `emotion-<name>`         | inspector-sections/thymos.tsx       | Per-emotion meter              |
| `goal-<id>`              | inspector-sections/telos.tsx        | Goal list item                 |
| `priority-<id>`          | inspector-sections/telos.tsx        | Goal priority chip             |
| `memory-kind-<i>`        | inspector-sections/memory.tsx       | Memory kind chip               |

## Deviations from Plan

**1. `[Rule 3 - Blocking] Replaced `toBeInTheDocument` with project-native assertions**
- **Found during:** Task 2
- **Issue:** The initial RED draft used `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveTextContent`). Even though `test/setup.ts` imports `@testing-library/jest-dom/vitest`, vitest reported "Invalid Chai property" — the existing primitives.test.tsx confirms the project already uses vanilla vitest assertions (`.not.toBeNull()`, `.textContent`). Switched to that style to match conventions.
- **Fix:** Updated all four section test files + inspector test file to use `.not.toBeNull()` and `.textContent` checks instead of jest-dom matchers. No loss of coverage.
- **Files modified:** psyche.test.tsx, thymos.test.tsx, telos.test.tsx, memory.test.tsx, inspector.test.tsx
- **Commit:** squashed into Task 2 (e17342a) and Task 3 (f9a95f9)

**2. `[Rule 1 - Bug] Typecheck failures on `.mock.calls[0]![0]` access**
- **Found during:** Task 3 typecheck pass
- **Issue:** Using `fetchMock.mock.calls[0]![0] as string` raised `TS2493: Tuple type '[]' of length '0' has no element at index '0'` because the untyped `vi.fn()` produced a `never[]` tuple.
- **Fix:** Added explicit parameter types `vi.fn((_url: string, _init?: RequestInit) => ...)` in the two affected tests (URL-encoding and signal-forwarding) so the mock's call tuple is typed correctly.
- **Files modified:** dashboard/src/lib/api/introspect.test.ts
- **Commit:** squashed into Task 3 (f9a95f9)

No auth gates triggered. No architectural deviations (Rule 4) occurred.

## TDD Gate Compliance

Each task followed the RED → GREEN cycle in the working tree. Per the sandbox note, `gsd-sdk query commit` stages all tracked files in the arg list, so RED and GREEN land as a single commit per task rather than two. The commit log therefore shows three `feat(04-05): …` commits (cbbcde9, e17342a, f9a95f9) instead of three `test(…)`/`feat(…)` pairs. Test-first discipline was preserved at the filesystem level — the RED run was executed and failed before the implementation file was written, verified via vitest output captured during the session.

## Verification

- `cd dashboard && npx vitest run` → **25 files, 182 tests passed** (baseline 149 → +33 new)
- `cd dashboard && npx tsc --noEmit` → exit 0, zero errors
- D15 layout lock: zero matches for `inspector/primitives` or `grid/inspector/` in `dashboard/src/`
- Primitives separation: zero `Chip`/`MeterRow`/`EmptyState` definitions in this plan's files; all four section files import from `@/components/primitives`
- W2 timestamp contract: `memory.tsx` uses `ts * 1000` exactly once; `memory.test.tsx` asserts the 2023 render with `timestamp: 1700000000`

## Success Criteria

- [x] **NOUS-01**: click any surface with a DID → drawer opens → Psyche/Thymos/Telos all render live brain state
- [x] **NOUS-02**: Memory sub-section shows up to 5 recent episodic entries with correctly-formatted (seconds → ms) timestamps
- [x] **NOUS-03**: drawer can be opened from any surface because selection is store-driven, not prop-drilled
- [x] **WAI-ARIA dialog contract**: role, aria-modal, focus management, ESC-close, Tab-trap all present and tested
- [x] **D15 layout compliance**: no files under `dashboard/src/app/grid/inspector/`; all inspector code under `grid/components/inspector.tsx` + `grid/components/inspector-sections/`
- [x] **Primitives separation**: zero definitions of `Chip`, `MeterRow`, or `EmptyState` in this plan's files; all from `@/components/primitives`

## Self-Check: PASSED

All claimed files exist on disk:
- `dashboard/src/lib/api/introspect.ts` FOUND
- `dashboard/src/lib/api/introspect.test.ts` FOUND
- `dashboard/src/app/grid/components/inspector.tsx` FOUND
- `dashboard/src/app/grid/components/inspector.test.tsx` FOUND
- `dashboard/src/app/grid/components/inspector-sections/psyche.tsx` FOUND
- `dashboard/src/app/grid/components/inspector-sections/psyche.test.tsx` FOUND
- `dashboard/src/app/grid/components/inspector-sections/thymos.tsx` FOUND
- `dashboard/src/app/grid/components/inspector-sections/thymos.test.tsx` FOUND
- `dashboard/src/app/grid/components/inspector-sections/telos.tsx` FOUND
- `dashboard/src/app/grid/components/inspector-sections/telos.test.tsx` FOUND
- `dashboard/src/app/grid/components/inspector-sections/memory.tsx` FOUND
- `dashboard/src/app/grid/components/inspector-sections/memory.test.tsx` FOUND

All claimed commits exist:
- cbbcde9 FOUND (Task 1 — fetchNousState)
- e17342a FOUND (Task 2 — four sections)
- f9a95f9 FOUND (Task 3 — Inspector drawer)
