---
phase: 25b-sanctions-and-spawn-wizard
plan: 03
type: execute
wave: 0
depends_on: []
files_modified:
  - grid/src/api/operator/telos-force.ts
  - grid/test/operator/telos-force.test.ts
autonomous: true
requirements: [D-25b-NEW-1, D-25b-10]
tags: [header-auth, security, operator, h4]

must_haves:
  truths:
    - "telos-force rejects body-supplied tier with 401 tier_missing"
    - "Tier gate is H4 (< 4 → 403 tier_too_low)"
    - "Header x-operator-tier:4 + valid x-operator-id succeeds; body tier ignored"
    - "telos plaintext body fields (telos statement) still parsed correctly"
  artifacts:
    - path: "grid/src/api/operator/telos-force.ts"
      provides: "Header-trust auth for POST telos-force endpoint"
      contains: "OPERATOR_ID_REGEX"
    - path: "grid/test/operator/telos-force.test.ts"
      provides: "Regression tests pinning header-auth contract"
  key_links:
    - from: "telos-force.ts"
      to: "x-operator-tier header"
      via: "req.headers['x-operator-tier']"
      pattern: "x-operator-tier"
---

<objective>
Migrate `telos-force.ts` from body-trust to header-trust authentication, tier H4 (D-25b-NEW-1). Mirror cognitive-snapshot.ts pattern.

Purpose: Wave 0 prerequisite.
Output: Header-auth in route + regression tests; telos.refined audit emit (if any) sources operator_id from header.
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
  <name>Task 1: Migrate telos-force.ts to header-auth (H4)</name>
  <files>grid/src/api/operator/telos-force.ts</files>
  <read_first>
    - grid/src/api/operator/telos-force.ts (file being modified)
    - grid/src/api/operator/cognitive-snapshot.ts (canonical analog lines 25-90)
    - grid/src/api/operator/types.ts (OPERATOR_ID_REGEX)
  </read_first>
  <action>
    1. Remove `import { validateTierBody, type OperatorBody }`. Add `import { OPERATOR_ID_REGEX } from '../types.js';`.
    2. Replace validateTierBody block with verbatim header-auth block from cognitive-snapshot.ts, with these adaptations:
       - Tier gate: `if (tierNum < 4)` → 403 tier_too_low
       - `const resolvedTier: 'H4' = 'H4';`
    3. Body type: KEEP `telos` / telos-statement field; remove only `tier` and `operator_id` from Body.
    4. Substitute `v.tier` → `resolvedTier`, `v.operator_id` → `resolvedOperatorId` in downstream audit emit and registry mutation.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/telos-force.test.ts</automated>
  </verify>
  <done>
    - validateTierBody no longer imported
    - Tier gate is `< 4`
    - Telos body field still parsed
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression tests for telos-force header-auth contract</name>
  <files>grid/test/operator/telos-force.test.ts</files>
  <read_first>
    - grid/test/operator/telos-force.test.ts (existing tests)
    - grid/test/operator/cognitive-snapshot.test.ts (assertion analog)
  </read_first>
  <behavior>
    - No headers + body `{tier:'H5'}` → 401 tier_missing
    - Header `x-operator-tier:'3'` (< 4) → 403 tier_too_low
    - Header `x-operator-tier:'4'`, bad x-operator-id → 400 invalid_operator_id
    - Header `x-operator-tier:'4'` + valid x-operator-id + body `{tier:'H1', telos:'...'}` → 200; tier ignored; telos accepted
    - Audit emit operator_id sources from header
  </behavior>
  <action>Clone cognitive-snapshot.test.ts header-auth describe block; substitute endpoint URL and H4 threshold.</action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/telos-force.test.ts</automated>
  </verify>
  <done>
    - All test cases pass
    - Existing tests still pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → Grid telos-force endpoint | Untrusted client must not control tier |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-03-01 | Elevation of Privilege | telos-force.ts | mitigate | Header-trust H4 gate per D-25b-NEW-1; tests pin contract |
</threat_model>

<verification>
- Test passes
- `grep -n "validateTierBody" grid/src/api/operator/telos-force.ts` returns nothing
- `grep -n "tierNum < 4" grid/src/api/operator/telos-force.ts` returns the H4 gate line
</verification>

<success_criteria>
- telos-force rejects body tier; enforces H4 via header
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-03-SUMMARY.md`
</output>
