/**
 * Grid page E2E smoke (Plan 03-06 Task 3).
 *
 * Boots the real dashboard dev server (auto-started via playwright.config.ts
 * webServer) against the mock Grid fixture on 127.0.0.1:8080 and asserts:
 *
 *   SC-4: Region map renders >=3 region nodes from /api/v1/grid/regions
 *   SC-5: Nous marker moves to the destination region within one render
 *         cycle of the nous.moved frame (and within our 5s timeout budget).
 *   SC-3: Firehose populates with >=3 rows (spawn + 3 ticks).
 *   SC-6: Heartbeat widget flips data-status to "live" after a tick arrives.
 *
 * Expected marker pixel coordinates are derived from computeRegionLayout
 * (the SAME function the app uses) — the test NEVER hardcodes magic pixels.
 */

import { test, expect, type Page } from '@playwright/test';
import { startMockGrid, MOCK_REGIONS, type MockGridHandle } from './fixtures/mock-grid-server';
// Import the pure-JS layout module via a relative path so Playwright's TS
// transform does not need to resolve the `@/` alias that Vitest/Next use.
import {
    computeRegionLayout,
    VIEWPORT_W,
    VIEWPORT_H,
} from '../../src/app/grid/components/region-layout';

let mock: MockGridHandle;

test.beforeAll(async () => {
    mock = await startMockGrid(8080);
});
test.afterAll(async () => {
    if (mock) await mock.stop();
});

test('dashboard boots, renders live region map + firehose + heartbeat, and animates Nous move', async ({
    page,
}: { page: Page }) => {
    await page.goto('/grid');

    // SC-4: >=3 region nodes render from the initial regions fetch.
    await expect(page.locator('[data-testid="region-node"]').first()).toBeVisible({
        timeout: 5_000,
    });
    expect(await page.locator('[data-testid="region-node"]').count()).toBeGreaterThanOrEqual(3);

    // SC-3: firehose populates with >=3 rows (1 spawn + 3 ticks arrive
    // within the first 1.4s of the WS subscription handler).
    await expect
        .poll(
            async () => await page.locator('[data-testid="firehose-row"]').count(),
            { timeout: 5_000 },
        )
        .toBeGreaterThanOrEqual(3);

    // SC-6: heartbeat flips to 'live' once a tick arrives (data-status is the
    // Plan-05-locked selector convention).
    await expect(page.locator('[data-testid="heartbeat-status"]')).toHaveAttribute(
        'data-status',
        'live',
        { timeout: 5_000 },
    );

    // SC-5: Nous marker settles at region-b center after nous.moved.
    // Expected pixel coords derived from the same layout function the app
    // uses — NEVER hardcoded pixel positions.
    const layout = computeRegionLayout(MOCK_REGIONS);
    const posB = layout.get('region-b');
    expect(posB).toBeDefined();
    const expectedX = Math.round(posB!.x * VIEWPORT_W);
    const expectedY = Math.round(posB!.y * VIEWPORT_H);

    const marker = page.locator('[data-nous-did="did:noesis:alice"]');
    await expect(marker).toBeVisible({ timeout: 5_000 });

    // Match expected translate with 1px tolerance per axis (float rounding).
    // Browsers may return `translate(Xpx, Ypx)` or `translate(X.Npx, Y.Npx)`.
    // Tolerance is ±1px because the hash-derived layout can round up OR down
    // depending on the DID (changed from did:example:alice → did:noesis:alice
    // in Plan 06-06 to satisfy SelectionStore.DID_REGEX).
    await expect
        .poll(
            async () => await marker.evaluate((el) => (el as SVGGElement).style.transform),
            { timeout: 5_000 },
        )
        .toMatch(
            (() => {
                const x0 = expectedX - 1;
                const x1 = expectedX + 1;
                const y0 = expectedY - 1;
                const y1 = expectedY + 1;
                return new RegExp(
                    String.raw`translate\(\s*(?:${x0}|${expectedX}|${x1})(?:\.\d+)?px,\s*(?:${y0}|${expectedY}|${y1})(?:\.\d+)?px\s*\)`,
                );
            })(),
        );
});
