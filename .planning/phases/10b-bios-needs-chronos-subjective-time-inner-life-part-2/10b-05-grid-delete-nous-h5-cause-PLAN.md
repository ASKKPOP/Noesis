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
    - "ORDER is deterministic: appendBiosDeath → appendNousDeleted (D-30 extension)"
    - "Tombstone invariant preserved: post-death DID cannot be reused"
  artifacts:
    - path: "grid/src/api/operator/delete-nous.ts"
      provides: "delete-nous endpoint extended with bios.death emission"
      contains: "appendBiosDeath"
  key_links:
    - from: "grid/src/api/operator/delete-nous.ts"
      to: "grid/src/bios/appendBiosDeath.ts"
      via: "cause='operator_h5' call before appendNousDeleted"
      pattern: "appendBiosDeath.*operator_h5"
---

<objective>
Extend the existing operator H5 delete-nous endpoint (Phase 8 D-30) to emit `bios.death` with `cause='operator_h5'` in the same tick, immediately before the existing `appendNousDeleted` call. Turns Wave 0 stub GREEN: api/operator/delete-nous-bios-death.test.ts.

Purpose: Operator-initiated death generates the same audit trail as natural (starvation) death — dashboards get a unified bios.death stream regardless of cause.

Output: 1 modified file, ~5 lines inserted; zero new files.
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

From grid/src/api/operator/delete-nous.ts:145-162 — existing D-30 ORDER:
```
1. Validate operator auth
2. Resolve current tick
3. Compute final_state_hash (existing)
4. await appendNousDeleted({did, tick, reason: 'operator_h5'})
5. Release resources, return 200
```

D-10b-03 EXTENSION — insert step 3.5:
```
3.5. await appendBiosDeath({did, tick, cause: 'operator_h5', finalStateHash})
```

From 10b-03-SUMMARY.md:
- appendBiosDeath signature: (deps, {did, tick, cause, finalStateHash})
- appendBiosDeath tombstones the DID on success
- appendNousDeleted must run AFTER so it sees the tombstoned DID (existing D-30 already handles this safely)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Insert appendBiosDeath into D-30 ORDER before appendNousDeleted</name>
  <files>grid/src/api/operator/delete-nous.ts</files>
  <read_first>
    - grid/src/api/operator/delete-nous.ts (full file, locate existing appendNousDeleted call at ~line 145-162)
    - grid/src/bios/appendBiosDeath.ts (from plan 10b-03)
    - grid/src/bios/index.ts (barrel exports)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-03 cause semantics)
  </read_first>
  <behavior>
    - Import appendBiosDeath from '../../bios/index.js'
    - Compute finalStateHash (reuse the same function that feeds appendNousDeleted — don't hash twice differently)
    - Call appendBiosDeath BEFORE appendNousDeleted, same tick
    - Both calls share the same tick value resolved once at endpoint entry
    - If appendBiosDeath throws (e.g., already tombstoned — idempotency violation), propagate: do NOT suppress
  </behavior>
  <action>
Edit `grid/src/api/operator/delete-nous.ts`:
- Add import near other grid imports:
```ts
import { appendBiosDeath } from '../../bios/index.js';
```
- Locate the existing block (around lines 145-162) that looks like:
```ts
const tick = deps.currentTick();
const finalStateHash = await computeFinalStateHash(did, tick);
await appendNousDeleted({ chain, registry, currentTick: deps.currentTick }, {
  did,
  tick,
  reason: 'operator_h5',
  finalStateHash,
});
```
- Insert appendBiosDeath BETWEEN the hash compute and appendNousDeleted:
```ts
const tick = deps.currentTick();
const finalStateHash = await computeFinalStateHash(did, tick);

// Per D-10b-03: bios.death precedes nous.deleted (same tick) for operator H5
await appendBiosDeath(
  { chain, registry, currentTick: deps.currentTick },
  {
    did,
    tick,
    cause: 'operator_h5',
    finalStateHash,
  },
);

await appendNousDeleted({ chain, registry, currentTick: deps.currentTick }, {
  did,
  tick,
  reason: 'operator_h5',
  finalStateHash,
});
```
- Do NOT change auth checks, error handling, or response shape.
- Do NOT modify appendNousDeleted itself — the tombstone check there already passes because appendBiosDeath tombstones first (the existing D-30 code was written to handle a tombstoned DID as legal for nous.deleted, per Phase 8).
  </action>
  <verify>
    <automated>cd grid && bun test test/api/operator/delete-nous-bios-death.test.ts --run</automated>
  </verify>
  <done>Operator DELETE /nous/:did emits bios.death (cause='operator_h5') immediately before nous.deleted in same tick. Both calls share one tick value. Grep `rg "appendBiosDeath" grid/src/api/operator/delete-nous.ts` returns 1 call site.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator API → audit chain | Authenticated operator actions must produce correctly-ordered event pairs |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-05-01 | Tampering | Reorder bios.death after nous.deleted | mitigate | Unit test asserts ordering; grep for literal sequence in source |
| T-10b-05-02 | Repudiation | bios.death missing when H5 fires | mitigate | Integration test: delete-nous endpoint observes both events |
| T-10b-05-03 | Elevation of Privilege | Non-operator triggers H5 cause | mitigate | Existing Phase 8 operator auth guard unchanged |
</threat_model>

<verification>
- `cd grid && bun test test/api/operator/delete-nous-bios-death.test.ts --run` — GREEN
- `rg "appendBiosDeath" grid/src/api/operator/delete-nous.ts` returns exactly 1 call
- `rg "operator_h5" grid/src/api/operator/delete-nous.ts` returns ≥2 matches (both events tagged)
- Both appendBiosDeath and appendNousDeleted observed in the same tick in integration test
</verification>

<success_criteria>
- delete-nous endpoint emits bios.death (cause=operator_h5) before nous.deleted
- Both events share the same tick (audit_tick=system_tick invariant preserved)
- Tombstone invariant preserved: DID tombstoned by appendBiosDeath, appendNousDeleted runs afterward
- Zero new files; zero changes to auth, validation, or response shape
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-05-SUMMARY.md`
</output>
