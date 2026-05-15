---
phase: 17-iris-theory-of-mind
plan: wave-1
subsystem: brain/protocol
tags: [iris, theory-of-mind, action-types, bridge-types, contracts]
dependency_graph:
  requires: [wave-0]
  provides: [ActionType iris members, BrainAction iris union]
  affects: [grid/src/integration/nous-runner.ts, brain/src/noesis_brain/iris/]
tech_stack:
  added: []
  patterns: [enum extension, TypeScript union backfill]
key_files:
  created: []
  modified:
    - brain/src/noesis_brain/rpc/types.py
    - protocol/src/noesis/bridge/types.ts
decisions:
  - "D-17-06: 4 ActionType members added after SKILL_SHARE, all forwarded to Grid"
  - "D-17-10: BrainAction union backfilled with historically dispatched types + 4 iris strings"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-15"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 17 Plan Wave-1: Add Iris Action Type Contracts Summary

Interface-first wave: 4 Iris Theory of Mind ActionType members added to the Brain Python enum and the TypeScript bridge union extended with all 15 dispatched action types (5 original + 6 historical backfill + 4 iris).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add 4 IRIS ActionType members to types.py | 17213eb | brain/src/noesis_brain/rpc/types.py |
| 2 | Extend BrainAction action_type union in bridge/types.ts | 17213eb | protocol/src/noesis/bridge/types.ts |

## What Was Done

**Task 1 — brain/src/noesis_brain/rpc/types.py**

Added 4 new `ActionType` members after `SKILL_SHARE`, with doc comments per D-17-06:

```python
IRIS_BELIEF_REVISED = "iris_belief_revised"              # Metadata: {target_did, belief_hash, dimension} (3 keys)
IRIS_CONTEXT_INVOKED = "iris_context_invoked"            # Metadata: {belief_count} (1 key)
IRIS_CONTRADICTION_DETECTED = "iris_contradiction_detected"  # Metadata: {target_did, contradiction_hash} (2 keys)
IRIS_PRIOR_SEEDED = "iris_prior_seeded"                  # Metadata: {target_did, seed_event_hash} (2 keys)
```

Comment block notes the MUST-match invariant with Grid NousRunner switch cases and the 3-keys-not-5 discipline.

**Task 2 — protocol/src/noesis/bridge/types.ts**

Replaced the narrow 5-type `action_type` union in `BrainAction` with the full 15-type union. Added:
- Phase 7: `telos_refined`
- Phase 10a: `drive_crossed`
- Phase 10b: `bios_death`
- Phase 12: `propose`, `vote_commit`, `vote_reveal`
- Phase 17: `iris_belief_revised`, `iris_context_invoked`, `iris_contradiction_detected`, `iris_prior_seeded`

Each group carries a phase comment. Doc comment on `action_type` field points back to the Python enum as source of truth.

## Verification Output

**Python (Task 1):**
```
IRIS_BELIEF_REVISED = iris_belief_revised
IRIS_CONTEXT_INVOKED = iris_context_invoked
IRIS_CONTRADICTION_DETECTED = iris_contradiction_detected
IRIS_PRIOR_SEEDED = iris_prior_seeded
OK — 4 iris ActionType members
```

**TypeScript (Task 2):**
`node_modules/.bin/tsc --noEmit -p protocol/tsconfig.json` → zero errors (empty output).

## Deviations from Plan

None — plan executed exactly as written. The `BrainAction` historical backfill (telos_refined, drive_crossed, bios_death, propose, vote_commit, vote_reveal) was explicitly called for in Task 2's action block per D-17-10.

One pre-existing issue noted per plan: duplicate `MemoryEntry` interface at lines 59-66 and 78-85 in bridge/types.ts. Not touched per plan instruction.

## Critical Invariants Satisfied

- Wall-clock free: no datetime/time/random/uuid imports added
- String values match exactly: `iris_belief_revised`, `iris_context_invoked`, `iris_contradiction_detected`, `iris_prior_seeded`
- 3-keys-not-5: documented in enum comments; Grid injects nous_did + tick at emit time

## Self-Check: PASSED

- `brain/src/noesis_brain/rpc/types.py` modified — confirmed by uv run verification
- `protocol/src/noesis/bridge/types.ts` modified — confirmed by tsc --noEmit zero errors
- Commit 17213eb exists on main and pushed to origin
