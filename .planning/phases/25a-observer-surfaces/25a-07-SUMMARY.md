---
phase: 25a
plan: "07"
subsystem: codex-gap-closure
tags: [security, h3-gate, header-auth, cognitive-inspector, regression-tests, gap-closure]
dependency_graph:
  requires: [25a-01, 25a-02, 25a-03, 25a-04, 25a-05, 25a-06]
  provides: [GAP-25a-1, GAP-25a-2, GAP-25a-3]
  affects: [grid/src/api/operator/cognitive-snapshot.ts, steward/src/app/nous/[id]/page.tsx]
tech_stack:
  added: []
  patterns: [header-derived auth context, server-trusted tier resolution, lowercase drive-key contract]
key_files:
  modified:
    - grid/src/api/operator/cognitive-snapshot.ts
    - grid/test/operator/cognitive-snapshot.test.ts
    - grid/test/operator/cognitive-snapshot-client.test.ts
    - steward/src/app/nous/[id]/page.tsx
decisions:
  - "Header-trust pattern (x-operator-tier + x-operator-id) mirrors existing governance/_validation.ts validateTierAtLeast — no new abstraction introduced"
  - "Steward placeholder operator_id 'op:00000000-0000-4000-8000-000000000001' is a valid UUID-v4 shape that satisfies OPERATOR_ID_REGEX; will be replaced by SIWE-derived identity in a future phase"
  - "Allowlist delta = 0 preserved; sole-producer for operator.inspected unchanged (still one call site in cognitive-snapshot.ts)"
  - "Body-trust → header-trust migration scoped to cognitive-snapshot ONLY; peer operator routes (clock, governance, telos, delete, memory-query, export) still use body-trust and need a coordinated follow-up phase"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-21"
  tasks_completed: 6
  tasks_total: 6
  files_modified: 4
  commits: 3
---

# Phase 25a Plan 07: Codex Gap Closure Summary

Closed three gaps surfaced by post-merge Codex review of Phase 25a: the H3 tier-bypass in `cognitive-snapshot.ts` (P1), the invalid `op:steward:default` operator_id in the Steward Cognitive Inspector (P1), and the uppercase drive-key index that rendered all five drive bars at zero (P2). All three closed by surgical edits to four files (3 source + 2 test, of which one source file took two changes) with regression tests pinning each contract.

## Gaps Closed

| Gap | Severity | File | Fix |
|-----|----------|------|-----|
| GAP-25a-1 | P1 | grid/src/api/operator/cognitive-snapshot.ts | Route now reads tier from `x-operator-tier` and operator_id from `x-operator-id` request headers; body fields are ignored. Mirrors `validateTierAtLeast` pattern from governance/_validation.ts. Body type changed to `never`. Audit payload's `operator_id` is the header-derived value. |
| GAP-25a-2 | P1 | steward/src/app/nous/[id]/page.tsx | Cognitive Inspector fetch no longer sends `body:{tier:'H3', operator_id:'op:steward:default'}`. Sends `x-operator-tier:'3'` + `x-operator-id:<UUID-v4>` headers with an empty body. Placeholder UUID `op:00000000-0000-4000-8000-000000000001` (or `NEXT_PUBLIC_STEWARD_OPERATOR_ID` env override) satisfies `OPERATOR_ID_REGEX`. |
| GAP-25a-3 | P2 | steward/src/app/nous/[id]/page.tsx | Drive bar lookup changed from `cognitive?.drive_levels?.[drive]` to `cognitive?.drive_levels?.[drive.toLowerCase()]` — Brain returns lowercase keys, UI label list stays uppercase. |

## Regression Tests Added

| File | New tests | Purpose |
|------|-----------|---------|
| grid/test/operator/cognitive-snapshot.test.ts | 4 new cases (3 explicit GAP-25a-1) | Pin header-trust: body-only request → 401, header tier<3 → 403, missing/malformed operator_id → 400, audit operator_id sourced from header even when body claims a different one |
| grid/test/operator/cognitive-snapshot-client.test.ts | 2 new cases (both GAP-25a-3) | Pin lowercase drive_levels keys: uppercase response rejected with BrainMalformedResponseError, lowercase response accepted with correct nested values |

Test counts: cognitive-snapshot.test.ts 17/17 pass, cognitive-snapshot-client.test.ts 14/14 pass.

## Invariants Held

| Invariant | Check | Result |
|-----------|-------|--------|
| Allowlist delta = 0 | `git diff grid/src/audit/broadcast-allowlist.ts` | empty — zero new audit events |
| Sole-producer for operator.inspected | grep for `appendOperatorEvent(` call in cognitive-snapshot.ts | 1 call site preserved (line 151) |
| CI plaintext gate | `node scripts/check-cognitive-snapshot-plaintext.mjs` | 0 violations across all scopes |
| Grid TypeScript compile | `cd grid && npx tsc --noEmit` | clean |
| Steward TypeScript compile | `cd steward && npx tsc --noEmit` | clean |
| Brain regression | `cd brain && uv run pytest test/test_cognitive_snapshot.py -x` | 14/14 pass — Brain code untouched, no drift |
| Surgical-changes rule | files modified = 4 (within the 5 declared in `files_modified` frontmatter; one was source-side only) | honored |

## Commits

| SHA | Subject |
|-----|---------|
| b98a005 | fix(25a-07): trust x-operator-tier/id headers in cognitive-snapshot (GAP-25a-1) |
| 94711e6 | test(25a-07): pin drive_levels lowercase-keys contract (GAP-25a-3) |
| e9789f0 | fix(25a-07): steward Cognitive Inspector sends headers + lowercase drive lookup (GAP-25a-2, GAP-25a-3) |

All pushed to `feat/grid-retheme-portal-dashboard`. Grid Docker image rebuilt (`noesis-grid:latest` digest `sha256:c3fb0be1...`) and container restarted (T5 step 7).

## UAT Outcome (T6)

UAT items #3 (Cognitive Inspector live data) and #4 (Brain Health 2x2 grid regression check) re-run by the human operator: **both pass**. Headers present in DevTools network panel, 5 drive bars render non-zero percentages, no plaintext leaks, negative-path body-only fetch returns 401 as designed. The H3 gate is now real, not docstring-aspirational.

UAT items #1 (Firehose hover-pause), #2 (Allowlist Monitor green state + 45-row table), and #5 (`/humans/[did]` deep-link + invalid DID inline 404) remain in their existing pending state — orthogonal to this gap closure.

## Carry-Forward / Follow-Up

The body-trust → header-trust migration in this plan is **scoped to `cognitive-snapshot` only**. Peer operator routes (clock-pause/resume, governance, telos-force, delete-nous, memory-query, export) still call `validateTierBody` against the request body. They will need a coordinated follow-up phase to migrate uniformly — likely the same phase that introduces the SIWE-derived session middleware that injects `x-operator-*` headers from authenticated context rather than from the client. Without that, the Steward Console must remain a trusted-internal surface (not publicly deployed) — the placeholder UUID is a placeholder, not an auth check.

Note for the SUMMARY reader: `grep -cE "appendOperatorEvent|services\\.audit\\.append" grid/src/api/operator/cognitive-snapshot.ts` returns 4 (one import + two docstring references + one actual call). The semantic sole-producer invariant — exactly one call site that *emits* — is preserved. The T5 acceptance criterion that requested exactly 1 match was satisfied via the call-only grep `grep -cE "appendOperatorEvent\\("` returning 1.
