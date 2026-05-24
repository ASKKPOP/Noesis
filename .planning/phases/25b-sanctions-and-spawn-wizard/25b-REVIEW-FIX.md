---
phase: 25b-sanctions-and-spawn-wizard
fixed_at: 2026-05-22T00:00:00Z
review_path: .planning/phases/25b-sanctions-and-spawn-wizard/25b-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 25b: Code Review Fix Report

**Fixed at:** 2026-05-22T00:00:00Z
**Source review:** `.planning/phases/25b-sanctions-and-spawn-wizard/25b-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 Critical, 5 Warning)
- Fixed: 7
- Skipped: 0

---

## Fixed Issues

### CR-01: Steward Console sends operator-tier/id headers directly from the browser

**Files modified:** `steward/src/app/api/operator/[...path]/route.ts` (new), `steward/src/app/nous/[id]/page.tsx`, `steward/src/app/humans/[did]/page.tsx`, `steward/src/app/system/spawn/page.tsx`
**Commit:** `a73d1e4`
**Applied fix:** Created a Next.js catch-all API proxy at `steward/src/app/api/operator/[...path]/route.ts`. The proxy reads `STEWARD_OPERATOR_ID` (server-only env var, no `NEXT_PUBLIC_` prefix) and injects it as `x-operator-id` before forwarding to the Grid. All three `'use client'` pages now POST to `/api/operator/...` (relative, same-origin) instead of directly to `GRID_ORIGIN`, so the operator-id is never embedded in the client bundle. The `x-operator-tier` header is still passed from the client (it encodes the action tier, not a secret), but `x-operator-id` is now entirely server-side.

### CR-02: Force Telos form posts to wrong URL and sends no auth headers

**Files modified:** `steward/src/app/nous/[id]/page.tsx`
**Commit:** `a73d1e4`
**Applied fix:** Fixed three bugs in `handleForceTelos`: (1) URL corrected from `/telos` to `/telos/force` routed through the operator proxy; (2) `x-operator-tier: 4` header added (injected via proxy, operator-id injected server-side); (3) body key changed from `{ telos }` to `{ new_telos }` to match the `telos-force.ts` route schema. CR-01 and CR-02 were committed atomically since they share the same page.tsx files.

### WR-01: Quarantine and slash-coin emit audit on no-op when registry record is missing

**Files modified:** `grid/src/api/operator/quarantine.ts`, `grid/src/api/operator/slash-coin.ts`
**Commit:** `efef066`
**Applied fix:** Both routes now re-check the registry record before applying the in-memory flag / balance debit and before emitting the audit event. If the record is absent or has `status === 'deleted'` (tombstoned between step 3 and step 7/8), the route returns 410 `gone` with no audit emission. This closes the state-inconsistency window described in the review.

### WR-02: Empty reason string accepted as valid reason_hash

**Files modified:** `grid/src/api/operator/ban-human.ts`, `grid/src/api/operator/freeze-wallet.ts`, `grid/src/api/operator/quarantine.ts`, `grid/src/api/operator/slash-coin.ts`, `grid/src/api/operator/force-sleep.ts`, `grid/src/api/operator/mute-broadcast.ts`
**Commit:** `e93c35c`
**Applied fix:** All six sanction routes now return 400 `reason_required` when `reasonPlain.length < 10`, enforcing the same minimum-length constraint server-side that the Steward Console UI enforces with `minLength={10}`. Direct API calls that bypass the UI are now rejected.

### WR-03: Ban and freeze are not idempotent — double-apply emits duplicate audit

**Files modified:** `grid/src/api/operator/ban-human.ts`, `grid/src/api/operator/freeze-wallet.ts`
**Commit:** `6d5d60c`
**Applied fix:** Both routes now call `services.humanSanctionStore.getFlags(targetDid)` after the existence check (step 3b). If the human is already banned (ban route) or already frozen (freeze route), the route returns `{ ok: true }` immediately — no reason-hash computation, no sanction_reasons insert, no audit emission. The `humanSanctionStore` is narrowed non-null at step 3 so the getFlags call is safe.

### WR-04: Mute flag and quarantine flag are in-memory only with no operator warning

**Files modified:** `grid/src/integration/nous-runner.ts`, `grid/src/api/operator/quarantine.ts`
**Commit:** `12731ae`
**Applied fix:** Added explicit `WR-04 NOTE — IN-MEMORY ONLY` block comments on the `muteFlag` field in `NousRunner` and on the quarantineFlag application block in `quarantine.ts`. Both comments state clearly that the flag does not survive Grid restarts, that operators must re-apply after any restart, and that a future phase should add a sanctions replay table.

### WR-05: Dead `extractEntries` function in Nous detail page

**Files modified:** `steward/src/app/nous/[id]/page.tsx`
**Commit:** `9742c83`
**Applied fix:** Removed the `extractEntries` function (lines 305–313 in the reviewed version) and its `void extractEntries` suppressor (line 326). The function contained a logic bug (returning a raw Promise as `AuditTrailEntry[]`) and was never called. All audit parsing uses `parseAudit`, which correctly awaits the JSON response.

---

_Fixed: 2026-05-22T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
