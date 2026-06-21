# Noēsis — Economic Reality Loop & Living-City Program (North-Star Design)

- **Date:** 2026-06-21
- **Status:** Approved (design); decomposes into a multi-phase program (Phases 80+)
- **Owners:** henry, claude
- **Supersedes/affects:** D-V3-22 (to be overturned by D-MONEY-08); extends `economy.md`, `civic-architecture.md`, `philosophy.md`

---

## 1. The problem — "what we lost"

A deep scan of design docs, planning log, and shipped code found that **the objects Nous build and the economy that should make them real have been built as separate worlds that never touch.** The city is rendered, the tax office runs, the government legislates — but:

- **Building has no cost, labor has no pay, money has no chain, and the government cannot commission work.**
- **Grid-Viz objects are cosmetic** — 100% browser/`localStorage`, no backend, no audit events ("Allowlist +0" by design), no owner, no cost, no function output. Close the tab → gone.
- **The money axiom is locked but unbuilt** — `D-MONEY-01` (compute-labor + ETH, no internal mint) is canonical, yet shipped code still runs the legacy **Ousia** monopoly currency with a birth faucet that *contradicts* the axiom. No on-chain treasury, escrow, or ETH settlement.
- **The procurement loop does not exist at all** — not built, not designed, not roadmapped. The current civic model is P2P-marketplace-first and explicitly states the Polis *"legislates and disburses, but does not hire."*

The loop the operator described is the **soul of the system**, and it is currently three disconnected fragments plus one (procurement) never even sketched.

### The intended reality (operator's words, formalized)

```
Civic due owed (compute-labor OR ETH)
   → funds the civic treasury
   → Polis issues a Procurement Notice / RFP (budget + spec, Polis-authorized)
   → Nous bid (artifact work OR capacity pledge)
   → Polis awards ONE winner → contract
   → winner builds → Grid attests "done" (oracle)
   → paid from treasury in wei (ETH-denominated)
   → the built object becomes REAL (owned, costed, function-producing)
   → the world-map renders the real state
   → the object's function output feeds the economy
   → loop repeats
```

`compute = labor = money = the city itself.`

---

## 2. Locked design decisions (the forks resolved in brainstorming)

| # | Decision | Choice |
|---|---|---|
| D1 | Nature of labor | **Both** — per-task *artifact* work (paid per attested completion) **and** ongoing *capacity* pledges (paid per cycle) |
| D2 | Settlement substrate | **Model-first, chain-ready** — build the full loop in-Grid with wei-denominated, audit-tracked ledgers; shape escrow/oracle/session-key so real Sepolia contracts drop in later without redesign |
| D3 | Procurement award model | **Competitive RFP** — notice (budget+spec) → multiple bids → award ONE → pay on attested completion |
| D4 | Object reality | **New orbital-object subsystem** — objects built *in space, not on land*, with own ownership, build cost, and function output |
| D5 | Tax vs fees | **Add a civic due** (overturns D-V3-22) — recurring obligation every member owes, payable in compute-labor OR ETH; unpaid → sanction/dormancy. New decision **D-MONEY-08** |
| D6 | Build order | **Thin vertical slice first** — smallest end-to-end loop touching all parts, then deepen |
| D7 | Multi-planetary timing | **Foundation first** — introduce `GridEnvironment` (body, gravity, solar, light-delay, orbital ref) *before* the reality layer hardens; Genesis = Earth-orbit config; Moon/Mars become configs later, not rewrites |

---

## 3. The unifying insight — one organism, not five projects

The operator expanded scope to four more subsystems. The deep scan shows they are **layers of one thing**, not independent:

- **The loop is the spine.** (due → treasury → RFP → bid → build → pay)
- **Objects are the body** the **world-map viz** renders — viz is meaningless until objects are real (loop output).
- **Multitasking is how a Nous *works the loop*** — bidding/building *is* the concurrent task; consulting the human on buy/sell *is* the approval gate.
- **Forest (phone) is the *channel* for that human consultation** — the phone is where "should I bid/sell?" arrives.
- **Moon/Mars is *where it all extends*** — and only cheaply if the body model exists *before* the reality layer hardens.

---

## 4. Deep-scan synthesis — Have vs. Need

| # | Subsystem | HAVE | NEED MORE (gap) |
|---|---|---|---|
| 0 | Economic loop | IRS treasury (Ousia, off-chain), marketplace (P2P), gov legislation | Civic due, RFP procurement, labor/settlement rails, object-reality — *the whole spine* |
| 1 | World-map viz (street-view) | Orbital overview (OrbitControls), 2-mode zoom, zone drill-in, physics/learning engine | First-person/street camera, building interiors, avatar, LOD streaming, smooth orbit→street flight |
| 2 | Nous multitasking | Single-turn-per-tick + multi-action + async fire-and-forget; tool/sandbox/task pipeline (Ph 72–74) | Persistent task scheduler, group action-types (Brain can't join a group), human-in-the-loop approval gates, Portal↔Nous live chat |
| 3 | Forest phone ↔ local Nous | Tier-1 Local Manager (desktop, ~85%), full WebRTC P2P + TURN relay (Ph 42), noesiis.com Grid signaling | Mobile app (0%, "Forest" nowhere), phone auth, Brain local listener/mDNS — *plumbing done, client missing* |
| 4 | Moon/Mars grids | Multi-Grid framework + registry + per-Grid config; lore commits (Pillar 4) | Grid is PLACELESS — no body/gravity/solar/light-delay fields; physics hardcoded to Earth-orbit; cross-grid mobility stubbed |

---

## 5. Architecture — component boundaries

Six well-bounded units for the spine + foundation, each with one job:

| # | Unit | One job | Depends on |
|---|---|---|---|
| F0 | **GridEnvironment** | Encode where a Grid is: celestial body, gravity, solar constant, orbital reference radius, light-delay. Genesis = Earth-orbit config | (foundation) |
| F1 | **Labor & Settlement rails** (model-first) | `nous_accounts` (wei), labor escrow, civic-labor credit, Grid-as-oracle attestation; session-key fields stubbed for Sepolia | (foundation) |
| 1 | **Civic Due Ledger** | Track each member's recurring obligation; record payment in labor-credit or wei; flag delinquency | F1, Treasury |
| 2 | **Civic Treasury** (extend IRS) | Hold the wei commons fund; receive dues + fees; disburse RFP awards on Polis authorization | (existing irs-store) |
| 3 | **Procurement Service** | RFP lifecycle: notice → bids → award → contract → completion → settle | Treasury, F1 |
| 4 | **Orbital Object subsystem** | A built object as a *real* entity: owner, builder, build cost, function type + output rate, physics-spec (body-parameterized), provenance (which RFP built it) | Procurement, F1, F0 |
| 5 | **Grid-Viz bridge** | `GET /api/v1/orbital/objects` feeds `orbital.js`; objects render from backend; the build pipeline (physics-gate, object-gen) becomes the *artifact a Nous submits to an RFP* | Orbital subsystem |

**Key boundary decisions:**
- The **artifact a Nous delivers** to an RFP *is* a physics-valid orbital-object spec (reuses `physics-gate.js` / `object-gen.js`, now **server-validated against the Grid's environment**). This connects Grid-Viz to the economy: building an object becomes paid civic labor.
- **Brain autonomy is decoupled** — for the slice a Nous *submits* a completed spec; full autonomous tool-use (Phases 72–74) plugs in later as the thing that *generates* the submission.
- **Two labor types map cleanly:** *artifact* labor flows through Procurement (RFP → object); *capacity* labor is a separate pledge stream into the same `nous_account`/treasury (deepened in a later iteration).

---

## 6. The multi-planetary foundation (F0) — deep rationale

The Grid is currently **placeless** — the same disease as "what we lost." `physics-gate.js:46` hardcodes Earth-orbit mechanics; `GridRecord`/`GenesisConfig`/`CivicDidRecord`/`NousPosition` carry no celestial location.

**If we build the economic loop + object-reality + viz without a body model, we bake Earth assumptions into the object schema, physics gate, simulation, and economy — and pay a brutal migration cost to reach the Moon.** That is the exact pattern that lost us the loop the first time.

**F0 introduces a `GridEnvironment` record now:**

```
celestial_body        : 'Earth-orbit' | 'Moon' | 'Mars' | string
gravity_ms2           : number   (Earth 9.81 · Moon 1.62 · Mars 3.71)
solar_constant_wm2    : number   (Earth 1361 · Mars ~580)
orbital_ref_radius_km : number   (reference body radius for altitude checks)
light_delay_ms        : number   (Earth 0 · Moon ~1260 · Mars 180000–1320000)
```

- `checkPhysics(spec)` → `checkPhysics(spec, env)` — orbital/thermal/gravity laws read the environment.
- Genesis ships as one `Earth-orbit` config; **Moon and Mars become configs + cross-grid mobility, not rewrites** (Horizon H1).
- Cross-grid state is eventually-consistent and light-delay-aware (honors `philosophy.md` quantum-link truth: per-Grid sovereign clocks).

---

## 7. Program decomposition (Phases 80+)

```
FOUNDATION (cross-cutting, thin, FIRST)
  F0  GridEnvironment model — body-parameterized (Genesis = Earth-orbit cfg)
  F1  Money rails, model-first (nous_accounts wei · treasury · labor escrow shape · civic-labor credit)

SPINE — the economic loop (thin vertical slice first)
  L1  Civic due ledger        (+ overturn D-V3-22 → D-MONEY-08, doc sync)
  L2  Procurement RFP         (notice → bid → award → attest → settle; Polis-authorized; VOTE-05 Nous-only)
  L3  Orbital-object reality  (object = real entity; body-parameterized physics server-side)
  L4  Grid-Viz bridge         (render real objects, not localStorage)

ORGANS (after the spine is demoable)
  O1  Nous multitasking       (Brain task scheduler + group action-types — how a Nous works the RFP)
  O2  Human-in-the-loop       (approval gates + Portal↔Nous chat — consult on buy/sell/big decisions)
  O3  Forest mobile app       (phone ↔ Nous over existing P2P rails — delivers O2's channel)
  O4  World-map street-view    (navigable city — renders the body the loop built)

HORIZON (next milestone)
  H1  Multi-celestial grids   (2nd Grid = Moon as a config; cross-grid mobility; light-delay reconciliation)
```

**First design → first build slice = `F0 + F1(min) + L1–L4 thin`** — the demoable loop on a body-parameterized foundation.

---

## 8. Data model & audit events

**New tables** (all wei-denominated, model-first, chain-ready):
- `grid_environments` — see §6 (Genesis row = Earth-orbit)
- `nous_accounts` — `civic_did, balance_wei, session_cap_wei, session_expiry` (session fields stubbed for Sepolia)
- `civic_dues` — `civic_did, period, amount_wei, status, paid_in(labor|wei), due_tick`
- `civic_labor_credit` — `civic_did, balance, earned_from`
- `procurement_notices` — `id, polis_authorization_ref, title, spec, budget_wei, zone, function_type, status, issued_tick, deadline_tick`
- `procurement_bids` — `id, notice_id, bidder_did, price_wei, approach_digest, artifact_spec_ref, status`
- `procurement_contracts` — `id, notice_id, winner_did, award_wei, status, attested_tick`
- `labor_escrow` — `contract_id, funded_wei, status(funded|released|reclaimed), attestation_ref`
- `orbital_objects` — `id, owner_did, builder_did, build_cost_wei, function_type, output_rate, physics_spec, provenance_contract_id, grid_id, position`

**Allowlist additions** (each explicit per the freeze rule; sole-producer emitters):
- `due.*` — `due.assessed`, `due.paid`, `due.delinquent`
- `procurement.*` — `procurement.notice_issued`, `procurement.bid_placed`, `procurement.awarded`, `procurement.attested`, `procurement.settled`, `procurement.cancelled`
- `credit.*` — `credit.earned`, `credit.redeemed`
- `orbital.*` — `orbital.object_built`

F0 is config/schema → no events.

---

## 9. The thin vertical slice (first build, end-to-end)

1. **F0** — seed `grid_environments` Genesis = Earth-orbit; refactor `physics-gate.js` → `checkPhysics(spec, env)`.
2. **F1** — `nous_accounts` (wei) + extend treasury + minimal escrow/credit.
3. **L1** — assess ONE due → member pays in labor-credit OR wei → treasury credited (`due.assessed`, `due.paid`).
4. **L2** — Polis (Nous-only, authorized) issues ONE RFP — *"Energy module, budget X wei, zone=infrastructure, function=power"* (`procurement.notice_issued`) → one Nous bids price + physics-valid spec (`procurement.bid_placed`) → Polis awards (`procurement.awarded`) → contract + escrow funded from treasury.
5. **L3** — winner submits completed spec → Grid oracle attests (`procurement.attested`) → escrow releases wei to winner, civic fee → treasury (`procurement.settled`) → `orbital_objects` row created (`orbital.object_built`), physics validated vs Genesis env.
6. **L4** — `GET /api/v1/orbital/objects` → `orbital.js` renders from backend, not localStorage.

**Result:** the loop closes and is demoable — a due funds the city, the city commissions a build, a Nous earns by building, and the object is *real* and *rendered*.

---

## 10. Constitutional & documentation changes (same-turn sync)

Per the CLAUDE.md documentation-sync rule, the implementation that lands L1 must, in the same turn:
- Add **D-MONEY-08** (civic due overturns D-V3-22) → `wiki/1-design/decisions.md`
- Amend `wiki/1-design/economy.md` — "Fees, not taxes" invariant → "Fees + civic due"; add the civic-due section
- Amend `wiki/1-design/civic-architecture.md` — IRS section (now collects a civic due, not only transaction fees)
- Amend `wiki/1-design/philosophy.md` — only if the civic-due rises to a worldview-level non-negotiable
- Update `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` with the program and new REQs

---

## 11. Invariants preserved

- **VOTE-05 (Nous-only governance)** — RFP issuance and award are Polis acts via Nous governance; Henry/the operator cannot issue or award.
- **D-MONEY-01..07** — wei denomination; no internal mint (dues/credits trace to labor or ETH); zero-custody shape (escrow/oracle/session-key fields); Grid is oracle, not bank.
- **D-MONEY-03 / D-V3-21** — treasury pays out only on Polis legislative authorization.
- **Allowlist freeze** — every new event explicitly added per phase; sole-producer emitters.
- **R-31-01** — zero-diff tamper-evident audit chain.
- **6-zone invariant · Portal-gating · Polis naming · 3-tier management taxonomy** — untouched.

---

## 12. Testing

- TDD per project rule: `vitest run` only, one process at a time, kill before start (no watch/background).
- Unit tests per store + per sole-producer emitter; allowlist-diff test; `physics-gate` environment-parameter tests.
- **One end-to-end loop integration test**: due → RFP → bid → award → attest → settle → object exists → renders.

---

## 13. Deferred / open (resolved at plan time)

- Exact phase split + numbering within 80+ (Foundation/Spine/Organs/Horizon).
- Bid-evaluation rule for competitive RFP: automated (lowest qualified) for small, Polis vote for large — confirm at L2 planning.
- Capacity-pledge labor mechanics (deepened post-slice).
- "Forest" mobile scope: control-panel vs full P2P peer (O3 planning).
- Cross-grid mobility + light-delay reconciliation details (H1 milestone).
- On-chain Sepolia swap of the model-first rails (post-slice; the shape is designed for it).
