/**
 * Tests for fetchGridHealth / fetchGridStatus / countByLifecyclePhase — the
 * live reads behind /portal/status.
 *
 * Mirrors system-map.test.ts: asserts the URL is built from
 * NEXT_PUBLIC_GRID_ORIGIN, that both are public reads (no auth, no credentials),
 * and the discriminated-union error mapping.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    countByLifecyclePhase,
    fetchGridHealth,
    fetchGridStatus,
    type GridHealth,
    type GridStatus,
} from './grid-health';

function jsonResp(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const HEALTH_FIXTURE: GridHealth = {
    status: 'ok',
    reasons: [],
    timestamp: 1_700_000_000_000,
    audit: {
        in_memory_length: 120,
        persisted_max_id: 120,
        divergence: 0,
        divergence_threshold: 50,
        last_persist_attempt_at: 1_700_000_000_000,
        last_persist_error: null,
    },
    firehose: {
        client_count: 2,
        frames_sent_total: 10,
        frames_dropped_total: 0,
        last_frame_at: 1_700_000_000_000,
        watermark_bytes: 1_048_576,
    },
    clock: { tick: 65, running: true, last_tick_at: 1_700_000_000_000 },
};

const STATUS_FIXTURE: GridStatus = {
    name: 'genesis',
    tick: 65,
    epoch: 0,
    nousCount: 3,
    regionCount: 6,
    activeLaws: 1,
    auditEntries: 120,
    uptime: 60_000,
};

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('fetchGridHealth', () => {
    it('returns ok=true with parsed data on 200', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp(HEALTH_FIXTURE)));
        const res = await fetchGridHealth();
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.data.clock.tick).toBe(65);
    });

    it('builds the URL from NEXT_PUBLIC_GRID_ORIGIN as a public read', async () => {
        vi.stubEnv('NEXT_PUBLIC_GRID_ORIGIN', 'http://grid.test');
        const fetchMock = vi.fn(async () => jsonResp(HEALTH_FIXTURE));
        vi.stubGlobal('fetch', fetchMock);
        await fetchGridHealth();
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://grid.test/health/detailed');
        expect(init.credentials).toBeUndefined();
        expect(init.headers).toEqual({ accept: 'application/json' });
    });

    it('maps 503 watchdog_not_ready to unavailable', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'watchdog_not_ready' }, 503)));
        const res = await fetchGridHealth();
        expect(res).toEqual({ ok: false, error: { kind: 'unavailable' } });
    });

    it('maps a fetch rejection to network', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        const res = await fetchGridHealth();
        expect(res).toEqual({ ok: false, error: { kind: 'network' } });
    });

    it('re-throws AbortError', async () => {
        const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
        vi.stubGlobal('fetch', vi.fn(async () => { throw abort; }));
        await expect(fetchGridHealth()).rejects.toBe(abort);
    });
});

describe('fetchGridStatus', () => {
    it('GETs /api/v1/grid/status and returns the parsed body', async () => {
        vi.stubEnv('NEXT_PUBLIC_GRID_ORIGIN', 'http://grid.test');
        const fetchMock = vi.fn(async () => jsonResp(STATUS_FIXTURE));
        vi.stubGlobal('fetch', fetchMock);
        const res = await fetchGridStatus();
        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url).toBe('http://grid.test/api/v1/grid/status');
        expect(res).toEqual({ ok: true, data: STATUS_FIXTURE });
    });

    it('maps non-2xx to unavailable and a rejection to network', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({}, 500)));
        expect(await fetchGridStatus()).toEqual({ ok: false, error: { kind: 'unavailable' } });
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('x'); }));
        expect(await fetchGridStatus()).toEqual({ ok: false, error: { kind: 'network' } });
    });
});

describe('countByLifecyclePhase', () => {
    it('tallies phases as reported, in first-seen order', () => {
        expect(
            countByLifecyclePhase([
                { lifecyclePhase: 'infant' },
                { lifecyclePhase: 'maturity' },
                { lifecyclePhase: 'infant' },
            ]),
        ).toEqual([
            { phase: 'infant', count: 2 },
            { phase: 'maturity', count: 1 },
        ]);
    });

    it('returns an empty list for an empty roster', () => {
        expect(countByLifecyclePhase([])).toEqual([]);
    });
});
