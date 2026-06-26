/**
 * Phase 51 (TYPE-B-06) — Sole-producer for mobility.operator_abandoned.
 *
 * Emitted when an owning operator declares it will stop hosting a Nous, opening the
 * 30-day adoption window. DIDs hashed. actorDid = operator_did_hash. Closed 4-key (alpha).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type MobilityOperatorAbandonedPayload, MOBILITY_OPERATOR_ABANDONED_KEYS } from '../mobility/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendMobilityOperatorAbandoned(audit: AuditChain, payload: MobilityOperatorAbandonedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMobilityOperatorAbandoned: payload must be a plain object`);
    }
    if (typeof payload.nous_did_hash !== 'string' || !HEX64_RE.test(payload.nous_did_hash)) {
        throw new TypeError(`appendMobilityOperatorAbandoned: nous_did_hash must match HEX64, got ${JSON.stringify(payload.nous_did_hash)}`);
    }
    if (typeof payload.operator_did_hash !== 'string' || !HEX64_RE.test(payload.operator_did_hash)) {
        throw new TypeError(`appendMobilityOperatorAbandoned: operator_did_hash must match HEX64, got ${JSON.stringify(payload.operator_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendMobilityOperatorAbandoned: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (!Number.isInteger(payload.window_end_tick) || payload.window_end_tick <= payload.tick) {
        throw new TypeError(`appendMobilityOperatorAbandoned: window_end_tick must be an integer > tick, got ${JSON.stringify(payload.window_end_tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== MOBILITY_OPERATOR_ABANDONED_KEYS.length || !actualKeys.every((k, i) => k === MOBILITY_OPERATOR_ABANDONED_KEYS[i])) {
        throw new TypeError(`appendMobilityOperatorAbandoned: closed-tuple violation — expected ${JSON.stringify(MOBILITY_OPERATOR_ABANDONED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        nous_did_hash: payload.nous_did_hash,
        operator_did_hash: payload.operator_did_hash,
        tick: payload.tick,
        window_end_tick: payload.window_end_tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendMobilityOperatorAbandoned: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('mobility.operator_abandoned', payload.operator_did_hash, cleanPayload);
}
