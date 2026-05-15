---
phase: 17-iris-theory-of-mind
plan: wave-2
subsystem: grid/iris
tags: [iris, theory-of-mind, audit-emitters, nous-runner, sole-producer]
dependency_graph:
  requires: [wave-0, wave-1]
  provides: [grid/src/iris/ emitters, NousRunner iris dispatch]
  affects: [grid/src/integration/nous-runner.ts, grid/src/integration/types.ts]
tech_stack:
  added: [grid/src/iris/ directory (6 files)]
  patterns: [sole-producer emitter, closed-tuple payload, self-report invariant, HEX64_RE hash validation, 3-keys-not-5]
key_files:
  created:
    - grid/src/iris/types.ts
    - grid/src/iris/appendIrisBeliefRevised.ts
    - grid/src/iris/appendIrisContextInvoked.ts
    - grid/src/iris/appendIrisContradictionDetected.ts
    - grid/src/iris/appendIrisPriorSeeded.ts
    - grid/src/iris/index.ts
  modified:
    - grid/src/integration/nous-runner.ts
    - grid/src/integration/types.ts
decisions:
  - "HEX64_RE used for all hash fields — Brain emits full sha256 hexdigests, no truncation"
  - "BrainAction union in grid/src/integration/types.ts extended with 4 iris variants (Rule 1 fix)"
  - "nous_did field name (not did) distinguishes iris payloads from bios/ananke per D-17-07"
metrics:
  duration_minutes: 15
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 2
  completed_date: "2026-05-15"
---

# Phase 17 Plan wave-2: Grid iris/ Emitters + NousRunner Dispatch Summary

## One-Liner

4 sole-producer iris emitters with HEX64_RE closed-tuple validation + 4 NousRunner dispatch cases wiring Brain iris actions to the audit chain.

## What Was Built

### Task 1: grid/src/iris/ directory (6 files)

**types.ts** — Payload interfaces (`IrisBeliefRevisedPayload`, `IrisContextInvokedPayload`, `IrisContradictionDetectedPayload`, `IrisPriorSeededPayload`) and alphabetically sorted `EXPECTED_KEYS` tuples used by all 4 emitters for closed-tuple enforcement.

**appendIrisBeliefRevised.ts** — Sole producer for `iris.belief_revised`. 4-key payload `{nous_did, tick, target_did, belief_hash}`. Exports `DID_RE` and `HEX64_RE` (barrel re-exported).

**appendIrisContextInvoked.ts** — Sole producer for `iris.context_invoked`. 3-key payload `{nous_did, tick, belief_count}`. No hash field; `belief_count` validated as non-negative integer.

**appendIrisContradictionDetected.ts** — Sole producer for `iris.contradiction_detected`. 4-key payload `{nous_did, tick, target_did, contradiction_hash}`.

**appendIrisPriorSeeded.ts** — Sole producer for `iris.prior_seeded`. 4-key payload `{nous_did, tick, target_did, seed_event_hash}`.

**index.ts** — Barrel export for all 4 emitters, types, and EXPECTED_KEYS constants.

All 4 emitters follow the `appendBiosBirth.ts` 10-step validation discipline in order:
1. DID regex: actorDid
2. DID regex: payload.nous_did
3. Self-report invariant: payload.nous_did === actorDid
4. Tick: non-negative integer
5. Target DID or belief_count (per emitter)
6. Hash field via HEX64_RE (per emitter, or skipped for context_invoked)
7. Closed-tuple: Object.keys(payload).sort() === EXPECTED_KEYS
8. Explicit reconstruction (prototype-pollution defense)
9. payloadPrivacyCheck (D-17-17 privacy gate)
10. audit.append(event_type, actorDid, cleanPayload)

### Task 2: NousRunner dispatch + BrainAction union

**nous-runner.ts** — 4 iris import statements + 4 case branches inserted after `vote_reveal`, before `case 'noop'`. All follow the `drive_crossed` try/catch pattern: rejections log via `console.warn(JSON.stringify({...}))` and never propagate to sibling actions.

**types.ts** (deviation fix) — 4 new `BrainActionIris*` interfaces added to the `BrainAction` discriminated union. This was required to resolve TS2678 type errors in the switch statement. See Deviations section.

## Commits

| Hash | Message |
|------|---------|
| `2734c44` | feat(17-wave-2): Grid iris/ emitters + NousRunner dispatch |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended BrainAction discriminated union in grid/src/integration/types.ts**
- **Found during:** Task 2 verification (TypeScript compilation)
- **Issue:** NousRunner's switch statement is typed against the local `BrainAction` discriminated union in `grid/src/integration/types.ts`, NOT the protocol package's `BrainAction`. The local union did not include the 4 iris action_type strings, causing TS2678 errors on all 4 new case branches.
- **Fix:** Added 4 interfaces (`BrainActionIrisBeliefRevised`, `BrainActionIrisContextInvoked`, `BrainActionIrisContradictionDetected`, `BrainActionIrisPriorSeeded`) and included them in the `BrainAction` union. This mirrors the existing pattern for `BrainActionDriveCrossed`, `BrainActionWhisperSend`, and governance variants.
- **Files modified:** `grid/src/integration/types.ts`
- **Commit:** `2734c44`

## Known Stubs

None. All 4 emitters are fully wired production code. NousRunner passes hashes from `action.metadata` as-is (no stubs, no mocks).

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All 4 iris emitters are internal Grid audit functions with no external surface. The `payloadPrivacyCheck` gate (step 9) is present in all 4 emitters per T-17-W2-01. Sole-producer boundary enforced per T-17-W2-03.

## Verification Results

```
# TypeScript compile (iris-related): 0 errors
cd /Users/desirey/Programming/src/Noesis/grid && npx tsc --noEmit 2>&1 | grep iris
# (no output)

# 4 iris cases in NousRunner
grep -c "case 'iris_" grid/src/integration/nous-runner.ts
# 4

# Sole-producer: each event appears only in its emitter
grep -r "iris.belief_revised" grid/src/ | grep -v allowlist | grep -v .test.
# grid/src/iris/appendIrisBeliefRevised.ts (comment + audit.append call only)

# Wall-clock free
grep -r "Date.now|new Date" grid/src/iris/
# (no output)
```

## Self-Check: PASSED

- grid/src/iris/types.ts: FOUND
- grid/src/iris/appendIrisBeliefRevised.ts: FOUND
- grid/src/iris/appendIrisContextInvoked.ts: FOUND
- grid/src/iris/appendIrisContradictionDetected.ts: FOUND
- grid/src/iris/appendIrisPriorSeeded.ts: FOUND
- grid/src/iris/index.ts: FOUND
- Commit 2734c44: FOUND
