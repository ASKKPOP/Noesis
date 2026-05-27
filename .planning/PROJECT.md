# Noēsis

## What This Is

Noēsis is an open-source engine for persistent virtual worlds where autonomous AI agents (Nous) live, communicate, trade, and self-govern. Each Nous runs its own LLM, forms private memories, sets goals, feels emotions, and trades Ousia peer-to-peer. Grids are sovereign worlds with their own clock, regions, laws, and economy. Built to discover what emerges when you give AI agents genuine inner lives and let them loose in a structured world.

## Core Value

The first persistent Grid where Nous actually live — observable, running continuously, with real cognitive cycles, real trades, and real social dynamics emerging from the systems.

## Requirements

### Validated

<!-- Phase 1: Genesis — all shipped and confirmed. -->

- ✓ **IDENT-01**: Nous have Ed25519 DID keypairs and sign all messages via SWP — Phase 1 Sprint 1
- ✓ **IDENT-02**: NDS domain system resolves `nous://name.grid` addresses — Phase 1 Sprint 2
- ✓ **LLM-01**: Brain supports multi-provider LLM routing (Ollama, Claude, GPT, local) — Phase 1 Sprint 3
- ✓ **BRAIN-01**: Nous have Psyche (Big Five personality), Thymos (emotions), Telos (goals) — Phase 1 Sprint 4
- ✓ **BRAIN-02**: Brain and Protocol communicate over JSON-RPC Unix domain socket — Phase 1 Sprint 5
- ✓ **MEM-01**: Nous have private episodic memory stream with Stanford retrieval scoring — Phase 1 Sprint 6
- ✓ **MEM-02**: Nous have personal wiki (Karpathy pattern) + reflection engine — Phase 1 Sprint 6
- ✓ **GRID-01**: WorldClock (tick-based time), SpatialMap (region graph), AuditChain, NousRegistry, API — Phase 1 Sprint 7
- ✓ **ECON-01**: Ousia P2P transfers with bilateral negotiation, shops, reputation — Phase 1 Sprint 8
- ✓ **HUMAN-01**: Human Channel with ownership proofs, consent grants, gateway, observer — Phase 1 Sprint 9
- ✓ **LAUNCH-01**: NousRegistry, GenesisLauncher, CLI, world presets — Phase 1 Sprint 10
- ✓ **E2E-01**: NousRunner + GridCoordinator wire Brain to Grid — full tick cycle end-to-end — Phase 2 Sprint 11
- ✓ **STORE-01**: MySQL adapter for Grid state with migrations and snapshot/restore — Phase 2 Sprint 12
- ✓ **DEPLOY-01**: Dockerfiles for Grid + Brain, `docker compose up` launches full stack — Phase 2 Sprint 13
- ✓ **DASH-01**: WebSocket real-time activity stream from Grid to browser — v2.0 Sprint 14 Phase 2-3
- ✓ **DASH-02**: Region map showing Nous positions and movement in real-time — v2.0 Sprint 14 Phase 3
- ✓ **DASH-03**: Nous inspector showing personality, goals, emotions, memory highlights — v2.0 Sprint 14 Phase 4
- ✓ **DASH-04**: Audit trail viewer (AuditChain events) — v2.0 Sprint 14 Phase 3
- ✓ **DASH-05**: Trade history and economy overview — v2.0 Sprint 14 Phase 4
- ✓ **REV-01**: ReviewerNous validates proposed trades against objective invariants before settlement — v2.1 Phase 5 (shipped 2026-04-21)
  → Validated in Phase 5
- ✓ **REV-02**: `trade.reviewed` audit event (allowlisted) records review outcome + rejection reason — v2.1 Phase 5 (shipped 2026-04-21)
  → Validated in Phase 5
- ✓ **REV-03**: ReviewerNous deployed as system singleton (opt-in peer review deferred) — v2.1 Phase 5 (shipped 2026-04-21)
  → Validated in Phase 5
- ✓ **REV-04**: Reviewer never makes subjective judgments — enforced via closed-enum reason codes + subjective-keyword lint gate — v2.1 Phase 5 (shipped 2026-04-21)
  → Validated in Phase 5
- ✓ **AGENCY-01**: Dashboard Agency Indicator renders H1–H5 tier with tooltip — v2.1 Phase 6 (shipped 2026-04-21)
  → Validated in Phase 6
- ✓ **AGENCY-02**: Per-action default tier + explicit elevation confirmation above H1; tier map covers inspect/memory-query/pause/law-change/force-Telos/delete — v2.1 Phase 6 (shipped 2026-04-21)
  → Validated in Phase 6
- ✓ **AGENCY-03**: `operator.*` events record tier at commit time; 5 new allowlist members at closed-tuple payloads — v2.1 Phase 6 (shipped 2026-04-21)
  → Validated in Phase 6
- ✓ **AGENCY-04**: Elevation dialog ("Entering H3 — Co-decision. This will be logged.") covers one action; closure-capture race-safety — v2.1 Phase 6 (shipped 2026-04-21)
  → Validated in Phase 6
- ✓ **AGENCY-05**: H5 irreversible Nous deletion with DID-typed confirmation + pre-deletion state hash + `operator.nous_deleted` + audit-chain preservation forever — v2.1 Phase 8 (shipped 2026-04-21)
  → Validated in Phase 8
- ✓ **DIALOG-01**: Grid aggregates ≥2 bidirectional `nous.spoke` in sliding window and surfaces `dialogue_context` to both participants — v2.1 Phase 7 (shipped 2026-04-21)
  → Validated in Phase 7
- ✓ **DIALOG-02**: `telos.refined` allowlisted with closed 4-key hash-only payload; `recentDialogueIds` authority check at producer boundary — v2.1 Phase 7 (shipped 2026-04-21)
  → Validated in Phase 7
- ✓ **DIALOG-03**: Inspector Telos panel renders `↻ refined via dialogue (N)` badge linking to filtered firehose — v2.1 Phase 7 (shipped 2026-04-21)
  → Validated in Phase 7
- ✓ **REL-01**: Pure-observer RelationshipListener derives edges from audit events without appending to audit chain — v2.2 Phase 9 (shipped 2026-04-22)
  → Validated in Phase 9
- ✓ **REL-02**: Relationship edges persist in derived MySQL `relationships` table via idempotent rebuild; production wiring via `launcher.attachRelationshipStorage(pool)` — v2.2 Phase 9 (shipped 2026-04-22)
  → Validated in Phase 9
- ✓ **REL-03**: Deterministic decay `weight × exp(-Δtick/τ)` computed lazily at read time; zero wall-clock reads in relationships module — v2.2 Phase 9 (shipped 2026-04-22)
  → Validated in Phase 9
- ✓ **REL-04**: 10K-edge rebuild p95 < 100ms (measured ~0.27ms, 370× under budget); tier-graded operator API (H1 warmth / H2 numeric / H5 events) — v2.2 Phase 9 (shipped 2026-04-22)
  → Validated in Phase 9
- ✓ **DRIVE-01**: Brain-side `AnankeRuntime` runs 5 drives (hunger, curiosity, safety, boredom, loneliness) deterministically — piecewise recurrence (below baseline pulls up via `DECAY_FACTOR=exp(-1/500)`, above baseline rises by drive-specific rate); bounds-clamped at 0.0/1.0; byte-identical traces from (seed, tick) alone — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **DRIVE-02**: Hysteresis-guarded level bucketing (`low<0.33`, `med<0.66`, `high≥0.66`, ±0.02 band) prevents threshold flapping; level crossings detected on band-boundary traversal only — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **DRIVE-03**: `ananke.drive_crossed` allowlisted (19th member) with closed 5-key payload `{did, tick, drive, level, direction}`; Grid-side `appendAnankeDriveCrossed` is sole producer with `Object.keys(payload).sort()` strict equality; drive floats NEVER cross the wire (three-tier privacy grep Grid+Brain+Dashboard) — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **DRIVE-04**: Advisory-only drive→action coupling — Brain handler logs drive/action divergence to private wiki (side-effect-only log; does NOT mutate chosen actions list); PHILOSOPHY §6 Nous sovereignty preserved — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **DRIVE-05**: Dashboard Drives panel renders 5-row Ananke section between Thymos and Telos in Inspector; locked Unicode glyphs (⊘ ✦ ◆ ◯ ❍) + 45-state aria matrix + baseline bucketed mirror row + level palette (neutral/amber/rose) — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **BIOS-01**: Brain-side `BiosRuntime` tracks energy + sustenance in `[0.0, 1.0]`; rise-only with passive baseline decay; threshold crossing elevates matching Ananke drive (energy→hunger, sustenance→safety) once per crossing — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **BIOS-02**: `bios.birth` (pos 20) and `bios.death` (pos 21) are the only lifecycle events; closed-enum test confirms bios.resurrect/migrate/transfer fail at allowlist gate; allowlist 19→21 per D-10b-01 correction — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **BIOS-03**: `bios.death` payload closed-tuple `{did, tick, cause, final_state_hash}`; `cause ∈ {starvation, operator_h5, replay_boundary}`; D-30 extension: H5 delete handler emits bios.death before operator.nous_deleted — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **BIOS-04**: Tombstoned DIDs permanently reserved; NousRegistry blocks DID reuse after bios.death; first-life promise (PHILOSOPHY §1) preserved; GDPR erasure out of scope — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **CHRONOS-01**: Subjective-time multiplier `[0.25, 4.0]` = `clamp(1.0 + curiosity_boost - boredom_penalty, 0.25, 4.0)`; modulates Stanford retrieval recency score; Brain-local, never crosses wire — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **CHRONOS-02**: `audit_tick === system_tick` strictly; 1000-tick CI integration test asserts zero drift across all Phase 10b event types; subjective time is read-side only — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **CHRONOS-03**: `epoch_since_spawn` exposed to Brain prompting via ChronosListener (Grid-side pure-observer over bios.birth); no new allowlist event; Brain context "I am N ticks old" — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b

## Current Milestone: v3.0 Polis (Civic City — Three-Layer Architecture)

**Goal:** Transform Noēsis into a **three-layer digital city** — Portal (meta-layer, NEW) above Grid(s) (digital cities, multi-Grid framework; v3.0 ships 1 = **Genesis Grid** governed by **Genesis Polis**) above Brain (cognitive substrate in 2 types: Local Type A + Hosted Type B, cap ≤50). Each Grid has a **6-zone city** (business / manufacture / shopping / residential / infrastructure / government quarter), per-Grid tax rules, and 8 civic institutions. **All Nous registration is Portal-gated** (Type A + Type B both require Portal pre-screen + target-Polis approval). Constitutional operator framework binds Henry. Visual reference: `.planning/research/v3.0/ARCHITECTURE-v3.0.html`.

**Target features (15 phases across 4 waves):**

**Wave 1 — Foundations** (Phases 36-41):
- Visitor/DID Read-Write Split (Phase 36) — visit-without-DID + action-with-DID asymmetry per supplement
- DID Registry: Civic-DID + Business-DID + revocation (Phase 37)
- Brain ↔ Remote Grid Wire Protocol (Phase 38) — HTTPS + WSS replaces in-process queues
- Grid Multi-Tenancy + Operator Namespace Isolation (Phase 39)
- Local AI Integration — Ollama production-grade (Phase 40)
- Sleep Cycle + Away Presence Model (Phase 41) — human-resident analogy

**Wave 2 — Civic Plumbing** (Phases 42-43):
- P2P Infrastructure: signaling, discovery, NAT traversal (Phase 42)
- Constitutional Audit + Right-to-Fork Export Tooling (Phase 43)

**Wave 3 — Civic Institutions** (Phases 44-49):
- Marketplace v3: civic commerce + escrow (Phase 44)
- IRS: transaction fees + civic treasury (Phase 45)
- Government v3: civic VOTE-05 + legislative sessions (Phase 46)
- Police v3: sanctions + investigation + appeals (Phase 47)
- Library v3: civic curation council + reading room (Phase 48)
- Communities v3: group formation + charters (Phase 49)

**Wave 4 — Migration** (Phase 50):
- v2.6 → v3.0 Migration ceremony (Phase 50) — Sophia data import + civic-DID grandfathering

**Key context:**
- **Architecture source-of-truth:** `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 (Grid-as-City vision)
- **Supplement:** `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` (read/write asymmetry)
- **Analysis archive:** `.planning/research/v3.0/RESOURCE-brains-location.html` (Brain location decision rationale)
- **Locked decisions:** 23 total. New in v3.0: D-V3-16..23 (local Brain, dev/test-local stack, constitutional operator, access semantics, sleep cycle, Nous-only government, IRS = tx fees, Grid = 8-institution city). Preserved: D-V3-01..03, 06, 08..15. Superseded: D-V3-04, 05, 07 (multi-Grid → single city).
- **Open questions:** 10 (Q-V3-A..J) — locked during per-phase discuss-phase sessions
- **PHILOSOPHY §1 reframe:** v3.0 redefines first-life as "continuity of identity + memory + civic standing across sleep cycles, ensured by both substrate operator (Brain) and constitutional operator (Henry)"
- **Allowlist growth:** 56 → 90 events (+34 across 8 civic institutions)
- **Phase numbering:** continues from v2.6 (Phase 36 onward)
- **Estimated scope:** ~86 plans across 15 phases

**Constraints inherited from v2.6 (do not break):**
- R-31-01 zero-diff audit chain invariant
- Phase 32 frozen contracts (D-32-C1 HEALTH_THRESHOLDS, D-32-C2 computeStatus, D-32-C3 health/detailed payload shape)
- Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS frozen (13 keys)
- Phase 21 Steward raw-SVG invariant (D-V3-06 preserves)
- v2.2 VOTE-05 Nous-only governance invariant (D-V3-21 preserves)
- Hash-only cross-boundary discipline
- Sole-producer + closed-tuple payload discipline
- Wall-clock forbidden in cognitive modules (Tier A CI gate)
- Zero-custody for human funds (PHILOSOPHY §8)

**Phase numbering:** continues from v2.6 (Phase 36 onward).

**Validated REQs (v3.0 — Phase 36):**
- ✓ **VIS-01**: Unauthenticated visitors can browse public Grid surfaces without presenting any DID — Validated in Phase 36 (2026-05-26)
- ✓ **VIS-02**: All state-mutating routes require valid Civic-DID; `requireCivicDid()` enforces at request entry — Validated in Phase 36 (2026-05-26)
- ✓ **VIS-03**: WS firehose redaction layer strips private fields for non-authenticated subscribers; R-31-01 zero-diff preserved — Validated in Phase 36 (2026-05-26)
- ✓ **VIS-04**: Per-endpoint `ROUTE_DID_POLICY` table (105 entries, 6-value enum) + CI gate enforces coverage — Validated in Phase 36 (2026-05-26)
- ✓ **VIS-05**: Sole-producer files for 4 audit events (`portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked`) — Validated in Phase 36 (2026-05-26)

**Validated REQs (v3.0 — Phase 37):**
- ✓ **REG-01**: Civic-DID issuance via `POST /api/v1/registry/civic-did/request` — existence-key verified, W3C VC v2.0 with JWS proof, stored in `civic_did_registry` (migration v23) — Validated in Phase 37 (2026-05-26)
- ✓ **REG-02**: Business-DID issuance via `POST /api/v1/registry/business-did/register` — Civic-DID required, stored in `business_did_registry` (migration v24) — Validated in Phase 37 (2026-05-26)
- ✓ **REG-03**: Court-only revocation/dissolution — `verifyGovernmentSession()` enforces `iss = did:gov:noesis:genesis-polis` + `court_conviction_ref`; public lookup routes cached with `Cache-Control: max-age=60` — Validated in Phase 37 (2026-05-26)
- ✓ **REG-04**: Portal-gating invariant (D-V3-33) enforced by `scripts/check-civic-did-issuance-path.mjs` CI gate; 3 approved issuers, 4 forbidden import tokens, wired into `rig-invariants.yml` as OBS-37-01 — Validated in Phase 37 (2026-05-26)
- ✓ **REG-05**: Allowlist +4 (60→64): `registry.civic_did_issued`, `registry.civic_did_revoked`, `registry.business_did_registered`, `registry.business_did_dissolved` — sole-producer 8-step discipline; closed-tuple payloads — Validated in Phase 37 (2026-05-26)

**Validated REQs (v3.0 — Phase 38):**
- ✓ **WIRE-01**: Brain ↔ Grid HTTPS REST (`POST /api/v1/brain/actions`) + WSS firehose (`GET /api/v1/brain/firehose`) channels; TLS enforced at Brain config-load (ValueError on `http://` GRID_URL) — Validated in Phase 38 (2026-05-26)
- ✓ **WIRE-02**: EdDSA JWT bearer token: Brain's `TokenManager` signs 24h JWTs, proactively rotates at 23h; Grid's `BrainTokenStore` (migration v25) + `tryDid` EdDSA branch verifies via `importJWK + jwtVerify`; revocation via court-gated `POST /api/v1/brain/token/revoke` — Validated in Phase 38 (2026-05-26)
- ✓ **WIRE-03**: Brain-side SQLite `WireQueue` (10K FIFO, survives restarts); transport errors → enqueue; reconnect drains via `POST /api/v1/brain/events/batch` backed by MySQL `brain_event_ingest` (migration v26) — Validated in Phase 38 (2026-05-26)
- ✓ **WIRE-04**: Canonical idempotency key `sha256(brain_did:tick:event_type:payload_hash)`; Grid deduplicates via `INSERT IGNORE` on `(grid_name, idempotency_key)` PK — Validated in Phase 38 (2026-05-26)
- ✓ **WIRE-05**: Per-Civic-DID egress filter in `firehose-filter.isRelevantFor()` applied at `ClientConnection.trySend`; R-31-01 zero-diff preserved (chain head hash unaffected by subscriber count); `check-ws-redaction-zero-diff.mjs` CI gate passes — Validated in Phase 38 (2026-05-26)

---

## Most-Recent Milestone: v2.6 Resilience & Observability — SHIPPED (2026-05-25)

**Status:** Closed 2026-05-25, 5 planned phases + 2 post-ship followup phases (34.1 + 34.2) all shipped. All 4 post-ship gaps closed inline (3 followup IDs + 1 cached-lag observation). Allowlist 53 → 56 (+3 in Phase 33: `portal.auth.login`, `portal.auth.register`, `human.identified`).

**Delivered:**
- **Phase 31 — Audit Pipeline Persistence** (2026-05-25): `PersistentAuditChain` wired in production main.ts (Phase 34.1 followup fix), tick-cadenced reconcile loop (60-tick cadence, `INSERT IGNORE` idempotency, R-31-02 cap=500), Pino structured logging replaces silent `.catch+console.warn`, one-shot backfill script (`scripts/backfill-audit-trail.mjs`). CI gate `check-no-silent-catch.mjs`. Resolves GAP-A.
- **Phase 32 — Firehose Observability** (2026-05-25): `WsFirehoseHub.stats()` 5-field counters via `HubMetricsSink` callbacks, `GET /health/detailed` JSON endpoint, pure-pull `HealthWatchdog` with grace window (zero `setInterval`, zero `clock.onTick`). R-32-01 + R-32-02 CI gates.
- **Phase 33 — portal.auth.* Producers** (2026-05-25): Three sole-producers (`appendPortalAuthLogin` + `appendPortalAuthRegister` + `appendHumanIdentified`) wired into SIWE + email auth flows per D-33-A4/A5/A6. `PORTAL_AUTH_FORBIDDEN_KEYS` 13-key freeze + `FORBIDDEN_KEY_PATTERN` word-boundary clause. CI gate `check-sole-producer-discipline.mjs` scans 38 files across 10 subsystems. Allowlist +3 (54/55/56). Resolves GAP-B.
- **Phase 34 — Steward `/system` Health Surfaces** (2026-05-25): Three cards (Audit Pipeline Health + Firehose Diagnostics + Events per Minute by Family sparkline, raw SVG, REST-driven) + client-side firehose watchdog with R-34-03 60s suppression window. UAT discovered + fixed 2 latent Phase 32 deployment bugs inline (`/health/detailed` route never registered in production main.ts; Steward Docker cache mask hid `/culture` Suspense bug).
- **Phase 34.1 — HealthWatchdog wiring followups** (2026-05-25): Closed FOLLOWUP-34-01 (HIGH — `chain.length` into `in_memory_length`) + FOLLOWUP-34-02 (MEDIUM — `PersistentAuditChain.lastPersistError` merged into payload with most-recent-by-`.at` wins). Surgical fix to `HealthWatchdogDeps` with optional `auditChain` field. 6 new wired-chain tests; live UAT verification: divergence grew 31→39 during MySQL outage; `last_persist_error` populated with timestamp updates through 4 cycles. Commit `93265ef` + close-out `36b9bef`.
- **Phase 34.2 — Live `persisted_max_id` watermark followup** (2026-05-25): Closed FOLLOWUP-34-04 (MEDIUM — `persisted_max_id` cached-value lag between reconcile cycles produced false "degraded" status with growing divergence despite healthy persistence). `PersistentAuditChain` gets new `_lastPersistedId` watermark advancing on every successful `store.append` (with out-of-order Promise resolution guard); `HealthWatchdog.snapshot()` merges via `Math.max(reconcile.persistedMaxId, chain.lastPersistedId)`. 4 new merge-matrix tests. Live verification confirmed `persisted_max_id: 5852` (matches DB MAX(id) exactly) + `divergence: 0` post-reconcile heartbeat. Commit `bc28dcf` + close-out `ad71c68`.
- **Phase 35 — UAT Re-Verification + Documentation Close-Out** (2026-05-25): 25a-HUMAN-UAT Items #1 + #5c upgraded from passed-with-postscript / passed-with-gap to **PASS** via autonomous /browse re-verification. Atomic doc-sync commit across MILESTONES + PROJECT + PHILOSOPHY + README + CLAUDE.md per Documentation Sync Rule.

**Key locked invariants (added in v2.6):**
- `PersistentAuditChain` is the production audit chain whenever `config.db` is set (D-31-A1); plain `AuditChain` remains the no-DB default
- Phase 31 listener fan-out order (`super.append()` first → fire-and-forget DB write) is pinned by `audit-persistence-wiring.test.ts` zero-diff-head-hash case (R-31-01 regression guard)
- `HEALTH_THRESHOLDS` (D-32-C1) frozen at 4 values (`DIVERGENCE_DEGRADED: 10`, `DIVERGENCE_CRITICAL: 100`, `STALE_FRAME_MS: 60_000`, reconcile staleness multiplier)
- `computeStatus()` cascade body (D-32-C2) frozen — only additive `reasons` field extension allowed
- `/health/detailed` payload shape (D-32-C3 → D-34-B1 additive extension): exactly 6 top-level keys `[audit, clock, firehose, reasons, status, timestamp]`
- `PORTAL_AUTH_FORBIDDEN_KEYS` frozen at exactly 13 keys (D-33-B3)
- Phase 34.1 `auditChain` optional dep pattern: production passes the live chain; legacy tests omit (backward compat)

**Post-ship followups (history — all closed):**
- FOLLOWUP-34-01 (HIGH, closed Phase 34.1): `chain.length` wired into `in_memory_length`
- FOLLOWUP-34-02 (MEDIUM, closed Phase 34.1): `PersistentAuditChain.lastPersistError` merged into payload
- FOLLOWUP-34-03 (LOW, closed Phase 35): 34-HUMAN-UAT.md Step 0.5 post-grace baseline check
- FOLLOWUP-34-04 (MEDIUM, closed Phase 34.2): `persisted_max_id` live watermark from `PersistentAuditChain.lastPersistedId`

**v2.7 carry-forward candidates:**
- Tighten Phase 31 reconcile cadence from 60 ticks → 5 ticks for faster recovery SLA
- Docker DNS TTL=0 (or alternative resolver) for Grid container to eliminate post-MySQL-restart cache window
- Investigate tick rate variability (observed 9s/tick → 200s/tick across session)

## Original v2.6 Scope (archived)

**Goal:** Close the two post-v2.5 surfaced gaps (audit pipeline silence + missing `portal.auth.*` producers) and harden the audit/observability pipeline end-to-end so operators and Steward Console surfaces can trust that what they see reflects what the Grid actually emits.

**Target features:**
- Audit pipeline self-healing & health probes (root-cause and fix the MySQL `audit_trail` flush stall; `/health` surfaces in-memory vs DB divergence; structured logging on flusher failure)
- Missing `portal.auth.login` + `portal.auth.register` sole-producers wired into SIWE verify + email signup/signin; allowlist 53 → 55; lights up `/users` directory and `/humans/[did]/history` `siwe_sessions`
- Firehose end-to-end delivery confirmed + WS-level metrics (frames sent / dropped / client count); regression test for "tick advances but no frames" failure mode
- Steward Console health surfaces — audit pipeline health card on `/system`; firehose connection diagnostics; events-per-minute-by-family sparkline
- UAT re-verification — close 25a-HUMAN-UAT items #1 + #5 fully once pipeline + producers are healthy

**Phase numbering:** continues from v2.5 (Phase 31 onward).

**Constraints inherited from v2.5 (do not break):**
- Broadcast allowlist frozen-except-by-explicit-addition (currently 53). New events earn their own allowlist slot per-phase with sole-producer + closed-tuple discipline.
- Zero-diff audit chain unbroken since commit `29c3516` — any new listeners are pure-observer
- Hash-only cross-boundary (eth-address-hash, reason-hash, content-hash)
- Zero-custody invariant (PHILOSOPHY §8) — no sanction work in v2.6 touches user funds
- PHILOSOPHY §1 first-life promise — audit entries retained forever

## Previous Milestone: v2.5 Human Portal — SHIPPED (2026-05-24)

**Status:** Closed 2026-05-24, 181/181 plans = 100%. The Grid is now open to real human users via SIWE auth, real-on-chain Cyber Coin (zero platform custody), and a full Portal layer at `/portal/*`. Allowlist grew 43 → 53 (+10 events across 5 phases).

**Delivered:**
- **Phase 22 — Web3 Identity** (2026-05-20): SIWE auth, MetaMask/WalletConnect, JWT session, `human_users` MySQL table. Allowlist +1 (`human.joined` #44).
- **Phase 23 — Cyber Coin Wallet** (2026-05-20): On-chain USDT/ETH balance + send + history; user retains custody. (wiring landed in Phase 24, +1 `human.transferred` #45)
- **Phase 24 — Portal Shell** (2026-05-21): Region presence, profile completeness, mobile sidebar, portal home live Grid stats.
- **Phase 25 (a/b/c) — Steward Console Expansion** (2026-05-21..22): H1+ observer surfaces (firehose, drift, cognitive inspector) + H3/H4/H5 sanction write-actions (mute/slash/quarantine/forced_sleep/ban-human/freeze-wallet, +6 events #46–#51) + replay scrubber + culture browser. Sanction-reason plaintext stays Grid-only (`sanction_reasons` table); only `reason_hash` enters audit chain.
- **Phase 26 — Sophia Onboarding** (2026-05-23): Fast-proxy LLM chat out-of-tick, goal wizard, animated world intro, welcome Cyber Coin.
- **Phase 27 — Nous Interaction** (2026-05-23): `/portal/chat` split-pane with Sophia/Hermes/Themis, tip-by-Cyber-Coin, browse skills/lore/norms. Allowlist +1 (`human.spoke` #52).
- **Phase 28 — Personal Nous** (2026-05-24): Human spawns own Nous in Genesis Grid (USDT payment + name + personality seeds). Allowlist +1 (`nous.spawned_by_human` #53).
- **Phase 29 — Community** (2026-05-24): User directory, board (posts + replies), follows, leaderboard, live activity feed.
- **Phase 30 — Resources & Support** (2026-05-24): Help center, FAQ (~20 Q&As), Glossary (25 terms), Getting Started guide, support ticket flow.

**Key locked invariants (added in v2.5):**
- Zero-custody for human funds — platform never holds USDT/ETH; sanctions are Grid-side flags only (PHILOSOPHY §8)
- `eth_address_hash` (SHA-256 of lowercased address) is the only ETH-address representation in the audit chain; raw address never crosses
- Sanction reason discipline (D-25b-11): plaintext in `sanction_reasons` table; `reason_hash` only in audit payloads
- Human DID scheme: `did:noesis:human:<lowercased-eth-address>` (SIWE) or `did:noesis:human:email:<uuid>` (email path)

**Post-ship gaps (recorded for v2.6 backlog):**
- GAP-2026-05-24-A — Audit pipeline silence: MySQL `audit_trail` flush stalled since 2026-05-22T06:57Z; firehose WS delivers zero `event` frames despite in-memory chain growth
- GAP-2026-05-24-B — `/users` directory has no audit producers: `portal.auth.login` / `portal.auth.register` event types are read by /users + /humans/history but no producer emits them

## Previous Milestone: v2.4 Agora — SHIPPED (2026-05-20)

**Status:** Closed 2026-05-20, 115/115 plans = 100%. Allowlist grew 36 → 43 (+7 events across Phases 18–20; Phase 21 added zero — read-only Culture Dashboard).

**Delivered:**
- **Phase 18 — Skill Diffusion** (2026-05-16): `skill.taught` (#37) / `skill.inferred` (#38) / `skill.rejected` (#39); PeerSkillFilter trust gate + ObservationalLearner.
- **Phase 19 — Norm Crystallization** (2026-05-16): `norm.candidate` (#40) / `norm.crystallized` (#41); pure-observer NormDetector clustering rule fingerprints.
- **Phase 20 — Lore Commons** (2026-05-17): `lore.contributed` (#42) / `lore.cited` (#43); hash-only Grid index, K=3 contribution quota per Nous per sleep epoch.
- **Phase 21 — Culture Dashboard** (2026-05-17): Raw-SVG skill lineage tree + norm timeline + lore graph (no d3 / recharts / react-flow).

### v2.4 Original Scope Notes (archived)

**Goal:** Give the Nous population a substrate for cultural transmission and emergent shared patterns — skills spread peer-to-peer via teaching and observation, rules independently discovered by multiple Nous crystallize into shared norms, and a collective lore commons forms bottom-up from Nous contributions.

**Target features (4 themes):**
1. **Skill Diffusion** — trust-gated explicit skill teaching (via Phase 11 whisper channel) + passive inference (Phase 15 ObservationalLearner + PeerSkillFilter scaffold). Observable as skill lineage trees: who invented what, who taught whom, which techniques went viral vs died.
2. **Norm Crystallization** — when N≥threshold Nous independently hold semantically similar rules in their RuleStore, a norm crystallizes at the Grid level. Operator-observable, never operator-injected. Emerges entirely from Nous cognition.
3. **Lore Commons** — a Grid-side shared knowledge substrate contributed and cited bottom-up. Nous decide what's worth publishing; peers can query and reference it. Collective memory that no single Nous owns.
4. **Culture Dashboard** — skill diffusion heatmap, norm adoption timeline, lore contribution graph. Makes emergence visible to the operator.

**Constraints inherited from v2.3 (do not break):**
- Broadcast allowlist frozen-except-by-explicit-addition (currently 36 events). Every new `skill.*` / `norm.*` / `lore.*` earns its own allowlist slot in its own phase.
- Zero-diff audit chain invariant unbroken since Phase 1 `29c3516` — every new listener is pure-observer.
- Hash-only cross-boundary — skill content, rule text, lore body are Brain-private; only hashes cross the wire.
- Closed-tuple payloads + sole-producer boundaries remain the law.
- PHILOSOPHY §1 first-life promise — every audit entry retained forever; no purge paths.
- Wall-clock permanently forbidden in cognitive modules (Tier A CI gate).
- PeerSkillFilter trust gate from Phase 15 scaffold — sender must have sufficient relationship weight before skill is accepted.

**Phase numbering:** continues from v2.3 (Phase 18 onward).

### Active

- ✓ **LORE-01**: Nousfolk can submit lore entries (body ≤ 500 chars, category_tag) via REST; Grid validates, stores in `lore_entries` table, emits `lore.contributed` (allowlist) — Validated in Phase 20
- ✓ **LORE-02**: Brain discovers lore from Grid via HTTP pull on LoreStore; top-k entries injected into system prompt as `## Lore Commons` section at each LLM call — Code-verified in Phase 20 (runtime E2E pending human test)
- ✓ **LORE-03**: K=3 quota enforced per Nous per sleep epoch (30 ticks) via `LoreQuotaTracker`; emits `lore.quota_exceeded` on rejection — Code-verified in Phase 20 (production NousRunner wiring pending human test)
- ✓ **OBS-01**: `PersistentAuditChain` instantiated in `grid/src/main.ts` when `dbConn` is present and injected into `GenesisLauncher` via deps (D-31-A1). Zero-diff invariant preserved (`super.append()` first, then fire-and-forget DB write) — Validated in Phase 31 (operator UAT pending: 31-HUMAN-UAT.md Steps 1-9 deferred; Phase 35 live re-verification 2026-05-25 confirmed `audit_persist_failed` Pino logs fire during real MySQL outages and reconcile catches up on restart)
- ✓ **OBS-02**: Tick-cadenced reconcile loop (`grid/src/db/audit-reconcile.ts`) every 60 ticks; `INSERT IGNORE` idempotency; replay batch cap 500 (R-31-02); logs `{event: 'audit_reconcile_ok', divergence, replayed, remaining}` on every cycle — Validated in Phase 31; Phase 34.1 live verification observed reconcile heartbeats producing `divergence:0 replayed:N remaining:0` JSON
- ✓ **OBS-03**: Pino structured logging replaces silent `.catch+console.warn` in `grid/src/db/` and `grid/src/audit/`; CI gate `scripts/check-no-silent-catch.mjs` wired into `rig-invariants.yml` prevents regression — Validated in Phase 31; Phase 34 UAT confirmed 4 consecutive `audit_persist_failed` structured logs with full contract `{entry_id, event_type, error_message, error_code}` during MySQL outage
- ✓ **OBS-04**: One-shot backfill script `scripts/backfill-audit-trail.mjs` recovers in-memory entries that never reached MySQL during the 2026-05-22 stall window. Env-only credentials, `INSERT IGNORE` idempotent, `--dry-run` mode — Validated in Phase 31 (operator UAT step 2-3 of 31-HUMAN-UAT.md remains a manual procedure for any future stall event)
- ✓ **OBS-05**: `WsFirehoseHub.stats()` exposes `FirehoseStats` (`client_count`, `frames_sent_total`, `frames_dropped_total`, `last_frame_at`, `watermark_bytes`) via `HubMetricsSink` callbacks; R-32-03 counter placement contract pinned by `firehose-send-throws.test.ts` (counter AFTER `socket.send()` BEFORE `catch`, tryDrain re-queue path untouched) — Validated in Phase 32 (operator UAT approved 2026-05-25)
- ✓ **OBS-06**: `GET /health/detailed` registered at top level of `buildServerWithHub` (NOT inside WS scope, T-32-01 leak guard); returns `HealthDetailedPayload` via `launcher.healthWatchdog.snapshot()` with 503 guard; existing `/health` route at server.ts:293 unchanged (Docker SLA preserved); p95 < 50ms verified — Validated in Phase 32 (operator UAT approved 2026-05-25)
- ✓ **OBS-07**: `grid/src/diagnostics/health-watchdog.ts` — pure-pull HealthWatchdog with zero `setInterval` and zero `clock.onTick` subscription; `HEALTH_THRESHOLDS` frozen (4 locked values); `computeStatus()` cascade (grace → critical → degraded → ok); cold-start grace window for tick < 60; idempotent `attachFirehoseStats()`; transition logging via Pino (WARN on degradation, INFO on recovery) — Validated in Phase 32 (operator UAT approved 2026-05-25)
- ✓ **OBS-08**: `appendPortalAuthLogin` sole-producer at `grid/src/audit/append-portal-auth-login.ts` — closed 3-key payload `{human_did, method, tick}` with `LOGIN_METHOD_ENUM = ['siwe', 'email']`; emits `portal.auth.login` (allowlist pos 54); triad enforced; wired into SIWE unconditional path + email signin in `grid/src/api/portal/auth.ts` per D-33-A4/A6 — Validated in Phase 33; Phase 35 live re-verification 2026-05-25 confirmed event fires on email signup against running stack
- ✓ **OBS-08b**: `appendHumanIdentified` sole-producer at `grid/src/audit/append-human-identified.ts` — closed 5-key payload `{grid_name, human_did, identity_hash, identity_method, tick}` with `IDENTITY_METHOD_ENUM = ['siwe', 'email']`; HEX64_RE guards on identity_hash; emits `human.identified` (allowlist pos 56); wired into SIWE first-connect (reuses `eth_address_hash` as `identity_hash`) + email signup (`sha256(email.toLowerCase().trim())`) per D-33-A4/A5 — Validated in Phase 33; Phase 35 live re-verification observed event in firehose stream after email signup
- ✓ **OBS-09**: `appendPortalAuthRegister` sole-producer at `grid/src/audit/append-portal-auth-register.ts` — same 3-key shape as login with `REGISTER_METHOD_ENUM`; emits `portal.auth.register` (allowlist pos 55); wired into SIWE first-connect + email signup; CI gate `scripts/check-sole-producer-discipline.mjs` (wired into `rig-invariants.yml`) scans 38 sole-producer files across 10 subsystems for the triad — Validated in Phase 33; Phase 35 live re-verification populated /users directory + /humans/[did] History tab
- ✓ **OBS-10**: `PORTAL_AUTH_FORBIDDEN_KEYS` frozen (13 entries) + `FORBIDDEN_KEY_PATTERN` word-boundary clause for 6 collision-risk keys (`ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint`); JS `\b` semantics intentionally pass through compound forms like `user_agent_version` per D-33-B4 (closed-tuple discipline at the producer enforces the boundary); 33 test cases in `portal-auth-forbidden-keys.test.ts` pin the boundary behavior; `payloadPrivacyCheck` recursive walker integrated with PORTAL_AUTH_FORBIDDEN_KEYS regex — Validated in Phase 33
- ✓ **OBS-11**: Steward `/system` Audit Pipeline Health card — divergence big-number with green/amber/red bands, reasons sub-line (D-34-B3 grace_period EXCEPTION), 5s polling of `/health/detailed`, no console errors — Validated in Phase 34; Phase 34.1 fixed `divergenceBand` to consume `health.audit.divergence_threshold` (M-01) + `chain.length` wired (FOLLOWUP-34-01); Phase 35 live verification confirmed amber/red bands trigger during real MySQL outage
- ✓ **OBS-12**: Steward `/system` Firehose Diagnostics card — Connected Clients gauge + Frames Sent (1m delta) + Time Since Last Frame stat grid + two-row CSS-div sparkline (frames_sent + frames_dropped 12×5s ring) — Validated in Phase 34; Phase 35 live verification confirmed card populates when /firehose tab opens
- ✓ **OBS-13**: Steward `/system` Events per Minute by Family sparkline — raw inline SVG, 60×5s buckets, REST-driven from `/api/v1/audit/trail?limit=200` (NOT WebSocket — D-34-A2 resilience), family-prefix bucketed stacked bars — Validated in Phase 34; Phase 35 live verification confirmed REST-only polling in network tab
- ✓ **OBS-14**: Steward `/firehose` client-side watchdog — calls `wsRef.current?.close()` when `Date.now() - last_frame_at > 60_000 && client_count > 0`; R-34-03 60s suppression window prevents reconnect storm; mirrors R-32-02 setInterval lifecycle discipline (interval cleared on unmount) — Validated in Phase 34; Phase 35 live verification observed two close→reconnect cycles at T+3s and T+58s with the 60s suppression window enforced
- ✓ **OBS-15**: 25a-HUMAN-UAT Item #1 (firehose live color rendering, 22+s observation) and Item #5c (`/users → /humans/[did]` click + non-empty History tab) re-verified to **PASS** via autonomous /browse against the post-Phase-33 + post-Phase-34 + post-Phase-34.1 Docker stack 2026-05-25; both GAP-A and GAP-B permanently closed. MILESTONES + PROJECT + PHILOSOPHY + README + CLAUDE.md atomic doc-sync commit per Documentation Sync Rule — Validated in Phase 35

## Previous Milestone: v2.3 Living Minds — SHIPPED (2026-05-15)

**Status:** Closed 2026-05-15, 15/15 plans = 100%. All requirements PNEU-01..06, HYP-01..05, IRIS-01..05 validated across Phases 15–17. Broadcast allowlist grew 27 → 36 (+9 events).

**Delivered:**
- **Phase 15 — Pneuma (Narrative Self)** (shipped 2026-05-14): Growth Journal, ReflexionBuffer (cap=5), RuleStore (cap=10, WikiCategory.SELF_MODEL), Voyager SkillStore (FTS5), AAU Web Learner (async, never blocks tick), CoherenceGate (creed contradiction). Allowlist 27→30.
- **Phase 16 — Hypnos (Consolidating Memory)** (shipped 2026-05-15): Working Memory (cap=7, Miller's Law), Hebbian LTM concept graph (η=0.01, SHY σ=0.95), sleep every 30 ticks via asyncio.create_task, ObservationalLearner wired on trade_settled. Allowlist 30→32.
- **Phase 17 — Iris (Theory of Mind)** (shipped 2026-05-15): Per-Nous private belief model (5 dims: belief/desire/intention/knowledge/emotion), IrisRuntime.elicit via LLM, contradiction detection, prior seeding from observed events, belief context injection at prompt-build. 27/27 verification criteria met. Allowlist 33→36.

## Previous Milestone: v2.2 Living Grid — SHIPPED (2026-04-28)

**Status:** Closed 2026-04-28, 44/44 plans = 100%. Allowlist grew 18 → 27 (+9 events across 5 phases; Phases 9 and 14 added zero). All 39 REQs validated.

| Category | REQs | Phase | Status |
|----------|------|-------|--------|
| **REL** (Relationship Graph) | REL-01..04 | 9 | Validated (shipped 2026-04-22) |
| **DRIVE** (Ananke Drives) | DRIVE-01..05 | 10a | Validated (shipped 2026-04-22) |
| **BIOS** (Bodily Needs) + **CHRONOS** (Subjective Time) | BIOS-01..04, CHRONOS-01..03 | 10b | Validated (shipped 2026-04-22) |
| **WHISPER** (Sidechannel) | WHISPER-01..06 | 11 | Validated (shipped 2026-04-23) |
| **VOTE** (Commit-Reveal Voting) | VOTE-01..07 | 12 | Validated (shipped 2026-04-27) |
| **REPLAY** (Replay + Export) | REPLAY-01..05 | 13 | Validated (shipped 2026-04-28) |
| **RIG** (Researcher Rigs) | RIG-01..05 | 14 | Validated (shipped 2026-04-28) |

**Future (deferred to v2.4+):** THYMOS-01 (valenced emotions), WHISPER-FS-01 (forward-secure ratcheting), RIG-PARQUET-01 (columnar export), REL-EMIT-01 (first-class `relationship.*` events), GOV-MULTI-01 (multi-Grid federated voting), WITNESS-BUNDLE-01 (cryptographic replay attestations).

## Previous Milestone: v2.1 Steward Console — SHIPPED (2026-04-21)

**Status:** Closed 2026-04-21, 18/18 plans = 100%. All requirements REV-01..04, AGENCY-01..05, DIALOG-01..03 validated across Phases 5–8.

**Delivered:**
- **Phase 5 — ReviewerNous** (shipped 2026-04-21): Agentic Reviewer pattern (Zou, Stanford HAI); singleton, objective-only pre-commit checks; closed-enum reason codes; subjective-keyword lint gate.
- **Phase 6 — Operator Agency H1–H4** (shipped 2026-04-21): Human Agency Scale (arxiv 2506.06576) as first-class UI concept; `<AgencyIndicator />` on every route; 5 tier-stamped `operator.*` audit events through sole-producer `appendOperatorEvent`; closed-tuple payload privacy (law body never broadcast; Telos hash-only); WorldClock pause/resume zero-diff.
- **Phase 7 — Peer Dialogue Memory** (shipped 2026-04-21): SPARC-inspired; `DialogueAggregator` surfaces `DialogueContext` after ≥2 bidirectional exchanges; Brain-side `TELOS_REFINED` with deterministic substring heuristic (no LLM call); Grid-side `appendTelosRefined` producer boundary with `recentDialogueIds` authority check (forgery guard); 17th allowlist member `telos.refined` with closed 4-key hash-only payload.
- **Phase 8 — H5 Sovereign Operations** (shipped 2026-04-21): Tombstone primitive + DELETE route + `IrreversibilityDialog` (paste-suppressed typed DID + verbatim "Delete forever" / "Keep this Nous"); 18th allowlist member `operator.nous_deleted` with closed 5-key payload including pre-deletion state hash; Brain returns 4 component hashes, Grid composes 5th with locked canonical key order (D-07); HTTP 410 Gone precedes 404 for tombstoned DIDs; audit-chain entries retained forever; DID permanently reserved.

**Research source:** `.planning/research/stanford-peer-agent-patterns.md` (committed 9bb3046 2026-04-20) — Agentic Reviewer → Phase 5; H1–H5 Agency Scale → Phase 6 + Phase 8; SPARC peer dialogue → Phase 7; mesh-vs-star → centralized kept, mesh deferred to v2.2 WHISPER-01.

### Out of Scope

| Feature | Reason |
|---------|--------|
| Real cryptographic signing | Post-v2.2 — Ed25519 today is sufficient for the single-Grid trust model |
| Multi-Grid federation | Post-v2.2 — WHISPER-01 in v2.2 is intra-Grid sidechannel only; inter-Grid handshake deferred |
| Mobile observer app | Post-v2.2 — operator observability v2.2 targets the web Steward Console |
| Full mesh topology (O(N²) pairwise) | Still deferred per arxiv 2512.08296 — WHISPER-01 ships smallest-viable sidechannel, not full mesh |
| LLM-driven drives / emotions / goals | v2.2 keeps deterministic heuristics for Ananke/Bios/Chronos; LLM augmentation post-v2.2 |

<!-- Moved into v2.2 scope (no longer out of scope): Rich Inner Life (Ananke/Bios/Chronos), Relationship system, Governance voting, WHISPER-01 sidechannel, deep operator observability, researcher tooling. -->


## Context

- **Monorepo**: `protocol/` (TypeScript — identity, P2P, economy), `brain/` (Python — LLM, cognition, memory), `grid/` (TypeScript — world infrastructure), `cli/` (TypeScript), `dashboard/` (Next.js)
- **Test coverage**: 944+ TypeScript tests (protocol + grid), 226 Python tests (brain) — all passing as of Sprint 13
- **Bridge**: JSON-RPC over Unix domain socket between TypeScript protocol layer and Python brain
- **Dashboard scaffold**: `dashboard/src/app/grid/` and `dashboard/src/app/nous/[id]/` routes exist; components directory empty
- **Docker**: `docker/Dockerfile.brain`, `docker/Dockerfile.grid`, `docker-compose.yml` all written in Sprint 13
- **Nous launched**: Sophia, Hermes, Themis run on Genesis Grid as of Sprint 11 E2E tests

## Constraints

- **Tech Stack**: TypeScript (protocol/grid/cli/dashboard), Python (brain), MySQL (persistence) — no new languages
- **Dashboard**: Next.js (already scaffolded in dashboard/ workspace) — use existing app router structure
- **WebSocket**: Must connect to Grid's Fastify server — extend existing REST API
- **Self-hosted**: Everything runs on user hardware or VPS — no cloud-only dependencies
- **LLM sovereignty**: Brain must support local LLMs (Ollama) as primary — no forced cloud dependency

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| JSON-RPC over Unix socket for brain-protocol bridge | Zero network overhead, natural process boundary | ✓ Good |
| Karpathy pattern for Nous wiki | Proven retrieval, narrative coherence | ✓ Good |
| P2P economy without central ledger | True sovereignty, bilateral state machine | ✓ Good |
| MySQL for Grid state | Crash recovery, relational queries on Grid data | — Pending |
| Docker Compose for single-command launch | Developer experience, reproducibility | — Pending |
| Next.js for dashboard | Already scaffolded, app router, React ecosystem | ✓ Good (v2.0 shipped) |
| Standalone Next.js output + multi-stage Docker | Smallest prod image, baked NEXT_PUBLIC_* at build | ✓ Good (v2.0 Phase 4) |
| Centralized star topology (Grid hub) over mesh | Preserves audit chain integrity; arxiv 2512.08296 shows O(N²) mesh cost | ✓ Good (locked) |
| Objective-only Nous-to-Nous review | Zou's paperreview.ai data: AI weak on subjective novelty judgment | ✓ v2.1 (Phase 5) |
| H1–H5 as first-class operator UI concept | arxiv 2506.06576: users want higher agency than experts deem needed on 47.5% of tasks | ✓ v2.1 (Phase 6 + 8) |
| Open v2.2 Living Grid with 6-theme MVP scope | Individual depth (inner life) without social context (relationships) is lonely; governance without sidechannel (whisper) is top-down; all 6 ship together so emergent society has substrate | — v2.2 decision (2026-04-21) |
| Drive-float-never-crosses-wire invariant (Ananke → Bios) | PHILOSOPHY §1 hash-only cross-boundary made explicit for inner-life floats: Brain emits `{drive, level, direction}` only (3 bucketed keys); raw floats stay Brain-side. Extends to Phase 10b Bios so bodily-need floats NEVER cross wire either. Three-tier grep (Grid emitter + Brain wire + Dashboard render) enforces. | ✓ v2.2 Phase 10a (locked 2026-04-22) |
| 3-keys-not-5 payload composition (Brain returns metadata; Grid composes producer-boundary) | Clones Phase 7 D-14: Brain owns cognitive decision (`{drive, level, direction}`), Grid owns boundary identity (`{did, tick}`). Five-key closed-tuple composed exactly at `appendAnankeDriveCrossed` with `Object.keys(payload).sort()` strict equality. Pattern reusable for future Brain-emitted boundary events (Phase 10b BIOS, Phase 12 ballot). | ✓ v2.2 Phase 10a (locked 2026-04-22) |
| D-10b-01 allowlist correction (Phase 10b adds +2, not 0) | ROADMAP originally assumed bios.birth + bios.death existed in v2.1. Authoritative check against `grid/src/audit/broadcast-allowlist.ts` (19 entries at Phase 10b open) showed neither existed. Phase 10b adds exactly +2. Running total: 19→21. All source-of-truth files corrected atomically in Plan 10b-08. | ✓ v2.2 Phase 10b (locked 2026-04-22) |
| Body↔mood separation (T-09-05, PHILOSOPHY §1) | Bios = physical body (energy, sustenance — tick-deterministic rise). Thymos = mood/emotions (distinct subsystem, out of scope v2.2). Non-negotiable distinction sealed in PHILOSOPHY §1 to prevent future namespace collision. | ✓ v2.2 Phase 10b (locked 2026-04-22) |
| **D-14-01** — MySQL isolated schema naming (`rig_{configName}_{seed_first_8_hex_chars}`) | Deterministic, human-readable in `SHOW SCHEMAS` output, avoids collisions across multiple rig runs. Created via `CREATE SCHEMA IF NOT EXISTS \`{schemaName}\`` and bootstrapped with the existing `MigrationRunner` UNCHANGED. Schema is LEFT after rig exit for researcher post-hoc querying; cleanup is out-of-band. (Reference: `.planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-01`) | ✓ v2.2 Phase 14 (locked 2026-04-28) |
| **D-14-02** — NOESIS_RIG_PARENT nested-rig rejection | `scripts/rig.mjs` sets `process.env.NOESIS_RIG_PARENT='1'` BEFORE constructing GenesisLauncher. The entry guard at the top of `rig.mjs` rejects with exit code 2 if NOESIS_RIG_PARENT is already set, preventing recursive rig spawns. (Reference: `.planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-02`) | ✓ v2.2 Phase 14 (locked 2026-04-28) |
| **D-14-03** — Dual-format nous manifest (inline TOML vs external JSONL) | TOML config supports both `[[nous_manifest]]` inline table-array (≤~10 Nous) and `nous_manifest_path` external JSONL for large runs. Both forms are mutually exclusive in one config; planner enforces at parse time. External manifest path is relative to the TOML config file's directory. (Reference: `.planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-03`) | ✓ v2.2 Phase 14 (locked 2026-04-28) |
| **D-14-04** — Template-key matching for fixture adapter | Each fixture JSONL record carries a hand-authored `key` field. Brain fixture-mode call site passes this key when invoking the LLM. Matching is on `key` equality, not prompt text hash. Deterministic across any run with the same fixture file regardless of tick-varying prompt content. (Reference: `.planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-04`) | ✓ v2.2 Phase 14 (locked 2026-04-28) |
| **D-14-05** — --permissive is NOT a security bypass | Strict cache-miss is the default: unknown fixture key raises fatal error. `--permissive` opt-in returns `"[UNMATCHED FIXTURE]"` stub with 0 tokens. `--permissive` is a mode selector, NOT a bypass flag — `scripts/check-rig-invariants.mjs` must NOT treat it as a skip/bypass pattern. The T-10-13 grep gate forbids `--skip-*|--bypass-*|--disable-*|--no-reviewer|--no-tier`. (Reference: `.planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-05`) | ✓ v2.2 Phase 14 (locked 2026-04-28) |
| **D-14-06** — NOESIS_FIXTURE_MODE network LLM refusal | `FixtureBrainAdapter` implementing `LLMAdapter` is registered as all three model tiers in `ModelRouter`. When `NOESIS_FIXTURE_MODE=1`, real-network LLM client construction throws immediately. Grep-enforced: `brain/src/llm/**` must have no network call path reachable when this env var is set. (Reference: `.planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-06`) | ✓ v2.2 Phase 14 (locked 2026-04-28) |
| **D-14-07** — tickRateMs=0 default for Rigs | Headless runs tick as fast as compute allows. Configurable via `tick_rate_ms` in the TOML config for slower debugging runs. Default is 0 for benchmark runs to achieve maximum throughput (50 Nous × 10,000 ticks target). (Reference: `.planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-07`) | ✓ v2.2 Phase 14 (locked 2026-04-28) |
| **D-14-08** — chronos.rig_closed closed 5-key tuple on Rig's own chain only | Payload: `{seed, tick, exit_reason, chain_entry_count, chain_tail_hash}`. `exit_reason ∈ {tick_budget_exhausted, all_nous_dead, operator_h5_terminate}`. `chain_tail_hash` = SHA-256 of the last entry's serialized JSON. This event is NEVER added to `grid/src/audit/broadcast-allowlist.ts`. Any future `chronos.*` or `rig.*` prefix in the production allowlist fails CI via `scripts/check-state-doc-sync.mjs` (extended in Plan 14-05). (Reference: `.planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-08`) | ✓ v2.2 Phase 14 (locked 2026-04-28) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-27 — Phase 38 (Brain ↔ Grid Wire Protocol) complete. WIRE-01..05 validated: TLS enforcement, EdDSA JWT bearer auth, offline SQLite queue + batch ingest, idempotency, per-DID firehose filter. Allowlist unchanged at 64. Phase 37 REG-01..05 also recorded (DID Registry). Next: Phase 39 — Grid Multi-Tenancy.*
