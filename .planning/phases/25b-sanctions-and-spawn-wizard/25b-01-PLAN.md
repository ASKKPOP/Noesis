---
phase: 25b-sanctions-and-spawn-wizard
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - grid/src/api/operator/clock-pause-resume.ts
  - grid/test/operator/clock-pause-resume.test.ts
autonomous: true
requirements: [D-25b-NEW-1, D-25b-10]
tags: [header-auth, security, operator, h3]

must_haves:
  truths:
    - "Body-only request (no x-operator-tier header) returns 401 tier_missing"
    - "Body claiming tier:'H5' with no header returns 401 tier_missing"
    - "Valid x-operator-tier:3 + x-operator-id header succeeds; body tier ignored"
    - "Audit payload operator_id sources from header, not body"
  artifacts:
    - path: "grid/src/api/operator/clock-pause-resume.ts"
      provides: "Header-trust auth for POST /api/v1/operator/clock/pause and /resume"
      contains: "OPERATOR_ID_REGEX"
    - path: "grid/test/operator/clock-pause-resume.test.ts"
      provides: "Regression tests pinning header-auth contract"
  key_links:
    - from: "clock-pause-resume.ts"
      to: "x-operator-tier header"
      via: "req.headers['x-operator-tier']"
      pattern: "x-operator-tier"
---

<objective>
Migrate `POST /api/v1/operator/clock/pause` and `/api/v1/operator/clock/resume` from body-trust to header-trust authentication, mirroring the 25a-07 pattern in `cognitive-snapshot.ts`. This is Wave 0 of the 25b security prerequisite — eliminates the AuthZ bypass surface where any client could claim H3 via body.

Purpose: Without header-auth, sanction UAT cannot be performed safely — anyone could claim H5. Locks the route contract before sanction routes inherit it.
Output: Updated route file using header reads; matching regression tests; behavior unchanged for legitimate operators.
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
  <name>Task 1: Migrate clock-pause-resume.ts to header-auth (H3)</name>
  <files>grid/src/api/operator/clock-pause-resume.ts</files>
  <read_first>
    - grid/src/api/operator/clock-pause-resume.ts (file being modified)
    - grid/src/api/operator/cognitive-snapshot.ts (canonical 25a-07 analog — lines 25-90 for error-ladder comment + header-auth block)
    - grid/src/api/operator/types.ts (OPERATOR_ID_REGEX export)
    - grid/src/api/operator/_validation.ts (existing validateTierBody being removed)
  </read_first>
  <action>
    Per D-25b-NEW-1 (header-auth migration) and S1 pattern in PATTERNS.md:

    1. Remove import: `import { validateTierBody, type OperatorBody } from './_validation.js';`
    2. Add import: `import { OPERATOR_ID_REGEX } from '../types.js';` (or correct relative path matching cognitive-snapshot.ts)
    3. For EACH of `/clock/pause` and `/clock/resume` handlers:
       a. Change `Body: OperatorBody` generic to `Body: never` (these routes use no other body fields)
       b. Replace `const v = validateTierBody(req.body ?? {}, 'H3'); if (!v.ok) { ... }` with the verbatim header-auth block from cognitive-snapshot.ts lines ~65-90:
          - Read `tierHeader = req.headers['x-operator-tier']`; if non-string → 401 `tier_missing`
          - `tierNum = parseInt(tierHeader, 10)`; if non-finite → 401 `tier_missing`
          - If `tierNum < 3` → 403 `tier_too_low`
          - Read `opIdHeader = req.headers['x-operator-id']`; if non-string OR fails OPERATOR_ID_REGEX → 400 `invalid_operator_id`
          - `const resolvedTier: 'H3' = 'H3';`
          - `const resolvedOperatorId = opIdHeader;`
       c. Replace any downstream usage of `v.tier` → `resolvedTier`; `v.operator_id` → `resolvedOperatorId`
    4. Add the canonical error-ladder comment block from cognitive-snapshot.ts (the table comment at top documenting 400/401/403 codes)
    5. Behavior MUST remain identical for valid header-auth requests.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/clock-pause-resume.test.ts</automated>
  </verify>
  <done>
    - File compiles with no TS errors
    - validateTierBody no longer imported
    - Both pause and resume endpoints use header reads
    - resolvedTier/resolvedOperatorId flow into any audit emit calls
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regression tests pinning header-auth contract</name>
  <files>grid/test/operator/clock-pause-resume.test.ts</files>
  <read_first>
    - grid/test/operator/clock-pause-resume.test.ts (existing tests to extend/replace)
    - grid/test/operator/cognitive-snapshot.test.ts (analog showing exact assertion shapes for tier_missing / tier_too_low / invalid_operator_id / body-ignored cases)
  </read_first>
  <behavior>
    - POST /clock/pause with no headers, body `{tier:'H5', operator_id:'op:...'}` → 401 `{error:'tier_missing'}`
    - POST /clock/pause with header `x-operator-tier: 'abc'` → 401 `tier_missing`
    - POST /clock/pause with header `x-operator-tier: '2'`, valid op-id header → 403 `tier_too_low`
    - POST /clock/pause with `x-operator-tier: '3'`, missing/invalid `x-operator-id` header → 400 `invalid_operator_id`
    - POST /clock/pause with `x-operator-tier: '3'` and valid `x-operator-id` header, body `{tier:'H1'}` → 200 success, body tier IGNORED
    - Audit emit (if route emits — verify same as pre-migration behavior) sources operator_id from header
    - Same matrix for /clock/resume
  </behavior>
  <action>
    Clone the structure of `cognitive-snapshot.test.ts` describe blocks for header-auth tests. Add one describe('header-auth contract') per endpoint with the 5 cases above. Use existing test harness fixtures (whatever pattern cognitive-snapshot.test.ts uses for booting the Fastify instance + asserting audit-chain content).
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/clock-pause-resume.test.ts</automated>
  </verify>
  <done>
    - All 10 new test cases (5 per endpoint) pass
    - Existing legitimate-operator tests still pass
    - No body-trust fallback paths remain
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Steward UI → Grid `/api/v1/operator/clock/*` | Untrusted client crosses here; must not control tier |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-01-01 | Elevation of Privilege | clock-pause-resume.ts | mitigate | Read tier from `x-operator-tier` server-trusted header (D-25b-NEW-1); reject body-supplied tier; regression tests in Task 2 pin contract |
| T-25b-01-02 | Spoofing | clock-pause-resume.ts | mitigate | `x-operator-id` validated against OPERATOR_ID_REGEX; audit payload self-report invariant ensures operator_id matches header |
| T-25b-01-03 | Repudiation | clock-pause-resume.ts | accept | Header-trust shifts responsibility to deployment-layer auth proxy (out of scope for this plan; addressed by SIWE middleware in later phase per CONTEXT) |
</threat_model>

<verification>
- `npm --prefix grid run test -- run test/operator/clock-pause-resume.test.ts` passes
- `grep -r "validateTierBody" grid/src/api/operator/clock-pause-resume.ts` returns nothing
- `grep -n "x-operator-tier" grid/src/api/operator/clock-pause-resume.ts` returns the header read lines
</verification>

<success_criteria>
- Clock pause/resume reject body-supplied tier with 401 tier_missing
- All regression tests pass
- Audit emits (if any) source operator_id from header
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-01-SUMMARY.md`
</output>
