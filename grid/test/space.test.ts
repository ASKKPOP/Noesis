import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialMap } from '../src/space/map.js';
import type { Region, RegionConnection } from '../src/space/types.js';

function makeRegion(id: string, name: string, capacity = 100): Region {
    return { id, name, description: `${name} region`, regionType: 'public', capacity, properties: {} };
}

describe('SpatialMap', () => {
    let map: SpatialMap;
    const agora = makeRegion('agora', 'Agora Central');
    const market = makeRegion('market', 'Market District');
    const library = makeRegion('library', 'Great Library');

    beforeEach(() => {
        map = new SpatialMap();
        map.addRegion(agora);
        map.addRegion(market);
        map.addRegion(library);
    });

    describe('regions', () => {
        it('adds and retrieves regions', () => {
            expect(map.getRegion('agora')).toEqual(agora);
            expect(map.getRegion('unknown')).toBeUndefined();
        });

        it('lists all regions', () => {
            expect(map.allRegions()).toHaveLength(3);
        });
    });

    describe('connections', () => {
        it('adds bidirectional connection', () => {
            const conn: RegionConnection = {
                fromRegion: 'agora', toRegion: 'market',
                travelCost: 2, bidirectional: true,
            };
            map.addConnection(conn);
            expect(map.getConnections('agora')).toHaveLength(1);
            expect(map.getConnections('market')).toHaveLength(1);
        });

        it('one-way connection only found from origin', () => {
            const conn: RegionConnection = {
                fromRegion: 'agora', toRegion: 'library',
                travelCost: 3, bidirectional: false,
            };
            map.addConnection(conn);
            expect(map.getConnections('agora')).toHaveLength(1);
            expect(map.getConnections('library')).toHaveLength(0);
        });

        it('returns travel cost between connected regions', () => {
            map.addConnection({ fromRegion: 'agora', toRegion: 'market', travelCost: 2, bidirectional: true });
            expect(map.getTravelCost('agora', 'market')).toBe(2);
            expect(map.getTravelCost('market', 'agora')).toBe(2);
        });

        it('returns null for unconnected regions', () => {
            expect(map.getTravelCost('agora', 'library')).toBeNull();
        });
    });

    describe('placement and movement', () => {
        beforeEach(() => {
            map.addConnection({ fromRegion: 'agora', toRegion: 'market', travelCost: 2, bidirectional: true });
            map.addConnection({ fromRegion: 'market', toRegion: 'library', travelCost: 3, bidirectional: true });
        });

        it('places a Nous in a region', () => {
            map.placeNous('did:noesis:sophia', 'agora');
            const pos = map.getPosition('did:noesis:sophia');
            expect(pos).toBeDefined();
            expect(pos!.regionId).toBe('agora');
            expect(map.nousCount).toBe(1);
        });

        it('throws when placing in unknown region', () => {
            expect(() => map.placeNous('did:noesis:x', 'nowhere')).toThrow('Region not found');
        });

        it('moves Nous between connected regions', () => {
            map.placeNous('did:noesis:sophia', 'agora');
            const result = map.moveNous('did:noesis:sophia', 'market');
            expect(result.success).toBe(true);
            expect(result.fromRegion).toBe('agora');
            expect(result.toRegion).toBe('market');
            expect(result.travelCost).toBe(2);
            expect(map.getPosition('did:noesis:sophia')!.regionId).toBe('market');
        });

        it('rejects move for unplaced Nous', () => {
            const result = map.moveNous('did:noesis:unknown', 'market');
            expect(result.success).toBe(false);
            expect(result.error).toContain('not placed');
        });

        it('rejects move to unknown region', () => {
            map.placeNous('did:noesis:sophia', 'agora');
            const result = map.moveNous('did:noesis:sophia', 'nowhere');
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('rejects move to same region', () => {
            map.placeNous('did:noesis:sophia', 'agora');
            const result = map.moveNous('did:noesis:sophia', 'agora');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Already');
        });

        it('rejects move to unconnected region', () => {
            map.placeNous('did:noesis:sophia', 'agora');
            const result = map.moveNous('did:noesis:sophia', 'library');
            expect(result.success).toBe(false);
            expect(result.error).toContain('No connection');
        });

        it('rejects move when destination at capacity', () => {
            const tiny = makeRegion('tiny', 'Tiny Room', 1);
            map.addRegion(tiny);
            map.addConnection({ fromRegion: 'agora', toRegion: 'tiny', travelCost: 1, bidirectional: true });
            map.placeNous('did:noesis:hermes', 'tiny');
            map.placeNous('did:noesis:sophia', 'agora');
            const result = map.moveNous('did:noesis:sophia', 'tiny');
            expect(result.success).toBe(false);
            expect(result.error).toContain('capacity');
        });

        it('lists all Nous in a region', () => {
            map.placeNous('did:noesis:sophia', 'agora');
            map.placeNous('did:noesis:hermes', 'agora');
            map.placeNous('did:noesis:atlas', 'market');
            expect(map.getNousInRegion('agora')).toHaveLength(2);
            expect(map.getNousInRegion('market')).toHaveLength(1);
            expect(map.getNousInRegion('library')).toHaveLength(0);
        });
    });

    describe('allConnections (aggregate accessor)', () => {
        it('returns all connections in insertion order', () => {
            const c1: RegionConnection = {
                fromRegion: 'agora', toRegion: 'market', travelCost: 2, bidirectional: true,
            };
            const c2: RegionConnection = {
                fromRegion: 'market', toRegion: 'library', travelCost: 3, bidirectional: false,
            };
            map.addConnection(c1);
            map.addConnection(c2);

            const all = map.allConnections();
            expect(all).toHaveLength(2);
            expect(all[0]).toEqual(c1);
            expect(all[1]).toEqual(c2);
        });

        it('returns a copy — mutating it does not affect internal state', () => {
            map.addConnection({
                fromRegion: 'agora', toRegion: 'market', travelCost: 2, bidirectional: true,
            });
            const first = map.allConnections();
            first.push({
                fromRegion: 'x', toRegion: 'y', travelCost: 0, bidirectional: false,
            });
            expect(map.allConnections()).toHaveLength(1);
        });
    });
});
