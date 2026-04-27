/**
 * GREEN tests for canonicalStringify (REPLAY-01 canonical-JSON serializer).
 *
 * These tests assert byte-stability under key-order permutations, recursion,
 * array preservation, whitespace-freedom, cycle detection, and type rejection.
 *
 * The serializer is the substrate of the entire tarball determinism contract.
 * Any nondeterminism here propagates to every hash comparison in Phase 13.
 *
 * See: 13-RESEARCH.md §Pattern 7, §Don't Hand-Roll, grid/src/export/canonical-json.ts.
 */

import { describe, it, expect } from 'vitest';
import { canonicalStringify } from '../../src/export/canonical-json.js';

describe('canonicalStringify', () => {
    it('key-order permutation invariant — two objects same keys different insertion order', () => {
        const a = canonicalStringify({ b: 1, a: 2 });
        const b = canonicalStringify({ a: 2, b: 1 });
        expect(a).toBe(b);
        expect(a).toBe('{"a":2,"b":1}');
    });

    it('three permutations of same 3-key object produce identical strings', () => {
        const obj1 = { z: 3, a: 1, m: 2 };
        const obj2 = { a: 1, m: 2, z: 3 };
        const obj3 = { m: 2, z: 3, a: 1 };
        const s1 = canonicalStringify(obj1);
        const s2 = canonicalStringify(obj2);
        const s3 = canonicalStringify(obj3);
        expect(s1).toBe(s2);
        expect(s2).toBe(s3);
        expect(s1).toBe('{"a":1,"m":2,"z":3}');
    });

    it('recursive key-sort at every depth — nested objects with different key orders', () => {
        const deep1 = { a: { z: 1, y: 2 }, b: { q: 'x', p: 9 } };
        const deep2 = { b: { p: 9, q: 'x' }, a: { y: 2, z: 1 } };
        expect(canonicalStringify(deep1)).toBe(canonicalStringify(deep2));
        expect(canonicalStringify(deep1)).toBe('{"a":{"y":2,"z":1},"b":{"p":9,"q":"x"}}');
    });

    it('array order is PRESERVED — arrays are not sorted', () => {
        expect(canonicalStringify([3, 1, 2])).toBe('[3,1,2]');
        expect(canonicalStringify([1, 3, 2])).toBe('[1,3,2]');
        // Arrays with same elements in different order produce different strings
        expect(canonicalStringify([3, 1, 2])).not.toBe(canonicalStringify([1, 3, 2]));
    });

    it('no whitespace in output — regex /^[^\\s]*$/ matches', () => {
        const outputs = [
            canonicalStringify({ a: 1, b: 'hi', c: [1, 2] }),
            canonicalStringify({ nested: { x: 1, y: 2 } }),
            canonicalStringify([1, 'two', true, null]),
        ];
        for (const out of outputs) {
            expect(out).toMatch(/^[^\s]*$/);
        }
    });

    it('primitives serialized correctly', () => {
        expect(canonicalStringify(null)).toBe('null');
        expect(canonicalStringify(true)).toBe('true');
        expect(canonicalStringify(false)).toBe('false');
        expect(canonicalStringify(0)).toBe('0');
        expect(canonicalStringify(-1)).toBe('-1');
        expect(canonicalStringify('hello world')).toBe('"hello world"');
    });

    it('cycle detection — object with self-reference throws TypeError', () => {
        const a: Record<string, unknown> = {};
        a.self = a;
        expect(() => canonicalStringify(a)).toThrow(TypeError);
        expect(() => canonicalStringify(a)).toThrow(/cycle/i);
    });

    it('cycle detection — array with self-reference throws TypeError', () => {
        const arr: unknown[] = [1, 2];
        arr.push(arr);
        expect(() => canonicalStringify(arr)).toThrow(TypeError);
        expect(() => canonicalStringify(arr)).toThrow(/cycle/i);
    });

    it('undefined throws TypeError', () => {
        expect(() => canonicalStringify(undefined)).toThrow(TypeError);
        expect(() => canonicalStringify(undefined)).toThrow(/unsupported type undefined/);
    });

    it('function throws TypeError', () => {
        expect(() => canonicalStringify(() => 1)).toThrow(TypeError);
        expect(() => canonicalStringify(() => 1)).toThrow(/unsupported type function/);
    });

    it('symbol throws TypeError', () => {
        expect(() => canonicalStringify(Symbol('test'))).toThrow(TypeError);
        expect(() => canonicalStringify(Symbol('test'))).toThrow(/unsupported type symbol/);
    });

    it('BigInt throws TypeError', () => {
        expect(() => canonicalStringify(BigInt(42))).toThrow(TypeError);
        expect(() => canonicalStringify(BigInt(42))).toThrow(/unsupported type bigint/);
    });

    it('numeric stability — same value serialized 3 times produces identical strings', () => {
        const obj = { n: 0.1 + 0.2, x: 1 / 3 };
        const s1 = canonicalStringify(obj);
        const s2 = canonicalStringify(obj);
        const s3 = canonicalStringify(obj);
        expect(s1).toBe(s2);
        expect(s2).toBe(s3);
    });
});
