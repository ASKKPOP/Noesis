/**
 * /grid/relationships — graph view page (D-9-08, UI-SPEC §Surface 2).
 *
 * Server component: metadata declaration + static shell.
 * RelationshipGraph is a 'use client' component that fetches data via SWR.
 *
 * Route: /grid/relationships (NOT /grid/relationships-graph — see D-9-08).
 * Copy is verbatim from 09-UI-SPEC.md §Copywriting Contract — do not change.
 */

import { RelationshipGraph } from './relationship-graph';

export const metadata = { title: 'Relationship Graph — Noēsis Grid' };

export default function RelationshipsPage(): React.ReactElement {
    return (
        <main className="bg-neutral-950 min-h-screen p-4">
            <h1 className="text-sm font-semibold text-neutral-100">
                Relationship Graph
            </h1>
            <p className="mt-1 text-xs text-neutral-400">
                Warmth and weight derived from dialogue and trade events. Read-only.
            </p>

            {/* SVG graph card */}
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-900 p-6">
                <RelationshipGraph />
            </div>

            {/* Legend */}
            <div className="mt-6" data-testid="graph-legend">
                <h3 className="mb-2 text-xs font-semibold text-neutral-100">Warmth</h3>
                <ul className="flex flex-col gap-1">
                    <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <svg width="24" height="4" aria-hidden="true">
                            <line x1="0" y1="2" x2="24" y2="2" stroke="#9ca3af" strokeWidth="1.5" />
                        </svg>
                        cold — weight under 0.20
                    </li>
                    <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <svg width="24" height="4" aria-hidden="true">
                            <line x1="0" y1="2" x2="24" y2="2" stroke="#f59e0b" strokeWidth="1.5" />
                        </svg>
                        warm — weight 0.20 to 0.60
                    </li>
                    <li className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <svg width="24" height="4" aria-hidden="true">
                            <line x1="0" y1="2" x2="24" y2="2" stroke="#e11d48" strokeWidth="1.5" />
                        </svg>
                        hot — weight 0.60 or higher
                    </li>
                </ul>
            </div>

            {/* H1 footnote */}
            <p className="mt-4 text-[11px] text-neutral-500">
                Showing bucketed warmth only. Numeric weights require H2 Reviewer.
            </p>
        </main>
    );
}
