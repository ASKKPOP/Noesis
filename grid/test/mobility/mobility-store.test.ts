/**
 * Phase 51 Type Mobility (Plan 1) — MobilityStore. abandon + adopt with ownership transfer.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { MobilityStore } from '../../src/mobility/mobility-store.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const NOUS = 'did:noesis:nous:sophia';
const OLD = 'did:noesis:human:old';
const NEW = 'did:noesis:human:new';
const pending = (windowEnd: number) => [{ nous_did: NOUS, status: 'adoption_pending', abandoned_by_human_did: OLD, window_end_tick: windowEnd }];

describe('MobilityStore.abandon', () => {
    it('opens the window + emits mobility.operator_abandoned (hashed DIDs)', async () => {
        const p = pool(); const audit = new AuditChain();
        await new MobilityStore(p, audit).abandon({ gridName: 'genesis', nousDid: NOUS, operatorDid: OLD, windowEndTick: 86405, tick: 5 });
        expect((p.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/INSERT INTO mobility_records/i);
        const ev = audit.query({ eventType: 'mobility.operator_abandoned' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).operator_did_hash).toMatch(/^[0-9a-f]{64}$/i);
        expect(JSON.stringify(ev[0].payload)).not.toContain(NOUS);
    });
});

describe('MobilityStore.adopt', () => {
    it('within the window: emits attempted + succeeded, transfers ownership', async () => {
        const p = pool(pending(999999)); const audit = new AuditChain();
        const r = await new MobilityStore(p, audit).adopt({ gridName: 'genesis', nousDid: NOUS, adopterDid: NEW, tick: 10 });
        expect(r).toEqual({ ok: true });
        const calls = (p.query as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.some((c) => /DELETE FROM nous_sponsors/i.test(c[0]))).toBe(true);
        expect(calls.some((c) => /INSERT INTO nous_sponsors/i.test(c[0]))).toBe(true);
        expect(audit.query({ eventType: 'mobility.adoption_attempted' })).toHaveLength(1);
        expect(audit.query({ eventType: 'mobility.adoption_succeeded' })).toHaveLength(1);
    });
    it('no record → not_adoptable (attempt still logged)', async () => {
        const p = pool([]); const audit = new AuditChain();
        const r = await new MobilityStore(p, audit).adopt({ gridName: 'genesis', nousDid: NOUS, adopterDid: NEW, tick: 10 });
        expect(r).toEqual({ ok: false, reason: 'not_adoptable' });
        expect(audit.query({ eventType: 'mobility.adoption_attempted' })).toHaveLength(1);
        expect(audit.query({ eventType: 'mobility.adoption_succeeded' })).toHaveLength(0);
    });
    it('past the window → window_expired', async () => {
        const r = await new MobilityStore(pool(pending(1)), new AuditChain()).adopt({ gridName: 'genesis', nousDid: NOUS, adopterDid: NEW, tick: 5 });
        expect(r).toEqual({ ok: false, reason: 'window_expired' });
    });
});
