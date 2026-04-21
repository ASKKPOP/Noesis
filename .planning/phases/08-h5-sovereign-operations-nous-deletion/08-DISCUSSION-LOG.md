# Phase 8 Discussion Log

**Phase:** 08-h5-sovereign-operations-nous-deletion
**Mode:** `/gsd-discuss-phase 8 --auto`
**Date:** 2026-04-21
**Resolution:** All 10 gray areas auto-resolved with recommended options. No interactive user prompts per `--auto` contract.

---

## Codebase & Prior-Context Scouting

Loaded before gray-area analysis:
- `.planning/ROADMAP.md` Phase 8 block (goal, 5 success criteria, dependencies on Phase 6 + 7, 2–3 plan estimate).
- `.planning/REQUIREMENTS.md` AGENCY-05 (irreversibility warning, DID-typed confirm, `operator.nous_deleted`, no audit-chain purging).
- `.planning/STATE.md` (allowlist 17 events, Phase 6 D-20 H5-not-in-hydration-whitelist, Inspector H5 disabled affordance at `data-testid="inspector-h5-delete"`, Open Question #3 on H5 permission surface).
- `.planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md` (ElevationDialog + closure-capture race pattern, tier-required invariant, hash-only boundary, payload privacy matrix, H5 hydration whitelist).
- `.planning/phases/07-peer-dialogue-telos-refinement/07-CONTEXT.md` (sole-producer pattern, closed-tuple payload, zero-diff regression pattern, doc-sync reconciliation).
- `PHILOSOPHY.md` §1 (sovereign intelligence), §4 (memory earned), §7 (H5 Sovereign definition + first-life promise).
- `grid/src/registry/registry.ts` + `grid/src/registry/types.ts` (no delete path; `records.has(did)` naturally covers DID reuse).
- `grid/src/space/map.ts` (no `removeNous`; Phase 8 adds it).
- `grid/src/audit/operator-events.ts` (sole-producer template `appendOperatorEvent`, `VALID_TIERS` includes H5).
- `grid/src/audit/append-telos-refined.ts` (Phase 7 structural sibling for `appendNousDeleted`).
- `grid/src/api/operator/telos-force.ts` (closed-tuple payload + HEX64_RE guard + error ladder template).
- `dashboard/src/app/grid/components/inspector.tsx` lines 210–234 (existing disabled H5 button to wire live).

---

## Gray Areas — Auto-Resolved

Each area below was identified from ROADMAP + REQUIREMENTS + prior-phase context analysis. `--auto` mode selected the recommended option for each without user prompting.

### GA-1: DID-typed confirmation UX — paste-enabled vs paste-suppressed

**Options considered:**
- (A) Paste-enabled — simpler UX, operator clicks DID in Inspector header → Cmd-C → pastes.
- (B) **Paste-suppressed, typed-only — maximum friction per AGENCY-05.** ← selected
- (C) Two-factor (paste + type again) — overkill.

**Rationale:** AGENCY-05 mandates irreversibility warning naming the first-life promise. Paste reduces the cognitive commitment to a single keystroke; typing forces character-by-character reading of the DID. The first-life promise (audit entries outlive the Nous) is serious enough to warrant the friction. Resolves to **D-01 + D-02 + D-03**.

### GA-2: State-hash composition — Brain-single-hash vs Grid-composes-from-components

**Options considered:**
- (A) Brain returns a single opaque `state_hash` — simpler, but opaque to the forensic pipeline.
- (B) **Brain returns 4 component hashes; Grid composes the 5th (final) hash over component-hashes + registry metadata.** ← selected
- (C) Brain returns plaintext — rejected outright (violates Phase 6 D-19 hash-only invariant and PHILOSOPHY §1).

**Rationale:** Option B preserves the hash-only invariant while giving future forensic tooling the ability to verify subsystem integrity independently (if those hashes are later surfaced). Option A loses that optionality. Grid adds registry metadata (ousia, lifecycle, region, spawnedAtTick) because it owns those fields — Brain does not see them. Resolves to **D-06 + D-07 + D-08 + D-09 + D-10**.

### GA-3: Deletion semantics — hard-delete vs tombstone

**Options considered:**
- (A) Hard-delete — `records.delete(did)` + `nameIndex.delete(name)` — breaks historical name-resolution in firehose replays.
- (B) **Tombstone — `status = 'deleted'` + `deletedAtTick`; record retained forever.** ← selected
- (C) Archive table — separate `deletedNous` map — extra surface area for no gain.

**Rationale:** Historical firehose replay and audit chain verification must resolve DID→name indefinitely (PHILOSOPHY §7 first-life promise). Hard-delete orphans historical entries' human-readable context. Tombstone is cheap (bounded per operator action count), preserves the public-key / name / spawn-tick lineage, and DID-reuse prevention falls out naturally from the existing `records.has(did)` check. Resolves to **D-11 + D-12 + D-13 + D-14 + D-15 + D-33 + D-34**.

### GA-4: Post-deletion error semantics — 404 Not Found vs 410 Gone

**Options considered:**
- (A) 404 Not Found — treats deletion as non-existence.
- (B) **410 Gone with `{error, deleted_at_tick}` payload — signals the distinction between "never existed" and "existed, now deleted".** ← selected
- (C) 403 Forbidden — wrong semantic class.

**Rationale:** 410 is the RFC-7231 semantic for intentional permanent removal of a previously-present resource. 404 conflates deletion with DID-never-existed, making dashboard UX and historical audit queries ambiguous. The `deleted_at_tick` field gives clients enough context to resolve against firehose. Centralized via `tombstoneCheck` helper to prevent drift across 4+ DID-resolving routes. Resolves to **D-16 + D-17 + D-18 + D-19**.

### GA-5: Elevation flow — single-dialog vs two-stage

**Options considered:**
- (A) Single irreversibility dialog that internally elevates H4→H5 → couples elevation UX to commit UX.
- (B) **Two-stage — existing Phase 6 `ElevationDialog(tier=H5)` → new `IrreversibilityDialog` with DID-typed confirm.** ← selected
- (C) No elevation, just a big red button — violates Phase 6 tier-visibility contract.

**Rationale:** Phase 6 D-06..D-08 established ElevationDialog as the canonical elevation primitive with closure-capture race safety and auto-downgrade semantics. Reusing it for H5 preserves the consistency of tier transitions across the console. A net-new single dialog would fork the elevation primitive. The irreversibility dialog handles commit-specific friction (DID typing); elevation handles tier-transition ceremony. Clean separation of concerns. Resolves to **D-20 + D-21 + D-22 + D-23 + D-05** (D-05 covers the auto-downgrade on cancel, mirroring Phase 6 D-08 single-use elevation).

### GA-6: Audit payload shape — open-ended vs closed 5-key tuple

**Options considered:**
- (A) Open-ended object with spread — flexible for future extension but structurally unguarded.
- (B) **Closed 5-key tuple `{tier, action, operator_id, target_did, pre_deletion_state_hash}` with `Object.keys(payload).sort()` structural assertion.** ← selected
- (C) Include 4 component hashes — pollutes payload; forensic tooling can re-request from Brain if needed.

**Rationale:** Phase 6 D-11 and Phase 7 D-20 established closed-tuple discipline for all allowlisted events. `Object.keys(payload).sort()` structural assertion makes key drift a loud test failure. Adding component hashes bloats the broadcast payload and creates multiple redundant forensic surfaces (the combined hash is the canonical forensic record). Resolves to **D-24 + D-25 + D-26 + D-27 + D-38**.

### GA-7: Privacy matrix — extend FORBIDDEN_KEY_PATTERN vs reuse as-is

**Options considered:**
- (A) Extend `FORBIDDEN_KEY_PATTERN` with new keys like `state_hash` — conflates forensic hashes with forbidden plaintext.
- (B) **Reuse pattern unchanged; `operator.nous_deleted`'s 5 keys are structurally clean.** ← selected

**Rationale:** The 5 payload keys contain no substring matching `/prompt|response|wiki|reflection|thought|emotion_delta/i`. `pre_deletion_state_hash` is a hash, not plaintext — it must NOT be forbidden. Extending the pattern for this event's keys would reject legitimate hash-only payloads in future phases too. Same resolution Phase 7 D-21 reached. Resolves to **D-28 + D-29 + D-30**.

### GA-8: H5 permission surface — feature flag (default-OFF) vs default-ON behind dialog (resolves STATE.md Open Q#3)

**Options considered:**
- (A) Default-OFF feature flag (`NOESIS_ENABLE_H5=1` required) — invisible unless discovered via docs.
- (B) **Default-ON behind irreversibility dialog; optional `NOESIS_GRID_DISABLE_H5=1` env off-switch for demos/hardening.** ← selected
- (C) H5 requires a second operator's co-sign — out of scope for single-operator v2.1.

**Rationale:** arxiv 2506.06576 (cited in PHILOSOPHY §7) finds that workers want higher agency than experts deem necessary; making the tier visible is what distinguishes guardian from puppeteer. A feature flag hides H5 by default, violating the visible-tier mandate. The irreversibility dialog + DID-typed confirm + auto-downgrade IS the safety moat — not a flag. An optional env off-switch remains available for operators who want it. Resolves STATE.md Open Question #3 → **D-31 + D-32 + D-40**.

### GA-9: DID/name reusability — reusable-after-tombstone vs permanent-reservation

**Options considered:**
- (A) DIDs reusable after tombstone, names free for re-spawn — maximizes namespace flexibility.
- (B) **Permanent reservation; tombstoned DID and name both remain in registry indices.** ← selected

**Rationale:** The first-life promise of PHILOSOPHY §7 — "the integrity of the record outlives the Nous" — requires unambiguous DID→identity resolution for all time. Reuse would make historical firehose replays ambiguous: which DID does this audit entry belong to? Conservative default; a future `NAME-REUSE-01` or `DID-REUSE-01` phase can revisit with operator-explicit unlock if the flexibility becomes needed. Resolves to **D-33 + D-34**.

### GA-10: Testing strategy — per-SC tests vs unified smoke + privacy + determinism

**Options considered:**
- (A) One mega integration test covering the 5 success criteria — hard to diagnose failures.
- (B) **Per-surface test files mirroring Phase 7 discipline: privacy matrix, producer-boundary gate, route error ladder, tombstone DID-reuse, tombstone tick-skip race, audit-no-purge, zero-diff regression, plus dashboard primitive + wiring tests.** ← selected

**Rationale:** Phase 7's test matrix pattern (separate privacy + producer-boundary + zero-diff files) diagnoses failures precisely. AGENCY-05 has multiple independent invariants (DID-typed UX, state-hash composition, tombstone semantics, 410 errors, audit preservation) — bundling them into one test file would mean a single failure points at many possible root causes. RED-first commits per file preserve Noēsis TDD discipline. Resolves to **D-35 + D-36**.

---

## Non-Gray-Area Decisions (Auto-Derived From Prior Context)

These decisions were NOT gray areas — they follow mechanically from Phase 6 + Phase 7 invariants:

- Allowlist grows 17→18 at position 18 (frozen-ordering invariant). → **D-24**
- `appendNousDeleted` is the sole producer (Phase 6 D-13 / Phase 7 D-17 pattern). → **D-38**
- Closed payload tuple with `Object.keys(payload).sort()` assertion (Phase 6 D-11 / Phase 7 D-20). → **D-25**
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` guards at 4 entry points (adds delete route to Phase 6's 3). → **D-38**
- `scripts/check-state-doc-sync.mjs` bumped 17→18 in the phase-close commit (Phase 6 D-22 / Phase 7 D-32 discipline). → **D-39**
- Auto-downgrade from H5→H1 on commit OR cancel (Phase 6 D-08 single-use elevation). → **D-05 + D-20**
- AuditChain zero-diff regression across 0 vs 10 listeners (Phase 1 / Phase 6 / Phase 7 chain). → **D-36**
- Audit chain never purged, verify() passes post-deletion (PHILOSOPHY §7). → covered in **D-35** audit-no-purge test.

---

## Plan Decomposition (Resolved Under GA-10, Refined in D-37)

Three plans, each ~8–12 tasks:

1. **08-01** — Grid deletion primitive + tombstone infrastructure. Surfaces: `NousRegistry.tombstone`, `SpatialMap.removeNous`, `tombstoneCheck` helper, 410 Gone wiring across existing DID-resolving routes, `status` field in introspect payload, runner despawn. Does NOT add the delete route or audit event — keeps tombstone mechanics isolated for testability.

2. **08-02** — Delete route + audit event + Brain state-hash RPC. Surfaces: `POST /api/v1/operator/nous/:did/delete`, `appendNousDeleted`, `combineStateHash`, Brain `compute_pre_deletion_state_hash` RPC with 4-component tuple, allowlist 17→18, privacy matrix, producer-boundary gate, zero-diff regression, doc-sync bump.

3. **08-03** — Dashboard UX: `IrreversibilityDialog` primitive + Inspector wiring. Surfaces: new primitive (DID-typed, paste-suppressed, red-bordered, first-life promise copy), 2-stage elevation flow wiring from Inspector, tombstoned-state rendering of the Delete Nous button, introspect 410 → `FetchError.nous_deleted`, auto-downgrade on cancel regression.

Each plan ships RED-first per Noēsis TDD discipline.

---

## Open Questions Resolved in This Phase

- **STATE.md Open Q#3** — "H5 permission surface: feature flag vs default-ON behind dialog?"
  → **RESOLVED: default-ON behind irreversibility dialog** (D-31).
  Rationale: visible-tier mandate (PHILOSOPHY §7 + arxiv 2506.06576). The dialog IS the safety; a flag would violate visibility. Optional `NOESIS_GRID_DISABLE_H5=1` env gate remains for demos. To be struck from STATE.md Open Questions in the phase-close commit.

---

## Scope Boundaries Reaffirmed (from ROADMAP + PHILOSOPHY)

**Out of scope, NOT gray areas — pre-decided by prior context:**
- Forensic plaintext vault — hash-only v2.1 ships (PHILOSOPHY §1).
- Audit-chain purging — explicitly forbidden (PHILOSOPHY §7).
- DID/name reuse after tombstone — first-life promise.
- Undelete / resurrection — tombstones terminal.
- Bulk deletion — per-DID only in v2.1.
- Cross-grid deletion — single-grid scope (PROJECT.md).
- Brain self-termination — only H5-elevated operator deletes.

See `<deferred>` section of `08-CONTEXT.md` for the full list.

---

## Downstream Handoff

- **Next command:** `/gsd-ui-phase 8 --auto` (UI hint = yes for `IrreversibilityDialog` primitive + Inspector wiring work) then `/gsd-plan-phase 8 --auto`.
- **Expected plan count:** 3 (per D-37).
- **Researcher inputs:** CONTEXT.md + this log. No open questions for the researcher — all UX/semantic gray areas resolved.
- **Planner inputs:** CONTEXT.md is the source of truth for 40 numbered decisions; this log documents the reasoning. Planner should read CONTEXT.md `<decisions>` + `<canonical_refs>` + `<code_context>` + `<specifics>` sections.

---

*End of discussion log.*
