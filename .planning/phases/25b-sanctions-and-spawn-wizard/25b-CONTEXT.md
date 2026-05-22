# Phase 25b: Sanctions + Spawn Wizard — Context

**Gathered:** 2026-05-21
**Status:** Ready for research → planning
**Source:** Extracted from `.planning/phases/25-steward-console-expansion-humans-sanctions-cognitive-inspect/25-CONTEXT.md` (decisions D-07, D-08, D-10, D-12) plus 25b-specific decisions added in this session

<domain>
## Phase Boundary

Ship operator-facing **write actions** in the Steward Console:

1. **Wave 0 — Header-auth migration** (security prerequisite for any sanction work). Migrate the 6 existing operator routes from body-trust to header-trust authentication, following the 25a-07 pattern. This unblocks safe testing of new sanction routes (otherwise anyone can claim H5).
2. **Nous sanctions** (4 new H-tier-gated routes): mute-broadcast, slash-coin, quarantine, force-sleep
3. **Human sanctions** (2 new H5-gated routes): ban-human, freeze-wallet
4. **Researcher Nous spawn wizard** (1 new H5-gated route): operator-spawned system Nous, treasury-funded, distinct from Phase 27 human-spawn flow

**Allowlist Δ:** +6 events (`operator.muted`, `operator.slashed`, `operator.quarantined`, `operator.forced_sleep`, `operator.human_banned`, `operator.human_frozen`). Running total after 25b: 51. Spawn wizard reuses existing `nous.spawned`.

**Explicitly out of scope for 25b:**
- Replay scrubber UI → 25c
- Culture browser re-theme → 25c
- Human-pays-coin personal Nous spawn → Phase 27 (different DID scheme, different funding source)
- Public deployment of Steward → still requires SIWE-derived session middleware in a later phase
- Un-sanction events (operator.unmuted etc.) — see deferred ideas

</domain>

<decisions>
## Implementation Decisions

### Locked from umbrella 25-CONTEXT.md (no re-discussion)

**D-25b-07** (= umbrella D-07): Four new Nous sanctions, each a sole-producer emitter with a closed-tuple audit payload:
- **Mute-broadcast** (H3) → `operator.muted {operator_id, nous_did, tick, reason_hash}`
- **Slash Cyber Coin** (H4) → `operator.slashed {operator_id, nous_did, tick, amount, reason_hash}`
- **Quarantine** (H4) → `operator.quarantined {operator_id, nous_did, tick, reason_hash}`
- **Force-sleep** (H3) → `operator.forced_sleep {operator_id, nous_did, tick, reason_hash}`

**D-25b-08** (= umbrella D-08): Two new human sanctions (both H5):
- **Ban-human** (H5) → `operator.human_banned {operator_id, human_did, tick, reason_hash}`
- **Freeze-wallet** (H5) → `operator.human_frozen {operator_id, human_did, tick, reason_hash}`

**D-25b-09** (= umbrella D-09): Closed-tuple audit discipline preserved — each sanction has its own append helper file under `grid/src/audit/`, never multiplexed into a shared emitter.

**D-25b-10** (= umbrella D-10): Existing pre-25a operator agency primitives (clock-pause/resume, governance ballot lifecycle, telos-force, delete-nous, memory-query, export) are not redesigned. Wave 0 hardens their AUTH model only (see D-25b-NEW-1 below).

**D-25b-11** (= umbrella D-11): Reason justifications hashed Brain-side or Grid-side; only `reason_hash` crosses the wire. Plaintext stored Grid-side in a sanction-reasons table for operator UI lookup; never appears in audit payload.

**D-25b-12** (= umbrella D-12): Spawn wizard targets **system/researcher Nous only** — Sophia/Hermes/Themis-class agents created by an operator. H5 tier gated. Funded from a system treasury (specific source decided during planning). Distinct from Phase 27's `nous.spawned_by_human` flow. Reuses existing `nous.spawned` audit event.

### New for 25b (locked this session)

**D-25b-NEW-1 — Wave 0 header-auth migration scope (BLOCKING PREREQUISITE):**
Before ANY sanction route lands, migrate all 6 existing operator routes from body-trust to header-trust auth, following the exact 25a-07 pattern:
- Read tier from `x-operator-tier` request header (server-trusted)
- Read operator_id from `x-operator-id` request header (server-trusted, validated against `OPERATOR_ID_REGEX`)
- Reject body-supplied `tier` / `operator_id`
- Add regression tests pinning the contract (body-only request → 401 tier_missing; audit payload sources operator_id from header, not body)

**Routes to migrate (6 plans, one per route):**
1. `grid/src/api/operator/clock-pause-resume.ts` → `25b-01-clock-pause-resume-header-auth-PLAN.md`
2. `grid/src/api/operator/governance.ts` (or equivalent — covers proposal/ballot operator endpoints) → `25b-02-governance-header-auth-PLAN.md`
3. `grid/src/api/operator/telos-force.ts` → `25b-03-telos-force-header-auth-PLAN.md`
4. `grid/src/api/operator/delete-nous.ts` → `25b-04-delete-nous-header-auth-PLAN.md`
5. `grid/src/api/operator/memory-query.ts` → `25b-05-memory-query-header-auth-PLAN.md`
6. `grid/src/api/operator/export.ts` → `25b-06-export-header-auth-PLAN.md`

**Rationale:**
- 25b is about to add 6 NEW operator routes. Writing them in the now-deprecated body-trust pattern then re-migrating later is wasteful — fix the pattern first, then all 6 new sanction routes are born header-auth.
- Without this, sanction UAT is impossible to do safely in any reachable environment because anyone can claim H5 in the request body.
- Plan-per-route gives clean atomic commits, parallel-safe execution, and one-route-at-a-time rollback if a regression test fails.

**Wave 0 is parallel-safe** — all 6 plans modify distinct files; no shared file overlap. They can all run in a single wave.

### Deferred to planner discretion (sensible defaults; planner picks based on existing codebase patterns)

The following 3 gray areas were considered but NOT locked this session — planner uses reasonable defaults aligned with existing Grid patterns. If the planner's choice surfaces in plan-checker review and feels wrong, raise it then.

**D-25b-NEW-2 — Sanction durability + reversal model:**
- Default direction: sanctions are **persistent until manually cleared** (no auto-expire TTL). No un-sanction audit events in this phase — operator clears a sanction by issuing the inverse via existing primitives where applicable (e.g. quarantine cleared by a clock or memory-query operation, mute cleared by NOT enforcing the flag).
- Allowlist impact if reversed in a future phase: +4 (operator.unmuted, operator.unslashed_refund, operator.unquarantined, operator.sleep_released). NOT added in 25b — defer to a "Sanction Lifecycle" phase if/when operators ask for it.

**D-25b-NEW-3 — Sanctioned Nous runtime behavior:**
- **Muted:** Nous continues ticking; LLM thinks normally; ALL broadcast-emitting actions (`nous.spoke`, `nous.direct_message`, `nous.whispered`, skill teaching) are **suppressed at the audit-emitter boundary**. The Nous is "shouting into the void." Other Nous don't observe a muted peer.
- **Quarantined:** Nous flagged with `quarantineFlag: true` in registry; remains in original region; peer discovery filters quarantined Nous out of nearby-list queries. Effectively socially isolated but spatially present. No physical region move.
- **Force-sleep:** Triggers an immediate Hypnos sleep cycle (Phase 16). Same `nous.sleep.entered`/`completed` events as natural sleep, distinguished only by the upstream `operator.forced_sleep` event preceding it in the chain.

Planner: encode these as task acceptance criteria. If a different model fits the codebase better, raise it in PLAN.md and ask the user via the plan-checker review.

**D-25b-NEW-4 — Freeze-wallet semantics (zero-custody constraint):**
- v2.5 invariant: platform holds zero custody of human wallets. Freeze is therefore a Grid-side flag, **not** an on-chain action.
- Implementation: `human_users.frozen: bool` column added via new migration (v11). Portal middleware checks the flag and blocks portal actions (chat, tip, spawn — phases 26+27) when true. SIWE sign-in itself remains allowed so the user can still see their (read-only) frozen status.
- The user's underlying EVM wallet is untouched. They can still transact on-chain outside Noēsis — Noēsis just refuses to accept further actions from them inside the portal until an H5 operator clears the flag.

**D-25b-NEW-5 — Ban-human uses a distinct `human_users.banned` column (separate from `frozen`):**
- Locked during plan-checker revision (2026-05-21). The PATTERNS.md original note left this to planner discretion; planner picked "separate columns" and we now ratify that choice.
- **Rationale:** `frozen` and `banned` are semantically distinct sanctions. A frozen-but-not-banned human must still be able to SIWE-authenticate to see their (read-only) frozen status (per D-25b-NEW-4). A banned human is fully revoked. Collapsing both into one column would conflate two different operator intents and one different downstream behavior (SIWE permitted vs SIWE rejected).
- **Implementation:** Migration v13 adds `human_users.banned TINYINT(1) NOT NULL DEFAULT 0`. Migration v12 (plan 07) already adds `frozen`. Both columns coexist on `human_users`. Ban sets `banned=1`; freeze sets `frozen=1`; they are independently togglable.
- **Forward-compat:** Portal middleware (plan 13) reads BOTH columns. Ban → SIWE rejected at auth layer. Freeze → SIWE accepted, but portal-action endpoints reject.

</decisions>

<deferred_ideas>
## Deferred to future phases (do NOT touch in 25b)

- **Un-sanction events** (operator.unmuted, operator.unslashed_refund, etc.) — Allowlist +4 if/when added. New phase ("Sanction Lifecycle").
- **Sanction TTLs** (auto-expire after N ticks) — same future phase.
- **Sanction appeals flow** (human-side request to lift a ban) — Phase 28+ community surfaces.
- **On-chain freeze** — would require custody, violates v2.5 zero-custody invariant. Never.
- **Public Steward deploy** — still gated on SIWE-derived session middleware; out of scope for 25b.
- **Unified spawn wizard for steward + human portal** — rejected in umbrella D-12. Steward spawn (25b, H5 operator, treasury-funded) and human spawn (Phase 27, SIWE-authenticated human, Cyber-Coin-funded) stay distinct flows.
- **Treasury funding mechanism for system Nous spawn** (whether config-defined treasury DID, operator-allocated, or a dedicated `system_treasury` ledger entry) — defer to a follow-up phase. 25b ships with the existing `economy.initialSupply` allocation (same path Phase 22 / GenesisLauncher uses for every spawned Nous). If researchers need different per-spawn allocations or a treasury debit trail, raise it as a new phase.
- **Replay scrubber + culture browser** → 25c.

</deferred_ideas>

<scope_anchors>
## Existing assets the planner should reuse

- **25a-07 header-auth pattern** — `grid/src/api/operator/cognitive-snapshot.ts` is the canonical reference for Wave 0 migrations. Mirror the exact structure (tier header read → numeric parse → tier gate → operator_id header read → OPERATOR_ID_REGEX validation → resolved values used in audit emit).
- **Phase 8 H5 IrreversibilityDialog** — clone copy-verbatim for new H5 sanction confirmations (ban-human, slash-coin if reason includes "irreversible", spawn wizard final confirm).
- **Phase 6 H3 single-click + reason prompt** — pattern for mute-broadcast, force-sleep, quarantine.
- **Phase 16 Hypnos sleep cycle** — force-sleep triggers the same sleep state machine; reuse `nous-runner.ts` sleep entry path.
- **`appendOperatorEvent` sole-producer pattern** — every new sanction emitter goes in `grid/src/audit/append-operator-*.ts`, one file per event type.
- **Closed-tuple validator** — sanction payloads validated by the same closed-tuple key-set check used in 25a-03 cognitive snapshot.
- **CI plaintext gate** — extend `scripts/check-cognitive-snapshot-plaintext.mjs` pattern if any sanction payload could leak plaintext; reason_hash should make this a no-op but verify.

</scope_anchors>

<plan_shape_hint>
## Expected plan structure (planner refines)

**Wave 0 (security prerequisite — 6 plans, parallel-safe):**
- 25b-01 through 25b-06: header-auth migration of 6 existing operator routes

**Wave 1 (sanction emitter foundation — 1-2 plans):**
- Allowlist 45→51 update (add 6 new event names) + 6 sole-producer emitter files + closed-tuple payload types + sanction-reasons table migration (v11 includes both the reasons table and human_users.frozen column)

**Wave 2 (Nous sanction routes + UI — ~3-4 plans):**
- 4 new operator routes (mute, slash, quarantine, force-sleep) with header-auth from day one
- Steward UI sanctions panel on /nous/[id] (Phase 6 H3 patterns + Phase 8 H5 dialog clone)

**Wave 3 (human sanction routes + UI — ~2-3 plans):**
- 2 new operator routes (ban-human, freeze-wallet)
- Steward UI sanctions panel on /humans/[did] (clone of Nous panel, H5 dialog)
- Portal middleware checks `human_users.frozen` and blocks chat/tip/spawn actions (forward-compat for phases 26+27)

**Wave 4 (researcher Nous spawn wizard — ~2-3 plans):**
- New `POST /operator/spawn-system-nous` route (H5, header-auth)
- Spawn wizard UI flow in Steward (name → personality seeds → confirm → spawn)
- Treasury funding source — planner picks specific mechanism (config-defined treasury DID, or operator-pays-from-personal-allocation; raise in plan-checker if ambiguous)

**Plan count estimate:** 6 (Wave 0) + 1-2 (Wave 1) + 3-4 (Wave 2) + 2-3 (Wave 3) + 2-3 (Wave 4) = **14-18 plans**. Matches earlier roadmap rough estimate of "10-14 (incl. header-auth wave 0)" — planner may compress.

</plan_shape_hint>

---

*Phase: 25b-sanctions-and-spawn-wizard*
*Generated by /gsd-discuss-phase 25b on 2026-05-21*
