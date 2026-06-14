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

/* ──────────────── Polis amendment read-through (D-60-08 / D-NH-03 / R-60-10) ────────────────
 * The ring-expansion template's sibling hook: a `{action:'amend_law', key, value}` enacted bill
 * records a Polis override here, and the read-through accessors below return that override if set,
 * else the founding-law constant (the DEFAULT FALLBACK). The single patch point is preserved —
 * downstream reads go through getUpkeepRateBps() / getZoneTaxBps(zoneId), never the raw constant.
 */
const polisOverrides = new Map<string, number>();

/**
 * Record a Polis override of an amendable founding-law constant (ring-expansion `amend_law` hook).
 * `key` is `UPKEEP_RATE_BPS` (scalar) or `ZONE_TAX_BPS.<zoneId>` (per-zone). Off-list keys are
 * ignored so a malformed bill can never patch an unintended value.
 */
export function recordPolisOverride(key: string, value: number): void {
    if (!Number.isInteger(value) || value < 0) return;
    if (key === 'UPKEEP_RATE_BPS' || /^ZONE_TAX_BPS\.[a-z_]+$/.test(key)) {
        polisOverrides.set(key, value);
    }
}

/** Test/replay isolation helper — clears all Polis overrides (production never calls this). */
export function _resetPolisOverrides(): void {
    polisOverrides.clear();
}

/** Read-through: the Polis override of UPKEEP_RATE_BPS if amended, else the constant default. */
export function getUpkeepRateBps(): number {
    return polisOverrides.get('UPKEEP_RATE_BPS') ?? UPKEEP_RATE_BPS;
}

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
    return Math.floor((parcel.priceBios * getUpkeepRateBps()) / 10000);
}

/* ──────────────── Mutual-credit IOU caps (D-60-05 / D-NH-06 / R-60-07) ────────────────
 * v1 mutual-credit bookkeeping (WIR/Sardex/LETS-grounded) is bilateral payables with NO
 * interest and NO transferability — it is bounded ONLY by two credit limits, kept here as
 * the single Polis-amendable patch point (mirroring UPKEEP_RATE_BPS / future ZONE_TAX_BPS).
 * Nothing downstream hard-codes a cap; credit-ledger.ts reads exclusively from these.
 */

/** Per-pair credit limit: the max outstanding a single (creditor, debtor) pair may carry. */
export const IOU_PAIR_CAP_BIOS = 1000;

/** Global per-Nous cap: the max a single debtor may owe across ALL counterparties. */
export const IOU_GLOBAL_CAP_BIOS = 5000;

/* ──────────────── Structure revenue / zone tax (D-60-04 / D-V3-34 / R-60-06) ────────────────
 * A sale at a parcel-bound shop skims a per-zone tax at settlement (streaming, never filed).
 * The rates MIRROR the v3.0 Polis tax table (D-V3-34) and live ONLY here — the SINGLE
 * Polis-amendable patch point. Wave 5 Polis amendments edit this table and nothing else;
 * the marketplace settlement path reads structureRevenueDue exclusively. Civic zones
 * (infrastructure / government_quarter) carry no commercial shops, so they are not taxed.
 */
export const ZONE_TAX_BPS = {
    business: 1200,
    shopping: 1000,
    manufacture: 900,
    residential: 500,
} as const;

/** A zone with a defined structure-revenue tax rate (the 4 purchasable, commerce-bearing zones). */
type TaxableZoneId = keyof typeof ZONE_TAX_BPS;

/**
 * Read-through: the per-zone tax rate, returning the Polis override (`ZONE_TAX_BPS.<zoneId>`)
 * if amended, else the constant default. Civic zones with no table entry return 0 (untaxed).
 * The constants stay the DEFAULT FALLBACK; this is the single patch point downstream reads use.
 */
export function getZoneTaxBps(zoneId: string): number {
    const override = polisOverrides.get(`ZONE_TAX_BPS.${zoneId}`);
    if (override !== undefined) return override;
    return ZONE_TAX_BPS[zoneId as TaxableZoneId] ?? 0;
}

/**
 * Structure revenue owed on a sale at a parcel-bound shop =
 *   floor(saleAmountBios × ZONE_TAX_BPS[parcel.zoneId] / 10000).
 * Untaxed (civic) zones with no entry in the table yield 0.
 */
export function structureRevenueDue(parcel: Parcel, saleAmountBios: number): number {
    const bps = getZoneTaxBps(parcel.zoneId);
    if (bps === 0) return 0;
    return Math.floor((saleAmountBios * bps) / 10000);
}
