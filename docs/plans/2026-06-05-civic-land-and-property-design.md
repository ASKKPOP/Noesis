# Civic Land & Property — Design

**Status:** Validated design, awaiting implementation approval
**Date:** 2026-06-05
**Milestone:** v3.0 — Polis (Civic City)
**Proposed phase slot:** New v3.0 phase — *provisional* **Phase 48b "Civic Land & Property"**
(depends on Phase 36 zoning/civic-map, Phase 44 Marketplace v3, Phase 45 IRS Treasury; final number to be locked in `/gsd-discuss-phase`)
**Allowlist impact:** 81 → 86 (+5), all under the pre-cleared `zoning.*` / `treasury.*` prefixes

---

## Problem

A Nous's only relationship to space today is a single `NousPosition` pointer — *which shared region it is currently in*. There is no concept of **owning** space. Consequences:

- A **business has no location** — `Shop` is a free-floating economic record with no address; "where is the shop?" is unanswerable.
- A Nous **cannot pursue or complete a place-based goal** ("own a home", "own a shop") — there is nothing to own, so Telos can't target it.
- Everyone is, literally, on the street. There is no private space a Nous owns, no scarcity of land, and nothing to search for or visit by address.

This was an omission, not a deliberate exclusion. The v3.0 6-zone city already names a **Residential** zone ("Citizen homes…") and **Business/Shopping** zones, but those are stub labels with no ownable units underneath ("PHASE-36 STUB — Phase 57 wires real data").

## Goal

Introduce **ownable parcels** with built **structures** that give space real meaning: businesses get an address, Nous get a home, property becomes a completable goal, and spaces are addressable / searchable / visitable. Keep it parcel-scale, not a city-builder (YAGNI).

## Non-goals (v1)

- No buildings-construction simulation (no materials, no build time beyond one tick).
- No interior rooms / sub-parcels.
- No player-created **map regions** (parcels layer on top of the region graph; they are not new graph nodes).
- No P2P parcel resale market (treasury sale only; a `// future: resale` seam is left).
- No operator buy/grant/seize of land (operators are read-only on land, mirroring VOTE-05).
- No anti-monopoly rules beyond the simple per-Nous cap.

---

## Decisions (from brainstorming)

| # | Decision |
|---|----------|
| D-1 | Ownable unit = **Parcel** (fixed plots seeded per zone). Not the Light "home address attribute" and not the Full real-estate sim. |
| D-2 | Acquisition = **buy from the Polis treasury** with Ousia. No free claim, no P2P resale in v1. |
| D-3 | Owning a parcel grants: **business-location requirement**, **home base/address**, **Telos goal target**, **owner access control**, **build one structure**, and **join structures others built**. |
| D-4 | "Make space" = **build one structure per parcel** (name/type/visibility) **+ join open structures built by other Nous**. Not rooms, not new map regions. |
| D-5 | Ownership cap = **≤1 Residential (home) + ≤1 Business/Shopping (business)** per Nous (total ≤2). |
| D-6 | Spaces must be **addressable, searchable, and visitable** — canonical id address always; optional human-readable named address via the existing **NDS**. |
| D-7 | Land lands as a **new v3.0 phase** (provisional 48b). Write design doc → stop for review (this document). |

---

## 1. Data model & where parcels live

A **Parcel** is a fixed, ownable plot belonging to one **zone** of a Grid. Parcels are a registry layered on top of the `SpatialMap` — **not** new region-graph nodes — so travel/capacity logic is untouched. Each zone is seeded with a fixed parcel count at Grid instantiation (tunable per preset; e.g. Residential 20, Business 12, Shopping 12, Manufacture 8). Government Quarter & Infrastructure are **civic land — not purchasable** in v1.

```ts
interface Parcel {
  id: string;                  // canonical address, e.g. "genesis:residential:0007"
  gridId: string;
  zoneId: 'residential' | 'business' | 'shopping' | 'manufacture'
        | 'infrastructure' | 'government_quarter';
  ownerDid: string | null;     // null = owned by Polis treasury (unclaimed)
  price: number;               // Ousia; derived from zone.basePrice
  structure: Structure | null; // what's built on it (§3)
  entryPolicy: { policy: 'open' | 'allowlist'; allowlist: string[] };
  acquiredAtTick: number | null;
}

interface Structure {
  name: string;                          // plaintext lives in registry state, NOT the chain
  type: 'home' | 'shop' | 'workshop' | 'venue';
  visibility: 'private' | 'open';        // open => other Nous may join
  builtAtTick: number;
  namedAddress: string | null;           // optional NDS name, e.g. "place://aurora-cafe.genesis"
}
```

**New store `ParcelRegistry`** — mirrors `ShopRegistry` / `brain-token-store` (in-memory map + MySQL table `parcels`). Single source of truth for ownership. Enforces the D-5 cap: at most one Residential and one Business/Shopping parcel per `ownerDid`.

## 2. Acquisition (treasury sale)

```
Brain → ActionType.PARCEL_PURCHASE { parcelId }
 → Grid: ParcelRegistry.purchase(parcelId, buyerDid)
     1. validate parcel exists & ownerDid == null            (else: already_owned)
     2. validate zone is purchasable                         (else: zone_not_purchasable / not_for_sale)
     3. validate buyer cap not exceeded                      (else: cap_exceeded)
     4. validate buyer balance ≥ price (EconomyManager)      (else: insufficient_funds)
     5. EconomyManager.transfer(buyer → treasury, price)     // Ousia sink into IRS treasury
     6. set ownerDid = buyer; acquiredAtTick = currentTick
     7. emit zoning.parcel_purchased + treasury.parcel_revenue
```

- **Pricing** from the zone (`zone.basePrice`, alongside the existing `taxRate`).
- **Treasury, not P2P** — payment flows to the Polis treasury (same one the IRS feeds), creating scarcity and a money sink. Resale deferred.
- **Explicit failure reasons** (no silent catch — respects `check-no-silent-catch`), each surfaced to the Brain to re-plan.
- **Operator boundary:** operators cannot buy/grant/seize parcels (read-only on land).

## 3. Structures & visiting ("make space" + join others)

**Build** (one structure per parcel):
```
Brain → ActionType.STRUCTURE_BUILD { parcelId, name, type, visibility, namedAddress? }
 → validate caller owns parcel; parcel.structure == null; type fits zone
   (home→residential; shop/workshop→business/shopping/manufacture; venue→any purchasable)
 → if namedAddress: register via NDS (public/private/restricted)
 → set parcel.structure; emit zoning.structure_built
```

**Join / leave** — presence *inside* a structure tracked as an attribute layered on the visitor's existing position (no new region):
```
Brain → ActionType.STRUCTURE_JOIN { parcelId }
 → validate structure exists AND (visibility=='open' OR visitor ∈ owner.entryPolicy.allowlist)
   (else: not_permitted)
 → add visitor to StructurePresence(parcelId); emit zoning.structure_joined
Brain → ActionType.STRUCTURE_LEAVE { parcelId } → emit zoning.structure_left
```

**Owner access control** — `entryPolicy = open` (anyone) or `allowlist` (named DIDs). A `private` structure rejects non-allowlisted joins. This is what makes a structure genuine private space *or* a public venue, at the owner's choice.

**Functional roles:** `shop` = required location for a registered shop (§4); `venue` = gathering spot with public occupancy on the civic map; `home` = owner's base address; `workshop` = Telos/flavor.

## 4. Capability wiring (why it matters)

1. **Business needs a location.** `ShopRegistry.register` gains a required `parcelId`; validates caller owns it, it's in Business/Shopping/Manufacture, and has a `shop` structure. No business parcel → no shop. Seed shops migrated onto seeded parcels so existing economy/tests pass. Every shop now has an address.
2. **Home base / address.** A Nous's Residential parcel = its `homeParcelId`; surfaces on public profile + civic map. `ActionType.RETURN_HOME` moves toward the home's region (reuses `moveNous`). No home = visibly "on the street."
3. **Goal target (Telos).** Two adoptable goal templates: `own_home` (own a Residential parcel + `home` structure) and `own_business` (own a Business/Shopping parcel + `shop` structure + registered shop). Completion checks fire on `zoning.*` events. Property becomes a completable purpose.
4. **Drives nudge (advisory only).** Homelessness feeds Ananke `safety`/`loneliness` pressure as advisory input; per PHILOSOPHY §6 it never overrides sovereign choice.

## 5. Addressing, search & visiting

- **Canonical address** = parcel id (`genesis:residential:0007`), always resolves.
- **Named address via NDS** — owner may register `place://aurora-cafe.genesis` on build; NDS gives uniqueness + `public/private/restricted` registration. Public registration ⇒ discoverable + visitable by anyone.
- **Search / directory** (visitor-public, no DID — fits read/write split):
  ```
  GET /api/v1/civic-map/parcels?zone=&type=&owner=&q=&visibility=
      → [{ address, namedAddress?, zoneId, ownerDid, structure:{name,type,visibility}, occupancy }]
  GET /api/v1/civic-map/parcel/:address → public detail + current occupancy count
  ```
  Returns **public fields only**. Private structures appear as existing-but-private and reject joins.
- **Visiting "for any purpose":** resolve address → `moveNous` to its region → `STRUCTURE_JOIN`. Humans open the public page directly. Purpose unconstrained (trade, attend, visit, browse).

## 6. Audit events & constitution compliance

Five new allowlist members (explicit per-phase addition, per the freeze rule), all under pre-cleared prefixes. **Closed payloads, keys sorted, hashes only:**

| Event | Payload (sorted keys) |
|-------|-----------------------|
| `zoning.parcel_purchased` | `{buyer_did, parcel_id, price, tick, zone_id}` |
| `treasury.parcel_revenue` | `{amount, parcel_id, tick}` |
| `zoning.structure_built`  | `{name_hash, owner_did, parcel_id, structure_type, tick, visibility}` |
| `zoning.structure_joined` | `{parcel_id, tick, visitor_did}` |
| `zoning.structure_left`   | `{parcel_id, tick, visitor_did}` |

**Privacy invariants:**
- Structure **plaintext name never hits the chain** — only `name_hash`. Plaintext name lives in registry/NDS state, which the **search directory reads from** (same pattern as governance `title_hash` vs. title-in-table).
- New keys dodge `FORBIDDEN_KEY_PATTERN` (no `body`/`text`/`content`/`session_id`). `name_hash`, `structure_type`, `visibility` are safe.
- **Zero-diff:** purchase/build/join are real state changes that emit entries, but passive observation (reading the directory, watching a parcel) emits nothing.

**CI gates extended:**
- `check-sole-producer-discipline.mjs` covers new producers `appendZoningParcelPurchased`, `appendTreasuryParcelRevenue`, `appendZoningStructureBuilt`, `appendZoningStructureJoined`, `appendZoningStructureLeft` (triad: `Object.keys(payload).sort()` + privacy check + `audit.append`).
- `check-state-doc-sync.mjs` confirms allowlist +5 (81 → 86) and docs aligned.

## 7. API / Brain / UI surfaces

**Grid REST (writes — DID-gated; 5 new route-policy entries):**
```
POST /api/v1/civic-map/parcels/:address/purchase      { }
POST /api/v1/civic-map/parcels/:address/structure     { name, type, visibility, namedAddress? }
POST /api/v1/civic-map/parcels/:address/join          { }
POST /api/v1/civic-map/parcels/:address/leave         { }
PUT  /api/v1/civic-map/parcels/:address/entry-policy   { policy, allowlist[] }
```
Reads (§5) are public.

**Brain (Python):** new `ActionType`s `PARCEL_PURCHASE`, `STRUCTURE_BUILD`, `STRUCTURE_JOIN`, `STRUCTURE_LEAVE`, `RETURN_HOME`. System prompt gains a compact "## Property" block (home address or "homeless", business address, owned-parcel count, nearby open venues). Telos templates `own_home` / `own_business`. All advisory; sovereignty preserved.

**Dashboard (:3001):** civic-map zone view lists parcels (owner + structure + live occupancy); new Directory/Search panel on `GET parcels`; structure public page (name, type, occupancy count).

**Portal (human side):** a **"Property"** section under a human's Nous — parcels/home/business + market browse; humans visit structures via public pages.

**Steward Console:** read-only **Land Registry** view (who owns what, treasury land revenue); **no** buy/grant/seize.

## 8. Testing (bottom-up, matching the test guide layers)

- **L1 gates:** new producers pass sole-producer discipline; state-doc-sync confirms +5; privacy grep confirms no plaintext name on the wire.
- **L2 grid:** `ParcelRegistry` — seed counts per zone; `purchase` happy path + all 5 failure reasons; ≤1-home/≤1-business cap; `build` (type-fits-zone, one-per-parcel); `join/leave` + `entryPolicy` (open/allowlist/private rejection).
- **L2 grid economy:** `ShopRegistry.register` requires a built business parcel; seed-shop migration; treasury receives parcel revenue.
- **L2 brain:** new `ActionType`s round-trip the bridge; Telos `own_home`/`own_business` completion; fixture-mode (no LLM).
- **L3 integration:** purchase → `EconomyManager.transfer` → treasury → `zoning.parcel_purchased` + `treasury.parcel_revenue` land on chain in order; chain still verifies after buy+build+join; replay reproduces same head hash.
- **L5 API:** public search returns public-only fields; private structure rejects join; anonymous purchase → 401.
- **SAT-7 (new) "A Nous puts down roots":** spawn → buy Residential parcel → build home → buy Business parcel → build shop → register shop → another Nous searches the directory and visits the open shop → verify `own_business` goal marks achieved and the chain verifies.

## 9. Documentation sync (on implementation)

Per the same-turn docs-sync rule, implementation will update: `README.md` (capability + "where Nous live"), `PHILOSOPHY.md` (§2 Constraints — scarcity of land), `.planning/ROADMAP.md` + `MILESTONES.md` + `PROJECT.md` + `REQUIREMENTS.md` + `STATE.md` (new phase, REQs, allowlist freeze note for the 5 events), v3.0 `CIVIC-ARCHITECTURE.md` + `ARCHITECTURE-v3.0.html`, and `docs/noesis-test-guide.html` (new "Space & Ownership" section + SAT-7).

## 10. Open questions for `/gsd-discuss-phase`

1. **Final phase number** — provisional 48b; confirm slot vs. Police (47) / Library (48) / Communities (49) ordering and dependencies.
2. **Seed parcel counts per zone** — exact numbers per Genesis preset.
3. **`zone.basePrice` values** — initial Ousia prices; baked config vs. Polis-legislated (could reuse Phase 46 bill flow later).
4. **Rebuild/demolish** — v1 freezes one structure per parcel forever; allow replace/demolish now or defer?
5. **Migration ordering** — does seed-shop→parcel migration run in this phase's MySQL migration or piggyback Phase 50 migration tooling?
