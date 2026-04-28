import { describe, it, expect } from 'vitest';
import { makeRigSchemaName } from '../../src/rig/types.js';

describe('Rig schema name (D-14-01)', () => {
    it('matches /^rig_[a-z0-9-]+_[0-9a-f]{8}$/', () => {
        const name = makeRigSchemaName('bench-50', 'd4e5f6a7b8c9d0e1');
        expect(name).toBe('rig_bench-50_d4e5f6a7');
        expect(name).toMatch(/^rig_[a-z0-9-]+_[0-9a-f]{8}$/);
    });

    it('is deterministic (same inputs → same output)', () => {
        const a = makeRigSchemaName('small', 'abcdef0123456789');
        const b = makeRigSchemaName('small', 'abcdef0123456789');
        expect(a).toBe(b);
    });

    it('rejects uppercase config names', () => {
        expect(() => makeRigSchemaName('Bench50', 'abcdef01')).toThrow();
    });

    it('rejects seeds shorter than 8 chars', () => {
        expect(() => makeRigSchemaName('bench', 'abc')).toThrow();
    });
});
