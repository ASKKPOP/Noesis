/**
 * Phase 48b — Civic Land & Property types.
 *
 * A Parcel is a fixed, ownable plot belonging to one zone of a Grid. Parcels are
 * a registry layered on top of the SpatialMap — NOT new region-graph nodes — so
 * travel/capacity logic is untouched. One buildable Structure per parcel.
 */

import type { ZoneKind } from '../zoning/zone-types.js';

/**
 * A zone id. D-V3-40: the zone set belongs to each Grid — the six template zones plus
 * whatever its Polis adds — so a zone id is any id in that Grid's set, never a fixed union.
 * Rules key on the zone's KIND (home / business / civic), not on its name.
 */
export type ZoneId = string;

export type StructureType = 'home' | 'shop' | 'workshop' | 'venue';
export type Visibility = 'open' | 'private';

/** Which structure types may be built in which KIND of zone. Civic land takes no private build. */
export const STRUCTURE_KIND_FIT: Readonly<Record<StructureType, readonly ZoneKind[]>> = Object.freeze({
    home: ['home'],
    shop: ['business'],
    workshop: ['business'],
    venue: ['home', 'business'],
});

export interface EntryPolicy {
    /** 'open' = anyone may join; 'allowlist' = only DIDs in `allowlist` may join. */
    policy: 'open' | 'allowlist';
    /** DIDs permitted to join when policy === 'allowlist'. */
    allowlist: string[];
}

/** A single placed furniture object inside an interior area (D-NH-02 / Phase 59). */
export interface InteriorObject {
    kind: string;                 // a FURNITURE_CATALOG kind
    class: 'mirror' | 'functional';
    state?: string;               // optional render/use state (unused in v1)
}

/** A named area (room/zone) holding furniture objects. */
export interface InteriorArea {
    name: string;
    objects: InteriorObject[];
}

/**
 * The Smallville-shaped interior tree (D-NH-02). Lives Grid-side ONLY — its
 * contents are NEVER serialized onto the audit chain; only object_kind/object_class
 * enums ever cross the boundary (D-59-08).
 */
export interface Interior {
    areas: InteriorArea[];
}

export interface Structure {
    name: string;                 // plaintext; lives Grid-side only (never on the audit chain raw)
    type: StructureType;
    visibility: Visibility;
    builtAtTick: number;
    namedAddress: string | null;  // optional NDS name, e.g. "place://aurora-cafe.genesis"
    interior?: Interior;          // Phase 59 HOUSE-2: furnished interior tree (Grid-side only)
    boundShopId?: string;         // Phase 60 HOUSE-3: bound ShopRegistry shop id (D-60-03)
}

/** The upkeep condition ladder (D-NH-03): maintained → worn → derelict (→ reclaimed). */
export type ParcelCondition = 'maintained' | 'worn' | 'derelict';

export interface Parcel {
    id: string;                   // canonical slug address, e.g. "genesis:residential:0007"
    gridId: string;
    zoneId: ZoneId;
    ring: number;                 // D-NH-10 vector address: 0 = Government Core, larger = farther out
    sector: number;              // D-NH-10 vector address: angular position in DEGREES [0, 360)
    level: number;               // D-NH-10 vector address: vertical level (defaults to 0)
    ownerDid: string | null;      // null = unclaimed (owned by the Polis treasury)
    priceWei: number;            // positive integer
    structure: Structure | null;
    entryPolicy: EntryPolicy;
    acquiredAtTick: number | null;
    condition: ParcelCondition;   // Phase 59 HOUSE-2: upkeep ladder state (default 'maintained')
    lastUpkeepTick?: number;      // last tick upkeep was collected (undefined until first charge)
    missedPeriods: number;        // consecutive missed upkeep periods (default 0)
}

/** Discriminated result for the registry's expected-failure operations. */
export type ParcelResult<R extends string> =
    | { ok: true; parcel: Parcel }
    | { ok: false; reason: R };

export type PurchaseReason =
    | 'parcel_not_found'
    | 'already_owned'
    | 'zone_not_purchasable'
    | 'cap_exceeded'
    | 'insufficient_funds';

export type BuildReason =
    | 'parcel_not_found'
    | 'not_owner'
    | 'already_built'
    | 'type_zone_mismatch';

export type JoinReason =
    | 'parcel_not_found'
    | 'no_structure'
    | 'not_permitted'
    | 'closed_to_visitors';

export type LeaveReason =
    | 'parcel_not_found'
    | 'not_present';

export type EntryPolicyReason =
    | 'parcel_not_found'
    | 'not_owner'
    | 'no_structure';

export interface BuildInput {
    name: string;
    type: StructureType;
    visibility: Visibility;
    namedAddress?: string | null;
}
