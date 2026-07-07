/**
 * Regression: the Steward operator console (/console → this page) crashed with a
 * client-side exception ("Application error") whenever any Nous existed. page.tsx read
 * `n.ousia.toLocaleString()`, but the Grid API GET /api/v1/grid/nous returns `balance_wei`
 * (there is no `ousia` field), so `undefined.toLocaleString()` threw during render and the
 * error boundary blanked the whole console — on prod AND local.
 * Found by /qa on 2026-07-07. Fix: read `balance_wei` (null-safe).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './page';

// Isolate the page's own rendering — the Nous roster table is where the bug lived.
vi.mock('@/components/StewardShell', () => ({
    default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// A Nous exactly as GET /api/v1/grid/nous returns it: has `balance_wei`, NO `ousia`.
const NOUS_FROM_API = {
    did: 'did:noesis:hermes',
    name: 'Hermes',
    region: 'market',
    balance_wei: 1000,
    lifecyclePhase: 'spawning',
    reputation: 0,
    status: 'active',
};

beforeEach(() => {
    global.fetch = vi.fn(async (url: string | URL) => {
        const u = String(url);
        const body = u.includes('/grid/nous')
            ? [NOUS_FROM_API]
            : u.includes('/grid/status')
                ? { tick: 374 }
                : { proposals: [] };
        return { ok: true, json: async () => body } as Response;
    }) as unknown as typeof fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Steward dashboard — Nous roster balance (regression: ousia→balance_wei API drift)', () => {
    it('renders the roster balance instead of crashing on a Nous with no `ousia` field', async () => {
        render(<DashboardPage />);
        // The row that used to throw renders once the fetch resolves.
        await waitFor(() => expect(screen.getByText('Hermes')).toBeInTheDocument());
        // balance_wei=1000 → localized "1,000"; proves the correct field is read (locale-robust).
        expect(screen.getByText(/1[,.\s]?000/)).toBeInTheDocument();
    });
});
