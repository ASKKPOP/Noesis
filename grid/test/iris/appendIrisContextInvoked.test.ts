/**
 * appendIrisContextInvoked unit tests — Phase 17 Wave 4 IRIS-TEST-05.
 *
 * Covers:
 *  - Happy path: valid 3-key payload commits and returns audit entry.
 *  - belief_count: non-negative integer validation.
 *  - Closed-tuple: missing/extra key → TypeError.
 *  - Self-report invariant.
 *  - Tick validation.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendIrisContextInvoked } from '../../src/iris/appendIrisContextInvoked.js';
import type { IrisContextInvokedPayload } from '../../src/iris/types.js';
import { IRIS_CONTEXT_INVOKED_KEYS } from '../../src/iris/types.js';

const NOUS_DID = 'did:noesis:alpha';

const happy: IrisContextInvokedPayload = {
    nous_did: NOUS_DID,
    tick: 10,
    belief_count: 5,
};

describe('appendIrisContextInvoked — Phase 17 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends well-formed payload and returns audit entry', () => {
        const entry = appendIrisContextInvoked(chain, NOUS_DID, happy);
        expect(entry.eventType).toBe('iris.context_invoked');
        expect(entry.actorDid).toBe(NOUS_DID);
        const p = entry.payload as Record<string, unknown>;
        expect(Object.keys(p).sort()).toEqual([...IRIS_CONTEXT_INVOKED_KEYS].sort());
        expect(p.belief_count).toBe(5);
    });

    it('commits to the chain (length increments)', () => {
        expect(chain.length).toBe(0);
        appendIrisContextInvoked(chain, NOUS_DID, happy);
        expect(chain.length).toBe(1);
    });

    it('accepts belief_count=0 (structurally valid — no injections happened)', () => {
        const entry = appendIrisContextInvoked(chain, NOUS_DID, { ...happy, belief_count: 0 });
        expect(entry).toBeDefined();
        expect((entry.payload as Record<string, unknown>).belief_count).toBe(0);
    });

    it('accepts belief_count=1 (minimum non-zero)', () => {
        const entry = appendIrisContextInvoked(chain, NOUS_DID, { ...happy, belief_count: 1 });
        expect(entry).toBeDefined();
    });

    it('rejects negative belief_count', () => {
        expect(() =>
            appendIrisContextInvoked(chain, NOUS_DID, { ...happy, belief_count: -1 } as any)
        ).toThrow(TypeError);
    });

    it('rejects fractional belief_count (non-integer)', () => {
        expect(() =>
            appendIrisContextInvoked(chain, NOUS_DID, { ...happy, belief_count: 1.5 } as any)
        ).toThrow(TypeError);
    });

    it('rejects extra key (closed-tuple enforcement)', () => {
        expect(() =>
            appendIrisContextInvoked(chain, NOUS_DID, { ...happy, extra: 'x' } as any)
        ).toThrow(TypeError);
    });

    it('rejects missing belief_count (2-key payload)', () => {
        const bad = { nous_did: NOUS_DID, tick: 1 } as any;
        expect(() => appendIrisContextInvoked(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects mismatched nous_did (self-report invariant)', () => {
        const bad = { ...happy, nous_did: 'did:noesis:other' };
        expect(() => appendIrisContextInvoked(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        expect(() =>
            appendIrisContextInvoked(chain, NOUS_DID, { ...happy, tick: -1 } as any)
        ).toThrow(TypeError);
    });

    it('accepts tick=0 (boundary)', () => {
        const entry = appendIrisContextInvoked(chain, NOUS_DID, { ...happy, tick: 0 });
        expect(entry).toBeDefined();
    });

    it('IRIS_CONTEXT_INVOKED_KEYS is sorted alphabetically', () => {
        const sorted = [...IRIS_CONTEXT_INVOKED_KEYS].sort();
        expect([...IRIS_CONTEXT_INVOKED_KEYS]).toEqual(sorted);
    });
});
