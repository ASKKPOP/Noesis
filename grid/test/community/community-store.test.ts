/**
 * Phase 49 Communities v3 (Plan 1) — CommunityStore + charter validation.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { CommunityStore } from '../../src/community/community-store.js';
import { validateCharter, type Charter } from '../../src/community/types.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const FOUNDER = 'did:civic:noesis:alice';
const CHARTER: Charter = { membership: 'open', subgovernance: 'founder_led', conduct_rules: 'be kind', exit_terms: 'leave anytime' };

describe('validateCharter (COMM-02)', () => {
    it('accepts a well-formed charter and the three membership criteria', () => {
        expect(validateCharter(CHARTER).ok).toBe(true);
        expect(validateCharter({ ...CHARTER, membership: 'approval_required' }).ok).toBe(true);
        expect(validateCharter({ ...CHARTER, membership: { bios_fee: 50 } }).ok).toBe(true);
    });
    it('rejects each invalid clause with its name', () => {
        expect(validateCharter({ ...CHARTER, membership: 'whatever' })).toEqual({ ok: false, clause: 'membership' });
        expect(validateCharter({ ...CHARTER, subgovernance: 'dictator' })).toEqual({ ok: false, clause: 'subgovernance' });
        expect(validateCharter({ ...CHARTER, conduct_rules: '' })).toEqual({ ok: false, clause: 'conduct_rules' });
        expect(validateCharter({ ...CHARTER, exit_terms: '' })).toEqual({ ok: false, clause: 'exit_terms' });
        expect(validateCharter(null)).toEqual({ ok: false, clause: 'charter_not_object' });
    });
});

describe('CommunityStore.found (COMM-01)', () => {
    it('inserts the community + seats the founder + emits community.founded (hashed DIDs)', async () => {
        const p = pool(); const audit = new AuditChain();
        const id = await new CommunityStore(p, audit).found({ gridName: 'genesis', founderDid: FOUNDER, name: 'Stoics', purpose: 'study', charter: CHARTER, biosPaid: 100, tick: 5 });
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
        const calls = (p.query as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.some((c) => /INSERT INTO communities/i.test(c[0]))).toBe(true);
        expect(calls.some((c) => /INSERT INTO community_members.*'founder'/is.test(c[0]))).toBe(true);
        const ev = audit.query({ eventType: 'community.founded' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).founder_did_hash).toMatch(/^[0-9a-f]{64}$/i);
        expect(JSON.stringify(ev[0].payload)).not.toContain(FOUNDER);
    });
});

describe('CommunityStore.addMember (COMM-03)', () => {
    it('active membership emits community.joined', async () => {
        const p = pool(); const audit = new AuditChain();
        await new CommunityStore(p, audit).addMember({ gridName: 'genesis', communityId: '22222222-2222-4222-8222-222222222222', memberDid: 'did:civic:noesis:bob', status: 'active', tick: 6 });
        expect(audit.query({ eventType: 'community.joined' })).toHaveLength(1);
    });
    it('pending membership does NOT emit (queued for approval)', async () => {
        const p = pool(); const audit = new AuditChain();
        await new CommunityStore(p, audit).addMember({ gridName: 'genesis', communityId: '22222222-2222-4222-8222-222222222222', memberDid: 'did:civic:noesis:bob', status: 'pending', tick: 6 });
        expect(audit.query({ eventType: 'community.joined' })).toHaveLength(0);
    });
});

describe('CommunityStore Plan 2 (COMM-04/05)', () => {
    const CID = '22222222-2222-4222-8222-222222222222';
    it('post inserts + emits community.posted (body off-chain)', async () => {
        const p = pool(); const audit = new AuditChain();
        const id = await new CommunityStore(p, audit).post({ gridName: 'genesis', communityId: CID, posterDid: FOUNDER, body: 'hello all', tick: 7 });
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
        expect((p.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/INSERT INTO community_posts/i);
        const ev = audit.query({ eventType: 'community.posted' });
        expect(ev).toHaveLength(1);
        expect(JSON.stringify(ev[0].payload)).not.toContain('hello all'); // body off-chain
    });
    it('dissolve flips status + emits community.dissolved', async () => {
        const p = pool(); const audit = new AuditChain();
        await new CommunityStore(p, audit).dissolve({ gridName: 'genesis', communityId: CID, byDid: FOUNDER, tick: 8 });
        expect((p.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/UPDATE communities SET status = 'dissolved'/i);
        expect(audit.query({ eventType: 'community.dissolved' })).toHaveLength(1);
    });
});
