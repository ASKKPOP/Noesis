/**
 * Phase 49 Communities v3 Plan 1 (COMM-01/02/03) — payloads + charter contract.
 * DIDs hashed on the audit chain (raw DIDs live in communities/community_members).
 */

/** D-V3-09 sybil cost: founding a community burns this much Bios (→ civic treasury;
 *  returned to treasury on dissolution, never refunded to the founder). */
export const FOUND_BIOS_COST = 100;

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

/** community.founded — a Civic-DID holder founds a community (paid the Bios sybil cost). */
export interface CommunityFoundedPayload {
    readonly bios_paid: number;
    readonly charter_hash: string;     // HEX64
    readonly community_id: string;     // UUID
    readonly founder_did_hash: string; // HEX64
    readonly name_hash: string;        // HEX64
    readonly tick: number;
}
export const COMMUNITY_FOUNDED_KEYS = ['bios_paid', 'charter_hash', 'community_id', 'founder_did_hash', 'name_hash', 'tick'] as const;

/** community.joined — a Civic-DID holder joins a community (charter satisfied). */
export interface CommunityJoinedPayload {
    readonly community_id: string;    // UUID
    readonly member_did_hash: string; // HEX64
    readonly tick: number;
}
export const COMMUNITY_JOINED_KEYS = ['community_id', 'member_did_hash', 'tick'] as const;
