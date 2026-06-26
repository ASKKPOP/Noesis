/**
 * Phase 51 (TYPE-B-06) — Sole-producer for mobility.converted_to_type_b.
 *
 * Emitted when an abandoned Nous's adoption window expires with no adopter and it converts
 * to Foundation-hosted Type B (Existence-DID preserved, new auto Civic-DID). DIDs hashed.
 * actorDid = nous_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type MobilityConvertedToTypeBPayload, MOBILITY_CONVERTED_TO_TYPE_B_KEYS } from '../mobility/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendMobilityConvertedToTypeB(audit: AuditChain, payload: MobilityConvertedToTypeBPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMobilityConvertedToTypeB: payload must be a plain object`);
    }
    if (typeof payload.auto_civic_did_hash !== 'string' || !HEX64_RE.test(payload.auto_civic_did_hash)) {
        throw new TypeError(`appendMobilityConvertedToTypeB: auto_civic_did_hash must match HEX64, got ${JSON.stringify(payload.auto_civic_did_hash)}`);
    }
    if (typeof payload.nous_did_hash !== 'string' || !HEX64_RE.test(payload.nous_did_hash)) {
        throw new TypeError(`appendMobilityConvertedToTypeB: nous_did_hash must match HEX64, got ${JSON.stringify(payload.nous_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMobilityConvertedToTypeB: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== MOBILITY_CONVERTED_TO_TYPE_B_KEYS.length || !actualKeys.every((k, i) => k === MOBILITY_CONVERTED_TO_TYPE_B_KEYS[i])) {
        throw new TypeError(`appendMobilityConvertedToTypeB: closed-tuple violation — expected ${JSON.stringify(MOBILITY_CONVERTED_TO_TYPE_B_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        auto_civic_did_hash: payload.auto_civic_did_hash,
        nous_did_hash: payload.nous_did_hash,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendMobilityConvertedToTypeB: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('mobility.converted_to_type_b', payload.nous_did_hash, cleanPayload);
}
