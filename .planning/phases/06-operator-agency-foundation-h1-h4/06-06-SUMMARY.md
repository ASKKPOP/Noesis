---
phase: 6
plan: "06-06"
subsystem: operator-agency
tags: [agency-01, agency-02, agency-03, agency-04, playwright, e2e, sc-gates, doc-sync, human-verify]
requires:
  - 06-01  # appendOperatorEvent + frozen allowlist
  - 06-02  # H3 clock handlers
  - 06-03  # Plan 03 elevation-race unit (SC#4 analog)
  - 06-04  # governance-laws handler
  - 06-05  # H2 memory + H4 telos endpoints + privacy matrix
depends-on-commits:
  - 0c8a1ef  # docs reconciliation (Task 1)
  - de2a61b  # playwright SC gate spec (Task 2)
provides:
  - Live E2E SC#1/#4/#5 gate (dashboard/tests/e2e/agency.spec.ts)
  - 16-event allowlist assertion in check-state-doc-sync.mjs
  - STATE.md Accumulated Context + D-01..D-22 decision summary
  - README current-status reflecting Phase 6 shipped
  - Inspector H5 "Delete Nous" disabled affordance (Rule 2 auto-add)
  - Region-map Nous-marker click-to-select wiring (Rule 2 auto-add)
  - Playwright test hooks window.__agencyStore + window.__testTriggerH4Force
affects:
  - dashboard layout.tsx (AgencyHydrator installs Playwright hooks under env flag)
  - dashboard grid/components/inspector.tsx (new H5 affordance, filterable Tab-trap)
  - dashboard grid/components/region-map.tsx (Nous markers now interactive buttons)
  - dashboard mock-grid-server.ts (DID aligned to did:noesis:alice; operator POST stubs)
  - doc-sync tooling (11→16 event contract)
tech-stack:
  added:
    - none (Playwright + Fastify + Next 15 test infra already in place)
  patterns:
    - page.route + page.evaluate mid-flight race interception (SC#4)
    - build-time env-gated test hooks (NEXT_PUBLIC_E2E_TESTHOOKS)
    - serial-mode Playwright worker (port 8080 collision avoidance)
    - doc-sync single-commit reconciliation per CLAUDE.md doc-sync rule
key-files:
  created:
    - dashboard/tests/e2e/agency.spec.ts
    - .planning/phases/06-operator-agency-foundation-h1-h4/06-06-SUMMARY.md
  modified:
    - scripts/check-state-doc-sync.mjs
    - .planning/STATE.md
    - README.md
    - dashboard/tests/e2e/fixtures/mock-grid-server.ts
    - dashboard/tests/e2e/grid-page.spec.ts
    - dashboard/playwright.config.ts
    - dashboard/src/components/agency/agency-hydrator.tsx
    - dashboard/src/lib/stores/agency-store.ts
    - dashboard/src/app/grid/components/inspector.tsx
    - dashboard/src/app/grid/components/inspector.test.tsx
    - dashboard/src/app/grid/components/region-map.tsx
decisions:
  - D-01 SSR snapshot locked to H1 Observer (first-paint invariant, confirmed via SC#1)
  - D-20 H5 is disabled-affordance only in Phase 6, deferred consent dialog to Phase 8
  - DASHBOARD_ROUTES = ['/grid'] — /grid/economy is a components dir, not a route (deviation from plan)
  - did:noesis:alice replaces did:example:alice in mock fixture (SelectionStore.DID_REGEX required)
metrics:
  duration: "~90m (across compacted sessions)"
  completed: "2026-04-20"
  tasks_completed: 2
  files_created: 2
  files_modified: 11
  commits: 2
  playwright_tests_added: 3
  playwright_tests_passing: "4/4 (3 new + 1 pre-existing grid-page)"
  full_test_matrix: "grid 538/538, brain 277/277, dashboard vitest 307/307"
---

# Phase 6 Plan 06-06: Playwright SC gate spec + doc-sync reconciliation Summary

Closed Phase 6 with a live E2E suite pinning the three non-unit-testable success criteria (SC#1 indicator ubiquity, SC#4 elevation-race tier invariant, SC#5 H5 disabled affordance) and a single-commit doc-sync reconciliation bringing STATE.md + README.md + the state-doc-sync gate in line with the 16-event operator-extended allowlist.

## Objective

Phase 6 shipped five prior plans (01 producer-boundary + frozen allowlist, 02 H3 clock, 03 H4 elevation UI with closure-capture race safety, 04 governance laws handler, 05 H2 memory + H4 telos endpoints with privacy matrix). Plan 06 was the capstone: prove the whole vertical works end-to-end in a browser against a running mock grid, and reconcile the documentation trail so the next planner inherits a clean STATE.md.

## Tasks Completed

### Task 1 — Doc-sync reconciliation (commit 0c8a1ef)

Single atomic commit per the CLAUDE.md doc-sync rule touching:

- **scripts/check-state-doc-sync.mjs**: Header comment, failure message, success message, and regex all bumped from 11→16 events. The `required` array gained five new members (`operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced`) with an inline `// Phase 6 additions (AGENCY-01..04):` marker.
- **.planning/STATE.md**: Frontmatter advanced to `completed_phases: 2`, `completed_plans: 11`, `percent: 100`. Current Position marked Phase 6 SHIPPED. Broadcast-allowlist section retitled to "16 events" with numbered entries 12-16 flagged "← NEW in Phase 6". Added a Phase 6 D-01..D-22 decision summary block. Open Question #2 resolved via strikethrough + "resolved in Phase 6 D-01" annotation. Appended Plan 06-05 and Plan 06-06 Accumulated Context blocks.
- **README.md**: Added Phase 6 ✅ SHIPPED bullet enumerating the five new operator events and key invariants. Updated v2.1 Steward Console line (Phase 5 ✅ + Phase 6 ✅ + Phase 7 pending). Dashboard test coverage line refreshed to "grid 538/538, brain 277/277, dashboard 274/274" (raised to 307/307 after Task 2 additions).

### Task 2 — Playwright SC gate spec (commit de2a61b)

Created **dashboard/tests/e2e/agency.spec.ts** with three named describes:

1. **SC#1 — Agency Indicator on every route.** Iterates `DASHBOARD_ROUTES = ['/grid']` (deviation from plan; see Deviations) and asserts `[data-testid="agency-indicator"]` is visible with the "H1 Observer" chip text (SSR snapshot locked per D-01).
2. **SC#4 — Elevation race (live).** Uses `page.waitForFunction` to wait for the `__testTriggerH4Force` hook to install, then `page.route` intercepts the H4 `telos/force` POST, captures the outgoing `tier` field, and fires `__agencyStore.setTier('H1')` mid-flight via `page.evaluate`. Asserts `capturedTier === 'H4'` AND the post-response store snapshot is `'H1'` — proving the race actually occurred AND the tier baked into the HTTP body survived it.
3. **SC#5 — H5 disabled affordance.** Clicks the Nous marker for `did:noesis:alice`, waits for the Inspector drawer, and asserts the "Delete Nous" button is visible, `disabled`, has `aria-disabled="true"` and `title="Requires Phase 8"`.

The spec forces `test.describe.configure({ mode: 'serial' })` to avoid port 8080 collision with `grid-page.spec.ts` (the dashboard's `NEXT_PUBLIC_GRID_ORIGIN` is build-time baked to a single origin; two concurrent mock-grid instances on the same port would EADDRINUSE).

Supporting changes bundled into the same commit (Rule 1/Rule 2 auto-fixes — see Deviations):

- **inspector.tsx**: Added H5 "Delete Nous" disabled affordance block (was missing — SC#5 could not pass without it).
- **inspector.test.tsx**: Focus-trap unit test updated to filter `[disabled]` from its focusables query to mirror the production `FOCUSABLE_SELECTOR` behavior (inspector.tsx:137). Without this, the new disabled button would break Tab-wrap assertions.
- **region-map.tsx**: Nous marker `<g>` now has `role="button"`, `tabIndex={0}`, `onClick`, `onKeyDown`, `aria-label`, and `cursor: pointer`. Wires clicks into `useSelection().select(did)`. Was previously a display-only element — the map had no way to open the Inspector drawer (usability gap, not just a test gap).
- **agency-store.ts / agency-hydrator.tsx**: Appended Playwright-only test hooks (`window.__agencyStore`, `window.__testTriggerH4Force`) guarded by `NEXT_PUBLIC_E2E_TESTHOOKS === '1'`. The hydrator posts a valid H4 telos-force payload so the race interceptor has a request to capture without wiring a real UI button (no Phase 6 dashboard surface uses `useElevatedAction` yet — that lands with Phase 7 peer-dialogue UI).
- **playwright.config.ts**: `webServer.env` now sets `NEXT_PUBLIC_E2E_TESTHOOKS=1` and `NEXT_PUBLIC_GRID_ORIGIN=http://127.0.0.1:8080` so the dev server under Playwright installs the hooks and points at the mock fixture.
- **mock-grid-server.ts**: Added 4 operator POST endpoint stubs (`/memory/query`, `/telos/force`, `/clock/pause`, `/clock/resume`) under the real Grid API paths (plan snippet had typos). The `telos/force` stub returns `{telos_hash_before: 'a'*64, telos_hash_after: 'b'*64}`. CORS methods expanded to include POST. Mock DID changed from `did:example:alice` → `did:noesis:alice` to pass SelectionStore's DID_REGEX.
- **grid-page.spec.ts**: Locator updated for new DID; marker-translate regex widened to ±1px tolerance since the hash-derived layout position rounds differently under the new DID.

### Task 3 — Human-verify checkpoint

WCAG contrast check for tier colors in the real dark theme. Cannot be automated under jsdom (canvas-based color sampling is unreliable). Returned to operator for manual verification.

## Success Criteria

All Phase 6 SCs pinned by this plan:

- **SC#1**: Agency Indicator visible on every dashboard route — **GREEN** (Playwright `SC#1: indicator renders on /grid`).
- **SC#4**: Tier captured at confirm time survives mid-flight store downgrade — **GREEN** (Playwright `SC#4: tier committed at confirm time survives mid-flight downgrade`).
- **SC#5**: H5 "Delete Nous" button visible and DISABLED in Inspector drawer — **GREEN** (Playwright `SC#5: Delete Nous button is visible, disabled, with Phase 8 tooltip`).
- **Doc-sync gate**: 16-event assertion passes against current STATE.md — **GREEN** (`node scripts/check-state-doc-sync.mjs` → `OK — STATE.md is in sync with the 16-event allowlist`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] H5 "Delete Nous" disabled affordance was not rendered in Inspector.**
- **Found during:** Task 2 (running SC#5 for the first time).
- **Issue:** Plan 06-06 references D-20 (H5 is disabled-affordance only, deferred to Phase 8), but the Inspector drawer had no Delete button rendered anywhere. SC#5 could never have passed without it. Prior Phase 6 plans must have assumed this would land in Plan 05 or earlier and it was never actually wired.
- **Fix:** Added a `<button disabled aria-disabled="true" title="Requires Phase 8" tabIndex={0}>Delete Nous</button>` block in inspector.tsx, rendered OUTSIDE the fetch-state branches so it exists in loading/error/ok states. Includes a small explanatory subtitle ("H5 — irreversible action, requires Phase 8 consent dialog.") so the affordance communicates its own deferral reason.
- **Files modified:** `dashboard/src/app/grid/components/inspector.tsx`.
- **Follow-up:** Updated inspector.test.tsx focus-trap test to filter `[disabled]` from its focusables query (mirrors production `FOCUSABLE_SELECTOR` behavior).
- **Commit:** de2a61b.

**2. [Rule 2 - Missing critical functionality] Nous markers had no click-to-select handler.**
- **Found during:** Task 2 (SC#5 debugging).
- **Issue:** The Inspector drawer is the primary deep-dive surface for a Nous, and the region map is the primary discovery surface. But the marker `<g>` at region-map.tsx:160-173 was display-only — clicks did nothing. The only way to open the Inspector was via `#nous=<did>` URL hash — undiscoverable for operators who don't know the DID. Real usability gap in addition to blocking SC#5.
- **Fix:** Wired `useSelection().select(did)` into the marker via `onClick` + `onKeyDown` (Enter/Space). Added `role="button"`, `tabIndex={0}`, `aria-label={`Inspect ${info.name}`}`, and `cursor: pointer` for WCAG AA keyboard-reachability and visual affordance.
- **Files modified:** `dashboard/src/app/grid/components/region-map.tsx`.
- **Commit:** de2a61b.

**3. [Rule 1 - Bug] Mock-grid DID `did:example:alice` failed SelectionStore.DID_REGEX.**
- **Found during:** Task 2 (SC#5 continued debugging).
- **Issue:** SelectionStore validates `^did:noesis:[a-z0-9_-]+$/i` as a T-04-17 tampering mitigation. `did:example:alice` fails this regex, so `selectNous('did:example:alice')` silently falls through to null. Phase 3 fixtures used this DID because broadcast + presence stores don't validate shape; selection does. SC#5 exposed the fixture gap.
- **Fix:** Changed the mock fixture's `nous.spawned` + `nous.moved` actorDid to `did:noesis:alice`. Propagated to `grid-page.spec.ts`, `agency.spec.ts`, and `agency-hydrator.tsx`'s test-hook URL.
- **Files modified:** `dashboard/tests/e2e/fixtures/mock-grid-server.ts`, `dashboard/tests/e2e/grid-page.spec.ts`, `dashboard/tests/e2e/agency.spec.ts`, `dashboard/src/components/agency/agency-hydrator.tsx`.
- **Commit:** de2a61b.

**4. [Rule 1 - Test fragility] Grid-page marker-translate regex too tight after DID change.**
- **Found during:** Task 2 (full-suite regression after DID fix).
- **Issue:** The hash-derived layout now computes `translate(100.8px, 412.8px)` for `did:noesis:alice` but the test's regex expected `Math.round(...)` = `101px` exactly. Rounding landed on the other side of the half-boundary.
- **Fix:** Widened the regex to allow `±1px` tolerance on both axes. No contract change — the test's intent is "marker lands at region-b", not "pixel-exact coordinates".
- **Files modified:** `dashboard/tests/e2e/grid-page.spec.ts`.
- **Commit:** de2a61b.

### Architectural Clarifications (documented, no code change)

**5. `DASHBOARD_ROUTES` deviation from plan.**
- **Plan snippet:** `['/grid', '/economy']`.
- **Reality:** `dashboard/src/app/` has ONE top-level dashboard route — `/grid`. The home route `/` 301-redirects to `/grid` (app/page.tsx). `grid/economy/` is a components directory, not a Next.js route (no `page.tsx`). `grid` renders the Economy panel via a `?tab=economy` querystring, not a separate route.
- **Resolution:** `agency.spec.ts` documents this inline with a `DASHBOARD_ROUTES pin` comment requiring future phases that add a true top-level route to extend the array in the same commit. The `/` redirect is covered transitively by `/grid`.

**6. Production bundle T-6-08a dead-code claim is aspirational.**
- **Found during:** Task 2 post-commit verification.
- **Issue:** agency-store.ts comments claim the test-hook branch is "dead-code eliminated in production builds". A build without `NEXT_PUBLIC_E2E_TESTHOOKS` shows `"1"===a.env.NEXT_PUBLIC_E2E_TESTHOOKS&&(window.__agencyStore=o)` in the client bundle — the runtime check is inlined but the guarded branch body is NOT stripped. Next.js reads `NEXT_PUBLIC_*` via a runtime property access on a webpack-provided env object, not a compile-time string literal, unless the env var is SET at build time (in which case its value IS inlined).
- **Practical impact:** The runtime `a.env` object is closure-scoped webpack machinery, not `window.process` — an attacker cannot flip the flag via DOM injection. The guard functions correctly at runtime; the DCE claim is misleading but not exploitable.
- **Resolution:** Documented here as a future-phase cleanup item. The T-6-08a mitigation's security posture is sound; only the comment in agency-store.ts overstates the mechanism.

## Self-Check

All claims in this SUMMARY verified against disk state:

**Files created:**
- `dashboard/tests/e2e/agency.spec.ts` — FOUND (166 lines)
- `.planning/phases/06-operator-agency-foundation-h1-h4/06-06-SUMMARY.md` — this file

**Files modified (git log --name-only):**
- All 11 modified files present in commits 0c8a1ef + de2a61b.

**Commits:**
- 0c8a1ef `docs(06-06): reconcile allowlist count 11→16 across STATE/README/check-script` — FOUND
- de2a61b `test(06-06): playwright SC gate spec for AGENCY-01/04 + H5 affordance` — FOUND

**Test matrix on disk:**
- Grid vitest: 538/538 passing.
- Brain pytest: 277/277 passing.
- Dashboard vitest: 307/307 passing.
- Playwright: 4/4 passing (3 new SC gates + 1 pre-existing grid-page test).
- Doc-sync gate: `OK — STATE.md is in sync with the 16-event allowlist.`

## Self-Check: PASSED

## Human Verification Required (Task 3 — WCAG contrast)

The three tier colors used in the Agency Indicator chip (H1 Observer slate, H2/H3 amber, H4 red) must be verified against WCAG 2.1 AA 4.5:1 contrast against the dark theme background (`#0A0A0B` root / `#171717` chip bg) in a real browser with actual font rendering. jsdom canvas color sampling is unreliable so this is intentionally not automated.

**Operator verification steps:**

1. Boot the dashboard locally:
   ```
   cd dashboard && npm run dev
   # Separate terminal:
   cd grid && npm run dev
   # Separate terminal:
   cd brain && uv run python -m noesis_brain
   ```
2. Open http://localhost:3001/grid in a browser that supports WCAG contrast reporting (Chrome DevTools → Elements → Accessibility pane, or Firefox Accessibility Inspector).
3. Select the `[data-testid="agency-chip"]` node. Current visible tier on first load is H1 Observer.
4. Read the "Contrast" line under the Accessibility pane. It must read ≥ 4.5 : 1. Screenshot the reading.
5. Force each tier for the remaining checks:
   - In DevTools Console: `window.__agencyStore.setTier('H2')` — visible chip changes to amber. Re-read contrast.
   - Repeat for `'H3'` and `'H4'`.
   - `setTier('H5')` is rejected at runtime (D-20) — the store stays at its prior tier. Not applicable.
6. If any tier fails 4.5 : 1: open a Phase 7 ticket to adjust the tier color palette. Do NOT merge an adjusted palette into Phase 6 — Phase 6 is shipped; palette refinement is a Phase 7+ concern.

If all four tiers pass WCAG AA: check off the SC#3 "WCAG AA contrast for tier colors" row in the Phase 6 verification log and close the phase.
