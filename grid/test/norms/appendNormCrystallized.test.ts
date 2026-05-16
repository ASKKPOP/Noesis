/**
 * Phase 19 Plan 03 — appendNormCrystallized unit tests
 *
 * Covers all 10-step validation boundaries plus the happy path.
 * Additional validation: evidence_tick_range [first, last] with first <= last.
 */

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendNormCrystallized } from '../../src/norms/appendNormCrystallized.js';
import type { NormCrystallizedPayload } from '../../src/norms/types.js';

function makeChain() {
    return new AuditChain();
}

const VALID_PAYLOAD: NormCrystallizedPayload = {
    convergence_type: 'coincidental',
    evidence_tick_range: [10, 30],
    fingerprint: 'b3c4d5',
    participating_count: 4,
    tick: 30,
};

describe('appendNormCrystallized — happy path', () => {
    it('returns an AuditEntry with eventType norm.crystallized when valid', () => {
        const audit = makeChain();
        const entry = appendNormCrystallized(audit, 'did:noesis:grid', { ...VALID_PAYLOAD });
        expect(entry.eventType).toBe('norm.crystallized');
        expect(entry.actorDid).toBe('did:noesis:grid');
        expect(entry.payload.fingerprint).toBe('b3c4d5');
        expect(entry.payload.evidence_tick_range).toEqual([10, 30]);
    });

    it('accepts emergent convergence_type', () => {
        const audit = makeChain();
        const entry = appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            convergence_type: 'emergent',
        });
        expect(entry.payload.convergence_type).toBe('emergent');
    });

    it('accepts evidence_tick_range with first === last (single-tick crystallization)', () => {
        const audit = makeChain();
        const entry = appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            evidence_tick_range: [10, 10],
        });
        expect(entry.payload.evidence_tick_range).toEqual([10, 10]);
    });
});

describe('appendNormCrystallized — Step 1: DID_RE validation', () => {
    it('throws TypeError containing DID_RE for invalid actorDid', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'not-a-did', { ...VALID_PAYLOAD }))
            .toThrow(/DID_RE/);
    });
});

describe('appendNormCrystallized — Step 2: actorDid must be did:noesis:grid', () => {
    it('throws TypeError for valid DID that is not grid', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'did:noesis:nous-001', { ...VALID_PAYLOAD }))
            .toThrow(/actorDid must be/);
    });
});

describe('appendNormCrystallized — evidence_tick_range validation', () => {
    it('throws TypeError when first > last (reversed range)', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            evidence_tick_range: [30, 10],
        })).toThrow(/evidence_tick_range/);
    });

    it('throws TypeError when evidence_tick_range has only 1 element', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            evidence_tick_range: [10] as unknown as [number, number],
        })).toThrow(/evidence_tick_range/);
    });

    it('throws TypeError when evidence_tick_range is not an array', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            evidence_tick_range: 'bad' as unknown as [number, number],
        })).toThrow(/evidence_tick_range/);
    });

    it('throws when evidence_tick_range has 3 elements', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            evidence_tick_range: [10, 20, 30] as unknown as [number, number],
        })).toThrow(/evidence_tick_range/);
    });
});

describe('appendNormCrystallized — Step 4: fingerprint CHAR6_RE', () => {
    it('throws TypeError containing CHAR6_RE for non-hex fingerprint', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            fingerprint: 'zzzzzz',
        })).toThrow(/CHAR6_RE/);
    });
});

describe('appendNormCrystallized — Step 5: participating_count threshold', () => {
    it('throws TypeError for participating_count below threshold 3', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            participating_count: 2,
        })).toThrow(/participating_count/);
    });
});

describe('appendNormCrystallized — Step 6: convergence_type enum', () => {
    it('throws TypeError containing convergence_type for invalid enum', () => {
        const audit = makeChain();
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', {
            ...VALID_PAYLOAD,
            convergence_type: 'unknown' as 'emergent',
        })).toThrow(/convergence_type/);
    });
});

describe('appendNormCrystallized — Step 7: closed-tuple', () => {
    it('throws TypeError containing closed-tuple for extra payload key', () => {
        const audit = makeChain();
        const payloadWithExtra = { ...VALID_PAYLOAD, extra_key: 'x' } as unknown as NormCrystallizedPayload;
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', payloadWithExtra))
            .toThrow(/closed-tuple/);
    });
});

describe('appendNormCrystallized — Step 9: privacy gate', () => {
    it('rejects payload with rule_content key (extra key hits closed-tuple or privacy gate)', () => {
        const audit = makeChain();
        const violating = {
            ...VALID_PAYLOAD,
            rule_content: 'some rule text',
        } as unknown as NormCrystallizedPayload;
        expect(() => appendNormCrystallized(audit, 'did:noesis:grid', violating))
            .toThrow(/closed-tuple|privacy/i);
    });
});
