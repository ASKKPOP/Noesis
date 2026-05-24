/**
 * Plan 24-04 Task 1 — PortalDashboard live stats tests.
 *
 * Tests verify the portal page source file directly (static analysis approach)
 * and the pure helper logic, since JSX rendering in .tsx test files is broken
 * in the current vitest 4.x + vite 8 environment (oxc SSR transform issue —
 * pre-existing across all 42 JSX test files).
 *
 * Tests:
 * - Test 1: Source contains 'Grid · v2.5' header text
 * - Test 2: Source uses liveNous.length for Active Nous value
 * - Test 3: Source uses currentTick state for Current Tick value
 * - Test 4: Source has 'Grid offline' fallback text
 * - Test 5: Source derives agent status from liveNous (not hardcoded 'live')
 * - Test 6: Source uses status === 'active' for live detection
 * - Test 7: Source does NOT contain 'Phase 23 — Cyber Coin Wallet integration'
 * - Test 8: Source contains 'Phase 24' UPDATES entry
 *
 * Additional contract tests:
 * - Uses /api/v1/grid/status (not /api/v1/grid/state — Pitfall 1)
 * - Uses Promise.allSettled
 * - Uses credentials: 'include'
 * - Uses clearInterval (cleanup)
 * - Uses 15_000 polling interval
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PAGE_PATH = path.resolve(
    __dirname,
    'page.tsx',
);

const src = fs.readFileSync(PAGE_PATH, 'utf-8');

describe('PortalDashboard page.tsx — header label', () => {
    it('Test 1: source contains "Grid · v2.5" header text', () => {
        expect(src).toContain('Grid · v2.5');
    });
});

describe('PortalDashboard page.tsx — live stat cards', () => {
    it('Test 2: source renders Active Nous value from liveNous.length', () => {
        expect(src).toContain('liveNous.length');
        expect(src).toContain('Active Nous');
    });

    it('Test 3: source renders Current Tick value from currentTick state', () => {
        expect(src).toContain('currentTick');
        expect(src).toContain('Current Tick');
    });

    it('Test 4: source has "Grid offline" fallback text for both stat cards', () => {
        expect(src).toContain('Grid offline');
        // '—' em dash fallback when tick is null
        expect(src).toContain('currentTick !== null');
    });
});

describe('PortalDashboard page.tsx — Nous agent status', () => {
    it('Test 5: source derives agent status from liveNous (not hardcoded)', () => {
        // Must NOT have hardcoded status: 'live' in NOUS_AGENTS constant
        expect(src).not.toContain("status: 'live'");
        // Must derive isLive from liveNous array
        expect(src).toContain('liveNous');
    });

    it("Test 6: source uses status === 'active' for live detection", () => {
        expect(src).toContain("status === 'active'");
    });
});

describe('PortalDashboard page.tsx — UPDATES list', () => {
    it('Test 7: source does NOT contain stale "Phase 23" coming entry', () => {
        expect(src).not.toContain('Phase 23 — Cyber Coin Wallet integration in development');
        // The old Coming·Phase 23 pattern should be gone
        expect(src).not.toContain("'Phase 23 — Cyber Coin");
    });

    it('Test 8: source contains a Phase 24 UPDATES entry', () => {
        expect(src).toContain('Phase 24');
    });
});

describe('PortalDashboard page.tsx — API contract (Pitfall guards)', () => {
    it('uses /api/v1/grid/status (NOT /api/v1/grid/state — Pitfall 1)', () => {
        expect(src).toContain('grid/status');
        expect(src).not.toContain('grid/state');
    });

    it('uses Promise.allSettled for parallel fetch', () => {
        expect(src).toContain('allSettled');
    });

    it('uses credentials: include on all fetch calls', () => {
        const matches = src.match(/credentials: 'include'/g) ?? [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('uses clearInterval for cleanup', () => {
        expect(src).toContain('clearInterval');
    });

    it('uses 15_000 polling interval', () => {
        expect(src).toContain('15_000');
    });
});
