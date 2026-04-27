/**
 * appendOperatorExported — SOLE producer boundary for `operator.exported`
 * audit events (REPLAY-02 / D-13-09).
 *
 * Mirrors Phase 8 appendNousDeleted discipline (08-CONTEXT D-31, D-23..D-27):
 *   1. Operator-id format guard (OPERATOR_ID_RE — op:<uuid-v4>).
 *   2. Type guard on payload (must be plain object, non-null, non-array).
 *   3. Literal guard: tier === 'H5'.
 *   4. Regex / range guards:
 *      - operator_id matches OPERATOR_ID_RE.
 *      - tarball_hash matches HEX64_RE.
 *      - start_tick is non-negative integer.
 *      - end_tick is integer ≥ start_tick.
 *      - requested_at is integer ≥ 0 AND < REQUESTED_AT_MAX (Unix SECONDS defense,
 *        rejects accidental Date.now() millisecond values — T-10-08 / D-13-09).
 *   5. Self-report invariant: payload.operator_id === operatorId param.
 *   6. Closed-tuple structural check: Object.keys(payload).sort() === EXPECTED_KEYS.
 *   7. Explicit reconstruction — no prototype pollution.
 *   8. Privacy gate: payloadPrivacyCheck(cleanPayload) — belt-and-suspenders (T-10-10).
 *   9. Commit: audit.append('operator.exported', operatorId, cleanPayload).
 *      NOTE: No targetDid for this event — the export targets a tick range, not a DID.
 *
 * Any other file in grid/src/ calling audit.append('operator.exported', ...)
 * fails the producer-boundary grep test (operator-exported-producer-boundary.test.ts).
 *
 * See: REPLAY-02, D-13-09, T-10-10 (privacy gate), T-10-08 (milliseconds defense).
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
 * Unix SECONDS upper bound — rejects any value that looks like milliseconds.
 * Date.now() in 2024 is ~1.7e12 (ms), which is >> 1e10 (s).
 * Any legitimate Unix second timestamp in the next century will be < 1e10.
 * Per D-13-09 / Phase 5 TradeRecord contract.
 */
const REQUESTED_AT_MAX = 10_000_000_000;

/** Closed 6-key payload for operator.exported (D-13-09). */
export interface OperatorExportedPayload {
    readonly tier: 'H5';
    readonly operator_id: string;    // op:<uuid-v4> — OPERATOR_ID_RE
    readonly start_tick: number;     // non-negative integer
    readonly end_tick: number;       // integer ≥ start_tick
    readonly tarball_hash: string;   // HEX64_RE — sha256 of the exported tarball
    readonly requested_at: number;   // Unix SECONDS — < REQUESTED_AT_MAX
}

/**
 * The 6 keys an operator.exported payload MUST carry — nothing more, nothing less.
 * Sorted alphabetically for the closed-tuple structural check (step 6).
 */
const EXPECTED_KEYS = [
    'end_tick', 'operator_id', 'requested_at', 'start_tick', 'tarball_hash', 'tier',
] as const;

/**
 * Sole producer path for operator.exported audit events.
 *
 * @throws TypeError if any guard fails: operator-id format, payload type,
 *   literal guards, regex/range guards, self-report invariant, extra/missing keys,
 *   or payloadPrivacyCheck rejection.
 */
export function appendOperatorExported(
    audit: AuditChain,
    operatorId: string,
    payload: OperatorExportedPayload,
): AuditEntry {
    // 1. Operator-id format guard.
    if (typeof operatorId !== 'string' || !OPERATOR_ID_RE.test(operatorId)) {
        throw new TypeError(
            `appendOperatorExported: invalid operatorId — must match OPERATOR_ID_RE (op:<uuid-v4>), got ${JSON.stringify(operatorId)}`,
        );
    }

    // 2. Type guard on payload.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendOperatorExported: payload must be a plain object`);
    }

    // 3. Literal guard — tier must be exactly 'H5'.
    if ((payload as { tier?: unknown }).tier !== 'H5') {
        throw new TypeError(
            `appendOperatorExported: tier must be literal 'H5', got ${JSON.stringify((payload as { tier?: unknown }).tier)}`,
        );
    }

    // 4. Regex / range guards on remaining fields.

    // operator_id in payload must match OPERATOR_ID_RE.
    if (typeof payload.operator_id !== 'string' || !OPERATOR_ID_RE.test(payload.operator_id)) {
        throw new TypeError(`appendOperatorExported: operator_id must match OPERATOR_ID_RE (op:<uuid-v4>)`);
    }

    // 5. Self-report invariant: payload.operator_id must equal the operatorId param.
    if (payload.operator_id !== operatorId) {
        throw new TypeError(
            `appendOperatorExported: payload.operator_id must equal operatorId (self-report invariant)`,
        );
    }

    // tarball_hash must be 64 hex chars.
    if (typeof payload.tarball_hash !== 'string' || !HEX64_RE.test(payload.tarball_hash)) {
        throw new TypeError(`appendOperatorExported: tarball_hash must match HEX64_RE (64 lowercase hex chars)`);
    }

    // start_tick must be a non-negative integer.
    if (!Number.isInteger(payload.start_tick) || payload.start_tick < 0) {
        throw new TypeError(
            `appendOperatorExported: start_tick must be a non-negative integer, got ${JSON.stringify(payload.start_tick)}`,
        );
    }

    // end_tick must be an integer ≥ start_tick.
    if (!Number.isInteger(payload.end_tick) || payload.end_tick < payload.start_tick) {
        throw new TypeError(
            `appendOperatorExported: end_tick must be an integer ≥ start_tick, got end_tick=${JSON.stringify(payload.end_tick)} start_tick=${JSON.stringify(payload.start_tick)}`,
        );
    }

    // requested_at must be a non-negative integer AND < REQUESTED_AT_MAX (Unix SECONDS defense).
    if (!Number.isInteger(payload.requested_at) || payload.requested_at < 0) {
        throw new TypeError(
            `appendOperatorExported: requested_at must be a non-negative integer, got ${JSON.stringify(payload.requested_at)}`,
        );
    }
    if (payload.requested_at >= REQUESTED_AT_MAX) {
        throw new TypeError(
            `appendOperatorExported: requested_at must be Unix SECONDS (< ${REQUESTED_AT_MAX}), got ${payload.requested_at} — use Math.floor(Date.now()/1000), not Date.now()`,
        );
    }

    // 6. Closed-tuple structural check — exactly the 6 expected keys, sorted.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendOperatorExported: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 7. Explicit reconstruction — no prototype pollution / prototype-inherited keys.
    const cleanPayload = {
        tier: 'H5' as const,
        operator_id: payload.operator_id,
        start_tick: payload.start_tick,
        end_tick: payload.end_tick,
        tarball_hash: payload.tarball_hash,
        requested_at: payload.requested_at,
    };

    // 8. Privacy gate — belt-and-suspenders (T-10-10 / D-13-09).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendOperatorExported: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 9. Commit to chain. No targetDid — the export targets a tick range, not a DID.
    return audit.append('operator.exported', operatorId, cleanPayload);
}
