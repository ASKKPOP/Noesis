/**
 * Phase 57 Grid Zoning (Plan 2) — ResidenceStore. assignResidence → zoning.residence_assigned.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ResidenceStore } from '../../src/zoning/residence-store.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(): Pool {
    return { query: vi.fn().mockResolvedValue([[] as RowDataPacket[], {}]) } as unknown as Pool;
}
const CIVIC = 'did:civic:noesis:human:alice';

describe('ResidenceStore.assignResidence', () => {
    it('allocates a deterministic residence + emits zoning.residence_assigned (hashed DID)', async () => {
        const p = pool(); const audit = new AuditChain();
        const r = await new ResidenceStore(p, audit).assignResidence({ gridName: 'genesis', civicDid: CIVIC, tick: 5 });
        expect(r.residenceId).toMatch(/^res-[0-9a-f]{12}$/i);
        const ev = audit.query({ eventType: 'zoning.residence_assigned' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).residence_id).toBe(r.residenceId);
        expect(JSON.stringify(ev[0].payload)).not.toContain(CIVIC);
    });
    it('is deterministic for the same Civic-DID', async () => {
        const a = await new ResidenceStore(pool(), new AuditChain()).assignResidence({ gridName: 'genesis', civicDid: CIVIC, tick: 5 });
        const b = await new ResidenceStore(pool(), new AuditChain()).assignResidence({ gridName: 'genesis', civicDid: CIVIC, tick: 9 });
        expect(a.residenceId).toBe(b.residenceId);
    });
});
