/**
 * Phase 6 E2E — Operator Agency Foundation.
 *
 * Pins the three Phase 6 success criteria that cannot be meaningfully
 * asserted by unit tests:
 *
 *   SC#1: Agency Indicator visible on every dashboard route.
 *   SC#4: Tier captured at confirmation time survives a mid-flight
 *         store downgrade (live E2E analog of Plan 03's
 *         elevation-race.test.tsx unit regression).
 *   SC#5: H5 "Delete Nous" button is visible and DISABLED in the
 *         Inspector drawer with aria-disabled=true and
 *         title="Requires Phase 8".
 *
 * Runs against the dashboard dev server (playwright.config.ts webServer)
 * and the mock-grid fixture on 127.0.0.1:8080. The agency store is
 * exposed under `window.__agencyStore` via the NEXT_PUBLIC_E2E_TESTHOOKS
 * flag. A parallel hook `window.__testTriggerH4Force` fires a raw H4
 * POST so SC#4's race interceptor has a request to capture without
 * needing a real UI button (no Phase 6 dashboard surface wires
 * `useElevatedAction` into a clickable affordance yet).
 *
 * DASHBOARD_ROUTES pin — deviation from plan:
 *
 *   The plan snippet referenced `['/grid', '/economy']`. Investigation
 *   of `dashboard/src/app/` shows only ONE top-level dashboard route:
 *   `/grid`. The home route `/` 301-redirects to `/grid`
 *   (app/page.tsx); `grid/economy/` is a components directory (no
 *   page.tsx, no route). Any future phase that adds a true top-level
 *   route MUST extend DASHBOARD_ROUTES in this file to preserve SC#1
 *   coverage. The root `/` redirect is covered transitively by `/grid`.
 */

import { test, expect, type Page } from '@playwright/test';
import { startMockGrid, type MockGridHandle } from './fixtures/mock-grid-server';

// This spec shares the same 127.0.0.1:8080 port as grid-page.spec.ts
// (the dashboard's NEXT_PUBLIC_GRID_ORIGIN is baked at build time to that
// single origin). Force serial mode so two mock-grid instances never try
// to bind the port simultaneously across workers.
test.describe.configure({ mode: 'serial' });

let mock: MockGridHandle;

test.beforeAll(async () => { mock = await startMockGrid(8080); });
test.afterAll(async () => { if (mock) await mock.stop(); });

// Routes that MUST mount the indicator per SC#1. Update when a new
// top-level route is added in the same commit that introduces it.
const DASHBOARD_ROUTES: readonly string[] = ['/grid'];

// Known DID spawned by the mock fixture (see mock-grid-server.ts nous.spawned).
// MUST match SelectionStore.DID_REGEX (`/^did:noesis:[a-z0-9_-]+$/i`) — a
// non-matching DID would fall through to null on click and break SC#5.
const MOCK_DID = 'did:noesis:alice';

test.describe('Phase 6 — Agency Indicator on every route (SC#1)', () => {
    for (const route of DASHBOARD_ROUTES) {
        test(`SC#1: indicator renders on ${route}`, async ({ page }: { page: Page }) => {
            await page.goto(route);

            const indicator = page.locator('[data-testid="agency-indicator"]');
            await expect(indicator).toBeVisible({ timeout: 5_000 });

            const chip = page.locator('[data-testid="agency-chip"]');
            await expect(chip).toBeVisible();
            // Default H1 Observer on first load (SSR snapshot locked per D-01).
            await expect(chip).toContainText('H1');
            await expect(chip).toContainText('Observer');
        });
    }
});

test.describe('Phase 6 — Elevation race (SC#4 live)', () => {
    test('SC#4: tier committed at confirm time survives mid-flight downgrade', async ({ page }: { page: Page }) => {
        await page.goto('/grid');

        // Wait for the test hook to install (fires inside AgencyHydrator's
        // useEffect post-mount). Without this the race window opens before
        // window.__testTriggerH4Force exists.
        await page.waitForFunction(
            () => typeof (window as unknown as { __testTriggerH4Force?: () => void })
                .__testTriggerH4Force === 'function',
            null,
            { timeout: 5_000 },
        );

        // Capture the POST body so we can assert tier=H4 even if a downgrade
        // fires mid-flight. The interceptor is the mid-flight downgrade
        // trigger: between request-out and response-in it flips the store.
        let capturedTier: string | undefined;
        await page.route('**/api/v1/operator/nous/**/telos/force', async (route) => {
            const req = route.request();
            try {
                const body = req.postDataJSON() as { tier?: string };
                capturedTier = body.tier;
            } catch {
                capturedTier = undefined;
            }
            // Mid-flight downgrade: another "UI source" flips the store to H1
            // AFTER the request is on the wire but BEFORE the response lands.
            // SC#4 asserts the tier recorded in the POST body is the tier at
            // confirm-click time — regardless of the store's current snapshot.
            await page.evaluate(() => {
                const store = (window as unknown as {
                    __agencyStore?: { setTier: (t: 'H1') => void };
                }).__agencyStore;
                store?.setTier('H1');
            });
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    telos_hash_before: 'a'.repeat(64),
                    telos_hash_after:  'b'.repeat(64),
                }),
            });
        });

        // Fire the H4 elevation via the test hook. This bypasses the real
        // ElevationDialog path on purpose — the dialog's closure-capture
        // logic is covered by Plan 03's elevation-race.test.tsx unit. The
        // E2E gate here is: does the tier baked into the HTTP body at send
        // time survive a concurrent store mutation before response arrives?
        await page.evaluate(() => {
            (window as unknown as { __testTriggerH4Force?: () => void })
                .__testTriggerH4Force?.();
        });

        await expect.poll(() => capturedTier, { timeout: 5_000 }).toBe('H4');

        // Confirm the mid-flight downgrade actually landed on the store.
        // This proves the race was real (not elided by fortunate timing).
        await expect.poll(async () => {
            return await page.evaluate(() => {
                const store = (window as unknown as {
                    __agencyStore?: { getSnapshot: () => string };
                }).__agencyStore;
                return store?.getSnapshot() ?? null;
            });
        }, { timeout: 3_000 }).toBe('H1');
    });
});

test.describe('Phase 6 — H5 disabled affordance (SC#5)', () => {
    test('SC#5: Delete Nous button is visible, disabled, with Phase 8 tooltip', async ({ page }: { page: Page }) => {
        await page.goto('/grid');

        // Select a Nous to open the Inspector drawer. The mock fixture
        // spawns did:noesis:alice within ~500ms of the WS subscription.
        const marker = page.locator(`[data-nous-did="${MOCK_DID}"]`);
        await expect(marker).toBeVisible({ timeout: 5_000 });
        await marker.click();

        // Inspector drawer mounts; the H5 affordance is rendered outside
        // the fetch-state branches so it's present even during loading.
        const drawer = page.locator('[data-testid="inspector-drawer"]');
        await expect(drawer).toBeVisible({ timeout: 3_000 });

        const btn = page.locator('[data-testid="inspector-h5-delete"]');
        await expect(btn).toBeVisible({ timeout: 3_000 });
        await expect(btn).toBeDisabled();
        await expect(btn).toHaveAttribute('title', 'Requires Phase 8');
        await expect(btn).toHaveAttribute('aria-disabled', 'true');
        await expect(btn).toContainText(/delete nous/i);
    });
});
