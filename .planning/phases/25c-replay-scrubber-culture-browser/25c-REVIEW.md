---
phase: 25c-replay-scrubber-culture-browser
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - dashboard/package.json
  - dashboard/vitest.config.ts
  - grid/src/api/operator/relationships.ts
  - grid/src/main.ts
  - grid/test/api/relationships-privacy.test.ts
  - grid/test/operator/ban-human.test.ts
  - grid/test/operator/freeze-wallet.test.ts
  - steward/src/app/culture/lore-graph.tsx
  - steward/src/app/culture/norm-timeline.tsx
  - steward/src/app/culture/nous-filter-bar.tsx
  - steward/src/app/culture/page.tsx
  - steward/src/app/culture/skill-lineage.tsx
  - steward/src/app/replay/page.tsx
  - steward/src/app/replay/replay-modal.tsx
  - steward/src/components/StewardShell.tsx
findings:
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 25c: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This phase ships three distinct bodies of work: (1) Grid relationship endpoints with header-auth migration and the T-09-07 privacy invariant; (2) Grid main.ts wiring of humanSanctionStore and spawnNousDeps; (3) Steward /replay and /culture surfaces. The Grid code is generally clean and the test coverage is thorough. Two critical issues require immediate attention before ship: the replay modal's tick-range filter uses `entry.id` (a monotonic DB row ID) rather than a tick field, so scrubber position never aligns with actual Grid ticks; and the `operatorTier` prop on `ReplayModal` has no caller-supplied value in `ReplayPage`, meaning the H4 SENSITIVE_KEYS redaction is permanently bypassed — all sensitive payload values are shown unredacted to every user. Four warnings and four informational items follow.

---

## Critical Issues

### CR-01: Replay tick-range filter uses DB row `id`, not a tick field — scrubber is broken

**File:** `steward/src/app/replay/replay-modal.tsx:95`

**Issue:** The filter that constrains visible audit entries to the selected export's tick range compares `e.id` (the monotonic integer primary key from the DB) against `start_tick` and `end_tick` (Grid clock ticks stored in `entry.payload`). These two number spaces are entirely different. For any real Grid the row IDs and tick numbers will not overlap meaningfully, so the filter either returns the full dataset or nothing, making the scrubber non-functional.

```ts
// Current — compares DB row ID to payload tick values
const inRange = all.filter(e => (e.id ?? 0) >= start_tick && (e.id ?? 0) <= end_tick);
```

The `AuditEntry` interface defined at line 7 of this file only carries `id`, `eventType`, `actorDid`, `payload`, `createdAt`, and `eventHash`. The Grid tick for an event lives in `payload.tick` (when present) or must be read from the audit chain's ordering. The correct field to filter on is `payload.tick` (with a fallback to `id` only if `tick` is absent — and then document the degradation).

**Fix:**
```ts
function getEntryTick(e: AuditEntry): number {
    if (typeof e.payload['tick'] === 'number') return e.payload['tick'] as number;
    return e.id ?? 0;
}

const inRange = all.filter(e => {
    const t = getEntryTick(e);
    return t >= start_tick && t <= end_tick;
});
```

Apply the same helper to `visibleEntries` filter and sort at line 109–111:
```ts
const visibleEntries = entries
    .filter(e => getEntryTick(e) <= selectedTick)
    .sort((a, b) => getEntryTick(b) - getEntryTick(a))
    .slice(0, 100);
```

---

### CR-02: `operatorTier` is never passed to `ReplayModal` — H4 redaction permanently bypassed

**File:** `steward/src/app/replay/page.tsx:144` and `steward/src/app/replay/replay-modal.tsx:63`

**Issue:** `ReplayModal` accepts `operatorTier?: string` and uses it to gate SENSITIVE_KEYS redaction: `if (tierNum < 4 && SENSITIVE_KEYS.has(key)) return '— Requires H4'`. When `operatorTier` is absent the expression `parseInt(('H1').replace('H', ''), 10)` evaluates to `1`, and all content with keys in SENSITIVE_KEYS (`telos_text`, `creed_text`, `message`, `text`, etc.) should be redacted.

However, `ReplayPage` invokes the modal at line 144 without supplying `operatorTier`:
```tsx
<ReplayModal entry={selected} onClose={() => setSelected(null)} />
```

So the `operatorTier` prop defaults to `undefined`, `tierNum` becomes `1`, and the redaction predicate `tierNum < 4` is `true` — meaning all sensitive keys ARE redacted. This is actually the safe-side failure. But it is still a correctness bug: the scrubber is intended to show tier-appropriate data, and there is currently no mechanism to supply the real operator tier. Every user sees the H1 redacted view regardless of their actual tier.

Additionally, if the calling site is ever updated to pass a tier string without the 'H' prefix (e.g., `"3"` instead of `"H3"`), the `replace('H', '')` will leave the string unchanged and `parseInt` will return the correct number — but this is fragile. The parse logic at line 63 is:
```ts
const tierNum = parseInt((operatorTier ?? 'H1').replace('H', ''), 10);
```

If `operatorTier` is ever passed as `"3"` (a plain digit), `replace('H', '')` is a no-op and `parseInt("3", 10)` → `3`, which is correct but only by coincidence. If passed as `"tier-3"` the result is `NaN`, which means `tierNum < 3` is `false` (NaN comparisons are always false) and the gated fetch at line 85 never fires — but `tierNum < 4` is also false so nothing gets redacted either, leaking all sensitive values.

**Fix (two parts):**

1. Decide where operator tier comes from (session/auth context, not a prop) and wire it. For now, surface the missing prop clearly:

```tsx
// replay/page.tsx
{selected && (
    <ReplayModal
        entry={selected}
        onClose={() => setSelected(null)}
        operatorTier={operatorTier}  {/* supply from session context */}
    />
)}
```

2. Harden the tier parse to avoid NaN silent bypass:

```ts
// replay-modal.tsx line 63
const rawTier = (operatorTier ?? 'H1').replace(/^H/i, '');
const tierNum = Number.isInteger(Number(rawTier)) ? Number(rawTier) : 1;
```

---

## Warnings

### WR-01: Culture page fetches on mount but never re-fetches on `?nous=` filter change

**File:** `steward/src/app/culture/page.tsx:87`

**Issue:** The `useEffect` that fetches all four culture endpoints has an empty dependency array (`[]`). The `activeFilter` (from `?nous=` query param) is computed at line 78 but never added to the dependency list. If the user changes the Nous filter via `NousFilterBar`, the URL updates but the displayed data does not change — the components just re-filter client-side over already-fetched data. For `SkillLineage` and `LoreGraph` this is acceptable (client-side filter). However, if any of the four Grid endpoints ever accept a `?did=` query param to server-filter, this wiring will silently ignore the filter. It is also misleading that the comment at line 91 says "culture data" but the fetch URLs are hardcoded without the filter param.

More concretely: the culture page fetches lore with `?limit=100` which may not include the filtered Nous's contributions at all if the Grid has more than 100 lore entries. A user who filters by DID will see an empty lore graph not because the Nous has no lore, but because the page only loaded the 100 most-recent global entries.

**Fix:** Document the client-side-only filter constraint in a comment, or add the filter as a fetch parameter with a re-fetch on change:

```ts
useEffect(() => {
    fetchCultureData();
}, [activeFilter]);  // re-fetch when filter changes so ?did= can be forwarded to endpoints
```

---

### WR-02: `NormTimeline` uses `Math.min/max(...spread)` on unbounded array — stack overflow risk

**File:** `steward/src/app/culture/norm-timeline.tsx:58-59`

**Issue:** The tick range is computed with spread syntax on an array of length `3 * norms.length`:

```ts
const allTicks = sortedNorms.flatMap(n => [n.evidence_tick_range[0], n.evidence_tick_range[1], n.crystallized_tick]);
const minTick = Math.min(...allTicks);
const maxTick = Math.max(...allTicks);
```

`Math.min(...array)` passes each element as a separate function argument. JavaScript engines typically limit call stack argument counts at ~65,535 (V8) to ~100,000 (SpiderMonkey). With ~22,000+ norm records this will throw a `RangeError: Maximum call stack size exceeded` or produce `Infinity`/`-Infinity` silently. The Grid is expected to accumulate norms over time.

**Fix:**
```ts
let minTick = Infinity;
let maxTick = -Infinity;
for (const n of sortedNorms) {
    if (n.evidence_tick_range[0] < minTick) minTick = n.evidence_tick_range[0];
    if (n.evidence_tick_range[1] < minTick) minTick = n.evidence_tick_range[1];
    if (n.crystallized_tick < minTick) minTick = n.crystallized_tick;
    if (n.evidence_tick_range[0] > maxTick) maxTick = n.evidence_tick_range[0];
    if (n.evidence_tick_range[1] > maxTick) maxTick = n.evidence_tick_range[1];
    if (n.crystallized_tick > maxTick) maxTick = n.crystallized_tick;
}
```

---

### WR-03: `humanSanctionStore` closures in `main.ts` capture `dbConn` in a condition — potential null dereference if pool is replaced

**File:** `grid/src/main.ts:138-158`

**Issue:** The `humanSanctionStore` object is constructed inside `if (dbConn)` and closes over `dbConn` directly:

```ts
const humanSanctionStore = dbConn ? {
    async existsByDid(did: string): Promise<boolean> {
        const pool = dbConn.getPool();   // <-- dbConn captured by closure
        ...
    },
    ...
} : undefined;
```

TypeScript infers `dbConn` as `DatabaseConnection | undefined` at the outer scope. Inside the ternary, narrowing applies only to the value expression — the closures themselves are not re-narrowed. At runtime this is safe because the closures are only created when `dbConn` is truthy and `dbConn` is never reassigned. However, if a future refactor adds `dbConn = undefined` after this block (e.g., during a hot-reload path), the closures will throw at runtime rather than being cleanly disabled.

This is low risk today but the pattern is fragile. The safer pattern is to capture `pool` at construction time:

```ts
const humanSanctionStore = dbConn ? (() => {
    const pool = dbConn.getPool();
    return {
        async existsByDid(did: string): Promise<boolean> {
            const [rows] = await pool.query(...) as any;
            ...
        },
        ...
    };
})() : undefined;
```

This also avoids the repeated `dbConn.getPool()` call per method invocation.

---

### WR-04: `LoreGraph` uses only the first contributing entry per citing DID for citation edges — citation lines may be misleading

**File:** `steward/src/app/culture/lore-graph.tsx:115-118`

**Issue:** When drawing citation edges, the component finds the citing Nous's position by taking the _first_ lore entry attributed to that DID:

```ts
const citingEntry = entries.find(e => e.contributor_did === citing_did);
```

If a Nous has contributed multiple lore entries, all citations by that Nous are drawn from the same single source node (whichever entry happens to appear first in the array). This makes the graph misleading — it looks like all citations originate from one lore entry even when they don't. This is a correctness/accuracy issue, not a crash risk.

**Fix:** Source the edge from the citing entry identified by `content_hash` if that hash exists in `posMap` (i.e., the citing entry itself is in the dataset), falling back to the first entry for the DID only when no better anchor is available. Consider adding a comment explaining the approximation.

---

## Info

### IN-01: `vitest.config.ts` uses `oxc.jsx` API that is experimental in Vitest 4.x

**File:** `dashboard/vitest.config.ts:27-31`

**Issue:** The config documents use of the `oxc` top-level key to configure JSX transforms via `oxc.jsx.runtime = 'automatic'`. This API path is non-standard in the published Vitest 4.x types. The comment at line 10 acknowledges this is a Vite 8 / OXC-specific path. If Vite 8 or Vitest 4 stabilize a different API shape before release, this config will break silently (the key is simply ignored). The existing comment is good; it should additionally note the Vitest/Vite version range this was verified against.

---

### IN-02: Redundant `role="button"` on `<button>` elements in replay-modal and nous-filter-bar

**File:** `steward/src/app/culture/nous-filter-bar.tsx:108`, `steward/src/app/replay/page.tsx:113`

**Issue:** `<button role="button">` is redundant — the `button` element already has an implicit ARIA role of `button`. More importantly, the table row at `replay/page.tsx:113` has `role="button"` but is a `<tr>` element. Screen readers will announce this as a button, which is acceptable for the interactive pattern, but the accessible name from `aria-label` at line 114 embeds raw operator_id and tick numbers. If `operator_id` contains special characters this reads awkwardly to screen reader users.

These are not blocking issues but should be tidied.

---

### IN-03: `StewardShell` always shows "Grid Online" — hardcoded badge, no liveness check

**File:** `steward/src/components/StewardShell.tsx:173-176`

**Issue:** The header badge unconditionally renders `<span className="badge badge-online"><Dot color="#2d7a2d" />Grid Online</span>`. There is no health check or fetch. If the Grid is down, the UI still says "Grid Online." This can lead operators to trust a false status and delay debugging a real outage.

---

### IN-04: `page.tsx` (culture) duplicates interface definitions already present in child components

**File:** `steward/src/app/culture/page.tsx:14-73`

**Issue:** `LineageNode`, `LineageEdge`, `LoreEntry`, `LoreCitationPayload`, and `LoreCitationEntry` are all defined in `page.tsx` and again in the child component files (`skill-lineage.tsx`, `lore-graph.tsx`). The duplication means a field rename in one place will not be caught by the compiler unless both files are updated. Consider exporting the types from a shared `types.ts` in the `culture/` directory.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
