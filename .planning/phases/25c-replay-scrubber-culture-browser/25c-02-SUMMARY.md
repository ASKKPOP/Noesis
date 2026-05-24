---
phase: 25c
plan: "02"
subsystem: dashboard/replay
tags: [vitest, vite8, jsx, oxc, replay, tier-gate, d07]
dependency_graph:
  requires: []
  provides: [replay-client-tests-green, vitest-jsx-parse-fixed]
  affects: [dashboard-test-suite]
tech_stack:
  added: []
  patterns: [vite8-oxc-jsx-transform]
key_files:
  created: []
  modified:
    - dashboard/vitest.config.ts
    - dashboard/package.json
    - package-lock.json
decisions:
  - "Use Vite 8 native OXC jsx config instead of @vitejs/plugin-react plugin for vitest 4.x"
  - "replay-client.tsx was already fully implemented from Phase 13 — no source changes needed"
metrics:
  duration: "2m"
  completed: "2026-05-22"
  tasks_completed: 2
  files_changed: 3
---

# Phase 25c Plan 02: D-07 Replay Client Tests GREEN Summary

**One-liner:** Fixed Vite 8/rolldown OXC JSX incompatibility in vitest 4.1.4, making all 10 replay-client.test.tsx tests pass and honoring the Phase 13 REPLAY-05 acceptance contract.

## What Was Built

**Task 1 — Fix JSX parse for dashboard vitest (D-07 Pitfall 1):**

The dashboard uses vitest 4.1.4, which bundles Vite 8 (rolldown/oxc pipeline). The original `vitest.config.ts` used `@vitejs/plugin-react` (a babel-based plugin targeting Vite 4-7), which is incompatible with Vite 8's OXC transform. This caused all 44 JSX test files to fail with "Failed to parse source / Unexpected JSX expression" errors.

Fix: replaced the `plugins: [react()]` approach with Vite 8's native `oxc.jsx` configuration:
```typescript
oxc: {
    jsx: { runtime: 'automatic' },
},
```

This eliminates the babel/OXC conflict. No external plugin needed for Vite 8 JSX.

Also installed `@vitejs/plugin-react@^4.7.0` locally in dashboard's `node_modules` (was missing locally; only existed at root via npm workspace hoisting, but at an incompatible version for the bundled Vite 8).

**Task 2 — Make replay-client.test.tsx RED stubs GREEN (D-07):**

`replay-client.tsx` was already fully and correctly implemented from Phase 13 (the test stubs were RED only because JSX parse failed, not because the implementation was missing). After fixing the vitest config, all 10 tests passed immediately without any source changes to `replay-client.tsx`.

Verified threat model mitigations present in the existing implementation:
- T-25c-02-01: `tierAtLeast(tier, 'H3')` gate — renders `TIER_GATE_COPY` for H1/H2, no slider ✓
- T-25c-02-02: H3 payload redaction — `H4_PLACEHOLDER` / `H5_PLACEHOLDER` in FirehoseRow ✓
- T-25c-02-03: read-only surface — no mutations from replay-client ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest config incompatible with bundled Vite 8 OXC**
- **Found during:** Task 1
- **Issue:** `@vitejs/plugin-react` (babel-based) conflicts with Vite 8's oxc pipeline in vitest 4.1.4. Warning: "Both esbuild and oxc options were set. oxc options will be used and esbuild options will be ignored." JSX was never transformed.
- **Fix:** Rewrote `vitest.config.ts` to use `oxc: { jsx: { runtime: 'automatic' } }` — Vite 8 native config, no plugin needed.
- **Files modified:** `dashboard/vitest.config.ts`
- **Commit:** 661c1d4

**2. [Rule 3 - Blocking] @vitejs/plugin-react@6.x incompatible with root vite 5.x**
- **Found during:** Task 1 investigation
- **Issue:** Attempted to install `@vitejs/plugin-react@6.0.2` (designed for Vite 8) but it imports `vite/internal` which is not exported by root vite 5.4.21. Config loading failed.
- **Fix:** Pivoted to native Vite 8 OXC config instead of installing v6 plugin.
- **Files modified:** none (root package.json reverted)

## Deferred Items

21 pre-existing test failures in 5 test files were revealed after fixing the JSX parse issue. They are behavioral failures from the `feat/grid-retheme-portal-dashboard` branch's theme changes (Tailwind class renames, data-testid changes):

- `firehose-row.test.tsx`: `border-rose-900` → actual `border-rose-400`
- `heartbeat.test.tsx`: `text-red-400` → actual `animate-pulse`
- `inspector.test.tsx`: missing `section-psyche`, `inspector-h5-delete` testids
- `delete-flow.test.tsx`: integration failures downstream of inspector changes
- `PortalSidebarHeader.test.tsx`: `aside.style.transform` empty (was handled via class)

These are outside the scope of D-07. Logged to `deferred-items.md`.

## Verification Results

```
cd dashboard && npx vitest run src/app/grid/replay/replay-client.test.tsx --reporter=dot
→ Tests: 10 passed (10) ✓

grep -r "validateTierBody" dashboard/src/
→ 0 matches ✓

grep -rn "import.*d3|import.*recharts|import.*react-flow|import.*cytoscape" dashboard/src/app/grid/replay/
→ 0 matches ✓
```

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Only test infrastructure files modified.

## Self-Check: PASSED

- vitest.config.ts exists and uses OXC config: confirmed ✓
- dashboard/package.json has @vitejs/plugin-react in devDependencies: confirmed ✓
- Commit 661c1d4 exists: confirmed ✓
- All 10 replay-client.test.tsx tests pass: confirmed ✓
- No banned imports in replay directory: confirmed ✓
