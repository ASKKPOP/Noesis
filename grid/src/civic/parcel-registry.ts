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
    PURCHASABLE_ZONES,
    HOME_ZONES,
    BUSINESS_ZONES,
    STRUCTURE_ZONE_FIT,
} from './types.js';
import { FURNITURE_CATALOG, isValidFurniture } from './furniture.js';

export interface SeedZoneInput {
    zoneId: ZoneId;
    count: number;
    priceBios: number;
    /** D-NH-10 vector-address ring this band belongs to (0 = Government Core). */
    ring: number;
    /** D-NH-10 vector-address level (defaults to 0). */
    level?: number;
}

export class ParcelRegistry {
    private readonly parcels = new Map<string, Parcel>();
    /** parcelId → set of currently-present visitor DIDs (presence inside a structure). */
    private readonly presence = new Map<string, Set<string>>();

    constructor(private readonly gridId: string = 'genesis') {}

    /** Seed `count` unclaimed parcels into a zone. Ids are zero-padded 4-digit slugs. */
    seedZone(input: SeedZoneInput): void {
        if (!Number.isInteger(input.count) || input.count <= 0) {
            throw new Error(`seedZone: count must be a positive integer, got ${input.count}`);
        }
        if (!Number.isInteger(input.priceBios) || input.priceBios <= 0) {
            throw new Error(`seedZone: priceBios must be a positive integer, got ${input.priceBios}`);
        }
        const level = input.level ?? 0;
        for (let i = 0; i < input.count; i++) {
            const seq = String(i + 1).padStart(4, '0');
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
                priceBios: input.priceBios,
                structure: null,
                entryPolicy: { policy: 'open', allowlist: [] },
                acquiredAtTick: null,
                condition: 'maintained',
                missedPeriods: 0,
            });
        }
    }

    /**
     * Insert or replace a fully-formed parcel directly (used by ParcelStore for
     * hydrate-on-boot and seed-mirror). The store owns DB persistence; this only
     * mirrors the authoritative row into the in-memory read cache. Presence
     * (occupants) is never touched here — it is memory-only by design (R-H-09).
     */
    upsert(parcel: Parcel): void {
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

    /** Lookup one parcel by canonical address. Returns a copy or undefined. */
    get(address: string): Parcel | undefined {
        const p = this.parcels.get(address);
        return p ? this.clone(p) : undefined;
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
        if (!PURCHASABLE_ZONES.includes(p.zoneId)) return { ok: false, reason: 'zone_not_purchasable' };
        if (this.exceedsCap(buyerDid, p.zoneId)) return { ok: false, reason: 'cap_exceeded' };
        if (buyerBalanceBios < p.priceBios) return { ok: false, reason: 'insufficient_funds' };

        p.ownerDid = buyerDid;
        // acquiredAtTick is stamped by the caller via stampAcquired (tick is a Grid concern).
        return { ok: true, parcel: this.clone(p) };
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
        if (!STRUCTURE_ZONE_FIT[input.type].includes(p.zoneId)) {
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
            priceBios: 0,
            structure: null,
            entryPolicy: { policy: 'open', allowlist: [] },
            acquiredAtTick: null,
            condition: 'maintained',
            missedPeriods: 0,
        };
    }

    /** Parse the zone segment from a `grid:zone:seq` address. */
    private zoneForAddress(address: string): ZoneId {
        return address.split(':')[1] as ZoneId;
    }

    /** A representative structure type for the address's zone (home for residential). */
    private structureTypeForAddress(address: string): StructureType {
        const zoneId = this.zoneForAddress(address);
        return zoneId === 'residential' ? 'home' : 'shop';
    }

    /** Total parcels seeded. */
    get count(): number {
        return this.parcels.size;
    }

    /** True if buyer already holds the max allowed in the target zone's class (≤1 home, ≤1 business). */
    private exceedsCap(buyerDid: string, zoneId: ZoneId): boolean {
        const classZones = HOME_ZONES.includes(zoneId) ? HOME_ZONES : BUSINESS_ZONES;
        for (const p of this.parcels.values()) {
            if (p.ownerDid === buyerDid && classZones.includes(p.zoneId)) return true;
        }
        return false;
    }

    private clone(p: Parcel): Parcel {
        return {
            ...p,
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
