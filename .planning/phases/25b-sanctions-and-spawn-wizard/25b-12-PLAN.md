---
phase: 25b-sanctions-and-spawn-wizard
plan: 12
type: execute
wave: 3
# wave = earliest-possible execution wave; depends_on enforces actual ordering within wave.
# Serialized after 25b-10 to avoid merge conflict on grid/src/api/operator/index.ts barrel.
depends_on: [25b-07, 25b-08, 25b-10]
files_modified:
  - grid/src/api/operator/ban-human.ts
  - grid/src/api/operator/freeze-wallet.ts
  - grid/src/api/operator/index.ts
  - grid/src/db/schema.ts
  - grid/test/operator/ban-human.test.ts
  - grid/test/operator/freeze-wallet.test.ts
autonomous: true
requirements: [D-25b-08, D-25b-NEW-1, D-25b-NEW-4, D-25b-NEW-5]
tags: [sanction-route, h5, human, ban, freeze]

must_haves:
  truths:
    - "POST /api/v1/operator/humans/:did/ban requires H5, emits operator.human_banned, sets human_users.banned"
    - "POST /api/v1/operator/humans/:did/freeze requires H5, emits operator.human_frozen, sets human_users.frozen=1"
    - "Both routes use header-auth from day one; body never carries tier"
    - "Freeze is Grid-side flag ONLY; no on-chain action (zero-custody invariant per D-25b-NEW-4)"
    - "Reason plaintext stored in sanction_reasons table; only reason_hash in audit"
  artifacts:
    - path: "grid/src/api/operator/ban-human.ts"
      provides: "POST /api/v1/operator/humans/:did/ban, H5 header-auth"
      exports: ["registerBanHumanRoute"]
    - path: "grid/src/api/operator/freeze-wallet.ts"
      provides: "POST /api/v1/operator/humans/:did/freeze, H5 header-auth"
      exports: ["registerFreezeWalletRoute"]
    - path: "grid/src/db/schema.ts"
      provides: "Migration v13 adds human_users.banned column (if not combined into v12 — planner adds v13 here)"
      contains: "version: 13"
  key_links:
    - from: "ban-human.ts"
      to: "human_users.banned column"
      via: "UPDATE human_users SET banned=1 WHERE did=?"
      pattern: "UPDATE human_users"
    - from: "freeze-wallet.ts"
      to: "human_users.frozen column (added in v12)"
      via: "UPDATE human_users SET frozen=1 WHERE did=?"
      pattern: "UPDATE human_users"
---

<objective>
**Key Decision (D-25b-NEW-5):** `human_users.banned` is a SEPARATE column from `human_users.frozen` — locked during plan-checker revision. Rationale: frozen-but-not-banned humans must still be able to SIWE-auth to view their status; banned humans are fully revoked. Migration v13 introduces the `banned` column; v12 (plan 07) already added `frozen`. See `.planning/phases/25b-sanctions-and-spawn-wizard/25b-CONTEXT.md` `<decisions>` section for the full ratified record.

Ship two H5 human sanctions: ban-human (full portal access revoked) and freeze-wallet (Grid-side flag blocking portal actions; zero-custody per D-25b-NEW-4 — on-chain wallet untouched). Both header-auth.

Purpose: Operator power to revoke malicious humans. Freeze-wallet is the Noēsis-side reversible action; ban-human is full revocation.

Output: 2 new H5 routes + migration v13 for banned column + tests. Frozen column already added in plan 07 (migration v12).
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
  <name>Task 1: Migration v13 — human_users.banned column</name>
  <files>grid/src/db/schema.ts</files>
  <read_first>
    - grid/src/db/schema.ts (v12 entry from plan 07 for shape reference)
  </read_first>
  <action>
    PATTERNS.md noted ban-human "planner decides" whether to reuse `frozen` or add `banned`. Per CONTEXT D-25b-NEW-4 (freeze is reversible Grid-side flag; ban is full revocation), these are SEMANTICALLY DISTINCT — keep them separate columns to preserve the umbrella decision that frozen-but-not-banned humans can still SIWE-authenticate to see their status.

    Append migration v13:

    ```typescript
    {
      version: 13,
      name: 'add_banned_human_users',
      up: `
        ALTER TABLE human_users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0;
      `,
      down: `
        ALTER TABLE human_users DROP COLUMN banned;
      `,
    },
    ```
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/db/</automated>
  </verify>
  <done>Migration v13 in schema.ts; db tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: POST /api/v1/operator/humans/:did/ban route (H5)</name>
  <files>grid/src/api/operator/ban-human.ts, grid/src/api/operator/index.ts, grid/test/operator/ban-human.test.ts</files>
  <read_first>
    - grid/src/api/operator/mute-broadcast.ts (template from plan 09 — clone, change tier to H5, target = human)
    - grid/src/api/operator/delete-nous.ts (H5 + irreversibility shape — but DID gate uses same DID_REGEX since human DIDs share did:noesis: prefix per CONTEXT)
    - grid/src/audit/append-operator-human-banned.ts (emitter signature; note `human_did` key not `target_did`)
    - grid/src/api/portal/auth.ts (SIWE auth handler — verify human_users table shape)
    - grid/src/api/operator/index.ts (barrel registrar)
  </read_first>
  <behavior>
    - POST /api/v1/operator/humans/:did/ban with H5 header-auth + valid did:noesis: format + existing human_users row + body `{reason}` → 200 ok
    - Audit chain shows operator.human_banned with `human_did` (not target_did) field
    - sanction_reasons row inserted with event_type='operator.human_banned'
    - human_users.banned set to 1
    - 401/403/400 header-auth errors; 400 invalid_did; 404 unknown_human (no human_users row)
    - NO tombstone check (no human tombstones in v2.5 per PATTERNS.md)
  </behavior>
  <action>
    Clone `mute-broadcast.ts` with adaptations:

    1. Endpoint: `POST /api/v1/operator/humans/:did/ban`
    2. Function: `registerBanHumanRoute`
    3. Tier: H5 (`< 5` gate, `resolvedTier: 'H5'`)
    4. DID gate: use DID_REGEX (human DIDs share did:noesis: shape per CONTEXT). The captured value goes into the `human_did` audit field.
    5. NO tombstone check (humans have no tombstones in v2.5).
    6. Existence check: query `SELECT 1 FROM human_users WHERE did = ?`; if no row → 404 unknown_human.
    7. Sanction application: `UPDATE human_users SET banned = 1 WHERE did = ?`.
    8. Reason hash + sanction_reasons insert with event_type='operator.human_banned'.
    9. Emit: `appendOperatorHumanBanned(services.audit, resolvedOperatorId, { tier:'H5', action:'ban_human', operator_id: resolvedOperatorId, human_did: targetDid, tick: services.clock.state.tick, reason_hash: reasonHash })`.
    10. Register in index.ts barrel.

    Tests:
    - Header-auth contract (4 cases at H5)
    - Invalid DID → 400 invalid_did
    - Unknown human → 404 unknown_human
    - Success: human_users.banned=1, audit emit, sanction_reasons row
    - Reason discipline: plaintext not in payload
    - Payload uses `human_did` field, not `target_did` (closed-tuple shape from emitter test in plan 08 already enforces this)
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/ban-human.test.ts</automated>
  </verify>
  <done>
    - Route exists, H5 header-auth
    - human_users.banned set on success
    - Audit emit uses human_did key
    - Route registered in barrel
    - All tests pass
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: POST /api/v1/operator/humans/:did/freeze route (H5) — zero-custody Grid flag</name>
  <files>grid/src/api/operator/freeze-wallet.ts, grid/src/api/operator/index.ts, grid/test/operator/freeze-wallet.test.ts</files>
  <read_first>
    - grid/src/api/operator/ban-human.ts (just-created template — clone structure)
    - grid/src/audit/append-operator-human-frozen.ts (emitter signature)
    - grid/src/api/operator/index.ts (barrel)
  </read_first>
  <behavior>
    - POST /api/v1/operator/humans/:did/freeze, H5 header-auth, valid did, existing human row, body `{reason}` → 200 ok
    - human_users.frozen set to 1 (column added in migration v12 from plan 07)
    - Audit emit operator.human_frozen with human_did field
    - sanction_reasons row inserted
    - NO on-chain action attempted (zero-custody per D-25b-NEW-4); confirm by reading the route — no wagmi/ethers/web3 imports
    - Header-auth + DID + existence error ladder same as ban-human
  </behavior>
  <action>
    Clone ban-human.ts changing only:
    - Endpoint: `POST /api/v1/operator/humans/:did/freeze`
    - Function: `registerFreezeWalletRoute`
    - Sanction application: `UPDATE human_users SET frozen = 1 WHERE did = ?` (frozen column, NOT banned)
    - sanction_reasons event_type='operator.human_frozen'
    - Audit emit: `appendOperatorHumanFrozen(...)` with action='freeze_wallet'

    Add explicit code comment at top of file:
    ```typescript
    // ZERO-CUSTODY INVARIANT (D-25b-NEW-4): This route sets a Grid-side flag ONLY.
    // No on-chain action is taken — the user's EVM wallet remains entirely under their control.
    // Portal middleware (plan 13) reads this flag to block portal actions; SIWE sign-in remains allowed.
    ```

    Register in index.ts barrel.

    Tests mirror ban-human.test.ts with frozen-specific assertions:
    - human_users.frozen=1 (and human_users.banned remains 0)
    - No ethers/wagmi imports in the route file (grep assertion)
    - Audit emit has correct event name and human_did key
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/freeze-wallet.test.ts</automated>
  </verify>
  <done>
    - Route exists, H5 header-auth, zero-custody respected
    - human_users.frozen=1 on success
    - No on-chain dependencies in route file
    - All tests pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → ban-human / freeze-wallet (H5) | Untrusted client must not claim H5 |
| Grid → on-chain | NEVER cross — zero-custody invariant |
| Sanctioned human → portal actions | Blocked by portal middleware in plan 13 (forward-compat) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-12-01 | Elevation of Privilege | ban/freeze routes | mitigate | H5 header-auth gate; tests pin contract |
| T-25b-12-02 | Information Disclosure | Audit payload | mitigate | reason_hash only; CI gate from plan 08 enforces |
| T-25b-12-03 | Tampering | On-chain wallet | mitigate | Freeze is Grid-flag only; no wagmi/ethers/web3 imports in route file (grep-enforced in test) |
| T-25b-12-04 | Repudiation | operator_id | mitigate | Header-trust; payload self-report invariant enforced by emitter |
</threat_model>

<verification>
- All test files pass
- `node scripts/check-operator-sanctions-plaintext.mjs` exits 0
- `grep -E "(wagmi|ethers|web3)" grid/src/api/operator/freeze-wallet.ts` returns nothing
- Migration v13 visible in schema.ts
</verification>

<success_criteria>
- Both H5 human sanction routes ship with header-auth
- Zero-custody invariant preserved (no on-chain code in freeze route)
- Migration v13 adds banned column; frozen already in v12
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-12-SUMMARY.md`
</output>
