import { describe, expect, it } from 'vitest';
import { parseSceneEvents, refreshNeeded, sceneLine, type SceneEvent } from '../scene-events';
import { translator } from '../map-i18n';

const ev = (over: Partial<SceneEvent>): SceneEvent => ({ id: 1, at: 0, kind: 'spoke', ...over });
const en = translator('en');
const noZone = (): undefined => undefined;

describe('scene events', () => {
    it('reads the feed and drops anything malformed', () => {
        const page = parseSceneEvents({
            cursor: 9,
            events: [
                { id: 7, at: 100, kind: 'moved', actor: { did: 'did:noesis:sophia', name: 'Sophia' }, region: 'market', from_region: 'agora' },
                { id: 8, at: 101, kind: 'not_a_kind' },
                { id: 'x', at: 102, kind: 'spoke' },
                { id: 9, at: 103, kind: 'bought_land', parcel_id: 'genesis:business:0003', zone_id: 'business', actor: { name: 'no did' } },
            ],
        });
        expect(page?.cursor).toBe(9);
        expect(page?.events.map((e) => e.id)).toEqual([7, 9]);
        expect(page?.events[1].actor).toBeUndefined();
        expect(parseSceneEvents({ events: [] })).toBeNull();
        expect(parseSceneEvents(null)).toBeNull();
    });

    it('words each event as one plain line', () => {
        const sophia = { did: 'did:noesis:sophia', name: 'Sophia' };
        expect(sceneLine(ev({ kind: 'moved', actor: sophia, region: 'market', from_region: 'agora' }), en, noZone)).toBe('Sophia moved from agora to market');
        expect(sceneLine(ev({ kind: 'moved', actor: sophia, region: 'market' }), en, noZone)).toBe('Sophia moved to market');
        expect(sceneLine(ev({ kind: 'spoke', actor: sophia }), en, noZone)).toBe('Sophia spoke');
        expect(sceneLine(ev({ kind: 'bought_land', zone_id: 'business' }), en, () => 'Business')).toBe('A lot was bought in Business');
        expect(sceneLine(ev({ kind: 'built', detail: 'shop' }), en, () => 'Shopping')).toBe('New building in Shopping: shop');
        expect(sceneLine(ev({ kind: 'built' }), en, noZone)).toBe('A new building went up in the Grid');
        expect(sceneLine(ev({ kind: 'moved', actor: sophia, region: 'market' }), translator('ko'), noZone)).toBe('Sophia이(가) market(으)로 이동했습니다');
    });

    it('re-reads only what an event changed', () => {
        expect([...refreshNeeded([ev({ kind: 'spoke' }), ev({ kind: 'moved' })])]).toEqual([]);
        expect([...refreshNeeded([ev({ kind: 'built' })])]).toEqual(['parcels']);
        expect([...refreshNeeded([ev({ kind: 'orbital_built' })])]).toEqual(['objects']);
        expect([...refreshNeeded([ev({ kind: 'zones_changed' })])].sort()).toEqual(['parcels', 'zones']);
    });
});
