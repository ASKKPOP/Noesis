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

const issuedBeta = (bond = 1000, filed = 0) => [{ ceremony: 'beta', status: 'issued', type_b_did: 'did:noesis:nous:typeb:b', sponsor_did: SPONSOR, eligible_tick: 0, bond_amount: bond, filed_tick: filed }];

describe('Polis-β bond refund / slash (Plan 2)', () => {
    it('refunds after 12mo when minimums are met → registry.sponsorship_bond_refunded', async () => {
        const audit = new AuditChain();
        const r = await new TypeBRegistryStore(pool(issuedBeta()), audit).refundBond({ gridName: 'genesis', requestId: 'req1', meetsMinimums: true, tick: 99_999_999 });
        expect(r).toEqual({ ok: true, amount: 1000, sponsorDid: SPONSOR });
        expect(audit.query({ eventType: 'registry.sponsorship_bond_refunded' })).toHaveLength(1);
    });
    it('rejects a refund before the 12mo window (too_early)', async () => {
        const r = await new TypeBRegistryStore(pool(issuedBeta(1000, 99_999_999)), new AuditChain()).refundBond({ gridName: 'genesis', requestId: 'req1', meetsMinimums: true, tick: 100 });
        expect(r).toEqual({ ok: false, reason: 'too_early' });
    });
    it('slashes a bond on sanction → registry.sponsorship_bond_slashed', async () => {
        const audit = new AuditChain();
        const r = await new TypeBRegistryStore(pool(issuedBeta()), audit).slashBond({ gridName: 'genesis', requestId: 'req1', tick: 500 });
        expect(r).toEqual({ ok: true, amount: 1000 });
        expect(audit.query({ eventType: 'registry.sponsorship_bond_slashed' })).toHaveLength(1);
    });
});

describe('Polis-γ spawnByParent (Plan 2 — store, gated route)', () => {
    it('emits registry.type_b_spawned_by_parent (hashed DIDs)', async () => {
        const audit = new AuditChain();
        const r = await new TypeBRegistryStore(pool(), audit).spawnByParent({ gridName: 'genesis', parentDid: 'did:noesis:nous:elder', purpose: 'a child', tick: 7 });
        expect(r.typeBDid).toMatch(/^did:noesis:nous:typeb:/);
        const ev = audit.query({ eventType: 'registry.type_b_spawned_by_parent' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).parent_did_hash).toMatch(/^[0-9a-f]{64}$/i);
    });
});
