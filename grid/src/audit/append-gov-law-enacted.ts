/**
 * Phase 46 (CIVGOV-05/06) — Sole-producer for gov.law_enacted.
 *
 * Emitted when a passed bill enters the civic law book. actorDid = law_id (a civic/system
 * act, not a person). supersedes_law_id is ALWAYS present for closed-tuple integrity:
 * a UUID when this law replaces an existing one, or null. Closed 4-key payload (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type GovLawEnactedPayload, GOV_LAW_ENACTED_KEYS } from '../gov/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function appendGovLawEnacted(
    audit: AuditChain,
    payload: GovLawEnactedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGovLawEnacted: payload must be a plain object`);
    }
    // 2. Regex: bill_id (UUID).
    if (typeof payload.bill_id !== 'string' || !UUID_RE.test(payload.bill_id)) {
        throw new TypeError(`appendGovLawEnacted: bill_id must be a UUID, got ${JSON.stringify(payload.bill_id)}`);
    }
    // 3. Regex: law_id (UUID).
    if (typeof payload.law_id !== 'string' || !UUID_RE.test(payload.law_id)) {
        throw new TypeError(`appendGovLawEnacted: law_id must be a UUID, got ${JSON.stringify(payload.law_id)}`);
    }
    // 4. Nullable UUID: supersedes_law_id (null allowed; if non-null must be UUID).
    if (payload.supersedes_law_id !== null
        && (typeof payload.supersedes_law_id !== 'string' || !UUID_RE.test(payload.supersedes_law_id))) {
        throw new TypeError(`appendGovLawEnacted: supersedes_law_id must be a UUID or null, got ${JSON.stringify(payload.supersedes_law_id)}`);
    }
    // 5. Non-negative integer: enacted_at_tick.
    if (!Number.isInteger(payload.enacted_at_tick) || payload.enacted_at_tick < 0) {
        throw new TypeError(`appendGovLawEnacted: enacted_at_tick must be non-negative integer, got ${JSON.stringify(payload.enacted_at_tick)}`);
    }
    // 6. Closed-tuple structural check (supersedes_law_id key always present).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== GOV_LAW_ENACTED_KEYS.length
        || !actualKeys.every((k, i) => k === GOV_LAW_ENACTED_KEYS[i])) {
        throw new TypeError(`appendGovLawEnacted: closed-tuple violation — expected ${JSON.stringify(GOV_LAW_ENACTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        bill_id: payload.bill_id,
        enacted_at_tick: payload.enacted_at_tick,
        law_id: payload.law_id,
        supersedes_law_id: payload.supersedes_law_id,
    };
    // 8. Privacy gate + audit.append. actorDid = law_id.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGovLawEnacted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('gov.law_enacted', payload.law_id, cleanPayload);
}
