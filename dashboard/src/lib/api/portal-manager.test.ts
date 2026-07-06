/**
 * Tests for fetchRegistrations — Portal Manager v1 reviewer-queue client.
 *
 * Mirrors operator.ts error discipline: non-2xx maps to a discriminated-union
 * error exposing only `kind`. Asserts the URL is built from NEXT_PUBLIC_GRID_ORIGIN
 * and the operator headers are sent.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRegistrations, fetchDidIssuance, fetchAuditChain } from './portal-manager';

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

const DID_FIXTURE = {
    grid_name: 'genesis',
    issued: [{ civic_did: 'did:civic:noesis:human:c1', status: 'active', issued_at_tick: 10, kind: 'civic' }],
    counts: { active: 2, revoked: 1, total: 3, nous_active: 7 },
};

const AUDIT_FIXTURE = {
    integrity: { in_memory_length: 4, persisted_max_id: 4, divergence: 0, divergence_threshold: 10, healthy: true },
    recent: [{ event_type: 'portal.registration_submitted', tick: 1 }],
};

describe('fetchDidIssuance', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('returns ok=true and maps body→data on 200', async () => {
        const fetchMock = vi.fn(async () => jsonResp(DID_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchDidIssuance(OP);
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.data.counts.nous_active).toBe(7);
    });

    it('hits /did-issuance with credentials:include + operator headers', async () => {
        vi.stubEnv('NEXT_PUBLIC_GRID_ORIGIN', 'http://grid.test');
        const fetchMock = vi.fn(async () => jsonResp(DID_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        await fetchDidIssuance(OP);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://grid.test/api/v1/portal-manager/did-issuance');
        expect(init.credentials).toBe('include');
        const headers = init.headers as Record<string, string>;
        expect(headers['x-operator-tier']).toBe('5');
        expect(headers['x-operator-id']).toBe(OP.operatorId);
    });

    it('maps 401/403/400 to unauthorized', async () => {
        for (const code of [401, 403, 400]) {
            const fetchMock = vi.fn(async () => jsonResp({ error: 'x' }, code));
            vi.stubGlobal('fetch', fetchMock);
            const res = await fetchDidIssuance(OP);
            expect(res.ok).toBe(false);
            if (!res.ok) expect(res.error.kind).toBe('unauthorized');
        }
    });

    it('maps 503 portal_manager_disabled→console_disabled, else db_unavailable', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'portal_manager_disabled' }, 503)));
        let res = await fetchDidIssuance(OP);
        if (!res.ok) expect(res.error.kind).toBe('console_disabled');
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'db_unavailable' }, 503)));
        res = await fetchDidIssuance(OP);
        if (!res.ok) expect(res.error.kind).toBe('db_unavailable');
    });

    it('maps a fetch rejection to network', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
        const res = await fetchDidIssuance(OP);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.kind).toBe('network');
    });
});

describe('fetchAuditChain', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('returns ok=true and maps body→data on 200', async () => {
        const fetchMock = vi.fn(async () => jsonResp(AUDIT_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchAuditChain(OP);
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.data.integrity.healthy).toBe(true);
            expect(res.data.recent[0].event_type).toBe('portal.registration_submitted');
        }
    });

    it('hits /audit-chain with credentials:include + operator headers', async () => {
        vi.stubEnv('NEXT_PUBLIC_GRID_ORIGIN', 'http://grid.test');
        const fetchMock = vi.fn(async () => jsonResp(AUDIT_FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);
        await fetchAuditChain(OP);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://grid.test/api/v1/portal-manager/audit-chain');
        expect(init.credentials).toBe('include');
        const headers = init.headers as Record<string, string>;
        expect(headers['x-operator-tier']).toBe('5');
        expect(headers['x-operator-id']).toBe(OP.operatorId);
    });

    it('maps 401/403 to unauthorized and 503 disabled→console_disabled', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'x' }, 403)));
        let res = await fetchAuditChain(OP);
        if (!res.ok) expect(res.error.kind).toBe('unauthorized');
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'portal_manager_disabled' }, 503)));
        res = await fetchAuditChain(OP);
        if (!res.ok) expect(res.error.kind).toBe('console_disabled');
    });

    it('maps a fetch rejection to network', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
        const res = await fetchAuditChain(OP);
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.kind).toBe('network');
    });
});
