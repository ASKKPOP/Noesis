/**
 * Phase 28 SPAWN-04 — appendNousSpawnedByHuman sole-producer invariants
 *
 * TDD RED scaffold — tests reference contracts that Plan 01 must implement.
 * Tests will FAIL until grid/src/audit/append-nous-spawned-by-human.ts is created.
 *
 * Test matrix:
 *   Happy path:
 *     - emits event with type 'nous.spawned_by_human'
 *     - sets actorDid to nous_did (sole-producer invariant)
 *     - emitted payload contains exactly 4 keys: grid_name, nous_did, owner_human_did, tick
 *   Type guards:
 *     - throws TypeError when payload is null
 *     - throws TypeError when payload is undefined
 *     - throws TypeError when payload is an array
 *   DID validation:
 *     - throws TypeError when nous_did fails DID_RE ('not-a-did', 'did:other:foo', '', 'did:noesis:')
 *     - throws TypeError when owner_human_did fails DID_RE
 *   Field guards:
 *     - throws TypeError when grid_name is empty string
 *     - throws TypeError when grid_name is not a string (number)
 *     - throws TypeError when tick is negative
 *     - throws TypeError when tick is a float (1.5)
 *   Closed-tuple invariant:
 *     - throws TypeError when extra key is present
 *     - throws TypeError when required key is missing
 *   Privacy guard:
 *     - throws TypeError when payload contains privacy-violating key ('content')
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import {
    appendNousSpawnedByHuman,
    type NousSpawnedByHumanPayload,
} from '../../src/audit/append-nous-spawned-by-human.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_PAYLOAD: NousSpawnedByHumanPayload = {
    grid_name: 'genesis',
    nous_did: 'did:noesis:human-nous:0xabcd12-eidolon',
    owner_human_did: 'did:noesis:human:0xabcd1234abcd1234abcd1234abcd1234abcd1234',
    tick: 1000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('appendNousSpawnedByHuman', () => {
    let chain: AuditChain;

    beforeEach(() => {
        chain = new AuditChain();
    });

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    describe('happy path', () => {
        it('appends an entry with eventType nous.spawned_by_human', () => {
            const entry = appendNousSpawnedByHuman(chain, VALID_PAYLOAD);
            expect(entry.eventType).toBe('nous.spawned_by_human');
        });

        it('sets actorDid to nous_did (sole-producer invariant)', () => {
            const entry = appendNousSpawnedByHuman(chain, VALID_PAYLOAD);
            expect(entry.actorDid).toBe(VALID_PAYLOAD.nous_did);
        });

        it('emits payload with exactly EXPECTED_KEYS (grid_name, nous_did, owner_human_did, tick)', () => {
            const entry = appendNousSpawnedByHuman(chain, VALID_PAYLOAD);
            const keys = Object.keys(entry.payload as object).sort();
            expect(keys).toEqual(['grid_name', 'nous_did', 'owner_human_did', 'tick']);
        });

        it('payload grid_name matches input', () => {
            const entry = appendNousSpawnedByHuman(chain, VALID_PAYLOAD);
            expect((entry.payload as NousSpawnedByHumanPayload).grid_name).toBe('genesis');
        });

        it('payload tick matches input', () => {
            const entry = appendNousSpawnedByHuman(chain, VALID_PAYLOAD);
            expect((entry.payload as NousSpawnedByHumanPayload).tick).toBe(1000);
        });
    });

    // -------------------------------------------------------------------------
    // Type guards (null / undefined / array)
    // -------------------------------------------------------------------------

    describe('type guards', () => {
        it('throws TypeError when payload is null', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, null as any),
            ).toThrow(TypeError);
        });

        it('throws TypeError when payload is undefined', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, undefined as any),
            ).toThrow(TypeError);
        });

        it('throws TypeError when payload is an array', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, [] as any),
            ).toThrow(TypeError);
        });

        it('throws TypeError when payload is a primitive string', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, 'invalid' as any),
            ).toThrow(TypeError);
        });
    });

    // -------------------------------------------------------------------------
    // DID validation
    // -------------------------------------------------------------------------

    describe('DID validation', () => {
        it.each([
            ['not-a-did'],
            ['did:other:foo'],
            [''],
            ['did:noesis:'],
        ])('throws TypeError when nous_did=%s fails DID_RE', (bad) => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, nous_did: bad }),
            ).toThrow(TypeError);
        });

        it('throws TypeError when owner_human_did fails DID_RE (not-a-did)', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, owner_human_did: 'not-a-did' }),
            ).toThrow(TypeError);
        });

        it('throws TypeError when owner_human_did is empty string', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, owner_human_did: '' }),
            ).toThrow(TypeError);
        });
    });

    // -------------------------------------------------------------------------
    // Field guards
    // -------------------------------------------------------------------------

    describe('field guards', () => {
        it('throws TypeError when grid_name is empty string', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, grid_name: '' }),
            ).toThrow(TypeError);
        });

        it('throws TypeError when grid_name is not a string (number)', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, grid_name: 42 as any }),
            ).toThrow(TypeError);
        });

        it('throws TypeError when tick is negative', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, tick: -1 }),
            ).toThrow(TypeError);
        });

        it('throws TypeError when tick is a float (1.5)', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, tick: 1.5 }),
            ).toThrow(TypeError);
        });

        it('throws TypeError when tick is not a number (string)', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, tick: '1000' as any }),
            ).toThrow(TypeError);
        });
    });

    // -------------------------------------------------------------------------
    // Closed-tuple invariant
    // -------------------------------------------------------------------------

    describe('closed-tuple invariant', () => {
        it('throws when an extra key is present (unexpected key set)', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, extra: 'value' } as any),
            ).toThrow(/unexpected key set/);
        });

        it('throws TypeError when required key tick is missing', () => {
            const { tick: _t, ...partial } = VALID_PAYLOAD;
            expect(() =>
                appendNousSpawnedByHuman(chain, partial as any),
            ).toThrow(TypeError);
        });

        it('throws TypeError when required key grid_name is missing', () => {
            const { grid_name: _g, ...partial } = VALID_PAYLOAD;
            expect(() =>
                appendNousSpawnedByHuman(chain, partial as any),
            ).toThrow(TypeError);
        });
    });

    // -------------------------------------------------------------------------
    // Privacy guard — payloadPrivacyCheck integration
    // -------------------------------------------------------------------------

    describe('privacy guard', () => {
        it('throws TypeError when payload contains privacy-violating key (content)', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, content: 'leak' } as any),
            ).toThrow(TypeError);
        });

        it('throws TypeError when payload contains privacy-violating key (prompt)', () => {
            expect(() =>
                appendNousSpawnedByHuman(chain, { ...VALID_PAYLOAD, prompt: 'leak' } as any),
            ).toThrow(TypeError);
        });
    });
});
