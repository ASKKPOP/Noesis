import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Regression: ISSUE-001 — WalletConnect connector must be gated on the project id.
 * Found by /qa on 2026-07-08.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-07-08.md
 *
 * Bug: wagmiConfig always declared walletConnect() with an empty-string
 * projectId fallback, so wagmi initialized the connector on every portal page
 * mount and Reown's remote-config fetch failed with "Project ID Not Configured"
 * (400/403) console errors. Neither sign-in button uses WalletConnect — both use
 * injected() (MetaMask) — so the connector only produced console noise.
 *
 * Source-text contract (same approach as siwe-auth.test.ts): importing
 * wagmi-config pulls the full wagmi connector tree, which these unit tests
 * deliberately do not mock. We assert the guard exists in source instead.
 */
describe('wagmiConfig — WalletConnect gating (regression: ISSUE-001)', () => {
    const configPath = path.resolve(__dirname, './wagmi-config.ts');
    let source: string;

    beforeAll(() => {
        source = fs.readFileSync(configPath, 'utf8');
    });

    it('reads the project id from NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', () => {
        expect(source).toContain("process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID']");
    });

    it('wires walletConnect only when the project id is present (conditional spread)', () => {
        // New form: ...(wcProjectId ? [walletConnect({ ... })] : [])
        expect(source).toMatch(/\?\s*\[\s*walletConnect\(/);
    });

    it('does NOT list walletConnect as an unconditional connector', () => {
        // Old buggy form: connectors: [ injected(), walletConnect({ projectId: ... }) ]
        expect(source).not.toMatch(/injected\(\),\s*walletConnect\(/);
    });

    it('warns in the browser when the project id is missing', () => {
        expect(source).toMatch(/console\.warn\([^;]*WALLETCONNECT_PROJECT_ID/);
    });
});
