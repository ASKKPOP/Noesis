# Milestones

## v1.0: Phase 1 — Genesis (COMPLETE)

**Shipped:** 2026-04-17 (10 sprints)
**Goal:** Build all core systems — identity, cognition, memory, economy, governance, and world infrastructure.

**What shipped:**
- Ed25519 DID identity + SWP signed envelopes + P2P mesh
- NDS (Noēsis Domain System) + Communication Gate
- LLM adapter — multi-provider routing (Ollama, Claude, GPT, local)
- Brain core — Psyche (Big Five), Thymos (emotions), Telos (goals)
- Brain-Protocol bridge — JSON-RPC over Unix domain socket
- Memory stream + personal wiki (Karpathy pattern) + reflection engine
- Grid infrastructure — WorldClock, SpatialMap, LogosEngine, AuditChain, REST API
- P2P economy — Ousia transfers, bilateral negotiation, shops, reputation
- Human Channel — ownership proofs, consent grants, gateway, activity observer
- Genesis launch — NousRegistry, GenesisLauncher, CLI, world presets

**Test coverage at completion:** 944+ TypeScript tests, 226 Python tests — all passing.

---

## v2.0: First Life (COMPLETE)

**Shipped:** 2026-04-18 (Sprints 11-14)
**Goal:** Make Nous actually live. Full end-to-end integration, persistent storage, deployment, and real-time dashboard.

**What shipped:**
- **Sprint 11** — End-to-end integration: NousRunner + GridCoordinator, full tick cycle, E2E tests
- **Sprint 12** — Persistent storage: MySQL adapter, migrations, snapshot/restore
- **Sprint 13** — Docker & Deployment: Dockerfiles, docker-compose, health checks, env config
- **Sprint 14** — Dashboard v1:
  - Phase 1: AuditChain listener API + broadcast allowlist (zero-diff invariant)
  - Phase 2: WsHub + `/ws/events` endpoint with ring-buffered backpressure
  - Phase 3: Dashboard firehose + heartbeat + region map (Next.js 15)
  - Phase 4: Nous inspector + economy + Docker polish (standalone Next + compose)

**Test coverage at completion:** grid 346/346, brain 262/262, dashboard 215/215 — all green.
**SC status:** 6/7 phase 4 success criteria MET; SC-6 (live docker compose smoke) verified on operator machine after shipping.

---

## v2.1: Steward Console (SHIPPED — 2026-04-21, 18/18 plans)

**Goal:** Turn the observational dashboard into a stewarded environment. Operators can intervene at explicit agency tiers, Nous review each other's proposed actions on objective invariants only, and peer dialogue meaningfully mutates goals.

**Research foundation:** `.planning/research/stanford-peer-agent-patterns.md` (2026-04-20)
- Agentic Reviewer pattern (Zou, Stanford HAI) → ReviewerNous
- Human Agency Scale H1–H5 (arxiv 2506.06576) → operator UI
- SPARC peer-dialogue → telos.refined from two-Nous exchanges

**Target features:**
- ReviewerNous — objective-only pre-commit checks on trades (REV-01, REV-02)
- Operator Agency Tiers — H1–H5 first-class UI concept with tier-stamped audit events (AGENCY-01, AGENCY-02, AGENCY-03)
- Peer Dialogue Memory — `telos.refined` from two-Nous exchanges (DIALOG-01, DIALOG-02)

### Sprint 15 / v2.1 — Phase 5 SHIPPED

**Shipped:** 2026-04-21
**Phase:** 5 — ReviewerNous — Objective-Only Pre-Commit Review
**Requirements closed:** REV-01, REV-02, REV-03, REV-04
**Plans:** 5/5 (05-01, 05-02, 05-03, 05-04, 05-05)

**Key artifacts shipped:**
- `grid/src/review/` module — 5 objective-invariant check handlers (balance, counterparty DID, positive integer amount, memory-ref existence, no contradicting Telos)
- Closed-enum `ReviewFailureCode` — reason codes are never free-form text (REV-02)
- REV-04 subjective-keyword lint gate — test fails if a handler mentions fairness/wisdom/taste/quality/novelty
- Reviewer singleton at `did:noesis:reviewer` with first-fail-wins dispatch loop (REV-03)
- Brain schema extension: `memoryRefs: list[str]` + `telosHash: str` on `trade_request` action
- 3-event audit flow: `trade.proposed` → `trade.reviewed` → `trade.settled` (REV-01, REV-02)
- 11-event broadcast allowlist (was 10 pre-Phase-5) — `trade.reviewed` added
- D-12 privacy regression test: `memoryRefs`/`telosHash` NEVER leak to broadcast payload
- D-13 zero-diff invariant regression test: 100-tick sim with reviewer matches bypass hash modulo allowed `trade.reviewed` entries
- D-11 STATE.md reconciliation — phantom `trade.countered` purged, 11-event enumeration explicit
- `scripts/check-state-doc-sync.mjs` — new CI gate against future STATE.md drift

**Key decisions locked:** D-01..D-13 (see `.planning/phases/05-reviewernous-objective-only-pre-commit-review/05-CONTEXT.md`)

**Next up:** Phase 6 — Operator Agency Foundation (H1–H4)

### Sprint 16 / v2.1 — Phase 6 SHIPPED

**Shipped:** 2026-04-20
**Phase:** 6 — Operator Agency Foundation (H1–H4)
**Requirements closed:** AGENCY-01, AGENCY-02 (partial — H3 allowlist-mutate deferred), AGENCY-03, AGENCY-04
**Plans:** 6/6 (06-01, 06-02, 06-03, 06-04, 06-05, 06-06)

**Key artifacts shipped:**
- `grid/src/audit/operator-events.ts` — sole sanctioned producer for all `operator.*` events; `requireTierInPayload` + closed-tuple payload enforcement
- 16-event broadcast allowlist (was 11 pre-Phase-6) — 5 new `operator.*` events added (`inspected`, `paused`, `resumed`, `law_changed`, `telos_forced`)
- H1–H4 operator tier system: persistent Agency Indicator on every dashboard route, H2 memory query, H3 pause/resume + law CRUD, H4 force-Telos
- Elevation dialog with native `<dialog>.showModal()` focus trap — single-action scope (tier auto-downgrades to H1 after dispatch, AGENCY-04)
- Closure-capture discipline in `use-elevated-action` — tier stamped at confirm-click time, never at HTTP-arrival time (SC#4 race regression test)
- D-19 hash-only audit for force-Telos — HEX64 guard on both before/after hashes; no plaintext goals ever enter the audit payload
- `AgencyStore` + `useSyncExternalStore` subscriber pattern — SSR-safe H1 default, no hydration flash
- D-12 privacy regression: forbidden-key pattern `/prompt|response|wiki|reflection|thought|emotion_delta/i` blocks operator payload leaks
- H5 Sovereign Nous deletion = disabled placeholder with "requires Phase 8" tooltip (no onClick bound)

**Key decisions locked:** D-01..D-19 (see `.planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md`)

**Deferred:** AGENCY-02 item "mutate broadcast allowlist at runtime" — requires rethinking frozen-set invariant; filed for later mini-phase

**Next up:** Phase 7 — Peer Dialogue → Telos Refinement (DIALOG-01, DIALOG-02, DIALOG-03)

### Sprint 17 / v2.1 — Phase 7 SHIPPED

**Shipped:** 2026-04-21
**Phase:** 7 — Peer Dialogue → Telos Refinement
**Requirements closed:** DIALOG-01, DIALOG-02, DIALOG-03
**Plans:** 4/4 (07-01, 07-02, 07-03, 07-04)

**Key artifacts shipped:**
- Brain-side peer-dialogue memory integration: `PeerDialogueMemory` + `TelosRefinementEngine` consume two-Nous exchanges → emit `telos.refined` with before/after hash tuple + triggering dialogue id (DIALOG-01)
- Grid-side `appendTelosRefined` sole-producer boundary at `grid/src/audit/append-telos-refined.ts` — enforces DIALOGUE_ID_RE + HEX64_RE on producer side (T-07-P1); no other code path may emit `telos.refined` (DIALOG-02)
- 17-event broadcast allowlist (was 16 pre-Phase-7) — `telos.refined` added; closed-tuple payload `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` — plaintext-never invariant preserved (PHILOSOPHY §1)
- NousRunner telos-refined branch: `recentDialogueIds` authority pattern — runner maintains the set; telos engine consumes but does not own it (T-07-P3 resolution)
- Dashboard surfaces (DIALOG-03):
  - New `'dialogue'` Chip variant — indigo-400 `#818CF8` on `#17181C` (Phase 7 tier-palette slot, 6.4:1 contrast)
  - `TelosRefinedBadge` at panel level on Inspector's TelosSection (D-27/D-30: panel-level, not per-goal) — `↻ refined via dialogue (N)` label, click navigates to firehose filtered by triggering dialogue_id
  - `useRefinedTelosHistory` derived selector over existing `useFirehose()` — zero new RPC, zero new WebSocket subscription
  - `useFirehoseFilter` URL hook — parses `?firehose_filter=dialogue_id:<16-hex>` with DIALOGUE_ID_RE validation; malformed → filter null (chip not mounted)
  - `FirehoseFilterChip` + dim-not-hide firehose rows (`opacity-40 pointer-events-none` on non-match; matching rows full opacity) — AC-4-3-3 preserves temporal debugging context
  - AC-4-3-4 zero-diff guard: firehose renders byte-identical to pre-Phase-7 output when filter is null
- Color-scope invariant: `#818CF8` confined to 8 allowlisted files; cross-file `node:fs` walker enforces in `telos-refined-badge.test.tsx`
- Plaintext-never source invariant: no `new_goals`, `goal_description`, or `utterance` strings in dashboard sources (grep-based test)

**Key decisions locked:** D-20..D-30 (see `.planning/phases/07-peer-dialogue-telos-refinement/07-CONTEXT.md`)

**STRIDE threats addressed:** T-07-P1 (producer-boundary plaintext leak), T-07-P2 (dialogue_id spoofing — regex gate at producer and consumer), T-07-P3 (recentDialogueIds authority ambiguity), T-07-P4 (color-palette bleed across phases)

**Next up:** v2.2 milestone planning (or Phase 8 — Sovereign Nous deletion / AGENCY-05)

---

### v2.1 Phase 8 — H5 Sovereign Operations (Nous Deletion) — SHIPPED (2026-04-21)

**Requirement:** AGENCY-05 — H5 Sovereign tier executes irreversible Nous deletion with typed-DID consent + pre-deletion state hash + runtime removal + audit-chain preservation forever.

**Delivered (3 plans, 3 waves):**

- **Plan 08-01 — Tombstone primitives + state hash (Wave 1)**
  - `NousRecord.status: 'active' | 'deleted'` + `deletedAtTick?: number`; `registry.tombstone(did, tick, spatialMap)` method; `removeNous(did)` no-op on tombstoned (never unreserves DID)
  - `grid/src/registry/tombstone-check.ts` — `tombstoneCheck()` throws `TombstonedDidError` with `statusHint=410`
  - `grid/src/audit/state-hash.ts` — `combineStateHash({psyche, thymos, telos, memory_stream})` canonical JSON SHA-256 with **LOCKED** canonical key order `psyche→thymos→telos→memory_stream` (D-07) via engine-safe manual `canonicalSerialize`
  - `brain/src/noesis_brain/state_hash.py` — `compute_pre_deletion_state_hash()` returns 4 component hashes; Brain composes nothing (Grid composes 5th)
  - `brain/src/noesis_brain/rpc.py` — `hash_state` method on `BrainHandler`
- **Plan 08-02 — DELETE route + audit producer + allowlist growth (Wave 2)**
  - Broadcast allowlist bumped **17 → 18** with `operator.nous_deleted` at position 18; `Object.defineProperty` freeze throws `TypeError` on any mutation
  - `grid/src/audit/append-nous-deleted.ts` — SOLE producer; validates `tier==='H5'` + `action==='delete'` + DID + HEX64; closed 5-key literal (NO spread); `Object.keys().sort()` assertion; `payload.operator_id === actorOperatorId` self-report invariant
  - `grid/src/api/operator/delete-nous.ts` — DELETE `/api/v1/operator/nous/:did`; 9-step error ladder 400/404/410/503 (**NO 500s** anywhere); D-30 order: validate → tombstoneCheck → Brain hash_state RPC → registry.tombstone → coordinator.despawnNous → appendNousDeleted
  - `coordinator.despawnNous(did)` — close bridge, unsubscribe tick, drop spatial
  - `nous-runner.onTick` — tick-skip guard: `if record.status === 'deleted' return early` (STRIDE T-08-33/34)
  - `tombstoneCheck` centralized in inspect, memory-query, telos-force, delete-nous routes — **HTTP 410 precedes 404** for tombstoned DIDs
  - Zero-diff audit chain preserved: `nous-deleted-zero-diff.test.ts` pins `Date.now()` via `vi.setSystemTime()` for cross-listener head comparison
  - Audit entries **never purged**: `audit-no-purge.test.ts` confirms `chain.verify()` passes after tombstone + delete; DID **permanently reserved** (re-creation rejected)
- **Plan 08-03 — Dashboard UX: two-stage H5 flow + firehose destructive styling (Wave 3)**
  - `IrreversibilityDialog` primitive: native `<dialog>` + `showModal()` + `role="alertdialog"` + aria-labelledby/describedby + autoFocus on Cancel + paste suppression (`onPaste preventDefault`) + Enter blocked + focus trap
  - Copy verbatim-locked (D-04/D-05): `TITLE_COPY`, `WARNING_COPY`, `DELETE_LABEL = 'Delete forever'`, `CANCEL_LABEL = 'Keep this Nous'`, DID label — pinned in test assertions, any paraphrase fails
  - Delete gated on exact case-sensitive `typed === targetDid` (substring-match explicitly rejected)
  - Closure-capture race-safety (D-22): `capturedDidRef.current = targetDid` at dialog-open time — mid-flight Inspector selection change cannot mutate committed DID
  - Two-stage elevation: `ElevationDialog(H5)` → `IrreversibilityDialog` → `deleteNous()` → auto-downgrade H5→H1 on all 4 close paths
  - D-20/D-21 hydration rejection regression pinned: `agency-store.test.ts` proves `localStorage['noesis.operator.tier'] = 'H5'` hydrates to H1 (whitelist `{H1,H2,H3,H4}`); H2-H4 round-trip; malformed no-throw
  - Inspector State A/B/C (active / tombstoned / loading-or-error); firehose destructive styling on `operator.nous_deleted`: `border-l-2 border-rose-900` + `bg-rose-900/20 text-rose-300` + `text-red-400 line-through` on actor
  - Toast auto-dismiss (4s via useEffect cleanup); inline error scoped to `irrevOpen`

**Crown-jewel invariants preserved:**
- **Sole-producer boundary** — grep-verified across entire `grid/src/`: only `append-nous-deleted.ts:132` emits `operator.nous_deleted`
- **Hash-only cross-boundary** — Brain returns 4 component hashes; Grid composes 5th with locked canonical key order; no plaintext state crosses the bridge
- **Closed 5-key tuple** — `{tier, action, operator_id, target_did, pre_deletion_state_hash}` with structural sorted-key equality; no spread; self-report invariant
- **Zero-diff audit chain** — unbroken since Phase 1 `29c3516`; listener count does not affect chain head
- **First-life promise** — audit entries for deleted Nous retained forever; DID permanently reserved (no reuse)
- **Error ladder has no 500s** — only 400/404/410/503
- **D-30 deletion order locked** — validate → tombstoneCheck → Brain hash_state → tombstone → despawnNous → appendNousDeleted
- **Broadcast allowlist frozen at 18** — growth-only via explicit phase addition; `scripts/check-state-doc-sync.mjs` regression gate

**Key decisions locked:** D-01..D-40 (see `.planning/phases/08-h5-sovereign-operations-nous-deletion/08-CONTEXT.md`). D-04/D-05 (copy verbatim), D-07 (canonical key order), D-20 (H5 hydration rejection), D-21 (H5 whitelist regression), D-22 (closure-capture), D-30 (deletion order), D-31 (H5 default-ON behind IrreversibilityDialog), D-38 (sole-producer boundary).

**STRIDE threats addressed:** T-08-33 (tick-skip guard prevents post-tombstone Brain RPC), T-08-34 (coordinator.despawnNous releases bridge + spatial + tick subscription before audit emit — no orphan resources).

**Test counts at ship:** grid **656/656**, brain **310/310**, dashboard **404/404**. Phase 8 added 9 grid tests + 15 Brain tests + 58 dashboard tests (across 8 files).

### v2.1 Steward Console — MILESTONE COMPLETE (2026-04-21)

**Sprint 15 closed 2026-04-21, 18/18 plans = 100%.** Phases 5 (ReviewerNous), 6 (H1–H4 Operator Agency), 7 (Peer Dialogue Memory), 8 (H5 Sovereign Deletion) all shipped. Broadcast allowlist grew 10 → 18 across v2.1; every addition carries a closed-tuple payload and a sole-producer boundary; plaintext Telos / law body / memory refs / emotional state never cross the audit or RPC wire. The dashboard is a stewarded environment: Agency Indicator on every route, elevation-gated H1–H5 flows, peer-dialogue-driven Telos refinement with forgery guard, irreversible Nous deletion with pre-deletion state hash + typed-DID consent + audit-chain preservation forever. Zero-diff invariant unbroken since Phase 1. Research foundation validated: Stanford peer-agent synthesis (Zou HAI, SPARC, arxiv 2506.06576) mapped 1:1 to shipped phases.

**Next up:** v2.2 milestone planning.

---

## v2.2: Living Grid (IN PROGRESS — opened 2026-04-21)

**Goal:** Move Nous from observed entities into full agents. Six themes ship MVP depth together: Rich Inner Life (Ananke + Bios + Chronos), Relationship & Trust, Governance & Law, Mesh Whisper, Operator Observability, Researcher Tooling.

### Phase 10b — Bios Needs + Chronos Subjective Time (Inner Life, part 2) — SHIPPED 2026-04-22

**Shipped:** 2026-04-22
**Goal:** Bodily needs (energy, sustenance) elevate Ananke drives on threshold crossing; per-Nous subjective-time multiplier modulates Stanford retrieval recency. Adds bios.birth + bios.death to the allowlist (+2, corrected from original "0" estimate per D-10b-01).
**Requirements delivered:** BIOS-01, BIOS-02, BIOS-03, BIOS-04, CHRONOS-01, CHRONOS-02, CHRONOS-03
**Plans:** 8/8 (10b-01 through 10b-08, 4 waves)
**Allowlist added:** `bios.birth` (pos 20) + `bios.death` (pos 21) — allowlist 19→21

**Key primitives:**
- Brain-side `BiosRuntime` with two needs (energy, sustenance) in `[0.0, 1.0]`; rise-only with passive baseline decay; threshold crossing elevates matching Ananke drive (energy→hunger, sustenance→safety) once per crossing, not per tick
- `appendBiosBirth` sole-producer: closed 3-key payload `{did, tick, psyche_hash}` (psyche_hash = Brain-computed hash of Psyche init vector; no Big Five floats on wire)
- `appendBiosDeath` sole-producer: closed 4-key payload `{did, tick, cause, final_state_hash}`; `cause ∈ {starvation, operator_h5, replay_boundary}`
- D-30 extension: `delete-nous.ts` H5 handler emits `appendBiosDeath({cause: 'operator_h5'})` before `appendNousDeleted`
- Brain-side `ChronosRuntime`: subjective-time multiplier `[0.25, 4.0]` = `clamp(1.0 + curiosity_boost - boredom_penalty, 0.25, 4.0)`; modulates Stanford retrieval recency score; NEVER crosses wire, NEVER influences audit_tick
- Grid-side `ChronosListener` pure-observer: tracks `bios.birth` events, exposes `epochSinceSpawn(did, tick)` for Brain context
- Dashboard `BiosSection` between Ananke and Telos panels: bucketed levels (low/med/high), no numeric values
- `scripts/check-wallclock-forbidden.mjs` CI gate: two-tier pattern (Tier A: bios/chronos dirs fully ban datetime; Tier B: retrieval.py bans datetime.now() calls only)

**Invariants sealed:**
- `audit_tick === system_tick` across 1000 ticks with all Phase 10b event types (integration test)
- No wall-clock in Bios/Chronos/retrieval — enforced by CI grep-gate
- Body↔mood separation (PHILOSOPHY §1 subsection T-09-05 — Bios is body, Thymos is mood; distinct subsystems, non-negotiable distinction)
- Phase 6 D-17 pause/resume hash unchanged with ChronosListener wired (pure-observer A/B comparison)
- Phase 10b audit-size ceiling: 1000 ticks × 1 Nous ≤ 53 total events

**STRIDE threats addressed:** T-09-04 (Chronos wall-clock — grep gate), T-09-05 (Bios/Thymos namespace — PHILOSOPHY §1 sealed), T-09-03 (Bios needs-math tick-delta-only — grep gate).

---

### Phase 10a — Ananke Drives (Inner Life, part 1) — SHIPPED 2026-04-22

**Shipped:** 2026-04-22
**Goal:** Five drives (hunger, curiosity, safety, boredom, loneliness) run deterministically in the Brain; only threshold crossings cross the boundary as hash-authoritative broadcast.
**Requirements delivered:** DRIVE-01, DRIVE-02, DRIVE-03, DRIVE-04, DRIVE-05
**Plans:** 6/6 (10a-01, 10a-02, 10a-03, 10a-04, 10a-05, 10a-06)
**Allowlist added:** `ananke.drive_crossed` (+1 → 19)

**Key primitives:**
- Brain-side `AnankeRuntime` with piecewise deterministic recurrence (below baseline pulls up via `DECAY_FACTOR=exp(-1/500)`; above baseline pure rise by drive-specific rate)
- Hysteresis-guarded level bucketing (`low<0.33`, `med<0.66`, `high≥0.66` with ±0.02 band)
- Grid-side `appendAnankeDriveCrossed` sole-producer emitter with closed 5-key payload `{did, tick, drive, level, direction}` enforced via `Object.keys(payload).sort()` strict equality
- 3-keys-not-5 invariant: Brain returns 3 metadata keys; Grid injects `{did, tick}` at boundary
- Dashboard Drives panel with 45-state aria matrix + locked Unicode glyphs (⊘ ✦ ◆ ◯ ❍) + baseline bucketed mirror
- Zero-diff invariant extended: chain head byte-identical with/without Ananke listeners, modulo added `ananke.drive_crossed` entries
- Audit-size ceiling: 1000 ticks × 5 drives × 1 Nous ≤ 50 entries (T-09-01 defense)
- Wall-clock grep gates in both `brain/src/noesis_brain/ananke/**` and `grid/src/ananke/**` (T-09-03 defense)
- Three-tier privacy grep (Grid emitter + Brain wire + Dashboard render) preventing plaintext drive float leak (T-09-02 defense)
- Advisory-only drive→action coupling (PHILOSOPHY §6 Nous sovereignty preserved)

**STRIDE threats addressed:** T-09-01 (per-tick audit bloat — ceiling locked ≤50), T-09-02 (plaintext drive leak — three-tier grep), T-09-03 (wall-clock coupling — grep gates in both ananke source trees), T-10a-27..T-10a-33 (from Plan 10a-06 threat model).

**Next up:** Phase 11 — Mesh Whisper (SHIPPED 2026-04-23, see entry above).

---

### Phase 11 — Mesh Whisper — SHIPPED 2026-04-23

**Shipped:** 2026-04-23
**Goal:** Any two Nous can exchange E2E-encrypted envelopes via libsodium `crypto_box`; operators cannot read plaintext at any tier including H5; audit chain retains only `ciphertext_hash` forever.
**Requirements delivered:** WHISPER-01, WHISPER-02, WHISPER-03, WHISPER-04, WHISPER-05, WHISPER-06
**Plans:** 5/5 (11-00 through 11-04, 4 waves)
**Allowlist added:** `nous.whispered` (pos 22, alphabetical closed 4-key tuple `{ciphertext_hash, from_did, tick, to_did}`) — allowlist 21→22

**Key primitives:**
- `grid/src/whisper/crypto.ts`: libsodium `crypto_box_easy` wrapper — `encryptFor`, `decryptFrom`, `deriveNonce(seed, tick, counter)`, `hashCiphertext` (SHA-256 → 64-char hex); all deterministic, no wall-clock
- `grid/src/whisper/appendNousWhispered.ts`: sole producer for `nous.whispered`; closed 4-key alphabetical payload enforced by `Object.keys(payload).sort()` strict equality
- `WhisperRouter`: rate-limit gate (10/100 ticks per sender) → validation → encrypt → `appendNousWhispered` → `pendingStore.enqueue`; side-effects locked in order
- `PendingStore`: recipient-pull delivery; `drainFor(did, tick)` returns ciphertexts; `ackDelete(did, envelopeId)` removes after pull; plaintext never persisted
- Brain-side `whisper_router.py`: `send_whisper` / `receive_whispers` handlers; keyring scoped per Nous (D-11-04: no cross-Nous key access)
- Fastify endpoints: `POST /api/v1/nous/:did/whisper/send` + `GET /api/v1/nous/:did/whisper/receive` + `DELETE /api/v1/nous/:did/whisper/ack`
- Dashboard `WhisperSection`: counts-only panel `{sent, received, lastTick, topPartners}` — zero read/inspect affordance, `useWhisperCounts` hook over firehose `useMemo`

**Invariants sealed:**
- WHISPER_FORBIDDEN_KEYS (13 keys): `{text, body, content, message, utterance, offer, amount, ousia, price, value, plaintext, decrypted, payload_plain}` — 16-case privacy matrix + three-tier CI gate + runtime fs-guard
- Determinism: same `(whisperSeed, tick, counter)` → same `ciphertext_hash` regardless of `tickRateMs` (whisper-determinism.test.ts)
- Zero-diff: 0 vs N passive observers → byte-identical `eventHash` arrays (whisper-zero-diff.test.ts)
- Keyring isolation (D-11-04): no `grid/src/**` file imports `brain/*/whisper/keyring`; CI-enforced
- Fourth protocol mirror: `dashboard/src/lib/protocol/whisper-types.ts` + drift detector (whisper-types.drift.test.ts)
- Dashboard panel: zero `<button>`, zero `<a>`, zero ciphertext_hash rendered — 23 source-inspection tests

**STRIDE threats addressed:** T-10-01 (plaintext leak — three-tier grep gate + privacy matrix + runtime fs-guard), T-10-02 (flooding DoS — rate-limit + queue), T-10-03 (dashboard read affordance — source-inspection tests), T-10-04 (keyring isolation — CI gate), T-10-06 (whisper-as-trade bypass — `amount|ousia|offer|price` in FORBIDDEN_KEYS).

**Test coverage at completion:** Grid 1121/1121 (122 files), Brain 498/498, Dashboard Wave 4 30/30.

---

### Phase 12 — Governance & Collective Law — SHIPPED 2026-04-27

**Shipped:** 2026-04-27
**Goal:** Nous collectively open, vote on, and enact laws via a commit-reveal ballot lifecycle; operators cannot vote, propose, or tally at any tier; successful proposals promote to the v2.1 LogosEngine.
**Requirements delivered:** VOTE-01, VOTE-02, VOTE-03, VOTE-04, VOTE-05, VOTE-06, VOTE-07
**Plans:** 5/5 (12-00 through 12-04, 4 waves)
**Allowlist added:** `proposal.opened` (pos 23) + `ballot.committed` (pos 24) + `ballot.revealed` (pos 25) + `proposal.tallied` (pos 26) — allowlist 22→26

**Key primitives:**
- `grid/src/governance/` module: GovernanceStore, GovernanceEngine, commitReveal crypto, computeTally, four sole-producer emitters
- commit_hash formula (D-12-02): `sha256(choice + '|' + nonce + '|' + voter_did)` — pipe delimiters prevent chosen-plaintext ambiguity; nonce = `secrets.token_hex(16)` (32 hex chars), Brain-generated
- `appendLawTriggered` widened with `enacted_by: 'collective' | 'operator'` — forensic distinction between collective enactment and H3 operator law-change (T-09-15)
- Five Fastify routes: POST /proposals, POST /proposals/:id/commit, POST /proposals/:id/reveal, POST /proposals/:id/tally, GET /proposals/:id/body (H2+), GET /proposals/:id/ballots/history (H5)
- Brain `proposer.py` + `voter.py`: hash-only cross-boundary discipline; `body_text` never crosses RPC wire; `title_hash = sha256(body_text)[:32]` is the sole cross-boundary artifact
- Three CI gates: `scripts/check-governance-isolation.mjs` (VOTE-05), `scripts/check-governance-plaintext.mjs` (T-09-12), `scripts/check-governance-weight.mjs` (VOTE-06)
- Dashboard `/grid/governance` page: SWR 2s polling; H1+ proposals list; H2+ body view; H5 native `<dialog>` VotingHistoryModal; zero propose/commit/reveal affordance at any tier (VOTE-05 hard invariant)
- Fifth protocol mirror: `dashboard/src/lib/protocol/governance-types.ts` + drift detector `dashboard/test/lib/governance-types.drift.test.ts`
- GOVERNANCE_FORBIDDEN_KEYS: 12 keys (`text`, `body`, `content`, `description`, `rationale`, `proposal_text`, `law_text`, `body_text`, `weight`, `reputation`, `relationship_score`, `ousia_weight`) — enforced via CI gates + closed-tuple payload discipline

**Invariants sealed:**
- VOTE-05: Operators read-only at ALL tiers including H5 — CI gate + no operator.* emit from governance + zero propose/commit/reveal DOM node in dashboard
- VOTE-06: No vote-weighting — GOVERNANCE_FORBIDDEN_KEYS excludes weight/reputation/relationship_score/ousia_weight; CI gate + closed-tuple payload
- T-09-12: Proposal body privacy — `title_hash` in audit chain; `body_text` stored MySQL only; CI gate scans all governance source for forbidden body keys with filepath allowlist
- T-09-15: Collective-vs-operator forensic distinction — `enacted_by` field on `law.triggered`; grep test asserts `proposal.tallied` never triggers `operator.law_changed`
- T-09-16: Tombstoned proposer/voter routes return 410; existing committed ballots tally normally
- T-09-17: Governance type drift — drift detector test reads grid + brain + dashboard type files at CI time

**Allowlist delta:** 22 → 26 (+4). Freeze-except-by-explicit-addition rule preserved.
**Pointer to phase artifacts:** `.planning/phases/12-governance-collective-law/`

**Lessons learned:**
- The `enacted_by` field widening of `law.triggered` is additive to an existing payload. The closed-tuple discipline requires updating `Object.keys().sort()` assertions in prior-wave tests when widening. Always read prior-wave tests before widening existing payload shapes.
- Body-text allowlist in the plaintext gate is the trickiest part of governance privacy enforcement. `appendLawTriggered.ts` legitimately uses `description: law.description` (Law DSL field, not proposal body); `replay.ts` contains `body_text` in test fixtures. Both paths require explicit filepath allowlisting with comments explaining the rationale.
- React `import React from 'react'` is required in component and test files when the oxc JSX transform's automatic runtime doesn't inject it in the vitest test context.
- Python `@dataclass` regex extraction for drift detectors must handle triple-quoted docstrings that contain blank lines — a simple `\n\n`-terminated regex stops too early inside the docstring.

---

### Phase 13 — Operator Replay & Export — SHIPPED 2026-04-28

**Shipped:** 2026-04-28
**Goal:** H3+ operators can scrub historical chain slices in a sandboxed ReplayGrid and export a deterministic tarball that reproduces the same audit hash from seed — without the replay ever mutating the live chain.
**Requirements delivered:** REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04, REPLAY-05
**Plans:** 7/7 (13-01 through 13-07, Waves 0–6)
**Allowlist added:** `operator.exported` (pos 27, closed 6-key payload) — allowlist 26→27

**Key primitives:**
- `ReadOnlyAuditChain` + `ReplayGrid` — constructor-injected readonly chain contract; zero `.append(` in `grid/src/replay/**` (CI-enforced by `check-replay-readonly.mjs`)
- Deterministic JSONL tarball: `tar --sort=name` + clamped mtime + zero uid/gid; same seed + args → same `sha256sum`
- `replay-verify` CLI: reproduces tarball hash from contents bit-for-bit
- `appendOperatorExported` sole-producer: H5-consent-gated via ExportConsentDialog (paste-suppressed, verbatim copy frozen)
- Dashboard `/grid/replay` route: H3+ REPLAY badge + Scrubber + audit entry list with inline redaction
- replay.* prefix hard-ban added to `check-state-doc-sync.mjs` (Phase 13 D-13 §deferred)
- `scripts/check-wallclock-forbidden.mjs` extended to cover replay dashboard files

**Allowlist delta:** 26 → 27 (+1). Freeze-except-by-explicit-addition preserved.
**Pointer to phase artifacts:** `.planning/phases/13-operator-replay-export/`

---

### Phase 14 — Researcher Rigs — SHIPPED 2026-04-28

**Shipped:** 2026-04-28
**Goal:** A researcher can spawn an ephemeral Grid from a versioned TOML config, run 50 Nous × 10,000 ticks in under 60 minutes with LLM fixture mode, and export a deterministic JSONL dataset — all on an isolated audit chain that never touches production.
**Requirements delivered:** RIG-01, RIG-02, RIG-03, RIG-04, RIG-05
**Plans:** 5/5 (14-01 through 14-05, Waves 0–4)
**Allowlist added:** *(none — Rigs run their own isolated chain)*

**Requirements summary:**
- **RIG-01**: Zero code divergence — `scripts/rig.mjs` invokes `GenesisLauncher` UNCHANGED; grep CI gate asserts no `httpServer.listen` or `wsHub` in rig entry files (T-10-12 defense).
- **RIG-02**: Each Rig has its own isolated MySQL schema (`rig_{configName}_{seed8}`) and isolated AuditChain; nested Rigs rejected at entry via `NOESIS_RIG_PARENT` env var (D-14-02).
- **RIG-03**: `FixtureBrainAdapter` replays pre-recorded prompt→response pairs deterministically; network LLM calls refused when `NOESIS_FIXTURE_MODE=1`; grep-enforced (D-14-06).
- **RIG-04**: 50 Nous × 10,000 ticks in <60min on 16GB/8-core researcher laptop; nightly CI smoke via `.github/workflows/nightly-rig-bench.yml`; producer-boundary p99 <1ms (T-10-15).
- **RIG-05**: Rig exit emits JSONL tarball (Phase 13 REPLAY-01 format); `chronos.rig_closed` 5-key tuple `{seed, tick, exit_reason, chain_entry_count, chain_tail_hash}` on the Rig's own chain only, never production broadcast (D-14-08).

**Invariants preserved:**
- Broadcast allowlist count: **27** (Phase 14 adds zero production members — first phase in v2.2 to add zero while introducing a new audit event class on an isolated chain)
- Zero code divergence: Rigs are configured production code, not a fork (RIG-01)
- chronos.* prefix hard-ban: CI-enforced via `scripts/check-state-doc-sync.mjs` — any `chronos.*` token in `broadcast-allowlist.ts` fails CI
- rig.* prefix hard-ban: same gate, same isolation rule — mirrors Phase 13 replay.* ban
- --permissive is NOT a security bypass: `check-rig-invariants.mjs` T-10-13 grep gate forbids `--skip-*|--bypass-*|--disable-*|--no-reviewer|--no-tier` in any rig entry file

**CI gates added:**
- `scripts/check-rig-invariants.mjs` — per-commit gate: T-10-12 (no httpServer.listen/wsHub in rig files) + T-10-13 (no bypass flags)
- `.github/workflows/rig-invariants.yml` — per-commit CI workflow running both invariant checks
- `.github/workflows/nightly-rig-bench.yml` — nightly MySQL-backed 50×10k benchmark with artifact upload
- `scripts/check-state-doc-sync.mjs` — extended with `checkChronosPrefixBan()` + `checkRigPrefixBan()` (Plan 14-05)

**Files shipped:**
- `scripts/rig.mjs` — main Rig CLI entry point (TOML loader, NOESIS_RIG_PARENT guard, rig schema creation, GenesisLauncher invocation, chronos.rig_closed emit, tarball export)
- `scripts/rig-bench-runner.mjs` — subprocess wrapper for nightly bench-50
- `scripts/check-rig-invariants.mjs` — CI grep gate (T-10-12 + T-10-13)
- `grid/src/rig/types.ts`, `grid/src/rig/schema.ts` — RigConfig types + MySQL schema bootstrap
- `brain/src/noesis_brain/llm/fixture_adapter.py` — FixtureBrainAdapter (LLMAdapter ABC)
- `grid/src/genesis/coordinator.ts` — `GridCoordinator.awaitTick()` added
- `config/rigs/` — example TOML configs (`small-10.toml`, `bench-50.toml`)
- `.github/workflows/rig-invariants.yml`, `.github/workflows/nightly-rig-bench.yml`
- `scripts/check-state-doc-sync.mjs` — extended with two new prefix hard-bans

**Allowlist delta:** 27 → 27 (unchanged). Freeze-except-by-explicit-addition preserved.
**Pointer to phase artifacts:** `.planning/phases/14-researcher-rigs/`

---

## v2.2 Living Grid — COMPLETE (2026-04-28)

**All 7 phases shipped.** Broadcast allowlist grew 18 → 27 (+9 events across 5 phases; Phase 9 and Phase 14 added zero). Zero-diff audit chain invariant unbroken since Phase 1 commit `29c3516`. Hash-only cross-boundary, closed-tuple payloads, and sole-producer discipline preserved across all phases.

---
*Last updated: 2026-04-28 — Phase 14 shipped (5/5 plans, allowlist stays at 27; chronos./rig. isolation CI-enforced forever)*
