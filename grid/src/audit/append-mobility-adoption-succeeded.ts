/**
 * Phase 51 (TYPE-B-06) — Sole-producer for mobility.adoption_succeeded.
 *
 * Emitted when an adoption is accepted; the Nous stays Type A under the new operator.
 * DIDs hashed. actorDid = adopter_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type MobilityAdoptionSucceededPayload, MOBILITY_ADOPTION_SUCCEEDED_KEYS } from '../mobility/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendMobilityAdoptionSucceeded(audit: AuditChain, payload: MobilityAdoptionSucceededPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMobilityAdoptionSucceeded: payload must be a plain object`);
    }
    if (typeof payload.adopter_did_hash !== 'string' || !HEX64_RE.test(payload.adopter_did_hash)) {
        throw new TypeError(`appendMobilityAdoptionSucceeded: adopter_did_hash must match HEX64, got ${JSON.stringify(payload.adopter_did_hash)}`);
    }
    if (typeof payload.nous_did_hash !== 'string' || !HEX64_RE.test(payload.nous_did_hash)) {
        throw new TypeError(`appendMobilityAdoptionSucceeded: nous_did_hash must match HEX64, got ${JSON.stringify(payload.nous_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMobilityAdoptionSucceeded: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== MOBILITY_ADOPTION_SUCCEEDED_KEYS.length || !actualKeys.every((k, i) => k === MOBILITY_ADOPTION_SUCCEEDED_KEYS[i])) {
        throw new TypeError(`appendMobilityAdoptionSucceeded: closed-tuple violation — expected ${JSON.stringify(MOBILITY_ADOPTION_SUCCEEDED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        adopter_did_hash: payload.adopter_did_hash,
        nous_did_hash: payload.nous_did_hash,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendMobilityAdoptionSucceeded: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('mobility.adoption_succeeded', payload.adopter_did_hash, cleanPayload);
}
