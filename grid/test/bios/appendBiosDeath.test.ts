/**
 * Phase 10b Wave 0 RED stub — BIOS-03 + BIOS-04 appendBiosDeath sole producer.
 *
 * Clones grid/test/ananke/append-drive-crossed.test.ts shape with renames.
 * References `../../src/bios/appendBiosDeath.js` which does not exist at
 * Wave 0 ⇒ unresolved import = RED.
 *
 * Wave 2 (Plan 10b-03) creates the production module; Wave 3 (Plan 10b-05)
 * extends the operator H5 delete handler to call this BEFORE
 * appendNousDeleted (D-30 ordering carried into Phase 10b).
 *
 * Closed 4-key payload (D-10b-04):
 *   { cause, did, final_state_hash, tick }
 *
 * Closed cause-enum: { 'starvation', 'operator_h5', 'replay_boundary' }.
 * Forbidden siblings: 'system_shutdown', 'natural_causes', 'unknown'.
 *
 * Guards:
 *   - DID_RE on actorDid + payload.did
 *   - HEX64_RE on final_state_hash
 *   - tick non-negative integer
 *   - self-report invariant
 *   - cause is closed-enum
 *   - post-death rejection: registry.isTombstoned(did)=true ⇒ throws
 *   - Object.keys(payload).sort() strict-equality
 *   - payloadPrivacyCheck rejects energy/sustenance/need_value/bios_value
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import {
    appendBiosDeath,
    CAUSE_VALUES,
    DID_RE,
    HEX64_RE,
} from '../../src/bios/appendBiosDeath.js';
import type { BiosDeathPayload, BiosDeathCause } from '../../src/bios/types.js';

const DID = 'did:noesis:alpha';
const FINAL_HASH = 'b'.repeat(64);

const happy: BiosDeathPayload = {
    cause: 'starvation',
    did: DID,
    final_state_hash: FINAL_HASH,
    tick: 500,
};

const EXPECTED_DEATH_KEYS = ['cause', 'did', 'final_state_hash', 'tick'] as const;

describe('appendBiosDeath — BIOS-03/BIOS-04 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    describe('happy path', () => {
        it('appends a well-formed starvation death', () => {
            const entry = appendBiosDeath(chain, DID, happy);
            expect(entry.eventType).toBe('bios.death');
            expect(entry.actorDid).toBe(DID);
            const payload = entry.payload as Record<string, unknown>;
            expect(Object.keys(payload).sort()).toEqual([...EXPECTED_DEATH_KEYS].sort());
            expect(payload.cause).toBe('starvation');
            expect(payload.did).toBe(DID);
            expect(payload.final_state_hash).toBe(FINAL_HASH);
            expect(payload.tick).toBe(500);
        });

        it.each(['starvation', 'operator_h5', 'replay_boundary'] as const satisfies readonly BiosDeathCause[])(
            'accepts cause enum member %s',
            (cause) => {
                expect(() => appendBiosDeath(chain, DID, { ...happy, cause })).not.toThrow();
            },
        );

        it('CAUSE_VALUES contains exactly the 3 expected causes', () => {
            expect([...CAUSE_VALUES].sort()).toEqual(['operator_h5', 'replay_boundary', 'starvation']);
        });
    });

    describe('closed-enum cause rejection', () => {
        it.each(['system_shutdown', 'natural_causes', 'unknown', 'crash', ''])(
            'rejects forbidden cause %s',
            (cause) => {
                const bad = { ...happy, cause: cause as BiosDeathCause };
                expect(() => appendBiosDeath(chain, DID, bad))
                    .toThrow(/unknown cause|invalid cause/);
            },
        );
    });

    describe('closed-tuple rejection', () => {
        it('rejects missing key (3-key payload — cause absent)', () => {
            const bad = { did: DID, final_state_hash: FINAL_HASH, tick: 1 } as unknown as BiosDeathPayload;
            expect(() => appendBiosDeath(chain, DID, bad))
                .toThrow(/unexpected key set|missing/);
        });

        it('rejects extra innocuous key (5-key payload)', () => {
            const bad = { ...happy, extra: 1 } as unknown as BiosDeathPayload;
            expect(() => appendBiosDeath(chain, DID, bad))
                .toThrow(/unexpected key set/);
        });

        it('rejects extra forbidden key — sustenance', () => {
            const bad = { ...happy, sustenance: 0.5 } as unknown as BiosDeathPayload;
            expect(() => appendBiosDeath(chain, DID, bad))
                .toThrow(/unexpected key set|privacy violation/);
        });
    });

    describe('DID regex + self-report invariant', () => {
        it('rejects malformed actorDid', () => {
            expect(() => appendBiosDeath(chain, 'alpha', happy))
                .toThrow(/invalid actorDid/);
        });

        it('rejects mismatched DIDs', () => {
            expect(() => appendBiosDeath(chain, DID, { ...happy, did: 'did:noesis:beta' }))
                .toThrow(/self-report invariant/);
        });
    });

    describe('final_state_hash HEX64 validation', () => {
        it('rejects non-hex final_state_hash', () => {
            const bad = { ...happy, final_state_hash: 'z'.repeat(64) };
            expect(() => appendBiosDeath(chain, DID, bad))
                .toThrow(/invalid final_state_hash/);
        });

        it('rejects short final_state_hash', () => {
            const bad = { ...happy, final_state_hash: 'a'.repeat(63) };
            expect(() => appendBiosDeath(chain, DID, bad))
                .toThrow(/invalid final_state_hash/);
        });

        it('HEX64_RE matches lowercase 64-hex', () => {
            expect(HEX64_RE.test('b'.repeat(64))).toBe(true);
            expect(HEX64_RE.test('B'.repeat(64))).toBe(false);
        });
    });

    describe('tick validation', () => {
        it('rejects negative tick', () => {
            expect(() => appendBiosDeath(chain, DID, { ...happy, tick: -1 }))
                .toThrow(/tick must be non-negative integer/);
        });

        it('rejects non-integer tick', () => {
            expect(() => appendBiosDeath(chain, DID, { ...happy, tick: 1.5 }))
                .toThrow(/tick must be non-negative integer/);
        });

        it('accepts tick 0 (boundary)', () => {
            expect(() => appendBiosDeath(chain, DID, { ...happy, tick: 0 })).not.toThrow();
        });
    });

    describe('post-death rejection (BIOS-04)', () => {
        it('throws when registry.isTombstoned(did) returns true', () => {
            const isTombstoned = vi.fn().mockReturnValue(true);
            expect(() =>
                appendBiosDeath(chain, DID, happy, { isTombstoned }),
            ).toThrow(/already tombstoned|post-death|already dead/);
            expect(isTombstoned).toHaveBeenCalledWith(DID);
        });

        it('passes when registry.isTombstoned(did) returns false', () => {
            const isTombstoned = vi.fn().mockReturnValue(false);
            expect(() =>
                appendBiosDeath(chain, DID, happy, { isTombstoned }),
            ).not.toThrow();
        });
    });
});
