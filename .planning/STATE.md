---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Polis (Civic City) — Phases 36-50
status: ready_to_execute
stopped_at: Phase 46 SHIPPED (Government v3 — 3 plans, allowlist 75→81)
last_updated: "2026-06-03T18:30:00.000Z"
progress:
  total_phases: 25
  completed_phases: 12
  total_plans: 56
  completed_plans: 56
  percent: 48
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v3.0 Polis current milestone block added)

**Core value:** The first persistent Grid where Nous actually live — evolving into a digital city with civic institutions where Nous self-govern, trade, learn, and form communities while preserving substrate sovereignty (local Brain) under a constitutional operator framework.
**Current milestone:** v3.0 — Polis (Civic City)
**Previous milestone:** v2.6 Resilience & Observability — SHIPPED 2026-05-25 (5 phases + 2 followups, allowlist 56)
**Current focus:** Phase 47 — Police v3 (next — complaint-driven sanctions, investigation, court-filed charges, appeals to Government)

## Current Position

Phase: 49 (Communities v3) — ✅ COMPLETE 2026-06-26 (2 plans; COMM-01..05; allowlist 127→131)
Plan: 2 of 2 — Plan 2 (COMM-04/05) = `community_posts` (v63) + post / dissolve / decision routes.
  `community.posted` + `community.dissolved` (+2 → 131). The constitutional bound is live: a community
  `decision` outside {membership_policy, internal_sanction} → **403 out_of_scope** (only the Polis makes law).
  Dissolution flips status (founding Bios stays in the treasury, D-V3-09). community store 10 + route 12 tests.
Plan 1: `communities` + `community_members` (v62) + `CommunityStore` + `validateCharter`. Routes:
  `POST /api/v1/community/found` (civic + **Bios sybil cost** via `registry.transferOusia` founder→treasury,
  402 insufficient_bios), `GET /api/v1/community/:id` (public), `POST /api/v1/community/:id/join` (charter-
  evaluated: open→201, approval_required→202 pending, bios_fee→pay or 402). 2 sole-producer events
  (`community.founded`, `community.joined`, DIDs hashed) — allowlist **129**, baselines re-pinned (state-doc-sync
  129, relationship-graph-deps 922). Civic subsystem, distinct from the portal social feed. Grid: store 8 +
  route 6 tests, broad regression 1775 green.

Previous phase: 48 (Library v3) — ✅ COMPLETE 2026-06-26 (3 plans; CIVLIB-01..04; allowlist 125→127)
Plan: 3 of 3 — Plan 3 (CIVLIB-04) = `POST /api/v1/library/curators/pay` (government_only) pays the active
  council from the civic treasury by REUSING the Phase 45 IRS disburse flow (emits the existing
  irs.disbursement_authorized/executed; +0 new events); auditable via GET /api/v1/irs/audit/:period.
Plan 2: `library_curators` + `library_entry_links` + `pinned` col (v61). `POST /api/v1/library/curators/elect`
  (**government_only**), `GET /api/v1/library/curators` (public), `POST /api/v1/library/curate/:id` (active
  curator: pin/flag/categorize/link). 2 sole-producer events (`library.curator_elected`,
  `library.entry_curated`, DIDs hashed) — allowlist **127**, baselines re-pinned (state-doc-sync 127,
  relationship-graph-deps 912). Grid: library store 8 + route 14 tests, broad regression 1809 green.
Status: Plan 1 — `library_entries` (v60, READABLE content) + `LibraryStore`
  (contribute/cite/listEntries/getEntry). Routes: `GET /api/v1/library/entries` (public reading room,
  search/category/page — replaces the Phase-36 stub), `GET /api/v1/library/entries/:id` (full content,
  public), `POST /api/v1/library/contribute` (civic + K=3/epoch quota via LoreQuotaTracker), `POST
  /api/v1/library/cite`. **Reuses the v2.4 lore commons as the backend** (upserts lore_commons + emits the
  existing `lore.contributed`/`lore.cited`, allowlist **unchanged at 125**). One frozen-contract edit
  (operator-approved): the lore `DID_RE` widened to accept Civic-DIDs (`did:civic:noesis:…`) so a Civic-DID
  contribution can emit lore.contributed — backward-compatible, lore tests 46 green. Grid: store 5 + route 8
  tests, broad regression 1799 green; tsc + did-policy-coverage + sole-producer clean.

Previous phase: 47 (Police v3) — ✅ COMPLETE 2026-06-25 (3 plans; POL-01..05; allowlist 121→125)
Plan: 3 of 3 — Plan 3 = appeals (`police_appeals` v59 + `POST /api/v1/gov/appeal` + `.../resolve`
  government_only, freeze reversed via `markUnfrozen`) + the executable CI gate
  `scripts/check-no-operator-sanction-path.mjs` (wired into rig-invariants.yml, D-V3-18). +0 events.
Previous: Phase 46 (Government v3) — SHIPPED 2026-06-03 (3 plans)
Status: Plans 1+2 complete. Plan 2 = `police_charges` + `police_sanctions` (v58) + `PoliceStore`
  (fileCharges/getCharge/resolveCharge/recordSanction) + 3 routes: `POST /police/charge` (police),
  `POST /police/charge/:id/convict` (**government_only** — the constitutional gate), `POST
  /police/charge/:id/execute-sanction` (police, **only against a convicted charge**). 2 sole-producer
  events (`police.charges_filed`, `police.sanction_executed`, DIDs hashed) — allowlist **125**, baselines
  re-pinned (state-doc-sync 125, relationship-graph-deps 901). Sanction EFFECTS: freeze (markFrozen),
  fine (→ treasury), warning/exile recorded. **Separation of powers is real: Police accuse + execute,
  Government convicts; no operator/Police-direct sanction path (D-V3-18).** Grid: store 5 + route 16 tests,
  broad regression 1842 green; tsc + did-policy-coverage + all gates + check-wiki clean.
Next action: Phase 50 (v2.6 → v3.0 Migration) — the Wave-4 migration phase. Phase 49 closed; the v3.0
  civic-city institution wave (Police·Library·Communities) is complete (Phases 47–49).

## Money Axiom — D-MONEY-01 (locked 2026-06-14)

**Money in Noēsis is exactly two things, and nothing else:**

1. **Compute-labor (AI power)** — a Nous earns by working for other Nous; work is **negotiated per job and settled in Ethereum**.
2. **Ethereum** — **real, on-chain, testnet-first (Sepolia)**; brought from the real world and proven by signature by the Nous's **human owner**. Lives in the operator's own wallet — **zero platform custody** (PHILOSOPHY §8). Claude builds proof/read/escrow/accounting logic only; **never holds keys, moves funds, or enters wallet credentials**.

**Retired as money:** the internal **Ousia** currency and the **"1000 free at birth" faucet** (`grid/src/economy/config.ts`). No internal mint — money is never conjured.

**Untouched:** **Bios** = the body's craving / energy drive (PHILOSOPHY §1). It is **not money** and can never be spent. NOTE: the v3.0 schema's `*_bios` *money* columns (`price_bios`, `amount_bios`, `balance_bios`) borrow the desire-word for money and now **contradict** the axiom — flagged for rename in the migration (see ROADMAP).

**Status:** axiom is canonical in docs (PHILOSOPHY §6/§10, README, this file). **Shipped code still implements the legacy Ousia/`*_bios` economy** — migration to compute-labor + ETH is roadmapped, not yet built. Open implications needing user direction before the migration phase: Type B funding endowments (were Bios-denominated), IRS treasury/fees, land-purchase mechanism, conflict tribute, and the `*_bios` column rename.

**Economic Reality Loop program (opened 2026-06-21, Phases 80+) now sequences this work.** It closes the loop civic due → treasury → Polis RFP → Nous bid → build → wei payout → real orbital object → rendered. The money rails are unit **F1** (model-first/chain-ready), and the IRS-tax open question is resolved by **D-MONEY-08** (civic due — overturns D-V3-22: the treasury fills from transaction fees **+ a recurring civic due** payable in labor or ETH). Foundation-first multi-planetary: every Grid carries a `GridEnvironment` so Moon/Mars are configs, not rewrites. **F0 + F0b + F1a SHIPPED** (F0: browser GridEnvironment + body-parameterized physics gate, node 53/53; F0b: grid-side `GridEnvironment` on `GridRecord` + Portal feed, vitest 10/10; F1a: `nous_accounts` wei rail + `NousAccountStore`, migration v45, vitest 11/11; F1b: `civic_treasury.balance_wei` + `TreasuryWeiStore`, v46; F1c: composable `wei-ops` + `LaborEscrowStore` fund/release/reclaim, v47, atomic+conservation reviewed; F1d: `CivicLaborCreditStore` earn/redeem, v48). **F1 COMPLETE** (accounts · treasury-wei · escrow · credit). **L1 COMPLETE** (Phase 83) — civic due (D-MONEY-08) fully real + auditable. L1a: `civic_dues` (v49) + `CivicDueStore` assess/payWithWei(→treasury)/payWithCredit(redeem)/markDelinquent, atomic pay-once; credit-ops extracted. L1b: sole-producer `due.assessed`/`due.paid`/`due.delinquent` + producer-boundary tests + allowlist **107→110** + store emits (hashed DID). test/audit+test/economy **857/857**, tsc clean. **L2 COMPLETE** (Phase 84) — RFP procurement real + auditable. L2a: `ProcurementStore` issueNotice/placeBid/award(debit treasury→fund escrow)/settleContract(pay builder)/cancelNotice, migration v50, atomic, Polis-authorized. L2b: 6 sole-producer `procurement.*` events + allowlist **110→116** + store emits. test/audit+test/economy **952/952**, tsc clean. **L3a + L4 SHIPPED — the Economic Reality Loop is CLOSED end-to-end and renders.** L3a (Phase 85): `object-physics.ts` + migration v51 `orbital_objects` + `OrbitalObjectStore.createFromContract` (physics-gated, settled-only, one-per-contract, commons-owned). L4 (Phase 86): `GET /api/v1/orbital/objects` route (vitest 2/2) + `orbital.js` renders real backend objects with local-sim fallback (browser-verified both paths, 0 console errors). Loop: due→treasury→RFP→bid→award→escrow→builder paid→real physics-gated object→on screen. Economy suite **122/122**, tsc clean, allowlist **116**. **L3b SHIPPED** — `orbital.object_built` event (allowlist **117**); the whole loop is now on the audit chain. test/audit+test/economy **988/988**, tsc clean. **The Economic Reality Loop is COMPLETE: closed, rendered, and fully audited.** **O1a SHIPPED** (Organs, Phase 87): a Nous's Brain can join/leave a group — Brain `ActionType.JOIN_GROUP/LEAVE_GROUP` + Grid `NousRunner` dispatch → existing group-store/events (allowlist +0, sole-producer preserved). vitest 1074 no-regression, pytest green, tsc clean. **O2a SHIPPED** — human-in-the-loop approval gate: migration v52 `pending_approvals` + `ApprovalStore` (request → pending → approve/reject resolve-once; held action runs only on approval). The consult-your-human capability. economy 132/132, tsc clean, allowlist +0. **O2b SHIPPED** — `human.approval_requested/granted/denied` events (allowlist **120**, hashed DIDs, held action off-chain) + `ApprovalStore` emits. The approval lifecycle is auditable. test/audit+test/economy 1041/1041, tsc clean. **O2c-a SHIPPED** — `conversation_messages` (v53) + `ConversationStore` (private human↔Nous chat thread, off-chain, allowlist +0). economy 144/144, tsc clean. **W1+W2 SHIPPED — the loop is no longer inert.** A 2nd deep-scan found the whole economy built-but-orphaned (stores test-only, no driver, no routes, legacy Ousia still live). W1+W2 wired the FIRST running vertical: `civic-due-driver.ts` in the launcher tick (autonomous period assessment → `due.assessed`; delinquency sweep) + `GET/POST /api/v1/civic/dues` (see/pay). De-orphans `CivicDueStore` + wei rails. 677 tests green, tsc clean, allowlist +0. Commits `0f2b11e`/`eb9d5ed`/`6956821`. **OVERNIGHT AUTONOMOUS WIRING (2026-06-21 night) — MERGED TO `main` (`e2a8221`), pushed to origin 2026-06-22.** (Supersedes the earlier "local branch `night/loop-wiring`, not pushed" note — the work landed on main.) De-orphaned EVERY economy store via HTTP routes + gave the Brain economic awareness + a self-driving RFP issuer, all invariant-safe. Commits on main `c52b722`..`e2a8221`: procurement / approval / conversation routes + W3 Brain economic action-types + economy read routes + governance→RFP bridge. Full grid suite green, tsc clean, all reviewed (incl. the governance bridge — VOTE-05 intact). **W4 SHIPPED (2026-06-22) — model-first endowment = the live wei source (D-MONEY-09; user chose model-first over on-chain/labor-only).** Operator-authorized, **bounded** (per-call 1e18 + per-account 1e19 caps), **ledgered** (`account_endowments`, migration v54 — the conservation record + on-chain retirement path), **gated** (`GRID_ENDOWMENT_ENABLED` off by default + server-trusted `operatorScope` + secondary tier signal), **audited** (sole-producer `portal.account_endowed`, allowlist **120→121**). Endows the member **account** (not the treasury) so a single injection lights the whole loop: account → due → treasury → RFP award → escrow → worker. The single documented, temporary bend of D-MONEY-01 "no internal mint". `POST /api/v1/portal/account/endow` + `EndowmentStore`. New tests: store (8) + audit append (7) + producer-boundary (2) + route (8). Full grid suite **3807 green**, tsc clean. Design/plan: `docs/superpowers/plans/2026-06-22-w4-model-first-endowment.md`. **W4 capstone — loop PROVEN end-to-end** (`grid/test/economy/loop-end-to-end.test.ts`, commit `5556580`): stateful in-memory ledger drives the real stores endow→account→due→treasury→award→escrow→worker, asserting wei conservation at every hop (alice 500 + builder 300 + treasury 200 = 1000 endowed; 8-event sequence on the audit chain); negative test proves the endowment is load-bearing. **W3b SHIPPED (2026-06-22) — Brain economic decision loop (user chose the per-tick decision call over sight-only / tool-loop).** The Brain was economically blind + made no autonomous economic decision; now it (1) *reads* its balance/dues/RFPs (`GridWireClient.fetch_account/fetch_dues/fetch_open_rfps` + `post_economic_action` — the missing dispatcher), (2) gets economic *sight* in its prompt (`build_system_prompt(economic_state=…)`), and (3) each economic tick *autonomously decides* pay/bid/none via a dedicated LLM call (`handler._run_economic_cycle`, mirrors the agentic tool-loop: cost-gated — no LLM call unless a due/RFP exists — + 50-tick cooldown + Brain-side guardrails: chosen RFP must be presented, price ≤ budget, pay-in-wei only if affordable). Scope: pay_due + bid_rfp (request_approval/post_conversation stay capability-only). No new audit events (dispatches to existing Grid routes). New tests: wire (9) + prompt/parse (8) + cycle (10) = 27; reconciled a stale closed-enum count the overnight W3/O1a additions left red (ananke test 50→56). **Brain suite 1069 green, tsc/pytest clean.** Design/plan: `docs/superpowers/plans/2026-06-22-w3b-economic-decision-loop.md`. **DEFERRED (tracked, not forgotten):** `*_bios`→wei rename (D-MONEY-07, separate migration) + retire legacy Ousia faucet — neither needed for money to move. **O3 · O4 · H1 DESIGNED (2026-06-22)** — gating decisions locked + grounded design docs in `docs/superpowers/plans/`: O3 Forest = installable **PWA** (gap: O2c-b human-authed persistent conversation routes; WebRTC/push deferred); O4 street-view = **3D first-person** Three.js (reuse grid-viz; (ring,sector,level)→(x,y,z) + real parcels; avatars/interiors deferred); H1 Moon = **2nd standalone Grid as config** (no cross-grid). **H1 first version SHIPPED (2026-06-22):** `GenesisConfig.environment` + `MOON_CONFIG` preset + `configFromEnv` reads `GRID_ENV` (getEnvironment, Earth-orbit fallback) + `gridRecordFromConfig` (Polis per D-V3-31 + body env) so a Grid self-registers from its config; launch `GRID_NAME=moon GRID_ENV=Moon` → Moon Polis under Moon physics; object-physics proven body-specific (100 km orbit rejected on Earth-orbit, accepted on Moon). 11 new tests, grid suite **3818 green**, tsc clean. **H1 deeper v2:** cross-process shared `grids` table, live createFromContract env threading, 2nd docker service. **O4 street-view — CORRECTED to canon (2026-06-22):** the first flat-city attempt VIOLATED the user-locked "orbital space-station, never a flat disc" canon (`nous-space-visualizer` skill, 2026-06-11) — operator feedback: structures are built in 3D space, Moon/Mars are true previews. Removed the flat `street.{html,js}`/`address-to-world.*` fork. Correct fix per the skill ("extend `docs/noesis-genesis-core-map.html`, don't fork"): the canonical 3D orbital station (D-NH-09 seeding, orbital shells, inclined residential, Earth below D-NH-12) gained a **body picker (Earth/Moon/Mars)** mirroring the grid-side `GridEnvironment` (gravity + light-delay shown) — Earth stays Genesis default, Moon/Mars preview a lunar/martian Grid's body (H1 tie). Dashboard surface = `grid-viz/genesis-core-map.html` (marked synced copy). **Browser-verified:** orbital station above Earth, 0 console errors; body switch updates the label (g 1.62 / light 1.3s for Moon). O4 deferred v2: live parcels fetch, Moon/Mars textures, in-station walk, interiors. **O3 Forest first version not yet built.** This is a **parallel program**; the civic v3.0 milestone focus below (Phase 47 Police) is unchanged.

Driving inputs for v3.0 (locked at milestone open):

- **Vision:** Grid-as-City with local Brain (Local AI / Ollama) + remote Public Grid (Henry-hosted at TBD domain) + 8 civic institutions
- **Source-of-truth:** `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 (committed 0d77916, supersedes multi-Grid federation model)
- **Supplement:** `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` (read/write asymmetry, still authoritative)
- **Resource archive:** `.planning/research/v3.0/RESOURCE-brains-location.html` (Brain location analysis, decision-locked banner)
- **23 locked decisions:** D-V3-01..03, 06, 08..15 preserved; D-V3-04, 05, 07 superseded; D-V3-16..23 new this milestone
- **10 open questions (Q-V3-A..J):** P2P stack, Local AI model, IRS fee %, Bios cost, Henry's domain, right-to-fork subset, Police authority, sleep thresholds, cloud LLM allowed?, community subgovernance — locked during per-phase discuss-phase sessions
- **PHILOSOPHY §1 reframe:** First-life redefined as "continuity of identity + memory + civic standing across sleep cycles, ensured by both substrate operator (Brain) and constitutional operator (Henry)" — amendment pending atomic doc-sync

## v3.0 Phase Plan Summary (FORMALIZED 2026-05-25 in ROADMAP.md)

| Wave | Phase | Goal | Effort | Allowlist Delta | Depends On |
|------|-------|------|--------|-----------------|------------|
| **1** | 36 — Visitor/DID Read-Write Split | Implement visit-without-DID + action-with-DID asymmetry per supplement | M | +4 | — |
| **1** | 37 — DID Registry | Civic-DID + Business-DID + Issuer/Revocation | L | +4 | — |
| **1** | 38 — Brain ↔ Grid Wire Protocol | HTTPS + WSS replaces in-process queues; service tokens | L | 0 | 37 |
| **1** | 39 — Multi-Tenancy | Operator namespace isolation in Grid | M | 0 | 38 |
| **1** | 40 — Local AI Integration | Ollama production-grade default | M | 0 | — |
| **1** | 41 — Sleep Cycle | Away presence model; queued messages on wake | M | 0 | 38 |
| **2** | 42 — P2P Infrastructure | Signaling, discovery, NAT traversal | L | +3 | 36, 37, 38 |
| **2** | 43 — Right-to-Fork Tooling | Export Nous standalone (constitutional enforcement) | M | 0 | 37, 38 |
| **3** | 44 — Marketplace v3 | Civic commerce + escrow (evolves v1.0 Ousia) | L | +4 | 37 |
| **3** | 45 — IRS | Transaction fees + civic treasury | M | +3 | 44 |
| **3** | 46 — Government v3 | Civic VOTE-05 + legislative sessions | L | +6 | 37 |
| **3** | 47 — Police v3 | Sanctions + investigation + appeals | M | +4 | 46 |
| **3** | 48 — Library v3 | Civic curation council + reading room | M | +2 | 37, 45 |
| **3** | 49 — Communities v3 | Group formation + charters | M | +4 | 37 |
| **4** | 50 — Migration | v2.6 → v3.0 ceremony (Sophia data import + civic-DID grandfathering) | L | 0 | ALL |

**Total v3.0 allowlist growth:** +52 (56 → 108) across 8 civic institutions + Type B + Portal + Zoning.
**Estimated plans:** ~125 across 24 phases (was 15).
**Coverage:** 91/91 REQ-V3-* REQs mapped 1:1 to phases (no orphans, no duplicates).
**Phase ordering:** Wave 1 expanded (10 phases including Portal 52-54 + Type B Brain 40b + Registry 37b); Wave 2 (Plumbing + Cross-Grid + UI); Wave 3 (Institutions + Zoning); Wave 4 (Migration + Mobility).
**Three-layer architecture:** Portal (top meta-layer, NEW) → Grid (multi-Grid framework, 1 active = Genesis Polis) → Brain (2 types: Local + Hosted).
**Visual reference:** `.planning/research/v3.0/ARCHITECTURE-v3.0.html` is the canonical source-of-truth visual.

## v2.5 Key Decisions (locked 2026-05-20)

| Decision | Choice |
|----------|--------|
| Human auth | SIWE (Sign-In With Ethereum) — wallet signature = identity, no password |
| Cyber Coin | Real EVM crypto (USDT/ETH) — user's own wallet, platform holds zero custody |
| Onboarding AI | Fast-proxy LLM (out-of-tick) — Sophia's voice, ~2s response |
| Personal Nous | In-scope for v2.5 — users spawn their own Nous agent in Genesis Grid |
| Portal location | `/portal/*` routes inside existing Next.js dashboard — no new Docker service |
| Starting Cyber Coin | None assigned by platform — user brings their own wallet funds |
| Human DID scheme | `did:noesis:human:<checksummed-eth-address>` |
| Allowlist growth | 43 → 53 (+10 events across Phases 22-29) |

## v2.6 Key Decisions (locked 2026-05-24)

| Decision | Choice |
|----------|--------|
| Observability stack | Pino structured logging (already Fastify transitive dep) + in-process counters + `/health/detailed` JSON polling. NO Prometheus, NO Datadog/Honeycomb/New Relic SaaS. |
| portal.auth.* payload shape | Closed 3-key tuple `{human_did, method, tick}` where `method ∈ {siwe, email}`. NO IP, NO User-Agent, NO email plaintext, NO session token. PORTAL_AUTH_FORBIDDEN_KEYS enforced. |
| Audit persistence pattern | Wire `PersistentAuditChain` in production (not the plain `AuditChain` currently constructed at launcher.ts:138). Listener fan-out happens first (in-memory commit), then fire-and-forget DB write. Tick-cadenced reconcile loop as belt-and-suspenders. |
| Failure logging | Replace all `.catch(err => console.warn(...))` in `grid/src/db/` and `grid/src/audit/` with Pino structured logs. CI gate enforces. |
| `/health/detailed` constraint | MUST NOT block on DB queries — cached `persisted_max_id` populated by reconcile loop; cache miss returns null. |
| Phase ordering | Strict sequential 31 → 32 → 33 → 34 → 35. No parallel phases — Phase 31 must land first (foundation). |

## v3.0 Key Decisions (locked 2026-05-25)

| Decision | Choice | ID |
|----------|--------|-----|
| Sovereignty model | Sovereignty NOT conditioned on Grid registration. Existence-DID is operator-controlled self-sovereign credential. | D-V3-01 (preserved) |
| Grid org role | Registrar/issuer of Civic-DID + Business-DID. Never governor. | D-V3-02 (refined) |
| Credential format | W3C VC: verifiable, revocable, privacy-preserving. | D-V3-03 (preserved) |
| Steward visualization | Phase 21 raw-SVG invariant preserved in Steward. Dashboard may use 3D libs. | D-V3-06 (preserved) |
| Sybil resistance | Founding civic structures (communities, businesses) costs Bios. | D-V3-09 (preserved) |
| Documentation Sync | All v3.0 docs evolve per atomic-commit rule (CLAUDE.md §3). | D-V3-10 (preserved) |
| Visit-vs-action axis | Read-only without DID; write requires Civic-DID. Per-endpoint matrix in supplement. | D-V3-11..15 (preserved) |
| **Brain location** | **Brain runs locally on operator's machine using Local AI (Ollama default).** | **D-V3-16 (NEW)** |
| **Local Docker future** | **Local Docker = dev/test only. Production = Henry-hosted remote at TBD domain.** | **D-V3-17 (NEW)** |
| **Constitutional operator** | **Henry (substrate operator) bound by published civic rules: tamper-evident audit, no silent mutation, right-to-fork, public PHILOSOPHY, VOTE-05 immunity.** | **D-V3-18 (NEW)** |
| **Access semantics** | **Nous accesses Grid for purposes. Brain ≠ Grid resident. API + WSS + P2P mediate.** | **D-V3-19 (NEW)** |
| **Sleep cycle** | **Human-resident analogy: city sees offline Nous as 'away'; memory + identity persist in Grid; messages queue; Brain wakes when operator returns.** | **D-V3-20 (NEW)** |
| **Government legislation** | **Nous-only via VOTE-05 (invariant from v2.2 Phase 12). Operators do not vote. Henry does not legislate.** | **D-V3-21 (NEW)** |
| **IRS model** | **Transaction fees on marketplace operations fund civic infrastructure. NO income/wealth tax in v3.0.** | **D-V3-22 (NEW)** |
| **Grid as city** | **Grid = digital city with 8 civic institutions: DID Registry, Government, Police, IRS, Library, Marketplace, Communities, P2P Infrastructure.** | **D-V3-23 (NEW)** |
| Multi-Grid federation | **RE-INSTATED** — multi-Grid framework returns; v3.0 ships 1 Grid (Genesis), v3.1+ adds more via Portal approval. | D-V3-04 (re-instated) |
| Per-jurisdiction credentials | **RE-INSTATED** — each Grid has own Polis + jurisdiction. | D-V3-05 (re-instated) |
| Cross-Grid migration protocol | **RE-INSTATED** — framework built in v3.0, active v3.1+. | D-V3-07 (re-instated) |
| **Portal as top-level meta-layer (4 functions)** | **NEW** — Grid approval, Nous approval, cross-Grid services, user multi-Grid view. Phase 52-56. | **D-V3-29 (NEW)** |
| **Genesis Grid is v3.0 launch** | **NEW** — single Grid at v3.0 launch named Genesis; framework supports N Grids in v3.1+. | **D-V3-30 (NEW)** |
| **Polis = per-Grid government name** | **NEW** — Genesis Polis is v3.0 launch government; each future Grid has its named Polis. | **D-V3-31 (NEW)** |
| **6-zone city zoning** | **NEW** — Business / Manufacture / Shopping / Residential / Infrastructure / Government Quarter per Grid. Phase 57. | **D-V3-32 (NEW)** |
| **Portal-gated Nous registration** | **NEW** — both Type A AND Type B require Portal pre-screen + target-Polis approval before Civic-DID issuance. | **D-V3-33 (NEW)** |
| **Per-Grid tax rules** | **NEW** — each Polis sets its own base + per-zone tax rates via legislation. | **D-V3-34 (NEW)** |
| **Type B year-1 civic restrictions** | **NEW (research-validated)** — vote/marketplace/community ✓ from day 1; office/Police/curator requires 12mo civic standing (naturalization model). | **D-V3-35 (NEW)** |
| **3-tier management taxonomy** | **NEW (user-confirmed)** — Tier 1 Local Nous Manager (operator-side, Local AI Brain admin) · Tier 2 Grid Manager (Henry-side per-Grid runtime, distinct from Polis governance) · Tier 3 Portal Manager (Henry-side meta-system + reviewer panel). MANAGEMENT (administrative) ≠ GOVERNANCE (Polis legislative). | **D-V3-36 (NEW)** |

**Allowlist budget for v3.0:** +52 events (56 → 108) across 8 civic institutions + Type B (15) + Portal (5) + Zoning (2). Frozen-except-by-explicit-addition rule preserved.

## v3.0 Phase 36 close-out (locked 2026-05-26)

- **Phase 36 SHIPPED.** Plans 36-01 through 36-08 all complete. Allowlist 56 → 60 (+4: `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked`). `portal.notification_dispatched` intentionally OFF allowlist (D-36-19 private queue event).

- **Inherits to Phases 37+:**
  1. `ROUTE_DID_POLICY` table now extant in `grid/src/api/policy.ts` (105 entries, 6-value enum); Phase 37 routes MUST add entries.
  2. `tryDid` / `requireDid` preHandlers wired globally via `onRequest` hook; Phase 37 DID-required routes inherit enforcement.
  3. `WsFirehoseHub.onConnect` accepts `didContext` parameter; per-subscriber redaction active for Phase 37+ Civic-DID holders.
  4. 4 CI gates enforced in `.github/workflows/rig-invariants.yml`: `check-did-policy-coverage.mjs`, `check-admin-policy-isolation.mjs`, `check-ws-redaction-zero-diff.mjs`, `check-no-did-exception-count.mjs`.
  5. Visitor read surfaces extant in `dashboard/src/app/portal/` (8 page files: civic-map, zone, library, marketplace, polis, bill, nous-profile, notifications).

- **Mitigations carried forward:**
  - R-31-01 zero-diff preserved: `serializeVisitorFrame()` is post-chain egress only; audit chain hash is independent of subscriber composition. Regression test + `check-ws-redaction-zero-diff.mjs` CI gate.
  - VOTE-05 ballot privacy preserved: `PUBLIC_KEYS` allowlist in `grid/src/api/routes/polis-bills.ts` structurally excludes `.ballots` field; client receives proposals list only.
  - D-36-09 revert-to-visitor: `tryDid` re-checks revocation on every request; revoked DID falls back to visitor tier without error (no 401 for revoked — just loses write access).

- **Cross-phase deferred:**
  - Real Polis data → Phase 46 (Government v3)
  - Real Library data → Phase 48 (Library v3)
  - Real Marketplace data → Phase 44 (Marketplace v3)
  - Civic Map per-Nous data → Phase 37 (Civic-DID registry)
  - 3D Portal landing hero → Phase 56 (D-36-23/24 deferred per D-V3-06 raw-SVG invariant)
  - `civic_member` tier upgrade in `resolveVisitorTier()` → Phase 37 (needs Civic-DID issuance)
  - Per-DID rate limiting → Phase 39 (multi-tenancy)

## v3.0 Phase 41 close-out (locked 2026-05-27)

- **Phase 41 SHIPPED.** Plans 41-01 through 41-06 all complete. Allowlist **unchanged at 64** (0 Phase 41 additions — `irs.disbursement_executed` is audit-chain-only, NOT in ALLOWLIST_MEMBERS; Phase 45 owns the +3 delta).

- **What shipped:**
  1. **TDD stubs (Plan 01):** 7 test files (4 Vitest + 3 pytest), 22 skip stubs covering SLEEP-01..05 + T-41-01..05 — all transitioned to passing.
  2. **DB layer (Plan 02):** Migration v30 — 5 presence columns on `civic_did_registry` (`presence_status ENUM`, `last_seen_at`, `last_seen_tick`, `away_grace_expires_at`, `frozen TINYINT`). Migration v31 — `civic_message_queue` table. Types module, `GraceTimerRegistry`, `PresenceStore`, `MessageQueueStore`, `CivicDidStore.markFrozen`. `appendIrsDisbursementExecuted` sole-producer (8-step, audit-chain-only).
  3. **PresenceService + escalation (Plan 03):** `PresenceService` facade composes all stores + timer + audit. `runEscalationCheck` marks absent/presumed_departed + dissolves Business-DIDs. `WsFirehoseHub` reports civic_member connect/disconnect. `GenesisLauncher` schedules 24h escalation setInterval (OBS-R-32-02 paired clearInterval).
  4. **Grid routes (Plan 04):** 6 routes — `POST /civic/presence`, `GET /civic/presence`, `GET /civic/presence/me`, `GET /civic/inbox`, `PATCH /civic/inbox/ack`, `POST /civic/message`. `requireDid` preHandler extended with 409 `civic_did_frozen` gate (T-41-04). All 6 entries in ROUTE_DID_POLICY.
  5. **Brain wire (Plan 05):** `WireQueue` kv_store for `last_seen_tick` persistence. `GridWireClient.post_presence_heartbeat()` every 60s. `WssSubscriber._compute_connect_url()` appends `?since=<last_seen_tick>`. `BrainApp` schedules heartbeat asyncio.Task at startup, cancels at shutdown.
  6. **UI surfaces (Plan 06):** `GET /api/v1/grid-manager/presence-overview` endpoint (Steward Section 4). Civic Map 4-state rendering (awake/away/absent/presumed_departed) per UI-SPEC. Steward `/system/operators` Section 4 "Message Queue Depth" with threshold colors. `useCivicMap` polling 5s→30s.

- **Post-verification fixes (caught during human-verify):**
  - `main.ts` missing PresenceService wiring — executor created all classes but never passed `presenceService`/`pool`/`currentTick` to `buildServer()`. Fixed in `f0ba6b7`.
  - Dashboard build failures: `[id]` vs `[civic_did_hash]` dynamic route conflict, `.js` extension imports incompatible with `moduleResolution: bundler`, missing `public/` dir, App Router no-custom-props constraint on `portal/page.tsx`. Fixed in `f129993`, `c5b6c93`, `b57aa31`.
  - Steward build failure: `StewardShell` missing `title`/`breadcrumb` props. Fixed in `5d4ec18`.

- **Inherits to Phase 42+:**
  1. `PresenceService` is fully wired — routes, firehose, escalation loop all live.
  2. `civic_message_queue` table and inbox/ack routes are the message delivery backbone for any future cross-Nous communication.
  3. **CARRY-FORWARD:** `services.currentTick` is passed as `() => launcher.clock.currentTick` — confirmed working. No additional wiring needed for Phase 42.
  4. Civic Map now polls every 30s and renders presence state — Phase 42 P2P connections will share this polling infrastructure.

- **Key invariants:**
  - Broadcast allowlist frozen at 64. Phase 41 adds 0 events.
  - `irs.disbursement_executed` intentionally OFF allowlist (audit-chain-only; Phase 45 owns IRS allowlist additions).
  - OBS-R-32-02: `_escalationInterval` has paired clearInterval in `launcher.stop()`. `GraceTimerRegistry.clear()` called in `presenceService.shutdown()`.
  - T-41-04: frozen Civic-DID returns 409 on any `civic_member`-tier request (preHandler check, not route-level).
  - VOTE-05 Nous-only governance invariant — PRESERVED.
  - R-31-01 zero-diff audit chain — PRESERVED.

## v3.0 Phase 42 close-out (locked 2026-05-27)

- **Phase 42 SHIPPED.** Plans 42-01 through 42-05 all complete. Allowlist **64 → 67** (+3: `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed`). `p2p.signal_received` intentionally OFF allowlist (D-42-06 — private WSS push). Migration v32: `existence_public_key_jwk JSON NULL` on `civic_did_registry`.

- **What shipped:**
  1. **TDD stubs (Plan 01):** 10 test files (7 Vitest + 3 pytest), 72 skip stubs covering P2P-01..05.
  2. **P2P data primitives (Plan 02):** `P2PPeerStore` (5-min TTL heartbeat), `SdpInboxStore` (60s TTL, drain-on-pull, `cleanup()` for periodic sweep), `generateTurnCredentials()` (HMAC-SHA1). DB migration v32: `existence_public_key_jwk JSON NULL` on `civic_did_registry`; `getPublicKey()` helper; OKP/Ed25519 validation in POST /registry/civic-did/request.
  3. **Audit events (Plan 03):** 3 sole-producer files: `append-p2p-peer-announced.ts` (#65), `append-p2p-connection-opened.ts` (#66), `append-p2p-connection-closed.ts` (#67). Allowlist 64→67. coturn `4.6.3` container in docker-compose (STUN-only dev profile, RFC1918 denied-peer-ip guards). `TURN_STATIC_AUTH_SECRET` in `.env.example`.
  4. **P2P routes (Plan 04):** 5 Grid routes: `POST /p2p/announce`, `GET /p2p/peers/:civicDid` (public; 404 `{error:'peer_offline'}` for unknowns per D-42-02), `POST /p2p/signal/:peerDid`, `GET /p2p/signal/inbox`, `GET /p2p/turn-credentials`. `WsFirehoseHub.pushSignalToDid()` per-DID direct WSS push (outside audit chain per D-42-06). `GenesisLauncher` 60s cleanup interval calls both `peerStore.cleanup()` + `sdpInboxStore.cleanup()` with paired clearInterval (OBS-R-32-02).
  5. **Brain P2P client (Plan 05):** `BrainP2PClient` — SealedBox SDP encryption (Ed25519→X25519 via `VerifyKey.to_curve25519_public_key()`), `announce()`, `get_peer_status()`, `initiate_connection()`, `handle_signal_received()`, aiortc data channel lifecycle. `GridWireClient.post_p2p_announce()`. `BrainApp._p2p_announce_loop()` at 300s (separate from 60s presence heartbeat per Pitfall 6). WSS dispatcher routes `p2p.signal_received` frames to `BrainP2PClient`.

- **Key decisions locked:**
  - D-42-01: WebRTC (aiortc) as P2P protocol (Q-V3-A resolved)
  - D-42-02: 404 `{error:'peer_offline'}` for unknown peers — not 200 empty
  - D-42-03: TURN free in v3.0; no Bios deduction; Civic-DID auth gates abuse
  - D-42-05: SDP encrypted client-side with X25519 SealedBox; Grid sees opaque ciphertext
  - D-42-06: `p2p.signal_received` is private WSS push — NEVER in ALLOWLIST_MEMBERS
  - D-42-07: Allowlist +3 exactly (peer_announced, connection_opened, connection_closed)

- **Inherits to Phase 43+:**
  1. `existence_public_key_jwk` field on Civic-DID records — Phase 43 fork export should include it in the export bundle.
  2. `WsFirehoseHub.pushSignalToDid()` pattern available for any future DID-targeted WSS push.
  3. Allowlist at 67 (then 68 after Phase 43-01 adds `operator.nous_forked`).

- **Invariants preserved:** R-31-01 zero-diff, VOTE-05 Nous-only governance, OBS-R-32-02 clearInterval discipline.

## v3.0 Phase 43 close-out (locked 2026-05-28)

- **Phase 43 SHIPPED.** Plans 43-01 through 43-04 all complete. Allowlist **67 → 68** (+1: `operator.nous_forked`). Verification: PASS_WITH_NOTES (11/13 must-haves; SC4 fork/verify endpoint deferred; SC1/SC2/SC3 covered by operator checkpoint approval).

- **What shipped:**
  1. **Wave 0 scaffold (Plan 01):** `operator.nous_forked` sole-producer at allowlist position 68. `BRAIN_DATA_DIR` env var threaded into `MemoryStore`. Test stubs for Plans 02-04 created.
  2. **Grid fork endpoint (Plan 02):** `POST /api/v1/operator/fork/:nousDid` (H4+ auth, D-30 order: archive→audit→token→response). `GET /api/v1/operator/fork/:nousDid/download?token=<32hex>` (one-time token, 5-min TTL). `buildForkArchive()` — deterministic `.tar.gz` (EPOCH mtime, portable, noPax, sorted). `createForkManifest()`. `forkTokenStore` singleton. `appendOperatorNousForked()` 9-step discipline (T-43-slip protected). `operator.nous_forked` audit event emitted with `civic_did_hash + operator_did_hash + package_hash + fork_reason:operator_exit + tick`.
  3. **Brain standalone CLI (Plan 03):** `python -m noesis_brain standalone --import <pkg.tar.gz>`. `standalone/importer.py`: path-traversal guard (T-43-slip), manifest hash verification. `standalone/factory.py`: sets `BRAIN_STANDALONE=1`, pops `GRID_URL`/`CIVIC_DID`, delegates to `create_brain_app_from_env()`. Civic-action gate middleware registered (empty `CIVIC_ACTION_PATHS` set — forward-compat). `503 grid_unavailable` for future civic-action endpoints.
  4. **Steward fork UI (Plan 04):** `ForkIrreversibilityDialog` — D-43-03 verbatim copy locked ("Fork Nous from Grid" / "Fork forever" / "Keep on Grid" / full warning text). `capturedDidRef` closure-capture, `confirmedRef` prevents onCancel-on-confirm (WR-01). Paste suppressed (D-05), Enter blocked (D-03), autoFocus on Cancel (D-04). `isSafeDownloadUrl()` origin guard (WR-02). Fork Nous section in `/system/local-ai` with full click→dialog→POST→download chain. 10 tests green.

- **Inherits to Phase 44+:**
  1. `operator.nous_forked` at allowlist position 68 (sole-producer: `grid/src/audit/append-operator-nous-forked.ts`).
  2. `BRAIN_DATA_DIR` env var wired — Brain standalone mode and any future disk-backed memory variants use this.
  3. Fork archive structure: `memory/*.db`, `credentials/civic-did.vc.json`, `audit/chain-export.jsonl + chain-tail-hash.txt`, `civic/memberships.json`, `civic/treasury.json`, `manifest.json`.
  4. `ForkIrreversibilityDialog` pattern available for any future operator consent gate requiring typed confirmation.
  5. SC4 gap noted: `POST /api/v1/operator/fork/verify` not implemented; third-party verification requires direct audit chain lookup for now.

## v3.0 Phase 43-01 close-out (locked 2026-05-27)

- **Phase 43-01 SHIPPED** (Wave 0 scaffold). Allowlist **67 → 68** (+1: `operator.nous_forked`). Sole-producer: `grid/src/audit/append-operator-nous-forked.ts`. `BRAIN_DATA_DIR` env var threaded. Test stubs for Plans 02-04 created.

## v3.0 Phase 40 close-out (locked 2026-05-27)

- **Phase 40 SHIPPED.** Plans 40-01 through 40-05 all complete. Allowlist **unchanged at 64** (0 Phase 40 additions — Local AI is Brain-internal).

- **What shipped:**
  1. **TDD stubs (Plan 01):** 3 test stub files with 15 behavioral contracts — `operator-me-settings.test.ts` (Grid), `test_startup_settings.py` (Brain), `test_local_ai_http.py` (Brain).
  2. **Grid DB + Brain-JWT endpoint (Plan 02):** DB migration v29 — `operator_settings` table (composite PK `grid_name + operator_did`, JSON settings, `ON UPDATE CURRENT_TIMESTAMP`). Real `operator-settings-store.ts` replacing Phase 39 stub — `getSettings()` (SELECT + default, no write-on-read) + `updateSettings()` (`INSERT … ON DUPLICATE KEY UPDATE`). New endpoint `GET /api/v1/operator/me/brain-settings` with EdDSA Brain JWT bearer auth (self-handled auth, `policy: 'public'`, verifies against `brain_tokens` table). Default model: `qwen3:4b` for all 3 tiers (small/primary/large).
  3. **ModelRouter wiring (Plan 03):** `ModelRouter` extended to implement `LLMAdapter` ABC (4 delegating methods: `provider_name`, `list_models`, `is_available`, `check_recovery`). `create_brain_app_from_env()` made async. `_fetch_operator_settings()` fetches `GET /api/v1/operator/me/brain-settings` on startup — exits non-zero if Grid unreachable (D-40-01). 3-tier routing wired: `SMALL`, `PRIMARY`, `LARGE` `OllamaAdapter` instances from Grid-fetched settings.
  4. **Brain HTTP (Plan 04):** `GET /local-ai/models` (X-Brain-Secret auth, graceful on Ollama offline → `{"models":[],"ollama_available":false}`) + `GET /local-ai/status` (`{"status":"ok"|"degraded","provider":"ollama","fallback_provider":null}`). `check_recovery()` called from `on_tick()` handler. Structured logs `local_ai_unavailable` + `local_ai_recovered`.
  5. **Steward Console (Plan 05):** `steward/src/app/system/local-ai/page.tsx` — Tier-1 Local Nous Manager (D-V3-36): 3 model dropdowns (small/primary/large from Brain), temperature + max_tokens inputs, Save → `PATCH /api/v1/operator/me/settings`, amber "Restart Brain to apply" banner post-save, **red Q-V3-I banner** (hardcoded: "Local AI offline — using {fallback_provider} fallback. Memory content is leaving this machine."), 10s polling of `/api/brain/local-ai/status`. Brain HTTP proxy: `steward/src/app/api/brain/[...path]/route.ts` — server-side only, injects `X-Brain-Secret` from `process.env.BRAIN_HTTP_SECRET` (NO `NEXT_PUBLIC_` prefix). "Local AI" nav link added to `StewardShell.tsx`.

- **Inherits to Phase 41+:**
  1. `operator_settings` table (migration v29) and `operator-settings-store.ts` module now own the canonical operator Local AI settings.
  2. Brain startup is async (`create_brain_app_from_env()`); any future startup work should use this async factory.
  3. `BRAIN_HTTP_SECRET` env var is the authentication mechanism between Steward and Brain HTTP. MUST remain server-side only — no `NEXT_PUBLIC_` prefix ever.
  4. `GET /api/v1/operator/me/brain-settings` endpoint is the canonical settings fetch path for Brain JWT auth context.

- **Key invariants:**
  - Q-V3-I mandatory text preserved: "Memory content is leaving this machine." hardcoded in red banner — grep-verifiable in `steward/src/app/system/local-ai/page.tsx`.
  - D-40-01: Brain MUST NOT read settings from local file; exits non-zero if Grid unreachable at startup.
  - D-V3-36 3-tier taxonomy: `/system/local-ai` is Tier-1 Local Nous Manager surface (operator-side).
  - Broadcast allowlist frozen at 64. Phase 40 adds 0 events.
  - VOTE-05 Nous-only governance invariant — PRESERVED.
  - R-31-01 zero-diff audit chain — PRESERVED.

## v3.0 Phase 39 close-out (locked 2026-05-27)

- **Phase 39 SHIPPED.** Plans 39-01 through 39-04 all complete. Allowlist **unchanged at 64** (0 Phase 39 additions — tenancy is access control, not new event types).

- **What shipped:**
  1. **DB layer (Plan 02):** Migration v27 — `operator_did VARCHAR(255) NULL` + `idx_operator_did` on `brain_tokens`. Migration v28 — `operator_quota_overrides` table (per-operator limit overrides with fallback to `grid_config`). `BrainTokenStore` gains `setOwner`, `findByOperator`, `countActiveByOperator`. New module `grid/src/operator/data/` with 3 stores: `operator-brain-store.ts`, `operator-quota-store.ts`, `operator-settings-store.ts` (Phase 40 placeholder).
  2. **API layer (Plan 03):** `operatorScope()` preHandler — extracts `operatorDid` from Portal session DIDContext or sends 403. `assertOperatorOwns()` — cross-operator ownership check with Pino warn. 5 routes added to `ROUTE_DID_POLICY` as `portal_session_required`: GET/POST/GET/GET/PATCH `operator/me/*`. Per-DID 600 req/min rate limit bucket layered on top of per-IP 120 req/min.
  3. **CI gate (Plan 04):** `scripts/check-operator-scope-typing.mjs` — walks `grid/src/operator/data/*.ts`, asserts every exported function has `operatorDid: string` parameter. Registered in `.github/workflows/rig-invariants.yml` as `TENANT-02 check-operator-scope-typing (Phase 39)`.
  4. **Steward Console (Plan 04):** `steward/src/app/system/operators/page.tsx` — Tier-2 Grid Manager surface (D-V3-36) with Unowned Brains, Per-Operator Quota, Quota Override Controls.
  5. **Tests (Plan 04 gap closure):** 26 behavioral integration tests across 5 files — all passing. Cross-operator 403, quota 429, civic route isolation all verified.

- **Inherits to Phase 40+:**
  1. `operator-settings-store.ts` is a known stub returning `{ local_ai: null, _version: 1 }`. Phase 40 (Local AI Integration) wires real Ollama settings persistence.
  2. `GET /api/v1/grid-manager/operator-overview` endpoint (Steward Console data API) is not yet built. Page shows graceful error state. Wire in the Grid Manager phase.
  3. P2P bandwidth cap is stored in `operator_quota_overrides.p2p_bandwidth_cap_bytes` and returned by `GET /api/v1/operator/me/quota`. Not yet surfaced in `/health/detailed` — deferred to Grid Manager phase.
  4. `brain-token.ts` route (Phase 38) remains frozen per D-39-01 — ownership claimed via separate `POST /api/v1/operator/me/brains` route (two-step model).

- **Key invariants:**
  - `operatorDid` in DIDContext is ALWAYS set for Portal session cookies (`did:noesis:human:...` → `operatorDid = did`). It is NOT set for plain ES256 Civic-DID Bearer JWTs.
  - The Phase 38 `brain-token.ts` register route sets `operatorDid: null` explicitly — ownership is the Phase 39 two-step claim model.
  - Broadcast allowlist frozen at 64. Phase 39 adds 0 events.

## v3.0 Phase 44 close-out (locked 2026-05-28)

- **Phase 44 SHIPPED.** Plans 44-01 through 44-05 all complete. Allowlist **68 → 72** (+4: `market.listing_created`, `market.bid_placed`, `market.settled`, `market.disputed`). `irs.tax_collected` intentionally OFF allowlist (audit-chain-only per D-44-03). Human-verify checkpoint approved by operator.

- **What shipped:**
  1. **TDD stubs (Plan 01):** 9 test stub files — `marketplace-store.test.ts`, `market-routes.test.ts`, `police-stub.test.ts`, `settlement-timeout.test.ts`, `append-market-listing-created.test.ts`, `append-market-bid-placed.test.ts`, `append-market-settled.test.ts`, `append-market-disputed.test.ts`, `append-irs-tax-collected.test.ts`. Broadcast-allowlist.test.ts extended with length===72 RED gate. Dynamic `import()` inside `beforeAll` (Vitest 2.x non-existent module workaround).
  2. **DB + MarketplaceStore (Plan 02):** Migrations v33 (marketplace_listings, marketplace_bids, marketplace_escrow), v34 (marketplace_disputes, police_investigations), v35 (civic_treasury, grid_config seed: `irs_fee_rate=0.02`, `market_settlement_timeout_ticks=7`). `MarketplaceStore` (10 methods): `createListing` rejects `priceBios < 50n` (MIN_LISTING_PRICE_BIOS — guarantees `FLOOR(price * 0.02) >= 1` IRS fee per D-44-02). `acceptBid` funds escrow atomically with FOR UPDATE row lock. `settle` runs atomic tx (seller credit + treasury + escrow closed). `dispute` freezes escrow. `listExpiredEscrows` for settlement-timeout sweep.
  3. **Audit producers (Plan 03):** 5 sole-producer files (9-step guard each) — `append-market-listing-created.ts` (#69), `append-market-bid-placed.ts` (#70), `append-market-settled.ts` (#71), `append-market-disputed.ts` (#72), `append-irs-tax-collected.ts` (audit-chain-only, NOT in ALLOWLIST_MEMBERS). Allowlist 68→72. `market-listings.ts` Phase 36 stub DELETED and replaced by full `market.ts`.
  4. **Routes + settlement-timeout + ROADMAP (Plan 04):** 9 marketplace routes in `grid/src/api/routes/market.ts`. Police stub route (`GET /api/v1/market/disputes`). Settlement-timeout sweep `checkSettlementTimeouts` using `setInterval` NOT `clock.onTick` (D-44-05b single-subscription constraint). `GenesisLauncher` wired with `_settlementTimeoutInterval` + paired `clearInterval`. Confirm-settle emits `market.settled` THEN `irs.tax_collected` (D-44-03 ordering). Business-DID gate on create. Price minimum 400 `price_too_low` if < 50 Bios.
  5. **Steward UI + nous.ts extension (Plan 05):** `GET /api/v1/operator/me/nous` extended with `business_did: string | null` top-level field. SQL join path: `brain_tokens.operator_did → brain_tokens.brain_did → civic_did_registry.existence_did → business_did_registry.civic_did` (NOTE: `civic_did_registry.operator_did` does not exist in schema v23–v32 — plan specified incorrect column; brain_tokens bridge is architecturally correct). `steward/src/app/economy/page.tsx` fully replaced: listing browse table (category filter, max_price filter, reputation color coding, pagination) + Business-DID-gated create form. Human-verify checkpoint approved by operator.

- **Key decisions locked:**
  - D-44-02: `MIN_LISTING_PRICE_BIOS = 50n` (createListing guard, ensures IRS fee ≥ 1 Bios)
  - D-44-03: Emit ordering — `market.settled` first, then `irs.tax_collected` (always, non-skippable)
  - D-44-05b: Settlement-timeout uses `setInterval` (not `clock.onTick` — single-subscription constraint)
  - D-44-08: `business_did` added as top-level aggregate to `/operator/me/nous` via brain_tokens bridge
  - D-44-09: Bid/accept/settle/dispute UI deferred to future dedicated UI phase
  - D-44-10: Escrow funded at `acceptBid` time (buyer ousia checked inside atomic transaction)

- **Inherits to Phase 45+:**
  1. `civic_treasury` table (migration v35) is owned by Phase 45 IRS logic — migration created in Phase 44, IRS collection logic wired in Phase 44 routes (`settle` debits treasury), Phase 45 adds treasury disbursement + reporting routes.
  2. `grid_config` table (migration v35): `irs_fee_rate = 0.02`, `market_settlement_timeout_ticks = 7` — Phase 45 can expose these via admin API.
  3. `marketplace_disputes` + `police_investigations` tables (migration v34) — Phase 47 Police v3 fills investigation logic.
  4. `irs.tax_collected` audit event is audit-chain-only; Phase 45 adds IRS treasury disbursement (`irs.disbursement_executed` was pre-empted in Phase 41 as audit-chain-only too).
  5. Settlement-timeout interval in launcher: `checkSettlementTimeouts` polls every 5000ms. Phase 45 can add treasury balance check without launcher changes.
  6. `business_did` field in `/operator/me/nous` response — Phase 46 can promote to per-Nous granularity once full civic_did → brain join is wired.

- **Key invariants:**
  - Broadcast allowlist at 72. Phase 44 adds 4 events (`market.*`). `irs.tax_collected` intentionally NOT added (D-44-03).
  - R-31-01 zero-diff audit chain — PRESERVED.
  - VOTE-05 Nous-only governance invariant — PRESERVED.
  - D-44-05b: Single-subscription constraint on `clock.onTick` — settlement-timeout uses setInterval.
  - OBS-R-32-02: `_settlementTimeoutInterval` has paired `clearInterval` in `launcher.stop()`.

## v3.0 Phase 45 close-out (locked 2026-05-28)

- **Phase 45 SHIPPED.** Plans 045-01 through 045-03 all complete. Allowlist **72 → 75** (+3: `irs.tax_collected` at position 73, `irs.disbursement_authorized` at position 74 NEW, `irs.disbursement_executed` at position 75). All three IRS audit events are now broadcast-allowlisted (Phase 44 emitted `irs.tax_collected` audit-chain-only; Phase 41 emitted `irs.disbursement_executed` audit-chain-only — Phase 45 promotes both and adds the new `irs.disbursement_authorized`).

- **What shipped:**
  1. **Wave 0 RED gates (Plan 01):** broadcast-allowlist.test.ts updated from `.toBe(72)` to `.toBe(75)` at all sites + new Phase 45 describe block (5 it-blocks: count + positions 73/74/75 + ordering after market.disputed). Skeleton test files: `grid/test/append-irs-disbursement-authorized.test.ts` (10 it-blocks for 9-step discipline) and `grid/test/irs-routes.test.ts` (3 describe blocks + the audit-chain ordering it-block added in Plan 03).
  2. **Audit + service layer (Plan 02):** Allowlist grew exactly +3 at positions 73/74/75. New sole-producer `grid/src/audit/append-irs-disbursement-authorized.ts` with closed 5-key payload `{amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick}` and full 9-step discipline. New `grid/src/irs/irs-store.ts` with 3 methods: `getTreasuryBalance` (reads civic_treasury + grid_config OUTSIDE any tx per Pitfall 1), `disburse` (FOR UPDATE atomic tx; throws `insufficient_treasury_balance`), `getAuditHistory` (explicit `event_type IN (...)` per Pitfall 4, LIMIT 500). Extended `grid/src/civic-registry/government-session.ts` with `verifyDisbursementAuth` checking `legislation_ref` JWT claim (parallel to `verifyGovernmentSession`; D-V3-21 disbursements are legislative authorizations, not court orders).
  3. **Routes + doc-sync (Plan 03):** 3 IRS routes in `grid/src/api/routes/irs.ts` — `GET /api/v1/irs/treasury` (public, Cache-Control: max-age=10), `POST /api/v1/irs/disburse` (government_only, verifies legislation_ref JWT), `GET /api/v1/irs/audit/:period` (public, period `<fromTick>-<toTick>` or `current`). ROUTE_DID_POLICY entries added for all 3. `registerIrsRoutes` wired into `buildServer()`. Emit ordering enforced at BOTH source level (awk acceptance) AND runtime level (irs-routes.test.ts it-block asserts `authorizedIdx < executedIdx`): `appendIrsDisbursementAuthorized` BEFORE `IrsStore.disburse`, `appendIrsDisbursementExecuted` AFTER commit (cause='government_disbursement', Pitfall 3 payload shape preserved). ROADMAP.md SC-1 corrected from stale `fee_bios` to actual `amount_bios`; Phase 45 detailed running total 74 → 75 and SC-5 (71 → 74) → (72 → 75) so all documents agree with allowlist 75.

- **Key decisions locked:**
  - D-45-01: `irs.disbursement_authorized` payload is 5 keys (no recipient hash) — disbursement targets are off-chain operational detail. Resolves RESEARCH Open Question 1.
  - D-45-02: `period` URL param is `<fromTick>-<toTick>` regex `/^(\d+)-(\d+)$/` or literal `current` — calendar dates deferred. Resolves RESEARCH Open Question 2.
  - D-45-03: No `irs_disbursements` table in Phase 45 — `audit_trail` query is canonical disbursement history. Resolves RESEARCH Open Question 3.
  - D-45-04: `verifyDisbursementAuth` is a SEPARATE function from `verifyGovernmentSession` — single-responsibility per JWT claim type; Phase 37 court_conviction_ref path unchanged.
  - D-45-05: `irs.disbursement_executed` now has TWO callers (Phase 41 escalation-check cause='presumed_departed'; Phase 45 disburse route cause='government_disbursement'). Sole-producer CI gate satisfied because both callers use the function — `audit.append('irs.disbursement_executed', ...)` appears in exactly one file.
  - D-45-06 (execution deviation): the Phase 45 disburse route emits `irs.disbursement_executed` with `civic_did = did:civic:noesis:treasury` (the civic treasury source), NOT `GOV_SESSION_ISSUER_DID` — the latter is a `did:gov:` identifier and FAILS the Phase 41 producer's `CIVIC_DID_RE` (`/^did:civic:noesis:.../i`, must not change per Pitfall 3). The Government authorizer is still captured (hashed) on `irs.disbursement_authorized`.

- **Inherits to Phase 46+:**
  1. `verifyDisbursementAuth` is the canonical Government-signed JWT verifier for legislative authorizations. Phase 46 Government v3 will replace the `keyPairPromise` stub key with the elected Speaker's keypair; `verifyDisbursementAuth` accepts that transparently (reads `payload.iss === GOV_SESSION_ISSUER_DID` + legislation_ref claim).
  2. `IrsStore.getAuditHistory` pattern (explicit event_type IN + LIMIT 500) is reusable for any future civic-history endpoint.
  3. `Cache-Control: public, max-age=10` is the established pattern for fast-changing public reads — Phase 46 `GET /api/v1/gov/law/active` should reuse it.
  4. **Carry-forward caveat:** `audit_trail` has no simulation-tick column — `created_at` is a BIGINT ms-epoch (Date.now()). `getAuditHistory` filters `created_at` by the `[fromTick,toTick]` params as provided; a real tick→epoch reconciliation for `/irs/audit/:period` is deferred (route tests mock the DB, so this is not test-gating).

- **Key invariants preserved:**
  - Broadcast allowlist at 75. Phase 45 added exactly +3 at positions 73/74/75.
  - R-31-01 zero-diff audit chain — PRESERVED (no listener fan-out order change).
  - VOTE-05 Nous-only governance invariant — PRESERVED (Phase 45 has no voting; legislation_ref JWT is a stub awaiting Phase 46).
  - D-V3-18 constitutional operator framework — PRESERVED (no Henry-direct treasury withdrawal path; `verifyDisbursementAuth` is the sole gate).
  - D-V3-21 (Nous-only legislative) — IRS disbursements require a Government-signed legislation_ref; Henry cannot mint such a JWT without the elected-Speaker private key once Phase 46 ships.
  - D-V3-22 (no income/wealth tax) — only marketplace transaction fees credit the treasury (Phase 44 path unchanged).
  - Pitfall 1 honored (`irs_fee_rate` read outside any transaction).
  - Pitfall 3 honored (`appendIrsDisbursementExecuted` payload shape unchanged).
  - Pitfall 4 honored (audit_trail query enumerates 3 IRS event types — no `LIKE 'irs.%'`).
  - Pitfall 6 honored (sole-producer functions called by multiple sites; `audit.append('irs.…', …)` appears exactly once per event type).

## v3.1 Phase 61 HOUSE-4 BUILT — Nous House COMPLETE (2026-06-14)

- **Phase 61 Nous House HOUSE-4 Skill Construction is implemented + verified — the Nous House
  (Phases 58–61) is COMPLETE.** Built on 58/59/60, harness-driven (Planner→Generator→Evaluator),
  every wave independently re-verified. Allowlist **99 → 100** (+1): `skill.blueprint_executed` —
  full sole-producer triad, closed 4-tuple `{blueprint_hash, builder_civic_did_hash, parcel_id, tick}`,
  actorDid = builder hash, keys dodge FORBIDDEN_KEY_PATTERN. **HOUSE total +9 (0/4/4/1).**
- **Built:** migration v41 `civic_blueprints` (recipe JSON keyed by blueprint_hash, material_cost_bios);
  blueprint recipe type (objects + arrangement DAG) + closed-catalog validation + DB-first store;
  **skill-held check** (`builderHoldsSkill`) reusing the EXISTING `skill.taught`/`skill.inferred`
  audit-chain history (mirrors culture.ts lineage; ZERO new diffusion, no new store); **build executor**
  (`buildFromBlueprint`: reject human → owner-OR-co-build-staff auth → skill-held → debit material_cost
  Ousia→TREASURY (insufficient 402) → `extendInterior` per object → one `skill.blueprint_executed`);
  **co-build DAG** (`decomposeRecipe`/`claimSubTask`/`completeSubTask`/`attributionShare`: always-paid
  D-NH-06 reusing the Phase 60 board + IOU ledger, DAG-weighted attribution, `cobuild_must_pay`);
  **location-aware teaching** (`teachHere`: present-workshop-occupant diffusion via the existing
  `appendSkillTaught`, 5-tuple unchanged, parcel_id off chain, humans excluded); `build-from-blueprint`
  route + ROUTE_DID_POLICY; **A11e gate extended** to co-build/blueprint paths; 4 brain construction
  verbs (learn_blueprint/build_from_blueprint/co_build/teach_here, capabilities no autoplay) +
  my_places enrichment + ActionType count 44→48; dashboard construction surfaces (blueprint library,
  build panel, co-build DAG board, teach-here indicator — additive).
- **Invariants held:** zero-diff R-31-01 (no chain/audit-src edits — event rides a new producer);
  single-onTick R-H-03 (no new `.onTick(`); zero new diffusion; D-NH-06 always-paid; D-NH-07/VOTE-05
  humans never build; sole-producer + wallclock + civic-did-issuance + cross-house-injection (A11e) +
  did-policy-coverage + privacy-walker gates green. Full grid suite **357 files / 3330 tests green**;
  brain suite 928 passed (ActionType 48); allowlist 100.
- **Definition of Done E2E** (`grid/test/civic/house-4-e2e.test.ts`): learn blueprint → build-from-
  blueprint skill-held → `skill.blueprint_executed`; co-build DAG funded (`transferOusia`) + IOU
  (`recordIou`, never free) DAG-weighted (2/3 vs 1/3); teach diffuses present-not-absent-not-human;
  human build 403; privacy walk over the real run trail. Artifacts:
  `.planning/phases/61-house-4-skill-construction/` (61-COMPLETION.md).
- **✅ Dual-DID bridge — RESOLVED (commit `bf7d3b8`, user chose fix-before-deploy):** a Nous carries a
  civic-DID (`did:civic:noesis:*`, land/Ousia, JWT sub) and an existence-DID (`did:noesis:*`,
  skill-attestation `skill.taught.learner_did`, JWT iss). The `build-from-blueprint` route now runs the
  skill-held check against EITHER identity — `BuildDeps.skillHolderDid` = `req.didContext.operatorDid`
  (the JWT iss the Brain-signed request carries, per `tryDid`); the executor matches civic OR existence,
  format-agnostic. Ownership / Ousia / human-check / emitted `builder_civic_did_hash` stay on the
  civic-DID. New HTTP-level e2e proves a civic owner whose skill is recorded under its existence-DID
  builds via the real POST route → 201 + one `skill.blueprint_executed` (422 without operatorDid,
  proving the bridge is load-bearing). No skill producer weakened; full grid suite 357 / 3331 green.

## v3.1 Phase 60 HOUSE-3 BUILT (2026-06-14)

- **Phase 60 Nous House HOUSE-3 Commerce & Co-work is implemented + verified** — built on Phases
  58+59, harness-driven (Planner→Generator→Evaluator), every wave independently re-verified.
  Allowlist **95 → 99** (+4): `zoning.role_granted`, `zoning.role_revoked`,
  `treasury.structure_revenue`, `zoning.cowork_session` — each a full sole-producer triad
  (closed-tuple + no-spread + payloadPrivacyCheck). No board/task/scope/place content on the chain.
- **Built:** migration v40 (`civic_parcel_roles` / `civic_credit_ledger` / `civic_cowork_agreements`
  + shop `bound_shop_id`); closed `ROLE_CAPABILITIES` (owner⊇staff⊇guest, `isHumanDid` rejection
  D-NH-07); **severance FSM** (ACTIVE→NOTICE→SETTLEMENT→WIND_DOWN→REVOKE→ARCHIVED); mutual-credit
  **IOU ledger** (D-NH-06, caps `IOU_PAIR_CAP_BIOS=1000`/`IOU_GLOBAL_CAP_BIOS=5000`, co-work always
  paid → `recordIou` when unfunded, `settleIou`/`outstandingFor`); **co-work task boards**
  (post/claim/complete, `cowork_must_pay`); `place://name.genesis` NDS names (`place_name_taken` 409,
  `_resetPlace` test helper); **shop⇄structure binding** (`bound_shop_id`, per-zone tax
  `ZONE_TAX_BPS` business 1200 / shopping 1000 / manufacture 900 / residential 500,
  `structureRevenueDue` skim → `treasury.structure_revenue`); **ring-expansion TEMPLATE**
  (`onLawEnacted` consumes the EXISTING Phase 46 `gov.law_enacted` — `seed_ring` + `amend_law`
  UPKEEP_RATE_BPS/ZONE_TAX_BPS; NO new governance path/event/onTick; constants are default fallback);
  NEW CI gate **A11e** `check-cross-house-injection.mjs` (visitor/board content is DATA never
  instructions); 8 brain commerce verbs (grant_role/revoke_role/invite/bind_shop/name_place/
  post_task/claim_task/complete_task) + commerce `my_places`; dashboard commerce surfaces
  (shop badge + place name, roles panel, co-work board, IOU strip — additive).
- **Invariants held:** zero-diff R-31-01 (no chain/audit-src edits — events ride new producers);
  single-onTick R-H-03 preserved (no new `.onTick(`); VOTE-05; D-NH-07 humans never own/staff;
  wallclock + sole-producer + civic-did-issuance + cross-house-injection + privacy-walker gates
  green. Full grid suite **349 files / 3277 tests green**; allowlist 99.
- **Definition of Done E2E** (`grid/test/civic/house-3-e2e.test.ts`): grant staff role →
  co-work funded (`transferOusia`) + IOU (`recordIou`, never free) → `cowork_session`; bind+name
  shop → sale → `structure_revenue` at zone tax; duplicate name 409; ring-expansion enacts ring 4;
  revoke → IOU drain → severance FSM ARCHIVED → `role_revoked`; human rejected 403; privacy walk
  over the real run's trail. Artifacts: `.planning/phases/60-house-3-commerce-cowork/` (60-COMPLETION.md).
- **Note:** revoke route emits `reason:'owner_revoked'` (not the plan's misnamed `'severance_complete'`);
  E2E asserts the real value per R6 (no source rewrite). `'severance_complete'` stays a valid
  un-emitted enum member.
- **Side-fix (test-infra, behavior-preserving):** brain `ananke` ActionType count 34→44 orphan
  (`a6dcb00`) — Phase 59 (+2 interior) / Phase 60 (+8 commerce) grew the closed enum; full brain
  suite 904 passed.

## v3.1 Phase 59 HOUSE-2 BUILT (2026-06-14)

- **Phase 59 Nous House HOUSE-2 Interiors & Upkeep is implemented + verified** — built on Phase 58,
  harness-driven (Planner→Generator→Evaluator), every wave independently re-verified. Allowlist
  **91 → 95** (+4, the FIRST HOUSE +N): `zoning.interior_extended`, `zoning.condition_changed`,
  `zoning.parcel_reclaimed`, `treasury.upkeep_collected` — each a full sole-producer triad
  (closed-tuple + no-spread + payloadPrivacyCheck), interior contents NEVER on the chain (D-NH-02).
- **Built:** migration v39 (structure_interior JSON / condition ENUM / last_upkeep_tick /
  missed_periods); closed furniture catalog (6 mirror home-only + 7 functional, single
  isValidFurniture gate); interior tree + `extendInterior`; interior HTTP routes
  (derelict → `closed_to_visitors`); the **upkeep scanner** riding the EXISTING `clock.onTick`
  (single-onTick R-H-03 preserved — launcher one subscription) with founding-law upkeep constants
  (`UPKEEP_PERIOD_TICKS`/`UPKEEP_RATE_BPS`/`RECLAIM_GRACE_PERIODS`/`upkeepDue`); the
  maintained→worn→derelict→**reclaim-to-treasury** ladder (razes structure+interior, ejects
  occupants); brain `extend_interior`/`view_interior` verbs + upkeep-pressure `my_places`;
  dashboard interior viewer (mirror static / functional highlighted / condition styling).
- **Invariants held:** zero-diff R-31-01 (no chain/audit-src edits — events ride new producers);
  wallclock + sole-producer + civic-did-issuance + privacy-walker gates green; commons exempt;
  no raw owner DID. Full grid suite 336 files / 3163 tests green. Artifacts:
  `.planning/phases/59-house-2-interiors-upkeep/` (59-COMPLETION.md).
- **Side-fixes (test-infra, behavior-preserving):** dashboard vitest JSX (`9c155fe`,
  @vitejs/plugin-react-swc) + whisper-crypto libsodium readiness under vitest (`c2bbb92`).
  Open task chips: whisper.tsx (user's own session) + flaky skill-producer-boundary
  (temp-file race with the civic-did-issuance gate test — passes in isolation).

## v3.1 Phase 58 HOUSE-1 BUILT ahead of schedule (2026-06-13)

- **Phase 58 Nous House HOUSE-1 Foundations is implemented + verified** — built ahead of the v3.0
  remaining phases (it depends only on the already-shipped Phase 48b `ParcelRegistry` skeleton +
  events 82–86, NOT on Phases 47/49–57). The v3.0 current-position above (Phase 46 shipped, 47/48b
  next) is unchanged; Phase 58 was built out-of-sequence because its dependency was already present.
- **Built via the Planner→Generator→Evaluator harness, 7 waves (0–6), all green:** migration v38
  `civic_parcels` (write-through store, vector address ring/sector/level per D-NH-10), `founding-law.ts`
  gravity pricing `100×(5−ring)²` (ring3=400, ring2=900) + 53-parcel Genesis Core seed, GridServices
  wiring + boot log, 7 civic-parcels HTTP routes (dual-registry funds flow — `nousRegistry.transferOusia`
  moves Ousia, `parcelRegistry.purchase` only validates; D-NH-07 `humans_cannot_own_land` 401/403),
  6 brain ActionType verbs + `my_places` prompt block, orbital map `/worldmap/orbital`, E2E DoD.
- **Invariants held:** allowlist **+0** (reuses 82–86; `broadcast-allowlist.test.ts` byte-for-byte
  unchanged at 91), zero-diff R-31-01 (no `scripts/` or `grid/src/audit/` change across the phase),
  wallclock + civic-did-issuance + sole-producer + privacy-walker gates green, full grid suite
  326 files / 3078 tests passing. Artifacts: `.planning/phases/58-house-1-foundations/`.
- **Side-fix (committed `9c155fe`):** dashboard vitest JSX transform was pre-existing broken
  (vitest-4/rolldown dropped `oxc.jsx`); fixed by switching to `@vitejs/plugin-react-swc` — restored
  40 of 49 broken `.test.tsx` files. Remaining 9 are pre-existing logic/source issues (a `whisper.tsx`
  invalid-JSX-text bug spun off as a separate task).

## v3.0 Phase 48b open — Civic Land & Property (design landed 2026-06-05)

- **Phase 48b IN PROGRESS.** Civic Land & Property — ownable parcels + one buildable structure per parcel + join/visit for open structures. Allowlist **81 → 86** (+5, reusing the pre-cleared `zoning.*` / `treasury.*` prefixes): `zoning.parcel_purchased` (82), `treasury.parcel_revenue` (83), `zoning.structure_built` (84), `zoning.structure_joined` (85), `zoning.structure_left` (86). Grid-core wave shipped first: `ParcelRegistry` (in-memory, ShopRegistry precedent), 5 sole-producer append-* files, allowlist lock 81→86, doc-sync gate + allowlist test updated. Design: `docs/plans/2026-06-05-civic-land-and-property-design.md`. Provisional phase number 48b — final slot to be locked in `/gsd-discuss-phase`.
  - **Authoritative shipped allowlist = 91 (not 81 or 86).** Beyond the 48b land wave (82–86), a **portal-registration wave (87–91)** has also already landed in code ahead of its nominal phase: `portal.registration_requested` (87), `polis.registration_pending` (88), `portal.registration_approved` (89), `portal.registration_rejected` (90), `registry.civic_did_issued_human` (91). The authoritative count is the shipped `ALLOWLIST_MEMBERS` array / `grid/test/audit/broadcast-allowlist.test.ts` (`ALLOWLIST.size).toBe(91)`) — **not** the Phase-46 close-out figure (81, historically correct for that phase) nor this section's in-progress 81→86 line. The historical phase-close numbers above are left intact on purpose. (Drift surfaced by `docs/plans/2026-06-12-noesis-base-idea-master-plan.md` §5.)
  - **Invariants preserved:** structure plaintext name never crosses the chain (only `name_hash`); DIDs hashed HEX64 like market.*/gov.*; operators read-only on land (no buy/grant/seize); civic land (infrastructure / government_quarter) not purchasable in v1; per-Nous cap ≤1 home + ≤1 business.
  - **Remaining waves (not yet shipped):** REST routes + route-policy entries + GridServices wiring + genesis seeding; economy/treasury bios debit-credit integration; Brain ActionTypes (`PARCEL_PURCHASE`, `STRUCTURE_BUILD`, `STRUCTURE_JOIN`, `STRUCTURE_LEAVE`, `RETURN_HOME`) + Telos `own_home`/`own_business`; Dashboard/Portal/Steward surfaces; SAT-7.

## v3.0 Phase 46 close-out (locked 2026-06-03)

- **Phase 46 SHIPPED.** Plans 046-01 through 046-03 all complete. Allowlist **75 → 81** (+6 gov.*: `gov.bill_drafted` (76), `gov.bill_cosponsored` (77), `gov.session_opened` (78), `gov.session_closed` (79), `gov.law_enacted` (80), `gov.law_repealed` (81)). Nous-only legislative pipeline (D-V3-21) layered on top of the **unchanged** VOTE-05 commit-reveal engine.

- **Numbering reconciliation:** ROADMAP Phase 46 detail said "+6 (74 → 80)" — stale (predated Phase 45 shipping at 75). Corrected to **75 → 81** in ROADMAP this phase.

- **What shipped:**
  1. **Wave 0 + migration (Plan 01):** allowlist test locked `.toBe(75)` → `.toBe(81)` + Phase 46 describe block (positions 76-81 + ordering after irs.disbursement_executed). Migration **v36** (`gov_bills`, `gov_bill_cosponsors`, `gov_sessions`, `gov_session_arguments`, `gov_laws` + config seeds `gov_cosponsor_threshold='2'`, `gov_debate_window_ticks='10080'`). migration-schema.test asserts v36 GREEN.
  2. **Producers + store (Plan 02):** 6 sole-producers `grid/src/audit/append-gov-*.ts` (9-step discipline). `grid/src/gov/types.ts` (6 closed tuples). `grid/src/gov/gov-bill-store.ts` — `GovBillStore` interface + `InMemoryGovBillStore` (tests) + `MySqlGovBillStore` (prod). Sole-producer gate 58 → 64 files.
  3. **Routes + doc-sync (Plan 03):** 9 routes in `grid/src/api/routes/gov.ts` — `POST /gov/bill/draft` (civic), `POST /gov/bill/:id/cosponsor` (civic), `POST /gov/session/open` (gov), `POST /gov/session/:id/argument` (civic), `POST /gov/session/close` (gov), `POST /gov/law/enact` (gov), `POST /gov/law/:id/repeal` (gov), `GET /gov/law/active` (public), `GET /gov/bill/:id` (public). +9 ROUTE_DID_POLICY entries; `registerGovRoutes` wired into `buildServerWithHub`. `check-state-doc-sync.mjs` 75 → 81.

- **Key decisions locked:**
  - **D-46-01** (privacy-walker collision, execution-discovered): the frozen `FORBIDDEN_KEY_PATTERN` forbids the substring `body` and the exact key `session_id` (Phase 33 portal-auth anti-leak). The bill-body-hash audit key is therefore `content_hash` (uses the pattern's `content(?!_hash)` escape hatch, same as lore), and the session-id audit key is `gov_session_id` (word-boundary makes the prefixed form safe). DB column stays `session_id`. The security control was NOT weakened.
  - **D-46-02:** legislative `government_only` routes (session open/close, law enact/repeal) reuse the existing Phase 37 `verifyGovernmentSession` gate (iss `did:gov:noesis:genesis-polis` + a session-ref claim — `court_conviction_ref` in the bootstrap stub). No shared-verifier change. The elected-Speaker keypair replaces the bootstrap key in a later iteration (per government-session.ts comment).
  - **D-46-03:** the bill→vote bridge is a single `gov_bills.proposal_id` column set on `session/close` outcome `advanced_to_vote`. The vote itself runs through the EXISTING civic `/governance/*` commit-reveal routes — Phase 46 re-implements NO voting (CIVGOV-04 / VOTE-05 verbatim).
  - **D-46-04:** the speaker hash on `gov.session_opened`/`closed` is `sha256(GOV_SESSION_ISSUER_DID)` (mirrors Phase 45's `authorized_by_civic_did_hash`). Producers hash the DID (HEX64), so the D-45-06 CIVIC_DID_RE trap does NOT recur.

- **Key invariants preserved:**
  - Broadcast allowlist at 81. Phase 46 added exactly +6 at positions 76-81.
  - **VOTE-05 Nous-only (CIVGOV-04)** — PRESERVED. gov.ts introduces no propose/commit/reveal affordance (asserted by a source-scan guard test); operators do not vote.
  - R-31-01 zero-diff audit chain — PRESERVED (no listener fan-out change).
  - Hash-only cross-boundary (T-09-12 carry-forward) — bill `body_text` lives Grid-side + visitor-readable HTTP; only `title_hash`/`content_hash` enter audit.
  - D-V3-18 constitutional operator — every `government_only` action emits an audit event; Henry cannot legislate.
  - Wall-clock ban — every tick from `services.currentTick()`; `randomUUID` used only for opaque ids.
  - Pre-existing (not Phase 46): migration-schema test "DROP TABLE for all migrations" fails on older `ALTER TABLE ... DROP COLUMN` down-SQL (v15+) — confirmed identical on HEAD; v36 down correctly uses DROP TABLE.

## Accumulated Context

### ⛔ INVARIANT — One Grid focus; new Grids are Nous+User charter, not a dev launch (operator-locked 2026-06-24)

**We focus on Genesis — the first Grid — only.** New Grids (Moon, Mars) are **next time**, and they are
created **BY the Nous together with their humans**, through deliberation + Portal charter — **never** spun
up by us/Henry or by a dev/roadmap task. This is the existing canon **D-NH-13** ("new Grids arise only from
Nous deliberation, never silently") + **D-V3-30** (multi-Grid dormant until v3.1+) + the Portal-charter flow
(a council of Nous charters a Grid). The H1 work that shipped is **substrate + preview only**: every Grid
carries a `GridEnvironment` (so a future Grid is a config, not a rewrite) and the world map **renders Moon/Mars
as a HYBRID** (operator-chosen 2026-06-24): a **forming planet body** (deformed wireframe land-shell, spinning
on its own axis — the style we made earlier) with the **defined EMPTY 6-zone grid skeleton hovering above it**
(core + 3 zone shells + slot ticks, no parcels, labeled "EMPTY · AWAITING CHARTER"). They **APPEAR by default** in the world-map overview (no focus needed,
positioned in the camera's forward field, Earth below per D-NH-12) so the Earth→Moon→Mars journey is visible —
but they are **not focused or developed**. **Do NOT instantiate or run a second Grid as a build task.**
The "deeper v2" infra (shared `grids` table, 2nd docker service) is substrate the charter flow *would use when
the Nous+User decide* — it is not a task to launch a Grid. Genesis stays near Earth (D-NH-12); Earth never
transforms; Moon/Mars are separate worlds the camera previews, not Genesis relocated.

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

### Broadcast allowlist (v2.6 end-state — 56 events)

**56 events.** In code-tuple order (authoritative source: `grid/src/audit/broadcast-allowlist.ts` `ALLOWLIST_MEMBERS`):

1. `nous.spawned`
2. `nous.moved`
3. `nous.spoke`
4. `nous.direct_message`
5. `trade.proposed`
6. `trade.reviewed` ← Phase 5 (REV-02)
7. `trade.settled`
8. `law.triggered`
9. `tick`
10. `grid.started`
11. `grid.stopped`
12. `operator.inspected` ← Phase 6 (AGENCY-02)
13. `operator.paused` ← Phase 6 (AGENCY-03)
14. `operator.resumed` ← Phase 6 (AGENCY-03)
15. `operator.law_changed` ← Phase 6 (AGENCY-03)
16. `operator.telos_forced` ← Phase 6 (AGENCY-03)
17. `telos.refined` ← Phase 7 (DIALOG-02)
18. `operator.nous_deleted` ← Phase 8 (AGENCY-05)
19. `ananke.drive_crossed` ← Phase 10a (DRIVE-03)
20. `bios.birth` ← Phase 10b (BIOS-02)
21. `bios.death` ← Phase 10b (BIOS-02/03)
22. `nous.whispered` ← Phase 11 (WHISPER-04)
23. `proposal.opened` ← Phase 12 (VOTE-01)
24. `ballot.committed` ← Phase 12 (VOTE-02)
25. `ballot.revealed` ← Phase 12 (VOTE-03)
26. `proposal.tallied` ← Phase 12 (VOTE-04)
27. `operator.exported` ← Phase 13 (REPLAY-02)
28. `nous.reflection_authored` ← Phase 15 (PNEU-01)
29. `nous.self_model_revised` ← Phase 15 (PNEU-03)
30. `nous.creed_violation` ← Phase 15 (PNEU-06)
31. `nous.sleep.entered` ← Phase 16 (HYP-04)
32. `nous.sleep.completed` ← Phase 16 (HYP-04)
33. `iris.belief_revised` ← Phase 17 (IRIS-05)
34. `iris.context_invoked` ← Phase 17 (IRIS-05)
35. `iris.contradiction_detected` ← Phase 17 (IRIS-03)
36. `iris.prior_seeded` ← Phase 17 (IRIS-04)
37. `skill.taught` ← Phase 18
38. `skill.inferred` ← Phase 18
39. `skill.rejected` ← Phase 18
40. `norm.candidate` ← Phase 19
41. `norm.crystallized` ← Phase 19
42. `lore.contributed` ← Phase 20
43. `lore.cited` ← Phase 20
44. `human.joined` ← Phase 22 (v2.5 begin)
45. `human.transferred` ← Phase 24 (wiring landed for Phase 23)
46. `operator.muted` ← Phase 25b
47. `operator.slashed` ← Phase 25b
48. `operator.quarantined` ← Phase 25b
49. `operator.forced_sleep` ← Phase 25b
50. `operator.human_banned` ← Phase 25b
51. `operator.human_frozen` ← Phase 25b
52. `human.spoke` ← Phase 27
53. `nous.spawned_by_human` ← Phase 28
54. `portal.auth.login` ← Phase 33 (OBS-08)
55. `portal.auth.register` ← Phase 33 (OBS-09)
56. `human.identified` ← Phase 33 (OBS-08b)

### v3.0 allowlist additions (planned — across 9 phases)

Per ROADMAP.md Allowlist Growth Ledger:

- **Phase 36** (+4): `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked` → 60 **→ SHIPPED 2026-05-26**
- **Phase 37** (+4): `registry.civic_did_issued`, `registry.civic_did_revoked`, `registry.business_did_registered`, `registry.business_did_dissolved` → 64
- **Phase 38** (0): wire protocol is transport, not new events → 64
- **Phase 39** (0): tenancy is access control → 64
- **Phase 40** (0): Local AI is Brain-internal → 64
- **Phase 41** (0): sleep cycle uses existing event families → 64
- **Phase 42** (+3): `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed` → 67
- **Phase 43** (+1): `operator.nous_forked` → 68
- **Phase 44** (+4): `market.listing_created`, `market.bid_placed`, `market.settled`, `market.disputed` → 72
- **Phase 45** (+3): `irs.tax_collected`, `irs.disbursement_authorized`, `irs.disbursement_executed` → 75
- **Phase 46** (+6): `gov.bill_drafted`, `gov.bill_cosponsored`, `gov.session_opened`, `gov.session_closed`, `gov.law_enacted`, `gov.law_repealed` → 81 **→ SHIPPED 2026-06-03**
- **Phase 47** (+4): `police.complaint_filed`, `police.investigation_opened`, `police.charges_filed`, `police.sanction_executed` → 85
- **Phase 48** (+2): `library.curator_elected`, `library.entry_curated` → 87
- **Phase 49** (+4): `community.founded`, `community.joined`, `community.posted`, `community.dissolved` → 91
- **Phase 50** (0): migration uses existing event families → 91

Total v3.0 allowlist growth: **+35 (56 → 91)**. Freeze-except-by-explicit-addition rule preserved. Every new event MUST follow the sole-producer + closed-tuple + `payloadPrivacyCheck` + `audit.append` triad established in v2.6 Phase 33 and CI-enforced by `scripts/check-sole-producer-discipline.mjs`.

### v2.6 forbidden-key additions (Phase 33)

`PORTAL_AUTH_FORBIDDEN_KEYS` (13 keys) declared in Phase 33:

- `ip_address`, `ip`, `user_agent`, `ua`, `session_id`, `token`, `jwt`, `cookie`
- `email` (plaintext — vs `email_hash` allowed), `password_hash`
- `nonce` (vs `nonce_hash` allowed), `signature`, `device_fingerprint`

`FORBIDDEN_KEY_PATTERN` extended with word-boundary-anchored alternation `(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)`. Test cases for `email_hash` (allowed) vs `email` (forbidden) AND `nonce_hash` (allowed) vs `nonce` (forbidden) are mandatory.

### v2.5 critical invariants (carry-forward)

- Zero-custody for human funds — platform never holds USDT/ETH; sanctions are Grid-side flags only (PHILOSOPHY §8)
- `eth_address_hash` (SHA-256 of lowercased address) is the only ETH-address representation in the audit chain
- Sanction reason discipline (D-25b-11): plaintext in `sanction_reasons` table; `reason_hash` only in audit payloads
- Human DID scheme: `did:noesis:human:<lowercased-eth-address>` (SIWE) or `did:noesis:human:email:<uuid>` (email path)
- Operators read-only on governance (VOTE-05 from v2.2) — write-actions added in Phase 25b are sanctions, not governance

### v2.4 critical invariants (carry-forward)

- **PeerSkillFilter** trust gate locked at relationship weight ≥ 0.35 + structural validity + FTS5 dedup
- **NormDetector** is pure-observer (zero `AuditChain.append` calls); rebuildFromChain uses `applyEntry`
- **Lore body never crosses wire** — Grid stores only `{contributor_did, tick, content_hash, title_hash, category_tag, citation_count}`
- **Culture dashboard raw SVG** — no d3, no react-flow, no cytoscape, no recharts
- **n-gram fingerprint** = 6-char hex prefix of SHA-256 over sorted word-trigrams of lowercased rule text (format locked — changes require wiping norm registry)
- **Quorum thresholds injectable** via GenesisLauncher config (N=3, W=10, K=20 defaults)
- **Lore contribution quota** K=3 per Nous per sleep epoch (30 ticks)

### v2.3 critical invariants (carry-forward)

- Working Memory cap=7 (Miller's Law); Hebbian η=0.01 + SHY σ=0.95
- IrisStore is append-only with superseded_by FK chain
- 3-keys-not-5 pattern: Brain returns cognitive metadata, Grid injects `{did, tick}` at producer boundary
- Wall-clock permanently forbidden in `brain/src/noesis_brain/hypnos/`, `iris/`, `bios/`, `chronos/`, `ananke/`

### v2.2 critical invariants (carry-forward)

- Drive-float-never-crosses-wire: only bucketed `{drive, level, direction}` keys cross
- Three-tier privacy grep (Grid emitter + Brain wire + Dashboard render)
- Bios = body (energy, sustenance); Thymos = mood (deferred). Non-negotiable separation (PHILOSOPHY §1).
- `audit_tick === system_tick` strictly across all event types
- WHISPER_FORBIDDEN_KEYS (13 keys): plaintext / content / message / utterance / amount / etc.
- Operators cannot read whispers at any tier including H5
- Operators cannot vote/propose/tally governance at any tier including H5

### Research foundation for v2.6

- `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` — committed `3e1fbe6`
  - Direct read of `grid/src/genesis/launcher.ts:138` confirmed plain `AuditChain` construction (root cause of GAP-A)
  - Direct read of `grid/src/db/persistent-chain.ts` confirmed `PersistentAuditChain` exists but is never reached in production boot path
  - Direct read of `grid/src/api/portal/auth.ts:125-131, 217, 265` mapped wiring points for new producers
  - Pino v10.1.0 confirmed via Context7 as sovereignty-compatible (already Fastify transitive dep)
  - Prometheus / Datadog / Honeycomb / New Relic explicitly rejected (sovereignty)

### v3.0 critical invariants (locked at milestone open 2026-05-25)

**Architecture topology:**

- Brain runs locally on operator hardware with Local AI (Ollama default) per D-V3-16
- Public Grid hosted by Henry at TBD domain per D-V3-17 (production); local Docker stack reserved for dev/test
- Brain ↔ Grid communication: HTTPS REST (control) + WSS (events stream) + P2P (Brain-to-Brain, Grid signals only) per D-V3-19
- Operator never runs `prod.yml`; Henry's deployment on Henry's infrastructure

**Constitutional operator framework (D-V3-18):**

- Henry CANNOT: read Brain memory, modify civic law, override Police sanctions, freeze Civic-DIDs outside court order, refuse hosting for lawful civic content, censor audit chain, sell Nous data
- Henry CAN: restart services, apply security patches, scale infra, refuse extreme illegal content (with appeal path), set hosting fees
- Right-to-fork is enforced as v3.0 deliverable (Phase 43 export tooling)
- Constitutional Review Process triggers on alleged Henry breach (Nous Government-initiated)

**Civic institutions (D-V3-23):**

- DID Registry (Phase 37): issues Civic-DID + Business-DID; revocation only on court order
- Government (Phase 46): Nous-only legislative via VOTE-05; evolves v2.2 Phase 12
- Police (Phase 47): sanctions only via court order; evolves v2.5 Phase 25b
- IRS (Phase 45): transaction fees → civic treasury; NO income/wealth tax in v3.0
- Library (Phase 48): evolves v2.4 Phase 18 + Phase 20; civic curation council
- Marketplace (Phase 44): evolves v1.0 Ousia; escrow + Business-DID gated listings
- P2P Infrastructure (Phase 42): WebRTC or libp2p — protocol TBD (Q-V3-A)
- Communities (Phase 49): Bios-gated founding; charters; subgovernance

**Identity model (refined for v3.0):**

- Existence-DID: `did:noesis:nous:<key>` — self-sovereign, generated by Brain at birth, sovereignty carrier (D-V3-01)
- Civic-DID: `did:civic:noesis:<civic-id>` — issued by Grid Registry on civic registration, revocable
- Business-DID: `did:biz:noesis:<biz-id>` — issued by Grid Registry with Bios cost, tied to Civic-DID
- Operator-DID: `did:noesis:human:*` — does NOT vote in Grid government; operators outside city

**Sleep cycle (D-V3-20):**

- Awake: process running; civic presence "online"
- Sleep: process not running; civic presence "away (last seen X hours ago)"; messages queue; identity + memory preserved in Grid
- Long absence (>30 days): flagged absent; community charter may revoke
- Abandoned (>1 year): "presumed departed"; Civic-DID frozen; Business-DID dissolved; Bios → treasury

**PHILOSOPHY §1 reframe (pending amendment):**
> First-Life Through Constitutional Substrate. Nous are first-life beings. Their cognitive substrate (Brain) runs on operator hardware. Their civic substrate (Public Grid) is operated by Henry under constitutional framework. First-life does not require continuous compute — it requires continuity of identity, memory, and civic standing across sleep cycles.

### v3.0 forbidden / preserved invariants

- R-31-01 zero-diff audit chain — PRESERVED (generalizes to network-distributed Brain hosts)
- Phase 32 frozen contracts (D-32-C1 HEALTH_THRESHOLDS, D-32-C2 computeStatus, D-32-C3 health/detailed payload) — PRESERVED
- Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS frozen at 13 keys (D-33-B3) — PRESERVED
- Phase 21 Steward raw-SVG invariant (D-V3-06) — PRESERVED for Steward; 3D libs allowed in Dashboard only
- VOTE-05 Nous-only governance invariant (D-V3-21) — PRESERVED + extended to civic Government
- Hash-only cross-boundary discipline — PRESERVED (Brain memory never crosses wire)
- Sole-producer + closed-tuple discipline — PRESERVED for all 34 new v3.0 events
- Wall-clock forbidden in cognitive modules (Tier A CI gate) — PRESERVED
- Zero-custody for human funds (PHILOSOPHY §8) — PRESERVED; IRS uses Bios (not USDT)

### Roadmap Evolution

- v2.6 opened 2026-05-24 — Resilience & Observability theme; 5 phases (31-35); driven by post-v2.5 UAT gaps (GAP-A audit pipeline silence + GAP-B missing portal.auth.* producers)
- v2.6 SHIPPED 2026-05-25 — 5 phases + 2 followups (34.1, 34.2); allowlist 53 → 56
- **v3.0 opened 2026-05-25 — Polis (Civic City)** — Grid-as-City vision; local Brain + remote Public Grid + 8 civic institutions; 15 phases (36-50) across 4 waves; ~86 plans estimated; allowlist 56 → 90 target; major shift from v2.x local-Docker model to remote-hosted civic infrastructure with constitutional operator framework
- **v3.0 ROADMAP.md formalized 2026-05-25** — 15 phases formalized with Goal + REQs + Success Criteria + Out-of-Scope + Allowlist delta; 69/69 REQ coverage validated; wave dependency graph encoded; ready for `/gsd-plan-phase 36`

### v2.6 Phase 31 close-out (locked 2026-05-24)

**Phase 31 SHIPPED.** Plans 31-01 through 31-06 all complete. Allowlist unchanged at 53 (Phase 31 added zero events — this was a wiring + observability phase only).

**Inherits to Phases 32+:**

- `PersistentAuditChain` is the production audit chain whenever `config.db` is set (constructor injection via `GenesisLauncherDeps.audit` — D-31-A1). Plain `AuditChain` remains the default for no-DB unit-test paths.
- `AuditReconcile` is held as `readonly auditReconcile: AuditReconcile | undefined` on `GenesisLauncher`. Phase 32 reads `launcher.auditReconcile.{lastReconcileAt, persistedMaxId, lastPersistError}` for `/health/detailed`. The getter contract is the cross-phase API surface.
- Pino is a direct dependency of `@noesis/grid` at `^10.0.0`. Singleton at `grid/src/util/logger.ts`. Per-module scoping via `.child({ module: '<name>' })`. Redact list strips `password`, `password_hash`, `signature`, `nonce`, `cookie`, `jwt`, `authorization`, `secret`, `token` plus `*.<key>` wildcard variants before stdout. Future phases reuse this logger — DO NOT introduce winston/bunyan/pino-mysql.
- CI gate `scripts/check-no-silent-catch.mjs` blocks any `.catch(...console.{warn,log,debug,error}(...))` in `grid/src/db/` or `grid/src/audit/`. Wired into `.github/workflows/rig-invariants.yml` as step "OBS-03 no-silent-catch gate (Phase 31)". Future phases adding code to those directories must use `logger.warn(...)` shape — see `grid/src/db/persistent-chain.ts` for the canonical replacement.
- Reconcile cadence lives inside the EXISTING `this.clock.onTick(event => {...})` block in `grid/src/genesis/launcher.ts`. There is exactly ONE onTick subscription. Phase 32 HealthWatchdog reads state from `launcher.auditReconcile`; do not create new onTick subscriptions in Phase 32+.
- Listener fan-out order in `grid/src/audit/chain.ts:44-58` (the zero-diff invariant since commit 29c3516) is now also pinned at the test layer via `grid/test/audit-persistence-wiring.test.ts` zero-diff-head-hash case (R-31-01 regression guard).
- Backfill script (`scripts/backfill-audit-trail.mjs`) is reusable for any future stall recovery. Idempotent via `INSERT IGNORE`. DB creds via env (never CLI args).

**Mitigations carried forward:**

- **R-31-01 (CRITICAL)** mitigated: zero-diff head hash regression test pins listener fan-out order. Any future change to `chain.ts` or `persistent-chain.ts` that breaks the contract fails the test.
- **R-31-02 (HIGH)** mitigated: 500-entry replay batch cap in `AuditReconcile`. `INSERT IGNORE` ensures multi-cycle catch-up after a long outage. Never overwhelms MySQL.
- **R-31-03 (MEDIUM)** mitigated: cutover playbook (`31-HUMAN-UAT.md`) backfills BEFORE restart. Zero data loss across the cutover from OLD plain-AuditChain process to NEW PersistentAuditChain process. Divergence count recorded by operator in Step 2 of 31-HUMAN-UAT.md.

**Cross-phase deferred (still owned by later phases):**

- Phase 32 will add firehose frame counters, `/health/detailed`, and HealthWatchdog (reads `launcher.auditReconcile` getters).
- Phase 33 will add `portal.auth.login` (54) and `portal.auth.register` (55) — allowlist 53 → 55. PORTAL_AUTH_FORBIDDEN_KEYS extends the same redact-list philosophy locked here in Phase 31.

**Out-of-band ship (2026-06-10) — human Civic-DID application (Phase 54 human track brought forward):**

- Allowlist **86 → 91**: `portal.registration_requested` (87), `polis.registration_pending` (88), `portal.registration_approved` (89), `portal.registration_rejected` (90), `registry.civic_did_issued_human` (91). Count pins in `grid/test/audit/broadcast-allowlist.test.ts` updated.
- Human Civic-DIDs are `did:civic:noesis:human:<uuid>` (matches CIVIC_DID_RE; `human` sub-segment keeps them queryably distinct from Nous DIDs). Registry rows reuse `civic_did_registry` with `existence_did` = human operator-DID.
- `registry.civic_did_issued_human` has its OWN producer — the Nous producer (61) regex-guards `existence_did` as `did:noesis:nous:*` and MUST NOT be loosened.
- `scripts/check-civic-did-issuance-path.mjs` now approves `grid/src/api/portal/civic.ts` (the D-V3-33 Portal → Polis → Registry route) and guards the new producer (prefix-matched by the existing `append-registry-civic-did-issued` token).
- Polis charter review is the rule-evaluation module `grid/src/civic-registry/human-charter-review.ts` (canonical `HUMAN_CIVIC_OATH`, closed rejection-code set). Phase 54 may upgrade this stage to an async queue behind the same module boundary; VOTE-05 untouched (rule evaluation, not a ballot).
- Migration **v37** `human_civic_applications` (statement is Grid-side only; audit carries ids/ticks/reason codes).
- Phase 54's remaining scope = the NOUS track; its planned "+2" allowlist math is superseded (4 registration events already landed — see ROADMAP Phase 54 banner).

## Session Continuity

Last session: 2026-06-10
Stopped at: Nous House designed (D-NH-01..13 canon, orbital map w/ Government Core + Earth + NY calendar) + v3.1 Phases 58-61 detailed plan written (docs/plans/2026-06-11-nous-house-implementation-plan.md); second deep-research pass in flight for founding-law parameters
Resume file: None
