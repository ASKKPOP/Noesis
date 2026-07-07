/**
 * Regression: the /nous Nous Roster page (NousRosterPage) carried the SAME
 * ousia→balance_wei field-drift crash as the Dashboard — nous/page.tsx read
 * n.ousia.toLocaleString(), but GET /api/v1/grid/nous returns `balance_wei`
 * (no `ousia`), so undefined.toLocaleString() threw and blanked the roster
 * whenever a Nous existed. This sibling page was fixed in the same commit but
 * left uncovered by the first regression test (page.regression.test.tsx);
 * code-review flagged the gap. Found by /qa + code-review on 2026-07-07.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NousRosterPage from './page';

vi.mock('@/components/StewardShell', () => ({
    default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('next/link', () => ({
    default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

// GET /api/v1/grid/nous shape: { nous: [...] }, each Nous with balance_wei, NO ousia.
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
    global.fetch = vi.fn(
        async () => ({ ok: true, json: async () => ({ nous: [NOUS_FROM_API] }) }) as Response,
    ) as unknown as typeof fetch;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Nous Roster page — balance cell (regression: ousia→balance_wei API drift)', () => {
    it('renders the roster balance instead of crashing on a Nous with no `ousia` field', async () => {
        render(<NousRosterPage />);
        await waitFor(() => expect(screen.getByText('Hermes')).toBeInTheDocument());
        // balance_wei=1000 → localized "1,000" (locale-robust); reputation=0 renders "0".
        expect(screen.getByText(/1[,.\s]?000/)).toBeInTheDocument();
    });
});
