---
phase: 10b
plan: 03
type: execute
wave: 1
depends_on: [10b-01]
files_modified:
  - grid/src/bios/types.ts
  - grid/src/bios/appendBiosBirth.ts
  - grid/src/bios/appendBiosDeath.ts
  - grid/src/bios/index.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/genesis/launcher.ts
autonomous: true
requirements: [BIOS-02, BIOS-03, BIOS-04]
must_haves:
  truths:
    - "Broadcast allowlist contains exactly 21 events (19 existing + bios.birth + bios.death)"
    - "bios.birth emits on every Nous spawn (both launcher sites) with closed-tuple {did, tick, psyche_hash}"
    - "bios.death is the sole producer file for bios.death; closed-tuple {did, tick, cause, final_state_hash}; cause enum literal-guarded"
    - "Tombstoned DIDs cannot emit bios.birth or bios.death (gated via NousRegistry)"
  artifacts:
    - path: "grid/src/bios/appendBiosBirth.ts"
      provides: "Sole producer of bios.birth event"
      contains: "auditChain.append"
    - path: "grid/src/bios/appendBiosDeath.ts"
      provides: "Sole producer of bios.death event with cause enum"
      contains: "CAUSE_VALUES"
    - path: "grid/src/audit/broadcast-allowlist.ts"
      provides: "21-event allowlist + BIOS_FORBIDDEN_KEYS + CHRONOS_FORBIDDEN_KEYS"
      contains: "bios.birth"
  key_links:
    - from: "grid/src/genesis/launcher.ts"
      to: "grid/src/bios/appendBiosBirth.ts"
      via: "spawn-site call pairs appendNousSpawned + appendBiosBirth (ORDER fixed)"
      pattern: "appendBiosBirth"
    - from: "grid/src/bios/appendBiosDeath.ts"
      to: "grid/src/audit/broadcast-allowlist.ts"
      via: "event name must be allowlist member"
      pattern: "bios\\.death"
---

<objective>
Create Grid-side sole-producer emitters for bios.birth and bios.death, extend the broadcast allowlist from 19→21 events per D-10b-01, wire bios.birth emission into both `launcher.ts` spawn sites, and add BIOS/CHRONOS forbidden-key privacy matrices. Turns Wave 0 stubs GREEN for: allowlist-twenty-one, append-bios-birth-boundary, append-bios-death-boundary, closed-enum-bios-lifecycle, privacy/bios-forbidden-keys, privacy/chronos-forbidden-keys, zero-diff-bios, audit-size-ceiling-bios, ci/bios-no-walltime.

Purpose: Externalize Bios lifecycle as audit events crossing the Grid↔Dashboard boundary, preserving closed-tuple payload discipline + sole-producer invariant.

Output: 4 new files in `grid/src/bios/`, extended allowlist (19→21), 2 call sites added to launcher.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-RESEARCH.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md

<interfaces>
<!-- Clone targets — executor MUST read and mirror these exactly. -->

From grid/src/ananke/append-drive-crossed.ts:59-133 — clone for appendBiosBirth/Death:
- 8-step validation: (1) resolve tick, (2) build payload, (3) closed-tuple strict-eq gate,
  (4) privacy grep, (5) tombstone check, (6) auditChain.append, (7) return hash, (8) telemetry.

From grid/src/audit/append-nous-deleted.ts:78-87 — CAUSE_VALUES literal-guard:
```ts
const CAUSE_VALUES = ['starvation', 'operator_h5', 'replay_boundary'] as const;
type Cause = typeof CAUSE_VALUES[number];
function assertCause(c: string): asserts c is Cause {
  if (!(CAUSE_VALUES as readonly string[]).includes(c)) throw new Error(`invalid cause: ${c}`);
}
```

From grid/src/audit/broadcast-allowlist.ts (existing file) — extend from 19→21:
- Append 'bios.birth' at position 20, 'bios.death' at position 21
- Add BIOS_FORBIDDEN_KEYS = ['value', 'raw_value', 'rise_rate', 'threshold'] as const
- Add CHRONOS_FORBIDDEN_KEYS = ['subjective_multiplier', 'curiosity', 'boredom'] as const
- Extend FORBIDDEN_KEY_PATTERN to include both new matrices

From grid/src/genesis/launcher.ts:172, 297 — TWO spawn call sites:
- Line 172: initial genesis spawn loop
- Line 297: operator-requested spawn
- Both: after appendNousSpawned, call appendBiosBirth({did, tick, psycheHash}).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend broadcast allowlist 19→21 + privacy matrices</name>
  <files>grid/src/audit/broadcast-allowlist.ts, grid/src/bios/types.ts</files>
  <read_first>
    - grid/src/audit/broadcast-allowlist.ts (current 19-event list)
    - grid/src/audit/forbidden-keys.ts (if exists, else search for FORBIDDEN_KEY_PATTERN)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-01 allowlist correction, D-10b-03 payload shapes)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md (allowlist extension section)
  </read_first>
  <behavior>
    - BROADCAST_ALLOWLIST has exactly 21 members (sorted order preserved, bios.birth and bios.death appended)
    - BIOS_FORBIDDEN_KEYS = ['value', 'raw_value', 'rise_rate', 'threshold'] (flat + nested)
    - CHRONOS_FORBIDDEN_KEYS = ['subjective_multiplier', 'curiosity', 'boredom']
    - bios/types.ts exports BiosBirthPayload = { did: string; tick: number; psycheHash: string }
    - bios/types.ts exports BiosDeathPayload = { did: string; tick: number; cause: Cause; finalStateHash: string }
    - CAUSE_VALUES literal-guarded constant exported
  </behavior>
  <action>
Edit `grid/src/audit/broadcast-allowlist.ts`:
- Find the existing `export const BROADCAST_ALLOWLIST = [...]` array
- Append `'bios.birth'` and `'bios.death'` as the last two entries (maintain alphabetical-within-namespace order: bios.* comes before chronos.* would if added, but Chronos has no wire events per D-10b-07)
- Update the size assertion/comment: `// 21 events: 19 from phases 1-10a + bios.birth + bios.death (+2 per Phase 10b)`
- Add below the existing FORBIDDEN_KEYS:
```ts
export const BIOS_FORBIDDEN_KEYS = [
  'value', 'raw_value', 'rise_rate', 'threshold',
  'hysteresis_band', 'tau', 'decay_factor',
] as const;

export const CHRONOS_FORBIDDEN_KEYS = [
  'subjective_multiplier', 'curiosity', 'boredom',
  'curiosity_boost', 'boredom_penalty',
] as const;
```
- Extend the FORBIDDEN_KEY_PATTERN regex (or equivalent filter) to union both new matrices so any attempt to include these keys in a broadcast payload fails the closed-tuple gate.

Create `grid/src/bios/types.ts`:
```ts
/**
 * Bios event payload types. Closed-tuple — exact keys only, sorted equality.
 * Per Phase 10b CONTEXT.md D-10b-03.
 */

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
  </action>
  <verify>
    <automated>cd grid && bun test test/audit/allowlist-twenty-one.test.ts test/audit/closed-enum-bios-lifecycle.test.ts test/privacy/bios-forbidden-keys.test.ts test/privacy/chronos-forbidden-keys.test.ts --run</automated>
  </verify>
  <done>Allowlist exactly 21 members. bios.resurrect / bios.migrate / bios.transfer rejected. BIOS_FORBIDDEN_KEYS and CHRONOS_FORBIDDEN_KEYS enforced at payload gate.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Sole-producer emitters appendBiosBirth + appendBiosDeath</name>
  <files>grid/src/bios/appendBiosBirth.ts, grid/src/bios/appendBiosDeath.ts, grid/src/bios/index.ts</files>
  <read_first>
    - grid/src/ananke/append-drive-crossed.ts (full file, lines 59-133 are the clone target)
    - grid/src/audit/append-nous-deleted.ts (lines 78-87, CAUSE literal-guard pattern)
    - grid/src/genesis/nous-registry.ts (tombstone API from Phase 8 D-33/D-34)
    - grid/src/bios/types.ts (from Task 1)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md (sole-producer + 8-step validation pattern)
  </read_first>
  <behavior>
    - appendBiosBirth({did, tick, psycheHash}) → hash string after 8-step validation
    - appendBiosDeath({did, tick, cause, finalStateHash}) → hash string; cause must pass assertCause
    - Both perform: closed-tuple strict-eq (Object.keys().sort() === KEYS), tombstone check, privacy grep
    - Both use auditChain.append('bios.birth'|'bios.death', payload) — sole producer
    - Post-death emission of bios.death for a DID throws "already tombstoned"
    - index.ts barrel exports both functions + types
  </behavior>
  <action>
Create `grid/src/bios/appendBiosBirth.ts` (clone ananke/append-drive-crossed.ts:59-133 structure):
```ts
import { AuditChain } from '../audit/chain.js';
import { NousRegistry } from '../genesis/nous-registry.js';
import { BIOS_FORBIDDEN_KEYS } from '../audit/broadcast-allowlist.js';
import { BiosBirthPayload, BIOS_BIRTH_KEYS } from './types.js';

const DID_REGEX = /^did:nous:[a-z0-9]{32}$/;

export interface AppendBiosBirthDeps {
  chain: AuditChain;
  registry: NousRegistry;
  currentTick: () => number;
}

export async function appendBiosBirth(
  deps: AppendBiosBirthDeps,
  payload: BiosBirthPayload,
): Promise<string> {
  // Step 1: resolve tick
  const systemTick = deps.currentTick();
  if (payload.tick !== systemTick) {
    throw new Error(`bios.birth tick mismatch: payload=${payload.tick} system=${systemTick}`);
  }

  // Step 2: DID regex
  if (!DID_REGEX.test(payload.did)) {
    throw new Error(`invalid DID format: ${payload.did}`);
  }

  // Step 3: psycheHash format (64-char hex)
  if (!/^[0-9a-f]{64}$/.test(payload.psycheHash)) {
    throw new Error(`invalid psycheHash format`);
  }

  // Step 4: closed-tuple strict-equality gate
  const keys = Object.keys(payload).sort();
  const expected = [...BIOS_BIRTH_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new Error(`bios.birth payload shape violation: got ${JSON.stringify(keys)}, expected ${JSON.stringify(expected)}`);
  }

  // Step 5: privacy grep — no forbidden keys at any depth
  const jsonStr = JSON.stringify(payload);
  for (const forbidden of BIOS_FORBIDDEN_KEYS) {
    if (jsonStr.includes(`"${forbidden}"`)) {
      throw new Error(`bios.birth leaks forbidden key: ${forbidden}`);
    }
  }

  // Step 6: tombstone check — DID must not be already tombstoned
  if (deps.registry.isTombstoned(payload.did)) {
    throw new Error(`cannot re-birth tombstoned DID: ${payload.did}`);
  }

  // Step 7: append to audit chain (sole producer)
  const hash = await deps.chain.append('bios.birth', payload);

  // Step 8: telemetry (observability only, no wall-clock in state)
  return hash;
}
```

Create `grid/src/bios/appendBiosDeath.ts` (same structure + CAUSE literal-guard):
```ts
import { AuditChain } from '../audit/chain.js';
import { NousRegistry } from '../genesis/nous-registry.js';
import { BIOS_FORBIDDEN_KEYS } from '../audit/broadcast-allowlist.js';
import { BiosDeathPayload, BIOS_DEATH_KEYS, assertCause } from './types.js';

const DID_REGEX = /^did:nous:[a-z0-9]{32}$/;

export interface AppendBiosDeathDeps {
  chain: AuditChain;
  registry: NousRegistry;
  currentTick: () => number;
}

export async function appendBiosDeath(
  deps: AppendBiosDeathDeps,
  payload: BiosDeathPayload,
): Promise<string> {
  const systemTick = deps.currentTick();
  if (payload.tick !== systemTick) {
    throw new Error(`bios.death tick mismatch: payload=${payload.tick} system=${systemTick}`);
  }
  if (!DID_REGEX.test(payload.did)) {
    throw new Error(`invalid DID format: ${payload.did}`);
  }
  if (!/^[0-9a-f]{64}$/.test(payload.finalStateHash)) {
    throw new Error(`invalid finalStateHash format`);
  }
  assertCause(payload.cause); // literal-guard: throws on unknown cause

  const keys = Object.keys(payload).sort();
  const expected = [...BIOS_DEATH_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new Error(`bios.death payload shape violation: got ${JSON.stringify(keys)}`);
  }

  const jsonStr = JSON.stringify(payload);
  for (const forbidden of BIOS_FORBIDDEN_KEYS) {
    if (jsonStr.includes(`"${forbidden}"`)) {
      throw new Error(`bios.death leaks forbidden key: ${forbidden}`);
    }
  }

  if (deps.registry.isTombstoned(payload.did)) {
    throw new Error(`cannot re-kill tombstoned DID: ${payload.did}`);
  }

  const hash = await deps.chain.append('bios.death', payload);
  // NousRegistry tombstones on bios.death (extend registry listener per Phase 8 D-33)
  deps.registry.tombstone(payload.did);
  return hash;
}
```

Create `grid/src/bios/index.ts`:
```ts
export { appendBiosBirth } from './appendBiosBirth.js';
export { appendBiosDeath } from './appendBiosDeath.js';
export type { BiosBirthPayload, BiosDeathPayload, Cause } from './types.js';
export { CAUSE_VALUES, assertCause } from './types.js';
```
  </action>
  <verify>
    <automated>cd grid && bun test test/bios/append-bios-birth-boundary.test.ts test/bios/append-bios-death-boundary.test.ts test/ci/bios-no-walltime.test.ts --run</automated>
  </verify>
  <done>Both emitters exist; sole-producer grep (`rg "auditChain\\.append\\(['\"]bios\\." grid/src/`) returns exactly 2 files. Closed-tuple + CAUSE guards enforced. Tombstone gating verified.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire appendBiosBirth into launcher.ts (2 spawn sites)</name>
  <files>grid/src/genesis/launcher.ts</files>
  <read_first>
    - grid/src/genesis/launcher.ts (full file — identify lines 172 and 297 spawn sites)
    - grid/src/bios/appendBiosBirth.ts (from Task 2)
    - grid/src/audit/append-nous-spawned.ts (order reference: bios.birth immediately after nous.spawned)
  </read_first>
  <behavior>
    - Both launcher spawn sites (genesis initial + operator-requested) call appendBiosBirth after appendNousSpawned
    - ORDER: appendNousSpawned → appendBiosBirth within same tick
    - psycheHash sourced from the Psyche bootstrap (existing Phase 9 artifact)
    - Zero new dependencies beyond grid/src/bios/
  </behavior>
  <action>
Edit `grid/src/genesis/launcher.ts`:
- Add import at top: `import { appendBiosBirth } from '../bios/index.js';`
- At line ~172 (initial genesis spawn loop): immediately after the existing `await appendNousSpawned(...)` call, add:
```ts
await appendBiosBirth(
  { chain: deps.chain, registry: deps.registry, currentTick: deps.currentTick },
  { did, tick: currentTick, psycheHash },
);
```
- At line ~297 (operator-requested spawn): same insertion after `appendNousSpawned`.
- Confirm `psycheHash` is in scope at both sites (it's computed by the Psyche bootstrap before spawn). If not in scope at site 2, pass it through the spawn request parameter added to the request handler signature.
- Do NOT modify the audit chain logic, tick resolution, or registry semantics. Pure additive wiring.
  </action>
  <verify>
    <automated>cd grid && bun test test/regression/pause-resume-10b.test.ts test/ananke/audit-size-ceiling-10b.test.ts --run</automated>
  </verify>
  <done>Both spawn sites emit appendBiosBirth. Grep: `rg "appendBiosBirth" grid/src/genesis/launcher.ts | wc -l` returns 2+ (1 import, 2 calls). Regression hash unchanged for pause/resume zero-diff.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Grid → Dashboard wire | bios.birth/death events broadcast; must honor closed-tuple + forbidden-key gates |
| Operator API → Grid | cause='operator_h5' must only be settable by authenticated operator endpoint |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-03-01 | Tampering | Allowlist bypass via string-munging | mitigate | Allowlist is `as const` literal union; extension requires TS compile |
| T-10b-03-02 | Spoofing | Forge bios.death with fake cause | mitigate | assertCause literal-guard + TypeScript exhaustive narrowing |
| T-10b-03-03 | Information Disclosure | Raw value leak via forbidden key | mitigate | BIOS_FORBIDDEN_KEYS privacy grep at append-time (step 5) |
| T-10b-03-04 | Elevation of Privilege | Re-birth tombstoned DID | mitigate | NousRegistry.isTombstoned check (step 6) |
| T-10b-03-05 | Repudiation | bios.death without tombstone | mitigate | appendBiosDeath calls registry.tombstone on success |
</threat_model>

<verification>
- `cd grid && bun test test/bios/ test/audit/allowlist-twenty-one.test.ts test/privacy/bios-forbidden-keys.test.ts test/privacy/chronos-forbidden-keys.test.ts --run` — all GREEN
- `rg "auditChain\\.append\\(['\"]bios\\.(birth|death)" grid/src/ | awk -F: '{print $1}' | sort -u` returns exactly 2 files (sole-producer)
- `rg "'bios\\.(birth|death)'" grid/src/audit/broadcast-allowlist.ts` returns 2 matches
- `rg "appendBiosBirth\\(" grid/src/genesis/launcher.ts` returns 2 matches (both spawn sites)
</verification>

<success_criteria>
- Allowlist has exactly 21 members, with bios.birth and bios.death added
- BIOS_FORBIDDEN_KEYS + CHRONOS_FORBIDDEN_KEYS in effect
- Sole-producer invariant holds for bios.birth and bios.death (grep verified)
- Closed-tuple payload gate active (any extra/missing key → throw)
- CAUSE enum literal-guarded — bios.death with cause='unknown' rejected
- Phase 6 pause/resume zero-diff regression hash unchanged with bios events in stream
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-03-SUMMARY.md`
</output>
