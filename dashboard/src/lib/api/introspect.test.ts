/**
 * Tests for fetchNousState — typed REST wrapper around
 * `GET {origin}/api/v1/nous/:did/state`, with a discriminated error union.
 *
 * Contract:
 *   - 200 → `{ ok: true, data: NousStateResponse }` (JSON body passed through)
 *   - 400 → `{ ok: false, error: { kind: 'invalid_did' } }`
 *   - 404 → `{ ok: false, error: { kind: 'unknown_nous' } }`
 *   - 503 → `{ ok: false, error: { kind: 'brain_unavailable' } }`
 *   - other non-2xx or fetch rejection (non-abort) → `{ kind: 'network' }`
 *   - AbortError is RE-THROWN so callers can differentiate via signal.aborted
 *   - URL uses `encodeURIComponent(did)` to tolerate `:` in did:noesis:x
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNousState, type NousStateResponse } from './introspect';

function jsonResp(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const FIXTURE: NousStateResponse = {
    did: 'did:noesis:test',
    name: 'Test',
    archetype: 'curious-scholar',
    location: 'alpha',
    grid_name: 'noesis',
    mood: 'calm',
    emotions: { joy: 0.4 },
    active_goals: [],
    psyche: {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        neuroticism: 0.5,
    },
    thymos: { mood: 'calm', emotions: { joy: 0.4 } },
    telos: { active_goals: [] },
    memory_highlights: [],
};

describe('fetchNousState', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('returns ok=true with the parsed body on HTTP 200', async () => {
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetchNousState('did:noesis:test', 'http://localhost:8080');

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual(FIXTURE);
    });

    it('maps HTTP 400 to { kind: "invalid_did" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'invalid_did' }, 400)));
        const result = await fetchNousState('did:noesis:bad', 'http://localhost:8080');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('invalid_did');
    });

    it('maps HTTP 404 to { kind: "unknown_nous" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'unknown_nous' }, 404)));
        const result = await fetchNousState('did:noesis:ghost', 'http://localhost:8080');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('unknown_nous');
    });

    it('maps HTTP 503 to { kind: "brain_unavailable" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'brain_unavailable' }, 503)));
        const result = await fetchNousState('did:noesis:offline', 'http://localhost:8080');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('brain_unavailable');
    });

    it('maps any other non-2xx status to { kind: "network" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'teapot' }, 418)));
        const result = await fetchNousState('did:noesis:test', 'http://localhost:8080');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('network');
    });

    it('maps fetch rejection (non-AbortError) to { kind: "network" }', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('failed to fetch'); }));
        const result = await fetchNousState('did:noesis:test', 'http://localhost:8080');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe('network');
    });

    it('re-throws AbortError so callers can guard via signal.aborted', async () => {
        const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
        vi.stubGlobal('fetch', vi.fn(async () => { throw abortErr; }));
        await expect(
            fetchNousState('did:noesis:test', 'http://localhost:8080'),
        ).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('uses encodeURIComponent on the did when building the URL', async () => {
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        await fetchNousState('did:noesis:alpha', 'http://localhost:8080');

        const url = fetchMock.mock.calls[0]![0] as string;
        expect(url).toBe('http://localhost:8080/api/v1/nous/did%3Anoesis%3Aalpha/state');
    });

    it('forwards the AbortSignal to fetch init', async () => {
        const fetchMock = vi.fn(async () => jsonResp(FIXTURE, 200));
        vi.stubGlobal('fetch', fetchMock);

        const ac = new AbortController();
        await fetchNousState('did:noesis:test', 'http://localhost:8080', ac.signal);

        const init = fetchMock.mock.calls[0]![1] as RequestInit | undefined;
        expect(init?.signal).toBe(ac.signal);
    });
});
