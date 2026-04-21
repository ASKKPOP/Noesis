/**
 * Phase 7 Plan 01 Task 1 — dialogue_id determinism tests (RED-first).
 *
 * Covers D-03 / D-06: dialogue_id = sha256(sortedDids|channel|windowStartTick).slice(0,16).
 * The function must be:
 *   - order-independent over dids
 *   - 16-hex (DIALOGUE_ID_RE: /^[0-9a-f]{16}$/)
 *   - strictly input-dependent (different channel or tick → different id)
 *
 * Imports from the dialogue barrel, which does not yet exist → RED.
 */

import { describe, it, expect } from 'vitest';
import { computeDialogueId, DIALOGUE_ID_RE } from '../../src/dialogue/index.js';

describe('computeDialogueId', () => {
    it('matches DIALOGUE_ID_RE (/^[0-9a-f]{16}$/)', () => {
        const id = computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch', 42);
        expect(id).toMatch(DIALOGUE_ID_RE);
        expect(id).toMatch(/^[0-9a-f]{16}$/);
        expect(id.length).toBe(16);
    });

    it('is order-independent over dids', () => {
        const a = computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch', 100);
        const b = computeDialogueId(['did:noesis:b', 'did:noesis:a'], 'ch', 100);
        expect(a).toBe(b);
    });

    it('differs when channel differs', () => {
        const base = computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch1', 10);
        const other = computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch2', 10);
        expect(other).not.toBe(base);
    });

    it('differs when windowStartTick differs', () => {
        const base = computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch', 10);
        const other = computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch', 11);
        expect(other).not.toBe(base);
    });

    it('is pure: same input → same output across calls', () => {
        const inputs: [string[], string, number] = [['did:noesis:x', 'did:noesis:y'], 'channel-7', 42];
        const first = computeDialogueId(inputs[0], inputs[1], inputs[2]);
        const second = computeDialogueId(inputs[0], inputs[1], inputs[2]);
        expect(first).toBe(second);
    });
});
