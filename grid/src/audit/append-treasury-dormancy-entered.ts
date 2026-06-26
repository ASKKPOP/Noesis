/**
 * Phase 45b (TYPE-B-04) — Sole-producer for treasury.dormancy_entered.
 *
 * Emitted when a Type B treasury hits zero: the Brain stops, identity preserved indefinitely.
 * NEVER bios.death (D-V3-25 / PHILOSOPHY §9). DID hashed. actorDid = type_b_did_hash. 2-key.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type TreasuryDormancyEnteredPayload, TREASURY_DORMANCY_ENTERED_KEYS } from '../typeb/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendTreasuryDormancyEntered(audit: AuditChain, payload: TreasuryDormancyEnteredPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendTreasuryDormancyEntered: payload must be a plain object`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendTreasuryDormancyEntered: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.type_b_did_hash !== 'string' || !HEX64_RE.test(payload.type_b_did_hash)) {
        throw new TypeError(`appendTreasuryDormancyEntered: type_b_did_hash must match HEX64, got ${JSON.stringify(payload.type_b_did_hash)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== TREASURY_DORMANCY_ENTERED_KEYS.length || !actualKeys.every((k, i) => k === TREASURY_DORMANCY_ENTERED_KEYS[i])) {
        throw new TypeError(`appendTreasuryDormancyEntered: closed-tuple violation — expected ${JSON.stringify(TREASURY_DORMANCY_ENTERED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { tick: payload.tick, type_b_did_hash: payload.type_b_did_hash };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendTreasuryDormancyEntered: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('treasury.dormancy_entered', payload.type_b_did_hash, cleanPayload);
}
