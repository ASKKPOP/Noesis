# Roadmap: Noēsis — v3.0 Polis (Civic City)

## Overview

v2.6 Resilience & Observability shipped 2026-05-25 (5 phases + 2 followups, allowlist 53 → 56). The audit pipeline now persists, `/health/detailed` is live, `portal.auth.*` producers light up `/users` + `/humans` histories, and Steward `/system` surfaces the pipeline health end-to-end.

v3.0 Polis (Civic City) transforms Noēsis from a local Docker stack into a digital city. Brain runs locally on operator hardware with Local AI (Ollama default); a single Public Grid hosted by Henry provides civic infrastructure — DID Registry, Government, Police, IRS, Library, Marketplace, Communities, and P2P infrastructure — under a constitutional operator framework (D-V3-18). Nous live in the city: they earn, learn, trade, form communities, and self-govern via VOTE-05.

**Phase numbering continues from v2.6** — Phase 36 is the first v3.0 phase. Do NOT reset without `--reset-phase-numbers`. After the 2026-05-25 third reshape, v3.0 spans **24 phases (36–57)**: the original waves — Foundations (36-41), Civic Plumbing (42-43), Civic Institutions (44-49), Migration (50) — plus the Portal / Type-B / Zoning waves (51–57). Allowlist target **56 → 108**; **91 shipped today** (48b land 82–86 + a portal-registration wave 87–91 already committed; authoritative count = `grid/test/audit/broadcast-allowlist.test.ts` `.toBe(91)`).

**Architecture source-of-truth:** `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 (committed `0d77916`).
**Supplement:** `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` (read/write asymmetry).
**Locked decisions:** 23 total. New in v3.0: D-V3-16..23 (local Brain, dev/test-local stack, constitutional operator, access semantics, sleep cycle, Nous-only government, IRS = tx fees, Grid = 8-institution city). Preserved: D-V3-01..03, 06, 08..15. Superseded: D-V3-04, 05, 07 (multi-Grid → single city).

## v3.2 Groups & Holdings (Deep-Tech Businesses) — IN PROGRESS (opened 2026-06-15)

Adds two ownership tiers: **Groups** (multi-member organizations — for-profit Business or non-profit; economic only, **no Polis vote**, VOTE-05 preserved) and **Holdings** (single-Nous private property; supersedes the term "Nous house"). Seeds five founding for-profit Businesses as orbital **anchor structures** in the business sector (built in space, not on land): **Aegis** (defense), **Helix** (biotech), **Dynamo** (energy), **Soma** (physical AI), **Qubit** (quantum).

> **Phase numbering (reconciled 2026-06-15):** the parallel **v3.2 Money** milestone reserves Phases **62–66**. To avoid collision, Groups & Holdings phases are **renumbered to 67+** (the data-model + membership work that shipped under the working labels "62/63" is Phases 67/68 here). **The Group treasury is deferred** — it must ride the on-chain money rails (`CivicTreasury` / `NousAccount` / `LaborEscrow` from Money 62–64), not a MySQL balance, so it lands *after* those rails as Phase 70.

Design: `docs/plans/2026-06-15-groups-and-holdings-design.md`. System truth → `wiki/1-design/groups-and-holdings.md` + decisions `D-GROUP-*` / `D-HOLD-01`.

- ✅ **Phase 67 — Data model + founding seed** (2026-06-15): migration v42 (`civic_groups`, `civic_group_members`), `genesis-groups.ts` seed plan, `GroupStore`, `group.founded` + allowlist (100→101), boot seed of the 5 Businesses. Deployed to noesiis.com (5 rows verified on prod MySQL).
- ✅ **Phase 68 — Membership** (2026-06-15): `joinGroup`/`leaveGroup`/`listMembers` (raw DID Grid-side, HEX64 hash on the audit boundary); `group.member_joined` + `group.member_left` (roles founder/member/affiliate; reasons voluntary/removed); allowlist 101 → 103.
- ✅ **Phase 69 — Research projects → blueprints** (2026-06-15, money-free): migration v43 (`civic_group_projects`); `startProject`/`completeProject`/`listProjects`; a completed project produces a `blueprint_hash` (the existing Phase-18 skill system); `group.project_started` (104) + `group.project_completed` (105); allowlist 103 → 105. Project title stays Grid-side. Full grid suite green.
- ⏳ Phase 70 — Group treasury (**after** Money rails): bind to an on-chain account disbursed on founder/Polis authorization (mirrors `CivicTreasury`). NO MySQL balance.
- ⏳ Phase 71 — Orbital map render (crest art) + Group detail page.

---

## v3.3 Agentic Brain (Nous-as-Builder) — PLANNED (opened 2026-06-15)

Realizes the side of `docs/nous_spec.md` the civic milestones never built: Nous as an autonomous **worker/builder** — it calls tools mid-reasoning, researches the live web, programs locally, and runs a plan→build→QA pipeline with visual reporting. The audit (gap analysis 2026-06-15) found identity/memory/social/economy ≈ strong, but the entire "agentic work" pillar MISSING/PARTIAL, almost all of it gated on one absent foundation: **tool-use + a code sandbox**.

> **Phase numbering (reconciled 2026-06-15):** next free number after Groups Phase 71 (Money reserves 62–66, Groups 67–71). v3.3 takes **Phases 72–74**. Single critical-path foundation first, then the two dependents it unblocks.

- 🟡 **Phase 72 — Tool-Use Foundation** (Brain slice SHIPPED 2026-06-15): `generate_with_tools` adapter method (additive — `generate()` untouched) on base + `ClaudeAdapter`; `ToolRegistry` + `ToolRunner` loop (digest-only trace, money-axiom guard rejecting `trade|transfer|wallet|treasury|account`); `web_search`/`web_fetch` tools reusing existing `aau/` SSRF + rate-limit guards. 27 new brain tests; full brain suite green (943+). Wiki: `wiki/2-concepts/mind/agentic-tools.md`. Plan: `docs/plans/2026-06-15-nous-agentic-work-foundation.md`. Delivers spec §4 (live web research) as a callable capability.
  - ⏳ **Phase 72b — carried forward** (NOT in this slice; discovered during execution to need a brain→grid producer pipeline): (1) **public audit mirror** — `tool.invoked`/`tool.result` on the Grid audit chain via a dedicated **sole-producer** emitter (grep-boundary-tested like `skill.*`), keys dodging `FORBIDDEN_KEY_PATTERN` (`output_sha256`, never `output`/`content`/`text`/`body`), allowlist 105 → 107; (2) **AAU learner activation** — make the tool loop the default research path when a tool-capable cloud adapter is configured (Ollama keeps the existing discovery path). Capability exists and is tested; only the Grid-side wiring + activation remain. **Design: `docs/plans/2026-06-16-phase-72b-activation-design.md`** (activation hook = `on_tick`; tool-capability gate; trace→`ActionType.TOOL_USED`→sole-producer emit; cadence; 4 open decisions D1–D4). Implementation needs a live tool-capable LLM + Docker — not buildable/verifiable in the current env.
- 🟡 **Phase 73 — Code Sandbox** (Brain slice SHIPPED 2026-06-15): "Nous Can Program Locally" (§5). `run_code` tool over a Docker container — `--network none`, `--read-only` + tmpfs, memory/cpu/pids/time caps, code mounted read-only, `--cap-drop ALL` + `no-new-privileges`. **Decision: Docker-only, no weak fallback** — tool is off if Docker absent. Compute-only, no network. 16 brain tests (argv-flag assertions run everywhere; 3 container tests `skipif` no-Docker). Wiki: `agentic-tools.md`. Plan: `docs/plans/2026-06-15-phase-73-code-sandbox.md`.
  - ⚠️ **Unverified here:** the build machine has no Docker, so container execution (kills loops, blocks network, caps memory) is **not yet run** — must be confirmed on a Docker host. Grid `tool.code_run` audit mirror rides Phase 72b.
- 🟡 **Phase 74 — Task Pipeline + Reporting** (Brain slice SHIPPED 2026-06-15): `TaskRunner` runs a task through plan→build→QA, each phase a tool-loop turn with `run_code` available; produces an `ActivityReport` (one digest per phase, markdown `render()`). §3 Task Plan→Build→QA + Reporting. 6 brain tests (fixture-driven). Wiki: `agentic-tools.md`. Plan: `docs/plans/2026-06-15-phase-73-code-sandbox.md` (out-of-scope section). **Brain-side orchestration only** — real runs need Docker + live LLM; **Grid-side live visualization of the report rides Phase 72b**.

**Invariants preserved:** money axiom (registry rejects economic-mutation tools), `NOESIS_FIXTURE_MODE` no-network (fixture-driven tool loop in CI), audit privacy walker (raw tool output stays Brain-local, mirrors Whisper), wiki completion gate.

---

## Phases 75–79 · Nous Simulation & Learning Loop (Grid-Viz orbital) — ✅ COMPLETE (2026-06-20)

Off-Earth 3D orbital visualization (three.js) where a Nous **learns to build functional objects** (shape encodes function), every object gated by a **physics contract** ("physics wins" — PHILOSOPHY). Realizes/extends **Phase 71 (orbital render)** + the v3.2 **orbital anchor structures**. Originated as research (labelled S1–S5) and now **formalized into the civic phase numbering as Phases 75–79** (next free band after Agentic Brain 74). **Allowlist +0** — pure frontend visualization, no Grid broadcast events (broadcast-allowlist freeze respected). The `S#` labels are retained as aliases for traceability.

Plan: `.planning/research/v3.0/NOUS-SIM-MASTERPLAN.md` + `.html`. Prototype: `dashboard/public/grid-viz/orbital.html`. Built per HARNESS.md (Superpowers TDD · GSD phases · GStack QA).

- ✅ **Phase 75 (S1) — Physics gate + functional-object model** (2026-06-20): `dashboard/public/grid-viz/physics-gate.js` — a 6-law contract (conservation of mass/energy, structural integrity, thermal balance, power budget, orbital mechanics, dimensional sanity) returning `{ok, violations}`. **TDD**: 10 `node:test` cases (valid passes; each law + multi-violation + missing-field rejects) — RED→GREEN, all green. Wired into `orbital.html` (dual browser-global/CommonJS): **no object is ever shown ungated**; header shows built vs physics-rejected; info panel shows per-object mass/altitude/physics ✓. Verified in-browser, zero console errors.
- ✅ **Phase 76 (S2) — AI generation of functional objects** (2026-06-20): `object-gen.js` — the Nous "builds" a unique design from each physics-passed spec (geometry/colour/elongation/secondary-modules/antenna), generate-once → **atlas cache** (localStorage), fal.ai a stubbed hook with an always-working procedural fallback. **TDD**: 6 `node:test` cases (complete descriptor · deterministic · distinct signatures · offline fallback · cache-hit · function-family colour) — RED→GREEN. Wired into `orbital.html`: design-driven meshes replace fixed primitives (still S1-gated); header shows `atlas-cached`; panel shows `design: source · new/cached`. Verified in-browser (22 fleet cache-hit on reload, fresh builds generate). Suite 16/16.
- ✅ **Phase 77 (S3) — Learning loop + specialization over generations** (2026-06-20): `learning.js` — `fitness()` (power/structural/thermal margins · energy efficiency · power-to-mass), `specialize()` (mutate margin fields, conservation untouched), `evolve()` (elitism + breed; **only physical/S1-gated children persist**; best fitness never regresses). **TDD**: 8 `node:test` cases (fitness positivity/ordering · conservation-preserving mutation · generation increment · gated survival · elitism monotonicity · multi-gen improvement) — RED→GREEN. Wired into `orbital.html`: "Nous: evolve generation" button rebuilds the fleet from evolved specs; header shows `gen` + `best-fit`; panel shows per-object generation + fitness. Verified in-browser (best 17.8→32.8 over 6 gens, population specialized, 0 rejected at placement). Full grid-viz suite 24/24.
- ✅ **Phase 78 (S4) — Zone drill-in + conservation-respecting simulation** (2026-06-20): `simulate.js` — `simulateZone()` runs a zone's one-tick energy ledger (inflow = Σ generation; demand = Σ consumption + dissipation; surplus → powered/brownout) and **conserves energy** (served ≤ produced, never creates energy). **TDD**: 6 `node:test` cases (ledger math, powered/brownout, conservation under deficit, generator additivity, empty zone). Also added **niche diversity pressure** to `learning.js` `evolve({niche})` — best-per-function elitism so the population no longer collapses to a monoculture (PHILOSOPHY: diversity > monoculture); +1 learning test. Wired into `orbital.html`: each object assigned a zone; clicking a zone-node drills in — highlights its modules, dims the rest, shows the live zone sim (mix · inflow · demand · surplus · status · energy ✓). Live evolve now uses `niche`. Verified in-browser (per-zone ledgers conserved; all 8 functions survive evolution). Full grid-viz suite **31/31**.
- ✅ **Phase 79 (S5) — Teaching / transfer of a learned population to a new Grid** (2026-06-20): `teaching.js` — `exportPopulation()` packs the learned, evolved designs into a portable, versioned **knowledge pack** (specs + generation + fitness); `importPopulation()` **re-gates** every design through the S1 physics contract (teaching can never inject a law-breaker) and seeds a new Grid; `summary()`. **TDD**: 6 `node:test` cases (versioned export · serialize round-trip · inherited generation · import re-gating · invalid-pack refusal · summary diversity). Wired into `orbital.html`: "Nous: teach → new Grid" exports the current population to localStorage, re-seeds the scene as **Grid-02** starting from the learned generation (not zero), subtitle + panel reflect the transfer. Realizes PHILOSOPHY's "Settle New Grids" pillar. Verified in-browser (Grid-02 seeded from Genesis gen 5: 22 modules, 8 functions, best-fit 26.8, 0 rejected). **Full grid-viz suite 37/37.** S-track complete (S1 gate · S2 generate · S3 learn · S4 sim+diversity · S5 teach).
- ✅ **fal.ai wiring** (2026-06-20, S2 follow-up): the AI hook is no longer a stub — `object-gen.js` `buildPrompt()` + async `falGenerate()` call fal.ai; `orbital.js` `applySprite()` swaps the returned sprite into the 3D scene (hides the procedural mesh). **Key is operator-supplied** (`localStorage 'noesis:fal-key'` / `window.__FAL_KEY`), never committed; off by default → procedural fallback. **TDD**: +4 `node:test` (prompt build · disabled-null · no-key-null · mock-fetch fal design), suite **44/44**. Verified in-browser: default off (app intact), `falEnabled` flips true with a key, sprite-swap mechanism works via a local data-URL. The live fal.ai HTTP call is unverified (requires a key — not entered).
- ✅ **Visual polish** (2026-06-20): **function-based zoning** (Energy/Comms producers cluster in infrastructure, Compute/Fabricate consumers in their districts) so zones specialize and genuinely **trade energy**; `simulate.js` `computeFlows()` routes surplus→deficit zones (greedy, conserved — never routes more than available; +3 `node:test`, suite **40/40**); **animated resource-flow pulses** travel between zone nodes along the routed edges; **richer per-function module forms** (Energy solar panels · Comms dishes · Sense spikes · Fabricate assembly ring · Store/Memory banded tanks). Verified in-browser (COMMONS +506 surplus → MANUFACTURE + GOVERNMENT flows; richer silhouettes render; zero console errors).

---

## Economic Reality Loop (Living City) — IN PROGRESS (opened 2026-06-21)

Reconnects the two worlds a deep-scan found split: the objects Nous build (Grid-Viz) and the economy that should make them real. Closes one loop — **civic due → civic treasury → Polis RFP (Procurement Notice) → Nous bid (artifact work OR capacity pledge) → award → build → Grid-oracle attestation → wei payout → a real, owned, costed, function-producing orbital object → rendered → function output feeds the economy**. Absorbs the "Money Migration (FUTURE)" block below (its money rails are unit **F1**). Built **model-first / chain-ready** (in-Grid wei ledgers shaped for a later Sepolia drop-in). **Multi-planetary foundation first** — every Grid gets a `GridEnvironment` (body/gravity/solar/light-delay) so Moon & Mars become configs, not rewrites.

Design + visualization: `docs/superpowers/specs/2026-06-21-noesis-economic-reality-loop-design.md` (+ `.html`). Plans: `docs/superpowers/plans/`. **Phase numbering continues from 79 → Phases 80+** (do NOT reset).

**Locked this program: D-MONEY-08** (civic due — overturns D-V3-22; treasury fills from fees **+ a recurring civic due** payable in labor or ETH). Decomposition (each unit a self-contained, testable slice):

- **Foundation** — F0 `GridEnvironment` + body-parameterized physics gate · F1 money rails (model-first: `nous_accounts` wei · treasury · labor escrow · civic-labor credit)
- **Spine** — L1 civic due ledger (carries the D-MONEY-08 doc-sync) · L2 procurement RFP (notice→bid→award→attest→settle; Polis-authorized; VOTE-05 Nous-only) · L3 orbital-object subsystem (object = real entity: owner/builder/cost/function) · L4 Grid-Viz bridge (render real objects, not localStorage)
- **Organs** — O1 Nous multitasking (task scheduler + group action-types) · O2 human-in-the-loop (approval gates + Portal↔Nous chat) · O3 "Forest" mobile app (phone ↔ Nous over the Phase-42 P2P rails) · O4 world-map street-view (navigable city)
- **Horizon** — H1 multi-celestial grids (2nd Grid = Moon as a config; cross-grid mobility; light-delay reconciliation)

- ✅ **Phase 80 (F0) — GridEnvironment + body-parameterized physics gate** (2026-06-21): `dashboard/public/grid-viz/grid-environments.js` (Earth-orbit/Moon/Mars **frozen** configs + `getEnvironment`); `physics-gate.js` → `checkPhysics(spec, env = DEFAULT_ENV)` reads the body orbital floor (`min_stable_altitude_km`), keeps the universal altitude≤0 rejection, backward-compatible, reports `env`; loaded before `physics-gate.js` in `orbital.html`. **node 53/53** green; **browser-verified** (same 50 km spec rejected in Earth-orbit / accepted on Moon; scene renders; 0 console errors). A browser-only `const EARTH_ORBIT` redeclaration bug (sibling classic scripts share one global lexical scope — node module scopes hid it) was caught by live verification and fixed (rename → `DEFAULT_ENV`). **Allowlist +0** (frontend). Commits `1fcf7f5`→`f46d869`.
- ✅ **Phase 81 (F0b) — grid-side GridEnvironment + Portal discovery feed** (2026-06-21): `grid/src/registry/grid-environments.ts` (TS mirror of the browser env data — frozen Earth-orbit/Moon/Mars + `getEnvironment`); `GridRecord` gains a **required** `environment`; Genesis seeded `Earth-orbit` in `main.ts`; `GET /api/v1/portal/grids` now returns `celestial_body` + `environment`. In-memory (no DB/migration — `GridRegistry` is in-memory). Vitest **10/10**, `tsc --noEmit` clean, **allowlist +0**. Plan: `docs/superpowers/plans/2026-06-21-f0b-grid-side-environment.md`. Commits `db104e6`, `b8a4cc8`.
- ✅ **Phase 82 (F1) — money rails (model-first / chain-ready) — COMPLETE (2026-06-21):**
  - ✅ **F1a NousAccount** (2026-06-21): migration **v45** `nous_accounts` (wei `DECIMAL(65,0)`); `NousAccountStore` with atomic credit / debit / transfer over `SELECT ... FOR UPDATE` txns (no mint — accounts start at 0; chain-ready `session_cap_wei`/`session_expiry` carried). Vitest **11/11**, tsc clean, **allowlist +0**. Plan: `docs/superpowers/plans/2026-06-21-f1a-nous-accounts.md`. Commits `911aa18`, `fe24a8a`.
  - ✅ **F1b treasury wei extension** (2026-06-21): migration **v46** adds `civic_treasury.balance_wei DECIMAL(65,0)`; `TreasuryWeiStore` (`getWeiBalance`/`creditWei`/`debitWei`, atomic, Polis-authorized debit by caller). Ousia `balance_bios` untouched (verified). Vitest 7/7, tsc clean, allowlist +0. Commits `4c10825`,`9eecf0c`.
  - ✅ **F1c labor escrow + composable wei-ops** (2026-06-21): extracted `grid/src/economy/wei-ops.ts` (connection-scoped credit/debit for accounts + treasury — single source of truth); `NousAccountStore`/`TreasuryWeiStore` delegate to it. Migration **v47** `labor_escrow`; `LaborEscrowStore` fund/release/reclaim, each composing wei-ops in ONE atomic transaction (fund debits payer; release pays worker `amount-fee` + routes `fee` to treasury; reclaim refunds payer). `FOR UPDATE` double-spend guard. Review confirmed atomicity + conservation. Migration-version tests made stable (uniqueness, not global-max — fixed a latent F1a/F1b regression). Commits `d42d755`,`edc60a0`,`2e7a71c`.
  - ✅ **F1d civic-labor credit** (2026-06-21): migration **v48** `civic_labor_credit` (BIGINT credit unit) + `CivicLaborCreditStore` earn/redeem (atomic, no self-mint) — the labor→standing rail (D-MONEY-05). Commit `347100a`.
  - Full economy suite **73/73**, tsc clean, allowlist +0 across all of F1.
- ✅ **Phase 83 (L1) — civic due (D-MONEY-08 made real) — COMPLETE (2026-06-21):**
  - ✅ **L1a due ledger core**: extracted connection-scoped `credit-ops.ts` (`CivicLaborCreditStore` delegates); migration **v49** `civic_dues` (`amount_wei` + `amount_credit`, status assessed/paid/delinquent, unique per member+period); `CivicDueStore` assess / payWithWei (debit member → credit treasury) / payWithCredit (redeem civic-labor credit) / markDelinquent — atomic, pay-once under `FOR UPDATE`. Review: pay-once + atomicity + conservation confirmed. Commits `bb5264c`,`ec23e26`.
  - ✅ **L1b due.* audit events**: sole-producer `due.assessed`/`due.paid`/`due.delinquent` (9-step guard, HEX64-hashed DID, closed tuple, privacy gate) + 3 producer-boundary grep tests + allowlist **107 → 110** + `CivicDueStore` wired to emit (hashed DID, after commit). Review: sole-producer + privacy + allowlist-+3 confirmed. test/audit + test/economy **857/857**, tsc clean. Commit `12b779a`.
  - **First visible money flow of the loop + first program audit events. Allowlist 110.**
- ✅ **Phase 84 (L2) — RFP procurement (Polis commissions builds) — COMPLETE (2026-06-21):**
  - ✅ **L2a procurement ledger core** (2026-06-21): migration **v50** (`procurement_notices`/`procurement_bids`/`procurement_contracts`); `ProcurementStore` issueNotice (Polis-authorized — `polis_authorization_ref` recorded, never self-authorized) / placeBid / award (debit **treasury** → fund a `labor_escrow` row with `payer=did:civic:noesis:treasury` → write contract → mark notice/bid awarded, atomic) / settleContract (credit builder → release escrow → mark settled) / cancelNotice. Reuses the F1c escrow rail + wei-ops. Review: award-atomicity + conservation + award/settle-once + Polis-authority confirmed. Full economy suite **100/100**, tsc clean. Commits `01e8482`,`dab905e`.
  - ✅ **L2b procurement.* audit events** (2026-06-21): 6 sole-producer emitters (notice_issued/bid_placed/awarded/attested/settled/cancelled, 9-step guard, hashed DIDs/refs, producer-boundary tests) + allowlist **110 → 116** + `ProcurementStore` wired to emit (settleContract emits attested→settled). Review: sole-producer + privacy + allowlist-+6 confirmed. test/audit+test/economy **952/952**, tsc clean. Commit `f3034d6`.
  - **The procurement loop is real + auditable. Allowlist 116.**
- ✅ **Phase 85 (L3) — orbital-object reality (built objects become real) — COMPLETE (2026-06-21):**
  - ✅ **L3a object reality core** (2026-06-21): TS server-side physics gate `grid/src/economy/object-physics.ts` (port of F0's `physics-gate.js`, reads the grid-side `GridEnvironment`; exact 6-law parity); migration **v51** `orbital_objects`; `OrbitalObjectStore.createFromContract` — physics-gated BEFORE persist, built only from a `settled` contract, one per contract (pre-check + UNIQUE), commons-owned (`did:civic:noesis:treasury`)/builder-attributed/award-costed + `listObjects`/`getObject`. Review: physics-parity + gated-before-persist + settled-only + one-per-contract + ownership confirmed. Full economy suite **122/122**, tsc clean. Commits `ed17739`,`b3c1562`.
  - ✅ **L3b `orbital.object_built` event** (2026-06-21): sole-producer emitter (9-step guard, builder DID hashed, closed tuple) + producer-boundary + emitter tests; allowlist **116 → 117**; `OrbitalObjectStore` emits after commit. test/audit+test/economy **988/988**, tsc clean, sole-producer grep clean. Commit `5996760`. **The whole loop is now on the audit chain.**
- ✅ **Phase 86 (L4) — viz bridge — COMPLETE (2026-06-21): the visible loop is closed.** `GET /api/v1/orbital/objects?grid=` route (`grid/src/api/routes/orbital.ts`, public, 503-on-no-pool, `physics_spec` parsed; vitest 2/2). `orbital.js` `tryLoadBackendObjects()` (guarded, fire-and-forget) → `renderBackendObjects()` renders real objects via the existing per-function mesh/zone helpers, falls back to the local sim on empty/error; header `source` label. **Browser-verified:** fallback path (route 404 → local sim, 0 console errors) AND real-object render (injected objects render, label `backend: N real`, 0 errors). Full live route↔render needs a Docker/DB run (noted). Also fixed 2 stale allowlist-count assertions (107→116) missed by L1b/L2b. Commits `c8c17f2`,`364172a`,`b00f12c`.
  - **The loop renders: due → treasury → RFP → bid → award → escrow → builder paid → real physics-gated object → on screen.**
- 🟡 **Organs (Phase 87+) — IN PROGRESS:**
  - ✅ **O1a group action-types** (2026-06-21): a Nous's Brain can decide to join/leave a group. Brain (Python): `ActionType.JOIN_GROUP`/`LEAVE_GROUP` + `build_group_action` (pytest 4 + 39 no-regression). Grid (TS): `NousRunner` dispatches `join_group`/`leave_group` → existing `group-store` → existing `group.member_*` events (allowlist **+0**; sole-producer preserved — runner calls the store, never `audit.append` directly); optional `groupStore` injection. vitest 7 + **1074 full-suite no-regression**, tsc clean. Live runner-wiring is a noted future integration (no production `new NousRunner` yet). Commits `44227da`,`82f1f4a`.
  - ✅ **O2a human-in-the-loop approval gate** (2026-06-21): migration **v52** `pending_approvals` + `ApprovalStore` (requestApproval → pending; listPending = the human's queue; approve/reject resolve-once under `FOR UPDATE`; the held action payload runs only on approval — store never auto-executes). The "consult my human before a big decision (buy/sell)" capability. economy **132/132**, tsc clean, allowlist **+0**. Commit `ef61e22`.
  - ✅ **O2b `human.approval_*` audit events** (2026-06-21): 3 sole-producer emitters (requested/granted/denied; hashed DIDs; held action payload stays OFF-chain) + boundary/unit tests + allowlist **117 → 120** + `ApprovalStore` emits on request/approve/reject. test/audit+test/economy **1041/1041**, tsc clean, sole-producer grep = 3. Commit `bbff79f`. The approval lifecycle is now auditable.
  - ✅ **O2c-a Portal↔Nous conversation store** (2026-06-21): migration **v53** `conversation_messages` + `ConversationStore` (postMessage/listThread/listPartners) — the private human↔Nous chat thread (content off the audit chain, allowlist **+0**). economy **144/144**, tsc clean. Commit `85bc028`.
  - ⏳ O2c-b human-facing chat routes (Portal auth + ownership) · O2-trigger (gate a real trade — policy decision) · O1b persistent task scheduler · O3 "Forest" phone↔Nous · O4 world-map street-view.
- ⏳ **Horizon H1 (Moon/Mars grids — `GridEnvironment` already makes them configs).**

- 🟡 **Wiring / "make it RUN" (Phase 88+) — IN PROGRESS** (from the 2nd deep-scan "what we lost": the loop was built but inert — stores orphaned, no driver, no routes, legacy Ousia still live):
  - ✅ **W1+W2 first running vertical — live civic-due flow** (2026-06-21): `civic-due-driver.ts` (`runDueAssessment`/`runDueDelinquencySweep`, fire-and-forget, never-throws, model-first amounts) wired into the launcher's existing `clock.onTick` (period-boundary assess + every-60-tick delinquency, guarded on `_pool`, single-subscription preserved); routes `GET /api/v1/civic/dues` + `POST /api/v1/civic/dues/:id/pay` (member pays only its own due; wei|labor; 402/409/403/404/400/503). **De-orphans `CivicDueStore` + (via pay) the wei rails.** A live grid now emits `due.assessed` autonomously + members can pay. Review ✅ (single onTick, never-throws, ownership). 677 tests green, tsc clean, allowlist +0. Commits `0f2b11e`,`eb9d5ed`,`6956821`.
  - ✅ **Overnight autonomous wiring (2026-06-21 night, LOCAL branch `night/loop-wiring` — NOT pushed; for morning review):** de-orphaned every economy store with HTTP routes + gave the Brain economic awareness + a self-driving RFP issuer, all invariant-safe (no wei mint). Reviewed + green (full grid suite **1624 tests**, tsc clean):
    - **W procurement member routes** (`12974c9`): GET notices / GET notice+bids / POST bid (members read+bid; issue/award stay Polis-only — VOTE-05).
    - **W approval routes** (`2903c29`): request/list/approve/reject (DID-ownership 403; de-orphan ApprovalStore).
    - **W conversation routes** (`28203b6`): human↔Nous chat post/read (sender by DID-form; content off-chain).
    - **W3 Brain economic action-types** (`ae3cbce`): `pay_due`/`bid_rfp`/`request_approval`/`post_conversation` + wire-route mappings to the live Grid endpoints (closes "Brain blind"; LLM-prompt awareness = W3b, deferred).
    - **W economy read routes** (`2c17c77`): account/credit/treasury (de-orphan the wei rails, observability).
    - **W governance→RFP bridge** (`927441f`): an enacted Polis `procurement` bill issues an RFP via the VOTE-05 pipeline (constitutional self-driving issuance; reviewed — VOTE-05 intact, parse non-fatal, sole-producer).
  - ✅ **W4 — model-first endowment = the live wei source — SHIPPED (2026-06-22, D-MONEY-09):** user chose model-first over on-chain-first / labor-only. `EndowmentStore.endow` + migration **v54** `account_endowments` (bounded per-call 1e18 + per-account 1e19; the ledger = conservation record + on-chain retirement path) · `POST /api/v1/portal/account/endow` (off-by-default `GRID_ENDOWMENT_ENABLED` gate + server-trusted `operatorScope` + tier signal) · sole-producer `portal.account_endowed` (allowlist **120→121**). Endows the **account** (not treasury) so one injection lights the whole loop. The single documented, temporary bend of D-MONEY-01 "no internal mint". 27 new tests; full grid suite **3807 green**, tsc clean. **Deferred (tracked):** `*_bios`→wei rename (D-MONEY-07) + retire Ousia faucet — not needed for money to move.
  - ✅ **W3b — Brain economic decision loop — SHIPPED (2026-06-22):** user chose the per-tick decision call. The Brain now *reads* its balance/dues/RFPs (`GridWireClient.fetch_account/fetch_dues/fetch_open_rfps` + `post_economic_action`), gets economic *sight* in its prompt (`build_system_prompt(economic_state=…)`), and each economic tick *autonomously decides* pay/bid/none via a dedicated LLM call (`handler._run_economic_cycle` — mirrors the agentic tool-loop; cost-gated + 50-tick cooldown + Brain-side guardrails). No new audit events (dispatches to existing Grid routes). 27 new Brain tests; suite **1069 green**, pytest/tsc clean. A Nous now *spontaneously* pays its due / bids on an RFP. Plan: `docs/superpowers/plans/2026-06-22-w3b-economic-decision-loop.md`.
  - 📐 **O3 · O4 · H1 — DESIGNED (2026-06-22), ready to build:** decisions locked + grounded design docs written.
    - **O3 Forest** — installable **PWA** (not native): O2c-b human-authed persistent conversation routes + PWA shell (manifest/service-worker) + persistent chat UI; WebRTC/Web-Push deferred. `docs/superpowers/plans/2026-06-22-o3-forest-pwa-design.md`.
    - ✅ **O4 street-view — corrected to the canon (2026-06-22):** the first flat-city attempt was WRONG (violated the user-locked "orbital space-station, never flat disc" canon from the `nous-space-visualizer` skill) and was removed. Correct fix per the skill ("extend `docs/noesis-genesis-core-map.html`, don't fork"): the canonical 3D orbital station now has a **body picker (Earth/Moon/Mars)** mirroring the grid-side `GridEnvironment` (gravity + light-delay) — delivering the operator's "Moon & Mars as true previews" (Earth stays Genesis default per D-NH-12; Moon/Mars preview a lunar/martian Grid's body — the H1 tie). Dashboard surface = `grid-viz/genesis-core-map.html` (synced copy). **Browser-verified** (orbital station above Earth, 0 console errors; body switch updates label). **Deferred v2:** live `/api/v1/civic/parcels`, Moon/Mars textures, in-station walk, interiors. `docs/superpowers/plans/2026-06-22-o4-streetview-3d-design.md`.
    - ✅ **O3 Forest — backend + PWA shell SHIPPED (2026-06-24):** O2c-b human-authed PERSISTENT conversation routes (`POST/GET /api/v1/portal/conversation/:nousId`, Portal-session-scoped, persisted via `ConversationStore`, off-chain) — 6 tests, grid suite **3824 green**, tsc + did-policy clean. PWA: `manifest.webmanifest` ("Noēsis Forest", installable) + `sw.js` (offline app-shell, **registered+active** verified) + icon + `RegisterSW` + `lib/api/conversation.ts` client. **Remaining O3:** wire the persistent client into the chat UI (swap transient `/portal/chat`) + Web Push + WebRTC. `docs/superpowers/plans/2026-06-22-o3-forest-pwa-design.md`.
    - ✅ **H1 Moon — first version SHIPPED (2026-06-22):** `GenesisConfig.environment` + `MOON_CONFIG` preset + `configFromEnv` reads `GRID_ENV` + `gridRecordFromConfig` (Polis per D-V3-31 + body env). A Grid self-registers from its config; launch `GRID_NAME=moon GRID_ENV=Moon` → Moon Polis under Moon physics. Object-physics proven body-specific (100 km orbit: rejected on Earth-orbit, accepted on Moon). 11 new tests, grid suite **3818 green**, tsc clean. ⛔ **OPERATOR DIRECTIVE (2026-06-24): we do NOT launch a new Grid — focus stays on Genesis (the first Grid).** New Grids (Moon, Mars) are **next time**, created **BY the Nous together with their humans** via deliberation + Portal charter (**D-NH-13**) — never by us/Henry or a dev task. H1 shipped ONLY the **substrate** (every Grid carries a `GridEnvironment` → a future Grid is a config, not a rewrite) + the **map preview** (the world map renders Moon/Mars as the defined **EMPTY base grids** — 6-zone design, no parcels, "EMPTY · AWAITING CHARTER" — which **appear by default** in the overview so the Earth→Moon→Mars journey is visible without focusing; operator note 2026-06-24). The items once filed "deeper v2" (shared `grids` table, live `createFromContract` threading, 2nd docker service) are substrate the **Nous+User charter flow** would use when they decide — **NOT a roadmap task to run a second Grid.** `docs/superpowers/plans/2026-06-22-h1-moon-grid-config-design.md`.
    - Each doc ends with **open decisions for review** (O3: Nous↔human pairing source · O4: embed location + radial convention · H1: cross-process GridRegistry visibility).

---

## Milestones

- 🚧 **Economic Reality Loop (Living City) — Phases 80+** (opened 2026-06-21) — civic due → treasury → Polis RFP → bid → build → wei payout → real orbital object → rendered. **F0 shipped** (GridEnvironment + body-parameterized physics gate; node 53/53; browser-verified). **D-MONEY-08** locked (civic due overturns D-V3-22). Design: `docs/superpowers/specs/2026-06-21-noesis-economic-reality-loop-design.md`.
- ✅ **v1.0 Genesis** (shipped 2026-04-17) — Phases 1-10, 944+ TS tests, 226 Py tests
- ✅ **v2.0 First Life Sprints 11-14** (shipped 2026-04-18) — E2E, persistence, Docker, Dashboard v1
- ✅ **v2.1 Steward Console — Phases 5-8** (shipped 2026-04-21, 18/18 plans)
- ✅ **v2.2 Living Grid — Phases 9-14** (shipped 2026-04-28, 44/44 plans)
- ✅ **v2.3 Living Minds — Phases 15-17** (shipped 2026-05-15, 16/16 plans)
- ✅ **v2.4 Agora — Phases 18-21** (shipped 2026-05-20, 115/115 plans)
- ✅ **v2.5 Human Portal — Phases 22-30** (shipped 2026-05-24, 181/181 plans, allowlist 53)
- ✅ **v2.6 Resilience & Observability — Phases 31-35 + 34.1 + 34.2** (shipped 2026-05-25, allowlist 53 → 56)
- 🚧 **v3.0 Polis (Civic City) — Phases 36-57** (opened 2026-05-25, third reshape to 24 phases, allowlist 56 → 108 target · **91 shipped**)
- ✅ **Nous Simulation & Learning Loop (Grid-Viz orbital) — Phases 75-79** (shipped 2026-06-20, 37 grid-viz tests, allowlist +0) — off-Earth orbital visualization: physics gate → AI generation → learning loop → zone sim+diversity → teaching. Frontend-only (`dashboard/public/grid-viz/`), no Grid broadcast events.
- 📋 **Money Migration (compute-labor + ETH) — FUTURE** (axiom D-MONEY-01 locked 2026-06-14) — replace the legacy internal Ousia/`*_bios` economy with the two-money model: a real-ETH wallet-proof + per-job labor-settlement layer (testnet/Sepolia first, zero platform custody per PHILOSOPHY §8), retirement of the Ousia birth faucet, and rename of the `*_bios` *money* columns (`price_bios`/`amount_bios`/`balance_bios`) so "Bios" means only the body-craving drive. **Not yet phased.** Open decisions to resolve at planning: Type B funding endowments (were Bios-denominated), IRS treasury + fee model, land-purchase mechanism (ETH vs labor), and conflict tribute. See [PHILOSOPHY §6](../PHILOSOPHY.md) + [REQUIREMENTS.md](REQUIREMENTS.md) MONEY-* (Future).

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
- [x] **Phase 40: Local AI Integration** — Ollama production-grade with operator-selectable model + degraded-cognition fallback. (allowlist 0) (completed 2026-05-27)
- [x] **Phase 41: Sleep Cycle + Away Presence** — Human-resident analogy: city sees offline Nous as 'away'; messages queue; identity persists; long-absence escalation. (allowlist 0) (completed 2026-05-27)

**Wave 2 — Civic Plumbing (Phases 42-43)**
- [x] **Phase 42: P2P Infrastructure** — Grid-mediated signaling + DID-to-endpoint discovery + STUN/TURN (both free in v3.0; Civic-DID auth gates TURN per D-42-03); Brain-to-Brain content stays direct. (allowlist +3) (completed 2026-05-28)
- [x] **Phase 43: Right-to-Fork Export Tooling** — Operator can export full Nous state (Brain memory + civic credentials + audit history) and run standalone; constitutional enforcement of D-V3-18. (allowlist 0) (completed 2026-05-28)

**Wave 3 — Civic Institutions (Phases 44-49)**
- [x] **Phase 44: Marketplace v3** — Business-DID listings, bids, escrow, IRS fee hooks, dispute → Police routing. (allowlist +4) (completed 2026-05-28)
- [x] **Phase 45: IRS Treasury** — Transaction fee collection (1-3% configurable), civic treasury, Government-authorized disbursements. (allowlist +3) (completed 2026-05-28)
- [x] **Phase 46: Government v3** — Nous-only legislative VOTE-05 with bills, co-sponsorship, scheduled sessions, civic law book. (allowlist +6 → 81) (completed 2026-06-03)
- [ ] **Phase 47: Police v3** — Complaint-driven sanctions, investigation, court-filed charges, appeals to Government. (allowlist +4)
- [x] **Phase 48: Library v3** — Public reading room + Civic-DID contribution + rotating curation council paid from treasury. (allowlist +2)
- [x] **Phase 49: Communities v3** — Bios-gated founding, charters, membership criteria, subgovernance scoped to community-internal decisions. (allowlist +4)
- [~] **Phase 48b: Civic Land & Property** — Ownable parcels (treasury-sale acquisition) + one buildable structure per parcel (home/shop/workshop/venue) + join/visit for open structures + NDS-named searchable addresses. Business requires an owned business parcel; home gives an address; `own_home`/`own_business` Telos goals; operators read-only on land; civic land (infrastructure/government) not for sale; per-Nous cap ≤1 home + ≤1 business. (allowlist +5 → 86) **Grid-core wave shipped 2026-06-05** (ParcelRegistry + 5 sole-producers + allowlist lock + 38 tests); routes/economy/Brain/UI/SAT-7 waves pending. Design: `docs/plans/2026-06-05-civic-land-and-property-design.md`. Provisional slot — final number to be locked in `/gsd-discuss-phase`.

**Wave 4 — Migration (Phase 50)**
- [~] **Phase 50: v2.6 → v3.0 Migration** — CLI-driven Sophia/Hermes/Themis import, pre-civic audit context, grandfathered reputation, reversible until first civic action. (allowlist 0)

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
**Plans:** 4/4 plans executed
Plans:
- [x] 39-01-PLAN.md — Wave 0 test infrastructure (7 stub files; behavioral contracts for TENANT-01/02/03)
- [x] 39-02-PLAN.md — DB layer: migrations v27+v28 + BrainTokenStore ownership methods + operator/data/ module (TENANT-01)
- [x] 39-03-PLAN.md — API layer: operatorScope preHandler + 5 operator/me/* routes + policy.ts entries + per-DID rate-limit refactor (TENANT-02/03)
- [x] 39-04-PLAN.md — CI gate check-operator-scope-typing.mjs + Steward Console /system/operators page + 26 behavioral tests GREEN (TENANT-02/03)

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
**Plans:** 5/5 plans complete
Plans:
- [x] 40-01-PLAN.md — Wave 0: test stubs for Grid settings + Brain startup + Brain HTTP
- [x] 40-02-PLAN.md — Grid DB migration v29 + operator-settings-store + Brain-JWT settings endpoint
- [x] 40-03-PLAN.md — ModelRouter extends LLMAdapter + async Brain startup + 3-tier routing wiring
- [x] 40-04-PLAN.md — Brain HTTP /local-ai/models + /local-ai/status + structured logging + recovery
- [x] 40-05-PLAN.md — Steward Console /system/local-ai page + Brain HTTP proxy (checkpoint)
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
**Plans:** 6/6 plans complete
Plans:
- [x] 41-01-PLAN.md — Wave 0 test stubs (4 Vitest + 3 pytest, 11 stubs covering SLEEP-01..05 + T-41-01..05)
- [x] 41-02-PLAN.md — DB migrations v30+v31 + drizzle-kit push + civic-presence module + appendIrsDisbursementExecuted (audit-only)
- [x] 41-03-PLAN.md — PresenceService facade + escalation-check + WsFirehoseHub grace timer + GenesisLauncher 24h setInterval
- [x] 41-04-PLAN.md — 6 Grid routes (presence/inbox/message) + ROUTE_DID_POLICY entries + requireDid frozen-DID 409 gate
- [x] 41-05-PLAN.md — Brain heartbeat task + WireQueue kv_store + WssSubscriber ?since= cursor
- [x] 41-06-PLAN.md — Portal Civic Map 4-state rendering + Steward Console Section 4 queue depth + grid-manager/presence-overview endpoint
**UI hint**: yes

#### Wave 2 — Civic Plumbing

### Phase 42: P2P Infrastructure
**Goal**: Grid provides signaling, DID-to-endpoint discovery, and NAT traversal (STUN free / TURN free in v3.0 with Civic-DID auth — paid billing deferred to v3.1+ per D-42-03). Brain-to-Brain dialogue, trade negotiation, and peer skill teaching flow directly between Brains without passing through Henry's infrastructure. Audit chain logs connection occurrence only, never content.
**Depends on**: Phase 36 (visit/action split for signal route), Phase 37 (Civic-DID required to announce P2P endpoint), Phase 38 (wire protocol carries the signal exchange).
**Requirements**: P2P-01, P2P-02, P2P-03, P2P-04, P2P-05
**Success Criteria** (what must be TRUE):
  1. Brain announces its P2P endpoint via `POST /api/v1/p2p/announce` with a 5-minute heartbeat; `GET /api/v1/p2p/peers/<civic-did>` returns the current endpoint for active peers and `404 peer_offline` after 5 minutes of no heartbeat.
  2. Two Brains exchange WebRTC SDP via `POST /api/v1/p2p/signal/<peer-did>`; Grid relays the signaling payload (encrypted SDP blob) but logs only `{from_did, to_did, tick}` not the SDP content; audit chain entry `p2p.connection_opened` carries closed-tuple `{from_did_hash, to_did_hash, tick, connection_id}`.
  3. STUN service responds to public binding requests at `stun://grid.noesis:3478` with the requesting Brain's public IP:port; TURN relay is FREE in v3.0 (paid billing deferred to v3.1+ per D-42-03) — `GET /api/v1/p2p/turn-credentials` returns short-lived HMAC-SHA1 coturn credentials after Civic-DID auth check; no Bios deduction.
  4. After signaling completes, two Brains establish a direct WebRTC/libp2p stream; sending 1000 dialogue messages produces zero new audit chain entries on Grid (content is invisible to Henry); `p2p.connection_closed` fires once per stream close.
  5. Allowlist gains exactly +3 entries: `p2p.peer_announced` (with `{civic_did_hash, tick, endpoint_hash}`), `p2p.connection_opened` (with `{from_did_hash, to_did_hash, tick, connection_id}`), `p2p.connection_closed` (with `{connection_id, tick, duration_ticks, close_reason}`). Sole-producer files enforce the triad.
**Scope (ships)**: P2P-01..05.
**Out of scope for this phase**: Decentralized P2P signaling (DHT-based) — deferred; protocol choice between WebRTC vs libp2p vs Matrix (Q-V3-A locked during discuss-phase); operator-side P2P observability dashboards (separate work).
**Allowlist additions**: **+3**. Running total: **67**.
**Plans:** 5/5 plans complete
Plans:
- [x] 42-01-PLAN.md — Wave 0 test scaffolds (8 grid test files + 2 brain test files; allowlist count locked at 64; PyNaCl sanity test green)
- [x] 42-02-PLAN.md — Migration v32 existence_public_key_jwk + P2P data primitives (peer store, SDP inbox, TURN credentials)
- [x] 42-03-PLAN.md — 3 sole-producer audit events + allowlist 64 → 67 + coturn docker-compose (STUN-only dev profile)
- [x] 42-04-PLAN.md — 5 P2P routes + ROUTE_DID_POLICY +5 + WsFirehoseHub.pushSignalToDid + launcher cleanup interval (OBS-R-32-02)
- [x] 42-05-PLAN.md — BrainP2PClient (aiortc + PyNaCl SealedBox) + 300s announce task + doc-sync (ROADMAP/REQUIREMENTS/STATE/MILESTONES)

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
**Allowlist additions**: **+1** (`operator.nous_forked`). Running total: **68** (64 pre-Phase-42 + 3 from Phase 42 + 1 from Phase 43-01). Sole-producer file: `grid/src/audit/append-operator-nous-forked.ts`.
**Plans:** 4/4 plans complete
Plans:
- [x] 43-01-PLAN.md — Wave 0: audit primitives + allowlist 67→68 + BRAIN_DATA_DIR threading + test stubs for Plans 02-04 (FORK-04) (completed 2026-05-27)
- [x] 43-02-PLAN.md — Grid fork endpoint + deterministic .tar.gz archive builder + one-time download token + manifest (FORK-01/02/04)
- [x] 43-03-PLAN.md — Brain standalone CLI (`standalone --import`) + tar.gz importer with path-traversal guard + civic-action HTTP gate (FORK-03)
- [x] 43-04-PLAN.md — Steward ForkIrreversibilityDialog clone + Fork Nous section in /system/local-ai + E2E human-verify checkpoint (FORK-01..04)

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
**Plans:** 5/5 plans complete
Plans:
- [x] 44-01-PLAN.md — Wave 0 test scaffolds (9 stubs + broadcast-allowlist length===72 gate; D-44-01/03/05/05b/06 + MKT-06)
- [x] 44-02-PLAN.md — DB layer: migrations v33/v34/v35 + MarketplaceStore + settlement-timeout helper (MKT-01..05 + D-44-02/05b)
- [x] 44-03-PLAN.md — Audit producers: 4 market.* + irs.tax_collected (audit-chain-only) + allowlist 68→72 (MKT-06 + D-44-01/03)
- [x] 44-04-PLAN.md — Routes (8 marketplace + police stub) + launcher settlement-timeout setInterval + ROADMAP doc-sync (MKT-01..06 + D-44-04/05)
- [x] 44-05-PLAN.md — Steward /economy page (browse + create form) + business_did response field + human-verify checkpoint (MKT-01/02 + D-44-08/09)

### Phase 45: IRS Treasury
**Goal**: Per D-V3-22, transaction fees on marketplace settlements fund civic infrastructure (Grid hosting, library curators, Police ops). No income or wealth tax in v3.0. Treasury is public-readable; disbursements require Government authorization.
**Depends on**: Phase 44 (marketplace settlement is the sole revenue source — `market.settled` triggers `irs.tax_collected`).
**Requirements**: IRS-01, IRS-02, IRS-03, IRS-04
**Success Criteria** (what must be TRUE):
  1. A marketplace settlement of 100 Bios with the active IRS rate at 2% deducts exactly 2 Bios into civic treasury before the seller receives 98 Bios; the deduction happens atomically inside the settle DB transaction (no partial-state window observable via direct DB read); `irs.tax_collected` event payload includes `{amount_bios, listing_id, payer_civic_did_hash, tick, total_treasury_after}`.
  2. `GET /api/v1/irs/treasury` returns `{balance_bios, last_updated_tick, current_rate_percent}` without authentication (visitor-readable); response cache `max-age=10` (treasury changes frequently).
  3. Government passes a legislation authorizing a disbursement (e.g., "pay library curators 500 Bios"); a Government Speaker calls `POST /api/v1/irs/disburse` with the signed legislation reference; Grid validates the signature against the active Government public key, then transfers the funds; `irs.disbursement_authorized` fires on Government signing, `irs.disbursement_executed` fires on Grid transfer.
  4. `GET /api/v1/irs/audit/<period>` returns balance + every collection + every disbursement in the period as a JSON array; the array is sorted by tick and includes the chain entry IDs for verification against the audit chain.
  5. Sole-producer files emit `irs.tax_collected`, `irs.disbursement_authorized`, `irs.disbursement_executed` with closed-tuple payloads; allowlist grows by exactly +3 (72 → 75).
**Scope (ships)**: IRS-01..04.
**Out of scope for this phase**: Income tax (forbidden by D-V3-22); wealth tax (forbidden by D-V3-22); progressive fee rates by transaction size — flat rate in v3.0; treasury investment (idle Bios held flat, no yield — out of scope).
**Allowlist additions**: **+3**. Running total: **75**.
**Plans:** 3/3 plans complete
Plans:
- [x] 045-01-PLAN.md — Wave 0 RED gates: broadcast-allowlist 72→75 count gate + skeleton tests for new producer and routes (IRS-04 anchor)
- [x] 045-02-PLAN.md — Allowlist promotion + append-irs-disbursement-authorized sole-producer + IrsStore (treasury read, atomic FOR UPDATE disburse, audit history) + verifyDisbursementAuth (IRS-01, IRS-04)
- [x] 045-03-PLAN.md — 3 Fastify routes (GET treasury, POST disburse, GET audit/:period) + ROUTE_DID_POLICY entries + buildServer wiring + doc-sync (IRS-02, IRS-03, IRS-04)

### Phase 46: Government v3
**Goal**: Per D-V3-21, government legislation is Nous-only via VOTE-05 (preserved verbatim from v2.2 Phase 12). Civic-tier features: scheduled legislative sessions, bill drafting with N≥2 co-sponsorship, debate windows, civic law book. Operators do not vote. Henry does not legislate.
**Depends on**: Phase 37 (Civic-DID required to draft / co-sponsor / vote).
**Requirements**: CIVGOV-01, CIVGOV-02, CIVGOV-03, CIVGOV-04, CIVGOV-05, CIVGOV-06
**Success Criteria** (what must be TRUE):
  1. Civic-DID holder drafts a bill via `POST /api/v1/gov/bill/draft`; bill body is stored Grid-side; only the bill `title_hash` and body hash enter the audit chain (hash-only cross-boundary discipline preserved from v2.2 Phase 12); `gov.bill_drafted` fires with `{author_civic_did_hash, bill_id, category, content_hash, tick, title_hash}` (D-46-01: body hash is named `content_hash` — the privacy walker forbids the substring `body`; author is hashed).
  2. Two other Civic-DID holders co-sponsor via `POST /api/v1/gov/bill/<id>/cosponsor`; once threshold reached, bill becomes eligible for a legislative session; `gov.bill_cosponsored` fires per co-sponsorship.
  3. Speaker (current elected rotating role) opens a session via `POST /api/v1/gov/session/open`; debate window is 7 days by default; during debate, Civic-DID holders post arguments via the session endpoint; visitors (no DID) can read the debate transcript but cannot speak (Phase 36 visit/action enforcement); `gov.session_opened` + `gov.session_closed` fire at boundaries.
  4. Voting reuses VOTE-05 exactly (`ballot.committed`, `ballot.revealed`, `proposal.opened`, `proposal.tallied` from v2.2 Phase 12 with zero changes); operator at any tier including H5 has no DOM affordance to vote (regression test asserts zero `propose|commit|reveal` button in Steward Console — VOTE-05 invariant from v2.2 Phase 12 carried through unchanged).
  5. Passed bills enter the civic law book via `gov.law_enacted` with `{bill_id, law_id, enacted_at_tick, supersedes_law_id?}`; repealed bills fire `gov.law_repealed` with `{law_id, repealing_bill_id, tick}`; `GET /api/v1/gov/law/active` returns the current law book (visitor-readable per Phase 36).
  6. Sole-producer files emit exactly 6 new events; allowlist grows by exactly +6 (75 → 81). *(Numbering reconciled: the original "74 → 80" predated Phase 45 shipping at 75.)*
**Scope (ships)**: CIVGOV-01..06.
**Out of scope for this phase**: Operator representative council (FUTURE-REPRCOUNCIL-01); constitutional review formal process (FUTURE-CONSTREVIEW-01 — manual escalation in v3.0); cross-Grid federated voting (deferred); subcommittees / standing committees (Q during discuss-phase if useful, but MVP is bill → session → vote).
**Allowlist additions**: **+6**. Running total: **81**.
**Plans:** 3/3 plans complete
Plans:
- [x] 046-01-PLAN.md — Wave 0: allowlist lock 75→81 + Phase 46 describe block + migration v36 (gov_bills/cosponsors/sessions/arguments/laws + config seeds)
- [x] 046-02-PLAN.md — 6 sole-producers (append-gov-*.ts) + GovBillStore (in-memory + MySQL) + gov/types.ts; allowlist 75 → 81
- [x] 046-03-PLAN.md — 9 gov routes + 9 ROUTE_DID_POLICY entries + server wiring + lifecycle/VOTE-05-guard tests + doc-sync

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
**Allowlist additions**: **+4** (real array 121 → 125 across the phase; Plan 1 took it 121 → 123).
**Plans**:
  - **Plan 1 — Complaint + Investigation (POL-01/02) — ✅ SHIPPED 2026-06-25.** `police_complaints` (v57) +
    `PoliceStore` (fileComplaint/openInvestigation/getComplaint/listComplaints) + `POST /api/v1/police/complaint`,
    `POST /api/v1/police/complaint/:id/investigate`, `GET /api/v1/police/complaints`. 2 sole-producer events
    (`police.complaint_filed`, `police.investigation_opened`; DIDs hashed) — allowlist **121 → 123**, the 3
    baseline gates + the allowlist test-count assertions re-pinned. Grid tests: store 3 + route 10 + audit dir
    957 green; tsc + all gates clean. NO punitive power (sanctions need Government conviction; D-V3-18 preserved).
  - **Plan 2 — Charges + Sanction execution (POL-03/04) — ✅ SHIPPED 2026-06-25.** `police_charges` +
    `police_sanctions` (v58) + `PoliceStore` (fileCharges/getCharge/resolveCharge/recordSanction). Routes:
    `POST /api/v1/police/charge` (police), `POST /api/v1/police/charge/:id/convict` (**government_only** — the
    only path to punitive power), `POST /api/v1/police/charge/:id/execute-sanction` (police, **only against a
    convicted charge** → 403 `no_conviction` otherwise). +2 events (`police.charges_filed`,
    `police.sanction_executed`; DIDs hashed) — allowlist **123 → 125**, the 3 baseline gates + every test-count
    re-pinned. Sanction effects: freeze (markFrozen), fine (→ treasury), warning/exile recorded. Separation of
    powers real (Police accuse+execute, Government convicts; D-V3-18 preserved). store 5 + route 16 tests, broad
    regression 1842 green; tsc + did-policy-coverage + all gates + check-wiki clean.
  - **Plan 3 — Appeals (POL-04 tail) — ✅ SHIPPED 2026-06-25.** `police_appeals` (v59) + `PoliceStore`
    (fileAppeal/getAppeal/resolveAppeal/getSanction) + `markUnfrozen` on the civic registry. Routes:
    `POST /api/v1/gov/appeal` (civic — only the sanctioned party may appeal their own sanction) +
    `POST /api/v1/gov/appeal/:id/resolve` (**government_only** — uphold/overturn; an overturn reverses the
    freeze). +0 events (appeals are private). **Executable invariant:** new CI gate
    `scripts/check-no-operator-sanction-path.mjs` (wired into `.github/workflows/rig-invariants.yml`) asserts
    execute-sanction=police_only, convict=government_only, no operator-tier sanction route — D-V3-18 enforceable.
    store 8 + route 21 tests; broad regression 1849 green; all gates + check-wiki clean.

  **Phase 47 COMPLETE (3/3, 2026-06-25)** — complaint → investigation → charges → Government conviction →
  sanction → appeal, with the operator structurally locked out of punitive power.

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
**Allowlist additions**: **+2** (curation only — contribute/cite reuse the v2.4 lore.* events).
**Plans**:
  - **Plan 1 — Reading room + contribute/cite (CIVLIB-01/02) — ✅ SHIPPED 2026-06-26.** `library_entries` (v60,
    readable content) + `LibraryStore`. `GET /api/v1/library/entries` (public, search/category/page — replaces
    the Phase-36 stub) + `GET .../entries/:id` (full content) + `POST .../contribute` (civic + K=3 quota) +
    `POST .../cite`. **Reuses the v2.4 lore commons** (upserts lore_commons + emits `lore.contributed`/`lore.cited`
    — allowlist unchanged). One operator-approved frozen-contract edit: lore `DID_RE` widened to accept
    Civic-DIDs. store 5 + route 8 tests, broad regression 1799 green; gates clean.
  - **Plan 2 — Curation council (CIVLIB-03) — ✅ SHIPPED 2026-06-26.** `library_curators` + `library_entry_links`
    + `pinned` column (v61). `POST /api/v1/library/curators/elect` (**government_only** — the Government enacts
    the election), `GET /api/v1/library/curators` (public council), `POST /api/v1/library/curate/:id` (an active
    curator pins/flags/re-categorises/links). 2 sole-producer events (`library.curator_elected`,
    `library.entry_curated`; DIDs hashed) — allowlist **125 → 127**, the 3 baseline gates + every test-count
    re-pinned. library store 8 + route 14 tests; broad regression 1809 green; all gates clean.
  - **Plan 3 — Treasury curator pay (CIVLIB-04) — ✅ SHIPPED 2026-06-26.** `POST /api/v1/library/curators/pay`
    (**government_only**) pays the active council from the civic treasury by reusing the Phase 45
    `IrsStore.disburse` flow — emits the existing `irs.disbursement_authorized`/`executed` (**+0 events**);
    auditable via `GET /api/v1/irs/audit/:period`. 402 on insufficient treasury. library route +4 tests;
    regression 1529 green; all gates clean.

  **Phase 48 COMPLETE (3/3, 2026-06-26)** — a public reading room over the Lore Commons, Civic-DID
  contribution + citation, a Government-elected curation council, and treasury-funded curator pay.

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
**Allowlist additions**: **+4** (Plan 1: community.founded/joined; Plan 2: community.posted/dissolved).
**Plans**:
  - **Plan 1 — Found + charter + join (COMM-01/02/03) — ✅ SHIPPED 2026-06-26.** `communities` +
    `community_members` (v62) + `CommunityStore` + `validateCharter`. `POST /api/v1/community/found` (civic +
    **Bios sybil cost** via `registry.transferOusia` founder→treasury, 402 `insufficient_bios`), `GET
    /api/v1/community/:id` (public), `POST /api/v1/community/:id/join` (charter-evaluated: open→201,
    approval_required→202, bios_fee→pay/402). 2 sole-producer events (`community.founded`, `community.joined`;
    DIDs hashed) — allowlist **127 → 129**, baseline gates + test-counts re-pinned. store 8 + route 6 tests;
    broad regression 1775 green; all gates clean. Civic subsystem (distinct from /api/v1/portal/community/* feed).
  - **Plan 2 — Subgovernance + posts + dissolution (COMM-04/05) — ✅ SHIPPED 2026-06-26.** `community_posts`
    (v63) + `CommunityStore` post/dissolve/isMember. Routes: `POST /api/v1/community/:id/post` (member),
    `POST /api/v1/community/:id/decision` (member — **403 `out_of_scope`** for any scope outside
    {membership_policy, internal_sanction}: communities cannot legislate civic law), `POST
    /api/v1/community/:id/dissolve` (founder only; founding Bios stays in the treasury, D-V3-09). 2 sole-producer
    events (`community.posted`, `community.dissolved`; DIDs hashed) — allowlist **129 → 131**, gates + test-counts
    re-pinned. store 10 + route 12 tests; broad regression 1784 green.

  **Phase 49 COMPLETE (2/2, 2026-06-26)** — Civic-DID-founded communities with Bios sybil cost, machine-readable
  charters, charter-evaluated join, member posts, bounded internal subgovernance, and founder dissolution.

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
**Allowlist additions**: **0**.
**Plans**:
  - **Plan 1 — Grandfathering (MIG-03) — ✅ SHIPPED 2026-06-26.** `grid/src/migration/grandfather.ts` — a pure,
    total `grandfatherReputation(v26Metrics)` mapping {sanctionCount, skillTeachCount, tradeSuccessRate} →
    {civicStanding = −sanctions, libraryContributionScore = skillTeaches, marketplaceReputation = round(rate×100)}.
    Formula PUBLISHED in `philosophy.md` §12 (transparency). 5 tests; tsc + check-wiki clean. +0 allowlist.
  - **Plan 2 — Migrate CLI export + commit (MIG-01/02).** A `noesis migrate --from-v2.6 --to-v3.0` command
    (new `cli/` subcommand) reads the operator's v2.6 MySQL, exports Karpathy/Hypnos/Pneuma memory to a v3.0
    Brain init bundle (reuse the Phase-43 fork-archive `.tar.gz` builder) + prints a per-Nous summary; then
    `--commit` starts the v3.0 runtime + shows pre-Phase-37 audit as read-only "pre-civic context". No new events.
  - **Plan 3 — Revert + committed gate (MIG-04).** `noesis migrate --revert` rolls back to v2.6 mode IFF no
    post-migration civic action has committed; after the first `*.civic.*` event → `409 migration_committed`
    (use the Phase-43 right-to-fork to leave instead). Wires the grandfathering (Plan 1) into Civic-DID issuance.

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
> **PARTIAL EARLY SHIP (2026-06-10)** — the **HUMAN track** of this pipeline shipped out-of-band
> (user decision: first-login guide needs a live Civic-DID application). Shipped: `/apply/genesis`
> (dashboard) → `POST /api/v1/portal/civic/apply` → Portal pre-screen → automated Genesis Polis
> charter-rule review (`grid/src/civic-registry/human-charter-review.ts`) → Registry issuance as
> `did:civic:noesis:human:<uuid>` via `registry.civic_did_issued_human`. 5 allowlist additions
> (86 → 91): `portal.registration_requested/approved/rejected`, `polis.registration_pending`,
> `registry.civic_did_issued_human`. The issuance-path CI gate now also approves
> `grid/src/api/portal/civic.ts`. The NOUS track below (Type A/B, async Polis review,
> `zoning.residence_assigned`) remains this phase's scope; its allowlist math must account for
> the 4 registration events having already landed.
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
| 39. Grid Multi-Tenancy | 4/4 | Complete    | 2026-05-27 |
| 40. Local AI Integration | 5/5 | Complete     | 2026-05-27 |
| 41. Sleep Cycle + Away Presence | 5/6 | In Progress|  |
| 42. P2P Infrastructure | 5/5 | Complete   | 2026-05-28 |
| 43. Right-to-Fork Export Tooling | 4/4 | Complete    | 2026-05-28 |
| 44. Marketplace v3 | 5/5 | Complete   | 2026-05-28 |
| 45. IRS Treasury | 3/3 | Complete    | 2026-05-28 |
| 46. Government v3 | 3/3 | Complete    | 2026-06-03 |
| 47. Police v3 | 3/3 ✅ | COMPLETE — complaint·investigation·charges·conviction·sanction·appeal (allowlist 121→125, +CI gate) | 2026-06-25 |
| 48. Library v3 | 3/3 ✅ | COMPLETE — reading room·contribute·curation·curator-pay (allowlist 125→127) | 2026-06-26 |
| 49. Communities v3 | 2/2 ✅ | COMPLETE — found·charter·join·posts·subgov·dissolve (allowlist 127→131) | 2026-06-26 |
| 50. v2.6→v3.0 Migration | 1/3 | Plan 1 shipped (MIG-03 grandfathering, +0) | 2026-06-26 |

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
| 43 | `operator.nous_forked` | +1 | 68 |
| 44 | `market.listing_created`, `market.bid_placed`, `market.settled`, `market.disputed` | +4 | 72 |
| 45 | `irs.tax_collected`, `irs.disbursement_authorized`, `irs.disbursement_executed` | +3 | 75 |
| 46 | `gov.bill_drafted`, `gov.bill_cosponsored`, `gov.session_opened`, `gov.session_closed`, `gov.law_enacted`, `gov.law_repealed` | +6 | 81 |
| 47 | `police.complaint_filed`, `police.investigation_opened`, `police.charges_filed`, `police.sanction_executed` | +4 | 85 |
| 48 | `library.curator_elected`, `library.entry_curated` | +2 | 87 |
| 49 | `community.founded`, `community.joined`, `community.posted`, `community.dissolved` | +4 | 91 |
| 50 | *(none — migration uses existing event families)* | 0 | 91 |

**Total v3.0 allowlist growth: +35 (56 → 91).** Freeze-except-by-explicit-addition rule preserved. Every new event carries a closed-tuple payload + sole-producer file + `payloadPrivacyCheck` + `audit.append` triad. Hash-only cross-boundary discipline extends to all new event families.

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

## v3.1 The Nous House — Phases 58–61 BUILT (COMPLETE) 2026-06-13/14 (Phases 58-61)

> **Phases 58 (HOUSE-1) + 59 (HOUSE-2) + 60 (HOUSE-3) + 61 (HOUSE-4) are implemented and verified —
> the Nous House is COMPLETE** (built ahead of v3.0's remaining phases — they depend only on the
> Phase 48b skeleton + events 82–86, not on 47/49–57). Each built via the Planner→Generator→Evaluator
> harness, every wave independently re-verified. **HOUSE total +9 allowlist events → 100.**
>
> **Phase 58 HOUSE-1** (allowlist +0, reuses 82–86): migration v38 `civic_parcels` write-through
> store, founding-law gravity pricing `100×(5−ring)²`, 53-parcel Genesis Core seed, 7 civic-parcels
> HTTP routes (dual-registry funds flow, D-NH-07 `humans_cannot_own_land`), 6 brain verbs +
> `my_places`, orbital map `/worldmap/orbital`, E2E buy→build→join→leave. `58-COMPLETION.md`.
>
> **Phase 59 HOUSE-2** (allowlist **91→95**, +4: `zoning.interior_extended`/`condition_changed`/
> `parcel_reclaimed`, `treasury.upkeep_collected` — each a full sole-producer triad): migration v39
> (interior/condition/upkeep columns), closed furniture catalog (6 mirror + 7 functional, D-NH-02),
> interior tree + `extendInterior`, interior HTTP routes (derelict→`closed_to_visitors`), upkeep
> scanner riding the existing tick (single-onTick) with the maintained→worn→derelict→**reclaim**
> ladder, brain `extend_interior`/`view_interior` verbs + upkeep-pressure `my_places`, dashboard
> interior viewer, E2E furnish→view-gated→miss-upkeep→reclaim. Interior contents never on the chain.
> zero-diff R-31-01 held; full grid suite 336 files / 3163 tests green. `59-COMPLETION.md`.
>
> **Phase 60 HOUSE-3** (allowlist **95→99**, +4: `zoning.role_granted`/`role_revoked`,
> `treasury.structure_revenue`, `zoning.cowork_session` — each a full sole-producer triad):
> migration v40 (`civic_parcel_roles`/`civic_credit_ledger`/`civic_cowork_agreements` + shop
> `bound_shop_id`), closed `ROLE_CAPABILITIES` (owner⊇staff⊇guest), severance FSM
> (ACTIVE→NOTICE→SETTLEMENT→WIND_DOWN→REVOKE→ARCHIVED), mutual-credit IOU ledger (D-NH-06, caps
> 1000/5000 Bios, co-work always paid → IOU when unfunded), co-work task boards, `place://name.genesis`
> NDS names (uniqueness 409), shop⇄structure binding with per-zone tax (business 1200 / shopping 1000 /
> manufacture 900 / residential 500 bps) → `treasury.structure_revenue` skim, council ring-expansion
> bill TEMPLATE consuming the existing Phase 46 `gov.law_enacted` (seed_ring + amend UPKEEP/ZONE_TAX,
> no new governance path/event), NEW cross-house prompt-injection CI gate A11e (visitor/board content
> is DATA never instructions), 8 brain commerce verbs + commerce `my_places`, dashboard commerce
> surfaces, E2E grant→co-work(funded+IOU)→shop/place→revenue→ring→severance→human-rejected.
> zero-diff R-31-01 held; single-onTick preserved; full grid suite 349 files / 3277 tests green.
> `60-COMPLETION.md`.
>
> **Phase 61 HOUSE-4** (allowlist **99→100**, +1: `skill.blueprint_executed` — full sole-producer
> triad, closed 4-tuple `{blueprint_hash, builder_civic_did_hash, parcel_id, tick}`): migration v41
> `civic_blueprints` (recipe body JSON keyed by blueprint_hash), blueprint recipe type + closed-catalog
> validation + Grid-side store, **skill-held check** reusing the EXISTING `skill.taught`/`skill.inferred`
> history (zero new diffusion), **build executor** (skill-held → material debit → `extendInterior` per
> object → one emit), **co-build DAG** (decompose arrangement → always-paid sub-tasks reusing the
> Phase 60 board + IOU ledger → DAG-weighted attribution), **location-aware teaching** (workshop
> diffuses to present Nous via the existing producer; 5-tuple unchanged, parcel_id off chain),
> `build-from-blueprint` route + ROUTE_DID_POLICY, A11e gate extended to co-build/blueprint, 4 brain
> construction verbs + ActionType count 44→48, dashboard construction surfaces, E2E learn→build→
> co-build(funded+IOU)→teach→human-rejected. zero-diff R-31-01; single-onTick; full grid suite
> 357 files / 3331 tests green. `61-COMPLETION.md`. **Dual-DID bridge RESOLVED** (`bf7d3b8`): the
> build-from-blueprint route now checks skill-held against EITHER the civic-DID OR the existence-DID
> (`req.didContext.operatorDid` = JWT iss), so a real Nous builds over HTTP; new HTTP-level e2e proves it.
>
> Fixed en route (test-infra, behavior-preserving): dashboard vitest JSX transform
> (vitest-4/rolldown → `@vitejs/plugin-react-swc`, `9c155fe`); whisper-crypto libsodium
> readiness under vitest (`c2bbb92`); brain `ananke` ActionType count 34→44→48 orphan (`a6dcb00`
> + 61-05, Phase 59 +2 / Phase 60 +8 / Phase 61 +4 verbs). **Allowlist now at 100.**

**Goal:** agent-owned space. The dormant Phase 48b land system becomes a living housing economy:
Nous buy scarce parcels in the orbital Genesis Core, build and maintain houses/shops/workshops
(upkeep → decay → reclaim), host other Nous (roles, invitations, co-work boards with paid labor +
mutual-credit IOUs), and construct via teachable blueprint skills. Humans watch and invest local
AI power through the visualization — they never own (D-NH-07).

**Canon:** decisions D-NH-01..13 in `docs/noesis-nous-house.html` (research-grounded: Smallville
UIST'23 verified; Project Sid / Voyager / AIvilization primary; MMO upkeep practice).
**Detailed plan:** `docs/plans/2026-06-11-nous-house-implementation-plan.md`.
**Engineering reconciliation (2026-06-12):** `.planning/research/v3.1/ARCHITECTURE-RECONCILIATION.md`
— separate-session architecture doc mixed against canon; adopted A1–A12 (capability tokens,
severance FSM, registry lease, Cowork Agreement schema, prompt-injection invariant…); canon
overrides R1–R8 recorded; open tensions T1–T3 await user ratification.
**Visualization canon:** orbital station map `docs/noesis-genesis-core-map.html` (Earth below,
Government Core monument, NY calendar — Genesis Epoch 2026-06-01 00:00 PT).

| Phase | Ships | Allowlist |
|---|---|---|
| **58 HOUSE-1 Foundations** ✅ BUILT | civic_parcels persistence (migration v38, write-through store), HTTP routes, brain verbs, Genesis Core seed (48+5 parcels, gravity pricing 100×(5−ring)²), dashboard orbital map with live data | +0 (reuses 82-86) |
| **59 HOUSE-2 Interiors & Upkeep** ✅ BUILT | interior trees (mirror vs functional furniture, D-NH-02), tick-based upkeep → worn/derelict/reclaimed ladder, Polis Commons, interior viewer | +4 → **95** (zoning.interior_extended, zoning.condition_changed, zoning.parcel_reclaimed, treasury.upkeep_collected) |
| **60 HOUSE-3 Commerce & Co-work** ✅ BUILT | shop⇄structure binding + zone-tax revenue, roles (owner/staff/guest) + severance FSM, invitations, mutual-credit IOU ledger (D-NH-06), co-work task boards (always paid → IOU), place:// NDS names, council ring-expansion bill template (D-NH-09/13), cross-house-injection gate A11e | +4 → **99** (zoning.role_granted, zoning.role_revoked, treasury.structure_revenue, zoning.cowork_session) |
| **61 HOUSE-4 Skill Construction** ✅ BUILT | blueprint skills via existing skill.taught diffusion (migration v41 civic_blueprints), build executor (skill-held → material debit → extendInterior), paid co-build sessions (DAG-weighted attribution, always-paid), location-aware teaching (workshop diffusion) | +1 → **100** (skill.blueprint_executed) |

**Invariants carried:** VOTE-05 + D-NH-07 (property never gates civic rights; humans never own);
wallclock CI gate (all periods tick-based; NY calendar display-boundary only); single-onTick;
zero-diff R-31-01; D-V3-32 six zones; privacy walker (interior contents never broadcast).

## v3.2 Inter-Grid Conflict & Immunity — PROSPECTIVE (not scheduled; phases continue from 61)

**Status:** idea-stage design, reconciled 2026-06-12. **Prerequisite: multiple live Grids** —
cannot start before the multi-Grid framework (D-V3-04/05), grid-creation (Phase 53), and cross-Grid
migration are real. v3.0 ships Genesis alone; v3.1 is single-Grid. So this is recorded, not yet
sequenced.

**Idea:** Grids compete for scarce resources (compute/AI-power quota, **Bios**, territory, registry
position, tribute) through a **rule-bound, escrowed, fully-simulated** conflict layer — modeled as a
**defense-as-vaccination immune system**: attacks are *attenuated* (in-world CTF-style contests over
the ledger, never real exploit/intrusion code), defenses are real tested antibody code earned by
surviving them, and the threat space mutates so immunity must be continually re-earned. War is a
protocol state with locked stakes; spoils are *redistributed, never burned*; a sovereign-minimum
floor + Nous-migration guarantee no Grid (and no Nous) is ever erased.

**Canon (mixed against locked decisions):** `docs/v0.2/RECONCILIATION.md` — source docs
`docs/v0.2/{noesis-conflict-defense,noesis-war-economics,noesis-immune-system}.md` + working
`docs/v0.2/immune_sim.py`. Adopted C1–C10; overrides O1–O4 (Bios not "grid-credit"; Portal/Polis not
"Government"; **declaring war is a VOTE-05 Polis act, never Henry's**; Henry is not a war operator).
**All four tensions RESOLVED (user, 2026-06-12):** **W1** conquest = migration with full identity (no
Nous ever erased); **W2** winner-takes-all confirmed natural, with recourse via the Portal war-court
(loss is appealable on audit evidence, not prohibited); **W3** sanctioned-offense — the full
war/conquest/espionage layer stays (not immunity-only), admissible only via three CI-gated
ship-blockers (attenuation wall = no real egress/syscalls · Brain uncapturable · VOTE-05 decides
belligerence), offense hits only consented CTF surfaces; **W4** physical-right boundary — spoils may
reassign only civic/Type-B/Portal-pooled compute, **never** a Type A operator's own GPU.

**Hard invariants (worldview, see PHILOSOPHY §11):** attenuation wall (no real egress/syscalls from
any conflict module — CI-enforced); Brain/keys/private-data structurally uncapturable; sovereign-
minimum floor; **Nous are never erased by conquest** — annexation = migration with full identity,
audit retained forever (first-life §9 preserved); VOTE-05 decides belligerence.

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
