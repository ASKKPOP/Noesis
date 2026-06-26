/**
 * Phase 37b Type B Registry (Plan 1) — Polis-α charter + Polis-β sponsor ceremonies.
 * Deliberate latency: file → (window) → issue.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { TypeBRegistryStore } from '../../src/typeb/type-b-registry-store.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const SPONSOR = 'did:civic:noesis:founder';

describe('Polis-α charter', () => {
    it('files a pending charter when under the quarter limit', async () => {
        const r = await new TypeBRegistryStore(pool([{ n: 0 }]), new AuditChain()).fileCharter({ gridName: 'genesis', sponsorDid: SPONSOR, purpose: 'a research librarian', tick: 100 });
        expect(r?.typeBDid).toMatch(/^did:noesis:nous:typeb:[0-9a-f]{16}$/i);
        expect(r?.eligibleTick).toBeGreaterThan(100);
    });
    it('returns null when the quarter charter limit (5) is reached', async () => {
        expect(await new TypeBRegistryStore(pool([{ n: 5 }]), new AuditChain()).fileCharter({ gridName: 'genesis', sponsorDid: SPONSOR, purpose: 'x', tick: 100 })).toBeNull();
    });
    it('approves after the review window → registry.type_b_chartered (hashed DIDs)', async () => {
        const audit = new AuditChain();
        const r = await new TypeBRegistryStore(pool([{ ceremony: 'alpha', status: 'pending_review', type_b_did: 'did:noesis:nous:typeb:abc', sponsor_did: SPONSOR, eligible_tick: 50 }]), audit)
            .approveCharter({ gridName: 'genesis', requestId: 'req1', tick: 99999 });
        expect(r).toEqual({ ok: true, typeBDid: 'did:noesis:nous:typeb:abc' });
        const ev = audit.query({ eventType: 'registry.type_b_chartered' });
        expect(ev).toHaveLength(1);
        expect(JSON.stringify(ev[0].payload)).not.toContain(SPONSOR);
    });
    it('rejects approval before the review window (too_early)', async () => {
        const r = await new TypeBRegistryStore(pool([{ ceremony: 'alpha', status: 'pending_review', type_b_did: 'x', sponsor_did: SPONSOR, eligible_tick: 99999 }]), new AuditChain())
            .approveCharter({ gridName: 'genesis', requestId: 'req1', tick: 100 });
        expect(r).toEqual({ ok: false, reason: 'too_early' });
    });
});

describe('Polis-β sponsor', () => {
    it('posts a sufficient bond → registry.sponsorship_bond_posted', async () => {
        const audit = new AuditChain();
        const r = await new TypeBRegistryStore(pool(), audit).postSponsorBond({ gridName: 'genesis', sponsorDid: SPONSOR, purpose: 'a market maker', bondAmount: 1000, activeTypeBCount: 0, tick: 100 });
        expect(r?.typeBDid).toMatch(/^did:noesis:nous:typeb:/);
        expect(audit.query({ eventType: 'registry.sponsorship_bond_posted' })).toHaveLength(1);
    });
    it('rejects a bond below the nonlinear required amount', async () => {
        expect(await new TypeBRegistryStore(pool(), new AuditChain()).postSponsorBond({ gridName: 'genesis', sponsorDid: SPONSOR, purpose: 'x', bondAmount: 500, activeTypeBCount: 0, tick: 100 })).toBeNull();
    });
    it('finalizes after the comment window → registry.type_b_sponsored', async () => {
        const audit = new AuditChain();
        const r = await new TypeBRegistryStore(pool([{ ceremony: 'beta', status: 'comment_window', type_b_did: 'did:noesis:nous:typeb:zzz', sponsor_did: SPONSOR, eligible_tick: 50 }]), audit)
            .finalizeSponsorship({ gridName: 'genesis', requestId: 'req1', tick: 99999 });
        expect(r).toEqual({ ok: true, typeBDid: 'did:noesis:nous:typeb:zzz' });
        expect(audit.query({ eventType: 'registry.type_b_sponsored' })).toHaveLength(1);
    });
});
