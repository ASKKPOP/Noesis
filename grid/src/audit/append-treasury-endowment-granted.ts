/**
 * Phase 45b (TYPE-B-03) — Sole-producer for treasury.endowment_granted.
 *
 * Emitted when the Foundation endows a new Type B Nous at birth (~12mo runway). DID hashed.
 * actorDid = type_b_did_hash. Closed 4-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type TreasuryEndowmentGrantedPayload, TREASURY_ENDOWMENT_GRANTED_KEYS } from '../typeb/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendTreasuryEndowmentGranted(audit: AuditChain, payload: TreasuryEndowmentGrantedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendTreasuryEndowmentGranted: payload must be a plain object`);
    }
    if (!Number.isFinite(payload.endowment_amount) || payload.endowment_amount <= 0) {
        throw new TypeError(`appendTreasuryEndowmentGranted: endowment_amount must be a positive number, got ${JSON.stringify(payload.endowment_amount)}`);
    }
    if (!Number.isInteger(payload.runway_months) || payload.runway_months <= 0) {
        throw new TypeError(`appendTreasuryEndowmentGranted: runway_months must be a positive integer, got ${JSON.stringify(payload.runway_months)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendTreasuryEndowmentGranted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.type_b_did_hash !== 'string' || !HEX64_RE.test(payload.type_b_did_hash)) {
        throw new TypeError(`appendTreasuryEndowmentGranted: type_b_did_hash must match HEX64, got ${JSON.stringify(payload.type_b_did_hash)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== TREASURY_ENDOWMENT_GRANTED_KEYS.length || !actualKeys.every((k, i) => k === TREASURY_ENDOWMENT_GRANTED_KEYS[i])) {
        throw new TypeError(`appendTreasuryEndowmentGranted: closed-tuple violation — expected ${JSON.stringify(TREASURY_ENDOWMENT_GRANTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        endowment_amount: payload.endowment_amount,
        runway_months: payload.runway_months,
        tick: payload.tick,
        type_b_did_hash: payload.type_b_did_hash,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendTreasuryEndowmentGranted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('treasury.endowment_granted', payload.type_b_did_hash, cleanPayload);
}
