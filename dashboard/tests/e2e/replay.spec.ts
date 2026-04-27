/**
 * Phase 13 E2E — Replay route tier auto-downgrade (D-13-07 / T-13-05-01).
 *
 * Pins the Phase 13 success criterion that cannot be asserted by unit tests:
 *
 *   SC: Navigating away from /grid/replay calls agencyStore.setTier('H1')
 *       (the live /grid page no longer shows REPLAY content after navigation).
 *
 * Runs against the dashboard dev server (playwright.config.ts webServer)
 * and the mock-grid fixture on 127.0.0.1:8080. The agency store is
 * exposed under `window.__agencyStore` via the NEXT_PUBLIC_E2E_TESTHOOKS
 * flag (same hook used by agency.spec.ts SC#4 test).
 *
 * Two-phase assertion:
 *   1. Arrive at /grid/replay at H1 — tier-gate renders, no REPLAY badge.
 *   2. Elevate to H3 via window.__agencyStore — REPLAY badge appears.
 *   3. Navigate to /grid — auto-downgrade fires, REPLAY badge gone.
 */

import { test, expect, type Page } from '@playwright/test';
import { startMockGrid, type MockGridHandle } from './fixtures/mock-grid-server';

// This spec shares the same 127.0.0.1:8080 port as grid-page.spec.ts and
// agency.spec.ts. Force serial mode so two mock-grid instances never try
// to bind the port simultaneously.
test.describe.configure({ mode: 'serial' });

let mock: MockGridHandle;

test.beforeAll(async () => {
    mock = await startMockGrid(8080);
});
test.afterAll(async () => {
    if (mock) await mock.stop();
});

test.describe('Phase 13 — Replay route tier gate and auto-downgrade (D-13-07)', () => {
    test('H1 operator sees tier gate copy, not REPLAY badge', async ({ page }: { page: Page }) => {
        await page.goto('/grid/replay');

        // Wait for the agency store to hydrate (window.__agencyStore present).
        await page.waitForFunction(
            () => typeof (window as unknown as { __agencyStore?: unknown }).__agencyStore === 'object',
            null,
            { timeout: 5_000 },
        );

        // At H1 (default), tier gate renders, no REPLAY badge.
        const tierGate = page.locator('[data-testid="tier-gate"]');
        await expect(tierGate).toBeVisible({ timeout: 5_000 });
        await expect(tierGate).toContainText('Replay requires H3');

        const replayBadge = page.locator('[data-testid="replay-badge"]');
        await expect(replayBadge).not.toBeVisible();
    });

    test('tier auto-downgrade on /grid/replay route exit (D-13-07 / T-13-05-01)', async ({ page }: { page: Page }) => {
        await page.goto('/grid/replay');

        // Wait for the agency store hook.
        await page.waitForFunction(
            () => typeof (window as unknown as { __agencyStore?: unknown }).__agencyStore === 'object',
            null,
            { timeout: 5_000 },
        );

        // Elevate to H3 via the exposed store hook.
        await page.evaluate(() => {
            const store = (window as unknown as {
                __agencyStore?: { setTier: (t: string) => void };
            }).__agencyStore;
            store?.setTier('H3');
        });

        // REPLAY badge should now appear (H3+ renders the replay shell).
        const replayBadge = page.locator('[data-testid="replay-badge"]');
        await expect(replayBadge).toBeVisible({ timeout: 3_000 });

        // Navigate away to the live grid.
        await page.goto('/grid');

        // After navigation, ReplayClient unmounts → cleanup fires setTier('H1').
        // The live /grid page does not render the REPLAY badge.
        // Poll via the store snapshot to confirm the downgrade completed.
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const store = (window as unknown as {
                    __agencyStore?: { getSnapshot: () => string };
                }).__agencyStore;
                return store?.getSnapshot() ?? null;
            });
        }, { timeout: 5_000 }).toBe('H1');

        // Belt-and-suspenders: no REPLAY badge visible on the live grid route.
        const liveReplayBadge = page.locator('[data-testid="replay-badge"]');
        await expect(liveReplayBadge).not.toBeVisible();
    });
});
