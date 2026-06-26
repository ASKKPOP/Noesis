/**
 * Phase 37b Type B Registry — birth-ceremony payloads (Plan 1: Polis-α charter + Polis-β
 * sponsor). DIDs hashed on the audit chain. Closed-tuple, keys alphabetical.
 *
 * These events ARE the Type B issuance pipeline (the Foundation/Polis ceremony) — analogous to
 * the human civic.ts pipeline — so this store never imports the Phase-37 issuance producer
 * (D-V3-33 / check-civic-did-issuance-path.mjs stays green). Every ceremony has deliberate
 * latency: no instant Type B birth.
 */
import { createHash } from 'node:crypto';

/** Polis-α: Foundation review latency (≥7 days) before a charter can be approved. */
export const CHARTER_REVIEW_TICKS = 20160; // 7 days × 24h × 3600s / 30s
/** Polis-α: ≤5 charters per calendar quarter (≈90 days). */
export const CHARTER_QUARTER_TICKS = 259200;
export const CHARTER_QUARTER_LIMIT = 5;
/** Polis-β: 7-day public comment window before a sponsorship finalizes. */
export const SPONSOR_COMMENT_TICKS = 20160;
/** Polis-β: base bond = 10× the community-founding Bios cost (Phase 49 FOUND_BIOS_COST=100). */
export const SPONSOR_BOND_BASE = 1000;

/** Deterministic prospective Type B DID for a ceremony request. */
export function prospectiveTypeBDid(sponsorDid: string, purpose: string, filedTick: number): string {
    const key = createHash('sha256').update(`${sponsorDid}|${purpose}|${filedTick}`).digest('hex').slice(0, 16);
    return `did:noesis:nous:typeb:${key}`;
}

/** Nonlinear bond: base × (activeTypeBCount + 1)² (scales with crowding, D-V3-25 sybil cost). */
export function requiredBond(activeTypeBCount: number): number {
    const n = activeTypeBCount + 1;
    return SPONSOR_BOND_BASE * n * n;
}

/** registry.type_b_chartered — Polis-α: Foundation panel approved a charter; Civic-DID issued. */
export interface RegistryTypeBCharteredPayload {
    readonly sponsor_did_hash: string;  // HEX64
    readonly tick: number;
    readonly type_b_did_hash: string;   // HEX64
}
export const REGISTRY_TYPE_B_CHARTERED_KEYS = ['sponsor_did_hash', 'tick', 'type_b_did_hash'] as const;

/** registry.sponsorship_bond_posted — Polis-β: a sponsor posted the refundable bond. */
export interface RegistrySponsorshipBondPostedPayload {
    readonly bond_amount: number;
    readonly sponsor_did_hash: string;  // HEX64
    readonly tick: number;
    readonly type_b_did_hash: string;   // HEX64 (prospective)
}
export const REGISTRY_SPONSORSHIP_BOND_POSTED_KEYS = ['bond_amount', 'sponsor_did_hash', 'tick', 'type_b_did_hash'] as const;

/** registry.type_b_sponsored — Polis-β: comment window closed with no objection; Civic-DID issued. */
export interface RegistryTypeBSponsoredPayload {
    readonly sponsor_did_hash: string;  // HEX64
    readonly tick: number;
    readonly type_b_did_hash: string;   // HEX64
}
export const REGISTRY_TYPE_B_SPONSORED_KEYS = ['sponsor_did_hash', 'tick', 'type_b_did_hash'] as const;
