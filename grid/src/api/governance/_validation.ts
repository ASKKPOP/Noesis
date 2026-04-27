/**
 * Governance API shared validators — DID, tombstone, and tier checks.
 *
 * Single-sources validation logic shared across all five governance routes.
 * Mirrors the structure of grid/src/api/operator/_validation.ts but applies
 * to Nous DIDs (not operator IDs) and reads tier from x-operator-tier header
 * (GET routes) rather than from the request body (operator POST routes).
 *
 * Phase 12 Wave 3 — VOTE-01 / VOTE-05 / D-12-05 / D-12-06 / T-09-16.
 *
 * Key constraints (from D-12-05 / D-12-06):
 *   - DID regex must match /^did:noesis:[a-z0-9_\-]+$/i — same pattern as all entry points.
 *   - validateProposerDid / validateVoterDid BOTH check:
 *     1. DID regex
 *     2. NousRegistry membership (operator DIDs never have this)
 *     3. tombstone status → 410 if deleted
 *   - validateTierAtLeast reads 'x-operator-tier' header (string '1'..'5').
 *     Returns 401 if missing/non-numeric, 403 if below minTier.
 *
 * Privacy: no body_text, no voter choices appear in this module.
 * Wall-clock ban: no Date.now, no Math.random.
 */

import type { FastifyRequest } from 'fastify';

export const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;
export const COMMIT_HASH_RE = /^[0-9a-f]{64}$/i;
export const NONCE_RE = /^[0-9a-f]{32}$/;

export type ValidationOk = { ok: true };
export type ValidationFail = { ok: false; status: number; error: string };
export type ValidationResult = ValidationOk | ValidationFail;

/** Registry interface sufficient for governance DID validation. */
export interface GovernanceRegistry {
    get(did: string): { did: string; status: string; deletedAtTick?: number } | undefined;
    has?(did: string): boolean;
    isTombstoned(did: string): boolean;
}

/**
 * Validate a proposer DID through: regex → registry membership → tombstone check.
 * Returns { ok:true } on pass, or { ok:false, status, error } on fail.
 */
export function validateProposerDid(
    did: string,
    registry: GovernanceRegistry,
): ValidationResult {
    if (!DID_REGEX.test(did)) {
        return { ok: false, status: 400, error: 'invalid_did' };
    }
    const record = registry.get(did);
    if (!record) {
        return { ok: false, status: 404, error: 'unknown_nous' };
    }
    if (record.status === 'deleted' || registry.isTombstoned(did)) {
        return { ok: false, status: 410, error: 'tombstoned' };
    }
    return { ok: true };
}

/**
 * Validate a voter DID through: regex → registry membership → tombstone check.
 * Same logic as validateProposerDid — voters MUST be NousRegistry members.
 * Returns { ok:true } on pass, or { ok:false, status, error } on fail.
 */
export function validateVoterDid(
    did: string,
    registry: GovernanceRegistry,
): ValidationResult {
    if (!DID_REGEX.test(did)) {
        return { ok: false, status: 400, error: 'invalid_did' };
    }
    const record = registry.get(did);
    if (!record) {
        return { ok: false, status: 404, error: 'unknown_nous' };
    }
    if (record.status === 'deleted' || registry.isTombstoned(did)) {
        return { ok: false, status: 410, error: 'tombstoned' };
    }
    return { ok: true };
}

/**
 * Validate the x-operator-tier header for GET governance routes.
 *
 * Reads 'x-operator-tier' from request.headers. Returns:
 *   - { ok:true }  if tier is numeric and >= minTier
 *   - { ok:false, status:401, error:'tier_missing' }  if header absent or non-numeric
 *   - { ok:false, status:403, error:'tier_too_low' }  if tier < minTier
 */
export function validateTierAtLeast(
    request: FastifyRequest,
    minTier: 1 | 2 | 3 | 4 | 5,
): ValidationResult {
    const headerVal = request.headers['x-operator-tier'];
    if (!headerVal || typeof headerVal !== 'string') {
        return { ok: false, status: 401, error: 'tier_missing' };
    }
    const tier = parseInt(headerVal, 10);
    if (isNaN(tier) || !isFinite(tier)) {
        return { ok: false, status: 401, error: 'tier_missing' };
    }
    if (tier < minTier) {
        return { ok: false, status: 403, error: 'tier_too_low' };
    }
    return { ok: true };
}

/**
 * Validate a u32-compatible positive integer (>= 1).
 */
export function validatePositiveU32(n: unknown, name: string): ValidationResult {
    if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0 || n > 0xFFFFFFFF) {
        return { ok: false, status: 400, error: `invalid_${name}` };
    }
    return { ok: true };
}

/**
 * Validate a percentage integer in [1..100].
 */
export function validatePctRange(n: unknown, name: string): ValidationResult {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 100) {
        return { ok: false, status: 400, error: `invalid_${name}` };
    }
    return { ok: true };
}
