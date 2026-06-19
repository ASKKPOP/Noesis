/**
 * Tests for fetchRegistrations — Portal Manager v1 reviewer-queue client.
 *
 * Mirrors operator.ts error discipline: non-2xx maps to a discriminated-union
 * error exposing only `kind`. Asserts the URL is built from NEXT_PUBLIC_GRID_ORIGIN
 * and the operator headers are sent.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRegistrations } from './portal-manager';

function jsonResp(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const OP = { tier: 5, operatorId: 'op:12345678-1234-4234-8234-1234567890ab' };

const FIXTURE = {
    grid_name: 'genesis',
    applications: [],
    counts: { pending: 1, approved: 2, rejected: 0, total: 3 },
    activity: { registrations_total: 3, civic_dids_issued: 2 },
};

describe('fetchRegistrations', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns ok=true with parsed data on 200', async () => {
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchRegistrations(OP);
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.data.counts.total).toBe(3);
    });

    it('builds the URL from NEXT_PUBLIC_GRID_ORIGIN and sends operator headers', async () => {
        vi.stubEnv('NEXT_PUBLIC_GRID_ORIGIN', 'http://grid.test');
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        await fetchRegistrations(OP);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://grid.test/api/v1/portal-manager/registrations');
        const headers = init.headers as Record<string, string>;
        expect(headers['x-operator-tier']).toBe('5');
        expect(headers['x-operator-id']).toBe(OP.operatorId);
    });

    it('sends credentials: include so the Portal session cookie reaches the Grid cross-origin', async () => {
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        await fetchRegistrations(OP);
        const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(init.credentials).toBe('include');
    });

    it('appends ?status= when a status filter is given', async () => {
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        await fetchRegistrations(OP, 'pending');
        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url).toContain('?status=pending');
    });

    it('maps 401/403/400 to unauthorized', async () => {
        for (const code of [401, 403, 400]) {
            const fetchMock = vi.fn(async () => jsonResp({ error: 'x' }, code));
            vi.stubGlobal('fetch', fetchMock);
            const res = await fetchRegistrations(OP);
            expect(res.ok).toBe(false);
            if (!res.ok) expect(res.error.kind).toBe('unauthorized');
        }
    });

    it('maps 503 { error: db_unavailable } to db_unavailable', async () => {
        const fetchMock = vi.fn(async () => jsonResp({ error: 'db_unavailable' }, 503));
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchRegistrations(OP);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.kind).toBe('db_unavailable');
    });

    it('maps 503 { error: portal_manager_disabled } to console_disabled (distinct from db_unavailable)', async () => {
        const fetchMock = vi.fn(async () => jsonResp({ error: 'portal_manager_disabled' }, 503));
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchRegistrations(OP);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.kind).toBe('console_disabled');
    });

    it('maps a fetch rejection to network and exposes only `kind`', async () => {
        const fetchMock = vi.fn(async () => { throw new Error('boom'); });
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchRegistrations(OP);
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
        await expect(fetchRegistrations(OP)).rejects.toThrow('aborted');
    });
});
