---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Steward Console — Phases 5-8
status: verifying
stopped_at: Phase 8 UI-SPEC approved
last_updated: "2026-04-21T11:04:47.582Z"
last_activity: 2026-04-21
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 15
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** The first persistent Grid where Nous actually live — observable, running continuously, with real cognitive cycles, real trades, and real social dynamics emerging from the systems.
**Current milestone:** v2.1 — Steward Console
**Current focus:** Phase 07 — peer-dialogue-telos-refinement

## Current Position

Phase: 07 (peer-dialogue-telos-refinement) — ✅ VERIFIED PASS (2026-04-21)
Plan: 4 of 4 (all shipped)
Plans shipped: 01, 02, 03, 04, 05, 06 (Phase 6 complete) + 07-01, 07-02, 07-03, 07-04 (Phase 7 complete + verified — DIALOG-01/02/03 closed).
Status: Phase 7 verified — ready to open Phase 8 (H5 Sovereign Operations — Nous Deletion).
Last activity: 2026-04-21

Progress: [██████████] 100% (15/15 plans — Phases 5, 6, 7 verified complete)

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

### Broadcast allowlist (Phase 7 — post-ship, Plan 07-03)

**17 events.** In code-tuple order (authoritative source: `grid/src/audit/broadcast-allowlist.ts` `ALLOWLIST_MEMBERS`):

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

Phantom `trade.countered` is NOT emitted and NOT allowlisted — never shipped in code, removed from this enumeration per D-11. If/when the full trade counter-offer handshake ships it earns its own allowlist slot in its own phase.

Regression gate: `scripts/check-state-doc-sync.mjs` asserts this enumeration matches the frozen 17-event invariant.

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
3. **H5 permission surface** — default-OFF feature flag vs default-ON behind irreversibility dialog? First-life promise suggests default-OFF. (Phase 8 plan)
4. **Dialog detection threshold semantics** — rolling ≥2 exchanges in N-tick window vs strict turn-taking (A→B→A→B)? Affects aggregator + dialogue_id generation. (Phase 7 plan)

## Session Continuity

Last session: 2026-04-21T11:04:47.577Z
Stopped at: Phase 8 UI-SPEC approved
Resume file: .planning/phases/08-h5-sovereign-operations-nous-deletion/08-UI-SPEC.md
Next action: Execute Plan 07-04 (Phase 7 closure — E2E integration, demo, doc-sync) via `/gsd-execute-plan`

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
