/**
 * Tests for fetchSystemMap — System Map live aggregate client.
 *
 * Mirrors portal-manager.ts error discipline: non-2xx maps to a discriminated-union
 * error exposing only `kind`. Asserts the URL is built from NEXT_PUBLIC_GRID_ORIGIN
 * and that it is a public read (no auth headers, no credentials).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSystemMap } from './system-map';

function jsonResp(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const FIXTURE = {
    grid_name: 'genesis',
    tick: 65,
    generated_at_tick: 65,
    surfaces: {
        grid: { status: 'up', metric: 2, headline: 'world running', tick: 65, client_count: 2, chain_valid: true },
        portal: { status: 'up', metric: 1, headline: '1 awaiting review', pending: 1, approved: 2, rejected: 0, total: 3 },
        steward: { status: 'up', metric: 'operator console', headline: 'reads the Grid' },
        brain: { status: 'up', metric: 3, headline: '3 active', total: 4, unowned: 1, active: 3 },
    },
    institutions: {
        registry: { status: 'active', metric: 5, headline: '', civic_active: 5, nous_active: 1 },
        polis: { status: 'active', metric: 2, headline: '', bills_active: 2, bills_enacted: 1 },
        police: { status: 'empty', metric: 0, headline: '', complaints: 0, sanctions_active: 0 },
        irs: { status: 'active', metric: '123', headline: '', balance_wei: '123', fee_rate_percent: 2 },
        marketplace: { status: 'active', metric: 4, headline: '', listings_active: 4, escrow_settled: 1 },
        library: { status: 'active', metric: 42, headline: '', entries_published: 42, citations_total: 9 },
        communities: { status: 'active', metric: 3, headline: '', communities_active: 3, members_active: 7 },
        p2p: { status: 'active', metric: 1, headline: '', peers_online: 1 },
    },
};

describe('fetchSystemMap', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns ok=true with parsed data on 200', async () => {
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchSystemMap();
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.data.institutions.library.entries_published).toBe(42);
    });

    it('builds the URL from NEXT_PUBLIC_GRID_ORIGIN', async () => {
        vi.stubEnv('NEXT_PUBLIC_GRID_ORIGIN', 'http://grid.test');
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        await fetchSystemMap();
        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url).toBe('http://grid.test/api/v1/system/map');
    });

    it('is a public read — sends no auth headers and no credentials', async () => {
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        await fetchSystemMap();
        const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        const headers = (init.headers ?? {}) as Record<string, string>;
        expect(headers['x-operator-tier']).toBeUndefined();
        expect(headers['x-operator-id']).toBeUndefined();
        expect(init.credentials).toBeUndefined();
    });

    it('maps a non-2xx (503) to db_unavailable', async () => {
        const fetchMock = vi.fn(async () => jsonResp({ error: 'x' }, 503));
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchSystemMap();
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.kind).toBe('db_unavailable');
    });

    it('maps a fetch rejection to network and exposes only `kind`', async () => {
        const fetchMock = vi.fn(async () => { throw new Error('boom'); });
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchSystemMap();
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.error.kind).toBe('network');
            expect(Object.keys(res.error)).toEqual(['kind']);
        }
    });

    it('re-throws AbortError', async () => {
        const fetchMock = vi.fn(async () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            throw e;
        });
        vi.stubGlobal('fetch', fetchMock);
        await expect(fetchSystemMap()).rejects.toThrow('aborted');
    });
});
