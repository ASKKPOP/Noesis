---
phase: 07-peer-dialogue-telos-refinement
plan: 04
type: execute
wave: 4
depends_on: [01, 02, 03]
revised_at: 2026-04-21
files_modified:
  - dashboard/src/components/primitives/chip.tsx
  - dashboard/src/components/primitives/primitives.test.tsx
  - dashboard/src/components/dialogue/telos-refined-badge.tsx
  - dashboard/src/components/dialogue/telos-refined-badge.test.tsx
  - dashboard/src/lib/hooks/use-refined-telos-history.ts
  - dashboard/src/lib/hooks/use-refined-telos-history.test.ts
  - dashboard/src/lib/hooks/use-firehose-filter.ts
  - dashboard/src/lib/hooks/use-firehose-filter.test.ts
  - dashboard/src/app/grid/components/firehose-filter-chip.tsx
  - dashboard/src/app/grid/components/firehose-filter-chip.test.tsx
  - dashboard/src/app/grid/components/inspector-sections/telos.tsx
  - dashboard/src/app/grid/components/inspector-sections/telos.test.tsx
  - dashboard/src/app/grid/components/inspector.tsx
  - dashboard/src/app/grid/components/firehose.tsx
  - dashboard/src/app/grid/components/firehose.test.tsx
  - dashboard/src/app/grid/components/firehose-row.tsx
  - .planning/MILESTONES.md
autonomous: true
requirements: [DIALOG-03]
must_haves:
  truths:
    - "Inspector renders a panel-level badge on TelosSection when the selected Nous has refinedCount ≥ 1"
    - "Badge is absent (not hidden) when refinedCount === 0 — no DOM node"
    - "Clicking the badge navigates to /grid?tab=firehose&firehose_filter=dialogue_id:<lastRefinedDialogueId>"
    - "Firehose dims non-matching rows (opacity-40) when filter active; matching rows render at full opacity"
    - "Filter chip renders literal 'dialogue_id:' + the 16-hex value in JetBrains Mono; × button clears the filter"
    - "useRefinedTelosHistory derives state from existing useFirehose — zero new RPC, zero new WebSocket"
    - "Malformed telos.refined events (non-16-hex dialogue_id, missing hash fields) silently dropped at hook boundary"
    - "Indigo-400 (#818CF8) appears ONLY in telos-refined-badge.tsx and firehose-filter-chip.tsx — enforced by grep-based source test"
  artifacts:
    - path: "dashboard/src/components/dialogue/telos-refined-badge.tsx"
      provides: "Panel-level ↻ refined via dialogue chip with click-through navigation"
      exports: ["TelosRefinedBadge"]
    - path: "dashboard/src/lib/hooks/use-refined-telos-history.ts"
      provides: "Client-only derived selector over useFirehose — {lastRefinedDialogueId, refinedCount, refinedAfterHashes}"
      exports: ["useRefinedTelosHistory"]
    - path: "dashboard/src/lib/hooks/use-firehose-filter.ts"
      provides: "Next.js query-param hook with DIALOGUE_ID_RE regex guard"
      exports: ["useFirehoseFilter", "DIALOGUE_ID_RE"]
    - path: "dashboard/src/app/grid/components/firehose-filter-chip.tsx"
      provides: "Active-filter chip with × clear button"
      exports: ["FirehoseFilterChip"]
    - path: "dashboard/src/components/primitives/chip.tsx"
      provides: "Chip primitive with new color='dialogue' variant"
      contains: "'dialogue'"
  key_links:
    - from: "dashboard/src/app/grid/components/inspector-sections/telos.tsx"
      to: "dashboard/src/components/dialogue/telos-refined-badge.tsx"
      via: "import + render at heading-row right via flex justify-between"
      pattern: "TelosRefinedBadge"
    - from: "dashboard/src/components/dialogue/telos-refined-badge.tsx"
      to: "dashboard/src/lib/hooks/use-refined-telos-history.ts"
      via: "useRefinedTelosHistory(did) hook call"
      pattern: "useRefinedTelosHistory"
    - from: "dashboard/src/lib/hooks/use-refined-telos-history.ts"
      to: "dashboard/src/app/grid/hooks.ts (useFirehose)"
      via: "derived selector over useFirehose().entries — no new subscription"
      pattern: "useFirehose"
    - from: "dashboard/src/app/grid/components/firehose.tsx"
      to: "dashboard/src/lib/hooks/use-firehose-filter.ts"
      via: "useFirehoseFilter() → dim-not-hide classname branch + <FirehoseFilterChip /> mount"
      pattern: "useFirehoseFilter"
---

<objective>
Implement the dashboard-side DIALOG-03 surfaces that consume the `telos.refined` firehose events Plan 03 emits: (1) a panel-level `↻ refined via dialogue (N)` badge on the Inspector's TelosSection, (2) a dim-not-hide firehose filter chip triggered by the URL query param `firehose_filter=dialogue_id:<16-hex>`, and (3) a new `'dialogue'` color variant on the shared Chip primitive (indigo-400 `#818CF8`). All work is client-only — zero new RPC, zero new WebSocket subscription — derived from the existing `useFirehose()` firehose store Plans 3 and earlier phases established.

Purpose: Closes DIALOG-03. Gives operators an affordance to notice Brain-initiated goal refinement and jump directly to the triggering dialogue in the firehose. Honors PHILOSOPHY §1 by never displaying plaintext `new_goals` — the UI surface is strictly hash + dialogue_id navigation. Honors the Phase 6 tier palette guardrail by choosing indigo-400 (a slot not claimed by any operator tier or accent) so Nous-initiated refinement is visually distinct from operator-forced actions.

Output:
- 4 new production files (badge + 2 hooks + filter chip)
- 4 new test files
- 1 modified primitive (Chip gains `'dialogue'` variant) + its existing test extended
- 3 modified Grid components (TelosSection, Inspector, Firehose) + their existing tests extended
- 1 modified firehose-row (dim-not-hide opacity branch)
- MILESTONES.md append entry ("Phase 7 shipped — peer dialogue → telos refinement")
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-CONTEXT.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-UI-SPEC.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-PATTERNS.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-VALIDATION.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from the codebase. -->
<!-- Executor should use these directly — no further codebase exploration needed. -->

From dashboard/src/components/primitives/chip.tsx (existing — to be extended):
```typescript
export type ChipColor = 'neutral' | 'blue' | 'amber' | 'red' | 'muted';
// Phase 7 extends to: 'neutral' | 'blue' | 'amber' | 'red' | 'muted' | 'dialogue'

export interface ChipProps {
    readonly label: string;
    readonly testId?: string;
    readonly color?: ChipColor;
    readonly 'aria-label'?: string;
}

const COLOR_CLASSES: Record<ChipColor, string> = {
    neutral: 'bg-neutral-800 text-neutral-200',
    blue: 'bg-neutral-900 border-2 border-blue-400 text-neutral-200',
    amber: 'bg-neutral-900 border-2 border-amber-300 text-neutral-200',
    red: 'bg-neutral-900 border-2 border-red-400 text-red-400',
    muted: 'bg-neutral-900 border border-dashed border-neutral-600 text-neutral-500 line-through',
    // Phase 7 adds:
    // dialogue: 'bg-[#17181C] border border-[#818CF8] text-[#818CF8]',
};
```

From dashboard/src/app/grid/hooks.ts (existing — consumed, NOT modified):
```typescript
export function useFirehose(): FirehoseSnapshot;
// FirehoseSnapshot.entries is oldest-first; each entry has at minimum:
//   { id?: number; eventType: string; actorDid: string; payload: unknown; eventHash: string; ... }
// useRefinedTelosHistory filters: eventType === 'telos.refined' && payload.did === targetDid
```

From dashboard/src/lib/api/introspect.ts (existing — consumed):
```typescript
export interface NousStateResponse {
    telos: { active_goals: Array<{ id: string; description: string; priority: number }> };
    // plus other fields — not consumed by Phase 7 except as-is pass-through
}
```

From dashboard/src/app/grid/components/inspector-sections/telos.tsx (existing — to be modified):
```typescript
export interface TelosSectionProps {
    readonly telos: NousStateResponse['telos'];
    // Phase 7 adds:
    // readonly did: string | null;   // plumbed from Inspector so the hook can filter by Nous
}
```

From dashboard/src/app/grid/components/tab-bar.tsx (existing reference pattern for Next.js query-param mutation):
```typescript
import { useRouter, useSearchParams } from 'next/navigation';
const router = useRouter();
const searchParams = useSearchParams();
// Pattern: const next = new URLSearchParams(searchParams.toString()); next.set(k, v); router.push(`?${next}`);
```

From plan-03-allowlist-producer-boundary.md (producer side — already shipped by Wave 3):
```typescript
// Wire-format contract (closed 4-key tuple):
// { did: string, before_goal_hash: string(64-hex), after_goal_hash: string(64-hex), triggered_by_dialogue_id: string(16-hex) }
// eventType string on the firehose: 'telos.refined'
export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;
export const HEX64_RE = /^[0-9a-f]{64}$/;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend Chip primitive with 'dialogue' color variant + add useFirehoseFilter + useRefinedTelosHistory hooks</name>
  <files>
    dashboard/src/components/primitives/chip.tsx,
    dashboard/src/components/primitives/primitives.test.tsx,
    dashboard/src/lib/hooks/use-firehose-filter.ts,
    dashboard/src/lib/hooks/use-firehose-filter.test.ts,
    dashboard/src/lib/hooks/use-refined-telos-history.ts,
    dashboard/src/lib/hooks/use-refined-telos-history.test.ts
  </files>
  <read_first>
    - `dashboard/src/components/primitives/chip.tsx:17,30-36` — `ChipColor` union + `COLOR_CLASSES` map that Phase 7 extends
    - `dashboard/src/components/primitives/primitives.test.tsx` — existing Chip test cases (verify none reference the new 'dialogue' variant before the edit)
    - `dashboard/src/app/grid/hooks.ts:27-30` — `useFirehose()` signature + `FirehoseSnapshot` shape
    - `dashboard/src/lib/stores/firehose-store.ts:26-33` — `FirehoseSnapshot` exact fields (`entries`, `filteredEntries`, `filter`, etc.)
    - `dashboard/src/app/grid/components/firehose-row.tsx` — existing `entry.payload` typing pattern (unknown with runtime guard)
    - `dashboard/src/app/grid/components/tab-bar.tsx:17,38-55` — canonical Next.js `useRouter` + `useSearchParams` + `new URLSearchParams` pattern for query-param mutation
    - `07-UI-SPEC.md` §Color (lines 152-190) — indigo-400 `#818CF8` + contrast verification 6.4:1 on `#17181C`
    - `07-UI-SPEC.md` §Interaction Contract (lines 240-270) — badge click URL contract + DIALOGUE_ID_RE regex + silent-drop on malformed
    - `07-UI-SPEC.md` §State Contract (lines 296-311) — hook return shape on SSR / empty / populated / did=null / Nous switch
    - `07-CONTEXT.md` D-28 — derived selector over existing useFirehose, zero new RPC
    - `07-CONTEXT.md` D-29 — firehose_filter=dialogue_id:<16-hex> URL shape, most-recent semantics
    - `07-CONTEXT.md` D-30 — panel-level placement (not per-goal) because hash is whole-telos
  </read_first>
  <behavior>
    **Chip primitive (additive, zero-diff for existing callers):**
    - `ChipColor` union grows to include `'dialogue'` as the sixth slot
    - `COLOR_CLASSES['dialogue'] = 'bg-[#17181C] border border-[#818CF8] text-[#818CF8]'`
    - Default behavior (no `color` prop) still resolves to `'neutral'` — Inspector memory chips, Economy chips, and TelosSection priority chips render BYTE-IDENTICAL before and after the edit
    - The existing `primitives.test.tsx` Chip tests all still pass; add one new test: `color='dialogue'` renders with indigo-400 border + text classes

    **useFirehoseFilter hook (dashboard/src/lib/hooks/use-firehose-filter.ts):**
    - Exports `DIALOGUE_ID_RE = /^[0-9a-f]{16}$/` (sibling of the Plan 03 Grid-side regex; kept in sync via a comment cross-reference)
    - Exports `useFirehoseFilter(): { filter: { key: 'dialogue_id'; value: string } | null; setFilter(next): void; clear(): void }`
    - Parses `searchParams.get('firehose_filter')` as strict `<key>:<value>`; unknown keys ignored (returns `filter: null`)
    - For `dialogue_id` key: validates value against `DIALOGUE_ID_RE`; malformed → returns `filter: null` (chip not mounted; firehose renders unfiltered)
    - `setFilter({key, value})` builds new URLSearchParams preserving all other params, writes `firehose_filter=<key>:<value>`, calls `router.push`
    - `clear()` removes only the `firehose_filter` param (other params preserved)

    **useRefinedTelosHistory hook (dashboard/src/lib/hooks/use-refined-telos-history.ts):**
    - Exports `useRefinedTelosHistory(did: string | null): { lastRefinedDialogueId: string | null; refinedCount: number; refinedAfterHashes: ReadonlySet<string> }`
    - Subscribes to firehose via `useFirehose()` — no `useSyncExternalStore`, no WS, no RPC
    - When `did === null`: returns `{ lastRefinedDialogueId: null, refinedCount: 0, refinedAfterHashes: new Set() }`
    - Filters entries where `entry.eventType === 'telos.refined'` AND (payload is object) AND `payload.did === did` AND `DIALOGUE_ID_RE.test(payload.triggered_by_dialogue_id)` AND `/^[0-9a-f]{64}$/.test(payload.after_goal_hash)`
    - Malformed entries silently dropped (no console.warn, no throw)
    - `refinedCount` = number of matching entries in current snapshot
    - `lastRefinedDialogueId` = `triggered_by_dialogue_id` of the MOST RECENT matching entry (highest `id` or tail of `entries` — entries are oldest-first per FirehoseSnapshot)
    - `refinedAfterHashes` = Set of all `after_goal_hash` values across matching entries (retained for future per-goal attribution; D-30 deferral exit path)
    - `useMemo` the derived object so reference identity is stable across renders when entries haven't changed

    **Test cases (must write BEFORE implementation per TDD):**

    *primitives.test.tsx — add one case after existing Chip tests:*
    - Test: `color='dialogue'` → rendered node has class `border-[#818CF8]` and class `text-[#818CF8]`

    *use-firehose-filter.test.ts (7 cases):*
    1. No `firehose_filter` param → `filter === null`
    2. `firehose_filter=dialogue_id:a1b2c3d4e5f6a7b8` → `filter === { key: 'dialogue_id', value: 'a1b2c3d4e5f6a7b8' }`
    3. `firehose_filter=dialogue_id:NOTHEX` (not lowercase hex) → `filter === null`
    4. `firehose_filter=dialogue_id:abc` (length 3 not 16) → `filter === null`
    5. `firehose_filter=unknown_key:anything` → `filter === null`
    6. `setFilter({key:'dialogue_id', value:'a1b2c3d4e5f6a7b8'})` → `router.push` called with URL containing `firehose_filter=dialogue_id%3Aa1b2c3d4e5f6a7b8` or `firehose_filter=dialogue_id:a1b2c3d4e5f6a7b8` (whichever URLSearchParams emits); other params (e.g., `tab=firehose`) preserved
    7. `clear()` with `?tab=firehose&firehose_filter=dialogue_id:...` active → `router.push` called with URL that has `tab=firehose` but NOT `firehose_filter`

    *use-refined-telos-history.test.ts (8 cases):*
    1. `did === null` → `{ refinedCount: 0, lastRefinedDialogueId: null, refinedAfterHashes.size === 0 }`
    2. Empty firehose entries → same zero state
    3. Three `telos.refined` entries for `did:noesis:alice` (all well-formed) → `refinedCount === 3`; `lastRefinedDialogueId` === triggered_by_dialogue_id of the LAST entry (newest); `refinedAfterHashes.size === 3`
    4. Mixed stream: 2 for alice + 2 for bob → with `did='did:noesis:alice'`, count === 2; with `did='did:noesis:bob'`, count === 2
    5. Malformed: `triggered_by_dialogue_id: 'NOTHEX'` (not 16-hex) → entry silently dropped
    6. Malformed: `after_goal_hash` missing → entry silently dropped
    7. Non-`telos.refined` entry (e.g. `nous.spoke`) with matching did → ignored
    8. Reference stability: two renders with identical entries array return object whose `refinedAfterHashes` is referentially equal (via useMemo)
  </behavior>
  <action>
    **Step 1 (RED — Chip variant test):**
    Edit `dashboard/src/components/primitives/primitives.test.tsx`: append one `it(...)` case asserting that `<Chip label="x" color="dialogue" />` renders a node with classes `border-[#818CF8]` and `text-[#818CF8]`. Run `cd dashboard && pnpm test -- primitives.test` — MUST fail (type error on `'dialogue'` not in ChipColor union).

    **Step 2 (GREEN — Chip variant):**
    Edit `dashboard/src/components/primitives/chip.tsx`:
    - Extend `ChipColor` union: `'neutral' | 'blue' | 'amber' | 'red' | 'muted' | 'dialogue'`
    - Add entry to `COLOR_CLASSES`: `dialogue: 'bg-[#17181C] border border-[#818CF8] text-[#818CF8]'` (matches 07-UI-SPEC §Color — indigo-400 `#818CF8`, border width 1px not 2px per §Color table which specifies "Badge border + icon + label text" at 1px; background is secondary surface `#17181C`)
    - Add a top-of-file JSDoc note: `// Phase 7: 'dialogue' variant — indigo-400 #818CF8 for Nous-initiated telos.refined badge (07-UI-SPEC §Color). Contrast 6.4:1 on #17181C. Not to be reused for operator-tier surfaces (H2/H3/H4 reserved).`
    Run `cd dashboard && pnpm test -- primitives.test` — MUST pass. Run `cd dashboard && pnpm tsc --noEmit` to confirm no type regressions.

    **Step 3 (RED — useFirehoseFilter tests):**
    Create `dashboard/src/lib/hooks/use-firehose-filter.test.ts` with all 7 cases above. Mock `next/navigation` via `vi.mock('next/navigation', ...)` following the pattern in `dashboard/src/app/grid/components/tab-bar.test.tsx` (read that file to match the mocking style exactly). Import `{ useFirehoseFilter, DIALOGUE_ID_RE }` from `../use-firehose-filter`. Run `cd dashboard && pnpm test -- use-firehose-filter` — MUST fail (module not found).

    **Step 4 (GREEN — useFirehoseFilter):**
    Create `dashboard/src/lib/hooks/use-firehose-filter.ts`:
    ```typescript
    'use client';
    /**
     * useFirehoseFilter — thin wrapper over Next.js useSearchParams + useRouter.
     *
     * Parses `firehose_filter=<key>:<value>`. Phase 7 supports only key='dialogue_id'
     * with value matching DIALOGUE_ID_RE (16-hex, lowercase). Unknown keys or
     * malformed values resolve to `filter: null` — the chip does not mount and
     * the firehose renders unfiltered. Mirrors the producer-boundary regex
     * discipline from Plan 03's append-telos-refined.ts.
     *
     * 07-UI-SPEC §Interaction Contract (lines 250-256, D-29).
     * 07-CONTEXT.md D-29 (URL shape), D-31 (regex symmetry with producer side).
     */
    import { useRouter, useSearchParams } from 'next/navigation';
    import { useCallback, useMemo } from 'react';

    export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

    export interface FirehoseFilter {
      readonly key: 'dialogue_id';
      readonly value: string;
    }

    export interface UseFirehoseFilterReturn {
      readonly filter: FirehoseFilter | null;
      setFilter(next: FirehoseFilter): void;
      clear(): void;
    }

    export function useFirehoseFilter(): UseFirehoseFilterReturn {
      const router = useRouter();
      const searchParams = useSearchParams();
      const raw = searchParams.get('firehose_filter');

      const filter = useMemo<FirehoseFilter | null>(() => {
        if (!raw) return null;
        const colonIdx = raw.indexOf(':');
        if (colonIdx <= 0) return null;
        const key = raw.slice(0, colonIdx);
        const value = raw.slice(colonIdx + 1);
        if (key !== 'dialogue_id') return null;
        if (!DIALOGUE_ID_RE.test(value)) return null;
        return { key, value };
      }, [raw]);

      const setFilter = useCallback((next: FirehoseFilter) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('firehose_filter', `${next.key}:${next.value}`);
        router.push(`?${params.toString()}`);
      }, [router, searchParams]);

      const clear = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('firehose_filter');
        const qs = params.toString();
        router.push(qs ? `?${qs}` : '?');
      }, [router, searchParams]);

      return { filter, setFilter, clear };
    }
    ```
    Run `cd dashboard && pnpm test -- use-firehose-filter` — MUST pass all 7 cases.

    **Step 5 (RED — useRefinedTelosHistory tests):**
    Create `dashboard/src/lib/hooks/use-refined-telos-history.test.ts` with all 8 cases. Mock `useFirehose` via `vi.mock('@/app/grid/hooks', ...)` returning a `FirehoseSnapshot` with the fields `useFirehose` actually returns (read `dashboard/src/lib/stores/firehose-store.ts:26-33` for the exact shape — expect at minimum `entries` (oldest-first array)). Run tests — MUST fail (module not found).

    **Step 6 (GREEN — useRefinedTelosHistory):**
    Create `dashboard/src/lib/hooks/use-refined-telos-history.ts`:
    ```typescript
    'use client';
    /**
     * useRefinedTelosHistory — derived selector over useFirehose().
     *
     * D-28: client-only, zero new RPC, zero new WebSocket. Returns a stable
     * summary of `telos.refined` events for the selected Nous:
     *   - refinedCount — how many valid refinements in current firehose snapshot
     *   - lastRefinedDialogueId — triggered_by_dialogue_id of the most recent one
     *   - refinedAfterHashes — set of all after_goal_hash values (kept for the
     *     D-30 deferral exit path: future per-goal attribution)
     *
     * Malformed events (non-16-hex dialogue_id, missing/invalid after_goal_hash)
     * are silently dropped — matches 07-UI-SPEC §State Contract "Silent drop
     * at hook boundary" + the Phase 6 D-16 pattern.
     *
     * Plaintext invariant (PHILOSOPHY §1, D-18): this hook NEVER references
     * `new_goals`, `description`, or `priority` from a telos.refined payload.
     * Enforced by the grep-based source test in telos-refined-badge.test.tsx.
     */
    import { useMemo } from 'react';
    import { useFirehose } from '@/app/grid/hooks';

    const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;
    const HEX64_RE = /^[0-9a-f]{64}$/;

    interface TelosRefinedPayload {
      did: string;
      before_goal_hash: string;
      after_goal_hash: string;
      triggered_by_dialogue_id: string;
    }

    function isValidPayload(p: unknown, targetDid: string): p is TelosRefinedPayload {
      if (typeof p !== 'object' || p === null) return false;
      const r = p as Record<string, unknown>;
      return (
        r.did === targetDid &&
        typeof r.triggered_by_dialogue_id === 'string' &&
        DIALOGUE_ID_RE.test(r.triggered_by_dialogue_id) &&
        typeof r.after_goal_hash === 'string' &&
        HEX64_RE.test(r.after_goal_hash) &&
        typeof r.before_goal_hash === 'string' &&
        HEX64_RE.test(r.before_goal_hash)
      );
    }

    export interface RefinedTelosHistory {
      readonly lastRefinedDialogueId: string | null;
      readonly refinedCount: number;
      readonly refinedAfterHashes: ReadonlySet<string>;
    }

    const EMPTY: RefinedTelosHistory = {
      lastRefinedDialogueId: null,
      refinedCount: 0,
      refinedAfterHashes: new Set(),
    };

    export function useRefinedTelosHistory(did: string | null): RefinedTelosHistory {
      const snap = useFirehose();
      return useMemo<RefinedTelosHistory>(() => {
        if (!did) return EMPTY;
        const matches = snap.entries.filter((e) =>
          e.eventType === 'telos.refined' && isValidPayload(e.payload, did)
        );
        if (matches.length === 0) return EMPTY;
        const last = matches[matches.length - 1];
        const hashes = new Set<string>();
        for (const m of matches) {
          hashes.add((m.payload as TelosRefinedPayload).after_goal_hash);
        }
        return {
          lastRefinedDialogueId: (last.payload as TelosRefinedPayload).triggered_by_dialogue_id,
          refinedCount: matches.length,
          refinedAfterHashes: hashes,
        };
      }, [did, snap.entries]);
    }
    ```
    Run `cd dashboard && pnpm test -- use-refined-telos-history` — MUST pass all 8 cases.

    **Step 7 (REFACTOR + integrate):**
    - Confirm DIALOGUE_ID_RE in `use-firehose-filter.ts` and the inline copy in `use-refined-telos-history.ts` are literally identical — add a comment in each referring to the other ("keep in sync with Plan 03 grid/src/audit/append-telos-refined.ts:DIALOGUE_ID_RE")
    - Run full dashboard suite: `cd dashboard && pnpm test` — all pre-existing tests still green; 3 new test files green
    - Run `cd dashboard && pnpm tsc --noEmit` — zero type errors
  </action>
  <verify>
    <automated>cd dashboard && pnpm test -- primitives.test use-firehose-filter use-refined-telos-history --run && pnpm tsc --noEmit</automated>
  </verify>
  <done>
    - `ChipColor` extended with `'dialogue'`; primitives.test.tsx passes including new case
    - `use-firehose-filter.ts` + 7-case test file exist; all green; DIALOGUE_ID_RE exported
    - `use-refined-telos-history.ts` + 8-case test file exist; all green; malformed events silently dropped
    - Zero TypeScript errors across dashboard
    - Files use literal `#818CF8` ONLY in chip.tsx (verified by grep in Task 3)
    - Neither hook references `new_goals`, `description`, or `priority` (grep-verified in Task 2)
  </done>
  <acceptance_criteria>
    **AC-4-1-1 (Chip zero-diff for existing callers):** `cd dashboard && pnpm test -- primitives.test` passes all pre-existing Chip test cases unmodified. Manual grep: `grep -rn "Chip" dashboard/src/ | grep -v "\.test\." | grep -v "chip.tsx" | head -20` shows existing call sites (Inspector memory badges, Economy listings, TelosSection priority chip) do not pass a `color` prop — their visual output must be byte-identical after the edit.

    **AC-4-1-2 (useFirehoseFilter regex parity with producer):** `grep -n "DIALOGUE_ID_RE" dashboard/src/lib/hooks/use-firehose-filter.ts grid/src/audit/append-telos-refined.ts` returns the same literal pattern `/^[0-9a-f]{16}$/` on both sides. (This is the consumer-side mirror of the Plan 03 producer gate; divergence would cause a valid producer-emitted id to fail dashboard parsing.)

    **AC-4-1-3 (useRefinedTelosHistory hash-only invariant):** `grep -iE "new_goals|description|priority|utterance" dashboard/src/lib/hooks/use-refined-telos-history.ts` returns ZERO matches. PHILOSOPHY §1 + D-18: plaintext goal content never enters the dashboard. The hook consumes only `did`, `before_goal_hash`, `after_goal_hash`, `triggered_by_dialogue_id`.

    **AC-4-1-4 (reference stability):** The 8th test case in `use-refined-telos-history.test.ts` asserts `result1.refinedAfterHashes === result2.refinedAfterHashes` (reference equality) when the input entries array reference is stable across renders. Enforces `useMemo` discipline so TelosRefinedBadge does not re-render on unrelated firehose activity.
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create TelosRefinedBadge + FirehoseFilterChip components with full test coverage</name>
  <files>
    dashboard/src/components/dialogue/telos-refined-badge.tsx,
    dashboard/src/components/dialogue/telos-refined-badge.test.tsx,
    dashboard/src/app/grid/components/firehose-filter-chip.tsx,
    dashboard/src/app/grid/components/firehose-filter-chip.test.tsx
  </files>
  <read_first>
    - `dashboard/src/components/primitives/chip.tsx` (post-Task-1) — confirm `'dialogue'` variant available
    - `dashboard/src/lib/hooks/use-refined-telos-history.ts` (post-Task-1) — consumed shape
    - `dashboard/src/lib/hooks/use-firehose-filter.ts` (post-Task-1) — `{ filter, setFilter, clear }` surface
    - `dashboard/src/app/grid/components/tab-bar.test.tsx` — router-mock pattern for click-through tests
    - `07-UI-SPEC.md` §Copywriting Contract (lines 194-236) — exact badge label / aria-label / filter-chip aria-label strings
    - `07-UI-SPEC.md` §Interaction Contract (lines 240-270) — focus ring, keyboard Enter/Space, dim-not-hide
    - `07-UI-SPEC.md` §Testing Contract (lines 317-354) — locked testids: `telos-refined-badge`, `telos-refined-badge-trigger`, `firehose-filter-chip`, `firehose-filter-clear`
    - `07-CONTEXT.md` D-27 (panel-level badge only), D-29 (click target: tab=firehose + firehose_filter=dialogue_id:…), D-30 (count in parens when N>1)
  </read_first>
  <behavior>
    **TelosRefinedBadge component (dashboard/src/components/dialogue/telos-refined-badge.tsx):**
    - Props: `{ did: string | null }` — NO `refinedCount` prop (reads via hook; keeps the badge self-contained)
    - Calls `useRefinedTelosHistory(did)` — gets `{ lastRefinedDialogueId, refinedCount }`
    - When `refinedCount === 0`: returns `null` (no DOM node — per 07-UI-SPEC §State Contract "Empty (refinedCount === 0) → Not rendered")
    - When `refinedCount >= 1`: renders a `<button type="button">` wrapping a `<Chip label="..." color="dialogue" />`
      - `data-testid="telos-refined-badge"` on the outer `<button>`; `data-testid="telos-refined-badge-trigger"` on the same element (UI-SPEC lists both as locked testids for the interactive element; we apply both as `data-testid` and an extra `data-testid-trigger` is achieved by using `getByTestId('telos-refined-badge-trigger')` — simplest solution: the button gets `data-testid="telos-refined-badge"` AND a `data-testid-trigger` attribute is not standard. Per UI-SPEC §Component Inventory the hierarchy is "badge wrapper" + "inner button trigger" — resolve by making the outer `<span data-testid="telos-refined-badge">` wrap the `<button data-testid="telos-refined-badge-trigger">`. Chip then lives inside the button.)
    - Label: `refinedCount === 1` → `↻ refined via dialogue`; `refinedCount > 1` → `↻ refined via dialogue (N)` where N is the numeric count
    - `aria-label` (on the button): for N=1 → `Telos refined via peer dialogue — 1 refinement in history. Click to view triggering dialogue in firehose.`; for N>1 → `Telos refined via peer dialogue — ${N} refinements in history. Click to view most recent triggering dialogue in firehose.`
    - `title` attribute (on the button): `Refined via peer dialogue. Click to filter firehose by dialogue_id.`
    - Focus ring: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300` (matches Phase 6 pattern)
    - Click handler: builds URL with current pathname + `useSearchParams` params + `tab=firehose` + `firehose_filter=dialogue_id:${lastRefinedDialogueId}`, calls `router.push`
    - Button has `cursor-pointer` styling
    - Button element uses `useFirehoseFilter` for the `setFilter` call? NO — the badge needs to also switch `tab=firehose`, which is outside `useFirehoseFilter`'s scope (that hook only manages the filter param). The badge uses its own `useRouter` + `useSearchParams` pattern to construct the full URL atomically in one `router.push`.

    **FirehoseFilterChip component (dashboard/src/app/grid/components/firehose-filter-chip.tsx):**
    - Props: NONE — the component is self-contained, reads `useFirehoseFilter()` internally
    - When `filter === null`: returns `null`
    - When `filter.key === 'dialogue_id'`:
      - Outer `<div data-testid="firehose-filter-chip" role="status" aria-live="polite">` containing:
        - Text prefix: `<span className="text-[14px] text-neutral-200">dialogue_id: </span>` (Body 14/400 Inter)
        - Value: `<span className="font-mono text-[12px] text-[#818CF8]">${filter.value}</span>` (Micro-mono 12/400 JetBrains Mono, indigo-400)
        - Clear button: `<button type="button" data-testid="firehose-filter-clear" aria-label="Clear dialogue filter. Show all firehose events." onClick={clear}>×</button>` (U+00D7 multiplication sign, 14px, centered in 16×16 hit target)
    - Background: `bg-[#17181C]` (secondary token); border: `border border-[#818CF8]` (indigo-400, matching badge border)
    - Focus ring on clear button: sky-300 same as badge
    - Keyboard Enter/Space on the clear button activates (native `<button>` behavior)

    **Test cases (TDD — write BEFORE implementation):**

    *telos-refined-badge.test.tsx (≥ 7 cases):*
    1. `did=null` → `queryByTestId('telos-refined-badge')` returns null (hook returns refinedCount:0; component returns null)
    2. `refinedCount === 0` (did set but no matching events) → same null result
    3. `refinedCount === 1` → badge present; label is literally `↻ refined via dialogue` (no `(N)` suffix)
    4. `refinedCount === 3` → label is literally `↻ refined via dialogue (3)`
    5. Click `telos-refined-badge-trigger` button → `router.push` called ONCE with a URL string that contains BOTH `tab=firehose` AND `firehose_filter=dialogue_id:<lastRefinedDialogueId>` (order-agnostic; use two substring assertions). Decode any URL-encoded `%3A` back to `:` before asserting.
    6. Keyboard Enter on the focused button → same `router.push` behavior
    7. `aria-label` exact-match for N=1 and N=3 per Copywriting Contract
    8. (source-invariant test — grep-based) `readFileSync('dashboard/src/components/dialogue/telos-refined-badge.tsx')` does NOT contain any of: `new_goals`, `goal_description`, `priority`, `utterance`. Asserts plaintext-never at component level.
    9. (source-invariant test — grep-based) Same file DOES contain literal `#818CF8` via the Chip `color="dialogue"` variant path, OR asserts the Chip variant is used (grep for `color="dialogue"`). Either shape is acceptable; the stronger claim is that NO file in `dashboard/src/` outside of `chip.tsx`, `telos-refined-badge.tsx`, `telos-refined-badge.test.tsx`, `firehose-filter-chip.tsx`, `firehose-filter-chip.test.tsx` contains the literal `#818CF8`.

    *firehose-filter-chip.test.tsx (≥ 6 cases):*
    1. `filter=null` (no `?firehose_filter=` param) → `queryByTestId('firehose-filter-chip')` returns null
    2. `filter={key:'dialogue_id',value:'a1b2c3d4e5f6a7b8'}` → chip renders; value `'a1b2c3d4e5f6a7b8'` visible inside a JetBrains-Mono / `font-mono` span
    3. `firehose_filter=dialogue_id:NOTHEX` URL → useFirehoseFilter returns filter:null → chip not mounted
    4. Click `firehose-filter-clear` → `router.push` called with URL that does NOT contain `firehose_filter=`
    5. Keyboard Enter on clear button → same router.push as click
    6. `aria-label` on clear button is literally `Clear dialogue filter. Show all firehose events.`; chip wrapper has `role="status"` + `aria-live="polite"`
  </behavior>
  <action>
    **Step 1 (RED — badge tests):**
    Create `dashboard/src/components/dialogue/` directory. Create `telos-refined-badge.test.tsx` with all 9 cases above. Mock `useRefinedTelosHistory` via `vi.mock('@/lib/hooks/use-refined-telos-history', ...)` returning configurable `{ refinedCount, lastRefinedDialogueId }`. Mock `next/navigation` (useRouter + useSearchParams) via `vi.mock`. Use `@testing-library/react` (already a project dep). Run `cd dashboard && pnpm test -- telos-refined-badge` — MUST fail (component not found).

    **Step 2 (GREEN — badge component):**
    Create `dashboard/src/components/dialogue/telos-refined-badge.tsx`:
    ```typescript
    'use client';
    /**
     * TelosRefinedBadge — panel-level chip on TelosSection.
     *
     * Renders iff useRefinedTelosHistory(did).refinedCount >= 1 (D-27, D-30:
     * panel-level, not per-goal, because compute_active_telos_hash covers the
     * whole goal set). Clicking navigates to /grid?tab=firehose&firehose_filter=
     * dialogue_id:<lastRefinedDialogueId> — preserves other query params.
     *
     * 07-UI-SPEC §Copywriting (lines 194-208) — label/aria-label/title strings
     *  are LOCKED; do not edit without a UI-SPEC amendment.
     *
     * PHILOSOPHY §1 + D-18: this component renders only the fact of refinement
     * (a count + a dialogue_id reference). No plaintext goal content ever.
     */
    import { useCallback } from 'react';
    import { useRouter, useSearchParams } from 'next/navigation';
    import { Chip } from '@/components/primitives';
    import { useRefinedTelosHistory } from '@/lib/hooks/use-refined-telos-history';

    export interface TelosRefinedBadgeProps {
      readonly did: string | null;
    }

    export function TelosRefinedBadge({ did }: TelosRefinedBadgeProps): React.ReactElement | null {
      const { refinedCount, lastRefinedDialogueId } = useRefinedTelosHistory(did);
      const router = useRouter();
      const searchParams = useSearchParams();

      const onActivate = useCallback(() => {
        if (!lastRefinedDialogueId) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'firehose');
        params.set('firehose_filter', `dialogue_id:${lastRefinedDialogueId}`);
        router.push(`?${params.toString()}`);
      }, [router, searchParams, lastRefinedDialogueId]);

      if (refinedCount === 0 || !lastRefinedDialogueId) return null;

      const label = refinedCount === 1
        ? '↻ refined via dialogue'
        : `↻ refined via dialogue (${refinedCount})`;
      const ariaLabel = refinedCount === 1
        ? 'Telos refined via peer dialogue — 1 refinement in history. Click to view triggering dialogue in firehose.'
        : `Telos refined via peer dialogue — ${refinedCount} refinements in history. Click to view most recent triggering dialogue in firehose.`;

      return (
        <span data-testid="telos-refined-badge">
          <button
            type="button"
            data-testid="telos-refined-badge-trigger"
            aria-label={ariaLabel}
            title="Refined via peer dialogue. Click to filter firehose by dialogue_id."
            onClick={onActivate}
            className="cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            <Chip label={label} color="dialogue" />
          </button>
        </span>
      );
    }
    ```
    Run `cd dashboard && pnpm test -- telos-refined-badge` — MUST pass all 9 cases.

    **Step 3 (RED — filter chip tests):**
    Create `dashboard/src/app/grid/components/firehose-filter-chip.test.tsx` with the 6 cases. Mock `useFirehoseFilter` via `vi.mock('@/lib/hooks/use-firehose-filter', ...)`. Run — MUST fail (component not found).

    **Step 4 (GREEN — filter chip component):**
    Create `dashboard/src/app/grid/components/firehose-filter-chip.tsx`:
    ```typescript
    'use client';
    /**
     * FirehoseFilterChip — active-filter indicator above the firehose event list.
     *
     * Mounts iff useFirehoseFilter().filter is non-null (currently only when
     * firehose_filter=dialogue_id:<16-hex> is set and passes the regex gate).
     * Screen readers are notified via role="status" aria-live="polite" when the
     * chip mounts.
     *
     * Layout: [dialogue_id: <mono-value>] [×]
     * 07-UI-SPEC §Copywriting (lines 209-218), §Color (border + mono value in
     *  indigo-400 #818CF8 on secondary #17181C background).
     */
    import { useFirehoseFilter } from '@/lib/hooks/use-firehose-filter';

    export function FirehoseFilterChip(): React.ReactElement | null {
      const { filter, clear } = useFirehoseFilter();
      if (filter === null) return null;
      return (
        <div
          data-testid="firehose-filter-chip"
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-full border border-[#818CF8] bg-[#17181C] px-3 py-1 mb-4"
        >
          <span className="text-[14px] text-neutral-200">dialogue_id: </span>
          <span className="font-mono text-[12px] text-[#818CF8]">{filter.value}</span>
          <button
            type="button"
            data-testid="firehose-filter-clear"
            aria-label="Clear dialogue filter. Show all firehose events."
            onClick={clear}
            className="flex h-4 w-4 items-center justify-center rounded text-[14px] leading-none hover:bg-[#23252B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            ×
          </button>
        </div>
      );
    }
    ```
    Run `cd dashboard && pnpm test -- firehose-filter-chip` — MUST pass all 6 cases.

    **Step 5 (REFACTOR + source-invariant checks):**
    - In `telos-refined-badge.test.tsx`, add the two source-invariant `it(...)` cases (plaintext-never + color-scope). Implementation:
      ```typescript
      import { readFileSync, readdirSync, statSync } from 'node:fs';
      import { join, relative } from 'node:path';
      const SRC = readFileSync(join(process.cwd(), 'src/components/dialogue/telos-refined-badge.tsx'), 'utf8');
      it('has no plaintext goal references', () => {
        for (const forbidden of ['new_goals', 'goal_description', 'utterance']) {
          expect(SRC).not.toContain(forbidden);
        }
      });
      // 'priority' check is intentionally omitted — TelosSection sibling uses it
      // for the existing priority chip and could import indirectly.
      ```
    - Also add a cross-file color-scope check using `node:fs` readdirSync recursion (the `glob` package is NOT a dashboard dependency; this is the canonical tooling choice for this scope-scan):
      ```typescript
      // node:fs-based recursive walker — no `glob` dep required.
      // Imported from the 'node:fs' + 'node:path' imports at the top of Step 5.
      function walkTsFiles(dir: string, root: string = dir): string[] {
        const out: string[] = [];
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          const st = statSync(full);
          if (st.isDirectory()) {
            if (entry === 'node_modules' || entry === '.next') continue;
            out.push(...walkTsFiles(full, root));
          } else if (/\.(ts|tsx)$/.test(entry)) {
            // Emit paths relative to the cwd root, forward-slash normalized.
            out.push(relative(root, full).replace(/\\/g, '/'));
          }
        }
        return out;
      }

      it('indigo-400 #818CF8 literal scoped to Phase 7 files only', () => {
        const SRC_ROOT = join(process.cwd(), 'src');
        const files = walkTsFiles(SRC_ROOT).map((f) => `src/${f}`);
        const offenders: string[] = [];
        const allowed = new Set([
          'src/components/primitives/chip.tsx',
          'src/components/dialogue/telos-refined-badge.tsx',
          'src/components/dialogue/telos-refined-badge.test.tsx',
          'src/app/grid/components/firehose-filter-chip.tsx',
          'src/app/grid/components/firehose-filter-chip.test.tsx',
          'src/lib/hooks/use-refined-telos-history.ts',      // not expected, but allowlist doesn't hurt
          'src/lib/hooks/use-refined-telos-history.test.ts',
        ]);
        for (const f of files) {
          if (allowed.has(f)) continue;
          const content = readFileSync(join(process.cwd(), f), 'utf8');
          if (/#818CF8/i.test(content)) offenders.push(f);
        }
        expect(offenders).toEqual([]);
      });
      ```
    - Run full dashboard test suite: `cd dashboard && pnpm test --run` — all green, new tests + all pre-existing.
    - Run `cd dashboard && pnpm tsc --noEmit` — zero errors.
  </action>
  <verify>
    <automated>cd dashboard && pnpm test -- telos-refined-badge firehose-filter-chip --run && pnpm tsc --noEmit</automated>
  </verify>
  <done>
    - 4 new files committed (2 components + 2 tests)
    - TelosRefinedBadge renders NOTHING when refinedCount===0; renders labeled button otherwise
    - Click on badge trigger produces router.push URL containing both `tab=firehose` AND `firehose_filter=dialogue_id:${lastId}`
    - FirehoseFilterChip renders iff useFirehoseFilter returns non-null filter
    - Clear button round-trips filter:null → filter:null via router.push removing only the `firehose_filter` param
    - Source-invariant tests pass: no `new_goals` / `goal_description` / `utterance` in component; `#818CF8` scoped to exactly 7 allowlisted files
    - All locked testids present exactly: `telos-refined-badge`, `telos-refined-badge-trigger`, `firehose-filter-chip`, `firehose-filter-clear`
  </done>
  <acceptance_criteria>
    **AC-4-2-1 (Absent not hidden on zero refinements):** Test case "refinedCount === 0 → queryByTestId returns null" — asserts NO DOM node exists (not display:none, not opacity:0). Matches 07-UI-SPEC §State Contract line 302: "Empty (refinedCount === 0) → Badge not rendered. No placeholder, no 'no refinements yet' copy. Absence is the signal."

    **AC-4-2-2 (Click-through URL contract):** Router.push URL after badge click contains, in some order: `tab=firehose` AND `firehose_filter=dialogue_id:${lastRefinedDialogueId}`. Other pre-existing params (e.g., `focus=<did>`) preserved (assert via a test case that seeds `focus=did:noesis:alice` into searchParams and verifies it survives).

    **AC-4-2-3 (Aria-label exact match):** For refinedCount=1 and refinedCount=3, the `aria-label` on the trigger button is a literal byte-for-byte match against 07-UI-SPEC §Copywriting (lines 202-204). Any drift fails the test. Enforces voice/copy lock per UI-SPEC.

    **AC-4-2-4 (Color-scope invariant, cross-file):** The source-invariant test walks `dashboard/src/**/*.{ts,tsx}` via `node:fs` readdirSync recursion and asserts `#818CF8` appears ONLY in the 7 allowlisted Phase 7 files. Prevents a future executor from accidentally introducing the dialogue color to an unrelated surface (e.g., an operator-tier chip), which would conflate Nous-initiated with operator-forced in the UI.

    **AC-4-2-5 (Plaintext-never at component level):** `telos-refined-badge.tsx` source does not contain the strings `new_goals`, `goal_description`, or `utterance`. PHILOSOPHY §1 invariant enforced all the way down the stack: aggregator (Plan 01) → producer (Plan 03) → hook (Task 1) → component (Task 2).

    **AC-4-2-6 (Focus ring parity):** Both the badge trigger button and the chip clear button use the exact same Phase 6 focus-ring utility classes: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300`. Checker reviews for string literal match with Phase 6 patterns.
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire badge into TelosSection + dim-not-hide row behavior in Firehose + MILESTONES.md update</name>
  <files>
    dashboard/src/app/grid/components/inspector-sections/telos.tsx,
    dashboard/src/app/grid/components/inspector-sections/telos.test.tsx,
    dashboard/src/app/grid/components/inspector.tsx,
    dashboard/src/app/grid/components/firehose.tsx,
    dashboard/src/app/grid/components/firehose.test.tsx,
    dashboard/src/app/grid/components/firehose-row.tsx,
    .planning/MILESTONES.md
  </files>
  <read_first>
    - `dashboard/src/app/grid/components/inspector-sections/telos.tsx:14-59` — current `TelosSectionProps` + heading + goal list JSX (already read in this plan's context above)
    - `dashboard/src/app/grid/components/inspector.tsx` — HOW TelosSection is consumed + what `did` is available at that call site (read to find the `<TelosSection telos=...` line and determine how to thread the new `did` prop)
    - `dashboard/src/app/grid/components/inspector-sections/telos.test.tsx` — existing TelosSection tests (must continue passing)
    - `dashboard/src/app/grid/components/firehose.tsx` (already read above, lines 1-82) — composition point for mounting `<FirehoseFilterChip />` and applying dim-not-hide
    - `dashboard/src/app/grid/components/firehose-row.tsx` — current row rendering; determine where to add the `opacity-40` class conditionally
    - `dashboard/src/app/grid/components/firehose.test.tsx` — existing firehose tests (must continue passing)
    - `07-UI-SPEC.md` §Spacing Scale (lines 106-131) — badge placement = heading-row right via `flex items-center justify-between`, gap-sm (8px); filter-chip placement = above event list with md (16px) padding-bottom
    - `07-UI-SPEC.md` §Interaction Contract "Firehose filter application (dim, not hide)" (lines 258-263) — non-matching rows `opacity-40` + `pointer-events: none` on hover affordances; matching rows `opacity-100`; event text remains selectable
    - `07-UI-SPEC.md` §Testing Contract (lines 335-340) — specific test cases for the extended TelosSection + firehose tests
    - CLAUDE.md Documentation Sync Rule — MILESTONES.md append on phase ship
  </read_first>
  <behavior>
    **TelosSection modification:**
    - New required prop: `did: string | null`
    - Heading row becomes `<div className="flex items-center justify-between mb-2">` containing the existing `<h3>` on the left and `<TelosRefinedBadge did={did} />` on the right
    - Empty-state copy/structure unchanged (still renders the `<EmptyState>` when goals.length === 0) — but heading row + badge still render so an operator sees a refinement badge even if goals are empty (refinement history exists independently of current goals — this is intentional because Brain could have refined a goal list back to empty)
    - Priority chip per-goal rendering unchanged (still neutral Chip, not dialogue color)

    **Inspector.tsx modification:**
    - Pass `did` prop through to `<TelosSection>`. The `did` is the currently-focused Nous's DID — whatever key the inspector already uses to fetch its NousStateResponse. Read inspector.tsx to find the exact variable name (likely `focusedDid` or similar) and thread it through.

    **Firehose modification:**
    - Import `FirehoseFilterChip` and `useFirehoseFilter`
    - After `const snap = useFirehose()`, add `const { filter: dialogueFilter } = useFirehoseFilter()` — note the rename to avoid colliding with `snap.filter` (event-type filter, Phase 3)
    - Mount `<FirehoseFilterChip />` (self-conditional render) AS THE FIRST child of the `<ul>` container wrapper, OR above the `<ul>` inside the firehose panel section but below the header — choose placement that matches 07-UI-SPEC §Spacing Scale "Filter chip placement in firehose" diagram (above the event list, md 16px pb). Concretely: insert it between the `<header>` and the `<ul>`, or inside a new wrapper around the existing conditional-render branches.
    - Pass `dialogueFilter` down to each `<FirehoseRow>` via a new `dialogueFilter` prop (optional, may be null)
    - Filter-matches-zero UX: when `dialogueFilter !== null` AND NO row in `visible` has a matching `triggered_by_dialogue_id`, render the empty-match heading `No matching events for dialogue_id ${dialogueFilter.value}. Press × to clear.` (per 07-UI-SPEC §Copywriting Contract lines 228-234). Rows are still dimmed (not removed) — but if the rendered list is literally empty because none match, show the override heading.
    - **Do not remove** the existing Phase 3 event-type filter UI or behavior — this is additive.

    **FirehoseRow modification:**
    - Add optional prop: `dialogueFilter: { key: 'dialogue_id', value: string } | null`
    - When `dialogueFilter` is non-null:
      - Row is a "match" iff `entry.eventType === 'telos.refined' && entry.payload.triggered_by_dialogue_id === dialogueFilter.value` OR iff `entry.payload?.dialogue_id === dialogueFilter.value` (if other events ever carry `dialogue_id` — currently only `telos.refined` does, but leaving the door open for future `nous.spoke` if Phase 7+ adds `dialogue_id` to spoke events — for now, the conservative match is on `triggered_by_dialogue_id` ONLY)
      - Actually the rule per 07-UI-SPEC is: "row with matching `triggered_by_dialogue_id` in payload" (line 337). Use only that check.
      - Non-match: add className `opacity-40 pointer-events-none` (the pointer-events-none scoped only to hover affordances — if the row has no hover affordances this is a no-op, which is fine)
      - Match: full opacity (no added class)
    - When `dialogueFilter` is null: row renders identical to pre-Phase-7 (zero-diff)

    **Test additions:**

    *inspector-sections/telos.test.tsx — extended (≥ 3 new cases):*
    1. TelosSection with `did='did:noesis:alice'` and mocked `useRefinedTelosHistory` returning `refinedCount:2` → badge testid present at panel level (i.e., NOT inside any `[data-testid^='goal-']` element). Use `getByTestId('telos-refined-badge')`, then assert `getByTestId('section-telos').contains(badge)` but `getAllByTestId(/^goal-/).every(g => !g.contains(badge))`.
    2. TelosSection with `did=null` → `queryByTestId('telos-refined-badge')` returns null.
    3. Existing empty-state test (`goals: []` → "No active goals. Telos is quiescent.") still passes unchanged — the new heading row + absent badge do not disrupt it.

    *firehose.test.tsx — extended (≥ 3 new cases):*
    4. Filter active (`useFirehoseFilter` mocked to return `filter={key:'dialogue_id',value:'a1b2c3d4e5f6a7b8'}`), stream has 2 rows: one `telos.refined` with `triggered_by_dialogue_id='a1b2c3d4e5f6a7b8'` and one `nous.spoke` with unrelated content. Assert matching row rendered without `opacity-40`; non-matching row rendered with `opacity-40` class.
    5. Filter active, zero rows match → empty-match heading "No matching events for dialogue_id ..." rendered; `<FirehoseFilterChip>` still mounted.
    6. Filter null (no `firehose_filter` param) → rows render UNMODIFIED (no `opacity-40`); `<FirehoseFilterChip>` not mounted; pre-existing Firehose behavior unchanged.
  </behavior>
  <action>
    **Step 1 (RED — TelosSection extended tests):**
    Edit `dashboard/src/app/grid/components/inspector-sections/telos.test.tsx`. Add 2 new `it(...)` cases (panel-level badge present + null did absent). Mock `useRefinedTelosHistory` via `vi.mock('@/lib/hooks/use-refined-telos-history', ...)`. Mock `next/navigation` so the nested badge's router.push test path doesn't explode. Run `cd dashboard && pnpm test -- inspector-sections/telos` — MUST fail (new props not accepted, TypeScript error on `<TelosSection did=... />` call).

    **Step 2 (GREEN — TelosSection + Inspector wire-through):**
    Edit `dashboard/src/app/grid/components/inspector-sections/telos.tsx`:
    ```typescript
    'use client';
    /**
     * TelosSection — active goals list + Phase 7 panel-level refinement badge.
     *
     * Phase 7 adds a `did` prop plumbed from Inspector so the section can render
     * <TelosRefinedBadge did={did} /> at the heading-row right. Badge is absent
     * (no DOM) when refinedCount === 0 — 07-UI-SPEC §State Contract line 302.
     * Empty goals list + badge coexist: refinement history is independent of
     * the current goal set.
     */
    import { Chip, EmptyState } from '@/components/primitives';
    import { TelosRefinedBadge } from '@/components/dialogue/telos-refined-badge';
    import type { NousStateResponse } from '@/lib/api/introspect';

    export interface TelosSectionProps {
      readonly telos: NousStateResponse['telos'];
      readonly did: string | null;
    }

    export function TelosSection({ telos, did }: TelosSectionProps): React.ReactElement {
      const goals = telos.active_goals;
      return (
        <section data-testid="section-telos" aria-labelledby="section-telos-title" className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 id="section-telos-title" className="text-sm font-semibold text-neutral-100">
              Telos
            </h3>
            <TelosRefinedBadge did={did} />
          </div>
          {goals.length === 0 ? (
            <EmptyState title="No active goals. Telos is quiescent." testId="empty-telos" />
          ) : (
            <ul className="flex flex-col gap-1">
              {goals.map((goal) => (
                <li
                  key={goal.id}
                  data-testid={`goal-${goal.id}`}
                  className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                >
                  <span className="flex-1 text-xs text-neutral-200">{goal.description}</span>
                  <Chip label={`priority ${goal.priority.toFixed(2)}`} testId={`priority-${goal.id}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }
    ```
    Edit `dashboard/src/app/grid/components/inspector.tsx`: locate the `<TelosSection telos={...}` call. Pass `did={<whateverVarHoldsTheFocusedDid>}` (determine from reading inspector.tsx — likely `focusedDid`, `selectedDid`, or similar; if ambiguous, add a top-of-file comment `// Phase 7: pipe focused DID to TelosSection so refinement badge can filter firehose by owner`). Run `cd dashboard && pnpm test -- inspector-sections/telos inspector` — MUST pass.

    **Step 3 (RED — Firehose extended tests):**
    Edit `dashboard/src/app/grid/components/firehose.test.tsx`. Add 3 new `it(...)` cases. Mock `useFirehoseFilter` + `useFirehose`. Run `cd dashboard && pnpm test -- firehose` — MUST fail (component doesn't accept filter yet, rows don't dim).

    **Step 4 (GREEN — Firehose + FirehoseRow):**
    Edit `dashboard/src/app/grid/components/firehose.tsx`:
    - Add imports: `import { useFirehoseFilter } from '@/lib/hooks/use-firehose-filter';` and `import { FirehoseFilterChip } from './firehose-filter-chip';`
    - Inside component: `const { filter: dialogueFilter } = useFirehoseFilter();`
    - Before the main conditional render, render `<FirehoseFilterChip />` (it is self-conditional — renders null when filter is null). Place it between `<header>...</header>` and the main content branch.
    - Pass `dialogueFilter={dialogueFilter}` to each `<FirehoseRow>` call.
    - In the match-zero case (when `dialogueFilter !== null` and no `visible` entry's `telos.refined` payload `triggered_by_dialogue_id` equals `dialogueFilter.value`), render the empty-match heading "No matching events for dialogue_id ${dialogueFilter.value}. Press × to clear." — reuse the existing empty-state DIV shape but with the new text, conditionally branching inside the existing `visible.length === 0` branch OR as a sibling check (cleaner: compute `hasMatch = dialogueFilter ? visible.some(...) : true` and render the empty-match heading when `!hasMatch`).

    Edit `dashboard/src/app/grid/components/firehose-row.tsx`:
    - Add optional prop `dialogueFilter?: { key: 'dialogue_id'; value: string } | null` to the row props type.
    - Compute `const isMatch = dialogueFilter === null || dialogueFilter === undefined || (entry.eventType === 'telos.refined' && typeof entry.payload === 'object' && entry.payload !== null && (entry.payload as { triggered_by_dialogue_id?: string }).triggered_by_dialogue_id === dialogueFilter.value);`
    - Add `className={isMatch ? '' : 'opacity-40 pointer-events-none'}` (merge with existing className)

    Run `cd dashboard && pnpm test -- firehose` — MUST pass all extended cases + all pre-existing cases.

    **Step 5 (REFACTOR + MILESTONES.md):**
    Run full dashboard suite: `cd dashboard && pnpm test --run` — all green.
    Run `cd dashboard && pnpm tsc --noEmit` — zero errors.
    Run `make test` from repo root — Grid + Brain + Dashboard all green.

    Update `.planning/MILESTONES.md` (per CLAUDE.md Documentation Sync Rule — phase-ship trigger): append a new entry under the appropriate milestone heading (v2.1, Sprint 15 or whatever the current sprint label is — read the file first to match the existing format). Entry shape:
    ```markdown
    ### Phase 7 — Peer Dialogue → Telos Refinement (shipped YYYY-MM-DD)

    Closed DIALOG-01/02/03. Added:
    - Grid-side `DialogueAggregator` + `dialogue_context` tick-param widening (Plan 01)
    - Brain `ActionType.TELOS_REFINED` + `_build_refined_telos` heuristic (Plan 02, clones Phase 6 `force_telos` hash-before/hash-after ordering)
    - Allowlist grew 16 → 17; sole producer boundary `appendTelosRefined`; NousRunner `case 'telos_refined'` with `recentDialogueIds` authority check (Plan 03)
    - Inspector panel-level `↻ refined via dialogue` badge; `useRefinedTelosHistory` derived selector (zero new RPC); `firehose_filter=dialogue_id:<16-hex>` dim-not-hide filter (Plan 04)

    **Invariants preserved:** zero-diff determinism (grid/test/dialogue/zero-diff.test.ts), hash-only cross-boundary, plaintext `new_goals` never leaves Brain, allowlist position-stability, `telos.refined` sole producer boundary.

    **STRIDE mitigations shipped:** 34 threats across 4 plans — see each plan's `<threat_model>` register.
    ```
    (Adjust the date + details to match what actually shipped.)

    Verify MILESTONES.md edit: `cd /Users/desirey/Programming/src/Noēsis && git diff .planning/MILESTONES.md | head -40` shows the append.
  </action>
  <verify>
    <automated>cd dashboard && pnpm test -- inspector-sections/telos firehose --run && pnpm tsc --noEmit && cd /Users/desirey/Programming/src/Noēsis && make test</automated>
  </verify>
  <done>
    - TelosSection takes `did` prop; badge rendered at panel level (heading-row right); existing empty-state unchanged
    - Inspector threads focused-Nous did to TelosSection
    - Firehose mounts FirehoseFilterChip when filter active; rows dim-not-hide when not matching; empty-match heading when zero matches
    - FirehoseRow accepts `dialogueFilter` prop; `opacity-40 pointer-events-none` applied only to non-match rows when filter active; zero-diff when filter null
    - MILESTONES.md updated per CLAUDE.md Documentation Sync Rule (phase-ship trigger)
    - Full dashboard suite green; TypeScript clean; `make test` green end-to-end across Grid + Brain + Dashboard
  </done>
  <acceptance_criteria>
    **AC-4-3-1 (Panel-level badge placement):** The test `getAllByTestId(/^goal-/).every(g => !g.contains(badge))` passes, AND `getByTestId('section-telos').contains(badge)` passes. Badge is INSIDE the section but OUTSIDE any `<li data-testid="goal-...">`. Matches D-27, D-30, and 07-UI-SPEC §Spacing Scale "Badge placement in TelosSection heading row".

    **AC-4-3-2 (Empty-goals-but-refined coexistence):** TelosSection with `goals:[]` AND `refinedCount:2` renders BOTH the `EmptyState` ("No active goals. Telos is quiescent.") AND the badge. Refinement history is independent of current goal set. Add an explicit test case.

    **AC-4-3-3 (Dim not hide preserves debugging context):** Test case "filter active + one matching + one non-matching" asserts BOTH rows are present in the DOM (both `<li>` nodes exist in `firehose-list`). Only the non-matching row has `opacity-40`. The firehose is a debugger's surface; hiding would break temporal context — this test locks the dim-not-hide invariant.

    **AC-4-3-4 (Zero-diff when filter null):** Test case "filter null → rows render unmodified" asserts NO row has the `opacity-40` class. Rendered DOM is BYTE-IDENTICAL to pre-Phase-7 firehose rendering when no filter is active. Regression guard: Phase 7 must not leak dim-styling into the unfiltered path.

    **AC-4-3-5 (Doc-sync on phase ship per CLAUDE.md):** `git diff .planning/MILESTONES.md` contains the Phase 7 entry with the six required elements: (a) phase number + slug, (b) ship date, (c) enumerated plans 01-04, (d) invariants preserved list, (e) STRIDE threat count summary, (f) closes DIALOG-01/02/03 requirements. MILESTONES.md is the public record of what shipped; the entry must be readable as a standalone history record.

    **AC-4-3-6 (End-to-end green):** `make test` exits 0 from the repo root. This is the final gate before /gsd-verify-work. Grid + Brain + Dashboard all pass; `grid/test/dialogue/zero-diff.test.ts` (determinism gate) still green; no regression anywhere in the stack.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Firehose WS → dashboard hook | Untrusted audit payloads cross from Grid runtime to React client. Payload.triggered_by_dialogue_id, payload.after_goal_hash, payload.did all require regex/shape validation before use in URL construction, state mutation, or DOM text. |
| URL query param → React state | `firehose_filter` query string is fully attacker-controllable via bookmarks, shared links, or path manipulation. Must not execute, must not poison client state, must not display as HTML. |
| React component → router.push | Any unchecked string concatenation into `router.push(...)` is an open redirect / URL-injection vector. All values going into the URL must be regex-gated at construction time. |
| Badge click → operator navigation | Operator trusts the badge click to move them to the relevant firehose slice. If badge lies (wrong dialogue_id) operator draws wrong conclusions about a Nous's behavior. Integrity matters. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-40 | Spoofing | `useRefinedTelosHistory` vs. injected `telos.refined` with `did` impersonation | mitigate | Hook filters on `payload.did === targetDid` exactly; combined with the producer-side self-report invariant (Plan 03 Task 1, `payload.did === actorDid`), impersonation requires a compromised Grid AuditChain — out of dashboard scope |
| T-07-41 | Tampering | Malformed `triggered_by_dialogue_id` (non-16-hex) injected into firehose | mitigate | `DIALOGUE_ID_RE = /^[0-9a-f]{16}$/` in Task 1 hook silently drops the entry; malformed id never reaches `lastRefinedDialogueId` or the URL |
| T-07-42 | Tampering | Malformed `after_goal_hash` (non-64-hex) injected | mitigate | `HEX64_RE` check in `isValidPayload`; drops the entry |
| T-07-43 | Tampering | URL param `firehose_filter=dialogue_id:<non-hex>` from bookmark/paste | mitigate | `useFirehoseFilter` regex-gates the value; returns `filter: null` on mismatch; chip does not mount and no filter applied |
| T-07-44 | Tampering | URL param `firehose_filter=<unknown_key>:...` from future key that doesn't exist yet | mitigate | Hook whitelist: only `dialogue_id` recognized; unknown keys return `filter: null` (future-proof — adding `goal_hash:` later is additive, not breaking) |
| T-07-45 | Repudiation | Operator clicks badge; denies intent | accept | Badge click writes to URL via router.push → reflected in browser history. Non-audit surface; no repudiation risk in the Grid audit chain |
| T-07-46 | Information Disclosure | Plaintext `new_goals` leaks into dashboard via component render of payload | mitigate | Grep-based source-invariant test in Task 2 asserts `new_goals`, `goal_description`, `utterance` strings do NOT appear in `telos-refined-badge.tsx`; Task 1 hook drops non-whitelisted payload fields before they reach React state |
| T-07-47 | Information Disclosure | Goal priority leaks via inspected payload in React DevTools | accept | React DevTools is a dev-tool; `payload` is not stored in hook state (only derived summary); production exposure negligible. Operator has local Grid access anyway. |
| T-07-48 | Information Disclosure | Dialogue_id in URL leaks via server access logs / referer headers to third parties | mitigate | Dialogue_id is a 16-hex digest, not content. Leaks a "that two specific Nouses had a dialogue at tick T" fact but no content. Accepted per PHILOSOPHY §1 (hash-only boundary is the contract) |
| T-07-49 | Denial of Service | Attacker-crafted URL with `firehose_filter=dialogue_id:<valid-but-nonexistent>` causes "zero matching rows" state, operator can't see events | mitigate | Empty-match heading "Press × to clear." (07-UI-SPEC §Copywriting) tells the operator how to recover; clear button is keyboard-accessible |
| T-07-50 | Denial of Service | Firehose saturated with malformed `telos.refined` events — hook does O(n) filter on every render | mitigate | `useMemo` keyed on `[did, snap.entries]` — re-derives only when firehose entries change. Firehose ring buffer capped at 500 (Phase 3 cap); worst case 500 regex checks per render batch; sub-millisecond in practice |
| T-07-51 | Denial of Service | Infinite-render loop if `useMemo` deps are not referentially stable | mitigate | `snap.entries` is a stable array reference from `FirehoseStore` (Phase 3 contract); dep array `[did, snap.entries]` reliably invalidates only on new events or did change. Reference-stability test case in Task 1 asserts this. |
| T-07-52 | Elevation of Privilege | Badge click navigates to a URL that triggers privileged action (e.g., `?admin=1`) | mitigate | Badge click constructs URL via `new URLSearchParams(searchParams.toString())` — preserves existing params as-is, sets only `tab=firehose` and `firehose_filter=...`. No attacker-controlled path component, no new privileged param injected |
| T-07-53 | Elevation of Privilege | Operator confuses Nous-initiated refinement badge with an operator-forced action chip | mitigate | Indigo-400 `#818CF8` palette choice (07-UI-SPEC §Color, lines 164-176) deliberately avoids the H2/H3/H4 tier palette; label "refined via dialogue" explicitly names the initiator (Brain, not operator); aria-label reiterates "via peer dialogue" |
| T-07-54 | Tampering | Future UI developer adds `#818CF8` to a non-Phase-7 surface, conflating dialogue-refinement with other states | mitigate | Cross-file grep source-invariant test in Task 2 walks `dashboard/src/**/*.{ts,tsx}` via `node:fs` readdirSync recursion, asserts `#818CF8` appears ONLY in 7 allowlisted files — test fails on any drift |
</threat_model>

<verification>
Per-plan verification (per-task automated commands run within each task). Overall plan verification:

**Component behavior (Vitest, ~15s):**
```bash
cd dashboard && pnpm test -- primitives.test use-firehose-filter use-refined-telos-history telos-refined-badge firehose-filter-chip inspector-sections/telos firehose --run
```

**TypeScript soundness:**
```bash
cd dashboard && pnpm tsc --noEmit
```

**End-to-end determinism gate (reuses Wave 0 infrastructure):**
```bash
cd /Users/desirey/Programming/src/Noēsis && make test
# Runs Grid + Brain + Dashboard; grid/test/dialogue/zero-diff.test.ts (determinism invariant) MUST be green
```

**Source invariants (enforced inside Task 2 tests):**
- Plaintext-never: no `new_goals`, `goal_description`, `utterance` in `telos-refined-badge.tsx`
- Color-scope: `#818CF8` appears only in 7 allowlisted Phase 7 files (walker uses `node:fs` readdirSync — no `glob` dep)
- Testid lock: snapshot check for the four locked testids (`telos-refined-badge`, `telos-refined-badge-trigger`, `firehose-filter-chip`, `firehose-filter-clear`)
</verification>

<success_criteria>
DIALOG-03 closed per REQUIREMENTS.md. All of the following testable:
1. Operator selects a Nous in the Inspector; if that Nous has any `telos.refined` event in the firehose, a `↻ refined via dialogue` (or `↻ refined via dialogue (N)`) chip appears at panel-level on the TelosSection
2. Clicking the badge navigates to `/grid?tab=firehose&firehose_filter=dialogue_id:<most-recent>` — preserving any existing query params
3. On that filtered firehose view, a `dialogue_id: <mono-value>` chip is mounted above the event list; matching rows render at full opacity; non-matching rows dim to `opacity-40`
4. Clicking `×` on the filter chip clears the `firehose_filter` param and restores all rows to full opacity
5. `refinedCount === 0` → badge absent (no DOM node) — verified by test
6. Malformed `firehose_filter` values (non-16-hex) → chip not mounted, filter not applied — verified by test
7. Malformed `telos.refined` events on the wire silently dropped at hook boundary — verified by test
8. Plaintext `new_goals` / `goal_description` / `utterance` NEVER reach the dashboard — verified by source-invariant grep test
9. Indigo-400 `#818CF8` appears ONLY in the 7 allowlisted Phase 7 files — verified by cross-file grep test (node:fs walker, no `glob` dep)
10. `make test` exits 0 — full repo green end-to-end
11. `.planning/MILESTONES.md` contains the Phase 7 ship entry per CLAUDE.md Doc Sync Rule
</success_criteria>

<output>
After completion, create `.planning/phases/07-peer-dialogue-telos-refinement/07-04-SUMMARY.md` documenting:
- New files created (4 production + 4 tests)
- Modified files (Chip primitive + TelosSection + Inspector + Firehose + FirehoseRow + existing tests)
- Test counts added per file
- MILESTONES.md append confirmation
- Full `make test` result + any Playwright smoke-test outcomes (if run)
- STRIDE threats T-07-40..T-07-54 dispositions confirmed in implementation
</output>
