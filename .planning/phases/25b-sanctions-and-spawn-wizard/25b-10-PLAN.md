---
phase: 25b-sanctions-and-spawn-wizard
plan: 10
type: execute
wave: 2
# wave = earliest-possible execution wave; depends_on enforces actual ordering within wave.
# Serialized after 25b-09 to avoid merge conflict on grid/src/api/operator/index.ts barrel
# (both plans register new routes into the same barrel registrar). Wave label kept at 2
# because 09 and 10 share the same upstream prerequisite set.
depends_on: [25b-07, 25b-08, 25b-09]
files_modified:
  - grid/src/api/operator/quarantine.ts
  - grid/src/api/operator/slash-coin.ts
  - grid/src/api/operator/index.ts
  - grid/src/registry/nous-registry.ts
  - grid/test/operator/quarantine.test.ts
  - grid/test/operator/slash-coin.test.ts
autonomous: true
requirements: [D-25b-07, D-25b-NEW-1, D-25b-NEW-3]
tags: [sanction-route, h4, quarantine, slash, nous]

must_haves:
  truths:
    - "POST /api/v1/operator/nous/:did/quarantine requires H4, emits operator.quarantined, sets registry quarantineFlag"
    - "POST /api/v1/operator/nous/:did/slash requires H4, emits operator.slashed with amount field, debits Nous wallet"
    - "Peer discovery filters quarantined Nous from nearby-list queries (D-25b-NEW-3)"
    - "Slash amount must be positive integer; non-positive → 400 invalid_amount"
    - "Reason plaintext stored in sanction_reasons table; only reason_hash in audit payload"
  artifacts:
    - path: "grid/src/api/operator/quarantine.ts"
      provides: "POST /api/v1/operator/nous/:did/quarantine, H4 header-auth"
      exports: ["registerQuarantineRoute"]
    - path: "grid/src/api/operator/slash-coin.ts"
      provides: "POST /api/v1/operator/nous/:did/slash, H4 header-auth"
      exports: ["registerSlashCoinRoute"]
    - path: "grid/src/registry/nous-registry.ts"
      provides: "quarantineFlag on NousRecord + peer-discovery filter"
      contains: "quarantineFlag"
  key_links:
    - from: "quarantine.ts"
      to: "appendOperatorQuarantined"
      via: "audit emit on success"
      pattern: "appendOperatorQuarantined"
    - from: "slash-coin.ts"
      to: "appendOperatorSlashed"
      via: "audit emit on success with amount"
      pattern: "appendOperatorSlashed"
    - from: "nous-registry peer-discovery query"
      to: "quarantineFlag filter"
      via: "WHERE/filter clause excludes quarantined records"
      pattern: "quarantineFlag"
---

<objective>
Ship two H4 Nous sanctions: quarantine (set registry flag; peer discovery filters out) and slash-coin (debit Nous wallet by amount). Both header-auth from day one.

Purpose: Completes the 4-route Nous sanction set started in plan 09.

Output: 2 new routes + registry quarantine support + tests.

**Sequencing note:** This plan runs AFTER 25b-09 (not in parallel) because both plans modify `grid/src/api/operator/index.ts` (the route barrel). Serializing them avoids a merge conflict on barrel registrations.
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
  <name>Task 1: POST /api/v1/operator/nous/:did/quarantine route (H4) + registry filter</name>
  <files>grid/src/api/operator/quarantine.ts, grid/src/api/operator/index.ts, grid/src/registry/nous-registry.ts</files>
  <read_first>
    - grid/src/api/operator/mute-broadcast.ts (template from plan 09 — clone structure, change tier to H4)
    - grid/src/registry/nous-registry.ts (NousRecord shape + peer-discovery / nearby-list query methods)
    - grid/src/audit/append-operator-quarantined.ts (emitter signature from plan 07)
    - grid/src/api/operator/index.ts (barrel registrar — already updated by plan 09 with mute + force-sleep entries; preserve those)
  </read_first>
  <action>
    **A. Create `grid/src/api/operator/quarantine.ts`:**

    Clone mute-broadcast.ts template with:
    - Endpoint: `POST /api/v1/operator/nous/:did/quarantine`
    - Function: `registerQuarantineRoute`
    - Tier: H4 (`< 4` gate, `resolvedTier: 'H4'`)
    - Sanction application step: set `record.quarantineFlag = true` on the NousRegistry record (or call `registry.setQuarantineFlag(targetDid, true)`).
    - Emit: `appendOperatorQuarantined(services.audit, resolvedOperatorId, { tier:'H4', action:'quarantine', operator_id: resolvedOperatorId, target_did: targetDid, tick: services.clock.state.tick, reason_hash: reasonHash })`.
    - sanction_reasons insert with event_type='operator.quarantined'.

    **B. Modify `grid/src/registry/nous-registry.ts`:**

    1. Add `quarantineFlag: boolean = false` field to NousRecord type/class.
    2. Identify the peer-discovery / nearby-list query method(s) — likely `getNearbyNous(centerDid, radius)` or similar.
    3. Add a filter clause excluding records with `quarantineFlag === true`:
       ```typescript
       return candidates.filter(r => !r.quarantineFlag);
       ```
    4. Do NOT physically move the Nous; it remains in its region per D-25b-NEW-3.
    5. Quarantined Nous still appears in operator-side queries (full registry list) — only peer-side discovery filters.

    **C. Register route in `grid/src/api/operator/index.ts`** (append after plan 09's registrations; preserve mute + force-sleep entries).
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/quarantine.test.ts</automated>
  </verify>
  <done>
    - Route exists, H4 header-auth
    - Registry record gains quarantineFlag; peer-discovery filters
    - Route registered in barrel (alongside plan 09's mute + force-sleep)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: POST /api/v1/operator/nous/:did/slash route (H4) with amount</name>
  <files>grid/src/api/operator/slash-coin.ts, grid/src/api/operator/index.ts, grid/test/operator/slash-coin.test.ts</files>
  <read_first>
    - grid/src/api/operator/quarantine.ts (just-created template)
    - grid/src/audit/append-operator-slashed.ts (signature — note the `amount` field in EXPECTED_KEYS)
    - grid/src/integration/nous-runner.ts OR wherever the Nous wallet/balance state lives (find via grep for "wallet" or "balance" or "ousia" in registry/economy modules — confirm how to debit)
    - grid/src/api/operator/index.ts (barrel registrar)
  </read_first>
  <behavior>
    - Body: `{ amount: number, reason?: string }`
    - amount must be positive integer; non-positive or non-integer → 400 invalid_amount
    - Insufficient balance: per planner discretion — either 409 conflict OR debit to zero (read economy module to determine existing convention); document choice in code comment
    - Success: balance reduced by amount; operator.slashed audit payload contains amount; sanction_reasons inserted
    - All header-auth + DID + tombstone + unknown-runner gates from quarantine route
  </behavior>
  <action>
    Clone quarantine.ts structure with:
    - Endpoint: `POST /api/v1/operator/nous/:did/slash`
    - Function: `registerSlashCoinRoute`
    - Tier: H4
    - Body type adds `amount: unknown` (validate to positive integer; on fail → 400 invalid_amount)
    - Sanction application: invoke whatever existing economy primitive debits a Nous balance (e.g. `services.economy.debit(targetDid, amount)`). Read the economy module first to find the canonical debit path. If no such primitive exists, raise this to the user via plan-checker review rather than inventing one.
    - Emit: `appendOperatorSlashed(services.audit, resolvedOperatorId, { tier:'H4', action:'slash', operator_id: resolvedOperatorId, target_did: targetDid, tick: services.clock.state.tick, amount, reason_hash: reasonHash })`.

    Tests (slash-coin.test.ts):
    - Header-auth contract (4 cases)
    - amount: 0 → 400; amount: -5 → 400; amount: 'abc' → 400; amount: 1.5 → 400
    - Success: balance debited by amount; audit payload has amount field
    - Reason discipline: plaintext NOT in audit payload
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/slash-coin.test.ts</automated>
  </verify>
  <done>
    - Route exists, H4 header-auth, amount validated
    - Balance debit goes through existing economy primitive
    - All tests pass
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Quarantine-route tests covering header-auth + peer-discovery filter</name>
  <files>grid/test/operator/quarantine.test.ts</files>
  <read_first>
    - grid/test/operator/delete-nous.test.ts (harness pattern)
    - grid/src/registry/nous-registry.ts (peer-discovery method to test the filter)
  </read_first>
  <behavior>
    - Header-auth contract (4 cases)
    - DID gate, tombstone, unknown-runner gates
    - Success: 200; quarantineFlag === true on record; operator.quarantined in audit; sanction_reasons row
    - Peer-discovery filter: with Nous A quarantined, peer-discovery query from neighboring Nous B does NOT return A; non-quarantined control Nous C IS returned
    - Operator-side full registry query DOES still return A (operator visibility preserved)
  </behavior>
  <action>Write Vitest suite mirroring delete-nous.test.ts harness, plus the peer-discovery filter assertions.</action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/quarantine.test.ts</automated>
  </verify>
  <done>All test cases pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → quarantine/slash routes | Untrusted client must not claim H4 |
| Slash amount → wallet | Untrusted client must not specify negative/non-integer amount |
| Peer-discovery query → quarantined record | Must be filtered at registry boundary |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-10-01 | Elevation of Privilege | quarantine/slash routes | mitigate | H4 header-auth gate |
| T-25b-10-02 | Tampering | slash amount | mitigate | Positive-integer validation → 400 invalid_amount; non-finite/negative rejected |
| T-25b-10-03 | Information Disclosure | Audit payload | mitigate | reason_hash only; CI gate enforced |
| T-25b-10-04 | Denial of Service | Peer discovery | accept | Quarantined Nous is intentionally invisible to peers per D-25b-NEW-3; this IS the sanction effect |
</threat_model>

<verification>
- Both test files pass
- `node scripts/check-operator-sanctions-plaintext.mjs` exits 0
- `grep -n "quarantineFlag" grid/src/registry/nous-registry.ts` shows the field + filter usage
</verification>

<success_criteria>
- Quarantine route ships; peer-discovery filter enforced
- Slash route ships; amount validated; balance debited
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-10-SUMMARY.md`
</output>
