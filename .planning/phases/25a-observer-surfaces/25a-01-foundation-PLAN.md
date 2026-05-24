---
phase: 25a
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/util/ring-buffer.ts
  - grid/src/api/operator/brain-http-errors.ts
  - scripts/check-cognitive-snapshot-plaintext.mjs
  - grid/test/audit/forbidden-key-pattern.test.ts
  - grid/test/util/ring-buffer.test.ts
autonomous: true
requirements: [OBS-FOUNDATION]
tags: [foundation, ci-gate, plaintext-leak-prevention]
user_setup: []
must_haves:
  truths:
    - "FORBIDDEN_KEY_PATTERN rejects reflexion_text, creed_text, whisper_plaintext"
    - "FORBIDDEN_KEY_PATTERN still EXEMPTS skill_title (D-25a-05 explicit allowance)"
    - "scripts/check-cognitive-snapshot-plaintext.mjs greps endpoint + tests and exits 1 on hit"
    - "RingBuffer.peek() returns all entries without draining"
  artifacts:
    - path: "grid/src/audit/broadcast-allowlist.ts"
      provides: "Extended FORBIDDEN_KEY_PATTERN regex"
      contains: "reflexion_text|creed_text|whisper_plaintext"
    - path: "grid/src/util/ring-buffer.ts"
      provides: "Non-destructive peek() method"
      contains: "peek()"
    - path: "scripts/check-cognitive-snapshot-plaintext.mjs"
      provides: "CI grep gate for cognitive-snapshot plaintext leakage"
    - path: "grid/src/api/operator/brain-http-errors.ts"
      provides: "Shared BrainUnreachableError, BrainUnknownDidError, BrainMalformedResponseError"
  key_links:
    - from: "scripts/check-cognitive-snapshot-plaintext.mjs"
      to: "brain/src/noesis_brain/http/, grid/src/api/operator/cognitive-snapshot*.ts"
      via: "file-glob scan"
      pattern: "reflexion_text|creed_text|whisper_plaintext"
---

<objective>
Establish foundation primitives consumed by Plans 02-06: extend the FORBIDDEN_KEY_PATTERN regex with the three new plaintext keys (D-25a-05), add a non-destructive RingBuffer.peek() method (used by DriftDetector polling), extract shared Brain HTTP error classes into a reusable module (used by both brain-hash-state-client.ts and cognitive-snapshot-client.ts), and ship the CI grep gate `scripts/check-cognitive-snapshot-plaintext.mjs`.

Purpose: Without these primitives, downstream plans cannot ship safely. The forbidden-key regex is the structural plaintext-leak defense (D-25a-05); the CI gate enforces it across both Brain (Python) and Grid (TypeScript) sides; peek() unblocks DriftDetector REST polling without buffer drain. All four are tiny, surgical, and unlock parallel work in Wave 2.

Output: extended regex, extracted error module, peek() API, working CI script + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/25a-observer-surfaces/25a-CONTEXT.md
@.planning/phases/25a-observer-surfaces/25a-RESEARCH.md
@.planning/phases/25a-observer-surfaces/25a-PATTERNS.md
@grid/src/audit/broadcast-allowlist.ts
@grid/src/util/ring-buffer.ts
@grid/src/api/operator/brain-hash-state-client.ts
@scripts/check-whisper-plaintext.mjs

<interfaces>
<!-- Current FORBIDDEN_KEY_PATTERN (broadcast-allowlist.ts:421) -->
```typescript
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick|text|body|content(?!_hash)|message|utterance|plaintext|decrypted|payload_plain|description|rationale|proposal_text|law_text|body_text|weight|reputation|relationship_score|ousia_weight|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content|ltm_content|concept_text|graph_data|episode_text|node_content|edge_content|skill_body|skill_text|rule_text|norm_text|fingerprint_text|rule_content|lore_body|lore_content|title_text|summary_text/i;
```

<!-- Current RingBuffer<T> (ring-buffer.ts) -->
```typescript
export class RingBuffer<T> {
    push(item: T): T | null;        // returns evicted item or null
    drain(): T[];                    // DESTRUCTIVE — returns + empties
    get size(): number;
    get capacity(): number;
    get isFull(): boolean;
}
```

<!-- Brain HTTP errors (brain-hash-state-client.ts:22-48) -->
```typescript
export class BrainUnreachableError extends Error { constructor(cause: unknown) }
export class BrainUnknownDidError extends Error { constructor(did: string, status: number) }
export class BrainMalformedResponseError extends Error { constructor(detail: string) }
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend FORBIDDEN_KEY_PATTERN and add ring-buffer peek()</name>
  <read_first>
    - grid/src/audit/broadcast-allowlist.ts (read lines 1-460 fully — regex is line 421; reading the existing whisper FORBIDDEN comment block at 358-365 explains the design)
    - grid/src/util/ring-buffer.ts (entire file — 50 lines)
    - .planning/phases/25a-observer-surfaces/25a-RESEARCH.md §"Brain Endpoint Forbidden-Key Contract" (lines 392-408)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"grid/src/audit/broadcast-allowlist.ts (MOD)" (lines 430-435)
  </read_first>
  <behavior>
    - FORBIDDEN_KEY_PATTERN matches `reflexion_text` (case-insensitive)
    - FORBIDDEN_KEY_PATTERN matches `creed_text`
    - FORBIDDEN_KEY_PATTERN matches `whisper_plaintext`
    - FORBIDDEN_KEY_PATTERN does NOT match `skill_title` (D-25a-05 exemption — critical)
    - FORBIDDEN_KEY_PATTERN does NOT match `content_hash` (existing `(?!_hash)` lookahead preserved)
    - All existing forbidden alternates still match (regression: `skill_body`, `rule_text`, `lore_body`, `prompt`, etc.)
    - RingBuffer.peek() returns the entries array in FIFO order WITHOUT draining
    - After peek(), subsequent push/peek/drain see identical state to before peek()
  </behavior>
  <action>
    1. Edit `grid/src/audit/broadcast-allowlist.ts` line 421. Append `|reflexion_text|creed_text|whisper_plaintext` to the regex character set BEFORE the closing `/i`. Place the additions immediately after `|summary_text` and before `/i`. Do NOT add `skill_title` (per D-25a-05 explicit exemption — pitfall 7 in RESEARCH).
    2. Edit `grid/src/util/ring-buffer.ts`. Add a `peek(): readonly T[]` method that returns `[...this.items]` (defensive copy, non-destructive). Place between `drain()` and the `size` getter. Update JSDoc to clarify: "Non-destructive snapshot in FIFO order. Used by DriftDetector polling."
    3. Create `grid/test/audit/forbidden-key-pattern.test.ts` with the explicit MUST-MATCH and MUST-NOT-MATCH cases listed in behavior. Use vitest `describe`/`it`/`expect` matching the conventions of existing grid tests.
    4. Create `grid/test/util/ring-buffer.test.ts` (if not already present — check first; if it exists, ADD a `describe('peek')` block, do not duplicate file). Test: peek() returns identical array shape to drain() but does not empty buffer; consecutive peek() calls return identical results; peek() on empty buffer returns `[]`.
    5. Run `cd grid && npx vitest run test/audit/forbidden-key-pattern.test.ts test/util/ring-buffer.test.ts --reporter=verbose` — must pass.
  </action>
  <verify>
    <automated>cd grid && npx vitest run test/audit/forbidden-key-pattern.test.ts test/util/ring-buffer.test.ts --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "reflexion_text" grid/src/audit/broadcast-allowlist.ts` returns a match on the FORBIDDEN_KEY_PATTERN line
    - `grep -n "creed_text" grid/src/audit/broadcast-allowlist.ts` returns a match
    - `grep -n "whisper_plaintext" grid/src/audit/broadcast-allowlist.ts` returns a match
    - `grep -c "skill_title" grid/src/audit/broadcast-allowlist.ts` returns 0 (NOT in pattern)
    - `grep -n "peek" grid/src/util/ring-buffer.ts` returns a match on a method declaration
    - vitest run exits 0 for both new test files
    - All existing forbidden-key regression tests still pass: `cd grid && npx vitest run --reporter=verbose | grep -E "FORBIDDEN|forbidden"` shows passes
  </acceptance_criteria>
  <done>Regex extended with 3 new keys (skill_title NOT added); peek() method added with passing tests; existing forbidden-key tests still green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extract shared Brain HTTP error classes</name>
  <read_first>
    - grid/src/api/operator/brain-hash-state-client.ts (lines 1-50 fully — error class definitions)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"cognitive-snapshot-client.ts" (lines 207-218) — explicitly recommends extracting to brain-http-errors.ts
  </read_first>
  <behavior>
    - `brain-http-errors.ts` exports `BrainUnreachableError`, `BrainUnknownDidError`, `BrainMalformedResponseError` with identical shape and message format to current brain-hash-state-client.ts definitions
    - `brain-hash-state-client.ts` re-imports the three classes from the shared module (zero behavior change)
    - All existing tests that import these error classes from `brain-hash-state-client.ts` still pass (the re-export preserves the import path)
  </behavior>
  <action>
    1. Create `grid/src/api/operator/brain-http-errors.ts`. Move the three error classes (`BrainUnreachableError`, `BrainUnknownDidError`, `BrainMalformedResponseError`) from `brain-hash-state-client.ts` lines 22-48 verbatim into this new file. Keep identical constructor signatures, error messages, and `name` assignments.
    2. Edit `grid/src/api/operator/brain-hash-state-client.ts`:
       - Remove the three class declarations (lines 22-48).
       - Add at top: `import { BrainUnreachableError, BrainUnknownDidError, BrainMalformedResponseError } from './brain-http-errors.js';`
       - Add a re-export so existing import sites keep working: `export { BrainUnreachableError, BrainUnknownDidError, BrainMalformedResponseError };`
    3. Run `cd grid && npm run test` — full suite must remain green (proves zero regression).
    4. Run `cd grid && npx tsc --noEmit` — must pass (proves no type breakage).
  </action>
  <verify>
    <automated>cd grid && npx tsc --noEmit && npm run test 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -l "class BrainUnreachableError" grid/src/api/operator/` lists ONLY `brain-http-errors.ts` (single definition)
    - `grep -n "export.*BrainUnreachableError" grid/src/api/operator/brain-hash-state-client.ts` shows a re-export (not a class definition)
    - `cd grid && npm run test` exits 0
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Three error classes live in brain-http-errors.ts; brain-hash-state-client.ts re-exports them; zero test regressions.</done>
</task>

<task type="auto">
  <name>Task 3: Ship scripts/check-cognitive-snapshot-plaintext.mjs CI gate</name>
  <read_first>
    - scripts/check-whisper-plaintext.mjs (entire 276 lines — the analog to clone)
    - .planning/phases/25a-observer-surfaces/25a-RESEARCH.md §"Brain Endpoint Forbidden-Key Contract" (lines 392-408)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"check-cognitive-snapshot-plaintext.mjs" (lines 417-427)
  </read_first>
  <action>
    1. Copy `scripts/check-whisper-plaintext.mjs` to `scripts/check-cognitive-snapshot-plaintext.mjs`. Then modify:
    2. Change the FILE_GLOBS / scan-scope constants to target:
       - `brain/src/noesis_brain/http/**/*.py`
       - `brain/test/test_cognitive_snapshot*.py`
       - `grid/src/api/operator/cognitive-snapshot*.ts`
       - `grid/test/operator/cognitive-snapshot*.test.ts`
    3. Change the FORBIDDEN_KEYS array to EXACTLY: `['reflexion_text', 'rule_text', 'creed_text', 'skill_body', 'lore_body', 'whisper_plaintext']`. Do NOT include `skill_title` (D-25a-05 exemption — explicit comment in the script: `// skill_title is the documented exception per D-25a-05; never add it`).
    4. Preserve exit-1-on-hit / exit-0-on-clean semantics. Preserve the report-format (file path + line number + matched key).
    5. Sanity check: the script must succeed at the current state of the repo (no cognitive-snapshot files exist yet → 0 hits → exit 0). Run: `node scripts/check-cognitive-snapshot-plaintext.mjs` → exit 0.
    6. Negative test: create a temp file `/tmp/leak-test.py` containing `reflexion_text = "leak"`, place it on a temporary glob, run the script, confirm exit 1. (This is exploratory — don't commit the temp file. Verify-then-delete.)
  </action>
  <verify>
    <automated>node scripts/check-cognitive-snapshot-plaintext.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `test -x scripts/check-cognitive-snapshot-plaintext.mjs` (executable) OR script runs via `node`
    - `grep -n "skill_title" scripts/check-cognitive-snapshot-plaintext.mjs` shows ONLY a comment explaining the exemption (no array membership)
    - `grep -nE "reflexion_text|creed_text|whisper_plaintext" scripts/check-cognitive-snapshot-plaintext.mjs` returns matches (all three keys in the FORBIDDEN list)
    - `node scripts/check-cognitive-snapshot-plaintext.mjs; echo "exit=$?"` prints `exit=0` at HEAD (no scanned files yet)
    - Script reports include the matched keyword + file path + line number (verified by manual leak test)
  </acceptance_criteria>
  <done>CI script committed, executable, passes at HEAD with zero hits, fails (exit 1) when a forbidden key is introduced.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build/CI → repo | CI grep gate runs against repository files before commit |
| code → forbidden-key regex | Sole-producer audit emitters validate payload keys against FORBIDDEN_KEY_PATTERN at runtime |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25a-01-01 | Information Disclosure | FORBIDDEN_KEY_PATTERN gap | mitigate | Add `reflexion_text|creed_text|whisper_plaintext` to regex (D-25a-05); CI test asserts new keys match and `skill_title` does NOT match |
| T-25a-01-02 | Information Disclosure | CI grep gate bypass | mitigate | `scripts/check-cognitive-snapshot-plaintext.mjs` runs against brain/, grid/, and test scopes; exits 1 on any FORBIDDEN_KEYS hit; wired into pre-commit (separate concern, not 25a) |
| T-25a-01-03 | Tampering | Accidentally adding `skill_title` to FORBIDDEN list | mitigate | Test in `forbidden-key-pattern.test.ts` asserts `skill_title` does NOT match (regression gate); explanatory comment in CI script |
| T-25a-01-04 | Repudiation | — | accept | Foundation changes are CI-traceable via git; no runtime audit needed |
| T-25a-01-05 | Denial of Service | RingBuffer.peek() memory copy on every poll | accept | Buffer capacity is 256; copy cost is O(256) which is negligible at 5s poll rate |
</threat_model>

<verification>
- All three tasks have green `<automated>` verification commands
- After completion: `node scripts/check-cognitive-snapshot-plaintext.mjs && cd grid && npm run test && npx tsc --noEmit` exits 0 in sequence
- No new audit events introduced (allowlist delta confirmed 0)
- `grep -c "skill_title" grid/src/audit/broadcast-allowlist.ts scripts/check-cognitive-snapshot-plaintext.mjs` returns only comment-level matches (zero array/regex membership)
</verification>

<success_criteria>
- FORBIDDEN_KEY_PATTERN extended with exactly 3 keys; skill_title NOT added
- RingBuffer.peek() shipped, tested, non-destructive
- brain-http-errors.ts exports 3 error classes; brain-hash-state-client.ts re-exports them; zero behavior change
- scripts/check-cognitive-snapshot-plaintext.mjs exists, executable, scope-correct, exits 0 at HEAD
- All existing grid tests still pass
</success_criteria>

<output>
After completion, create `.planning/phases/25a-observer-surfaces/25a-01-SUMMARY.md` documenting:
- Final FORBIDDEN_KEY_PATTERN string (verbatim)
- RingBuffer.peek() signature
- brain-http-errors.ts module path + exports
- CI script scan globs + forbidden key list
- Decision IDs implemented: D-25a-05 (forbidden-key gate)
</output>
