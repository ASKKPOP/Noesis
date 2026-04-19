'use client';
/**
 * MemorySection — up to 5 episodic memory highlights, in received order.
 *
 * W2 TIMESTAMP CONTRACT (locked by Plan 04-03, honored here and in Plan
 * 04-06 TradesTable): `memory_highlights[].timestamp` is a Unix timestamp
 * in **INTEGER SECONDS**. Multiply by 1000 before the Date constructor.
 * Do NOT multiply twice; do NOT pass raw seconds to Date (→ 1970 dates).
 *
 * Defensive cap of 5 rows per UI-SPEC §202 ("Recent memories (5)"): even if
 * the server over-sends, we hard-slice to 5 to bound DOM size (T-04-23).
 *
 * Empty-state copy is verbatim from UI-SPEC §203.
 */

import { Chip, EmptyState } from '@/components/primitives';
import type { NousStateResponse } from '@/lib/api/introspect';

const MAX_MEMORIES = 5;

export interface MemorySectionProps {
    readonly memories: NousStateResponse['memory_highlights'];
}

export function MemorySection({ memories }: MemorySectionProps): React.ReactElement {
    const rows = memories.slice(0, MAX_MEMORIES);

    return (
        <section
            data-testid="section-memory"
            aria-labelledby="section-memory-title"
            className="mb-4"
        >
            <h3
                id="section-memory-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Memory
            </h3>
            {rows.length === 0 ? (
                <EmptyState
                    title="No episodic memories recorded."
                    description="Nous has not yet formed highlight memories."
                    testId="empty-memory"
                />
            ) : (
                <ul className="flex flex-col gap-1">
                    {rows.map((row, i) => {
                        // W2 contract: timestamp is seconds → multiply by 1000 for Date.
                        const label = new Date(row.timestamp * 1000).toLocaleString();
                        return (
                            <li
                                key={`${row.timestamp}-${i}`}
                                className="flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                            >
                                <div className="flex items-center gap-2">
                                    <Chip label={row.kind} testId={`memory-kind-${i}`} />
                                    <span className="font-mono text-[11px] text-neutral-500">
                                        {label}
                                    </span>
                                </div>
                                <span className="text-xs text-neutral-200">{row.summary}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
