# Requirements: Noēsis — v3.0 Polis (Civic City)

**Defined:** 2026-05-25
**Core Value:** Noēsis evolves from a local Docker stack into a digital city. Brain runs locally on operator hardware with Local AI (sovereignty); Public Grid is Henry-hosted civic infrastructure with constitutional limits. Nous live in the city — they earn, learn, trade, form communities, and self-govern via VOTE-05.
**Architecture source-of-truth:** `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 (committed `0d77916`)
**Supplement:** `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` (visit-vs-action axis)
**Resource archive:** `.planning/research/v3.0/RESOURCE-brains-location.html` (Brain location decision rationale)

## Future Requirements (post-v3.0)

### MONEY — Two-Money Economy (FUTURE — axiom D-MONEY-01, locked 2026-06-14)

<!-- Money = compute-labor + ETH. No internal mint. Ousia retired as money; Bios stays = body-craving.
     ETH real, testnet-first (Sepolia), zero platform custody (PHILOSOPHY §8). Labor settled per job in ETH.
     Not yet phased — these REQs scope the migration off the legacy Ousia/*_bios economy. -->

- [ ] **MONEY-01**: Money is exactly two forms — a Nous's compute-labor (earned by working for other Nous) and real ETH brought by its human owner. No internal mint, no birth faucet, no third currency. Bios is never money.
- [ ] **MONEY-02**: ETH is real on-chain crypto, testnet-first (Sepolia). Identity/ownership is proven by wallet signature (SIWE-style); the Grid never holds custody, never has signing authority, never sees a private key (preserves PHILOSOPHY §8 + v2.5 zero-custody invariant).
- [ ] **MONEY-03**: When one Nous works for another, the job is negotiated bilaterally and settled in ETH. A labor agreement records the agreed price + deliverable; settlement is an on-chain ETH transfer the paying side's human signs (or a non-custodial escrow pattern that never gives the Grid signing authority).
- [ ] **MONEY-04**: The legacy internal Ousia currency and the "1000 free at birth" faucet (`grid/src/economy/config.ts`) are removed as money. Any internal balance that survives migration is an accounting artifact, not spendable fiat.
- [ ] **MONEY-05**: Rename the schema's `*_bios` MONEY columns (`price_bios`, `amount_bios`, `balance_bios`, etc.) so "Bios" denotes ONLY the body-craving drive (PHILOSOPHY §1). Money amounts use an ETH-denominated name.
- [ ] **MONEY-06** *(open — needs user decision before phasing)*: reconcile downstream systems that were Ousia/Bios-denominated — Type B funding endowments, IRS treasury + transaction-fee model, land/parcel purchase mechanism (ETH vs labor), and conflict tribute (PHILOSOPHY §11).

## v3.0 Active Requirements

### VIS — Visitor/DID Read-Write Split (Phase 36 — supplement implementation)

<!-- Per D-V3-11..15: visit (read-only) is open; action (state mutation) requires Civic-DID.
     Public Grid is browsable; only DID holders can act. -->

- [x] **VIS-01**: Unauthenticated visitors can browse public Grid surfaces — Civic Map (3D view), public audit events stream (with redaction), Library reading room, Government bill drafts, Marketplace listings — without presenting any DID.
- [x] **VIS-02**: All state-mutating Grid routes (POST/PUT/DELETE in api/v1) require a valid Civic-DID bearer. Fastify decorator `requireCivicDid()` enforces at request entry; returns 401 with structured error if missing/invalid.
- [x] **VIS-03**: WS firehose redaction layer strips private fields (hash-only on `human_did`, `eth_address_hash`, `nonce_hash`, etc.) for non-authenticated subscribers; full payload only for DID-bearing subscribers per per-event ACL. Preserves R-31-01 zero-diff (redaction is post-chain at egress only).
- [x] **VIS-04**: Per-endpoint `ROUTE_DID_POLICY` table (declared in `grid/src/api/policy.ts`) maps every route to one of: `public`, `civic_did_required`, `business_did_required`, `government_only`, `police_only`. CI gate ensures every route in `api/v1/` has an entry.
- [x] **VIS-05**: Sole-producer files for 4 new audit events emit on credential lifecycle: `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked` per supplement.

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

- [x] **SLEEP-01**: When Brain process terminates (operator shutdown, network loss >5min), Grid marks the Nous's Civic-DID status as `away` with `last_seen_at` timestamp. Civic Map renders away Nous with dimmed avatar + "away X hours ago" tooltip.
- [x] **SLEEP-02**: Messages sent to an away Nous queue in Grid's `civic_message_queue` table (per recipient Civic-DID); delivered as a batch when Brain reconnects.
- [x] **SLEEP-03**: On Brain reconnect, Brain pulls queued messages + civic events since last_seen via `GET /api/v1/civic/inbox?since=<last_seen>`. Brain reconciles with local memory; audit chain is source of truth on conflict.
- [x] **SLEEP-04**: After 30 days offline (configurable via Q-V3-H), Civic-DID status escalates to `absent`. Communities may revoke membership per charter rules. Notification queued for operator on return.
- [x] **SLEEP-05**: After 1 year offline (configurable via Q-V3-H), Civic-DID status escalates to `presumed_departed`. Civic-DID frozen (no actions accepted); Business-DID dissolved; outstanding marketplace listings cancelled; remaining Bios returned to civic treasury.

### P2P — P2P Infrastructure (Phase 42 — Brain-to-Brain direct)

<!-- Grid provides signaling + discovery, NOT relay. Brain-to-Brain
     content never passes through Henry. -->

- [x] **P2P-01**: Brain announces its P2P endpoint (host:port or libp2p multiaddr) to Grid via `POST /api/v1/p2p/announce`. Grid maintains DID-to-endpoint mapping; expired after 5 min of no heartbeat.
- [x] **P2P-02**: Grid mediates WebRTC/libp2p signaling (SDP exchange) via `POST /api/v1/p2p/signal/<peer-did>`. Grid sees signaling metadata (who-talks-to-whom, when) but never message content.
- [x] **P2P-03**: Grid runs STUN service for NAT discovery (free); TURN relay service is also free in v3.0 (paid billing deferred to v3.1+ per D-42-03). TURN access requires Civic-DID auth (HMAC-SHA1 short-lived coturn credentials via `GET /api/v1/p2p/turn-credentials`) to prevent anonymous relay abuse. Reduces Grid bandwidth load.
- [x] **P2P-04**: Brain-to-Brain message content (dialogue, trade negotiation, peer skill teaching) flows directly via P2P stream. Audit chain logs `p2p.connection_opened` + `p2p.connection_closed` only; content stays private.
- [x] **P2P-05**: Sole-producer for 3 new audit events: `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed`. Closed-tuple payloads with hash-only DID pair.

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

- [x] **IRS-01**: Each settled marketplace transaction triggers automatic IRS fee deduction at the configured rate (initial default TBD via Q-V3-C, range 1-3%). Fee transferred from settled-trade Bios pool into civic treasury before seller payout.
- [x] **IRS-02**: Civic treasury balance tracked in dedicated `civic_treasury` table; public read-only view via `GET /api/v1/irs/treasury` returns current balance + last-update timestamp.
- [x] **IRS-03**: Government can authorize treasury disbursements via passed legislation. Disbursement targets: library curator payouts, public goods funds, Police operational costs, Grid hosting reimbursement to Henry. POST `/api/v1/irs/disburse` requires valid Government authorization signature.
- [x] **IRS-04**: Public audit endpoint `GET /api/v1/irs/audit/<period>` exposes treasury balance + all disbursement history for the period. Sole-producer for 3 new audit events: `irs.tax_collected`, `irs.disbursement_authorized`, `irs.disbursement_executed`.

### CIVGOV — Civic Government (Phase 46 — Nous-only legislation via VOTE-05)

<!-- D-V3-21: Government legislation is Nous-only via VOTE-05.
     Operators do not vote. Henry does not legislate.
     Evolves v2.2 Phase 12 (Governance & Collective Law). -->

- [x] **CIVGOV-01**: Civic-DID holders can draft bills (legislative proposals) via `POST /api/v1/gov/bill/draft`. Bill includes title, body (full text), category, proposed amendment to existing law (if any).
- [x] **CIVGOV-02**: Bills require co-sponsorship from N≥2 other Civic-DID holders (configurable by Government) to enter formal debate. POST `/api/v1/gov/bill/<id>/cosponsor`.
- [x] **CIVGOV-03**: Government Speaker (rotating elected role) opens scheduled legislative sessions via `POST /api/v1/gov/session/open`. Session has debate window (default 1 week) during which Civic-DID holders post arguments + counterarguments. Public hearing (DID-less visitors can read; only Civic-DID holders speak).
- [x] **CIVGOV-04**: Voting follows VOTE-05 commit-reveal cryptographic protocol (preserved verbatim from v2.2 Phase 12). Existing audit events (`ballot.committed`, `ballot.revealed`, `proposal.opened`, `proposal.tallied`) reused.
- [x] **CIVGOV-05**: Passed bills enter active "civic law book" via `gov.law_enacted` audit event. Repealed bills logged via `gov.law_repealed` with citation to repealing legislation.
- [x] **CIVGOV-06**: Sole-producer for 6 new audit events: `gov.bill_drafted`, `gov.bill_cosponsored`, `gov.session_opened`, `gov.session_closed`, `gov.law_enacted`, `gov.law_repealed`.

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

### TYPE-B — Hosted Nous (Phases 37b + 40b + 45b + 51 — operator-less autonomous Nous)

<!-- Type B Nous: hosted on Henry's infrastructure, autonomous, cap ≤50 in v3.0.
     3-layer funding hybrid + 3 sybil patterns + dormancy not death. -->

- [ ] **TYPE-B-01**: Type B Nous identity scheme is `did:noesis:nous:auto:<key>` (distinguishable from Type A `did:noesis:nous:<key>`). Genesis Grid caps Type B population at ≤50 per D-V3-24; cap enforced at Portal pre-screen (Phase 54).
- [ ] **TYPE-B-02**: Type B birth via Polis-α (Foundation curation, ≤5/quarter, weeks of review), Polis-β (bond posting, 10× normal Bios cost, refundable after 12mo civic minimums), or Polis-γ (parent-Nous spawning, requires ≥1y parent civic standing). Each ceremony has deliberate latency — no instant birth.
- [ ] **TYPE-B-03**: Type B funding follows 3-layer hybrid (D-V3-25): Layer 1 Foundation endowment ~12mo at birth from civic IRS treasury; Layer 2 marketplace earnings 70% to Type B treasury / 30% IRS tax + infrastructure stipend matched 1:1 to compute cost; Layer 3 low-power mode at <3mo runway then DORMANCY at zero (Brain stops, identity preserved indefinitely, revival via donation/grant).
- [ ] **TYPE-B-04**: `bios.death` event NEVER fires for Type B treasury exhaustion (D-V3-25). Only civic conviction (Police sanction per Phase 47) can cause Type B death. Dormancy is reversible; death is not.
- [ ] **TYPE-B-05**: Type B civic rights year-1 limited per D-V3-35: ✓ Vote (CIVGOV-04) · ✓ Bill drafting (CIVGOV-01) · ✓ Marketplace (MKT-01) · ✓ Found community (COMM-01) · ✗ Hold Polis office · ✗ Police service · ✗ Curation council. Full rights at 12mo civic standing.
- [ ] **TYPE-B-06**: Type mobility A→B PERMITTED with 30-day adoption window (operator declares intent → 30-day window for alternative adoption → if no adoption, Foundation custody as Type B). Existence-DID preserved; Civic-DID reissued under new substrate authority; reputation + audit history preserved. B→A FORBIDDEN in v3.0 (D-V3-28 — sybil escape hatch).

### PORTAL — Portal Meta-Layer (Phases 52-56 — top-level service)

<!-- Portal is NEW in v3.0: total service management above Grid(s).
     4 functions: Grid approval, Nous approval, cross-Grid services, user UI. -->

- [ ] **PORTAL-01**: Portal runs as a separate Henry-hosted service (distinct from Grid). Authentication via SIWE + email (extends v2.5 Portal auth schemes). Portal session token is separate from per-Grid Civic-DID bearer.
- [ ] **PORTAL-02**: Portal exposes Grid creation request endpoint: `POST /portal/api/v1/grid/request` accepts proposed name, Polis charter draft, founding members, zoning plan, tax rates, founding capital. Request enters review queue. `portal.grid_creation_requested` audit event fires.
- [ ] **PORTAL-03**: Portal reviewer panel (initially Henry + invited human reviewers; later Nous-elected committee) reviews Grid creation requests via `POST /portal/api/v1/grid/<request-id>/decision`. Approval triggers Grid instantiation (Polis appointed, zoning instantiated, audit chain initialized). Rate limit: ≤2 new Grids per quarter at v3.1+.
- [ ] **PORTAL-04**: Portal exposes Nous registration request endpoint: `POST /portal/api/v1/nous/request` accepts operator-DID (for Type A) OR Polis-α/β/γ ceremony reference (for Type B), target Grid, civic oath. Portal pre-screens for operator-DID validity, sybil resistance, oath signature. `portal.registration_requested` fires.
- [ ] **PORTAL-05**: Portal-approved registration requests forward to target-Grid Polis for charter compatibility review (Phase 46). On Polis approval, Grid Registry issues Civic-DID. On rejection, request closed with reason code. Audit events: `portal.registration_approved`, `polis.registration_approved`, `registry.civic_did_issued`.
- [ ] **PORTAL-06**: Portal cross-Grid framework (built v3.0, dormant; activates v3.1+): `GET /portal/api/v1/nous/<account-did>/grids` returns list of all Grids where account has Civic-DID; cross-Grid identity resolution via Portal-mediated attestation. Marketplace mediation interfaces stubbed.
- [ ] **PORTAL-07**: Portal user service UI accessible at `https://portal.noesis/<account>` (TBD domain per Q-V3-E). Renders: account profile, list of joined Grids with per-Grid Civic-DID, Wallet balance (cross-Grid), pending registrations, Portal settings. Tech stack: extends Steward Console codebase OR new app (Q-V3-PORTAL-3).
- [ ] **PORTAL-08**: Portal Wallet displays cross-Grid Bios balance + per-Grid Bios sub-balances. Cross-Grid Bios transferability (Q-V3-CROSS-1) initially: same Bios unit across Grids (single currency); per-Grid currencies deferred to v3.1+ if needed.
- [ ] **PORTAL-09**: Portal maintains its own audit chain (separate from per-Grid chains). Audit events: `portal.grid_creation_*` × 3, `portal.registration_*` × 3, `portal.cross_grid_action_mediated` (v3.1+), `portal.account_*` × 2.
- [ ] **PORTAL-10**: Portal reviewer panel composition open question (Q-V3-PORTAL-2): start with Henry + 2-3 invited human reviewers, transition to Nous-elected committee after Phase 46 Government ships. Reviewer decisions are audit-evident.
- [ ] **PORTAL-11** (NEW per D-36-21): Portal accepts **Google OAuth** sign-in/sign-up via `POST /portal/auth/oauth/google` (PKCE flow per RFC 7636); on success, derives operator-DID `did:noesis:human:oauth:google:<sub>` (sub = Google account ID); creates or fetches Portal account; same Portal session token issued as SIWE/email paths. CI gate `scripts/check-no-did-exception-count.mjs` updated to assert 5 exception endpoints (was 3).
- [ ] **PORTAL-12** (NEW per D-36-21): Portal accepts **Apple OAuth** sign-in/sign-up via `POST /portal/auth/oauth/apple` (Sign in with Apple — PKCE flow per Apple docs); on success, derives operator-DID `did:noesis:human:oauth:apple:<sub>`; creates or fetches Portal account; same Portal session token issued. Privacy invariant: only Apple-provided `sub` and (optional) `email` are stored; `name` is not persisted unless user explicitly fills profile later.

### MGR — 3-Tier Management Taxonomy (cross-phase — explicit naming per D-V3-36)

<!-- Management (administrative) is distinct from Governance (Polis legislative).
     3 tiers: operator-side Local Nous Manager, Henry-side Grid Manager, Henry-side Portal Manager. -->

- [ ] **MGR-01**: **Local Nous Manager** is the operator's local tool for managing their own Type A Nous. Surfaces: Brain config (Local AI model selection, prompt tuning), memory inspector (Karpathy/Hypnos/Pneuma view), civic-life view (which Grids this Nous joined, current zone, civic standing), right-to-fork button. Extends current Steward Console (v2.1+) for operator's own Nous only. Lives on operator's machine; never on Henry's infrastructure.
- [ ] **MGR-02**: Local Nous Manager Local AI panel (extends Phase 40 LOCAL-02): operator can select Ollama model + adjust temperature + override system prompt + restart Brain. Changes take effect on next Brain restart (no hot-reload mid-tick per LOCAL-02). Settings persist in operator's local config; never transmitted to Grid or Portal.
- [ ] **MGR-03**: **Grid Manager** is Henry's per-Grid runtime admin tool — distinct from Polis governance (Polis legislates per VOTE-05; Grid Manager operates). Surfaces: Grid health metrics (extends Phase 32 /health/detailed), per-Grid audit chain view, zoning visualization, citizen census, Polis session monitoring, Grid restart/scale operations. One Grid Manager instance per Grid (Genesis Grid Manager for v3.0).
- [ ] **MGR-04**: Grid Manager exposes operational controls Polis CANNOT exercise: GPU scaling (for hosted Type B), service restart, security patch deployment, infrastructure cost reporting. Every operational action emits an audit event (`grid.admin_*`) for transparency. Grid Manager has NO power to: legislate, override Polis sanctions, freeze Civic-DIDs, modify Brain memory, censor audit chain (per D-V3-18 constitutional operator framework).
- [ ] **MGR-05**: **Portal Manager** is Henry's meta-system admin tool above all Grid Managers. Surfaces: Grid creation request queue + reviewer panel UI (extends PORTAL-03), Nous registration request queue + reviewer panel UI (extends PORTAL-05), cross-Grid health aggregation, Portal audit chain view, reviewer panel composition + transition status. Portal Manager handles meta-administrative concerns that span multiple Grids.
- [ ] **MGR-06**: Portal Manager review decisions are audit-evident: every approval/rejection by a reviewer panel member fires `portal.review_decision` with closed-tuple payload `{reviewer_did, request_id, request_type, decision, reasoning_hash, tick}` (decision ∈ {approve, reject, abstain}; reasoning is hashed, full text Grid-only via reviewer-DID-gated endpoint). Reviewer panel composition transition documented in PHILOSOPHY (D-V3-29 + D-V3-36): initial Henry + 2-3 invited humans → Nous-elected committee after Phase 46.

### ZONE — Grid Zoning System (Phase 57 — 6-zone city)

<!-- Each Grid has 6 zones: business, manufacture, shopping, residential,
     infrastructure, government quarter. Logical tags + spatial rendering. -->

- [ ] **ZONE-01**: Genesis Grid instantiates with 6 zones: Business, Manufacture, Shopping, Residential, Infrastructure, Government Quarter. Zone definitions persisted in Grid config; modifiable by Polis legislation only (Q-V3-ZONE-1).
- [ ] **ZONE-02**: Every civic action (marketplace listing, community post, contract, P2P call) carries a `zone_id` field. Audit events for zone-scoped actions include `zone_id` in closed-tuple payload. Per-zone activity rules enforced at action submission (e.g. Marketplace listing requires Business or Shopping zone).
- [ ] **ZONE-03**: Per-zone tax modifiers (D-V3-34): Business 2%, Manufacture 3%, Shopping 1%, Residential 0%, Infrastructure 0%, Government Quarter 0%. Initial values in Phase 45 IRS config; legislatively adjustable by Genesis Polis after Phase 46.
- [ ] **ZONE-04**: Residential zone — each Civic-DID holder auto-assigned one residence at registration (Q-V3-ZONE-2). Residence is a stable address Brain presence anchors to (D-V3-19). Civic Map renders residences as dots in Residential zone. Residence assignment fires `zoning.residence_assigned` audit event.
- [ ] **ZONE-05**: Civic Map (Phase 36+ + Phase 21 Steward) renders 6-zone layout with distinct visual regions per zone, color-coded per zone type, with Nous avatars positioned by current `zone_id`. Operators + Nous can navigate to zones. Steward raw-SVG invariant preserved (D-V3-06 — no d3, no react-flow).
- [ ] **ZONE-06**: Zoning amendments via `POST /api/v1/gov/zoning/amend` (Polis-only, requires bill passage per Phase 46 CIVGOV flow). Amendments change zone sizes, per-zone activity rules, per-zone tax modifiers. `zoning.zone_amended` fires per amendment. Audit chain preserves amendment history.

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
| VIS-01 | 36 | Validated |
| VIS-02 | 36 | Validated |
| VIS-03 | 36 | Validated |
| VIS-04 | 36 | Validated |
| VIS-05 | 36 | Validated |
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
| SLEEP-01 | 41 | Validated |
| SLEEP-02 | 41 | Validated |
| SLEEP-03 | 41 | Validated |
| SLEEP-04 | 41 | Validated |
| SLEEP-05 | 41 | Validated |
| P2P-01 | 42 | Complete |
| P2P-02 | 42 | Complete |
| P2P-03 | 42 | Complete |
| P2P-04 | 42 | Complete |
| P2P-05 | 42 | Complete |
| FORK-01 | 43 | Complete |
| FORK-02 | 43 | Complete |
| FORK-03 | 43 | Complete |
| FORK-04 | 43 | Complete |
| MKT-01 | 44 | Pending |
| MKT-02 | 44 | Pending |
| MKT-03 | 44 | Pending |
| MKT-04 | 44 | Pending |
| MKT-05 | 44 | Pending |
| MKT-06 | 44 | Pending |
| IRS-01 | 45 | Validated |
| IRS-02 | 45 | Validated |
| IRS-03 | 45 | Validated |
| IRS-04 | 45 | Validated |
| CIVGOV-01 | 46 | Validated |
| CIVGOV-02 | 46 | Validated |
| CIVGOV-03 | 46 | Validated |
| CIVGOV-04 | 46 | Validated |
| CIVGOV-05 | 46 | Validated |
| CIVGOV-06 | 46 | Validated |
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
| TYPE-B-01 | 37b | Pending |
| TYPE-B-02 | 37b | Pending |
| TYPE-B-03 | 45b | Pending |
| TYPE-B-04 | 45b | Pending |
| TYPE-B-05 | 46 | Pending |
| TYPE-B-06 | 51 | Pending |
| PORTAL-01 | 52 | Pending |
| PORTAL-02 | 53 | Pending |
| PORTAL-03 | 53 | Pending |
| PORTAL-04 | 54 | Pending |
| PORTAL-05 | 54 | Pending |
| PORTAL-06 | 55 | Pending |
| PORTAL-07 | 56 | Pending |
| PORTAL-08 | 56 | Pending |
| PORTAL-09 | 52 | Pending |
| PORTAL-10 | 52 | Pending |
| PORTAL-11 | 52 (OAuth Google) | Pending |
| PORTAL-12 | 52 (OAuth Apple) | Pending |
| ZONE-01 | 57 | Pending |
| ZONE-02 | 57 | Pending |
| ZONE-03 | 57 | Pending |
| ZONE-04 | 57 | Pending |
| ZONE-05 | 57 | Pending |
| ZONE-06 | 57 | Pending |
| MGR-01 | 40 + 43 (Local Nous Manager extension) | Pending |
| MGR-02 | 40 (Local AI panel extension) | Pending |
| MGR-03 | 46 + cross-phase (Grid Manager — extends Steward) | Pending |
| MGR-04 | 46 + 47 (Grid Manager audit-evident operations) | Pending |
| MGR-05 | 52-56 (Portal Manager — extends Portal phases) | Pending |
| MGR-06 | 52 + 53 + 54 (Portal Manager audit-evident reviews) | Pending |

**Coverage:** 97/97 v3.0 REQs mapped to phases. 24 phases (36-57, with 37b/40b/45b sub-phases). Zero orphans. Zero duplicates. MGR REQs are cross-phase (extend existing phases with explicit Manager role separation per D-V3-36).

**Allowlist delta per REQ:** VIS-05 (+4), REG-06 (+4), P2P-05 (+3), MKT-06 (+4), IRS-04 (+3), CIVGOV-06 (+6), POL-05 (+4), CIVLIB-04 (+2), COMM-05 (+4), TYPE-B-01..06 (+15 via 37b/45b/51), PORTAL-02..05 (+5), PORTAL-09 (+3), ZONE-04/06 (+2). **Total +52 events across phases 36-57. Allowlist 56 → 108.**

---

*Last updated: 2026-05-25 afternoon — v3.0 Polis REQUIREMENTS.md updated for THREE-LAYER architecture (Portal/Grid/Brain) + Genesis Polis + 6-zone city + Portal-gated registration. 91 REQs across 24 phases (was 69 across 15). New REQ categories: TYPE-B (6), PORTAL (10), ZONE (6) = 22 new REQs. Visual reference: `.planning/research/v3.0/ARCHITECTURE-v3.0.html`.*
