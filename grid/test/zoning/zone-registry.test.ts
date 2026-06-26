/**
 * Phase 57 Grid Zoning (Plan 1) — ZoneRegistry. 6 zones, activity validation, tax modifier, amend.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ZoneRegistry } from '../../src/zoning/zone-registry.js';
import { ZONE_TYPES, CANONICAL_ZONES } from '../../src/zoning/zone-types.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}

describe('the 6-zone invariant (D-V3-32)', () => {
    it('has exactly the 6 canonical zone types', () => {
        expect([...ZONE_TYPES].sort()).toEqual(['business', 'government_quarter', 'infrastructure', 'manufacture', 'residential', 'shopping']);
        expect(CANONICAL_ZONES.infrastructure.for_sale).toBe(false);
        expect(CANONICAL_ZONES.government_quarter.for_sale).toBe(false);
    });
});

describe('ZoneRegistry.validateActivity', () => {
    it('permits marketplace_listing only in business/shopping (criterion 2)', () => {
        const reg = new ZoneRegistry(pool(), new AuditChain());
        expect(reg.validateActivity('business', 'marketplace_listing')).toBe(true);
        expect(reg.validateActivity('shopping', 'marketplace_listing')).toBe(true);
        expect(reg.validateActivity('residential', 'marketplace_listing')).toBe(false);
        expect(reg.validateActivity('government_quarter', 'governance')).toBe(true);
    });
});

describe('ZoneRegistry.taxModifierBps', () => {
    it('falls back to the canonical default when unamended (manufacture = 100bps)', async () => {
        expect(await new ZoneRegistry(pool([]), new AuditChain()).taxModifierBps('genesis', 'manufacture')).toBe(100);
    });
    it('uses the amended override when present', async () => {
        expect(await new ZoneRegistry(pool([{ tax_modifier_bps: 250 }]), new AuditChain()).taxModifierBps('genesis', 'business')).toBe(250);
    });
});

describe('ZoneRegistry.amendZone', () => {
    it('upserts the override + emits zoning.zone_amended (hashed amender)', async () => {
        const p = pool(); const audit = new AuditChain();
        await new ZoneRegistry(p, audit).amendZone({ gridName: 'genesis', zoneId: 'manufacture', taxModifierBps: 150, amendedByDid: 'did:gov:noesis:polis', tick: 7 });
        const ev = audit.query({ eventType: 'zoning.zone_amended' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).zone_id).toBe('manufacture');
        expect((ev[0].payload as Record<string, unknown>).amended_by_did_hash).toMatch(/^[0-9a-f]{64}$/i);
    });
});
