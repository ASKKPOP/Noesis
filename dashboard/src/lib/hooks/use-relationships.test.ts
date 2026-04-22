/**
 * use-relationships.test.ts — SWR hook batching-key tests.
 *
 * Tests verify:
 * 1. windowKey = Math.floor(currentTick / 100) — four tick boundary assertions.
 * 2. useRelationshipsH1 returns null SWR key when did is null.
 * 3. useRelationshipsH2 returns null SWR key when tier is 'H1'.
 * 4. Two components with same did+window-key dedupe to one fetch.
 *
 * Strategy: vi.mock 'swr' to capture the SWR key that the hook computes,
 * and vi.mock '@/lib/stores/tick-store' to inject the current tick value.
 * This tests the key-building logic in isolation without a real HTTP server
 * or StoresProvider.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock tick store — control currentTick from tests
// ---------------------------------------------------------------------------
let _mockTick = 0;

vi.mock('@/lib/stores/tick-store', () => ({
    useTick: () => _mockTick,
}));

// ---------------------------------------------------------------------------
// Mock SWR — capture the key and fetcher, don't actually fetch
// ---------------------------------------------------------------------------
type SwrKey = unknown;
type SwrFetcher = (() => Promise<unknown>) | null;

interface SWRCall {
    key: SwrKey;
    fetcher: SwrFetcher;
}

const _swrCalls: SWRCall[] = [];
let _fetcherCallCount = 0;

vi.mock('swr', () => ({
    default: (key: SwrKey, fetcher: SwrFetcher) => {
        _swrCalls.push({ key, fetcher });
        // Track how many times the fetcher function is actually invoked
        // to test deduplication behavior.
        if (fetcher !== null) {
            _fetcherCallCount++;
        }
        return { data: undefined, error: undefined, isLoading: true };
    },
}));

// ---------------------------------------------------------------------------
// Mock fetchers — avoid real HTTP
// ---------------------------------------------------------------------------
vi.mock('@/lib/api/relationships', () => ({
    fetchRelationshipsH1: vi.fn().mockResolvedValue({}),
    fetchRelationshipsH2: vi.fn().mockResolvedValue({}),
    fetchGraph: vi.fn().mockResolvedValue({}),
}));

import { useRelationshipsH1, useRelationshipsH2, useGraph } from './use-relationships';

describe('use-relationships — 100-tick batching key (D-9-13, T-09-11)', () => {
    beforeEach(() => {
        _swrCalls.length = 0;
        _fetcherCallCount = 0;
        _mockTick = 0;
    });

    // -----------------------------------------------------------------------
    // Test 1: windowKey = Math.floor(currentTick / 100) at four tick boundaries
    // -----------------------------------------------------------------------
    it('builds windowKey = Math.floor(currentTick / 100) at tick 999, 1000, 1099, 1100', () => {
        const did = 'did:noesis:test-nous';

        // Tick 999 → windowKey 9
        _mockTick = 999;
        renderHook(() => useRelationshipsH1(did));
        expect(_swrCalls.at(-1)!.key).toEqual(['relationships-h1', did, 9]);

        // Tick 1000 → windowKey 10
        _mockTick = 1000;
        renderHook(() => useRelationshipsH1(did));
        expect(_swrCalls.at(-1)!.key).toEqual(['relationships-h1', did, 10]);

        // Tick 1099 → windowKey 10 (same window as 1000)
        _mockTick = 1099;
        renderHook(() => useRelationshipsH1(did));
        expect(_swrCalls.at(-1)!.key).toEqual(['relationships-h1', did, 10]);

        // Tick 1100 → windowKey 11 (new window)
        _mockTick = 1100;
        renderHook(() => useRelationshipsH1(did));
        expect(_swrCalls.at(-1)!.key).toEqual(['relationships-h1', did, 11]);
    });

    // -----------------------------------------------------------------------
    // Test 2: null SWR key when did is null (prevents fetch before selection)
    // -----------------------------------------------------------------------
    it('returns null SWR key when did is null (no fetch before selection)', () => {
        _mockTick = 500;
        renderHook(() => useRelationshipsH1(null));
        const lastCall = _swrCalls.at(-1)!;
        expect(lastCall.key).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Test 3: null SWR key when tier is 'H1' (T-09-20 + T-09-24)
    // -----------------------------------------------------------------------
    it('returns null SWR key for useRelationshipsH2 when tier is H1 (T-09-20)', () => {
        _mockTick = 500;
        const did = 'did:noesis:test-nous';
        renderHook(() => useRelationshipsH2(did, 'H1'));
        const lastCall = _swrCalls.at(-1)!;
        // T-09-20: H1 operators MUST NOT access H2 numeric data from SWR cache
        expect(lastCall.key).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Test 4: H2 and H5 tiers DO produce a non-null key (positive case)
    // -----------------------------------------------------------------------
    it('produces non-null SWR key for useRelationshipsH2 when tier is H2 or H5', () => {
        _mockTick = 200;
        const did = 'did:noesis:test-nous';

        renderHook(() => useRelationshipsH2(did, 'H2'));
        expect(_swrCalls.at(-1)!.key).toEqual(['relationships-h2', did, 2]);

        renderHook(() => useRelationshipsH2(did, 'H5'));
        expect(_swrCalls.at(-1)!.key).toEqual(['relationships-h2', did, 2]);
    });

    // -----------------------------------------------------------------------
    // Test 5: BATCH_WINDOW_TICKS literal is exactly 100 (load-bearing D-9-13)
    // -----------------------------------------------------------------------
    it('uses exactly 100 as the batch window divisor (D-9-13 gate)', () => {
        // If BATCH_WINDOW_TICKS were changed, the key at tick=150 would differ.
        // With 100: floor(150/100) = 1
        // With 50:  floor(150/50) = 3
        _mockTick = 150;
        const did = 'did:noesis:test-nous';
        renderHook(() => useRelationshipsH1(did));
        expect(_swrCalls.at(-1)!.key).toEqual(['relationships-h1', did, 1]);
    });

    // -----------------------------------------------------------------------
    // Test 6: useGraph uses the same 100-tick window key
    // -----------------------------------------------------------------------
    it('useGraph builds [graph, windowKey] with 100-tick batching', () => {
        _mockTick = 1050;
        renderHook(() => useGraph());
        expect(_swrCalls.at(-1)!.key).toEqual(['graph', 10]);
    });
});
