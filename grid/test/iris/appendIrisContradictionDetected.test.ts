/**
 * appendIrisContradictionDetected unit tests — Phase 17 Wave 4 IRIS-TEST-05.
 *
 * Structural clone of appendIrisBeliefRevised.test.ts with:
 *  - belief_hash → contradiction_hash
 *  - event type → 'iris.contradiction_detected'
 *
 * Covers:
 *  - Happy path: valid 4-key payload commits and returns audit entry.
 *  - Closed-tuple rejection: missing key, extra key → TypeError.
 *  - Self-report invariant: payload.nous_did !== actorDid → TypeError.
 *  - Tick validation: negative tick → TypeError.
 *  - DID validation: invalid target_did → TypeError.
 *  - Hash format: invalid contradiction_hash (not 64-char hex) → TypeError.
 *  - Privacy gate: clean payload passes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendIrisContradictionDetected } from '../../src/iris/appendIrisContradictionDetected.js';
import type { IrisContradictionDetectedPayload } from '../../src/iris/types.js';
import { IRIS_CONTRADICTION_DETECTED_KEYS } from '../../src/iris/types.js';

const NOUS_DID = 'did:noesis:alpha';
const TARGET_DID = 'did:noesis:beta';
const CONTRADICTION_HASH = 'b'.repeat(64);  // 64-char lowercase hex (sha256 length)

const happy: IrisContradictionDetectedPayload = {
    nous_did: NOUS_DID,
    tick: 20,
    target_did: TARGET_DID,
    contradiction_hash: CONTRADICTION_HASH,
};

describe('appendIrisContradictionDetected — Phase 17 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends well-formed payload and returns audit entry', () => {
        const entry = appendIrisContradictionDetected(chain, NOUS_DID, happy);
        expect(entry.eventType).toBe('iris.contradiction_detected');
        expect(entry.actorDid).toBe(NOUS_DID);
        const p = entry.payload as Record<string, unknown>;
        expect(Object.keys(p).sort()).toEqual([...IRIS_CONTRADICTION_DETECTED_KEYS].sort());
        expect(p.contradiction_hash).toBe(CONTRADICTION_HASH);
        expect(p.target_did).toBe(TARGET_DID);
        expect(p.tick).toBe(20);
    });

    it('commits to the chain (length increments)', () => {
        expect(chain.length).toBe(0);
        appendIrisContradictionDetected(chain, NOUS_DID, happy);
        expect(chain.length).toBe(1);
    });

    it('rejects missing key (3-key payload — no contradiction_hash)', () => {
        const bad = { nous_did: NOUS_DID, tick: 1, target_did: TARGET_DID } as any;
        expect(() => appendIrisContradictionDetected(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects extra key (closed-tuple enforcement)', () => {
        const bad = { ...happy, extra: 'oops' } as any;
        expect(() => appendIrisContradictionDetected(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects mismatched nous_did (self-report invariant)', () => {
        const bad = { ...happy, nous_did: 'did:noesis:other' };
        expect(() => appendIrisContradictionDetected(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const bad = { ...happy, tick: -1 };
        expect(() => appendIrisContradictionDetected(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects invalid target_did (not a DID)', () => {
        const bad = { ...happy, target_did: 'not-a-did' };
        expect(() => appendIrisContradictionDetected(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects invalid contradiction_hash (not 64-char hex)', () => {
        const bad = { ...happy, contradiction_hash: 'not-hex' };
        expect(() => appendIrisContradictionDetected(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects 32-char hash (must be 64-char sha256 hexdigest)', () => {
        const bad = { ...happy, contradiction_hash: 'b'.repeat(32) };
        expect(() => appendIrisContradictionDetected(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('accepts tick=0 (boundary)', () => {
        const entry = appendIrisContradictionDetected(chain, NOUS_DID, { ...happy, tick: 0 });
        expect(entry).toBeDefined();
    });

    it('privacy gate passes on clean payload (belt-and-suspenders)', () => {
        const entry = appendIrisContradictionDetected(chain, NOUS_DID, happy);
        expect(entry).toBeDefined();
    });

    it('IRIS_CONTRADICTION_DETECTED_KEYS is sorted alphabetically', () => {
        const sorted = [...IRIS_CONTRADICTION_DETECTED_KEYS].sort();
        expect([...IRIS_CONTRADICTION_DETECTED_KEYS]).toEqual(sorted);
    });
});
