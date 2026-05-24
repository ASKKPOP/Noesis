'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface Region {
    id: string;
    name: string;
    description: string;
    capacity: number;
}

interface Connection {
    from: string;
    to: string;
}

interface RegionNode extends Region {
    cx: number;
    cy: number;
}

function layoutNodes(regions: Region[]): RegionNode[] {
    const n = regions.length;
    if (n === 0) return [];
    const cx = 250;
    const cy = 250;
    const radius = n === 1 ? 0 : Math.min(180, 60 + n * 20);
    return regions.map((r, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        return {
            ...r,
            cx: cx + radius * Math.cos(angle),
            cy: cy + radius * Math.sin(angle),
        };
    });
}

export default function MapPage() {
    const [nodes, setNodes] = useState<RegionNode[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<RegionNode | null>(null);

    useEffect(() => {
        async function fetchRegions() {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/regions`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const regionList: Region[] = data.regions ?? [];
                const connList: Connection[] = data.connections ?? [];
                setNodes(layoutNodes(regionList));
                setConnections(connList);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to fetch regions');
            } finally {
                setLoading(false);
            }
        }
        fetchRegions();
    }, []);

    function getNode(id: string) {
        return nodes.find((n) => n.id === id);
    }

    const connectedTo = selected
        ? connections
              .filter((c) => c.from === selected.id || c.to === selected.id)
              .map((c) => (c.from === selected.id ? c.to : c.from))
              .map((id) => nodes.find((n) => n.id === id))
              .filter(Boolean) as RegionNode[]
        : [];

    return (
        <StewardShell title="World Map" breadcrumb="Steward · Map">
            {error ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    Could not load regions: {error}
                </div>
            ) : loading ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    Loading world map…
                </div>
            ) : nodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    No regions configured.
                </div>
            ) : (
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                    {/* SVG map */}
                    <div className="steward-card" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                            {nodes.length} regions · {connections.length} connections
                        </div>
                        <div style={{ padding: '8px' }}>
                            <svg
                                viewBox="0 0 500 500"
                                width="100%"
                                style={{ height: 500, display: 'block' }}
                            >
                                {/* Background */}
                                <rect width="500" height="500" fill="var(--parchment)" />

                                {/* Connection lines */}
                                {connections.map((c, i) => {
                                    const from = getNode(c.from);
                                    const to = getNode(c.to);
                                    if (!from || !to) return null;
                                    const isHighlighted =
                                        selected &&
                                        (c.from === selected.id || c.to === selected.id);
                                    return (
                                        <line
                                            key={i}
                                            x1={from.cx}
                                            y1={from.cy}
                                            x2={to.cx}
                                            y2={to.cy}
                                            stroke={isHighlighted ? 'var(--terracotta)' : 'var(--rule)'}
                                            strokeWidth={isHighlighted ? 2 : 1}
                                            strokeDasharray={isHighlighted ? undefined : '4 3'}
                                            opacity={isHighlighted ? 0.8 : 0.6}
                                        />
                                    );
                                })}

                                {/* Region nodes */}
                                {nodes.map((node) => {
                                    const isSelected = selected?.id === node.id;
                                    const isConnected = connectedTo.some((n) => n.id === node.id);
                                    return (
                                        <g
                                            key={node.id}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setSelected(isSelected ? null : node)}
                                        >
                                            {/* Outer glow for selected */}
                                            {isSelected && (
                                                <circle
                                                    cx={node.cx}
                                                    cy={node.cy}
                                                    r={52}
                                                    fill="rgba(184,84,47,0.1)"
                                                    stroke="rgba(184,84,47,0.3)"
                                                    strokeWidth={1}
                                                />
                                            )}

                                            {/* Circle */}
                                            <circle
                                                cx={node.cx}
                                                cy={node.cy}
                                                r={40}
                                                fill={isSelected ? 'rgba(184,84,47,0.15)' : isConnected ? 'rgba(184,84,47,0.06)' : 'var(--vellum)'}
                                                stroke={isSelected ? 'var(--terracotta)' : isConnected ? 'rgba(184,84,47,0.4)' : 'var(--rule)'}
                                                strokeWidth={isSelected ? 2 : 1}
                                            />

                                            {/* ID label inside */}
                                            <text
                                                x={node.cx}
                                                y={node.cy + 4}
                                                textAnchor="middle"
                                                style={{
                                                    fontFamily: 'var(--mono)',
                                                    fontSize: 10,
                                                    fill: isSelected ? 'var(--terracotta)' : 'var(--muted)',
                                                    letterSpacing: '0.06em',
                                                }}
                                            >
                                                {node.id.length > 8 ? node.id.slice(0, 8) : node.id}
                                            </text>

                                            {/* Name label below */}
                                            <text
                                                x={node.cx}
                                                y={node.cy + 56}
                                                textAnchor="middle"
                                                style={{
                                                    fontFamily: 'var(--sans)',
                                                    fontSize: 11,
                                                    fill: isSelected ? 'var(--ink)' : 'var(--muted)',
                                                    fontWeight: isSelected ? 500 : 400,
                                                }}
                                            >
                                                {node.name.length > 12 ? node.name.slice(0, 12) + '…' : node.name}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>

                    {/* Detail panel */}
                    <div
                        style={{
                            width: 260,
                            flexShrink: 0,
                        }}
                    >
                        {selected ? (
                            <div className="steward-card">
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--rule)' }}>
                                    <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 400, color: 'var(--ink)', marginBottom: 2 }}>
                                        {selected.name}
                                    </div>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                                        {selected.id}
                                    </div>
                                </div>
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--rule)' }}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                                        Description
                                    </div>
                                    <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                                        {selected.description || 'No description.'}
                                    </p>
                                </div>
                                <div style={{ padding: '14px 16px', borderBottom: connectedTo.length > 0 ? '1px solid var(--rule)' : 'none' }}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                                        Capacity
                                    </div>
                                    <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, color: 'var(--ink)' }}>
                                        {selected.capacity.toLocaleString()}
                                    </div>
                                </div>
                                {connectedTo.length > 0 && (
                                    <div style={{ padding: '14px 16px' }}>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                                            Connected Regions ({connectedTo.length})
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {connectedTo.map((r) => (
                                                <div
                                                    key={r.id}
                                                    onClick={() => setSelected(r)}
                                                    style={{
                                                        fontSize: 13,
                                                        color: 'var(--terracotta)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                    }}
                                                >
                                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>→</span>
                                                    {r.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: '40px 16px',
                                    color: 'var(--muted)',
                                    fontFamily: 'var(--mono)',
                                    fontSize: 12,
                                    lineHeight: 1.6,
                                }}
                            >
                                Click a region node to view details.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </StewardShell>
    );
}
