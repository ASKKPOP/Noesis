---
phase: 10a-ananke-drives-inner-life-part-1
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/ananke/types.ts
  - grid/src/ananke/append-drive-crossed.ts
  - grid/src/ananke/index.ts
  - grid/test/audit/allowlist-nineteen.test.ts
  - grid/test/ananke/append-drive-crossed.test.ts
  - grid/test/ananke/drive-crossed-producer-boundary.test.ts
  - grid/test/privacy/drive-forbidden-keys.test.ts
autonomous: true
requirements: [DRIVE-03, DRIVE-05]
schema_push: not_applicable
user_setup: []

must_haves:
  truths:
    - "Allowlist contains exactly 19 entries; `ananke.drive_crossed` is entry #19"
    - "Forbidden sibling events (`ananke.drive_raised`, `ananke.drive_saturated`, `ananke.drive_reset`) throw at the allowlist gate"
    - "`appendAnankeDriveCrossed` is the SOLE function that appends `ananke.drive_crossed` entries; any other producer path fails the producer-boundary test"
    - "`appendAnankeDriveCrossed` rejects payloads that do not have exactly the 5-key set `{did, tick, drive, level, direction}` (Object.keys(payload).sort() strict equality)"
    - "`FORBIDDEN_KEY_PATTERN` rejects any payload containing `hunger`, `curiosity`, `safety`, `boredom`, `loneliness`, or `drive_value` as a key anywhere"
    - "`drive` and `level` and `direction` values are constrained to closed enums — a payload with `drive: 'energy'` or `level: 'medium'` throws"
  artifacts:
    - path: grid/src/audit/broadcast-allowlist.ts
      provides: "Extended ALLOWLIST (19 members) + extended FORBIDDEN_KEY_PATTERN (incl. drive-value leaf keys)"
      contains: "ananke.drive_crossed"
    - path: grid/src/ananke/types.ts
      provides: "Closed enums: AnankeDriveName, AnankeDriveLevel, AnankeDirection; AnankeDriveCrossedPayload interface"
      min_lines: 40
    - path: grid/src/ananke/append-drive-crossed.ts
      provides: "Sole producer boundary for `ananke.drive_crossed` — regex guards, closed-tuple check, privacy gate, chain.append"
      min_lines: 80
    - path: grid/src/ananke/index.ts
      provides: "Public module surface — exports appendAnankeDriveCrossed + types only"
      min_lines: 5
    - path: grid/test/ananke/append-drive-crossed.test.ts
      provides: "Unit tests — happy path, closed-tuple rejection, enum rejection, DID regex rejection"
      min_lines: 100
    - path: grid/test/ananke/drive-crossed-producer-boundary.test.ts
      provides: "Producer boundary — grep asserts `audit.append('ananke.drive_crossed', ...)` appears ONLY in `append-drive-crossed.ts`"
      min_lines: 25
    - path: grid/test/audit/allowlist-nineteen.test.ts
      provides: "Allowlist-19 regression — frozen set size, order, member equality; mutation attempts throw"
      min_lines: 40
    - path: grid/test/privacy/drive-forbidden-keys.test.ts
      provides: "Privacy matrix extension — DRIVE_FORBIDDEN_KEYS rejected across nested payload walks"
      min_lines: 50
  key_links:
    - from: grid/src/ananke/append-drive-crossed.ts
      to: grid/src/audit/broadcast-allowlist.ts
      via: "imports payloadPrivacyCheck + FORBIDDEN_KEY_PATTERN to belt-and-suspenders-validate payloads"
      pattern: "import.*payloadPrivacyCheck.*broadcast-allowlist"
    - from: grid/src/ananke/append-drive-crossed.ts
      to: grid/src/audit/chain.ts
      via: "calls audit.append('ananke.drive_crossed', actorDid, cleanPayload)"
      pattern: "audit\\.append\\('ananke\\.drive_crossed'"
    - from: grid/test/ananke/drive-crossed-producer-boundary.test.ts
      to: grid/src (entire tree)
      via: "grep asserting `'ananke.drive_crossed'` appears only in append-drive-crossed.ts (+ allowlist + types)"
      pattern: "grep -rn 'ananke.drive_crossed'"
---

<objective>
Build the Grid-side sole-producer boundary for `ananke.drive_crossed` audit events and extend the broadcast allowlist from 18 to 19. This plan ships NO dispatch wiring (that's Plan 10a-04) — it only delivers (a) the closed-tuple emitter function, (b) the allowlist addition, (c) the privacy-matrix extension, (d) the producer-boundary test. Runs parallel to Plan 10a-01 (no file overlap).

Purpose: DRIVE-03 (threshold-crossing event with closed 5-key payload) + DRIVE-05 (numeric drive values never cross the wire — enforced by the closed-tuple check rejecting `drive_value` and by FORBIDDEN_KEY_PATTERN rejecting drive names as keys).

Output: 4 source files + 4 test files. `cd grid && pnpm vitest run src/ananke test/ananke test/audit test/privacy` passes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-CONTEXT.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-RESEARCH.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-PATTERNS.md
@.planning/REQUIREMENTS.md
@grid/src/audit/append-telos-refined.ts
@grid/src/audit/broadcast-allowlist.ts

<locked_decisions>
- **D-10a-03:** Closed 5-key payload `{did, tick, drive, level, direction}` — enforced via `Object.keys(payload).sort()` strict equality (clone Phase 7 `appendTelosRefined` pattern exactly).
- **D-10a-04:** Threshold-crossing emission only — NEVER per-tick. The emitter does not reject non-crossings explicitly (the runtime never calls it for non-crossings) but the `grid/test/audit/audit-size-ceiling.test.ts` regression (Plan 10a-06) proves the bound.
- **D-10a-07:** Privacy matrix — extend Phase 6 matrix with `DRIVE_FORBIDDEN_KEYS = {hunger, curiosity, safety, boredom, loneliness, drive_value}`. Extend `FORBIDDEN_KEY_PATTERN` in `broadcast-allowlist.ts` to catch these substrings at any depth.
- **D-10a-08:** Allowlist addition is exactly one — `ananke.drive_crossed`. No `ananke.drive_raised`, no `ananke.drive_saturated`, no `ananke.drive_reset`. Closed-enum sibling-rejection test.
- **DID regex (Phase 7 D-29, locked project-wide):** `/^did:noesis:[a-z0-9_\-]+$/i`. Phase 10a becomes the 5th entry point that uses this regex (after agora, logos, operator, telos).
</locked_decisions>

<analog_sources>
**PRIMARY CLONE:** `grid/src/audit/append-telos-refined.ts` — this file is the textbook sole-producer template. Clone EXACTLY the following structural elements:
  1. Regex guards (`DID_RE`) with specific error messages.
  2. `EXPECTED_KEYS` const declared as `as const` tuple, ALPHABETICAL order.
  3. `Object.keys(payload).sort()` strict-equality check (length + element-wise comparison).
  4. Explicit object reconstruction (`const cleanPayload = {did, ...}`) to prevent prototype pollution.
  5. `payloadPrivacyCheck(cleanPayload)` belt-and-suspenders gate BEFORE chain.append.
  6. `audit.append('ananke.drive_crossed', actorDid, cleanPayload)` as the final line.

**SECONDARY CLONE:** `grid/src/audit/append-nous-deleted.ts` — the Phase 8 defense template establishes the 8-step validation discipline. Ananke is simpler (no state-hash pre-snapshot) but the validation ordering discipline transfers.

**Allowlist extension pattern:** `grid/src/audit/broadcast-allowlist.ts` lines 37–66 show the canonical comment-annotation idiom for each allowlist addition. Phase 10a addition at position 19 follows this comment idiom exactly.
</analog_sources>

<interfaces>
```typescript
// grid/src/ananke/types.ts

/**
 * Closed enums + payload contract for `ananke.drive_crossed` audit events.
 * Phase 10a — DRIVE-03, DRIVE-05.
 *
 * Mirrors brain/src/noesis_brain/ananke/types.py. Drift is tested in
 * grid/test/ananke/types-drift.test.ts (Plan 10a-06).
 */

/** Closed 5-member drive enum. Order matches REQUIREMENTS DRIVE-01 enumeration. */
export const ANANKE_DRIVE_NAMES = [
    'hunger',
    'curiosity',
    'safety',
    'boredom',
    'loneliness',
] as const;
export type AnankeDriveName = typeof ANANKE_DRIVE_NAMES[number];

/** Closed 3-member level enum. `med` is deliberately abbreviated (not `medium`) to match the payload enum across Brain↔Grid↔Dashboard. */
export const ANANKE_DRIVE_LEVELS = ['low', 'med', 'high'] as const;
export type AnankeDriveLevel = typeof ANANKE_DRIVE_LEVELS[number];

/** Closed 2-member direction enum. Stable rows omit direction entirely; there is no `stable` payload value. */
export const ANANKE_DIRECTIONS = ['rising', 'falling'] as const;
export type AnankeDirection = typeof ANANKE_DIRECTIONS[number];

/** Closed 5-key payload for `ananke.drive_crossed`. Contract-locked by D-10a-03. */
export interface AnankeDriveCrossedPayload {
    readonly did: string;         // actor DID — matches DID_RE
    readonly tick: number;        // non-negative integer
    readonly drive: AnankeDriveName;
    readonly level: AnankeDriveLevel;  // the NEW level (post-crossing)
    readonly direction: AnankeDirection;
}
```

```typescript
// grid/src/ananke/append-drive-crossed.ts
// Structural clone of grid/src/audit/append-telos-refined.ts.

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import {
    ANANKE_DRIVE_NAMES, ANANKE_DRIVE_LEVELS, ANANKE_DIRECTIONS,
    type AnankeDriveCrossedPayload,
} from './types.js';

export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

const DRIVE_NAME_SET: ReadonlySet<string> = new Set(ANANKE_DRIVE_NAMES);
const DRIVE_LEVEL_SET: ReadonlySet<string> = new Set(ANANKE_DRIVE_LEVELS);
const DIRECTION_SET: ReadonlySet<string> = new Set(ANANKE_DIRECTIONS);

// Alphabetical order — matches the canonical-tuple invariant.
const EXPECTED_KEYS = ['did', 'direction', 'drive', 'level', 'tick'] as const;

export function appendAnankeDriveCrossed(
    audit: AuditChain,
    actorDid: string,
    payload: AnankeDriveCrossedPayload,
): AuditEntry {
    // 1. DID regex (self-report invariant).
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendAnankeDriveCrossed: invalid actorDid ${JSON.stringify(actorDid)}`);
    }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(`appendAnankeDriveCrossed: invalid payload.did`);
    }
    if (payload.did !== actorDid) {
        throw new TypeError(`appendAnankeDriveCrossed: payload.did must equal actorDid (self-report invariant)`);
    }

    // 2. Scalar shape — tick is a non-negative integer.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendAnankeDriveCrossed: tick must be non-negative integer, got ${payload.tick}`);
    }

    // 3. Closed-enum validation — drive / level / direction must be members.
    if (!DRIVE_NAME_SET.has(payload.drive)) {
        throw new TypeError(`appendAnankeDriveCrossed: unknown drive ${JSON.stringify(payload.drive)}`);
    }
    if (!DRIVE_LEVEL_SET.has(payload.level)) {
        throw new TypeError(`appendAnankeDriveCrossed: unknown level ${JSON.stringify(payload.level)} (expected low|med|high)`);
    }
    if (!DIRECTION_SET.has(payload.direction)) {
        throw new TypeError(`appendAnankeDriveCrossed: unknown direction ${JSON.stringify(payload.direction)} (expected rising|falling)`);
    }

    // 4. Closed-tuple — exactly 5 keys, alphabetical.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendAnankeDriveCrossed: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 5. Explicit reconstruction (prototype-pollution defense).
    const cleanPayload = {
        did: payload.did,
        tick: payload.tick,
        drive: payload.drive,
        level: payload.level,
        direction: payload.direction,
    };

    // 6. Privacy gate — belt-and-suspenders (the 5 closed keys are natively
    //    clean by D-10a-07, but FORBIDDEN_KEY_PATTERN catches regressions).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendAnankeDriveCrossed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 7. Commit.
    return audit.append('ananke.drive_crossed', actorDid, cleanPayload);
}
```

```typescript
// grid/src/ananke/index.ts

export { appendAnankeDriveCrossed, DID_RE } from './append-drive-crossed.js';
export {
    ANANKE_DRIVE_NAMES, ANANKE_DRIVE_LEVELS, ANANKE_DIRECTIONS,
} from './types.js';
export type {
    AnankeDriveName, AnankeDriveLevel, AnankeDirection, AnankeDriveCrossedPayload,
} from './types.js';
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend allowlist to 19 + extend privacy pattern with DRIVE_FORBIDDEN_KEYS</name>
  <files>
    grid/src/audit/broadcast-allowlist.ts,
    grid/test/audit/allowlist-nineteen.test.ts,
    grid/test/privacy/drive-forbidden-keys.test.ts
  </files>
  <read_first>
    - Read `grid/src/audit/broadcast-allowlist.ts` in full (already in context) — understand the `buildFrozenAllowlist` discipline, the `ALLOWLIST_MEMBERS` tuple structure, and the `FORBIDDEN_KEY_PATTERN` regex.
    - Read `grid/test/audit/` directory listing to find the existing allowlist-size tests (e.g., `allowlist-eighteen.test.ts` or similar). The 10a test is the successor; if `allowlist-eighteen.test.ts` exists, keep it (it remains a regression gate for Phases 6/7/8) and create a NEW `allowlist-nineteen.test.ts` for the 10a-era size assertion.
    - Read `grid/test/privacy/` directory listing. If a Phase 6 privacy matrix test exists (`operator-forbidden-keys.test.ts` or similar), clone its test file structure.
  </read_first>
  <behavior>
    - `ALLOWLIST.size === 19` after the edit.
    - `ALLOWLIST.has('ananke.drive_crossed') === true`.
    - `ALLOWLIST.has('ananke.drive_raised') === false`; same for `drive_saturated` and `drive_reset`.
    - `ALLOWLIST_MEMBERS[18] === 'ananke.drive_crossed'` (0-indexed — the new entry is the 19th = index 18).
    - `ALLOWLIST.add('x')` throws `TypeError: ALLOWLIST is frozen; cannot mutate at runtime`.
    - `FORBIDDEN_KEY_PATTERN.test('hunger')` returns `true`; same for `curiosity|safety|boredom|loneliness|drive_value`.
    - `FORBIDDEN_KEY_PATTERN.test('prompt')` still returns `true` (Phase 6 behavior preserved — no regression).
    - `payloadPrivacyCheck({ metadata: { hunger_score: 0.7 } })` returns `{ok: false, offendingPath: 'metadata.hunger_score', offendingKeyword: 'hunger'}`.
    - Nested arrays traversed: `payloadPrivacyCheck({ data: [{drive_value: 0.3}] })` returns `{ok: false, offendingPath: 'data.0.drive_value'}`.
  </behavior>
  <action>
    1. **Edit `grid/src/audit/broadcast-allowlist.ts`:**
       - Update the module-level JSDoc at lines 24–35 to append: ` * Phase 10a (DRIVE-03): +1 'ananke.drive_crossed' at position 19 — Nous-internal drive pressure threshold crossings. Closed 5-key payload: {did, tick, drive, level, direction}. Emitted ONLY via appendAnankeDriveCrossed() (grid/src/ananke/append-drive-crossed.ts). Tuple ORDER locked; reorder fails allowlist-nineteen.test.ts.`
       - In `ALLOWLIST_MEMBERS`, after `'operator.nous_deleted',`, append (inside the readonly tuple, with the comment block):
         ```typescript
         // Phase 10a (DRIVE-03) — Ananke drive threshold crossings. Closed 5-key payload:
         // {did, tick, drive, level, direction}. level ∈ {low,med,high}; direction ∈ {rising,falling}.
         // Emitted ONLY via appendAnankeDriveCrossed() (grid/src/ananke/append-drive-crossed.ts).
         'ananke.drive_crossed',
         ```
       - Extend `FORBIDDEN_KEY_PATTERN` to add the 6 drive-leaf keys:
         ```typescript
         export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value/i;
         ```
       - Add a module-level constant above `FORBIDDEN_KEY_PATTERN`:
         ```typescript
         /** Phase 10a (D-10a-07): drive-leaf keys that MUST NOT appear in any broadcast payload. */
         export const DRIVE_FORBIDDEN_KEYS = ['hunger', 'curiosity', 'safety', 'boredom', 'loneliness', 'drive_value'] as const;
         ```

    2. **Create `grid/test/audit/allowlist-nineteen.test.ts`:**
       ```typescript
       import { describe, it, expect } from 'vitest';
       import { ALLOWLIST, isAllowlisted } from '../../src/audit/broadcast-allowlist.js';

       describe('allowlist 19 — Phase 10a DRIVE-03', () => {
           it('has exactly 19 entries', () => {
               expect(ALLOWLIST.size).toBe(19);
           });

           it('contains ananke.drive_crossed', () => {
               expect(isAllowlisted('ananke.drive_crossed')).toBe(true);
           });

           it.each(['ananke.drive_raised', 'ananke.drive_saturated', 'ananke.drive_reset'])(
               'rejects forbidden sibling %s',
               (event) => {
                   expect(isAllowlisted(event)).toBe(false);
               },
           );

           it('is frozen — .add throws TypeError', () => {
               // @ts-expect-error — testing runtime immutability
               expect(() => ALLOWLIST.add('x.y')).toThrow(TypeError);
           });

           it('preserves all 18 prior allowlist members (regression)', () => {
               const priorMembers = [
                   'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
                   'trade.proposed', 'trade.reviewed', 'trade.settled',
                   'law.triggered', 'tick', 'grid.started', 'grid.stopped',
                   'operator.inspected', 'operator.paused', 'operator.resumed',
                   'operator.law_changed', 'operator.telos_forced',
                   'telos.refined', 'operator.nous_deleted',
               ];
               for (const m of priorMembers) expect(isAllowlisted(m)).toBe(true);
           });
       });
       ```

    3. **Create `grid/test/privacy/drive-forbidden-keys.test.ts`:**
       ```typescript
       import { describe, it, expect } from 'vitest';
       import { FORBIDDEN_KEY_PATTERN, DRIVE_FORBIDDEN_KEYS, payloadPrivacyCheck }
           from '../../src/audit/broadcast-allowlist.js';

       describe('DRIVE_FORBIDDEN_KEYS privacy matrix extension (D-10a-07)', () => {
           it.each(DRIVE_FORBIDDEN_KEYS)('rejects leaf key %s', (key) => {
               expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
           });

           it('preserves Phase 6 forbidden keys (regression)', () => {
               for (const key of ['prompt', 'response', 'wiki', 'reflection', 'thought', 'emotion_delta']) {
                   expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
               }
           });

           it('detects nested drive-leaf keys', () => {
               const r = payloadPrivacyCheck({ metadata: { hunger_score: 0.7 } });
               expect(r.ok).toBe(false);
               expect(r.offendingPath).toBe('metadata.hunger_score');
               expect(r.offendingKeyword).toBe('hunger');
           });

           it('walks arrays', () => {
               const r = payloadPrivacyCheck({ data: [{ drive_value: 0.3 }] });
               expect(r.ok).toBe(false);
               expect(r.offendingPath).toBe('data.0.drive_value');
           });

           it('case-insensitive — Hunger matches hunger', () => {
               const r = payloadPrivacyCheck({ Hunger: 0.5 });
               expect(r.ok).toBe(false);
           });

           it('does not flag innocuous keys', () => {
               expect(payloadPrivacyCheck({ did: 'did:noesis:x', tick: 1 }).ok).toBe(true);
           });
       });
       ```
  </action>
  <verify>
    <automated>cd grid && pnpm vitest run test/audit/allowlist-nineteen.test.ts test/privacy/drive-forbidden-keys.test.ts -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^\s*'" grid/src/audit/broadcast-allowlist.ts` inside the `ALLOWLIST_MEMBERS` tuple returns 19 (or manually: the array between `ALLOWLIST_MEMBERS: readonly string[] = [` and `] as const;` contains 19 quoted strings).
    - `pnpm vitest run test/audit/allowlist-nineteen.test.ts` reports 5 passing tests.
    - `pnpm vitest run test/privacy/drive-forbidden-keys.test.ts` reports ≥ 10 passing tests (6 drive-keys + 6 Phase 6 regressions + 4 behavior tests).
    - The regex `FORBIDDEN_KEY_PATTERN` literal in `broadcast-allowlist.ts` contains `hunger|curiosity|safety|boredom|loneliness|drive_value`.
  </acceptance_criteria>
  <done>
    ALLOWLIST is 19 members. `ananke.drive_crossed` is entry #19. Forbidden siblings rejected. Privacy pattern extended with 6 drive-leaf keys; Phase 6 regressions preserved. `DRIVE_FORBIDDEN_KEYS` exported for downstream grep tests.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create appendAnankeDriveCrossed sole-producer + closed-tuple + producer-boundary tests</name>
  <files>
    grid/src/ananke/types.ts,
    grid/src/ananke/append-drive-crossed.ts,
    grid/src/ananke/index.ts,
    grid/test/ananke/append-drive-crossed.test.ts,
    grid/test/ananke/drive-crossed-producer-boundary.test.ts
  </files>
  <read_first>
    - Read `grid/src/audit/append-telos-refined.ts` in full (already in context) — this is the primary clone source. Match its ordering, comment style, error-message format verbatim (substituting `telos.refined` → `ananke.drive_crossed`).
    - Read `grid/src/audit/chain.ts` to confirm the `AuditChain.append(eventType, actorDid, payload)` signature so the final call matches.
    - Read an existing producer-boundary test (`grep -rn "producer-boundary" grid/test/` — search result will yield `grid/test/audit/telos-refined-producer-boundary.test.ts` or similar). Clone its shape.
    - Read `grid/vitest.config.ts` to confirm test file discovery pattern and the alias configuration for `.js` suffixed imports.
  </read_first>
  <behavior>
    **Happy path:**
    - `appendAnankeDriveCrossed(chain, 'did:noesis:alpha', {did:'did:noesis:alpha', tick: 100, drive: 'hunger', level: 'med', direction: 'rising'})` returns an `AuditEntry` with `type === 'ananke.drive_crossed'` and payload is exactly the 5-key object.

    **Rejections (each asserts a specific TypeError):**
    - Missing key: `{did, tick, drive, level}` (4 keys) → throws `unexpected key set`.
    - Extra key: `{did, tick, drive, level, direction, raw: 0.34}` → throws `unexpected key set` (the `raw` key is rejected before privacy check — closed-tuple is the first gate).
    - Extra key that also triggers privacy pattern: `{did, tick, drive, level, direction, hunger: 0.5}` → throws `unexpected key set` (closed-tuple fires first; privacy check never runs because tuple fails).
    - Wrong drive enum: `drive: 'energy'` → throws `unknown drive "energy"`.
    - Wrong level enum: `level: 'medium'` → throws `unknown level "medium" (expected low|med|high)`.
    - Wrong direction enum: `direction: 'stable'` → throws `unknown direction "stable"` (stable is a UI-only concept, never crosses the wire).
    - Invalid DID: `actorDid: 'alpha'` (no prefix) → throws `invalid actorDid`.
    - DID mismatch: `actorDid: 'did:noesis:alpha'`, `payload.did: 'did:noesis:beta'` → throws `payload.did must equal actorDid (self-report invariant)`.
    - Negative tick: `tick: -1` → throws `tick must be non-negative integer`.
    - Non-integer tick: `tick: 1.5` → throws same.

    **Producer boundary:** `grep -rn "'ananke.drive_crossed'" grid/src/` yields matches ONLY in: `audit/broadcast-allowlist.ts` (allowlist member) and `ananke/append-drive-crossed.ts` (the emitter). Any third match in a `grid/src/**` file fails the boundary test.
  </behavior>
  <action>
    1. **Create `grid/src/ananke/types.ts`** — use the exact code from the `<interfaces>` block. Confirm the 3 closed enums are exported as `as const` tuples with derived type aliases.

    2. **Create `grid/src/ananke/append-drive-crossed.ts`** — use the exact code from the `<interfaces>` block. Pay attention to:
       - `EXPECTED_KEYS` is `['did', 'direction', 'drive', 'level', 'tick']` (alphabetical, NOT payload-interface order).
       - The closed-tuple check must occur AFTER the enum checks in the code above — this is a deliberate ordering: enum validation produces more informative error messages for common mistakes (`drive: 'energy'` is a more useful error than `unexpected key set`). The tuple check catches STRUCTURAL violations the enum checks cannot express (missing keys, extra keys).
       - Error messages include the JSON-stringified input for debuggability.

    3. **Create `grid/src/ananke/index.ts`** — use the code from the `<interfaces>` block. NO other exports (no internal helpers leak).

    4. **Create `grid/test/ananke/append-drive-crossed.test.ts`** — follow `grid/test/audit/append-telos-refined.test.ts` structure. Minimum 15 test cases covering all rejections plus 2 happy paths (rising, falling). Use an in-memory AuditChain fixture (clone the existing fixture pattern from telos-refined tests).

    5. **Create `grid/test/ananke/drive-crossed-producer-boundary.test.ts`:**
       ```typescript
       import { describe, it, expect } from 'vitest';
       import { execSync } from 'node:child_process';

       describe('ananke.drive_crossed sole-producer boundary', () => {
           it("string 'ananke.drive_crossed' appears only in allowlist and emitter", () => {
               // Grep all grid/src for the literal. Allowed locations:
               //  - grid/src/audit/broadcast-allowlist.ts (allowlist member)
               //  - grid/src/ananke/append-drive-crossed.ts (sole emitter)
               const out = execSync(
                   "grep -rln \"'ananke.drive_crossed'\\|\\\"ananke.drive_crossed\\\"\" grid/src",
                   { encoding: 'utf8', cwd: process.cwd().replace(/\/grid$/, '') },
               ).trim().split('\n').filter(Boolean).sort();

               const expected = [
                   'grid/src/ananke/append-drive-crossed.ts',
                   'grid/src/audit/broadcast-allowlist.ts',
               ];
               expect(out).toEqual(expected);
           });
       });
       ```
       (If the test runs from `grid/` directly, adjust `cwd` logic; the gist is the grep search must be anchored at repo root or `grid/` consistently.)
  </action>
  <verify>
    <automated>cd grid && pnpm vitest run src/ananke test/ananke -q</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm vitest run test/ananke/append-drive-crossed.test.ts` reports ≥ 15 passing tests.
    - `pnpm vitest run test/ananke/drive-crossed-producer-boundary.test.ts` passes.
    - `grep -rln "ananke.drive_crossed" grid/src/` returns exactly 2 files.
    - `grep -c "^export " grid/src/ananke/index.ts` ≥ 4 (emitter, 3 constants) and the index file is ≤ 10 lines (minimal surface).
    - `appendAnankeDriveCrossed` happy-path invocation appends an entry whose `payload` JSON has keys in insertion order `{did, tick, drive, level, direction}` (insertion preserves spec semantics even though the closed-tuple check uses alphabetical sort for equality).
  </acceptance_criteria>
  <done>
    Sole-producer module exists at `grid/src/ananke/append-drive-crossed.ts`. Closed-tuple, closed-enum, DID-regex, self-report, and tick-integer validations all reject mismatching inputs. Producer boundary grep test proves the literal `'ananke.drive_crossed'` appears only in the two authorized files.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain→Grid (wire) | `ananke.drive_crossed` payload crosses this boundary. Closed-tuple enforcement is the firewall. Brain sends 3 keys `{drive, level, direction}`; Grid's `nous-runner` (Plan 10a-04) injects `did` and `tick`. |
| Grid→Dashboard (broadcast) | Allowlist check + privacy walk runs at WsHub (Phase 2 infra). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10a-06 | Information Disclosure | Payload leaking drive float | mitigate | Closed-tuple `Object.keys(payload).sort()` strict-equality check rejects any `raw` / `value` / `drive_value` key. Extended `FORBIDDEN_KEY_PATTERN` rejects drive-name-as-key. Both gates fire BEFORE `chain.append`. (Addresses T-09-02 inherited: plaintext drive leak — structurally impossible because the payload interface has no float field and the tuple check refuses extras.) |
| T-10a-07 | Tampering | Unauthorized event emission (fake crossing) | mitigate | Self-report invariant: `payload.did === actorDid`. Only the authoritative runtime loop can emit. Producer-boundary grep test proves no other code path constructs a `'ananke.drive_crossed'` literal. |
| T-10a-08 | Spoofing | Forbidden sibling events (drive_raised/saturated/reset) | mitigate | Allowlist is a closed 19-entry frozen set. Attempting `audit.append('ananke.drive_raised', ...)` succeeds at the chain level (the chain doesn't gate) but `isAllowlisted('ananke.drive_raised') === false` → WsHub drops silently at broadcast. Plan 10a-06 adds an assertion that no non-allowlisted `ananke.*` event reaches WsHub. (Addresses T-09-01 inherited: per-tick bloat — D-10a-08 forbidden-sibling discipline prevents event-type sprawl.) |
| T-10a-09 | Repudiation | Determinism of payload shape across TypeScript versions | accept | TypeScript's structural typing cannot guarantee shape at runtime; that's why the runtime closed-tuple check exists. Accepted risk: a future TS compiler optimization cannot drop the runtime check because it runs on Object.keys of the caller's literal. |
| T-10a-10 | Denial of Service | Allowlist mutation at runtime | mitigate | `buildFrozenAllowlist` overrides `add`/`delete`/`clear` to throw. `allowlist-nineteen.test.ts` includes mutation attempt assertion. Inherited Phase 6 discipline. |
</threat_model>

<verification>
Gate checklist:
- [ ] `ALLOWLIST.size === 19`.
- [ ] `grep -rln "ananke.drive_crossed" grid/src/` returns exactly 2 files.
- [ ] `grep -rln "ananke.drive_raised\|ananke.drive_saturated\|ananke.drive_reset" grid/src/` returns 0 files.
- [ ] `FORBIDDEN_KEY_PATTERN` literal string contains `hunger|curiosity|safety|boredom|loneliness|drive_value`.
- [ ] `pnpm vitest run test/ananke test/audit test/privacy` exits 0.
- [ ] `grid/src/ananke/index.ts` exports nothing beyond the emitter and the 3 enum constants + 4 types.
</verification>

<success_criteria>
- DRIVE-03 delivered: `ananke.drive_crossed` allowlisted, closed 5-key payload enforced, sole-producer boundary proven.
- DRIVE-05 delivered at the wire: the payload interface and closed-tuple check make it structurally impossible to emit a numeric drive value across the Brain↔Grid boundary.
- Privacy matrix extended per D-10a-07 without regression on Phase 6's forbidden keys.
- Phase 6 D-11 closed-tuple + sole-producer discipline cloned faithfully; Phase 8 D-22 defense-layering respected.
</success_criteria>

<output>
After completion, create `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-02-SUMMARY.md`.
</output>
