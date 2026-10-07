import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPortalOverview, formatWei } from './portal-overview';

afterEach(() => { vi.unstubAllGlobals(); });

describe('portal overview client (Phase 56)', () => {
    it('formatWei is exact for values beyond Number precision', () => {
        expect(formatWei('0')).toBe('0');
        expect(formatWei('1000000000000000000')).toBe('1');
        expect(formatWei('1500000000000000000')).toBe('1.5');
        expect(formatWei('123456789012345678901234567')).toBe('123456789.012345');
        expect(formatWei('2500')).toBe('0'); // below 1e-6 ETH
    });

    it('sends the session cookie and maps 401 to unauthenticated', async () => {
        const f = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
        vi.stubGlobal('fetch', f);
        expect(await fetchPortalOverview()).toEqual({ ok: false, error: { kind: 'unauthenticated' } });
        expect(f.mock.calls[0]![1]).toMatchObject({ credentials: 'include' });
    });

    it('returns the overview body on 200', async () => {
        const body = { human_did: 'did:noesis:human:x', nous: [], grids: [], wallet: { total_wei: '0', by_grid: [] }, registrations: [] };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
        expect(await fetchPortalOverview()).toEqual({ ok: true, data: body });
    });
});
