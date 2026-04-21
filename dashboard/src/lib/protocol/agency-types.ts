/**
 * SYNC: grid/src/api/types.ts (Phase 6 tier types)
 *
 * Two-source copy intentional — Grid and dashboard are separate packages
 * (per Phase 5 precedent; audit-types.ts follows the same rule). If one
 * side changes, update the other in the same commit.
 */

export type HumanAgencyTier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export const TIER_NAME: Record<HumanAgencyTier, string> = {
    H1: 'Observer',
    H2: 'Reviewer',
    H3: 'Partner',
    H4: 'Driver',
    H5: 'Sovereign',
};

// operator_id: session-scoped UUID-v4. Regex enforces v4 variant bits per RFC 4122.
export const OPERATOR_ID_REGEX = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
