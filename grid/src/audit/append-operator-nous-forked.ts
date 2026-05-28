/**
 * appendOperatorNousForked — SOLE producer boundary for `operator.nous_forked`
 * audit events (FORK-04 / D-43-04).
 *
 * Constitutional right-to-fork enforcement per D-V3-18. This event is recorded
 * in the Grid's audit chain AND embedded inside the fork package manifest.json.
 *
 * 9-step discipline (mirrors Phase 8 appendNousDeleted + Phase 13 appendOperatorExported):
 *   1. Operator-id format guard (OPERATOR_ID_RE — op:<uuid-v4>).
 *   2. Type guard on payload (must be plain object, non-null, non-array).
 *   3. Literal/enum guard: fork_reason ∈ {operator_exit}.
 *   4. Regex / range guards:
 *      - civic_did_hash, operator_did_hash, package_hash match HEX64_RE.
 *      - tick is a non-negative integer.
 *   NOTE: Step 5 (self-report invariant) is SKIPPED — operator_id is NOT in the
 *   payload (payload contains operator_did_hash, not operator_id). No self-report.
 *   6. Closed-tuple structural check: Object.keys(payload).sort() === EXPECTED_KEYS.
 *   7. Explicit reconstruction — no prototype pollution (no spread).
 *   8. Privacy gate: payloadPrivacyCheck(cleanPayload) — belt-and-suspenders (T-43-payload-leak).
 *   9. Commit: audit.append('operator.nous_forked', operatorId, cleanPayload).
 *
 * Any other file in grid/src/ calling audit.append('operator.nous_forked', ...)
 * fails the producer-boundary grep test (operator-nous-forked-producer-boundary.test.ts).
 *
 * See: FORK-04, D-43-04, T-43-sole, T-43-payload-leak.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

/** 64-hex SHA-256 — matches grid/src/audit/state-hash.ts HEX64_RE. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * Operator-identity regex — op:<uuid-v4> per Phase 6 D-04.
 * Matches OPERATOR_ID_REGEX from grid/src/api/types.ts.
 */
export const OPERATOR_ID_RE = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valid fork reasons — closed enum, v3.0 only value.
 * Extension requires a new D-43-* decision + CONTEXT.md update.
 */
const FORK_REASONS = new Set(['operator_exit']);

/** Closed 5-key payload for operator.nous_forked (D-43-04). Keys in alphabetical order. */
export interface OperatorNousForkedPayload {
    readonly civic_did_hash: string;    // HEX64_RE — SHA-256 of forked Nous's Civic-DID
    readonly fork_reason: string;       // 'operator_exit'
    readonly operator_did_hash: string; // HEX64_RE — SHA-256 of requesting operator's DID
    readonly package_hash: string;      // HEX64_RE — SHA-256 of complete .tar.gz archive
    readonly tick: number;              // integer >= 0
}

/**
 * The 5 keys an operator.nous_forked payload MUST carry — nothing more, nothing less.
 * Sorted alphabetically for the closed-tuple structural check (step 6).
 */
const EXPECTED_KEYS = ['civic_did_hash', 'fork_reason', 'operator_did_hash', 'package_hash', 'tick'] as const;

/**
 * Sole producer path for operator.nous_forked audit events.
 *
 * @throws TypeError if any guard fails: operator-id format, payload type,
 *   literal/enum guard, regex/range guards, extra/missing keys,
 *   or payloadPrivacyCheck rejection.
 */
export function appendOperatorNousForked(
    audit: AuditChain,
    operatorId: string,
    payload: OperatorNousForkedPayload,
): AuditEntry {
    // 1. Operator-id format guard.
    if (typeof operatorId !== 'string' || !OPERATOR_ID_RE.test(operatorId)) {
        throw new TypeError(
            `appendOperatorNousForked: invalid operatorId — must match OPERATOR_ID_RE (op:<uuid-v4>), got ${JSON.stringify(operatorId)}`,
        );
    }

    // 2. Type guard on payload.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendOperatorNousForked: payload must be a plain object`);
    }

    // 3. Literal/enum guard — fork_reason must be in FORK_REASONS.
    if (!FORK_REASONS.has(payload.fork_reason as string)) {
        throw new TypeError(
            `appendOperatorNousForked: fork_reason must be one of [operator_exit], got ${JSON.stringify(payload.fork_reason)}`,
        );
    }

    // 4. Regex / range guards.

    // civic_did_hash, operator_did_hash, package_hash must each be 64 lowercase hex chars.
    for (const field of ['civic_did_hash', 'operator_did_hash', 'package_hash'] as const) {
        const val = payload[field];
        if (typeof val !== 'string' || !HEX64_RE.test(val)) {
            throw new TypeError(
                `appendOperatorNousForked: ${field} must match HEX64_RE (64 lowercase hex chars), got ${JSON.stringify(val)}`,
            );
        }
    }

    // tick must be a non-negative integer.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendOperatorNousForked: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // NOTE: Step 5 (self-report invariant) SKIPPED — operator_id is not in payload.

    // 6. Closed-tuple structural check — exactly the 5 expected keys, sorted.
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== EXPECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])
    ) {
        throw new TypeError(
            `appendOperatorNousForked: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 7. Explicit reconstruction — no prototype pollution / prototype-inherited keys.
    const cleanPayload = {
        civic_did_hash: payload.civic_did_hash,
        fork_reason: payload.fork_reason,
        operator_did_hash: payload.operator_did_hash,
        package_hash: payload.package_hash,
        tick: payload.tick,
    };

    // 8. Privacy gate — belt-and-suspenders (T-43-payload-leak / D-43-04).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendOperatorNousForked: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 9. Commit to chain.
    return audit.append('operator.nous_forked', operatorId, cleanPayload);
}
