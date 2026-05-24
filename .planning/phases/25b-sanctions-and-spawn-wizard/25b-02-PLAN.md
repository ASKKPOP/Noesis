---
phase: 25b-sanctions-and-spawn-wizard
plan: 02
type: execute
wave: 0
depends_on: []
files_modified:
  - grid/src/api/operator/governance-laws.ts
  - grid/test/operator/governance-laws.test.ts
autonomous: true
requirements: [D-25b-NEW-1, D-25b-10]
tags: [header-auth, security, operator, h3, governance]

must_haves:
  truths:
    - "Governance operator routes reject body-supplied tier with 401 tier_missing"
    - "Header x-operator-tier:3 + valid x-operator-id succeed; body tier ignored"
    - "Non-auth body fields (proposal text, ballot data) still parsed correctly"
  artifacts:
    - path: "grid/src/api/operator/governance-laws.ts"
      provides: "Header-trust auth for governance operator endpoints"
      contains: "OPERATOR_ID_REGEX"
    - path: "grid/test/operator/governance-laws.test.ts"
      provides: "Regression tests pinning header-auth contract"
  key_links:
    - from: "governance-laws.ts"
      to: "x-operator-tier header"
      via: "req.headers['x-operator-tier']"
      pattern: "x-operator-tier"
---

<objective>
Migrate `grid/src/api/operator/governance-laws.ts` operator endpoints from body-trust to header-trust authentication (D-25b-NEW-1). H3 tier gate.

Purpose: Wave 0 prerequisite — header-auth all 6 existing operator routes before sanction routes land.
Output: Header-auth on every operator handler in governance-laws.ts; regression tests; non-auth body fields preserved.
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
  <name>Task 1: Migrate governance-laws.ts operator handlers to header-auth (H3)</name>
  <files>grid/src/api/operator/governance-laws.ts</files>
  <read_first>
    - grid/src/api/operator/governance-laws.ts (file being modified — identify EVERY handler that currently uses validateTierBody)
    - grid/src/api/operator/cognitive-snapshot.ts (canonical analog — lines 25-90)
    - grid/src/api/operator/types.ts (OPERATOR_ID_REGEX)
  </read_first>
  <action>
    For EVERY handler in governance-laws.ts that currently calls `validateTierBody`:

    1. Replace the validateTierBody block with the verbatim header-auth block from cognitive-snapshot.ts lines ~65-90 (tier read → numeric parse → `< 3` gate → opId header read → OPERATOR_ID_REGEX validation → `resolvedTier: 'H3' = 'H3'` → `resolvedOperatorId`).
    2. Body types: KEEP non-auth fields (e.g. proposal body, ballot data) — only remove `tier` and `operator_id` fields from the Body type.
    3. Remove `import { validateTierBody, type OperatorBody } ...` if it becomes unused. Add `import { OPERATOR_ID_REGEX } from '../types.js';`.
    4. Downstream: substitute `v.tier` → `resolvedTier`, `v.operator_id` → `resolvedOperatorId` in any audit emits.
    5. Preserve existing error-ladder comment style at top — add 400/401/403 cases.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/governance-laws.test.ts</automated>
  </verify>
  <done>
    - validateTierBody no longer called from governance-laws.ts
    - All handlers read tier/operator_id from headers
    - Non-auth body fields untouched
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression tests for governance header-auth contract</name>
  <files>grid/test/operator/governance-laws.test.ts</files>
  <read_first>
    - grid/test/operator/governance-laws.test.ts (existing tests)
    - grid/test/operator/cognitive-snapshot.test.ts (assertion shape analog)
  </read_first>
  <behavior>
    - For EACH operator endpoint in governance-laws.ts (enumerate them by reading the route file first):
      * No headers + body `{tier:'H5'}` → 401 tier_missing
      * Header `x-operator-tier:'2'` → 403 tier_too_low
      * Header `x-operator-tier:'3'`, missing/bad x-operator-id → 400 invalid_operator_id
      * Header `x-operator-tier:'3'` + valid x-operator-id + body claiming `tier:'H1'` → 200; body tier IGNORED
    - Audit emit (where applicable) sources operator_id from header
  </behavior>
  <action>
    Mirror cognitive-snapshot.test.ts describe-block structure. Add one describe('header-auth contract') section per operator endpoint with the 4 cases above.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/governance-laws.test.ts</automated>
  </verify>
  <done>
    - All new test cases pass
    - Existing legitimate-operator tests still pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → Grid governance operator endpoints | Untrusted client must not control tier |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-02-01 | Elevation of Privilege | governance-laws.ts | mitigate | Header-trust per D-25b-NEW-1; tests pin contract |
| T-25b-02-02 | Spoofing | governance-laws.ts | mitigate | OPERATOR_ID_REGEX validation on x-operator-id header |
</threat_model>

<verification>
- Test command passes
- `grep -n "validateTierBody" grid/src/api/operator/governance-laws.ts` returns nothing
</verification>

<success_criteria>
- Governance operator endpoints reject body-supplied tier
- Regression tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-02-SUMMARY.md`
</output>
