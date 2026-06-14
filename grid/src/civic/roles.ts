/**
 * Phase 60 HOUSE-3 (A4 / D-60-01 / R-60-02) — typed relationship roles.
 *
 * Roles are typed, directional edges anchored to Civic-DIDs (NOT sessions) so two
 * Nous resume at their existing trust level after a restart. Capabilities flow from
 * the edge TYPE via the closed ROLE_CAPABILITIES table — there is no per-edge
 * capability list. The owner edge is IMPLICIT from Parcel.ownerDid and is never
 * stored as a RoleEdge row (D-60-01). Humans can NEVER hold a role edge
 * (VOTE-05 / D-NH-07): grantRole rejects did:civic:noesis:human:*.
 *
 * trust_score is a derived float updated from honored co-work / IOU settlements
 * (reputation, not vibes); it persists on the (parcel_id, holder) edge so a re-grant
 * resumes at the existing level (the severance FSM retains the edge as history rather
 * than deleting it).
 */

/** The three role kinds. `owner` is implicit from Parcel.ownerDid (never a stored edge). */
export type Role = 'owner' | 'staff' | 'guest';

/** A grantable role edge kind (owner is implicit, never granted). */
export type GrantableRole = 'staff' | 'guest';

/**
 * A typed relationship edge. Anchored to the holder Civic-DID; `revoked_tick` is set
 * when the severance FSM downgrades the edge to retained history (never deleted).
 */
export interface RoleEdge {
    parcel_id: string;
    holder_civic_did: string;
    role: Role;
    granted_by_civic_did: string;
    granted_tick: number;
    trust_score: number;
    /** Set at ARCHIVED when the edge is downgraded to history (D-60-02); undefined while active. */
    revoked_tick?: number;
}

/**
 * The closed capability table. owner ⊇ staff ⊇ guest. Capabilities flow from the
 * edge type — callers never store a per-edge capability list. Frozen so it cannot
 * be mutated at runtime (the single source of truth for what a role may do).
 */
export const ROLE_CAPABILITIES: Readonly<Record<Role, readonly string[]>> = Object.freeze({
    // guest: enter + social affordances + trade at the shop counter.
    guest: Object.freeze(['enter', 'social', 'trade_at_shop_counter']),
    // staff ⊇ guest + functional-furniture use + manage listings + admit guests.
    staff: Object.freeze([
        'enter', 'social', 'trade_at_shop_counter',
        'use_functional_furniture', 'manage_listings', 'admit_guests',
    ]),
    // owner ⊇ staff + the proprietary affordances (build/furnish/bind/name/revoke).
    owner: Object.freeze([
        'enter', 'social', 'trade_at_shop_counter',
        'use_functional_furniture', 'manage_listings', 'admit_guests',
        'build', 'furnish', 'bind_shop', 'name_place', 'set_entry_policy', 'grant_role', 'revoke_role',
    ]),
});

/** Civic-DID form reserved for human operators (D-NH-07 precedent: civic-parcels.ts). */
const HUMAN_CIVIC_DID_RE = /^did:civic:noesis:human:/i;

/** True if `did` is a human operator Civic-DID — such DIDs can NEVER hold a role edge. */
export function isHumanDid(did: string): boolean {
    return HUMAN_CIVIC_DID_RE.test(did);
}
