---
phase: 21-culture-dashboard
reviewed: 2026-05-17T17:05:50Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - dashboard/src/app/grid/components/event-type-filter.tsx
  - dashboard/src/app/grid/components/tab-bar.test.tsx
  - dashboard/src/app/grid/components/tab-bar.tsx
  - dashboard/src/app/grid/culture/culture-dashboard.tsx
  - dashboard/src/app/grid/culture/page.tsx
  - dashboard/src/components/culture/__tests__/lore-graph.test.tsx
  - dashboard/src/components/culture/__tests__/norm-timeline.test.tsx
  - dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx
  - dashboard/src/components/culture/lore-graph.tsx
  - dashboard/src/components/culture/norm-timeline.tsx
  - dashboard/src/components/culture/skill-lineage-graph.tsx
  - dashboard/src/lib/api/culture.ts
  - dashboard/src/lib/hooks/use-culture.ts
  - dashboard/src/lib/stores/event-type.ts
  - dashboard/vitest.config.ts
  - grid/src/__tests__/culture-lineage.test.ts
  - grid/src/api/routes/culture.ts
  - grid/src/api/server.ts
  - scripts/check-relationship-graph-deps.mjs
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-17T17:05:50Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 21 introduces the culture dashboard (three SVG panels: skill lineage, norm timeline, lore graph), the culture tab in TabBar, the `culture` event category in the filter store, and the server-side BFS layout route. The implementation is clean, well-structured, and consistent with D-9-08 invariants — no banned graph layout libs, no client-side layout math, all three components use raw SVG with server-computed positions.

Two warnings were found: a partial-render edge case in `LoreGraph` and an unclamped `limit`/`offset` on the audit trail endpoint that was not introduced in Phase 21 but is exercised by the new `fetchLoreCitations` call. Three info items cover a test fixture inconsistency and minor code duplication.

No critical issues were found.

## Warnings

### WR-01: LoreGraph renders partial SVG when `loreEntries` is empty but `loreCitations` is non-empty

**File:** `dashboard/src/components/culture/lore-graph.tsx:38`
**Issue:** The empty-state guard uses `&&` — both collections must be empty to trigger `EmptyState`. If `loreEntries` is empty but `loreCitations` is non-empty (e.g., a lore.cited audit event arrives before the lore entries are fetched in a race, or if the lore and citation APIs momentarily desync), `loreIds` will be empty, all citation lines will silently resolve to `null` (the `if (!a || !b) return null` guard on line 110 catches them), and the SVG renders Nous nodes on the left with no lore nodes or edges on the right. The user sees an orphaned node column with no explanation.

In practice the two fetches run in `Promise.all` so neither can return before the other, and architecturally a `lore.cited` event cannot precede a `lore.contributed` event. However the guard logic is defensive-fragile: an intermediate refetch window or a server data inconsistency silently produces a broken visual rather than an error or empty state.

**Fix:**
```tsx
// Change the empty guard from AND to OR:
if (loreEntries.length === 0 || loreCitations.length === 0) {
    // ... EmptyState
}
// OR guard against partial state more explicitly:
if (loreEntries.length === 0 && loreCitations.length === 0) {
    return <EmptyState ... />;
}
// And add a guard after building loreIds if the bipartite graph would be degenerate:
if (nousIds.length === 0 || loreIds.length === 0) {
    return <EmptyState title="No lore yet." ... />;
}
```

The second option (add a second guard after building the node sets) is safer because it catches any combination of empty-left or empty-right columns regardless of which array produced them.

---

### WR-02: Audit trail endpoint (`/api/v1/audit/trail`) has no `limit` clamp — exploitable with `?limit=99999999`

**File:** `grid/src/api/server.ts:427-428`
**Issue:** The `parseInt` calls for `limit` and `offset` on the audit trail endpoint at lines 427–428 have no upper-bound clamp, unlike the `/api/v1/economy/trades` endpoint which explicitly clamps to `Math.min(limitRaw, 100)`. A caller can pass `?limit=99999999` and force the server to serialise the entire audit chain into a single response. This endpoint is now actively called by the new `fetchLoreCitations` (which uses `?type=lore.cited`), making the surface more relevant than before.

This is not new code introduced in Phase 21 (the endpoint existed) but Phase 21 adds the first client use of this endpoint from the dashboard, increasing the exposure.

**Fix:**
```typescript
// In the /api/v1/audit/trail handler, add clamping consistent with trades:
const limitRaw = req.query.limit ? parseInt(req.query.limit, 10) : 50;
const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, 200)   // or 100, matching trades max
    : 50;
const offsetRaw = req.query.offset ? parseInt(req.query.offset, 10) : 0;
const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

const entries = services.audit.query({
    eventType: req.query.type,
    actorDid: req.query.actor,
    limit,
    offset,
});
return { entries, total: services.audit.length };
```

## Info

### IN-01: Frontend test fixture for `SkillLineageGraph` uses a label that does not match server-produced output

**File:** `dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx:10`
**Issue:** The test fixture defines `SKILL_NODE = { id: 'sha256:a1b2c3def456', label: 'a1b2c3' }`. This implies the label for a skill node is the first 6 characters of the hash portion after the `sha256:` prefix. However, the server route (`grid/src/api/routes/culture.ts:173`) computes `label: p.skill_hash.slice(0, 6)` which for `'sha256:a1b2c3def456'` produces `'sha256'`, not `'a1b2c3'`. The server-side test (`grid/src/__tests__/culture-lineage.test.ts:80`) correctly asserts `expect(skillNode!.label).toBe('sha256')`.

The frontend component test passes because it only tests that `n.label` is rendered (not what the server sends), but a developer reading the fixture could misunderstand the server contract.

**Fix:** Update the fixture to use a label consistent with the server's `.slice(0, 6)` behaviour:
```typescript
const SKILL_NODE = { id: 'sha256:a1b2c3def456', label: 'sha256', type: 'skill' as const, x: 200, y: 150 };
```

---

### IN-02: `lastDIDSegment` helper duplicated across client and server

**File:** `dashboard/src/components/culture/lore-graph.tsx:16` and `grid/src/api/routes/culture.ts:34`
**Issue:** The same four-line function is duplicated verbatim in both files. This is not a bug — the client-side copy is intentional (it's the D-9-08 pattern: server sends IDs, client formats labels locally for the lore column). The duplication is noted for future maintenance; if the truncation rule changes it must be updated in both places.

**Fix:** No immediate action required. If a shared `@noesis/utils` package is ever created, this would be a candidate for extraction.

---

### IN-03: `SWR dedupingInterval: 0` in all three culture hooks disables same-window request coalescing

**File:** `dashboard/src/lib/hooks/use-culture.ts:39,49,68`
**Issue:** `dedupingInterval: 0` means SWR's time-window deduplication for concurrent requests is effectively disabled. If two components both mount and call `useSkillLineage()` within the same render cycle with the same window key, SWR will still deduplicate concurrent in-flight requests by key (this is SWR's in-flight dedup, separate from the time-window dedup). However, if the component unmounts and remounts quickly (e.g., tab switching), a new fetch fires immediately instead of reusing a recently completed response. This could cause unnecessary extra round trips when the culture tab is toggled rapidly.

The comment (D-9-13: batch window) explains the intent — cache invalidation by tick window — but `dedupingInterval: 0` also disables the 2000ms default dedup window that SWR uses to coalesce rapid re-renders. Setting it to a small value like `500` would be safer.

**Fix:**
```typescript
{ revalidateOnFocus: false, dedupingInterval: 500 }
```

---

_Reviewed: 2026-05-17T17:05:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
