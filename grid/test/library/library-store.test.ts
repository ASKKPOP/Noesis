/**
 * Phase 48 Library v3 (Plan 1) — LibraryStore. Contribute stores readable content,
 * mirrors the v2.4 lore commons, and emits lore.contributed (Civic-DID, now accepted by
 * the widened DID_RE). Cite bumps the count + emits lore.cited. Mock-pool unit tests.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { LibraryStore } from '../../src/library/library-store.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const ALICE = 'did:civic:noesis:alice';

describe('LibraryStore.contribute (CIVLIB-02)', () => {
    it('inserts readable content, upserts lore_commons, and emits lore.contributed with the Civic-DID', async () => {
        const p = pool(); const audit = new AuditChain();
        const { entryId, contentHash } = await new LibraryStore(p, audit).contribute({
            gridName: 'genesis', contributorDid: ALICE, title: 'On Minds', body: 'A study.', category: 'observation', tick: 5,
        });
        expect(entryId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(contentHash).toMatch(/^[0-9a-f]{64}$/i);
        const calls = (p.query as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.some((c) => /INSERT INTO library_entries/i.test(c[0]))).toBe(true);
        expect(calls.some((c) => /lore_commons/i.test(c[0]))).toBe(true); // v2.4 commons mirror
        const ev = audit.query({ eventType: 'lore.contributed' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).contributor_did).toBe(ALICE);
    });
});

describe('LibraryStore.cite (CIVLIB-02)', () => {
    it('increments the citation count and emits lore.cited', async () => {
        const p = pool(); const audit = new AuditChain();
        await new LibraryStore(p, audit).cite({ gridName: 'genesis', citingDid: 'did:civic:noesis:bob', contentHash: 'a'.repeat(64), tick: 6 });
        expect((p.query as ReturnType<typeof vi.fn>).mock.calls.some((c) => /UPDATE library_entries SET citation_count/i.test(c[0]))).toBe(true);
        expect(audit.query({ eventType: 'lore.cited' })).toHaveLength(1);
    });
});

describe('LibraryStore reading room (CIVLIB-01)', () => {
    it('listEntries filters by category + search and omits the body', async () => {
        const p = pool([{ entry_id: 'e1', title: 'T', category: 'synthesis', contributor_civic_did: ALICE, citation_count: 0, contributed_tick: 1, content_hash: 'b'.repeat(64) }]);
        const out = await new LibraryStore(p, new AuditChain()).listEntries({ gridName: 'genesis', category: 'synthesis', search: 'T', limit: 50, offset: 0 });
        expect(out[0].title).toBe('T');
        const [sql, params] = (p.query as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(sql).toMatch(/status = 'published'/i);
        expect((params as unknown[]).map(String)).toEqual(expect.arrayContaining(['synthesis', '%T%']));
    });
    it('getEntry returns full content (body included)', async () => {
        const p = pool([{ entry_id: 'e1', title: 'T', body: 'full text', category: 'synthesis', status: 'published', contributor_civic_did: ALICE, citation_count: 0, contributed_tick: 1, content_hash: 'b'.repeat(64) }]);
        const out = await new LibraryStore(p, new AuditChain()).getEntry('genesis', 'e1');
        expect(out?.body).toBe('full text');
    });
});
