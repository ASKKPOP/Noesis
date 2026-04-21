/**
 * Shared tier/operator_id body validator for /api/v1/operator/* endpoints.
 *
 * Single-sources the D-14/D-15 body contract so the tier-required (AGENCY-03)
 * and operator_id-format invariants are enforced identically across every
 * operator handler (clock pause/resume, governance laws, and Plan 05's
 * memory query + telos force endpoints).
 *
 * If this validator ever diverges from the one used by appendOperatorEvent,
 * one invariant can outrun the other — keep the regex and tier enum in sync
 * with grid/src/api/types.ts (the authoritative source for both constants).
 */

import { OPERATOR_ID_REGEX, type HumanAgencyTier } from '../types.js';

export interface OperatorBody {
    tier?: unknown;
    operator_id?: unknown;
}

export type ValidateResult<T extends HumanAgencyTier> =
    | { ok: true; tier: T; operator_id: string }
    | { ok: false; error: 'invalid_tier' | 'invalid_operator_id' };

/**
 * Validates a request body against the expected H-tier plus the session-scoped
 * operator_id regex. Returns a discriminated union — callers branch on `ok`
 * and emit { error } with the 400 status.
 *
 * T-6-06d mitigation: tier is compared by strict equality; no numeric/string
 * coercion, no substring match. Only the exact expected tier passes.
 */
export function validateTierBody<T extends HumanAgencyTier>(
    body: OperatorBody,
    expectedTier: T,
): ValidateResult<T> {
    if (body.tier !== expectedTier) return { ok: false, error: 'invalid_tier' };
    if (typeof body.operator_id !== 'string' || !OPERATOR_ID_REGEX.test(body.operator_id)) {
        return { ok: false, error: 'invalid_operator_id' };
    }
    return { ok: true, tier: expectedTier, operator_id: body.operator_id };
}
