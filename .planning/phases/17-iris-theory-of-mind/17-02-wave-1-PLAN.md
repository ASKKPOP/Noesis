---
phase: 17-iris-theory-of-mind
plan: wave-1
type: execute
wave: 2
depends_on: [wave-0]
files_modified:
  - brain/src/noesis_brain/rpc/types.py
  - protocol/src/noesis/bridge/types.ts
autonomous: true
requirements: [IRIS-01, IRIS-02, IRIS-03, IRIS-04]

must_haves:
  truths:
    - "ActionType enum has 4 new iris members with string values matching NousRunner switch cases exactly"
    - "BrainAction.action_type union in bridge/types.ts includes all 4 iris action strings"
    - "Protocol layer can deserialize iris action_type values without TypeScript error"
  artifacts:
    - path: "brain/src/noesis_brain/rpc/types.py"
      provides: "4 new ActionType members"
      contains: "IRIS_BELIEF_REVISED"
    - path: "protocol/src/noesis/bridge/types.ts"
      provides: "Extended BrainAction union"
      contains: "iris_belief_revised"
  key_links:
    - from: "brain/src/noesis_brain/rpc/types.py ActionType.IRIS_BELIEF_REVISED"
      to: "grid/src/integration/nous-runner.ts case 'iris_belief_revised'"
      via: "action_type string value equality"
      pattern: "iris_belief_revised"
    - from: "protocol/src/noesis/bridge/types.ts BrainAction"
      to: "grid/src/integration/nous-runner.ts executeActions"
      via: "TypeScript union type check"
      pattern: "'iris_belief_revised' \\| 'iris_context_invoked'"
---

<objective>
Add the 4 Iris action types to both the Python Brain enum and the TypeScript bridge contract.

Purpose: Wave 2 Grid emitters and Wave 3 Brain wiring both depend on these type definitions existing first. This is the interface-first step — contracts before implementations.

Output: types.py with 4 new ActionType members; bridge/types.ts BrainAction union extended with 4 iris strings.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/17-iris-theory-of-mind/17-CONTEXT.md
@.planning/phases/17-iris-theory-of-mind/17-PATTERNS.md

<interfaces>
<!-- Current ActionType enum state — from brain/src/noesis_brain/rpc/types.py -->
```python
class ActionType(str, Enum):
    SPEAK = "speak"
    DIRECT_MESSAGE = "direct_message"
    MOVE = "move"
    TRADE_REQUEST = "trade_request"
    TELOS_REFINED = "telos_refined"
    DRIVE_CROSSED = "drive_crossed"
    BIOS_DEATH = "bios_death"
    NOOP = "noop"
    PROPOSE = "propose"
    VOTE_COMMIT = "vote_commit"
    VOTE_REVEAL = "vote_reveal"
    SKILL_LEARN = "skill_learn"  # Brain-internal only
    RULE_STORE = "rule_store"    # Brain-internal only
    SKILL_SHARE = "skill_share"  # Brain-internal only
```

<!-- Current BrainAction union — from protocol/src/noesis/bridge/types.ts line 26 -->
```typescript
export interface BrainAction {
    action_type: 'speak' | 'direct_message' | 'move' | 'trade_request' | 'noop';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}
```
Note: The existing union is intentionally narrow (only 5 types). D-17-10 says "extend with the 4 new iris action strings". Add ONLY the 4 iris strings plus any historically missing forwarded types (drive_crossed, telos_refined, bios_death, propose, vote_commit, vote_reveal) that NousRunner already handles but are missing from the union. This prevents the union from lying about the actual wire contract.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add 4 IRIS ActionType members to brain/src/noesis_brain/rpc/types.py</name>
  <files>brain/src/noesis_brain/rpc/types.py</files>
  <action>
Insert 4 new ActionType members after `SKILL_SHARE = "skill_share"` (line 33), before the blank line that separates the enum from the JSON-RPC error codes.

**Insert this block** (per D-17-06):
```python
    # Phase 17 — D-17-06: Iris Theory of Mind lifecycle events.
    # String values MUST match the Grid NousRunner switch cases exactly.
    # All 4 are forwarded to the Grid (unlike SKILL_LEARN/RULE_STORE/SKILL_SHARE which are Brain-internal).
    # 3-keys-not-5: Brain metadata carries 1–3 keys; Grid injects nous_did and tick at emit time.
    IRIS_BELIEF_REVISED = "iris_belief_revised"              # Metadata: {target_did, belief_hash, dimension} (3 keys)
    IRIS_CONTEXT_INVOKED = "iris_context_invoked"            # Metadata: {belief_count} (1 key)
    IRIS_CONTRADICTION_DETECTED = "iris_contradiction_detected"  # Metadata: {target_did, contradiction_hash} (2 keys)
    IRIS_PRIOR_SEEDED = "iris_prior_seeded"                  # Metadata: {target_did, seed_event_hash} (2 keys)
```

**Placement invariant:** The 4 new members must be the last items in the ActionType enum body, after all existing members. Do not reorder existing members.

**String value match invariant:** The string values `"iris_belief_revised"`, `"iris_context_invoked"`, `"iris_contradiction_detected"`, `"iris_prior_seeded"` are locked and must match character-for-character the NousRunner switch cases to be added in Wave 2.
  </action>
  <verify>
    <automated>python -c "from noesis_brain.rpc.types import ActionType; print([e.value for e in ActionType if e.name.startswith('IRIS')])"</automated>
  </verify>
  <done>
    - `ActionType.IRIS_BELIEF_REVISED.value == "iris_belief_revised"`
    - `ActionType.IRIS_CONTEXT_INVOKED.value == "iris_context_invoked"`
    - `ActionType.IRIS_CONTRADICTION_DETECTED.value == "iris_contradiction_detected"`
    - `ActionType.IRIS_PRIOR_SEEDED.value == "iris_prior_seeded"`
    - File parses: `python -c "import noesis_brain.rpc.types"` exits 0
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Extend BrainAction action_type union in protocol/src/noesis/bridge/types.ts</name>
  <files>protocol/src/noesis/bridge/types.ts</files>
  <action>
The current `action_type` union in `BrainAction` (line 26) lists only 5 types, but NousRunner already dispatches on 11+ action types. Per D-17-10, extend the union with the 4 iris types. Also backfill historically missing forwarded types so the TypeScript union accurately reflects the wire contract.

**Replace** the current `BrainAction` interface (lines 25-30):
```typescript
export interface BrainAction {
    action_type: 'speak' | 'direct_message' | 'move' | 'trade_request' | 'noop';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}
```

**With:**
```typescript
export interface BrainAction {
    /** Action type string — MUST match ActionType enum values in brain/src/noesis_brain/rpc/types.py exactly. */
    action_type:
        | 'speak'
        | 'direct_message'
        | 'move'
        | 'trade_request'
        | 'noop'
        // Phase 7: Nous-initiated telos refinement after peer dialogue.
        | 'telos_refined'
        // Phase 10a: Ananke drive threshold crossing (Grid injects nous_did + tick).
        | 'drive_crossed'
        // Phase 10b: Bios starvation death signal.
        | 'bios_death'
        // Phase 12: Governance voting lifecycle.
        | 'propose'
        | 'vote_commit'
        | 'vote_reveal'
        // Phase 17 — D-17-10: Iris Theory of Mind lifecycle events (forwarded to Grid).
        | 'iris_belief_revised'
        | 'iris_context_invoked'
        | 'iris_contradiction_detected'
        | 'iris_prior_seeded';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}
```

**Note on duplicate MemoryEntry interface:** protocol/src/noesis/bridge/types.ts has `MemoryEntry` defined twice (lines 59-66 and 78-85). This is a pre-existing issue — do NOT fix it in this wave, only touch `BrainAction`.
  </action>
  <verify>
    <automated>cd /Users/desirey/Programming/src/Noesis/protocol && npx tsc --noEmit 2>&1 | grep -c "error" | xargs -I{} sh -c 'echo "{} tsc errors"; [ "{}" -eq 0 ]'</automated>
  </verify>
  <done>
    - `BrainAction.action_type` union includes `'iris_belief_revised'`, `'iris_context_invoked'`, `'iris_contradiction_detected'`, `'iris_prior_seeded'`
    - TypeScript compiles without errors in protocol/
    - All historically dispatched action types are present in the union (telos_refined, drive_crossed, bios_death, propose, vote_commit, vote_reveal, all 4 iris)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain ActionType→Grid NousRunner | String values must match exactly; mismatch = silent noop |
| protocol bridge/types.ts | TypeScript contract between Brain adapter and Grid runner |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-W1-01 | Tampering | ActionType string value drift | mitigate | Comment in types.py: "MUST match Grid NousRunner switch cases exactly"; Wave 4 drift detector test |
| T-17-W1-02 | Information Disclosure | BrainAction union too narrow | mitigate | Backfill historical types so TypeScript compiler catches future mismatches |
</threat_model>

<verification>
```bash
# Verify all 4 iris ActionType values
python -c "
from noesis_brain.rpc.types import ActionType
iris = [e for e in ActionType if e.name.startswith('IRIS')]
for e in iris:
    print(e.name, '=', e.value)
assert len(iris) == 4
print('OK — 4 iris ActionType members')
"

# Verify protocol TypeScript compiles
cd /Users/desirey/Programming/src/Noesis/protocol && npx tsc --noEmit && echo "protocol OK"
```
</verification>

<success_criteria>
- 4 iris ActionType members importable from noesis_brain.rpc.types
- BrainAction union accepts all 4 iris strings without TypeScript error
- No existing tests broken (python -m pytest brain/ -x -q if test dir exists)
</success_criteria>

<output>
After completion, create `.planning/phases/17-iris-theory-of-mind/17-wave-1-SUMMARY.md` following the summary template.
</output>
