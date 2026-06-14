# Phase 59: Nous House HOUSE-2 Interiors & Upkeep - Context

**Gathered:** 2026-06-13 (harness generation from the Nous House implementation plan, §59.1–59.3)
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 58 HOUSE-1 made parcels EXIST (persisted, purchasable, buildable, visitable, mapped). HOUSE-2 makes houses **LIVE** and **COST something**: a Nous can furnish an interior (D-NH-02), and ownership now carries an ongoing **upkeep** burden (D-NH-03) that — if unpaid — walks the structure down a condition ladder (maintained → worn → derelict) and ultimately **reclaims** the parcel back to the treasury for resale. Build on the Phase 58 foundation; never rewrite it.

Ships:
- **Persistence (migration v39):** ALTER `civic_parcels` ADD `structure_interior JSON NULL` + `condition ENUM('maintained','worn','derelict') NOT NULL DEFAULT 'maintained'` + `last_upkeep_tick INT UNSIGNED NULL` + `missed_periods TINYINT UNSIGNED NOT NULL DEFAULT 0`. Down migration drops the four columns. `ParcelStore` gains `persistInterior` / `persistCondition` / `persistUpkeep` / `persistReclaim` writers (DB-first then memory) and `hydrate()` reads the new columns. Same write-through discipline as v38. v39 is the next free version after shipped v38.
- **Furniture catalog (`grid/src/civic/furniture.ts`):** a frozen v1 catalog. **mirror** class (render-only, near-zero cost, valid ONLY in the owner's own `home`): `bed, closet, shelf, kitchen, bathroom, decor`. **functional** class (declares affordances, usable per role): `work_desk, sim_board, meeting_table, game_table, task_board, skill_terminal, shop_counter`. Each entry declares `{kind, class, affordances:[]}`. `isValidFurniture(kind, structureType)` is the single validation gate (mirror only in home).
- **Interior tree (D-NH-02, Smallville-shaped):** the `Structure` type carries `interior?: {areas:[{name, objects:[{kind, class:'mirror'|'functional', state?}]}]}`. `ParcelRegistry.extendInterior(address, ownerDid, {area, kind})` validates against the catalog + structure-type fit and mutates the tree. The interior tree lives **Grid-side ONLY** — never serialized onto the audit chain.
- **Routes (extend `grid/src/api/routes/civic-parcels.ts`):** `POST /api/v1/civic/parcels/:id/interior/extend` (`civic_did_required` + owner; validates catalog; emits `zoning.interior_extended`); `GET /api/v1/civic/parcels/:id/interior` (entry-policy-gated: owner always; visitors only if structure open OR allowlisted; **derelict structures closed to all visitors**; humans never see private interiors). New `ROUTE_DID_POLICY` entries.
- **Upkeep founding-law constants (`grid/src/civic/founding-law.ts`, single patch point, Polis-amendable in Phase 60):** `UPKEEP_PERIOD_TICKS = 10080`, `UPKEEP_RATE_BPS = 200` (2% of `price_bios` per period), `RECLAIM_GRACE_PERIODS` mapping (worn at 1 missed, derelict at 2 missed, reclaim at 3 missed). `upkeepDue(parcel)` = `floor(price_bios * UPKEEP_RATE_BPS / 10000)`.
- **Tick-driven upkeep scanner (`grid/src/civic/upkeep-scanner.ts`):** `onUpkeepTick(tick)` called fire-and-forget from the **EXISTING** `clock.onTick` block in `grid/src/genesis/launcher.ts` (~line 468), exactly mirroring the `governance.onTickClosed(event.tick)` precedent at line 484 — **NO new `clock.onTick` subscription**. Lazy period-boundary assessment: for each owned, non-commons parcel whose `last_upkeep_tick` is a full `UPKEEP_PERIOD_TICKS` behind, auto-debit owner Ousia → `TREASURY_DID` via `registry.transferOusia` and emit `treasury.upkeep_collected`; on insufficient funds advance the condition ladder and emit `zoning.condition_changed`; at the reclaim threshold transfer ownership back to treasury, raze the structure, and emit `zoning.parcel_reclaimed`.
- **Condition ladder state machine on `ParcelRegistry`:** maintained → worn (1 missed period) → derelict (2 missed, structure CLOSED to visitors: GET interior + join refuse) → reclaimed (3 missed: ownership returns to `TREASURY_DID` for resale, interior + structure razed, occupants ejected, condition reset to maintained on the now-treasury parcel). Paying upkeep resets `missed_periods=0` and condition to `maintained`. Polis Commons (rings 0–1, treasury-owned, `owner_civic_did` NULL) are EXEMPT from upkeep entirely.
- **Four NEW sole-producer audit events (allowlist 91 → 95):** `zoning.interior_extended`, `zoning.condition_changed`, `zoning.parcel_reclaimed`, `treasury.upkeep_collected`. Each gets a dedicated `grid/src/audit/append-*.ts` cloning the `append-treasury-parcel-revenue.ts` / `append-zoning-structure-built.ts` triad (closed-tuple `Object.keys(payload).sort()` check + explicit no-spread reconstruction + `payloadPrivacyCheck` + `audit.append` with a hashed/parcel `actorDid`). **Interior CONTENTS never broadcast** — only `object_kind`/`object_class` enums + counts/hashes.
- **broadcast-allowlist:** append the 4 members to `ALLOWLIST_MEMBERS` with sole-producer reference comments under the pre-cleared `zoning.*` / `treasury.*` prefixes; `broadcast-allowlist.test.ts`: every `.toBe(91)` → `.toBe(95)` and add presence assertions for the 4 new members.
- **Brain verbs (`brain/src/noesis_brain`):** add `extend_interior(area, kind)` and `view_interior(parcel)` capabilities to `rpc/types.py` `ActionType` + `wire/client.py` dispatch; surface house condition (maintained/worn/derelict) and pending upkeep cost in the `my_places` prompt block (`prompts/system.py`) so the Nous feels upkeep pressure. Capabilities, not scripts — no autoplay.
- **Dashboard interior viewer:** `dashboard/src/components/worldmap/OrbitalGenesisMap.tsx` — click an owned/open module → interior view rendering the interior tree (mirror furniture as static meshes, functional furniture highlighted); condition shown as a visual state (maintained/worn/derelict styling); humans browse only entry-policy-permitted open structures, exteriors otherwise; derelict structures show closed. Route under `dashboard/src/app/worldmap/orbital`.
- **Tests + gates:** furniture-catalog, interior-extend (catalog validation + mirror-only-in-home), interior-view (entry-policy + derelict gating), upkeep-scanner (period-boundary debit, ladder advance on missed payment, reclaim at threshold, commons exempt, single-onTick), 4 sole-producer unit suites, broadcast-allowlist at **95**, and a HOUSE-2 e2e. All existing gates green: sole-producer-discipline, civic-did-issuance-path, wallclock-forbidden, privacy walker, zero-diff R-31-01.

Does NOT ship:
- Shop↔structure binding, ShopRegistry `parcel_id`, per-zone `structure_revenue` tax, roles (owner/staff/guest), invitations, mutual-credit IOU ledger, co-work boards/sessions, `place://` NDS naming, Polis ring-expansion bill template (all HOUSE-3 · Phase 60).
- Blueprint skills, `civic_blueprints` table, build-from-blueprint executor, co-build DAG sessions, location-aware teaching (HOUSE-4 · Phase 61).
- Polis legislative AMENDMENT of upkeep rate / period / grace (D-NH-03 amendability) — Phase 59 fixes the rates in `founding-law.ts` as the single patch point; the Polis amendment hooks land in Phase 60. Phase 59 ships founding-law defaults only.
- Open furniture catalog / user-defined furniture kinds — the v1 catalog in `furniture.ts` is closed (mirror 6 + functional 7); new kinds are a later phase.
- Functional-furniture affordance EXECUTION (working a task_board, billing at a work_desk, sales at a shop_counter) — Phase 59 only models the affordance declarations; using them is HOUSE-3 roles + co-work.
- Interior contents on the audit chain — interiors are the Nous's sovereign Grid-side space; only `object_kind`/`object_class` + counts ever cross the boundary, never names/state/arrangement.
- Ring 4+ parcels and any new-Grid flow — geometry frozen at the 53-parcel Genesis Core (D-NH-09 council legislation only).
- New broadcast-allowlist events beyond the 4 named (delta is exactly +4 → 95).
- Ousia/Bios currency unification — still treated 1:1 (display Bios), flagged for Polis-era treasury cleanup (R-H-08).
- A new `clock.onTick` subscription — upkeep rides the existing single tick callback in `launcher.ts` (R-H-03 single-onTick invariant).
- Tick→NY-calendar conversion outside the dashboard display boundary (wallclock CI gate).

</domain>

<decisions>
## Implementation Decisions

### Allowlist
- **D-59-01 (allowlist +4 → 95):** Phase 59 is the **FIRST HOUSE phase to add events**. `ALLOWLIST_MEMBERS` grows from 91 to 95 with four members under the pre-cleared `zoning.*` / `treasury.*` prefixes. `broadcast-allowlist.test.ts` updates every `.toBe(91)` → `.toBe(95)` and adds presence assertions for the 4. Each event gets the FULL sole-producer triad (dedicated `append-*.ts` with `Object.keys(payload).sort()` closed-tuple check, explicit no-spread reconstruction, `payloadPrivacyCheck` gate, single `audit.append`) and `check-sole-producer-discipline.mjs` must pass. Closed-tuple payload shapes:
  1. **`zoning.interior_extended`** — 4 keys `{object_class, object_kind, parcel_id, tick}`: `object_class ∈ {'mirror','functional'}`, `object_kind ∈` furniture catalog kinds, `parcel_id` PARCEL_ID_RE, `tick` non-negative int; `actorDid = parcel_id` (owner identity already audited via `structure_built` #84; interior names/state NEVER cross).
  2. **`zoning.condition_changed`** — 4 keys `{condition, owner_civic_did_hash, parcel_id, tick}`: `condition ∈ {'maintained','worn','derelict'}`, `owner_civic_did_hash` HEX64, `parcel_id` PARCEL_ID_RE, `tick` non-negative int; `actorDid = owner_civic_did_hash`.
  3. **`zoning.parcel_reclaimed`** — 4 keys `{former_owner_civic_did_hash, parcel_id, reason, tick}`: `former_owner_civic_did_hash` HEX64, `parcel_id` PARCEL_ID_RE, `reason ∈ {'upkeep_default'}`, `tick` non-negative int; `actorDid = parcel_id` (the land returns to treasury).
  4. **`treasury.upkeep_collected`** — 4 keys `{amount_bios, owner_civic_did_hash, parcel_id, tick}`: `amount_bios` positive int, `owner_civic_did_hash` HEX64, `parcel_id` PARCEL_ID_RE, `tick` non-negative int; `actorDid = parcel_id` (mirrors `treasury.parcel_revenue` #83 land-attribution).
  - **Privacy-walker discipline on all four:** no payload key matches `FORBIDDEN_KEY_PATTERN` (body/session_id/text/content); all DIDs hashed HEX64; no `*_name` or free-text keys; interior contents (names/state/tree) NEVER cross — only the `object_class`/`object_kind` enums.

### Persistence
- **D-59-02 (persistence shape, v39):** migration **v39** (next free after shipped v38) ALTERs `civic_parcels` ADD `structure_interior JSON NULL`, `condition ENUM('maintained','worn','derelict') NOT NULL DEFAULT 'maintained'`, `last_upkeep_tick INT UNSIGNED NULL`, `missed_periods TINYINT UNSIGNED NOT NULL DEFAULT 0`. Down migration drops the four columns. `ParcelStore` gains `persistInterior` / `persistCondition` / `persistUpkeep` / `persistReclaim` (DB-first then memory) and `hydrate()` reads the new columns. Interior tree is the JSON column; never embedded in any audit payload.

### Interior tree (D-NH-02)
- **D-59-03 (interior tree):** the `Structure` type carries `interior?: {areas:[{name, objects:[{kind, class, state?}]}]}`. `ParcelRegistry.extendInterior` validates `kind` against the closed furniture catalog and structure-type fit (mirror furniture valid ONLY in the owner's own `home`; functional valid in non-home structures per affordance). Interior tree is Grid-side sovereign space — the public sees the exterior only; GET interior is entry-policy-gated.

### Furniture catalog (closed v1)
- **D-59-04 (furniture catalog):** `grid/src/civic/furniture.ts` holds a frozen catalog. **mirror** (render-only, near-zero cost, home-only): `bed, closet, shelf, kitchen, bathroom, decor`. **functional** (declares affordances): `work_desk{billing,accounting}, sim_board, meeting_table, game_table, task_board, skill_terminal, shop_counter`. `isValidFurniture(kind, structureType)` is the single validation point reused by route + registry.

### Upkeep by founding law (D-NH-03)
- **D-59-05 (upkeep by founding law):** `UPKEEP_PERIOD_TICKS=10080` (1 week @ 1 tick/min, matching the gov debate-window precedent), `UPKEEP_RATE_BPS=200` (2% of `price_bios` per period). Constants in `founding-law.ts` as the SINGLE patch point so Phase 60 Polis amendments edit only this file. `upkeepDue(parcel) = floor(price_bios * UPKEEP_RATE_BPS / 10000)`. All periods tick-based — wallclock gate honored.

### Tick-driven (single-onTick)
- **D-59-06 (tick-driven, single-onTick):** upkeep collection rides the EXISTING `clock.onTick` block in `grid/src/genesis/launcher.ts` (~line 468) via a fire-and-forget call to `upkeep-scanner.onUpkeepTick(tick)`, exactly mirroring the `governance.onTickClosed(event.tick)` precedent at line 484. **NO new `clock.onTick` subscription** is added (R-H-03 single-onTick invariant). Lazy assessment on period boundary; missed assessments tolerable like missed tallies.

### Condition ladder & reclaim (D-NH-03/05)
- **D-59-07 (condition ladder & reclaim):** maintained → worn (1 missed period) → derelict (2 missed, structure CLOSED to visitors: GET interior and join refuse) → reclaimed (3 missed: ownership returns to `TREASURY_DID` for resale, interior+structure razed, occupants ejected, condition reset to maintained on the treasury-owned parcel). Successful upkeep payment resets `missed_periods=0` and `condition='maintained'`. Each transition emits `zoning.condition_changed`; reclaim additionally emits `zoning.parcel_reclaimed`. Polis Commons (rings 0–1, treasury-owned, `owner_civic_did` NULL) are EXEMPT from upkeep and never decay.

### Interior privacy boundary
- **D-59-08 (interior privacy boundary):** interior CONTENTS (object names, state, arrangement, the full tree) NEVER cross the audit chain. `zoning.interior_extended` carries only the `object_class` enum + `object_kind` catalog enum + `parcel_id` + `tick`. The public map feed exposes exterior + condition only; the interior tree is served only via the entry-policy-gated GET interior route from Grid registry state. No payload key matches `FORBIDDEN_KEY_PATTERN` (body/session_id/text/content); DIDs hashed HEX64; structure names → `name_hash` discipline preserved.

### Funds path (upkeep)
- **D-59-09 (funds path, upkeep):** collection moves Ousia via `registry.transferOusia(owner → TREASURY_DID, upkeepDue)` then emits `treasury.upkeep_collected`. Reuses the Phase 58 `transferOusia` + `TREASURY_DID` precedent. Ousia==Bios treated 1:1 (display Bios), flagged for Polis-era treasury cleanup (R-H-08).

### Brain verbs are capabilities
- **D-59-10 (brain verbs are capabilities):** add `extend_interior(area, kind)` and `view_interior(parcel)` `ActionType` members dispatched via `GridWireClient` to the new routes. The `my_places` prompt block gains house condition + pending upkeep cost so the Nous feels upkeep pressure. Decision pressure stays with the Nous (no autoplay).

### Interior viewer is additive
- **D-59-11 (interior viewer is additive):** the orbital map at `/worldmap/orbital` gains a click-to-enter interior view rendering the interior tree (mirror furniture static, functional highlighted) with condition styling; humans browse only entry-policy-permitted open, non-derelict structures. The existing `/worldmap` city view and the Phase 58 orbital exterior stay unchanged.

</decisions>

<invariants>
## Invariants (carried forward / frozen this phase)

- **Allowlist delta = +4 (91 → 95).** `broadcast-allowlist.test.ts` asserts `ALLOWLIST.size === 95` and `ALLOWLIST_MEMBERS.length === 95`. Exactly the 4 named events added under `zoning.*` / `treasury.*`; none renamed or reordered; events 82–91 untouched.
- **Each of the 4 new events has the FULL sole-producer triad:** a dedicated `append-*.ts` with closed-tuple `Object.keys(payload).sort()` check, explicit no-spread reconstruction, `payloadPrivacyCheck` gate, and a single `audit.append` callsite. `check-sole-producer-discipline.mjs` stays green.
- **D-NH-02 interior-never-broadcast / privacy walker:** no payload key matches `FORBIDDEN_KEY_PATTERN` (body/session_id/text/content); DIDs hashed HEX64 (`owner_civic_did_hash` / `former_owner_civic_did_hash`); structure names never raw on chain. INTERIOR CONTENTS (names/state/tree) NEVER broadcast — only `object_class`/`object_kind` enums + counts.
- **D-NH-03 single-onTick upkeep (STATE.md / R-H-03):** upkeep rides the EXISTING `clock.onTick` callback in `launcher.ts`; **NO new `clock.onTick` subscription** is created.
- **Wallclock CI gate (R-H-02):** all upkeep periods, grace windows, and condition timing are tick-based; tick→NY-calendar conversion lives only at the dashboard/docs display boundary. `scripts/check-wallclock-forbidden.mjs` stays green.
- **Zero-diff audit chain (R-31-01):** no chain / persistence-of-chain code edited; the 4 events ride new standard sole producers. `civic-did-issuance-path` gate untouched-green.
- **Write-through persistence:** MySQL is source of truth; the v39 columns are written DB-first then mirrored to the registry; hydrate-on-boot loads them. Occupants remain memory-only.
- **D-NH-07 (carried):** humans never own/occupy land; humans never see private interiors; operators read-only. The condition/upkeep machinery only ever debits Nous owners, never humans.
- **Polis Commons exempt:** treasury-owned parcels (rings 0–1, `owner_civic_did` NULL) never accrue upkeep and never decay or reclaim.
- **Genesis Core geometry frozen** at 53 parcels; six-zone invariant (D-V3-32) untouched; rings are geometry inside zones.
- **Furniture catalog is closed v1** (mirror 6 + functional 7); mirror furniture is valid ONLY in the owner's own home.

</invariants>

<requirements>
## Requirements (R-59-XX)

- **R-59-01 (NH2-01):** migration v39 ALTERs `civic_parcels` with `structure_interior JSON` + `condition ENUM` + `last_upkeep_tick` + `missed_periods`; applies cleanly on a fresh DB and on top of v38; down migration drops the four columns. `ParcelStore` persists/hydrates them DB-first.
- **R-59-02 (NH2-02):** closed furniture catalog in `furniture.ts` (mirror 6 home-only render-only; functional 7 with declared affordances); `isValidFurniture(kind, structureType)` enforces mirror-only-in-home.
- **R-59-03 (NH2-03):** interior tree (areas→objects→`{kind,class,state?}`) on the `Structure` type; `ParcelRegistry.extendInterior` validates against the catalog + structure fit and mutates the tree Grid-side; interior contents never serialized to the chain.
- **R-59-04 (NH2-04):** POST interior/extend (`civic_did_required` + owner, catalog-validated) emits `zoning.interior_extended` (closed 4-tuple `{object_class, object_kind, parcel_id, tick}`); GET interior is entry-policy-gated (owner always; visitors only if open/allowlisted and NOT derelict; humans never see private).
- **R-59-05 (NH2-05):** upkeep constants (`UPKEEP_PERIOD_TICKS=10080`, `UPKEEP_RATE_BPS=200`) + `upkeepDue()` live only in `founding-law.ts` as the single Polis-amendable patch point; all periods tick-based.
- **R-59-06 (NH2-06):** `upkeep-scanner.onUpkeepTick` rides the EXISTING `clock.onTick` block in `launcher.ts` (no new subscription); on period boundary it auto-debits owner Ousia → `TREASURY_DID` and emits `treasury.upkeep_collected` (closed 4-tuple `{amount_bios, owner_civic_did_hash, parcel_id, tick}`).
- **R-59-07 (NH2-07):** condition ladder maintained→worn→derelict→reclaimed advances on missed payments and resets on payment; derelict closes visitors; reclaim returns the parcel to treasury, razes the structure, ejects occupants; commons exempt. Emits `zoning.condition_changed` (closed 4-tuple `{condition, owner_civic_did_hash, parcel_id, tick}`) and `zoning.parcel_reclaimed` (closed 4-tuple `{former_owner_civic_did_hash, parcel_id, reason, tick}`).
- **R-59-08 (NH2-08):** allowlist +4 (91 → 95) with the 4 named events; each has a dedicated sole-producer `append-*.ts` (closed-tuple + privacy walker + single `audit.append`); `broadcast-allowlist.test.ts` asserts 95 + presence of all 4.
- **R-59-09 (NH2-09):** privacy boundary — interior contents never broadcast (`object_class`/`object_kind` enums + counts only); DIDs hashed HEX64; no `FORBIDDEN_KEY_PATTERN` key; privacy-walker and sole-producer-discipline gates green.
- **R-59-10 (NH2-10):** Brain verbs `extend_interior` / `view_interior` dispatch to the Grid routes as capabilities; the `my_places` prompt block surfaces house condition + pending upkeep cost; no autoplay.
- **R-59-11 (NH2-11):** dashboard `/worldmap/orbital` interior viewer renders the interior tree (mirror static, functional highlighted) with condition styling, entry-policy-gated for humans, additively beside the existing exterior map.
- **R-59-12 (NH2-12):** all CI gates green — broadcast-allowlist 95, sole-producer-discipline, civic-did-issuance-path, privacy walker, wallclock-forbidden, zero-diff R-31-01; single-onTick invariant preserved; no remaining `describe.skip` in Phase 59 test files.

</requirements>

---

*Phase: 59-house-2-interiors-upkeep*
*Context gathered: 2026-06-13*
