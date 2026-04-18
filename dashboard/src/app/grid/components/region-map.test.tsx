/**
 * RegionMap tests (Plan 03-06 Task 1).
 *
 * Coverage:
 *   RM-1:  SVG root has viewBox, role="img", aria-label="Region map"
 *   RM-2:  renders one region-node <g> per region with <circle> + <text name>
 *   RM-3:  renders one <line data-edge> per connection (with both endpoints)
 *   RM-4:  given a PresenceStore entry, renders a nous-marker <g> translated
 *          to the spawn region center (computed via computeRegionLayout)
 *   RM-5:  on nous.moved, the SAME <g data-nous-did> element updates its
 *          transform (element identity preserved → CSS transition applies)
 *   RM-6:  marker has inline style transition: transform 150ms ease-out
 *   RM-7:  empty regions array renders empty SVG + sr-only "No regions loaded"
 *   RM-8:  connection referencing unknown region is silently skipped
 *   RM-9:  computeRegionLayout is deterministic (same input → same output)
 *   RM-10: computeRegionLayout clamps coordinates into [0.05, 0.95]²
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { StoresProvider, useStores } from '../use-stores';
import { RegionMap, computeRegionLayout } from './region-map';
import type { PresenceStore } from '@/lib/stores/presence-store';
import { makeAuditEntry, makeNousMovedEntry, resetFixtureIds } from '@/test/fixtures/ws-frames';
import type { Region, RegionConnection } from '@/lib/protocol/region-types';

const VIEWPORT_W = 720;
const VIEWPORT_H = 480;

const REGIONS: Region[] = [
    {
        id: 'region-a',
        name: 'Atrium',
        description: 'A',
        regionType: 'public',
        capacity: 10,
        properties: {},
    },
    {
        id: 'region-b',
        name: 'Belfry',
        description: 'B',
        regionType: 'public',
        capacity: 10,
        properties: {},
    },
    {
        id: 'region-c',
        name: 'Cloister',
        description: 'C',
        regionType: 'restricted',
        capacity: 5,
        properties: {},
    },
];

const CONNECTIONS: RegionConnection[] = [
    { fromRegion: 'region-a', toRegion: 'region-b', travelCost: 1, bidirectional: true },
    { fromRegion: 'region-b', toRegion: 'region-c', travelCost: 2, bidirectional: true },
];

function Wrapper({ children }: { children: ReactNode }) {
    return <StoresProvider>{children}</StoresProvider>;
}

/** Inline probe — captures the store triple so tests can ingest events. */
function Capture({
    capture,
    children,
}: {
    capture: { presence?: PresenceStore };
    children: ReactNode;
}) {
    const s = useStores();
    capture.presence = s.presence;
    return <>{children}</>;
}

describe('RegionMap', () => {
    beforeEach(() => resetFixtureIds());

    it('RM-1: svg root has viewBox, role="img", aria-label="Region map"', () => {
        const { container } = render(
            <RegionMap regions={REGIONS} connections={CONNECTIONS} />,
            { wrapper: Wrapper },
        );
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg!.getAttribute('viewBox')).toBe(`0 0 ${VIEWPORT_W} ${VIEWPORT_H}`);
        expect(svg!.getAttribute('role')).toBe('img');
        expect(svg!.getAttribute('aria-label')).toBe('Region map');
    });

    it('RM-2: renders one region-node group per region with circle + name text', () => {
        const { container } = render(
            <RegionMap regions={REGIONS} connections={CONNECTIONS} />,
            { wrapper: Wrapper },
        );
        const nodes = container.querySelectorAll('[data-testid="region-node"]');
        expect(nodes).toHaveLength(REGIONS.length);

        const layout = computeRegionLayout(REGIONS);
        for (const region of REGIONS) {
            const node = container.querySelector(
                `[data-testid="region-node"][data-region-id="${region.id}"]`,
            );
            expect(node).not.toBeNull();
            const circle = node!.querySelector('circle');
            expect(circle).not.toBeNull();
            const pos = layout.get(region.id)!;
            expect(Number(circle!.getAttribute('cx'))).toBeCloseTo(pos.x * VIEWPORT_W, 5);
            expect(Number(circle!.getAttribute('cy'))).toBeCloseTo(pos.y * VIEWPORT_H, 5);
            const text = node!.querySelector('text');
            expect(text).not.toBeNull();
            expect(text!.textContent).toBe(region.name);
        }
    });

    it('RM-3: renders one line per connection with both endpoints at region centers', () => {
        const { container } = render(
            <RegionMap regions={REGIONS} connections={CONNECTIONS} />,
            { wrapper: Wrapper },
        );
        const layout = computeRegionLayout(REGIONS);

        for (const c of CONNECTIONS) {
            const line = container.querySelector(`line[data-edge="${c.fromRegion}→${c.toRegion}"]`);
            expect(line).not.toBeNull();
            const a = layout.get(c.fromRegion)!;
            const b = layout.get(c.toRegion)!;
            expect(Number(line!.getAttribute('x1'))).toBeCloseTo(a.x * VIEWPORT_W, 5);
            expect(Number(line!.getAttribute('y1'))).toBeCloseTo(a.y * VIEWPORT_H, 5);
            expect(Number(line!.getAttribute('x2'))).toBeCloseTo(b.x * VIEWPORT_W, 5);
            expect(Number(line!.getAttribute('y2'))).toBeCloseTo(b.y * VIEWPORT_H, 5);
        }
    });

    it('RM-4: renders a nous-marker at its region center from PresenceStore', () => {
        const capture: { presence?: PresenceStore } = {};
        const { container } = render(
            <Capture capture={capture}>
                <RegionMap regions={REGIONS} connections={CONNECTIONS} />
            </Capture>,
            { wrapper: Wrapper },
        );

        act(() => {
            capture.presence!.applyEvent(
                makeAuditEntry({
                    eventType: 'nous.spawned',
                    actorDid: 'did:a',
                    payload: { name: 'Alice', region: 'region-a', ndsAddress: '' },
                }),
            );
        });

        const marker = container.querySelector('[data-testid="nous-marker"][data-nous-did="did:a"]');
        expect(marker).not.toBeNull();
        const layout = computeRegionLayout(REGIONS);
        const pos = layout.get('region-a')!;
        const expected = `translate(${pos.x * VIEWPORT_W}px, ${pos.y * VIEWPORT_H}px)`;
        expect((marker as SVGGElement).style.transform).toBe(expected);
    });

    it('RM-5: on nous.moved the SAME element updates its transform (identity preserved)', () => {
        const capture: { presence?: PresenceStore } = {};
        const { container } = render(
            <Capture capture={capture}>
                <RegionMap regions={REGIONS} connections={CONNECTIONS} />
            </Capture>,
            { wrapper: Wrapper },
        );

        act(() => {
            capture.presence!.applyEvent(
                makeAuditEntry({
                    eventType: 'nous.spawned',
                    actorDid: 'did:a',
                    payload: { name: 'Alice', region: 'region-a', ndsAddress: '' },
                }),
            );
        });

        const before = container.querySelector('[data-nous-did="did:a"]') as SVGGElement | null;
        expect(before).not.toBeNull();
        const layout = computeRegionLayout(REGIONS);
        const posA = layout.get('region-a')!;
        expect(before!.style.transform).toBe(
            `translate(${posA.x * VIEWPORT_W}px, ${posA.y * VIEWPORT_H}px)`,
        );

        act(() => {
            capture.presence!.applyEvent(
                makeNousMovedEntry('did:a', 'Alice', 'region-a', 'region-b'),
            );
        });

        const after = container.querySelector('[data-nous-did="did:a"]') as SVGGElement | null;
        expect(after).not.toBeNull();
        // Same DOM element — React reused the keyed node so CSS transition animates.
        expect(after).toBe(before);
        const posB = layout.get('region-b')!;
        expect(after!.style.transform).toBe(
            `translate(${posB.x * VIEWPORT_W}px, ${posB.y * VIEWPORT_H}px)`,
        );
    });

    it('RM-6: marker has inline style transition: transform 150ms ease-out', () => {
        const capture: { presence?: PresenceStore } = {};
        const { container } = render(
            <Capture capture={capture}>
                <RegionMap regions={REGIONS} connections={CONNECTIONS} />
            </Capture>,
            { wrapper: Wrapper },
        );

        act(() => {
            capture.presence!.applyEvent(
                makeAuditEntry({
                    eventType: 'nous.spawned',
                    actorDid: 'did:a',
                    payload: { name: 'Alice', region: 'region-a', ndsAddress: '' },
                }),
            );
        });

        const marker = container.querySelector(
            '[data-testid="nous-marker"][data-nous-did="did:a"]',
        ) as SVGGElement;
        // jsdom normalizes CSS; check for the transition substrings rather than exact value.
        const transition = marker.style.transition;
        expect(transition).toContain('transform');
        expect(transition).toContain('150ms');
        expect(transition).toContain('ease-out');
    });

    it('RM-7: empty regions array renders svg + sr-only "No regions loaded"', () => {
        const { container } = render(<RegionMap regions={[]} connections={[]} />, {
            wrapper: Wrapper,
        });
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        // No region nodes.
        expect(container.querySelectorAll('[data-testid="region-node"]')).toHaveLength(0);
        // Empty-state text exists.
        const text = container.querySelector('text.sr-only');
        expect(text).not.toBeNull();
        expect(text!.textContent).toBe('No regions loaded');
    });

    it('RM-8: connection referencing unknown region is silently skipped', () => {
        const broken: RegionConnection[] = [
            { fromRegion: 'region-a', toRegion: 'missing', travelCost: 1, bidirectional: true },
            { fromRegion: 'ghost', toRegion: 'region-b', travelCost: 1, bidirectional: true },
        ];
        const { container } = render(<RegionMap regions={REGIONS} connections={broken} />, {
            wrapper: Wrapper,
        });
        // Both edges skipped, no line rendered for them.
        expect(
            container.querySelector('line[data-edge="region-a→missing"]'),
        ).toBeNull();
        expect(
            container.querySelector('line[data-edge="ghost→region-b"]'),
        ).toBeNull();
        // Region nodes still render.
        expect(container.querySelectorAll('[data-testid="region-node"]')).toHaveLength(3);
    });

    it('RM-9: computeRegionLayout is deterministic for the same input', () => {
        const l1 = computeRegionLayout(REGIONS);
        const l2 = computeRegionLayout(REGIONS);
        for (const r of REGIONS) {
            expect(l2.get(r.id)).toEqual(l1.get(r.id));
        }
    });

    it('RM-10: computeRegionLayout clamps all coords to [0.05, 0.95]²', () => {
        // Include a much bigger set to exercise the full grid.
        const many: Region[] = Array.from({ length: 25 }, (_, i) => ({
            id: `r-${i}`,
            name: `R${i}`,
            description: '',
            regionType: 'public' as const,
            capacity: 1,
            properties: {},
        }));
        const layout = computeRegionLayout(many);
        for (const { x, y } of layout.values()) {
            expect(x).toBeGreaterThanOrEqual(0.05);
            expect(x).toBeLessThanOrEqual(0.95);
            expect(y).toBeGreaterThanOrEqual(0.05);
            expect(y).toBeLessThanOrEqual(0.95);
        }
    });
});
