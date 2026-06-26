/**
 * Phase 45b (TYPE-B-04) — Sole-producer for treasury.revived.
 *
 * Emitted when a dormant Type B Nous's funding is restored above the revival threshold (via
 * donation or Polis grant): the Brain resumes. DID hashed. actorDid = type_b_did_hash. 2-key.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type TreasuryRevivedPayload, TREASURY_REVIVED_KEYS } from '../typeb/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendTreasuryRevived(audit: AuditChain, payload: TreasuryRevivedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendTreasuryRevived: payload must be a plain object`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendTreasuryRevived: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.type_b_did_hash !== 'string' || !HEX64_RE.test(payload.type_b_did_hash)) {
        throw new TypeError(`appendTreasuryRevived: type_b_did_hash must match HEX64, got ${JSON.stringify(payload.type_b_did_hash)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== TREASURY_REVIVED_KEYS.length || !actualKeys.every((k, i) => k === TREASURY_REVIVED_KEYS[i])) {
        throw new TypeError(`appendTreasuryRevived: closed-tuple violation — expected ${JSON.stringify(TREASURY_REVIVED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { tick: payload.tick, type_b_did_hash: payload.type_b_did_hash };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendTreasuryRevived: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('treasury.revived', payload.type_b_did_hash, cleanPayload);
}
