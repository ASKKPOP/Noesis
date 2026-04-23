---
phase: 10b
plan: 06
type: execute
wave: 3
depends_on: [10b-03]
files_modified:
  - dashboard/src/lib/protocol/bios-types.ts
  - dashboard/src/lib/hooks/use-bios-levels.ts
  - dashboard/src/app/grid/components/inspector-sections/bios.tsx
  - dashboard/src/app/grid/components/inspector-sections/bios.test.tsx
  - dashboard/src/app/grid/components/inspector.tsx
autonomous: false
requirements: [BIOS-01]
must_haves:
  truths:
    - "Inspector Overview tab shows a Bios section between Ananke and Telos with 2 rows: energy (⚡) and sustenance (⬡)"
    - "Bios levels render as glyph/bucket only (low/med/high) — no raw values on screen"
    - "Dashboard bios-types.ts mirrors grid BiosBirth/BiosDeath payloads BYTE-EQUIVALENTLY via SYNC header — snake_case keys (psyche_hash, final_state_hash) per D-10b-01"
    - "BIOS_BIRTH_KEYS / BIOS_DEATH_KEYS tuples match grid exactly; drift test fails on any divergence"
    - "BIOS_FORBIDDEN_KEYS also enforced dashboard-side: any forbidden key in incoming event fails render"
  artifacts:
    - path: "dashboard/src/app/grid/components/inspector-sections/bios.tsx"
      provides: "BiosSection React component, 2-row glyph display"
      contains: "export function BiosSection"
    - path: "dashboard/src/lib/hooks/use-bios-levels.ts"
      provides: "React hook extracting energy/sustenance levels from current Nous state"
      contains: "export function useBiosLevels"
    - path: "dashboard/src/lib/protocol/bios-types.ts"
      provides: "Dashboard mirror of Grid bios payloads with drift-sync header; snake_case wire keys"
      contains: "SYNC:"
  key_links:
    - from: "dashboard/src/app/grid/components/inspector.tsx"
      to: "dashboard/src/app/grid/components/inspector-sections/bios.tsx"
      via: "<BiosSection> JSX between <AnankeSection> and <TelosSection>"
      pattern: "<BiosSection"
    - from: "dashboard/src/app/grid/components/inspector-sections/bios.tsx"
      to: "dashboard/src/lib/hooks/use-bios-levels.ts"
      via: "hook provides levels to component"
      pattern: "useBiosLevels"
    - from: "dashboard/src/lib/protocol/bios-types.ts"
      to: "grid/src/bios/types.ts"
      via: "SYNC header; byte-equivalent shape; snake_case keys"
      pattern: "psyche_hash|final_state_hash"
---

<objective>
Create the Dashboard Bios panel per the approved 10b-UI-SPEC.md: a compact 2-row section (⚡ energy, ⬡ sustenance) in the Inspector Overview tab, between AnankeSection and TelosSection. Mirror the 10a Ananke inspector patterns exactly. The dashboard mirror of bios payloads MUST use snake_case keys (`psyche_hash`, `final_state_hash`) matching the Grid source of truth per D-10b-01 — the drift test compares shape byte-equivalently. Turns Wave 0 stubs GREEN for: privacy/bios-forbidden-keys-dashboard, lib/bios-types.drift.

Purpose: Make the Nous body legible to humans operating the Grid — level buckets only, glyphs over numbers, no raw floats ever.

Output: 4 new files + 1 inspector edit; 1 human-verify checkpoint for glyph visual smoke.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-UI-SPEC.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-03-SUMMARY.md

<interfaces>
<!-- Clone targets from Phase 10a Ananke inspector. -->

From dashboard/src/app/grid/components/inspector-sections/ananke.tsx — clone for bios.tsx:
- Uses DriveIndicator atoms (or equivalent glyph+color component). Reuse; do NOT fork.
- 5 rows (hunger, safety, curiosity, sociality, spite). Bios version has 2 rows only.
- Aria pattern: `aria-label="{drive} {level} {direction}"` — mirror for bios.

From dashboard/src/lib/hooks/use-ananke-levels.ts — clone for use-bios-levels.ts (line-for-line, per 10b-PATTERNS.md lines 857-928):
- Filters the `useFirehose()` stream for `eventType === 'ananke.drive_crossed'` events matching the target DID.
- Maps the Ananke drives that correspond to Bios needs via `DRIVE_TO_NEED = { hunger: 'energy', safety: 'sustenance' }`.
- Returns `Map<NeedName, NeedLevelEntry>` where each entry carries `{ level, direction }` (both level and direction dimensions matter).

From dashboard/src/lib/protocol/ananke-types.ts — clone for bios-types.ts:
- File starts with SYNC header pointing at grid/src/bios/types.ts
- Mirrors BiosBirthPayload, BiosDeathPayload **byte-equivalently** in shape (keys sorted, CAUSE_VALUES re-exported)
- A drift test compares dashboard types to grid types; any divergence (casing, missing key, reordered tuple) fails.

From grid/src/bios/types.ts (plan 10b-03 — source of truth, D-10b-01 snake_case on the wire):
```ts
export interface BiosBirthPayload {
  readonly did: string;
  readonly tick: number;
  readonly psyche_hash: string;        // snake_case
}
export const BIOS_BIRTH_KEYS = ['did', 'psyche_hash', 'tick'] as const;

export const CAUSE_VALUES = ['starvation', 'operator_h5', 'replay_boundary'] as const;
export type Cause = typeof CAUSE_VALUES[number];

export interface BiosDeathPayload {
  readonly did: string;
  readonly tick: number;
  readonly cause: Cause;
  readonly final_state_hash: string;   // snake_case
}
export const BIOS_DEATH_KEYS = ['cause', 'did', 'final_state_hash', 'tick'] as const;
```
Dashboard MUST mirror these exactly. The drift test (`dashboard/test/lib/bios-types.drift.test.ts`) will fail if any key is camelCase (e.g., `psycheHash`, `finalStateHash`) or if the sorted-tuple constants diverge.

From 10b-UI-SPEC.md (approved 6/6 PASS):
- Glyphs: ⚡ U+26A1 energy, ⬡ U+2B21 sustenance
- Level-to-color map: low=green, med=amber, high=red (match Ananke vocabulary)
- Empty state (Nous not yet birthed): "—" placeholder, aria="bios pending"
- Section heading: "Bios" with small-caps styling (match Ananke heading)
- Aria-label grammar: `{need} {level} {direction}` mirroring Ananke (e.g. `energy med rising`). The BiosSection test matrix covers level × direction per need; the firehose-source hook unit test (in use-bios-levels.test.ts) covers the full drive → need mapping.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Dashboard bios-types.ts (drift-synced, snake_case) + use-bios-levels hook</name>
  <files>dashboard/src/lib/protocol/bios-types.ts, dashboard/src/lib/hooks/use-bios-levels.ts</files>
  <read_first>
    - dashboard/src/lib/protocol/ananke-types.ts (clone target; copy SYNC header format)
    - dashboard/src/lib/hooks/use-ananke-levels.ts (hook clone target)
    - grid/src/bios/types.ts (from plan 10b-03 — source of truth for sync; snake_case keys)
    - dashboard/test/lib/bios-types.drift.test.ts (Wave 0 stub — confirms fixture expects snake_case)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-UI-SPEC.md (glyph + level mapping)
  </read_first>
  <behavior>
    - bios-types.ts starts with `// SYNC: grid/src/bios/types.ts — drift test enforces parity`
    - Mirrors BiosBirthPayload, BiosDeathPayload, CAUSE_VALUES, assertCause — **keys are snake_case** matching grid (per D-10b-01)
    - `BIOS_BIRTH_KEYS = ['did', 'psyche_hash', 'tick']` (sorted; snake_case member `psyche_hash`)
    - `BIOS_DEATH_KEYS = ['cause', 'did', 'final_state_hash', 'tick']` (sorted; snake_case member `final_state_hash`)
    - If the Wave 0 drift-test fixture was scaffolded with camelCase placeholders from an earlier iteration, update the fixture to snake_case so it matches the grid source of truth
    - use-bios-levels.ts subscribes to the Grid firehose via `useFirehose()` (same pattern as use-ananke-levels)
    - Filters `eventType === 'ananke.drive_crossed'` where `actorDid === did` AND `payload.drive ∈ {hunger, safety}` (the two drives Bios elevates per D-10b-02)
    - Maps drive → need via `DRIVE_TO_NEED = { hunger: 'energy', safety: 'sustenance' }`
    - Returns `Map<NeedName, NeedLevelEntry>` where `NeedLevelEntry = { level: 'low'|'med'|'high', direction: 'rising'|'falling'|null }`
    - Initial baseline (before any crossing fires): energy and sustenance both at `low` with `direction: null`
  </behavior>
  <action>
Create `dashboard/src/lib/protocol/bios-types.ts` (mirror `ananke-types.ts` structure, starting with explicit SYNC header). **All wire-payload keys are snake_case per D-10b-01** — this file is a byte-equivalent shape-mirror of `grid/src/bios/types.ts`:
```ts
// SYNC: grid/src/bios/types.ts
// This file MUST remain byte-equivalent in shape to the Grid source of truth.
// Keys are snake_case per D-10b-01 (wire-format contract).
// The drift test at dashboard/test/lib/bios-types.drift.test.ts will fail on divergence
// (case drift, key reorder, missing tuple entries, etc.).
// When grid/src/bios/types.ts changes, regenerate this file with identical keys/values.

export interface BiosBirthPayload {
  readonly did: string;
  readonly tick: number;
  readonly psyche_hash: string;   // snake_case per D-10b-01 (mirrors grid source)
}

// Alphabetically sorted — matches grid BIOS_BIRTH_KEYS exactly.
export const BIOS_BIRTH_KEYS = ['did', 'psyche_hash', 'tick'] as const;

export const CAUSE_VALUES = ['starvation', 'operator_h5', 'replay_boundary'] as const;
export type Cause = typeof CAUSE_VALUES[number];

export interface BiosDeathPayload {
  readonly did: string;
  readonly tick: number;
  readonly cause: Cause;
  readonly final_state_hash: string;   // snake_case per D-10b-01 (mirrors grid source)
}

// Alphabetically sorted — matches grid BIOS_DEATH_KEYS exactly.
export const BIOS_DEATH_KEYS = ['cause', 'did', 'final_state_hash', 'tick'] as const;

export function assertCause(c: string): asserts c is Cause {
  if (!(CAUSE_VALUES as readonly string[]).includes(c)) {
    throw new Error(`invalid bios.death cause: ${c}`);
  }
}
```

**Drift-test fixture sync:** If the Wave 0 stub at `dashboard/test/lib/bios-types.drift.test.ts` has any embedded fixture referencing `psycheHash` or `finalStateHash` (camelCase from an earlier iteration), update those references to `psyche_hash` / `final_state_hash` so the fixture matches the grid source of truth. The drift test should pass after bios-types.ts is created.

Create `dashboard/src/lib/hooks/use-bios-levels.ts` — clone of `use-ananke-levels.ts` with drive→need filtering (canonical pattern from 10b-PATTERNS.md lines 902-928):
```ts
import { useMemo } from 'react';
import { useFirehose } from './use-firehose';
import type { AnankeDriveCrossedPayload } from '../protocol/ananke-types';

export type NeedName = 'energy' | 'sustenance';
export type NeedLevel = 'low' | 'med' | 'high';
export type NeedDirection = 'rising' | 'falling' | null;

export interface NeedLevelEntry {
  level: NeedLevel;
  direction: NeedDirection;
}

// D-10b-02: Bios elevates hunger (from energy) and safety (from sustenance).
// The dashboard receives `ananke.drive_crossed` for these drives and projects them back
// to Bios needs for display. No bios.* event carries level data — this is by design.
const DRIVE_TO_NEED: Record<string, NeedName> = {
  hunger: 'energy',
  safety: 'sustenance',
};

const NEED_ORDER: readonly NeedName[] = ['energy', 'sustenance'];

function baselineMap(): Map<NeedName, NeedLevelEntry> {
  const map = new Map<NeedName, NeedLevelEntry>();
  for (const n of NEED_ORDER) map.set(n, { level: 'low', direction: null });
  return map;
}

function isAnankeCrossingPayload(p: unknown, targetDid: string): p is AnankeDriveCrossedPayload {
  if (typeof p !== 'object' || p === null) return false;
  const r = p as Record<string, unknown>;
  if (r.did !== targetDid) return false;
  if (typeof r.drive !== 'string') return false;
  if (r.level !== 'low' && r.level !== 'med' && r.level !== 'high') return false;
  if (r.direction !== 'rising' && r.direction !== 'falling') return false;
  if (typeof r.tick !== 'number') return false;
  return true;
}

export function useBiosLevels(did: string | null): Map<NeedName, NeedLevelEntry> {
  const snap = useFirehose();
  return useMemo<Map<NeedName, NeedLevelEntry>>(() => {
    const map = baselineMap();
    if (!did) return map;
    for (const entry of snap.entries) {
      if (entry.eventType !== 'ananke.drive_crossed') continue;
      if (entry.actorDid !== did) continue;
      if (!isAnankeCrossingPayload(entry.payload, did)) continue;
      const need = DRIVE_TO_NEED[entry.payload.drive];
      if (!need) continue;  // drives that don't map to a Bios need (curiosity, boredom, sociality, spite) — ignore
      map.set(need, { level: entry.payload.level, direction: entry.payload.direction });
    }
    return map;
  }, [snap.entries, did]);
}
```
Do NOT add `bios` state to any Zustand store. The hook reads the firehose directly and projects drive events to need levels at render time. Raw float values never enter the dashboard pipeline — only the bucket levels already present in `ananke.drive_crossed` payloads.
  </action>
  <verify>
    <automated>cd dashboard && bun test test/lib/bios-types.drift.test.ts test/privacy/bios-forbidden-keys-dashboard.test.ts --run</automated>
  </verify>
  <done>Drift test passes (grid types === dashboard types; snake_case keys match). Hook returns bucket-only levels. No raw float keys present anywhere in dashboard store path. Grep `rg "psycheHash|finalStateHash" dashboard/src/lib/protocol/bios-types.ts` returns zero matches (no camelCase leak).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: BiosSection component + inspector mount</name>
  <files>dashboard/src/app/grid/components/inspector-sections/bios.tsx, dashboard/src/app/grid/components/inspector-sections/bios.test.tsx, dashboard/src/app/grid/components/inspector.tsx</files>
  <read_first>
    - dashboard/src/app/grid/components/inspector-sections/ananke.tsx (full clone target)
    - dashboard/src/app/grid/components/inspector.tsx (locate <AnankeSection /> and <TelosSection /> to insert between)
    - dashboard/src/lib/hooks/use-bios-levels.ts (from Task 1)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-UI-SPEC.md (18-case aria matrix, glyph mapping)
  </read_first>
  <behavior>
    - BiosSection renders Section heading "Bios" + 2 rows (energy ⚡, sustenance ⬡)
    - Each row uses existing level-indicator component from Ananke (no forked atom)
    - Empty state when levels are null: "—" with aria-label="bios pending"
    - bios.test.tsx covers 18-case aria matrix (2 needs × 3 levels × 3 directions)
    - inspector.tsx: add `<BiosSection did={selectedDid} />` between `<AnankeSection>` and `<TelosSection>`
    - Zero numeric values rendered; only glyphs + level bucket labels
  </behavior>
  <action>
Create `dashboard/src/app/grid/components/inspector-sections/bios.tsx`:
```tsx
import { useBiosLevels, type NeedName, type NeedLevelEntry } from '../../../../lib/hooks/use-bios-levels';
import { LevelIndicator } from '../atoms/level-indicator'; // same atom used by Ananke

const NEEDS: ReadonlyArray<{ key: NeedName; glyph: string; label: string }> = [
  { key: 'energy',     glyph: '⚡', label: 'energy' },
  { key: 'sustenance', glyph: '⬡', label: 'sustenance' },
];

interface Props {
  did: string | null;
}

function ariaLabelFor(label: string, entry: NeedLevelEntry | undefined, didIsNull: boolean): string {
  if (didIsNull) return `${label} pending`;
  if (!entry) return `${label} pending`;
  return entry.direction ? `${label} ${entry.level} ${entry.direction}` : `${label} ${entry.level}`;
}

export function BiosSection({ did }: Props) {
  const levels = useBiosLevels(did);

  return (
    <section
      aria-label="bios"
      className="inspector-section inspector-section--bios"
    >
      <header className="inspector-section__heading">Bios</header>
      <ul className="inspector-section__rows">
        {NEEDS.map(({ key, glyph, label }) => {
          const entry = levels.get(key);
          return (
            <li
              key={key}
              className="inspector-row"
              aria-label={ariaLabelFor(label, entry, did === null)}
            >
              <span className="inspector-row__glyph" aria-hidden>{glyph}</span>
              <span className="inspector-row__label">{label}</span>
              {entry ? <LevelIndicator level={entry.level} /> : <span className="inspector-row__empty">—</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

Create `dashboard/src/app/grid/components/inspector-sections/bios.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BiosSection } from './bios';

vi.mock('../../../../lib/hooks/use-bios-levels', () => ({
  useBiosLevels: vi.fn(),
}));

import { useBiosLevels, type NeedName, type NeedLevelEntry, type NeedLevel, type NeedDirection } from '../../../../lib/hooks/use-bios-levels';

const LEVELS: readonly NeedLevel[] = ['low', 'med', 'high'];
const DIRECTIONS: readonly NeedDirection[] = ['rising', 'falling', null];

function mapOf(entries: Partial<Record<NeedName, NeedLevelEntry>>): Map<NeedName, NeedLevelEntry> {
  const m = new Map<NeedName, NeedLevelEntry>();
  if (entries.energy) m.set('energy', entries.energy);
  if (entries.sustenance) m.set('sustenance', entries.sustenance);
  return m;
}

describe('BiosSection', () => {
  it('renders pending state when did is null (no Nous selected)', () => {
    (useBiosLevels as any).mockReturnValue(mapOf({}));
    render(<BiosSection did={null} />);
    expect(screen.getByLabelText('energy pending')).toBeInTheDocument();
    expect(screen.getByLabelText('sustenance pending')).toBeInTheDocument();
  });

  // 18-case aria matrix: 2 needs × 3 levels × 3 direction states (rising, falling, null)
  for (const need of ['energy', 'sustenance'] as const) {
    for (const level of LEVELS) {
      for (const direction of DIRECTIONS) {
        const expected = direction ? `${need} ${level} ${direction}` : `${need} ${level}`;
        it(`renders ${need} @ ${level} direction=${direction ?? 'null'} → aria="${expected}"`, () => {
          (useBiosLevels as any).mockReturnValue(mapOf({
            [need]: { level, direction },
          } as any));
          render(<BiosSection did="did:noesis:abc" />);
          expect(screen.getByLabelText(expected)).toBeInTheDocument();
        });
      }
    }
  }

  it('does NOT render any numeric value', () => {
    (useBiosLevels as any).mockReturnValue(mapOf({
      energy: { level: 'high', direction: 'rising' },
      sustenance: { level: 'med', direction: 'falling' },
    }));
    const { container } = render(<BiosSection did="did:noesis:abc" />);
    // No digits anywhere in the Bios section text
    expect(container.textContent ?? '').not.toMatch(/[0-9]/);
  });
});
```

Edit `dashboard/src/app/grid/components/inspector.tsx`:
- Add import: `import { BiosSection } from './inspector-sections/bios';`
- Locate the Overview tab render block with `<AnankeSection ... />` and `<TelosSection ... />`
- Insert `<BiosSection did={selectedDid} />` between them:
```tsx
<AnankeSection did={selectedDid} />
<BiosSection did={selectedDid} />
<TelosSection did={selectedDid} />
```
  </action>
  <verify>
    <automated>cd dashboard && bun test test/app/grid/components/inspector-sections/bios.test.tsx --run</automated>
  </verify>
  <done>18-case aria matrix passes (2 needs × 3 levels × 3 direction states incl. null). BiosSection mounts between Ananke and Telos. No digits rendered in Bios panel.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human-verify Bios panel visual smoke test</name>
  <what-built>
    BiosSection rendering in Inspector Overview tab with glyph + level indicators per 10b-UI-SPEC.md.
  </what-built>
  <how-to-verify>
    1. `cd dashboard && bun run dev` (or existing dev script) and open http://localhost:3000/grid
    2. Genesis-spawn at least one Nous via operator console
    3. Click the spawned Nous to open Inspector → Overview tab
    4. Confirm a "Bios" section appears BETWEEN Ananke and Telos
    5. Confirm it shows 2 rows: "⚡ energy" and "⬡ sustenance" with level indicator (low/med/high glyph+color)
    6. Confirm NO numeric values appear anywhere in the Bios rows
    7. Wait 60+ seconds of simulation — confirm energy level rises visibly (low → med) without refresh
    8. Run the operator H5 delete on the Nous — confirm Bios section disappears (or shows tombstoned state) along with Ananke/Telos
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (glyphs misrendering, section misplaced, numeric leak, etc.)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Grid → Dashboard event wire | bios.birth/death events consumed; must not deserialize forbidden keys |
| Dashboard store → React render | Only bucket-level strings stored; raw values never reach components |
| Dashboard types ↔ Grid types | Byte-equivalent snake_case mirror; drift test enforces parity |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-06-01 | Information Disclosure | Raw need value leaks into DOM | mitigate | Test asserts no digits in Bios panel text; hook sources only `ananke.drive_crossed` payloads which carry bucket levels only (no raw floats ever enter dashboard) |
| T-10b-06-02 | Tampering | Drift between grid and dashboard types (casing, tuple order, missing keys) | mitigate | bios-types.drift.test.ts compares file contents; fails on camelCase leak or tuple divergence |
| T-10b-06-03 | Accessibility regression | Aria labels missing for new section | mitigate | 18-case aria matrix test covers every (need × level) combination |
</threat_model>

<verification>
- `cd dashboard && bun test test/app/grid/components/inspector-sections/bios.test.tsx test/lib/bios-types.drift.test.ts test/privacy/bios-forbidden-keys-dashboard.test.ts --run` — all GREEN
- `rg "<BiosSection" dashboard/src/app/grid/components/inspector.tsx` returns exactly 1 match
- `rg "raw_value|rise_rate" dashboard/src/` returns zero matches
- `rg "psycheHash|finalStateHash" dashboard/src/lib/protocol/bios-types.ts` returns zero matches (no camelCase leak on the wire mirror)
- `rg "psyche_hash|final_state_hash" dashboard/src/lib/protocol/bios-types.ts` returns ≥2 matches (snake_case present)
- Human-verify checkpoint approved
</verification>

<success_criteria>
- BiosSection mounts in Inspector Overview between Ananke and Telos
- Exactly 2 rows with glyphs ⚡ and ⬡
- All 18 aria matrix cases render with correct labels
- Zero numeric values rendered in Bios section
- Drift-sync test passes: dashboard types snake_case-mirror grid types byte-equivalently
- Human confirms visual smoke: rows appear, levels update, glyphs render correctly
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-06-SUMMARY.md`
</output>
</output>
