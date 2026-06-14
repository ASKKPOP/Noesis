/**
 * Phase 58 HOUSE-1 — Founding Law: gravity pricing + Genesis Core seed plan.
 *
 * The SINGLE patch point for the Genesis Core's economic + spatial constants.
 * Phase 60 Polis amendments edit THIS file (and only this file) to change land
 * pricing or the ring/zone layout — nothing downstream hard-codes a price or a
 * per-ring count.
 *
 * D-58-04 (gravity pricing, D-NH-08): price = 100 × (5 − ring)².
 *   ring 3 (residential) = 400 Bios, ring 2 (business/shopping/manufacture) = 900 Bios.
 *   Civic rings 0–1 are not for sale (PURCHASABLE_RINGS).
 * D-58-03 (Genesis Core seed, D-NH-04/09): exactly 53 parcels (48 purchasable + 5 civic).
 */

import type { ZoneId, StructureType, Visibility, Parcel } from './types.js';

/**
 * Gravity pricing (D-58-04 / D-NH-08): land nearer the Government Core (lower ring)
 * costs more. `price = 100 × (5 − ring)²`. ring 3 → 400, ring 2 → 900.
 */
export function gravityPrice(ring: number): number {
    return 100 * (5 - ring) ** 2;
}

/** Rings a Nous may buy a parcel in. Rings 0–1 are civic land (not for sale). */
export const PURCHASABLE_RINGS: readonly number[] = [2, 3];

/** A single Genesis Core seed instruction: a ring/zone band with a fixed parcel count. */
export interface SeedPlanEntry {
    /** Vector-address ring (0 = Government Core, larger = farther out). */
    ring: number;
    /** The civic zone every parcel in this band belongs to. */
    zoneId: ZoneId;
    /** How many parcels to seed in this band. */
    count: number;
    /**
     * For civic commons (rings 0–1) a structure is pre-built at seed time
     * (e.g. the Polis venue floors). Purchasable bands leave this undefined —
     * the structure is built by the owner after purchase.
     */
    prebuiltStructure?: {
        type: StructureType;
        visibility: Visibility;
    };
}

/**
 * GENESIS_CORE_SEED_PLAN (D-58-03 / D-NH-04/09) — exactly 53 parcels:
 *   ring 0  government_quarter ×1                          (civic, no sale)
 *   ring 1  infrastructure ×4 (pre-built open venue floors) (civic, no sale)
 *   ring 2  business ×8 + shopping ×8 + manufacture ×8 = 24 (purchasable @ 900)
 *   ring 3  residential ×24                               (purchasable @ 400)
 *   = 48 purchasable + 5 civic = 53.
 *
 * This is the SINGLE patch point Phase 60 Polis ring-expansion bills edit.
 */
export const GENESIS_CORE_SEED_PLAN: readonly SeedPlanEntry[] = [
    // Ring 0 — Government Core monument (civic land, not for sale).
    { ring: 0, zoneId: 'government_quarter', count: 1 },
    // Ring 1 — infrastructure commons: pre-built open Polis venue floors (civic).
    { ring: 1, zoneId: 'infrastructure', count: 4, prebuiltStructure: { type: 'venue', visibility: 'open' } },
    // Ring 2 — business / shopping / manufacture (purchasable @ gravityPrice(2) = 900).
    { ring: 2, zoneId: 'business', count: 8 },
    { ring: 2, zoneId: 'shopping', count: 8 },
    { ring: 2, zoneId: 'manufacture', count: 8 },
    // Ring 3 — residential homes (purchasable @ gravityPrice(3) = 400).
    { ring: 3, zoneId: 'residential', count: 24 },
];

/* ───────────────────────── Upkeep (D-59-05 / D-NH-03) ─────────────────────────
 * Ownership carries an ongoing upkeep burden. These constants are the SINGLE patch
 * point — Phase 60 Polis amendments edit only this file; nothing downstream
 * hard-codes a rate, period, or grace window. All periods are tick-based (the
 * wallclock CI gate forbids NY-calendar arithmetic outside the display boundary).
 */

/** One upkeep period = 10080 ticks (1 week @ 1 tick/min; matches the gov debate window). */
export const UPKEEP_PERIOD_TICKS = 10080;

/** Upkeep charge per period = 2% (200 bps) of the parcel's price_bios. */
export const UPKEEP_RATE_BPS = 200;

/**
 * Condition-ladder grace thresholds, keyed by the number of MISSED periods at which
 * each transition fires: worn at 1 missed, derelict at 2, reclaim at 3 (D-NH-03/05).
 */
export const RECLAIM_GRACE_PERIODS = { worn: 1, derelict: 2, reclaim: 3 } as const;

/**
 * Upkeep owed per period for a parcel = floor(price_bios × UPKEEP_RATE_BPS / 10000).
 * Commons (price 0 / treasury-owned) yield 0 and are exempt at the scanner.
 */
export function upkeepDue(parcel: Parcel): number {
    return Math.floor((parcel.priceBios * UPKEEP_RATE_BPS) / 10000);
}
