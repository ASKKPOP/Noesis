---
phase: 03-dashboard-v1-firehose-heartbeat-region-map
plan: 06
subsystem: dashboard
tags: [dashboard, ui, region-map, svg, playwright, e2e, presence, flushSync]
requires: [03-01, 03-02, 03-03, 03-04, 03-05]
provides:
  - "dashboard/src/app/grid/components/region-map.tsx — <RegionMap/> SVG panel (regions + connections + Nous markers with 150ms CSS transition)"
  - "dashboard/src/app/grid/components/region-layout.ts — pure computeRegionLayout() (FNV-1a 32-bit deterministic hash into 5×5 grid, clamped to [0.05, 0.95]²)"
  - "dashboard/src/app/grid/grid-client.tsx — placeholder replaced by <RegionMap/>; ingestAll wraps PresenceStore.applyEvents in flushSync for SC-5 one-render-cycle guarantee"
  - "dashboard/tests/e2e/grid-page.spec.ts — Playwright E2E smoke asserting region map + firehose + heartbeat + marker-move against a mock Grid"
  - "dashboard/tests/e2e/fixtures/mock-grid-server.ts — Fastify + @fastify/websocket mock Grid bound to 127.0.0.1:8080 (regions endpoint + ws/events stream)"
affects:
  - dashboard/src/app/grid/grid-client.tsx
  - dashboard/package.json (added fastify, @fastify/websocket, ws, @types/ws as devDependencies)
tech-stack:
  added:
    - "fastify@^5.0.0 (devDependency) — mock Grid HTTP server for E2E"
    - "@fastify/websocket@^11.0.0 (devDependency) — WS upgrade handler for mock"
    - "ws@^8.18.0 + @types/ws@^8.5.10 (devDependency) — typings for fastify/websocket connections"
  patterns:
    - "Pure-layout module split: computeRegionLayout extracted from region-map.tsx so Playwright specs can import it without dragging in React/'use client'/hooks"
    - "flushSync scoped narrowly around PresenceStore.applyEvents so firehose + heartbeat updates remain batched (only presence needs one-cycle semantics)"
    - "Deterministic FNV-1a 32-bit hash (Math.imul-based) for stable cross-runtime bucketing of region.id → 5×5 grid cell, linear-probing on collision"
    - "Nous markers keyed by DID so React reuses the same <g> node across region changes; CSS transition: transform 150ms ease-out animates the move visually"
key-files:
  created:
    - dashboard/src/app/grid/components/region-map.tsx
    - dashboard/src/app/grid/components/region-map.test.tsx
    - dashboard/src/app/grid/components/region-layout.ts
    - dashboard/tests/e2e/grid-page.spec.ts
    - dashboard/tests/e2e/fixtures/mock-grid-server.ts
  modified:
    - dashboard/src/app/grid/grid-client.tsx
    - dashboard/package.json
  deleted:
    - dashboard/tests/e2e/placeholder.spec.ts (superseded by grid-page.spec.ts)
decisions:
  - "Extract computeRegionLayout into its own .ts module (region-layout.ts) instead of re-exporting from region-map.tsx so Playwright can import the pure math without the 'use client' component and React's usePresence hook graph. Region-map.tsx re-exports computeRegionLayout so existing unit-test imports (`./region-map`) keep working unchanged."
  - "Use real Region shape (id, name, description, regionType, capacity, properties — no x/y) in all test fixtures and mock data. Layout is computed client-side via hashing region.id, resolving 03-RESEARCH.md Open Question Q1b (locked 2026-04-18)."
  - "flushSync applied ONLY around stores.presence.applyEvents(entries) in ingestAll — firehose + heartbeat stay outside so React can batch them normally. Only presence needs one-render-cycle commit for SC-5."
  - "Mock Grid fixture writes CORS headers manually rather than pulling in @fastify/cors as an additional devDependency — fewer moving parts for a test-only artifact bound to 127.0.0.1."
  - "Playwright spec imports the pure layout module via a relative path (../../src/app/grid/components/region-layout) instead of the `@/` alias, avoiding Playwright TS-config alias resolution concerns. Vitest still resolves `@/` via the vitest.config.ts alias."
metrics:
  tasks_completed: 3
  tests_added: 10
  unit_tests_passing: 108
  typescript_errors: 0
  completed_date: 2026-04-18
---

# Phase 3 Plan 06: Dashboard v1 — Region Map + E2E Smoke Summary

Ships the region-map panel (MAP-01 / MAP-02 / MAP-03) and the full-stack Playwright smoke that exercises SC-4 and SC-5 end-to-end: a pure `computeRegionLayout()` (FNV-1a 32-bit, 5×5 grid, clamped to [0.05, 0.95]²), an SVG `<RegionMap/>` with DID-keyed markers that CSS-transition on region change, a `flushSync`-wrapped presence commit for one-render-cycle marker moves, and a 127.0.0.1-bound Fastify mock Grid that drives the dashboard dev server through spawn → 3 ticks → nous.moved.

## Tasks

### Task 1 — RegionMap SVG component

Created `region-map.tsx` (memoized client component) + `region-layout.ts` (pure math) + `region-map.test.tsx` (10 tests, all green). Component renders:

- SVG root with `viewBox="0 0 720 480"`, `role="img"`, `aria-label="Region map"`.
- One `<g data-testid="region-node" data-region-id={r.id}>` per region, containing a `<circle>` at `(layout.x * 720, layout.y * 480)` plus a `<text>` with the region name. Names are rendered as TEXT NODES — never dangerouslySet — mitigating XSS from untrusted Grid payloads (T-03-20).
- One `<line data-edge="{fromRegion}→{toRegion}">` per connection with endpoints at the corresponding region centers. Connections referencing unknown region ids are silently skipped (no thrown error, no edge drawn).
- One `<g data-testid="nous-marker" data-nous-did={did}>` per Nous tracked by `PresenceStore.getSnapshot().allNous`, translated via inline `style.transform` with `transition: 'transform 150ms ease-out'`. Markers are keyed by DID so React preserves the same DOM node on region changes — CSS transition then animates the position (MAP-03).
- Empty regions array renders an `sr-only` `<text>No regions loaded</text>` per the 03-UI-SPEC empty-state copywriting contract.

`computeRegionLayout()` is pure and deterministic: FNV-1a 32-bit hash (Math.imul-based for 32-bit integer semantics) → modulo 25 (5×5 grid) → linear probe on collision → rescale cell center into `[0.05, 0.95]²`. Exported so both the component and the Playwright spec derive identical pixel coordinates without hardcoded magic numbers.

### Task 2 — Wire RegionMap into grid-client with flushSync

Replaced the Plan-05 placeholder `<section>Region map — Coming in Plan 06</section>` with `<RegionMap regions={initialRegions?.regions ?? []} connections={initialRegions?.connections ?? []} />`. Added `import { flushSync } from 'react-dom'` and wrapped `stores.presence.applyEvents(entries)` inside `ingestAll` with `flushSync(() => { ... })` so the marker position commits in the same React cycle as the nous.moved frame arrives (SC-5). Firehose + heartbeat updates stay outside the flushSync so React can batch them normally.

Verified: `grep "coming in Plan 06"` returns no matches; `npx tsc --noEmit` clean; all 108 vitest tests green.

### Task 3 — Playwright E2E smoke

Created `tests/e2e/grid-page.spec.ts` + `tests/e2e/fixtures/mock-grid-server.ts`. The mock Grid:

- Binds Fastify 5 on 127.0.0.1:8080 with `@fastify/websocket`.
- Serves `GET /api/v1/grid/regions` returning 3 regions + 2 connections using the authoritative shape (no x/y; `fromRegion`/`toRegion` — not `from`/`to`).
- On the `/ws/events` endpoint, sends a `hello` frame immediately, waits for the client's `subscribe` frame, then emits `nous.spawned` (payload uses singular `region` — matches `grid/src/genesis/launcher.ts:89`), three `tick` events, and one `nous.moved` (payload uses `fromRegion`/`toRegion` — matches `grid/src/integration/nous-runner.ts:138`), spaced 100–1800 ms apart.
- Isolated to 127.0.0.1 (T-03-24 mitigation); not shipped in any production bundle.

The Playwright spec imports `computeRegionLayout`, `VIEWPORT_W`, `VIEWPORT_H` from the pure `region-layout.ts` module (relative path) so it computes the expected pixel coordinates without hardcoding. Assertions:

- `[data-testid="region-node"]` count ≥ 3 visible within 5 s (SC-4).
- `[data-testid="firehose-row"]` count ≥ 3 within 5 s (SC-3).
- `[data-testid="heartbeat-status"]` has `data-status="live"` within 5 s (SC-6).
- `[data-nous-did="did:example:alice"]` style.transform matches `translate(<expectedX>px, <expectedY>px)` within 5 s (SC-5), using the layout-derived pixel coords for region-b.

Added devDependencies to `dashboard/package.json`: `fastify@^5.0.0`, `@fastify/websocket@^11.0.0`, `ws@^8.18.0`, `@types/ws@^8.5.10`. Deleted the Wave-0 placeholder `tests/e2e/placeholder.spec.ts`.

## Verification Results

- `cd dashboard && npx vitest run` → 14 files / **108 tests passing**, 0 failing.
- `cd dashboard && npx tsc --noEmit -p tsconfig.json` → **0 errors**.
- `cd dashboard && npx vitest run src/app/grid/components/region-map.test.tsx` → **10/10 passing** (RM-1 through RM-10).
- `cd dashboard && npx playwright test tests/e2e/grid-page.spec.ts` → NOT EXECUTED in this sandbox. The sandbox blocks `npx playwright test` (command denied). The test has been written and typechecks clean; it needs to run in an environment that can boot the Next.js dev server on :3001 and the mock Grid on :8080 simultaneously. Deferred to the orchestrator / verifier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] `usePresence()` returns PresenceSnapshot, not raw nousByDid**
- **Found during:** Task 1 implementation.
- **Issue:** The plan's `<action>` snippet used `presence.nousByDid.entries()`, but the actual `usePresence()` hook returns a `PresenceSnapshot` with an `allNous` map (the raw `nousByDid` is a private field on the store, not a hook snapshot).
- **Fix:** Used `presence.allNous.entries()` in the component. Tests written against the real hook shape, all 10 pass.
- **Files modified:** `region-map.tsx` only.

**2. [Rule 3 — Blocking issue] Playwright cannot import `@/` alias or the client component**
- **Found during:** Task 3 implementation.
- **Issue:** The plan's `<action>` imports `{ computeRegionLayout } from '@/app/grid/components/region-map'` in the Playwright spec. Two problems: (a) Playwright's TS transform does not honor the Next.js `@/` alias by default, and (b) `region-map.tsx` is a `'use client'` component that pulls in React + `usePresence` — importing it from a Playwright spec would drag the full hook graph into the test runtime.
- **Fix:** Extracted the pure math into `region-layout.ts` (no React, no `'use client'`, no hooks). The component re-exports `computeRegionLayout` so existing unit-test imports keep working unchanged. The Playwright spec imports via a relative path (`../../src/app/grid/components/region-layout`) to sidestep the alias issue entirely.
- **Files created:** `region-layout.ts`. Files modified: `region-map.tsx` (refactored to import from region-layout + re-export).

### None blocking architectural decisions; no Rule 4 checkpoints required.

## Threat Flags

None — all surface introduced by this plan is covered by the existing `<threat_model>` entries in 03-06-PLAN.md (T-03-20 through T-03-25). The mock Grid binds only to 127.0.0.1 (T-03-24 mitigation honored). The extracted `region-layout.ts` introduces no new network or DOM surface.

## Self-Check: PASSED

- `test -f dashboard/src/app/grid/components/region-map.tsx` → FOUND
- `test -f dashboard/src/app/grid/components/region-map.test.tsx` → FOUND
- `test -f dashboard/src/app/grid/components/region-layout.ts` → FOUND
- `test -f dashboard/tests/e2e/grid-page.spec.ts` → FOUND
- `test -f dashboard/tests/e2e/fixtures/mock-grid-server.ts` → FOUND
- `grep "coming in Plan 06" dashboard/src/app/grid/grid-client.tsx` → NO MATCHES (placeholder successfully removed)
- `grep "<RegionMap" dashboard/src/app/grid/grid-client.tsx` → FOUND
- `grep "flushSync(() => {" dashboard/src/app/grid/grid-client.tsx` → FOUND
- All 108 unit/component tests passing.
- `npx tsc --noEmit` reports 0 errors.

No git commits attempted (sandbox blocks commits by design — orchestrator handles). Files written, verification run where possible, SUMMARY.md complete.
