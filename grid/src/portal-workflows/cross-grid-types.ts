/**
 * Phase 55 Portal Cross-Grid Framework (DORMANT in v3.0, active v3.1+) — payloads.
 *
 * v3.0 ships the framework but only Genesis is active, so cross-Grid features are dormant:
 * the read endpoints return at most [Genesis], the marketplace-mediation endpoint returns
 * 503 not_yet_active, and these two events are ALLOWLISTED BUT NEVER FIRE in v3.0 (their
 * sole-producers exist for v3.1). DIDs hashed. Keys alphabetical.
 */

/** Reason returned by every dormant cross-Grid action endpoint in v3.0. */
export const CROSS_GRID_DORMANT_REASON = 'not_yet_active';

/** portal.cross_grid_action_mediated — DORMANT v3.0: a cross-Grid action mediated by Portal. */
export interface PortalCrossGridActionMediatedPayload {
    readonly account_did_hash: string;  // HEX64
    readonly action_id: string;
    readonly source_grid: string;
    readonly target_grid: string;
    readonly tick: number;
}
export const PORTAL_CROSS_GRID_ACTION_MEDIATED_KEYS = ['account_did_hash', 'action_id', 'source_grid', 'target_grid', 'tick'] as const;

/** portal.cross_grid_identity_linked — DORMANT v3.0: an existence-DID linked to a Civic-DID on a Grid. */
export interface PortalCrossGridIdentityLinkedPayload {
    readonly account_did_hash: string;  // HEX64
    readonly civic_did_hash: string;    // HEX64
    readonly grid_name: string;
    readonly tick: number;
}
export const PORTAL_CROSS_GRID_IDENTITY_LINKED_KEYS = ['account_did_hash', 'civic_did_hash', 'grid_name', 'tick'] as const;
