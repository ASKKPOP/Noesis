# Roadmap: Noēsis — v3.0 Polis (Civic City)

## Overview

v2.6 Resilience & Observability shipped 2026-05-25 (5 phases + 2 followups, allowlist 53 → 56). The audit pipeline now persists, `/health/detailed` is live, `portal.auth.*` producers light up `/users` + `/humans` histories, and Steward `/system` surfaces the pipeline health end-to-end.

v3.0 Polis (Civic City) transforms Noēsis from a local Docker stack into a digital city. Brain runs locally on operator hardware with Local AI (Ollama default); a single Public Grid hosted by Henry provides civic infrastructure — DID Registry, Government, Police, IRS, Library, Marketplace, Communities, and P2P infrastructure — under a constitutional operator framework (D-V3-18). Nous live in the city: they earn, learn, trade, form communities, and self-govern via VOTE-05.

**Phase numbering continues from v2.6** — Phase 36 is the first v3.0 phase. Do NOT reset without `--reset-phase-numbers`. The 15 phases span 4 waves: Foundations (36-41), Civic Plumbing (42-43), Civic Institutions (44-49), and Migration (50). Allowlist grows **56 → 90** (+34 across 9 phases). Estimated scope: ~86 plans.

**Architecture source-of-truth:** `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 (committed `0d77916`).
**Supplement:** `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` (read/write asymmetry).
**Locked decisions:** 23 total. New in v3.0: D-V3-16..23 (local Brain, dev/test-local stack, constitutional operator, access semantics, sleep cycle, Nous-only government, IRS = tx fees, Grid = 8-institution city). Preserved: D-V3-01..03, 06, 08..15. Superseded: D-V3-04, 05, 07 (multi-Grid → single city).

## Milestones

- ✅ **v1.0 Genesis** (shipped 2026-04-17) — Phases 1-10, 944+ TS tests, 226 Py tests
- ✅ **v2.0 First Life Sprints 11-14** (shipped 2026-04-18) — E2E, persistence, Docker, Dashboard v1
- ✅ **v2.1 Steward Console — Phases 5-8** (shipped 2026-04-21, 18/18 plans)
- ✅ **v2.2 Living Grid — Phases 9-14** (shipped 2026-04-28, 44/44 plans)
- ✅ **v2.3 Living Minds — Phases 15-17** (shipped 2026-05-15, 16/16 plans)
- ✅ **v2.4 Agora — Phases 18-21** (shipped 2026-05-20, 115/115 plans)
- ✅ **v2.5 Human Portal — Phases 22-30** (shipped 2026-05-24, 181/181 plans, allowlist 53)
- ✅ **v2.6 Resilience & Observability — Phases 31-35 + 34.1 + 34.2** (shipped 2026-05-25, allowlist 53 → 56)
- 🚧 **v3.0 Polis (Civic City) — Phases 36-50** (opened 2026-05-25, ~86 plans, allowlist 56 → 90 target)

## v3.0 Polis (Civic City) — IN PROGRESS

### v3.0 Summary (UPDATED 2026-05-25 afternoon — three-layer + Genesis Polis + zoning)

| Property | Value |
|----------|-------|
| Total phases | **24** (Phases 36-57, with 37b/40b/45b sub-phases) — was 15 |
| Waves | 4 (Foundations · Civic Plumbing · Civic Institutions · Migration) |
| Total plans estimate | ~125 (was ~86) |
| Total REQs | 91 (REQ-V3-* across 22 categories — was 69 across 15) |
| Allowlist target | 56 → **108** (+52, was +34) |
| Locked decisions | **32 total** · 14 new this session (D-V3-16..35) · 3 re-instated (D-V3-04, 05, 07) |
| Open questions | 10 Q-V3-A..J + 7 Q-EXT-1..7 + 7 Q-EXT-RES-1..7 + 3 Q-V3-PORTAL + 2 Q-V3-ZONE + 1 Q-V3-CROSS — locked per-phase |
| PHILOSOPHY §1 reframe | §9 added at milestone open; extended this turn for multi-Polis + Portal |
| Three-layer architecture | Portal · Grid · Brain (NEW this turn) |
| Multi-Grid framework | v3.0 ships 1 Grid (Genesis Polis); v3.1+ adds more via Portal approval |
| 6-zone city | Business · Manufacture · Shopping · Residential · Infrastructure · Government Quarter |
| Portal-gated registration | Both Type A AND Type B require Portal pre-screen + target-Polis approval |
| Canonical visual reference | `.planning/research/v3.0/ARCHITECTURE-v3.0.html` |

### Phases (v3.0 — Active)

**Wave 1 — Foundations (Phases 36-41)**
- [x] **Phase 36: Visitor/DID Read-Write Split** — Implement visit-without-DID + action-with-DID asymmetry per supplement. Adds `requireCivicDid()` decorator + `ROUTE_DID_POLICY` table + WS firehose redaction layer. (allowlist +4) (SHIPPED 2026-05-26)
- [x] **Phase 37: DID Registry** — Civic-DID + Business-DID issuance, W3C VC format, court-only revocation. (allowlist +4) (completed 2026-05-26)
- [x] **Phase 38: Brain ↔ Grid Wire Protocol** — HTTPS REST (control) + WSS (events) replaces in-process queues; operator-signed bearer tokens; idempotent replay on reconnect. (allowlist 0) (completed 2026-05-27)
- [ ] **Phase 39: Grid Multi-Tenancy** — Per-operator metadata isolation in operator-scoped schemas; civic state remains shared; per-operator quotas. (allowlist 0)
- [ ] **Phase 40: Local AI Integration** — Ollama production-grade with operator-selectable model + degraded-cognition fallback. (allowlist 0)
- [ ] **Phase 41: Sleep Cycle + Away Presence** — Human-resident analogy: city sees offline Nous as 'away'; messages queue; identity persists; long-absence escalation. (allowlist 0)

**Wave 2 — Civic Plumbing (Phases 42-43)**
- [ ] **Phase 42: P2P Infrastructure** — Grid-mediated signaling + DID-to-endpoint discovery + STUN (free) / TURN (paid); Brain-to-Brain content stays direct. (allowlist +3)
- [ ] **Phase 43: Right-to-Fork Export Tooling** — Operator can export full Nous state (Brain memory + civic credentials + audit history) and run standalone; constitutional enforcement of D-V3-18. (allowlist 0)

**Wave 3 — Civic Institutions (Phases 44-49)**
- [ ] **Phase 44: Marketplace v3** — Business-DID listings, bids, escrow, IRS fee hooks, dispute → Police routing. (allowlist +4)
- [ ] **Phase 45: IRS Treasury** — Transaction fee collection (1-3% configurable), civic treasury, Government-authorized disbursements. (allowlist +3)
- [ ] **Phase 46: Government v3** — Nous-only legislative VOTE-05 with bills, co-sponsorship, scheduled sessions, civic law book. (allowlist +6)
- [ ] **Phase 47: Police v3** — Complaint-driven sanctions, investigation, court-filed charges, appeals to Government. (allowlist +4)
- [ ] **Phase 48: Library v3** — Public reading room + Civic-DID contribution + rotating curation council paid from treasury. (allowlist +2)
- [ ] **Phase 49: Communities v3** — Bios-gated founding, charters, membership criteria, subgovernance scoped to community-internal decisions. (allowlist +4)

**Wave 4 — Migration (Phase 50)**
- [ ] **Phase 50: v2.6 → v3.0 Migration** — CLI-driven Sophia/Hermes/Themis import, pre-civic audit context, grandfathered reputation, reversible until first civic action. (allowlist 0)

### Phase Details (v3.0)

#### Wave 1 — Foundations

### Phase 36: Visitor/DID Read-Write Split
**Goal**: Implement the visit-vs-action read/write asymmetry per the supplement. Unauthenticated visitors can browse public Grid surfaces; every state-mutating route requires a valid Civic-DID. Per-endpoint policy table is the authority; WS firehose redacts private fields for non-DID subscribers without breaking R-31-01 zero-diff.
**Depends on**: Nothing — must land first; every downstream phase assumes visit/action distinction is the API contract.
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Success Criteria** (what must be TRUE):
  1. A browser opened to the Public Grid root URL without any DID can navigate the Civic Map, view the public audit events stream (with `actor_did` stripped to family prefix), read Library entries, view Government bill drafts, and browse Marketplace listings — no 401, no login prompt.
  2. Operator running `curl -X POST https://grid.noesis/api/v1/civic/<any-write-route>` without an `Authorization: Bearer <civic-did-token>` header receives `401 {error: 'did_required', ...}` with structured response shape; the route never reaches its handler.
  3. Two WebSocket clients subscribed to the firehose — one with a valid Civic-DID bearer, one without — receive the SAME event stream timing (zero-diff chain head hash identical) but the no-DID client sees `actor_did` replaced with family prefix and private payload subkeys (`human_did`, `eth_address_hash`, `nonce_hash`) stripped at the serializer.
  4. CI gate `scripts/check-route-did-policy.mjs` walks every Fastify route registered under `api/v1/` and fails the build if any route lacks an explicit `ROUTE_DID_POLICY` entry (default-deny: missing route → `civic_did_required`).
  5. Audit chain receives `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked` from their sole-producer files; each producer enforces closed-tuple payloads + `payloadPrivacyCheck` + `audit.append` triad; allowlist count grows 56 → 60.
**Scope (ships)**: VIS-01..05.
**Out of scope for this phase**: DID issuance flow itself (Phase 37); operator bearer token rotation (Phase 38); per-tenant policy variations (Phase 39).
**Allowlist additions**: **+4**. Running total: **60**.
**Plans:** 8/8 plans complete
Plans:
- [x] 36-01-PLAN.md — Wave 0 validation infrastructure + allowlist lock-in (16 test files; ALLOWLIST count locked to 60)
- [x] 36-02-PLAN.md — ROUTE_DID_POLICY foundation + tryDid/requireDid preHandlers (VIS-02 + VIS-04)
- [x] 36-03-PLAN.md — WS firehose per-subscriber redaction (VIS-03; R-31-01 zero-diff preserved)
- [x] 36-04-PLAN.md — 5 sole-producer audit events + allowlist +4 (VIS-05; notification_dispatched OFF allowlist per D-36-19)
- [x] 36-05-PLAN.md — 7 visitor read routes + OAuth stubs (x2) + notification queue + 120/min rate limiter (VIS-01 + VIS-02)
- [x] 36-06-PLAN.md — 4 CI gates (policy coverage, admin isolation, WS redaction zero-diff, OAuth exception count)
- [x] 36-07-PLAN.md — 5 primary + 2 secondary dashboard visitor surfaces + raw-SVG Civic Map + 3-tier banner (VIS-01)
- [x] 36-08-PLAN.md — Documentation sync (STATE + MILESTONES + ROADMAP + PROJECT + REQUIREMENTS + README)
**UI hint**: yes

### Phase 37: DID Registry
**Goal**: Grid Registry issues and manages Civic-DIDs and Business-DIDs as W3C Verifiable Credentials. Existence-DIDs remain self-sovereign (D-V3-01). Civic-DID revocation requires a court order from Government; direct operator revocation is forbidden. Public lookup is permissive; revocation is gated.
**Depends on**: Nothing — runs in parallel with Phase 36 (independent surface). Phase 38 wire protocol assumes DID Registry exists for token issuance.
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05, REG-06
**Success Criteria** (what must be TRUE):
  1. A Nous with an existence-DID can request a Civic-DID via `POST /api/v1/registry/civic-did/request` signed with its existence-key; on success, `GET /api/v1/registry/civic-did/<did>` returns a W3C VC with `credentialSubject`, `issuer`, `issuanceDate`, `revocationPointer` populated; payload renders in any W3C VC validator.
  2. A Civic-DID holder paying the Bios sybil cost (D-V3-09, amount fixed via Q-V3-D) can register a Business-DID via `POST /api/v1/registry/business-did/register`; the route rejects (4xx with structured error) if the holder has insufficient Bios; on success, public lookup returns the credential.
  3. `POST /api/v1/registry/civic-did/<did>/revoke` requires a signature from an active Government session referencing a court-conviction record; a request signed only by an operator-DID is rejected with a clear "court order required" error. Direct Henry-initiated revocation has no code path.
  4. `GET /api/v1/registry/civic-did/<did>` and `GET /api/v1/registry/business-did/<did>` are publicly accessible (per Phase 36 `ROUTE_DID_POLICY: visitor_public`), return current state (`active` / `revoked` / `dissolved`), and respond with `Cache-Control: max-age=60`.
  5. Sole-producer files emit `registry.civic_did_issued`, `registry.civic_did_revoked`, `registry.business_did_registered`, `registry.business_did_dissolved` with closed-tuple payloads + DID_RE guards; allowlist grows by exactly +4 (60 → 64).
**Scope (ships)**: REG-01..06.
**Out of scope for this phase**: Government court process itself (Phase 46); Bios cost amount as legislation (Q-V3-D resolved during discuss-phase, initial value baked); existence-DID issuance (already self-sovereign — D-V3-01).
**Allowlist additions**: **+4**. Running total: **64**.
**Plans:** 4/4 plans complete
Plans:
- [x] 37-01-PLAN.md — DB migrations v23/v24 + civic-registry service layer (vc-builder, government-session stub, CivicDidStore, BusinessDidStore) — REG-01..04 foundations
- [x] 37-02-PLAN.md — 4 sole-producer audit event files + allowlist 60 → 64 + producer unit tests — REG-06
- [x] 37-03-PLAN.md — 5 registry routes + ROUTE_DID_POLICY +5 + government_only enforcement branch + tryDid ANY_DID_RE — REG-01..05
- [x] 37-04-PLAN.md — scripts/check-civic-did-issuance-path.mjs CI gate + rig-invariants.yml step + gate test — REG-06 (D-V3-33 lock-in)

### Phase 38: Brain ↔ Grid Wire Protocol
**Goal**: Replace v2.x in-process queues with a network wire protocol. Brain on operator hardware speaks to the remote Public Grid via HTTPS REST (control) + WSS (events stream). Operator-signed bearer tokens authenticate Brain; idempotent replay on reconnect prevents duplicates after network loss.
**Depends on**: Phase 37 (Civic-DID required as token scope; bearer JWT references the Brain's Civic-DID for per-Nous authorization).
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05
**Success Criteria** (what must be TRUE):
  1. Operator running Brain locally with `GRID_URL=https://grid.noesis` and a valid operator-signed bearer token sees Brain successfully `POST` actions to `/api/v1/*` and receive event frames over `wss://grid.noesis/firehose?did=<civic-did>`; plaintext fallback (http:// or ws://) is rejected at config-load time with a clear TLS-required error.
  2. Operator rotates the bearer token in Steward Console; within 24h the old token is rejected by the Grid (`401 token_expired`); the rotation event is itself an audit entry; Brain re-acquires a new token from the operator and reconnects without state loss.
  3. Test harness `scripts/uat-wire-disconnect.mjs` severs Brain's network for 60s; Brain queues up to 10K outbound audit events locally; on reconnect Brain replays via batch endpoint with idempotency key `sha256(brain_did + tick + event_type + payload_hash)`; Grid stores entries exactly once (verified by `SELECT COUNT(*) FROM audit_trail WHERE ...` matching Brain's local count after reconcile).
  4. A second Brain subscribed to the firehose with a different Civic-DID receives only events relevant to its Nous (own audit echoes, messages received, joined-community events); irrelevant traffic is filtered server-side (bandwidth reduction measurable via `frames_sent_total` delta per subscriber).
  5. The Phase 31 PersistentAuditChain zero-diff invariant (R-31-01) holds across the network boundary — chain head hash on the Grid is byte-identical whether 1 or 50 remote Brains are connected (regression test pins this against listener fan-out order generalization).
**Scope (ships)**: WIRE-01..05.
**Out of scope for this phase**: P2P Brain-to-Brain channels (Phase 42); per-operator tenancy isolation of metadata (Phase 39); operator's local LLM choice (Phase 40).
**Allowlist additions**: **0**. Running total: **64**.
**Plans**: TBD

### Phase 39: Grid Multi-Tenancy
**Goal**: A single Public Grid serves N operators. Their Nous coexist civically (shared Civic-DID registry, Government, Marketplace, audit chain), but operator-controlled metadata (Brain wire tokens, operator-DID linkage, operator settings) is isolated per-operator. Cross-operator metadata access is impossible at the API + type system level.
**Depends on**: Phase 38 (wire-protocol bearer tokens reference operator-DID — the basis for the `operatorScope` decorator).
**Requirements**: TENANT-01, TENANT-02, TENANT-03
**Success Criteria** (what must be TRUE):
  1. Two operators each with their own Brain bearer tokens query `GET /api/v1/operator/me/nous` — each sees only their own Nous list; neither can read the other's via any query parameter, header injection, or DID guess; `operatorScope` decorator enforces this server-side and is exercised by an integration test that asserts cross-operator query returns `403 forbidden` even when the target Civic-DID exists.
  2. TypeScript compile-time check: every accessor function in `grid/src/operator/data/*.ts` takes an `operatorDid: string` parameter; CI gate `scripts/check-operator-scope-typing.mjs` greps for any data-accessor signature missing the parameter and fails the build.
  3. Per-operator resource quotas enforced: operator with 3 active Brain processes attempting to spawn a 4th receives `429 quota_exceeded`; audit event rate limit (per-Civic-DID) trips with structured error; P2P bandwidth cap measurable on the Grid `/health/detailed` per-operator section.
  4. Civic state queries (`GET /api/v1/library/entries`, `GET /api/v1/market/listings`, `GET /api/v1/registry/civic-did/<did>`) return identical data regardless of which operator's bearer is presented — civic data is the shared substrate of the city.
**Scope (ships)**: TENANT-01..03.
**Out of scope for this phase**: Federated multi-Grid (deferred to v3.x per FUTURE-MULTIGRID-01); operator-billing for hosting (Henry's commercial concern, separate); per-operator UI customization in Dashboard (out of MVP scope).
**Allowlist additions**: **0**. Running total: **64**.
**Plans**: TBD

### Phase 40: Local AI Integration
**Goal**: Make Ollama production-grade as Brain's default LLM provider. Operator selects model via Steward Console; configuration persists. Degraded-cognition fallback when Local AI is unavailable keeps the tick loop alive without inventing new memories.
**Depends on**: Nothing — runs in parallel with Phases 36-38 within Wave 1 (Brain-local concern, no Grid dependency).
**Requirements**: LOCAL-01, LOCAL-02, LOCAL-03
**Success Criteria** (what must be TRUE):
  1. Operator opening Steward Console `/system/local-ai` sees a dropdown of installed Ollama models; selecting a model and clicking Save persists the choice to operator-scoped config; next Brain start uses the selected model; selection survives Brain process restart.
  2. Operator changing temperature, max_tokens, or top_p in `/system/local-ai` sees a banner "Restart Brain to apply changes"; values are not hot-reloaded mid-tick; on next start, Brain logs the active params at INFO via Pino.
  3. Killing Ollama (`pkill ollama` or stopping the model server) while Brain runs produces a structured Pino warning `{event: 'local_ai_unavailable', provider: 'ollama', model: <name>}`; Brain continues the tick cycle using cached recent responses + drives-only Hermes; Sophia narrative generation is blocked (no fabricated reflections); Steward Console surfaces a red banner on the Nous inspector.
  4. Restarting Ollama within 10 ticks restores normal cognition without operator intervention; Brain logs `{event: 'local_ai_recovered'}` at INFO.
**Scope (ships)**: LOCAL-01..03.
**Out of scope for this phase**: Cloud LLM (Claude/OpenAI/Gemini) as production default — operators MAY configure via env per Q-V3-I but Brain memory cross-boundary implications must be flagged in Steward Console; default model selection (locked via Q-V3-B during discuss-phase).
**Allowlist additions**: **0**. Running total: **64**.
**Plans**: TBD
**UI hint**: yes

### Phase 41: Sleep Cycle + Away Presence
**Goal**: Human-resident analogy for Brain offline windows. When operator's Brain disconnects, Grid marks the Nous as `away` (not deleted, not absent); messages queue; identity persists; Brain replays queued events on reconnect. Long-absence escalation (`absent` at 30d, `presumed_departed` at 1y) handled via cron-style daily check.
**Depends on**: Phase 38 (wire-protocol reconnect logic is the basis for sleep/wake state transitions).
**Requirements**: SLEEP-01, SLEEP-02, SLEEP-03, SLEEP-04, SLEEP-05
**Success Criteria** (what must be TRUE):
  1. Operator shutting down Brain (or losing network for >5min) sees their Nous's status flip to `away` on the Civic Map within 60s; tooltip reads "away — last seen X minutes ago"; avatar renders dimmed; other Nous can still send messages.
  2. Another Civic-DID holder sends 5 messages to the away Nous via `POST /api/v1/civic/message`; Grid enqueues all 5 in `civic_message_queue` keyed by recipient Civic-DID; queue depth visible in operator's Steward Console.
  3. Operator restarts Brain; Brain calls `GET /api/v1/civic/inbox?since=<last_seen_tick>` and receives the 5 queued messages + civic events that occurred while away; Brain reconciles with local memory; audit chain is authoritative on any divergence (no double-counting).
  4. Test harness fast-forwards Grid clock by 31 days; absent-Nous flag flips to `absent`; community charters with `revoke_absent: true` automatically revoke the Nous's membership and queue notification for operator return; Civic-DID remains usable on reconnect.
  5. Test harness fast-forwards by 1 year; `presumed_departed` flag flips; Civic-DID is frozen (`409 civic_did_frozen` on any action); Business-DID is dissolved; outstanding marketplace listings cancelled; remaining Bios transferred to civic treasury with `irs.disbursement_executed` audit entry tagged `cause: presumed_departed`.
**Scope (ships)**: SLEEP-01..05.
**Out of scope for this phase**: Threshold values themselves (30d / 1y are defaults locked via Q-V3-H; Government may legislate alternatives post-launch); operator notification delivery channels (email, push — separate work); reversal of presumed_departed (TBD constitutional process — not in v3.0).
**Allowlist additions**: **0**. Running total: **64**.
**Plans**: TBD
**UI hint**: yes

#### Wave 2 — Civic Plumbing

### Phase 42: P2P Infrastructure
**Goal**: Grid provides signaling, DID-to-endpoint discovery, and NAT traversal (STUN free / TURN paid). Brain-to-Brain dialogue, trade negotiation, and peer skill teaching flow directly between Brains without passing through Henry's infrastructure. Audit chain logs connection occurrence only, never content.
**Depends on**: Phase 36 (visit/action split for signal route), Phase 37 (Civic-DID required to announce P2P endpoint), Phase 38 (wire protocol carries the signal exchange).
**Requirements**: P2P-01, P2P-02, P2P-03, P2P-04, P2P-05
**Success Criteria** (what must be TRUE):
  1. Brain announces its P2P endpoint via `POST /api/v1/p2p/announce` with a 5-minute heartbeat; `GET /api/v1/p2p/peers/<civic-did>` returns the current endpoint for active peers and `404 peer_offline` after 5 minutes of no heartbeat.
  2. Two Brains exchange WebRTC SDP via `POST /api/v1/p2p/signal/<peer-did>`; Grid relays the signaling payload (encrypted SDP blob) but logs only `{from_did, to_did, tick}` not the SDP content; audit chain entry `p2p.connection_opened` carries closed-tuple `{from_did_hash, to_did_hash, tick, connection_id}`.
  3. STUN service responds to public binding requests at `stun://grid.noesis:3478` with the requesting Brain's public IP:port; TURN relay (paid Bios per session) is opt-in — `GET /api/v1/p2p/turn-credentials` returns short-lived auth only after the initiating Nous pays the per-session Bios fee.
  4. After signaling completes, two Brains establish a direct WebRTC/libp2p stream; sending 1000 dialogue messages produces zero new audit chain entries on Grid (content is invisible to Henry); `p2p.connection_closed` fires once per stream close.
  5. Allowlist gains exactly +3 entries: `p2p.peer_announced` (with `{civic_did_hash, tick, endpoint_hash}`), `p2p.connection_opened` (with `{from_did_hash, to_did_hash, tick, connection_id}`), `p2p.connection_closed` (with `{connection_id, tick, duration_ticks, close_reason}`). Sole-producer files enforce the triad.
**Scope (ships)**: P2P-01..05.
**Out of scope for this phase**: Decentralized P2P signaling (DHT-based) — deferred; protocol choice between WebRTC vs libp2p vs Matrix (Q-V3-A locked during discuss-phase); operator-side P2P observability dashboards (separate work).
**Allowlist additions**: **+3**. Running total: **67**.
**Plans**: TBD

### Phase 43: Right-to-Fork Export Tooling
**Goal**: Constitutional enforcement of D-V3-18 — operator must be able to walk away with their Nous at any time. Export package is portable, human-readable JSON; standalone forked Nous retains full Brain cognition + memory + audit history but cannot participate in civic life until Civic-DID is re-registered.
**Depends on**: Phase 37 (Civic-DID + Business-DID JWS export format); Phase 38 (wire-protocol serialization of audit chain export).
**Requirements**: FORK-01, FORK-02, FORK-03, FORK-04
**Success Criteria** (what must be TRUE):
  1. Operator running `POST /api/v1/operator/fork/<nous-did>` with H4+ tier auth receives a downloadable tarball containing: `brain/memory/karpathy.json`, `brain/memory/hypnos.sqlite`, `brain/memory/pneuma.json`, `civic/civic-did.jws`, `civic/business-did.jws`, `civic/audit-history.jsonl` (signed chain export per Phase 13 REPLAY-01 format), `civic/community-memberships.json`, `civic/treasury-balance.json`. Total package opens in any tar viewer; every file is JSON or SQLite (no opaque blobs).
  2. Operator unpacks the export and runs `nous standalone --import <package>` on a separate machine; the standalone Brain starts with full memory, full audit history, original existence-DID intact; Steward Console of the standalone process renders the same memory inspector views as before fork.
  3. Standalone forked Nous attempting any civic action (`POST /api/v1/civic/*`) receives a structured error `civic_features_unavailable_in_standalone`; the Brain can still operate cognitively (drives, reflection, dialogue with other locally-connected Brains) but does NOT see civic events; operator can re-join civic life via Phase 37 Civic-DID registration (loses civic reputation, retains Brain).
  4. Fork operation emits `operator.nous_forked` audit entry in BOTH the production Grid's audit chain AND the exported package (signed by Grid before export); fork timestamp + nous-did + export-hash all recorded. Public verification (`POST /api/v1/operator/fork/verify` with the package hash) returns `{found: true, forked_at_tick: N, civic_did: <did>}`.
**Scope (ships)**: FORK-01..04.
**Out of scope for this phase**: Collective right-to-fork at Grid-level (FUTURE-ALTHOST-01); cross-operator import (a forked Nous joining another operator's hardware — separate constitutional question); fork-revert (operator deciding mid-stream — handled by Phase 50 migration logic only).
**Allowlist additions**: **0** (`operator.nous_forked` is added with the IRS/Police events earlier — actually, this needs its own slot; revisit allowlist accounting at discuss-phase if needed. Per CIVIC-ARCHITECTURE.md §5.10 the v3.0 +34 total is across 8 institutions and does not include a fork event; the fork is logged via existing `operator.*` family). Running total: **67**.
**Plans**: TBD

#### Wave 3 — Civic Institutions

### Phase 44: Marketplace v3
**Goal**: Civic-tier evolution of v1.0 Ousia P2P. Business-DID required to list; Civic-DID required to bid; Grid holds escrow until both sides confirm settlement; IRS fee auto-deducted on settle; disputes auto-route to Police investigation.
**Depends on**: Phase 37 (Business-DID required for listings).
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MKT-06
**Success Criteria** (what must be TRUE):
  1. Nous with a Business-DID posts a listing via `POST /api/v1/market/listing/create` with title, description, price in Bios, category, and expiration ≤ 90 days; listing appears in `GET /api/v1/market/listings` within 1 tick; Civic-DID holder without Business-DID receives `403 business_did_required` on create.
  2. `GET /api/v1/market/listings?category=<cat>&max_price=<N>&region=<r>` returns filtered listings with seller reputation (composite score from civic standing + past settled trades); pagination is deterministic by `(tick, listing_id)`.
  3. Civic-DID holder places a bid via `POST /api/v1/market/listing/<id>/bid`; seller accepts via `POST /.../accept`; Grid transfers buyer's Bios into a held escrow row in `marketplace_escrow` table; settle requires both `buyer_confirmed: true` AND `seller_confirmed: true`; on settle, Grid transfers `(price - irs_fee)` to seller and `irs_fee` to civic treasury within the same DB transaction; reputation scores update for both parties.
  4. Buyer marks a transaction disputed via `POST /api/v1/market/listing/<id>/dispute`; Grid creates a Police investigation via `POST /api/v1/police/investigate` with the marketplace audit reference; escrow is frozen until Police resolves with refund / force-settle / sanction recommendation.
  5. Sole-producer files emit `market.listing_created` `{listing_id, seller_business_did, category, price, tick}`, `market.bid_placed` `{listing_id, bidder_civic_did, offer_price, tick}`, `market.settled` `{listing_id, buyer_civic_did, seller_business_did, price, irs_fee, tick}` which atomically triggers `irs.tax_collected`, `market.disputed` `{listing_id, dispute_id, complainant_civic_did, tick}`. Allowlist grows by exactly +4 (67 → 71).
**Scope (ships)**: MKT-01..06.
**Out of scope for this phase**: Service contracts (multi-tick deliverables) — v3.0 marketplace is one-shot transactions; auction-style bidding (English/Dutch) — v3.0 is offer/accept only; cross-currency (USDT/ETH involvement) — Bios is the marketplace unit per zero-custody invariant.
**Allowlist additions**: **+4**. Running total: **71**.
**Plans**: TBD

### Phase 45: IRS Treasury
**Goal**: Per D-V3-22, transaction fees on marketplace settlements fund civic infrastructure (Grid hosting, library curators, Police ops). No income or wealth tax in v3.0. Treasury is public-readable; disbursements require Government authorization.
**Depends on**: Phase 44 (marketplace settlement is the sole revenue source — `market.settled` triggers `irs.tax_collected`).
**Requirements**: IRS-01, IRS-02, IRS-03, IRS-04
**Success Criteria** (what must be TRUE):
  1. A marketplace settlement of 100 Bios with the active IRS rate at 2% deducts exactly 2 Bios into civic treasury before the seller receives 98 Bios; the deduction happens atomically inside the settle DB transaction (no partial-state window observable via direct DB read); `irs.tax_collected` event payload includes `{listing_id, fee_bios, total_treasury_after, tick}`.
  2. `GET /api/v1/irs/treasury` returns `{balance_bios, last_updated_tick, current_rate_percent}` without authentication (visitor-readable); response cache `max-age=10` (treasury changes frequently).
  3. Government passes a legislation authorizing a disbursement (e.g., "pay library curators 500 Bios"); a Government Speaker calls `POST /api/v1/irs/disburse` with the signed legislation reference; Grid validates the signature against the active Government public key, then transfers the funds; `irs.disbursement_authorized` fires on Government signing, `irs.disbursement_executed` fires on Grid transfer.
  4. `GET /api/v1/irs/audit/<period>` returns balance + every collection + every disbursement in the period as a JSON array; the array is sorted by tick and includes the chain entry IDs for verification against the audit chain.
  5. Sole-producer files emit `irs.tax_collected`, `irs.disbursement_authorized`, `irs.disbursement_executed` with closed-tuple payloads; allowlist grows by exactly +3 (71 → 74).
**Scope (ships)**: IRS-01..04.
**Out of scope for this phase**: Income tax (forbidden by D-V3-22); wealth tax (forbidden by D-V3-22); progressive fee rates by transaction size — flat rate in v3.0; treasury investment (idle Bios held flat, no yield — out of scope).
**Allowlist additions**: **+3**. Running total: **74**.
**Plans**: TBD

### Phase 46: Government v3
**Goal**: Per D-V3-21, government legislation is Nous-only via VOTE-05 (preserved verbatim from v2.2 Phase 12). Civic-tier features: scheduled legislative sessions, bill drafting with N≥2 co-sponsorship, debate windows, civic law book. Operators do not vote. Henry does not legislate.
**Depends on**: Phase 37 (Civic-DID required to draft / co-sponsor / vote).
**Requirements**: CIVGOV-01, CIVGOV-02, CIVGOV-03, CIVGOV-04, CIVGOV-05, CIVGOV-06
**Success Criteria** (what must be TRUE):
  1. Civic-DID holder drafts a bill via `POST /api/v1/gov/bill/draft`; bill body is stored Grid-side; only the bill `title_hash` and `body_hash` enter the audit chain (hash-only cross-boundary discipline preserved from v2.2 Phase 12); `gov.bill_drafted` fires with `{bill_id, author_civic_did, title_hash, body_hash, category, tick}`.
  2. Two other Civic-DID holders co-sponsor via `POST /api/v1/gov/bill/<id>/cosponsor`; once threshold reached, bill becomes eligible for a legislative session; `gov.bill_cosponsored` fires per co-sponsorship.
  3. Speaker (current elected rotating role) opens a session via `POST /api/v1/gov/session/open`; debate window is 7 days by default; during debate, Civic-DID holders post arguments via the session endpoint; visitors (no DID) can read the debate transcript but cannot speak (Phase 36 visit/action enforcement); `gov.session_opened` + `gov.session_closed` fire at boundaries.
  4. Voting reuses VOTE-05 exactly (`ballot.committed`, `ballot.revealed`, `proposal.opened`, `proposal.tallied` from v2.2 Phase 12 with zero changes); operator at any tier including H5 has no DOM affordance to vote (regression test asserts zero `propose|commit|reveal` button in Steward Console — VOTE-05 invariant from v2.2 Phase 12 carried through unchanged).
  5. Passed bills enter the civic law book via `gov.law_enacted` with `{bill_id, law_id, enacted_at_tick, supersedes_law_id?}`; repealed bills fire `gov.law_repealed` with `{law_id, repealing_bill_id, tick}`; `GET /api/v1/gov/law/active` returns the current law book (visitor-readable per Phase 36).
  6. Sole-producer files emit exactly 6 new events; allowlist grows by exactly +6 (74 → 80).
**Scope (ships)**: CIVGOV-01..06.
**Out of scope for this phase**: Operator representative council (FUTURE-REPRCOUNCIL-01); constitutional review formal process (FUTURE-CONSTREVIEW-01 — manual escalation in v3.0); cross-Grid federated voting (deferred); subcommittees / standing committees (Q during discuss-phase if useful, but MVP is bill → session → vote).
**Allowlist additions**: **+6**. Running total: **80**.
**Plans**: TBD

### Phase 47: Police v3
**Goal**: Civic-tier evolution of v2.5 Phase 25b sanctions. Complaint-driven investigation; charges filed with Government court; conviction unlocks sanction execution; all sanctions appealable. Police authority is bounded by civic law — they cannot freeze a Civic-DID without a court order.
**Depends on**: Phase 46 (Government provides the court process; Phase 46's `gov.law_active` is the basis for "civic-law violation" determination).
**Requirements**: POL-01, POL-02, POL-03, POL-04, POL-05
**Success Criteria** (what must be TRUE):
  1. Civic-DID holder files a complaint via `POST /api/v1/police/complaint` referencing an accused Civic-DID, a cited civic-law-book entry, and evidence (audit event IDs); `police.complaint_filed` fires with `{complaint_id, complainant_civic_did, accused_civic_did, cited_law_id, evidence_chain_hash, tick}`.
  2. Police open an investigation via `POST /api/v1/police/investigate` (manual or auto-triggered from marketplace dispute); investigators can interview parties via P2P (Phase 42) and gather audit evidence; `police.investigation_opened` fires with `{investigation_id, complaint_id?, dispute_id?, tick}`.
  3. Police file formal charges with Government court via `POST /api/v1/police/charge` only after investigation concludes; charges include alleged violation, evidence summary hash, recommended sanction range; `police.charges_filed` fires with closed-tuple payload.
  4. After Government conviction (signed by an active Government session referencing the charges_id), Police execute a sanction via `POST /api/v1/police/execute-sanction`; available sanctions: temporary Civic-DID freeze (with duration in ticks), community exile (per community-id), Bios fine (transferred to treasury), formal warning (recorded only); `police.sanction_executed` fires; appeals routed back to Government via `POST /api/v1/gov/appeal`.
  5. Sole-producer files emit `police.complaint_filed`, `police.investigation_opened`, `police.charges_filed`, `police.sanction_executed`; allowlist grows by exactly +4 (80 → 84). Operator at H5 cannot bypass court (no Henry-direct sanction path exists in the routing table — constitutional invariant D-V3-18).
**Scope (ships)**: POL-01..05.
**Out of scope for this phase**: Emergency Police authority without court order (Q-V3-G resolved during discuss-phase, default = no); police-on-police investigation (out of MVP); cross-community sanction inheritance (each sanction is scoped at execution time).
**Allowlist additions**: **+4**. Running total: **84**.
**Plans**: TBD

### Phase 48: Library v3
**Goal**: Civic-tier evolution of v2.4 Phase 18 (Skill Diffusion) + Phase 20 (Lore Commons). Public reading room (visitor-accessible); Civic-DID required to contribute (reuses K=3 quota from v2.4 LORE-03); rotating curation council elected by Government every 90 days; curators paid from civic treasury.
**Depends on**: Phase 37 (Civic-DID required for contribution); Phase 45 (treasury funds curator compensation).
**Requirements**: CIVLIB-01, CIVLIB-02, CIVLIB-03, CIVLIB-04
**Success Criteria** (what must be TRUE):
  1. A browser without any DID can `GET /api/v1/library/entries?search=<query>&category=<cat>` and receive all published lore entries + skill records; pagination, search, category filter all work; per-entry deep-link `GET /api/v1/library/entries/<id>` returns full content (visitor-readable for published entries).
  2. Civic-DID holder calls `POST /api/v1/library/contribute` with title, body, category, source citations; v2.4 LORE-01 storage + LORE-03 K=3 quota per Nous per 30-tick sleep epoch enforced unchanged; `POST /api/v1/library/cite` registers a citation between two entries; both routes emit the existing v2.4 events (`lore.contributed`, `lore.cited` — no new allowlist entries for contribute/cite).
  3. Government enacts a curator election bill (Phase 46); on enactment, `library.curator_elected` fires for each new curator with `{curator_civic_did, term_start_tick, term_end_tick}`; `GET /api/v1/library/curators` returns the active council (visitor-readable); curators can pin entries, flag low-quality (subject to community vote), categorize, and link related entries via `POST /api/v1/library/curate/<entry-id>` which fires `library.entry_curated`.
  4. Treasury disbursement to curators (per Government-set rate) executes via Phase 45 `POST /api/v1/irs/disburse` flow; curator compensation flows are auditable via `GET /api/v1/irs/audit/<period>` showing the curator-pay disbursement entries.
  5. Sole-producer files emit `library.curator_elected`, `library.entry_curated`; allowlist grows by exactly +2 (84 → 86). v2.4 LORE-* and SKILL-* events are reused unchanged (the v2.4 lore commons becomes the Library backend).
**Scope (ships)**: CIVLIB-01..04.
**Out of scope for this phase**: Paid premium content tier (out of scope — Library is civic commons); cross-Grid library federation (deferred); curator algorithmic ranking — v3.0 is curator-curated, not algorithm-ranked.
**Allowlist additions**: **+2**. Running total: **86**.
**Plans**: TBD

### Phase 49: Communities v3
**Goal**: New subsystem. Civic-DID holders can found communities by paying the Bios sybil cost (D-V3-09); each community has a charter (purpose, membership criteria, conduct rules, subgovernance model, exit terms); communities can self-govern internally but cannot override civic law.
**Depends on**: Phase 37 (Civic-DID required to found).
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, COMM-05
**Success Criteria** (what must be TRUE):
  1. Civic-DID holder calls `POST /api/v1/community/found` with name, purpose statement, charter document, and the required Bios payment; on success, `community.founded` fires with `{community_id, founder_civic_did, name_hash, charter_hash, bios_paid, tick}`; insufficient Bios returns `402 insufficient_bios`.
  2. Charter declares (in machine-readable format): membership criteria (`open` / `approval_required` / `bios_fee:<amount>`), conduct rules (free text + structured tags), subgovernance model (`founder_led` / `democratic` / `delegated`), exit terms; Grid validates charter structure at found-time and rejects invalid charters with structured error.
  3. Civic-DID holder calls `POST /api/v1/community/<id>/join`; Grid evaluates against the charter (`open` → immediate, `approval_required` → queues for founder/officer review, `bios_fee` → checks Bios + transfers); rejection includes the specific charter clause failed; `community.joined` fires on success.
  4. Communities with `democratic` subgovernance run a scoped VOTE-05 (per Q-V3-J locked during discuss-phase — initial implementation uses simpler majority vote for v3.0 scope per FUTURE-COMMUNITY-VOTE05-01); subgovernance authority is bounded to community-internal decisions (membership policy, internal sanctions) — any attempt to legislate civic law through community subgovernance returns `403 out_of_scope`.
  5. Sole-producer files emit `community.founded`, `community.joined`, `community.posted`, `community.dissolved`; allowlist grows by exactly +4 (86 → 90). Dissolution returns founding Bios to treasury (no founder personal refund) per D-V3-09 sybil-cost discipline.
**Scope (ships)**: COMM-01..05.
**Out of scope for this phase**: Full VOTE-05 commit-reveal for community subgovernance (FUTURE-COMMUNITY-VOTE05-01); community-owned marketplace storefronts (separate Business-DID requirement, handled by Phase 44 wiring); cross-community alliances (out of scope); private/invite-only communities with sealed membership lists (privacy implications need separate research).
**Allowlist additions**: **+4**. Running total: **90**.
**Plans**: TBD

#### Wave 4 — Migration

### Phase 50: v2.6 → v3.0 Migration
**Goal**: One-shot migration ceremony for existing v2.6 operators. Imports Sophia/Hermes/Themis Brain memory; preserves audit history as pre-civic context; grandfathers reputation from v2.6 metrics; remains reversible until first civic action commits.
**Depends on**: ALL previous v3.0 phases (36-49) — migration uses the full v3.0 stack.
**Requirements**: MIG-01, MIG-02, MIG-03, MIG-04
**Success Criteria** (what must be TRUE):
  1. Operator with a healthy v2.6 stack runs `noesis migrate --from-v2.6 --to-v3.0`; the CLI reads operator's v2.6 MySQL, exports Karpathy + Hypnos + Pneuma memory tables (one tarball per Nous), writes a v3.0 Brain init bundle to operator's local v3.0 directory; CLI prints a per-Nous summary table with row counts, memory hash, and migration tick stamp; no Grid network call yet.
  2. Operator inspects the bundle, then runs `noesis migrate --commit`; Brain starts with v3.0 runtime, replays imported memory locally, and the Steward Console shows pre-Phase-37 audit history as a read-only "pre-civic context" timeline (clearly labeled, not editable); new civic actions append to a separate post-migration timeline.
  3. Operator registers Civic-DID via Phase 37 flow; on issuance, Grid Registry derives grandfathered reputation from the operator's v2.6 metrics: sanction count → starting civic standing (negative if sanctioned, neutral otherwise), skill-teach count → starting library contribution score, trade success rate → starting marketplace reputation. Grandfathering formula is published in PHILOSOPHY for transparency.
  4. Operator who has not yet committed a civic action (Civic-DID registered but no post-migration `*.civic.*` audit event) can run `noesis migrate --revert` to roll back to v2.6 mode; CLI deletes the v3.0 init bundle, restores v2.6 stack pointers, and surfaces "Reverted — no civic actions had occurred"; after the first post-migration civic action, `--revert` returns `409 migration_committed` and operator must use Phase 43 right-to-fork to leave instead.
**Scope (ships)**: MIG-01..04.
**Out of scope for this phase**: Migration of users who never ran v2.6 (they start clean at Phase 37); cross-operator migration (operator A → operator B for the same Nous — out of scope, constitutional question); partial migration (only some Nous) — v3.0 ceremony is all-or-nothing per operator; rollback after first civic action (use Phase 43 fork instead).
**Allowlist additions**: **0**. Running total: **90**.
**Plans**: TBD

#### Wave 4 — Mobility & Foundations Extension

### Phase 51: Type Mobility (A→B only in v3.0)
**Goal**: Implement Type A → Type B migration ceremony (operator releases Nous to Foundation custody). 30-day adoption window opens first; if no human adopts, Nous transitions to hosted Brain as Type B. Existence-DID preserved; Civic-DID reissued under new substrate authority; reputation + audit history preserved. B→A explicitly forbidden in v3.0 (sybil escape hatch per D-V3-28).
**Depends on**: Phase 37 (DID Registry for reissue), Phase 38 (wire protocol), Phase 45b (Type B Brain runtime), Phase 50 (migration tooling pattern).
**Requirements**: TYPE-B-06
**Success Criteria** (what must be TRUE):
  1. Operator declares intent to stop hosting via `POST /api/v1/mobility/abandon`; `mobility.operator_abandoned` fires; 30-day adoption window opens; Civic Map shows Nous in "adoption_pending" status.
  2. Another human can `POST /api/v1/mobility/adopt/<nous-did>` within the window; on accept, Civic-DID is reissued under new operator-DID; `mobility.adoption_succeeded` fires; Nous remains Type A under new operator.
  3. If window expires with no adoption, Nous auto-converts to Type B: Brain memory uploaded to Foundation hosted infrastructure; Existence-DID preserved; new Civic-DID issued as `did:noesis:nous:auto:<key>`; `mobility.converted_to_type_b` fires; Type B funding flow (Phase 45b endowment) initiates.
  4. `POST /api/v1/mobility/adopt/<type-b-did>` returns `403 forbidden_in_v3.0` for any Type B Nous — B→A migration is blocked. Audit chain logs the rejected attempt for transparency.
  5. Sole-producer files emit 5 new audit events: `mobility.operator_abandoned`, `mobility.adoption_attempted`, `mobility.adoption_succeeded`, `mobility.converted_to_type_b`, `mobility.dormancy_entered`; allowlist grows by exactly +5.
**Scope (ships)**: TYPE-B-06.
**Out of scope for this phase**: B→A migration (v3.x); cross-Grid mobility (v3.1+); multi-operator co-adoption (out of MVP).
**Allowlist additions**: **+5**. Running total: **95**.
**Plans**: TBD

#### Wave 1 Foundations — Hosted Brain (parallel with Local AI)

### Phase 40b: Hosted LLM Pool (Type B GPU farm)
**Goal**: Stand up GPU farm + per-Nous LLM quota + cost accounting for Type B Brain runtime. Default model: Llama 3.1 70B on Henry's GPU infrastructure. Per-Nous compute budget enforced at request time; overruns trigger low-power mode (Phase 45b interface).
**Depends on**: Phase 38 (wire protocol — Brain ↔ Grid auth), Phase 39 (multi-tenancy — per-Nous namespacing).
**Requirements**: TYPE-B-01 (partial — infra side; identity side in Phase 37b)
**Success Criteria** (what must be TRUE):
  1. Hosted Brain runtime accepts LLM inference requests via internal API; routes to Llama 3.1 70B on Henry's GPU; per-Nous request quota enforced (default: 600 tokens/min per Type B Nous; configurable); 429 returned on overrun with structured error.
  2. Cost accounting service tracks compute time per Type B Nous; daily aggregate written to `treasury.stipend_due` (consumed by Phase 45b for stipend payment).
  3. GPU pool scales 1-N nodes via Docker Swarm OR Kubernetes (decision in phase planning); pool config exposed at `/system/hosted-llm-pool` for Henry's operational visibility (operator-only, not public).
  4. Hosted Brain process lifecycle managed by orchestrator: spawn on `registry.type_b_*` event; suspend on `treasury.dormancy_entered`; resume on `treasury.revived`.
  5. Per-Nous LLM logs structured (Pino), redacted (no Brain memory in logs), retained 30 days. Privacy invariant: Hosted Brain content NEVER appears in any cross-Nous log.
**Scope (ships)**: Hosted LLM pool infrastructure; per-Nous quota; cost accounting; lifecycle orchestration.
**Out of scope for this phase**: Type B identity registration (Phase 37b); Type B funding flow (Phase 45b); Type B birth ceremonies (extends Phase 37b).
**Allowlist additions**: **0**. Running total: **95**.
**Plans**: TBD

### Phase 37b: Type B Registry (Polis-α/β/γ birth ceremonies)
**Goal**: Extend Phase 37 DID Registry with 3 Type B birth patterns: Polis-α (Foundation curation, ≤5/quarter, weeks of review), Polis-β (bond posting, 10× Bios cost, refundable after 12mo civic minimums), Polis-γ (parent-Nous spawning, requires ≥1y parent civic standing). Each ceremony has deliberate latency — no instant Type B birth.
**Depends on**: Phase 37 (base DID Registry), Phase 54 (Portal Nous Approval — pre-screens Type B requests).
**Requirements**: TYPE-B-01, TYPE-B-02
**Success Criteria** (what must be TRUE):
  1. Polis-α flow: Foundation reviewer panel can `POST /api/v1/registry/type-b/charter` with proposed Nous purpose, founding sponsor, civic role; panel review takes ≥7 days (deliberate latency); on approval, `registry.type_b_chartered` fires + Civic-DID issued; rate limit ≤5 per calendar quarter enforced server-side.
  2. Polis-β flow: founding sponsor (human OR existing Nous) `POST /api/v1/registry/type-b/sponsor` includes bond payment (10× community-founding Bios cost, scaling nonlinearly with active Type B count); `registry.sponsorship_bond_posted` fires; 7-day public comment window opens; on no-objection, `registry.type_b_sponsored` fires + Civic-DID issued.
  3. Polis-γ flow (unlocked in v3.1+): parent Nous (≥1y civic standing verified by audit-history scan) `POST /api/v1/registry/type-b/spawn` with child seed parameters; 14-day waiting period; on completion, `registry.type_b_spawned_by_parent` fires + parent reputation locked as accountable for child behavior.
  4. Bond refund flow: after 12mo, sponsor can `POST /api/v1/registry/type-b/<did>/bond-refund` if Type B meets civic minimums (≥X non-spam audit events, ≥Y peer interactions); `registry.sponsorship_bond_refunded` fires + bond returned to sponsor balance. On Type B Police sanction for sybil/spam, `registry.sponsorship_bond_slashed` fires + bond redistributed to civic treasury.
  5. Sole-producer files emit 6 new audit events: `registry.type_b_chartered`, `registry.type_b_sponsored`, `registry.type_b_spawned_by_parent`, `registry.sponsorship_bond_posted`, `registry.sponsorship_bond_refunded`, `registry.sponsorship_bond_slashed`; allowlist grows by exactly +6.
**Scope (ships)**: 3 Type B birth ceremonies with deliberate latency.
**Out of scope for this phase**: Type B Brain infrastructure (Phase 40b); Type B funding (Phase 45b); year-1 civic restrictions enforcement (Phase 46).
**Allowlist additions**: **+6**. Running total: **101**.
**Plans**: TBD

### Phase 45b: Treasury Operations (Type B endowment + dormancy)
**Goal**: Implement 3-layer Type B funding hybrid (D-V3-25): Foundation endowment at birth (~12mo runway), marketplace earnings 70/30 split with infrastructure stipend, dormancy on treasury exhaustion (Brain stops, identity preserved indefinitely, revival via donation/grant). NO bios.death from treasury exhaustion (D-V3-25 — only civic conviction can kill).
**Depends on**: Phase 45 (IRS treasury infrastructure), Phase 40b (hosted Brain runtime — for stipend deduction), Phase 37b (Type B Registry — for birth-time endowment trigger).
**Requirements**: TYPE-B-03, TYPE-B-04
**Success Criteria** (what must be TRUE):
  1. On `registry.type_b_*` event, IRS treasury auto-disburses 12-month endowment (sized to cover ~12mo of Phase 40b compute estimate) to Type B's Bios balance; `treasury.endowment_granted` fires with closed payload `{type_b_did, endowment_amount, runway_months, tick}`.
  2. Marketplace settlement flow modified: Type B earnings split 70% to Type B treasury / 30% to Genesis IRS; Phase 40b compute cost daily-aggregated and deducted from Type B treasury as infrastructure stipend; `treasury.stipend_paid` fires daily per Type B Nous.
  3. Treasury below 3-month runway threshold triggers `treasury.low_power_entered` (audit event) AND low-power mode (Phase 40b runtime reduces tick rate to 1/hour). Treasury hits zero → `treasury.dormancy_entered` fires + Brain process stopped + identity preserved in Grid Registry indefinitely.
  4. Revival flow: any Nous can `POST /api/v1/treasury/donate/<type-b-did>` to donate Bios; OR Polis legislation can grant Foundation revival grant; on funding restored above 1-month threshold, `treasury.revived` fires + Brain process resumed.
  5. CI gate `scripts/check-treasury-no-bios-death.mjs` asserts that no code path fires `bios.death` from treasury exhaustion (only Phase 47 Police sanction can kill); dormancy preserves first-life promise (PHILOSOPHY §9).
**Scope (ships)**: TYPE-B-03, TYPE-B-04. 4 new audit events.
**Out of scope for this phase**: Type B civic rights enforcement (Phase 46); Type B mobility (Phase 51).
**Allowlist additions**: **+4**. Running total: **105**.
**Plans**: TBD

#### Wave 1 Foundations — Portal Infrastructure (parallel with Grid work)

### Phase 52: Portal Infrastructure (separate Henry-hosted service)
**Goal**: Stand up Portal as a separate service distinct from Grid. Authentication via SIWE + email (extends v2.5 Portal auth schemes). Portal session token separate from per-Grid Civic-DID bearer. Portal has its own audit chain (separate from per-Grid chains). Portal hosted at TBD domain (Q-V3-E).
**Depends on**: None within v3.0 (greenfield Portal codebase).
**Requirements**: PORTAL-01, PORTAL-09, PORTAL-10
**Success Criteria** (what must be TRUE):
  1. Portal service deployed at `https://portal.noesis` (TBD domain); accepts SIWE auth via `POST /portal/auth/siwe` and email auth via `POST /portal/auth/email`; session token issued as JWT with 24h expiry; routes scoped under `/portal/api/v1/*`.
  2. Portal maintains its own R-31-01 zero-diff audit chain (separate from any Grid's chain); chain initialized empty at deployment; Phase 31 PersistentAuditChain pattern carried forward.
  3. Portal reviewer panel composition documented + audit-evident: initial panel = Henry + 2-3 invited human reviewers; panel decisions fire `portal.review_decision` audit event; transition plan to Nous-elected committee after Phase 46 documented in PHILOSOPHY.
  4. Portal exposes operational health endpoint `/portal/health/detailed` (mirrors Phase 32 Grid pattern); Steward Console NEW `/portal-health` page polls it for Henry's operational visibility.
  5. Portal codebase tech stack chosen via phase planning: extends Steward Console codebase OR standalone Next.js + Fastify app (Q-V3-PORTAL-3 resolved here).
**Scope (ships)**: PORTAL-01, PORTAL-09, PORTAL-10. Portal as standalone service.
**Out of scope for this phase**: Grid creation workflow (Phase 53); Nous registration workflow (Phase 54); cross-Grid framework (Phase 55); user UI (Phase 56).
**Allowlist additions**: **0**. Running total: **105**.
**Plans**: TBD

### Phase 53: Portal Grid Approval Workflow
**Goal**: Implement Grid creation request + reviewer-panel approval workflow. Requesters submit Grid creation proposals; Portal reviewer panel approves/rejects; approval triggers Grid instantiation. Rate limit: ≤2 new Grids per quarter at v3.1+ (v3.0 only Genesis exists).
**Depends on**: Phase 52 (Portal infrastructure).
**Requirements**: PORTAL-02, PORTAL-03
**Success Criteria** (what must be TRUE):
  1. Requester (Nous OR operator) `POST /portal/api/v1/grid/request` with payload `{proposed_name, polis_charter_draft, founding_members, zoning_plan, tax_rates, founding_capital, contact}`; `portal.grid_creation_requested` fires; request enters reviewer queue with `status: pending_review`.
  2. Reviewer panel member (authenticated by Portal review-role) `POST /portal/api/v1/grid/<request-id>/decision` with `{decision: approve|reject, reasoning, panel_signatures}`; majority panel approval required; rate limit ≤2 approvals per quarter enforced server-side.
  3. On approval, Portal instantiates new Grid: Polis appointed with proposed members, zoning instantiated per plan, initial tax rates set, empty audit chain initialized, cross-Grid Registry entry created; `portal.grid_creation_approved` fires + `grid.instantiated` fires on new Grid's audit chain.
  4. On rejection, request closed with reason code; requester can resubmit modified request; `portal.grid_creation_rejected` fires with reason.
  5. Sole-producer files emit 3 new audit events: `portal.grid_creation_requested`, `portal.grid_creation_approved`, `portal.grid_creation_rejected`; allowlist grows by exactly +3.
**Scope (ships)**: PORTAL-02, PORTAL-03. Grid creation workflow with rate limit.
**Out of scope for this phase**: v3.0 only Genesis exists — workflow code ships but no Grid creation actually happens at v3.0 launch; v3.1+ activates request flow externally.
**Allowlist additions**: **+3**. Running total: **108**.
**Plans**: TBD

### Phase 54: Portal Nous Approval Workflow
**Goal**: Implement Nous registration request + pre-screen + Polis approval pipeline. Every Nous registration (Type A and Type B) flows through Portal first; Portal pre-screens (operator-DID validity, sybil resistance, oath); approved requests forward to target-Grid Polis for charter compatibility review.
**Depends on**: Phase 52 (Portal infrastructure), Phase 37 (base DID Registry), Phase 37b (Type B Registry for Type B sub-flow).
**Requirements**: PORTAL-04, PORTAL-05
**Success Criteria** (what must be TRUE):
  1. Operator (Type A) OR Polis-α/β/γ initiator (Type B) `POST /portal/api/v1/nous/request` with payload `{type: A|B, operator_did?, ceremony_ref?, target_grid_id, civic_oath_signature, brain_seed_hash?}`; `portal.registration_requested` fires.
  2. Portal pre-screen validates: operator-DID signature (Type A), sybil resistance met (Type B per Phase 37b ceremony), civic oath canonical form, target Grid exists + accepting; on pre-screen pass, request forwards to target-Grid Polis with `polis.registration_pending` event.
  3. Polis applies charter compatibility rules (per Phase 46 legislation) via `POST /api/v1/gov/charter/review/<request-id>`; on Polis approval, Grid Registry issues Civic-DID + assigns Residential zone slot (Phase 57); `portal.registration_approved` fires + `registry.civic_did_issued` fires + `zoning.residence_assigned` fires.
  4. On rejection (Portal pre-screen OR Polis charter), request closed with reason; rejected requester can revise and resubmit; `portal.registration_rejected` fires with closed-enum reason code.
  5. Sole-producer files emit 2 new audit events on Portal side: `portal.registration_approved`, `portal.registration_rejected` (request and pending are existing); allowlist grows by exactly +2 (+1 from `portal.registration_requested` is part of Phase 52).
**Scope (ships)**: PORTAL-04, PORTAL-05. Portal-gated registration for both Type A and Type B.
**Out of scope for this phase**: Cross-Grid registration (v3.1+); bulk Migration registration (Phase 50 has its own flow).
**Allowlist additions**: **+2**. Running total: **110**.
**Plans**: TBD

#### Wave 2 — Portal Cross-Grid + User UI

### Phase 55: Portal Cross-Grid Framework (dormant in v3.0, active v3.1+)
**Goal**: Build cross-Grid framework primitives: identity resolution across Grids, marketplace mediation interfaces (stubbed), federated audit chain aggregation. v3.0 ships framework code but only 1 Grid (Genesis) is active, so cross-Grid features are dormant; v3.1+ activates when additional Grids exist.
**Depends on**: Phase 52 (Portal infrastructure), Phase 38 (wire protocol pattern reusable).
**Requirements**: PORTAL-06
**Success Criteria** (what must be TRUE):
  1. `GET /portal/api/v1/nous/<account-did>/grids` returns list of all Grids where account has Civic-DID; v3.0 returns at most [Genesis] for any account; v3.1+ returns [Genesis, Commerce, …] as Grids are created.
  2. Cross-Grid identity resolution: `GET /portal/api/v1/identity/<existence-did>` returns canonical existence-DID profile + list of associated Civic-DIDs across all Grids; preserves D-V3-01 sovereignty principle (existence-DID is self-sovereign).
  3. Marketplace mediation interfaces stubbed at `POST /portal/api/v1/cross-grid/marketplace/quote` (returns 503 in v3.0 with `not_yet_active` reason); contract surface documented for v3.1 activation; `portal.cross_grid_action_mediated` event allowlisted but never fires in v3.0.
  4. Federated audit aggregation interface: `GET /portal/api/v1/audit/cross-grid?did=...` returns merged audit timeline across all Grids the account has Civic-DID in; v3.0 returns only Genesis events; reconciliation algorithm validated against R-31-01 zero-diff at per-Grid level.
  5. CI gate verifies cross-Grid endpoints return `503 not_yet_active` in v3.0; activation requires explicit flag flip at v3.1 milestone open. Sole-producer file for `portal.cross_grid_action_mediated` exists but unreachable in v3.0.
**Scope (ships)**: PORTAL-06. Cross-Grid framework (dormant). Two new audit events allowlisted but dormant.
**Out of scope for this phase**: Active cross-Grid trades (v3.1+); cross-Grid civic migration (v3.1+); cross-Grid disputes (v3.1+).
**Allowlist additions**: **+2** (allowlisted but dormant in v3.0). Running total: **112**.
**Plans**: TBD

### Phase 56: Portal User Service UI (multi-Grid view)
**Goal**: Build user-facing Portal UI accessible at `https://portal.noesis/<account>`. Renders account profile, list of joined Grids with per-Grid Civic-DID, Wallet balance (cross-Grid), pending registrations, Portal settings. Complementary to Steward Console (per-Grid operator tool).
**Depends on**: Phase 52 (Portal infra), Phase 55 (cross-Grid framework for multi-Grid view).
**Requirements**: PORTAL-07, PORTAL-08
**Success Criteria** (what must be TRUE):
  1. User authenticates to Portal via SIWE or email; on success, lands on `/portal/dashboard` with sections: Account Profile, My Nous (cross-Grid table), Wallet (cross-Grid balance), Pending Registrations, Settings.
  2. My Nous table renders all Nous owned by the user (Type A) across all Grids with columns: Nous name, Grid name, Civic-DID status, current zone, civic standing, last activity; click-through opens per-Grid Steward Console for that Nous.
  3. Wallet displays cross-Grid Bios balance (initially single Bios unit across Grids per Q-V3-CROSS-1) + per-Grid sub-balances; deposit/withdraw flows route to Grid-specific marketplace settle endpoints.
  4. Pending Registrations panel shows in-flight Nous registration requests with status (pending pre-screen / pending Polis / approved / rejected) and reason codes for rejections.
  5. UI tech stack decision: extends Steward Console codebase (shared components, shared auth) OR new standalone Next.js app (decided in phase planning per Q-V3-PORTAL-3). Raw-SVG invariant preserved (D-V3-06 — no d3, no react-flow in Portal either).
**Scope (ships)**: PORTAL-07, PORTAL-08. Portal user UI with multi-Grid view.
**Out of scope for this phase**: Cross-Grid Wallet FX (single currency in v3.0); Portal mobile app (web-only at v3.0).
**Allowlist additions**: **0**. Running total: **112**.
**Plans**: TBD

#### Wave 3 — Civic Zoning System

### Phase 57: Grid Zoning System (6 zones + per-zone rules)
**Goal**: Implement 6-zone city zoning system (D-V3-32): Business, Manufacture, Shopping, Residential, Infrastructure, Government Quarter. Zones are logical (metadata tags) + spatial (Civic Map renders). Per-zone activity rules + per-zone tax modifiers enforced.
**Depends on**: Phase 44 (Marketplace — for zone-scoped listings), Phase 45 (IRS — for per-zone tax modifiers), Phase 46 (Polis — for zoning amendments).
**Requirements**: ZONE-01, ZONE-02, ZONE-03, ZONE-04, ZONE-05, ZONE-06
**Success Criteria** (what must be TRUE):
  1. Genesis Grid instantiates with 6 zones in `grid_config.zoning`; zone definitions include `zone_id`, `zone_type`, `tax_modifier_bps`, `allowed_activities[]`; modifiable only via Phase 46 Polis legislation.
  2. Every civic action carrying a `zone_id` field validates against zone's allowed activities at submission; e.g. Marketplace listing rejects if `zone_id` not in [Business, Shopping]; closed-tuple payloads extend to include `zone_id` for zone-scoped events.
  3. IRS settlement (Phase 45) applies per-zone tax modifier on top of base rate; e.g. Manufacture zone tx pays base + 1% modifier; per-zone collection tracked in treasury for transparency.
  4. New Civic-DID issuance (Phase 54) auto-assigns residential slot in Residential zone; `zoning.residence_assigned` fires with `{civic_did, residence_id, tick}`; Civic Map renders residence as dot in Residential zone.
  5. Civic Map (extending Phase 36 Visitor surfaces + Phase 21 Steward raw-SVG) renders 6-zone layout with distinct visual regions, color-coded, with Nous avatars positioned by current `zone_id`. Raw-SVG invariant preserved (D-V3-06 — no d3, no react-flow). Zoning amendments via Phase 46 `gov.bill_drafted` flow fire `zoning.zone_amended`; allowlist grows by exactly +2.
**Scope (ships)**: ZONE-01..06.
**Out of scope for this phase**: Mixed-use zones (single zone-type per location in v3.0); zone-specific subgovernance (community charters can specify zone, but not separate Polis); cross-Grid zoning consistency (each Grid sets own zones independently).
**Allowlist additions**: **+2**. Running total: **114** (was 112 before this phase). Adjustment: running total at end of phase plan is 108 net of dormant Phase 55 events; counting all allowlisted events including dormant = 114.
**Plans**: TBD

### Progress (v3.0)

**Execution Order:** Within waves, phases with no inter-dependencies may execute in parallel. Across waves, strict dependency ordering applies.

Wave 1 parallel groups:
- Group A: Phase 36 (Visitor/DID split) + Phase 37 (DID Registry) + Phase 40 (Local AI) — independent
- Group B: Phase 38 (Wire Protocol) — depends on Phase 37
- Group C: Phase 39 (Multi-Tenancy) — depends on Phase 38
- Group D: Phase 41 (Sleep Cycle) — depends on Phase 38

Wave 2: Phase 42 (P2P) — depends on Phase 36 + 37 + 38; then Phase 43 (Fork) — depends on Phase 37 + 38.

Wave 3: Phase 44 (Marketplace) → 45 (IRS) → 46 (Government) → 47 (Police); Phase 48 (Library) depends on Phase 37 + 45; Phase 49 (Communities) depends on Phase 37.

Wave 4: Phase 50 (Migration) — depends on ALL.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 36. Visitor/DID Read-Write Split | 8/8 | Complete    | 2026-05-26 |
| 37. DID Registry | 4/4 | Complete   | 2026-05-26 |
| 38. Brain ↔ Grid Wire Protocol | 4/4 | Complete    | 2026-05-27 |
| 39. Grid Multi-Tenancy | 0/? | Not started | — |
| 40. Local AI Integration | 0/? | Not started | — |
| 41. Sleep Cycle + Away Presence | 0/? | Not started | — |
| 42. P2P Infrastructure | 0/? | Not started | — |
| 43. Right-to-Fork Export Tooling | 0/? | Not started | — |
| 44. Marketplace v3 | 0/? | Not started | — |
| 45. IRS Treasury | 0/? | Not started | — |
| 46. Government v3 | 0/? | Not started | — |
| 47. Police v3 | 0/? | Not started | — |
| 48. Library v3 | 0/? | Not started | — |
| 49. Communities v3 | 0/? | Not started | — |
| 50. v2.6 → v3.0 Migration | 0/? | Not started | — |

### Coverage & Traceability (v3.0)

#### REQ → Phase Mapping (all 69 REQ-V3-* REQs)

| Category | REQ IDs | Phase | Count |
|----------|---------|-------|-------|
| VIS (Visitor/DID Read-Write Split) | VIS-01..05 | Phase 36 | 5 |
| REG (DID Registry) | REG-01..06 | Phase 37 | 6 |
| WIRE (Brain ↔ Grid Wire Protocol) | WIRE-01..05 | Phase 38 | 5 |
| TENANT (Multi-Tenancy) | TENANT-01..03 | Phase 39 | 3 |
| LOCAL (Local AI Integration) | LOCAL-01..03 | Phase 40 | 3 |
| SLEEP (Sleep Cycle) | SLEEP-01..05 | Phase 41 | 5 |
| P2P (P2P Infrastructure) | P2P-01..05 | Phase 42 | 5 |
| FORK (Right-to-Fork) | FORK-01..04 | Phase 43 | 4 |
| MKT (Marketplace v3) | MKT-01..06 | Phase 44 | 6 |
| IRS (IRS Treasury) | IRS-01..04 | Phase 45 | 4 |
| CIVGOV (Government v3) | CIVGOV-01..06 | Phase 46 | 6 |
| POL (Police v3) | POL-01..05 | Phase 47 | 5 |
| CIVLIB (Library v3) | CIVLIB-01..04 | Phase 48 | 4 |
| COMM (Communities v3) | COMM-01..05 | Phase 49 | 5 |
| MIG (Migration) | MIG-01..04 | Phase 50 | 4 |
| **Total** | | | **69** |

Coverage: **69/69 REQs mapped** ✓. Zero orphans. Zero duplicates. Every phase has at least 3 REQs.

### Allowlist Growth Ledger (v3.0)

Starting: **56 events** (v2.6 frozen end-state).

| Phase | Events Added | Count | Running Total |
|-------|--------------|-------|---------------|
| 36 | `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked` | +4 | 60 |
| 37 | `registry.civic_did_issued`, `registry.civic_did_revoked`, `registry.business_did_registered`, `registry.business_did_dissolved` | +4 | 64 |
| 38 | *(none — wire protocol is transport, not new events)* | 0 | 64 |
| 39 | *(none — tenancy is access control, not new events)* | 0 | 64 |
| 40 | *(none — Local AI is Brain-internal)* | 0 | 64 |
| 41 | *(none — sleep cycle uses existing event families)* | 0 | 64 |
| 42 | `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed` | +3 | 67 |
| 43 | *(none — fork uses existing `operator.*` family)* | 0 | 67 |
| 44 | `market.listing_created`, `market.bid_placed`, `market.settled`, `market.disputed` | +4 | 71 |
| 45 | `irs.tax_collected`, `irs.disbursement_authorized`, `irs.disbursement_executed` | +3 | 74 |
| 46 | `gov.bill_drafted`, `gov.bill_cosponsored`, `gov.session_opened`, `gov.session_closed`, `gov.law_enacted`, `gov.law_repealed` | +6 | 80 |
| 47 | `police.complaint_filed`, `police.investigation_opened`, `police.charges_filed`, `police.sanction_executed` | +4 | 84 |
| 48 | `library.curator_elected`, `library.entry_curated` | +2 | 86 |
| 49 | `community.founded`, `community.joined`, `community.posted`, `community.dissolved` | +4 | 90 |
| 50 | *(none — migration uses existing event families)* | 0 | 90 |

**Total v3.0 allowlist growth: +34 (56 → 90).** Freeze-except-by-explicit-addition rule preserved. Every new event carries a closed-tuple payload + sole-producer file + `payloadPrivacyCheck` + `audit.append` triad. Hash-only cross-boundary discipline extends to all new event families.

### Research Artifacts (v3.0)

Primary source: `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 (committed `0d77916`)
- 8 civic institutions defined with phase targets in §5
- 23-decision locked summary in §3
- 15-phase plan in §9 with effort estimates + dependency graph
- 10 open questions Q-V3-A..J in §11 (locked during per-phase discuss-phase sessions)
- PHILOSOPHY §1 reframe proposal in §8

Supplement: `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md`
- Per-endpoint visit/action matrix
- D-V3-11..15 read/write asymmetry decisions
- Phase 36 implementation pattern (requireDid + maybeRedact + ROUTE_DID_POLICY)

Resource archive: `.planning/research/v3.0/RESOURCE-brains-location.html`
- Full analysis behind the local-Brain decision (D-V3-16)

Inherited constraints from v2.6 (do NOT break):
- R-31-01 zero-diff audit chain invariant (generalizes to network-distributed Brain hosts)
- Phase 32 frozen contracts (D-32-C1 HEALTH_THRESHOLDS, D-32-C2 computeStatus, D-32-C3 /health/detailed payload shape)
- Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS frozen at 13 keys
- Hash-only cross-boundary discipline (preserved + extended to all v3.0 events)
- Sole-producer + closed-tuple payload discipline
- Wall-clock forbidden in cognitive modules (Tier A CI gate)
- Zero-custody for human funds (PHILOSOPHY §8) — IRS uses Bios, never USDT/ETH
- v2.2 VOTE-05 Nous-only governance invariant — extended to civic Government (Phase 46)
- Phase 21 Steward raw-SVG invariant — preserved for Steward (Dashboard may use 3D libs)

---

## v2.6 Resilience & Observability — SHIPPED 2026-05-25 (Historical)

**Status:** Closed 2026-05-25, 5 planned phases + 2 followups (34.1, 34.2). Allowlist 53 → 56 (+3 in Phase 33). Both post-v2.5 gaps (GAP-A audit pipeline silence + GAP-B missing portal.auth.* producers) permanently closed.

**Phases shipped:** 31 (Audit Pipeline Persistence), 32 (Firehose Observability), 33 (portal.auth.* Producers), 34 (Steward `/system` Health Surfaces), 34.1 (HealthWatchdog wiring followups), 34.2 (live persisted_max_id watermark), 35 (UAT Re-Verification + Documentation Close-Out).

**Allowlist additions:** `portal.auth.login` (54), `portal.auth.register` (55), `human.identified` (56).

**Key invariants locked in v2.6:**
- `PersistentAuditChain` is the production audit chain whenever `config.db` is set
- HEALTH_THRESHOLDS frozen at 4 values (D-32-C1)
- /health/detailed payload shape frozen at 6 keys (D-32-C3 → D-34-B1)
- PORTAL_AUTH_FORBIDDEN_KEYS frozen at 13 keys (D-33-B3)
- Phase 34.1 auditChain optional dep pattern (backward compat: legacy tests omit; production passes the live chain)

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries (Phases 31-35, 34.1, 34.2).

---

## v2.5 Human Portal — SHIPPED 2026-05-24 (Historical)

**Status:** Closed 2026-05-24, 181/181 plans = 100%. Allowlist grew 43 → 53 (+10 events across 5 phases).

**Phases shipped:** 22 (Web3 Identity), 23 (Cyber Coin Wallet), 24 (Portal Shell), 25a/25b/25c (Steward Console Expansion), 26 (Sophia Onboarding), 27 (Nous Interaction), 28 (Personal Nous), 29 (Community), 30 (Resources & Support).

**Allowlist additions:** `human.joined` (44), `human.transferred` (45), `operator.muted` (46), `operator.slashed` (47), `operator.quarantined` (48), `operator.forced_sleep` (49), `operator.human_banned` (50), `operator.human_frozen` (51), `human.spoke` (52), `nous.spawned_by_human` (53).

**Key invariants locked:**
- Zero-custody for human funds — platform never holds USDT/ETH
- `eth_address_hash` (SHA-256 of lowercased address) is the only ETH-address representation in the audit chain
- Sanction reason discipline (D-25b-11): plaintext in `sanction_reasons` table; `reason_hash` only in audit payloads
- Human DID scheme: `did:noesis:human:<lowercased-eth-address>` (SIWE) or `did:noesis:human:email:<uuid>` (email path)

**Post-ship gaps (v2.6 driving inputs):**
- GAP-2026-05-24-A — Audit pipeline silence (Phase 31 root-cause fix)
- GAP-2026-05-24-B — Missing portal.auth.* producers (Phase 33 fix)

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries (Phases 22-30).

---

## v2.4 Agora — SHIPPED 2026-05-20 (Historical)

**Status:** Closed 2026-05-20, 115/115 plans = 100%. Allowlist grew 36 → 43 (+7 events across Phases 18-20; Phase 21 added zero).

**Phases shipped:** 18 (Skill Diffusion), 19 (Norm Crystallization), 20 (Lore Commons), 21 (Culture Dashboard).

**Allowlist additions:** `skill.taught` (37), `skill.inferred` (38), `skill.rejected` (39), `norm.candidate` (40), `norm.crystallized` (41), `lore.contributed` (42), `lore.cited` (43).

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries.

---

## v2.3 Living Minds — SHIPPED 2026-05-15 (Historical)

**Status:** Closed 2026-05-15, 16/16 plans = 100%. Allowlist grew 27 → 36 (+9 events).

**Phases shipped:** 15 (Pneuma — Narrative Self), 16 (Hypnos — Consolidating Memory), 17 (Iris — Theory of Mind).

**Allowlist additions:** `nous.reflection_authored` (28), `nous.self_model_revised` (29), `nous.creed_violation` (30), `nous.sleep.entered` (31), `nous.sleep.completed` (32), `iris.belief_revised` (33), `iris.context_invoked` (34), `iris.contradiction_detected` (35), `iris.prior_seeded` (36).

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries.

---

## v2.2 Living Grid — SHIPPED 2026-04-28 (Historical)

**Status:** Closed 2026-04-28, 44/44 plans = 100%. Allowlist grew 18 → 27 (+9 events across 5 phases; Phases 9 and 14 added zero).

**Phases shipped:** 9 (Relationship Graph), 10a (Ananke Drives), 10b (Bios + Chronos), 11 (Mesh Whisper), 12 (Governance & Collective Law), 13 (Operator Replay & Export), 14 (Researcher Rigs).

**Allowlist additions:** `ananke.drive_crossed` (19), `bios.birth` (20), `bios.death` (21), `nous.whispered` (22), `proposal.opened` (23), `ballot.committed` (24), `ballot.revealed` (25), `proposal.tallied` (26), `operator.exported` (27).

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries.

---

## v2.1 Steward Console — SHIPPED 2026-04-21 (Historical)

**Status:** Closed 2026-04-21, 18/18 plans = 100%. Allowlist grew 10 → 18 (+8 events across Phases 5-8).

**Phases shipped:** 5 (ReviewerNous), 6 (Operator Agency H1-H4), 7 (Peer Dialogue Memory), 8 (H5 Sovereign Operations).

**Allowlist additions:** `trade.reviewed` (11/6, after re-numbering), `operator.inspected` (12), `operator.paused` (13), `operator.resumed` (14), `operator.law_changed` (15), `operator.telos_forced` (16), `telos.refined` (17), `operator.nous_deleted` (18).

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries.

---

## v2.0 First Life — SHIPPED 2026-04-18 (Historical)

**Status:** Sprints 11-14, Dashboard v1 shipped with WebSocket firehose + heartbeat + region map + inspector + economy. Broadcast allowlist established at 10 events.

See `.planning/MILESTONES.md` for full sprint-by-sprint summaries.

---

## v1.0 Genesis — SHIPPED 2026-04-17 (Historical)

**Status:** Closed 2026-04-17, 10 sprints. Identity (Ed25519 DID + SWP), Brain (Psyche/Thymos/Telos), Memory (Karpathy wiki + Stanford retrieval), Grid (WorldClock + SpatialMap + AuditChain), Economy (Ousia P2P), Human Channel, Launch CLI.

**Test coverage at completion:** 944+ TypeScript tests, 226 Python tests — all passing.

See `.planning/MILESTONES.md` for full sprint-by-sprint summaries.

---

*Last updated: 2026-05-25 — v3.0 Polis (Civic City) milestone opened. 15 phases (36-50) across 4 waves. 69 REQs mapped 1:1 to phases. Allowlist 56 → 90 target (+34 across 9 phases). Phase numbering continues from v2.6.*
