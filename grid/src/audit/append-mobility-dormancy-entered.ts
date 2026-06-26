/**
 * Phase 51 (TYPE-B-06) — Sole-producer for mobility.dormancy_entered.
 *
 * Emitted when a freshly-converted Type B Nous enters dormancy, waiting for its Type B
 * endowment (Phase 45b) to fund it. DID hashed. actorDid = nous_did_hash. Closed 2-key.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type MobilityDormancyEnteredPayload, MOBILITY_DORMANCY_ENTERED_KEYS } from '../mobility/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendMobilityDormancyEntered(audit: AuditChain, payload: MobilityDormancyEnteredPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMobilityDormancyEntered: payload must be a plain object`);
    }
    if (typeof payload.nous_did_hash !== 'string' || !HEX64_RE.test(payload.nous_did_hash)) {
        throw new TypeError(`appendMobilityDormancyEntered: nous_did_hash must match HEX64, got ${JSON.stringify(payload.nous_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMobilityDormancyEntered: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== MOBILITY_DORMANCY_ENTERED_KEYS.length || !actualKeys.every((k, i) => k === MOBILITY_DORMANCY_ENTERED_KEYS[i])) {
        throw new TypeError(`appendMobilityDormancyEntered: closed-tuple violation — expected ${JSON.stringify(MOBILITY_DORMANCY_ENTERED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        nous_did_hash: payload.nous_did_hash,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendMobilityDormancyEntered: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('mobility.dormancy_entered', payload.nous_did_hash, cleanPayload);
}
