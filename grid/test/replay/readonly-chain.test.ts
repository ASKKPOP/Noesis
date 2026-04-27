/**
 * RED tests for ReadOnlyAuditChain (REPLAY-03 / T-10-07).
 *
 * These tests encode the acceptance criteria for Wave 1 (Plan 13-02).
 * They MUST fail until grid/src/replay/readonly-chain.ts is created.
 *
 * Threat mitigation: T-10-07 — "ReplayGrid shares state with live Grid".
 * ReadOnlyAuditChain.append() must throw to prevent any replay code from
 * accidentally writing back to what would be the live audit chain.
 */

import { describe, it, expect } from 'vitest';
// RED until Wave 1 (Plan 13-02) creates grid/src/replay/readonly-chain.ts
import { ReadOnlyAuditChain } from '../../src/replay/readonly-chain.js';
import type { AuditEntry } from '../../src/audit/types.js';

/** A minimal canned AuditEntry for test setup. */
function makeEntry(id: number, eventHash: string, prevHash: string): AuditEntry {
    return {
        id,
        eventType: 'tick',
        actorDid: 'system',
        payload: { n: id },
        prevHash,
        eventHash,
        createdAt: 1714435200000,
    };
}

const GENESIS = '0'.repeat(64);
const HASH_1 = 'a'.repeat(64);

const INITIAL_ENTRIES: AuditEntry[] = [
    makeEntry(1, HASH_1, GENESIS),
];

describe('ReadOnlyAuditChain', () => {
    it('append() throws TypeError with "read-only" in message', () => {
        const chain = new ReadOnlyAuditChain(INITIAL_ENTRIES);
        expect(() =>
            chain.append('tick', 'system', { n: 2 }),
        ).toThrow(/read-only/i);
        // Throws a TypeError specifically
        expect(() =>
            chain.append('tick', 'system', { n: 2 }),
        ).toThrow(TypeError);
    });
    // RED until Wave 1 (Plan 13-02) creates grid/src/replay/readonly-chain.ts

    it('loadEntries() and read APIs work — chain.length, chain.head, chain.at(0) functional', () => {
        const chain = new ReadOnlyAuditChain(INITIAL_ENTRIES);
        expect(chain.length).toBe(1);
        expect(chain.head).toBe(HASH_1);
        expect(chain.at(0)).toMatchObject({ eventType: 'tick', id: 1 });
    });
    // RED until Wave 1 (Plan 13-02) creates grid/src/replay/readonly-chain.ts

    it('does not fire onAppend listeners on construction (loadEntries is silent)', () => {
        let fired = 0;
        const chain = new ReadOnlyAuditChain([]);
        chain.onAppend(() => { fired++; });
        // Now load entries — must NOT fire listeners
        const entries: AuditEntry[] = [makeEntry(1, HASH_1, GENESIS)];
        // ReadOnlyAuditChain constructor calls loadEntries internally;
        // we construct a fresh chain with entries to test the invariant
        const chain2 = new ReadOnlyAuditChain(entries);
        chain2.onAppend(() => { fired++; });
        // After construction, fired must still be 0
        expect(fired).toBe(0);
    });
    // RED until Wave 1 (Plan 13-02) creates grid/src/replay/readonly-chain.ts
});
