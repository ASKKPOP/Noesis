---
phase: 21-culture-dashboard
plan: "03"
subsystem: dashboard-data-layer
tags: [api, swr-hooks, culture, data-contract]
dependency_graph:
  requires: ["21-01"]
  provides: [culture-api-fetchers, culture-swr-hooks]
  affects: [wave-2-svg-components]
tech_stack:
  added: []
  patterns: [swr-batch-window, abort-signal-error-handling, parallel-promise-all]
key_files:
  created:
    - dashboard/src/lib/api/culture.ts
    - dashboard/src/lib/hooks/use-culture.ts
  modified: []
decisions:
  - "fetchLoreCitations maps audit trail AuditEntry.payload to LoreCitation[] — audit trail returns { entries: AuditEntry[], total } with payload field per entry"
  - "useLoreGraph uses Promise.all for parallel fetches of lore entries and citations (Pitfall 4 Option 1)"
  - "BATCH_WINDOW_TICKS = 100 preserved per D-9-13 invariant — not changed"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  files_created: 2
---

# Phase 21 Plan 03: Culture Data Layer Summary

Typed fetch wrappers and SWR hooks for three culture data sources (skill lineage, norms, lore graph) — establishes the data contract for Wave 2 SVG components.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create culture.ts typed fetch wrappers | c2207be | dashboard/src/lib/api/culture.ts |
| 2 | Create use-culture.ts SWR hooks | 186dd7e | dashboard/src/lib/hooks/use-culture.ts |

## What Was Built

**`dashboard/src/lib/api/culture.ts`** — Four typed fetch wrappers following the `relationships.ts` error-handling pattern (AbortError re-throw, network/http discriminated errors). Exports five response type interfaces: `SkillLineageResponse`, `NormsResponse`, `LoreEntriesResponse`, `LoreCitationsResponse`, `LoreGraphData`. The `fetchLoreCitations` wrapper calls `/api/v1/audit/trail?type=lore.cited` and maps each `AuditEntry.payload` to a `LoreCitation` — adapting the audit trail's `{ entries: AuditEntry[] }` shape to `{ entries: LoreCitation[] }`.

**`dashboard/src/lib/hooks/use-culture.ts`** — Three SWR hooks (`useSkillLineage`, `useNorms`, `useLoreGraph`) following the `useGraph` pattern from `use-relationships.ts`. Each uses a `['key-name', windowKey]` batch-window SWR key where `windowKey = Math.floor(currentTick / BATCH_WINDOW_TICKS)`. `useLoreGraph` fetches both `/api/v1/grid/lore` and `/api/v1/audit/trail?type=lore.cited` in parallel via `Promise.all` and merges into `LoreGraphData`.

## Deviations from Plan

None — plan executed exactly as written.

The audit trail response shape was confirmed from `grid/src/api/server.ts` (line 423): returns `{ entries, total }` where each entry is an `AuditEntry` with a `payload` field. The `fetchLoreCitations` implementation correctly maps `entry.payload` to `LoreCitation`.

## Known Stubs

None. This plan creates data-layer contracts only (no UI rendering). The hooks return SWR responses that Wave 2 SVG components will consume.

## Threat Flags

None beyond what was already documented in the plan's threat model (T-21-03-01 accepted, T-21-03-02 mitigated by type cast).

## Self-Check

Files exist:
- dashboard/src/lib/api/culture.ts: present
- dashboard/src/lib/hooks/use-culture.ts: present

Commits:
- c2207be: feat(21-03): create culture.ts typed fetch wrappers
- 186dd7e: feat(21-03): create use-culture.ts SWR hooks

TypeScript: `npx tsc --noEmit` — no errors in culture.ts or use-culture.ts (pre-existing test file errors in Wave 2 components are out of scope for this plan).

## Self-Check: PASSED
