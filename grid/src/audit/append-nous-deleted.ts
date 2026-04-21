/**
 * appendNousDeleted — SOLE producer boundary for `operator.nous_deleted`
 * audit events (AGENCY-05 H5 Sovereign Operations).
 *
 * Mirrors Phase 6/7 discipline (08-CONTEXT D-31):
 *   1. Literal guards: tier must be 'H5', action must be 'delete'.
 *   2. Regex guards: operator_id (OPERATOR_ID_RE — op:<uuid-v4>),
 *      target_did (DID_RE), pre_deletion_state_hash (HEX64_RE).
 *   3. Self-report: payload.operator_id must match the operatorId param.
 *   4. Closed 5-key payload tuple — extra keys refused.
 *   5. payloadPrivacyCheck runs before chain.append (belt-and-suspenders;
 *      the 5 closed keys are natively privacy-clean per D-27).
 *   6. audit.append with canonical event type 'operator.nous_deleted'.
 *
 * Any other file in grid/src/ calling audit.append with eventType
 * === 'operator.nous_deleted' fails the producer-boundary grep test.
 *
 * See: 08-CONTEXT D-23, D-24, D-25, D-27, D-31.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

/** 64-hex SHA-256 — matches grid/src/audit/state-hash.ts HEX64_RE. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * DID regex for target_did — locked at 4 entry points project-wide
 * (3 from Phase 6 + 1 here).
 */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/**
 * Operator-identity regex — op:<uuid-v4> per Phase 6 D-04.
 * Matches OPERATOR_ID_REGEX from grid/src/api/types.ts.
 */
export const OPERATOR_ID_RE = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Closed 5-key payload for operator.nous_deleted (D-25). */
export interface NousDeletedPayload {
    readonly tier: 'H5';
    readonly action: 'delete';
    readonly operator_id: string;   // op:<uuid-v4> — OPERATOR_ID_RE
    readonly target_did: string;    // DID_RE (the Nous being deleted)
    readonly pre_deletion_state_hash: string; // HEX64_RE (combineStateHash output)
}

/** The 5 keys a nous_deleted payload must carry — nothing more, nothing less. */
const EXPECTED_KEYS = [
    'action', 'operator_id', 'pre_deletion_state_hash', 'target_did', 'tier',
] as const;

/**
 * Sole producer path for operator.nous_deleted audit events.
 *
 * @throws TypeError if literal guards fail, regex guards fail, the payload
 *   carries an unexpected key, or payloadPrivacyCheck rejects the payload.
 */
export function appendNousDeleted(
    audit: AuditChain,
    operatorId: string,
    payload: NousDeletedPayload,
): AuditEntry {
    // 1. Operator-id format guard.
    if (typeof operatorId !== 'string' || !OPERATOR_ID_RE.test(operatorId)) {
        throw new TypeError(
            `appendNousDeleted: invalid operatorId — must match OPERATOR_ID_RE (op:<uuid-v4>), got ${JSON.stringify(operatorId)}`,
        );
    }

    // 2. Type guard on payload.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendNousDeleted: payload must be a plain object`);
    }

    // 3. Literal guards — D-25 tier + action are constants, not generic strings.
    if ((payload as { tier?: unknown }).tier !== 'H5') {
        throw new TypeError(
            `appendNousDeleted: tier must be literal 'H5', got ${JSON.stringify((payload as { tier?: unknown }).tier)}`,
        );
    }
    if ((payload as { action?: unknown }).action !== 'delete') {
        throw new TypeError(
            `appendNousDeleted: action must be literal 'delete', got ${JSON.stringify((payload as { action?: unknown }).action)}`,
        );
    }

    // 4. Regex guards on the remaining fields.
    if (typeof payload.operator_id !== 'string' || !OPERATOR_ID_RE.test(payload.operator_id)) {
        throw new TypeError(`appendNousDeleted: operator_id must match OPERATOR_ID_RE (op:<uuid-v4>)`);
    }
    if (payload.operator_id !== operatorId) {
        throw new TypeError(
            `appendNousDeleted: payload.operator_id must equal operatorId (self-report invariant)`,
        );
    }
    if (typeof payload.target_did !== 'string' || !DID_RE.test(payload.target_did)) {
        throw new TypeError(`appendNousDeleted: target_did must match DID_RE`);
    }
    if (typeof payload.pre_deletion_state_hash !== 'string' || !HEX64_RE.test(payload.pre_deletion_state_hash)) {
        throw new TypeError(`appendNousDeleted: pre_deletion_state_hash must match HEX64_RE`);
    }

    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendNousDeleted: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Explicit reconstruction — no prototype pollution / prototype-inherited keys.
    const cleanPayload = {
        tier: 'H5' as const,
        action: 'delete' as const,
        operator_id: payload.operator_id,
        target_did: payload.target_did,
        pre_deletion_state_hash: payload.pre_deletion_state_hash,
    };

    // 7. Privacy gate — belt-and-suspenders (D-27).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendNousDeleted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to chain.
    return audit.append('operator.nous_deleted', operatorId, cleanPayload, payload.target_did);
}
