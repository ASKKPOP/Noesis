/**
 * Phase 47 (POL-01) — Sole-producer for police.complaint_filed.
 *
 * Emitted when a Civic-DID holder files a complaint accusing another of a civic-law
 * violation. DIDs are hashed (HEX64). actorDid = complainant_did_hash. Closed 6-key
 * payload (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type PoliceComplaintFiledPayload, POLICE_COMPLAINT_FILED_KEYS } from '../police/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendPoliceComplaintFiled(
    audit: AuditChain,
    payload: PoliceComplaintFiledPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPoliceComplaintFiled: payload must be a plain object`);
    }
    // 2. Regex: accused_did_hash (HEX64).
    if (typeof payload.accused_did_hash !== 'string' || !HEX64_RE.test(payload.accused_did_hash)) {
        throw new TypeError(`appendPoliceComplaintFiled: accused_did_hash must match HEX64, got ${JSON.stringify(payload.accused_did_hash)}`);
    }
    // 3. Regex: cited_law_id (UUID).
    if (typeof payload.cited_law_id !== 'string' || !UUID_RE.test(payload.cited_law_id)) {
        throw new TypeError(`appendPoliceComplaintFiled: cited_law_id must be a UUID, got ${JSON.stringify(payload.cited_law_id)}`);
    }
    // 4. Regex: complainant_did_hash (HEX64).
    if (typeof payload.complainant_did_hash !== 'string' || !HEX64_RE.test(payload.complainant_did_hash)) {
        throw new TypeError(`appendPoliceComplaintFiled: complainant_did_hash must match HEX64, got ${JSON.stringify(payload.complainant_did_hash)}`);
    }
    // 5. Regex: complaint_id (UUID).
    if (typeof payload.complaint_id !== 'string' || !UUID_RE.test(payload.complaint_id)) {
        throw new TypeError(`appendPoliceComplaintFiled: complaint_id must be a UUID, got ${JSON.stringify(payload.complaint_id)}`);
    }
    // 6. Regex: evidence_chain_hash (HEX64).
    if (typeof payload.evidence_chain_hash !== 'string' || !HEX64_RE.test(payload.evidence_chain_hash)) {
        throw new TypeError(`appendPoliceComplaintFiled: evidence_chain_hash must match HEX64, got ${JSON.stringify(payload.evidence_chain_hash)}`);
    }
    // 7. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPoliceComplaintFiled: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 8. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== POLICE_COMPLAINT_FILED_KEYS.length
        || !actualKeys.every((k, i) => k === POLICE_COMPLAINT_FILED_KEYS[i])) {
        throw new TypeError(`appendPoliceComplaintFiled: closed-tuple violation — expected ${JSON.stringify(POLICE_COMPLAINT_FILED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 9. Explicit reconstruction — no spread.
    const cleanPayload = {
        accused_did_hash: payload.accused_did_hash,
        cited_law_id: payload.cited_law_id,
        complainant_did_hash: payload.complainant_did_hash,
        complaint_id: payload.complaint_id,
        evidence_chain_hash: payload.evidence_chain_hash,
        tick: payload.tick,
    };
    // 10. Privacy gate + audit.append. actorDid = complainant_did_hash.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPoliceComplaintFiled: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('police.complaint_filed', payload.complainant_did_hash, cleanPayload);
}
