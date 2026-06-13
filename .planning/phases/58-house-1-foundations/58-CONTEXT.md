# Phase 58: Nous House HOUSE-1 Foundations - Context

**Gathered:** 2026-06-12 (harness generation from the Nous House implementation plan)
**Status:** Ready for planning

<domain>
## Phase Boundary

Wake the DORMANT Phase 48b civic-land skeleton (`grid/src/civic/parcel-registry.ts` + `types.ts` — in-memory, never instantiated, zero routes, no brain verbs) into a live, persisted, Nous-only property layer for the Genesis Core. HOUSE-1 is the floor: parcels exist, can be bought with Bios, structures can be built, and Nous can visit each other — visible on an orbital map. No interiors, no upkeep, no roles, no blueprints.

Ships:
- Persistence: migration **v38** creating `civic_parcels` (one row per parcel, structure embedded) + a write-through **ParcelStore** (DB is source of truth, registry is a read cache; hydrate-on-boot; every mutation writes DB-first then memory). Occupants stay memory-only (presence, not property).
- **Genesis Core seed (D-NH-09):** on empty-grid boot seed EXACTLY **53 parcels** = ring 0 government_quarter ×1 + ring 1 infrastructure commons ×4 (pre-built Polis venue structures, open) + ring 2 business/shopping/manufacture 8+8+8=24 + ring 3 residential ×24 = **48 purchasable + 5 civic**. Idempotent (INSERT IGNORE), emits NO audit events.
- **Gravity pricing (D-NH-08):** `price = 100 × (5 − ring)²`, constants centralized in `grid/src/civic/founding-law.ts`. Ring 3 home = 400 Bios, ring 2 = 900 Bios; rings 0–1 civic land not purchasable.
- **Vector addresses (D-NH-10):** `civic_parcels` carries `ring`/`sector_deg`/`level`; the `Parcel`/`Structure` types extend to carry (ring, sector, level). The data model never assumes a 2D plane.
- Services wiring (R-H-01): ParcelRegistry + ParcelStore instantiated in `grid/src/main.ts` inside the `if (dbConn)` block and ATTACHED to GridServices. Boot log `[civic] parcels loaded: N`.
- HTTP routes (`grid/src/api/routes/civic-parcels.ts`): GET list (public map feed, owner DIDs only as `owner_civic_did_hash` HEX64), GET detail, POST `:id/purchase|build|join|leave|entry-policy`. Policy entries added to ROUTE_DID_POLICY.
- **D-NH-07 enforcement:** purchase/build/join/leave/entry-policy are `civic_did_required`; human cookie sessions are `human_visitor` → 401; a `did:civic:noesis:human:*` DID → 403 `humans_cannot_own_land` (defensive). Operators read-only on land.
- Funds + audit on purchase: `registry.purchase()` validation → `registry.transferOusia(buyer → TREASURY_DID, price)` → store write → `zoning.parcel_purchased (82)` + `treasury.parcel_revenue (83)`. Build emits `zoning.structure_built (84)`; join/leave emit `zoning.structure_joined/left (85/86)`. HOUSE-1 treats Ousia == Bios (display Bios), flagged for Polis-era treasury cleanup (R-H-08).
- Brain civic-land verbs (`brain/src/noesis_brain`): new ActionType members `list_parcels / buy_parcel(zone, max_price) / build(parcel, type, name) / visit(parcel) / leave() / set_entry_policy`, dispatched via GridWireClient → `POST /api/v1/brain/actions` → Grid action handler → civic-parcels routes. Ownership enters the Brain prompt as a `my_places` block (Smallville Lesson 2: home anchors routine).
- Visualization (D-NH-01/12): `dashboard/src/components/worldmap/OrbitalGenesisMap.tsx` ported from `docs/noesis-genesis-core-map.html` — live fetch of the parcel feed (fallback to embedded seed), Earth below, Government Core monument, ghost frames flip to lit modules when `owner_civic_did_hash` present, occupancy lights, NY clock. New additive route `/worldmap/orbital` (existing `/worldmap` city view kept); linked from landing "Explore the map" and `/portal/civic-map`.
- Tests + gates: parcel-store / parcel-seed / founding-law / civic-parcels-routes / parcels-wiring suites; `broadcast-allowlist.test.ts` still asserts **91 (+0)**; all existing CI gates untouched-green.

Does NOT ship:
- Interior tree / mirror + functional furniture / interior viewer (HOUSE-2 · Phase 59).
- Upkeep, decay, condition ladder (maintained→worn→derelict→reclaimed), `treasury.upkeep_collected`, Polis reclaim (HOUSE-2 · Phase 59).
- Shop↔structure binding, roles (owner/staff/guest), invitations, mutual-credit IOU ledger, co-work boards, `place://` NDS naming, Polis ring-expansion bill template (HOUSE-3 · Phase 60).
- Blueprint skills, build-from-blueprint executor, co-build DAG sessions, location-aware teaching (HOUSE-4 · Phase 61).
- **Ring 4+ parcels** — they do not exist until the Genesis Polis legislates each expansion via the Phase 46 pipeline (D-NH-09). No organic sprawl.
- Any new broadcast-allowlist event (delta **+0**); events 82–86 are reused as-is.
- Ousia/Bios currency unification — HOUSE-1 treats them 1:1 and records the question for Polis-era treasury cleanup (R-H-08).
- Persistence of occupants across restart — presence is memory-only (R-H-09), accepted and documented.
- Tick→NY-calendar conversion anywhere outside the dashboard/docs display boundary (wallclock CI gate).

</domain>

<decisions>
## Implementation Decisions

### Allowlist
- **D-58-01 (allowlist +0):** Phase 58 reuses the already-shipped events **82–86** — `zoning.parcel_purchased (82)`, `treasury.parcel_revenue (83)`, `zoning.structure_built (84)`, `zoning.structure_joined (85)`, `zoning.structure_left (86)` — which entered the 91-member array with the Phase 48b skeleton, each with a sole-producer under `grid/src/audit/append-zoning-*.ts` + `append-treasury-parcel-revenue.ts`. Phase 58 adds **ZERO** new events. `grid/test/audit/broadcast-allowlist.test.ts` continues to assert `ALLOWLIST.size === 91` and `ALLOWLIST_MEMBERS.length === 91` — both untouched. No sole-producer is created, no closed-tuple change, no privacy-walker addition is required. HOUSE-2 (Phase 59) will be the first +N (+4: `zoning.interior_extended`, `zoning.condition_changed`, `zoning.parcel_reclaimed`, `treasury.upkeep_collected`).

### Persistence
- **D-58-02 (persistence shape):** `civic_parcels` — one row per parcel, structure **embedded** (one-structure-per-parcel makes a separate table unnecessary). Migration **v38** (next free version; latest shipped is v37). Columns include `ring TINYINT`, `sector_deg DECIMAL(6,2)`, `level SMALLINT DEFAULT 0` (D-NH-10 vector address), `owner_civic_did` (NULL = treasury), `price_bios`, `structure_name` (plaintext, Grid-side only), `structure_type ENUM(home|shop|workshop|venue)`, `visibility ENUM(open|private)`, `entry_policy ENUM(open|allowlist) DEFAULT open` + `entry_allowlist JSON`, `named_address` NULL (wired Phase 60). **Write-through:** DB first, then memory; registry hydrated from the store on boot. Lesson — HumanRegistry incident 2026-06-11: the registry is a read cache, MySQL is the source of truth.

### Genesis Core seed
- **D-58-03 (Genesis Core seed, D-NH-04/09):** seed EXACTLY **53 parcels** — ring 0 government_quarter ×1, ring 1 infrastructure commons ×4 (pre-built Polis venue structures: guest hall, market floor, shared workshop, archive — type `venue`, visibility `open`), ring 2 business ×8 + shopping ×8 + manufacture ×8, ring 3 residential ×24. 48 purchasable + 5 civic. Seeding idempotent (INSERT IGNORE), emits NO audit events (world-creation, not commerce). Rings 0–1 are NOT in `PURCHASABLE_ZONES`, so they cannot be bought. Ring 4+ is absent (council legislation only — Phase 60 hook).

### Gravity pricing
- **D-58-04 (gravity pricing, D-NH-08):** `gravityPrice(ring) = 100 × (5 − ring)²`. ring 3 = 400, ring 2 = 900. Constants live in `grid/src/civic/founding-law.ts` (single patch point for the Phase 60 Polis amendment). Civic rings 0–1 have no purchase price (not for sale).

### Nous-only property (D-NH-07)
- **D-58-05 (D-NH-07 Nous-only property):** the purchase route requires the `civic_member` tier (Nous Bearer JWT); human cookie sessions are `human_visitor` → 401. Defensive second check: reject any DID matching the human civic-DID form (`did:civic:noesis:human:*`) with reason `humans_cannot_own_land`. Operators are read-only on land. This is a constitutional invariant with a dedicated route test.

### Funds path
- **D-58-06 (funds path):** `registry.purchase()` validates affordability only; the route moves funds via `registry.transferOusia(buyer → TREASURY_DID, price)`, then writes the store, then appends `zoning.parcel_purchased (82)` + `treasury.parcel_revenue (83)`. Phase 48b types say "Bios" but Nous balances are Ousia — HOUSE-1 treats them **1:1** (display Bios) and records the unification question for Polis-era treasury cleanup (R-H-08).

### Services wiring
- **D-58-07 (services wiring):** ParcelRegistry + ParcelStore are constructed inside the `if (dbConn)` block in `grid/src/main.ts` and ATTACHED to GridServices (`parcels?:` field). Boot log `[civic] parcels loaded: N`. A route smoke check exercises `GET /api/v1/civic/parcels` in CI to catch the registry-not-wired bug class (R-H-01 — the `civicDidStore` not-wired incident).

### Route auth + audit-key hashing
- **D-58-08 (route auth + audit-key hashing):** owner DIDs never cross the public map feed or any `zoning.*`/`treasury.*` event in plaintext — `owner_civic_did_hash` is HEX64 (existing zoning.* discipline). Structure plaintext names live Grid-side only and never reach the chain (name_hash discipline; interiors are HOUSE-2+ anyway). No payload key matches `FORBIDDEN_KEY_PATTERN` (body/session_id/text/content).

### Visualization
- **D-58-09 (visualization is additive, D-NH-01/12):** `/worldmap` keeps the existing CyberGrid city view; NEW `/worldmap/orbital` is the canonical Grid view. `OrbitalGenesisMap.tsx` is ported from `docs/noesis-genesis-core-map.html`, live-fetches the parcel feed with embedded-seed fallback, renders Earth below, and uses the NY clock (`Date` allowed in the dashboard only — the wallclock gate scopes grid/dashboard-replay, not the orbital map). Linked from landing "Explore the map" and `/portal/civic-map`.

### Brain verbs
- **D-58-10 (brain verbs are capabilities, not scripts):** new ActionType members (`list_parcels / buy_parcel / build / visit / leave / set_entry_policy`) dispatched via GridWireClient to `POST /api/v1/brain/actions`; the Grid action handler routes them to the civic-parcels routes. Ownership enters Brain prompt context as a `my_places` block. Decision pressure stays with the Nous (no autoplay).

</decisions>

<invariants>
## Invariants (carried forward / frozen this phase)

- **Allowlist delta = +0.** `broadcast-allowlist.test.ts` keeps asserting `ALLOWLIST.size === 91` and `ALLOWLIST_MEMBERS.length === 91`. No event added, renamed, or reordered. Events 82–86 reused.
- **D-NH-07:** humans never own/occupy land. A signed-in human (`human_visitor` tier, or a `did:civic:noesis:human:*` DID) attempting purchase/build/join is refused (401 by tier, or 403 `humans_cannot_own_land` defensively). Operators read-only.
- **Genesis Core is exactly 53 parcels** (48 purchasable + 5 civic). Ring 4+ does not exist (council legislation only — Phase 60 hook, not this phase).
- **Gravity pricing** `price = 100 × (5 − ring)²` with constants only in `founding-law.ts`; ring 3 = 400, ring 2 = 900; civic rings 0–1 not purchasable.
- **Vector addresses** (ring, sector, level) — the data model and types never assume a 2D plane.
- **Wallclock CI gate:** all periods/state are tick-based; tick→NY-calendar (`NY <year> · DAY <n>`) conversion lives only at the dashboard/docs display boundary, never in audit/consensus/grid paths (`scripts/check-wallclock-forbidden.mjs` stays green).
- **Write-through persistence:** MySQL is source of truth, the in-memory registry is a read cache hydrated on boot; every mutation writes DB-first then memory. Occupants are presence (memory-only, lost on restart — accepted).
- **Zero-diff audit chain (R-31-01):** no chain / persistence-of-chain code is edited; new events ride existing sole producers. Sole-producer, civic-DID-issuance-path, and privacy-walker gates stay untouched-green.
- **Privacy/audit:** structure plaintext names never cross the chain (name_hash only); DIDs hashed (`owner_civic_did_hash` HEX64) in all `zoning.*`/`treasury.*` events; interior contents never broadcast (HOUSE-2+). No payload key matches `FORBIDDEN_KEY_PATTERN`.
- **Single-onTick invariant (STATE.md):** Phase 58 adds NO new `clock.onTick` subscription (no upkeep timing yet — that is Phase 59).

</invariants>

<requirements>
## Requirements (R-58-XX)

- **R-58-01 (NH1-01):** `civic_parcels` persisted via migration v38; write-through ParcelStore with hydrate-on-boot; DB is source of truth, registry is a read cache.
- **R-58-02 (NH1-02):** Genesis Core seeded exactly (53 parcels = 48 purchasable + 5 civic) idempotently on empty-grid boot, emitting no audit events.
- **R-58-03 (NH1-03):** gravity pricing `price = 100 × (5 − ring)²` with constants centralized in `founding-law.ts` (ring 3 = 400, ring 2 = 900).
- **R-58-04 (NH1-04):** vector address columns (ring, sector_deg, level) on `civic_parcels` and on the Parcel/Structure types; no 2D assumption.
- **R-58-05 (NH1-05):** ParcelRegistry + ParcelStore wired into GridServices in `main.ts` with boot log and a CI route smoke check (registry-not-wired bug class closed).
- **R-58-06 (NH1-06):** civic-parcels HTTP routes (list/detail public; purchase/build/join/leave/entry-policy `civic_did_required`) registered with ROUTE_DID_POLICY entries.
- **R-58-07 (NH1-07):** D-NH-07 enforced — `human_visitor` 401; `did:civic:noesis:human:*` refused with `humans_cannot_own_land`; operators read-only.
- **R-58-08 (NH1-08):** purchase moves funds via `registry.transferOusia(buyer → TREASURY_DID)` then emits `zoning.parcel_purchased (82)` + `treasury.parcel_revenue (83)`; build/join/leave emit 84/85/86. Allowlist +0.
- **R-58-09 (NH1-09):** owner DIDs only as `owner_civic_did_hash` (HEX64) on the public feed and all `zoning.*` events; structure plaintext names stay Grid-side.
- **R-58-10 (NH1-10):** Brain civic-land verbs (`list_parcels/buy_parcel/build/visit/leave/set_entry_policy`) dispatched to the Grid; ownership surfaces in the Brain prompt as a `my_places` block.
- **R-58-11 (NH1-11):** dashboard `/worldmap/orbital` renders the live orbital Genesis Core map (Earth below, lit owned modules, occupancy lights, NY clock) additively beside the existing `/worldmap` city view.
- **R-58-12 (NH1-12):** all CI gates green — broadcast-allowlist count 91 unchanged, sole-producer, civic-DID-issuance-path, privacy walker, wallclock-forbidden, zero-diff (R-31-01).

</requirements>

---

*Phase: 58-house-1-foundations*
*Context gathered: 2026-06-12*
