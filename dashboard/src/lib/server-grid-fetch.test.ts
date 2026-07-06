/**
 * Unit tests for safeGridFetch — the never-throwing, 3s-timeout SSR fetch helper.
 *
 * Incident (2026-07-06): top-level `await fetch(...)` SSR calls to the Grid had
 * no timeout and no non-2xx / non-JSON handling, so a slow/restarting Grid hung
 * the Node event loop and took down every route. safeGridFetch guarantees:
 *   - a 3s AbortSignal.timeout so no await outlives ~3s
 *   - res.ok guard (non-2xx → null)
 *   - JSON content-type guard (auth-redirect HTML → null, never crashes JSON.parse)
 *   - try/catch (network / timeout / parse → null)
 *   - NEVER throws.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeGridFetch } from './server-grid-fetch';

function jsonResponse(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
        json: async () => body,
    } as unknown as Response;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('safeGridFetch', () => {
    it('(1) 200 + application/json → resolves the parsed body', async () => {
        const body = { listings: [{ id: 'a' }] };
        global.fetch = vi.fn().mockResolvedValue(jsonResponse(body));
        await expect(safeGridFetch<typeof body>('http://grid/x')).resolves.toEqual(body);
    });

    it('(2) 401 with an HTML body → resolves null, does not throw', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            headers: new Headers({ 'content-type': 'text/html' }),
            json: async () => {
                throw new Error('should never be called');
            },
        } as unknown as Response);
        await expect(safeGridFetch('http://grid/x')).resolves.toBeNull();
    });

    it('(3) 500 → resolves null', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({}),
        } as unknown as Response);
        await expect(safeGridFetch('http://grid/x')).resolves.toBeNull();
    });

    it('(4) 200 but content-type text/html → resolves null, json() never invoked', async () => {
        const json = vi.fn(async () => ({ should: 'not parse' }));
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
            json,
        } as unknown as Response);
        await expect(safeGridFetch('http://grid/x')).resolves.toBeNull();
        expect(json).not.toHaveBeenCalled();
    });

    it('(5) fetch rejects (network error) → resolves null', async () => {
        global.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
        await expect(safeGridFetch('http://grid/x')).resolves.toBeNull();
    });

    it('(6) timeout (fetch rejects with TimeoutError) → resolves null; a signal is passed', async () => {
        const fetchMock = vi.fn().mockRejectedValue(
            new DOMException('The operation timed out.', 'TimeoutError'),
        );
        global.fetch = fetchMock;
        await expect(safeGridFetch('http://grid/x')).resolves.toBeNull();
        const init = fetchMock.mock.calls[0][1];
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('(7) caller init (cache + headers) is merged and preserved, signal added', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }));
        global.fetch = fetchMock;
        await safeGridFetch('http://grid/x', {
            cache: 'no-store',
            headers: { Cookie: 'noesis_portal_token=abc' },
        });
        const init = fetchMock.mock.calls[0][1];
        expect(init.cache).toBe('no-store');
        expect(init.headers).toEqual({ Cookie: 'noesis_portal_token=abc' });
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('malformed JSON (json() throws) → resolves null, does not throw', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => {
                throw new SyntaxError('Unexpected token < in JSON');
            },
        } as unknown as Response);
        await expect(safeGridFetch('http://grid/x')).resolves.toBeNull();
    });

    it('missing content-type header → resolves null', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({}),
            json: async () => ({ x: 1 }),
        } as unknown as Response);
        await expect(safeGridFetch('http://grid/x')).resolves.toBeNull();
    });
});
