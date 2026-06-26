/**
 * Phase 47 (POL-03) — Sole-producer for police.charges_filed.
 *
 * Emitted when Police file formal charges with the Government court after an investigation
 * concludes. accused DID hashed (HEX64); recommended_sanction is a kind, not a penalty.
 * actorDid = charge_id (a civic act). Closed 7-key payload (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PoliceChargesFiledPayload, POLICE_CHARGES_FILED_KEYS, SANCTION_TYPES } from '../police/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendPoliceChargesFiled(audit: AuditChain, payload: PoliceChargesFiledPayload): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPoliceChargesFiled: payload must be a plain object`);
    }
    // 2. accused_did_hash (HEX64).
    if (typeof payload.accused_did_hash !== 'string' || !HEX64_RE.test(payload.accused_did_hash)) {
        throw new TypeError(`appendPoliceChargesFiled: accused_did_hash must match HEX64, got ${JSON.stringify(payload.accused_did_hash)}`);
    }
    // 3. alleged_law_id (UUID).
    if (typeof payload.alleged_law_id !== 'string' || !UUID_RE.test(payload.alleged_law_id)) {
        throw new TypeError(`appendPoliceChargesFiled: alleged_law_id must be a UUID, got ${JSON.stringify(payload.alleged_law_id)}`);
    }
    // 4. charge_id (UUID).
    if (typeof payload.charge_id !== 'string' || !UUID_RE.test(payload.charge_id)) {
        throw new TypeError(`appendPoliceChargesFiled: charge_id must be a UUID, got ${JSON.stringify(payload.charge_id)}`);
    }
    // 5. evidence_summary_hash (HEX64).
    if (typeof payload.evidence_summary_hash !== 'string' || !HEX64_RE.test(payload.evidence_summary_hash)) {
        throw new TypeError(`appendPoliceChargesFiled: evidence_summary_hash must match HEX64, got ${JSON.stringify(payload.evidence_summary_hash)}`);
    }
    // 6. investigation_id (UUID).
    if (typeof payload.investigation_id !== 'string' || !UUID_RE.test(payload.investigation_id)) {
        throw new TypeError(`appendPoliceChargesFiled: investigation_id must be a UUID, got ${JSON.stringify(payload.investigation_id)}`);
    }
    // 7. recommended_sanction ∈ closed enum.
    if (!SANCTION_TYPES.includes(payload.recommended_sanction)) {
        throw new TypeError(`appendPoliceChargesFiled: recommended_sanction invalid, got ${JSON.stringify(payload.recommended_sanction)}`);
    }
    // 8. tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPoliceChargesFiled: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 9. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== POLICE_CHARGES_FILED_KEYS.length
        || !actualKeys.every((k, i) => k === POLICE_CHARGES_FILED_KEYS[i])) {
        throw new TypeError(`appendPoliceChargesFiled: closed-tuple violation — expected ${JSON.stringify(POLICE_CHARGES_FILED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 10. Explicit reconstruction — no spread.
    const cleanPayload = {
        accused_did_hash: payload.accused_did_hash,
        alleged_law_id: payload.alleged_law_id,
        charge_id: payload.charge_id,
        evidence_summary_hash: payload.evidence_summary_hash,
        investigation_id: payload.investigation_id,
        recommended_sanction: payload.recommended_sanction,
        tick: payload.tick,
    };
    // 11. Privacy gate + audit.append. actorDid = charge_id.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendPoliceChargesFiled: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('police.charges_filed', payload.charge_id, cleanPayload);
}
