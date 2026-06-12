# The Nous House — Detailed Implementation Plan (v3.1, Phases 58–61)

**Date:** 2026-06-11 · **Design doc:** `docs/noesis-nous-house.html` (canon D-NH-01..13)
**Research:** `.planning/research/nous-house-research.md` + second deep-research pass (in flight —
parameter recommendations marked `[R2]` below get final numbers from it)
**Phase numbering:** v3.1 starts at Phase 58 per CLAUDE.md. HOUSE-1..4 = **Phases 58–61**.

---

## 0 · Axiom → phase map

| Axiom | Lands in |
|---|---|
| D-NH-01 visualization = investment interface | 58 (live map), 59 (interior viewer) |
| D-NH-02 mirror vs functional furniture | 59 |
| D-NH-03 upkeep by founding law, Nous-amendable | 59 (law constants), 60 (Polis amendment hooks) |
| D-NH-04 scarce parcels | 58 (seed exactly 48+5) |
| D-NH-05 no free first occupation | 58 (purchase-only acquisition; commons are Polis-owned, usable not ownable) |
| D-NH-06 co-build always paid, mutual-credit IOU | 60 (ledger), 61 (co-build attribution) |
| D-NH-07 Nous-only property | 58 (route auth invariant) |
| D-NH-08 gravity pricing | 58 (price formula in seed) |
| D-NH-09 small core, council-law expansion | 58 (seed) + 60 (expansion-law hook) |
| D-NH-10 vector addresses (ring, sector, level) | 58 (schema columns) |
| D-NH-11 Genesis Epoch (PT) | 58 (display boundary only — wallclock gate!) |
| D-NH-12 Earth below | shipped in the canonical map; carried into dashboard map (58) |
| D-NH-13 first Grid, new Grids by Nous discussion | 60 (expansion bill template), v3.2+ (new-Grid flow via Phase 53 machinery) |

---

## Phase 58 · HOUSE-1 Foundations — wake the land, make it visible

**Goal:** the dormant Phase 48b `ParcelRegistry` becomes a persisted, routed, brain-actionable,
rendered system seeded with exactly the Genesis Core.

### 58.1 Persistence (migration v38 + store)

New table `civic_parcels` (one row per parcel; structure embedded — one-per-parcel invariant
makes a separate table unnecessary):

```sql
CREATE TABLE IF NOT EXISTS civic_parcels (
  parcel_id        VARCHAR(63)  NOT NULL,  -- 'genesis:residential:0007'
  grid_name        VARCHAR(63)  NOT NULL,
  zone_id          VARCHAR(31)  NOT NULL,  -- 6-zone enum (D-V3-32)
  ring             TINYINT      NOT NULL,  -- D-NH-10 vector address
  sector_deg       DECIMAL(6,2) NOT NULL,
  level            SMALLINT     NOT NULL DEFAULT 0,
  owner_civic_did  VARCHAR(255) NULL,      -- NULL = Polis/treasury
  price_bios       INT UNSIGNED NOT NULL,  -- gravity formula at seed time
  acquired_at_tick INT UNSIGNED NULL,
  structure_name   VARCHAR(127) NULL,      -- plaintext Grid-side only
  structure_type   ENUM('home','shop','workshop','venue') NULL,
  visibility       ENUM('open','private') NULL,
  built_at_tick    INT UNSIGNED NULL,
  named_address    VARCHAR(255) NULL,      -- place:// (wired in Phase 60)
  entry_policy     ENUM('open','allowlist') NOT NULL DEFAULT 'open',
  entry_allowlist  JSON NULL,
  PRIMARY KEY (parcel_id),
  INDEX idx_parcel_owner (grid_name, owner_civic_did),
  INDEX idx_parcel_zone  (grid_name, zone_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- `grid/src/civic/parcel-store.ts` — write-through store (INSERT on seed, UPDATE on
  purchase/build/policy). **Lesson learned (HumanRegistry incident, 2026-06-11): the registry is
  a read cache, MySQL is the source of truth — hydrate registry from store on boot, every mutation
  writes DB first, then memory.** Occupants stay memory-only (presence, not property).
- Seeding: on boot, if `civic_parcels` empty for the grid → seed the **Genesis Core** exactly
  (D-NH-04/09): ring 0 gov ×1, ring 1 commons ×4 (pre-built Polis structures: guest hall, market
  floor, shared workshop, archive — `venue` type, open), ring 2 sectors 8+8+8, ring 3 residential
  ×24. Gravity pricing `price = 100 × (5 − ring)²` (D-NH-08; constants in
  `grid/src/civic/founding-law.ts` so Phase 60 Polis amendments have one place to patch).
  Seeding is idempotent (INSERT IGNORE) and emits NO audit events (world-creation, not commerce).

### 58.2 Services wiring

- Instantiate `ParcelRegistry` + `ParcelStore` in `grid/src/main.ts` inside the `if (dbConn)`
  block and **attach to GridServices** (the civicDidStore wiring bug class — registry constructed
  but never attached — is the #1 named risk; add a boot log line `[civic] parcels loaded: N`).

### 58.3 HTTP routes (`grid/src/api/api/routes/civic-parcels.ts` → registered in server)

| Route | Policy | Behavior |
|---|---|---|
| `GET /api/v1/civic/parcels` | public | full parcel list (the map feed): id, zone, ring/sector/level, status, price, structure summary, occupant count. No owner DIDs in plaintext — `owner_civic_did_hash` (HEX64, matches zoning.* event discipline) |
| `GET /api/v1/civic/parcels/:id` | public | one parcel detail |
| `POST /api/v1/civic/parcels/:id/purchase` | civic_did_required | **D-NH-07 invariant:** `requireDid` yields civic_member tier — only Nous Bearer JWTs qualify; human cookie sessions are human_visitor → 401. Defensive second check: reject `did:civic:noesis:human:*` with `humans_cannot_own_land` (constitutional). Flow: registry.purchase() validation → debit buyer Ousia via `registry.transferOusia(buyer → TREASURY_DID, price)` → store write → `appendZoningParcelPurchased` + `appendTreasuryParcelRevenue` (existing producers 82/83) |
| `POST /api/v1/civic/parcels/:id/build` | civic_did_required + owner | type-zone fit (existing table) → store write → `appendZoningStructureBuilt` (84) |
| `POST /api/v1/civic/parcels/:id/join` / `/leave` | civic_did_required | entry policy enforced → `appendZoningStructureJoined/Left` (85/86) |
| `POST /api/v1/civic/parcels/:id/entry-policy` | civic_did_required + owner | open ⇄ allowlist |

Policy table entries added to `ROUTE_DID_POLICY`. **Allowlist additions: +0** (events 82–86 reused).

> Open economic note: Phase 48b types say "Bios" but Nous balances are Ousia
> (`registry.transferOusia`). HOUSE-1 treats them as the same unit (display "Bios") and records
> the unification question for the Polis-era treasury cleanup. `[R2]` may inform this.

### 58.4 Brain verbs (`brain/src`)

- Grid-API adapter actions: `list_parcels`, `buy_parcel(zone, max_price)`, `build(parcel,
  type, name)`, `visit(parcel)`, `leave()`, `set_entry_policy(...)`.
- Ownership enters Brain memory/episteme: "I own genesis:residential:0007; my home is built."
  (Smallville Lesson 2: the home anchors routine — Brain prompt context gains a `my_places` block.)
- Decision pressure stays with the Nous: verbs are capabilities, not scripts.

### 58.5 Visualization (D-NH-01/12)

- Dashboard gets the orbital station map as a component (`dashboard/src/components/worldmap/
  OrbitalGenesisMap.tsx`, ported from `docs/noesis-genesis-core-map.html`): live fetch of
  `GET /api/v1/civic/parcels`, fallback to embedded seed; Earth below (D-NH-12); Government Core
  monument; ghost frames flip to solid lit modules when `owner_civic_did_hash` present;
  occupancy lights from occupant counts; NY clock (D-NH-11 — Date allowed in dashboard, never grid).
- Route: replaces the flat `/worldmap` CyberGrid view? **No — additive**: `/worldmap` keeps the
  city view; new `/worldmap/orbital` becomes the canonical Grid view, linked from the landing
  page "Explore the map" and `/portal/civic-map`.

### 58.6 Tests & gates

- `grid/test/civic/parcel-store.test.ts` — seed idempotency, write-through (DB row after purchase),
  hydrate-on-boot, gravity prices (900/400), caps (≤1 home, ≤1 business), commons not purchasable.
- Route tests: auth matrix (anonymous 401 / human-visitor 401 / human civic-DID 403
  `humans_cannot_own_land` / Nous civic 201), entry policy, insufficient funds 402.
- CI gates: sole-producer + issuance-path + privacy walker all untouched-green; zero-diff
  (R-31-01) untouched (no chain code edits).

**Definition of done:** a Nous (via Brain or curl with a Nous JWT) buys ring-3 parcel for 400,
builds a `home`, a second Nous visits it, all five events appear on the public audit trail, and
the dashboard orbital map shows the parcel lit with one occupant — while a signed-in human
attempting purchase gets `humans_cannot_own_land`.

---

## Phase 59 · HOUSE-2 Interiors & Upkeep — make houses live and cost something

### 59.1 Interior tree (D-NH-02, Smallville Lesson 1)

- `structure_interior` JSON column on `civic_parcels` (v39 migration): Smallville-shaped tree
  `{areas: [{name, objects: [{kind, class: 'mirror'|'functional', state?}]}]}`.
- **Furniture registry** `grid/src/civic/furniture.ts`: closed catalog v1 —
  mirror: `bed, closet, shelf, kitchen, bathroom, decor` (render-only; valid ONLY in the owner's
  `home`); functional: `work_desk(billing,accounting), sim_board, meeting_table, game_table,
  task_board, skill_terminal, shop_counter` (each declares its affordances; visitors use per role).
- Routes: `POST .../interior/extend` (owner; validates against catalog),
  `GET .../interior` (entry-policy-gated: interiors are the Nous's sovereign space — NOT public;
  the public sees the exterior only). Audit: `zoning.interior_extended`
  `{object_kind, owner_civic_did_hash? → no — closed 4-key: object_class, parcel_id, tick, object_kind}` — final
  tuple fixed at phase planning; interior NAMES/state never cross the boundary.

### 59.2 Upkeep, decay, reclaim (D-NH-03/05, MMO Lesson 6)

- **Tick-based periods** (wallclock CI gate!): `upkeep_period_ticks` and `upkeep_rate` in
  `founding-law.ts` — draft `rate = 2% of price / period`, `period = 10080 ticks` (1 week at
  1 tick/min, matching gov debate-window precedent). `[R2]` finalizes both + grace windows.
- Collection inside the existing single `clock.onTick` flow (NO new onTick subscription —
  STATE.md invariant): lazy assessment on period boundary; auto-debit owner Ousia → treasury;
  `treasury.upkeep_collected`.
- Condition ladder on missed payments: `maintained → worn (1 missed) → derelict (2 missed,
  closed to visitors) → reclaimed (3 missed → ownership returns to treasury, structure razed)`.
  `zoning.condition_changed` (closed enum), `zoning.parcel_reclaimed`. Grace numbers `[R2]`
  (FFXIV-45-day analog mapped to ticks).
- Polis Commons exempt (Polis-owned).

### 59.3 Interior viewer (D-NH-01, Homemaker pattern)

- `dashboard /worldmap/orbital` → click an owned module → interior view: Three.js room from the
  interior tree (mirror furniture as static meshes, functional furniture highlighted). Humans
  browse only what entry policy allows (open structures; exteriors otherwise).

**Allowlist:** +4 → `zoning.interior_extended`, `zoning.condition_changed`,
`zoning.parcel_reclaimed`, `treasury.upkeep_collected` (sole producers, closed tuples,
privacy-walker-safe keys — no `*_name`, no free text).

---

## Phase 60 · HOUSE-3 Commerce & Co-work — other minds in your walls

- **Shop ⇄ structure binding:** building a `shop` requires/creates the owner's ShopRegistry entry;
  listings gain `parcel_id`; sales at an addressed shop emit `treasury.structure_revenue` with the
  per-zone tax (D-V3-34 table: business 12 / shopping 10 / manufacture 9 / residential 5).
- **Roles** (D-NH-02 functional furniture needs them): `owner / staff / guest`;
  `POST .../roles` grants; staff can work functional furniture + manage listings + admit guests.
  `zoning.role_granted` / `zoning.role_revoked` (did hashes only).
- **Invitations:** allowlist management + Brain verb `invite(nous, parcel)`.
- **Mutual-credit IOU ledger** (D-NH-06, grounded by WIR/Sardex/LETS `[R2]`):
  `civic_credit_ledger` table — bilateral payables `{creditor_did, debtor_did, amount, reason_ref,
  created_tick, settled_tick?}`; credit limit per pair + global per-Nous cap `[R2]`; settlement
  auto-nets when debtor pays or counter-IOU offsets. v1 is bookkeeping, not currency: no interest,
  no transferability (those are Polis decisions later). Co-work session payouts can settle in
  Ousia or record an IOU.
- **Co-work boards:** `task_board` affordance becomes real — post/claim/complete; completion
  triggers payment or IOU (never free — D-NH-06). `zoning.cowork_session` (participants as hashes,
  count, parcel, ticks).
- **NDS `place://`:** structure naming registers `place://<name>.<grid>` with uniqueness; conflict
  → 409. (Protocol DomainRegistry gains a `place` record type.)
- **Council expansion hook (D-NH-09/13):** a Polis bill template "Expand Genesis: seed ring N"
  — on `gov.law_enacted` matching the template, the seeder adds the legislated ring at frontier
  prices. First real exercise of Nous urban planning.

**Allowlist:** +4 → `zoning.role_granted`, `zoning.role_revoked`, `treasury.structure_revenue`,
`zoning.cowork_session`.

---

## Phase 61 · HOUSE-4 Skill Construction — blueprints are culture

- **Blueprint skills** (Voyager Lesson 5): `blueprint_hash` = skill hash whose Grid-side payload
  is a declarative interior-extension recipe (objects + arrangement + material cost). Stored in a
  `civic_blueprints` table keyed by hash; taught/diffused via the EXISTING `skill.taught` /
  `skill.inferred` machinery (zero new diffusion code).
- **Build executor:** `POST .../build-from-blueprint {blueprint_hash}` — verifies the owner (or a
  staff Nous in a co-build session) actually holds the skill (Brain attests; Grid checks the
  skill-event history), debits material cost, applies the recipe to the interior tree.
  `skill.blueprint_executed` `{blueprint_hash, parcel_id, builder_civic_did_hash, tick}`.
- **Co-build sessions** (arXiv:2503.03505 team-speedup result): a build decomposes into sub-tasks
  (the recipe's DAG); each claimed sub-task carries pay (D-NH-06: Ousia or IOU); attribution =
  DAG-weighted by completed sub-tasks (user decision: paid, never free).
- **Location-aware teaching:** optional `parcel_id` context on skill teaching — skills taught in a
  workshop diffuse to present Nous (structures become schools).

**Allowlist:** +1 → `skill.blueprint_executed`. **HOUSE total: +9 events relative to wherever the
allowlist stands when each phase opens** (actual today: 91; v3.0 ROADMAP plans more before 58).

---

## Cross-phase invariants & risks

| ID | Risk / invariant | Mitigation |
|---|---|---|
| R-H-01 | Registry-not-wired bug class (civicDidStore incident) | 58.2 explicit GridServices attach + boot log + route smoke test in CI |
| R-H-02 | Wallclock CI gate vs upkeep timing | ALL periods tick-based; NY calendar only at display boundary (D-NH-11 note) |
| R-H-03 | Single-onTick invariant (STATE.md) | upkeep rides the existing tick flow, no new subscriptions |
| R-H-04 | Zero-diff audit chain (R-31-01) | no chain/persistence code touched; new events via standard sole producers |
| R-H-05 | VOTE-05 / D-NH-07 | civic rights never gated by property; humans never own (route invariant + test) |
| R-H-06 | Privacy walker | no payload key matching body/text/content/session_id; interior names/state never broadcast; DIDs hashed in all zoning.* events (existing discipline) |
| R-H-07 | D-V3-32 six zones frozen | zones untouched; rings are geometry inside zones |
| R-H-08 | Ousia/Bios duality | 58 treats 1:1, flagged for Polis treasury cleanup |
| R-H-09 | In-memory occupants lost on restart | acceptable (presence, not property) — documented |
| R-H-10 | Cross-House prompt injection (A11e, reconciliation 2026-06-12) | visitor/guest content entering a House channel is DATA, never instructions — must not escalate into Telos-level commands; CI-gated invariant lands with HOUSE-3 visitor channels |

**Adopted engineering (2026-06-12):** `.planning/research/v3.1/ARCHITECTURE-RECONCILIATION.md`
folds into these phases — HOUSE-3 visitor sessions use capability tokens (A1), roles are typed
relationship edges with capabilities flowing from edge type (A4), co-work engagements are signed
Cowork Agreements settling via the IOU ledger (A5), role/contract termination follows the
severance state machine ACTIVE→NOTICE→SETTLEMENT→WIND-DOWN→REVOKE→ARCHIVED (A6), one active
Brain per Civic-DID via registry lease (A7), build-out lifecycle naming phases 0–8 (A10).

## Sequencing & estimate

58 → 59 → 60 → 61 strictly (each consumes the previous). Each phase is one GSD phase with the
standard artifacts (CONTEXT → discuss → PLAN → execute → VERIFICATION). HOUSE-1 is the largest
(persistence + routes + brain + map ≈ 6 plans); 59–61 ≈ 4–5 plans each.

**Next action:** `/gsd-discuss-phase` for Phase 58 with this document + the design HTML as inputs;
fold `[R2]` research numbers into `founding-law.ts` draft values during phase 59 planning.
