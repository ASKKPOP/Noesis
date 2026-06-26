/**
 * Phase 45b Treasury Operations (Plan 1) — TypeBTreasuryStore. endow / dormancy / donate+revive.
 * INVARIANT: never bios.death (enforced separately by check-treasury-no-bios-death.mjs).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { TypeBTreasuryStore } from '../../src/typeb/type-b-treasury-store.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const DID = 'did:noesis:nous:auto:abc123';

describe('TypeBTreasuryStore.endow', () => {
    it('credits the treasury + emits treasury.endowment_granted (hashed DID)', async () => {
        const p = pool(); const audit = new AuditChain();
        await new TypeBTreasuryStore(p, audit).endow({ gridName: 'genesis', typeBDid: DID, amount: 12000, tick: 5 });
        const ev = audit.query({ eventType: 'treasury.endowment_granted' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).endowment_amount).toBe(12000);
        expect((ev[0].payload as Record<string, unknown>).runway_months).toBe(12);
        expect(JSON.stringify(ev[0].payload)).not.toContain(DID);
    });
});

describe('TypeBTreasuryStore.enterDormancy', () => {
    it('marks dormant + emits treasury.dormancy_entered — and NEVER bios.death', async () => {
        const p = pool(); const audit = new AuditChain();
        await new TypeBTreasuryStore(p, audit).enterDormancy({ gridName: 'genesis', typeBDid: DID, tick: 9 });
        expect(audit.query({ eventType: 'treasury.dormancy_entered' })).toHaveLength(1);
        expect(audit.query({ eventType: 'bios.death' })).toHaveLength(0);
    });
});

describe('TypeBTreasuryStore.donate', () => {
    it('reviving a dormant treasury above threshold → treasury.revived + status active', async () => {
        const p = pool([{ bios_balance: 0, status: 'dormant', runway_months: 12 }]); const audit = new AuditChain();
        const r = await new TypeBTreasuryStore(p, audit).donate({ gridName: 'genesis', typeBDid: DID, amount: 500, tick: 12 });
        expect(r).toEqual({ balance: 500, revived: true });
        expect(audit.query({ eventType: 'treasury.revived' })).toHaveLength(1);
    });
    it('donating to an active treasury just adds balance (no revival event)', async () => {
        const p = pool([{ bios_balance: 1000, status: 'active', runway_months: 12 }]); const audit = new AuditChain();
        const r = await new TypeBTreasuryStore(p, audit).donate({ gridName: 'genesis', typeBDid: DID, amount: 200, tick: 12 });
        expect(r).toEqual({ balance: 1200, revived: false });
        expect(audit.query({ eventType: 'treasury.revived' })).toHaveLength(0);
    });
    it('returns null when there is no treasury', async () => {
        expect(await new TypeBTreasuryStore(pool([]), new AuditChain()).donate({ gridName: 'genesis', typeBDid: DID, amount: 100, tick: 1 })).toBeNull();
    });
});

describe('TypeBTreasuryStore.payStipend (Plan 2)', () => {
    it('comfortable balance → stays active, only treasury.stipend_paid', async () => {
        const p = pool([{ bios_balance: 1_000_000, status: 'active', runway_months: 12 }]); const audit = new AuditChain();
        const r = await new TypeBTreasuryStore(p, audit).payStipend({ gridName: 'genesis', typeBDid: DID, stipendAmount: 100, tick: 7 });
        expect(r).toEqual({ balance: 999_900, status: 'active' });
        expect(audit.query({ eventType: 'treasury.stipend_paid' })).toHaveLength(1);
        expect(audit.query({ eventType: 'treasury.low_power_entered' })).toHaveLength(0);
    });
    it('runway below threshold → low_power + treasury.low_power_entered (once, on crossing)', async () => {
        // 3 months × 100/day × 30 = 9000 threshold; balance 5000 is under it.
        const p = pool([{ bios_balance: 5000, status: 'active', runway_months: 12 }]); const audit = new AuditChain();
        const r = await new TypeBTreasuryStore(p, audit).payStipend({ gridName: 'genesis', typeBDid: DID, stipendAmount: 100, tick: 7 });
        expect(r?.status).toBe('low_power');
        expect(audit.query({ eventType: 'treasury.low_power_entered' })).toHaveLength(1);
    });
    it('exhaustion → dormancy (treasury.dormancy_entered) and NEVER bios.death', async () => {
        const p = pool([{ bios_balance: 50, status: 'low_power', runway_months: 12 }]); const audit = new AuditChain();
        const r = await new TypeBTreasuryStore(p, audit).payStipend({ gridName: 'genesis', typeBDid: DID, stipendAmount: 100, tick: 7 });
        expect(r).toEqual({ balance: 0, status: 'dormant' });
        expect(audit.query({ eventType: 'treasury.dormancy_entered' })).toHaveLength(1);
        expect(audit.query({ eventType: 'bios.death' })).toHaveLength(0);
    });
});

describe('TypeBTreasuryStore.applyTypeBEarning (Plan 2)', () => {
    it('splits a gross earning 70/30 and credits the Type B share', async () => {
        const r = await new TypeBTreasuryStore(pool([{ bios_balance: 100, status: 'active', runway_months: 12 }]), new AuditChain())
            .applyTypeBEarning({ gridName: 'genesis', typeBDid: DID, gross: 1000, tick: 7 });
        expect(r).toEqual({ typeBShare: 700, irsShare: 300 });
    });
});
