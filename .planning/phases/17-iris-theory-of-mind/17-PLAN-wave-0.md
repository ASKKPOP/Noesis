---
phase: 17-iris-theory-of-mind
plan: wave-0
type: execute
wave: 1
depends_on: []
files_modified:
  - brain/src/noesis_brain/rpc/handler.py
  - grid/src/audit/broadcast-allowlist.ts
autonomous: true
requirements: [IRIS-00-pre]

must_haves:
  truths:
    - "BrainHandler.__init__ declares self._iris_runtime = None before any guard at line 217"
    - "broadcast-allowlist.ts contains exactly 36 entries, positions 28-32 are Phase 15/16 stubs, positions 33-36 are the 4 iris.* events"
    - "FORBIDDEN_KEY_PATTERN includes all 6 iris-specific forbidden keys"
    - "IRIS_FORBIDDEN_KEYS export exists in broadcast-allowlist.ts"
  artifacts:
    - path: "brain/src/noesis_brain/rpc/handler.py"
      provides: "_iris_runtime field initialized in __init__"
      contains: "self._iris_runtime = None"
    - path: "grid/src/audit/broadcast-allowlist.ts"
      provides: "36-entry allowlist + extended FORBIDDEN_KEY_PATTERN"
      contains: "iris.belief_revised"
  key_links:
    - from: "BrainHandler.__init__ (line ~72)"
      to: "self._iris_runtime guard at line 217"
      via: "field initialization before first use"
      pattern: "self\\._iris_runtime = None"
    - from: "broadcast-allowlist.ts ALLOWLIST_MEMBERS"
      to: "NousRunner case dispatch"
      via: "isAllowlisted() gate"
      pattern: "iris\\.belief_revised"
---

<objective>
Fix the two Wave 0 blockers that would cause runtime failures if left unaddressed.

Purpose: Any on_tick() call currently raises AttributeError on `self._iris_runtime` (used at line 217 but never initialized). The allowlist must reach 36 entries (adding Phase 15/16 stubs at 28-32 and Iris entries at 33-36) before Wave 2 emitters can be registered.

Output: handler.py with `_iris_runtime = None` in `__init__`, broadcast-allowlist.ts with 36 entries and extended FORBIDDEN_KEY_PATTERN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/17-iris-theory-of-mind/17-CONTEXT.md
@.planning/phases/17-iris-theory-of-mind/17-PATTERNS.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Fix AttributeError — declare _iris_runtime in BrainHandler.__init__</name>
  <files>brain/src/noesis_brain/rpc/handler.py</files>
  <action>
The field `self._iris_runtime` is referenced at line 217 (`if self._iris_runtime is not None`) but never assigned in `__init__`. This raises AttributeError on every on_tick() call.

**Add one line to `__init__` body** immediately after `self._bios_birth_ticks: dict[str, int] = {}` (line 71), before `__init__` closes:

```python
        self._iris_runtime = None  # Phase 17 D-17-14: declared here; initialized in Wave 3 Task 1
```

No other changes to handler.py in this wave. The full IrisRuntime initialization (with iris_db_dir parameter and IrisStore construction) is Wave 3 Task 1. This wave only ensures the field exists to prevent AttributeError.

**Verification that placement is correct:** After the edit, run:
```
grep -n "_iris_runtime" brain/src/noesis_brain/rpc/handler.py | head -10
```
The assignment must appear BEFORE the guard at line 217. The line number of `self._iris_runtime = None` must be less than the line number of `if self._iris_runtime is not None`.

**Duplicate method warning (D-17 PATTERNS.md):** handler.py has duplicate method definitions (hash_state x2, query_memory x2, force_telos x2). Touch ONLY `__init__` (lines 40-71 region). Do not touch any other block.
  </action>
  <verify>
    <automated>python -c "import ast, sys; ast.parse(open('brain/src/noesis_brain/rpc/handler.py').read()) and print('syntax ok')"</automated>
  </verify>
  <done>
    - `self._iris_runtime = None` appears in `__init__` body at a line number less than 217
    - File parses without syntax error
    - `grep -c "_iris_runtime" brain/src/noesis_brain/rpc/handler.py` returns at least 3 (assignment + two guards)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Extend broadcast-allowlist.ts — positions 28-36 + FORBIDDEN_KEY_PATTERN</name>
  <files>grid/src/audit/broadcast-allowlist.ts</files>
  <action>
The allowlist currently has 27 entries ending at `'operator.exported'` (line 126). Phases 15 and 16 were not executed — their events are absent. Phase 17 D-17-01 requires verifying positions 28-32 exist before adding 33-36. Since they are absent, add them now as documented stubs.

**Step 1 — Update the header comment block** (lines 24-61). Replace the final line of the header:
```
 *  Phase 13 (REPLAY-02): +1 'operator.exported' at position 27...
```
with those lines preserved, and append below them:
```
 *  Phase 15 (REFLEX-02): +3 nous.reflection_authored, nous.self_model_revised, nous.creed_violation at positions 28-30.
 *  Phase 16 (SLEEP-01): +2 nous.sleep.entered, nous.sleep.completed at positions 31-32.
 *  Phase 17 (D-17-02): +4 iris.* events at positions 33-36 (allowlist 32→36).
 *   - 'iris.belief_revised'           (33) — closed 4-key {nous_did, tick, target_did, belief_hash}
 *   - 'iris.context_invoked'          (34) — closed 3-key {nous_did, tick, belief_count}
 *   - 'iris.contradiction_detected'   (35) — closed 4-key {nous_did, tick, target_did, contradiction_hash}
 *   - 'iris.prior_seeded'             (36) — closed 4-key {nous_did, tick, target_did, seed_event_hash}
 *  All 4 emitted ONLY via grid/src/iris/append*.ts sole-producer emitters (D-17-08).
```
Also update the opening summary line from "exactly these 27 event types" to "exactly these 36 event types" and update the version stamp to include "Phase 15 + Phase 16 + Phase 17".

**Step 2 — Append entries to ALLOWLIST_MEMBERS array** after `'operator.exported',` (line 126), before `] as const;`:

```typescript
    // Phase 15 (REFLEX-02) — stub allowlist entries. Sole-producer emitters in grid/src/reflexion/.
    // Added as prerequisites per D-17-01 (Phase 15/16 were not separately executed).
    'nous.reflection_authored',  // (28) {nous_did, tick, reflection_hash}
    'nous.self_model_revised',   // (29) {nous_did, tick, revision_hash}
    'nous.creed_violation',      // (30) {nous_did, tick, creed_hash, violation_hash}
    // Phase 16 (SLEEP-01) — stub allowlist entries. Sole-producer emitters in grid/src/sleep/.
    // Added as prerequisites per D-17-01 (Phase 15/16 were not separately executed).
    'nous.sleep.entered',        // (31) {nous_did, tick}
    'nous.sleep.completed',      // (32) {nous_did, tick, sleep_duration_ticks}
    // Phase 17 (IRIS-01..04 / D-17-02) — Theory of Mind lifecycle events.
    // All 4 carry hashes/counts only — belief content is Brain-private and NEVER crosses the wire.
    // Sole producers in grid/src/iris/append*.ts (D-17-08).
    'iris.belief_revised',         // (33) {nous_did, tick, target_did, belief_hash}
    'iris.context_invoked',        // (34) {nous_did, tick, belief_count}
    'iris.contradiction_detected', // (35) {nous_did, tick, target_did, contradiction_hash}
    'iris.prior_seeded',           // (36) {nous_did, tick, target_did, seed_event_hash}
```

**Step 3 — Extend FORBIDDEN_KEY_PATTERN** (line 274). The current regex ends with `ousia_weight/i`. Extend it by inserting before the `/i` flag:

```
|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content
```

Result (full new regex):
```typescript
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick|text|body|content|message|utterance|plaintext|decrypted|payload_plain|description|rationale|proposal_text|law_text|body_text|weight|reputation|relationship_score|ousia_weight|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content/i;
```

Also add the FORBIDDEN_KEY_PATTERN JSDoc comment extension (after the Phase 12 comment block, before the export line) noting Phase 17 additions.

**Step 4 — Add IRIS_FORBIDDEN_KEYS export** after `GOVERNANCE_FORBIDDEN_KEYS` (after line 218), following the exact same Object.freeze pattern:

```typescript
/**
 * Phase 17 (D-17-17): iris-leaf keys that MUST NOT appear in any iris payload.
 * Belief content, target text, emotion prose, dimension labels, and any iris
 * narrative is Brain-private and NEVER crosses the wire.
 * Only hashes (belief_hash, contradiction_hash, seed_event_hash) and counts
 * (belief_count) are permitted. Per D-17-17 — exactly 6 keys.
 */
export const IRIS_FORBIDDEN_KEYS = Object.freeze([
    'belief_content',
    'target_content',
    'emotion_text',
    'dimension_text',
    'belief_prose',
    'iris_content',
] as const);
```

**Ordering invariant:** The tuple ORDER of ALLOWLIST_MEMBERS is locked; broadcast-allowlist.test.ts will fail if order changes. Only append; never insert.
  </action>
  <verify>
    <automated>cd /Users/desirey/Programming/src/Noesis/grid && npx tsc --noEmit 2>&1 | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <done>
    - `ALLOWLIST_MEMBERS` has exactly 36 entries (`grep -c "'" grid/src/audit/broadcast-allowlist.ts` within the array context)
    - `isAllowlisted('iris.belief_revised')` returns true (verified by: `node -e "import('./src/audit/broadcast-allowlist.js').then(m => console.log(m.isAllowlisted('iris.belief_revised')))"` from grid/ dir)
    - `FORBIDDEN_KEY_PATTERN` includes `belief_content` and `iris_content`
    - `IRIS_FORBIDDEN_KEYS` is exported with 6 entries
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain→Grid | Action metadata crosses; belief content must not |
| Grid→Dashboard | Allowlist gate prevents inner-life field leakage |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-W0-01 | Information Disclosure | FORBIDDEN_KEY_PATTERN extension | mitigate | 6 new iris-specific keys added to regex; IRIS_FORBIDDEN_KEYS export for per-emitter belt-check |
| T-17-W0-02 | Denial of Service | Missing _iris_runtime initialization | mitigate | Declare field in __init__ before first guard; AttributeError eliminated |
</threat_model>

<verification>
```bash
# Verify _iris_runtime declared before first use
grep -n "_iris_runtime" brain/src/noesis_brain/rpc/handler.py | head -6

# Verify allowlist count = 36
node -e "
import('./grid/src/audit/broadcast-allowlist.js').then(m => {
  console.log('allowlist size:', m.ALLOWLIST_MEMBERS.length);
  console.log('iris.belief_revised:', m.isAllowlisted('iris.belief_revised'));
  console.log('iris.prior_seeded:', m.isAllowlisted('iris.prior_seeded'));
});
"

# Verify FORBIDDEN_KEY_PATTERN covers iris keys
node -e "
import('./grid/src/audit/broadcast-allowlist.js').then(m => {
  ['belief_content','iris_content','emotion_text','dimension_text'].forEach(k => {
    console.log(k, m.FORBIDDEN_KEY_PATTERN.test(k));
  });
});
"
```
</verification>

<success_criteria>
- Wave 0 blockers resolved: no AttributeError on BrainHandler instantiation
- Allowlist has 36 entries in locked tuple order
- FORBIDDEN_KEY_PATTERN rejects all 6 iris forbidden keys
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/phases/17-iris-theory-of-mind/17-wave-0-SUMMARY.md` following the summary template.
</output>
