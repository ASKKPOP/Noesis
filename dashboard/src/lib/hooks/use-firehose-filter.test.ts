import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFirehoseFilter, DIALOGUE_ID_RE } from './use-firehose-filter';

/**
 * Plan 07-04 Task 1 — useFirehoseFilter hook tests.
 *
 * Consumer-side mirror of Plan 03's producer-boundary regex discipline. The
 * hook accepts `?firehose_filter=<key>:<value>`, currently only key='dialogue_id'
 * with a strict 16-hex value. Malformed values and unknown keys silently resolve
 * to `filter: null` — the chip does not mount and firehose renders unfiltered.
 *
 * Pattern parallels tab-bar.test.tsx router-mock style.
 */

// Mutable mocks the test body rewrites per-case.
const mockPush = vi.fn();
let mockSearchParamsStr = '';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => new URLSearchParams(mockSearchParamsStr),
}));

beforeEach(() => {
    mockPush.mockReset();
    mockSearchParamsStr = '';
});

describe('DIALOGUE_ID_RE', () => {
    it('is the 16-hex lowercase pattern (producer-boundary parity)', () => {
        expect(DIALOGUE_ID_RE.test('a1b2c3d4e5f6a7b8')).toBe(true);
        expect(DIALOGUE_ID_RE.test('A1B2C3D4E5F6A7B8')).toBe(false); // not lowercase
        expect(DIALOGUE_ID_RE.test('a1b2c3d4e5f6a7b')).toBe(false); // 15 chars
        expect(DIALOGUE_ID_RE.test('a1b2c3d4e5f6a7b8a')).toBe(false); // 17 chars
        expect(DIALOGUE_ID_RE.test('g1b2c3d4e5f6a7b8')).toBe(false); // non-hex
    });
});

describe('useFirehoseFilter — parsing', () => {
    it('returns filter:null when no firehose_filter param is present', () => {
        const { result } = renderHook(() => useFirehoseFilter());
        expect(result.current.filter).toBeNull();
    });

    it('parses a well-formed dialogue_id param into a FirehoseFilter', () => {
        mockSearchParamsStr = 'firehose_filter=dialogue_id:a1b2c3d4e5f6a7b8';
        const { result } = renderHook(() => useFirehoseFilter());
        expect(result.current.filter).toEqual({
            key: 'dialogue_id',
            value: 'a1b2c3d4e5f6a7b8',
        });
    });

    it('returns filter:null when value is not lowercase-hex (NOTHEX)', () => {
        mockSearchParamsStr = 'firehose_filter=dialogue_id:NOTHEX0000000000';
        const { result } = renderHook(() => useFirehoseFilter());
        expect(result.current.filter).toBeNull();
    });

    it('returns filter:null when value is wrong length (abc)', () => {
        mockSearchParamsStr = 'firehose_filter=dialogue_id:abc';
        const { result } = renderHook(() => useFirehoseFilter());
        expect(result.current.filter).toBeNull();
    });

    it('returns filter:null when key is unknown (unknown_key:anything)', () => {
        mockSearchParamsStr = 'firehose_filter=unknown_key:anything';
        const { result } = renderHook(() => useFirehoseFilter());
        expect(result.current.filter).toBeNull();
    });
});

describe('useFirehoseFilter — setFilter', () => {
    it('setFilter writes firehose_filter=key:value preserving other params', () => {
        mockSearchParamsStr = 'tab=firehose';
        const { result } = renderHook(() => useFirehoseFilter());
        act(() => {
            result.current.setFilter({ key: 'dialogue_id', value: 'a1b2c3d4e5f6a7b8' });
        });
        expect(mockPush).toHaveBeenCalledTimes(1);
        const pushedUrl = mockPush.mock.calls[0]![0] as string;
        // URL should keep tab=firehose and include the dialogue_id filter.
        // URLSearchParams may URL-encode the colon as %3A; decode before asserting.
        const decoded = decodeURIComponent(pushedUrl);
        expect(decoded).toContain('tab=firehose');
        expect(decoded).toContain('firehose_filter=dialogue_id:a1b2c3d4e5f6a7b8');
    });
});

describe('useFirehoseFilter — clear', () => {
    it('clear removes only firehose_filter param (other params preserved)', () => {
        mockSearchParamsStr = 'tab=firehose&firehose_filter=dialogue_id:a1b2c3d4e5f6a7b8';
        const { result } = renderHook(() => useFirehoseFilter());
        act(() => {
            result.current.clear();
        });
        expect(mockPush).toHaveBeenCalledTimes(1);
        const pushedUrl = mockPush.mock.calls[0]![0] as string;
        const decoded = decodeURIComponent(pushedUrl);
        expect(decoded).toContain('tab=firehose');
        expect(decoded).not.toContain('firehose_filter');
    });
});
