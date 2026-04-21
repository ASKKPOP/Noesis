/**
 * Phase 6 Plan 04 Task 1 — LogosEngine.amendLaw() replace-in-place.
 *
 * D-18: amendLaw mutates an existing law with identity preserved. Returns the
 * amended law or undefined if the id is unknown. Type-level guarantee that id
 * cannot change via amend (`Partial<Omit<Law, 'id'>>`); runtime re-sets id
 * defensively in case a caller casts around the type.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LogosEngine } from '../../src/logos/engine.js';
import type { Law } from '../../src/logos/types.js';

function makeLaw(id: string, overrides: Partial<Law> = {}): Law {
    return {
        id,
        title: `Law ${id}`,
        description: `Test law ${id}`,
        ruleLogic: {
            condition: { type: 'true' },
            action: 'allow',
            sanction_on_violation: 'warning',
        },
        severity: 'minor',
        status: 'active',
        ...overrides,
    };
}

describe('LogosEngine.amendLaw (D-18)', () => {
    let engine: LogosEngine;

    beforeEach(() => {
        engine = new LogosEngine();
    });

    it('amends an existing law in place and returns the amended law', () => {
        engine.addLaw(makeLaw('law.1', { title: 'Original' }));
        const amended = engine.amendLaw('law.1', { title: 'Amended' });
        expect(amended).toBeDefined();
        expect(amended!.title).toBe('Amended');
        expect(engine.getLaw('law.1')?.title).toBe('Amended');
    });

    it('preserves law id even if a caller attempts to override it via a cast', () => {
        engine.addLaw(makeLaw('law.1'));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const amended = engine.amendLaw('law.1', { id: 'law.999' } as any);
        expect(amended?.id).toBe('law.1');
        expect(engine.getLaw('law.1')).toBeDefined();
        expect(engine.getLaw('law.999')).toBeUndefined();
    });

    it('returns undefined for a non-existent law without side-effect', () => {
        const result = engine.amendLaw('law.nonexistent', { title: 'x' });
        expect(result).toBeUndefined();
        expect(engine.getLaw('law.nonexistent')).toBeUndefined();
    });

    it('preserves unmentioned fields (spread semantics)', () => {
        const original = makeLaw('law.2', {
            title: 'Original',
            description: 'Original description',
            severity: 'major',
            status: 'active',
        });
        engine.addLaw(original);
        const amended = engine.amendLaw('law.2', { title: 'New Title' });
        expect(amended).toEqual({
            ...original,
            title: 'New Title',
        });
    });
});
