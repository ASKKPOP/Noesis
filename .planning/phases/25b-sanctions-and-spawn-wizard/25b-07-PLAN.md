---
phase: 25b-sanctions-and-spawn-wizard
plan: 07
type: execute
wave: 1
# wave = earliest-possible execution wave; depends_on enforces actual ordering within wave.
depends_on: []
files_modified:
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/audit/append-operator-muted.ts
  - grid/src/audit/append-operator-slashed.ts
  - grid/src/audit/append-operator-quarantined.ts
  - grid/src/audit/append-operator-forced-sleep.ts
  - grid/src/audit/append-operator-human-banned.ts
  - grid/src/audit/append-operator-human-frozen.ts
  - grid/src/db/schema.ts
  - grid/test/audit/broadcast-allowlist.test.ts
autonomous: true
requirements: [D-25b-07, D-25b-08, D-25b-09, D-25b-11, D-25b-NEW-4]
tags: [allowlist, audit-emitter, migration, sanctions, foundation]

must_haves:
  truths:
    - "Allowlist contains exactly 51 events (45 prior + 6 new sanction events)"
    - "Each new sanction event has its own sole-producer emitter file"
    - "Migration v12 creates sanction_reasons table AND adds human_users.frozen column"
    - "Each emitter validates closed-tuple key set via Object.keys(payload).sort()"
    - "reason_hash field validated by HEX64_RE; no plaintext reason in payload"
  artifacts:
    - path: "grid/src/audit/broadcast-allowlist.ts"
      provides: "ALLOWLIST_MEMBERS array with 6 new operator.* events appended"
      contains: "operator.muted"
    - path: "grid/src/audit/append-operator-muted.ts"
      provides: "appendOperatorMuted sole-producer emitter (H3)"
      exports: ["appendOperatorMuted"]
    - path: "grid/src/audit/append-operator-slashed.ts"
      provides: "appendOperatorSlashed sole-producer emitter (H4, includes amount)"
      exports: ["appendOperatorSlashed"]
    - path: "grid/src/audit/append-operator-quarantined.ts"
      provides: "appendOperatorQuarantined sole-producer emitter (H4)"
      exports: ["appendOperatorQuarantined"]
    - path: "grid/src/audit/append-operator-forced-sleep.ts"
      provides: "appendOperatorForcedSleep sole-producer emitter (H3)"
      exports: ["appendOperatorForcedSleep"]
    - path: "grid/src/audit/append-operator-human-banned.ts"
      provides: "appendOperatorHumanBanned sole-producer emitter (H5, human_did variant)"
      exports: ["appendOperatorHumanBanned"]
    - path: "grid/src/audit/append-operator-human-frozen.ts"
      provides: "appendOperatorHumanFrozen sole-producer emitter (H5, human_did variant)"
      exports: ["appendOperatorHumanFrozen"]
    - path: "grid/src/db/schema.ts"
      provides: "Migration v12: sanction_reasons table + human_users.frozen column"
      contains: "version: 12"
  key_links:
    - from: "ALLOWLIST_MEMBERS"
      to: "6 new operator.* event names"
      via: "appended in declared order at positions 46-51"
      pattern: "operator\\.(muted|slashed|quarantined|forced_sleep|human_banned|human_frozen)"
    - from: "Each emitter"
      to: "audit.append('operator.*', operatorId, cleanPayload, target_did_or_human_did)"
      via: "8-step sole-producer pattern"
      pattern: "audit\\.append"
---

<objective>
Establish the audit foundation for all 25b sanction routes: extend the broadcast allowlist by exactly +6 events, create 6 sole-producer emitter files mirroring `append-nous-deleted.ts`, and add migration v12 carrying both the sanction_reasons table (Grid-side plaintext storage for reason lookup) and the `human_users.frozen` column (for freeze-wallet semantics per D-25b-NEW-4).

Purpose: All Wave 2/3/4 routes depend on these emitters and tables existing. Single coherent foundation plan keeps the allowlist delta atomic and reviewable.

Output: 9 file modifications: allowlist (+6), 6 new emitter files, migration entry, allowlist test update. Producer-boundary CI gate added in plan 08.

**Note on migration version (resolved):** CONTEXT.md mentioned v11; PATTERNS.md said v12; codebase confirms next available version is v12 (current max is v11). Using **v12** per actual codebase state.
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
  <name>Task 1: Extend broadcast allowlist with 6 new sanction events</name>
  <files>grid/src/audit/broadcast-allowlist.ts, grid/test/audit/broadcast-allowlist.test.ts</files>
  <read_first>
    - grid/src/audit/broadcast-allowlist.ts (lines 75-205 — ALLOWLIST_MEMBERS array, especially preceding `human.*` block around lines 178-183, and the 39-count assertion comment at line 164)
    - grid/test/audit/broadcast-allowlist.test.ts (existing count + enumeration tests)
  </read_first>
  <action>
    Append after the existing `human.transferred` entry (position 45), per PATTERNS.md exact block:

    ```typescript
    // Phase 25b (SANCTION-01..06 / D-25b-07/08) — operator sanction events. Allowlist 45→51.
    // All 6 emitted ONLY via grid/src/audit/append-operator-*.ts sole-producer emitters (D-25b-09).
    // Reason plaintext NEVER crosses the wire — only reason_hash (HEX64_RE) per D-25b-11.
    'operator.muted',          // (46) {action, operator_id, reason_hash, target_did, tick, tier:'H3'}
    'operator.slashed',        // (47) {action, amount, operator_id, reason_hash, target_did, tick, tier:'H4'}
    'operator.quarantined',    // (48) {action, operator_id, reason_hash, target_did, tick, tier:'H4'}
    'operator.forced_sleep',   // (49) {action, operator_id, reason_hash, target_did, tick, tier:'H3'}
    'operator.human_banned',   // (50) {action, human_did, operator_id, reason_hash, tick, tier:'H5'}
    'operator.human_frozen',   // (51) {action, human_did, operator_id, reason_hash, tick, tier:'H5'}
    ```

    Update the count assertion comment at line ~164 — current text references 39; update to reflect 51 final total (verify current pre-25b total by reading the file; it should be 45 per CONTEXT, comment may be stale).

    In `broadcast-allowlist.test.ts`:
    - Update the length assertion from current value to 51
    - Add the 6 new event names to whatever enumeration/snapshot test exists
    - Add assertion that the 6 new events appear in this exact order at positions 46-51 (0-indexed: 45-50)
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/audit/broadcast-allowlist.test.ts</automated>
  </verify>
  <done>
    - ALLOWLIST_MEMBERS.length === 51
    - All 6 new entries present in declared order
    - Tests pass
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create 6 sole-producer sanction emitter files</name>
  <files>grid/src/audit/append-operator-muted.ts, grid/src/audit/append-operator-slashed.ts, grid/src/audit/append-operator-quarantined.ts, grid/src/audit/append-operator-forced-sleep.ts, grid/src/audit/append-operator-human-banned.ts, grid/src/audit/append-operator-human-frozen.ts</files>
  <read_first>
    - grid/src/audit/append-nous-deleted.ts (canonical 8-step sole-producer template — lines 21-23 imports + 60-133 body)
    - grid/src/audit/broadcast-allowlist.ts (payloadPrivacyCheck import + ALLOWLIST set)
    - grid/src/audit/chain.ts (AuditChain.append signature)
    - grid/src/audit/types.ts (AuditEntry type)
  </read_first>
  <behavior>
    For EACH emitter, behavior contract:
    - Rejects when operator_id fails OPERATOR_ID_RE → throws
    - Rejects non-object payload → throws
    - Rejects wrong tier literal (e.g. muted with tier='H4') → throws
    - Rejects wrong action literal (e.g. muted with action='slash') → throws
    - Rejects payload missing any required key → throws (closed-tuple)
    - Rejects payload with extra key → throws (closed-tuple)
    - Rejects reason_hash that fails HEX64_RE → throws
    - Rejects tick that is negative or non-integer → throws
    - Rejects payload.operator_id mismatching operatorId arg → throws (self-report invariant)
    - Calls audit.append(event_name, operatorId, cleanPayload, target_did_or_human_did) on success
    - cleanPayload is explicitly reconstructed (no spread) to prevent prototype pollution
  </behavior>
  <action>
    Create each file as a near-verbatim clone of `append-nous-deleted.ts`, varying only:

    **Per-emitter constants:**

    | File | Function | Event name | Tier literal | Action literal | EXPECTED_KEYS (sorted) | Extra fields |
    |------|----------|------------|--------------|----------------|------------------------|--------------|
    | append-operator-muted.ts | appendOperatorMuted | 'operator.muted' | 'H3' | 'mute' | `['action','operator_id','reason_hash','target_did','tick','tier']` | — |
    | append-operator-slashed.ts | appendOperatorSlashed | 'operator.slashed' | 'H4' | 'slash' | `['action','amount','operator_id','reason_hash','target_did','tick','tier']` | amount (positive integer) |
    | append-operator-quarantined.ts | appendOperatorQuarantined | 'operator.quarantined' | 'H4' | 'quarantine' | `['action','operator_id','reason_hash','target_did','tick','tier']` | — |
    | append-operator-forced-sleep.ts | appendOperatorForcedSleep | 'operator.forced_sleep' | 'H3' | 'force_sleep' | `['action','operator_id','reason_hash','target_did','tick','tier']` | — |
    | append-operator-human-banned.ts | appendOperatorHumanBanned | 'operator.human_banned' | 'H5' | 'ban_human' | `['action','human_did','operator_id','reason_hash','tick','tier']` | human_did instead of target_did |
    | append-operator-human-frozen.ts | appendOperatorHumanFrozen | 'operator.human_frozen' | 'H5' | 'freeze_wallet' | `['action','human_did','operator_id','reason_hash','tick','tier']` | human_did instead of target_did |

    **Mandatory 8-step body for each file (clone append-nous-deleted.ts:60-133):**
    1. `if (!OPERATOR_ID_RE.test(operatorId)) throw new Error(...)`
    2. Type guard: payload must be plain object
    3. Literal guards: `payload.tier === '<LITERAL>'`, `payload.action === '<LITERAL>'`
    4. Regex/range guards:
       - operator_id via OPERATOR_ID_RE
       - target_did OR human_did via DID_RE
       - reason_hash via HEX64_RE
       - tick is integer ≥ 0
       - amount (slashed only) is integer ≥ 0
    5. Self-report invariant: `payload.operator_id === operatorId`
    6. Closed-tuple structural: `Object.keys(payload).sort()` deep-equals EXPECTED_KEYS
    7. Explicit reconstruction:
       ```typescript
       const cleanPayload = {
         action: payload.action,
         operator_id: payload.operator_id,
         reason_hash: payload.reason_hash,
         target_did: payload.target_did,   // OR human_did for human sanctions
         tick: payload.tick,
         tier: payload.tier,
         // amount: payload.amount,  // only for slashed
       };
       ```
    8. `payloadPrivacyCheck(cleanPayload)` — belt-and-suspenders
    9. Final emit: `audit.append('<event_name>', operatorId, cleanPayload, payload.target_did /* or human_did */)`

    Re-export HEX64_RE, DID_RE, OPERATOR_ID_RE from this file the same way append-nous-deleted.ts does (so callers can validate before invoking the emitter).

    **D-25b-11 reason-hash discipline:** reason plaintext MUST NOT appear anywhere in this file or its payload. Only reason_hash (32-byte SHA-256 hex) crosses the wire.
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/audit/</automated>
  </verify>
  <done>
    - 6 emitter files exist
    - Each is structurally a clone of append-nous-deleted.ts with only the varying constants changed
    - No file contains the word "reason_text", "reason_plaintext", "plaintext_reason", "reason_body"
    - Each file's audit.append uses the correct event-name literal
  </done>
</task>

<task type="auto">
  <name>Task 3: Migration v12 — sanction_reasons table + human_users.frozen column</name>
  <files>grid/src/db/schema.ts</files>
  <read_first>
    - grid/src/db/schema.ts (lines 213-235 — v10 and v11 entries for shape reference)
    - grid/src/db/migration-runner.ts (lines 20-28 — multi-statement split-on-`;` behavior confirmation)
  </read_first>
  <action>
    Append a new migration entry after v11, per PATTERNS.md exact block:

    ```typescript
    {
      version: 12,
      name: 'create_sanction_reasons_and_freeze_human_users',
      up: `
        CREATE TABLE IF NOT EXISTS sanction_reasons (
          id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          reason_hash   CHAR(64)        NOT NULL,
          plaintext     TEXT            NOT NULL,
          operator_id   VARCHAR(48)     NOT NULL,
          event_type    VARCHAR(63)     NOT NULL,
          target_did    VARCHAR(255)    NOT NULL,
          tick          BIGINT UNSIGNED NOT NULL,
          created_at    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY uq_reason_hash (reason_hash),
          INDEX idx_target_tick (target_did, tick)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ALTER TABLE human_users ADD COLUMN frozen TINYINT(1) NOT NULL DEFAULT 0;
      `,
      down: `
        ALTER TABLE human_users DROP COLUMN frozen;
        DROP TABLE IF EXISTS sanction_reasons;
      `,
    },
    ```

    Combine both schema changes into a single migration per CONTEXT scope-reduction guidance (one coherent migration per phase boundary).
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/db/</automated>
  </verify>
  <done>
    - Migration v12 entry exists in schema.ts
    - Both DDL statements present in up; both reversed in down
    - Migration runner can apply and reverse cleanly (existing db tests pass)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Sanction route handlers → audit chain | Sole-producer emitters are the ONLY path to write operator.* sanction events |
| Reason plaintext → audit payload | Plaintext must NEVER cross this boundary (only reason_hash) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-07-01 | Tampering | Each emitter | mitigate | Closed-tuple Object.keys().sort() check rejects payloads with extra/missing keys |
| T-25b-07-02 | Information Disclosure | Audit payload | mitigate | reason_hash only (HEX64_RE validated); plaintext stored in sanction_reasons table Grid-side; CI gate in plan 08 enforces no plaintext-field names in emitter files |
| T-25b-07-03 | Repudiation | operator_id | mitigate | Self-report invariant: payload.operator_id === operatorId arg (sourced from header in route) |
| T-25b-07-04 | Elevation of Privilege | Allowlist | mitigate | Allowlist append-only with explicit per-event payload shape comment; producer-boundary test in plan 08 ensures no other file emits these events |
</threat_model>

<verification>
- `npm --prefix grid run test -- run test/audit/broadcast-allowlist.test.ts` passes
- `npm --prefix grid run test -- run test/audit/` passes
- `grep -l "audit.append('operator.muted'" grid/src/` returns ONLY `grid/src/audit/append-operator-muted.ts` (and similar for each new event)
- `grep -i "reason_text\|reason_plaintext\|plaintext_reason\|reason_body" grid/src/audit/append-operator-*.ts` returns nothing
- Migration v12 visible in `grid/src/db/schema.ts`
</verification>

<success_criteria>
- Allowlist has exactly 51 entries
- 6 emitter files exist, each a clone of append-nous-deleted.ts pattern
- Migration v12 carries both schema changes
- No plaintext reason field name appears in any new file
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-07-SUMMARY.md`
</output>
