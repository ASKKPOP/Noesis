/**
 * appendIrsDisbursementExecuted — SOLE producer boundary for `irs.disbursement_executed` audit events.
 *
 * Phase 41 / SLEEP-05 — pre-emits irs.disbursement_executed for presumed_departed Bios transfer.
 * Phase 45 (IRS Treasury) will own the full IRS module and add this event to the broadcast
 * allowlist (+3 delta). Phase 41 emits it audit-chain-only — Phase 41 allowlist delta = 0.
 *
 * The audit chain appends every entry regardless of broadcast allowlist membership; the
 * allowlist gate filters which entries fan out to the WSS firehose. Audit chain hash discipline
 * (R-31-01 zero-diff) is preserved — `irs.disbursement_executed` writes into the chain like any
 * other event; downstream broadcast subscribers do not receive it until Phase 45 ships.
 *
 * 8-step discipline mirrors appendRegistryCivicDidIssued.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

/** Closed-tuple payload — 5 keys, alphabetical. */
export interface IrsDisbursementExecutedPayload {
    readonly amount_bios: number;       // non-negative integer
    readonly cause: string;             // e.g. 'presumed_departed' — non-empty
    readonly civic_did: string;         // CIVIC_DID_RE — the source (departed Nous)
    readonly grid_name: string;         // non-empty
    readonly tick: number;              // non-negative integer
}

const EXPECTED_KEYS = ['amount_bios', 'cause', 'civic_did', 'grid_name', 'tick'] as const;

export function appendIrsDisbursementExecuted(
    audit: AuditChain,
    payload: IrsDisbursementExecutedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('appendIrsDisbursementExecuted: payload must be a plain object');
    }
    // 2. Regex guard: civic_did.
    if (typeof payload.civic_did !== 'string' || !CIVIC_DID_RE.test(payload.civic_did)) {
        throw new TypeError(`appendIrsDisbursementExecuted: civic_did must match CIVIC_DID_RE, got ${JSON.stringify(payload.civic_did)}`);
    }
    // 3. Non-empty string guards: cause + grid_name.
    if (typeof payload.cause !== 'string' || payload.cause.length === 0) {
        throw new TypeError(`appendIrsDisbursementExecuted: cause must be a non-empty string, got ${JSON.stringify(payload.cause)}`);
    }
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(`appendIrsDisbursementExecuted: grid_name must be a non-empty string, got ${JSON.stringify(payload.grid_name)}`);
    }
    // 4. Non-negative integer guards.
    if (!Number.isInteger(payload.amount_bios) || payload.amount_bios < 0) {
        throw new TypeError(`appendIrsDisbursementExecuted: amount_bios must be a non-negative integer, got ${JSON.stringify(payload.amount_bios)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendIrsDisbursementExecuted: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Closed-tuple structural check (alphabetical order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendIrsDisbursementExecuted: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_bios: payload.amount_bios,
        cause: payload.cause,
        civic_did: payload.civic_did,
        grid_name: payload.grid_name,
        tick: payload.tick,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendIrsDisbursementExecuted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    // 8. Commit to chain. NOT in broadcast allowlist — audit-chain only.
    return audit.append('irs.disbursement_executed', payload.civic_did, cleanPayload);
}
