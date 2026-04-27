/**
 * /grid/governance — governance proposals page (VOTE-07 / D-12-09).
 *
 * Server component: metadata declaration + static shell.
 * GovernanceDashboard is a 'use client' component that fetches data via SWR.
 *
 * Reads x-operator-tier from request headers and passes as initialTier prop.
 * Clones dashboard/src/app/grid/relationships/page.tsx shape (Phase 9 pattern).
 *
 * Privacy (VOTE-05): this page provides ZERO propose/commit/reveal affordance.
 * Operators are read-only at all tiers including H5.
 *
 * Phase 12 Wave 4 — VOTE-07 / D-12-09 / T-09-15.
 */

import { headers } from 'next/headers';
import { GovernanceDashboard } from './governance-dashboard';

export const metadata = { title: 'Governance — Noēsis Grid' };

export default async function GovernancePage(): Promise<React.ReactElement> {
    // Read operator tier from request headers (set by middleware / API gateway).
    // Default to H1 (lowest privilege) if header absent.
    const headersList = await headers();
    const tierHeader = headersList.get('x-operator-tier');
    const rawTier = parseInt(tierHeader ?? '1', 10);
    const tier = (rawTier >= 1 && rawTier <= 5 ? rawTier : 1) as 1 | 2 | 3 | 4 | 5;

    return (
        <main className="bg-neutral-950 min-h-screen p-4">
            <h1 className="text-sm font-semibold text-neutral-100">
                Governance
            </h1>
            <p className="mt-1 text-xs text-neutral-400">
                Collective proposals and commit-reveal ballots. Read-only.
            </p>

            {/* Proposals list card */}
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-900 p-6">
                <GovernanceDashboard tier={tier} />
            </div>

            {/* Tier footnote */}
            <p className="mt-4 text-[11px] text-neutral-500">
                Aggregate counts only. Proposal body requires H2 Reviewer.
                {tier >= 5 && ' Voting history visible at H5.'}
            </p>
        </main>
    );
}
