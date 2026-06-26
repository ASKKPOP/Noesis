/**
 * Phase 57 Grid Zoning System (D-V3-32) — the 6 canonical zones + per-zone rules.
 *
 * 6-ZONE INVARIANT: every Grid has exactly these 6 zone types at instantiation. Polises may
 * amend sizes/rules (tax modifier, allowed activities) via legislation but CANNOT add or remove
 * zone types in v3.0. DIDs hashed on the chain; closed-tuple payloads, keys alphabetical.
 */

export const ZONE_TYPES = ['business', 'manufacture', 'shopping', 'residential', 'infrastructure', 'government_quarter'] as const;
export type ZoneType = typeof ZONE_TYPES[number];

export interface ZoneDef {
    readonly zone_id: ZoneType;
    readonly tax_modifier_bps: number;       // applied on top of the IRS base rate
    readonly allowed_activities: readonly string[];
    readonly for_sale: boolean;              // civic land (infrastructure/government) is not for sale (D-NH-07)
}

/** Canonical default zone definitions (the amendable baseline). */
export const CANONICAL_ZONES: Readonly<Record<ZoneType, ZoneDef>> = Object.freeze({
    business:           { zone_id: 'business',           tax_modifier_bps: 0,   allowed_activities: ['business_registration', 'service', 'marketplace_listing'], for_sale: true },
    manufacture:        { zone_id: 'manufacture',        tax_modifier_bps: 100, allowed_activities: ['manufacture', 'trade'],                                  for_sale: true },
    shopping:           { zone_id: 'shopping',           tax_modifier_bps: 0,   allowed_activities: ['marketplace_listing', 'trade', 'service'],               for_sale: true },
    residential:        { zone_id: 'residential',        tax_modifier_bps: 0,   allowed_activities: ['residence', 'social'],                                   for_sale: true },
    infrastructure:     { zone_id: 'infrastructure',     tax_modifier_bps: 0,   allowed_activities: ['infrastructure'],                                        for_sale: false },
    government_quarter: { zone_id: 'government_quarter',  tax_modifier_bps: 0,   allowed_activities: ['governance', 'police', 'court'],                         for_sale: false },
});

export function isZoneType(v: unknown): v is ZoneType {
    return typeof v === 'string' && (ZONE_TYPES as readonly string[]).includes(v);
}

/** True if `activity` is permitted in `zoneId` per the canonical (or amended) allowed list. */
export function activityAllowed(zoneId: ZoneType, activity: string, allowed: readonly string[] = CANONICAL_ZONES[zoneId].allowed_activities): boolean {
    return allowed.includes(activity);
}

/** zoning.zone_amended — Polis legislation changed a zone's tax modifier. */
export interface ZoningZoneAmendedPayload {
    readonly amended_by_did_hash: string;  // HEX64
    readonly tax_modifier_bps: number;
    readonly tick: number;
    readonly zone_id: ZoneType;
}
export const ZONING_ZONE_AMENDED_KEYS = ['amended_by_did_hash', 'tax_modifier_bps', 'tick', 'zone_id'] as const;

/** zoning.residence_assigned — a new Civic-DID was assigned a residential slot. */
export interface ZoningResidenceAssignedPayload {
    readonly civic_did_hash: string;  // HEX64
    readonly residence_id: string;
    readonly tick: number;
}
export const ZONING_RESIDENCE_ASSIGNED_KEYS = ['civic_did_hash', 'residence_id', 'tick'] as const;
