/**
 * D-V3-40 — zones are free per Grid. The six canonical zones are the TEMPLATE every Grid
 * starts from; the Grid's Polis may add, relabel and remove zones. Removal is blocked
 * while the zone still holds land or residents.
 */
import { describe, it, expect } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { ZoneRegistry, ZoneError } from '../../src/zoning/zone-registry.js';
import { AuditChain } from '../../src/audit/chain.js';

interface ZoneRow { grid_name: string; zone_id: string; label: string; zone_kind: string; tax_modifier_bps: number; allowed_activities: string; active: number; changed_tick: number }

/** A tiny in-memory stand-in for the three tables the registry touches. */
function fakeDb(seed: { parcels?: Record<string, number>; residences?: number } = {}) {
    const zones: ZoneRow[] = [];
    const overrides = new Map<string, number>();
    const retired: string[] = [];   // zones whose unclaimed lots were retired
    const pool = {
        async query(sql: string, params: unknown[] = []) {
            const s = sql.replace(/\s+/g, ' ');
            if (s.includes('FROM grid_zones')) return [zones.filter((z) => z.grid_name === params[0]), {}];
            if (s.includes('INSERT INTO grid_zones')) {
                const [grid_name, zone_id, label, zone_kind, tax_modifier_bps, allowed_activities, active, changed_tick] = params as [string, string, string, string, number, string, number, number];
                const i = zones.findIndex((z) => z.grid_name === grid_name && z.zone_id === zone_id);
                const row = { grid_name, zone_id, label, zone_kind, tax_modifier_bps, allowed_activities, active, changed_tick };
                if (i === -1) zones.push(row); else zones[i] = row;
                return [{}, {}];
            }
            if (s.includes('FROM zone_config') && s.includes('zone_id = ?')) {
                const v = overrides.get(String(params[1]));
                return [v === undefined ? [] : [{ tax_modifier_bps: v }], {}];
            }
            if (s.includes('FROM zone_config')) return [[...overrides].map(([zone_id, tax_modifier_bps]) => ({ zone_id, tax_modifier_bps })), {}];
            if (s.includes('INSERT INTO zone_config')) { overrides.set(String(params[1]), Number(params[2])); return [{}, {}]; }
            if (s.startsWith('DELETE FROM civic_parcels')) { retired.push(String(params[1])); return [{}, {}]; }
            if (s.includes('FROM civic_parcels')) return [[{ n: seed.parcels?.[String(params[1])] ?? 0 }], {}];
            if (s.includes('FROM residence_assignments')) return [[{ n: seed.residences ?? 0 }], {}];
            throw new Error(`unexpected SQL: ${s}`);
        },
    } as unknown as Pool;
    return { pool, zones, retired };
}

const GOV = 'did:gov:noesis:polis';
const ids = async (r: ZoneRegistry, grid = 'Genesis') => (await r.listZones(grid)).map((z) => z.zone_id);

describe('template (D-V3-40)', () => {
    it('a Grid with no zone law starts from the six template zones', async () => {
        const r = new ZoneRegistry(fakeDb().pool, new AuditChain());
        const zones = await r.listZones('Genesis');
        expect(zones.map((z) => z.zone_id)).toEqual(['business', 'manufacture', 'shopping', 'residential', 'infrastructure', 'government_quarter']);
        expect(zones.every((z) => z.template)).toBe(true);
        expect(zones.find((z) => z.zone_id === 'residential')).toMatchObject({ label: 'Residential', kind: 'home', for_sale: true });
        expect(zones.find((z) => z.zone_id === 'government_quarter')).toMatchObject({ kind: 'civic', for_sale: false });
    });
});

describe('ZoneRegistry.addZone', () => {
    it('adds a zone to this Grid only, and records it on the chain', async () => {
        const { pool } = fakeDb(); const audit = new AuditChain();
        const r = new ZoneRegistry(pool, audit);
        await r.addZone({ gridName: 'Genesis', zoneId: 'harbor', label: 'Harbor', kind: 'business', allowedActivities: ['trade'], taxModifierBps: 50, changedByDid: GOV, tick: 9 });
        const z = (await r.listZones('Genesis')).find((x) => x.zone_id === 'harbor');
        expect(z).toMatchObject({ label: 'Harbor', kind: 'business', for_sale: true, template: false, tax_modifier_bps: 50, current_tax_modifier_bps: 50, allowed_activities: ['trade'] });
        expect(await ids(r, 'Moon')).not.toContain('harbor');
        const ev = audit.query({ eventType: 'zoning.zone_set_changed' });
        expect(ev).toHaveLength(1);
        expect(ev[0].payload).toMatchObject({ action: 'added', zone_id: 'harbor', tick: 9 });
        expect((ev[0].payload as Record<string, string>).changed_by_did_hash).toMatch(/^[0-9a-f]{64}$/);
        expect((ev[0].payload as Record<string, string>).label_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(ev[0].payload)).not.toContain('Harbor');   // the label itself never crosses the chain
    });

    it('civic zones are never for sale', async () => {
        const r = new ZoneRegistry(fakeDb().pool, new AuditChain());
        await r.addZone({ gridName: 'Genesis', zoneId: 'archive', label: 'Archive', kind: 'civic', allowedActivities: [], taxModifierBps: 0, changedByDid: GOV, tick: 1 });
        expect((await r.listZones('Genesis')).find((z) => z.zone_id === 'archive')?.for_sale).toBe(false);
    });

    it.each([
        ['zone_exists', { zoneId: 'business' }],
        ['invalid_zone_id', { zoneId: 'Bad Id' }],
        ['invalid_label', { label: '   ' }],
        ['invalid_kind', { kind: 'palace' }],
        ['invalid_activities', { allowedActivities: ['DROP TABLE'] }],
        ['invalid_tax_modifier', { taxModifierBps: 10001 }],
    ])('rejects %s', async (code, over) => {
        const r = new ZoneRegistry(fakeDb().pool, new AuditChain());
        const base = { gridName: 'Genesis', zoneId: 'harbor', label: 'Harbor', kind: 'business', allowedActivities: ['trade'], taxModifierBps: 0, changedByDid: GOV, tick: 1 };
        await expect(r.addZone({ ...base, ...over } as never)).rejects.toMatchObject({ code });
    });
});

describe('ZoneRegistry.relabelZone', () => {
    it('renames a template zone without changing its id or rules', async () => {
        const { pool } = fakeDb(); const audit = new AuditChain();
        const r = new ZoneRegistry(pool, audit);
        await r.relabelZone({ gridName: 'Genesis', zoneId: 'shopping', label: 'Bazaar', changedByDid: GOV, tick: 3 });
        const z = (await r.listZones('Genesis')).find((x) => x.zone_id === 'shopping');
        expect(z).toMatchObject({ label: 'Bazaar', kind: 'business', template: true, allowed_activities: ['marketplace_listing', 'trade', 'service'] });
        expect(await ids(r)).toHaveLength(6);
        expect(audit.query({ eventType: 'zoning.zone_set_changed' })[0].payload).toMatchObject({ action: 'relabeled', zone_id: 'shopping' });
    });
    it('rejects an unknown zone', async () => {
        const r = new ZoneRegistry(fakeDb().pool, new AuditChain());
        await expect(r.relabelZone({ gridName: 'Genesis', zoneId: 'nowhere', label: 'X', changedByDid: GOV, tick: 1 })).rejects.toMatchObject({ code: 'unknown_zone' });
    });
});

describe('ZoneRegistry.removeZone', () => {
    it('removes an empty zone — even a template one', async () => {
        const { pool } = fakeDb(); const audit = new AuditChain();
        const r = new ZoneRegistry(pool, audit);
        await r.removeZone({ gridName: 'Genesis', zoneId: 'manufacture', changedByDid: GOV, tick: 4 });
        expect(await ids(r)).toEqual(['business', 'shopping', 'residential', 'infrastructure', 'government_quarter']);
        expect(await r.hasZone('Genesis', 'manufacture')).toBe(false);
        expect(audit.query({ eventType: 'zoning.zone_set_changed' })[0].payload).toMatchObject({ action: 'removed', zone_id: 'manufacture' });
    });
    it('is blocked while the zone still holds land', async () => {
        const audit = new AuditChain();
        const r = new ZoneRegistry(fakeDb({ parcels: { business: 8 } }).pool, audit);
        await expect(r.removeZone({ gridName: 'Genesis', zoneId: 'business', changedByDid: GOV, tick: 4 })).rejects.toMatchObject({ code: 'zone_occupied' });
        expect(await ids(r)).toContain('business');
        expect(audit.query({ eventType: 'zoning.zone_set_changed' })).toHaveLength(0);
    });
    it('is blocked while residents are assigned to the residential zone', async () => {
        const r = new ZoneRegistry(fakeDb({ residences: 3 }).pool, new AuditChain());
        await expect(r.removeZone({ gridName: 'Genesis', zoneId: 'residential', changedByDid: GOV, tick: 4 })).rejects.toMatchObject({ code: 'zone_occupied' });
    });
    it('never removes the last zone', async () => {
        const r = new ZoneRegistry(fakeDb().pool, new AuditChain());
        for (const z of ['business', 'manufacture', 'shopping', 'residential', 'infrastructure']) {
            await r.removeZone({ gridName: 'Genesis', zoneId: z, changedByDid: GOV, tick: 1 });
        }
        await expect(r.removeZone({ gridName: 'Genesis', zoneId: 'government_quarter', changedByDid: GOV, tick: 1 })).rejects.toMatchObject({ code: 'last_zone' });
    });
    it('a removed zone can be added back', async () => {
        const r = new ZoneRegistry(fakeDb().pool, new AuditChain());
        await r.removeZone({ gridName: 'Genesis', zoneId: 'manufacture', changedByDid: GOV, tick: 1 });
        await r.addZone({ gridName: 'Genesis', zoneId: 'manufacture', label: 'Foundry', kind: 'business', allowedActivities: ['manufacture'], taxModifierBps: 100, changedByDid: GOV, tick: 2 });
        expect((await r.listZones('Genesis')).find((z) => z.zone_id === 'manufacture')).toMatchObject({ label: 'Foundry' });
    });
});

describe('tax modifier on a Grid-defined zone', () => {
    it('amends and reads back a custom zone; rejects a zone the Grid does not have', async () => {
        const { pool } = fakeDb(); const audit = new AuditChain();
        const r = new ZoneRegistry(pool, audit);
        await r.addZone({ gridName: 'Genesis', zoneId: 'harbor', label: 'Harbor', kind: 'business', allowedActivities: ['trade'], taxModifierBps: 50, changedByDid: GOV, tick: 1 });
        expect(await r.taxModifierBps('Genesis', 'harbor')).toBe(50);
        await r.amendZone({ gridName: 'Genesis', zoneId: 'harbor', taxModifierBps: 300, amendedByDid: GOV, tick: 2 });
        expect(await r.taxModifierBps('Genesis', 'harbor')).toBe(300);
        expect(audit.query({ eventType: 'zoning.zone_amended' })[0].payload).toMatchObject({ zone_id: 'harbor', tax_modifier_bps: 300 });
        await expect(r.amendZone({ gridName: 'Genesis', zoneId: 'nowhere', taxModifierBps: 1, amendedByDid: GOV, tick: 2 })).rejects.toMatchObject({ code: 'unknown_zone' });
    });
});

describe('ZoneError', () => {
    it('carries a machine code', () => { expect(new ZoneError('unknown_zone').code).toBe('unknown_zone'); });
});

describe('zone removal and land (D-V3-40 part 2)', () => {
    it('counts only claimed or built land as occupying a zone', async () => {
        let sql = '';
        const { pool } = fakeDb();
        const spy = { query: async (q: string, p: unknown[]) => { if (q.includes('COUNT(*)') && q.includes('civic_parcels')) sql = q; return (pool as unknown as { query: (q: string, p: unknown[]) => Promise<unknown> }).query(q, p); } } as unknown as Pool;
        await new ZoneRegistry(spy, new AuditChain()).removeZone({ gridName: 'Genesis', zoneId: 'shopping', changedByDid: GOV, tick: 4 });
        expect(sql).toMatch(/owner_civic_did IS NOT NULL OR structure_type IS NOT NULL/);
    });

    it('retires the removed zone\'s unclaimed lots with it', async () => {
        const { pool, retired } = fakeDb();
        const r = new ZoneRegistry(pool, new AuditChain());
        await r.removeZone({ gridName: 'Genesis', zoneId: 'shopping', changedByDid: GOV, tick: 4 });
        expect(retired).toEqual(['shopping']);
        expect(await ids(r)).not.toContain('shopping');
    });

    it('lets a home zone go while residents remain, as long as another home zone exists', async () => {
        const { pool } = fakeDb({ residences: 3 });
        const r = new ZoneRegistry(pool, new AuditChain());
        await r.addZone({ gridName: 'Genesis', zoneId: 'terraces', label: 'Terraces', kind: 'home', allowedActivities: ['residence'], taxModifierBps: 0, changedByDid: GOV, tick: 2 });
        await r.removeZone({ gridName: 'Genesis', zoneId: 'residential', changedByDid: GOV, tick: 4 });
        expect(await ids(r)).toContain('terraces');
        await expect(r.removeZone({ gridName: 'Genesis', zoneId: 'terraces', changedByDid: GOV, tick: 5 })).rejects.toMatchObject({ code: 'zone_occupied' });
    });
});
