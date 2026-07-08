import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Regression: ISSUE-005 — PortalAuthGate must hydrate the client auth store from /me.
 * Found by /qa on 2026-07-08.
 * Report: .gstack/qa-reports/qa-report-authenticated-local-2026-07-08.md
 *
 * Bug: the gate fetched /api/v1/portal/auth/me only to check res.ok (allow/deny)
 * and discarded the body — it never called setUser. The Zustand store has no
 * persist middleware, so on any reload / direct-nav currentUser was null and a
 * logged-in user saw a blank Profile (DID/Region/Member Since = "—") and empty
 * PortalHeader. It was only populated transiently right after login.
 *
 * Source-text contract (same approach as siwe-auth.test.ts / wagmi-config
 * regression): a full behavioral render pulls the next/navigation + store tree
 * these unit tests deliberately avoid mocking, so we assert the wiring in source.
 */
describe('PortalAuthGate — hydrates auth store from /me (regression: ISSUE-005)', () => {
    const gatePath = path.resolve(__dirname, './PortalAuthGate.tsx');
    let source: string;

    beforeAll(() => {
        source = fs.readFileSync(gatePath, 'utf8');
    });

    it('imports the human auth store', () => {
        expect(source).toMatch(/useHumanAuthStore/);
    });

    it('reads setUser from the store', () => {
        expect(source).toMatch(/setUser\s*=\s*useHumanAuthStore/);
    });

    it('parses the /me body and passes it to setUser (does not discard it)', () => {
        // The /me ok-branch must await res.json() and call setUser with it.
        expect(source).toMatch(/await\s+res\.json\(\)/);
        expect(source).toMatch(/setUser\(\s*user\s*\)/);
    });
});
