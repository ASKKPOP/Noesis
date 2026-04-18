---
phase: 03-dashboard-v1-firehose-heartbeat-region-map
plan: 02
subsystem: ui
tags: [nextjs, react-19, tailwind-4, vitest, playwright, jsdom, websocket-mock]

requires:
  - phase: 02-wshub-ws-events-endpoint
    provides: ws-protocol frame shapes (HelloFrame, EventFrame, DroppedFrame) + AuditEntry
provides:
  - dashboard/ as hydrated npm workspace (Next 15.2.4 + React 19.2.5 + Tailwind 4)
  - Vitest 4 (jsdom) + Playwright 1.50 (port 3001, Chromium) configured and executable
  - MockWebSocket class mirroring grid FakeSocket, browser-API compatible
  - ws-frames.ts canonical fixture builders (makeHello/makeEvent/makeDropped/makeAuditEntry/makeTickEntry/makeNousMovedEntry)
  - dashboard/.env.example locking NEXT_PUBLIC_GRID_ORIGIN=http://localhost:8080
  - test-id convention documented for Plans 05 + 06 (firehose-row, heartbeat-status, region-node, nous-marker, event-type-badge)
affects: [03-03, 03-04, 03-05, 03-06, phase-04-docker-compose]

tech-stack:
  added:
    - next@15.2.4
    - react@19.2.5
    - react-dom@19.2.5
    - tailwindcss@^4.0.0
    - "@tailwindcss/postcss@^4.0.0"
    - vitest@^4.1.0
    - "@playwright/test@1.50.0"
    - "@testing-library/react@^16.3.0"
    - "@testing-library/jest-dom@^6.6.3"
    - "@testing-library/user-event@^14.6.1"
    - "@vitejs/plugin-react@^4.3.4"
    - jsdom@^26.0.0
    - typescript@^5.5.0
    - eslint-config-next@15.2.4
  patterns:
    - Tailwind 4 CSS-first via @theme in globals.css (not JS-first config)
    - Dashboard cross-workspace type PARITY enforced by manual review (no cross-imports from grid/)
    - Test-id convention (`data-testid`) reserved for Plans 05 + 06 E2E selectors
    - MockWebSocket emit* test drivers mirror grid/test FakeSocket.emit pattern
    - Atomic Playwright placeholder spec so `playwright test --list` exits 0 in the Wave 0 gate

key-files:
  created:
    - dashboard/package.json
    - dashboard/tsconfig.json
    - dashboard/next.config.mjs
    - dashboard/postcss.config.mjs
    - dashboard/tailwind.config.ts
    - dashboard/vitest.config.ts
    - dashboard/playwright.config.ts
    - dashboard/.env.example
    - dashboard/.gitignore
    - dashboard/src/app/layout.tsx
    - dashboard/src/app/page.tsx
    - dashboard/src/app/globals.css
    - dashboard/src/test/setup.ts
    - dashboard/src/test/smoke.test.ts
    - dashboard/src/test/mocks/mock-websocket.ts
    - dashboard/src/test/fixtures/ws-frames.ts
    - dashboard/tests/e2e/placeholder.spec.ts
  modified:
    - package-lock.json

key-decisions:
  - Tailwind 4 configured CSS-first via @theme in globals.css; tailwind.config.ts retained for tooling/content-paths only
  - tests/e2e/placeholder.spec.ts added to keep playwright --list at exit 0 until Plan 06 writes real specs
  - tsconfig.tsbuildinfo added to .gitignore (TypeScript incremental build artifact, not source)
  - ws-frames.ts intentionally self-contained — no cross-workspace import from grid/src/; parity by review (locks in Plan 03-03 via SYNC header)
  - Dashboard typescript devDep pinned under workspace even though root already has ^5.5.0; Next + eslint-config-next expect local resolution

patterns-established:
  - "Wave 0 test gate: npm run test:unit on dashboard is the canonical Nyquist sample for Plans 03-06"
  - "Test-id convention: kebab-case data-testid attributes on components (firehose-row, heartbeat-status, region-node, nous-marker, event-type-badge) — binding on Plans 05 + 06"
  - "Port lock-in: NEXT_PUBLIC_GRID_ORIGIN=http://localhost:8080 matches grid/src/main.ts default (not the 3000 misnote in 03-RESEARCH.md)"
  - "Dashboard runs on 3001 (Next dev --port 3001) to avoid collision with Grid on 8080 and keep 3000 reserved for any future local tooling"

requirements-completed: [AUDIT-01]

duration: 10min
completed: 2026-04-18
---

# Phase 3 Plan 02: Dashboard Workspace Scaffold Summary

**Next.js 15 + React 19 + Tailwind 4 dashboard workspace with Vitest 4 (jsdom) + Playwright 1.50 harness, MockWebSocket fixture, and ws-protocol frame builders — Wave 0 test gate for Plans 03–06.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-18T11:01:00Z (approx)
- **Completed:** 2026-04-18T11:11:00Z
- **Tasks:** 2
- **Files created:** 17
- **Files modified:** 1 (package-lock.json)

## Accomplishments

- `dashboard/` is a real npm workspace — `npm install` at the repo root hydrates it and `next build` passes.
- Vitest 4 (jsdom) + Playwright 1.50 (port 3001, Chromium) configured and executable — Wave 0 gate unblocks Plans 03–06.
- MockWebSocket browser-API double + ws-frames fixture builders mirror grid server frames verbatim (HelloFrame / EventFrame / DroppedFrame / AuditEntry).
- Grid port 8080 locked into `.env.example` (not 3000 as one section of 03-RESEARCH.md had misnoted).
- Test-id convention documented for Plans 05 + 06 consumption: `firehose-row`, `heartbeat-status`, `region-node`, `nous-marker`, `event-type-badge`.
- Smoke test suite: 9/9 passing, covers MockWebSocket state machine + every fixture builder.

## Task Commits

1. **Task 1: Scaffold dashboard workspace (package.json, configs, globals.css, layout.tsx, page.tsx)** — `09df580` (feat)
2. **Task 2 — RED: Failing smoke test + vitest config + setup** — `066f3c4` (test)
3. **Task 2 — GREEN: MockWebSocket + ws-frames fixtures + Playwright config + placeholder spec** — `f902966` (feat)

_Note: Task 2 has TDD RED + GREEN splits. No REFACTOR commit was needed — GREEN was clean._

## Files Created/Modified

### Dashboard scaffold
- `dashboard/package.json` — Workspace manifest; Next 15.2.4 / React 19.2.5 / Tailwind 4 / Vitest 4 / Playwright 1.50
- `dashboard/tsconfig.json` — strict, bundler resolution, @/* alias to ./src/*
- `dashboard/next.config.mjs` — reactStrictMode; no rewrites (dashboard calls Grid directly via CORS from Plan 01)
- `dashboard/postcss.config.mjs` — Tailwind 4 via `@tailwindcss/postcss` plugin
- `dashboard/tailwind.config.ts` — content paths + legacy `theme.extend` mirror of the CSS-first tokens
- `dashboard/.env.example` — `NEXT_PUBLIC_GRID_ORIGIN=http://localhost:8080`
- `dashboard/.gitignore` — node_modules, .next, test-results, playwright-report, next-env.d.ts, tsconfig.tsbuildinfo
- `dashboard/src/app/layout.tsx` — Root layout with `html.dark`, Noēsis metadata
- `dashboard/src/app/page.tsx` — `redirect('/grid')` placeholder (Plan 05 lands the real `/grid`)
- `dashboard/src/app/globals.css` — Tailwind 4 `@import "tailwindcss"` + `@theme` token block per 03-UI-SPEC

### Test infrastructure
- `dashboard/vitest.config.ts` — jsdom environment, @/* alias, excludes tests/e2e/**, setupFiles
- `dashboard/playwright.config.ts` — testDir=./tests/e2e, port 3001, Chromium, retry 1, baseURL http://localhost:3001
- `dashboard/src/test/setup.ts` — jest-dom matchers registration + afterEach cleanup
- `dashboard/src/test/smoke.test.ts` — 9-case Wave 0 validation gate
- `dashboard/src/test/mocks/mock-websocket.ts` — Browser-API MockWebSocket with emitOpen/emitMessage/emitClose/emitError drivers
- `dashboard/src/test/fixtures/ws-frames.ts` — Canonical ws-protocol fixture builders (resetFixtureIds, makeHello, makeAuditEntry, makeEvent, makeDropped, makeTickEntry, makeNousMovedEntry)
- `dashboard/tests/e2e/placeholder.spec.ts` — Skipped placeholder so `playwright test --list` exits 0 for Wave 0 gate

### Modified
- `package-lock.json` — hydrated dashboard workspace deps (net +324 packages; repo node_modules grew 330M → 745M, dashboard/node_modules is 5.8M)

## Decisions Made

- **Tailwind 4 CSS-first:** Design tokens live in `globals.css` via `@theme`; `tailwind.config.ts` retained as a thin compatibility shim with `content` paths + `extend` mirror. Reason: Tailwind 4 deprecates `theme.extend` as the primary surface, but Next 15's ESLint + IDE integrations still probe for the config file.
- **Playwright placeholder spec:** `tests/e2e/placeholder.spec.ts` with `test.skip()` added so `npx playwright test --list` exits 0 (the acceptance criterion requires exit 0; empty test dirs exit 1 in Playwright 1.50). Plan 06 replaces it.
- **tsconfig.tsbuildinfo gitignored:** TypeScript's `incremental: true` option writes a buildinfo file on every `tsc --noEmit`. Not source — ignore it alongside `.next/` and `node_modules/`.
- **ws-frames.ts self-contained:** Deliberately no `import from '../../../grid/src/...'` — dashboard workspace stays decoupled. Shape parity with `grid/src/api/ws-protocol.ts` and `grid/src/audit/types.ts` is enforced by manual review. Plan 03-03 will add a SYNC header that pins the source-of-truth reference.
- **Grid port 8080 (not 3000):** Verified against `grid/src/main.ts:142`: `const port = process.env.GRID_PORT ? parseInt(process.env.GRID_PORT, 10) : 8080;`. 03-RESEARCH.md §Standard Stack had briefly referenced 3000; .env.example locks 8080 so no downstream plan re-verifies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Added `tsconfig.tsbuildinfo` to `.gitignore`**
- **Found during:** Task 1 (`git status` after `tsc --noEmit`)
- **Issue:** Plan specified `.gitignore` without the `tsconfig.tsbuildinfo` entry; TypeScript incremental builds write this artifact and it would show up as untracked on every typecheck.
- **Fix:** Added `tsconfig.tsbuildinfo` line to `dashboard/.gitignore`.
- **Files modified:** `dashboard/.gitignore`
- **Verification:** `git check-ignore -v dashboard/tsconfig.tsbuildinfo` matches.
- **Committed in:** `09df580` (Task 1 commit).

**2. [Rule 3 — Blocking] Added `dashboard/tests/e2e/placeholder.spec.ts`**
- **Found during:** Task 2 verification (`npx playwright test --list` exited 1 with `Error: No tests found`).
- **Issue:** Plan's acceptance criterion requires `playwright test --list` to exit 0, but Playwright 1.50 exits 1 when the testDir is empty.
- **Fix:** Added a `test.skip()` placeholder spec that satisfies the exit-0 contract and is explicitly marked for replacement by Plan 06's `nous-moves.spec.ts`.
- **Files modified:** `dashboard/tests/e2e/placeholder.spec.ts` (created)
- **Verification:** `npx playwright test --list` now exits 0 with "Total: 1 test in 1 file".
- **Committed in:** `f902966` (Task 2 GREEN commit).

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues required for verify commands to pass).
**Impact on plan:** Zero scope change. Both deviations close small gaps between the plan's verify commands and Next/Playwright 1.50 actual behavior. No architectural change; no test-id convention change.

## Issues Encountered

- **Vite/esbuild deprecation warnings during Vitest 4 run:** `@vitejs/plugin-react` still passes legacy `esbuild` options; Vite 7 (which ships with Vitest 4) prefers `oxc`. The warnings are cosmetic — the oxc path is used and tests pass. **Left as-is** — fixing requires a Vite plugin update outside this plan's scope. Logged for future attention when `@vitejs/plugin-react` ships an oxc-first release.
- **Next.js 15.2.4 CVE-2025-66478 advisory from npm:** Plan 02 pins 15.2.4 exactly (per threat T-03-05 exact-version pinning). Upgrading is a planner decision for a follow-up wave; **not auto-fixed** here because it changes locked versions. Logged as deferred.

## Deferred Issues

- **Next.js 15.2.4 has a published CVE (CVE-2025-66478).** Plan 02 pins the exact version; any upgrade must flow through replanning. Recommend opening a follow-up plan in Phase 3 or Phase 4 to bump to the latest patched 15.x once 03-RESEARCH.md's stack-lock is revisited.
- **`@vitejs/plugin-react` esbuild options deprecation.** Cosmetic warnings only; will clear when the plugin ships an oxc-native release.

## Known Stubs

- **`src/app/page.tsx`** redirects to `/grid` which is not yet implemented (Plan 05 lands `app/grid/page.tsx`). This is intentional and documented in the plan: Task 1 explicitly says "Do NOT create `src/app/grid/page.tsx` yet — that is Plan 05." The redirect will start producing a 404 until Plan 05; this is the expected scaffold state.
- **`tests/e2e/placeholder.spec.ts`** is a skipped no-op; Plan 06 replaces it with `nous-moves.spec.ts`.

## Threat Flags

None. No new security-relevant surface introduced beyond what the plan's `<threat_model>` already enumerates (T-03-05 dep-pinning, T-03-06 .env.example accept, T-03-07 playwright auto-start accept).

## TDD Gate Compliance

Task 2 was TDD-enforced:

- ✅ **RED gate:** `066f3c4` (`test(03-02): add failing smoke test for Wave 0 test infrastructure`) — smoke test written before implementation, verified failing via import-resolution error on MockWebSocket + ws-frames.
- ✅ **GREEN gate:** `f902966` (`feat(03-02): implement MockWebSocket, ws-frames fixtures, Playwright config`) — 9/9 tests pass.
- No REFACTOR commit — GREEN implementation was clean; no cleanup pass needed.

Task 1 (scaffold) is not TDD (pure config generation); its verify gate is `next build` + `tsc --noEmit`, both passing.

## User Setup Required

None — all scaffolding is local-filesystem and npm-registry. No external accounts, no dashboard configuration, no secrets.

## Next Phase Readiness

- ✅ Plans 03, 04, 05, 06 can `import { MockWebSocket } from '@/test/mocks/mock-websocket'` and `import { makeHello, makeEvent, ... } from '@/test/fixtures/ws-frames'` with zero further setup.
- ✅ `cd dashboard && npm run test:unit` is the canonical Nyquist sampling command for all downstream plans in this phase.
- ✅ Test-id convention documented and available for Plans 05 (firehose-row, heartbeat-status, event-type-badge) and 06 (region-node, nous-marker).
- ⚠️ Plan 01 (Grid CORS) runs in parallel in Wave 1 — dashboard will not be able to talk to Grid until Plan 01's CORS allowlist admits `http://localhost:3001`. This dependency is by design (Wave 1 parallelism).

## Dashboard Workspace File Tree at Completion

```
dashboard/.env.example
dashboard/.gitignore
dashboard/next-env.d.ts                  [gitignored — Next-generated]
dashboard/next.config.mjs
dashboard/package.json
dashboard/playwright.config.ts
dashboard/postcss.config.mjs
dashboard/src/app/globals.css
dashboard/src/app/layout.tsx
dashboard/src/app/page.tsx
dashboard/src/test/fixtures/ws-frames.ts
dashboard/src/test/mocks/mock-websocket.ts
dashboard/src/test/setup.ts
dashboard/src/test/smoke.test.ts
dashboard/tailwind.config.ts
dashboard/tests/e2e/placeholder.spec.ts
dashboard/tsconfig.json
dashboard/tsconfig.tsbuildinfo           [gitignored — TS incremental build]
dashboard/vitest.config.ts
```

## Dependency / Size Impact

- **Pre-install:** `node_modules` = 330M (grid + protocol + cli only, measured before this plan)
- **Post-install:** `node_modules` = 745M total; `dashboard/node_modules` = 5.8M (hoisted)
- **Delta:** +415M (Next.js, React 19, Tailwind 4, Vitest 4, Playwright 1.50 + Chromium via `npx playwright install` NOT run yet — will add ~150M when first E2E runs in Plan 06)
- **Total new packages:** 324 (per `npm install` output)

## Self-Check: PASSED

File existence:
- ✅ FOUND: `dashboard/package.json`
- ✅ FOUND: `dashboard/tsconfig.json`
- ✅ FOUND: `dashboard/next.config.mjs`
- ✅ FOUND: `dashboard/postcss.config.mjs`
- ✅ FOUND: `dashboard/tailwind.config.ts`
- ✅ FOUND: `dashboard/vitest.config.ts`
- ✅ FOUND: `dashboard/playwright.config.ts`
- ✅ FOUND: `dashboard/.env.example`
- ✅ FOUND: `dashboard/.gitignore`
- ✅ FOUND: `dashboard/src/app/layout.tsx`
- ✅ FOUND: `dashboard/src/app/page.tsx`
- ✅ FOUND: `dashboard/src/app/globals.css`
- ✅ FOUND: `dashboard/src/test/setup.ts`
- ✅ FOUND: `dashboard/src/test/smoke.test.ts`
- ✅ FOUND: `dashboard/src/test/mocks/mock-websocket.ts`
- ✅ FOUND: `dashboard/src/test/fixtures/ws-frames.ts`
- ✅ FOUND: `dashboard/tests/e2e/placeholder.spec.ts`

Commit verification:
- ✅ FOUND: `09df580` (Task 1: scaffold)
- ✅ FOUND: `066f3c4` (Task 2 RED: failing smoke test)
- ✅ FOUND: `f902966` (Task 2 GREEN: mocks + fixtures + playwright)

Verify commands:
- ✅ `npm install` at repo root — exit 0, 324 packages added
- ✅ `cd dashboard && npm run build` — exit 0, 4/4 static pages generated
- ✅ `cd dashboard && npm run test:unit` — exit 0, 9/9 tests pass
- ✅ `cd dashboard && npx tsc --noEmit` — exit 0, zero type errors
- ✅ `cd dashboard && npx playwright test --list` — exit 0, 1 placeholder test listed

---
*Phase: 03-dashboard-v1-firehose-heartbeat-region-map*
*Completed: 2026-04-18*
