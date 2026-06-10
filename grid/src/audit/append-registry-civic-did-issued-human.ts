/**
 * appendRegistryCivicDidIssuedHuman — SOLE producer boundary for `registry.civic_did_issued_human` audit events.
 *
 * Human Civic-DID application pipeline (2026-06-10) — allowlist position 91.
 * Fires when the Grid Registry issues a Civic-DID to a HUMAN citizen (operator-DID holder). Distinct from registry.civic_did_issued, whose producer regex-guards existence_did as did:noesis:nous:* (Nous-only).
 *
 * 8-step discipline mirrors appendRegistryCivicDidIssued:
 *   1. Type guard (plain non-null non-array object).
 *   2. Field guards (regex / closed-set / integer).
 *   5. Closed 4-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'registry.civic_did_issued_human'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

// Human operator-DIDs: did:noesis:human:0x<40hex> (SIWE) or did:noesis:human:email:<uuid>.
const HUMAN_DID_RE = /^did:noesis:human:[a-z0-9_:\\-]+$/i;
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\\-]+$/i;

/** Closed 4-key payload for registry.civic_did_issued_human. */
export interface RegistryCivicDidIssuedHumanPayload {
    readonly civic_did: string;       // CIVIC_DID_RE
    readonly grid_name: string;       // non-empty string
    readonly human_did: string;       // HUMAN_DID_RE
    readonly issued_at_tick: number;  // non-negative integer
}

/** The 4 keys a registry.civic_did_issued_human payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['civic_did', 'grid_name', 'human_did', 'issued_at_tick'] as const;

/**
 * Sole producer path for registry.civic_did_issued_human audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendRegistryCivicDidIssuedHuman(
    audit: AuditChain,
    payload: RegistryCivicDidIssuedHumanPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistryCivicDidIssuedHuman: payload must be a plain object`);
    }
    // Guard: civic_did.
    if (typeof payload.civic_did !== 'string' || !CIVIC_DID_RE.test(payload.civic_did)) {
        throw new TypeError(
            `appendRegistryCivicDidIssuedHuman: civic_did must match CIVIC_DID_RE, got ${JSON.stringify(payload.civic_did)}`,
        );
    }
    // Guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendRegistryCivicDidIssuedHuman: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`,
        );
    }
    // Guard: human_did.
    if (typeof payload.human_did !== 'string' || !HUMAN_DID_RE.test(payload.human_did)) {
        throw new TypeError(
            `appendRegistryCivicDidIssuedHuman: human_did must match HUMAN_DID_RE, got ${JSON.stringify(payload.human_did)}`,
        );
    }
    // Guard: issued_at_tick.
    if (!Number.isInteger(payload.issued_at_tick) || payload.issued_at_tick < 0) {
        throw new TypeError(
            `appendRegistryCivicDidIssuedHuman: issued_at_tick must be a non-negative integer, got ${JSON.stringify(payload.issued_at_tick)}`,
        );
    }
    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendRegistryCivicDidIssuedHuman: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        civic_did: payload.civic_did,
        grid_name: payload.grid_name,
        human_did: payload.human_did,
        issued_at_tick: payload.issued_at_tick,
    };
    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendRegistryCivicDidIssuedHuman: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 8. Commit to chain.
    return audit.append('registry.civic_did_issued_human', payload.civic_did, cleanPayload);
}
