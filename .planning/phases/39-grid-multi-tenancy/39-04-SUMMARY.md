---
phase: 39-grid-multi-tenancy
plan: "04"
subsystem: scripts/ci + steward/system
tags: [ci-gate, steward-console, multi-tenancy, wave-4, TENANT-02, D-39-10, D-V3-36]
status: complete
dependency_graph:
  requires:
    - grid/src/operator/data/operator-brain-store.ts  (Plan 02)
    - grid/src/operator/data/operator-quota-store.ts  (Plan 02)
    - grid/src/operator/data/operator-settings-store.ts  (Plan 02)
    - steward/src/components/StewardShell.tsx  (existing)
  provides:
    - scripts/check-operator-scope-typing.mjs  (D-39-10 CI gate)
    - .github/workflows/rig-invariants.yml  (TENANT-02 step registered)
    - steward/src/app/system/operators/page.tsx  (Tier-2 Grid Manager surface)
  affects:
    - .github/workflows/rig-invariants.yml (new TENANT-02 step appended)
tech_stack:
  added: []
  patterns:
    - CI gate walkDir + paren-matching scanFile pattern (follows check-sole-producer-discipline.mjs)
    - Steward Console client page: useEffect fetch + useState + StewardShell wrapper
    - Next.js App Router page at steward/src/app/system/operators/page.tsx
key_files:
  created:
    - scripts/check-operator-scope-typing.mjs
    - steward/src/app/system/operators/page.tsx
  modified:
    - .github/workflows/rig-invariants.yml
decisions:
  - "CI gate uses paren-matching depth counter to extract multi-line parameter blocks — handles split-param style in operator/data/ stores (pool on one line, operatorDid on next)"
  - "TENANT-02 gate appended after OBS-37-01 step in rig-invariants.yml (last existing gate before Vitest suite)"
  - "Steward Console page fetches /api/v1/grid-manager/operator-overview — endpoint not yet built (future); page shows error state gracefully"
  - "Quota override write controls labeled 'will be activated' — write API deferred to Grid Manager phase per plan spec"
metrics:
  duration: "~90s"
  completed: "2026-05-27T02:44:46Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 39 Plan 04: CI Gate + Steward Console Operators Page

CI gate enforcing D-39-10 (every exported function in grid/src/operator/data/ must include `operatorDid: string`) registered in GitHub Actions. Steward Console `/system/operators` page providing the Tier-2 Grid Manager surface showing unowned Brain pool, per-operator quota table, and quota override controls.

## What Was Built

**CI gate** (`scripts/check-operator-scope-typing.mjs`):
- Walks `grid/src/operator/data/*.ts` using `readdirSync` + paren-depth counter
- Extracts full multi-line parameter blocks for every `export (async )?function`
- Exits 0 when all functions include `operatorDid: string` — exits 1 and names violations otherwise
- Verified against all three Plan 02 stores: exits 0, prints `[check-operator-scope-typing] OK`

**CI registration** (`.github/workflows/rig-invariants.yml`):
- Step `TENANT-02 check-operator-scope-typing (Phase 39)` added after `OBS-37-01` step
- `run: node scripts/check-operator-scope-typing.mjs`

**Steward Console operators page** (`steward/src/app/system/operators/page.tsx`):
- Route: `/system/operators` in Steward Console (Henry-only app)
- Tier-2 Grid Manager surface per D-V3-36 (labeled in JSX and comments)
- Section 1 — Unowned Brains: table of `{brain_did, registered_at_ms}` from Grid API
- Section 2 — Per-Operator Quota: table of `{operator_did, brain_count, quota_limit, event_rate_per_did_per_min}`
- Section 3 — Quota Override Controls: present with amber "will be activated" notice (write API deferred)
- Fetches `GET /api/v1/grid-manager/operator-overview` with `credentials: include`
- `StewardShell` wrapper consistent with `system/page.tsx` pattern
- Graceful error display when Grid API is unavailable

## Verification Results

| Check | Status |
|-------|--------|
| `node scripts/check-operator-scope-typing.mjs` | PASS — exits 0, prints OK |
| `grep -c "Unowned Brains\|Per-Operator Quota\|Quota Override" page.tsx` | 6 (>= 3 required) |
| `'use client'` directive | PRESENT |
| `StewardShell` import | PRESENT |
| `Tier-2 Grid Manager surface` text | PRESENT |
| `operator_quota_overrides` reference | PRESENT (×2) |
| Unexpected file deletions | NONE |
| Allowlist count (60) | UNCHANGED — no audit.append in new files |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 428b34a | feat(39-04): CI gate check-operator-scope-typing.mjs + rig-invariants step |
| Task 2 | 028f170 | feat(39-04): Steward Console /system/operators page (D-39-07 / D-V3-36) |

## Checkpoint

Task 3 (`checkpoint:human-verify`) approved by operator. All 7 verification steps passed.

## Deviations from Plan

None — plan executed exactly as written for Tasks 1 and 2.

## Known Stubs

- `GET /api/v1/grid-manager/operator-overview` Grid API endpoint does not exist yet — the page shows an error state when the API returns 404/503. This is intentional per plan spec: "the real data API can be wired in a follow-up or in the Grid Manager phase." The page structure and fetch logic are correct; only the backend endpoint is deferred.

## Threat Surface Scan

No new network endpoints introduced by this plan's files:
- `scripts/check-operator-scope-typing.mjs` — local filesystem read only, no network
- `.github/workflows/rig-invariants.yml` — CI configuration, no runtime exposure
- `steward/src/app/system/operators/page.tsx` — client-side fetch to existing Grid API auth boundary; Steward Console is Henry-only per Phase 21 D-V3-06. T-39-04-02 (information disclosure) is mitigated: Grid Manager admin endpoint returns 403 for non-admin sessions; Steward has no public route exposure.

No threat flags.

## Self-Check

Files exist:
- scripts/check-operator-scope-typing.mjs: FOUND
- steward/src/app/system/operators/page.tsx: FOUND
- .planning/phases/39-grid-multi-tenancy/39-04-SUMMARY.md: (this file)

Commits exist:
- 428b34a: feat(39-04): CI gate check-operator-scope-typing.mjs + rig-invariants step
- 028f170: feat(39-04): Steward Console /system/operators page (D-39-07 / D-V3-36)

## Self-Check: PASSED

## Plan 04 Complete

All 3 tasks done. Phase 39 all 4 plans complete.
