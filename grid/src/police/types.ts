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

/** The four sanction kinds (POL-04). */
export type SanctionType = 'freeze' | 'exile' | 'fine' | 'warning';
export const SANCTION_TYPES: readonly SanctionType[] = ['freeze', 'exile', 'fine', 'warning'];

/** police.charges_filed — Police file formal charges with the Government court after an
 *  investigation concludes. recommended_sanction is the *range* (a sanction kind), not an
 *  executed penalty. accused DID hashed. */
export interface PoliceChargesFiledPayload {
    readonly accused_did_hash: string;       // HEX64
    readonly alleged_law_id: string;         // UUID — the law alleged violated
    readonly charge_id: string;              // UUID
    readonly evidence_summary_hash: string;  // HEX64
    readonly investigation_id: string;       // UUID
    readonly recommended_sanction: SanctionType;
    readonly tick: number;
}
export const POLICE_CHARGES_FILED_KEYS = [
    'accused_did_hash', 'alleged_law_id', 'charge_id', 'evidence_summary_hash', 'investigation_id', 'recommended_sanction', 'tick',
] as const;

/** police.sanction_executed — a sanction carried out AFTER a Government conviction. The
 *  material parameters (duration / community / amount) stay in the DB; the chain carries
 *  only the kind. accused DID hashed. */
export interface PoliceSanctionExecutedPayload {
    readonly accused_did_hash: string;   // HEX64
    readonly charge_id: string;          // UUID
    readonly sanction_id: string;        // UUID
    readonly sanction_type: SanctionType;
    readonly tick: number;
}
export const POLICE_SANCTION_EXECUTED_KEYS = [
    'accused_did_hash', 'charge_id', 'sanction_id', 'sanction_type', 'tick',
] as const;
