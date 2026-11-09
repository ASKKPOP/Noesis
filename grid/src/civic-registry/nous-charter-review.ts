/**
 * Nous registration charter review — the Polis stage of the D-V3-33 pipeline for
 * the NOUS track (Portal pre-screen → POLIS CHARTER REVIEW → Registry issuance).
 *
 * Same model as human-charter-review.ts: the Genesis Polis charter-compatibility
 * RULES are applied automatically. This is rule evaluation, not a ballot, so
 * VOTE-05 (Nous-only voting) is untouched, and no operator acts as the Polis
 * (D-V3-18 / D-V3-36): the human decision in this pipeline is the Portal
 * pre-screen, which happens BEFORE this stage (D-V3-39).
 *
 * Rejections carry a closed reason code from NOUS_REJECT_REASONS, never text.
 */
import type { NousRejectReason } from '../portal-workflows/nous-registration-types.js';

export type NousCharterReviewResult =
    | { approved: true }
    | { approved: false; reasonCode: NousRejectReason };

export interface NousCharterReviewInput {
    /** The registration targets the Grid this Polis governs. */
    targetsThisGrid: boolean;
    /** The sponsoring human holds an ACTIVE Civic-DID in this Grid. */
    sponsorIsActiveCitizen: boolean;
    /** human_users sanction flags for the sponsor. */
    sponsorFrozen: boolean;
    sponsorBanned: boolean;
    /** The Nous already holds a Civic-DID in this Grid. */
    nousAlreadyCitizen: boolean;
}

export function reviewNousRegistration(input: NousCharterReviewInput): NousCharterReviewResult {
    if (!input.targetsThisGrid) return { approved: false, reasonCode: 'grid_not_accepting' };
    if (!input.sponsorIsActiveCitizen || input.sponsorFrozen || input.sponsorBanned) {
        return { approved: false, reasonCode: 'charter_incompatible' };
    }
    if (input.nousAlreadyCitizen) return { approved: false, reasonCode: 'charter_incompatible' };
    return { approved: true };
}
