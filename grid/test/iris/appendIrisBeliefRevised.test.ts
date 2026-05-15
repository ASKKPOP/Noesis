/**
 * appendIrisBeliefRevised unit tests — Phase 17 Wave 4 IRIS-TEST-05.
 *
 * Covers:
 *  - Happy path: valid 4-key payload commits and returns audit entry.
 *  - Closed-tuple rejection: missing key, extra key → TypeError.
 *  - Self-report invariant: payload.nous_did !== actorDid → TypeError.
 *  - Tick validation: negative tick → TypeError.
 *  - DID validation: invalid target_did → TypeError.
 *  - Hash format: invalid belief_hash (not 64-char hex) → TypeError.
 *  - Privacy gate: clean payload passes (belt-and-suspenders gate present).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import {
    appendIrisBeliefRevised,
    HEX64_RE,
} from '../../src/iris/appendIrisBeliefRevised.js';
import type { IrisBeliefRevisedPayload } from '../../src/iris/types.js';
import { IRIS_BELIEF_REVISED_KEYS } from '../../src/iris/types.js';

const NOUS_DID = 'did:noesis:alpha';
const TARGET_DID = 'did:noesis:beta';
const BELIEF_HASH = 'a'.repeat(64);  // 64-char lowercase hex (sha256 length)

const happy: IrisBeliefRevisedPayload = {
    nous_did: NOUS_DID,
    tick: 42,
    target_did: TARGET_DID,
    belief_hash: BELIEF_HASH,
};

describe('appendIrisBeliefRevised — Phase 17 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends well-formed payload and returns audit entry', () => {
        const entry = appendIrisBeliefRevised(chain, NOUS_DID, happy);
        expect(entry.eventType).toBe('iris.belief_revised');
        expect(entry.actorDid).toBe(NOUS_DID);
        const p = entry.payload as Record<string, unknown>;
        expect(Object.keys(p).sort()).toEqual([...IRIS_BELIEF_REVISED_KEYS].sort());
        expect(p.belief_hash).toBe(BELIEF_HASH);
        expect(p.target_did).toBe(TARGET_DID);
        expect(p.tick).toBe(42);
    });

    it('commits to the chain (length increments)', () => {
        expect(chain.length).toBe(0);
        appendIrisBeliefRevised(chain, NOUS_DID, happy);
        expect(chain.length).toBe(1);
    });

    it('rejects missing key (3-key payload — no belief_hash)', () => {
        const bad = { nous_did: NOUS_DID, tick: 1, target_did: TARGET_DID } as any;
        expect(() => appendIrisBeliefRevised(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects extra key (closed-tuple enforcement)', () => {
        const bad = { ...happy, extra: 'oops' } as any;
        expect(() => appendIrisBeliefRevised(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects mismatched nous_did (self-report invariant)', () => {
        const bad = { ...happy, nous_did: 'did:noesis:other' };
        expect(() => appendIrisBeliefRevised(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const bad = { ...happy, tick: -1 };
        expect(() => appendIrisBeliefRevised(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects invalid target_did (not a DID)', () => {
        const bad = { ...happy, target_did: 'not-a-did' };
        expect(() => appendIrisBeliefRevised(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects invalid belief_hash (not 64-char hex)', () => {
        const bad = { ...happy, belief_hash: 'not-hex' };
        expect(() => appendIrisBeliefRevised(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('rejects 32-char hash (must be 64-char sha256 hexdigest)', () => {
        const bad = { ...happy, belief_hash: 'a'.repeat(32) };
        expect(() => appendIrisBeliefRevised(chain, NOUS_DID, bad)).toThrow(TypeError);
    });

    it('accepts tick=0 (boundary)', () => {
        const entry = appendIrisBeliefRevised(chain, NOUS_DID, { ...happy, tick: 0 });
        expect(entry).toBeDefined();
    });

    it('privacy gate passes on clean payload (belt-and-suspenders)', () => {
        // The privacy gate (payloadPrivacyCheck) is invoked on cleanPayload.
        // A correctly-formed payload with no forbidden keys must pass.
        const entry = appendIrisBeliefRevised(chain, NOUS_DID, happy);
        expect(entry).toBeDefined();
    });

    it('IRIS_BELIEF_REVISED_KEYS is sorted alphabetically', () => {
        const sorted = [...IRIS_BELIEF_REVISED_KEYS].sort();
        expect([...IRIS_BELIEF_REVISED_KEYS]).toEqual(sorted);
    });

    it('HEX64_RE matches 64-char lowercase hex', () => {
        expect(HEX64_RE.test('a'.repeat(64))).toBe(true);
        expect(HEX64_RE.test('0'.repeat(64))).toBe(true);
        expect(HEX64_RE.test('a'.repeat(63))).toBe(false);
        expect(HEX64_RE.test('A'.repeat(64))).toBe(false);  // uppercase fails
        expect(HEX64_RE.test('g'.repeat(64))).toBe(false);  // non-hex fails
    });
});
