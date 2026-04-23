---
phase: 10b
plan: 05
type: execute
wave: 2
depends_on: [10b-03]
files_modified:
  - grid/src/api/operator/delete-nous.ts
autonomous: true
requirements: [BIOS-03]
must_haves:
  truths:
    - "Operator H5 delete-nous emits bios.death with cause='operator_h5' BEFORE nous.deleted (same tick)"
    - "D-30 ORDER preserved: tombstone → despawn → appendBiosDeath → appendNousDeleted (B6-aligned — caller tombstones; appendBiosDeath itself does NOT tombstone)"
    - "Tombstone invariant preserved: post-death DID cannot be reused"
    - "Wire payload uses snake_case (final_state_hash) per D-10b-01 closed-tuple contract"
  artifacts:
    - path: "grid/src/api/operator/delete-nous.ts"
      provides: "delete-nous endpoint extended with explicit tombstone + bios.death emission"
      contains: "appendBiosDeath"
  key_links:
    - from: "grid/src/api/operator/delete-nous.ts"
      to: "grid/src/genesis/nous-registry.ts"
      via: "registry.tombstone(did, { cause: 'operator_h5', tick }) BEFORE appendBiosDeath"
      pattern: "registry\\.tombstone"
    - from: "grid/src/api/operator/delete-nous.ts"
      to: "grid/src/bios/appendBiosDeath.ts"
      via: "cause='operator_h5' call AFTER tombstone+despawn, BEFORE appendNousDeleted"
      pattern: "appendBiosDeath.*operator_h5"
---

<objective>
Extend the existing operator H5 delete-nous endpoint (Phase 8 D-30) to emit `bios.death` with `cause='operator_h5'` in the same tick, immediately before the existing `appendNousDeleted` call. Per Plan 03's B6 fix, `appendBiosDeath` no longer tombstones internally — this plan therefore performs the tombstone **explicitly first**, preserving the D-30 ORDER: **tombstone → despawn → appendBiosDeath → appendNousDeleted**. Turns Wave 0 stub GREEN: api/operator/delete-nous-bios-death.test.ts.

Purpose: Operator-initiated death generates the same audit trail as natural (starvation) death — dashboards get a unified bios.death stream regardless of cause.

Output: 1 modified file, ~12 lines inserted; zero new files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-03-SUMMARY.md

<interfaces>
<!-- Clone target for ORDER extension. -->

From grid/src/api/operator/delete-nous.ts (existing D-30 ORDER, Phase 8):
```
1. Validate operator auth
2. Resolve current tick
3. Compute final_state_hash (existing)
4. await appendNousDeleted({did, tick, reason: 'operator_h5', finalStateHash})
5. Release resources, return 200
```

D-10b-03 EXTENSION + B6 FIX — the new canonical D-30 ORDER for operator H5:
```
1. Validate operator auth
2. Resolve current tick
3. Compute final_state_hash
3a. await deps.registry.tombstone(did, { cause: 'operator_h5', tick })   ← NEW (was internal to appendBiosDeath; now caller-owned per B6)
3b. await deps.registry.despawn(did)                                      ← existing despawn step (kept in its Phase 8 position)
3c. await appendBiosDeath({did, tick, cause: 'operator_h5', final_state_hash})   ← NEW (snake_case wire key)
4.  await appendNousDeleted({did, tick, reason: 'operator_h5', finalStateHash})  ← existing; unchanged
5.  Return 200
```

From 10b-03-SUMMARY.md (B6 fix):
- appendBiosDeath signature: (deps, {did, tick, cause, final_state_hash})  — snake_case payload keys enforced by closed-tuple gate
- appendBiosDeath does **NOT** tombstone internally (single responsibility, caller-owned tombstone)
- Caller MUST call `deps.registry.tombstone(did, { cause, tick })` BEFORE invoking appendBiosDeath
- Post-tombstone, appendBiosDeath still performs its own `registry.isTombstoned(did)` verification — it expects the DID already tombstoned by the caller (the check is: "is it tombstoned?" which is satisfied)
- appendNousDeleted runs AFTER appendBiosDeath; its own tombstone-reuse guard already tolerates a tombstoned DID (Phase 8 behavior)

From grid/src/genesis/nous-registry.ts (Phase 8 D-33/D-34):
- `registry.tombstone(did: string, { cause: string, tick: number }): Promise<void>`
- Idempotent: tombstoning an already-tombstoned DID is a no-op (does NOT throw)
- `registry.despawn(did)` — existing, unchanged

Wire-key contract reminder (D-10b-01, enforced by plan 10b-03 closed-tuple gate):
- Local variable may remain camelCase (`finalStateHash`) for TS ergonomics
- Wire key passed to appendBiosDeath **MUST** be `final_state_hash` (snake_case)
- The closed-tuple gate `Object.keys(payload).sort() === BIOS_DEATH_KEYS` throws on any camelCase leak
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Insert tombstone + appendBiosDeath into D-30 ORDER before appendNousDeleted</name>
  <files>grid/src/api/operator/delete-nous.ts</files>
  <read_first>
    - grid/src/api/operator/delete-nous.ts (full file; locate existing despawn + appendNousDeleted call at ~line 145-162)
    - grid/src/bios/appendBiosDeath.ts (from plan 10b-03 — verify payload key names; snake_case)
    - grid/src/bios/types.ts (from plan 10b-03 — confirm BIOS_DEATH_KEYS = ['cause','did','final_state_hash','tick'])
    - grid/src/bios/index.ts (barrel exports)
    - grid/src/genesis/nous-registry.ts (tombstone API signature)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-03 cause semantics; D-30 ORDER)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-03-SUMMARY.md (B6 fix: caller owns tombstone)
  </read_first>
  <behavior>
    - Import appendBiosDeath from '../../bios/index.js'
    - Compute finalStateHash (reuse the same function that feeds appendNousDeleted — don't hash twice differently); local var stays camelCase
    - **Tombstone FIRST** via `deps.registry.tombstone(did, { cause: 'operator_h5', tick })` before anything bios-related — caller-owned per B6
    - Call appendBiosDeath AFTER tombstone + despawn, BEFORE appendNousDeleted, in the same tick
    - Payload wire key **MUST** be `final_state_hash` (snake_case) — NOT `finalStateHash`. The closed-tuple gate will throw on camelCase.
    - All calls share the same tick value resolved once at endpoint entry
    - If any step throws (already-tombstoned, closed-tuple violation, etc.), propagate: do NOT suppress
  </behavior>
  <action>
Edit `grid/src/api/operator/delete-nous.ts`:
- Add import near other grid imports:
```ts
import { appendBiosDeath } from '../../bios/index.js';
```
- Locate the existing block (around lines 145-162) that currently looks roughly like:
```ts
const tick = deps.currentTick();
const finalStateHash = await computeFinalStateHash(did, tick);
await deps.registry.despawn(did);                         // existing despawn (Phase 8)
await appendNousDeleted({ chain, registry, currentTick: deps.currentTick }, {
  did,
  tick,
  reason: 'operator_h5',
  finalStateHash,
});
```
- Restructure to the new D-30 ORDER (tombstone → despawn → appendBiosDeath → appendNousDeleted):
```ts
const tick = deps.currentTick();
const finalStateHash = await computeFinalStateHash(did, tick);

// D-30 ORDER step 3a (NEW per B6 fix): caller-owned tombstone BEFORE any bios emission.
// appendBiosDeath no longer tombstones internally — single-responsibility per plan 10b-03.
await deps.registry.tombstone(did, { cause: 'operator_h5', tick });

// D-30 ORDER step 3b: despawn (existing Phase 8 step — kept in position).
await deps.registry.despawn(did);

// D-30 ORDER step 3c (NEW per D-10b-03): bios.death precedes nous.deleted (same tick) for operator H5.
// Wire keys are snake_case per D-10b-01 — `final_state_hash`, NOT `finalStateHash`.
// The closed-tuple gate in appendBiosDeath will throw on any camelCase leak.
await appendBiosDeath(
  { chain, registry, currentTick: deps.currentTick },
  {
    did,
    tick,
    cause: 'operator_h5',
    final_state_hash: finalStateHash,   // snake_case wire key; local var stays camelCase
  },
);

// D-30 ORDER step 4: unchanged — nous.deleted after bios.death.
await appendNousDeleted({ chain, registry, currentTick: deps.currentTick }, {
  did,
  tick,
  reason: 'operator_h5',
  finalStateHash,
});
```
- Do NOT change auth checks, error handling, or response shape.
- Do NOT modify appendNousDeleted — its Phase 8 tombstone-reuse guard already tolerates a tombstoned DID.
- Do NOT remove the existing `despawn(did)` call; it must remain between tombstone and appendBiosDeath per D-30.
  </action>
  <verify>
    <automated>cd grid && bun test test/api/operator/delete-nous-bios-death.test.ts --run</automated>
  </verify>
  <done>Operator DELETE /nous/:did performs tombstone → despawn → appendBiosDeath (cause='operator_h5', snake_case wire payload) → appendNousDeleted in same tick. All calls share one tick value. Grep `rg "appendBiosDeath" grid/src/api/operator/delete-nous.ts` returns 1 call site. Grep `rg "registry\\.tombstone" grid/src/api/operator/delete-nous.ts` returns ≥1 call (caller-owned tombstone). Grep `rg "finalStateHash:" grid/src/api/operator/delete-nous.ts` at the appendBiosDeath call site returns zero matches (wire key is snake_case).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator API → audit chain | Authenticated operator actions must produce correctly-ordered event pairs |
| Operator API → NousRegistry | Tombstone must precede bios.death emission (D-30 ORDER + B6) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-05-01 | Tampering | Reorder bios.death after nous.deleted | mitigate | Unit test asserts ordering; grep for literal sequence in source |
| T-10b-05-02 | Repudiation | bios.death missing when H5 fires | mitigate | Integration test: delete-nous endpoint observes both events |
| T-10b-05-03 | Elevation of Privilege | Non-operator triggers H5 cause | mitigate | Existing Phase 8 operator auth guard unchanged |
| T-10b-05-04 | Tampering | camelCase wire key bypasses closed-tuple gate | mitigate | Plan 10b-03 closed-tuple gate (`Object.keys().sort() === BIOS_DEATH_KEYS`) throws on `finalStateHash`; call site uses `final_state_hash` explicitly |
| T-10b-05-05 | Repudiation | Caller skips tombstone, leaves DID re-usable | mitigate | D-30 ORDER enforces tombstone FIRST; test_tombstone_before_bios_death asserts ordering |
</threat_model>

<verification>
- `cd grid && bun test test/api/operator/delete-nous-bios-death.test.ts --run` — GREEN
- `rg "appendBiosDeath" grid/src/api/operator/delete-nous.ts` returns exactly 1 call
- `rg "registry\\.tombstone" grid/src/api/operator/delete-nous.ts` returns ≥1 match (caller-owned tombstone)
- `rg "operator_h5" grid/src/api/operator/delete-nous.ts` returns ≥3 matches (tombstone cause, bios.death cause, nous.deleted reason)
- `rg "final_state_hash:" grid/src/api/operator/delete-nous.ts` returns ≥1 match (snake_case wire key at appendBiosDeath call site)
- Integration test observes D-30 ORDER: tombstone → despawn → bios.death → nous.deleted, all at the same tick
</verification>

<success_criteria>
- delete-nous endpoint performs caller-owned tombstone BEFORE bios.death (per B6 fix)
- appendBiosDeath is invoked with snake_case wire payload (`final_state_hash`) — closed-tuple gate passes
- D-30 ORDER preserved: tombstone → despawn → bios.death → nous.deleted
- All four audit-affecting calls share the same tick (audit_tick=system_tick invariant preserved)
- Zero new files; zero changes to auth, validation, or response shape
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-05-SUMMARY.md`
</output>
</output>
