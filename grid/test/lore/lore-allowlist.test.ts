/**
 * Final allowlist count assertion — Phase 20 Wave 4 (D-20-13).
 * Must run AFTER lore.contributed and lore.cited are added to ALLOWLIST_MEMBERS.
 * Supersedes lore-allowlist-baseline.test.ts (which tested the pre-lore state).
 */
import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('Phase 20 allowlist final count (D-20-13)', () => {
    it('allowlist has exactly 43 events after lore additions', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(43);
    });

    it('lore.contributed is at position 42 (index 41)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[41]).toBe('lore.contributed');
    });

    it('lore.cited is at position 43 (index 42)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[42]).toBe('lore.cited');
    });

    it('norm.crystallized is still at position 41 (index 40) — Phase 19 anchor', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[40]).toBe('norm.crystallized');
    });
});
