/**
 * appendIrisPriorSeeded unit tests — Phase 17 Wave 4 IRIS-TEST-05.
 *
 * Structural clone of appendIrisBeliefRevised.test.ts with:
 *  - belief_hash → seed_event_hash
 *  - event type → 'iris.prior_seeded'
 *
 * Covers:
 *  - Happy path: valid 4-key payload commits and returns audit entry.
 *  - Closed-tuple rejection: missing key, extra key → TypeError.
 *  - Self-report invariant: payload.nous_did !== actorDid → TypeError.
 *  - Tick validation: negative tick → TypeError.
 *  - DID validation: invalid target_did → TypeError.
 *  - Hash format: invalid seed_event_hash (not 64-char hex) → TypeError.
 *  - Privacy gate: clean payload passes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendIrisPriorSeeded } from '../../src/iris/appendIrisPriorSeeded.js';
import type { IrisPriorSeededPayload } from '../../src/iris/types.js';
import { IRIS_PRIOR_SEEDED_KEYS } from '../../src/iris/types.js';

const NOUS_DID = 'did:noesis:alpha';
const TARGET_DID = 'did:noesis:beta';
const SEED_HASH = 'c'.repeat(64);  // 64-char lowercase hex (sha256 length)

const happy: IrisPriorSeededPayload = {
    nous_did: NOUS_DID,
    tick: 5,
    target_did: TARGET_DID,
    seed_event_hash: SEED_HASH,
};

describe('appendIrisPriorSeeded — Phase 17 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends well-formed payload and returns audit entry', () => {
        const entry = appendIrisPriorSeeded(chain, NOUS_DID, happy);
        expect(entry.eventType).toBe('iris.prior_seeded');
        expect(entry.actorDid).toBe(NOUS_DID);
        const p = entry.payload as Record<string, unknown>;
        expect(Object.keys(p).sort()).toEqual([...IRIS_PRIOR_SEEDED_KEYS].sort());
        expect(p.seed_event_hash).toBe(SEED_HASH);
        expect(p.target_did).toBe(TARGET_DID);
        expect(p.tick).toBe(5);
    });

    it('commits to the chain (length increments)', () => {
        expect(chain.length).toBe(0);
        appendIrisPriorSeeded(chain, NOUS_DID, happy);
        expect(chain.length).toBe(1);
    });

    it('rejects missing key (3-key payload — no seed_event_hash)', () => {
        const bad = { nous_did: NOUS_DID, tick: 1, target_did: TARGET_DID } as any;
        expect(() => appendIrisPriorSeeded(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects extra key (closed-tuple enforcement)', () => {
        const bad = { ...happy, extra: 'oops' } as any;
        expect(() => appendIrisPriorSeeded(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects mismatched nous_did (self-report invariant)', () => {
        const bad = { ...happy, nous_did: 'did:noesis:other' };
        expect(() => appendIrisPriorSeeded(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const bad = { ...happy, tick: -1 };
        expect(() => appendIrisPriorSeeded(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects invalid target_did (not a DID)', () => {
        const bad = { ...happy, target_did: 'not-a-did' };
        expect(() => appendIrisPriorSeeded(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects invalid seed_event_hash (not 64-char hex)', () => {
        const bad = { ...happy, seed_event_hash: 'not-hex' };
        expect(() => appendIrisPriorSeeded(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects 32-char hash (must be 64-char sha256 hexdigest)', () => {
        const bad = { ...happy, seed_event_hash: 'c'.repeat(32) };
        expect(() => appendIrisPriorSeeded(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('accepts 64-char seed_event_hash (full sha256 hexdigest)', () => {
        const longHash = '0123456789abcdef'.repeat(4);  // 64-char hex
        const entry = appendIrisPriorSeeded(chain, NOUS_DID, { ...happy, seed_event_hash: longHash });
        expect(entry).toBeDefined();
        expect((entry.payload as Record<string, unknown>).seed_event_hash).toBe(longHash);
    });

    it('accepts tick=0 (boundary)', () => {
        const entry = appendIrisPriorSeeded(chain, NOUS_DID, { ...happy, tick: 0 });
        expect(entry).toBeDefined();
    });

    it('privacy gate passes on clean payload (belt-and-suspenders)', () => {
        const entry = appendIrisPriorSeeded(chain, NOUS_DID, happy);
        expect(entry).toBeDefined();
    });

    it('IRIS_PRIOR_SEEDED_KEYS is sorted alphabetically', () => {
        const sorted = [...IRIS_PRIOR_SEEDED_KEYS].sort();
        expect([...IRIS_PRIOR_SEEDED_KEYS]).toEqual(sorted);
    });
});
