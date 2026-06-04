/**
 * Phase 46 (CIVGOV-05/06) — Sole-producer for gov.law_repealed.
 *
 * Emitted when an active law is repealed by a passed bill, with citation to the
 * repealing legislation. actorDid = law_id. Closed 3-key payload (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type GovLawRepealedPayload, GOV_LAW_REPEALED_KEYS } from '../gov/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function appendGovLawRepealed(
    audit: AuditChain,
    payload: GovLawRepealedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGovLawRepealed: payload must be a plain object`);
    }
    // 2. Regex: law_id (UUID).
    if (typeof payload.law_id !== 'string' || !UUID_RE.test(payload.law_id)) {
        throw new TypeError(`appendGovLawRepealed: law_id must be a UUID, got ${JSON.stringify(payload.law_id)}`);
    }
    // 3. Regex: repealing_bill_id (UUID).
    if (typeof payload.repealing_bill_id !== 'string' || !UUID_RE.test(payload.repealing_bill_id)) {
        throw new TypeError(`appendGovLawRepealed: repealing_bill_id must be a UUID, got ${JSON.stringify(payload.repealing_bill_id)}`);
    }
    // 4. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGovLawRepealed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== GOV_LAW_REPEALED_KEYS.length
        || !actualKeys.every((k, i) => k === GOV_LAW_REPEALED_KEYS[i])) {
        throw new TypeError(`appendGovLawRepealed: closed-tuple violation — expected ${JSON.stringify(GOV_LAW_REPEALED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        law_id: payload.law_id,
        repealing_bill_id: payload.repealing_bill_id,
        tick: payload.tick,
    };
    // 7. Privacy gate + audit.append. actorDid = law_id.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGovLawRepealed: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('gov.law_repealed', payload.law_id, cleanPayload);
}
