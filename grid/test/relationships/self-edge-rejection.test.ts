/**
 * Phase 9 Plan 01 Task 3 — D-9-11 self-loop rejection at canonical layer.
 *
 * The canonical-layer sortedPairKey() throws 'self-loop rejected' when
 * didA === didB. This is the Wave 0 regression gate for the invariant.
 *
 * NOTE: The listener (Wave 1) catches this throw and silently returns —
 * no audit emit, no Map write. This test only verifies the canonical-layer
 * guard; listener behavior is tested in Wave 1's listener.test.ts.
 *
 * D-9-11 reference: "self-loop silent-reject at producer boundary — sortedPairKey
 * throws; listener catches, drops silently (T-09-08 mitigation)."
 */

import { describe, it, expect } from 'vitest';
import { sortedPairKey } from '../../src/relationships/index.js';

describe('sortedPairKey — self-loop rejection (D-9-11)', () => {
    it('throws "self-loop rejected" when both DIDs are identical', () => {
        expect(() => sortedPairKey('did:noesis:x', 'did:noesis:x')).toThrow('self-loop rejected');
    });

    it('does NOT throw when DIDs are different (normal case)', () => {
        expect(() => sortedPairKey('did:noesis:a', 'did:noesis:b')).not.toThrow();
    });
});
