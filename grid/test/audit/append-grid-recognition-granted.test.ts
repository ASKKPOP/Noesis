/**
 * Phase 36 Wave 0 — append-grid-recognition-granted sole-producer test.
 *
 * Event: grid.recognition_granted
 * Keys (alphabetical): grid_name, granted_at_tick, nous_did
 * Actor: nous_did
 *
 * Tests fail RED until Plan 04 creates grid/src/audit/append-grid-recognition-granted.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendGridRecognitionGranted } from '../../src/audit/append-grid-recognition-granted.js';

const VALID_NOUS_DID = 'did:noesis:nous:zX9';
const GRID_NAME = 'genesis';

function makeChain(): AuditChain {
    return new AuditChain();
}

function validPayload() {
    return {
        grid_name: GRID_NAME,
        granted_at_tick: 10,
        nous_did: VALID_NOUS_DID,
    };
}

describe('appendGridRecognitionGranted — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is a primitive (boolean)', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), true as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when grid_name is not a non-empty string', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                ...validPayload(),
                grid_name: '',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when grid_name is not a string', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                ...validPayload(),
                grid_name: 42 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when granted_at_tick is negative (-1)', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                ...validPayload(),
                granted_at_tick: -1,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when granted_at_tick is a float (1.5)', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                ...validPayload(),
                granted_at_tick: 1.5,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when granted_at_tick is NaN', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                ...validPayload(),
                granted_at_tick: NaN,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when nous_did fails DID_RE', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                ...validPayload(),
                nous_did: 'not-a-valid-did',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when nous_did is not a string', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                ...validPayload(),
                nous_did: 123 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when extra key is present', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                ...validPayload(),
                extra_field: 'nope',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when a required key is missing', () => {
        const { nous_did: _omit, ...rest } = validPayload();
        expect(() =>
            appendGridRecognitionGranted(makeChain(), rest as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when key has wrong name', () => {
        expect(() =>
            appendGridRecognitionGranted(makeChain(), {
                grid_name: GRID_NAME,
                granted_tick: 10,   // wrong name
                nous_did: VALID_NOUS_DID,
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendGridRecognitionGranted — happy path', () => {
    it('returns AuditEntry with eventType === grid.recognition_granted and actorDid === nous_did', () => {
        const chain = makeChain();
        const entry = appendGridRecognitionGranted(chain, validPayload());
        expect(entry.eventType).toBe('grid.recognition_granted');
        expect(entry.actorDid).toBe(VALID_NOUS_DID);
    });

    it('accepts tick=0 (boundary)', () => {
        const chain = makeChain();
        const entry = appendGridRecognitionGranted(chain, { ...validPayload(), granted_at_tick: 0 });
        expect(entry.eventType).toBe('grid.recognition_granted');
    });
});
