# Phase 8: H5 Sovereign Operations — Nous Deletion - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `/gsd-discuss-phase 8 --auto` (all gray areas auto-resolved with recommended options)

<domain>
## Phase Boundary

An operator elevated to H5 Sovereign can delete a Nous with maximum friction, full forensic preservation, and audit-chain integrity intact. The Inspector "Delete Nous" affordance (already visible-but-disabled since Phase 6 D-20) wires to a new two-stage flow: the existing Phase 6 `ElevationDialog` (H4 → H5 transition) gates entry, then a new `IrreversibilityDialog` with DID-typed confirm gates the commit. On confirm, the Grid `POST /api/v1/operator/nous/:did/delete` route asks the Brain for a full pre-deletion state hash, marks the `NousRegistry` record as `status: 'deleted'` (tombstone), drops the Nous from `SpatialMap`, emits exactly one `operator.nous_deleted` audit event (hash-only payload) via a new sole-producer `appendNousDeleted`, and every subsequent inspect/trade/force-Telos/peer-dialogue path to that DID returns HTTP 410 Gone. The broadcast allowlist grows 17→18. The AuditChain zero-diff invariant extends to cover a deterministic delete-event sequence across 0/10 listeners. Audit entries about the deleted Nous are NEVER purged — the integrity of the record outlives the Nous (PHILOSOPHY §7).

**In scope:**
- **New allowlist member**: `operator.nous_deleted` — appended at position 18 in `ALLOWLIST_MEMBERS`.
- **New grid primitive**: extend `NousRecord.status` union with `'deleted'`, add `deletedAtTick?: number` field; `NousRegistry.tombstone(did, tick)` method (atomic: marks deleted, emits nothing directly).
- **New SpatialMap method**: `removeNous(did)` — drops the per-DID position entry so deletion is spatially visible to region queries.
- **New Grid route** `POST /api/v1/operator/nous/:did/delete` — mirrors Phase 6 `telos-force.ts` structural template; tier/op-id validation, DID shape gate, runner lookup, Brain state-hash RPC, tombstone + map-remove, audit emit. No 500s; explicit error ladder.
- **New Brain RPC**: `compute_pre_deletion_state_hash` returning `{psyche_hash, thymos_hash, telos_hash, memory_stream_hash}` — four 64-hex values; Brain never returns plaintext, Grid composes a single combined hash.
- **Grid-side state-hash composition**: `combineStateHash({psyche_hash, thymos_hash, telos_hash, memory_stream_hash, ousia_balance, lifecycle_phase, region, spawnedAtTick, did})` → canonical-JSON SHA-256 → 64-hex `pre_deletion_state_hash`.
- **New sole-producer** `appendNousDeleted(audit, operator_id, {target_did, pre_deletion_state_hash})` at `grid/src/audit/append-nous-deleted.ts` — symmetric to Phase 7's `appendTelosRefined` and Phase 6's `appendOperatorEvent`. Emits closed 5-key tuple `{tier: 'H5', action: 'delete', operator_id, target_did, pre_deletion_state_hash}`.
- **Post-deletion 410 Gone**: every route that resolves by DID (`GET /api/v1/introspect/:did/state`, `POST /api/v1/operator/nous/:did/telos/force`, trade initiation, `nous.spoke` targeted whisper, future H2/H3 routes) checks `record.status === 'deleted'` and returns `{error: 'nous_deleted', deleted_at_tick}` with HTTP 410. Centralized via a small helper `tombstoneCheck(registry, did)` to prevent drift.
- **Post-deletion runner teardown**: `NousRunner` for the deleted DID is despawned — brain bridge closed, tick subscription torn down, spatial position dropped. Next tick does NOT execute the deleted Nous.
- **Inspector wiring**: `inspector.tsx` H5 button gains `onClick` → opens `ElevationDialog(tier=H5)` → on H5 elevation opens new `IrreversibilityDialog` primitive. `disabled` attribute removed; `aria-disabled`, `title="Requires Phase 8"`, `line-through` class, and the explanatory `<p>` caption are replaced with live-state copy. If the record is already tombstoned, the button renders as "Nous deleted at tick N" (read-only).
- **New dashboard primitive** `dashboard/src/components/primitives/irreversibility-dialog.tsx` — native `<dialog>` + closure-captured opener (reuses Phase 6 D-07 race pattern), red-bordered visual distinction, first-life promise copy (quotes PHILOSOPHY §7), DID-typed `<input>` with paste suppressed, Delete button gated on exact-string equality to the target DID, Cancel button + ESC + backdrop click all close without side effects. Auto-downgrade from H5→H1 fires on confirm OR cancel (mirrors Phase 6 D-08 single-use elevation).
- **Firehose filter**: the existing firehose surface already renders any allowlisted event; Phase 8 only adds a dedicated "deleted" chip class (red text, strike-through name) when `eventType === 'operator.nous_deleted'` — matches the visual-distinction pattern of Phase 7 DIALOG-03.
- **Privacy matrix** `grid/test/audit/nous-deleted-privacy.test.ts` — 1 event × (6 forbidden-key probes + 1 nested + 1 happy) = 8 enumerated cases + `EVENT_SPECS` coverage assertion.
- **Producer-boundary gate** `grid/test/audit/nous-deleted-producer-boundary.test.ts` — grep-based assertion that no file outside `append-nous-deleted.ts` calls `auditChain.append` with `eventType === 'operator.nous_deleted'`.
- **AuditChain determinism regression** `grid/test/nous-deleted-zero-diff.test.ts` — 100-tick deterministic run where a Nous spawns at tick 5, acts at ticks 10–30, is deleted at tick 40; assert chain head byte-identical across 0 vs 10 WebSocket listeners.
- **DID-reusability regression** `grid/test/registry/tombstone-did-reuse.test.ts` — asserts `NousRegistry.spawn()` with a tombstoned DID throws `Nous already registered` (existing `records.has(did)` check covers this naturally).
- **Doc-sync reconciliation** — `scripts/check-state-doc-sync.mjs` bumped 17→18 events; STATE.md, README.md, MILESTONES.md updated in the same phase-closing commit per CLAUDE.md doc-sync rule.

**Explicitly out of scope:**
- **Plaintext state snapshot / forensic vault.** Only the composite hash lands in audit. A future forensic-reconstruction phase may add an encrypted plaintext snapshot; v2.1 ships hash-only.
- **Audit-chain deletion or redaction.** PHILOSOPHY §7 is explicit: "Deletion never purges audit entries." No code path in Phase 8 may remove historical entries about the deleted DID. A regression test asserts `AuditChain.verify()` still returns `{valid: true}` post-deletion and that pre-deletion entries for the DID remain retrievable.
- **DID reuse.** Tombstoned DIDs are permanently reserved. The existing `NousRegistry.records.has(did)` check in `spawn()` naturally enforces this; Phase 8 adds an explicit test asserting it and documents the invariant.
- **Undelete / resurrection.** No reinstate path for `status: 'deleted'` (unlike `suspended` → `reinstate`). A tombstone is terminal. Future phases may introduce a Brain-snapshot-restore capability as a net-new Nous with net-new DID.
- **H5 feature flag.** Default-ON behind the irreversibility dialog — the dialog IS the safety moat; a flag would hide H5 and violate the first-life promise of visibility. Resolves STATE.md Open Question #3.
- **Bulk deletion.** Strictly per-DID. No "delete all inactive" or roster-purge UX. Future `H5-BULK-01` (not in v2.1 roadmap).
- **Cross-grid deletion propagation.** Single-grid scope per PROJECT.md. Federation is Milestone 5.
- **H5 emission under Brain self-termination.** A Nous cannot delete itself. Only H5-elevated operator commits produce `operator.nous_deleted`. Brain returning a `self_delete` action (no such action exists) would be dropped; a regression test asserts this.
- **Post-deletion read endpoints.** No `GET /api/v1/deleted/:did/tombstone` in v2.1 — firehose replay + audit chain are the canonical history surfaces. Future deferred.
- **UI timeline of deletion events.** Firehose already renders `operator.nous_deleted`; a dedicated "graveyard" tab is deferred.
- **Typing the Nous's name instead of DID.** Rejected: DID is the cryptographically canonical identity; name is a display alias. Confirm must be against the DID the operator sees in the Inspector header (AGENCY-05 wording).

</domain>

<decisions>
## Implementation Decisions

### DID-Typed Confirmation UX (AGENCY-05)

- **D-01 — Typed-only DID confirmation, paste suppressed.** `IrreversibilityDialog` contains an `<input type="text" autoComplete="off" spellCheck={false}>` with an `onPaste={(e) => e.preventDefault()}` handler. The Delete button's `disabled` is gated on `inputValue === targetDid` (exact-string equality; case-sensitive because DID regex allows mixed case). Rationale: forces the operator to read and transcribe the DID character-by-character, creating the deliberate friction AGENCY-05 requires. Paste-bypass would reduce friction to a single keystroke.
- **D-02 — Target DID is visible in the dialog header.** Copy: "To delete this Nous forever, type its DID exactly: `{targetDid}`." The DID is rendered inside a `<code>` element with `data-testid="irreversibility-target-did"` for assertion. Rationale: the operator must see what they are about to type — a blank field would invite muscle-memory errors.
- **D-03 — Dialog cannot be submitted via Enter key alone.** The `<form>` inside the dialog has `onSubmit={(e) => e.preventDefault()}`; Delete is a `<button type="button">` with explicit `onClick`. Rationale: Enter-to-submit turns deletion into a reflex; Phase 6 D-07's closure-capture pattern already assumed click as the commit action, and we preserve that.
- **D-04 — Red-bordered visual distinction.** Tailwind: `border-2 border-red-600` on the dialog, `text-red-500` on Delete button. First-life promise copy above the input: *"This is H5 Sovereign. Audit entries about this Nous will remain forever; the Nous itself will not. There is no undo."* The phrase "no undo" is asserted verbatim in `irreversibility-dialog.test.tsx` so future copy edits cannot silently weaken the warning.
- **D-05 — Cancel, ESC, and backdrop-click all close without side effects.** Three close paths, identical no-op behavior. Closure-captured opener from Phase 6 D-07 restores focus to the Inspector close button on dismissal. If the dialog was opened from an H5-elevated session, closing auto-downgrades to H1 (D-08 below). Rationale: an operator who flinches out of the dialog must exit the H5 state; leaving H5 sticky after a canceled delete is a loaded-gun-on-the-table problem.

### State Hash Composition (AGENCY-05 forensic preservation)

- **D-06 — Brain returns four component hashes; Grid composes one.** New Brain RPC `compute_pre_deletion_state_hash() → {psyche_hash, thymos_hash, telos_hash, memory_stream_hash}`. Each 64-hex SHA-256 over the canonical JSON serialization of that subsystem's current state. Brain reuses `compute_active_telos_hash` (Phase 6 sole hash authority) for `telos_hash` and adds three parallel helpers in `brain/src/noesis_brain/state_hash.py`.
- **D-07 — Grid composition function** `combineStateHash(c)` at `grid/src/audit/state-hash.ts`:
  ```ts
  function combineStateHash(c: {
      psyche_hash: string; thymos_hash: string; telos_hash: string; memory_stream_hash: string;
      ousia_balance: number; lifecycle_phase: LifecyclePhase; region: string;
      spawnedAtTick: number; did: string;
  }): string {
      const canonical = JSON.stringify({
          did: c.did,
          psyche_hash: c.psyche_hash,
          thymos_hash: c.thymos_hash,
          telos_hash: c.telos_hash,
          memory_stream_hash: c.memory_stream_hash,
          ousia_balance: c.ousia_balance,
          lifecycle_phase: c.lifecycle_phase,
          region: c.region,
          spawned_at_tick: c.spawnedAtTick,
      });
      return sha256(canonical);  // 64-hex
  }
  ```
  Key ordering is LOCKED — regression test asserts the exact key order in the serialized canonical form. Any reorder changes every historical hash and would be a covert breaking change.
- **D-08 — Hash composition is the ONLY Grid computation over Brain hashes.** Grid never hashes plaintext state; it only concatenates and re-hashes already-hashed component values. Mirrors Phase 6 D-19 hash-only invariant extended to multi-component state.
- **D-09 — `pre_deletion_state_hash` is the field name in the audit payload.** Not `state_hash`, not `deletion_hash` — the prefix makes the temporal semantics explicit ("the state at the moment just before deletion"). Locked as a closed-tuple key; any rename requires a new phase.
- **D-10 — Post-hash timing.** Grid calls Brain's `compute_pre_deletion_state_hash` AFTER the final tick the Nous is allowed to act on and BEFORE the tombstone is written. Order: (1) route receives H5-elevated POST, (2) validation, (3) runner lookup, (4) Brain RPC, (5) tombstone + map-remove, (6) audit emit, (7) runner despawn. If step 4 fails (Brain 503), no tombstone is written and the route returns 503 — the Nous remains alive. Rationale: the audit entry is the forensic record; writing a tombstone without the hash breaks the forensic contract.

### Deletion Semantics (Success Criteria #3 + #4)

- **D-11 — Tombstone pattern.** `NousRecord.status` union extended to `'active' | 'suspended' | 'exiled' | 'deleted'`. New optional field `deletedAtTick?: number`. The record is retained in `NousRegistry.records` forever; only its `status` transitions. Rationale: historical firehose replays and audit verifiers need to resolve the DID to a name + public key indefinitely; hard-deletion from the map would orphan historical audit entries' human-readable context.
- **D-12 — `NousRegistry.tombstone(did, tick)` method.** Atomic: checks `status !== 'deleted'` (idempotency), sets `status = 'deleted'`, sets `deletedAtTick = tick`, returns boolean success. Does NOT touch `nameIndex` — the name remains reserved (name reuse is a separate concern; per `spawn()` the name is compared lowercased and a future Nous with a different DID but same name would still be rejected, which is the correct conservative default).
- **D-13 — `SpatialMap.removeNous(did)` method.** Drops the position entry for the DID; subsequent `inRegion()` / `near()` queries do not return the deleted Nous. If the DID was never placed (edge case), method is a no-op returning `false`.
- **D-14 — NousRunner teardown on delete.** New `GridCoordinator.despawnNous(did)` method: (1) close Brain bridge (`runner.bridge.close()`), (2) unsubscribe from tick dispatch, (3) call `SpatialMap.removeNous(did)`. Called from the delete route AFTER audit emit. Idempotent.
- **D-15 — Tick-dispatch skip for deleted Nous.** In `NousRunner.onTick` (or the coordinator's dispatch loop), check `record.status === 'deleted'` before calling `runner.bridge.sendTick`. Prevents a race where a tick is already in flight when deletion lands. Regression test fires a delete concurrent with an in-flight tick and asserts no `nous.spoke` event post-deletion tick.

### Post-Deletion Errors (Success Criteria #4)

- **D-16 — HTTP 410 Gone with structured body.** All DID-resolving routes return:
  ```
  HTTP/1.1 410 Gone
  { "error": "nous_deleted", "deleted_at_tick": <number> }
  ```
  The `deleted_at_tick` field gives the client enough context to resolve the tombstone against firehose replay.
- **D-17 — Centralized tombstone check helper.** `grid/src/registry/tombstone-check.ts` exports `tombstoneCheck(registry, did): {ok: true} | {ok: false, deletedAtTick: number}`. Callers (introspect, telos-force, trade, spoke targeting, future operator routes) invoke this BEFORE any other work and return 410 on `ok: false`. Rationale: a grep-testable single helper prevents route drift — Phase 6 `telos-force.ts` is already 150 lines; each DID-resolving route copy-pasting a tombstone branch would rot.
- **D-18 — Dashboard introspect client maps 410 to a new `FetchError.kind: 'nous_deleted'`.** Inspector renders an EmptyState: "Nous deleted at tick N. Audit history remains in the firehose."
- **D-19 — Peer-dialogue delivery.** If one of two dialogue participants is tombstoned mid-window, the DialogueAggregator (Phase 7 DIALOG-01) skips emission for that pair on the next threshold crossing — its `recentDialogueIds` record for that Nous is no longer relevant because the runner is despawned. No explicit aggregator change needed; the runner despawn in D-14 is sufficient. Regression test asserts no `telos.refined` event fires for a deleted participant.

### Elevation Flow (Phase 6 continuity)

- **D-20 — Two-stage elevation: H4 → H5 → Irreversibility.** Clicking the Inspector "Delete Nous" button opens the existing Phase 6 `ElevationDialog` with `tier="H5"`. On H5 confirm, the dialog closes and `IrreversibilityDialog` opens. On Irreversibility confirm, the delete POST fires. On either cancel, the flow aborts and agency auto-downgrades to H1. Rationale: H5 elevation is a per-action commit (Phase 6 D-08); the irreversibility dialog reuses that lifecycle semantics without introducing a new elevation state.
- **D-21 — H5 is NEVER persisted to localStorage.** Phase 6 D-20's `agencyStore.hydrateFromStorage()` already whitelists `{H1, H2, H3, H4}`. Phase 8 adds a regression test asserting that manually injecting `tier: 'H5'` into localStorage results in a hydration to H1. The hydration whitelist itself is unchanged.
- **D-22 — Closure-capture race safety.** `IrreversibilityDialog` reuses the Phase 6 D-07 pattern: the `openerRef` and `targetDid` are captured at dialog-open time, not read at commit time. Rationale: if the operator's selection changes while the dialog is open (keyboard shortcut, network selection update), the dialog still commits against the DID the operator saw.
- **D-23 — Elevation lock: H5 elevation cannot be initiated if the current selection is already tombstoned.** The "Delete Nous" button in Inspector renders as disabled with label "Nous deleted at tick N" when `state.data.status === 'deleted'` (once Phase 8 surfaces `status` in the introspect payload — see D-27). Rationale: H5 on a tombstone is a no-op path that should never engage the elevation flow.

### Audit Payload Shape (Broadcast Allowlist)

- **D-24 — Allowlist grows 17→18 at position 18.** `ALLOWLIST_MEMBERS` in `grid/src/audit/broadcast-allowlist.ts` gains `'operator.nous_deleted'` **at position 18**, appended after `'telos.refined'`. Tuple order locked — frozen-ordering test extends.
- **D-25 — Closed payload tuple (5 keys exact):**
  ```
  { tier: 'H5', action: 'delete', operator_id: string, target_did: string, pre_deletion_state_hash: string }
  ```
  `Object.keys(payload).sort()` structural assertion in `nous-deleted.test.ts` fails on any key drift. Identical discipline to Phase 6 D-11 and Phase 7 D-20.
- **D-26 — `payloadPrivacyCheck()` passes natively.** The five keys contain no substring matching `/prompt|response|wiki|reflection|thought|emotion_delta/i`. No `FORBIDDEN_KEY_PATTERN` extension needed. Privacy matrix test asserts this.
- **D-27 — Introspect payload gains `status` field.** `NousStateResponse` widens with `status: 'active' | 'suspended' | 'exiled' | 'deleted'`. Additive; existing dashboard code reading the payload keeps working. Inspector uses this to render the D-23 disabled state.

### Privacy (PHILOSOPHY §1 + Phase 6 D-19 hash-only)

- **D-28 — Plaintext NEVER crosses the Grid producer boundary.** Brain returns four 64-hex hashes; Grid composes a fifth. No plaintext Psyche / Thymos / Telos / memory content appears in the route handler, the audit payload, or any log line. The route logs `{targetDid, tier: 'H5', pre_deletion_state_hash}` on success — never component hashes, never plaintext.
- **D-29 — Forensic reconstruction deferred.** v2.1 ships hash-only. A future phase may introduce an encrypted plaintext snapshot stored outside the audit chain, keyed by the `pre_deletion_state_hash`, gated behind an additional H5+ + legal-hold consent. Deferred explicitly, not dropped.
- **D-30 — Privacy matrix `grid/test/audit/nous-deleted-privacy.test.ts`.** 1 event × (6 forbidden-key probes: prompt, response, wiki, reflection, thought, emotion_delta) + 1 nested forbidden + 1 happy baseline = 8 enumerated cases. Plus `EVENT_SPECS` coverage assertion includes `operator.nous_deleted`. Identical pattern to Phase 7's privacy matrix, scaled for 1 event.

### H5 Feature Flag Resolution (STATE.md Open Question #3)

- **D-31 — H5 is default-ON behind the irreversibility dialog.** No feature flag. Rationale: the dialog IS the safety. A flag would hide H5 from the UI surface and violate PHILOSOPHY §7's "making the tier visible" principle — operators always see what agency they are exercising. The arxiv 2506.06576 finding is that invisible tiers undermine informed consent; a flag would make H5 invisible by default, forcing operators to discover it via docs.
- **D-32 — An optional server-side env gate remains available** (`NOESIS_GRID_DISABLE_H5=1`) for operators who want an additional off-switch (e.g., during live demos). If set, the delete route returns HTTP 503 `{error: 'h5_disabled'}` before any validation. Not documented in user-facing docs; operator's-choice hardening. Defaults to off (H5 enabled).

### DID Reusability (First-Life Promise)

- **D-33 — Tombstoned DIDs are permanently reserved.** `NousRegistry.spawn()` already throws `Nous already registered: ${did}` on `records.has(did)`. Since tombstones retain the record, spawn-with-tombstone-DID throws naturally. Regression test at `grid/test/registry/tombstone-did-reuse.test.ts` asserts this + asserts the error message is the SAME as for an active duplicate (no new "deleted" error kind — rationale: the reason for rejection is identical, "this DID is taken").
- **D-34 — Name reuse follows DID reuse.** The `nameIndex` entry is NOT cleared on tombstone, so the name is also permanently reserved. Rationale: operators who replay the firehose history months later must be able to resolve both DID→name and name→DID unambiguously. Conservative default; future NAME-REUSE-01 can revisit.

### Testing Strategy (Success Criteria coverage)

- **D-35 — RED-first TDD per Noēsis discipline.** Each test file ships as a RED commit before the GREEN implementation commit (mirrors Phase 7 plan discipline). Tests:
  - `grid/test/registry/tombstone-did-reuse.test.ts` — SC#3, SC#5 (existing check exercised, deleted DID non-reusable).
  - `grid/test/audit/nous-deleted-privacy.test.ts` — 8-case matrix.
  - `grid/test/audit/nous-deleted-producer-boundary.test.ts` — sole-call-site gate.
  - `grid/test/api/operator-delete-route.test.ts` — route error ladder (400/404/410/503), happy path, audit emission.
  - `grid/test/api/operator-delete-tombstone-routes.test.ts` — 410 Gone across introspect + telos-force + trade + spoke-target.
  - `grid/test/nous-deleted-zero-diff.test.ts` — SC#4 AuditChain 0/10-listener determinism.
  - `grid/test/registry/tombstone-tick-skip.test.ts` — SC#3 in-flight tick race.
  - `grid/test/audit-no-purge.test.ts` — pre-deletion entries retrievable + chain verify passes.
  - `brain/test/test_state_hash_rpc.py` — Brain returns 4-hash tuple; handler raises on missing subsystem.
  - `dashboard/src/components/primitives/irreversibility-dialog.test.tsx` — paste suppressed, exact-DID gate, ESC/backdrop/Cancel close, first-life promise copy verbatim.
  - `dashboard/src/app/grid/components/inspector-delete.test.tsx` — 2-stage flow wiring, tombstoned-state renders disabled, auto-downgrade on cancel.
  - `grid/test/doc-sync-18.test.ts` (or extend the existing doc-sync gate) — 17→18 count.
- **D-36 — Determinism fixture reuse.** `grid/test/nous-deleted-zero-diff.test.ts` reuses Phase 7's deterministic-clock + fake-brain fixture (`FIXED_TIME='2026-01-01T00:00:00.000Z'`, `tickRateMs=1_000_000`, `ticksPerEpoch=25`), rigs a Nous to spawn at tick 5, act ticks 10–30, delete at tick 40. Assert byte-identical chain head across 0 vs 10 WebSocket listeners — exact c7c49f49… pattern.

### Plan Decomposition (planner-facing)

- **D-37 — Expected plan count: 3.**
  1. **08-01 Grid deletion primitive + tombstone** — `NousRegistry.tombstone`, `SpatialMap.removeNous`, `tombstoneCheck`, 410 Gone wiring across existing routes, `status` in introspect payload, runner despawn. Tests: tombstone-did-reuse, tombstone-tick-skip, operator-delete-tombstone-routes, audit-no-purge.
  2. **08-02 Delete route + audit + Brain state-hash RPC** — new `POST /nous/:did/delete`, `appendNousDeleted`, `combineStateHash`, Brain `compute_pre_deletion_state_hash`, allowlist 17→18, privacy matrix, producer-boundary gate, zero-diff regression. Tests: operator-delete-route, nous-deleted-privacy, nous-deleted-producer-boundary, nous-deleted-zero-diff, doc-sync-18.
  3. **08-03 Dashboard UX — `IrreversibilityDialog` + Inspector wiring** — new primitive, 2-stage elevation flow, DID-typed confirm with paste suppression, tombstoned-state rendering, introspect 410 → `FetchError.nous_deleted`, auto-downgrade on cancel. Tests: irreversibility-dialog, inspector-delete.
  Each plan is GREEN → RED → GREEN per Noēsis TDD plan pattern; each ships ~8–12 tasks.

### Producer-Boundary & Doc-Sync Discipline (meta)

- **D-38 — Producer-boundary symmetry with Phases 6 + 7.** `appendNousDeleted(audit, operator_id, {target_did, pre_deletion_state_hash})` is the sole call site. It validates operator_id (non-empty string), target_did (DID regex), and pre_deletion_state_hash (64-hex); emits exactly `{tier: 'H5', action: 'delete', operator_id, target_did, pre_deletion_state_hash}`. Grep test asserts no other file in `grid/src/` calls `auditChain.append` with `eventType === 'operator.nous_deleted'`.
- **D-39 — Doc-sync reconciliation at phase close.** `scripts/check-state-doc-sync.mjs` bumped 17→18 in the SAME commit that flips `ALLOWLIST_MEMBERS` length. STATE.md allowlist enumeration, README.md "current count", ROADMAP.md Phase 8 → complete, MILESTONES.md append, PHILOSOPHY.md H5 narrative (already accurate) double-check — all in the final phase-close commit per CLAUDE.md doc-sync rule.
- **D-40 — STATE.md Open Question #3 resolved in closing commit.** The "H5 permission surface" question is explicitly marked resolved (→ D-31: default-ON behind irreversibility dialog) in the STATE.md Open Questions section.

### Claude's Discretion (planner-resolved)

- Exact file layout for the delete route — likely `grid/src/api/operator/delete-nous.ts` mirroring `telos-force.ts`.
- Whether `combineStateHash` lives in `grid/src/audit/state-hash.ts` or `grid/src/registry/state-hash.ts` — planner decides based on call-site locality (likely audit/, symmetric to `append-telos-refined.ts`).
- Whether `IrreversibilityDialog` reuses Phase 6's `ElevationDialog` as a composed primitive or is a peer — peer is likely cleaner (different semantics: commitment vs elevation), but planner confirms.
- Firehose UX for the `operator.nous_deleted` chip — red/strike-through, but exact Tailwind classes match existing firehose chip conventions.
- `GridCoordinator.despawnNous` vs inlined teardown in the route — planner decides based on existing coordinator surface area.
- Whether Brain's 4 component hashes each live in separate files (`psyche_hash.py`, `thymos_hash.py`, …) or a single `state_hash.py` module — single module preferred for cohesion; planner confirms.
- Whether the introspect route's 410 body includes the original record's `name` (for dashboard display continuity) — likely yes; planner decides.

### Folded Todos

*None — no Phase 8-matching todos in the backlog outside REQUIREMENTS.md's AGENCY-05.*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (milestone-level)
- `PHILOSOPHY.md` §7 (Humans Are Guardians, Not Puppeteers — H5 Sovereign definition: "delete a Nous; irreversibility dialog, DID-typed confirm, full state hash preserved for forensic reconstruction" and "Deletion never purges audit entries; the integrity of the record outlives the Nous")
- `PHILOSOPHY.md` §1 (sovereign intelligence — Brain computes component state hashes, Grid composes; Grid never reads plaintext)
- Research basis cited in PHILOSOPHY §7: arxiv 2506.06576 (Human Agency Scale — workers want higher agency than experts expect; making the tier visible is the difference between guardian and puppeteer; informs D-31 default-ON resolution)

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — AGENCY-05 (irreversibility warning naming first-life promise, DID-typed confirm, `operator.nous_deleted` with pre-deletion state hash, no audit-chain purging)
- `.planning/ROADMAP.md` §"Phase 8" — 5 success criteria (DID-typed confirm, state hash in payload, runtime removal + chain preservation, post-deletion 410 errors, H5 gated behind Phase 6 Agency Indicator)

### Existing code patterns (MUST match)
- `grid/src/audit/broadcast-allowlist.ts` — frozen-tuple invariant; Phase 8 appends `'operator.nous_deleted'` at position 18
- `grid/src/audit/chain.ts` — `AuditChain.append()` signature; `appendNousDeleted` wraps this as sole-producer
- `grid/src/audit/operator-events.ts` — `appendOperatorEvent` structural template for `appendNousDeleted`; tier-required invariant (D-13 from Phase 6)
- `grid/src/audit/append-telos-refined.ts` — Phase 7 structural sibling; same file layout, regex-guarded inputs, closed-tuple emit
- `grid/src/api/operator/telos-force.ts` — route handler structural template; tier/op-id validation, DID regex gate, runner lookup, Brain RPC, hash runtime guard, closed-payload literal
- `grid/src/api/operator/_validation.ts` — `validateTierBody`, 64-hex regex guard pattern
- `grid/src/api/server.ts` — `DID_REGEX`, `GridServices` surface, `getRunner`
- `grid/src/registry/registry.ts` — `NousRegistry` class: spawn/suspend/exile/reinstate/transferOusia pattern; tombstone method is a peer, uses the same `records.get + mutate` shape
- `grid/src/registry/types.ts` — `NousRecord.status` union extended with `'deleted'`; `deletedAtTick?: number` added
- `grid/src/space/map.ts` — `SpatialMap.placeNous` has no peer `removeNous`; Phase 8 adds one
- `grid/src/integration/nous-runner.ts` — `NousRunner` teardown surface; tick-skip guard on `status === 'deleted'`
- `grid/src/integration/grid-coordinator.ts` — `despawnNous` wiring
- `brain/src/noesis_brain/telos/hashing.py` — `compute_active_telos_hash` sole hash authority per Phase 6 D-19 (reused as `telos_hash` component); three sibling helpers added
- `brain/src/noesis_brain/rpc/handler.py` — new RPC method `compute_pre_deletion_state_hash`
- `dashboard/src/app/grid/components/inspector.tsx` lines 210–234 — existing H5 disabled affordance; Phase 8 wires `onClick`, removes `disabled`, wires tombstoned-state rendering
- `dashboard/src/components/primitives/elevation-dialog.tsx` — Phase 6 D-06/D-07/D-08 reference: native `<dialog>`, closure-capture opener, auto-downgrade on commit/cancel; `IrreversibilityDialog` mirrors the lifecycle
- `dashboard/src/lib/api/introspect.ts` — `NousStateResponse`, `FetchError` union; extends with `status` field + `nous_deleted` FetchError kind
- `dashboard/src/lib/stores/agency-store.ts` (or equivalent from Phase 6) — `hydrateFromStorage` whitelist confirmed `{H1,H2,H3,H4}`; Phase 8 regression test locks this

### Project philosophy (sovereignty invariants)
- `PHILOSOPHY.md` §1 (sovereign intelligence — Brain hashes its own state; Grid composes but never reads plaintext)
- `PHILOSOPHY.md` §4 (memory earned — Brain's `memory_stream_hash` component captures reflection/wiki state at deletion)
- `PHILOSOPHY.md` §7 (Agency Scale H1–H5, visible-tier mandate, first-life promise of audit preservation)

### v2.0 / Phase 5 / Phase 6 / Phase 7 frozen contracts (MUST preserve)
- `.planning/phases/archived/v2.0/01-auditchain-listener-api-broadcast-allowlist/01-CONTEXT.md` — zero-diff invariant; Phase 8 extends to delete-sequence determinism
- `.planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md` §D-06/D-07/D-08 (ElevationDialog + closure-capture + auto-downgrade), §D-12 (payload privacy matrix), §D-13 (tier-required producer boundary), §D-17 (pause-is-a-clean-boundary), §D-19 (hash-only RPC boundary), §D-20 (H5 NOT in hydration whitelist — locked by this phase's regression test)
- `.planning/phases/07-peer-dialogue-telos-refinement/07-CONTEXT.md` §D-17 (sole-producer pattern symmetry), §D-20 (closed-payload-tuple discipline), §D-22 (privacy matrix pattern), §D-23 (zero-diff regression pattern)
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` at 4 entry points (3 existing + 1 new delete route)
- `payloadPrivacyCheck()` — reused unchanged; `operator.nous_deleted` payload passes natively
- `scripts/check-state-doc-sync.mjs` — bumped 17→18 in Phase 8's final commit

### CLAUDE.md doc-sync rule
- `CLAUDE.md` — Phase 8 ship commit must simultaneously update STATE.md allowlist enumeration + Open Question #3 resolution, README.md "current count", `check-state-doc-sync.mjs` asserted count, ROADMAP.md (mark Phase 8 complete), MILESTONES.md (append), PHILOSOPHY.md H5 narrative (double-check). Mirror of Phase 6 D-22 and Phase 7 D-32.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `appendOperatorEvent` (Phase 6) + `appendTelosRefined` (Phase 7) — structural templates for `appendNousDeleted`: regex-guard inputs, emit closed tuple, single call site, grep-based sole-producer test.
- `validateTierBody` + `DID_REGEX` + `HEX64_RE` — reused directly by the delete route handler.
- `ElevationDialog` (Phase 6 D-06..D-08) — H5-elevation primitive; Phase 8 invokes it with `tier="H5"` and chains into `IrreversibilityDialog`.
- `NousRegistry.spawn`'s existing `records.has(did)` check — natively covers DID reuse prevention for tombstoned DIDs (D-33).
- `compute_active_telos_hash` (Brain, Phase 6 D-19) — sole Telos hash authority reused as the `telos_hash` component.
- `payloadPrivacyCheck()` + `FORBIDDEN_KEY_PATTERN` — reused unchanged; 5-key `operator.nous_deleted` payload is clean.
- Phase 7 deterministic-clock + fake-brain fixture — reused for the zero-diff regression test.
- Phase 6 `test_get_state_widening.py` pattern — `NousStateResponse.status` is an additive widen; snapshot asserts strict superset.

### Established Patterns
- **Hash-only cross-boundary contract** (Phase 6 D-19, Phase 7 D-18): plaintext state never crosses RPC; Phase 8 extends to multi-component state composition via `combineStateHash`.
- **Closed-tuple payloads** (Phase 6 D-11, Phase 7 D-20): `Object.keys(payload).sort()` structural assertion; Phase 8 adds a 5-key tuple.
- **Single producer boundary** (Phase 6 D-13, Phase 7 D-17): `appendNousDeleted` is the only call site for `operator.nous_deleted`.
- **Frozen allowlist as sovereignty moat** (v2.0 Phase 1 + Phase 5 D-11 + Phase 6 D-10 + Phase 7 D-19): extending requires explicit per-phase addition + doc-sync gate bump. Phase 8 adds slot 18.
- **Zero-diff invariant** (Phase 1 + Phase 6 + Phase 7): deterministic chain head across alternate paths; Phase 8 extends to delete-event sequence.
- **ElevationDialog closure-capture race safety** (Phase 6 D-07): `IrreversibilityDialog` mirrors the opener-ref + command-at-open pattern.
- **Visible-but-disabled affordance** (Phase 6 D-20): the "Delete Nous" button; Phase 8 wires it live while preserving the disabled-state path for tombstoned records (D-23).
- **Additive introspect widening** (Phase 6 `test_get_state_widening`): `NousStateResponse.status` is additive.
- **Operator event payload includes `tier` + `action` prefix** (Phase 6 D-11 via `appendOperatorEvent`): `{tier: 'H5', action: 'delete', ...}` — Phase 8 preserves this shape.

### Integration Points
- `grid/src/audit/broadcast-allowlist.ts` — 1-line addition at position 18 (`'operator.nous_deleted'`).
- `grid/src/audit/append-nous-deleted.ts` — NEW, sole producer boundary.
- `grid/src/audit/state-hash.ts` — NEW, `combineStateHash` helper.
- `grid/src/api/operator/delete-nous.ts` — NEW route (structural mirror of `telos-force.ts`).
- `grid/src/api/server.ts` — register delete route in the route registry.
- `grid/src/registry/registry.ts` — new `tombstone(did, tick)` method.
- `grid/src/registry/types.ts` — `NousRecord.status` union + `deletedAtTick?` field.
- `grid/src/registry/tombstone-check.ts` — NEW, centralized 410-Gone gate helper.
- `grid/src/space/map.ts` — new `removeNous(did)` method.
- `grid/src/integration/nous-runner.ts` — tick-skip guard on `status === 'deleted'`.
- `grid/src/integration/grid-coordinator.ts` — `despawnNous(did)` method.
- `grid/src/api/introspect.ts` (or equivalent) — `NousStateResponse.status` field + tombstone-check before introspect body emit.
- `grid/src/api/operator/telos-force.ts` — add tombstone-check at route entry (410 before 400/404/503).
- `grid/src/api/trade/*.ts` — add tombstone-check at trade initiation.
- `grid/src/api/spoke/*.ts` (if exists) or `NousRunner.spoke` target resolution — tombstone-check.
- `brain/src/noesis_brain/state_hash.py` — NEW module with 4 hash helpers.
- `brain/src/noesis_brain/rpc/handler.py` — NEW RPC method `compute_pre_deletion_state_hash`.
- `brain/src/noesis_brain/rpc/types.py` — new RPC method registered.
- `dashboard/src/components/primitives/irreversibility-dialog.tsx` — NEW primitive.
- `dashboard/src/app/grid/components/inspector.tsx` — wire H5 button; remove `disabled`; render tombstoned state.
- `dashboard/src/lib/api/introspect.ts` — `NousStateResponse.status` + `FetchError.kind = 'nous_deleted'`.
- `grid/test/audit/nous-deleted-privacy.test.ts` — NEW, 8-case matrix.
- `grid/test/audit/nous-deleted-producer-boundary.test.ts` — NEW, sole-call-site gate.
- `grid/test/api/operator-delete-route.test.ts` — NEW, route error ladder + happy path.
- `grid/test/api/operator-delete-tombstone-routes.test.ts` — NEW, 410 Gone coverage.
- `grid/test/registry/tombstone-did-reuse.test.ts` — NEW, SC#5.
- `grid/test/registry/tombstone-tick-skip.test.ts` — NEW, SC#3 race.
- `grid/test/audit-no-purge.test.ts` — NEW, historical entry retention.
- `grid/test/nous-deleted-zero-diff.test.ts` — NEW, SC#4 determinism.
- `brain/test/test_state_hash_rpc.py` — NEW, 4-hash tuple contract.
- `dashboard/src/components/primitives/irreversibility-dialog.test.tsx` — NEW primitive tests.
- `dashboard/src/app/grid/components/inspector-delete.test.tsx` — NEW wiring tests.
- `scripts/check-state-doc-sync.mjs` — 17→18 bump.

</code_context>

<specifics>
## Specific Ideas

- **`appendNousDeleted` sketch:**
  ```ts
  // grid/src/audit/append-nous-deleted.ts
  const HEX64 = /^[a-f0-9]{64}$/;
  const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

  export function appendNousDeleted(
      chain: AuditChain,
      operatorId: string,
      p: { target_did: string; pre_deletion_state_hash: string },
  ): void {
      if (typeof operatorId !== 'string' || operatorId.length === 0) {
          throw new TypeError('operator.nous_deleted: operator_id required');
      }
      if (!DID_RE.test(p.target_did)) {
          throw new TypeError('operator.nous_deleted: invalid target_did');
      }
      if (!HEX64.test(p.pre_deletion_state_hash)) {
          throw new TypeError('operator.nous_deleted: pre_deletion_state_hash must be 64-hex');
      }
      chain.append('operator.nous_deleted', operatorId, {
          tier: 'H5',
          action: 'delete',
          operator_id: operatorId,
          target_did: p.target_did,
          pre_deletion_state_hash: p.pre_deletion_state_hash,
      });
  }
  ```
- **Delete route sketch:**
  ```ts
  // grid/src/api/operator/delete-nous.ts
  app.post<{ Params: { did: string }; Body: OperatorBody }>(
      '/api/v1/operator/nous/:did/delete',
      async (req, reply) => {
          // 0. Env off-switch (D-32).
          if (process.env.NOESIS_GRID_DISABLE_H5 === '1') {
              reply.code(503);
              return { error: 'h5_disabled' };
          }
          // 1. Tier H5 + operator_id gate.
          const v = validateTierBody(req.body ?? {}, 'H5');
          if (!v.ok) { reply.code(400); return { error: v.error }; }
          // 2. DID shape.
          const targetDid = req.params.did;
          if (!DID_REGEX.test(targetDid)) { reply.code(400); return { error: 'invalid_did' }; }
          // 3. Tombstone check — re-deletion is a no-op 410, not a 404.
          const tc = tombstoneCheck(services.registry, targetDid);
          if (!tc.ok) { reply.code(410); return { error: 'nous_deleted', deleted_at_tick: tc.deletedAtTick }; }
          // 4. Runner lookup.
          const runner = services.getRunner?.(targetDid);
          if (!runner) { reply.code(404); return { error: 'unknown_nous' }; }
          // 5. Bridge health.
          if (!runner.connected || typeof runner.computePreDeletionStateHash !== 'function') {
              reply.code(503); return { error: 'brain_unavailable' };
          }
          // 6. Brain RPC.
          let components;
          try { components = await runner.computePreDeletionStateHash(); }
          catch (err) { reply.log.warn({err}, 'pre-deletion hash rpc failed'); reply.code(503); return { error: 'brain_unavailable' }; }
          // 7. Runtime guards on 4 hashes.
          for (const k of ['psyche_hash','thymos_hash','telos_hash','memory_stream_hash'] as const) {
              if (!HEX64_RE.test(components[k])) { reply.code(503); return { error: 'brain_unavailable' }; }
          }
          // 8. Compose.
          const record = services.registry.get(targetDid)!;
          const stateHash = combineStateHash({
              did: targetDid, ...components,
              ousia_balance: record.ousia, lifecycle_phase: record.lifecyclePhase,
              region: record.region, spawnedAtTick: record.spawnedAtTick,
          });
          // 9. Tombstone + map + runner teardown.
          services.registry.tombstone(targetDid, services.clock.currentTick);
          services.spatial.removeNous(targetDid);
          services.coordinator.despawnNous(targetDid);
          // 10. Audit.
          appendNousDeleted(services.audit, v.operator_id, {
              target_did: targetDid, pre_deletion_state_hash: stateHash,
          });
          return { ok: true, pre_deletion_state_hash: stateHash, deleted_at_tick: services.clock.currentTick };
      },
  );
  ```
- **`combineStateHash` canonical-JSON key order (LOCKED):**
  ```
  { did, psyche_hash, thymos_hash, telos_hash, memory_stream_hash,
    ousia_balance, lifecycle_phase, region, spawned_at_tick }
  ```
- **`NousRegistry.tombstone` sketch:**
  ```ts
  tombstone(did: string, tick: number): boolean {
      const record = this.records.get(did);
      if (!record || record.status === 'deleted') return false;
      record.status = 'deleted';
      record.deletedAtTick = tick;
      return true;
  }
  ```
- **`IrreversibilityDialog` sketch (core friction logic):**
  ```tsx
  export function IrreversibilityDialog({ targetDid, onConfirm, onCancel }: Props) {
      const [typed, setTyped] = useState('');
      const exact = typed === targetDid;
      return (
          <dialog ref={dialogRef} className="border-2 border-red-600 p-6 bg-neutral-950">
              <h2>Delete Nous — permanent</h2>
              <p className="text-red-500">
                  This is H5 Sovereign. Audit entries about this Nous will remain forever;
                  the Nous itself will not. There is no undo.
              </p>
              <label>To delete, type its DID exactly:</label>
              <code data-testid="irreversibility-target-did">{targetDid}</code>
              <input
                  type="text" autoComplete="off" spellCheck={false}
                  value={typed} onChange={(e) => setTyped(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  data-testid="irreversibility-did-input"
              />
              <button type="button" onClick={onCancel}>Cancel</button>
              <button type="button" disabled={!exact} onClick={onConfirm} className="text-red-500">
                  Delete forever
              </button>
          </dialog>
      );
  }
  ```
- **Zero-diff regression sketch:**
  ```ts
  it('SC#4: chain head identical 0 vs 10 listeners across delete sequence', async () => {
      const scenario = async (listeners: number) => {
          // spawn, 30 ticks of activity, delete at tick 40
          return headHash;
      };
      const a = await scenario(0), b = await scenario(10);
      expect(a).toBe(b);
  });
  ```
- **Tombstone-check helper sketch:**
  ```ts
  // grid/src/registry/tombstone-check.ts
  export function tombstoneCheck(registry: NousRegistry, did: string):
      | { ok: true }
      | { ok: false; deletedAtTick: number } {
      const r = registry.get(did);
      if (r && r.status === 'deleted') {
          return { ok: false, deletedAtTick: r.deletedAtTick ?? -1 };
      }
      return { ok: true };
  }
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Forensic plaintext vault** — encrypted plaintext snapshot keyed by `pre_deletion_state_hash`, gated behind H5+legal-hold. Deferred explicitly; v2.1 ships hash-only (D-29).
- **Undelete / resurrection** — tombstones are terminal. Future `BRAIN-RESTORE-01` could spawn a net-new Nous from an archived plaintext vault.
- **Bulk deletion / roster purge** — per-DID only in v2.1. Future `H5-BULK-01`.
- **Cross-grid deletion propagation** — single-grid scope; federation Milestone 5.
- **Dedicated "graveyard" dashboard tab** — firehose + audit chain are canonical history surfaces. Deferred UX.
- **Per-goal / per-component hash attribution in audit** — Grid composes components into one hash per D-07. Future phase could extend payload to include the 4 component hashes if forensic tooling needs them (additive).
- **Name-reuse after tombstone** — names reserved alongside DIDs (D-34). Future `NAME-REUSE-01` can revisit with operator-explicit unlock.
- **DID reuse after tombstone** — explicitly forbidden (D-33). First-life promise.
- **Audit-chain compaction / pruning** — explicitly forbidden (PHILOSOPHY §7). Deletion never purges audit.
- **Typing the Nous's name instead of DID** — rejected; DID is canonical (AGENCY-05 wording).
- **Feature-flag hiding H5 from UI** — rejected (D-31); violates visible-tier mandate.
- **H5 via Brain self-termination action** — rejected; only H5-elevated operator commits produce `operator.nous_deleted`.
- **Retroactive audit-entry attribution to a tombstoned record** — existing firehose replay already resolves by DID; no new "archived firehose" feed.
- **Cryptographic attestation that the operator typed the DID** — v2.1 single-operator trust model suffices; future hardening phase.

</deferred>

---

*Phase: 08-h5-sovereign-operations-nous-deletion*
*Context gathered: 2026-04-21*
*Mode: `--auto` — all 10 gray areas auto-resolved with recommended options.*
*Downstream: `/gsd-ui-phase 8 --auto` (UI hint = yes, `IrreversibilityDialog` primitive + Inspector wiring) then `/gsd-plan-phase 8 --auto`.*
