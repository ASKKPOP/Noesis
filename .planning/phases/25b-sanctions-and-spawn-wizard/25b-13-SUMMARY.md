---
phase: 25b-sanctions-and-spawn-wizard
plan: 13
subsystem: portal-middleware, steward-ui
tags: [portal, check-frozen, sanctions, steward, humans, h5]
dependency_graph:
  requires: [25b-12]
  provides: [portal-frozen-check, steward-sanctions-humans-tab]
  affects: [grid/src/api/portal, steward/src/app/humans]
tech_stack:
  added: []
  patterns: [fastify-addHook-preHandler, tdd-red-green, header-auth-h5, h5-confirm-dialog]
key_files:
  created:
    - grid/src/api/portal/check-frozen.ts
    - grid/test/portal/check-frozen.test.ts
  modified:
    - grid/src/api/portal/index.ts
    - grid/src/api/server.ts
    - steward/src/app/humans/[did]/page.tsx
decisions:
  - "Added getFlags() to humanSanctionStore interface (server.ts) — plan code sketch used services.db.queryOne which does not exist; getFlags() is the minimal correct approach that matches the existing store interface pattern"
  - "walletSuffix confirm token derived from profile.eth_address.slice(-6) — matches plan H5 confirm dialog spec"
metrics:
  duration: ~15min
  completed: 2026-05-21
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 25b Plan 13: Portal Frozen Check + Steward Sanctions Tab Summary

**One-liner:** Fastify preHandler blocks frozen/banned humans on portal action routes; Steward humans page gains H5 Sanctions tab with ban + freeze confirm dialogs.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Portal preHandler — frozen check (TDD) | 943caa1 (RED), cef8abe (GREEN) | check-frozen.ts, portal/index.ts, server.ts |
| 2 | Sanctions tab on Steward /humans/[did] | c41fe40 | steward/src/app/humans/[did]/page.tsx |

## What Was Built

### Task 1: Portal preHandler middleware

`grid/src/api/portal/check-frozen.ts` — Fastify `addHook('preHandler')` that:
- Intercepts only portal action routes matching `PORTAL_ACTION_PATTERNS` (`/api/v1/portal/wallet/`)
- Reads `session.humanDid` set by the SIWE auth preHandler upstream
- Queries `humanSanctionStore.getFlags(did)` for the human's `{frozen, banned}` flags
- Returns `403 {error:'human_banned'}` if `banned=1` (priority)
- Returns `403 {error:'human_frozen'}` if `frozen=1`
- Passes through for: non-action URLs (SIWE sign-in allowed), no session, missing store, neither flag set
- Registered in `portal/index.ts` AFTER `registerPortalAuthRoutes` (session population ordering)

Hook registration order enforced: SIWE auth → frozen check → wallet routes.

Forward-compat: `PORTAL_ACTION_PATTERNS` array ready for Phase 26 (chat, tip) and 27 (spawn) additions.

### Task 2: Steward Sanctions Tab

`steward/src/app/humans/[did]/page.tsx` additions:
- `'sanctions'` added to `TabId` union type and `TABS` array (4th tab)
- Two H5 confirm dialogs in the tab panel:
  - **Ban Human (H5)**: confirm = wallet last-6-chars, reason ≥10 chars → `POST /api/v1/operator/humans/:did/ban`
  - **Freeze Wallet (H5)**: same confirm pattern → `POST /api/v1/operator/humans/:did/freeze`
- Both use header-auth: `x-operator-tier: '5'`, `x-operator-id: NEXT_PUBLIC_STEWARD_OPERATOR_ID`
- Submit buttons disabled until confirm matches wallet suffix AND reason ≥10 chars
- Success/error banners per row; state local to component (no global lift)
- Existing Profile/History/Nous tabs untouched (surgical change per CLAUDE.md §3)

## Verification

```
npm --prefix grid run test -- run test/portal/check-frozen.test.ts
→ 7 tests passed

npm --prefix steward run build
→ ✓ /humans/[did] built successfully

grep -n "isPortalActionRoute" grid/src/api/portal/check-frozen.ts
→ line 28 (helper) + line 35 (usage)

grep -c "x-operator-tier" steward/src/app/humans/[did]/page.tsx
→ 2 (one per action: ban + freeze)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] services.db.queryOne does not exist — used humanSanctionStore.getFlags() instead**
- **Found during:** Task 1 implementation (plan code sketch assumed `services.db`)
- **Issue:** `GridServices` has no `db` property; the plan's sketch was pseudo-code. The correct approach is to extend `humanSanctionStore` with a read method.
- **Fix:** Added `getFlags(did: string): Promise<{frozen: number; banned: number} | null>` to the `humanSanctionStore` interface in `server.ts`. Middleware reads flags via this method. Tests stub `getFlags` on the store.
- **Files modified:** `grid/src/api/server.ts`
- **Commit:** cef8abe

### Pre-existing Issues (Out of Scope)

- `test/portal/portal-auth-region.test.ts` — `falls back to agora for old tokens without region` test fails pre-dating this plan (confirmed by stash test). Not caused by plan 13 changes. Logged to deferred items.

## Known Stubs

None. Both sanction actions wire to real operator routes from plan 12. `walletSuffix` is derived from `profile.eth_address` (populated from `GET /api/v1/humans/:did`); displays `'—'` if profile not loaded yet (expected loading state).

## Threat Flags

No new threat surface beyond what's documented in the plan's threat model. The middleware enforces server-side frozen check (T-25b-13-01 mitigated: SIWE routes not blocked, action routes blocked, tests assert both). H5 confirm dialog implements T-25b-13-02 mitigation.

## Self-Check: PASSED

- `grid/src/api/portal/check-frozen.ts` — FOUND
- `grid/test/portal/check-frozen.test.ts` — FOUND
- `grid/src/api/portal/index.ts` (modified) — FOUND
- `grid/src/api/server.ts` (modified) — FOUND
- `steward/src/app/humans/[did]/page.tsx` (modified) — FOUND
- Commits 943caa1, cef8abe, c41fe40 — FOUND (git log confirms)
