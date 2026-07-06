/**
 * Phase 49 Communities v3 Plan 1 (COMM-01/02/03) — payloads + charter contract.
 * DIDs hashed on the audit chain (raw DIDs live in communities/community_members).
 */

/** D-V3-09 sybil cost: founding a community burns this much Bios (→ civic treasury;
 *  returned to treasury on dissolution, never refunded to the founder). */
export const FOUND_WEI_COST = 100;

export type MembershipCriteria = 'open' | 'approval_required' | { bios_fee: number };
export type SubgovernanceModel = 'founder_led' | 'democratic' | 'delegated';
export const SUBGOVERNANCE_MODELS: readonly SubgovernanceModel[] = ['founder_led', 'democratic', 'delegated'];

/** Machine-readable charter validated at found-time (COMM-02). */
export interface Charter {
    membership: MembershipCriteria;
    subgovernance: SubgovernanceModel;
    conduct_rules: string;
    exit_terms: string;
}

/** Validate a charter's structure. Returns the clause that failed, or null when valid. */
export function validateCharter(c: unknown): { ok: true; charter: Charter } | { ok: false; clause: string } {
    if (c === null || typeof c !== 'object' || Array.isArray(c)) return { ok: false, clause: 'charter_not_object' };
    const ch = c as Record<string, unknown>;
    const m = ch.membership;
    const membershipOk = m === 'open' || m === 'approval_required'
        || (typeof m === 'object' && m !== null && typeof (m as { bios_fee?: unknown }).bios_fee === 'number' && (m as { bios_fee: number }).bios_fee > 0);
    if (!membershipOk) return { ok: false, clause: 'membership' };
    if (!SUBGOVERNANCE_MODELS.includes(ch.subgovernance as SubgovernanceModel)) return { ok: false, clause: 'subgovernance' };
    if (typeof ch.conduct_rules !== 'string' || ch.conduct_rules.trim() === '') return { ok: false, clause: 'conduct_rules' };
    if (typeof ch.exit_terms !== 'string' || ch.exit_terms.trim() === '') return { ok: false, clause: 'exit_terms' };
    return { ok: true, charter: { membership: m as MembershipCriteria, subgovernance: ch.subgovernance as SubgovernanceModel, conduct_rules: ch.conduct_rules, exit_terms: ch.exit_terms } };
}

/** community.founded — a Civic-DID holder founds a community (paid the wei sybil cost). */
export interface CommunityFoundedPayload {
    readonly charter_hash: string;     // HEX64
    readonly community_id: string;     // UUID
    readonly founder_did_hash: string; // HEX64
    readonly name_hash: string;        // HEX64
    readonly tick: number;
    readonly wei_paid: number;
}
// Alphabetically sorted — the closed-tuple check compares Object.keys(payload).sort() element-wise.
export const COMMUNITY_FOUNDED_KEYS = ['charter_hash', 'community_id', 'founder_did_hash', 'name_hash', 'tick', 'wei_paid'] as const;

/** community.joined — a Civic-DID holder joins a community (charter satisfied). */
export interface CommunityJoinedPayload {
    readonly community_id: string;    // UUID
    readonly member_did_hash: string; // HEX64
    readonly tick: number;
}
export const COMMUNITY_JOINED_KEYS = ['community_id', 'member_did_hash', 'tick'] as const;

/** COMM-04 — subgovernance is bounded to community-internal scope. Anything outside this
 *  set is an attempt to legislate civic law → 403 out_of_scope (only the Polis makes law). */
export const INTERNAL_DECISION_SCOPES: readonly string[] = ['membership_policy', 'internal_sanction'];

/** community.posted — a member posts in the community (body stays in the DB, off-chain). */
export interface CommunityPostedPayload {
    readonly community_id: string;     // UUID
    readonly post_id: string;          // UUID
    readonly poster_did_hash: string;  // HEX64
    readonly tick: number;
}
export const COMMUNITY_POSTED_KEYS = ['community_id', 'post_id', 'poster_did_hash', 'tick'] as const;

/** community.dissolved — the community is wound down; its founding Bios stays in the treasury. */
export interface CommunityDissolvedPayload {
    readonly community_id: string;          // UUID
    readonly dissolved_by_did_hash: string; // HEX64
    readonly tick: number;
}
export const COMMUNITY_DISSOLVED_KEYS = ['community_id', 'dissolved_by_did_hash', 'tick'] as const;
