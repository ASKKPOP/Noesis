import { describe, expect, it } from 'vitest';
import { fitDistance } from '../grid-focus';

describe('fitDistance', () => {
    const half = (fov: number): number => Math.tan((fov * Math.PI) / 360);

    it('on a 4:3 window the Grid spans the width of the view', () => {
        const d = fitDistance(92, 50, 4 / 3);
        // visible half-width at that distance = the radius plus a small margin
        const halfWidth = d * half(50) * (4 / 3);
        expect(halfWidth).toBeGreaterThan(92);
        expect(halfWidth).toBeLessThan(92 * 1.1);
    });

    it('on a narrow window it stands further back so the Grid still fits', () => {
        const wide = fitDistance(92, 50, 4 / 3);
        const narrow = fitDistance(92, 50, 9 / 16);
        expect(narrow).toBeGreaterThan(wide);
        expect(narrow * half(50) * (9 / 16)).toBeGreaterThan(92);
    });

    it('on a very wide window the height of the Grid decides', () => {
        const d = fitDistance(92, 50, 4);
        expect(d * half(50)).toBeGreaterThan(92 * 0.6);
    });

    it('a smaller Grid is approached more closely', () => {
        expect(fitDistance(48, 50, 16 / 9)).toBeLessThan(fitDistance(92, 50, 16 / 9));
    });
});
