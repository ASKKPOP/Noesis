import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 1,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3001',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'npm run dev',
        port: 3001,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: {
            // Exposes the Plan 06-06 test hooks (__agencyStore,
            // __testTriggerH4Force). Dead-code eliminated in production.
            NEXT_PUBLIC_E2E_TESTHOOKS: '1',
            // Mock-grid fixture binds to 127.0.0.1:8080 (see
            // tests/e2e/fixtures/mock-grid-server.ts). Dashboard fetches
            // target this origin during Playwright runs.
            NEXT_PUBLIC_GRID_ORIGIN: 'http://127.0.0.1:8080',
        },
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
