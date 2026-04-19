/**
 * Tests for fetchRoster / fetchTrades / fetchShops — typed REST wrappers for
 * the three Economy/Roster endpoints locked by Plan 04-03.
 *
 * W2 cross-plan contract (Plan 04-03 owns, Plans 04-05 + 04-06 consume):
 *   - `TradeRecord.timestamp` is Unix SECONDS (integer). Enforced at the
 *     consumer (TradesTable test) and documented on the type in economy.ts.
 *
 * Shape discriminant: `{ ok: true; data: T } | { ok: false; error: { kind: 'network' } }`.
 * No per-status kinds here — callers of Economy endpoints don't distinguish
 * 404-vs-500; any non-2xx collapses to 'network'. AbortError is re-thrown.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    fetchRoster,
    fetchTrades,
    fetchShops,
    type RosterResponse,
    type TradesResponse,
    type ShopsResponse,
} from './economy';

function jsonResp(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const ROSTER_FIXTURE: RosterResponse = {
    nous: [
        {
            did: 'did:noesis:alpha',
            name: 'Alpha',
            region: 'alpha',
            ousia: 100,
            lifecyclePhase: 'adult',
            reputation: 0.5,
            status: 'active',
        },
    ],
};

const TRADES_FIXTURE: TradesResponse = {
    trades: [
        {
            actorDid: 'did:noesis:alpha',
            counterparty: 'did:noesis:beta',
            amount: 5,
            nonce: 'nonce-1',
            timestamp: 1700000000, // W2: Unix SECONDS
        },
    ],
    total: 1,
};

const SHOPS_FIXTURE: ShopsResponse = {
    shops: [
        {
            ownerDid: 'did:noesis:alpha',
            name: 'Alpha Emporium',
            listings: [{ sku: 'sku-1', label: 'Dialectic', priceOusia: 5 }],
        },
    ],
};

describe('fetchRoster', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns ok=true with the parsed body on HTTP 200', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResp(ROSTER_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetchRoster('http://localhost:8080');

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual(ROSTER_FIXTURE);
    });

    it('calls GET /api/v1/grid/nous on the given origin', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResp(ROSTER_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        await fetchRoster('http://localhost:8080');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url] = fetchMock.mock.calls[0]!;
        expect(url).toBe('http://localhost:8080/api/v1/grid/nous');
    });

    it('maps HTTP 500 to { ok: false, error: { kind: "network" } }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'boom' }, 500)));
        const result = await fetchRoster('http://localhost:8080');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('network');
    });

    it('re-throws AbortError so callers can guard via signal.aborted', async () => {
        const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
        vi.stubGlobal('fetch', vi.fn(async () => { throw abortErr; }));
        await expect(fetchRoster('http://localhost:8080')).rejects.toMatchObject({
            name: 'AbortError',
        });
    });
});

describe('fetchTrades', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns ok=true with the parsed body on HTTP 200', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp(TRADES_FIXTURE, 200)));
        const result = await fetchTrades('http://localhost:8080');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual(TRADES_FIXTURE);
    });

    it('defaults to limit=20 when no limit passed', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResp(TRADES_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        await fetchTrades('http://localhost:8080');

        const [url] = fetchMock.mock.calls[0]!;
        expect(url).toBe('http://localhost:8080/api/v1/economy/trades?limit=20');
    });

    it('clamps limit=999 to limit=100 (server-side max)', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResp(TRADES_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        await fetchTrades('http://localhost:8080', undefined, 999);

        const [url] = fetchMock.mock.calls[0]!;
        expect(url).toBe('http://localhost:8080/api/v1/economy/trades?limit=100');
    });

    it('clamps limit=0 / negative / NaN to fallback limit=20', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResp(TRADES_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        await fetchTrades('http://localhost:8080', undefined, 0);
        await fetchTrades('http://localhost:8080', undefined, -5);
        await fetchTrades('http://localhost:8080', undefined, Number.NaN);

        for (const call of fetchMock.mock.calls) {
            expect(call[0]).toBe('http://localhost:8080/api/v1/economy/trades?limit=20');
        }
    });

    it('maps HTTP 500 to { ok: false, error: { kind: "network" } }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'boom' }, 500)));
        const result = await fetchTrades('http://localhost:8080');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('network');
    });

    it('re-throws AbortError', async () => {
        const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
        vi.stubGlobal('fetch', vi.fn(async () => { throw abortErr; }));
        await expect(fetchTrades('http://localhost:8080')).rejects.toMatchObject({
            name: 'AbortError',
        });
    });
});

describe('fetchShops', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns ok=true with the parsed body on HTTP 200', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp(SHOPS_FIXTURE, 200)));
        const result = await fetchShops('http://localhost:8080');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual(SHOPS_FIXTURE);
    });

    it('calls GET /api/v1/economy/shops on the given origin', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResp(SHOPS_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        await fetchShops('http://localhost:8080');

        const [url] = fetchMock.mock.calls[0]!;
        expect(url).toBe('http://localhost:8080/api/v1/economy/shops');
    });

    it('maps fetch rejection (non-AbortError) to { kind: "network" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('net down'); }));
        const result = await fetchShops('http://localhost:8080');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('network');
    });
});
