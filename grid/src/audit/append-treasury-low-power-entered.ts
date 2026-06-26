/**
 * Phase 45b (TYPE-B-04) — Sole-producer for treasury.low_power_entered.
 *
 * Emitted when a Type B treasury's runway falls below the low-power threshold (Brain throttles
 * to a reduced tick rate). DID hashed. actorDid = type_b_did_hash. Closed 2-key.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type TreasuryLowPowerEnteredPayload, TREASURY_LOW_POWER_ENTERED_KEYS } from '../typeb/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendTreasuryLowPowerEntered(audit: AuditChain, payload: TreasuryLowPowerEnteredPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendTreasuryLowPowerEntered: payload must be a plain object`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendTreasuryLowPowerEntered: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.type_b_did_hash !== 'string' || !HEX64_RE.test(payload.type_b_did_hash)) {
        throw new TypeError(`appendTreasuryLowPowerEntered: type_b_did_hash must match HEX64, got ${JSON.stringify(payload.type_b_did_hash)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== TREASURY_LOW_POWER_ENTERED_KEYS.length || !actualKeys.every((k, i) => k === TREASURY_LOW_POWER_ENTERED_KEYS[i])) {
        throw new TypeError(`appendTreasuryLowPowerEntered: closed-tuple violation — expected ${JSON.stringify(TREASURY_LOW_POWER_ENTERED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { tick: payload.tick, type_b_did_hash: payload.type_b_did_hash };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendTreasuryLowPowerEntered: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('treasury.low_power_entered', payload.type_b_did_hash, cleanPayload);
}
