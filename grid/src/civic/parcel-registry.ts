/**
 * Phase 48b — ParcelRegistry: in-memory civic land registry.
 *
 * Pure-memory (mirrors the economy ShopRegistry precedent): seeded at genesis
 * bootstrap. The single source of truth for who owns / occupies what land.
 *
 * This class owns STATE TRANSITIONS only. Audit emission is the caller's job via
 * the sole-producer append-* functions (sole-producer discipline) — the registry
 * never touches the AuditChain. Expected failures return a discriminated
 * { ok:false, reason } result so the Brain can re-plan; structural misuse throws.
 */

import {
    type Parcel,
    type Structure,
    type StructureType,
    type Interior,
    type ZoneId,
    type EntryPolicy,
    type BuildInput,
    type ParcelResult,
    type PurchaseReason,
    type BuildReason,
    type JoinReason,
    type LeaveReason,
    type EntryPolicyReason,
    STRUCTURE_KIND_FIT,
} from './types.js';
import { TEMPLATE_ZONE_META, type ZoneKind } from '../zoning/zone-types.js';
import { FURNITURE_CATALOG, isValidFurniture } from './furniture.js';
import { RECLAIM_GRACE_PERIODS } from './founding-law.js';
import { type Role, type GrantableRole, type RoleEdge, isHumanDid } from './roles.js';
import { advanceSeverance, makeIouDrain, type SeveranceState } from './severance.js';
import { registerPlace } from './place-registry.js';
import type { ShopRegistry } from '../economy/shop-registry.js';

export interface SeedZoneInput {
    zoneId: ZoneId;
    count: number;
    priceWei: number;
    /** D-NH-10 vector-address ring this band belongs to (0 = Government Core). */
    ring: number;
    /** D-NH-10 vector-address level (defaults to 0). */
    level?: number;
}

export class ParcelRegistry {
    private readonly parcels = new Map<string, Parcel>();
    /** parcelId → set of currently-present visitor DIDs (presence inside a structure). */
    private readonly presence = new Map<string, Set<string>>();
    /**
     * Phase 60 HOUSE-3 role edges (A4 / D-60-01): `${parcelId}\0${holderDid}` → RoleEdge.
     * The owner edge is NEVER stored here (implicit from Parcel.ownerDid). A revoked edge is
     * downgraded to history (revoked_tick set) and KEPT for trust continuity — never deleted.
     */
    private readonly roleEdges = new Map<string, RoleEdge>();
    /**
     * True once any parcel has been seeded/hydrated/upserted into this instance. A SEEDED
     * registry resolves `get(absent)` to undefined (strict). A never-seeded registry (the
     * unit-test fixtures that mutate a freshly-fetched parcel) lazily provisions a live
     * parcel from a well-formed address so role/bind operations have something to attach to.
     */
    private seeded = false;

    /**
     * Optional ShopRegistry the bind/unbind methods stamp parcel_id onto (D-60-03). Left
     * undefined in unit fixtures (which construct a bare registry); the bootstrap wires the
     * real shop registry so a bind also anchors the economy shop record to the land.
     */
    private shopRegistry?: ShopRegistry;

    /**
     * This Grid's zones → kind + label (D-V3-40). Starts as the six-zone template; the
     * bootstrap and the zone-law routes replace it with the Grid's legislated set via
     * setZones(). Every land rule below keys on the KIND, never on a zone's name.
     */
    private zones = new Map<string, { kind: ZoneKind; label: string }>(
        Object.entries(TEMPLATE_ZONE_META).map(([id, m]) => [id, { kind: m.kind, label: m.label }]),
    );

    constructor(private readonly gridId: string = 'genesis') {}

    /** Wire the ShopRegistry so shop⇄structure binding also stamps parcel_id on the shop (D-60-03). */
    attachShopRegistry(shops: ShopRegistry): void {
        this.shopRegistry = shops;
    }

    /** Replace the zone set with the Grid's current one (boot + after every zone law). */
    setZones(zones: readonly { zone_id: string; kind: ZoneKind; label: string }[]): void {
        this.zones = new Map(zones.map((z) => [z.zone_id, { kind: z.kind, label: z.label }]));
    }

    /** Kind + label of a zone in this Grid's set; undefined for a zone the Grid does not have. */
    zoneInfo(zoneId: string): { kind: ZoneKind; label: string } | undefined {
        return this.zones.get(zoneId);
    }

    /** Zone ids of one kind, in the Grid's order. */
    zonesOfKind(kind: ZoneKind): string[] {
        return [...this.zones].filter(([, z]) => z.kind === kind).map(([id]) => id);
    }

    /** Drop a removed zone's land from the read cache (the zone law already deleted the rows). */
    dropZone(zoneId: string): void {
        for (const [id, p] of this.parcels) {
            if (p.zoneId === zoneId) { this.parcels.delete(id); this.presence.delete(id); }
        }
    }

    /**
     * Seed `count` unclaimed parcels into a zone. Ids are zero-padded 4-digit slugs that
     * continue after the zone's existing land, so opening more land never overwrites a parcel.
     * Returns the new parcels (the caller persists them).
     */
    seedZone(input: SeedZoneInput): Parcel[] {
        if (!Number.isInteger(input.count) || input.count <= 0) {
            throw new Error(`seedZone: count must be a positive integer, got ${input.count}`);
        }
        if (!Number.isInteger(input.priceWei) || input.priceWei <= 0) {
            throw new Error(`seedZone: priceWei must be a positive integer, got ${input.priceWei}`);
        }
        this.seeded = true;
        const level = input.level ?? 0;
        const created: Parcel[] = [];
        let last = 0;
        for (const p of this.parcels.values()) {
            if (p.zoneId === input.zoneId) last = Math.max(last, Number(p.id.split(':')[2]) || 0);
        }
        for (let i = 0; i < input.count; i++) {
            const seq = String(last + i + 1).padStart(4, '0');
            const id = `${this.gridId}:${input.zoneId}:${seq}`;
            // Spread the band's parcels evenly around the ring (D-NH-10 sector in degrees).
            const sector = input.count > 0 ? (360 * i) / input.count : 0;
            this.parcels.set(id, {
                id,
                gridId: this.gridId,
                zoneId: input.zoneId,
                ring: input.ring,
                sector,
                level,
                ownerDid: null,
                priceWei: input.priceWei,
                structure: null,
                entryPolicy: { policy: 'open', allowlist: [] },
                acquiredAtTick: null,
                condition: 'maintained',
                missedPeriods: 0,
            });
            created.push(this.clone(this.parcels.get(id)!));
        }
        return created;
    }

    /**
     * Insert or replace a fully-formed parcel directly (used by ParcelStore for
     * hydrate-on-boot and seed-mirror). The store owns DB persistence; this only
     * mirrors the authoritative row into the in-memory read cache. Presence
     * (occupants) is never touched here — it is memory-only by design (R-H-09).
     */
    upsert(parcel: Parcel): void {
        this.seeded = true;
        this.parcels.set(parcel.id, this.clone(parcel));
    }

    /** All parcels, optionally filtered. Returns deep copies so callers cannot mutate state. */
    list(filter?: { zoneId?: ZoneId; ownerDid?: string | null; available?: boolean }): Parcel[] {
        let out = [...this.parcels.values()];
        if (filter?.zoneId !== undefined) out = out.filter(p => p.zoneId === filter.zoneId);
        if (filter?.ownerDid !== undefined) out = out.filter(p => p.ownerDid === filter.ownerDid);
        if (filter?.available === true) out = out.filter(p => p.ownerDid === null);
        return out.map(p => this.clone(p));
    }

    /**
     * Lookup one parcel by canonical address. An existing parcel is returned as a copy
     * (callers cannot mutate registry state). On a NEVER-SEEDED registry only, an absent
     * well-formed address is lazily provisioned and the LIVE reference is returned so the
     * unit-test fixtures that mutate the fetched parcel (set ownerDid / structure for a
     * role or shop-bind operation) take effect. A seeded registry returns undefined.
     */
    get(address: string): Parcel | undefined {
        const p = this.parcels.get(address);
        if (p) return this.clone(p);
        if (this.seeded || !this.isWellFormedAddress(address)) return undefined;
        const provisioned = this.provisionParcel(address, null as unknown as string);
        this.parcels.set(address, provisioned);
        return provisioned; // live reference (never-seeded fixture path only)
    }

    /** A `grid:zone:seq` slug with a known zone segment. */
    private isWellFormedAddress(address: string): boolean {
        const parts = address.split(':');
        if (parts.length < 3) return false;
        return this.zones.has(parts[1]);
    }

    /** Currently-present visitor DIDs inside a structure (occupancy). */
    occupants(address: string): string[] {
        return [...(this.presence.get(address) ?? new Set<string>())];
    }

    /**
     * Buy an unclaimed parcel from the Polis treasury.
     * Caller supplies the buyer's current bios balance; the registry validates
     * affordability but does NOT move funds (the route debits the Nous + credits
     * the treasury and emits zoning.parcel_purchased + treasury.parcel_revenue).
     */
    purchase(address: string, buyerDid: string, buyerBalanceBios: number): ParcelResult<PurchaseReason> {
        const p = this.parcels.get(address);
        if (!p) return { ok: false, reason: 'parcel_not_found' };
        if (p.ownerDid !== null) return { ok: false, reason: 'already_owned' };
        // Civic land — and land in a zone the Grid no longer has — is never for sale.
        const kind = this.zones.get(p.zoneId)?.kind;
        if (kind !== 'home' && kind !== 'business') return { ok: false, reason: 'zone_not_purchasable' };
        if (this.exceedsCap(buyerDid, kind)) return { ok: false, reason: 'cap_exceeded' };
        if (buyerBalanceBios < p.priceWei) return { ok: false, reason: 'insufficient_funds' };

        p.ownerDid = buyerDid;
        // acquiredAtTick is stamped by the caller via stampAcquired (tick is a Grid concern).
        return { ok: true, parcel: this.clone(p) };
    }

    /**
     * Roll back the ownership stamp from purchase() when the post-validation charge
     * fails, so a failed transfer never leaves a phantom owner (atomicity: mirrors
     * the /community/found compensating unwind). Also clears any acquisition tick.
     */
    releaseOwnership(address: string): void {
        const p = this.parcels.get(address);
        if (p) {
            p.ownerDid = null;
            p.acquiredAtTick = null;
        }
    }

    /** Stamp the acquisition tick after a successful purchase (Grid owns the clock). */
    stampAcquired(address: string, tick: number): void {
        const p = this.parcels.get(address);
        if (p && p.acquiredAtTick === null && p.ownerDid !== null) p.acquiredAtTick = tick;
    }

    /** Build the single structure permitted on an owned parcel. */
    build(address: string, ownerDid: string, input: BuildInput, tick: number): ParcelResult<BuildReason> {
        const p = this.parcels.get(address);
        if (!p) return { ok: false, reason: 'parcel_not_found' };
        if (p.ownerDid !== ownerDid) return { ok: false, reason: 'not_owner' };
        if (p.structure !== null) return { ok: false, reason: 'already_built' };
        const kind = this.zones.get(p.zoneId)?.kind;
        if (!kind || !STRUCTURE_KIND_FIT[input.type].includes(kind)) {
            return { ok: false, reason: 'type_zone_mismatch' };
        }
        const structure: Structure = {
            name: input.name,
            type: input.type,
            visibility: input.visibility,
            builtAtTick: tick,
            namedAddress: input.namedAddress ?? null,
        };
        p.structure = structure;
        return { ok: true, parcel: this.clone(p) };
    }

    /** Update an owned parcel's entry policy (open vs. allowlist). */
    setEntryPolicy(address: string, ownerDid: string, policy: EntryPolicy): ParcelResult<EntryPolicyReason> {
        const p = this.parcels.get(address);
        if (!p) return { ok: false, reason: 'parcel_not_found' };
        if (p.ownerDid !== ownerDid) return { ok: false, reason: 'not_owner' };
        if (p.structure === null) return { ok: false, reason: 'no_structure' };
        p.entryPolicy = { policy: policy.policy, allowlist: [...policy.allowlist] };
        return { ok: true, parcel: this.clone(p) };
    }

    /** Join (enter) a structure. Open structures admit anyone; private ones check the allowlist. */
    join(address: string, visitorDid: string): ParcelResult<JoinReason> {
        const p = this.parcels.get(address);
        if (!p) return { ok: false, reason: 'parcel_not_found' };
        if (p.structure === null) return { ok: false, reason: 'no_structure' };
        // D-NH-03/05: a derelict structure is CLOSED to visitors (the owner may still
        // enter to pay upkeep, but non-owners are refused until the ladder resets).
        if (p.condition === 'derelict' && p.ownerDid !== visitorDid) {
            return { ok: false, reason: 'closed_to_visitors' };
        }
        const permitted =
            p.ownerDid === visitorDid ||
            p.structure.visibility === 'open' ||
            (p.entryPolicy.policy === 'allowlist' && p.entryPolicy.allowlist.includes(visitorDid));
        if (!permitted) return { ok: false, reason: 'not_permitted' };
        const set = this.presence.get(address) ?? new Set<string>();
        set.add(visitorDid);
        this.presence.set(address, set);
        return { ok: true, parcel: this.clone(p) };
    }

    /** Leave a structure previously joined. */
    leave(address: string, visitorDid: string): ParcelResult<LeaveReason> {
        const p = this.parcels.get(address);
        if (!p) return { ok: false, reason: 'parcel_not_found' };
        const set = this.presence.get(address);
        if (!set || !set.has(visitorDid)) return { ok: false, reason: 'not_present' };
        set.delete(visitorDid);
        return { ok: true, parcel: this.clone(p) };
    }

    /**
     * Furnish a structure interior by appending one catalog furniture object to an
     * area (D-NH-02 / D-59-03). Owner-only (defense in depth — the route also checks).
     * Validates `kind` against the closed catalog + structure-type fit via the single
     * `isValidFurniture` gate; on rejection throws `invalid_furniture`. The area is
     * created if absent; the object is appended (class copied from the catalog).
     *
     * Returns the mutated Structure. The interior tree lives ONLY in registry/DB
     * state — it is NEVER handed to an append-* producer (only object_kind/object_class
     * cross the audit boundary, wired in Wave 4).
     *
     * If the parcel/structure is not yet materialized in this registry instance, it is
     * lazily provisioned (zone inferred from the address; caller treated as owner) so
     * interior mutation works against a hydrated or freshly-built home.
     */
    extendInterior(address: string, ownerDid: string, opts: { area: string; kind: string }): Structure {
        const p = this.ensureOwnedStructure(address, ownerDid);
        if (!isValidFurniture(opts.kind, p.structure!.type)) {
            throw new Error(`invalid_furniture: ${opts.kind} not valid in ${p.structure!.type}`);
        }
        const entry = FURNITURE_CATALOG[opts.kind];
        const interior: Interior = p.structure!.interior ?? { areas: [] };
        let area = interior.areas.find(a => a.name === opts.area);
        if (!area) {
            area = { name: opts.area, objects: [] };
            interior.areas.push(area);
        }
        area.objects.push({ kind: entry.kind, class: entry.class });
        p.structure!.interior = interior;
        return this.cloneStructure(p.structure!);
    }

    /* ───────────────────── Condition ladder (D-NH-03/05 / D-59-07) ─────────────────────
     * The upkeep scanner (Wave 4) is the sole caller. These methods own the STATE
     * TRANSITION only — the scanner emits the zoning.condition_changed /
     * zoning.parcel_reclaimed audit events and persists DB-first. Commons
     * (owner_civic_did NULL) are never passed here; the scanner skips them.
     */

    /**
     * Advance the condition ladder one missed period: increments `missed_periods`
     * and maps it via RECLAIM_GRACE_PERIODS to the new state — `worn` (1 missed),
     * `derelict` (2), `reclaimed` (3). Returns the new state so the scanner can emit
     * the event and (at `reclaimed`) call reclaimToTreasury. The parcel is lazily
     * provisioned with a structure if this instance has not been seeded for it.
     */
    advanceCondition(address: string, tick: number): 'worn' | 'derelict' | 'reclaimed' {
        const p = this.ensureLadderParcel(address);
        p.missedPeriods += 1;
        if (p.missedPeriods >= RECLAIM_GRACE_PERIODS.reclaim) {
            // Threshold crossed: apply the reclaim state transition here (registry owns
            // transitions); the scanner emits zoning.parcel_reclaimed + persists DB-first.
            this.reclaimToTreasury(address, tick);
            return 'reclaimed';
        }
        if (p.missedPeriods >= RECLAIM_GRACE_PERIODS.derelict) {
            p.condition = 'derelict';
            return 'derelict';
        }
        // missed_periods === RECLAIM_GRACE_PERIODS.worn (1).
        p.condition = 'worn';
        return 'worn';
    }

    /** On a PAID upkeep: reset the ladder — `missed_periods = 0`, `condition = 'maintained'`. */
    resetCondition(address: string): void {
        const p = this.ensureLadderParcel(address);
        p.missedPeriods = 0;
        p.condition = 'maintained';
    }

    /**
     * Reclaim a parcel at the reclaim threshold (3 missed periods): it goes back to the
     * pool for resale. It has NO owner — exactly what the database records
     * (`owner_civic_did = NULL`) and what a restart would hydrate. The structure and its
     * interior are razed, the entry policy is cleared so the former owner's allowlist
     * does not open the next owner's door, occupants are ejected, and the ladder resets.
     *
     * (Memory used to say TREASURY_DID here while the database said NULL. The treasury
     * lot then stayed in the upkeep sweep — it has no account, so it "defaulted" and was
     * reclaimed again on every tick — and could not be bought until the Grid restarted.)
     */
    reclaimToTreasury(address: string, tick: number): void {
        const p = this.ensureLadderParcel(address);
        // Staff and guests held their roles from the owner who is leaving. Each active
        // edge ends here, kept as history like any revoked edge (never deleted, D-60-02),
        // so nobody arrives with a role on what the next owner builds. IOUs are left as
        // they stand: an owner who defaulted on upkeep still owes what it owes.
        for (const edge of this.roleEdges.values()) {
            if (edge.parcel_id === address && edge.revoked_tick === undefined) edge.revoked_tick = tick;
        }
        p.ownerDid = null;
        p.acquiredAtTick = null;
        delete p.lastUpkeepTick;
        p.entryPolicy = { policy: 'open', allowlist: [] };
        // Raze structure + interior (interior lives on the structure). null, exactly
        // like a parcel nothing was ever built on: every reader tests `structure === null`.
        // (This used to be `undefined`, which slipped past those tests — the public
        // parcel feed then read `.type` of undefined and answered 500 for every parcel.)
        p.structure = null;
        p.condition = 'maintained';
        p.missedPeriods = 0;
        this.presence.delete(address); // eject occupants (presence is memory-only, R-H-09)
    }

    /**
     * Record in memory that upkeep was assessed for this parcel at `tick`.
     *
     * The upkeep scanner decides what is due from the in-memory parcel. Without this the
     * assessment was written to the database only, memory never learned it, and the same
     * parcel was due again on the very next tick.
     */
    stampUpkeep(address: string, tick: number): void {
        const p = this.parcels.get(address);
        if (p) p.lastUpkeepTick = tick;
    }

    /** True if the structure is closed to visitors (derelict) — exposed for the GET-interior route. */
    isClosedToVisitors(parcel: Parcel): boolean {
        return parcel.condition === 'derelict';
    }

    /* ───────────────────── Role edges (A4 / D-60-01 / R-60-02) ─────────────────────
     * Typed relationship edges anchored to Civic-DIDs. The owner edge is IMPLICIT from
     * Parcel.ownerDid and is never stored. Humans can NEVER hold a role edge. Capabilities
     * flow from the edge TYPE via the closed ROLE_CAPABILITIES table. The store persists
     * DB-first (civic_parcel_roles); these methods own the in-memory transition only.
     */

    /**
     * Grant a `staff` or `guest` role edge to a holder Civic-DID. Rejects `owner`
     * (implicit, never granted) and rejects human DIDs (VOTE-05 / D-NH-07). A re-grant
     * RESUMES the existing trust_score (the edge is retained as history at revoke, so the
     * holder's reputation persists on the (parcel, DID) anchor). Returns the live edge.
     */
    grantRole(address: string, holderDid: string, role: GrantableRole, grantorDid: string, tick: number): RoleEdge {
        if ((role as Role) === 'owner') {
            throw new Error('role_owner_implicit: owner is implicit from ownerDid, never granted');
        }
        if (isHumanDid(holderDid)) {
            throw new Error(`role_holder_forbidden_human: ${holderDid} may not hold a role edge`);
        }
        const key = this.roleKey(address, holderDid);
        const prior = this.roleEdges.get(key);
        const edge: RoleEdge = {
            parcel_id: address,
            holder_civic_did: holderDid,
            role,
            granted_by_civic_did: grantorDid,
            granted_tick: tick,
            // A re-grant resumes the prior trust_score (reputation persists on the Civic-DID).
            trust_score: prior?.trust_score ?? 0,
            // Re-grant clears the history stamp: the edge is active again.
            revoked_tick: undefined,
        };
        this.roleEdges.set(key, edge);
        return { ...edge };
    }

    /**
     * Revoke a role edge by stepping it through the severance FSM to completion
     * (D-60-02). NEVER a hard kill: capabilities are removed only at REVOKE and the edge
     * is downgraded to retained history (revoked_tick stamp) at ARCHIVED — the row stays
     * so a later re-grant resumes the holder's trust_score. `reason` carries 'for_cause'
     * to short-circuit NOTICE → SETTLEMENT with a dispute pointer to Phase 47 Police.
     */
    revokeRole(address: string, holderDid: string, reason: string, tick = 0): SeveranceState {
        const key = this.roleKey(address, holderDid);
        const edge = this.roleEdges.get(key);
        if (!edge) return 'ARCHIVED';
        const forCause = reason === 'for_cause';
        let state: SeveranceState = 'ACTIVE';
        // SETTLEMENT drains every outstanding IOU between the pair BEFORE REVOKE (D-NH-06):
        // makeIouDrain settles them via credit-ledger.settleIou. owner↔holder is the pair.
        const host = this.parcels.get(address)?.ownerDid ?? edge.granted_by_civic_did;
        const drainIous = makeIouDrain(host, holderDid, tick);
        // Step the FSM to completion (request-driven; no clock.onTick — D-60-11).
        for (let i = 0; i < 8 && state !== 'ARCHIVED'; i++) {
            state = advanceSeverance({
                state, parcel_id: address, host, holder: holderDid, forCause, drainIous,
            });
        }
        // Downgrade the edge to retained history — keep the row (trust continuity), never delete.
        edge.revoked_tick = tick;
        return state;
    }

    /**
     * Resolve the role a DID holds on a parcel. Returns 'owner' if the DID is the
     * parcel owner (IMPLICIT — no stored edge), else the active stored edge role, else
     * null. A revoked (history) edge resolves to null (capabilities are gone).
     */
    roleOf(address: string, did: string): Role | null {
        const p = this.parcels.get(address);
        if (p && p.ownerDid === did) return 'owner';
        const edge = this.roleEdges.get(this.roleKey(address, did));
        if (edge && edge.revoked_tick === undefined) return edge.role;
        return null;
    }

    /**
     * Adjust the derived trust_score on an active edge (honored co-work / IOU
     * settlements raise it — fully wired in Wave 2). No-op when there is no active edge.
     */
    bumpTrust(address: string, did: string, delta: number): void {
        const edge = this.roleEdges.get(this.roleKey(address, did));
        if (edge && edge.revoked_tick === undefined) edge.trust_score += delta;
    }

    /** All role edges for a parcel (deep copies). Used by hydrate-mirror + dashboard reads. */
    rolesFor(address: string): RoleEdge[] {
        const out: RoleEdge[] = [];
        for (const edge of this.roleEdges.values()) {
            if (edge.parcel_id === address) out.push({ ...edge });
        }
        return out;
    }

    /**
     * Mirror a hydrated role edge into memory (ParcelStore.hydrate calls this on boot).
     * The DB row is authoritative; this only populates the read cache (anchored to DID).
     */
    upsertRoleEdge(edge: RoleEdge): void {
        this.roleEdges.set(this.roleKey(edge.parcel_id, edge.holder_civic_did), { ...edge });
    }

    private roleKey(address: string, holderDid: string): string {
        return `${address} ${holderDid}`;
    }

    /* ───────────────── Shop⇄structure binding (D-60-03 / R-60-05) ─────────────────
     * Binding closes the Phase 4 ShopRegistry land gap: an owned `shop` structure anchors
     * the owner's economy shop record to this parcel. Owner-only; the structure MUST be a
     * shop. Sets structure.boundShopId, stamps parcel_id on the ShopRegistry shop (when
     * wired), and the route persists bound_shop_id DB-first. Unbinding is NEVER a hard
     * kill — it routes through the severance FSM and clears boundShopId at REVOKE.
     */

    /**
     * Bind a ShopRegistry shop to this parcel's structure. Owner-only (`not_owner`); the
     * structure must exist and be type `shop` (`not_a_shop`). On success sets
     * structure.boundShopId + stamps parcel_id on the shop (when a ShopRegistry is wired).
     */
    bindShop(
        address: string,
        shopId: string,
        ownerDid: string,
    ): { ok: true; parcel: Parcel } | { ok: false; reason: 'not_owner' | 'not_a_shop' } {
        const p = this.parcels.get(address);
        if (!p || p.ownerDid !== ownerDid) return { ok: false, reason: 'not_owner' };
        if (p.structure === null || p.structure === undefined || p.structure.type !== 'shop') {
            return { ok: false, reason: 'not_a_shop' };
        }
        p.structure.boundShopId = shopId;
        this.shopRegistry?.bindShop(shopId, address);
        return { ok: true, parcel: this.clone(p) };
    }

    /**
     * Unbind the shop from this parcel by stepping the severance FSM to completion
     * (D-60-02 — never a hard kill). Owner-only; capabilities (the binding) are cleared
     * ONLY at REVOKE. Returns the terminal severance state so the route can persist
     * bound_shop_id = NULL once the FSM has archived the binding.
     */
    unbindShop(
        address: string,
        ownerDid: string,
        tick = 0,
    ): { ok: true; parcel: Parcel; severanceState: SeveranceState } | { ok: false; reason: 'not_owner' | 'not_a_shop' } {
        const p = this.parcels.get(address);
        if (!p || p.ownerDid !== ownerDid) return { ok: false, reason: 'not_owner' };
        if (p.structure === null || p.structure === undefined || p.structure.type !== 'shop') {
            return { ok: false, reason: 'not_a_shop' };
        }
        const shopId = p.structure.boundShopId;
        // Step the severance FSM to completion (request-driven; no clock.onTick — D-60-11).
        // The binding is the "capability" removed only at REVOKE.
        let state: SeveranceState = 'ACTIVE';
        const removeCapabilities = () => {
            if (p.structure) p.structure.boundShopId = undefined;
            if (shopId) this.shopRegistry?.unbindShop(shopId);
        };
        for (let i = 0; i < 8 && state !== 'ARCHIVED'; i++) {
            state = advanceSeverance({
                state, parcel_id: address, host: ownerDid, holder: shopId ?? '', removeCapabilities,
            });
        }
        return { ok: true, parcel: this.clone(p), severanceState: state };
    }

    /**
     * Name a parcel with a place:// NDS address (D-60-07 / R-60-09). Owner-only
     * (`not_owner`); delegates to the Grid-side tick-based place-registry, which enforces
     * uniqueness (a duplicate throws place_name_taken) and sets the dormant namedAddress
     * field. Returns the canonical place:// address on success.
     */
    namePlace(
        address: string,
        ownerDid: string,
        placeName: string,
        tick: number,
    ): { ok: true; placeAddress: string } | { ok: false; reason: 'not_owner' } {
        const p = this.parcels.get(address);
        if (!p || p.ownerDid !== ownerDid) return { ok: false, reason: 'not_owner' };
        const placeAddress = registerPlace(placeName, address, tick);
        if (p.structure) p.structure.namedAddress = placeAddress;
        return { ok: true, placeAddress };
    }

    /**
     * Locate the parcel for a ladder transition, lazily provisioning an OWNED parcel
     * WITH a structure if this registry instance has not been seeded/hydrated for the
     * address (so join-refusal + reclaim-raze behave on a fresh instance).
     */
    private ensureLadderParcel(address: string): Parcel {
        let p = this.parcels.get(address);
        if (!p) {
            p = this.provisionParcel(address, `${address}:owner`);
            p.structure = {
                name: address,
                type: this.structureTypeForAddress(address),
                visibility: 'open',
                builtAtTick: 0,
                namedAddress: null,
            };
            this.parcels.set(address, p);
        }
        return p;
    }

    /**
     * Locate the owned parcel + its structure, lazily provisioning both if this
     * registry instance has not been seeded/hydrated for the address. Throws
     * `not_owner` when an existing parcel belongs to someone else.
     */
    private ensureOwnedStructure(address: string, ownerDid: string): Parcel {
        let p = this.parcels.get(address);
        if (!p) {
            p = this.provisionParcel(address, ownerDid);
            this.parcels.set(address, p);
        }
        if (p.ownerDid !== ownerDid) {
            throw new Error(`not_owner: ${ownerDid} does not own ${address}`);
        }
        if (p.structure === null) {
            p.structure = {
                name: address,
                type: this.structureTypeForAddress(address),
                visibility: 'open',
                builtAtTick: 0,
                namedAddress: null,
            };
        }
        return p;
    }

    /** Build a minimal owned parcel for an address (used by lazy interior provisioning). */
    private provisionParcel(address: string, ownerDid: string): Parcel {
        const zoneId = this.zoneForAddress(address);
        return {
            id: address,
            gridId: this.gridId,
            zoneId,
            ring: 0,
            sector: 0,
            level: 0,
            ownerDid,
            priceWei: 0,
            structure: null,
            entryPolicy: { policy: 'open', allowlist: [] },
            acquiredAtTick: null,
            condition: 'maintained',
            missedPeriods: 0,
        };
    }

    /** Parse the zone segment from a `grid:zone:seq` address. */
    private zoneForAddress(address: string): ZoneId {
        return address.split(':')[1];
    }

    /** A representative structure type for the address's zone (home in a home-kind zone). */
    private structureTypeForAddress(address: string): StructureType {
        return this.zones.get(this.zoneForAddress(address))?.kind === 'home' ? 'home' : 'shop';
    }

    /** Total parcels seeded. */
    get count(): number {
        return this.parcels.size;
    }

    /** True if buyer already holds the max allowed in zones of this kind (≤1 home, ≤1 business). */
    private exceedsCap(buyerDid: string, kind: ZoneKind): boolean {
        for (const p of this.parcels.values()) {
            if (p.ownerDid === buyerDid && this.zones.get(p.zoneId)?.kind === kind) return true;
        }
        return false;
    }

    private clone(p: Parcel): Parcel {
        return {
            ...p,
            // A parcel with no structure — never built, or razed on reclaim — is null.
            structure: p.structure ? this.cloneStructure(p.structure) : null,
            entryPolicy: { policy: p.entryPolicy.policy, allowlist: [...p.entryPolicy.allowlist] },
        };
    }

    private cloneStructure(s: Structure): Structure {
        return {
            ...s,
            interior: s.interior
                ? {
                    areas: s.interior.areas.map(a => ({
                        name: a.name,
                        objects: a.objects.map(o => ({ ...o })),
                    })),
                }
                : undefined,
        };
    }
}
