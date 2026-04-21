import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
    CHECKS,
    CHECK_ORDER,
    registerCheck,
    clearRegistryForTesting,
} from '../../src/review/registry.js';
import type { Check } from '../../src/review/types.js';

describe('review/registry: registerCheck + CHECKS + CHECK_ORDER', () => {
    beforeEach(() => {
        clearRegistryForTesting();
    });

    it('registerCheck adds the name to CHECKS and pushes to CHECK_ORDER', () => {
        const handler: Check = () => ({ ok: true });
        registerCheck('insufficient_balance', handler);
        expect(CHECKS.size).toBe(1);
        expect(CHECKS.get('insufficient_balance')).toBe(handler);
        expect(CHECK_ORDER).toEqual(['insufficient_balance']);
    });

    it('duplicate registerCheck call throws with /already registered/i', () => {
        const handler: Check = () => ({ ok: true });
        registerCheck('insufficient_balance', handler);
        expect(() => registerCheck('insufficient_balance', handler)).toThrow(/already registered/i);
    });

    it('CHECK_ORDER.length always equals CHECKS.size', () => {
        registerCheck('insufficient_balance', () => ({ ok: true }));
        registerCheck('invalid_counterparty_did', () => ({ ok: true }));
        expect(CHECK_ORDER.length).toBe(CHECKS.size);
        expect(CHECK_ORDER.length).toBe(2);
    });
});

describe('registry: 5-check registration via side-effect imports', () => {
    beforeAll(async () => {
        clearRegistryForTesting();
        await import('../../src/review/checks/balance.js');
        await import('../../src/review/checks/counterparty-did.js');
        await import('../../src/review/checks/amount.js');
        await import('../../src/review/checks/memory-refs.js');
        await import('../../src/review/checks/telos-hash.js');
    });

    it('all 5 checks register into CHECKS', () => {
        expect(CHECKS.size).toBe(5);
        expect(new Set(CHECK_ORDER)).toEqual(new Set([
            'insufficient_balance',
            'invalid_counterparty_did',
            'non_positive_amount',
            'malformed_memory_refs',
            'malformed_telos_hash',
        ]));
    });

    it('balance handler: fails on proposerBalance < amount', () => {
        const handler = CHECKS.get('insufficient_balance')!;
        expect(handler({ proposerDid: 'did:noesis:a', proposerBalance: 5, counterparty: 'did:noesis:b', amount: 10, memoryRefs: ['mem:1'], telosHash: 'a'.repeat(64) }))
            .toEqual({ ok: false, code: 'insufficient_balance' });
        expect(handler({ proposerDid: 'did:noesis:a', proposerBalance: 10, counterparty: 'did:noesis:b', amount: 10, memoryRefs: ['mem:1'], telosHash: 'a'.repeat(64) }))
            .toEqual({ ok: true });
    });

    it('amount handler: fails on 0, negative, non-integer', () => {
        const h = CHECKS.get('non_positive_amount')!;
        const base = { proposerDid: 'did:noesis:a', proposerBalance: 1000, counterparty: 'did:noesis:b', memoryRefs: ['mem:1'], telosHash: 'a'.repeat(64) };
        expect(h({ ...base, amount: 0 })).toEqual({ ok: false, code: 'non_positive_amount' });
        expect(h({ ...base, amount: -1 })).toEqual({ ok: false, code: 'non_positive_amount' });
        expect(h({ ...base, amount: 1.5 })).toEqual({ ok: false, code: 'non_positive_amount' });
        expect(h({ ...base, amount: 1 })).toEqual({ ok: true });
    });

    it('counterparty-did handler: fails on malformed DID, dot in grid segment, and self-transfer', () => {
        const h = CHECKS.get('invalid_counterparty_did')!;
        const base = { proposerDid: 'did:noesis:alpha', proposerBalance: 10, amount: 1, memoryRefs: ['mem:1'], telosHash: 'a'.repeat(64) };
        expect(h({ ...base, counterparty: 'alpha' })).toEqual({ ok: false, code: 'invalid_counterparty_did' });
        expect(h({ ...base, counterparty: 'did:noesis:reviewer.gridX' })).toEqual({ ok: false, code: 'invalid_counterparty_did' });
        expect(h({ ...base, counterparty: 'did:noesis:alpha' })).toEqual({ ok: false, code: 'invalid_counterparty_did' }); // self
        expect(h({ ...base, counterparty: 'did:noesis:beta' })).toEqual({ ok: true });
    });

    it('memory-refs handler: fails on empty, non-string, or bad format', () => {
        const h = CHECKS.get('malformed_memory_refs')!;
        const base = { proposerDid: 'did:noesis:a', proposerBalance: 10, counterparty: 'did:noesis:b', amount: 1, telosHash: 'a'.repeat(64) };
        expect(h({ ...base, memoryRefs: [] })).toEqual({ ok: false, code: 'malformed_memory_refs' });
        expect(h({ ...base, memoryRefs: ['mem:abc'] })).toEqual({ ok: false, code: 'malformed_memory_refs' });
        expect(h({ ...base, memoryRefs: ['1'] })).toEqual({ ok: false, code: 'malformed_memory_refs' });
        expect(h({ ...base, memoryRefs: ['mem:1', 'mem:42'] })).toEqual({ ok: true });
    });

    it('telos-hash handler: fails on non-64-hex, passes on 64 lowercase hex', () => {
        const h = CHECKS.get('malformed_telos_hash')!;
        const base = { proposerDid: 'did:noesis:a', proposerBalance: 10, counterparty: 'did:noesis:b', amount: 1, memoryRefs: ['mem:1'] };
        expect(h({ ...base, telosHash: 'abc' })).toEqual({ ok: false, code: 'malformed_telos_hash' });
        expect(h({ ...base, telosHash: 'A'.repeat(64) })).toEqual({ ok: false, code: 'malformed_telos_hash' }); // upper case disallowed
        expect(h({ ...base, telosHash: 'a'.repeat(64) })).toEqual({ ok: true });
    });
});
