/**
 * Human Civic-DID charter review — the Polis stage of the D-V3-33 pipeline
 * (Portal pre-screen → POLIS CHARTER REVIEW → Registry issuance).
 *
 * v1 (2026-06-10): the review applies the Genesis Polis charter-compatibility
 * RULES automatically — matching ROADMAP Phase 54's "Polis applies charter
 * compatibility rules" language. This is rule evaluation, not a ballot, so
 * VOTE-05 (Nous-only voting) is untouched. Phase 54 may upgrade this stage
 * to an asynchronous review queue without changing callers: the module
 * boundary is the constitutional seam.
 *
 * Privacy: the statement is evaluated here Grid-side and stored Grid-side
 * only — it never crosses the audit boundary (rejections carry a closed
 * reason_code, never text).
 */

/** Canonical civic oath a human applicant must accept verbatim (D-36-22 family). */
export const HUMAN_CIVIC_OATH =
    'I enter the Genesis Grid as a citizen. I will respect the Grid Charter and the Laws of Themis.';

export const STATEMENT_MIN_LENGTH = 10;
export const STATEMENT_MAX_LENGTH = 2000;

export type CharterRejectionCode =
    | 'account_sanctioned'
    | 'already_registered'
    | 'oath_mismatch'
    | 'statement_invalid';

export type CharterReviewResult =
    | { approved: true }
    | { approved: false; reasonCode: CharterRejectionCode };

export interface CharterReviewInput {
    /** The oath text the applicant accepted — must equal HUMAN_CIVIC_OATH verbatim. */
    oathText: string;
    /** Free-form intent statement; length-bounded, stored Grid-side only. */
    statement: string;
    /** human_users sanction flags for the applicant. */
    frozen: boolean;
    banned: boolean;
    /** True when the applicant already holds an active Civic-DID in this Grid. */
    alreadyRegistered: boolean;
}

/**
 * Genesis Polis charter-compatibility rules, evaluated in constitutional
 * severity order: sanctions → duplicates → oath → statement.
 */
export function reviewHumanCivicApplication(input: CharterReviewInput): CharterReviewResult {
    if (input.frozen || input.banned) {
        return { approved: false, reasonCode: 'account_sanctioned' };
    }
    if (input.alreadyRegistered) {
        return { approved: false, reasonCode: 'already_registered' };
    }
    if (input.oathText !== HUMAN_CIVIC_OATH) {
        return { approved: false, reasonCode: 'oath_mismatch' };
    }
    const statement = input.statement.trim();
    if (statement.length < STATEMENT_MIN_LENGTH || statement.length > STATEMENT_MAX_LENGTH) {
        return { approved: false, reasonCode: 'statement_invalid' };
    }
    return { approved: true };
}
