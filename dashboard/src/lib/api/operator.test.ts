/**
 * Tests for postOperatorAction — typed POST wrapper for
 * `POST {origin}/api/v1/operator/*` endpoints (H2/H3/H4 actions).
 *
 * Contract mirrors the Fastify 400→404→503 error ladder from Plans 04/05
 * (see PATTERNS.md Pattern S-2). Operator has its own error kinds:
 *   - 400 → invalid_tier (body validation / malformed tier field)
 *   - 404 → unknown_nous (target_did not in roster)
 *   - 503 → brain_unavailable (brain container offline)
 *   - other non-2xx or fetch rejection (non-abort) → network
 *   - AbortError is RE-THROWN so callers can differentiate abort from failure
 *
 * Error bodies NEVER leak err.message into OperatorFetchError — the discriminated
 * union exposes only the `kind`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteNous, postOperatorAction } from './operator';

function jsonResp(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

describe('postOperatorAction', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns ok=true with the parsed body on HTTP 200', async () => {
        const fetchMock = vi.fn(async () => jsonResp({ ok: true, tier_echo: 'H3' }, 200));
        vi.stubGlobal('fetch', fetchMock);

        const result = await postOperatorAction<{ ok: true; tier_echo: string }>(
            '/api/v1/operator/clock/pause',
            'http://localhost:8080',
            { tier: 'H3', operator_id: 'op:abc' },
        );

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual({ ok: true, tier_echo: 'H3' });
    });

    it('sends method=POST with content-type and accept=application/json and JSON-stringified body', async () => {
        const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
            Promise.resolve(jsonResp({ ok: true }, 200)),
        );
        vi.stubGlobal('fetch', fetchMock);

        const body = { tier: 'H3', operator_id: 'op:xyz', foo: 'bar' };
        await postOperatorAction('/api/v1/operator/clock/pause', 'http://localhost:8080', body);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, init] = fetchMock.mock.calls[0]!;
        expect(init?.method).toBe('POST');
        const headers = init?.headers as Record<string, string>;
        expect(headers['content-type']).toBe('application/json');
        expect(headers.accept).toBe('application/json');
        expect(init?.body).toBe(JSON.stringify(body));
    });

    it('maps HTTP 400 to { kind: "invalid_tier" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'invalid_tier' }, 400)));
        const result = await postOperatorAction(
            '/api/v1/operator/clock/pause',
            'http://localhost:8080',
            {},
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('invalid_tier');
    });

    it('maps HTTP 404 to { kind: "unknown_nous" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'unknown_nous' }, 404)));
        const result = await postOperatorAction(
            '/api/v1/operator/nous/did:noesis:ghost/telos',
            'http://localhost:8080',
            {},
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('unknown_nous');
    });

    it('maps HTTP 503 to { kind: "brain_unavailable" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'brain_unavailable' }, 503)));
        const result = await postOperatorAction(
            '/api/v1/operator/memory/query',
            'http://localhost:8080',
            {},
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('brain_unavailable');
    });

    it('maps any other non-2xx status (500, 418) to { kind: "network" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'teapot' }, 418)));
        const result = await postOperatorAction(
            '/api/v1/operator/clock/pause',
            'http://localhost:8080',
            {},
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('network');

        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'oops' }, 500)));
        const result2 = await postOperatorAction(
            '/api/v1/operator/clock/pause',
            'http://localhost:8080',
            {},
        );
        expect(result2.ok).toBe(false);
        if (!result2.ok) expect(result2.error.kind).toBe('network');
    });

    it('maps fetch rejection (non-AbortError) to { kind: "network" } without leaking err.message', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new TypeError('Failed to fetch');
            }),
        );
        const result = await postOperatorAction(
            '/api/v1/operator/clock/pause',
            'http://localhost:8080',
            {},
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.kind).toBe('network');
            // Only the kind field is exposed — no raw error details.
            expect(Object.keys(result.error)).toEqual(['kind']);
        }
    });

    it('re-throws AbortError so callers can distinguish abort from network failure', async () => {
        const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw abortErr;
            }),
        );
        await expect(
            postOperatorAction('/api/v1/operator/clock/pause', 'http://localhost:8080', {}),
        ).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('composes origin + endpoint into the fetched URL without slash drift', async () => {
        const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
            Promise.resolve(jsonResp({ ok: true }, 200)),
        );
        vi.stubGlobal('fetch', fetchMock);

        await postOperatorAction(
            '/api/v1/operator/clock/pause',
            'http://localhost:8080',
            { tier: 'H3' },
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url] = fetchMock.mock.calls[0]!;
        expect(url).toBe('http://localhost:8080/api/v1/operator/clock/pause');
    });
});

describe('deleteNous', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    const HASH = 'a'.repeat(64);
    const DID = 'did:noesis:alpha';
    const BASE = 'http://localhost:8080';

    it('returns ok=true with tombstoned_at_tick and pre_deletion_state_hash on 200', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                jsonResp({ tombstoned_at_tick: 40, pre_deletion_state_hash: HASH }, 200),
            ),
        );
        const result = await deleteNous(DID, BASE);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.tombstoned_at_tick).toBe(40);
            expect(result.data.pre_deletion_state_hash).toBe(HASH);
        }
    });

    it('sends POST to /api/operator/nous/:did/delete', async () => {
        const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
            Promise.resolve(jsonResp({ tombstoned_at_tick: 1, pre_deletion_state_hash: HASH }, 200)),
        );
        vi.stubGlobal('fetch', fetchMock);
        await deleteNous(DID, BASE);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0]!;
        expect(url).toBe(`${BASE}/api/operator/nous/${DID}/delete`);
        expect(init?.method).toBe('POST');
    });

    it('forwards AbortSignal to fetch options', async () => {
        const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
            Promise.resolve(jsonResp({ tombstoned_at_tick: 1, pre_deletion_state_hash: HASH }, 200)),
        );
        vi.stubGlobal('fetch', fetchMock);
        const ac = new AbortController();
        await deleteNous(DID, BASE, ac.signal);
        const [, init] = fetchMock.mock.calls[0]!;
        expect(init?.signal).toBe(ac.signal);
    });

    it('maps HTTP 400 to { kind: "invalid_did" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'invalid_did' }, 400)));
        const result = await deleteNous(DID, BASE);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('invalid_did');
    });

    it('maps HTTP 404 to { kind: "unknown_nous" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'unknown_nous' }, 404)));
        const result = await deleteNous(DID, BASE);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('unknown_nous');
    });

    it('maps HTTP 410 to { kind: "nous_deleted" }', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => jsonResp({ error: 'nous_deleted', deleted_at_tick: 40 }, 410)),
        );
        const result = await deleteNous(DID, BASE);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('nous_deleted');
    });

    it('maps HTTP 503 to { kind: "brain_unavailable" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'brain_unavailable' }, 503)));
        const result = await deleteNous(DID, BASE);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('brain_unavailable');
    });

    it('maps HTTP 500 to { kind: "network" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'server_error' }, 500)));
        const result = await deleteNous(DID, BASE);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('network');
    });

    it('maps fetch rejection (non-abort) to { kind: "network" }', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new TypeError('failed to fetch');
            }),
        );
        const result = await deleteNous(DID, BASE);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.kind).toBe('network');
            expect(Object.keys(result.error)).toEqual(['kind']);
        }
    });

    it('re-throws AbortError (does NOT map to network)', async () => {
        const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
        vi.stubGlobal('fetch', vi.fn(async () => { throw abortErr; }));
        await expect(deleteNous(DID, BASE)).rejects.toMatchObject({ name: 'AbortError' });
    });
});
