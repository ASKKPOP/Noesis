/**
 * Phase 36 Wave 0 — append-grid-recognition-revoked sole-producer test.
 *
 * Event: grid.recognition_revoked
 * Keys (alphabetical): grid_name, nous_did, revoked_at_tick
 * Actor: nous_did
 *
 * Tests fail RED until Plan 04 creates grid/src/audit/append-grid-recognition-revoked.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendGridRecognitionRevoked } from '../../src/audit/append-grid-recognition-revoked.js';

const VALID_NOUS_DID = 'did:noesis:nous:zX9';
const GRID_NAME = 'genesis';

function makeChain(): AuditChain {
    return new AuditChain();
}

function validPayload() {
    return {
        grid_name: GRID_NAME,
        nous_did: VALID_NOUS_DID,
        revoked_at_tick: 55,
    };
}

describe('appendGridRecognitionRevoked — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is a primitive (string)', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), 'bad' as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when grid_name is empty string', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                ...validPayload(),
                grid_name: '',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when grid_name is not a string', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                ...validPayload(),
                grid_name: 99 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when nous_did fails DID_RE', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                ...validPayload(),
                nous_did: 'bad-did',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when nous_did is not a string', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                ...validPayload(),
                nous_did: 0 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when revoked_at_tick is negative (-1)', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                ...validPayload(),
                revoked_at_tick: -1,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when revoked_at_tick is a float (1.5)', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                ...validPayload(),
                revoked_at_tick: 1.5,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when revoked_at_tick is NaN', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                ...validPayload(),
                revoked_at_tick: NaN,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when extra key is present', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                ...validPayload(),
                extra: 'nope',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when a required key is missing', () => {
        const { grid_name: _omit, ...rest } = validPayload();
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), rest as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when key has wrong name', () => {
        expect(() =>
            appendGridRecognitionRevoked(makeChain(), {
                grid: GRID_NAME,   // wrong name
                nous_did: VALID_NOUS_DID,
                revoked_at_tick: 55,
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendGridRecognitionRevoked — happy path', () => {
    it('returns AuditEntry with eventType === grid.recognition_revoked and actorDid === nous_did', () => {
        const chain = makeChain();
        const entry = appendGridRecognitionRevoked(chain, validPayload());
        expect(entry.eventType).toBe('grid.recognition_revoked');
        expect(entry.actorDid).toBe(VALID_NOUS_DID);
    });

    it('accepts tick=0 (boundary)', () => {
        const chain = makeChain();
        const entry = appendGridRecognitionRevoked(chain, { ...validPayload(), revoked_at_tick: 0 });
        expect(entry.eventType).toBe('grid.recognition_revoked');
    });
});
