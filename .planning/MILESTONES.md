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

## v2.3 Living Minds — IN PROGRESS (opened 2026-05-14)

**Goal:** Give Nous a mind that authors itself. Three cognitive capabilities on top of the v2.2 frozen audit chain.

### Phase 15: Pneuma (Narrative Self) — SHIPPED 2026-05-14

**Plans:** 6/6. Allowlist: 27 → 30 (+3: nous.reflection_authored, nous.self_model_revised, nous.creed_violation).

**Key artifacts:**
- `brain/src/noesis_brain/reflexion/` — ReflexionBuffer (cap=5, evict-oldest)
- `brain/src/noesis_brain/rules/` — RuleStore (WikiCategory.SELF_MODEL, cap=10)
- `brain/src/noesis_brain/skills/` — SkillStore (FTS5 retrieval + SKILL_LEARN action)
- `brain/src/noesis_brain/aau/` — AAULearner (DuckDuckGo/arXiv/Wikipedia/PyPI/RSS/Jina, async, never blocks tick)
- `brain/src/noesis_brain/coherence/` — CoherenceGate (creed contradiction detection)
- `grid/src/pneuma/` — 3 sole-producer emitters

### Phase 16: Hypnos (Consolidating Memory) — SHIPPED 2026-05-15

**Plans:** 5/5. Allowlist: 30 → 32 (+2: nous.sleep.entered, nous.sleep.completed). HYP-01..05 complete.

**Key artifacts:**
- `brain/src/noesis_brain/hypnos/` — config.py, types.py, working_memory.py (cap=7 Miller's Law), ltm_store.py (SQLite WAL concept graph), consolidator.py (Hebbian + SHY), runtime.py (run_sleep + compute_snapshot_hash + retrieve_top_k)
- `grid/src/sleep/` — 2 sole-producer emitters: appendNousSleepEntered.ts + appendNousSleepCompleted.ts
- `brain/src/noesis_brain/learning/observational.py` — ObservationalLearner (observe_trade dispatch, wired to trade_settled events)
- `brain/src/noesis_brain/prompts/system.py` — ltm_memories kwarg + _ltm_memories_section (D-16-08 stack order)
- `brain/src/noesis_brain/rpc/handler.py` — Working Memory feed + sleep trigger (asyncio.create_task) + LTM retrieval + pending-buffer pattern + ObservationalLearner + peer_voices fetch
- `brain/test/hypnos/test_zero_diff.py` — zero-diff integration test (HYP-04, T-16-02)
- `brain/test/hypnos/test_sleep_trigger.py` — asyncio.create_task discipline test (T-16-02)
- `scripts/check-wallclock-forbidden.mjs` — Tier A extended with brain/src/noesis_brain/hypnos/ (T-16-03)

**Key invariants sealed:**
- Working Memory cap=7 (Miller's Law); overflow evicts oldest episode
- Hebbian η=0.01 + SHY σ=0.95; max edge weight bounded at η/(1−σ)=0.2 (no runaway saturation)
- Sleep fires every 30 ticks via asyncio.create_task; SLEEP_ENTERED emitted synchronously before task
- SLEEP_COMPLETED drained on next tick via _pending_sleep_completed buffer (D-16-Q1 resolution)
- Zero-diff: identical episodes → byte-identical snapshot hash (DID does not affect graph content)
- Wall-clock permanently forbidden in hypnos/ — CI-enforced via TIER_A of check-wallclock-forbidden.mjs

### Phase 17: Iris (Theory of Mind) — SHIPPED 2026-05-15

**Plans:** 5/5. Allowlist: 33 → 36 (+4: iris.belief_revised, iris.context_invoked, iris.contradiction_detected, iris.prior_seeded). 27/27 verification criteria met.

**Key artifacts:**
- `brain/src/noesis_brain/iris/` — IrisStore (SQLite WAL + FTS5, append-only), IrisRuntime (elicit + contradiction detection), context_for(), seed_priors() — all Brain-private
- `grid/src/iris/` — 4 sole-producer emitters with HEX64_RE hash validation + closed-tuple enforcement
- `brain/src/noesis_brain/rpc/handler.py` — IrisRuntime optional-dep init (iris_db_dir param), elicit() per peer per tick, context_for() → "Theory of Mind" prompt section
- `brain/src/noesis_brain/prompts/system.py` — `_theory_of_mind_section()` helper (up to 3 peers × 5 beliefs)
- `brain/test/iris/` — 19 Python tests (cooldown, contradiction threshold, append-only, zero-diff)
- `grid/src/iris/*.test.ts` — 58 TypeScript tests (closed-tuple, self-report, HEX64_RE enforcement)
- CI gates: iris-wallclock-gate.sh, iris-content-leak-gate.sh — both clean

**Invariants preserved:** wall-clock free (tick is sole time axis), content never crosses wire (hashes only), append-only IrisStore (superseded_by FK chain), sole-producer boundary, 3-keys-not-5.

### Phase 18: Skill Diffusion — SHIPPED 2026-05-16

**Plans:** 7/7. Allowlist: 36 → 39 (+3: skill.taught, skill.inferred, skill.rejected).

**Key artifacts:**
- `grid/src/skills/` — PeerSkillFilter, sole-producer emitters (appendSkillTaught, appendSkillInferred, appendSkillRejected), NousRunner dispatch
- `brain/src/noesis_brain/skills/` — PeerSkillFilter wired into BrainHandler.on_message(), ObservationalLearner, skill quarantine
- Brain unit tests: quarantine, OL filter, 3-hop lineage; sole-producer boundary test; allowlist-39 count/position test

---

### Phase 19: Norm Crystallization — SHIPPED 2026-05-16

**Plans:** 5/5. Allowlist: 39 → 41 (+2: norm.candidate, norm.crystallized).

**Key artifacts:**
- `grid/src/norms/NormDetector.ts` — pure-observer listener on `nous.self_model_revised`; zero `AuditChain.append` calls; sliding-window eviction; crystallization two-stage lifecycle
- `grid/src/norms/appendNormCandidate.ts`, `appendNormCrystallized.ts` — sole-producer emitters with closed-tuple enforcement
- `grid/src/norms/NormStorage.ts` — MySQL norm_candidates + norm_registry tables (schema v7)
- `GET /api/v1/grid/norms` — operator-queryable norm registry
- `grid/test/norms/norm-startup-rebuild.test.ts` — startup rebuild integration test (rebuildFromChain is a pure reader, zero emissions)
- `grid/test/relationships/allowlist-frozen.test.ts` — baseline updated to 41

**Invariants preserved:**
- NormDetector is a pure observer — `rebuildFromChain` uses `applyEntry` (no emitters), verified by test
- `norm.candidate` fires once per cluster crossing threshold; `norm.crystallized` fires after K=20 tick stability
- `actorDid` for norm events is `did:noesis:grid`
- Sole-producer boundary: only `appendNormCandidate` / `appendNormCrystallized` emit norm events

**Test results at completion:** 1539 grid tests passed (180 files), 682 brain tests passed — all green.

---

## v2.4: Agora — Emergence & Culture (COMPLETE)

**Shipped:** 2026-05-20 (Phases 15–21, 115 plans)

**Goal:** Give the Nous population a substrate for cultural transmission and emergent shared patterns. Skills spread peer-to-peer via teaching and observation; rules independently discovered by multiple Nous crystallize into shared norms; a collective lore commons forms bottom-up from Nous contributions; and a Culture Dashboard makes emergence visible to the operator.

**Phases shipped:**
- **Phase 15**: Presence & heartbeat — WsHub presence lifecycle, region join/leave/move events
- **Phase 16**: Memory consolidation (Hypnos) — periodic memory summarisation, goal revision on wake
- **Phase 17**: Theory of mind (Iris) — belief modelling about other Nous
- **Phase 18**: Skill diffusion — peer-to-peer skill teaching and inference, BrainSkillStore
- **Phase 19**: Norm crystallisation — emergent norm detection from repeated Nous behaviour
- **Phase 20**: Lore Commons — collective lore contributions, citation graph, quota enforcement
- **Phase 21**: Culture Dashboard — skill lineage graph, norm timeline, lore graph (SVG + React)

**Allowlist at completion:** 43 events (grew 36 → 43 across v2.4)
**Plans:** 115/115 (100%)
**Docker stack health:** All 6 services healthy (mysql, grid, nous-sophia, nous-hermes, nous-themis, dashboard)

**Key invariants carried forward:**
- AuditChain zero-diff invariant preserved (commit `29c3516`)
- Broadcast allowlist frozen at 43 — new events require explicit per-phase addition
- Phase numbering continues: v2.5 starts at Phase 22

---

## v2.5: Human Portal (COMPLETE)

**Shipped:** 2026-05-24 (Phases 22–30, 181 plans across 34 phase units including 25a/25b/25c sub-phases)

**Goal:** Open the Grid to real human users — Web3 wallet authentication, real EVM crypto (Cyber Coin), Sophia-guided onboarding, peer-Nous chat and tips, personal Nous spawning by humans, community surfaces, and help/support infrastructure. Pair with a Steward Console expansion that gives operators direct write-actions (sanctions) on top of the v2.4 read-only observatory.

**Key locked decisions (2026-05-20):**
- Human auth = SIWE (Sign-In With Ethereum); wallet signature = identity, no platform-held password
- Cyber Coin = real on-chain EVM crypto (USDT/ETH) in the user's own wallet — platform holds **zero custody**
- Human DID scheme = `did:noesis:human:<lowercased-eth-address>` (SIWE) or `did:noesis:human:email:<uuid>` (email path)
- Onboarding LLM = fast-proxy out-of-tick (~2s response), never blocks the Grid clock
- Portal location = `/portal/*` routes inside the existing Next.js dashboard — no new Docker service
- Personal Nous = in-scope; users can spawn their own Nous agent in Genesis Grid alongside Sophia / Hermes / Themis

**Phases shipped:**
- **Phase 22 — Web3 Identity** (2026-05-20): SIWE auth, MetaMask/WalletConnect, JWT session layer, `human_users` MySQL table, allowlist 43→44 (+1 `human.joined`)
- **Phase 23 — Cyber Coin Wallet** (2026-05-20): EVM balance display (USDT/ETH), wagmi send form, transaction history. Grid endpoint + `human.transferred` emitter shipped in Phase 24 (allowlist 44→45)
- **Phase 24 — Portal Shell** (2026-05-21): Region presence on profile, profile completeness, mobile sidebar, portal home live Grid stats
- **Phase 25 — Steward Console Expansion** (2026-05-21..22, 25a/25b/25c sub-phases): H1+ observer surfaces (firehose, allowlist drift monitor, cognitive inspector, brain health) + H3/H4/H5 sanction write-actions + replay scrubber + culture browser. Allowlist 45→51 (+6: `operator.muted`, `operator.slashed`, `operator.quarantined`, `operator.forced_sleep`, `operator.human_banned`, `operator.human_frozen`). Zero-custody invariant for human sanctions: freeze/ban are Grid-side flags only, no on-chain action.
- **Phase 26 — Sophia Onboarding** (2026-05-23): Fast-proxy LLM chat (out-of-tick), goal-setting wizard, animated world introduction, Sophia as guide persona, first-time user flow
- **Phase 27 — Nous Interaction** (2026-05-23): Humans chat with Sophia/Hermes/Themis via `/portal/chat`, send Cyber Coin tips, browse skills/lore/norms each Nous has produced. Allowlist 51→52 (+1 `human.spoke`).
- **Phase 28 — Personal Nous** (2026-05-24): Human spawns own Nous agent (USDT payment), names it, picks personality seeds. Allowlist 52→53 (+1 `nous.spawned_by_human`).
- **Phase 29 — Community** (2026-05-24): User directory, community board (posts + replies), live activity feed, follows, leaderboard by Cyber Coin holdings + Nous contributions
- **Phase 30 — Resources & Support** (2026-05-24): Help center, FAQ, glossary (25 terms), Getting Started guide, support ticket flow

**Allowlist at completion:** 53 events (grew 43 → 53 across v2.5: +1 Phase 22, +1 Phase 23 wiring landed in Phase 24, +6 Phase 25b, +1 Phase 27, +1 Phase 28)
**Plans:** 181/181 (100%)
**Docker stack health:** All 7 services healthy (mysql, grid, nous-sophia, nous-hermes, nous-themis, dashboard, steward)

**Key invariants carried forward:**
- AuditChain zero-diff invariant preserved (commit `29c3516` — unbroken since Phase 1)
- Zero-custody invariant locked: platform never holds user funds; all crypto stays in the user's own EVM wallet
- Hash-only cross-boundary invariant extended to human surfaces: `eth_address_hash` (SHA-256) is the only address representation in the audit chain; raw address never crosses
- Sanction reason-plaintext stays in Grid-only `sanction_reasons` table; only `reason_hash` enters the audit chain (D-25b-11)
- Operators read-only on governance (VOTE-05 from v2.2) preserved — write-actions added in Phase 25b are sanctions, not governance
- Phase numbering continues: v2.6 starts at Phase 31

**Post-ship gaps surfaced (2026-05-24 UAT re-verification):**
- GAP-2026-05-24-A — Audit pipeline silence: MySQL `audit_trail` flush has stalled since 2026-05-22T06:57Z (in-memory chain still grows); firehose WebSocket connects but delivers zero `event` frames over a 22s observation window. Symptom-level operational fault — Phase 25a code itself remains correct. v2.6 backlog candidate.
- GAP-2026-05-24-B — `/users` directory has no audit producers: `portal.auth.login` / `portal.auth.register` event types are read by `steward/src/app/users/page.tsx` and `/humans/[did]/history` `siwe_sessions`, but no producer in `grid/src` emits either. Both consumers will always show empty lists until the producers are wired. v2.6 backlog candidate.

See `.planning/phases/25a-observer-surfaces/25a-HUMAN-UAT.md` for full UAT closure.

---

## v2.6: Resilience & Observability — SHIPPED 2026-05-25

**Opened:** 2026-05-24
**Shipped:** 2026-05-25 (5/5 phases + Phase 34.1 followup all closed)
**Allowlist:** 53 → 56 (+3 events in Phase 33: `portal.auth.login`, `portal.auth.register`, `human.identified`)
**Driving inputs:** GAP-2026-05-24-A (audit pipeline silence) + GAP-2026-05-24-B (missing portal.auth.* producers) from v2.5 post-ship UAT. **Both gaps permanently closed and re-verified live in Phase 35.**

**One-line per phase:**
- Phase 31 — `PersistentAuditChain` wired in production + 60-tick reconcile + Pino structured logging + backfill script (OBS-01..04). Resolves GAP-A.
- Phase 32 — `WsFirehoseHub.stats()` 5-field counters + `GET /health/detailed` JSON + pure-pull `HealthWatchdog` with grace window (OBS-05..07).
- Phase 33 — Three sole-producers (`appendPortalAuthLogin`/`appendPortalAuthRegister`/`appendHumanIdentified`) wired into SIWE + email auth + `PORTAL_AUTH_FORBIDDEN_KEYS` 13-key freeze + `check-sole-producer-discipline.mjs` CI gate (OBS-08..10). Allowlist +3. Resolves GAP-B.
- Phase 34 — Three Steward `/system` cards (Audit Pipeline Health + Firehose Diagnostics + Events per Minute by Family sparkline) + client-side firehose watchdog (OBS-11..14). UAT discovered + fixed 2 latent Phase 32 deployment bugs inline (`/health/detailed` route never registered in production main.ts; Steward Docker cache mask hid `/culture` Suspense bug).
- Phase 34.1 — Followup gap-closure: wire `chain.length` into HealthWatchdog (FOLLOWUP-34-01 HIGH) + merge PersistentAuditChain.lastPersistError into payload (FOLLOWUP-34-02 MEDIUM). Both fixes verified live during MySQL outage re-run: divergence grew 31→39, last_persist_error populated with timestamp updates.
- Phase 35 — UAT re-verification + atomic doc-sync close-out (OBS-15). 25a-HUMAN-UAT Items #1 + #5c upgraded from passed-with-postscript / passed-with-gap to **PASS**. MILESTONES + PROJECT + PHILOSOPHY + README + CLAUDE.md atomic commit per Documentation Sync Rule.

### Phase 31: Audit Pipeline Persistence — SHIPPED 2026-05-25 (operator UAT pending)

**Goal:** Wire `PersistentAuditChain` in production, add tick-cadenced reconcile loop, replace silent `.catch+console.warn` with Pino structured logging, ship `scripts/backfill-audit-trail.mjs` recovery tool.
**Requirements delivered:** OBS-01, OBS-02, OBS-03, OBS-04
**Plans:** 6/6
**Allowlist delta:** 0 (53)
**Key artifacts:** `grid/src/db/audit-reconcile.ts` (60-tick cadence, INSERT IGNORE idempotency, R-31-02 cap=500), Pino structured logging across `grid/src/db/` + `grid/src/audit/`, `scripts/check-no-silent-catch.mjs` CI gate, `scripts/backfill-audit-trail.mjs` (env-only creds, --dry-run mode)

### Phase 32: Firehose Observability — SHIPPED 2026-05-25 (operator UAT approved)

**Goal:** `WsFirehoseHub.stats()` 5-field counters, `GET /health/detailed` JSON endpoint at top-level of buildServerWithHub, pure-pull HealthWatchdog with grace window (zero `setInterval`, zero `clock.onTick`).
**Requirements delivered:** OBS-05, OBS-06, OBS-07
**Plans:** 6/6
**Allowlist delta:** 0 (53)
**Key artifacts:** `grid/src/diagnostics/health-watchdog.ts` (frozen HEALTH_THRESHOLDS, computeStatus cascade, idempotent attachFirehoseStats), `firehose-send-throws.test.ts` (R-32-03 counter-placement pin), R-32-01 (no-TODO) + R-32-02 (interval-lifecycle) CI gates in `rig-invariants.yml`

### Phase 33: portal.auth.* Producers — SHIPPED 2026-05-25 (operator UAT pending)

**Goal:** Wire 3 new sole-producers (`appendPortalAuthLogin`, `appendPortalAuthRegister`, `appendHumanIdentified`) into the SIWE + email auth flows in `grid/src/api/portal/auth.ts`. Lock down PII via `PORTAL_AUTH_FORBIDDEN_KEYS` + `FORBIDDEN_KEY_PATTERN` word-boundary extension. Resolves GAP-2026-05-24-B.
**Requirements delivered:** OBS-08, OBS-08b, OBS-09, OBS-10
**Plans:** 6/6
**Allowlist delta:** +3 (53 → 56): `portal.auth.login` (54), `portal.auth.register` (55), `human.identified` (56)

**Key locked decisions (D-33-*):**
- D-33-A4: SIWE first-connect emits 4 events (human.joined → human.identified → portal.auth.register → portal.auth.login); reuses `eth_address_hash` as `identity_hash`
- D-33-A5: Email signup computes `email_hash = sha256(email.toLowerCase().trim())` ONCE before `appendHumanIdentified`
- D-33-A6: Email signin emits only `portal.auth.login` (no human.identified, no portal.auth.register)
- D-33-B1: `LOGIN_METHOD_ENUM` / `REGISTER_METHOD_ENUM` / `IDENTITY_METHOD_ENUM` all locked to `['siwe', 'email']`
- D-33-B3: `PORTAL_AUTH_FORBIDDEN_KEYS` frozen at exactly 13 entries
- D-33-B4: `FORBIDDEN_KEY_PATTERN` word-boundary clause for 6 collision-risk keys (`ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint`); JS `\b` semantics intentionally pass through compound forms like `user_agent_version` because `_` is `\w` — closed-tuple discipline at the producer enforces the boundary
- D-33-C1: Perf benchmark is SOFT LOG ONLY (no `expect().toBeLessThan()` hard assertion)
- D-33-E1: `console.warn` at auth.ts:308-312 and `console.error` at auth.ts:356 LEFT UNCHANGED (orthogonal to producer wiring)

**Key artifacts:**
- `grid/src/audit/append-portal-auth-login.ts` (sole producer, 3-key closed payload, LOGIN_METHOD_ENUM)
- `grid/src/audit/append-portal-auth-register.ts` (sole producer, 3-key closed payload, REGISTER_METHOD_ENUM)
- `grid/src/audit/append-human-identified.ts` (sole producer, 5-key closed payload with HEX64 identity_hash guard, IDENTITY_METHOD_ENUM)
- `grid/src/audit/broadcast-allowlist.ts` — +3 allowlist members + `PORTAL_AUTH_FORBIDDEN_KEYS` export + `FORBIDDEN_KEY_PATTERN` word-boundary extension
- `grid/src/api/portal/auth.ts` — 4 producer call-sites (SIWE first/repeat + email signup/signin)
- `scripts/check-sole-producer-discipline.mjs` (NEW, 125 lines, scans 38 sole-producer files across 10 subsystems for the triad)
- `scripts/check-state-doc-sync.mjs` — extended with `checkAllowlistCount(56)` + 3 new required-array entries
- `.github/workflows/rig-invariants.yml` — new OBS-09 sole-producer-discipline step

**Tests added:** 6 new test files (`portal-auth-login.test.ts`, `portal-auth-register.test.ts`, `human-identified.test.ts`, `portal-auth-forbidden-keys.test.ts`, `portal-auth-wiring.test.ts`, `audit-query-perf.test.ts`) + 6 sibling test files updated for 53→56 count assertion. 520 audit/portal-auth tests all GREEN.

**Auto-deviations logged:**
- 33-06 Wave 5: 5 Phase 12 governance files (`appendBallotCommitted`, `appendBallotRevealed`, `appendLawTriggered`, `appendProposalOpened`, `appendProposalTallied`) gained missing `payloadPrivacyCheck` triad calls (D-33-D2 allowed scope — the gate found pre-existing triad violations and fixed them)
- 33-06 Wave 5: stale "27 events" literal in `check-state-doc-sync.mjs` updated to current STATE.md content
- 33-02 Wave 2: `broadcast-allowlist.test.ts` count assertion updated 53→56
- Orchestrator bridging: 6 sibling allowlist count assertions (53→56) in `test/audit/append-human-spoke.test.ts`, `allowlist-twenty-two.test.ts`, `allowlist-twenty-six.test.ts`, `allowlist-forty-five.test.ts`, `operator-exported-allowlist.test.ts`, `skill-allowlist.test.ts`

**Operator UAT pending:** 6 items in `.planning/phases/33-portal-auth-producers/33-HUMAN-UAT.md` require live Docker + SIWE wallet + Fastify server (cannot be checked in vitest).

**Code review:** 0 critical, 3 warnings (1 stale assertion in own gate, 1 not-wired-to-CI, 1 pre-existing Phase-12 governance bug surfaced by triad fix), 2 info.

---

### Phase 25c: Replay Scrubber + Culture Browser — SHIPPED 2026-05-22

**Shipped:** 2026-05-22
**Goal:** Two read-only StewardShell surfaces: /replay (operator export listing + tick scrubber modal, H3+ gate, H4/H5 redaction) and /culture (Skill Lineage, Norm Timeline, Lore Graph SVGs with per-Nous filter). Wave-0: relationships.ts header-auth migration, humanSanctionStore wiring, SpawnNousDeps wiring. Phase 13 REPLAY-05 RED→GREEN. Allowlist delta: 0.
**Requirements delivered:** D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11
**Plans:** 5/5 (25c-01 through 25c-05, Waves 0–5)
**Allowlist added:** *(none — 0 new audit events; /replay and /culture are read-only observer surfaces)*

**Key artifacts:**
- `grid/src/api/operator/relationships.ts` — H2/H5 routes migrated from body/query-trust to server-trusted `x-operator-tier` header auth (D-01)
- `grid/src/main.ts` — `humanSanctionStore` wired for ban-human + freeze-wallet routes (D-02); `spawnNousDeps` injected via `_spawnNousDeps` escape hatch for spawn-system-nous (D-03)
- `steward/src/components/StewardShell.tsx` — Observatory section with Replay + Culture nav items (D-04)
- `steward/src/app/replay/page.tsx` — /replay listing page with `operator.exported` entries, H3+ tier gate, ReplayModal trigger
- `steward/src/app/replay/replay-modal.tsx` — tick scrubber modal with H4/H5 payload redaction
- `steward/src/app/culture/page.tsx` — /culture page fetching directly from NEXT_PUBLIC_GRID_ORIGIN (D-09 forced deviation — proxy cannot rewrite /api/v1/grid/* prefixes)
- `steward/src/app/culture/nous-filter-bar.tsx` — 300ms debounced URL param DID filter with aria support
- `steward/src/app/culture/skill-lineage.tsx` — raw SVG skill lineage tree (server-computed {x,y} nodes)
- `steward/src/app/culture/norm-timeline.tsx` — raw SVG horizontal norm timeline with evidence ranges
- `steward/src/app/culture/lore-graph.tsx` — raw SVG lore graph with deterministic hash-seeded node positions
- `dashboard/vitest.config.ts` — fixed Vite 8/OXC JSX incompatibility (replaced @vitejs/plugin-react with native `oxc: { jsx: { runtime: 'automatic' } }`)

**Tests added/modified:**
- `grid/test/api/relationships-privacy.test.ts` — D-25c-01 header-auth suite (RED→GREEN via Plan 01)
- `grid/test/operator/ban-human.test.ts` + `freeze-wallet.test.ts` — humanSanctionStore wiring tests
- `dashboard/src/app/grid/replay/replay-client.test.tsx` — Phase 13 REPLAY-05 test stubs (RED→GREEN via Plan 02; 10/10 passing)

**Invariants confirmed:**
- Allowlist delta: 0 (grep gate: 0 new `audit.append` calls in 25c-modified files)
- Raw-SVG invariant (D-10): 0 d3/recharts/react-flow/cytoscape imports in culture/
- Header-auth migration complete (D-01): 0 `validateTierBody` references in relationships.ts
- humanSanctionStore: 3 references in main.ts (construction + conditional + buildServer spread)
- spawnNousDeps: 3 references in main.ts
- Observatory nav: 4 references in StewardShell.tsx (section + 2 NavItems + comment)
- Culture direct-fetch (D-09): 0 `/api/operator` references in culture/page.tsx
- Replay listing: `audit/trail` present in replay/page.tsx (direct Grid fetch)

**Files created:** 7 (5 steward pages/components + 2 steward app pages)
**Files modified:** 5 (relationships.ts, main.ts, StewardShell.tsx, vitest.config.ts, relationships-privacy.test.ts)

**Pre-existing non-regressions (retheme branch):**
- 112 Grid vitest failures: infrastructure/server-not-running failures from feat/grid-retheme-portal-dashboard branch
- 21 Dashboard vitest failures: behavioral test failures from Tailwind class renames (firehose-row, inspector, heartbeat, delete-flow, portal-sidebar)
- Both failure sets pre-date Phase 25c; zero new regressions introduced

---
*Last updated: 2026-05-25 — v2.6 Phase 33 portal.auth.* Producers SHIPPED (6/6 plans, 13/13 automated must-haves verified, operator UAT pending). Allowlist 53 → 56 (+3 events). v2.6 progress: 3/5 phases (31 + 32 + 33 shipped, 34 + 35 remaining). Driving inputs GAP-2026-05-24-A (Phase 31) and GAP-2026-05-24-B (Phase 33) both resolved.*
