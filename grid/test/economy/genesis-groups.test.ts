/**
 * Groups & Holdings · Phase 1 — Genesis founding Businesses seed plan.
 *
 * Locks the D-GROUP-04 contract: exactly five for-profit Businesses
 * (Aegis/Helix/Dynamo/Soma/Qubit) seeded as orbital anchor structures in the
 * business sector (ring 2). Pure data — no DB. See
 * docs/plans/2026-06-15-groups-and-holdings-design.md.
 */
import { describe, it, expect, beforeAll } from 'vitest';

type GenesisGroups = typeof import('../../src/economy/genesis-groups.js');

describe('genesis-groups — founding seed (D-GROUP-04)', () => {
    let mod: GenesisGroups;
    beforeAll(async () => {
        mod = await import('../../src/economy/genesis-groups.js');
    });

    it('seeds exactly 5 founding Groups', () => {
        expect(mod.GENESIS_GROUPS).toHaveLength(5);
    });

    it('covers the five deep-tech domains', () => {
        const domains = mod.GENESIS_GROUPS.map((g) => g.domain).sort();
        expect(domains).toEqual(['biotech', 'defense', 'energy', 'physical_ai', 'quantum']);
    });

    it('all five founders are for-profit Businesses (D-GROUP-04)', () => {
        for (const g of mod.GENESIS_GROUPS) expect(g.kind).toBe('business');
    });

    it('names each domain to its crest art', () => {
        const byDomain = Object.fromEntries(mod.GENESIS_GROUPS.map((g) => [g.domain, g]));
        expect(byDomain.defense.crestPath).toBe('/orgs/defense.jpg');
        expect(byDomain.biotech.crestPath).toBe('/orgs/biotech.jpg');
        expect(byDomain.energy.crestPath).toBe('/orgs/energy.jpg');
        expect(byDomain.physical_ai.crestPath).toBe('/orgs/ai.jpg');
        expect(byDomain.quantum.crestPath).toBe('/orgs/quantum.jpg');
    });

    it('buildGenesisGroups stamps grid-scoped ids and the business ring (D-GROUP-03)', () => {
        const groups = mod.buildGenesisGroups('genesis');
        expect(groups).toHaveLength(5);
        for (const g of groups) {
            expect(g.groupId).toMatch(/^genesis:group:[a-z]+$/);
            expect(g.ring).toBe(2);          // business sector
            expect(g.zoneId).toBe('business');
        }
        // anchors are spread around the ring (distinct sectors)
        const sectors = new Set(groups.map((g) => g.sectorDeg));
        expect(sectors.size).toBe(5);
    });

    it('ids are the lowercased display names', () => {
        const aegis = mod.buildGenesisGroups('genesis').find((g) => g.domain === 'defense');
        expect(aegis?.groupId).toBe('genesis:group:aegis');
        expect(aegis?.displayName).toBe('Aegis');
    });
});
