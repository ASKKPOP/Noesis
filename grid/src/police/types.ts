/**
 * Phase 47 Police v3 — payload contracts for the two broadcast audit events of
 * Plan 1 (complaint + investigation). DIDs are HASHED on the audit chain (raw DIDs
 * live only in the DB tables); closed-tuple payloads, keys alphabetical.
 */

/** police.complaint_filed — a Civic-DID holder accuses another of a civic-law violation. */
export interface PoliceComplaintFiledPayload {
    readonly accused_did_hash: string;       // HEX64 — sha256(accused civicDid)
    readonly cited_law_id: string;           // UUID — the civic-law-book entry alleged violated
    readonly complainant_did_hash: string;   // HEX64 — sha256(complainant civicDid)
    readonly complaint_id: string;           // UUID
    readonly evidence_chain_hash: string;    // HEX64 — sha256 of the cited audit-event ids
    readonly tick: number;
}
export const POLICE_COMPLAINT_FILED_KEYS = [
    'accused_did_hash', 'cited_law_id', 'complainant_did_hash', 'complaint_id', 'evidence_chain_hash', 'tick',
] as const;

/** police.investigation_opened — Police open an investigation (from a complaint or a
 *  marketplace dispute). complaint_id / dispute_id are nullable but ALWAYS present
 *  (closed tuple): exactly one is non-null. */
export interface PoliceInvestigationOpenedPayload {
    readonly complaint_id: string | null;    // UUID or null
    readonly dispute_id: string | null;      // UUID or null
    readonly investigation_id: string;       // UUID
    readonly tick: number;
}
export const POLICE_INVESTIGATION_OPENED_KEYS = [
    'complaint_id', 'dispute_id', 'investigation_id', 'tick',
] as const;
