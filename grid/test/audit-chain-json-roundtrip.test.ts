import { describe, it, expect } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import type { AuditEntry } from '../src/audit/types.js';

/**
 * Regression for the audit-chain "chain_valid=false after restart" bug.
 *
 * Root cause: audit `payload` is persisted to a MySQL `JSON` column
 * (grid/src/db/schema.ts:37), which NORMALIZES/REORDERS object keys on
 * storage. On restore (grid/src/db/stores/audit-store.ts:loadAll) mysql2
 * returns the pre-parsed object in MySQL's key order. The pre-fix computeHash
 * used JSON.stringify(payload) — insertion-order-dependent — so the recomputed
 * hash no longer matched the stored event_hash and verify() reported the chain
 * broken at the first entry.
 *
 * The whole prior test suite used InMemoryGridStore (no JSON round-trip), so it
 * never exercised the reorder — that gap is exactly what these tests close.
 *
 * `mysqlJsonRoundTrip` simulates the reorder a real MySQL JSON column performs:
 * values are byte-preserved, only object key ORDER changes.
 */
function reorderKeys(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(reorderKeys);
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // Reverse-sorted key order — deliberately different from insertion order.
    for (const k of Object.keys(obj).sort().reverse()) out[k] = reorderKeys(obj[k]);
    return out;
}

function mysqlJsonRoundTrip(entry: AuditEntry): AuditEntry {
    return { ...entry, payload: reorderKeys(entry.payload) as Record<string, unknown> };
}

describe('AuditChain — survives MySQL JSON key reordering on restore', () => {
    it('verify() stays valid after payload keys are reordered on reload', () => {
        const seed = new AuditChain();
        // Payloads whose insertion order != sorted order, incl. a nested object.
        seed.append('registry.civic_did_issued', 'did:noesis:sophia', {
            zebra: 1,
            alpha: 'x',
            mid: { gamma: true, beta: [3, 1, 2] },
        });
        seed.append('market.settled', 'did:noesis:hermes', { price: 5, buyer: 'a', asset: 'z' });
        seed.append('polis.law_enacted', 'did:noesis:themis', { lawId: 'l1', title: 't' });

        // Sanity: the intact in-memory chain verifies.
        expect(seed.verify()).toEqual({ valid: true });

        // Simulate the DB round-trip: reorder every payload's keys.
        const reloaded = seed.all().map(mysqlJsonRoundTrip);

        const restored = new AuditChain();
        restored.loadEntries(reloaded);

        // With canonical (sorted-key) hashing this is valid; with the old
        // insertion-order JSON.stringify it would be { valid: false, brokenAt: 0 }.
        expect(restored.verify()).toEqual({ valid: true });
    });

    it('still detects a genuine value tamper after the round-trip', () => {
        const seed = new AuditChain();
        seed.append('event.a', 'did:noesis:a', { x: 1, y: 2 });
        seed.append('event.b', 'did:noesis:b', { y: 2, x: 1 });

        const reloaded = seed.all().map(mysqlJsonRoundTrip);
        // Tamper: change a VALUE (not just key order) in the second entry.
        (reloaded[1].payload as Record<string, unknown>).x = 999;

        const restored = new AuditChain();
        restored.loadEntries(reloaded);

        const result = restored.verify();
        expect(result.valid).toBe(false);
        expect(result.brokenAt).toBe(1);
    });

    it('stableStringify is key-order independent but value/array-order sensitive', () => {
        const a = AuditChain.stableStringify({ b: 1, a: { d: 2, c: 3 } });
        const b = AuditChain.stableStringify({ a: { c: 3, d: 2 }, b: 1 });
        expect(a).toBe(b); // key order ignored (recursively)

        expect(AuditChain.stableStringify({ x: 1 })).not.toBe(AuditChain.stableStringify({ x: 2 })); // value matters
        expect(AuditChain.stableStringify([1, 2])).not.toBe(AuditChain.stableStringify([2, 1])); // array order matters
    });
});
