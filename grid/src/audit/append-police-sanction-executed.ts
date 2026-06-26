/**
 * Phase 47 (POL-04) — Sole-producer for police.sanction_executed.
 *
 * Emitted when a sanction is carried out — ONLY after a Government conviction (the route
 * enforces the gate; this producer records the fact). accused DID hashed; material params
 * (duration / community / amount) stay in the DB. actorDid = sanction_id. Closed 5-key (alpha).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PoliceSanctionExecutedPayload, POLICE_SANCTION_EXECUTED_KEYS, SANCTION_TYPES } from '../police/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendPoliceSanctionExecuted(audit: AuditChain, payload: PoliceSanctionExecutedPayload): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPoliceSanctionExecuted: payload must be a plain object`);
    }
    // 2. accused_did_hash (HEX64).
    if (typeof payload.accused_did_hash !== 'string' || !HEX64_RE.test(payload.accused_did_hash)) {
        throw new TypeError(`appendPoliceSanctionExecuted: accused_did_hash must match HEX64, got ${JSON.stringify(payload.accused_did_hash)}`);
    }
    // 3. charge_id (UUID).
    if (typeof payload.charge_id !== 'string' || !UUID_RE.test(payload.charge_id)) {
        throw new TypeError(`appendPoliceSanctionExecuted: charge_id must be a UUID, got ${JSON.stringify(payload.charge_id)}`);
    }
    // 4. sanction_id (UUID).
    if (typeof payload.sanction_id !== 'string' || !UUID_RE.test(payload.sanction_id)) {
        throw new TypeError(`appendPoliceSanctionExecuted: sanction_id must be a UUID, got ${JSON.stringify(payload.sanction_id)}`);
    }
    // 5. sanction_type ∈ closed enum.
    if (!SANCTION_TYPES.includes(payload.sanction_type)) {
        throw new TypeError(`appendPoliceSanctionExecuted: sanction_type invalid, got ${JSON.stringify(payload.sanction_type)}`);
    }
    // 6. tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPoliceSanctionExecuted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== POLICE_SANCTION_EXECUTED_KEYS.length
        || !actualKeys.every((k, i) => k === POLICE_SANCTION_EXECUTED_KEYS[i])) {
        throw new TypeError(`appendPoliceSanctionExecuted: closed-tuple violation — expected ${JSON.stringify(POLICE_SANCTION_EXECUTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        accused_did_hash: payload.accused_did_hash,
        charge_id: payload.charge_id,
        sanction_id: payload.sanction_id,
        sanction_type: payload.sanction_type,
        tick: payload.tick,
    };
    // 9. Privacy gate + audit.append. actorDid = sanction_id.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendPoliceSanctionExecuted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('police.sanction_executed', payload.sanction_id, cleanPayload);
}
