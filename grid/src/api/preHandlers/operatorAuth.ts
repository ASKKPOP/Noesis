/**
 * Server-trusted operator identity — replaces the spoofable x-operator-tier/-id
 * header pattern (SECURITY-CRITICAL 2026-07-09). The operator's tier + audit id
 * are resolved from an env allowlist keyed on the authenticated Portal-session
 * DID (req.didContext.operatorDid), NOT from any client header.
 *
 * Env format `GRID_OPERATOR_DIDS`: comma-separated entries, each `DID|op:UUID|tier`.
 *   DID  — operator Portal existence-DID (DID_RE)
 *   op:UUID — server-trusted audit id (OPERATOR_ID_RE)
 *   tier — 1..5 (optional, default 5)
 * Malformed entries are skipped (fail-safe). Empty/unset ⇒ empty map (fail-closed).
 */
import { OPERATOR_ID_REGEX } from '../types.js';

/** Human existence-DID shape (mirrors DID_RE in append-human-joined.ts). */
const DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;

export interface OperatorGrant {
    readonly operatorId: string;
    readonly tier: number;
}

/** Parse GRID_OPERATOR_DIDS into a DID→grant map. Never throws. */
export function parseOperatorAllowlist(raw: string | undefined): Map<string, OperatorGrant> {
    const out = new Map<string, OperatorGrant>();
    if (!raw || raw.trim().length === 0) return out;
    for (const entry of raw.split(',')) {
        const parts = entry.trim().split('|');
        if (parts.length < 2 || parts.length > 3) continue;
        const did = parts[0].trim();
        const operatorId = parts[1].trim();
        const tierRaw = parts[2]?.trim();
        if (!DID_RE.test(did)) continue;
        if (!OPERATOR_ID_REGEX.test(operatorId)) continue;
        let tier = 5;
        if (tierRaw !== undefined && tierRaw !== '') {
            const n = Number.parseInt(tierRaw, 10);
            if (!Number.isInteger(n) || n < 1 || n > 5) continue;
            tier = n;
        }
        out.set(did, { operatorId, tier });
    }
    return out;
}

/** Resolve the operator grant for an authenticated DID, or null if not an operator. */
export function resolveOperator(
    operatorDid: string | undefined,
    allowlist: Map<string, OperatorGrant>,
): OperatorGrant | null {
    if (!operatorDid) return null;
    return allowlist.get(operatorDid) ?? null;
}

/**
 * Server-trusted tier gate for routes that keep policy 'public' but still require
 * an operator (admin/*). Resolves the operator from the authenticated DID, then
 * enforces a minimum tier. Both failure modes map to HTTP 403 at the call site.
 */
export function operatorTierGate(
    operatorDid: string | undefined,
    allowlist: Map<string, OperatorGrant>,
    minTier: number,
): { ok: true; grant: OperatorGrant } | { ok: false; error: 'not_operator' | 'tier_too_low' } {
    const grant = resolveOperator(operatorDid, allowlist);
    if (!grant) return { ok: false, error: 'not_operator' };
    if (grant.tier < minTier) return { ok: false, error: 'tier_too_low' };
    return { ok: true, grant };
}
