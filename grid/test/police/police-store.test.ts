/**
 * Phase 47 Police v3 (Plan 1) — PoliceStore. fileComplaint + openInvestigation:
 * inserts + sole-producer audit emits (hashed DIDs). Mock-pool unit tests.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { PoliceStore } from '../../src/police/police-store.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const LAW = '11111111-1111-4111-8111-111111111111';
const COMPLAINANT = 'did:civic:noesis:alice';
const ACCUSED = 'did:civic:noesis:bob';

describe('PoliceStore.fileComplaint (POL-01)', () => {
    it('inserts the complaint and emits police.complaint_filed with HASHED dids', async () => {
        const p = pool(); const audit = new AuditChain();
        const id = await new PoliceStore(p, audit).fileComplaint({
            gridName: 'genesis', complainantDid: COMPLAINANT, accusedDid: ACCUSED,
            citedLawId: LAW, evidenceChainHash: 'a'.repeat(64), tick: 5,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
        const insert = (p.query as ReturnType<typeof vi.fn>).mock.calls.find((c) => /INSERT INTO police_complaints/i.test(c[0]));
        expect((insert![1] as unknown[]).map(String)).toEqual(expect.arrayContaining([COMPLAINANT, ACCUSED, LAW]));
        const events = audit.query({ eventType: 'police.complaint_filed' });
        expect(events).toHaveLength(1);
        // raw DIDs must NOT appear on the chain — only their hashes.
        const payload = events[0].payload as Record<string, unknown>;
        expect(payload.complainant_did_hash).toMatch(/^[0-9a-f]{64}$/i);
        expect(JSON.stringify(payload)).not.toContain(ACCUSED);
    });
});

describe('PoliceStore.openInvestigation (POL-02)', () => {
    it('inserts the investigation, marks the complaint investigating, emits the event', async () => {
        const p = pool(); const audit = new AuditChain();
        const cid = '22222222-2222-4222-8222-222222222222';
        const id = await new PoliceStore(p, audit).openInvestigation({ gridName: 'genesis', complaintId: cid, tick: 7 });
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
        const calls = (p.query as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.some((c) => /INSERT INTO police_investigations/i.test(c[0]))).toBe(true);
        expect(calls.some((c) => /UPDATE police_complaints SET status = 'investigating'/i.test(c[0]))).toBe(true);
        const ev = audit.query({ eventType: 'police.investigation_opened' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).complaint_id).toBe(cid);
        expect((ev[0].payload as Record<string, unknown>).dispute_id).toBeNull();
    });

    it('rejects neither/both source (exactly one required)', async () => {
        const store = new PoliceStore(pool(), new AuditChain());
        await expect(store.openInvestigation({ gridName: 'genesis', tick: 1 })).rejects.toThrow(/exactly one/);
        await expect(store.openInvestigation({ gridName: 'genesis', complaintId: 'x', disputeId: 'y', tick: 1 })).rejects.toThrow(/exactly one/);
    });
});

const INV = '44444444-4444-4444-8444-444444444444';
const CHG = '55555555-5555-4555-8555-555555555555';

describe('PoliceStore.fileCharges (POL-03)', () => {
    it('inserts the charge and emits police.charges_filed with a hashed accused DID', async () => {
        const p = pool(); const audit = new AuditChain();
        const id = await new PoliceStore(p, audit).fileCharges({
            gridName: 'genesis', investigationId: INV, accusedDid: ACCUSED, allegedLawId: LAW,
            evidenceSummaryHash: 'b'.repeat(64), recommendedSanction: 'freeze', tick: 8,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
        expect((p.query as ReturnType<typeof vi.fn>).mock.calls.some((c) => /INSERT INTO police_charges/i.test(c[0]))).toBe(true);
        const ev = audit.query({ eventType: 'police.charges_filed' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).recommended_sanction).toBe('freeze');
        expect(JSON.stringify(ev[0].payload)).not.toContain(ACCUSED);
    });
});

describe('PoliceStore.recordSanction (POL-04)', () => {
    it('inserts the sanction, marks the charge executed, emits police.sanction_executed', async () => {
        const p = pool(); const audit = new AuditChain();
        const id = await new PoliceStore(p, audit).recordSanction({
            gridName: 'genesis', chargeId: CHG, accusedDid: ACCUSED, sanctionType: 'warning', tick: 9,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
        const calls = (p.query as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.some((c) => /INSERT INTO police_sanctions/i.test(c[0]))).toBe(true);
        expect(calls.some((c) => /UPDATE police_charges SET status = 'executed'/i.test(c[0]))).toBe(true);
        expect((audit.query({ eventType: 'police.sanction_executed' })[0].payload as Record<string, unknown>).sanction_type).toBe('warning');
    });
});
