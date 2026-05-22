---
phase: 25b-sanctions-and-spawn-wizard
plan: 09
type: execute
wave: 2
depends_on: [25b-07, 25b-08]
files_modified:
  - grid/src/api/operator/mute-broadcast.ts
  - grid/src/api/operator/force-sleep.ts
  - grid/src/api/operator/index.ts
  - grid/src/integration/nous-runner.ts
  - grid/test/operator/mute-broadcast.test.ts
  - grid/test/operator/force-sleep.test.ts
autonomous: true
requirements: [D-25b-07, D-25b-NEW-1, D-25b-NEW-3]
tags: [sanction-route, h3, mute, force-sleep, nous]

must_haves:
  truths:
    - "POST /api/v1/operator/nous/:did/mute requires H3 via header, emits operator.muted, sets runner mute flag"
    - "POST /api/v1/operator/nous/:did/force-sleep requires H3 via header, emits operator.forced_sleep, triggers Hypnos sleep cycle"
    - "Muted Nous: nous.spoke / nous.direct_message / nous.whispered / skill teaching are suppressed at NousRunner emitter boundary"
    - "Force-sleep chain shows operator.forced_sleep IMMEDIATELY before nous.sleep.entered"
    - "Reason plaintext stored in sanction_reasons table; audit payload contains reason_hash only"
  artifacts:
    - path: "grid/src/api/operator/mute-broadcast.ts"
      provides: "POST /api/v1/operator/nous/:did/mute, H3 header-auth"
      exports: ["registerMuteBroadcastRoute"]
    - path: "grid/src/api/operator/force-sleep.ts"
      provides: "POST /api/v1/operator/nous/:did/force-sleep, H3 header-auth"
      exports: ["registerForceSleepRoute"]
    - path: "grid/src/integration/nous-runner.ts"
      provides: "muteFlag suppression at broadcast emit boundary"
      contains: "muteFlag"
  key_links:
    - from: "mute-broadcast.ts"
      to: "appendOperatorMuted"
      via: "audit emit on success"
      pattern: "appendOperatorMuted"
    - from: "force-sleep.ts"
      to: "Hypnos sleep entry path"
      via: "trigger via existing nous-runner sleep machinery (Phase 16)"
      pattern: "appendNousSleepEntered|sleepRuntime"
    - from: "nous-runner muteFlag"
      to: "broadcast emit suppression"
      via: "early-return at emit boundary"
      pattern: "if.*muteFlag"
---

<objective>
Ship two H3 Nous sanctions: mute-broadcast (suppress all broadcast emissions) and force-sleep (trigger Hypnos sleep cycle). Both routes header-auth from day one. Mute requires NousRunner-level enforcement at the emit boundary (D-25b-NEW-3).

Purpose: First two Nous sanctions; establish the route + runner-side-effect pattern that quarantine/slash (plan 10) will follow.

Output: 2 new routes + nous-runner mute enforcement + tests.
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
  <name>Task 1: POST /api/v1/operator/nous/:did/mute route (H3) + NousRunner muteFlag enforcement</name>
  <files>grid/src/api/operator/mute-broadcast.ts, grid/src/integration/nous-runner.ts, grid/src/api/operator/index.ts</files>
  <read_first>
    - grid/src/api/operator/cognitive-snapshot.ts (header-auth block lines ~25-90 + DID gate + tombstone check + runner lookup)
    - grid/src/api/operator/delete-nous.ts (sanction-shape composite analog: tombstone → action → emit ordering)
    - grid/src/audit/append-operator-muted.ts (emitter signature, expects {action:'mute', tier:'H3', operator_id, target_did, tick, reason_hash})
    - grid/src/integration/nous-runner.ts (existing broadcast emit boundaries for nous.spoke, nous.direct_message, nous.whispered — identify the locations where suppression must occur)
    - grid/src/api/operator/index.ts (existing barrel registrar pattern, lines ~14-31)
  </read_first>
  <action>
    **A. Create `grid/src/api/operator/mute-broadcast.ts`:**

    Following PATTERNS.md template + composite analog:

    1. Imports: FastifyInstance, GridServices, DID_REGEX from server.js, OPERATOR_ID_REGEX from types.js, ApiError, tombstoneCheck + TombstonedDidError, appendOperatorMuted, createHash from node:crypto.
    2. `interface MuteBody { reason?: unknown }` — plaintext, never enters audit payload.
    3. `export function registerMuteBroadcastRoute(app: FastifyInstance, services: GridServices): void`
    4. Handler `POST /api/v1/operator/nous/:did/mute`:
       - **Step 1:** Header-auth block — read `x-operator-tier`, parse int, gate `< 3` → 403 tier_too_low; read `x-operator-id`, validate OPERATOR_ID_REGEX → 400 invalid_operator_id; set `resolvedTier: 'H3' = 'H3'`, `resolvedOperatorId`.
       - **Step 2:** DID shape gate — `req.params.did` must match DID_REGEX → 400 invalid_did.
       - **Step 3:** Tombstone check — `tombstoneCheck(services, targetDid)`; on TombstonedDidError → 410 gone.
       - **Step 4:** Runner lookup — `services.runners.get(targetDid)`; if missing → 404 unknown_nous.
       - **Step 5:** Reason hash — `const reasonPlain = typeof req.body?.reason === 'string' ? req.body.reason : ''; const reasonHash = createHash('sha256').update(reasonPlain).digest('hex');`
       - **Step 6:** Insert into sanction_reasons table (via services.db or whatever DB handle is exposed): `INSERT INTO sanction_reasons (reason_hash, plaintext, operator_id, event_type, target_did, tick) VALUES (?, ?, ?, 'operator.muted', ?, ?)`. Use ON DUPLICATE KEY UPDATE for idempotency on reason_hash unique key.
       - **Step 7:** Apply sanction — `runner.muteFlag = true` (or `runner.setMuteFlag(true)` if registry encapsulates state).
       - **Step 8:** Emit `appendOperatorMuted(services.audit, resolvedOperatorId, { tier: 'H3', action: 'mute', operator_id: resolvedOperatorId, target_did: targetDid, tick: services.clock.state.tick, reason_hash: reasonHash })`.
       - **Step 9:** Return `{ ok: true }` with 200.
       - Error ladder: 400 / 401 / 403 / 404 / 410, no 500s. Audit emit NEVER on error paths.

    **B. Modify `grid/src/integration/nous-runner.ts`:**

    1. Add `muteFlag: boolean = false` field to NousRunner class (or equivalent state shape).
    2. Identify every place where the runner currently calls into broadcast emitters for: `nous.spoke`, `nous.direct_message`, `nous.whispered`, skill teaching (the `appendSkillTaught` path). At EACH location, add an early-return guard:
       ```typescript
       if (this.muteFlag) {
         // Sanctioned: action is "shouting into the void" per D-25b-NEW-3.
         // Nous still thinks; emit is suppressed.
         return;
       }
       ```
    3. Do NOT block the Nous's LLM cognition or tick processing — only suppress the audit emit.
    4. Do NOT emit any new event when suppressing (no operator.mute_enforced sub-event).

    **C. Register route in `grid/src/api/operator/index.ts`:**

    Add `import { registerMuteBroadcastRoute } from './mute-broadcast.js';` and a corresponding `registerMuteBroadcastRoute(app, services);` call in the registration function, mirroring the existing barrel pattern.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/mute-broadcast.test.ts</automated>
  </verify>
  <done>
    - Route file exists; header-auth block matches cognitive-snapshot.ts pattern
    - NousRunner muteFlag added and enforced at all 4 broadcast paths
    - Route registered in index.ts barrel
    - Reason plaintext written to sanction_reasons table, not audit payload
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: POST /api/v1/operator/nous/:did/force-sleep route (H3)</name>
  <files>grid/src/api/operator/force-sleep.ts, grid/src/api/operator/index.ts, grid/test/operator/force-sleep.test.ts</files>
  <read_first>
    - grid/src/api/operator/mute-broadcast.ts (just-created template — clone structure)
    - grid/src/sleep/appendNousSleepEntered.ts (Phase 16 sleep emitter — verify signature for triggering sleep)
    - grid/src/integration/nous-runner.ts (sleep entry path — identify how runner triggers Hypnos sleep cycle naturally; force-sleep route should invoke the same entry point)
    - grid/src/audit/append-operator-forced-sleep.ts (emitter signature)
  </read_first>
  <behavior>
    - POST /api/v1/operator/nous/:did/force-sleep with H3 header-auth + valid DID + non-tombstoned + active runner + body `{reason:'...'}` → 200 ok
    - Audit chain shows: `operator.forced_sleep` followed IMMEDIATELY by `nous.sleep.entered` (existing Phase 16 emitter)
    - sanction_reasons table contains row with event_type='operator.forced_sleep'
    - Header-auth errors (401, 403, 400) same shape as mute route
    - Tombstoned DID → 410; unknown runner → 404
  </behavior>
  <action>
    Clone `mute-broadcast.ts` structure with these differences:

    1. Endpoint: `POST /api/v1/operator/nous/:did/force-sleep`
    2. Function: `registerForceSleepRoute`
    3. Tier: H3 (`< 3` gate, `resolvedTier: 'H3'`)
    4. Sanction application step (step 7): Trigger the existing Hypnos sleep entry on the runner. Read nous-runner.ts to determine the correct method (likely `runner.triggerSleep()` or `runner.hypnos.enterSleep()`). The existing Phase 16 path will emit `nous.sleep.entered` and later `nous.sleep.completed` autonomously.
    5. Audit emit ordering (CRITICAL): emit `operator.forced_sleep` BEFORE invoking the sleep trigger so the chain shows operator → sleep cause-effect ordering per D-25b-NEW-3:
       ```typescript
       // Emit operator.forced_sleep FIRST (cause)
       appendOperatorForcedSleep(services.audit, resolvedOperatorId, {...});
       // THEN trigger sleep (effect — Phase 16 machinery emits nous.sleep.entered)
       runner.triggerSleep();
       ```
       If sleep trigger is async and may emit before the synchronous next operation, document this in a code comment and ensure the operator.forced_sleep audit append completes before sleep is invoked.
    6. Register in index.ts barrel.

    Tests (force-sleep.test.ts):
    - Clone mute-broadcast.test.ts header-auth contract cases.
    - Add ordering assertion: audit chain entries [N, N+1] are `['operator.forced_sleep', 'nous.sleep.entered']` for the same target_did.
    - Reason plaintext goes to sanction_reasons; payload has only reason_hash.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/force-sleep.test.ts</automated>
  </verify>
  <done>
    - Route exists, header-auth, H3 gate
    - Audit ordering verified by test
    - Hypnos sleep machinery invoked unchanged
    - Route registered in index.ts
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Mute-route tests covering header-auth + runner enforcement</name>
  <files>grid/test/operator/mute-broadcast.test.ts</files>
  <read_first>
    - grid/test/operator/cognitive-snapshot.test.ts (header-auth case shapes)
    - grid/test/operator/delete-nous.test.ts (tombstone + unknown-nous case patterns)
    - grid/src/api/operator/mute-broadcast.ts (the route created in Task 1)
    - grid/src/integration/nous-runner.ts (mute enforcement points to test)
  </read_first>
  <behavior>
    - Header-auth contract: no headers → 401 tier_missing; tier '2' → 403 tier_too_low; tier '3' + bad opId → 400 invalid_operator_id
    - DID gate: invalid DID format → 400 invalid_did
    - Tombstone: target tombstoned → 410 gone
    - Unknown runner: no runner for DID → 404 unknown_nous
    - Success: 200 ok; runner.muteFlag === true; operator.muted in audit chain; sanction_reasons row inserted
    - Reason discipline: audit payload contains reason_hash only; sanction_reasons.plaintext contains the original reason text
    - Runner enforcement: after mute, trigger an operation that WOULD emit nous.spoke / nous.whispered → assert NO new audit entry for the muted Nous
  </behavior>
  <action>
    Write Vitest suite mirroring delete-nous.test.ts harness. For the "runner enforcement" assertion, drive a mock Brain action through the runner that would normally emit `nous.spoke`, and assert the chain length is unchanged for muted Nous (vs incremented for non-muted control).
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/mute-broadcast.test.ts</automated>
  </verify>
  <done>All test cases pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → mute/force-sleep routes | Untrusted client must not claim H3; must not bypass mute via direct runner call |
| Reason text → audit payload | Forbidden — only reason_hash crosses |
| Sanctioned Nous → broadcast | Suppressed at runner emit boundary; no observer can detect a muted Nous via chain reads |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-09-01 | Elevation of Privilege | mute/force-sleep routes | mitigate | Header-auth H3 gate; tests pin contract |
| T-25b-09-02 | Information Disclosure | Audit payload | mitigate | Reason hashed Grid-side; plaintext stored in sanction_reasons table; CI gate from plan 08 enforces |
| T-25b-09-03 | Tampering | NousRunner muteFlag | mitigate | Suppression at sole-producer emit boundary; sanctioned Nous cannot emit broadcast events; test asserts chain-length-unchanged |
| T-25b-09-04 | Replay | force-sleep | accept | Repeated force-sleep is idempotent (sleep state machine); operator can re-issue; no new attack surface |
</threat_model>

<verification>
- `npm --prefix grid run test -- run test/operator/mute-broadcast.test.ts test/operator/force-sleep.test.ts` passes
- `npm --prefix grid run test -- run test/audit/operator-muted-producer-boundary.test.ts test/audit/operator-forced-sleep-producer-boundary.test.ts` still passes (sole-producer still holds)
- `node scripts/check-operator-sanctions-plaintext.mjs` exits 0
- `grep -n "muteFlag" grid/src/integration/nous-runner.ts` shows ≥4 enforcement points (one per broadcast type)
</verification>

<success_criteria>
- Mute and force-sleep routes shipped with header-auth
- Muted Nous suppressed at emit boundary
- Force-sleep triggers Hypnos and chain shows cause-effect ordering
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-09-SUMMARY.md`
</output>
