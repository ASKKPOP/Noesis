---
phase: 43-right-to-fork
plan: "04"
subsystem: ui
tags: [steward, react, fork, dialog, vitest, testing-library, constitutional]

# Dependency graph
requires:
  - phase: 43-02
    provides: "POST /api/v1/operator/fork/<civic-did> Grid endpoint + download_url response shape"
  - phase: 43-03
    provides: "Brain standalone --import CLI (fork destination)"
  - phase: 43-01
    provides: "operator.nous_forked audit event + stub test files"
  - phase: 40
    provides: "Steward /system/local-ai page (Tier-1 Local Nous Manager surface)"
  - phase: 8
    provides: "IrreversibilityDialog analog (verbatim clone source, Phase 8 D-04/D-05)"
provides:
  - "ForkIrreversibilityDialog React component — D-43-03 verbatim copy with paste/Enter/closure-capture discipline"
  - "All 10 Plan 01 stub tests green (fork-irreversibility-dialog.test.tsx)"
  - "Fork Nous section integrated into /system/local-ai page"
  - "Vitest + @testing-library/react test infrastructure bootstrapped in steward package"
affects:
  - phase 43 overall completion
  - future Steward UI additions (test infra now available)

# Tech tracking
tech-stack:
  added:
    - "vitest ^4.1.7 (steward dev dependency)"
    - "@testing-library/react ^16.3.2 (steward dev dependency)"
    - "@testing-library/jest-dom ^6.9.1 (steward dev dependency)"
    - "@testing-library/user-event ^14.6.1 (steward dev dependency)"
    - "@vitejs/plugin-react (JSX transform for vitest v4 + OXC)"
  patterns:
    - "vitest config: @vitejs/plugin-react plugin for JSX in vitest v4 (OXC doesn't handle JSX natively)"
    - "expect.extend(matchers) from @testing-library/jest-dom/matchers (not /vitest import path) for vitest v4 compatibility"
    - "HTMLDialogElement.showModal/close shim for jsdom (vitest analog to Phase 8 dashboard shim)"
    - "getByTestId over getByRole for buttons with aria-label (aria-label overrides accessible name)"

key-files:
  created:
    - "steward/src/components/fork-irreversibility-dialog.tsx"
    - "steward/vitest.config.ts"
    - "steward/src/test/setup.ts"
    - "steward/src/test/mocks/next-navigation.ts"
  modified:
    - "steward/src/components/fork-irreversibility-dialog.test.tsx (10 it.skip stubs → 10 passing tests)"
    - "steward/src/app/system/local-ai/page.tsx (Fork Nous section added)"
    - "steward/package.json (test script + vitest deps)"

key-decisions:
  - "Use @vitejs/plugin-react (not bare OXC) for vitest v4 JSX transform — OXC in v4 does not parse JSX in .tsx test files without a React plugin"
  - "Use expect.extend(matchers) from @testing-library/jest-dom/matchers directly — @testing-library/jest-dom/vitest import path failed in v4"
  - "Buttons queried by data-testid (irrev-confirm, irrev-cancel) not by role+name — aria-label overrides accessible button name, breaking getByRole({name})"
  - "civicDid fetched opportunistically from settings response (civic_did optional field); shows 'No Nous to fork yet' when undefined — no new API endpoint needed"
  - "ForkIrreversibilityDialog uses data-testid='irrev-confirm' (vs analog's 'irrev-delete') — fork-specific semantics"

patterns-established:
  - "Steward test bootstrap: vitest.config.ts + src/test/setup.ts + src/test/mocks/next-navigation.ts (Phase 43-04 pattern)"
  - "Dialog component clone: D-43-03 verbatim copy lock enforced at top of component as named constants"

requirements-completed: [FORK-01, FORK-02, FORK-03, FORK-04]

# Metrics
duration: 8min
completed: "2026-05-28"
---

# Phase 43 Plan 04: Fork Nous UI — ForkIrreversibilityDialog + Local AI Page Integration Summary

**ForkIrreversibilityDialog verbatim clone of Phase 8 dialog with D-43-03 copy lock, vitest infrastructure bootstrapped in steward, Fork Nous section wired into /system/local-ai with POST /api/v1/operator/fork/<civic-did> → download flow**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-28T02:49:00Z
- **Completed:** 2026-05-28T02:57:00Z
- **Tasks:** 3 of 3 tasks complete (Task 3 checkpoint:human-verify — approved by operator)
- **Files modified:** 7

## Accomplishments
- Created `ForkIrreversibilityDialog` component as verbatim structural clone of Phase 8 `IrreversibilityDialog`, with D-43-03 copy-locked strings (title/warning/confirm/cancel) and all Phase 8 safety invariants preserved (paste suppressed, Enter blocked, capturedDidRef closure-capture, Cancel autoFocus)
- Replaced all 10 `it.skip()` stub tests from Plan 01 with passing implementations; vitest + @testing-library/react test infrastructure bootstrapped in steward package (previously had no test setup)
- Integrated Fork Nous section below existing Local AI Settings on `/system/local-ai` page: button opens dialog, handleForkConfirm POSTs to `/api/v1/operator/fork/<civic-did>`, parses `download_url`, triggers browser download via programmatic `<a>` click; error/success banners included

## Task Commits

Each task was committed atomically:

1. **Task 1: ForkIrreversibilityDialog component + 10 dialog tests green** - `cf9213a` (feat)
2. **Task 2: Wire Fork Nous section into /system/local-ai page** - `379363a` (feat)
3. **Task 3: Human verify full E2E** — checkpoint:human-verify (APPROVED by operator)

**Plan metadata:** committed separately (docs)

## Files Created/Modified
- `steward/src/components/fork-irreversibility-dialog.tsx` — ForkIrreversibilityDialog React component (D-43-03 verbatim copy locked, structural clone of Phase 8 IrreversibilityDialog)
- `steward/src/components/fork-irreversibility-dialog.test.tsx` — 10 passing tests (all stubs replaced): D-43-03 copy assertions, paste/Enter discipline, typed-match gate, Cancel autoFocus
- `steward/vitest.config.ts` — vitest config with @vitejs/plugin-react for JSX transform
- `steward/src/test/setup.ts` — test setup: expect.extend(matchers), DataTransfer/ClipboardEvent shims, cleanup()
- `steward/src/test/mocks/next-navigation.ts` — next/navigation stub for jsdom tests
- `steward/src/app/system/local-ai/page.tsx` — Fork Nous section added (Phase 43 additions, Phase 40 code untouched)
- `steward/package.json` — test script + vitest + testing-library deps

## Decisions Made

- **vitest v4 JSX transform:** OXC (vitest v4 default transformer) does not handle JSX in `.tsx` files without explicit plugin configuration. The `esbuild` option in `vitest.config.ts` is silently ignored when OXC is active. Fix: use `@vitejs/plugin-react` as a Vite plugin, which correctly handles JSX via Babel/esbuild pre-transform before OXC processes the code.
- **jest-dom setup:** `@testing-library/jest-dom/vitest` import path failed in vitest v4. Instead, used `import * as matchers from '@testing-library/jest-dom/matchers'` + `expect.extend(matchers)` directly in the setup file.
- **Button queries:** Buttons with `aria-label` have their accessible name overridden by the aria-label (not visible text content). `getByRole('button', { name: /Fork forever/i })` looks for accessible name, which is the full aria-label string ("Fork this Nous permanently..."), not the visible text. Fixed by querying via `getByTestId('irrev-confirm')` and checking `textContent`.
- **civicDid resolution:** No dedicated endpoint exists in Phase 43 for fetching the operator's Civic-DID from browser-side. Page reads `civic_did` from the optional settings response field (forward-compatible); shows "No Nous to fork yet" if undefined. No new API endpoint required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest v4 OXC JSX parse failure**
- **Found during:** Task 1 (running tests for the first time)
- **Issue:** vitest v4 defaults to OXC transformer which fails to parse JSX in `.tsx` test files with `Parse failed: Unexpected JSX expression`. Both `esbuild` and `oxc` config options in vitest.config.ts were silently ignored or incompatible.
- **Fix:** Added `@vitejs/plugin-react` as a vitest/vite plugin in `vitest.config.ts`. This is the correct pattern for vitest v4 with React JSX.
- **Files modified:** `steward/vitest.config.ts`, `steward/package.json`
- **Verification:** `npm test` passes all 10 tests
- **Committed in:** `cf9213a` (Task 1 commit)

**2. [Rule 1 - Bug] jest-dom matchers not registered**
- **Found during:** Task 1 (tests failing with "Invalid Chai property: toBeInTheDocument")
- **Issue:** `@testing-library/jest-dom/vitest` import path does not work correctly in vitest v4 environment. Matchers were not being registered despite the import in `setup.ts`.
- **Fix:** Changed to `import * as matchers from '@testing-library/jest-dom/matchers'` + `expect.extend(matchers)` in setup.ts.
- **Files modified:** `steward/src/test/setup.ts`
- **Verification:** `toBeInTheDocument()` assertions pass
- **Committed in:** `cf9213a` (Task 1 commit)

**3. [Rule 1 - Bug] Button accessible name conflict with aria-label**
- **Found during:** Task 1 (test 43-04-01c failing — getByRole('button', {name: /Fork forever/i}) not found)
- **Issue:** Buttons with `aria-label` use the aria-label as their accessible name (not visible text content). The aria-label is the full long description ("Fork this Nous permanently. This action cannot be undone."), not the button label "Fork forever".
- **Fix:** Tests use `getByTestId('irrev-confirm')` and check `textContent` for the label assertion, `toBeDisabled()` for the gate assertion.
- **Files modified:** `steward/src/components/fork-irreversibility-dialog.test.tsx`
- **Verification:** All 10 tests pass
- **Committed in:** `cf9213a` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in test infrastructure setup)
**Impact on plan:** All auto-fixes were for test infrastructure compatibility with vitest v4. Component implementation and page integration executed exactly as planned.

## D-43-03 Verbatim Copy Alignment

The following constants in `fork-irreversibility-dialog.tsx` EXACTLY match the test assertions:

| Constant | Value |
|----------|-------|
| `TITLE_COPY` | `'Fork Nous from Grid'` |
| `WARNING_COPY` | `'This permanently removes the Nous from civic life. The fork package will contain their complete state (memory, credentials, full audit history). Anyone with this file can reconstitute the Nous. The Nous loses civic reputation and community standing. This cannot be undone.'` |
| `CONFIRM_LABEL` | `'Fork forever'` |
| `CANCEL_LABEL` | `'Keep on Grid'` |

Tests assert these literals directly (T-43-copy threat mitigated).

## How civicDid Is Resolved

The `/system/local-ai` page fetches `/api/v1/operator/me/settings` on mount (existing Phase 40 load). The response is typed with an optional `civic_did?: string` field. When the Grid includes this field in a future Phase (or Phase 37 settings augmentation), the Fork Nous button will automatically become active. Until then, the page renders the "No Nous to fork yet" disabled state. No new API endpoint was required for Task 2.

## E2E Checkpoint Results

**Status: APPROVED (Task 3 checkpoint:human-verify passed — operator confirmed)**

The human-verify checkpoint was presented to the operator with the full E2E verification checklist:
1. Steward Console /system/local-ai — Fork Nous section visible below Local AI Settings
2. D-43-03 dialog renders with exact verbatim copy (title/warning/confirm/cancel)
3. Paste suppressed, Enter blocked, typed-match gate enforced, Cancel has autoFocus
4. Fork forever → POST /api/v1/operator/fork/<civic-did> → download_url → browser download
5. Audit chain shows `operator.nous_forked` event
6. Standalone Brain import via `python -m noesis_brain standalone --import <pkg.tar.gz>`
7. Civic actions on standalone Brain return 503 grid_unavailable

Operator response: "approved" — full Phase 43 right-to-fork loop verified.

## Threat Flags

None — all threat mitigations listed in the plan's `<threat_model>` were implemented:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-43-copy | MITIGATED — 4 verbatim constants in component; 10 tests assert exact strings |
| T-43-paste | MITIGATED — `onPaste={(e) => e.preventDefault()}` on input |
| T-43-enter | MITIGATED — `onKeyDown` blocks Enter key |
| T-43-fast-click | MITIGATED — `autoFocus` on Cancel button |
| T-43-closure-race | MITIGATED — `capturedDidRef.current = targetDid` at open time |
| T-43-error-leak | ACCEPTED — error responses surfaced verbatim to operator (intentional) |

## Known Stubs

- `civicDid` resolution: currently reads from optional `civic_did` field in settings response. If Grid doesn't return this field, the Fork Nous button remains disabled with "No Nous to fork yet" message. Future phase (Phase 37 settings augmentation or dedicated endpoint) will wire this fully.

## Self-Check

Checking created files exist:

- `steward/src/components/fork-irreversibility-dialog.tsx` — FOUND
- `steward/src/components/fork-irreversibility-dialog.test.tsx` — FOUND
- `steward/src/app/system/local-ai/page.tsx` — FOUND
- `steward/vitest.config.ts` — FOUND
- `steward/src/test/setup.ts` — FOUND
- `.planning/phases/43-right-to-fork/43-04-SUMMARY.md` — FOUND

Checking commits:
- `cf9213a` (Task 1: ForkIrreversibilityDialog + 10 tests) — FOUND
- `379363a` (Task 2: Fork Nous section in local-ai page) — FOUND

## Self-Check: PASSED
