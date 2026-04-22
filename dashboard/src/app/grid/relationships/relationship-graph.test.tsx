/**
 * RelationshipGraph tests — SVG render with server-provided {x, y} positions.
 *
 * Tests verify (09-05-PLAN.md Task 3):
 * 1. Renders 'Relationship Graph' h1 (via page.tsx integration render).
 * 2. Renders 'Warmth and weight derived from dialogue and trade events. Read-only.' hint.
 * 3. Loading state renders 'Loading graph…' with role="status".
 * 4. Error state renders 'Graph could not be loaded.' with role="alert".
 * 5. Given 3 nodes + 2 edges, <circle> count === 3 and <line> count === 2.
 * 6. Edge color matches warmth_bucket: cold=#9ca3af, hot=#e11d48.
 * 7. Edges with missing source/target nodes are skipped (defensive).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GraphResponse } from '@/lib/api/relationships';

// ---------------------------------------------------------------------------
// Mock tick store and SWR hook
// ---------------------------------------------------------------------------
vi.mock('@/lib/stores/tick-store', () => ({ useTick: () => 0 }));

const hoisted = vi.hoisted(() => {
    let _graphData: GraphResponse | undefined = undefined;
    let _isLoading = false;
    let _error: Error | undefined = undefined;

    return {
        get graphData() { return _graphData; },
        set graphData(v: GraphResponse | undefined) { _graphData = v; },
        get isLoading() { return _isLoading; },
        set isLoading(v: boolean) { _isLoading = v; },
        get error() { return _error; },
        set error(v: Error | undefined) { _error = v; },
    };
});

vi.mock('@/lib/hooks/use-relationships', () => ({
    useGraph: () => ({
        data: hoisted.graphData,
        isLoading: hoisted.isLoading,
        error: hoisted.error,
    }),
    useRelationshipsH1: () => ({ data: undefined, isLoading: false, error: undefined }),
    useRelationshipsH2: () => ({ data: undefined, isLoading: false, error: undefined }),
}));

import { RelationshipGraph } from './relationship-graph';
import RelationshipsPage from './page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGraph(
    nodes: Array<{ did: string; x: number; y: number }>,
    edges: Array<{ source_did: string; target_did: string; warmth_bucket: 'cold' | 'warm' | 'hot' }>,
): GraphResponse {
    return { nodes, edges, observed_at_tick: 100 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RelationshipGraph + RelationshipsPage', () => {
    beforeEach(() => {
        hoisted.graphData = undefined;
        hoisted.isLoading = false;
        hoisted.error = undefined;
    });

    // -----------------------------------------------------------------------
    // Test 1: Page h1 renders 'Relationship Graph'
    // -----------------------------------------------------------------------
    it('renders "Relationship Graph" h1 on the page', () => {
        hoisted.graphData = makeGraph([], []);

        render(<RelationshipsPage />);

        expect(screen.getByRole('heading', { name: /Relationship Graph/i })).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Test 2: Subtitle copy lock
    // -----------------------------------------------------------------------
    it('renders verbatim subtitle: "Warmth and weight derived from dialogue and trade events. Read-only."', () => {
        hoisted.graphData = makeGraph([], []);

        render(<RelationshipsPage />);

        expect(
            screen.getByText('Warmth and weight derived from dialogue and trade events. Read-only.'),
        ).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Test 3: Loading state
    // -----------------------------------------------------------------------
    it('loading state renders "Loading graph…" with role="status"', () => {
        hoisted.isLoading = true;
        hoisted.graphData = undefined;

        render(<RelationshipGraph />);

        const status = screen.getByRole('status');
        expect(status.textContent).toMatch(/Loading graph/);
    });

    // -----------------------------------------------------------------------
    // Test 4: Error state
    // -----------------------------------------------------------------------
    it('error state renders "Graph could not be loaded." with role="alert"', () => {
        hoisted.error = new Error('network');
        hoisted.graphData = undefined;

        render(<RelationshipGraph />);

        const alert = screen.getByRole('alert');
        expect(alert.textContent).toMatch(/Graph could not be loaded/);
    });

    // -----------------------------------------------------------------------
    // Test 5: circle count === nodes.length, line count === valid edges
    // -----------------------------------------------------------------------
    it('renders correct <circle> and <line> counts for 3 nodes + 2 edges', () => {
        hoisted.graphData = makeGraph(
            [
                { did: 'did:noesis:a', x: 100, y: 200 },
                { did: 'did:noesis:b', x: 300, y: 400 },
                { did: 'did:noesis:c', x: 500, y: 600 },
            ],
            [
                { source_did: 'did:noesis:a', target_did: 'did:noesis:b', warmth_bucket: 'warm' },
                { source_did: 'did:noesis:b', target_did: 'did:noesis:c', warmth_bucket: 'hot' },
            ],
        );

        const { container } = render(<RelationshipGraph />);

        const circles = container.querySelectorAll('circle');
        const lines = container.querySelectorAll('line');
        expect(circles).toHaveLength(3);
        expect(lines).toHaveLength(2);
    });

    // -----------------------------------------------------------------------
    // Test 6: Edge stroke color matches warmth_bucket
    // -----------------------------------------------------------------------
    it('edge stroke color matches warmth_bucket: cold=#9ca3af, hot=#e11d48', () => {
        hoisted.graphData = makeGraph(
            [
                { did: 'did:noesis:a', x: 100, y: 100 },
                { did: 'did:noesis:b', x: 200, y: 200 },
                { did: 'did:noesis:c', x: 300, y: 300 },
            ],
            [
                { source_did: 'did:noesis:a', target_did: 'did:noesis:b', warmth_bucket: 'cold' },
                { source_did: 'did:noesis:b', target_did: 'did:noesis:c', warmth_bucket: 'hot' },
            ],
        );

        const { container } = render(<RelationshipGraph />);

        const lines = container.querySelectorAll('line');
        expect(lines).toHaveLength(2);

        const strokes = Array.from(lines).map((l) => l.getAttribute('stroke'));
        expect(strokes).toContain('#9ca3af');
        expect(strokes).toContain('#e11d48');
    });

    // -----------------------------------------------------------------------
    // Test 7: Dangling edges (missing node) are skipped
    // -----------------------------------------------------------------------
    it('skips edges whose source_did or target_did is missing from nodes', () => {
        hoisted.graphData = makeGraph(
            [
                { did: 'did:noesis:a', x: 100, y: 100 },
                { did: 'did:noesis:b', x: 200, y: 200 },
            ],
            [
                // valid edge
                { source_did: 'did:noesis:a', target_did: 'did:noesis:b', warmth_bucket: 'warm' },
                // dangling edge — did:noesis:missing does not exist in nodes
                { source_did: 'did:noesis:a', target_did: 'did:noesis:missing', warmth_bucket: 'cold' },
            ],
        );

        const { container } = render(<RelationshipGraph />);

        // Only 1 valid edge should render; dangling edge is null → filtered by React
        const lines = container.querySelectorAll('line');
        expect(lines).toHaveLength(1);
    });
});
