/**
 * appendOperatorQuarantined — SOLE producer boundary for `operator.quarantined`
 * audit events (Phase 25b SANCTION-03 / D-25b-07/09).
 *
 * Mirrors Phase 8 appendNousDeleted discipline.
 *
 * D-25b-11: reason_hash is SHA-256(operator-supplied reason text). Plaintext NEVER appears
 * in this file or any audit payload. Grid-side sanction_reasons table stores
 * the plaintext for operator-UI lookup only.
 *
 * See: 25b-CONTEXT D-25b-07, D-25b-09, D-25b-11, PATTERNS.md Wave 1.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

/** 64-hex SHA-256. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/** DID regex — locked at 4 entry points project-wide. */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** Operator-identity regex — op:<uuid-v4> per Phase 6 D-04. */
export const OPERATOR_ID_RE = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Closed 6-key payload for operator.quarantined (D-25b-07). */
export interface OperatorQuarantinedPayload {
    readonly tier: 'H4';
    readonly action: 'quarantine';
    readonly operator_id: string;  // op:<uuid-v4> — OPERATOR_ID_RE
    readonly target_did: string;   // DID_RE (the Nous being quarantined)
    readonly tick: number;         // non-negative integer
    readonly reason_hash: string;  // HEX64_RE (SHA-256 of plaintext reason)
}

/** The 6 keys an operator.quarantined payload must carry — nothing more, nothing less. */
const EXPECTED_KEYS = [
    'action', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier',
] as const;

/**
 * Sole producer path for operator.quarantined audit events.
 *
 * @throws TypeError if any guard fails, payload carries unexpected key,
 *   or payloadPrivacyCheck rejects.
 */
export function appendOperatorQuarantined(
    audit: AuditChain,
    operatorId: string,
    payload: OperatorQuarantinedPayload,
): AuditEntry {
    // 1. Operator-id format guard.
    if (typeof operatorId !== 'string' || !OPERATOR_ID_RE.test(operatorId)) {
        throw new TypeError(
            `appendOperatorQuarantined: invalid operatorId — must match OPERATOR_ID_RE (op:<uuid-v4>), got ${JSON.stringify(operatorId)}`,
        );
    }

    // 2. Type guard on payload.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendOperatorQuarantined: payload must be a plain object`);
    }

    // 3. Literal guards.
    if ((payload as { tier?: unknown }).tier !== 'H4') {
        throw new TypeError(
            `appendOperatorQuarantined: tier must be literal 'H4', got ${JSON.stringify((payload as { tier?: unknown }).tier)}`,
        );
    }
    if ((payload as { action?: unknown }).action !== 'quarantine') {
        throw new TypeError(
            `appendOperatorQuarantined: action must be literal 'quarantine', got ${JSON.stringify((payload as { action?: unknown }).action)}`,
        );
    }

    // 4. Regex / range guards on remaining fields.
    if (typeof payload.operator_id !== 'string' || !OPERATOR_ID_RE.test(payload.operator_id)) {
        throw new TypeError(`appendOperatorQuarantined: operator_id must match OPERATOR_ID_RE (op:<uuid-v4>)`);
    }
    // 5. Self-report invariant.
    if (payload.operator_id !== operatorId) {
        throw new TypeError(
            `appendOperatorQuarantined: payload.operator_id must equal operatorId (self-report invariant)`,
        );
    }
    if (typeof payload.target_did !== 'string' || !DID_RE.test(payload.target_did)) {
        throw new TypeError(`appendOperatorQuarantined: target_did must match DID_RE`);
    }
    if (typeof payload.reason_hash !== 'string' || !HEX64_RE.test(payload.reason_hash)) {
        throw new TypeError(`appendOperatorQuarantined: reason_hash must match HEX64_RE (64-char hex SHA-256)`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendOperatorQuarantined: tick must be a non-negative integer`);
    }

    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendOperatorQuarantined: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 7. Explicit reconstruction — no prototype pollution.
    const cleanPayload = {
        action:      'quarantine' as const,
        operator_id: payload.operator_id,
        reason_hash: payload.reason_hash,
        target_did:  payload.target_did,
        tick:        payload.tick,
        tier:        'H4' as const,
    };

    // 8. Privacy gate — belt-and-suspenders (D-25b-11).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendOperatorQuarantined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 9. Commit to chain.
    return audit.append('operator.quarantined', operatorId, cleanPayload, payload.target_did);
}
