/**
 * Tests for refillFromDropped — REST backfill triggered by DroppedFrame.
 *
 * Contract: given sinceId (exclusive) and latestId (inclusive), fetch every
 * AuditEntry in (sinceId, latestId] from /api/v1/audit/trail, paginating by
 * PAGE_LIMIT (1000), deliver via onEntries in order, and coalesce concurrent
 * calls with the same (origin, sinceId, latestId) key into a single fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAuditEntry, resetFixtureIds } from '@/test/fixtures/ws-frames';
import type { AuditEntry } from '@/lib/protocol/audit-types';
import { refillFromDropped, RefillError, __resetRefillState } from './refill';

function mockJsonResponse(body: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => body,
    } as unknown as Response;
}

describe('refillFromDropped', () => {
    beforeEach(() => {
        resetFixtureIds();
        __resetRefillState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('fetches with offset=sinceId and limit covering the gap', async () => {
        const entries: AuditEntry[] = [
            makeAuditEntry({ id: 5 }),
            makeAuditEntry({ id: 6 }),
            makeAuditEntry({ id: 7 }),
        ];
        const fetchMock = vi.fn(
            async (_url: string, _init?: RequestInit) =>
                mockJsonResponse({ entries, total: 100 }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const received: AuditEntry[] = [];
        const out = await refillFromDropped(
            { sinceId: 4, latestId: 7 },
            'http://localhost:8080',
            (e) => received.push(...e),
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const url = fetchMock.mock.calls[0]![0];
        expect(url).toContain('offset=4');
        expect(url).toContain('limit=3');
        expect(out).toEqual(entries);
        expect(received).toEqual(entries);
    });

    it('paginates when gap exceeds PAGE_LIMIT (1000)', async () => {
        // 5 pages of 1000 entries each to span sinceId=0 → latestId=5000.
        const fetchMock = vi.fn(async (url: string) => {
            const offset = Number(new URL(url).searchParams.get('offset'));
            const limit = Number(new URL(url).searchParams.get('limit'));
            const page: AuditEntry[] = [];
            for (let i = 0; i < limit; i += 1) {
                page.push(makeAuditEntry({ id: offset + i + 1 }));
            }
            return mockJsonResponse({ entries: page, total: 5000 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const out = await refillFromDropped(
            { sinceId: 0, latestId: 5000 },
            'http://localhost:8080',
            () => {},
        );

        expect(fetchMock).toHaveBeenCalledTimes(5);
        // Every call must request limit<=1000.
        for (const call of fetchMock.mock.calls) {
            const url = call[0] as string;
            const limit = Number(new URL(url).searchParams.get('limit'));
            expect(limit).toBeLessThanOrEqual(1000);
        }
        expect(out).toHaveLength(5000);
    });

    it('coalesces concurrent calls with the same (origin, sinceId, latestId) key', async () => {
        // Manually-controlled fetch promise — we resolve it once both callers
        // have subscribed to the same in-flight promise.
        let resolveFetch!: (value: Response) => void;
        const pending = new Promise<Response>((res) => {
            resolveFetch = res;
        });
        const fetchMock = vi.fn(async () => pending);
        vi.stubGlobal('fetch', fetchMock);

        const entries: AuditEntry[] = [makeAuditEntry({ id: 10 }), makeAuditEntry({ id: 11 })];
        const p1 = refillFromDropped(
            { sinceId: 9, latestId: 11 },
            'http://localhost:8080',
            () => {},
        );
        const p2 = refillFromDropped(
            { sinceId: 9, latestId: 11 },
            'http://localhost:8080',
            () => {},
        );
        // Second call must NOT trigger a new fetch.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        resolveFetch(mockJsonResponse({ entries, total: 50 }));
        const [r1, r2] = await Promise.all([p1, p2]);
        expect(r1).toEqual(entries);
        expect(r2).toEqual(entries);
        // Exactly one network round-trip.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('propagates AbortSignal to fetch', async () => {
        const controller = new AbortController();
        const fetchMock = vi.fn(
            async (_url: string, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('aborted', 'AbortError'));
                    });
                }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const p = refillFromDropped(
            { sinceId: 0, latestId: 5 },
            'http://localhost:8080',
            () => {},
            controller.signal,
        );
        // Initial call should have received the signal.
        expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
        controller.abort();
        await expect(p).rejects.toBeInstanceOf(RefillError);
    });

    it('empty gap (sinceId === latestId) is a no-op', async () => {
        const fetchMock = vi.fn(async () => mockJsonResponse({ entries: [], total: 0 }));
        vi.stubGlobal('fetch', fetchMock);
        const received: AuditEntry[] = [];
        const out = await refillFromDropped(
            { sinceId: 10, latestId: 10 },
            'http://localhost:8080',
            (e) => received.push(...e),
        );
        expect(fetchMock).not.toHaveBeenCalled();
        expect(out).toEqual([]);
        expect(received).toEqual([]);
    });

    it('fetch failure throws RefillError with cause', async () => {
        const cause = new TypeError('network fail');
        const fetchMock = vi.fn(async () => {
            throw cause;
        });
        vi.stubGlobal('fetch', fetchMock);
        await expect(
            refillFromDropped(
                { sinceId: 0, latestId: 5 },
                'http://localhost:8080',
                () => {},
            ),
        ).rejects.toSatisfy((err: unknown) => {
            return err instanceof RefillError && (err as RefillError).cause === cause;
        });
    });
});
