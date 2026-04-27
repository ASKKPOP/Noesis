---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Active)
status: verifying
stopped_at: Phase 13 UI-SPEC approved
last_updated: "2026-04-27T20:32:36.753Z"
last_activity: 2026-04-24 -- Phase 12 verified and complete
progress:
  total_phases: 11
  completed_phases: 5
  total_plans: 32
  completed_plans: 32
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** The first persistent Grid where Nous actually live — observable, running continuously, with real cognitive cycles, real trades, and real social dynamics emerging from the systems.
**Current milestone:** v2.2 — Living Grid (6 themes: Rich Inner Life, Relationships, Governance, Whisper, Observability, Researcher Tools)
**Current focus:** Phase 13 — operator-replay-export (next)

## Current Position

Phase: 12 (governance-collective-law) — COMPLETE ✅
Plan: 5 of 5
Status: Verified 25/25 — ready for Phase 13
Last activity: 2026-04-24 -- Phase 12 verified and complete

Progress: [█████░░░░░] 71% (5/7 v2.2 phases complete — Phase 9 + 10a + 10b + 11 + 12 shipped)

## Accumulated Context

### Carry-forward from v2.0

**v2.0 shipped state (2026-04-18):**

- grid 346/346 tests, brain 262/262 tests, dashboard 215/215 tests — all green
- Broadcast allowlist FROZEN (v2.0 baseline: 10 events, per `grid/src/audit/broadcast-allowlist.ts`): `nous.spawned`, `nous.moved`, `nous.spoke`, `nous.direct_message`, `trade.proposed`, `trade.settled`, `law.triggered`, `tick`, `grid.started`, `grid.stopped`. (Historical drift note: pre-Phase-5 STATE.md claimed 11 with phantom `trade.countered` — phantom event was never emitted, never in code; drift corrected 2026-04-20 per Phase 5 D-11.)
- AuditChain zero-diff invariant holds since Phase 1 commit `29c3516`
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` enforced at 3 entry points
- TradeRecord.timestamp contract: Unix **seconds** (`< 10_000_000_000`)
- Trade payload privacy: `{counterparty, amount, nonce}` only — no memory refs, no Telos
- Dashboard Docker: Next.js standalone output, multi-stage build, ARG→ENV→RUN npm build ordering locked (Pitfall 1)
- `/api/dash/health` is static — no cascading probe to Grid
- SC-6 live-stack smoke: runtime verification pending on operator machine per HUMAN-TEST-GUIDE.md

### v2.1 allowlist additions (planned — one per phase)

- Phase 5 adds: `trade.reviewed` ✅ shipped
- Phase 6 adds: `operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced` (5 events)
- Phase 7 adds: `telos.refined` (hash-only payload)
- Phase 8 adds: `operator.nous_deleted`

Total v2.1 allowlist growth: 8 events. Freeze-except-by-explicit-addition rule preserved.

### Broadcast allowlist (Phase 12 — post-ship, Plan 12-04)

**26 events.** In code-tuple order (authoritative source: `grid/src/audit/broadcast-allowlist.ts` `ALLOWLIST_MEMBERS`):

1. `nous.spawned`
2. `nous.moved`
3. `nous.spoke`
4. `nous.direct_message`
5. `trade.proposed`
6. `trade.reviewed` ← NEW in Phase 5 (REV-02)
7. `trade.settled`
8. `law.triggered`
9. `tick`
10. `grid.started`
11. `grid.stopped`
12. `operator.inspected` ← NEW in Phase 6 (AGENCY-02)
13. `operator.paused` ← NEW in Phase 6 (AGENCY-03)
14. `operator.resumed` ← NEW in Phase 6 (AGENCY-03)
15. `operator.law_changed` ← NEW in Phase 6 (AGENCY-03)
16. `operator.telos_forced` ← NEW in Phase 6 (AGENCY-03)
17. `telos.refined` ← NEW in Phase 7 (DIALOG-02) — hash-only autonomous Telos refinement from peer dialogue
18. `operator.nous_deleted` ← NEW in Phase 8 (AGENCY-05) — H5 Sovereign Operations, closed 5-key payload: {tier, action, operator_id, target_did, pre_deletion_state_hash}
19. `ananke.drive_crossed` ← NEW in Phase 10a (DRIVE-03) — hash-only drive threshold crossing; closed 5-key payload `{did, tick, drive, level, direction}` where `drive ∈ {hunger, curiosity, safety, boredom, loneliness}`, `level ∈ {low, med, high}`, `direction ∈ {rising, falling}`
20. `bios.birth` ← NEW in Phase 10b (BIOS-02) — Nous lifecycle open; closed 3-key payload `{did, tick, psyche_hash}`; sole producer `grid/src/bios/appendBiosBirth.ts` · Phase 10b
21. `bios.death` ← NEW in Phase 10b (BIOS-02/03) — Nous lifecycle close; closed 4-key payload `{did, tick, cause, final_state_hash}`; `cause ∈ {starvation, operator_h5, replay_boundary}`; sole producer `grid/src/bios/appendBiosDeath.ts` · Phase 10b
22. `nous.whispered` ← NEW in Phase 11 (WHISPER-04) — E2E-encrypted whisper audit; closed 4-key payload `{ciphertext_hash, from_did, tick, to_did}` (alphabetical order); sole producer `grid/src/whisper/appendNousWhispered.ts` · Phase 11
23. `proposal.opened` ← NEW in Phase 12 (VOTE-01 / D-12-01) — governance proposal creation; closed 6-key payload `{proposal_id, proposer_did, tick, title_hash, description_hash, vote_closes_at_tick}`; sole producer `grid/src/governance/appendProposalOpened.ts` · Phase 12
24. `ballot.committed` ← NEW in Phase 12 (VOTE-02 / D-12-01) — commit-reveal vote commitment; closed 3-key payload `{proposal_id, voter_did, commit_hash}`; sole producer `grid/src/governance/appendBallotCommitted.ts` · Phase 12
25. `ballot.revealed` ← NEW in Phase 12 (VOTE-03 / D-12-01) — commit-reveal vote reveal; closed 4-key payload `{proposal_id, voter_did, choice, nonce_hash}`; sole producer `grid/src/governance/appendBallotRevealed.ts` · Phase 12
26. `proposal.tallied` ← NEW in Phase 12 (VOTE-04 / D-12-01) — governance tally; closed 6-key payload `{proposal_id, outcome, votes_for, votes_against, votes_abstain, tick}`; `outcome ∈ {passed, failed, quorum_not_met}`; sole producer `grid/src/governance/appendProposalTallied.ts` · Phase 12

Phantom `trade.countered` is NOT emitted and NOT allowlisted — never shipped in code, removed from this enumeration per D-11. If/when the full trade counter-offer handshake ships it earns its own allowlist slot in its own phase.

Regression gate: `scripts/check-state-doc-sync.mjs` asserts this enumeration matches the frozen 26-event invariant.

### Research foundation for v2.1

- `.planning/research/stanford-peer-agent-patterns.md` — committed 9bb3046 (2026-04-20)
  - Agentic Reviewer (Zou, Stanford HAI) → objective-only ReviewerNous (Phase 5)
  - arxiv 2512.08296 multi-agent topologies → stay centralized, defer nous.whispered mesh to Sprint 16+ (WHISPER-01)
  - SPARC peer-dialogue pattern → telos.refined from exchanges (Phase 7)
  - arxiv 2506.06576 Human Agency Scale → H1–H5 operator UI (Phases 6, 8)

### Phase 5 ship decisions (D-01..D-13)

See `.planning/phases/05-reviewernous-objective-only-pre-commit-review/05-CONTEXT.md` for full rationale. Key locked invariants:

- **D-11** — STATE.md allowlist reconciliation: 11 events, phantom `trade.countered` purged, `nous.direct_message` explicit, `trade.reviewed` added (this plan 05-05).
- **D-12** — Trade privacy: `memoryRefs` + `telosHash` required on brain-side `trade_request` actions but NEVER leak to the broadcast payload.
- **D-13** — Zero-diff invariant: a 100-tick simulation with reviewer enabled produces byte-identical audit chain hashes to the same simulation with the reviewer bypassed, except for the added `trade.reviewed` entries.

### Phase 6 ship decisions (D-01..D-22)

See `.planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md` for full rationale. Key locked invariants:

- **D-01** — Per-operator client-side tier state: persisted in `localStorage['noesis.operator.tier']`; default `H1`; hydrated post-SSR via `<AgencyHydrator />`. SSR snapshot is LOCKED to `'H1'` (tearing-safe).
- **D-07** — Closure-capture race-safety (SC#4 / T-6-04): `useElevatedAction` captures `{ tier: targetTier, operator_id, ...payload }` as a JS literal BEFORE the first `await`. A mid-flight `agencyStore.setTier('H1')` cannot mutate the committed tier. Load-bearing line: `use-elevated-action.ts:95`.
- **D-08** — Native `<HTMLDialogElement>` + `showModal()` (no Radix/portal). Focus-trap is browser-native; `onClose` handles both Escape and programmatic close; `onConfirm` uses a `useRef` (not `useState`) to prevent stale-closure double-resolve.
- **D-11** — Closed-tuple operator payloads: `operator.law_changed` broadcasts `{tier, action, operator_id, law_id, change_type}` ONLY. Law body NEVER broadcast. Structural `Object.keys(payload).sort()` assertions in `governance.test.ts` fail loudly on any key drift.
- **D-12** — 40-case D-12 privacy enumerator (`grid/test/audit/operator-payload-privacy.test.ts`): 5 events × (6 forbidden keys + 1 nested + 1 happy) = 40 enumerated cases + 1 coverage assertion that `EVENT_SPECS` matches the broadcast allowlist membership.
- **D-13** — Tier-required producer boundary: `appendOperatorEvent(tier, eventType, payload, operatorId)` is the SOLE producer path for operator.* events. Any direct `auditChain.append({ eventType: 'operator.*', ... })` fails the Plan 01 producer-boundary gate.
- **D-15 / D-19** — Hash-only Telos payload: `operator.telos_forced` broadcasts `{tier, action, operator_id, target_did, telos_hash_before, telos_hash_after}` — NEVER plaintext goals. Python handler returns hashes only; grid handler enforces 64-hex regex on both hashes (contract-drift guard at RPC boundary).
- **D-17** — WorldClock pause/resume zero-diff: a paused-at-tick-50 simulation produces the SAME AuditChain head as a continuous run (regression hash `c7c49f49...` under FIXED_TIME=2026-01-01, 100 ticks, tickRateMs=1_000_000, ticksPerEpoch=25). Closes T-6-05 (chain-of-custody loss across pause).
- **D-20** — H5 hydration rejection + disabled affordance: `agencyStore.hydrateFromStorage()` whitelist is `{H1,H2,H3,H4}`; a tampered `localStorage['noesis.operator.tier'] = 'H5'` is silently rejected. The Inspector exposes the "Delete Nous" button as a visible-but-disabled affordance with `title="Requires Phase 8"` and `aria-disabled="true"` (first-life promise: irreversibility requires Phase 8's consent dialog).
- **D-22** — Doc-sync reconciliation extended: `scripts/check-state-doc-sync.mjs` asserts 16 events + 5 new operator.* members. Any future phase adding allowlist members must update the gate + STATE.md enumeration in the SAME commit (CLAUDE.md doc-sync rule).

### Open questions (to resolve in /gsd-discuss-phase per phase)

1. ~~**ReviewerNous deployment code placement**~~ — resolved in Phase 5: singleton registered at Grid startup, exposed via barrel `grid/src/review/`.
2. ~~**Agency Indicator persistence**~~ — resolved in Phase 6 D-01: per-operator client-side tier state in `localStorage` under `noesis.operator.tier`, default H1, hydrated client-side post-SSR via `<AgencyHydrator />`. Grid state remains tier-agnostic; tier arrives on the wire per-request in the operator.* body contract.
3. ~~**H5 permission surface**~~ — resolved in Phase 8 D-31: default-ON behind irreversibility dialog. No feature flag; `IrreversibilityDialog` paste-suppressed typed DID confirmation + verbatim warning copy IS the gate. `IrreversibilityDialog` copy frozen (D-04/D-05): warning text, title, button labels, DID label verbatim-locked in test assertions.
4. ~~**Dialog detection threshold semantics**~~ — resolved in Phase 7 D-27: rolling ≥2 exchanges in N-tick window (default 5). Strict turn-taking NOT required; any bidirectional pair utterances count. `DialogueAggregator` buffers by (sortedDids, channel) pair with `windowTicks` sliding window.

## Session Continuity

Last session: 2026-04-27T20:32:36.749Z
Stopped at: Phase 13 UI-SPEC approved
Resume file: .planning/phases/13-operator-replay-export/13-UI-SPEC.md
Next action: `/gsd-plan-phase 13`

## v2.2 Opening Context

**v2.2 Living Grid** — 6 themes, MVP depth per theme, Phase numbering continues from 8 (v2.2 Phase 9+).

**Themes (user-confirmed 2026-04-21):**

1. Rich Inner Life — Ananke (drives), Bios (bodily needs), Chronos (time-perception)
2. Relationship & Trust — persistent Nous↔Nous graph, reputation-weighted interactions
3. Governance & Law — voting primitives, proposal lifecycle, Nous-collective law enactment
4. Mesh Whisper — WHISPER-01 sidechannel (smallest-viable, not full mesh)
5. Operator Observability — replay/rewind/export on the 18-event audit chain
6. Observer / Researcher Tools — spawn-N-Nous rigs, 10,000+ tick runs, dataset export

**Archived phases:** v2.1 Phases 05–08 moved to `.planning/phases/archived/v2.1/`. v2.0 Phases 01–04 already in `.planning/phases/archived/v2.0/`.

**Hard v2.2 invariants (inherited, non-negotiable):**

- Broadcast allowlist frozen at 18 — grows ONLY by explicit per-phase addition. Every new event type requires sole-producer boundary + closed-tuple payload + privacy matrix + doc-sync regression update in the same commit.
- Zero-diff audit chain — every new listener (drives engine, relationship tracker, vote tallier, whisper subscriber, replay engine) is pure-observer. Listener count must not mutate chain hash.
- Hash-only cross-boundary — Brain↔Grid plaintext never crosses the wire for drives / needs / relationship memories / vote contents. Same discipline as Telos (Phase 6/7).
- Closed-tuple payloads — no spread operators, no dynamic keys; `Object.keys().sort()` strict-equality assertions on every new event.
- First-life promise — audit entries retained forever. No purge. Applies to tombstoned Nous (established v2.1 Phase 8) and now to all new event types.
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` — same at all entry points for new routes.
- Copy-verbatim pattern (established D-04/D-05) — any destructive/irreversible UX copy frozen in test assertions.

## Accumulated Context (Plan 06-02 additions)

- **Plan 06-02 shipped (2026-04-21):** dashboard `<AgencyIndicator />` mounted in root layout overlay (`fixed right-4 top-4 z-50`) — visible on every route, closing SC#1 at unit level. Tier chip reads from localStorage-backed `agencyStore` with SSR snapshot locked to `'H1'` per D-01. Full dashboard suite: 274/274 across 35 files.
- **D-20 hydration discipline:** `agencyStore.hydrateFromStorage()` whitelist is `{H1,H2,H3,H4}` — `H5` is explicitly rejected even if someone sets `localStorage['noesis.operator.tier'] = 'H5'`. H5 remains a disabled-affordance-only tier for Phase 8.
- **Dashboard type mirror pattern (second use):** `dashboard/src/lib/protocol/agency-types.ts` joins `audit-types.ts` as hand-copied dashboard mirrors of grid protocol types. SYNC header + drift-detector test (fs.readFileSync) in place. If a third mirror ships, consolidate into a shared package.
- **PHILOSOPHY §7 verbatim drift detector:** `tier-tooltip.test.tsx` inlines the 5 tier definition strings — any paraphrase of `TIER_DEFINITIONS` fails. Source of truth remains PHILOSOPHY.md lines 71–75.
- **Tooling gap (ecosystem):** Vitest 4.1 + jsdom ships empty `window.localStorage`; jest-dom matchers don't register under oxc JSX transform. Dashboard-wide convention is plain Chai + native DOM. Per-file Map-backed Storage polyfill pattern is the workaround.

## Accumulated Context (Plan 06-04 additions)

- **Plan 06-04 shipped (2026-04-21):** Grid-side H3 Partner endpoints + WorldClock pause/resume + LogosEngine.amendLaw. 5 Fastify operator endpoints live at `/api/v1/operator/clock/{pause,resume}` and `/api/v1/operator/governance/laws*`. Commits: b8c760f (engine primitives + zero-diff), d188671 (clock endpoints), 83ecde3 (governance CRUD + shared validator). Full Grid suite 491/491 (baseline 458 + 33 new).
- **Crown-jewel #2 locked:** WorldClock pause/resume preserves the AuditChain head across the pause boundary byte-for-byte. Regression hash: `c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461` (continuous == paused-at-50 with `FIXED_TIME=2026-01-01T00:00:00.000Z`, 100 ticks, `tickRateMs=1_000_000`, `ticksPerEpoch=25`). Closes T-6-05 (chain-of-custody loss across pause).
- **D-11 payload closure (T-6-06 closed):** `operator.law_changed` audit payload is a closed tuple `{tier, action, operator_id, law_id, change_type}` — law body NEVER broadcast. Structural `Object.keys(entry.payload).sort()` assertion in `governance.test.ts` Test 8 fails loudly if a future refactor adds any key.
- **Shared validator lives at `grid/src/api/operator/_validation.ts`:** `validateTierBody<T extends HumanAgencyTier>(body, expectedTier)` single-sources the D-14/D-15 body contract across all `/api/v1/operator/*` endpoints. Plan 05 (memory + telos operator routes) consumes the same helper unchanged.
- **Idempotency decided in HTTP handler, not WorldClock:** capture `isPaused` before/after the call; only emit audit event on a genuine state transition. Double-pause returns 200 but emits one audit entry. WorldClock itself stays simple (`pause()` short-circuits when `!this.timer`).

## Accumulated Context (Plan 06-05 additions)

- **Plan 06-05 shipped (2026-04-21):** H2 memory-query + H4 telos-force Fastify routes wired through the Plan 01 producer boundary. Commits: ecbc157 (Brain-bridge + Python handlers), 5361f56 (Fastify routes), 3f6d0ad (40-case payload-privacy matrix). Grid 538/538 (+47), brain 277/277 (+8).
- **Hash-only cross-boundary contract locked (D-19):** `operator.telos_forced` crosses the grid↔brain RPC boundary as `{telos_hash_before, telos_hash_after}` ONLY. Plaintext Telos never crosses the wire in either direction. Triple enforcement: Python handler return shape (`compute_active_telos_hash` is the sole hash authority) + grid handler payload literal + privacy-matrix `operator.telos_forced::rejects "*"` cases.
- **Contract-drift guard on hash shape:** `telos-force.ts` enforces `64-hex` regex on returned hashes at the grid boundary; a malformed hash from Brain returns 503 + no audit emit (Rule 2 auto-add during execution).
- **Array-shaped `new_telos` guard:** `typeof [] === 'object'` in JS, so `Array.isArray(x)` is an explicit precondition in the body validator (Rule 2 auto-add; covered by `telos.test.ts::Test 8`).

## Accumulated Context (Plan 06-06 additions)

- **Plan 06-06 shipped (2026-04-21):** Phase 6 closed. Playwright E2E spec pins SC#1/#4/#5 against the mock-grid fixture; doc-sync script bumped 11→16 events; STATE.md + README.md reconciled in a single atomic commit per CLAUDE.md doc-sync rule.
- **DASHBOARD_ROUTES for SC#1 coverage:** E2E spec pins `['/grid']` as the concrete top-level dashboard route. Home (`/`) 301-redirects to `/grid` (per `app/page.tsx`); `/grid/economy` is a component directory (not a Next.js route — no `page.tsx`). Plan 7+ that adds a true top-level route (e.g. `/telos`, `/operator`) MUST extend `DASHBOARD_ROUTES` in `agency.spec.ts` in the same commit to preserve SC#1 coverage.
- **Test-hook exposure pattern:** `window.__agencyStore` and `window.__testTriggerH4Force` are exposed ONLY when `NEXT_PUBLIC_E2E_TESTHOOKS === '1'`. Playwright config webServer.env sets this flag for test runs; production builds elide the branch via dead-code elimination. Grep-verifiable: `.next/static` never contains `__agencyStore` when built with the flag unset.
- **H5 Inspector affordance (SC#5):** Phase 6 Plan 02 & 03 did NOT land the visible-disabled "Delete Nous" button in the Inspector drawer — Plan 06-06 added it as a Rule 2 auto-fix. Testid is `inspector-h5-delete`; styling follows D-20 (line-through, neutral-600 text, `aria-disabled="true"`, `title="Requires Phase 8"`, `tabIndex={0}` so keyboard reaches it but no handler bound).
- **WCAG contrast human-verify:** Phase 6 terminates with a human-verify checkpoint surfacing tier-color contrast in the real dark theme (H2 #60A5FA, H3 #FCD34D, H4 #F87171 on neutral-950). Automation-only gates (SC#1/#4/#5 Playwright, 40-case payload privacy, zero-diff pause/resume) are all green; the human check covers what jsdom anti-aliasing cannot sample reliably.

## Accumulated Context (Plan 07-01 additions)

- **Plan 07-01 shipped (2026-04-21):** Grid-side DIALOG-01 satisfied. `DialogueAggregator` subscribes to `AuditChain.onAppend`, buffers `nous.spoke` events per bidirectional pair (keyed by `sortedDids.join('|')|channel`), and surfaces `DialogueContext` to both participants on their next `sendTick` when ≥`minExchanges` (default 2) bidirectional utterances land within `windowTicks` (default 5). Commits: `f13d015` (aggregator + dialogue_id + zero-diff), `edac3c8` (TickParams widening + BrainAction variant + recentDialogueIds seam), `1596a52` (launcher/coordinator wiring + pause-drain). Full grid suite 562/562 (baseline 538 + 24 new dialogue tests).
- **Zero-diff invariant extended (Phase 7):** 100 `nous.spoke` appends × 0 vs N listeners → byte-identical `entries[].eventHash` arrays. DialogueAggregator joins ReviewerNous as a pure-observer listener. Regression test: `grid/test/dialogue/zero-diff.test.ts`. Chain head remains stable across listener count (invariant unbroken since commit `29c3516`, Phase 1).
- **Delivery keyed per-(pair, did) not per-pair (D-26 correction):** a pair-level delivery marker would silently skip the second participant. Delivery map key is `${sortedDids.join('|')}|${channel}|${did}` — each participant receives the same `DialogueContext` exactly once on their own tick. Load-bearing line: `grid/src/dialogue/aggregator.ts` inside `drainPending()`.
- **drainPending does NOT prune (Phase 7 discipline):** windowing is enforced at INGEST time only (the `onAppend` listener prunes then pushes). Calling `pruneWindow()` inside `drainPending()` caused the "caps at 5" test to fail when drain happened many ticks after the last utterance (minTick > all buffered ticks → empty buffer). Rule: aggregator buffers are always window-valid at rest; drain simply matches against `minExchanges`.
- **Aggregator construction order locked:** `GenesisLauncher` constructor MUST construct `this.aggregator` AFTER `this.audit` — the `AuditChain.onAppend` listener binds to the specific instance the Grid uses. Reversing the order silently breaks delivery (listener attaches to a discarded instance). Comment-guarded in `grid/src/genesis/launcher.ts`.
- **TelosRefinedAction union extension ships WITHOUT handler (Plan 03 seam):** `BrainAction` gains the variant now so Plan 07-02 (Brain) can emit it without grid type errors. `NousRunner.actOn` has NO `case 'telos_refined':` branch — verified by `grep -rn "case 'telos_refined'" grid/src/integration/nous-runner.ts` returning only comment references. Handler lands in Plan 07-03.
- **recentDialogueIds is a 100-cap insertion-ordered Set on `NousRunner`:** FIFO eviction via `Set.values().next()`. No wall-clock, no tick-indexed cleanup. Plan 07-03's authority check reads the set to reject Brain-returned `telos_refined` actions whose `triggered_by_dialogue_id` was never delivered to this Nous (forgery prevention). Test accessor: `_recentDialogueIdsForTest: ReadonlySet<string>`.
- **Pause-drain producer boundary is `launcher.drainDialogueOnPause()`:** HTTP handler in `grid/src/api/operator/clock-pause-resume.ts` invokes `services.drainDialogueOnPause?.()` AFTER `services.clock.pause()`. Keeps `WorldClock` tier-agnostic and concentrates the drain call site in one testable place. Idempotent — re-invoking on an already-empty aggregator is a no-op. D-04 covered by `boundary.test.ts` Test 8.
- **Pull-query tick delivery with sequential reduction:** `GridCoordinator.onTick` calls `aggregator.drainPending(runner.nousDid, tick)` BEFORE `runner.tick(...)`. When a runner has multiple pending contexts, they are delivered via sequential `Promise.reduce` (one `runner.tick()` call per context) to preserve per-context reasoning ordering (D-11). Empty-array path short-circuits to the plain `runner.tick(tick, epoch)` call — no allocation overhead when no dialogue is pending.
- **Broadcast allowlist UNCHANGED at 16:** Plan 07-01 adds NO allowlist events. `telos.refined` addition lands in Plan 07-03. Freeze-except-by-explicit-addition rule preserved.
- **Pre-existing tsc errors deferred:** `grid/src/db/connection.ts:46` (mysql2.execute overload) and `grid/src/main.ts:73,75,76` (DatabaseConnection.fromConfig arity) pre-exist on master. Tests don't need tsc (vitest isolated transform). Logged to `.planning/phases/07-peer-dialogue-telos-refinement/deferred-items.md` for future maintenance plan.

## Accumulated Context (Plan 07-02 additions)

- **Plan 07-02 shipped (2026-04-21):** Brain-side DIALOG-02 satisfied. `ActionType.TELOS_REFINED = "telos_refined"` added; `BrainHandler.on_tick` additively consumes optional `dialogue_context: list[dict]` RPC param; `_build_refined_telos(ctx)` clones the Phase 6 `force_telos` hash-before/mutate/hash-after pattern. Commits: `5a2ddec` (RED — 18 failing tests + fixtures), `ba518d3` (GREEN — handler widening + helper). Full Brain suite 295/295 (baseline 277 + 18 new dialogue tests).
- **D-13 ActionType distinction locked:** `TELOS_REFINED` (Nous-initiated, autonomous peer-dialogue refinement) is a distinct enum value from `operator.telos_forced` (Phase 6 operator-driven). Both cross the RPC boundary hash-only; the distinction is preserved on the wire so Grid Plan 07-03 can apply the authority check (reject if `triggered_by_dialogue_id ∉ nous.recentDialogueIds`) to autonomous refinements only.
- **D-14 closed 3-key metadata tuple:** `telos_refined` action metadata is `{before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` ONLY — no `new_goals`, no `telos_yaml`, no `prompt`, no `reflection`. `FORBIDDEN_METADATA_KEYS = {new_goals, goals, telos_yaml, prompt, response, wiki, reflection, thought, emotion_delta}` enforced by `test_no_forbidden_plaintext_keys_in_metadata`. Set-equality assertion `set(md.keys()) == EXPECTED_METADATA_KEYS` fails loudly on any key drift.
- **D-18 Brain-side privacy gate (hash-only cross-boundary):** `compute_active_telos_hash(self.telos.all_goals())` is the SOLE hash authority, called BEFORE then AFTER the atomic `self.telos = rebuilt` swap. Plaintext goals NEVER cross the RPC boundary in either direction. Mirrors the Phase 6 D-15/D-19 hash-only contract established for `operator.telos_forced` in `handler.py:376`.
- **D-22 silent no-op discipline:** when `before_goal_hash == after_goal_hash` (e.g. heuristic produces the same goal set), `_build_refined_telos` returns `None` and no action is emitted. Empty refinements never reach the wire. Test enforcement: `test_no_op_refinement_returns_no_action`. Implication for test authoring: single-goal `["Survive the day"]` fixtures that only promote within `short_term` produce no hash change → tests requiring a refinement must use 2+ goals so bucket promotion (`short_term` → `medium_term`) mutates the canonical hash.
- **Malformed `dialogue_id` drops silently:** Brain validates `dialogue_id` is a 16-char string BEFORE computing any hashes. Invalid shapes (empty, wrong length, non-string, `None`) return `None` from `_build_refined_telos` — no NOOP, no error, just absence. Parametrized coverage: `test_malformed_dialogue_id_drops_silently` × 5 cases.
- **Additive widening preserves Phase 6 NOOP path:** absent `dialogue_context`, empty list, non-list (`"not a list"`), non-dict entries (`None, "string", 42`), and non-matching dialogues ALL fall through to the existing Phase 6 NOOP branch unchanged. `test_on_tick_without_dialogue_context_preserves_pre_phase7_behavior` is the additive-widening contract test — any regression of the pre-Phase-7 baseline fails this case first.
- **Deterministic substring heuristic (no LLM):** `_dialogue_driven_goal_set(ctx)` lowercases utterance text, searches for active goal description substrings in any utterance, promotes matched goals to `short_term` and demotes unmatched to `medium_term`. No LLM call, no non-determinism, no external state. Goal descriptions sourced EXCLUSIVELY from `self.telos.active_goals()` (mitigates T-07-16: utterance text NEVER becomes a goal description).
- **Test layout deviation (Rule 3):** plan specified `brain/tests/unit/*.py` + `brain/tests/fixtures/dialogue_contexts.py`. Actual Brain layout is flat `brain/test/` per `pyproject.toml` `testpaths = ["test"]`. Colocated new files under `brain/test/` with module name `dialogue_fixtures.py`; imports as `from test.dialogue_fixtures import ...`. Any future Brain TDD work follows this flat convention — do not reintroduce the subdirectory layout without also updating `pyproject.toml`.
- **Brain test fixture pattern:** `brain/test/dialogue_fixtures.py` exposes `make_dialogue_context(**overrides)` (well-formed, matches "Survive the day") and `make_dialogue_context_no_match()` (unrelated weather topic). Default `dialogue_id="a1b2c3d4e5f60718"` (16-hex). Pattern mirrors Grid-side `grid/test/dialogue/fixtures.ts` for cross-layer symmetry in future integration tests (Plan 07-03).
- **Broadcast allowlist UNCHANGED at 16:** Plan 07-02 is Brain-only — no Grid changes, no allowlist mutation, no audit emission. `telos.refined` allowlist addition lands in Plan 07-03 where the Grid handler wraps the action → audit event. Freeze-except-by-explicit-addition rule preserved.

## Accumulated Context (Plan 07-03 additions)

- **Plan 07-03 shipped (2026-04-21):** Grid-side DIALOG-02 satisfied. Broadcast allowlist bumped 16→17 with `telos.refined` at position 17 (hash-only autonomous Telos refinement from peer dialogue). `NousRunner.executeActions` gained a `case 'telos_refined':` branch that applies the `recentDialogueIds` authority check (forgery guard T-07-20), extracts the 3 metadata keys, and routes through the new sole-producer helper `appendTelosRefined`. Commits: `8f916a2` (RED — 3 new test files / 16 failing), `449cba8` (GREEN — allowlist 17 + producer helper + index exports; Rule 1 auto-fix of broadcast-allowlist.test.ts 16→17), `6350676` (RED — integration test / 2 failing), `97040b9` (GREEN — runner branch + import). Full grid suite 585/585 (baseline 562 + 23 new: 4 allowlist-seventeen + 10 telos-refined-privacy + 2 producer-boundary + 6 runner-branch + 1 existing-test bump).
- **Producer-boundary discipline (D-31 / Phase-6 clone):** `grid/src/audit/append-telos-refined.ts` is the SOLE file project-wide that calls `audit.append('telos.refined', ...)`. Enforcement: `grid/test/audit/telos-refined-producer-boundary.test.ts` greps all `grid/src/**` for the `chain.append[^;]{0,200}['"]telos\.refined['"]` pattern and fails if any file other than `audit/append-telos-refined.ts` matches. Mirrors the Phase 6 `appendOperatorEvent` contract-drift gate — future direct `audit.append(...)` regressions surface immediately in CI.
- **Closed 4-key payload tuple (D-20):** `telos.refined` payload is `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` ONLY. `appendTelosRefined` rejects any other key via `Object.keys(payload).sort()` strict-equality check. Explicit object reconstruction (no spread, no rest) guarantees no prototype pollution or accidental key leak. Leaky Brain metadata (e.g. `new_goals`, `prompt`, `response`) is silently dropped at the runner boundary — only the 3 metadata keys the runner extracts reach `appendTelosRefined`.
- **Self-report invariant (D-31):** `appendTelosRefined` enforces `payload.did === actorDid` — a Nous cannot announce someone else's Telos refinement. A mismatch throws `TypeError` at the producer boundary, preventing forged cross-DID audit entries even if a compromised runner somehow constructed one.
- **Regex lockdown at 3 shapes:** `DID_RE = /^did:noesis:[a-z0-9_\-]+$/i` (same regex as the 3 Phase 6 entry points), `HEX64_RE = /^[0-9a-f]{64}$/` (matches `grid/src/api/operator/_validation.ts`), `DIALOGUE_ID_RE = /^[0-9a-f]{16}$/` (truncated SHA-256 first-16-chars per Plan 07-01's `generateDialogueId` output). All three are re-exported from `grid/src/audit/index.ts` as `TELOS_REFINED_DID_RE`, `TELOS_REFINED_HEX64_RE`, `DIALOGUE_ID_RE` for downstream consumers.
- **Authority check (T-07-20 forgery guard):** `NousRunner.executeActions` case `'telos_refined'` rejects silently (no audit emit, no error log) if `action.metadata.triggered_by_dialogue_id ∉ this.recentDialogueIds`. A Brain that fabricates a `dialogue_id` it never received via `dialogue_context` produces zero audit side effects. Test coverage: `telos-refined-runner-branch.test.ts::"unknown dialogue_id drops silently — no audit entry"`. Ties together Plan 07-01's 100-cap `recentDialogueIds` Set with Plan 07-02's hash-only Brain emission — the dialogue_id round-trip is the cryptographic-style authority token.
- **Privacy belt-and-suspenders (D-21):** `appendTelosRefined` runs `payloadPrivacyCheck(cleanPayload)` as step 4, AFTER the closed-tuple check guarantees the payload only carries the 4 hash/DID/dialogue_id keys (natively privacy-clean). The gate is a regression check, not the primary defense — its purpose is to fail future edits that accidentally widen the payload shape. Privacy matrix `telos-refined-privacy.test.ts` proves the gate fires correctly on each of the 6 forbidden keywords (`prompt|response|wiki|reflection|thought|emotion_delta`) and on a nested case.
- **Silent-drop discipline at runner boundary:** Following Phase 5/6 precedent (transport-layer rejections for trade reviewer / operator endpoint validation), the `case 'telos_refined':` branch uses `try { appendTelosRefined(...) } catch { /* silent drop */ }` rather than logging. Rationale: the producer boundary's `TypeError` throws are regression-test signal (they should NEVER fire in shipped code), not operational errors. If they DO fire in production, the test suite has already broken — logging adds noise without actionable signal.
- **Zero-diff invariant UNBROKEN across Plan 07-03:** `case 'telos_refined'` emits at most ONE audit entry per action and only when the authority check passes. A simulation with Brain emitting `telos_refined` actions vs one with those actions stripped produces byte-identical chain hashes EXCEPT for the added `telos.refined` entries (structurally identical to Phase 5/6 zero-diff treatment). No side-effect on other listeners; DialogueAggregator does not react to `telos.refined` (it subscribes to `nous.spoke` only, per Plan 07-01).
- **`nous-runner.ts` has no logger import:** the Phase 6 runner branches (e.g. operator event routing) do NOT use a logger — they use silent break / comment semantics. Plan 07-03 follows the same convention. Rule: if a `telos_refined` action is malformed or forged, the drop is silent at the runner; the Brain-side emission path should already have produced a canonical action per Plan 07-02. No logger was introduced solely for this plan.
- **Test files colocated under `grid/test/audit/` and `grid/test/integration/`:** `allowlist-seventeen.test.ts` + `telos-refined-privacy.test.ts` + `telos-refined-producer-boundary.test.ts` live next to `broadcast-allowlist.test.ts` (same-domain co-location). `telos-refined-runner-branch.test.ts` lives under `grid/test/integration/` since it exercises the full NousRunner + AuditChain + fake Brain bridge. No tests moved from existing locations.
- **Rule 1 auto-fix of `broadcast-allowlist.test.ts`:** bumping `ALLOWLIST.size` 16→17 broke two Phase 6 assertions (`expect(ALLOWLIST.size).toBe(16)` at lines asserting frozen-tuple invariance). Auto-fixed by updating both literals to `17` and appending `'telos.refined'` to the `it.each` enumeration. Updated test-title comment to mention "Phase 5+Phase 6+Phase 7 event types" for ongoing traceability.
- **Broadcast allowlist NOW 17 events:** Freeze-except-by-explicit-addition rule preserved. Next scheduled addition: `operator.nous_deleted` in Phase 8 (H5 nous-delete consent dialog). No other allowlist additions pending across v2.1.

## Accumulated Context (Plan 08-03 additions)

- **Plan 08-03 shipped (2026-04-21):** Phase 8 (v2.1) dashboard AGENCY-05 complete. `IrreversibilityDialog` primitive (paste suppression + exact-match typed DID confirmation + verbatim warning copy) + two-stage Inspector H5 delete flow (State A active / State B tombstoned / State C loading-or-error) + firehose destructive styling for `operator.nous_deleted` rows. Commits: `780e19a` (RED Task 1), `f1d3725` (GREEN Task 1), `3626443` (RED Task 2), `2bf57fc` (GREEN Task 2), `009b200` (RED Task 3), plus GREEN Task 3 (inspector + firehose-row).
- **D-31 — H5 default-ON behind IrreversibilityDialog (Phase 8 design decision):** No feature flag required. The `IrreversibilityDialog` itself is the irreversibility gate: paste-suppressed input forces the operator to manually type the target DID exactly (substring-check rejected), verbatim warning copy locked by test assertions (D-04/D-05). H5 hydration rejection (`agencyStore.hydrateFromStorage` whitelist `{H1,H2,H3,H4}`) remains a regression pin — H5 cannot be set from localStorage; it can only be set programmatically via `onElevationConfirm` in the two-stage Inspector flow.
- **IrreversibilityDialog copy frozen (D-04/D-05 verbatim-lock):** `WARNING_COPY`, `TITLE_COPY`, `DELETE_LABEL = 'Delete forever'`, `CANCEL_LABEL = 'Keep this Nous'`, DID input label — all pinned verbatim in `irreversibility-dialog.test.tsx` assertions. Any paraphrase fails. Copy source of truth: `dashboard/src/components/agency/irreversibility-dialog.tsx` constants.
- **Closure-capture D-22 applied to IrreversibilityDialog:** `capturedDidRef.current = targetDid` at dialog-open time (inside the `useEffect([open])` that calls `showModal()`). The confirm handler reads from `capturedDidRef.current`, not `targetDid` prop, preventing stale-closure race if Inspector selection changes while dialog is open (mirrors Phase 6 D-07 `useElevatedAction` closure-capture pattern).
- **Auto-downgrade H5→H1 on all close paths:** `onIrrevCancel` clears `irrevOpen` AND calls `agencyStore.setTier('H1')`. All 4 close paths (cancel button, Escape key, backdrop click, ESC via native `<dialog>` close event) funnel through the same `onCancel` prop. The `close` event listener on the native dialog element is the unified close handler.
- **Firehose destructive styling (Phase 8):** `operator.nous_deleted` rows receive `border-l-2 border-rose-900` left accent on the `<li>`, `bg-rose-900/20 text-rose-300` on the event-type badge, and `text-red-400 line-through` on the actor column. Non-deleted event types are a strict regression guard (FR-8 test). `data-testid="firehose-actor"` added to actor span for test selectability.
- **Inspector conditional rendering pattern:** `{irrevOpen && <IrreversibilityDialog .../>}` — dialog fully unmounts on close so `queryByTestId('irrev-dialog')` returns `null` post-cancel. Same pattern for `{elevationOpen && <ElevationDialog .../>}`. Avoids the "hidden `<dialog>` still in DOM" failure mode from jsdom's open-attribute approach.
- **Toast auto-dismiss (4s) via useEffect cleanup:** `showToast(message)` sets `{message, id: Date.now()}`, a `useEffect([toast])` schedules `setTimeout(4000)` and returns the clearTimeout as cleanup. `data-testid="inspector-toast"` visible during the window; cleared when Inspector unmounts or a new toast displaces the old one.
- **`inlineError` scoped to irrevOpen:** `inlineError` is only rendered when `inlineError && irrevOpen` — prevents stale error text leaking into the Inspector after the dialog closes. Inline error `data-testid="inspector-inline-error"` sits inside `<IrreversibilityDialog>` (passed as a prop or rendered adjacent in the flow).

## Accumulated Context (Phase 9 opening — /gsd-discuss-phase --auto)

- **Phase 9 context gathered (2026-04-21):** `/gsd-discuss-phase 9 --auto` resolved 13 gray areas in single pass. See `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` (D-9-01..D-9-13) + `09-DISCUSSION-LOG.md` audit trail. Next: `/gsd-plan-phase 9 --auto`.
- **D-9-01 — τ = 1000 ticks default (ROADMAP Open Question #1 closed):** Half-life ≈ 693 ticks, 3τ cool-down ≈ 3000 ticks. Balances "unobserved relationships cool over realistic researcher-rig horizon" against replay determinism. Exposed as `relationship.decay_tau_ticks` per-Grid config. Lazy decay at READ time (`weight × exp(-Δtick / τ)`) — no per-tick sweep, preserves O(edges_touched_this_tick) budget.
- **D-9-02 — Deterministic event-class valence mapping (plaintext NEVER crosses boundary):** Closed bump table: `trade.settled +0.10`, `trade.reviewed(rejected) -0.10`, `nous.spoke (bidirectional) +0.01`, `telos.refined (matching participants) +0.05`. Clamped to `[-1, +1]`. Valence derived FROM existing audit events; NOT from utterance text (rejects sentiment analysis). Constants frozen in `grid/src/relationships/config.ts`.
- **D-9-03 — Storage: in-memory Map + MySQL snapshot every 100 ticks + rebuild-from-chain on restart:** Clones `grid/src/db/persistent-chain.ts` snapshot cadence. Idempotent rebuild gives correctness; snapshot gives fast restart. Migration `sql/009_relationships.sql`.
- **D-9-04 — Listener construction order:** `RelationshipListener` constructed AFTER `this.aggregator` in `GenesisLauncher` (same pattern as Phase 7 D-26). Zero-diff test clones `grid/test/dialogue/zero-diff.test.ts`.
- **D-9-05 — Sole-producer grep gate (two-file writer):** `grid/src/relationships/listener.ts` = only in-memory Map mutator; `grid/src/relationships/storage.ts` = only MySQL writer. Clones Phase 6 D-13 `appendOperatorEvent` producer-boundary discipline. Test: `grid/test/audit/relationship-sole-producer.test.ts`.
- **D-9-06 — Tier-graded privacy surface (3 endpoint variants, ZERO new allowlist members):** `/api/v1/relationships/:did?tier=H1` returns bucketed warmth (cold/warm/hot); `?tier=H2` returns numeric `{valence, weight}`; `?tier=H5` returns raw edge-events. Audits via existing `operator.inspected` (Phase 6) — no allowlist growth. Mitigates T-09-07 plaintext-trust-score risk.
- **D-9-07 — Top-N = 5 default, cap 20, useSWR batching:** Matches ROADMAP success criterion #4 (`top=5`). Mitigates T-09-11 N+1 fetching from dashboard Inspector.
- **D-9-08 — Vanilla SVG graph view, deterministic seeded layout (NO new runtime deps):** Grep gate forbids `d3-force|react-force-graph|cytoscape|graphology` imports under `dashboard/src/components/relationships/**`. Upholds v2.2 "no new runtime deps" discipline.
- **D-9-09 — Performance: O(edges_touched_this_tick) + weekly 10K-edge p95 <100ms CI bench:** Lazy decay at read. `grid/test/relationships/load-10k.test.ts` runs weekly (matching Phase 8 perf-bench cadence). Closes ROADMAP success criterion #3.
- **D-9-10 — Canonical edge serialization (Phase 8 D-07 pattern):** 6-key order `{from_did, to_did, valence, weight, recency_tick, last_event_hash}`, 3-decimal fixed-point floats (`valence.toFixed(3)`, `weight.toFixed(3)`), SHA-256 over the concatenated UTF-8 string. Enables rebuild-from-chain idempotency check.
- **D-9-11 — Self-loop silent-reject at listener boundary (T-09-08 mitigation):** `from_did === to_did` events are silently dropped (no throw, no emit, no edge created). Mirrors Phase 7 D-21 silent-drop discipline. Test: `grid/test/relationships/self-edge-rejection.test.ts`.
- **D-9-12 — Wall-clock grep ban in `grid/src/relationships/**`:** Forbids `Date.now|performance.now|setInterval|setTimeout|Math.random`. Clones Phase 7 `dialogue-determinism-source.test.ts`. Relationships reads `currentTick` from the onAppend entry only. T-09-09 port mitigation.
- **D-9-13 — Zero new allowlist members (HARD INVARIANT, confirmed by ROADMAP SC#5):** Broadcast allowlist stays at 18. `relationship.warmed|cooled` deferred to REL-EMIT-01. `scripts/check-state-doc-sync.mjs` unchanged. Test: `grid/test/relationships/no-audit-emit.test.ts` asserts chain length unchanged by listener.

## Accumulated Context (Plan 10a-05 additions)

- **Plan 10a-05 shipped (2026-04-22):** Dashboard Drives panel live. `AnankeSection` renders 5 rows in locked order (hunger, curiosity, safety, boredom, loneliness) between `<ThymosSection>` and `<TelosSection>` in the Inspector Overview tabpanel. Zero new RPC, zero new `NousStateResponse` fields, zero wall-clock, zero timers, zero animation. Commits: `688670a` (RED Task 1 — 11 failing tests), `4494eb9` (GREEN Task 1 — SYNC mirror + hook, 11/11 green), `bbbfb27` (RED Task 2 — AnankeSection + privacy tests), `e7e32d1` (GREEN Task 2 — AnankeSection + Inspector mount), `1714f8e` (section-order regression). Full dashboard suite 517/517 across 53 test files (baseline 434 + 82 new Ananke tests + 1 section-order).
- **DRIVE-05 render-surface contract (6 enforcement gates):**
  1. Privacy grep on rendered DOM (`drive-forbidden-keys-dashboard.test.tsx`): no `/0\.[0-9]+/` in `container.innerHTML`, no `title=` attr, no `data-value=`, no `data-drive-raw=`.
  2. NousStateResponse shape grep: `dashboard/src/lib/api/introspect.ts` asserted free of any drive property key (`hunger:`, `curiosity:`, …).
  3. Wall-clock grep in Ananke source: `setTimeout|setInterval|requestAnimationFrame|Date.now|performance.now` forbidden in `inspector-sections/ananke.tsx` + `hooks/use-ananke-levels.ts`.
  4. 45-state aria-label matrix: `{drive} level {level}` or `{drive} level {level}, {direction}` — no other template variants allowed (5 drives × 3 levels × 3 directions).
  5. Drift detector (`ananke-types.drift.test.ts`): parses `brain/src/noesis_brain/ananke/config.py` at test time, bucketizes each float with `bucketFromLow(v)` (hysteresis-aware bucket starting from LOW: threshold 0.35, rise threshold 0.68), asserts mirror matches.
  6. SYNC-header discipline: `dashboard/src/lib/protocol/ananke-types.ts` carries 3 `SYNC: mirrors` pointer comments (Brain types.py, Brain config.py, Grid ananke/types.ts). Drift test asserts ≥2.
- **Locked UI contract (verbatim from 10a-UI-SPEC):** `DRIVE_ORDER = ['hunger', 'curiosity', 'safety', 'boredom', 'loneliness']`. Glyphs: `⊘ ✦ ◆ ◯ ❍` (U+2298, U+2726, U+25C6, U+25EF, U+274D — Unicode escape syntax in source, not literal glyphs). Palette: `bg-neutral-400|amber-400|rose-400` + matching `text-*` classes. Direction arrows: `↑` U+2191 rising, `↓` U+2193 falling, none if stable. Baseline bucketed map: hunger=low, curiosity=med, safety=low, boredom=med, loneliness=med. **NO** baseline floats (0.3/0.5/0.2/0.4) appear in executable dashboard code — documentation block only.
- **Hook pattern clone:** `use-ananke-levels.ts` clones `use-refined-telos-history.ts` — `useFirehose()` → filter by `(actorDid === did) && (eventType === 'ananke.drive_crossed')` → `useMemo` keyed on `(snap.entries, did)` → walks chronologically so the latest crossing per drive wins → `Map<DriveName, {level, direction}>` return. Shape-guard `isAnankeCrossingPayload(entry.payload)` before unpacking; malformed payloads silently ignored.
- **Test-harness mock pattern (Phase 7+9 clone):** Inspector renders AnankeSection unconditionally, so every Inspector test harness must mock `useAnankeLevels` at the module level (identical to the Phase 7 `use-refined-telos-history` mock and Phase 9 `use-relationships` + `tick-store` mocks). Applied to `inspector.test.tsx` AND `delete-flow.test.tsx`. Any future Inspector integration test adding `<Inspector />` must add this mock or wrap in a `StoresProvider`.
- **Rule 1 pre-existing fix in delete-flow.test.tsx:** The 3 delete-flow integration tests were failing on Phase-9 `use-relationships` + `tick-store` `StoresProvider` requirement BEFORE my Task 2 changes (verified via stash). Closed the gap here by adding Phase-9 mocks — not strictly required for 10a-05 but cheap to fix when touching the file for Phase 10a anyway. delete-flow now 3/3 green.
- **Rule 3 Vitest include extension:** `dashboard/vitest.config.ts` `include` was `src/**/*.{test,spec}.{ts,tsx}`. Plan put drift detector + privacy grep under `dashboard/test/`, which Vitest silently skipped. Extended to `['src/**', 'test/**']`. Any future dashboard test file under `dashboard/test/**` will now be picked up automatically.
- **Broadcast allowlist UNCHANGED at 19:** Plan 10a-05 is dashboard-only consumer. No new events. Allowlist position 19 is still `ananke.drive_crossed` (added in Plan 10a-02). Freeze-except-by-explicit-addition rule preserved.

## Accumulated Context (Phase 10a — Ananke drives shipped)

- **Phase 10a shipped (2026-04-22):** Five drives (hunger, curiosity, safety, boredom, loneliness) run deterministically in the Brain; `ananke.drive_crossed` is the 19th allowlisted event, carrying closed 5-key payload `{did, tick, drive, level, direction}`. Plans 10a-01 through 10a-06. Full Brain + Grid + Dashboard suites green.
- **Broadcast allowlist now 21 events** (Phase 10b added `bios.birth` at position 20 and `bios.death` at position 21 per D-10b-01). Freeze-except-by-explicit-addition rule preserved. Next scheduled addition: `nous.whispered` in Phase 11.
- **Drive-baseline mirror contract:** Dashboard renders baseline levels as a second row mirroring the current drive row. Baselines bucketed via `bucket(baseline, DriveLevel.LOW)` — hunger→low, curiosity→med, safety→low, boredom→med, loneliness→med. These are hardcoded visual constants; not read from Brain over the wire.
- **3-keys-not-5 invariant (D-10a-XX):** Brain returns `ActionType.DRIVE_CROSSED` with metadata `{drive, level, direction}` (3 keys). Grid dispatcher injects `{did, tick}` at the producer boundary to compose the 5-key closed-tuple payload. Clones Phase 7 D-14 pattern (Brain returns hash-only metadata; Grid composes the full payload).
- **T-09-01 audit-size ceiling locked:** 1000 ticks × 5 drives × 1 Nous ≤50 `ananke.drive_crossed` entries. Regression test: `grid/test/audit/audit-size-ceiling-ananke.test.ts`. Expected count ~10 (2 crossings/drive × 5); ×5 margin for oscillation near threshold.
- **T-09-02 plaintext-drive-leak defense — three-tier grep:** (1) Grid emitter privacy matrix forbids `hunger|curiosity|safety|boredom|loneliness|drive_value` flat + nested; (2) Brain wire-side asserts only `{drive, level, direction}` cross the RPC boundary (no raw floats); (3) Dashboard render-side asserts no `/0\.[0-9]+/` text nodes and no `data-value`/`title` numeric attributes.
- **T-09-03 wall-clock-coupling defense:** grep gates in `brain/test/test_ananke_no_walltime.py` and `grid/test/ci/ananke-no-walltime.test.ts` forbid `Date.now|performance.now|setInterval|setTimeout|Math.random|time.time|datetime.now|datetime.utcnow|random.random|uuid.uuid4` in either ananke source tree. Drive math consumes tick deltas only.
- **DECAY_FACTOR locked:** `math.exp(-1/TAU)` with `TAU=500`, computed ONCE at module load in `brain/src/noesis_brain/ananke/config.py`. No per-step recomputation. Rise rates (hunger=0.0003, curiosity=0.0002, safety=0.0001, boredom=0.0002, loneliness=0.0002) calibrated for 10,000-tick RIG runs to produce 2-3 crossings/drive.
- **Hysteresis band ±0.02:** level buckets don't flap across threshold (0.33/0.66) boundary. `bucket(value, previous_level)` returns the previous level if value is within band of the threshold; only crossing the band boundary returns a new level. Enforced in `brain/src/noesis_brain/ananke/drives.py::bucket`.
- **Advisory drive→action coupling (PHILOSOPHY §6 preserved):** handler logs divergence to Brain's private wiki when e.g. a high-hunger Nous chooses SPEAK instead of MOVE. The log is side-effect-only; MUST NOT mutate the chosen actions list. Grep-verifiable in `brain/src/noesis_brain/rpc/handler.py::_advisory_log_divergence`.
- **Drive-float-never-crosses-wire invariant:** Brain-side `CrossingEvent` carries `(drive, level, direction)` only — never the raw float. Implicit extension of PHILOSOPHY §1 hash-only cross-boundary; made explicit for Phase 10b Bios so bodily-need floats NEVER cross either.
- **AnankeRuntime constructor-time seeding:** per-Nous seed derived SHA256(did)[:8] at `_get_or_create_ananke`. Same DID always produces same seed; deterministic replay guaranteed.
- **Dashboard type mirror pattern (third use):** `dashboard/src/lib/protocol/ananke-types.ts` joins `audit-types.ts` and `agency-types.ts`. SYNC header + drift-detector test reads `brain/src/noesis_brain/ananke/config.py` constants. When a fourth mirror ships (likely Phase 11 whisper), consolidate into a shared `@noesis/protocol-types` package.
- **Zero-diff invariant extended to Phase 10a:** listener count with/without AnankeLoader wiring produces byte-identical `eventHash` sequences modulo the added `ananke.drive_crossed` entries. Regression test: `grid/test/audit/zero-diff-ananke.test.ts` (Plan 10a-06). Invariant unbroken since Phase 1 commit `29c3516`.
- **Plan 10a-06 shipped (2026-04-22):** Phase 10a closed. Task 1 landed 3 regression tests (zero-diff, audit-size ceiling, wall-clock grep gates Brain+Grid) + doc-sync script bump 18→19. Commit `7c6c794`. Task 2 human-verify checkpoint approved 2026-04-22 (standard Unicode BMP glyphs trusted: U+2298, U+2726, U+25C6, U+25EF, U+274D, U+2191, U+2193). Task 3 executed the CLAUDE.md Doc-Sync Rule: ROADMAP, STATE, MILESTONES, PROJECT, README updated atomically.

## Accumulated Context (Phase 10b — Bios Needs + Chronos Subjective Time — shipped 2026-04-22)

- **Phase 10b shipped (2026-04-22):** BIOS-01..04, CHRONOS-01..03 (7 REQs). 8 plans across 4 waves. Allowlist 19→21 with `bios.birth` (pos 20) + `bios.death` (pos 21) per D-10b-01 correction.
- **D-10b-01 (allowlist correction):** ROADMAP originally claimed "Phase 10b: Allowlist additions: 0" assuming bios.birth/bios.death existed in v2.1. They did not. Authoritative source (`grid/src/audit/broadcast-allowlist.ts`) confirmed 19 entries at Phase 10b open. Phase 10b adds exactly +2. Running total: 19→21. This doc-sync plan (10b-08) corrects all source-of-truth files.
- **Bios→Ananke elevator (D-10b-02):** energy→hunger, sustenance→safety. Once per threshold crossing, not every tick. Elevation raises matching drive level by one bucket; if already `high`, no-op. No new broadcast event — surfaces only via existing `ananke.drive_crossed`.
- **BIOS_FORBIDDEN_KEYS** = `{energy, sustenance, need_value, bios_value}` — forbidden across flat + nested render surfaces; three-tier grep (Grid emitter, Brain wire, Dashboard render). Clone of D-10a-07.
- **CHRONOS_FORBIDDEN_KEYS** = `{subjective_multiplier, chronos_multiplier, subjective_tick}` — Chronos is Brain-local read-side only; multiplier NEVER crosses the wire.
- **No wall-clock in Bios/Chronos/retrieval — enforced by `scripts/check-wallclock-forbidden.mjs`** (CI gate added in Plan 10b-07). Two-tier pattern: bios/chronos dirs fully banned from datetime imports (Tier A); retrieval.py banned from calling datetime.now() — type annotations allowed (Tier B).
- **audit_tick === system_tick** — enforced by 1000-tick integration test (`grid/test/integration/audit-tick-system-tick-drift-1000.test.ts`). Subjective-time multiplier NEVER influences audit tick numbering.
- **Phase 10b audit-size ceiling (D-10b-10):** 1000 ticks × 1 Nous ≤ 53 total events (bios.birth + bios.death + ananke.drive_crossed combined). Regression test: `grid/test/ananke/audit-size-ceiling-10b.test.ts`.
- **ChronosListener** is a pure-observer (`grid/src/chronos/wire-listener.ts`) — subscribes to `bios.birth` via `AuditChain.onAppend`, tracks per-DID birth ticks, exposes `epochSinceSpawn(did, currentTick)`. Clones `DialogueAggregator` pure-observer discipline. Zero `append` calls.
- **bios.birth sole-producer:** `grid/src/bios/appendBiosBirth.ts`. Closed 3-key payload `{did, tick, psyche_hash}`. `psyche_hash` = Brain-computed hash of Psyche init vector (no Big Five floats on wire).
- **bios.death sole-producer:** `grid/src/bios/appendBiosDeath.ts`. Closed 4-key payload `{did, tick, cause, final_state_hash}`. `cause ∈ {starvation, operator_h5, replay_boundary}`.
- **D-30 extension (Phase 10b):** `delete-nous.ts` H5 handler extended — `appendBiosDeath({cause: 'operator_h5', ...})` emitted before `appendNousDeleted` in the same deletion sequence. `operator.nous_deleted` remains the H5-tier audit; `bios.death` is the lifecycle-layer complement.
- **Body↔mood separation sealed (T-09-05):** PHILOSOPHY §1 updated with subsection "Body, not mood — T-09-05 (sealed 2026-04-22, Phase 10b)". Bios = physical need pressure (body). Thymos = emotional state (mood) — explicitly out of scope in v2.2. Non-negotiable distinction.
- **Closed-enum allowlist gate confirmed:** `bios.resurrect`, `bios.migrate`, `bios.transfer` all fail at allowlist gate (tested in Phase 10b-07 integration suite). Death is terminal; DIDs permanently reserved.

## Accumulated Context (Phase 11 — Mesh Whisper — shipped 2026-04-23)

- **Phase 11 shipped (2026-04-23):** WHISPER-01..06 (6 REQs). 5 plans (11-00 through 11-04), 4 execution waves. Allowlist 21→22 with `nous.whispered` (pos 22) per D-11-00. Full grid 1121/1121, brain 498/498, dashboard Wave 4 30/30 tests green.
- **D-11-00 (nous.whispered allowlist addition):** `nous.whispered` is the 22nd allowlisted event. Closed 4-key alphabetical tuple `{ciphertext_hash, from_did, tick, to_did}`. Sole producer: `grid/src/whisper/appendNousWhispered.ts`. No plaintext crosses the wire — ciphertext_hash is a SHA-256 of the NaCl box output; plaintext never emitted to the audit chain.
- **WHISPER_FORBIDDEN_KEYS** = `{text, body, content, message, utterance, offer, amount, ousia, price, value, plaintext, decrypted, payload_plain}` — 13 keys permanently forbidden from whisper-scoped payloads. Enforced by three-tier CI gate (`scripts/check-whisper-plaintext.mjs`), runtime fs-guard test, and 16-case privacy matrix.
- **Three-tier CI gate (D-11-08):** `scripts/check-whisper-plaintext.mjs` scans Grid `whisper|envelope|mesh` paths, Brain `whisper|envelope|mesh` paths, and Dashboard `whisper|envelope|mesh` paths for forbidden-key property assignments. Keyring isolation check (D-11-04) verifies no `grid/src/**` TypeScript imports `brain/*/whisper/keyring`. Exits 0 on clean codebase; exits 1 on first violation.
- **Sole-producer boundary (D-11-06):** `appendNousWhispered()` is the ONLY caller of `audit.append('nous.whispered', ...)`. Producer-boundary test greps all `grid/src/**` for direct `chain.append` calls with `nous.whispered` and fails if any file other than `appendNousWhispered.ts` matches. Mirrors Phase 6/7 discipline.
- **Determinism invariant (D-11-13):** same `(whisperSeed, tick, counter)` → same `ciphertext_hash` regardless of `tickRateMs`. Wall-clock (`Date.now`, `Math.random`, `performance.now`) banned in all whisper paths. Regression: `whisper-determinism.test.ts` (3 runs, different tickRateMs → byte-identical tuples). Wall-clock grep gate: `scripts/check-wallclock-forbidden.mjs` (extended in Phase 10b).
- **Zero-diff invariant extended to Phase 11:** 0 vs N passive observers produce byte-identical `eventHash` arrays. `whisper-zero-diff.test.ts` validates with 3 observers (one hash collector, one no-op, one partial). Invariant unbroken since Phase 1 commit `29c3516`.
- **Keyring isolation (D-11-04):** `grid/src/whisper/keyring.ts` is the ONLY file that imports `brain/src/noesis_brain/whisper/keyring.py` data. No other `grid/src/**` file may import brain keyring material. CI enforced by `check-whisper-plaintext.mjs` keyring-isolation check.
- **Fourth protocol mirror (D-11-06):** `dashboard/src/lib/protocol/whisper-types.ts` is the fourth SYNC mirror (joins audit-types.ts, agency-types.ts, ananke-types.ts). Drift detector: `dashboard/test/lib/whisper-types.drift.test.ts` reads all three sources at test time. Note from D-11-16: consolidation into `@noesis/protocol-types` shared package is DEFERRED to Phase 12+.
- **Dashboard counts-only panel (WHISPER-02 / T-10-03):** `WhisperSection` renders `{sent, received, lastTick, topPartners}` only — zero `<button>`, zero `<a>` elements, zero inspect/decrypt affordance. `useWhisperCounts` hook derives counts from existing firehose via `useMemo`; zero new RPC. `ciphertext_hash` is NEVER extracted in hook or rendered in component.
- **WhisperStore ephemeral (D-11-15):** `whisperStore.ts` has no `localStorage` usage — counts are derived from live firehose, not persisted state. `subscribe/getSnapshot/notify` triad for React `useSyncExternalStore`.
- **Broadcast allowlist baseline update (SC#5):** `scripts/check-relationship-graph-deps.mjs` `ALLOWLIST_BASELINE_LINES` updated from 147 → 265 to reflect Phase 10b + Phase 11 additions. The D-9-13 "zero new allowlist members" invariant applied to Phase 9 only; Phases 10b and 11 made deliberate additions per their own CONTEXT.md decisions.
- **D-11-16 consolidation deferred:** shared `@noesis/protocol-types` package consolidating the four dashboard type mirrors is deferred to Phase 12+. The three-way manual mirror pattern (grid/brain/dashboard) is intentional until then. Tracked in `deferred-items.md`.
