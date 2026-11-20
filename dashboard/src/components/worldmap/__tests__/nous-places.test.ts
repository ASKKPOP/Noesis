import { describe, expect, it } from 'vitest';
import { applySceneEvents, nousColor, parseRoster, placeOf, type NousView } from '../nous-places';
import { TEMPLATE_ZONES, type GridZoneView } from '../zone-view';
import type { SceneEvent } from '../scene-events';

const at = (region: string, did = 'did:noesis:sophia'): Pick<NousView, 'did' | 'region'> => ({ did, region });
const ev = (over: Partial<SceneEvent>): SceneEvent => ({ id: 1, at: 0, kind: 'spoke', ...over });

describe('where a Nous stands on the station', () => {
    it('follows the placing the operator approved', () => {
        expect(placeOf(at('council'), TEMPLATE_ZONES)).toBe('government_quarter');
        expect(placeOf(at('agora'), TEMPLATE_ZONES)).toBe('infrastructure');
        expect(placeOf(at('library'), TEMPLATE_ZONES)).toBe('infrastructure');
        expect(placeOf(at('workshop'), TEMPLATE_ZONES)).toBe('manufacture');
        expect(['business', 'shopping']).toContain(placeOf(at('market'), TEMPLATE_ZONES));
    });

    it('a Nous in the market always stands in the same one of its two districts', () => {
        const first = placeOf(at('market', 'did:noesis:hermes'), TEMPLATE_ZONES);
        expect(placeOf(at('market', 'did:noesis:hermes'), TEMPLATE_ZONES)).toBe(first);
    });

    it('falls back to a zone of the same kind when the Polis removed the preferred one', () => {
        const zones: GridZoneView[] = [
            { zone_id: 'government_quarter', label: 'Government Quarter', kind: 'civic' },
            { zone_id: 'harbour', label: 'Harbour', kind: 'business' },
            { zone_id: 'residential', label: 'Residential', kind: 'home' },
        ];
        expect(placeOf(at('workshop'), zones)).toBe('harbour');
        expect(placeOf(at('market'), zones)).toBe('harbour');
        expect(placeOf(at('agora'), zones)).toBe('government_quarter');
    });

    it('a region with no place on the station is placed nowhere', () => {
        expect(placeOf(at('alpha'), TEMPLATE_ZONES)).toBeNull();
        expect(placeOf(at('market'), [{ zone_id: 'residential', label: 'Residential', kind: 'home' }])).toBeNull();
    });

    it('reads the public list and looks for no balance', () => {
        const list = parseRoster({ nous: [{ did: 'did:noesis:sophia', name: 'Sophia', region: 'agora', balance_wei: 500 }, { did: 5 }] });
        expect(list).toEqual([{ did: 'did:noesis:sophia', name: 'Sophia', region: 'agora', asleep: false }]);
        expect(parseRoster({})).toBeNull();
    });

    it('follows moves and sleep from the scene feed, and flags a newcomer', () => {
        const sophia = { did: 'did:noesis:sophia', name: 'Sophia' };
        const start: NousView[] = [{ ...sophia, region: 'agora', asleep: false }];
        const moved = applySceneEvents(start, [ev({ kind: 'moved', actor: sophia, region: 'market', from_region: 'agora' }), ev({ kind: 'slept', actor: sophia })]);
        expect(moved.nous).toEqual([{ ...sophia, region: 'market', asleep: true }]);
        expect(moved.unknown).toBe(false);
        expect(start[0].region).toBe('agora'); // the earlier list is not changed in place
        expect(applySceneEvents(moved.nous, [ev({ kind: 'woke', actor: sophia })]).nous[0].asleep).toBe(false);
        expect(applySceneEvents(start, [ev({ kind: 'arrived', actor: { did: 'did:noesis:new', name: 'New' } })]).unknown).toBe(true);
    });

    it('gives each Nous its own steady colour', () => {
        expect(nousColor('did:noesis:sophia')).toBe(nousColor('did:noesis:sophia'));
        expect(nousColor('did:noesis:sophia')).not.toBe(nousColor('did:noesis:hermes'));
    });
});
