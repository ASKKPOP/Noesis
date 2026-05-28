/**
 * Phase 43 Plan 02 — forkTokenStore tests.
 *
 * Tests for grid/src/api/operator/fork-token-store.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { forkTokenStore } from '../../../src/api/operator/fork-token-store.js';

function makeEntry(overrides: Partial<{ nousDid: string; archiveBytes: Buffer; expiresAt: number }> = {}) {
    return {
        nousDid: 'did:civic:noesis:test',
        archiveBytes: Buffer.from('test-archive-bytes'),
        expiresAt: Date.now() + 5 * 60_000,  // 5 minutes from now
        ...overrides,
    };
}

describe('forkTokenStore — in-memory one-time token store', () => {
    beforeEach(() => {
        forkTokenStore._clear();
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        forkTokenStore._clear();
    });

    it('put(token, entry) stores the entry', () => {
        forkTokenStore.put('token-1', makeEntry());
        expect(forkTokenStore._size()).toBe(1);
    });

    it('consume(token) on first call returns entry AND deletes it', () => {
        const entry = makeEntry();
        forkTokenStore.put('token-2', entry);
        const result = forkTokenStore.consume('token-2');
        expect(result).toBeDefined();
        expect(result?.nousDid).toBe(entry.nousDid);
        expect(forkTokenStore._size()).toBe(0);
    });

    it('consume(token) on second call returns undefined (one-time semantics)', () => {
        forkTokenStore.put('token-3', makeEntry());
        forkTokenStore.consume('token-3');
        const result = forkTokenStore.consume('token-3');
        expect(result).toBeUndefined();
    });

    it('consume(token) on expired entry returns undefined AND deletes the entry', () => {
        vi.useFakeTimers();
        // Set up entry with expiresAt = now + 1ms
        const expiresAt = Date.now() + 1;
        forkTokenStore.put('token-4', makeEntry({ expiresAt }));

        // Advance time past expiry
        vi.advanceTimersByTime(10);

        const result = forkTokenStore.consume('token-4');
        expect(result).toBeUndefined();
        // Entry should have been deleted
        expect(forkTokenStore._size()).toBe(0);
    });

    it('consume(token) on missing entry returns undefined', () => {
        const result = forkTokenStore.consume('nonexistent-token');
        expect(result).toBeUndefined();
    });
});
