import { describe, it, expect } from 'vitest';
import { parseGridProfile, driftLine, percent } from './grid-profile';

const live = {
    grid: 'Genesis', window_size: 2000, actions: 10,
    activities: [{ activity: 'trade', count: 4, share: 0.4 }, { activity: 'knowledge', count: 6, share: 0.6 }],
    previous: [{ activity: 'knowledge', count: 82, share: 0.41 }, { activity: 'trade', count: 38, share: 0.19 }, { activity: 'civic', count: 80, share: 0.4 }],
};

describe('grid-profile', () => {
    it('narrows the route payload', () => {
        expect(parseGridProfile(live)).toMatchObject({ actions: 10, window_size: 2000 });
        expect(parseGridProfile({ ...live, previous: null })?.previous).toBeNull();
        expect(parseGridProfile({ error: 'profile_unavailable' })).toBeNull();
        expect(parseGridProfile({ ...live, activities: [{ activity: 'trade' }] })).toBeNull();
    });

    it('words the drift from the previous window', () => {
        expect(driftLine(parseGridProfile(live)!)).toBe('Before: knowledge 41% · trade 19%');
        expect(driftLine(parseGridProfile({ ...live, previous: null })!)).toBeNull();
        expect(percent(0.375)).toBe('38%');
    });
});
