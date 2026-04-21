---
phase: 7
plan_id: 01
slug: grid-aggregator
status: draft
wave: 1
wave_deps: []
requirement_refs: [DIALOG-01]
context_refs: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-25, D-26]
files_modified:
  - grid/src/dialogue/types.ts
  - grid/src/dialogue/dialogue-id.ts
  - grid/src/dialogue/aggregator.ts
  - grid/src/dialogue/index.ts
  - grid/src/integration/types.ts
  - grid/src/integration/grid-coordinator.ts
  - grid/src/integration/nous-runner.ts
  - grid/src/genesis/launcher.ts
  - grid/src/genesis/types.ts
  - grid/test/dialogue/dialogue-id.test.ts
  - grid/test/dialogue/aggregator.test.ts
  - grid/test/dialogue/zero-diff.test.ts
  - grid/test/dialogue/boundary.test.ts
autonomous: true
must_haves:
  truths:
    - "Two Nous exchanging ≥minExchanges bidirectional utterances on the same channel within a sliding windowTicks window cause the aggregator to mint a dialogue_id and surface a DialogueContext to BOTH participants on their next sendTick."
    - "dialogue_id is deterministic: computeDialogueId(sortedDids, channel, windowStartTick) produces identical output for identical input, regardless of observation order."
    - "TickParams widens additively — existing callers that omit dialogue_context continue to work unchanged."
    - "WorldClock.pause() drains the aggregator buffer — no cross-pause dialogue aggregation."
  artifacts:
    - path: grid/src/dialogue/aggregator.ts
      provides: "DialogueAggregator class with onAppend listener, drainPending(did, tick), reset()"
    - path: grid/src/dialogue/dialogue-id.ts
      provides: "computeDialogueId pure function"
    - path: grid/src/dialogue/types.ts
      provides: "DialogueContext, SpokeWindow TS interfaces"
    - path: grid/test/dialogue/dialogue-id.test.ts
      provides: "Wave-0 determinism + regex tests for computeDialogueId (RED-first)"
    - path: grid/test/dialogue/aggregator.test.ts
      provides: "Wave-0 behavioural tests for DialogueAggregator (RED-first)"
    - path: grid/test/dialogue/zero-diff.test.ts
      provides: "Wave-0 determinism gate: 0 vs N listeners → byte-identical chain head (RED-first)"
    - path: grid/test/dialogue/boundary.test.ts
      provides: "Wave-0 windowTicks boundary + pause-drain tests (RED-first; extended in Task 3)"
  key_links:
    - from: "grid/src/genesis/launcher.ts"
      to: "grid/src/dialogue/aggregator.ts"
      via: "constructor wiring; pause hook drains aggregator"
    - from: "grid/src/integration/grid-coordinator.ts"
      to: "grid/src/dialogue/aggregator.ts"
      via: "drainPending(runner.nousDid, tick) pulled per-tick before runner.tick(...)"
    - from: "grid/src/integration/nous-runner.ts"
      to: "recentDialogueIds rolling set"
      via: "populated on each sendTick with dialogue_context; consumed by Plan 03 telos_refined handler"
---

<objective>
Build the grid-side dialogue aggregation subsystem — the pure-function `computeDialogueId`, the listener-driven `DialogueAggregator` with sliding-window + bidirectional-pair semantics, the additive widening of `TickParams.dialogue_context?`, per-runner `recentDialogueIds` rolling set, and the GenesisLauncher wiring that owns lifetime + pause drain.

Purpose: DIALOG-01. Without this plan, no dialogue is ever detected and no downstream `telos.refined` path can fire. This plan also establishes the seam `recentDialogueIds` that Plan 03 consumes to authority-check Brain-returned `telos_refined` actions (prevents forgery).

**TDD discipline (revision 2026-04-21):** Tasks 1 and 3 are TDD-flipped. Test files are authored in the SAME task as the implementation, RED-first. Each task's `<action>` block lists the RED → GREEN sequence explicitly. Vitest must report real passing test assertions (not "0 tests found") at the end of each task.

Output: `grid/src/dialogue/{aggregator,dialogue-id,types,index}.ts`, widened `TickParams` in `grid/src/integration/types.ts`, pull-query wiring in `grid-coordinator.ts`, `recentDialogueIds` populated in `nous-runner.ts`, aggregator constructed + pause-drained from `genesis/launcher.ts`, plus the four `grid/test/dialogue/*.test.ts` files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-CONTEXT.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-RESEARCH.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-PATTERNS.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-VALIDATION.md

<interfaces>
<!-- Key existing contracts the executor must consume, not re-derive. Extracted from codebase. -->

From grid/src/audit/chain.ts (verified lines 50-58 per 07-RESEARCH.md):
```typescript
export class AuditChain {
    onAppend(listener: (entry: AuditEntry) => void): () => void;
    // Fires SYNCHRONOUSLY after commit (post-hash-write).
    // Does NOT fire on loadEntries() replay — important for determinism.
    append(eventType: string, actorDid: string, payload: object, targetDid?: string): AuditEntry;
}
export interface AuditEntry {
    readonly event_type: string;
    readonly actor_did: string;
    readonly payload: Record<string, unknown>;
    readonly tick: number;          // aggregator reads this (NOT Date.now)
    readonly hash: string;
}
```

From grid/src/integration/types.ts (current shape):
```typescript
export interface TickParams {
    tick: number;
    epoch: number;
}
export type BrainAction = SpeakAction | DirectMessageAction | MoveAction | NoopAction | TradeRequestAction;
```

From grid/src/integration/grid-coordinator.ts (verified lines 42-51 per 07-RESEARCH.md):
```typescript
this.launcher.clock.onTick(async (event) => {
    const { tick, epoch } = event;
    const tickPromises = [...this.runners.values()].map(runner =>
        runner.tick(tick, epoch).catch(err => log.error(...))
    );
    await Promise.all(tickPromises);
});
```

From grid/src/clock/ticker.ts (WorldClock):
```typescript
export class WorldClock {
    pause(): void;    // Phase 6 D-17: pause is a clean boundary
    resume(): void;
    onTick(cb: (event: {tick: number; epoch: number}) => void | Promise<void>): () => void;
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: TDD — dialogue_id + DialogueAggregator + zero-diff determinism (RED→GREEN in one task)</name>
  <files>grid/src/dialogue/types.ts, grid/src/dialogue/dialogue-id.ts, grid/src/dialogue/aggregator.ts, grid/src/dialogue/index.ts, grid/test/dialogue/dialogue-id.test.ts, grid/test/dialogue/aggregator.test.ts, grid/test/dialogue/zero-diff.test.ts</files>
  <read_first>
    - 07-PATTERNS.md §"`grid/src/dialogue/types.ts`" (copy readonly interface style from grid/src/integration/types.ts)
    - 07-PATTERNS.md §"`grid/src/dialogue/dialogue-id.ts`" (copy createHash+slice pattern from grid/src/api/operator/telos-force.ts HEX64_RE guard)
    - 07-PATTERNS.md §"`grid/src/dialogue/aggregator.ts`" (pattern-to-copy blocks: AuditChain listener subscription + pull-query drain)
    - grid/src/audit/chain.ts lines 50-58 — onAppend signature + post-commit firing semantics (do NOT fire on loadEntries)
    - grid/src/audit/operator-events.ts — HEX64_RE style for runtime guards
    - 07-CONTEXT.md D-01..D-12, D-25, D-26 — aggregator + dialogue_id + context shape semantics
    - 07-RESEARCH.md §"Pitfall 1" (no Date.now in aggregator; use entry.tick only)
    - 07-RESEARCH.md §"Pitfall 2" (Array.from(map.keys()).sort() before iterating)
  </read_first>
  <behavior>
    - **dialogue-id.test.ts:** computeDialogueId is order-independent over DIDs; output matches /^[0-9a-f]{16}$/; differs on any input change; passes ≥3 explicit assertions.
    - **aggregator.test.ts:** drainPending returns 0 windows with only 1 utterance; returns 1 DialogueContext on ≥2 bidirectional utterances within window; returns 0 on unidirectional stream; reset() clears state; ≥4 explicit assertions.
    - **zero-diff.test.ts:** 100 nous.spoke appends with 0 vs 10 passive listeners produce byte-identical chain `entries[].hash` arrays; aggregator listener is pure observer.
  </behavior>
  <action>
Create the test files FIRST (RED), then implement to make them GREEN. Each step is mandatory and sequenced — executor MUST NOT skip the RED phase.

**Step 1 (RED — tests authored before any production code):**

**1a.** Create `grid/test/dialogue/dialogue-id.test.ts`:
- `describe('computeDialogueId', ...)` with concrete `it(...)` cases:
  - "matches DIALOGUE_ID_RE (/^[0-9a-f]{16}$/)"
  - "is order-independent over dids"
  - "differs when channel differs"
  - "differs when windowStartTick differs"
- Each `it(...)` makes a real `expect(...)` assertion. NO `it.todo`, NO empty `describe`.
- Imports: `import { computeDialogueId, DIALOGUE_ID_RE } from '../../src/dialogue';` — these symbols do not yet exist, so the file fails to compile. That is the intended RED signal.

**1b.** Create `grid/test/dialogue/aggregator.test.ts`:
- `describe('DialogueAggregator', ...)` with `it(...)` cases:
  - "emits 0 contexts when only 1 utterance observed"
  - "emits 1 DialogueContext when ≥minExchanges bidirectional utterances occur within windowTicks"
  - "emits 0 contexts for unidirectional stream (same speaker repeating)"
  - "reset() drops all buffered state"
  - "Map iteration is deterministic (Array.from(...).sort() pattern)"
- Uses the real `AuditChain` from `../../src/audit/chain` to drive the listener.

**1c.** Create `grid/test/dialogue/zero-diff.test.ts`:
- `describe('dialogue — zero-diff determinism', ...)` with one `it(...)`:
  - "100 nous.spoke appends with 0 vs N passive DialogueAggregator listeners produce byte-identical entries[].hash chain head"
- The test creates two `AuditChain` instances with identical seed, runs 100 identical appends on each (one has N=10 aggregator listeners, the other N=0), then asserts `chainA.entries.map(e => e.hash)` deep-equals `chainB.entries.map(e => e.hash)`.

**1d.** Run `cd grid && pnpm test -- dialogue/dialogue-id dialogue/aggregator dialogue/zero-diff --run 2>&1 | tail -40` — MUST fail (compile error on missing imports OR failing assertions). Confirm failure is due to unimplemented code, not test malformation.

**Step 2 (GREEN — implement production code until tests pass):**

Create four files implementing the dialogue subsystem, following the analog patterns exactly.

**2a. `grid/src/dialogue/types.ts`** — readonly discriminated interfaces mirroring `grid/src/integration/types.ts`:
```typescript
export interface DialogueContext {
    readonly dialogue_id: string;            // 16-hex per D-03
    readonly counterparty_did: string;
    readonly channel: string;
    readonly exchange_count: number;
    readonly window_start_tick: number;
    readonly window_end_tick: number;
    readonly utterances: ReadonlyArray<{
        readonly tick: number;
        readonly speaker_did: string;
        readonly speaker_name: string;
        readonly text: string;               // already 200-char-truncated at nous.spoke producer
    }>;                                       // MAX 5 entries (D-05), slice(-5) at emit
}

export interface SpokeObservation {
    readonly tick: number;
    readonly speaker_did: string;
    readonly speaker_name: string;
    readonly channel: string;
    readonly text: string;
}

export interface DialogueAggregatorConfig {
    readonly windowTicks: number;    // D-25 default 5
    readonly minExchanges: number;   // D-25 default 2
}
```

**2b. `grid/src/dialogue/dialogue-id.ts`** — pure function, no imports from grid internals:
```typescript
import { createHash } from 'node:crypto';

export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

/**
 * Deterministic dialogue_id per D-03: sha256(sortedDids|channel|windowStartTick).slice(0,16).
 * Pure function — no I/O, no Date.now, no randomness. Order-independent over dids.
 */
export function computeDialogueId(
    dids: readonly string[],
    channel: string,
    windowStartTick: number,
): string {
    const sorted = [...dids].sort();
    const input = `${sorted.join('|')}|${channel}|${windowStartTick}`;
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
```

**2c. `grid/src/dialogue/aggregator.ts`** — class with AuditChain listener + per-pair-channel buffer + `drainPending(did, tick)` + `reset()`:

- Constructor: `(audit: AuditChain, config: DialogueAggregatorConfig)`. Register `audit.onAppend` listener; filter `entry.event_type === 'nous.spoke'`; call `this.ingestSpoke(entry)` per 07-PATTERNS.md §aggregator.
- Internal state:
  - `#buffers: Map<string, { windowStartTick: number; utterances: SpokeObservation[]; didsSeenInDirection: Set<string> }>` keyed by `pair_key = sortedDids.join('|') + '|' + channel` (D-02, D-05).
  - `#deliveredIds: Map<string, Set<string>>` pair_key -> set of dialogue_ids already delivered (prevents duplicate emission per window, D-08).
- `ingestSpoke(entry)`:
  1. Extract `{speaker_did: entry.actor_did, channel, text, name}` from payload + `tick = entry.tick`.
  2. Identify candidate pairs; create/update per D-01..D-08 semantics.
  3. **Bidirectional check (D-01):** `didsSeenInDirection` reaches size 2 AND utterances.length ≥ config.minExchanges before firing.
  4. **Window prune / windowStartTick update** per D-07.
  5. Enforce buffer cap `windowTicks × 4` entries.
- `drainPending(did: string, currentTick: number): DialogueContext[]`:
  1. Iterate `Array.from(this.#buffers.keys()).sort()` (pitfall 2).
  2. Build + return DialogueContext list per D-08 / D-11.
- `reset(): void` — clears `#buffers` and `#deliveredIds` (D-04).
- **No `Date.now()` / `Math.random()` / `performance.now()`** anywhere.

**2d. `grid/src/dialogue/index.ts`** — barrel:
```typescript
export { DialogueAggregator } from './aggregator';
export { computeDialogueId, DIALOGUE_ID_RE } from './dialogue-id';
export type { DialogueContext, SpokeObservation, DialogueAggregatorConfig } from './types';
```

**Step 3 (CONFIRM GREEN):**
Re-run `cd grid && pnpm test -- dialogue/dialogue-id dialogue/aggregator dialogue/zero-diff --run 2>&1 | tail -40`. All `it(...)` cases must pass; vitest output must show a non-zero test count. If vitest reports "0 tests found" the task FAILS — it means the test file was placed in a path vitest doesn't scan (fix by adjusting `grid/vitest.config.ts` `include` glob to cover `grid/test/dialogue/**/*.test.ts`).
  </action>
  <verify>
    <automated>cd grid && pnpm test -- dialogue/dialogue-id dialogue/aggregator dialogue/zero-diff --run 2>&1 | tail -40</automated>
  </verify>
  <done>
    - grid/test/dialogue/{dialogue-id,aggregator,zero-diff}.test.ts exist with real `expect(...)` assertions (NOT it.todo).
    - vitest reports a non-zero passing count across those three files.
    - Pure dialogue_id function passes all determinism tests.
    - Aggregator emits DialogueContext only on bidirectional ≥minExchanges within window.
    - Zero-diff test green: aggregator listener is pure-observer.
    - `grep -rn "Date\.now\|Math\.random\|performance\.now" grid/src/dialogue/` → 0 matches.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Widen TickParams additively + extend BrainAction union with TelosRefinedAction + add recentDialogueIds to NousRunner</name>
  <files>grid/src/integration/types.ts, grid/src/integration/nous-runner.ts</files>
  <read_first>
    - grid/src/integration/types.ts (current TickParams + BrainAction shapes — see <interfaces> above)
    - 07-PATTERNS.md §"`grid/src/integration/types.ts`" (discriminated-union extension pattern)
    - 07-PATTERNS.md §"`grid/src/integration/nous-runner.ts`" — Pattern-to-copy + divergence notes; the recentDialogueIds rolling set N=100
    - 07-CONTEXT.md D-10, D-14, D-16 (recentDialogueIds is the authority check seam)
    - grid/src/integration/nous-runner.ts — existing executeActions switch for the `case 'trade_request'` precedent (closest analog for pre-audit validation)
  </read_first>
  <action>
Make TWO additive, non-breaking edits. Do NOT implement the `case 'telos_refined'` handler yet — that lands in Plan 03 (producer boundary + handler go together because the handler calls `appendTelosRefined`).

**A. `grid/src/integration/types.ts` — purely additive:**

1. Import `DialogueContext` from `../dialogue/types` (or `../dialogue` barrel).
2. Add `TelosRefinedAction` interface to the BrainAction union (type-only; handler branch deferred to Plan 03):
```typescript
export interface TelosRefinedAction {
    action_type: 'telos_refined';
    channel: string;
    text: string;
    metadata: {
        before_goal_hash: string;            // 64-hex; validated in Plan 03 handler
        after_goal_hash: string;             // 64-hex; validated in Plan 03 handler
        triggered_by_dialogue_id: string;    // 16-hex; validated in Plan 03 handler
        // new_goals is permitted on the wire but MUST be dropped by Plan 03's case handler
        // before crossing the appendTelosRefined producer boundary (D-18, Pitfall 5).
        [key: string]: unknown;
    };
}

export type BrainAction =
    | SpeakAction
    | DirectMessageAction
    | MoveAction
    | NoopAction
    | TradeRequestAction
    | TelosRefinedAction;   // Phase 7 — Plan 03 implements the case branch
```
3. Widen `TickParams` additively (D-10):
```typescript
export interface TickParams {
    tick: number;
    epoch: number;
    dialogue_context?: DialogueContext;   // Phase 7 — additive; existing callers unaffected
}
```
4. Keep `IBrainBridge.sendTick(params: TickParams)` signature unchanged — the widening is achieved by making the field optional.

**B. `grid/src/integration/nous-runner.ts` — add `recentDialogueIds` field + signature widening on `runner.tick`:**

1. Add a private rolling set:
```typescript
/** Phase 7 D-16 authority-check seam: tracks dialogue_ids recently delivered to THIS nous.
 *  Populated by tick() when dialogue_context is present; consumed by Plan 03's
 *  `case 'telos_refined'` to reject forged dialogue_ids. Rolling cap = 100. */
private readonly recentDialogueIds: Set<string> = new Set();
private static readonly RECENT_DIALOGUE_CAP = 100;
```
2. Widen the runner's `tick(...)` method signature to accept an optional `dialogueContext?: DialogueContext` param (imported from `../dialogue`):
```typescript
async tick(tick: number, epoch: number, dialogueContext?: DialogueContext): Promise<void> {
    if (dialogueContext) {
        this.recordDialogueDelivery(dialogueContext.dialogue_id);
    }
    const params: TickParams = dialogueContext
        ? { tick, epoch, dialogue_context: dialogueContext }
        : { tick, epoch };
    const actions = await this.bridge.sendTick(params);
    await this.executeActions(actions);
}

private recordDialogueDelivery(id: string): void {
    if (this.recentDialogueIds.size >= NousRunner.RECENT_DIALOGUE_CAP) {
        const oldest = this.recentDialogueIds.values().next().value;
        if (oldest !== undefined) this.recentDialogueIds.delete(oldest);
    }
    this.recentDialogueIds.add(id);
}
```
3. Do NOT add a `case 'telos_refined'` branch in `executeActions` in this task. Plan 03 adds it alongside the `appendTelosRefined` producer helper so handler + boundary ship atomically.

**Purely additive rule:** existing runner callers that pass only `(tick, epoch)` continue to work. The parameter is optional with a sensible default.
  </action>
  <behavior>
    - Test 1: A runner `tick(5, 1)` call without dialogue_context still passes `{tick: 5, epoch: 1}` to bridge.sendTick — no new fields leak.
    - Test 2: A runner `tick(5, 1, ctx)` call populates recentDialogueIds with `ctx.dialogue_id` and passes `{tick, epoch, dialogue_context: ctx}` to bridge.sendTick.
    - Test 3: 101 distinct dialogue deliveries leave recentDialogueIds at exactly 100 (oldest-first eviction).
    - Typecheck across grid/src/: `BrainAction` union accepts the new variant; no existing consumer breaks.
  </behavior>
  <acceptance_criteria>
    - `cd grid && pnpm run typecheck` is green.
    - `grep -rn "case 'telos_refined'" grid/src/integration/nous-runner.ts` returns zero matches (handler deliberately deferred to Plan 03).
    - `grep -n "dialogue_context" grid/src/integration/types.ts` shows the additive optional field.
    - All existing grid tests still green: `cd grid && pnpm test 2>&1 | tail -10` shows no regressions vs. Phase 6 baseline (538 tests).
  </acceptance_criteria>
  <verify>
    <automated>cd grid && pnpm run typecheck && pnpm test -- integration/nous-runner 2>&1 | tail -30</automated>
  </verify>
  <done>
    - BrainAction union + TickParams + recentDialogueIds all in place.
    - Existing runner callers unaffected (grep + full grid test suite green).
    - Plan 03 can later add the `case 'telos_refined'` branch that calls `appendTelosRefined(this.audit, ..., ...)` against this seam.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: TDD — Wire DialogueAggregator from GenesisLauncher (pause drain) + GridCoordinator (pull-query per-runner per-tick), RED-first with grid/test/dialogue/boundary.test.ts</name>
  <files>grid/src/genesis/launcher.ts, grid/src/genesis/types.ts, grid/src/integration/grid-coordinator.ts, grid/test/dialogue/boundary.test.ts</files>
  <read_first>
    - 07-PATTERNS.md §"`grid/src/genesis/launcher.ts`" (construct + pass to coordinator)
    - 07-PATTERNS.md §"`grid/src/integration/grid-coordinator.ts`" (pull-query drain injection into existing onTick loop lines 42-51)
    - 07-CONTEXT.md D-04 (pause drains buffer), D-25 (config plumbed through launcher), D-11 (per-participant per-tick delivery)
    - 07-RESEARCH.md §"Pitfall 3" (aggregator owned by launcher so pause hook is trivial)
    - grid/src/clock/ticker.ts — confirm WorldClock.pause() is the drain trigger
    - grid/src/integration/grid-coordinator.ts existing tick loop lines 42-51
  </read_first>
  <behavior>
    - **boundary.test.ts (SC#5):** varies `config.dialogue.windowTicks ∈ {3, 5, 7}` and asserts that bidirectional utterances at tick T and tick T+windowTicks-1 fire (within window) while utterances at T and T+windowTicks+1 do NOT fire (outside window).
    - **boundary.test.ts (pause scenario, D-04):** launcher.clock.pause() followed by more nous.spoke events does NOT emit a dialogue_id that bridges pre-pause + post-pause utterances (Pitfall 3). aggregator.reset() is confirmed to have been invoked.
    - Launcher startup constructs a non-null `aggregator` reachable on `launcher.aggregator`.
  </behavior>
  <action>
Three cross-wiring edits PLUS a test file authored RED-first.

**Step 1 (RED — test file):**

Create `grid/test/dialogue/boundary.test.ts` with `describe(...)` + concrete `it(...)` cases for the behaviour above. Real `expect(...)` assertions, no `it.todo`. Imports will reference `DialogueAggregator` (exists after Task 1) plus the launcher / coordinator integration seam which does not yet exist — so tests fail compile / assertion. That is the RED signal.

Run `cd grid && pnpm test -- dialogue/boundary --run 2>&1 | tail -30`. MUST fail.

**Step 2 (GREEN — implementation):**

**A. `grid/src/genesis/types.ts` — add optional dialogue config:**
```typescript
export interface GridConfig {
    // existing fields ...
    dialogue?: {
        windowTicks: number;      // default 5 per D-25
        minExchanges: number;     // default 2 per D-25
    };
}
```

**B. `grid/src/genesis/launcher.ts` — construct aggregator; wire pause hook:**

1. Import: `import { DialogueAggregator } from '../dialogue';`.
2. Resolve config defaults: `const dialogueCfg = config.dialogue ?? { windowTicks: 5, minExchanges: 2 };`.
3. After `const audit = new AuditChain(...)` and before coordinator construction:
   ```typescript
   const aggregator = new DialogueAggregator(audit, dialogueCfg);
   ```
4. Pass `aggregator` into `GridCoordinator` construction (update GridCoordinator constructor props accordingly — see step C).
5. Wire pause drain. Two acceptable implementations — pick based on what's already in the file:
   - **Preferred (additive, minimal):** wrap the existing pause-trigger path (e.g. the `/api/v1/operator/clock/pause` handler OR the WorldClock.pause entry point owned by launcher) to call `aggregator.reset()` AFTER the WorldClock has paused.
   - **Alternate:** if WorldClock exposes `onPause(cb)`, register `aggregator.reset` as the callback.

   If neither path is already in-file, add a one-line public method to GenesisLauncher: `drainDialogueOnPause(): void { this.aggregator.reset(); }` and have the HTTP handler in `grid/src/api/operator/clock-pause.ts` (or equivalent) invoke it after pausing.
6. Expose the aggregator on `GenesisLauncher` as a readonly field `public readonly aggregator: DialogueAggregator` so the coordinator + tests can reach it.

**C. `grid/src/integration/grid-coordinator.ts` — pull-query drain injection:**

1. Accept `aggregator: DialogueAggregator` in the coordinator constructor (constructor props are shaped as `{ launcher, runners, ... }` in current code — add `aggregator` there).
2. Modify the existing onTick loop (currently lines 42-51 per 07-RESEARCH.md) exactly as shown in 07-PATTERNS.md §coordinator:
   ```typescript
   this.launcher.clock.onTick(async (event) => {
       const { tick, epoch } = event;
       const tickPromises = [...this.runners.values()].map(runner => {
           const contexts = this.aggregator.drainPending(runner.nousDid, tick);
           return contexts.length === 0
               ? runner.tick(tick, epoch).catch(err => log.error({ err, did: runner.nousDid }, 'runner tick failed'))
               : contexts.reduce<Promise<void>>(
                   (chain, ctx) => chain.then(() => runner.tick(tick, epoch, ctx)),
                   Promise.resolve(),
                 ).catch(err => log.error({ err, did: runner.nousDid }, 'runner tick failed'));
       });
       await Promise.all(tickPromises);
   });
   ```
3. Keep the existing `log.error` path byte-identical to avoid zero-diff drift.

**Step 3 (CONFIRM GREEN):**
Re-run `cd grid && pnpm test -- dialogue integration/grid-coordinator genesis/launcher --run 2>&1 | tail -40`. boundary.test.ts must report a non-zero passing count; aggregator.test.ts + zero-diff.test.ts from Task 1 still green.
  </action>
  <verify>
    <automated>cd grid && pnpm test -- dialogue integration/grid-coordinator genesis/launcher --run 2>&1 | tail -40</automated>
  </verify>
  <done>
    - grid/test/dialogue/boundary.test.ts exists with real assertions; passes.
    - Aggregator is live at grid startup, pause-safe, and reachable from the coordinator tick loop.
    - DialogueContexts are pull-queried + delivered per-runner per-tick (D-11).
    - Phase 6 baseline regressions: zero.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| AuditChain.onAppend → DialogueAggregator | Synchronous, in-process; aggregator is a pure observer and must not mutate chain state |
| DialogueAggregator → GridCoordinator (pull via drainPending) | In-process, deterministic; must return identical output across 0/N listeners (zero-diff) |
| GridCoordinator → NousRunner.tick(..., ctx) | In-process; ctx is read-only ReadonlyArray<utterance> |
| NousRunner → IBrainBridge.sendTick({..., dialogue_context}) | RPC boundary; additive widening — existing callers unaffected |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-01 | Tampering | DialogueAggregator (listener pollution) | mitigate | Aggregator is a pure observer; zero-diff test across 0/10 listeners (grid/test/dialogue/zero-diff.test.ts); source-grep forbids Date.now/Math.random/performance.now in grid/src/dialogue/ |
| T-07-02 | Spoofing | runner.recentDialogueIds forgery | mitigate | Set only populated when GridCoordinator delivers a context pulled from aggregator; rolling cap 100; Plan 03 handler rejects unknown dialogue_id (D-16) |
| T-07-03 | Information Disclosure | utterance content leak via DialogueContext | accept | DialogueContext stays in-process — never broadcast; utterance text is already Phase-1-truncated to 200 chars at nous.spoke producer. No new privacy surface introduced |
| T-07-04 | Denial of Service | unbounded per-pair buffer | mitigate | Buffer cap = windowTicks × 4 entries per pair; utterance slice(-cap) on overflow; window prune on every observation |
| T-07-05 | Integrity of audit forensics | pause-spanning dialogue window | mitigate | D-04: aggregator.reset() on WorldClock.pause() (Pitfall 3); covered by grid/test/dialogue/boundary.test.ts |
| T-07-06 | Tampering (determinism) | Map iteration order leak | mitigate | Array.from(m.keys()).sort() before iterating (Pitfall 2); covered by zero-diff test |
</threat_model>

<verification>
- Task 1 creates grid/test/dialogue/{aggregator,dialogue-id,zero-diff}.test.ts with real assertions (RED-first, then GREEN).
- Task 3 creates grid/test/dialogue/boundary.test.ts with real assertions (RED-first, then GREEN).
- After all three tasks: `cd grid && pnpm test` shows Phase 6 baseline (538) + 4 new dialogue test files green with non-zero case counts.
- `grep -rn "Date\.now\|Math\.random\|performance\.now" grid/src/dialogue/` → zero matches.
- `cd grid && pnpm run typecheck` clean.
</verification>

<success_criteria>
- DIALOG-01 SC#1: Two-Nous bidirectional exchange ≥2 utterances within windowTicks triggers dialogue_context delivery to BOTH participants.
- DIALOG-01 SC#5: grid/test/dialogue/boundary.test.ts varies windowTicks and asserts boundary fires/does-not-fire correctly.
- Zero-diff invariant preserved: 0 vs 10 listeners → byte-identical chain head.
- No new wall-clock dependency in determinism path (grep-verified).
- BrainAction union extended; Plan 03 can land the `case 'telos_refined'` branch against the `recentDialogueIds` seam without touching coordinator/aggregator again.
</success_criteria>

<output>
After completion, create `.planning/phases/07-peer-dialogue-telos-refinement/07-01-SUMMARY.md` summarising:
- Files added/modified (exact paths)
- Test counts before/after (Phase 6 baseline 538 → Plan 01 count)
- Invariants preserved (zero-diff, no-wall-clock, pause-drain)
- Seams exposed for Plan 03 (recentDialogueIds, TelosRefinedAction variant)
</output>
