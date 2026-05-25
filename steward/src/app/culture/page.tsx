'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import StewardShell from '@/components/StewardShell';
import { NousFilterBar } from './nous-filter-bar';
import { SkillLineage } from './skill-lineage';
import { NormTimeline } from './norm-timeline';
import { LoreGraph } from './lore-graph';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;

interface LineageNode {
    id: string;
    label: string;
    type: 'nous' | 'skill';
    x: number;
    y: number;
}

interface LineageEdge {
    source: string;
    target: string;
    tick: number;
    type: 'taught' | 'inferred';
}

interface SkillLineageData {
    nodes: LineageNode[];
    edges: LineageEdge[];
}

interface NormRecord {
    norm_id: string;
    fingerprint: string;
    crystallized_tick: number;
    participating_count: number;
    convergence_type: 'emergent' | 'coincidental';
    evidence_tick_range: [number, number];
}

interface NormsData {
    norms: NormRecord[];
}

interface LoreEntry {
    contributor_did: string;
    tick: number;
    content_hash: string;
    category_tag: string;
    citation_count: number;
}

interface LoreData {
    entries: LoreEntry[];
    total: number;
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

interface CitationsData {
    entries: LoreCitationEntry[];
}

function CulturePageContent() {
    const searchParams = useSearchParams();
    const nousParam = searchParams.get('nous') ?? '';
    const activeFilter = DID_REGEX.test(nousParam) ? nousParam : null;

    const [skillData, setSkillData] = useState<SkillLineageData | null>(null);
    const [normsData, setNormsData] = useState<NormsData | null>(null);
    const [loreData, setLoreData] = useState<LoreData | null>(null);
    const [citationsData, setCitationsData] = useState<CitationsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCultureData() {
            setLoading(true);
            setError(null);
            try {
                const [skillRes, normsRes, loreRes, citationsRes] = await Promise.allSettled([
                    fetch(`${GRID_ORIGIN}/api/v1/grid/culture/skills/lineage`, { cache: 'no-store' }),
                    fetch(`${GRID_ORIGIN}/api/v1/grid/norms`, { cache: 'no-store' }),
                    fetch(`${GRID_ORIGIN}/api/v1/grid/lore?limit=100`, { cache: 'no-store' }),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=lore.cited&limit=200`, { cache: 'no-store' }),
                ]);

                if (skillRes.status === 'fulfilled' && skillRes.value.ok) {
                    const data = await skillRes.value.json();
                    setSkillData(data);
                }

                if (normsRes.status === 'fulfilled' && normsRes.value.ok) {
                    const data = await normsRes.value.json();
                    setNormsData(data);
                }

                if (loreRes.status === 'fulfilled' && loreRes.value.ok) {
                    const data = await loreRes.value.json();
                    setLoreData(data);
                }

                if (citationsRes.status === 'fulfilled' && citationsRes.value.ok) {
                    const data = await citationsRes.value.json();
                    // Audit trail may return array or { entries: [] }
                    const entries = Array.isArray(data) ? data : data.entries ?? [];
                    setCitationsData({ entries });
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not reach Grid. Retry by reloading the page.');
            } finally {
                setLoading(false);
            }
        }
        fetchCultureData();
    }, [activeFilter]); // re-fetch when Nous filter changes so ?did= can be forwarded to Grid endpoints

    return (
        <StewardShell title="Culture" breadcrumb="Steward · Observatory · Culture">
            <div
                style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginBottom: 24,
                }}
            >
                Emergent skill, norm, and lore patterns. Filter by Nous.
            </div>

            <NousFilterBar />

            {error ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
                    {error}
                </div>
            ) : loading ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
                    Loading culture data…
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <SkillLineage
                        nodes={skillData?.nodes ?? []}
                        edges={skillData?.edges ?? []}
                        filter={activeFilter}
                    />
                    <NormTimeline norms={normsData?.norms ?? []} />
                    <LoreGraph
                        entries={loreData?.entries ?? []}
                        citations={citationsData?.entries ?? []}
                        filter={activeFilter}
                    />
                </div>
            )}
        </StewardShell>
    );
}

// Suspense boundary required by Next.js 15 for client components that read
// useSearchParams() during render. Inner CulturePageContent does the real work;
// this default export only wraps it.
export default function CulturePage() {
    return (
        <Suspense
            fallback={
                <StewardShell title="Culture" breadcrumb="Steward · Observatory · Culture">
                    <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Loading culture data…
                    </div>
                </StewardShell>
            }
        >
            <CulturePageContent />
        </Suspense>
    );
}
