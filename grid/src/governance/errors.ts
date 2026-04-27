/**
 * GovernanceError — typed error carrying an HTTP-equivalent status code.
 *
 * Phase 12 Wave 2 — used by all governance emitters so API routes (Wave 3)
 * can map cleanly to HTTP status codes without parsing error message strings.
 *
 * Examples:
 *   throw new GovernanceError('duplicate_ballot', 409);
 *   throw new GovernanceError('ballot_reveal_mismatch', 422);
 */
export class GovernanceError extends Error {
    constructor(
        public readonly code: string,
        public readonly httpStatus: number,
    ) {
        super(code);
        this.name = 'GovernanceError';
    }
}
