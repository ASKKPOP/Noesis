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
    - "Dashboard bios-types.ts mirrors grid BiosBirth/BiosDeath payloads via SYNC header (drift test will fail if diverged)"
    - "BIOS_FORBIDDEN_KEYS also enforced dashboard-side: any forbidden key in incoming event fails render"
  artifacts:
    - path: "dashboard/src/app/grid/components/inspector-sections/bios.tsx"
      provides: "BiosSection React component, 2-row glyph display"
      contains: "export function BiosSection"
    - path: "dashboard/src/lib/hooks/use-bios-levels.ts"
      provides: "React hook extracting energy/sustenance levels from current Nous state"
      contains: "export function useBiosLevels"
    - path: "dashboard/src/lib/protocol/bios-types.ts"
      provides: "Dashboard mirror of Grid bios payloads with drift-sync header"
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
---

<objective>
Create the Dashboard Bios panel per the approved 10b-UI-SPEC.md: a compact 2-row section (⚡ energy, ⬡ sustenance) in the Inspector Overview tab, between AnankeSection and TelosSection. Mirror the 10a Ananke inspector patterns exactly. Turns Wave 0 stubs GREEN for: privacy/bios-forbidden-keys-dashboard, lib/bios-types.drift.

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

From dashboard/src/lib/hooks/use-ananke-levels.ts — clone for use-bios-levels.ts:
- Selects slice of Nous state. Filter to energy + sustenance only.
- Returns `{ energy: NeedLevel, sustenance: NeedLevel }`.

From dashboard/src/lib/protocol/ananke-types.ts — clone for bios-types.ts:
- File starts with SYNC header pointing at grid/src/bios/types.ts
- Mirrors BiosBirthPayload, BiosDeathPayload exactly (keys sorted, CAUSE_VALUES re-exported)
- A drift test will fail if grid types diverge from dashboard types

From 10b-UI-SPEC.md (approved 6/6 PASS):
- Glyphs: ⚡ U+26A1 energy, ⬡ U+2B21 sustenance
- Level-to-color map: low=green, med=amber, high=red (match Ananke vocabulary)
- Empty state (Nous not yet birthed): "—" placeholder, aria="bios pending"
- Section heading: "Bios" with small-caps styling (match Ananke heading)
- 18-case aria matrix: 2 needs × 3 levels × 3 directions (rising/stable/falling)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Dashboard bios-types.ts (drift-synced) + use-bios-levels hook</name>
  <files>dashboard/src/lib/protocol/bios-types.ts, dashboard/src/lib/hooks/use-bios-levels.ts</files>
  <read_first>
    - dashboard/src/lib/protocol/ananke-types.ts (clone target; copy SYNC header format)
    - dashboard/src/lib/hooks/use-ananke-levels.ts (hook clone target)
    - grid/src/bios/types.ts (from plan 10b-03 — source of truth for sync)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-UI-SPEC.md (glyph + level mapping)
  </read_first>
  <behavior>
    - bios-types.ts starts with `// SYNC: grid/src/bios/types.ts — drift test enforces parity`
    - Mirrors BiosBirthPayload, BiosDeathPayload, CAUSE_VALUES, assertCause
    - use-bios-levels.ts subscribes to Nous state store, extracts only bucket levels (never raw values)
    - Hook returns `{ energy: 'low' | 'med' | 'high' | null, sustenance: 'low' | 'med' | 'high' | null }`
  </behavior>
  <action>
Create `dashboard/src/lib/protocol/bios-types.ts` (mirror `ananke-types.ts` structure, starting with explicit SYNC header):
```ts
// SYNC: grid/src/bios/types.ts
// This file MUST remain byte-equivalent in shape to the Grid source of truth.
// The drift test at dashboard/test/lib/bios-types.drift.test.ts will fail on divergence.
// When grid/src/bios/types.ts changes, regenerate this file with identical keys/values.

export interface BiosBirthPayload {
  readonly did: string;
  readonly tick: number;
  readonly psycheHash: string;
}

export const BIOS_BIRTH_KEYS = ['did', 'psycheHash', 'tick'] as const;

export const CAUSE_VALUES = ['starvation', 'operator_h5', 'replay_boundary'] as const;
export type Cause = typeof CAUSE_VALUES[number];

export interface BiosDeathPayload {
  readonly did: string;
  readonly tick: number;
  readonly cause: Cause;
  readonly finalStateHash: string;
}

export const BIOS_DEATH_KEYS = ['cause', 'did', 'finalStateHash', 'tick'] as const;

export function assertCause(c: string): asserts c is Cause {
  if (!(CAUSE_VALUES as readonly string[]).includes(c)) {
    throw new Error(`invalid bios.death cause: ${c}`);
  }
}
```

Create `dashboard/src/lib/hooks/use-bios-levels.ts` (clone `use-ananke-levels.ts`):
```ts
import { useGridStore } from '../store/grid-store'; // existing store
import { useMemo } from 'react';

export type NeedLevel = 'low' | 'med' | 'high';

export interface BiosLevels {
  energy: NeedLevel | null;
  sustenance: NeedLevel | null;
}

export function useBiosLevels(did: string | null): BiosLevels {
  const nous = useGridStore(s => (did ? s.nousByDid[did] : null));
  return useMemo<BiosLevels>(() => {
    if (!nous || !nous.bios) return { energy: null, sustenance: null };
    return {
      energy: nous.bios.energy ?? null,
      sustenance: nous.bios.sustenance ?? null,
    };
  }, [nous]);
}
```
Adjust the grid store typing (if needed) to carry `bios: { energy, sustenance } | null` on each Nous entry, populated by the bios.birth → bios.death stream handler. Keep raw values out of the store entirely — the reducer should convert incoming level codes to enum strings before storing. If the store reducer currently doesn't handle bios.birth/bios.death, add minimal handlers that only set/clear the levels bucket (no values stored).
  </action>
  <verify>
    <automated>cd dashboard && bun test test/lib/bios-types.drift.test.ts test/privacy/bios-forbidden-keys-dashboard.test.ts --run</automated>
  </verify>
  <done>Drift test passes (grid types === dashboard types). Hook returns bucket-only levels. No raw float keys present anywhere in dashboard store path.</done>
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
import { useBiosLevels, type NeedLevel } from '../../../../lib/hooks/use-bios-levels';
import { LevelIndicator } from '../atoms/level-indicator'; // same atom used by Ananke

const NEEDS: ReadonlyArray<{ key: 'energy' | 'sustenance'; glyph: string; label: string }> = [
  { key: 'energy',     glyph: '⚡', label: 'energy' },
  { key: 'sustenance', glyph: '⬡', label: 'sustenance' },
];

interface Props {
  did: string | null;
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
          const level = levels[key];
          return (
            <li
              key={key}
              className="inspector-row"
              aria-label={level ? `${label} ${level}` : `${label} pending`}
            >
              <span className="inspector-row__glyph" aria-hidden>{glyph}</span>
              <span className="inspector-row__label">{label}</span>
              {level ? <LevelIndicator level={level} /> : <span className="inspector-row__empty">—</span>}
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

import { useBiosLevels } from '../../../../lib/hooks/use-bios-levels';

const LEVELS = ['low', 'med', 'high'] as const;

describe('BiosSection', () => {
  it('renders empty state when levels are null', () => {
    (useBiosLevels as any).mockReturnValue({ energy: null, sustenance: null });
    render(<BiosSection did={null} />);
    expect(screen.getByLabelText('energy pending')).toBeInTheDocument();
    expect(screen.getByLabelText('sustenance pending')).toBeInTheDocument();
  });

  for (const need of ['energy', 'sustenance'] as const) {
    for (const level of LEVELS) {
      it(`renders ${need} ${level} with correct aria-label`, () => {
        (useBiosLevels as any).mockReturnValue({
          energy: need === 'energy' ? level : null,
          sustenance: need === 'sustenance' ? level : null,
        });
        render(<BiosSection did="did:nous:abc" />);
        expect(screen.getByLabelText(`${need} ${level}`)).toBeInTheDocument();
      });
    }
  }

  it('does NOT render any numeric value', () => {
    (useBiosLevels as any).mockReturnValue({ energy: 'high', sustenance: 'med' });
    const { container } = render(<BiosSection did="did:nous:abc" />);
    // No digits except within aria-hidden glyphs (which have no digits anyway)
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
  <done>18+ aria cases pass. BiosSection mounts between Ananke and Telos. No digits rendered in Bios panel.</done>
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

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-06-01 | Information Disclosure | Raw need value leaks into DOM | mitigate | Test asserts no digits in Bios panel text; store reducer drops any non-bucket key |
| T-10b-06-02 | Tampering | Drift between grid and dashboard types | mitigate | bios-types.drift.test.ts compares file contents; fails on divergence |
| T-10b-06-03 | Accessibility regression | Aria labels missing for new section | mitigate | 18-case aria matrix test covers every (need × level) combination |
</threat_model>

<verification>
- `cd dashboard && bun test test/app/grid/components/inspector-sections/bios.test.tsx test/lib/bios-types.drift.test.ts test/privacy/bios-forbidden-keys-dashboard.test.ts --run` — all GREEN
- `rg "<BiosSection" dashboard/src/app/grid/components/inspector.tsx` returns exactly 1 match
- Grep: `rg "raw_value|rise_rate" dashboard/src/` returns zero matches
- Human-verify checkpoint approved
</verification>

<success_criteria>
- BiosSection mounts in Inspector Overview between Ananke and Telos
- Exactly 2 rows with glyphs ⚡ and ⬡
- All 18 aria matrix cases render with correct labels
- Zero numeric values rendered in Bios section
- Drift-sync test ensures dashboard types never diverge from grid types
- Human confirms visual smoke: rows appear, levels update, glyphs render correctly
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-06-SUMMARY.md`
</output>
