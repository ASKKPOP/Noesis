---
phase: 10a-ananke-drives-inner-life-part-1
plan: 05
type: execute
wave: 3
depends_on: [10a-04]
files_modified:
  - dashboard/src/lib/protocol/ananke-types.ts
  - dashboard/src/lib/hooks/use-ananke-levels.ts
  - dashboard/src/app/grid/components/inspector-sections/ananke.tsx
  - dashboard/src/app/grid/components/inspector.tsx
  - dashboard/src/app/grid/components/inspector-sections/ananke.test.tsx
  - dashboard/src/lib/hooks/use-ananke-levels.test.ts
  - dashboard/test/lib/ananke-types.drift.test.ts
  - dashboard/test/privacy/drive-forbidden-keys-dashboard.test.ts
autonomous: true
requirements: [DRIVE-05]
schema_push: not_applicable
user_setup: []

must_haves:
  truths:
    - "Inspector Overview tab renders an AnankeSection between ThymosSection and TelosSection"
    - "The panel renders five rows in locked order: hunger, curiosity, safety, boredom, loneliness"
    - "Each row encodes level via BOTH a colored dot AND the level enum text (color-not-sole-channel)"
    - "No numeric drive value appears in any visible DOM text, title attribute, aria-label, or data-* attribute"
    - "On first-paint for a DID with no prior crossings, each row shows its DRIVE_BASELINE_LEVEL value and no direction arrow"
    - "When a new ananke.drive_crossed audit entry lands, the matching row updates level + color + direction arrow with no animation"
    - "45-state aria-label matrix is fully covered (5 drives × 3 levels × 3 directions: rising/falling/stable) — each has the exact string template from UI-SPEC"
    - "Drift-detector test reads brain/src/noesis_brain/ananke/config.py and fails if DRIVE_BASELINES changes without updating dashboard mirror"
  artifacts:
    - path: dashboard/src/lib/protocol/ananke-types.ts
      provides: "SYNC-header TypeScript mirror of Brain ananke enums + DRIVE_BASELINE_LEVEL map"
      min_lines: 40
    - path: dashboard/src/lib/hooks/use-ananke-levels.ts
      provides: "Hook that reads ananke.drive_crossed entries from the audit store and returns Map<drive, {level, direction}>"
      min_lines: 50
    - path: dashboard/src/app/grid/components/inspector-sections/ananke.tsx
      provides: "AnankeSection component: 5-row Drives panel with Unicode glyphs + colored dots + aria matrix"
      min_lines: 80
    - path: dashboard/src/app/grid/components/inspector.tsx
      provides: "Overview tab mounts <AnankeSection did={did}/> between Thymos and Telos"
      contains: "AnankeSection"
    - path: dashboard/src/app/grid/components/inspector-sections/ananke.test.tsx
      provides: "45-state aria matrix + baseline first-paint + transition + ordering tests"
      min_lines: 120
    - path: dashboard/test/lib/ananke-types.drift.test.ts
      provides: "Drift detector — reads brain/.../config.py, asserts dashboard mirror matches"
      min_lines: 40
    - path: dashboard/test/privacy/drive-forbidden-keys-dashboard.test.ts
      provides: "Dashboard privacy grep — DRIVE_FORBIDDEN_KEYS absent from rendered DOM attributes + fetchNousState() shape"
      min_lines: 30
  key_links:
    - from: dashboard/src/app/grid/components/inspector-sections/ananke.tsx
      to: dashboard/src/lib/hooks/use-ananke-levels.ts
      via: "component calls useAnankeLevels(did) to get the level map"
      pattern: "useAnankeLevels"
    - from: dashboard/src/lib/hooks/use-ananke-levels.ts
      to: dashboard/src/lib/protocol/ananke-types.ts
      via: "hook imports DRIVE_BASELINE_LEVEL for fallback when no crossings have landed"
      pattern: "DRIVE_BASELINE_LEVEL"
    - from: dashboard/src/app/grid/components/inspector.tsx
      to: dashboard/src/app/grid/components/inspector-sections/ananke.tsx
      via: "one-line JSX insertion between ThymosSection and TelosSection"
      pattern: "<AnankeSection"
---

<objective>
Ship the Dashboard Drives panel — a single new section inside the Inspector Overview tab rendering 5 drive rows × 3 levels × direction indicator as Unicode glyphs + color, per the exact 10a-UI-SPEC.md contract. Depends on Plan 10a-04 (audit entries flow to dashboard via the existing broadcast stream).

Purpose: DRIVE-05 render-surface enforcement (no numeric drive value in DOM) + the visible operator-facing artifact the phase ships. Every UI contract item from 10a-UI-SPEC.md is bound literally (glyphs, palette, aria matrix, spacing, typography, copy).

Output: 4 source files + 4 test files. `cd dashboard && pnpm test` passes with ≥ 60 new passing test cases.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-UI-SPEC.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-CONTEXT.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-RESEARCH.md
@.planning/REQUIREMENTS.md
@dashboard/src/app/grid/components/inspector.tsx
@dashboard/src/app/grid/components/inspector-sections/psyche.tsx
@dashboard/src/app/grid/components/inspector-sections/thymos.tsx
@dashboard/src/app/grid/components/inspector-sections/telos.tsx
@dashboard/src/app/grid/components/inspector-sections/relationships.tsx
@dashboard/src/lib/protocol/agency-types.ts
@dashboard/src/lib/hooks/use-refined-telos-history.ts

<locked_decisions_and_spec>
Every item below is a VERBATIM quote from `10a-UI-SPEC.md`. Do not deviate.

**Component path:** `dashboard/src/app/grid/components/inspector-sections/ananke.tsx` — NEW, clones `psyche.tsx` + `relationships.tsx` (H1 branch) shape.

**Mount position:** Between `<ThymosSection>` and `<TelosSection>` in the Overview tabpanel.

**Drive order (LOCKED):** `DRIVE_ORDER = ['hunger', 'curiosity', 'safety', 'boredom', 'loneliness']`. Never reorder by recency.

**Drive glyph matrix (LOCKED):**
| Drive | Glyph | Code point |
|-------|-------|-----------|
| hunger | ⊘ | U+2298 (CIRCLED DIVISION SLASH) |
| curiosity | ✦ | U+2726 (BLACK FOUR POINTED STAR) |
| safety | ◆ | U+25C6 (BLACK DIAMOND) |
| boredom | ◯ | U+25EF (LARGE CIRCLE) |
| loneliness | ❍ | U+274D (SHADOWED WHITE CIRCLE) |

**Level palette (LOCKED):**
| Level | dotClass | textClass |
|-------|----------|-----------|
| low | `bg-neutral-400` | `text-neutral-400` |
| med | `bg-amber-400` | `text-amber-400` |
| high | `bg-rose-400` | `text-rose-400` |

**Direction glyph (LOCKED):** `DIRECTION_GLYPH = {rising: '↑', falling: '↓'}`. Stable = no glyph.

**Baseline mirror (LOCKED per UI-SPEC §Baseline):**
```ts
export const DRIVE_BASELINE_LEVEL: Record<DriveName, DriveLevel> = {
    hunger: 'low',      // baseline 0.3 bucketed: 0.3 < 0.35 → low
    curiosity: 'med',   // baseline 0.5 bucketed: 0.5 in [0.35, 0.68] → med
    safety: 'low',      // baseline 0.2 bucketed: 0.2 < 0.35 → low
    boredom: 'med',     // baseline 0.4 bucketed: 0.4 in [0.35, 0.68] → med
    loneliness: 'med',  // baseline 0.4 bucketed: 0.4 in [0.35, 0.68] → med
};
```

**aria-label template (LOCKED):** `{drive} level {level}` OR `{drive} level {level}, {direction}` if direction present. No other variants allowed. 45-state matrix (15 per drive × 5 drives).

**Testid contract (LOCKED):**
- Section: `data-testid="section-ananke"`
- Row: `data-testid="drive-row-{drive}"`, plus `data-drive={drive}` `data-level={level}` `data-direction={direction ?? 'stable'}`
- Dot: `data-testid="drive-dot-{drive}"` with `aria-hidden="true"`
- Glyph: `data-testid="drive-glyph-{drive}"` with `aria-hidden="true"`
- Level text: `data-testid="drive-level-{drive}"` with the aria-label
- Direction arrow: `data-testid="drive-direction-{drive}"` with `aria-hidden="true"`

**Source-of-truth:** reads from the existing audit/firehose store (same pattern as Phase 9 `use-refined-telos-history`). NO new HTTP fetch, NO new RPC client. NO addition to `NousStateResponse`.

**No animations. No timers. No loading/error/empty states.**
</locked_decisions_and_spec>

<analog_sources>
**PRIMARY SECTION CLONE:** `dashboard/src/app/grid/components/inspector-sections/psyche.tsx` for the section shell (`<section data-testid="..." aria-labelledby="...">`, `<h3>` title), `relationships.tsx` (specifically the H1 warmth branch) for the list-of-rows idiom.

**HOOK CLONE:** `dashboard/src/lib/hooks/use-refined-telos-history.ts` — firehose-derived hook pattern. Cloned shape: subscribe to audit buffer, filter by actorDid + type, maintain a local map keyed by (drive), fall back to baseline when empty.

**MIRROR CLONE:** `dashboard/src/lib/protocol/agency-types.ts` — THE canonical SYNC-header mirror file. Clone the `// SYNC: mirrors grid/src/...` comment style, the drift-detector test pattern, and the `as const` + derived-type idiom.

**INSPECTOR MOUNT:** `dashboard/src/app/grid/components/inspector.tsx` — the existing file. The edit is ONE added JSX line in the Overview tabpanel.
</analog_sources>

<interfaces>
```typescript
// dashboard/src/lib/protocol/ananke-types.ts
// SYNC: mirrors brain/src/noesis_brain/ananke/types.py and config.py
// SYNC: mirrors grid/src/ananke/types.ts
// Drift is detected by dashboard/test/lib/ananke-types.drift.test.ts
// which reads the Python source and fails if the enum or baseline values diverge.

export const DRIVE_ORDER = ['hunger', 'curiosity', 'safety', 'boredom', 'loneliness'] as const;
export type DriveName = typeof DRIVE_ORDER[number];

export const DRIVE_LEVELS = ['low', 'med', 'high'] as const;
export type DriveLevel = typeof DRIVE_LEVELS[number];

export const DRIVE_DIRECTIONS = ['rising', 'falling'] as const;
export type DriveDirection = typeof DRIVE_DIRECTIONS[number];

// Mirrors Brain's DRIVE_BASELINES float → bucket() result.
// Baseline floats (hunger=0.3, curiosity=0.5, safety=0.2, boredom=0.4, loneliness=0.4)
// NEVER enter this file — only the bucketed enum.
export const DRIVE_BASELINE_LEVEL: Record<DriveName, DriveLevel> = {
    hunger: 'low',
    curiosity: 'med',
    safety: 'low',
    boredom: 'med',
    loneliness: 'med',
};

export interface AnankeLevelEntry {
    readonly level: DriveLevel;
    readonly direction: DriveDirection | null;  // null = stable (no glyph)
}

// Closed-tuple payload shape mirrored from Grid for audit-entry typing.
export interface AnankeDriveCrossedPayload {
    readonly did: string;
    readonly tick: number;
    readonly drive: DriveName;
    readonly level: DriveLevel;
    readonly direction: DriveDirection;
}
```

```typescript
// dashboard/src/lib/hooks/use-ananke-levels.ts

import { useMemo } from 'react';
import { useAuditStore } from '../audit/store.js'; // exact path TBD by executor — matches use-refined-telos-history import
import {
    DRIVE_ORDER, DRIVE_BASELINE_LEVEL,
    type DriveName, type AnankeLevelEntry, type AnankeDriveCrossedPayload,
} from '../protocol/ananke-types.js';

/**
 * Reads the audit buffer for `ananke.drive_crossed` entries addressed to `did`,
 * returns a Map<drive, {level, direction}>. Drives with no crossings fall back
 * to DRIVE_BASELINE_LEVEL with direction=null.
 *
 * Purely derived — no wall-clock, no timers, no fetch.
 */
export function useAnankeLevels(did: string | null): Map<DriveName, AnankeLevelEntry> {
    const entries = useAuditStore((s) => s.entries); // or whatever the existing selector is
    return useMemo(() => {
        const map = new Map<DriveName, AnankeLevelEntry>();
        // Initialize with baseline for all drives (deterministic first-paint).
        for (const drive of DRIVE_ORDER) {
            map.set(drive, { level: DRIVE_BASELINE_LEVEL[drive], direction: null });
        }
        if (!did) return map;

        // Walk entries in chronological order, overwriting the last crossing per drive.
        // (For performance on large buffers the executor may reverse-iterate and take
        // first-found-per-drive — either is correct; the test asserts the same final state.)
        for (const entry of entries) {
            if (entry.type !== 'ananke.drive_crossed') continue;
            if (entry.actorDid !== did) continue;
            const payload = entry.payload as AnankeDriveCrossedPayload;
            map.set(payload.drive, {
                level: payload.level,
                direction: payload.direction,
            });
        }
        return map;
    }, [entries, did]);
}
```

```tsx
// dashboard/src/app/grid/components/inspector-sections/ananke.tsx

import { useAnankeLevels } from '../../../../lib/hooks/use-ananke-levels.js';
import { DRIVE_ORDER, type DriveName, type DriveLevel } from '../../../../lib/protocol/ananke-types.js';

// Drive glyph map — LOCKED per 10a-UI-SPEC §Drive Glyph Matrix.
const DRIVE_GLYPH: Record<DriveName, string> = {
    hunger: '\u2298',       // ⊘ CIRCLED DIVISION SLASH
    curiosity: '\u2726',    // ✦ BLACK FOUR POINTED STAR
    safety: '\u25C6',       // ◆ BLACK DIAMOND
    boredom: '\u25EF',      // ◯ LARGE CIRCLE
    loneliness: '\u274D',   // ❍ SHADOWED WHITE CIRCLE
};

// Level style map — LOCKED per 10a-UI-SPEC §Level Bucket Color Encoding.
const LEVEL_STYLE: Record<DriveLevel, { dotClass: string; textClass: string }> = {
    low:  { dotClass: 'bg-neutral-400', textClass: 'text-neutral-400' },
    med:  { dotClass: 'bg-amber-400',   textClass: 'text-amber-400' },
    high: { dotClass: 'bg-rose-400',    textClass: 'text-rose-400' },
};

const DIRECTION_GLYPH = { rising: '\u2191', falling: '\u2193' } as const; // ↑ ↓

export function AnankeSection({ did }: { did: string | null }) {
    const levels = useAnankeLevels(did);
    return (
        <section
            data-testid="section-ananke"
            aria-labelledby="section-ananke-title"
            className="mb-4"
        >
            <h3
                id="section-ananke-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Drives
            </h3>
            <ul role="list" aria-label="Current drive pressure levels" className="flex flex-col gap-1">
                {DRIVE_ORDER.map((drive) => {
                    const entry = levels.get(drive)!;
                    const { level, direction } = entry;
                    const ariaLabel = direction
                        ? `${drive} level ${level}, ${direction}`
                        : `${drive} level ${level}`;
                    return (
                        <li
                            key={drive}
                            data-testid={`drive-row-${drive}`}
                            data-drive={drive}
                            data-level={level}
                            data-direction={direction ?? 'stable'}
                            className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                        >
                            <span
                                data-testid={`drive-dot-${drive}`}
                                aria-hidden="true"
                                className={`inline-block h-2 w-2 rounded-full ${LEVEL_STYLE[level].dotClass}`}
                            />
                            <span
                                data-testid={`drive-glyph-${drive}`}
                                aria-hidden="true"
                                className="text-sm leading-none text-neutral-200"
                            >
                                {DRIVE_GLYPH[drive]}
                            </span>
                            <span className="flex-1 text-xs text-neutral-200">{drive}</span>
                            <span
                                data-testid={`drive-level-${drive}`}
                                className={`text-xs ${LEVEL_STYLE[level].textClass}`}
                                aria-label={ariaLabel}
                            >
                                {level}
                            </span>
                            {direction && (
                                <span
                                    data-testid={`drive-direction-${drive}`}
                                    aria-hidden="true"
                                    className={`text-xs tabular-nums ${LEVEL_STYLE[level].textClass}`}
                                >
                                    {DIRECTION_GLYPH[direction]}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create ananke-types.ts SYNC mirror + use-ananke-levels hook + drift detector</name>
  <files>
    dashboard/src/lib/protocol/ananke-types.ts,
    dashboard/src/lib/hooks/use-ananke-levels.ts,
    dashboard/src/lib/hooks/use-ananke-levels.test.ts,
    dashboard/test/lib/ananke-types.drift.test.ts
  </files>
  <read_first>
    - Read `dashboard/src/lib/protocol/agency-types.ts` in full — this is the canonical SYNC-header mirror file. Match its header-comment format, `as const` idiom, and derived-type pattern verbatim.
    - Read `dashboard/src/lib/hooks/use-refined-telos-history.ts` in full — this is the canonical firehose-derived hook shape. Match its audit-store selector, useMemo idiom, and filter-by-did convention. Identify the exact audit-store import path so `use-ananke-levels` uses the same.
    - Read the existing drift-detector test for `agency-types.ts` (likely `dashboard/test/lib/agency-types.drift.test.ts` or similar) — clone its `fs.readFileSync` + regex-extract pattern.
    - Read `brain/src/noesis_brain/ananke/config.py` (just created in Plan 10a-01) to confirm the line format the drift test will parse.
  </read_first>
  <behavior>
    - `DRIVE_ORDER` is a 5-tuple `['hunger', 'curiosity', 'safety', 'boredom', 'loneliness']`.
    - `DRIVE_BASELINE_LEVEL` has 5 keys mapping to one of `low|med|high`.
    - `useAnankeLevels(null)` returns a Map of 5 entries, all at baseline, `direction: null`.
    - `useAnankeLevels('did:noesis:alpha')` with an empty audit store returns baselines.
    - `useAnankeLevels('did:noesis:alpha')` with a store containing `{type: 'ananke.drive_crossed', actorDid: 'did:noesis:alpha', payload: {did:'did:noesis:alpha', tick:100, drive:'hunger', level:'med', direction:'rising'}}` returns a Map where `hunger` entry is `{level:'med', direction:'rising'}`; other drives remain at baseline.
    - A newer entry for the same (did, drive) overwrites the older one.
    - An entry for a different DID does NOT affect the result.
    - **Drift detector:** reads `brain/src/noesis_brain/ananke/config.py`, extracts `DRIVE_BASELINES[...]` lines, bucketizes each float with the SAME hysteresis-aware bucket (initial from LOW) as `bucket(baseline, DriveLevel.LOW)` would produce, and asserts the result equals `DRIVE_BASELINE_LEVEL[drive]` for each drive.
  </behavior>
  <action>
    1. **Create `dashboard/src/lib/protocol/ananke-types.ts`** using the exact code from `<interfaces>`. Double-check: the baseline comment explicitly calls out that floats never appear here (documentation-as-guard against a future refactor regressing).

    2. **Create `dashboard/src/lib/hooks/use-ananke-levels.ts`** using the code from `<interfaces>`. Executor adapts the audit-store import path to match `use-refined-telos-history.ts` exactly. If that file uses a hook like `useAuditEntries()` instead of `useAuditStore(selector)`, clone THAT pattern — the interface shape is what matters, not the import name.

    3. **Create `dashboard/src/lib/hooks/use-ananke-levels.test.ts`** with ≥ 5 tests:
       - `test_returns_baseline_for_null_did`
       - `test_returns_baseline_for_empty_store`
       - `test_applies_single_crossing`
       - `test_newer_crossing_overrides_older`
       - `test_ignores_entries_for_other_dids`
       - `test_ignores_non_ananke_entry_types`

    4. **Create `dashboard/test/lib/ananke-types.drift.test.ts`:**
       ```typescript
       import { describe, it, expect } from 'vitest';
       import { readFileSync } from 'node:fs';
       import { resolve } from 'node:path';
       import { DRIVE_BASELINE_LEVEL } from '../../src/lib/protocol/ananke-types.js';

       // Same hysteresis-aware bucket function as Brain's drives.py bucket(value, LOW).
       // Starting from LOW: leave LOW only when value > 0.33 + 0.02 = 0.35; go HIGH if > 0.66 + 0.02 = 0.68.
       function bucketFromLow(v: number): 'low' | 'med' | 'high' {
           if (v > 0.68) return 'high';
           if (v > 0.35) return 'med';
           return 'low';
       }

       describe('ananke-types.ts SYNC drift detector', () => {
           it('dashboard DRIVE_BASELINE_LEVEL matches Brain config DRIVE_BASELINES', () => {
               const configPath = resolve(__dirname, '../../../brain/src/noesis_brain/ananke/config.py');
               const source = readFileSync(configPath, 'utf8');

               // Parse DRIVE_BASELINES[DriveName.X]: float lines.
               const pattern = /DriveName\.(\w+):\s*([\d.]+)/g;
               const brainBaselines: Record<string, number> = {};
               let m: RegExpExecArray | null;
               while ((m = pattern.exec(source)) !== null) {
                   brainBaselines[m[1].toLowerCase()] = parseFloat(m[2]);
               }

               // We expect 5 drives parsed (DRIVE_BASELINES has 5 entries).
               // The same regex also matches DRIVE_RISE_RATES which also has 5 entries —
               // so we expect to parse AT LEAST 5. Take the FIRST occurrence per drive name
               // which corresponds to DRIVE_BASELINES (declared above DRIVE_RISE_RATES).
               // Executor may tighten the regex to anchor on `DRIVE_BASELINES` block.

               for (const [drive, expectedLevel] of Object.entries(DRIVE_BASELINE_LEVEL)) {
                   const baseline = brainBaselines[drive];
                   expect(baseline, `drive ${drive} missing from config.py`).toBeDefined();
                   expect(bucketFromLow(baseline), `drift: ${drive} bucket mismatch`).toBe(expectedLevel);
               }
           });
       });
       ```
  </action>
  <verify>
    <automated>cd dashboard && pnpm vitest run src/lib/hooks/use-ananke-levels.test.ts test/lib/ananke-types.drift.test.ts -q</automated>
  </verify>
  <acceptance_criteria>
    - Both test files pass.
    - `grep -rn "0\.3\|0\.5\|0\.2\|0\.4" dashboard/src/lib/protocol/ananke-types.ts` returns 0 matches (no drive-baseline floats in the dashboard mirror source).
    - `grep -n "SYNC: mirrors" dashboard/src/lib/protocol/ananke-types.ts` returns ≥ 2 matches (Brain + Grid sync pointers).
    - The drift test parses `brain/src/noesis_brain/ananke/config.py` at test-time (verify the `fs.readFileSync` call is present and succeeds).
  </acceptance_criteria>
  <done>
    SYNC mirror file exists with drift-detector test that reads Brain source and verifies bucketed baselines match. Hook returns baselines for empty/null cases and applies crossings correctly.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create AnankeSection component + mount in Inspector + 45-state aria test + privacy grep</name>
  <files>
    dashboard/src/app/grid/components/inspector-sections/ananke.tsx,
    dashboard/src/app/grid/components/inspector.tsx,
    dashboard/src/app/grid/components/inspector-sections/ananke.test.tsx,
    dashboard/test/privacy/drive-forbidden-keys-dashboard.test.ts
  </files>
  <read_first>
    - Read `dashboard/src/app/grid/components/inspector.tsx` in full — identify the Overview tabpanel (the JSX block that renders Psyche, Thymos, Telos, Memory sections). Confirm the exact ordering and the tab-switching guard (e.g., `{tab === 'overview' && ...}`).
    - Read `dashboard/src/app/grid/components/inspector-sections/psyche.tsx` AND `thymos.tsx` AND `relationships.tsx` to confirm the section-component export style (named vs default), the props shape (does it take `did` or pull from context?), and the testid naming convention.
    - Read `dashboard/src/app/grid/components/inspector-sections/psyche.test.tsx` (or any sibling test) for the Vitest + testing-library idiom.
    - Re-read 10a-UI-SPEC.md §Accessibility Matrix to confirm the 45-state generator logic.
  </read_first>
  <behavior>
    **Component behavior:**
    - Renders `<section data-testid="section-ananke">` with an `<h3>` reading literally `Drives`.
    - Five `<li>` rows in canonical order.
    - Each row uses the exact Unicode glyph from the locked table.
    - Each row's `data-level` attribute equals the level enum value.
    - `data-direction="stable"` when there's no direction, else `"rising"` or `"falling"`.
    - `aria-label` on the level span follows the template EXACTLY: `{drive} level {level}` or `{drive} level {level}, {direction}`.
    - No numeric drive value appears anywhere (asserted by the privacy grep test).

    **Inspector mount:**
    - `inspector.tsx` imports `AnankeSection`.
    - `<AnankeSection did={selectedDid} />` appears between `<ThymosSection>` and `<TelosSection>` in the Overview tab JSX.
    - Section ordering test in `inspector.test.tsx` passes: Psyche → Thymos → Ananke → Telos → Memory in DOM order.

    **45-state aria test:**
    - `DRIVE_ORDER × DRIVE_LEVELS × (DRIVE_DIRECTIONS + 'stable')` = 45 cases.
    - For each, render the section with a mocked hook returning that state, query `data-testid="drive-level-{drive}"`, assert its `aria-label` exactly matches the template output.

    **Privacy test:**
    - Render the component with an audit store containing a valid `ananke.drive_crossed` entry. Query the rendered DOM.
    - Assert the rendered HTML string contains NO `0.33|0.66|drive_value` substrings, NO numeric float that could be a drive value, and NO occurrence of `hunger: 0.3` or similar.
    - Assert no `title=` attribute appears on any drive row or drive glyph.

    **No animation / timer grep:**
    - `grep` the component source and its hook for `setTimeout|setInterval|requestAnimationFrame|Date.now|performance.now` — MUST return 0 matches.
  </behavior>
  <action>
    1. **Create `dashboard/src/app/grid/components/inspector-sections/ananke.tsx`** — use the exact code from `<interfaces>`. Pay attention to Unicode escapes — prefer `\u2298` style over literal glyphs to avoid editor-encoding issues. Export a named `AnankeSection` (match sibling pattern).

    2. **Edit `dashboard/src/app/grid/components/inspector.tsx`:**
       - Add import: `import { AnankeSection } from './inspector-sections/ananke';`
       - In the Overview tabpanel JSX, between `<ThymosSection ... />` and `<TelosSection ... />`, insert: `<AnankeSection did={selectedDid} />` (using whatever variable name the existing code uses for the selected DID — match `PsycheSection` / `ThymosSection` prop-passing exactly).
       - NO other changes.

    3. **Create `dashboard/src/app/grid/components/inspector-sections/ananke.test.tsx`** with ≥ 60 test cases:

       ```tsx
       import { describe, it, expect } from 'vitest';
       import { render, screen } from '@testing-library/react';
       import { AnankeSection } from './ananke';
       import { DRIVE_ORDER, DRIVE_LEVELS, DRIVE_DIRECTIONS }
           from '../../../../lib/protocol/ananke-types';

       // mock useAnankeLevels to return deterministic state

       describe('AnankeSection — section shell and baseline', () => {
           it('renders section with testid and h3 "Drives"', () => { /* ... */ });
           it('renders 5 rows in DRIVE_ORDER', () => { /* ... */ });
           it('baseline first-paint — no direction glyph on any row', () => { /* ... */ });
       });

       describe('AnankeSection — 45-state aria-label matrix', () => {
           const directions = [null, 'rising', 'falling'] as const;
           for (const drive of DRIVE_ORDER) {
               for (const level of DRIVE_LEVELS) {
                   for (const direction of directions) {
                       const expectedAria = direction
                           ? `${drive} level ${level}, ${direction}`
                           : `${drive} level ${level}`;
                       it(`aria-label for (${drive}, ${level}, ${direction ?? 'stable'}) = "${expectedAria}"`, () => {
                           // mock useAnankeLevels to return Map with (drive -> {level, direction})
                           render(<AnankeSection did="did:noesis:alpha" />);
                           const el = screen.getByTestId(`drive-level-${drive}`);
                           expect(el.getAttribute('aria-label')).toBe(expectedAria);
                       });
                   }
               }
           }
       });

       describe('AnankeSection — glyph + palette', () => {
           const glyphMap = { hunger: '\u2298', curiosity: '\u2726', safety: '\u25C6', boredom: '\u25EF', loneliness: '\u274D' };
           for (const drive of DRIVE_ORDER) {
               it(`renders correct Unicode glyph for ${drive}`, () => {
                   render(<AnankeSection did={null} />);
                   expect(screen.getByTestId(`drive-glyph-${drive}`).textContent).toBe(glyphMap[drive]);
               });
           }
       });

       describe('AnankeSection — data-level, data-direction', () => { /* ... */ });
       describe('AnankeSection — transition test', () => {
           it('updates row from low/stable to med/rising after ananke.drive_crossed lands', () => { /* ... */ });
       });
       ```

    4. **Create `dashboard/test/privacy/drive-forbidden-keys-dashboard.test.ts`:**
       ```typescript
       import { describe, it, expect } from 'vitest';
       import { readFileSync } from 'node:fs';
       import { execSync } from 'node:child_process';
       import { render } from '@testing-library/react';
       import { AnankeSection } from '../../src/app/grid/components/inspector-sections/ananke';

       // DRIVE_FORBIDDEN_KEYS must mirror grid/src/audit/broadcast-allowlist.ts.
       const DRIVE_FORBIDDEN_KEYS = ['hunger', 'curiosity', 'safety', 'boredom', 'loneliness', 'drive_value'] as const;

       describe('DRIVE_FORBIDDEN_KEYS absent from dashboard rendered output + API shape', () => {
           it('NousStateResponse shape has no drive-related key', () => {
               const src = readFileSync('dashboard/src/lib/api/introspect.ts', 'utf8');
               // Match only KEY names, not comments/docs. We ensure none of the forbidden keys appear as a type property (e.g., `hunger:` or `hunger?:`).
               for (const key of DRIVE_FORBIDDEN_KEYS) {
                   const keyAsTypeField = new RegExp(`\\b${key}\\s*\\??\\s*:`, 'i');
                   expect(src).not.toMatch(keyAsTypeField);
               }
           });

           it('rendered AnankeSection DOM contains no numeric float that could be a drive value', () => {
               // Render with a crossing entry and assert the HTML contains no raw 0.x float.
               const { container } = render(<AnankeSection did="did:noesis:alpha" />);
               const html = container.innerHTML;
               // The only numbers allowed in the panel are zero (there are none intended).
               expect(html).not.toMatch(/0\.[0-9]+/);
               // Forbidden-key substrings must not appear in title or aria-label attributes
               // (the drive NAME is allowed in aria-label text as a semantic label; the
               // forbidden pattern targets them as PROPERTY KEYS in data-*/title/etc.).
               expect(html).not.toMatch(/title="[^"]*0\.[0-9]+/);
               expect(html).not.toMatch(/data-value=/);
               expect(html).not.toMatch(/data-drive-raw=/);
           });

           it('no wall-clock/timer in Ananke component or hook', () => {
               const out = execSync(
                   "grep -E 'setTimeout|setInterval|requestAnimationFrame|Date\\.now|performance\\.now' " +
                   "dashboard/src/app/grid/components/inspector-sections/ananke.tsx " +
                   "dashboard/src/lib/hooks/use-ananke-levels.ts || true",
                   { encoding: 'utf8' },
               );
               expect(out.trim()).toBe('');
           });
       });
       ```
  </action>
  <verify>
    <automated>cd dashboard && pnpm vitest run src/app/grid/components/inspector-sections/ananke.test.tsx test/privacy/drive-forbidden-keys-dashboard.test.ts -q</automated>
  </verify>
  <acceptance_criteria>
    - 45 aria-label tests pass (5 drives × 3 levels × 3 directions).
    - Component renders all 5 glyphs (5 glyph tests pass).
    - Section appears between Thymos and Telos in the Inspector Overview DOM order (existing inspector.test.tsx extension passes).
    - Privacy grep test passes — no numeric floats in rendered HTML, no title= attributes, no data-value attributes.
    - No-wall-clock grep returns empty string (zero matches in ananke.tsx or use-ananke-levels.ts).
    - `grep -n "AnankeSection" dashboard/src/app/grid/components/inspector.tsx` returns exactly 2 matches (import + JSX).
    - Full dashboard test suite `pnpm test` exits 0 — no regression to existing inspector tests.
  </acceptance_criteria>
  <done>
    AnankeSection exists at the exact path + shape from UI-SPEC; mounted between Thymos and Telos; 45-state aria matrix covered; privacy grep enforcing no-numeric-drive invariant; no timers or wall-clock reads.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Grid→Dashboard (WebSocket broadcast) | `ananke.drive_crossed` entries arrive here; allowlist gate (Plan 10a-02) already ran upstream. |
| Dashboard internal (audit store→render) | Derived view. Bucketed enum is all the dashboard ever sees. |
| Dashboard render surface (DOM) | Operator's eyes. Privacy contract enforced here by grep tests + UI-SPEC compliance. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10a-21 | Information Disclosure | DOM attribute carrying drive float | mitigate | Privacy grep test `no numeric float in rendered HTML` asserts zero `/0\.[0-9]+/` matches in the rendered container. UI-SPEC §Privacy Contract enumerates the surface set (visible text, title, aria-label, data-*) — all enforced by test. (Addresses T-09-02: render surface is the final leak-prevention gate.) |
| T-10a-22 | Information Disclosure | NousStateResponse shape regressing to expose drives | mitigate | Privacy test inspects `dashboard/src/lib/api/introspect.ts` source and asserts no `hunger:|curiosity:|...` property fields. Any future refactor adding drive floats to the API shape fails this test. |
| T-10a-23 | Tampering | Dashboard using a timer to fake direction glyph fade | mitigate | Component has no `setTimeout|setInterval|requestAnimationFrame`. Grep test asserts this. UI-SPEC explicitly forbids animation on drive rows. Direction is pure-audit-stream-derived. (Addresses T-09-03: no wall-clock reads in the render path.) |
| T-10a-24 | Repudiation | Baseline mirror drifting from Brain config silently | mitigate | Drift-detector test reads `brain/src/noesis_brain/ananke/config.py` at test time, bucketizes baselines with the Brain's hysteresis-aware bucket, and fails if the dashboard mirror's `DRIVE_BASELINE_LEVEL` disagrees. Doc-sync rule (CLAUDE.md) requires an in-same-commit update. |
| T-10a-25 | Spoofing | Foreign-DID entries polluting the rendered panel | mitigate | `useAnankeLevels(did)` filters audit entries by `actorDid === did`. Test `ignores_entries_for_other_dids` asserts this. |
| T-10a-26 | Denial of Service | Audit store buffer bloat | accept | Dashboard audit store size policy is inherited from earlier phases; 10a adds no new entries per tick (threshold-only emission). Plan 10a-06 adds the 50-entry-per-1000-tick ceiling regression. |
</threat_model>

<verification>
Gate checklist:
- [ ] `pnpm vitest run src/lib/hooks/use-ananke-levels.test.ts` passes (≥ 5 tests).
- [ ] `pnpm vitest run src/app/grid/components/inspector-sections/ananke.test.tsx` passes (≥ 60 tests — 45 aria + 5 glyph + shell + transition).
- [ ] `pnpm vitest run test/lib/ananke-types.drift.test.ts` passes.
- [ ] `pnpm vitest run test/privacy/drive-forbidden-keys-dashboard.test.ts` passes.
- [ ] Full `pnpm test` green (no regression).
- [ ] Section order in DOM: Psyche → Thymos → Ananke → Telos → Memory (asserted by extended inspector.test.tsx).
- [ ] Grep: `grep "setTimeout\|setInterval\|Date.now\|performance.now" dashboard/src/app/grid/components/inspector-sections/ananke.tsx dashboard/src/lib/hooks/use-ananke-levels.ts` returns 0 matches.
</verification>

<success_criteria>
- DRIVE-05 delivered on the render surface: no numeric drive value appears in any DOM attribute or text node, verified by grep + DOM inspection test.
- 45-state accessibility matrix covered per UI-SPEC Dimension 2.
- Color palette, glyphs, spacing, typography, copy all VERBATIM from UI-SPEC — no deviations.
- Drift detector establishes the Brain↔Dashboard baseline-mirror contract for all future phases.
</success_criteria>

<output>
After completion, create `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-05-SUMMARY.md`.
</output>
