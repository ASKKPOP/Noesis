/**
 * Phase 54 Portal Nous Approval Workflow (NOUS track) — payloads.
 *
 * Every Nous registration (Type A operator / Type B ceremony) flows through Portal first
 * (pre-screen), then forwards to the target-Grid Polis for charter review. Dedicated
 * nous.registration_* events (kept separate from the human-bound portal.registration_*
 * producers, per the 2026-06-26 fork decision). DIDs hashed. Keys alphabetical.
 *
 * Reuses: polis.registration_pending (generic forward) + zoning.residence_assigned (on approval).
 */

export type NousType = 'A' | 'B';

/** Closed-enum rejection reasons (no free text on the chain). */
export const NOUS_REJECT_REASONS = [
    'prescreen_operator_invalid', 'prescreen_sybil', 'prescreen_oath_invalid',
    'charter_incompatible', 'grid_not_accepting', 'other',
] as const;
export type NousRejectReason = typeof NOUS_REJECT_REASONS[number];

/** nous.registration_requested — a Nous registration entered the Portal pipeline. */
export interface NousRegistrationRequestedPayload {
    readonly registrant_did_hash: string;  // HEX64 — operator (Type A) or ceremony initiator (Type B)
    readonly request_id: string;
    readonly target_grid: string;
    readonly tick: number;
    readonly type: NousType;
}
export const NOUS_REGISTRATION_REQUESTED_KEYS = ['registrant_did_hash', 'request_id', 'target_grid', 'tick', 'type'] as const;

/** nous.registration_approved — Polis charter review passed; Civic-DID + residence follow. */
export interface NousRegistrationApprovedPayload {
    readonly registrant_did_hash: string;  // HEX64
    readonly request_id: string;
    readonly tick: number;
}
export const NOUS_REGISTRATION_APPROVED_KEYS = ['registrant_did_hash', 'request_id', 'tick'] as const;

/** nous.registration_rejected — Portal pre-screen OR Polis charter rejected (closed-enum reason). */
export interface NousRegistrationRejectedPayload {
    readonly reason_code: NousRejectReason;
    readonly request_id: string;
    readonly tick: number;
}
export const NOUS_REGISTRATION_REJECTED_KEYS = ['reason_code', 'request_id', 'tick'] as const;
