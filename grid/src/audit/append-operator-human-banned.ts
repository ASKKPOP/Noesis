/**
 * appendOperatorHumanBanned — SOLE producer boundary for `operator.human_banned`
 * audit events (Phase 25b SANCTION-05 / D-25b-08/09).
 *
 * Mirrors Phase 8 appendNousDeleted discipline.
 * Human variant: uses `human_did` (human DID) instead of `target_did` (Nous DID).
 * Both share the `did:noesis:` shape, so DID_RE validates both.
 *
 * D-25b-NEW-5: `banned` and `frozen` are distinct columns on `human_users`.
 * A banned human is fully revoked (SIWE rejected). See migration v13 (plan 09+).
 *
 * D-25b-11: reason_hash is SHA-256(operator-supplied reason text). Plaintext NEVER appears
 * in this file or any audit payload. Grid-side sanction_reasons table stores
 * the plaintext for operator-UI lookup only.
 *
 * See: 25b-CONTEXT D-25b-08, D-25b-09, D-25b-11, D-25b-NEW-5, PATTERNS.md Wave 1.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

/** 64-hex SHA-256. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/** DID regex for human_did — extends base DID_RE to allow colon-separated path segments.
 *  Human DIDs have the form `did:noesis:human:0x<40hex>` or `did:noesis:human:email:<uuid>`.
 *  Per HumanRegistry.ts DID_REGEX. */
export const DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;

/** Operator-identity regex — op:<uuid-v4> per Phase 6 D-04. */
export const OPERATOR_ID_RE = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Closed 6-key payload for operator.human_banned (D-25b-08). */
export interface OperatorHumanBannedPayload {
    readonly tier: 'H5';
    readonly action: 'ban_human';
    readonly operator_id: string;  // op:<uuid-v4> — OPERATOR_ID_RE
    readonly human_did: string;    // DID_RE (the human being banned)
    readonly tick: number;         // non-negative integer
    readonly reason_hash: string;  // HEX64_RE (SHA-256 of plaintext reason)
}

/** The 6 keys an operator.human_banned payload must carry — nothing more, nothing less. */
const EXPECTED_KEYS = [
    'action', 'human_did', 'operator_id', 'reason_hash', 'tick', 'tier',
] as const;

/**
 * Sole producer path for operator.human_banned audit events.
 *
 * @throws TypeError if any guard fails, payload carries unexpected key,
 *   or payloadPrivacyCheck rejects.
 */
export function appendOperatorHumanBanned(
    audit: AuditChain,
    operatorId: string,
    payload: OperatorHumanBannedPayload,
): AuditEntry {
    // 1. Operator-id format guard.
    if (typeof operatorId !== 'string' || !OPERATOR_ID_RE.test(operatorId)) {
        throw new TypeError(
            `appendOperatorHumanBanned: invalid operatorId — must match OPERATOR_ID_RE (op:<uuid-v4>), got ${JSON.stringify(operatorId)}`,
        );
    }

    // 2. Type guard on payload.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendOperatorHumanBanned: payload must be a plain object`);
    }

    // 3. Literal guards.
    if ((payload as { tier?: unknown }).tier !== 'H5') {
        throw new TypeError(
            `appendOperatorHumanBanned: tier must be literal 'H5', got ${JSON.stringify((payload as { tier?: unknown }).tier)}`,
        );
    }
    if ((payload as { action?: unknown }).action !== 'ban_human') {
        throw new TypeError(
            `appendOperatorHumanBanned: action must be literal 'ban_human', got ${JSON.stringify((payload as { action?: unknown }).action)}`,
        );
    }

    // 4. Regex / range guards on remaining fields.
    if (typeof payload.operator_id !== 'string' || !OPERATOR_ID_RE.test(payload.operator_id)) {
        throw new TypeError(`appendOperatorHumanBanned: operator_id must match OPERATOR_ID_RE (op:<uuid-v4>)`);
    }
    // 5. Self-report invariant.
    if (payload.operator_id !== operatorId) {
        throw new TypeError(
            `appendOperatorHumanBanned: payload.operator_id must equal operatorId (self-report invariant)`,
        );
    }
    if (typeof payload.human_did !== 'string' || !DID_RE.test(payload.human_did)) {
        throw new TypeError(`appendOperatorHumanBanned: human_did must match DID_RE`);
    }
    if (typeof payload.reason_hash !== 'string' || !HEX64_RE.test(payload.reason_hash)) {
        throw new TypeError(`appendOperatorHumanBanned: reason_hash must match HEX64_RE (64-char hex SHA-256)`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendOperatorHumanBanned: tick must be a non-negative integer`);
    }

    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendOperatorHumanBanned: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 7. Explicit reconstruction — no prototype pollution.
    const cleanPayload = {
        action:      'ban_human' as const,
        human_did:   payload.human_did,
        operator_id: payload.operator_id,
        reason_hash: payload.reason_hash,
        tick:        payload.tick,
        tier:        'H5' as const,
    };

    // 8. Privacy gate — belt-and-suspenders (D-25b-11).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendOperatorHumanBanned: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 9. Commit to chain (human_did as the actor target).
    return audit.append('operator.human_banned', operatorId, cleanPayload, payload.human_did);
}
