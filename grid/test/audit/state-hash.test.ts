import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { combineStateHash, HEX64_RE, type StateHashComponents } from '../../src/audit/state-hash.js';

const happy: StateHashComponents = {
    psyche_hash:        'a'.repeat(64),
    thymos_hash:        'b'.repeat(64),
    telos_hash:         'c'.repeat(64),
    memory_stream_hash: 'd'.repeat(64),
};

/** Pre-computed PINNED digest — SHA-256 of the canonical serialization in
 *  the LOCKED key order (psyche→thymos→telos→memory_stream). Any
 *  reordering inside combineStateHash produces a different digest and
 *  this assertion fails. See D-07. */
const LOCKED_CANONICAL = [
    '{"psyche_hash":"',        'a'.repeat(64),   '",',
    '"thymos_hash":"',         'b'.repeat(64),   '",',
    '"telos_hash":"',          'c'.repeat(64),   '",',
    '"memory_stream_hash":"',  'd'.repeat(64),   '"}',
].join('');
const EXPECTED_PINNED = createHash('sha256').update(LOCKED_CANONICAL).digest('hex');

describe('AGENCY-05 combineStateHash — LOCKED canonical composer (D-03, D-05, D-06, D-07)', () => {
    it('happy path returns 64-hex digest', () => {
        const out = combineStateHash(happy);
        expect(typeof out).toBe('string');
        expect(HEX64_RE.test(out)).toBe(true);
    });

    it('deterministic — same input → identical output (D-07 determinism)', () => {
        const a = combineStateHash(happy);
        const b = combineStateHash(happy);
        expect(a).toBe(b);
    });

    it('KEY-ORDER LOCK — digest matches pinned pre-computed value (D-07)', () => {
        // If someone reorders canonicalSerialize() to alphabetical
        // (memory_stream → psyche → telos → thymos), the digest changes
        // and this assertion fails — catching the regression.
        expect(combineStateHash(happy)).toBe(EXPECTED_PINNED);
    });

    it('caller literal key order does NOT change output (serializer enforces order)', () => {
        // Construct the object with alphabetical literal order — output
        // must STILL match the locked-order pinned digest.
        const alphabetical = {
            memory_stream_hash: 'd'.repeat(64),
            psyche_hash:        'a'.repeat(64),
            telos_hash:         'c'.repeat(64),
            thymos_hash:        'b'.repeat(64),
        } as StateHashComponents;
        expect(combineStateHash(alphabetical)).toBe(EXPECTED_PINNED);
    });

    it('rejects non-64-hex psyche_hash', () => {
        expect(() => combineStateHash({ ...happy, psyche_hash: 'nothex' } as StateHashComponents))
            .toThrow(/psyche_hash|hex64/i);
    });
    it('rejects non-64-hex thymos_hash', () => {
        expect(() => combineStateHash({ ...happy, thymos_hash: '' } as StateHashComponents))
            .toThrow(/thymos_hash|hex64/i);
    });
    it('rejects non-64-hex telos_hash', () => {
        expect(() => combineStateHash({ ...happy, telos_hash: 'Z'.repeat(64) } as StateHashComponents))
            .toThrow(/telos_hash|hex64/i);
    });
    it('rejects non-64-hex memory_stream_hash', () => {
        expect(() => combineStateHash({ ...happy, memory_stream_hash: 'a'.repeat(63) } as StateHashComponents))
            .toThrow(/memory_stream_hash|hex64/i);
    });

    it('rejects missing key (e.g. no psyche_hash)', () => {
        const { psyche_hash: _, ...rest } = happy;
        expect(() => combineStateHash(rest as unknown as StateHashComponents))
            .toThrow(/expected.*key|missing/i);
    });

    it('rejects extra key (closed tuple per D-06)', () => {
        expect(() => combineStateHash({ ...happy, extra: 'e'.repeat(64) } as unknown as StateHashComponents))
            .toThrow(/unexpected|extra/i);
    });

    it('rejects null', () => {
        expect(() => combineStateHash(null as unknown as StateHashComponents)).toThrow(TypeError);
    });
    it('rejects array', () => {
        expect(() => combineStateHash([] as unknown as StateHashComponents)).toThrow(TypeError);
    });
    it('rejects string', () => {
        expect(() => combineStateHash('abc' as unknown as StateHashComponents)).toThrow(TypeError);
    });
    it('rejects empty object', () => {
        expect(() => combineStateHash({} as StateHashComponents)).toThrow(/expected.*key|missing/i);
    });
});
