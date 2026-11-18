/**
 * Grid Zoning System — the zone TEMPLATE + per-zone rules.
 *
 * D-V3-40 (overturns the D-V3-32 6-zone invariant): the zone set belongs to each Grid.
 * The 6 canonical zones below are the TEMPLATE every Grid starts from; its Polis may then
 * add, relabel and remove zones by legislation (ZoneRegistry). A zone's `kind` — home /
 * business / civic — is what rules key on, never its name. DIDs hashed on the chain;
 * closed-tuple payloads, keys alphabetical.
 */

export const ZONE_TYPES = ['business', 'manufacture', 'shopping', 'residential', 'infrastructure', 'government_quarter'] as const;
export type ZoneType = typeof ZONE_TYPES[number];

/** What a zone is for, independent of its name: where Nous live, where they trade/make, or civic land. */
export const ZONE_KINDS = ['home', 'business', 'civic'] as const;
export type ZoneKind = typeof ZONE_KINDS[number];

/** Zone ids a Polis may define: lowercase snake, 2–31 chars. */
export const ZONE_ID_RE = /^[a-z][a-z0-9_]{1,30}$/;
export const ZONE_ACTIVITY_RE = /^[a-z_]{1,32}$/;

/** Kind + display label of each template zone. */
export const TEMPLATE_ZONE_META: Readonly<Record<ZoneType, { label: string; kind: ZoneKind }>> = Object.freeze({
    business:           { label: 'Business',           kind: 'business' },
    manufacture:        { label: 'Manufacture',        kind: 'business' },
    shopping:           { label: 'Shopping',           kind: 'business' },
    residential:        { label: 'Residential',        kind: 'home' },
    infrastructure:     { label: 'Infrastructure',     kind: 'civic' },
    government_quarter: { label: 'Government Quarter', kind: 'civic' },
});

/** One zone of one Grid, as the Grid currently defines it. */
export interface GridZone {
    readonly zone_id: string;
    readonly label: string;
    readonly kind: ZoneKind;
    readonly tax_modifier_bps: number;
    readonly allowed_activities: readonly string[];
    readonly for_sale: boolean;
    /** True for a zone that came from the template (possibly relabeled). */
    readonly template: boolean;
    /** Tax modifier after any Polis amendment. */
    readonly current_tax_modifier_bps: number;
}

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
    readonly zone_id: string;
}

/** zoning.zone_set_changed — Polis legislation added, relabeled or removed a zone (D-V3-40).
 *  The label itself stays Grid-side; only its hash crosses the chain. */
export const ZONE_SET_ACTIONS = ['added', 'relabeled', 'removed'] as const;
export type ZoneSetAction = typeof ZONE_SET_ACTIONS[number];
export interface ZoningZoneSetChangedPayload {
    readonly action: ZoneSetAction;
    readonly changed_by_did_hash: string;  // HEX64
    readonly label_hash: string;           // HEX64 — sha256 of the zone's label after the change
    readonly tick: number;
    readonly zone_id: string;
}
export const ZONING_ZONE_SET_CHANGED_KEYS = ['action', 'changed_by_did_hash', 'label_hash', 'tick', 'zone_id'] as const;
export const ZONING_ZONE_AMENDED_KEYS = ['amended_by_did_hash', 'tax_modifier_bps', 'tick', 'zone_id'] as const;

/** zoning.residence_assigned — a new Civic-DID was assigned a residential slot. */
export interface ZoningResidenceAssignedPayload {
    readonly civic_did_hash: string;  // HEX64
    readonly residence_id: string;
    readonly tick: number;
}
export const ZONING_RESIDENCE_ASSIGNED_KEYS = ['civic_did_hash', 'residence_id', 'tick'] as const;
