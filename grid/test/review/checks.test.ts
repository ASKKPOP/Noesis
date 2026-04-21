import { describe, it, expect, beforeEach } from 'vitest';
import {
    CHECKS,
    CHECK_ORDER,
    registerCheck,
    clearRegistryForTesting,
} from '../../src/review/registry.js';
import type { Check } from '../../src/review/types.js';

describe('review/registry: registerCheck + CHECKS + CHECK_ORDER', () => {
    beforeEach(() => {
        clearRegistryForTesting();
    });

    it('registerCheck adds the name to CHECKS and pushes to CHECK_ORDER', () => {
        const handler: Check = () => ({ ok: true });
        registerCheck('insufficient_balance', handler);
        expect(CHECKS.size).toBe(1);
        expect(CHECKS.get('insufficient_balance')).toBe(handler);
        expect(CHECK_ORDER).toEqual(['insufficient_balance']);
    });

    it('duplicate registerCheck call throws with /already registered/i', () => {
        const handler: Check = () => ({ ok: true });
        registerCheck('insufficient_balance', handler);
        expect(() => registerCheck('insufficient_balance', handler)).toThrow(/already registered/i);
    });

    it('CHECK_ORDER.length always equals CHECKS.size', () => {
        registerCheck('insufficient_balance', () => ({ ok: true }));
        registerCheck('invalid_counterparty_did', () => ({ ok: true }));
        expect(CHECK_ORDER.length).toBe(CHECKS.size);
        expect(CHECK_ORDER.length).toBe(2);
    });

    // Task 3 of this plan will add a test here that side-effect-imports the 5 check files
    // and asserts CHECKS.size === 5. Deferred because check files don't yet exist.
});
