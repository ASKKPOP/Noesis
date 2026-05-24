---
phase: 25b-sanctions-and-spawn-wizard
plan: 06
type: execute
wave: 0
depends_on: []
files_modified:
  - grid/src/api/operator/export-replay.ts
  - grid/test/operator/export-replay.test.ts
autonomous: true
requirements: [D-25b-NEW-1, D-25b-10]
tags: [header-auth, security, operator, h5, export]

must_haves:
  truths:
    - "export-replay rejects body-supplied tier with 401 tier_missing"
    - "Tier gate is H5 (< 5 → 403 tier_too_low)"
    - "operator.exported audit payload sources operator_id from header"
    - "export tarball generation unchanged for valid header-auth requests"
  artifacts:
    - path: "grid/src/api/operator/export-replay.ts"
      provides: "Header-trust auth for export-replay endpoint, H5"
      contains: "OPERATOR_ID_REGEX"
    - path: "grid/test/operator/export-replay.test.ts"
      provides: "Regression tests for header-auth contract"
  key_links:
    - from: "export-replay.ts"
      to: "appendOperatorExported"
      via: "audit emit with header operator_id"
      pattern: "appendOperatorExported"
---

<objective>
Migrate `export-replay.ts` to header-trust auth, H5 tier. Preserve operator.exported audit emit semantics (Phase 13 REPLAY-02).

Purpose: Wave 0 prerequisite. Last of 6 existing operator routes.
Output: Header-auth + tests; export payload semantics unchanged.
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
  <name>Task 1: Migrate export-replay.ts to header-auth (H5)</name>
  <files>grid/src/api/operator/export-replay.ts</files>
  <read_first>
    - grid/src/api/operator/export-replay.ts (file being modified)
    - grid/src/api/operator/cognitive-snapshot.ts (canonical analog lines 25-90)
    - grid/src/api/operator/types.ts (OPERATOR_ID_REGEX)
    - grid/src/audit/append-operator-exported.ts (sole-producer emitter — verify operator_id matches header)
  </read_first>
  <action>
    1. Remove `import { validateTierBody, type OperatorBody }`. Add `import { OPERATOR_ID_REGEX } from '../types.js';`.
    2. Replace validateTierBody with header-auth block:
       - Tier gate: `if (tierNum < 5)` → 403 tier_too_low
       - `const resolvedTier: 'H5' = 'H5';`
    3. Body type: KEEP start_tick/end_tick (export range) fields; remove `tier` and `operator_id`.
    4. Substitute `v.tier` → `resolvedTier`, `v.operator_id` → `resolvedOperatorId` in the appendOperatorExported call.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/export-replay.test.ts</automated>
  </verify>
  <done>
    - validateTierBody removed
    - operator.exported emit uses resolvedOperatorId
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression tests for export-replay header-auth + audit emit</name>
  <files>grid/test/operator/export-replay.test.ts</files>
  <read_first>
    - grid/test/operator/export-replay.test.ts (existing tests)
    - grid/test/operator/cognitive-snapshot.test.ts (assertion analog)
  </read_first>
  <behavior>
    - No headers → 401 tier_missing
    - Header `x-operator-tier:'4'` → 403 tier_too_low
    - Header `x-operator-tier:'5'`, bad x-operator-id → 400 invalid_operator_id
    - Header `x-operator-tier:'5'` + valid x-operator-id + body `{tier:'H1', start_tick:0, end_tick:10}` → 200; tier ignored
    - operator.exported audit entry has `operator_id` === header value (NOT body value)
  </behavior>
  <action>Clone header-auth describe block; extend existing audit-emit assertion to verify operator_id source.</action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/export-replay.test.ts</automated>
  </verify>
  <done>All tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → Grid export-replay (H5) | Untrusted client must not claim H5 to export chain |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-06-01 | Elevation of Privilege | export-replay.ts | mitigate | H5 header-trust gate per D-25b-NEW-1 |
| T-25b-06-02 | Repudiation | append-operator-exported.ts | mitigate | operator.exported.operator_id sourced from server-trusted header, not body |
</threat_model>

<verification>
- Tests pass
- `grep -n "validateTierBody" grid/src/api/operator/export-replay.ts` returns nothing
- `grep -n "tierNum < 5" grid/src/api/operator/export-replay.ts` returns the H5 gate
</verification>

<success_criteria>
- export-replay enforces H5 via header
- operator.exported audit emit operator_id sourced from header
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-06-SUMMARY.md`
</output>
