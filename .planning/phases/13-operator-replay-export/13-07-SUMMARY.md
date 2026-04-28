---
phase: 13-operator-replay-export
plan: "07"
subsystem: dashboard
tags: [replay, ui, dashboard, gap-closure, store-context, tier-redaction, phase-13]
dependency_graph:
  requires:
    - 13-05: ReplayClient shell + replayMode props + wall-clock CI gate
    - 13-06: STATE.md + tar gaps closed
  provides:
    - "ReplayStoresProvider: replay-scoped FirehoseStore + PresenceStore seeded from prop-fed entries"
    - "ReplayClient: mounts Firehose, Inspector, RegionMap with replayMode=true via StoresContext override"
    - "replay-redaction-copy.ts: single-source H4/H5 placeholder constants + restricted event type sets"
    - "FirehoseRow: tier-aware payload redaction (operatorTier prop, backward-compat)"
    - "Firehose: plumbs agencyStore tier to each FirehoseRow via useSyncExternalStore"
    - "Gap 3 (REPLAY-05 SC#5) FULLY SATISFIED — was PARTIAL"
  affects:
    - dashboard/src/app/grid/use-stores.ts (StoresContext exported)
    - dashboard/src/app/grid/components/firehose.tsx (operatorTier plumbing)
    - dashboard/src/app/grid/components/firehose-row.tsx (tier-aware redaction)
    - dashboard/src/app/grid/replay/ (4 new/modified files)
tech_stack:
  added:
    - "@testing-library/dom@^10.0.0 (root workspace — missing peer dep of @testing-library/react)"
  patterns:
    - "StoresContext export + override pattern for replay subtree store injection"
    - "useRef lazy-init + synchronous render-phase seeding for replay stores"
    - "useSyncExternalStore(agencyStore) for tier-aware render in Firehose"
    - "Tier-restricted payload redaction via parseInt(tier.replace('H',''), 10) comparison"
key_files:
  created:
    - dashboard/src/app/grid/replay/replay-stores.tsx
    - dashboard/src/app/grid/replay/replay-redaction-copy.ts
  modified:
    - dashboard/src/app/grid/use-stores.ts
    - dashboard/src/app/grid/replay/replay-client.tsx
    - dashboard/src/app/grid/replay/replay-client.test.tsx
    - dashboard/src/app/grid/replay/page.tsx
    - dashboard/src/app/grid/components/firehose.tsx
    - dashboard/src/app/grid/components/firehose-row.tsx
    - package.json
    - package-lock.json
decisions:
  - "Synchronous render-phase seeding in ReplayStoresProvider: stores are seeded during render (not useEffect) so the first render sees replay data. FirehoseStore.ingest and PresenceStore.applyEvents are idempotent (dedup by id), making render-phase invocation safe."
  - "StoresContext exported from use-stores.ts (additive, backward-compat): ReplayStoresProvider mounts StoresContext.Provider override so replay subtree's useStores() returns replay-scoped instances."
  - "Firehose reads agencyStore tier via useSyncExternalStore (same pattern as RelationshipsSection). This is a reactive read — Firehose re-renders when tier changes, passing fresh operatorTier to each FirehoseRow."
  - "FirehoseRow backward-compat: operatorTier=undefined sets tierNum=99, neither H4/H5 restriction branch fires, payloadPreview() called as before. Live /grid has no change."
  - "Inspector is OUT of scope for tier-aware redaction: Inspector renders structured NousState from an already-server-gated API endpoint; no raw payload detail inline."
  - "Test architecture: StoresProvider wrapper (not useStores mock) so ReplayStoresProvider context override reaches Firehose correctly. agencyStore mocked separately via vi.mock."
  - "@testing-library/dom installed at root (Rule 3 fix): was a missing peer dep of @testing-library/react; ALL 63 dashboard test files were failing with ERR_MODULE_NOT_FOUND before this fix."
metrics:
  duration: "~9 minutes"
  completed: "2026-04-28"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 8
---

# Phase 13 Plan 07: Wave 6 — Gap Closure: Wire Firehose, Inspector, RegionMap into Replay Surface Summary

**One-liner:** Replay surface now mounts the standard Firehose + Inspector + RegionMap panels sourced from a replay-scoped store context seeded with prop-fed audit entries, with tier-aware H4/H5 payload redaction in FirehoseRow — closing REPLAY-05 SC#5 (was PARTIAL).

## What Was Built

### Task 1: Export StoresContext + Create ReplayStoresProvider

**`dashboard/src/app/grid/use-stores.ts`** — one-line additive change: `const StoresContext` → `export const StoresContext`. Backward-compatible; `StoresProvider` and `useStores` unchanged.

**`dashboard/src/app/grid/replay/replay-stores.tsx`** (new, 85 lines) — `ReplayStoresProvider`:
- Accepts `entries: readonly AuditEntry[]`
- Calls `useStores()` to inherit `heartbeat` + `selection` from the outer `/grid` context
- `useRef` lazy-init for `FirehoseStore` and `PresenceStore` instances (one pair per mount)
- **Synchronous render-phase seeding**: `firehose.ingest(entries)` and `presence.applyEvents(entries)` run during render (not `useEffect`) guarded by a `seededEntriesRef` identity check — ensures the FIRST render sees replay data
- Mounts `<StoresContext.Provider value={{ ...outer, firehose, presence }}>` — overrides only firehose + presence; heartbeat + selection pass through
- Zero wall-clock primitives (CI gate exit 0)

### Task 2: Wire Panels into ReplayClient

**`dashboard/src/app/grid/replay/replay-client.tsx`** — replaced the inline `ReplayEntryRow` list with the standard three-panel surface:
- `ReplayStoresProvider` wraps the H3+ render branch, seeded from the existing `entries` prop
- `<Firehose replayMode />`, `<Inspector replayMode />`, `<RegionMap regions={regions} connections={connections} replayMode />` mounted inside the provider
- `ReplayEntryRow` component removed entirely
- `H4_RESTRICTED_EVENT_TYPES` / `H5_RESTRICTED_EVENT_TYPES` Sets removed (now in `replay-redaction-copy.ts`)
- Re-exports `H4_PLACEHOLDER`, `H5_PLACEHOLDER` from `./replay-redaction-copy` for test continuity (D-13-08)
- Preserved: `TIER_GATE_COPY`, `REPLAY_BADGE_COPY`, cleanup useEffect (`agencyStore.setTier('H1')`), Scrubber, ExportConsentDialog, Export button H5 gate

**`dashboard/src/app/grid/replay/page.tsx`** — added `fetchRegions(origin)` helper (same pattern as `/grid/page.tsx`). Passes `regions` and `connections` to `<ReplayClient>` with empty-array graceful defaults on fetch failure.

**`dashboard/src/app/grid/replay/replay-redaction-copy.ts`** (new) — single-source verbatim copy:
- `H4_PLACEHOLDER = '— Requires H4'`
- `H5_PLACEHOLDER = '— Requires H5'`
- `H4_RESTRICTED: ReadonlySet<string>` = `{'telos.refined', 'operator.telos_forced'}`
- `H5_RESTRICTED: ReadonlySet<string>` = `{'nous.whispered', 'operator.nous_deleted'}`

### Task 3: Tier-Aware FirehoseRow Redaction

**`dashboard/src/app/grid/components/firehose-row.tsx`**:
- Added `operatorTier?: string` to `FirehoseRowProps` (optional, backward-compat)
- Added import of `H4_PLACEHOLDER`, `H5_PLACEHOLDER`, `H4_RESTRICTED`, `H5_RESTRICTED` from `@/app/grid/replay/replay-redaction-copy`
- Payload render path: `tierNum = operatorTier ? parseInt(operatorTier.replace('H',''), 10) : 99` — checks H5_RESTRICTED first (most restrictive), then H4_RESTRICTED, falls back to `payloadPreview(entry.payload)`
- When `operatorTier === undefined` (live /grid): `tierNum === 99` → no redaction → exact pre-Phase-13 behavior

**`dashboard/src/app/grid/components/firehose.tsx`**:
- Added `useSyncExternalStore(agencyStore.subscribe, agencyStore.getSnapshot, agencyStore.getSnapshot)` to read the current operator tier reactively
- Passes `operatorTier={operatorTier}` to each `<FirehoseRow>` in the visible map

## Panel Mount Verification Points

Verifier can grep/assert:
- `screen.getByLabelText('Event firehose')` — Firehose's `<section aria-label="Event firehose">` (firehose.tsx:85)
- `screen.getByLabelText('Region map')` — RegionMap's `<svg aria-label="Region map">` (region-map.tsx:94)
- Inspector renders `null` when `selectedDid === null` (no aria-label needed; absence is correct)
- `screen.getByText('— Requires H4')` — H3 operator viewing `telos.refined` or `operator.telos_forced`
- `screen.getByText('— Requires H5')` — H3/H4 operator viewing `nous.whispered` or `operator.nous_deleted`

## Test Additions (replay-client.test.tsx)

New assertions added in Wave 6:
1. `H3 mounts the Firehose panel (aria-label="Event firehose")` — ✓
2. `H3 mounts the RegionMap panel (aria-label="Region map")` — ✓
3. `H3 renders "— Requires H4" placeholder for telos-revealing frame` — ✓
4. `H3 renders "— Requires H5" placeholder for whisper frame` — ✓
5. `H4 renders "— Requires H5" placeholder for whisper frame` — ✓
6. `H4 renders unredacted payload for H4-restricted telos event` — ✓

Preserved from Wave 4:
- Tier gate H1/H2 tests — ✓
- Tier reset on unmount (D-13-07) — ✓
- Wall-clock grep gate (D-13-05) — ✓

**Test architecture change:** Tests now use `StoresProvider` wrapper (not `useStores` mock). This is required because `ReplayStoresProvider` mounts a `StoresContext.Provider` override — if `useStores` is mocked to bypass `useContext`, the override is silently ignored and Firehose reads an empty store.

## Gap 3 (REPLAY-05 SC#5) Status: FULLY SATISFIED

Previous status (13-VERIFICATION.md): PARTIAL  
Reason for partial: "Firehose, Inspector, RegionMap are NOT mounted in /grid/replay route"  
Resolution: All three panels mounted with `replayMode=true`, sourced from `ReplayStoresProvider` seeded from the prop-fed audit slice. D-13-03 ("replay page reuses Firehose, Inspector, RegionMap with replayMode prop") satisfied.

## All Phase 13 Must-Haves Status

| Truth | Status |
|-------|--------|
| SC#1: Deterministic tarball + replay-verify CLI | VERIFIED (Plan 13-01..03) |
| SC#2: operator.exported allowlist + ExportConsentDialog | VERIFIED (Plan 13-04..05) |
| SC#3: ReplayGrid isolated readonly chain + CI gate | VERIFIED (Plan 13-02) |
| SC#4: STATE.md 27 events + operator.exported | VERIFIED (Plan 13-06) |
| SC#5: /grid/replay with Firehose + Inspector + RegionMap | **FULLY SATISFIED (this plan)** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @testing-library/dom missing from root workspace**
- **Found during:** Task 2 verification (all 63 dashboard test files failing with ERR_MODULE_NOT_FOUND)
- **Issue:** `@testing-library/react` requires `@testing-library/dom` as a peer dependency but it was not installed at the root workspace level. The pre-existing test passes shown in 13-05 SUMMARY (18 tests) must have been run in a different environment where this was installed.
- **Fix:** `npm install @testing-library/dom@^10.0.0 --save-dev` at repo root
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `4bcb2c7`

**2. [Rule 1 - Bug] Synchronous store seeding needed (useEffect would cause empty first render)**
- **Found during:** Task 2 — redaction tests passed structurally but placeholder text was absent
- **Issue:** Initial implementation used `useEffect` for seeding. React's `useEffect` runs after the DOM commit, so the first render shows empty stores. Tests render once and immediately assert — they see the empty-store render.
- **Fix:** Moved seeding to render-phase (synchronous) guarded by `seededEntriesRef` identity check. FirehoseStore.ingest and PresenceStore.applyEvents are idempotent, making render-phase invocation safe.
- **Files modified:** `replay-stores.tsx`
- **Commit:** `4bcb2c7`

**3. [Rule 1 - Bug] Duplicate aria-label on RegionMap wrapper section**
- **Found during:** Task 2 — `screen.getByLabelText('Region map')` failed due to ambiguous match
- **Issue:** Initial `replay-client.tsx` wrapped `<RegionMap>` in `<section aria-label="Region map">`. Since `RegionMap` itself renders `<svg aria-label="Region map">`, there were two elements with the same aria-label, causing `getByLabelText` to find the `<section>` (which contains the SVG) instead of the SVG itself — or throw an ambiguity error.
- **Fix:** Changed `<section aria-label="Region map">` to `<div>` (plain wrapper with no aria-label)
- **Files modified:** `replay-client.tsx`
- **Commit:** `4bcb2c7`

**4. [Rule 1 - Bug] useStores mock bypassed StoresContext override**
- **Found during:** Task 3 — redaction placeholder tests still failed after sync seeding fix
- **Issue:** The test mocked `useStores` to return static mock stores. Since `useStores` bypasses `useContext`, `ReplayStoresProvider`'s `StoresContext.Provider` override was invisible to `Firehose` — it read from the mock (empty) store instead of the seeded replay store.
- **Fix:** Removed `useStores` mock. Tests now use `StoresProvider` as a wrapper (the standard pattern from `firehose-row.test.tsx`). `agencyStore` is still mocked separately for tier control.
- **Files modified:** `replay-client.test.tsx`
- **Commit:** `1b95bf8`

## Known Stubs

None — all panel surface stubs from 13-05 are resolved in this plan. The `_replayMode` prefix on the prop parameter in Firehose/Inspector/RegionMap indicates the prop is accepted but the components don't branch on it (they read from whichever stores are in context — the correct store is provided by `ReplayStoresProvider`).

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. The StoresContext export is additive. The agencyStore read in Firehose is a pure reactive read of an existing singleton.

## Self-Check: PASSED

Files created/modified in this plan:
- `dashboard/src/app/grid/replay/replay-stores.tsx` — created
- `dashboard/src/app/grid/replay/replay-redaction-copy.ts` — created
- `dashboard/src/app/grid/use-stores.ts` — modified (StoresContext export)
- `dashboard/src/app/grid/replay/replay-client.tsx` — modified
- `dashboard/src/app/grid/replay/replay-client.test.tsx` — modified
- `dashboard/src/app/grid/replay/page.tsx` — modified
- `dashboard/src/app/grid/components/firehose.tsx` — modified
- `dashboard/src/app/grid/components/firehose-row.tsx` — modified
- `package.json` — modified (@testing-library/dom)
- `package-lock.json` — modified

Commits:
- `4718f7c` — Task 1: StoresContext export + ReplayStoresProvider
- `4bcb2c7` — Task 2: Wire panels into ReplayClient + page.tsx regions
- `1b95bf8` — Task 3: FirehoseRow tier-aware redaction
