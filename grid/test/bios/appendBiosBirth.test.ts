/**
 * Phase 10b Wave 0 RED stub — BIOS-02 appendBiosBirth sole producer.
 *
 * Clones grid/test/ananke/append-drive-crossed.test.ts shape with renames.
 * References `../../src/bios/appendBiosBirth.js` which does not exist at
 * Wave 0 ⇒ unresolved import = RED.
 *
 * Wave 2 (Plan 10b-03) creates the production module ⇒ GREEN.
 *
 * Closed 3-key payload (D-10b-04):
 *   { did, psyche_hash, tick }
 *
 * Guards:
 *   - DID_RE on actorDid + payload.did
 *   - HEX64_RE on psyche_hash
 *   - tick non-negative integer
 *   - self-report invariant (actorDid === payload.did)
 *   - Object.keys(payload).sort() strict-equality (no extra/missing keys)
 *   - payloadPrivacyCheck rejects energy/sustenance/need_value/bios_value
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import {
    appendBiosBirth,
    DID_RE,
    HEX64_RE,
} from '../../src/bios/appendBiosBirth.js';
import type { BiosBirthPayload } from '../../src/bios/types.js';

const DID = 'did:noesis:alpha';
const PSYCHE_HASH = 'a'.repeat(64);

const happy: BiosBirthPayload = {
    did: DID,
    psyche_hash: PSYCHE_HASH,
    tick: 100,
};

const EXPECTED_BIRTH_KEYS = ['did', 'psyche_hash', 'tick'] as const;

describe('appendBiosBirth — BIOS-02 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    describe('happy path', () => {
        it('appends a well-formed birth event', () => {
            const entry = appendBiosBirth(chain, DID, happy);
            expect(entry.eventType).toBe('bios.birth');
            expect(entry.actorDid).toBe(DID);
            const payload = entry.payload as Record<string, unknown>;
            expect(Object.keys(payload).sort()).toEqual([...EXPECTED_BIRTH_KEYS].sort());
            expect(payload.did).toBe(DID);
            expect(payload.psyche_hash).toBe(PSYCHE_HASH);
            expect(payload.tick).toBe(100);
        });

        it('commits to the chain (length increments, hash advances)', () => {
            const before = chain.head;
            appendBiosBirth(chain, DID, happy);
            expect(chain.length).toBe(1);
            expect(chain.head).not.toBe(before);
        });
    });

    describe('closed-tuple rejection', () => {
        it('rejects missing key (2-key payload — psyche_hash absent)', () => {
            const bad = { did: DID, tick: 1 } as unknown as BiosBirthPayload;
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/unexpected key set|missing/);
        });

        it('rejects extra innocuous key (4-key payload — extra)', () => {
            const bad = { ...happy, extra: 1 } as unknown as BiosBirthPayload;
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/unexpected key set/);
        });

        it('rejects extra forbidden key — energy float', () => {
            const bad = { ...happy, energy: 0.5 } as unknown as BiosBirthPayload;
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/unexpected key set|privacy violation/);
        });

        it('rejects extra forbidden key — bios_value', () => {
            const bad = { ...happy, bios_value: 0.5 } as unknown as BiosBirthPayload;
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/unexpected key set|privacy violation/);
        });
    });

    describe('DID regex + self-report invariant', () => {
        it('rejects malformed actorDid', () => {
            expect(() => appendBiosBirth(chain, 'alpha', happy))
                .toThrow(/invalid actorDid/);
        });

        it('rejects empty payload.did', () => {
            const bad = { ...happy, did: '' } as unknown as BiosBirthPayload;
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/invalid payload\.did/);
        });

        it('rejects mismatched DIDs (self-report invariant)', () => {
            expect(() => appendBiosBirth(chain, DID, { ...happy, did: 'did:noesis:beta' }))
                .toThrow(/self-report invariant/);
        });

        it('DID_RE matches valid DIDs', () => {
            expect(DID_RE.test('did:noesis:alpha')).toBe(true);
            expect(DID_RE.test('did:noesis:a-b_c9')).toBe(true);
            expect(DID_RE.test('not-a-did')).toBe(false);
        });
    });

    describe('psyche_hash HEX64 validation', () => {
        it('rejects non-hex psyche_hash', () => {
            const bad = { ...happy, psyche_hash: 'g'.repeat(64) };
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/invalid psyche_hash/);
        });

        it('rejects short psyche_hash (63 chars)', () => {
            const bad = { ...happy, psyche_hash: 'a'.repeat(63) };
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/invalid psyche_hash/);
        });

        it('rejects uppercase psyche_hash', () => {
            const bad = { ...happy, psyche_hash: 'A'.repeat(64) };
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/invalid psyche_hash/);
        });

        it('HEX64_RE matches lowercase 64-hex', () => {
            expect(HEX64_RE.test('a'.repeat(64))).toBe(true);
            expect(HEX64_RE.test('A'.repeat(64))).toBe(false);
        });
    });

    describe('tick validation', () => {
        it('rejects negative tick', () => {
            const bad = { ...happy, tick: -1 };
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/tick must be non-negative integer/);
        });

        it('rejects non-integer tick', () => {
            const bad = { ...happy, tick: 1.5 };
            expect(() => appendBiosBirth(chain, DID, bad))
                .toThrow(/tick must be non-negative integer/);
        });

        it('accepts tick 0 (boundary)', () => {
            expect(() => appendBiosBirth(chain, DID, { ...happy, tick: 0 }))
                .not.toThrow();
        });
    });
});
