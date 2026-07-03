/**
 * Groups & Holdings · Phase 1 — Genesis founding Businesses seed plan.
 *
 * The SINGLE patch point for the five founding for-profit Businesses (D-GROUP-04)
 * seeded as orbital anchor structures in the business sector (ring 2, D-GROUP-03).
 * A Group is a multi-member organization (collective); these five are all
 * for-profit Businesses. Membership + treasury arrive in later phases.
 *
 * See docs/plans/2026-06-15-groups-and-holdings-design.md.
 */

/** The five deep-tech R&D domains a founding Group covers. */
export type GroupDomain = 'defense' | 'biotech' | 'energy' | 'physical_ai' | 'quantum';

/** A Group is either a for-profit Business or a non-profit purpose group (D-GROUP-01). */
export type GroupKind = 'business' | 'nonprofit';

/** The business sector ring (D-GROUP-03 — anchors sit in the business zone, ring 2). */
export const BUSINESS_RING = 2;

/** A founding-Group seed row (grid-independent). */
export interface GenesisGroupSeed {
    readonly displayName: string;
    readonly domain: GroupDomain;
    readonly kind: GroupKind;
    /** Crest art served from dashboard/public/orgs/. */
    readonly crestPath: string;
    readonly charter: string;
    /** Orbital sector (0–360); anchors are spread evenly around the business ring. */
    readonly sectorDeg: number;
}

/** A grid-scoped founding Group (after buildGenesisGroups stamps the id + ring). */
export interface GenesisGroup extends GenesisGroupSeed {
    readonly groupId: string;
    readonly gridName: string;
    readonly ring: number;
    readonly zoneId: 'business';
}

/**
 * GENESIS_GROUPS (D-GROUP-04) — exactly five for-profit Businesses, evenly spaced
 * around the business ring at 72° intervals. The SINGLE patch point for the
 * founding set.
 */
export const GENESIS_GROUPS: readonly GenesisGroupSeed[] = [
    { displayName: 'Aegis', domain: 'defense', kind: 'business', crestPath: '/orgs/defense.jpeg', sectorDeg: 0, charter: 'Next-generation defense systems.' },
    { displayName: 'Helix', domain: 'biotech', kind: 'business', crestPath: '/orgs/biotech.jpeg', sectorDeg: 72, charter: 'Biotechnology and biomedical research.' },
    { displayName: 'Dynamo', domain: 'energy', kind: 'business', crestPath: '/orgs/energy.jpeg', sectorDeg: 144, charter: 'Energy generation and storage.' },
    { displayName: 'Soma', domain: 'physical_ai', kind: 'business', crestPath: '/orgs/ai.jpeg', sectorDeg: 216, charter: 'Physical AI and embodied intelligence.' },
    { displayName: 'Qubit', domain: 'quantum', kind: 'business', crestPath: '/orgs/quantum.jpeg', sectorDeg: 288, charter: 'Quantum computing and sensing.' },
];

/**
 * Stamp the founding seed into grid-scoped Groups: `groupId = {grid}:group:{name}`,
 * anchored in the business sector (ring 2). Idempotent — pure derivation, no I/O.
 */
export function buildGenesisGroups(gridName: string): GenesisGroup[] {
    return GENESIS_GROUPS.map((s) => ({
        ...s,
        // Lowercase the grid-name prefix to match the id convention (GROUP_ID_RE
        // + the parcel-id form `genesis:zone:nnnn`). The canonical config name is
        // capitalized ("Genesis", the Polis naming convention), so without this
        // the real boot builds "Genesis:group:…" and appendGroupFounded rejects
        // it → the Grid crash-loops seeding groups. (Mock tests passed only
        // because they seed with a lowercase name.)
        groupId: `${gridName.toLowerCase()}:group:${s.displayName.toLowerCase()}`,
        gridName,
        ring: BUSINESS_RING,
        zoneId: 'business' as const,
    }));
}
