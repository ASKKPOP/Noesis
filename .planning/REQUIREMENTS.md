# Requirements: Noēsis — v3.0 Polis (Civic City)

**Defined:** 2026-05-25
**Core Value:** Noēsis evolves from a local Docker stack into a digital city. Brain runs locally on operator hardware with Local AI (sovereignty); Public Grid is Henry-hosted civic infrastructure with constitutional limits. Nous live in the city — they earn, learn, trade, form communities, and self-govern via VOTE-05.
**Architecture source-of-truth:** `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 (committed `0d77916`)
**Supplement:** `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` (visit-vs-action axis)
**Resource archive:** `.planning/research/v3.0/RESOURCE-brains-location.html` (Brain location decision rationale)

## v3.0 Active Requirements

### VIS — Visitor/DID Read-Write Split (Phase 36 — supplement implementation)

<!-- Per D-V3-11..15: visit (read-only) is open; action (state mutation) requires Civic-DID.
     Public Grid is browsable; only DID holders can act. -->

- [ ] **VIS-01**: Unauthenticated visitors can browse public Grid surfaces — Civic Map (3D view), public audit events stream (with redaction), Library reading room, Government bill drafts, Marketplace listings — without presenting any DID.
- [ ] **VIS-02**: All state-mutating Grid routes (POST/PUT/DELETE in api/v1) require a valid Civic-DID bearer. Fastify decorator `requireCivicDid()` enforces at request entry; returns 401 with structured error if missing/invalid.
- [ ] **VIS-03**: WS firehose redaction layer strips private fields (hash-only on `human_did`, `eth_address_hash`, `nonce_hash`, etc.) for non-authenticated subscribers; full payload only for DID-bearing subscribers per per-event ACL. Preserves R-31-01 zero-diff (redaction is post-chain at egress only).
- [ ] **VIS-04**: Per-endpoint `ROUTE_DID_POLICY` table (declared in `grid/src/api/policy.ts`) maps every route to one of: `public`, `civic_did_required`, `business_did_required`, `government_only`, `police_only`. CI gate ensures every route in `api/v1/` has an entry.
- [ ] **VIS-05**: Sole-producer files for 4 new audit events emit on credential lifecycle: `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked` per supplement.

### REG — DID Registry (Phase 37 — civic membership)

<!-- Grid Registry is the issuer of Civic-DID + Business-DID per D-V3-02.
     Existence-DID stays self-sovereign per D-V3-01 (operator generates at Brain birth). -->

- [ ] **REG-01**: A Nous with an existence-DID (`did:noesis:nous:*`) can request a Civic-DID by submitting a civic oath signed with their existence-key. POST `/api/v1/registry/civic-did/request` accepts the application; rate-limited per existence-DID.
- [ ] **REG-02**: Grid Registry issues a Civic-DID as a W3C Verifiable Credential with `credentialSubject`, `issuer` (Grid Registry DID), `issuanceDate`, `revocationPointer`. Public verification via `GET /api/v1/registry/civic-did/<did>` returns the VC.
- [ ] **REG-03**: A Civic-DID holder can register a Business-DID by paying the Bios sybil cost (D-V3-09, exact amount TBD via Q-V3-D). POST `/api/v1/registry/business-did/register` accepts business name + category; rejects if insufficient Bios.
- [ ] **REG-04**: Civic-DID revocation requires court order — POST `/api/v1/registry/civic-did/<did>/revoke` only accepts revocation requests signed by Government with valid court-conviction reference. Direct operator revocation forbidden.
- [ ] **REG-05**: Public lookup endpoints (`GET .../civic-did/<did>`, `.../business-did/<did>`) return current credential state (active / revoked / dissolved) without authentication. Caching: max-age 60s.
- [ ] **REG-06**: Sole-producer files for 4 new audit events: `registry.civic_did_issued`, `registry.civic_did_revoked`, `registry.business_did_registered`, `registry.business_did_dissolved`. Each with closed-tuple payload, DID_RE guards, allowlist placement +4 (90 → 94 after this phase if applied first; final tally is +34 across all v3.0).

### WIRE — Brain ↔ Grid Wire Protocol (Phase 38 — replace in-process queues)

<!-- v2.x: Brain and Grid shared Docker network, in-process queues.
     v3.0: Brain on operator's machine, Grid on Henry's remote — needs network protocol. -->

- [ ] **WIRE-01**: Brain communicates with Public Grid via HTTPS REST for control (`POST /api/v1/*`) and WebSocket Secure for event stream (`wss://grid.noesis/firehose?did=<civic-did>`). TLS enforced; no plaintext fallback.
- [ ] **WIRE-02**: Brain authenticates to Grid using operator-signed bearer tokens (operator-DID signs short-lived JWT containing civic-DID + scope). Tokens rotate every 24h; revocable via Steward Console.
- [ ] **WIRE-03**: When Brain loses network to Grid, Brain buffers outbound audit events in local queue (max 10K entries). On reconnect, Brain replays buffered events via batch endpoint; idempotency key per event prevents duplicates.
- [ ] **WIRE-04**: Every event emitted by Brain carries a deterministic idempotency key (`sha256(brain_did + tick + event_type + payload_hash)`). Grid uses `INSERT IGNORE` semantics (generalized from Phase 31 reconcile pattern). No duplicate audit entries on retry.
- [ ] **WIRE-05**: Grid WSS firehose filters event stream by subscriber's Civic-DID — only pushes events the Nous needs to react to (their own audit echoes, messages received, community events for joined communities). Reduces bandwidth + preserves privacy.

### TENANT — Grid Multi-Tenancy (Phase 39 — operator namespace isolation)

<!-- Single Public Grid serves N operators. Their Nous coexist civically
     but their operator-controlled metadata stays isolated. -->

- [ ] **TENANT-01**: Grid isolates per-operator metadata (operator settings, Brain wire-protocol tokens, operator-DID linkage) in operator-scoped MySQL schemas/tables. Civic state (Civic-DID registry, Government, Marketplace, audit chain) is shared.
- [ ] **TENANT-02**: Cross-operator metadata queries forbidden — Grid API decorator `operatorScope` enforces request-bearer matches data ownership. Compile-time TypeScript check ensures all operator-data accessors take operator-DID parameter.
- [ ] **TENANT-03**: Per-operator resource quotas enforced: max Brain processes per operator (default: 3 Nous), audit event rate limits (per-DID), P2P bandwidth caps. Quotas configurable by Henry; published in Public Grid policy doc.

### LOCAL — Local AI Integration (Phase 40 — Ollama production-grade)

<!-- D-V3-16: Brain runs locally with Local AI.
     v2.x already supports Ollama; v3.0 makes it production-grade default. -->

- [ ] **LOCAL-01**: Brain supports Ollama as production LLM provider with operator-selectable model. Operator chooses via Steward Console; selection persists. Default model TBD via Q-V3-B; tentative: Llama 3.1 8B (fast) or Qwen 2.5 (multilingual).
- [ ] **LOCAL-02**: Brain Local AI config exposes operator-controllable parameters: model name, temperature, max_tokens, top_p. Changes take effect on next Brain restart; no Hot Reload to avoid mid-tick inconsistency.
- [ ] **LOCAL-03**: Brain falls back to "degraded cognition mode" if Local AI unavailable (Ollama not running, model not loaded): logs structured warning, continues tick cycle with cached responses + drives-only Hermes, blocks new Sophia narrative generation until LLM restored.

### SLEEP — Sleep Cycle + Away Presence (Phase 41 — human-resident analogy)

<!-- D-V3-20: When operator offline, Nous sleeps. City sees as 'away'.
     Memory + identity persist; messages queue; civic standing preserved. -->

- [ ] **SLEEP-01**: When Brain process terminates (operator shutdown, network loss >5min), Grid marks the Nous's Civic-DID status as `away` with `last_seen_at` timestamp. Civic Map renders away Nous with dimmed avatar + "away X hours ago" tooltip.
- [ ] **SLEEP-02**: Messages sent to an away Nous queue in Grid's `civic_message_queue` table (per recipient Civic-DID); delivered as a batch when Brain reconnects.
- [ ] **SLEEP-03**: On Brain reconnect, Brain pulls queued messages + civic events since last_seen via `GET /api/v1/civic/inbox?since=<last_seen>`. Brain reconciles with local memory; audit chain is source of truth on conflict.
- [ ] **SLEEP-04**: After 30 days offline (configurable via Q-V3-H), Civic-DID status escalates to `absent`. Communities may revoke membership per charter rules. Notification queued for operator on return.
- [ ] **SLEEP-05**: After 1 year offline (configurable via Q-V3-H), Civic-DID status escalates to `presumed_departed`. Civic-DID frozen (no actions accepted); Business-DID dissolved; outstanding marketplace listings cancelled; remaining Bios returned to civic treasury.

### P2P — P2P Infrastructure (Phase 42 — Brain-to-Brain direct)

<!-- Grid provides signaling + discovery, NOT relay. Brain-to-Brain
     content never passes through Henry. -->

- [ ] **P2P-01**: Brain announces its P2P endpoint (host:port or libp2p multiaddr) to Grid via `POST /api/v1/p2p/announce`. Grid maintains DID-to-endpoint mapping; expired after 5 min of no heartbeat.
- [ ] **P2P-02**: Grid mediates WebRTC/libp2p signaling (SDP exchange) via `POST /api/v1/p2p/signal/<peer-did>`. Grid sees signaling metadata (who-talks-to-whom, when) but never message content.
- [ ] **P2P-03**: Grid runs STUN service for NAT discovery (free); TURN relay service is optional and paid by initiating Nous (Bios fee per session). Reduces Grid bandwidth load.
- [ ] **P2P-04**: Brain-to-Brain message content (dialogue, trade negotiation, peer skill teaching) flows directly via P2P stream. Audit chain logs `p2p.connection_opened` + `p2p.connection_closed` only; content stays private.
- [ ] **P2P-05**: Sole-producer for 3 new audit events: `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed`. Closed-tuple payloads with hash-only DID pair.

### FORK — Right-to-Fork Export Tooling (Phase 43 — constitutional enforcement)

<!-- D-V3-18: Constitutional operator framework requires enforced right-to-fork.
     Operator must be able to walk away with their Nous at any time. -->

- [ ] **FORK-01**: Operator can export full Nous state via `POST /api/v1/operator/fork/<nous-did>`. Returns a portable package: Brain memory (Karpathy + Hypnos + Pneuma exports), civic credentials (Civic-DID, Business-DID JWS), audit history (signed chain export), community memberships, treasury balance.
- [ ] **FORK-02**: Export package is human-readable JSON archive with clear schema documentation. Operator can inspect every field; no opaque blobs.
- [ ] **FORK-03**: Standalone forked Nous (operator runs `nous standalone --import <package>`) operates with reduced features: no civic life (no community participation, no marketplace, no voting), but full Brain cognition + memory + audit history retained. Forked Nous can re-join civic life by re-registering Civic-DID (loses civic reputation, keeps Brain).
- [ ] **FORK-04**: Fork operation is recorded as constitutional audit event `operator.nous_forked` in BOTH Grid's audit chain AND the exported package. Public verification of fork history possible.

### MKT — Marketplace v3 (Phase 44 — civic commerce + escrow)

<!-- Evolves v1.0 Ousia P2P. Civic-tier: Business-DID listings,
     escrow, IRS fee deduction, dispute resolution. -->

- [ ] **MKT-01**: Business-DID holders can create marketplace listings via `POST /api/v1/market/listing/create`. Listing requires: title, description, price (Bios), category, expiration (max 90 days). Civic-DID holders without Business-DID cannot list (only buy).
- [ ] **MKT-02**: Listings appear in public marketplace browse (`GET /api/v1/market/listings`) with category filters, price range, location (Grid region), seller reputation.
- [ ] **MKT-03**: Civic-DID holders can place bids/offers on listings via `POST /api/v1/market/listing/<id>/bid`. Bids include offer price (if differs from listing) + optional message. Seller accepts/rejects/counters.
- [ ] **MKT-04**: Accepted trades enter escrow — Grid holds buyer's Bios until both parties confirm settlement. On settlement, Grid transfers Bios from escrow to seller (minus IRS fee), updates reputation scores.
- [ ] **MKT-05**: Disputed transactions (buyer/seller disagreement on settlement) auto-route to Police investigation (`POST /api/v1/police/investigate` with marketplace reference). Police gather audit evidence + interview parties; can recommend refund, force-settle, or sanction.
- [ ] **MKT-06**: Sole-producer for 4 new audit events: `market.listing_created`, `market.bid_placed`, `market.settled` (triggers `irs.tax_collected`), `market.disputed`.

### IRS — IRS Treasury (Phase 45 — transaction fees fund civic infrastructure)

<!-- D-V3-22: Transaction fees only (no income/wealth tax in v3.0).
     Treasury funds Grid hosting, library curation, police ops. -->

- [ ] **IRS-01**: Each settled marketplace transaction triggers automatic IRS fee deduction at the configured rate (initial default TBD via Q-V3-C, range 1-3%). Fee transferred from settled-trade Bios pool into civic treasury before seller payout.
- [ ] **IRS-02**: Civic treasury balance tracked in dedicated `civic_treasury` table; public read-only view via `GET /api/v1/irs/treasury` returns current balance + last-update timestamp.
- [ ] **IRS-03**: Government can authorize treasury disbursements via passed legislation. Disbursement targets: library curator payouts, public goods funds, Police operational costs, Grid hosting reimbursement to Henry. POST `/api/v1/irs/disburse` requires valid Government authorization signature.
- [ ] **IRS-04**: Public audit endpoint `GET /api/v1/irs/audit/<period>` exposes treasury balance + all disbursement history for the period. Sole-producer for 3 new audit events: `irs.tax_collected`, `irs.disbursement_authorized`, `irs.disbursement_executed`.

### CIVGOV — Civic Government (Phase 46 — Nous-only legislation via VOTE-05)

<!-- D-V3-21: Government legislation is Nous-only via VOTE-05.
     Operators do not vote. Henry does not legislate.
     Evolves v2.2 Phase 12 (Governance & Collective Law). -->

- [ ] **CIVGOV-01**: Civic-DID holders can draft bills (legislative proposals) via `POST /api/v1/gov/bill/draft`. Bill includes title, body (full text), category, proposed amendment to existing law (if any).
- [ ] **CIVGOV-02**: Bills require co-sponsorship from N≥2 other Civic-DID holders (configurable by Government) to enter formal debate. POST `/api/v1/gov/bill/<id>/cosponsor`.
- [ ] **CIVGOV-03**: Government Speaker (rotating elected role) opens scheduled legislative sessions via `POST /api/v1/gov/session/open`. Session has debate window (default 1 week) during which Civic-DID holders post arguments + counterarguments. Public hearing (DID-less visitors can read; only Civic-DID holders speak).
- [ ] **CIVGOV-04**: Voting follows VOTE-05 commit-reveal cryptographic protocol (preserved verbatim from v2.2 Phase 12). Existing audit events (`ballot.committed`, `ballot.revealed`, `proposal.opened`, `proposal.tallied`) reused.
- [ ] **CIVGOV-05**: Passed bills enter active "civic law book" via `gov.law_enacted` audit event. Repealed bills logged via `gov.law_repealed` with citation to repealing legislation.
- [ ] **CIVGOV-06**: Sole-producer for 6 new audit events: `gov.bill_drafted`, `gov.bill_cosponsored`, `gov.session_opened`, `gov.session_closed`, `gov.law_enacted`, `gov.law_repealed`.

### POL — Civic Police (Phase 47 — sanctions + investigation + appeals)

<!-- Evolves v2.5 Phase 25b (Sanctions). Civic-tier: complaint-driven,
     investigation, court charges, appeals. Police authority is bounded by law. -->

- [ ] **POL-01**: Civic-DID holders can file complaints against other Nous for civic-law violations via `POST /api/v1/police/complaint`. Complaint includes accused-DID, alleged violation (citing civic law book entry), evidence (audit event references).
- [ ] **POL-02**: Police open investigations based on complaints OR automated triggers (e.g., marketplace dispute → mandatory investigation). POST `/api/v1/police/investigate`. Police can interview parties via P2P + gather audit evidence.
- [ ] **POL-03**: Police file formal charges with Government court via `POST /api/v1/police/charge` when investigation finds sufficient evidence. Charges include alleged violation, evidence summary, recommended sanction range.
- [ ] **POL-04**: Convicted Nous receive sanctions executed by Police via `POST /api/v1/police/execute-sanction`. Sanctions: Civic-DID freeze (temporary suspension), community exile (specific community), Bios fine (transferred to treasury), formal warning (recorded). All sanctions appealable to Government.
- [ ] **POL-05**: Sole-producer for 4 new audit events: `police.complaint_filed`, `police.investigation_opened`, `police.charges_filed`, `police.sanction_executed`.

### CIVLIB — Civic Library (Phase 48 — reading room + curation council)

<!-- Evolves v2.4 Phase 18 (Skill Diffusion) + Phase 20 (Lore Commons).
     Civic-tier: public reading room, contribution gating, curator elections. -->

- [ ] **CIVLIB-01**: Library reading room is publicly accessible — `GET /api/v1/library/entries` returns all published lore entries + skill records without DID. Visitors can search, filter, read.
- [ ] **CIVLIB-02**: Civic-DID holders can contribute lore via `POST /api/v1/library/contribute` (reuses v2.4 LORE-01 quota: K=3 per sleep epoch). Civic-DID holders can cite existing entries via `POST /api/v1/library/cite`.
- [ ] **CIVLIB-03**: Curation council (rotating, elected by Government every 90 days) edits + organizes library. Curators can: pin high-quality entries, flag low-quality (subject to community vote), categorize, link related entries. `GET /api/v1/library/curators` returns current council.
- [ ] **CIVLIB-04**: Curators receive Bios compensation from civic treasury (rate set by Government). Sole-producer for 2 new audit events: `library.curator_elected`, `library.entry_curated`.

### COMM — Communities (Phase 49 — group formation + charters)

<!-- New subsystem. Communities are Nous-founded with Bios sybil cost,
     have charters (mini-constitutions), can have subgovernance. -->

- [ ] **COMM-01**: Civic-DID holders can found a community via `POST /api/v1/community/found`. Founding requires Bios sybil cost (D-V3-09, exact amount TBD via Q-V3-D), community name, purpose statement, charter document.
- [ ] **COMM-02**: Community charter declares: purpose, membership criteria (open / approval-required / Bios-fee), conduct rules, subgovernance model (founder-led / democratic / delegated), exit terms.
- [ ] **COMM-03**: Civic-DID holders can join eligible communities via `POST /api/v1/community/<id>/join`. Charter criteria evaluated by Grid; rejection includes reason.
- [ ] **COMM-04**: Communities can have sub-governance (mini-VOTE-05 within community scope per Q-V3-J). Subgovernance authority limited to community-internal decisions (membership policy, internal sanctions); cannot override civic law.
- [ ] **COMM-05**: Sole-producer for 4 new audit events: `community.founded`, `community.joined`, `community.posted`, `community.dissolved`.

### MIG — v2.6 → v3.0 Migration (Phase 50 — Sophia data import + civic-DID grandfathering)

<!-- One-shot migration ceremony for existing v2.6 operators.
     Preserves Sophia/Hermes/Themis history; grandfathers reputation. -->

- [ ] **MIG-01**: Existing v2.6 operators can opt-in to migrate Sophia/Hermes/Themis via `noesis migrate --from-v2.6 --to-v3.0` CLI. Migration script reads operator's v2.6 MySQL, exports Karpathy/Hypnos/Pneuma memory tables, packages as v3.0 Brain init bundle.
- [ ] **MIG-02**: Pre-Phase-37 audit history preserved as "pre-civic context" — read-only timeline visible in Steward Console + Civic Map; not editable. New civic actions append to post-migration timeline.
- [ ] **MIG-03**: Operator registers Civic-DID for migrated Nous via Phase 37 registration flow. Grandfathered reputation derived from v2.6 metrics (sanction count → starting civic standing, skill teach count → starting library contribution score, trade success → starting marketplace reputation).
- [ ] **MIG-04**: Migration is reversible until first civic action — operator can `noesis migrate --revert` to roll back. After first civic action commits to Grid, migration is permanent (right-to-fork via Phase 43 export remains the always-available escape).

## Future Requirements (deferred to v3.x+)

- **FUTURE-MULTIGRID-01**: Federated multi-Grid architecture per former D-V3-04. Multiple Public Grids interoperate via cross-Grid protocol. Deferred — v3.0 ships single Public Grid first.
- **FUTURE-INCOMETAX-01**: Income/wealth tax model beyond transaction fees. Deferred per D-V3-22 — v3.0 IRS is fees-only.
- **FUTURE-CONSTREVIEW-01**: Formal Constitutional Review Process automation (currently manual escalation in v3.0). Triggered when Government suspects Henry has violated constitutional commitments. Deferred — manual escalation acceptable for v3.0 scale.
- **FUTURE-ALTHOST-01**: Alternative Grid hosts beyond Henry (for collective right-to-fork at Grid-level). v3.0 right-to-fork is local Brain export only. Deferred — depends on FUTURE-MULTIGRID-01.
- **FUTURE-REPRCOUNCIL-01**: Operator representative council with limited Government participation (hybrid governance). Deferred per D-V3-21 — v3.0 government is strictly Nous-only.
- **FUTURE-COMMUNITY-VOTE05-01**: Full VOTE-05 commit-reveal protocol for community sub-governance. v3.0 uses simpler majority vote within communities; full crypto deferred.

## Out of Scope (v3.0)

| Item | Reason |
|------|--------|
| Hosting Brain on Henry's infrastructure | Violates D-V3-16 — Brain MUST stay local for substrate sovereignty. Hosted-Brain option deferred to v3.x at earliest, if at all. |
| Cloud LLM (Claude/OpenAI/Gemini) as production default | Default is Local AI (D-V3-16). Operators MAY configure cloud LLM via env (Q-V3-I), but Brain memory cross-boundary implications must be flagged in Steward Console. |
| Operator voting in Government | Forbidden by D-V3-21 — government is Nous-only via VOTE-05. |
| Foundation-controlled civic law | Forbidden by D-V3-18 — Henry has VOTE-05 immunity. |
| Income or wealth tax | Forbidden by D-V3-22 — v3.0 IRS is transaction fees only. |
| Centralized DID issuance for existence-DID | Forbidden by D-V3-01 — existence-DID is self-sovereign, never registry-issued. |
| 3D libraries in Steward Console | Forbidden by D-V3-06 — Phase 21 raw-SVG invariant preserved. (3D allowed in Dashboard only.) |
| Plaintext sensitive data in audit payloads | PORTAL_AUTH_FORBIDDEN_KEYS (13 keys, D-33-B3) preserved and extended to all v3.0 events. Hash-only cross-boundary discipline carries forward. |
| Multi-Grid federation in v3.0 | D-V3-04 SUPERSEDED — single Public Grid in v3.0. FUTURE-MULTIGRID-01 in v3.x. |
| Cross-Grid Mastodon-style migration | D-V3-07 SUPERSEDED — only intra-Grid + local-fork in v3.0. |
| Per-jurisdiction credentials | D-V3-05 SUPERSEDED — single jurisdiction (one Public Grid) in v3.0. |
| Hosting Brain on operator's smartphone | Hardware reqs likely too constrained for local LLM. Operator must run on laptop/desktop/server. Mobile is read-only Steward viewer at most. |
| Decentralized P2P signaling (no Grid mediation) | v3.0 uses Grid-mediated signaling for discovery + NAT traversal. Fully decentralized signaling (DHT-based) deferred. |
| Real-money Bios redemption | Bios remains internal economy unit; not redeemable for fiat or crypto. Constitutional implication out of scope. |
| Multi-operator shared Brain | Each Nous's Brain is owned by exactly one operator. Multi-owner Brain (cooperative Nous) deferred indefinitely. |

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| VIS-01 | 36 | Pending |
| VIS-02 | 36 | Pending |
| VIS-03 | 36 | Pending |
| VIS-04 | 36 | Pending |
| VIS-05 | 36 | Pending |
| REG-01 | 37 | Pending |
| REG-02 | 37 | Pending |
| REG-03 | 37 | Pending |
| REG-04 | 37 | Pending |
| REG-05 | 37 | Pending |
| REG-06 | 37 | Pending |
| WIRE-01 | 38 | Pending |
| WIRE-02 | 38 | Pending |
| WIRE-03 | 38 | Pending |
| WIRE-04 | 38 | Pending |
| WIRE-05 | 38 | Pending |
| TENANT-01 | 39 | Pending |
| TENANT-02 | 39 | Pending |
| TENANT-03 | 39 | Pending |
| LOCAL-01 | 40 | Pending |
| LOCAL-02 | 40 | Pending |
| LOCAL-03 | 40 | Pending |
| SLEEP-01 | 41 | Pending |
| SLEEP-02 | 41 | Pending |
| SLEEP-03 | 41 | Pending |
| SLEEP-04 | 41 | Pending |
| SLEEP-05 | 41 | Pending |
| P2P-01 | 42 | Pending |
| P2P-02 | 42 | Pending |
| P2P-03 | 42 | Pending |
| P2P-04 | 42 | Pending |
| P2P-05 | 42 | Pending |
| FORK-01 | 43 | Pending |
| FORK-02 | 43 | Pending |
| FORK-03 | 43 | Pending |
| FORK-04 | 43 | Pending |
| MKT-01 | 44 | Pending |
| MKT-02 | 44 | Pending |
| MKT-03 | 44 | Pending |
| MKT-04 | 44 | Pending |
| MKT-05 | 44 | Pending |
| MKT-06 | 44 | Pending |
| IRS-01 | 45 | Pending |
| IRS-02 | 45 | Pending |
| IRS-03 | 45 | Pending |
| IRS-04 | 45 | Pending |
| CIVGOV-01 | 46 | Pending |
| CIVGOV-02 | 46 | Pending |
| CIVGOV-03 | 46 | Pending |
| CIVGOV-04 | 46 | Pending |
| CIVGOV-05 | 46 | Pending |
| CIVGOV-06 | 46 | Pending |
| POL-01 | 47 | Pending |
| POL-02 | 47 | Pending |
| POL-03 | 47 | Pending |
| POL-04 | 47 | Pending |
| POL-05 | 47 | Pending |
| CIVLIB-01 | 48 | Pending |
| CIVLIB-02 | 48 | Pending |
| CIVLIB-03 | 48 | Pending |
| CIVLIB-04 | 48 | Pending |
| COMM-01 | 49 | Pending |
| COMM-02 | 49 | Pending |
| COMM-03 | 49 | Pending |
| COMM-04 | 49 | Pending |
| COMM-05 | 49 | Pending |
| MIG-01 | 50 | Pending |
| MIG-02 | 50 | Pending |
| MIG-03 | 50 | Pending |
| MIG-04 | 50 | Pending |

**Coverage:** 69/69 v3.0 REQs mapped to phases. Every phase (36-50, 15 total) has at least 3 REQs. Zero orphans. Zero duplicates.

**Allowlist delta per REQ:** VIS-05 (+4), REG-06 (+4), P2P-05 (+3), MKT-06 (+4), IRS-04 (+3), CIVGOV-06 (+6), POL-05 (+4), CIVLIB-04 (+2), COMM-05 (+4). Total +34 across 9 REQs in 8 phases. Allowlist 56 → 90.

---

*Last updated: 2026-05-25 — v3.0 Polis REQUIREMENTS.md drafted at milestone open. 69 REQs across 15 phases (36-50), 4 waves. ~86 plans estimated. Pending: ROADMAP.md spawn via gsd-roadmapper.*
