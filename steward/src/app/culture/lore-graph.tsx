'use client';

interface LoreEntry {
    contributor_did: string;
    tick: number;
    content_hash: string;
    category_tag: string;
    citation_count: number;
}

interface LoreCitationPayload {
    citing_did: string;
    content_hash: string;
    tick: number;
}

interface LoreCitationEntry {
    id: number;
    payload: LoreCitationPayload;
}

interface Props {
    entries: LoreEntry[];
    citations: LoreCitationEntry[];
    filter: string | null;
}

const LORE_COLORS: Record<string, string> = {
    myth:      '#6a4a7a',
    history:   '#5a5a6a',
    ritual:    '#b8542f',
    principle: '#8a6a2e',
};
const LORE_FALLBACK = '#8a8479';

function categoryColor(tag: string): string {
    return LORE_COLORS[tag] ?? LORE_FALLBACK;
}

function deterministicPosition(hash: string, width = 760, height = 420): { x: number; y: number } {
    // Use first 8 hex chars as two 4-char groups for x, y seed
    const xSeed = parseInt(hash.slice(0, 4), 16) / 0xffff;
    const ySeed = parseInt(hash.slice(4, 8), 16) / 0xffff;
    return {
        x: 20 + xSeed * (width - 40),
        y: 20 + ySeed * (height - 40),
    };
}

export function LoreGraph({ entries, citations, filter }: Props) {
    if (entries.length === 0) {
        return (
            <div className="steward-card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                            Culture
                        </div>
                        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                            Lore Graph
                        </h2>
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                        0 entries
                    </span>
                </div>
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    No lore contributions yet.
                </div>
            </div>
        );
    }

    // Compute positions for all entries using deterministic scatter
    const posMap = new Map(entries.map(e => [e.content_hash, deterministicPosition(e.content_hash)]));

    const isFiltered = (entry: LoreEntry): boolean => !filter || entry.contributor_did === filter;

    const filteredEmpty = filter && !entries.some(e => e.contributor_did === filter);

    return (
        <div className="steward-card">
            {/* Card header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                        Culture
                    </div>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Lore Graph
                    </h2>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                    {entries.length} entries
                </span>
            </div>

            {/* SVG body */}
            <div style={{ padding: '20px 0 0 0', overflowX: 'auto', minHeight: 320, maxHeight: 480 }}>
                <svg
                    role="img"
                    aria-label={`Lore graph visualization. ${entries.length} entries.`}
                    viewBox="0 0 800 480"
                    width="100%"
                    style={{ background: 'var(--parchment)', display: 'block' }}
                >
                    {/* Citation edges — render first, under nodes */}
                    {citations.map((citation, i) => {
                        const { content_hash, citing_did } = citation.payload;
                        // The cited entry (by content_hash)
                        const citedPos = posMap.get(content_hash);
                        if (!citedPos) return null;

                        // Find a lore entry contributed by the citing DID to use as source position
                        const citingEntry = entries.find(e => e.contributor_did === citing_did);
                        if (!citingEntry) return null;

                        const citingPos = posMap.get(citingEntry.content_hash);
                        if (!citingPos) return null;

                        // Don't draw self-loops
                        if (content_hash === citingEntry.content_hash) return null;

                        return (
                            <line
                                key={`citation-${i}`}
                                x1={citingPos.x}
                                y1={citingPos.y}
                                x2={citedPos.x}
                                y2={citedPos.y}
                                stroke="#6a4a7a"
                                strokeWidth={1}
                                opacity={0.4}
                            />
                        );
                    })}

                    {/* Entry nodes — circles on top */}
                    {entries.map(entry => {
                        const pos = posMap.get(entry.content_hash);
                        if (!pos) return null;

                        const filtered = isFiltered(entry);
                        const isSelected = filter && entry.contributor_did === filter;

                        return (
                            <circle
                                key={`entry-${entry.content_hash}`}
                                cx={pos.x}
                                cy={pos.y}
                                r={6}
                                fill={categoryColor(entry.category_tag)}
                                stroke={isSelected ? 'var(--terracotta)' : 'var(--ink)'}
                                strokeWidth={isSelected ? 2 : 0.75}
                                opacity={filtered ? 1.0 : 0.3}
                            />
                        );
                    })}

                    {/* Citation count labels for entries with citation_count >= 3 */}
                    {entries
                        .filter(e => e.citation_count >= 3)
                        .map(entry => {
                            const pos = posMap.get(entry.content_hash);
                            if (!pos) return null;
                            return (
                                <text
                                    key={`count-${entry.content_hash}`}
                                    x={pos.x + 12}
                                    y={pos.y + 4}
                                    fontSize={9}
                                    fontFamily="var(--mono)"
                                    fill="var(--muted)"
                                >
                                    ×{entry.citation_count}
                                </text>
                            );
                        })}
                </svg>

                {/* Filter empty state */}
                {filteredEmpty && (
                    <div style={{ padding: '12px 20px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                        No lore contributions from this Nous.
                    </div>
                )}
            </div>

            {/* Footer legend */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--rule)', marginTop: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {Object.entries(LORE_COLORS).map(([tag, color]) => (
                    <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width={12} height={12} style={{ display: 'block' }}>
                            <circle cx={6} cy={6} r={5} fill={color} />
                        </svg>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{tag}</span>
                    </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={24} height={12} style={{ display: 'block' }}>
                        <line x1={0} y1={6} x2={24} y2={6} stroke="#6a4a7a" strokeWidth={1} />
                    </svg>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>Citation</span>
                </div>
            </div>
        </div>
    );
}
