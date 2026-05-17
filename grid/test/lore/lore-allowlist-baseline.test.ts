import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('Phase 20 allowlist baseline — Wave 3 gate (D-20-13)', () => {
    it('allowlist has exactly 43 events after lore additions (Plan 03)', () => {
        // Wave 3: lore.contributed (42) and lore.cited (43) added in Plan 03.
        // If this fails with count < 43, lore events have not landed yet — run Plan 03.
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(43);
    });

    it('position 41 is norm.crystallized (last Phase 19 event)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[40]).toBe('norm.crystallized');
    });

    it('position 42 is lore.contributed (Phase 20 Plan 03)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[41]).toBe('lore.contributed');
    });

    it('position 43 is lore.cited (Phase 20 Plan 03)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[42]).toBe('lore.cited');
    });
});
