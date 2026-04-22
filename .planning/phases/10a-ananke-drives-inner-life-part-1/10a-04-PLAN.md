---
phase: 10a-ananke-drives-inner-life-part-1
plan: 04
type: execute
wave: 2
depends_on: [10a-02]
files_modified:
  - grid/src/integration/types.ts
  - grid/src/integration/nous-runner.ts
  - grid/test/integration/nous-runner-ananke.test.ts
  - grid/test/integration/brain-action-to-audit.test.ts
autonomous: true
requirements: [DRIVE-03, DRIVE-05]
schema_push: not_applicable
user_setup: []

must_haves:
  truths:
    - "When the Brain returns an Action with action_type=='drive_crossed', the nous-runner dispatcher invokes appendAnankeDriveCrossed exactly once, with the correct (did, tick) injection"
    - "The Grid injects the local tick counter and the connecting DID; Brain's 3-key metadata becomes the 5-key payload"
    - "If the Brain emits an Action with an action_type outside the closed enum (e.g., 'drive_raised'), the dispatcher silently drops it (logs at warn level) — no side effect on the chain"
    - "Multiple DRIVE_CROSSED actions in one Brain return produce multiple audit entries in chain-arrival order"
    - "The dispatcher does NOT call appendAnankeDriveCrossed for any non-DRIVE_CROSSED action; legacy dispatchers (speak/move/telos_refined) are untouched"
  artifacts:
    - path: grid/src/integration/types.ts
      provides: "Extended BrainAction type to include 'drive_crossed' variant with 3-key metadata"
      contains: "drive_crossed"
    - path: grid/src/integration/nous-runner.ts
      provides: "Dispatcher branch that converts drive_crossed Action → appendAnankeDriveCrossed call with did+tick injection"
      contains: "appendAnankeDriveCrossed"
    - path: grid/test/integration/nous-runner-ananke.test.ts
      provides: "Dispatcher unit test — mocked Brain returns DRIVE_CROSSED action, asserts appendAnankeDriveCrossed invocation shape"
      min_lines: 90
    - path: grid/test/integration/brain-action-to-audit.test.ts
      provides: "End-to-end integration — mocked Brain stream → nous-runner → audit chain, asserts entry shape and ordering"
      min_lines: 70
  key_links:
    - from: grid/src/integration/nous-runner.ts
      to: grid/src/ananke/append-drive-crossed.ts
      via: "dispatcher branch calls appendAnankeDriveCrossed with {did, tick, drive, level, direction}"
      pattern: "appendAnankeDriveCrossed\\("
    - from: grid/src/integration/nous-runner.ts
      to: grid/src/integration/types.ts
      via: "BrainAction discriminated union includes drive_crossed variant"
      pattern: "drive_crossed"
---

<objective>
Wire the Grid's `nous-runner` dispatcher to convert Brain `Action(action_type=DRIVE_CROSSED)` returns into `ananke.drive_crossed` audit entries via `appendAnankeDriveCrossed`. The Grid injects the authoritative `tick` (from `WorldClock`) and the connecting `did` (from the runner's context) — realizing the 3-keys-not-5 invariant end-to-end. Depends on Plan 10a-02 (emitter exists).

Purpose: DRIVE-03 (final wiring to chain) + DRIVE-05 (wire-side enforcement — any float that sneaks into `action.metadata` fails the enum-validation or closed-tuple check in `appendAnankeDriveCrossed` and is rejected before the chain).

Output: 2 modified files + 2 test files.
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
@grid/src/ananke/append-drive-crossed.ts
@grid/src/ananke/types.ts
@grid/src/audit/broadcast-allowlist.ts
@grid/src/integration/nous-runner.ts
@grid/src/integration/types.ts

<locked_decisions>
- **3-keys-not-5 invariant:** Brain sends `metadata = {drive, level, direction}` (3 keys); Grid injects `did` (from runner context) and `tick` (from WorldClock) to form the 5-key payload. This keeps the Brain DID-agnostic.
- **Dispatcher extensibility (RESEARCH Assumption A3):** The existing `nous-runner.ts` dispatcher already handles `speak | direct_message | move | trade_request | telos_refined | noop`. The `drive_crossed` branch is a new case statement — NO restructuring, just an extension. If the current dispatcher is structured as an exhaustive `switch` on `action.action_type`, the default branch must continue to log-warn-and-drop unknown action types.
- **Tick source:** `tick` is an integer from `WorldClock.getTick()` (or the equivalent accessor on the runner's context). NEVER `Date.now()`, NEVER a wall-clock stamp. Inherited Phase 5 discipline.
</locked_decisions>

<analog_sources>
**Dispatcher template:** `grid/src/integration/nous-runner.ts` — read in full. The existing `telos_refined` dispatcher branch (if present — introduced in Phase 7 DIALOG-02) is the line-for-line clone source. `drive_crossed` follows the identical pattern: validate metadata shape, call the sole-producer function, handle error.

**Type extension:** `grid/src/integration/types.ts` — read in full. Look for the existing `BrainAction` discriminated union (or equivalent name — may be `Action` or `NousAction`). Add a `drive_crossed` variant following the same pattern.

**End-to-end test template:** The Phase 7 E2E test for `telos.refined` establishes the stream→dispatcher→chain mock harness. If such a test exists at `grid/test/integration/*telos*.test.ts`, clone its structure.
</analog_sources>

<interfaces>
```typescript
// grid/src/integration/types.ts
// EDIT — extend BrainAction discriminated union.

// If the existing file has a shape like:
//   export type BrainAction =
//     | { action_type: 'speak'; channel: string; text: string; metadata?: {...} }
//     | { action_type: 'telos_refined'; ... }
//     | { action_type: 'noop'; ... };
// then add:

// Phase 10a DRIVE-03 — Ananke threshold-crossing Action variant.
// Metadata is exactly 3 keys: {drive, level, direction}.
// Grid injects did (from runner context) + tick (from WorldClock).
// Closed enums mirrored from grid/src/ananke/types.ts.
export interface BrainActionDriveCrossed {
    readonly action_type: 'drive_crossed';
    readonly channel: '';   // always empty for DRIVE_CROSSED
    readonly text: '';      // always empty
    readonly metadata: {
        readonly drive: AnankeDriveName;
        readonly level: AnankeDriveLevel;
        readonly direction: AnankeDirection;
    };
}

// And extend the union:
//   export type BrainAction = ... | BrainActionDriveCrossed;
```

```typescript
// grid/src/integration/nous-runner.ts
// EDIT — add dispatcher branch.

import { appendAnankeDriveCrossed } from '../ananke/index.js';

// Inside the dispatch switch (or if-else chain):
case 'drive_crossed': {
    try {
        appendAnankeDriveCrossed(this.auditChain, this.did, {
            did: this.did,
            tick: this.worldClock.getTick(),
            drive: action.metadata.drive,
            level: action.metadata.level,
            direction: action.metadata.direction,
        });
    } catch (err) {
        // Shape/enum validation failures are developer bugs — log and drop.
        // Do NOT throw; other actions in this tick batch must still dispatch.
        this.logger.warn({
            event: 'ananke.dispatch.rejected',
            did: this.did,
            reason: (err as Error).message,
        });
    }
    break;
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend BrainAction type + add drive_crossed dispatcher branch</name>
  <files>
    grid/src/integration/types.ts,
    grid/src/integration/nous-runner.ts
  </files>
  <read_first>
    - Read `grid/src/integration/types.ts` in full — identify the exact name of the discriminated union (likely `BrainAction` or `NousAction`), the exact shape of the `telos_refined` variant (it's the closest analog, Phase 7 precedent), and the existing import structure.
    - Read `grid/src/integration/nous-runner.ts` in full — find the dispatch logic (likely a `switch(action.action_type)` or a function map). Identify the runner's existing `this.did`, `this.auditChain`, `this.worldClock`, and `this.logger` references. If naming differs, use the existing names.
    - Read `grid/src/clock/` or wherever `WorldClock.getTick()` is defined to confirm the exact accessor. If it's `worldClock.tick` or `worldClock.now().tick`, use the existing accessor.
    - Read `grid/src/ananke/append-drive-crossed.ts` (just created in Plan 10a-02) to confirm the `appendAnankeDriveCrossed` signature.
  </read_first>
  <behavior>
    - TypeScript compilation (`pnpm tsc --noEmit`) succeeds after the edits.
    - `BrainAction` (or equivalent union name) now has 7 variants including `drive_crossed`.
    - An exhaustive `switch` over `action.action_type` with no `default` case would fail TypeScript's exhaustiveness check UNLESS the `drive_crossed` case is handled — asserting the new case is wired.
    - The dispatcher calls `appendAnankeDriveCrossed` with exactly: `(this.auditChain, this.did, {did, tick, drive, level, direction})`.
    - On `appendAnankeDriveCrossed` throwing (e.g., enum mismatch), the dispatcher CATCHES the error and logs at warn level — it does NOT rethrow (other actions in the same batch must still dispatch).
    - No other dispatcher branch is modified; `telos_refined`, `speak`, `move`, etc. continue to dispatch as before.
    - **Tick source is `worldClock.getTick()`** (or the existing accessor name) — NOT `Date.now()`.
  </behavior>
  <action>
    1. **Edit `grid/src/integration/types.ts`:**
       - At the top of the file (after existing imports), add:
         ```typescript
         import type { AnankeDriveName, AnankeDriveLevel, AnankeDirection } from '../ananke/types.js';
         ```
       - Add the `BrainActionDriveCrossed` interface (from `<interfaces>`).
       - Extend the discriminated union (locate it — likely `export type BrainAction = ...`) by appending `| BrainActionDriveCrossed`.
       - Do NOT modify any existing variant.

    2. **Edit `grid/src/integration/nous-runner.ts`:**
       - At the top of the file, add:
         ```typescript
         import { appendAnankeDriveCrossed } from '../ananke/index.js';
         ```
       - Locate the dispatcher (a `switch (action.action_type)` statement on the Brain's returned actions — the Phase 7 `'telos_refined'` case is the closest analog).
       - Insert the new `case 'drive_crossed':` branch immediately before the `case 'noop':` (or `default:`) branch. Use the exact code from the `<interfaces>` block.
       - Do NOT modify any existing case.
       - If the dispatcher uses a helper function map rather than a switch, register `drive_crossed` in the map with the same behavior.

    3. **Tick accessor reconciliation:** If the runner does not expose `worldClock.getTick()` directly but has, say, `this.clock.getTick()` or `this.tick`, use the existing name. The test in Task 2 will mock the specific accessor name, so consistency is what matters.

    4. **Error handling discipline:** the `try/catch` MUST log (via the existing `this.logger` — whatever its exact interface is) and break out of the case. Do NOT `return` (that would abort the remaining actions in the batch). Do NOT rethrow.
  </action>
  <verify>
    <automated>cd grid && pnpm tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm tsc --noEmit` exits 0 in the `grid` workspace.
    - `grep -n "drive_crossed" grid/src/integration/types.ts` returns ≥ 2 matches (interface name + variant literal).
    - `grep -n "appendAnankeDriveCrossed" grid/src/integration/nous-runner.ts` returns exactly 1 match (the dispatcher call).
    - `grep -n "Date.now\|performance.now\|setInterval" grid/src/integration/nous-runner.ts` — ANY match must pre-date this plan (i.e., not introduced by the Ananke wiring). The plan's own edits add zero wall-clock calls.
    - The `case 'drive_crossed':` block is ≤ 15 lines (not a full method).
  </acceptance_criteria>
  <done>
    BrainAction type extended with `drive_crossed` variant; dispatcher routes it to `appendAnankeDriveCrossed` with `did`+`tick` injected from runner context. TypeScript build clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Dispatcher unit test + end-to-end Brain-to-audit integration test</name>
  <files>
    grid/test/integration/nous-runner-ananke.test.ts,
    grid/test/integration/brain-action-to-audit.test.ts
  </files>
  <read_first>
    - Read an existing integration test `grid/test/integration/*.test.ts` to identify the fixture pattern for constructing a mock `NousRunner` (mocked AuditChain, fake WorldClock with settable tick, mocked logger).
    - Read `grid/test/integration/*telos*.test.ts` (if exists) for the Phase 7 TELOS_REFINED dispatcher test — clone its structure for the new DRIVE_CROSSED test.
    - Read `grid/src/audit/chain.ts` to understand the AuditChain interface — the tests will either use a real in-memory chain or a mock.
  </read_first>
  <behavior>
    **Unit test (`nous-runner-ananke.test.ts`) assertions:**
    - Given a mocked Brain returning `[Action(DRIVE_CROSSED, metadata={drive:'hunger', level:'med', direction:'rising'})]` and a runner with `did='did:noesis:alpha'` and `worldClock.getTick() === 100`, after `runner.dispatchActions(actions)`, the chain receives exactly one entry:
      - `entry.type === 'ananke.drive_crossed'`
      - `entry.payload === {did: 'did:noesis:alpha', tick: 100, drive: 'hunger', level: 'med', direction: 'rising'}` (deep equality).
    - Given a mocked Brain returning `[Action(DRIVE_CROSSED, {drive:'hunger', level:'med', direction:'rising'}), Action(DRIVE_CROSSED, {drive:'curiosity', level:'high', direction:'rising'})]`, the chain receives 2 entries in the same order.
    - Given a malformed action (`metadata.drive === 'energy'`), the dispatcher catches the error, calls `logger.warn` with `event: 'ananke.dispatch.rejected'`, and the chain remains unchanged.
    - Non-DRIVE_CROSSED actions (e.g., `Action(SPEAK)`) do NOT call `appendAnankeDriveCrossed` — assert via spy.

    **E2E test (`brain-action-to-audit.test.ts`) assertions:**
    - Using a real `AuditChain`, feed a simulated Brain stream that returns 10 `DRIVE_CROSSED` actions over 10 ticks (tick values 1..10); assert the chain ends with 10 `ananke.drive_crossed` entries, each with `payload.tick` matching the tick at which it was dispatched.
    - Assert `isAllowlisted('ananke.drive_crossed') === true` for the final chain state (the entry would pass to broadcast).
    - Regression: no non-ananke entry types appear unexpectedly in the chain.
  </behavior>
  <action>
    1. **Create `grid/test/integration/nous-runner-ananke.test.ts`:**
       ```typescript
       import { describe, it, expect, vi, beforeEach } from 'vitest';
       import { appendAnankeDriveCrossed } from '../../src/ananke/index.js';
       // Import the runner (exact path varies — adapt to actual export)
       import { NousRunner } from '../../src/integration/nous-runner.js';
       // Plus AuditChain factory / MockChain helper — clone from existing tests

       vi.mock('../../src/ananke/index.js', async (importOriginal) => {
           const actual = await importOriginal<typeof import('../../src/ananke/index.js')>();
           return {
               ...actual,
               appendAnankeDriveCrossed: vi.fn(actual.appendAnankeDriveCrossed),
           };
       });

       describe('nous-runner dispatches drive_crossed → appendAnankeDriveCrossed', () => {
           let runner: NousRunner;
           let chain: AuditChain;  // real in-memory chain
           let clock: { getTick: () => number };
           let logger: { warn: ReturnType<typeof vi.fn> };

           beforeEach(() => {
               // construct real chain + runner here, matching existing test fixture
               clock = { getTick: () => 100 };
               logger = { warn: vi.fn() };
               runner = new NousRunner({
                   did: 'did:noesis:alpha',
                   auditChain: chain,
                   worldClock: clock,
                   logger,
               });
               (appendAnankeDriveCrossed as any).mockClear();
           });

           it('lifts drive_crossed action → audit entry with injected did+tick', async () => {
               const action = {
                   action_type: 'drive_crossed' as const,
                   channel: '' as const,
                   text: '' as const,
                   metadata: { drive: 'hunger', level: 'med', direction: 'rising' } as const,
               };
               await runner.dispatchActions([action]);
               expect(appendAnankeDriveCrossed).toHaveBeenCalledExactlyOnceWith(
                   chain,
                   'did:noesis:alpha',
                   { did: 'did:noesis:alpha', tick: 100, drive: 'hunger', level: 'med', direction: 'rising' },
               );
           });

           it('dispatches multiple drive_crossed actions in order', async () => {
               const a1 = { action_type: 'drive_crossed', channel: '', text: '',
                            metadata: { drive: 'hunger', level: 'med', direction: 'rising' } } as any;
               const a2 = { action_type: 'drive_crossed', channel: '', text: '',
                            metadata: { drive: 'curiosity', level: 'high', direction: 'rising' } } as any;
               await runner.dispatchActions([a1, a2]);
               expect(appendAnankeDriveCrossed).toHaveBeenCalledTimes(2);
               expect(chain.entries.filter((e: any) => e.type === 'ananke.drive_crossed')).toHaveLength(2);
           });

           it('logs warn and drops on enum-mismatch metadata (does not throw)', async () => {
               const bad = { action_type: 'drive_crossed', channel: '', text: '',
                             metadata: { drive: 'energy', level: 'med', direction: 'rising' } } as any;
               await runner.dispatchActions([bad]);
               expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
                   event: 'ananke.dispatch.rejected',
               }));
               expect(chain.entries.filter((e: any) => e.type === 'ananke.drive_crossed')).toHaveLength(0);
           });

           it('ignores non-drive_crossed actions for ananke path', async () => {
               const speak = { action_type: 'speak', channel: 'agora', text: 'hi', metadata: {} } as any;
               await runner.dispatchActions([speak]);
               expect(appendAnankeDriveCrossed).not.toHaveBeenCalled();
           });
       });
       ```

       (Fixture construction exact signatures depend on actual NousRunner constructor — the executor adapts, but the ASSERTION shape is locked.)

    2. **Create `grid/test/integration/brain-action-to-audit.test.ts`:**
       ```typescript
       import { describe, it, expect } from 'vitest';
       import { isAllowlisted } from '../../src/audit/broadcast-allowlist.js';
       // Construct a real runner + real chain + simulated brain stream

       describe('Brain drive_crossed actions flow end-to-end → ananke.drive_crossed audit entries', () => {
           it('10 ticks, 10 drive_crossed actions → 10 audit entries with correct ticks', async () => {
               // construct: chain, runner with did='did:noesis:alpha'
               // For each tick t in 1..10:
               //   set clock.getTick() = t
               //   invoke runner.dispatchActions([{action_type:'drive_crossed', ...}])
               // Assert chain entries are 10 ananke.drive_crossed events with payload.tick === t_i
               const driveCrossedEntries = chain.entries.filter((e: any) => e.type === 'ananke.drive_crossed');
               expect(driveCrossedEntries).toHaveLength(10);
               for (let i = 0; i < 10; i++) {
                   expect(driveCrossedEntries[i].payload.tick).toBe(i + 1);
               }
               // allowlist verification
               expect(isAllowlisted('ananke.drive_crossed')).toBe(true);
           });
       });
       ```
  </action>
  <verify>
    <automated>cd grid && pnpm vitest run test/integration/nous-runner-ananke.test.ts test/integration/brain-action-to-audit.test.ts -q</automated>
  </verify>
  <acceptance_criteria>
    - Both test files pass; combined test count ≥ 5.
    - The unit test's "mismatch metadata" case verifies `logger.warn` fires and the chain is unchanged — proving the dispatcher's try/catch discipline.
    - The E2E test asserts `payload.tick === expected_tick` per entry — proving Grid injects the authoritative tick.
    - `pnpm vitest run test/integration -q` (all integration tests) exits 0 — no regression.
  </acceptance_criteria>
  <done>
    Dispatcher branch verified end-to-end. Brain→Grid→chain produces correctly-shaped audit entries with Grid-injected did+tick. Enum mismatches fail safe (logged + dropped, not thrown).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain→Grid (RPC return) | Action.metadata crosses here; Grid treats it as untrusted until `appendAnankeDriveCrossed` validates. |
| Grid internal (dispatcher→chain) | After validation, payload is trusted and appended. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10a-16 | Tampering | Malformed metadata from a compromised Brain | mitigate | `appendAnankeDriveCrossed` validates enum + closed-tuple before chain.append. Dispatcher wraps the call in try/catch and logs rejections as `ananke.dispatch.rejected`. (Addresses T-09-02: structurally prevents drive floats reaching chain even if Brain misbehaves.) |
| T-10a-17 | Information Disclosure | Tick value leaking wall-clock time | mitigate | Tick comes from `worldClock.getTick()` — a monotonically-increasing integer, not a wall-clock stamp. Plan 10a-06 grep gate forbids `Date.now|performance.now|setInterval` in `grid/src/ananke/**` AND in `grid/src/integration/nous-runner.ts` (ananke block). (Addresses T-09-03: wall-clock coupling forbidden at dispatcher.) |
| T-10a-18 | Denial of Service | One malformed action aborting the whole batch | mitigate | try/catch per action ensures one rejection does not prevent sibling actions from dispatching. Unit test `logs warn and drops on enum-mismatch` asserts this. |
| T-10a-19 | Elevation of Privilege | Brain forging a DID in payload | mitigate | The dispatcher EXPLICITLY sets `did: this.did` — it ignores `action.metadata.did` if the Brain accidentally included it (which would already fail the closed-tuple check since metadata has 3 keys, not 4). Self-report invariant enforced by `appendAnankeDriveCrossed` (`payload.did === actorDid`). |
| T-10a-20 | Spoofing | Dispatcher emitting for wrong DID | mitigate | `this.did` is set at runner construction and never mutated. One runner = one DID. Cross-DID emission structurally impossible. |
</threat_model>

<verification>
Gate checklist:
- [ ] `pnpm tsc --noEmit` clean in `grid/`.
- [ ] `pnpm vitest run test/integration -q` exits 0.
- [ ] Grid dispatcher calls `appendAnankeDriveCrossed` with 5-key payload (did+tick injected from runner context, drive+level+direction from Brain metadata).
- [ ] Enum-mismatch actions log `ananke.dispatch.rejected` at warn and do NOT append to chain.
- [ ] No `Date.now` / `performance.now` introduced by this plan's edits.
</verification>

<success_criteria>
- DRIVE-03 fully delivered: Brain→Grid→chain pathway produces correctly-shaped `ananke.drive_crossed` audit entries, end-to-end.
- DRIVE-05 defended at dispatcher: even a compromised Brain returning a float-carrying metadata is rejected before the chain.
- 3-keys-not-5 invariant realized structurally: Brain cannot know its own DID or tick, and doesn't need to.
</success_criteria>

<output>
After completion, create `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-04-SUMMARY.md`.
</output>
