---
phase: 25b-sanctions-and-spawn-wizard
plan: 04
type: execute
wave: 0
depends_on: []
files_modified:
  - grid/src/api/operator/delete-nous.ts
  - grid/test/operator/delete-nous.test.ts
autonomous: true
requirements: [D-25b-NEW-1, D-25b-10]
tags: [header-auth, security, operator, h5]

must_haves:
  truths:
    - "delete-nous rejects body-supplied tier with 401 tier_missing"
    - "Tier gate is H5 (< 5 → 403 tier_too_low)"
    - "ORDER-LOCKED sequence preserved: tombstone check → despawn → appendBiosDeath → appendNousDeleted"
    - "Audit emits (bios.death + nous.deleted) source operator_id from header"
  artifacts:
    - path: "grid/src/api/operator/delete-nous.ts"
      provides: "Header-trust auth for POST delete-nous endpoint, H5"
      contains: "OPERATOR_ID_REGEX"
    - path: "grid/test/operator/delete-nous.test.ts"
      provides: "Regression tests for header-auth contract"
  key_links:
    - from: "delete-nous.ts"
      to: "x-operator-tier header"
      via: "req.headers['x-operator-tier']"
      pattern: "x-operator-tier"
---

<objective>
Migrate `delete-nous.ts` from body-trust to header-trust authentication, H5 tier. Preserve the ORDER-LOCKED audit emit sequence (Phase 10b D-30: appendBiosDeath cause=operator_h5 → appendNousDeleted).

Purpose: Wave 0 prerequisite. H5 delete-nous is one of the most security-critical routes.
Output: Header-auth migration with no behavior change; tests pin contract + ordering.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-CONTEXT.md
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-PATTERNS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate delete-nous.ts to header-auth (H5)</name>
  <files>grid/src/api/operator/delete-nous.ts</files>
  <read_first>
    - grid/src/api/operator/delete-nous.ts (file being modified — note ORDER-LOCKED comment block)
    - grid/src/api/operator/cognitive-snapshot.ts (canonical analog lines 25-90)
    - grid/src/api/operator/types.ts (OPERATOR_ID_REGEX)
    - grid/src/audit/append-nous-deleted.ts (verify operator_id source matches header)
  </read_first>
  <action>
    1. Remove `import { validateTierBody, type OperatorBody }`. Add `import { OPERATOR_ID_REGEX } from '../types.js';`.
    2. Replace validateTierBody block with header-auth block from cognitive-snapshot.ts:
       - Tier gate: `if (tierNum < 5)` → 403 tier_too_low
       - `const resolvedTier: 'H5' = 'H5';`
    3. Body type: `Body: never` (delete-nous uses no other body fields; verify by reading the file).
    4. Substitute `v.tier` → `resolvedTier`, `v.operator_id` → `resolvedOperatorId` in BOTH appendBiosDeath and appendNousDeleted calls.
    5. PRESERVE the ORDER-LOCKED comment block at top of file and the sequence: tombstone check → registry.despawn → appendBiosDeath(cause='operator_h5') → appendNousDeleted. Do NOT reorder.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/delete-nous.test.ts</automated>
  </verify>
  <done>
    - Tier gate is `< 5`
    - ORDER-LOCKED sequence intact
    - Both audit emits use resolvedOperatorId
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression tests for delete-nous header-auth + ORDER-LOCKED preservation</name>
  <files>grid/test/operator/delete-nous.test.ts</files>
  <read_first>
    - grid/test/operator/delete-nous.test.ts (existing tests, especially ORDER-LOCKED assertions)
    - grid/test/operator/cognitive-snapshot.test.ts (header-auth assertion analog)
  </read_first>
  <behavior>
    - No headers + body `{tier:'H5'}` → 401 tier_missing
    - Header `x-operator-tier:'4'` (< 5) → 403 tier_too_low
    - Header `x-operator-tier:'5'`, bad x-operator-id → 400 invalid_operator_id
    - Header `x-operator-tier:'5'` + valid x-operator-id + body `{tier:'H1'}` → 200; tier ignored
    - Audit chain still shows bios.death(cause='operator_h5') IMMEDIATELY before nous.deleted (existing ORDER-LOCKED test must still pass)
    - bios.death.operator_id === nous.deleted.operator_id === header-supplied x-operator-id
  </behavior>
  <action>Add header-auth describe block. Verify the existing ORDER-LOCKED test (or extend it) reads operator_id from header path.</action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/delete-nous.test.ts</automated>
  </verify>
  <done>All tests pass including ORDER-LOCKED.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → Grid delete-nous (H5) | Untrusted client must not claim H5; consequences irreversible |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-04-01 | Elevation of Privilege | delete-nous.ts | mitigate | H5 header-trust gate per D-25b-NEW-1; tests pin contract |
| T-25b-04-02 | Tampering | delete-nous.ts | mitigate | ORDER-LOCKED sequence preserved; explicit test asserts ordering |
</threat_model>

<verification>
- Tests pass
- `grep -n "validateTierBody" grid/src/api/operator/delete-nous.ts` returns nothing
- `grep -n "tierNum < 5" grid/src/api/operator/delete-nous.ts` returns the H5 gate
</verification>

<success_criteria>
- delete-nous enforces H5 via header
- ORDER-LOCKED audit sequence intact
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-04-SUMMARY.md`
</output>
