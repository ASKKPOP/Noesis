import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('Phase 20 allowlist baseline — Wave 0 gate (D-20-13)', () => {
    it('allowlist has exactly 41 events before lore additions', () => {
        // Wave 0 RED gate: lore.contributed and lore.cited not yet in ALLOWLIST_MEMBERS.
        // If this fails with count > 41, a lore event landed before Wave 0 — STOP and fix.
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(41);
    });

    it('position 41 is norm.crystallized (last Phase 19 event)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[40]).toBe('norm.crystallized');
    });
});
