/**
 * Phase 53 Portal Grid Approval Workflow — payloads. The grid-side implementation of the Portal
 * pipeline (the same pattern as the Phase 54 human track: portal.* events on the grid chain;
 * the standalone Portal service extraction is Phase 52, deferred). DIDs hashed. Keys alphabetical.
 *
 * v3.0 ships the workflow but no Grid is actually created (only Genesis exists); v3.1+ activates it.
 */

/** Reviewer approvals are rate-limited to ≤2 new Grids per quarter (≈90 days). */
export const GRID_QUARTER_TICKS = 259200;
export const GRID_QUARTER_APPROVAL_LIMIT = 2;

/** Closed enum of rejection reasons (no free text on the chain). */
export const GRID_REJECT_REASONS = ['charter_incompatible', 'insufficient_capital', 'duplicate_name', 'panel_declined', 'other'] as const;
export type GridRejectReason = typeof GRID_REJECT_REASONS[number];

/** portal.grid_creation_requested — a requester proposed a new Grid. */
export interface PortalGridCreationRequestedPayload {
    readonly proposed_name: string;
    readonly request_id: string;
    readonly requester_did_hash: string;  // HEX64
    readonly tick: number;
}
export const PORTAL_GRID_CREATION_REQUESTED_KEYS = ['proposed_name', 'request_id', 'requester_did_hash', 'tick'] as const;

/** portal.grid_creation_approved — reviewer panel approved (majority); Grid would instantiate. */
export interface PortalGridCreationApprovedPayload {
    readonly request_id: string;
    readonly reviewer_did_hash: string;  // HEX64
    readonly tick: number;
}
export const PORTAL_GRID_CREATION_APPROVED_KEYS = ['request_id', 'reviewer_did_hash', 'tick'] as const;

/** portal.grid_creation_rejected — request closed with a closed-enum reason. */
export interface PortalGridCreationRejectedPayload {
    readonly reason: GridRejectReason;
    readonly request_id: string;
    readonly reviewer_did_hash: string;  // HEX64
    readonly tick: number;
}
export const PORTAL_GRID_CREATION_REJECTED_KEYS = ['reason', 'request_id', 'reviewer_did_hash', 'tick'] as const;
