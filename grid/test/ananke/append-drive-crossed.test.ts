/**
 * Phase 10a DRIVE-03 — unit tests for appendAnankeDriveCrossed sole producer.
 *
 * Covers:
 *  - Happy path (rising + falling directions).
 *  - Closed-tuple rejection (missing / extra keys).
 *  - Closed-enum rejection (drive / level / direction).
 *  - DID regex + self-report invariant.
 *  - Tick integer/non-negative validation.
 *  - Privacy pattern belt-and-suspenders (regression).
 *
 * Matches the test discipline of grid/test/audit/telos-refined-privacy.test.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import {
    appendAnankeDriveCrossed,
    DID_RE,
} from '../../src/ananke/append-drive-crossed.js';
import type { AnankeDriveCrossedPayload } from '../../src/ananke/types.js';

const DID = 'did:noesis:alpha';

const happyRising: AnankeDriveCrossedPayload = {
    did: DID,
    tick: 100,
    drive: 'hunger',
    level: 'med',
    direction: 'rising',
};

const happyFalling: AnankeDriveCrossedPayload = {
    did: DID,
    tick: 200,
    drive: 'curiosity',
    level: 'low',
    direction: 'falling',
};

describe('appendAnankeDriveCrossed — DRIVE-03 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    describe('happy path', () => {
        it('appends a well-formed rising crossing', () => {
            const entry = appendAnankeDriveCrossed(chain, DID, happyRising);
            expect(entry.eventType).toBe('ananke.drive_crossed');
            expect(entry.actorDid).toBe(DID);
            const payload = entry.payload as Record<string, unknown>;
            expect(Object.keys(payload).sort()).toEqual(
                ['did', 'direction', 'drive', 'level', 'tick'],
            );
            expect(payload.did).toBe(DID);
            expect(payload.tick).toBe(100);
            expect(payload.drive).toBe('hunger');
            expect(payload.level).toBe('med');
            expect(payload.direction).toBe('rising');
        });

        it('appends a well-formed falling crossing', () => {
            const entry = appendAnankeDriveCrossed(chain, DID, happyFalling);
            expect(entry.eventType).toBe('ananke.drive_crossed');
            expect((entry.payload as Record<string, unknown>).direction).toBe('falling');
        });

        it('commits to the chain (length increments, hash advances)', () => {
            const before = chain.head;
            appendAnankeDriveCrossed(chain, DID, happyRising);
            expect(chain.length).toBe(1);
            expect(chain.head).not.toBe(before);
        });

        it.each(['hunger', 'curiosity', 'safety', 'boredom', 'loneliness'] as const)(
            'accepts drive enum member %s',
            (drive) => {
                expect(() =>
                    appendAnankeDriveCrossed(chain, DID, { ...happyRising, drive }),
                ).not.toThrow();
            },
        );

        it.each(['low', 'med', 'high'] as const)('accepts level enum member %s', (level) => {
            expect(() =>
                appendAnankeDriveCrossed(chain, DID, { ...happyRising, level }),
            ).not.toThrow();
        });
    });

    describe('closed-tuple rejection', () => {
        it('rejects missing key (4-key payload)', () => {
            const bad = { did: DID, tick: 1, drive: 'hunger', level: 'med' } as unknown as AnankeDriveCrossedPayload;
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/unexpected key set|unknown direction/);
        });

        it('rejects extra innocuous key (6-key payload — raw)', () => {
            const bad = { ...happyRising, raw: 0.34 } as unknown as AnankeDriveCrossedPayload;
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/unexpected key set/);
        });

        it('rejects extra forbidden key — drive_value', () => {
            const bad = { ...happyRising, drive_value: 0.5 } as unknown as AnankeDriveCrossedPayload;
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/unexpected key set|privacy violation/);
        });

        it('rejects extra forbidden key — hunger float', () => {
            const bad = { ...happyRising, hunger: 0.5 } as unknown as AnankeDriveCrossedPayload;
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/unexpected key set|privacy violation/);
        });
    });

    describe('closed-enum rejection', () => {
        it('rejects unknown drive — energy', () => {
            const bad = { ...happyRising, drive: 'energy' } as unknown as AnankeDriveCrossedPayload;
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/unknown drive/);
        });

        it('rejects unknown level — medium (must be abbreviated med)', () => {
            const bad = { ...happyRising, level: 'medium' } as unknown as AnankeDriveCrossedPayload;
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/unknown level.*low\|med\|high/);
        });

        it('rejects unknown direction — stable (stable is UI-only)', () => {
            const bad = { ...happyRising, direction: 'stable' } as unknown as AnankeDriveCrossedPayload;
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/unknown direction/);
        });
    });

    describe('DID regex + self-report invariant', () => {
        it('rejects malformed actorDid (no prefix)', () => {
            expect(() => appendAnankeDriveCrossed(chain, 'alpha', happyRising))
                .toThrow(/invalid actorDid/);
        });

        it('rejects DID with spaces', () => {
            expect(() => appendAnankeDriveCrossed(chain, 'did:noesis:al pha', { ...happyRising, did: 'did:noesis:al pha' }))
                .toThrow(/invalid actorDid/);
        });

        it('rejects empty payload.did', () => {
            const bad = { ...happyRising, did: '' } as unknown as AnankeDriveCrossedPayload;
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/invalid payload\.did/);
        });

        it('rejects mismatched DIDs (self-report invariant)', () => {
            expect(() => appendAnankeDriveCrossed(chain, DID, { ...happyRising, did: 'did:noesis:beta' }))
                .toThrow(/self-report invariant/);
        });

        it('DID_RE matches valid DIDs', () => {
            expect(DID_RE.test('did:noesis:alpha')).toBe(true);
            expect(DID_RE.test('did:noesis:a-b_c9')).toBe(true);
            expect(DID_RE.test('not-a-did')).toBe(false);
        });
    });

    describe('tick validation', () => {
        it('rejects negative tick', () => {
            const bad = { ...happyRising, tick: -1 };
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/tick must be non-negative integer/);
        });

        it('rejects non-integer tick', () => {
            const bad = { ...happyRising, tick: 1.5 };
            expect(() => appendAnankeDriveCrossed(chain, DID, bad))
                .toThrow(/tick must be non-negative integer/);
        });

        it('accepts tick 0 (boundary)', () => {
            expect(() => appendAnankeDriveCrossed(chain, DID, { ...happyRising, tick: 0 }))
                .not.toThrow();
        });
    });
});
