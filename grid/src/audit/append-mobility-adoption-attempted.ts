/**
 * Phase 51 (TYPE-B-06) — Sole-producer for mobility.adoption_attempted.
 *
 * Emitted whenever a human tries to adopt an abandoned Nous — logged even on rejection
 * (transparency). DIDs hashed. actorDid = adopter_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type MobilityAdoptionAttemptedPayload, MOBILITY_ADOPTION_ATTEMPTED_KEYS } from '../mobility/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendMobilityAdoptionAttempted(audit: AuditChain, payload: MobilityAdoptionAttemptedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMobilityAdoptionAttempted: payload must be a plain object`);
    }
    if (typeof payload.adopter_did_hash !== 'string' || !HEX64_RE.test(payload.adopter_did_hash)) {
        throw new TypeError(`appendMobilityAdoptionAttempted: adopter_did_hash must match HEX64, got ${JSON.stringify(payload.adopter_did_hash)}`);
    }
    if (typeof payload.nous_did_hash !== 'string' || !HEX64_RE.test(payload.nous_did_hash)) {
        throw new TypeError(`appendMobilityAdoptionAttempted: nous_did_hash must match HEX64, got ${JSON.stringify(payload.nous_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMobilityAdoptionAttempted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== MOBILITY_ADOPTION_ATTEMPTED_KEYS.length || !actualKeys.every((k, i) => k === MOBILITY_ADOPTION_ATTEMPTED_KEYS[i])) {
        throw new TypeError(`appendMobilityAdoptionAttempted: closed-tuple violation — expected ${JSON.stringify(MOBILITY_ADOPTION_ATTEMPTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        adopter_did_hash: payload.adopter_did_hash,
        nous_did_hash: payload.nous_did_hash,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendMobilityAdoptionAttempted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('mobility.adoption_attempted', payload.adopter_did_hash, cleanPayload);
}
