---
phase: 25c-replay-scrubber-culture-browser
fixed_at: 2026-05-22T00:00:00Z
review_path: .planning/phases/25c-replay-scrubber-culture-browser/25c-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 25c: Code Review Fix Report

**Fixed at:** 2026-05-22
**Source review:** .planning/phases/25c-replay-scrubber-culture-browser/25c-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Replay tick-range filter uses DB row `id`, not a tick field — scrubber is broken

**Files modified:** `steward/src/app/replay/replay-modal.tsx`
**Commit:** 0aa26a4
**Applied fix:** Added `getEntryTick(e: AuditEntry): number` helper that reads `e.payload['tick']` when it is a number, falling back to `e.id ?? 0` otherwise. Replaced the `inRange` filter (line 95) and the `visibleEntries` filter+sort (lines 109–111) to use this helper instead of `e.id`. CR-01 and CR-02 were committed atomically because they touch the same two files.

---

### CR-02: `operatorTier` is never passed to `ReplayModal` — H4 redaction permanently bypassed

**Files modified:** `steward/src/app/replay/replay-modal.tsx`, `steward/src/app/replay/page.tsx`
**Commit:** 0aa26a4
**Applied fix:** Two-part fix. (1) In `replay-modal.tsx` the tier parse was hardened from `parseInt(...replace('H', ''))` to `replace(/^H/i, '')` + `Number.isInteger(Number(rawTier)) ? Number(rawTier) : 1` — eliminates the NaN silent bypass. (2) In `page.tsx` the `ReplayModal` invocation now passes `operatorTier={selected.payload.tier}` — the `tier` field already exists on `OperatorExportedPayload` at line 10 of that file.

**Note:** The operatorTier sourced here (`entry.payload.tier`) is the tier recorded in the `operator.exported` audit event payload. This is the tier of the operator who *created* the export, which is the correct value for gating replay access. If a future requirement needs to gate on the *viewing* operator's live session tier, that would require a separate auth-context hook.

---

### WR-01: Culture page fetches on mount but never re-fetches on `?nous=` filter change

**Files modified:** `steward/src/app/culture/page.tsx`
**Commit:** eb9e36b
**Applied fix:** Changed `useEffect(..., [])` to `useEffect(..., [activeFilter])` with a clarifying comment. The fetch will now re-run whenever the Nous DID filter changes, so Grid endpoints can be extended to accept `?did=` in the future without client-side wiring changes.

---

### WR-02: `NormTimeline` uses `Math.min/max(...spread)` on unbounded array — stack overflow risk

**Files modified:** `steward/src/app/culture/norm-timeline.tsx`
**Commit:** 678fbd3
**Applied fix:** Removed `allTicks` intermediate array and the two `Math.min/max(...spread)` calls. Replaced with a `let minTick = Infinity / let maxTick = -Infinity` pair updated by a `for...of` loop over `sortedNorms`, checking all three tick fields per record. This is O(n) and safe for any array length.

---

### WR-03: `humanSanctionStore` closures in `main.ts` capture `dbConn` by reference

**Files modified:** `grid/src/main.ts`
**Commit:** bd008cd
**Applied fix:** Wrapped the object literal in an IIFE (`(() => { const pool = dbConn.getPool(); return { ... }; })()`). The pool reference is now captured once at construction time. Each method's repeated `dbConn.getPool()` call was also eliminated (each now uses the captured `pool` directly), which is a minor efficiency improvement as well.

---

### WR-04: `LoreGraph` uses only the first contributing entry per citing DID for citation edges

**Files modified:** `steward/src/app/culture/lore-graph.tsx`
**Commit:** 633c7cc
**Applied fix:** Replaced the single `entries.find(e => e.contributor_did === citing_did)` call with a two-step approach: collect all entries for `citing_did`, then pick the one whose `tick` is closest to (and not after) the citation's `payload.tick` as the source anchor. Falls back to `allForCitingDid[0]` only when no entry precedes the citation tick. This avoids drawing all citations from the same arbitrary first node for Nous with multiple lore contributions. A comment documents the approximation and fallback logic.

**Note:** Requires human verification — this is a logic/accuracy fix and the correctness of "most recent entry before the citation tick" as a graph anchor depends on domain assumptions about how lore citations work. The visual result should be reviewed with real multi-entry Nous data.

---

_Fixed: 2026-05-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
