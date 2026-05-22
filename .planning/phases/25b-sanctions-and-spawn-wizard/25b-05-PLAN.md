---
phase: 25b-sanctions-and-spawn-wizard
plan: 05
type: execute
wave: 0
depends_on: []
files_modified:
  - grid/src/api/operator/memory-query.ts
  - grid/test/operator/memory-query.test.ts
autonomous: true
requirements: [D-25b-NEW-1, D-25b-10]
tags: [header-auth, security, operator, h2]

must_haves:
  truths:
    - "memory-query rejects body-supplied tier with 401 tier_missing"
    - "Tier gate is H2 (< 2 → 403 tier_too_low)"
    - "Header x-operator-tier:2 + valid x-operator-id succeeds; body tier ignored"
    - "memory-query body fields (query string, limits) still parsed correctly"
  artifacts:
    - path: "grid/src/api/operator/memory-query.ts"
      provides: "Header-trust auth for memory-query endpoint, H2"
      contains: "OPERATOR_ID_REGEX"
    - path: "grid/test/operator/memory-query.test.ts"
      provides: "Regression tests for header-auth contract"
  key_links:
    - from: "memory-query.ts"
      to: "x-operator-tier header"
      via: "req.headers['x-operator-tier']"
      pattern: "x-operator-tier"
---

<objective>
Migrate `memory-query.ts` to header-trust auth, H2 tier. Preserve any tier-gated response shaping (Phase 6 D-17 patterns where higher tiers see more detail).

Purpose: Wave 0 prerequisite.
Output: Header-auth + tests; non-auth body fields untouched.
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
  <name>Task 1: Migrate memory-query.ts to header-auth (H2)</name>
  <files>grid/src/api/operator/memory-query.ts</files>
  <read_first>
    - grid/src/api/operator/memory-query.ts (file being modified — note tier-shaping logic if present)
    - grid/src/api/operator/cognitive-snapshot.ts (canonical analog lines 25-90)
    - grid/src/api/operator/types.ts (OPERATOR_ID_REGEX)
  </read_first>
  <action>
    1. Remove `import { validateTierBody, type OperatorBody }`. Add `import { OPERATOR_ID_REGEX } from '../types.js';`.
    2. Replace validateTierBody with header-auth block:
       - Tier gate: `if (tierNum < 2)` → 403 tier_too_low
       - `const resolvedTier: 'H2' = 'H2';` — BUT if memory-query has tier-shaping that needs to know actual tier (e.g., H5 sees plaintext, H2 sees redacted), retain `tierNum` for those branches AND ensure no fallback to body tier.
    3. Body type: KEEP query/filter fields; remove only `tier` and `operator_id`.
    4. Substitute `v.tier` → `resolvedTier` (or `tierNum` for tier-shaping logic), `v.operator_id` → `resolvedOperatorId`.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/memory-query.test.ts</automated>
  </verify>
  <done>
    - validateTierBody removed
    - Tier-shaping (if present) keyed off header tier, not body
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression tests for memory-query header-auth contract</name>
  <files>grid/test/operator/memory-query.test.ts</files>
  <read_first>
    - grid/test/operator/memory-query.test.ts (existing tests)
    - grid/test/operator/cognitive-snapshot.test.ts (assertion analog)
  </read_first>
  <behavior>
    - No headers → 401 tier_missing
    - Header `x-operator-tier:'1'` → 403 tier_too_low
    - Header `x-operator-tier:'2'`, bad x-operator-id → 400 invalid_operator_id
    - Header `x-operator-tier:'2'` + valid x-operator-id + body `{tier:'H5', query:'...'}` → 200; body tier IGNORED (response NOT elevated to H5 detail level)
    - Existing tier-shaping tests still pass with header-driven tiers
  </behavior>
  <action>Clone header-auth describe block; if existing tests validate tier-shaping, retrofit them to drive tier via header.</action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/memory-query.test.ts</automated>
  </verify>
  <done>All tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → Grid memory-query | Untrusted client must not elevate tier to read protected memory |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-05-01 | Information Disclosure | memory-query.ts | mitigate | Tier-shaping keyed off header tier; body tier ignored; tests assert H2 body claim cannot unlock H5 detail |
| T-25b-05-02 | Elevation of Privilege | memory-query.ts | mitigate | Header-trust gate per D-25b-NEW-1 |
</threat_model>

<verification>
- Tests pass
- `grep -n "validateTierBody" grid/src/api/operator/memory-query.ts` returns nothing
</verification>

<success_criteria>
- memory-query enforces H2 via header; tier-shaping body-immune
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-05-SUMMARY.md`
</output>
