/**
 * RelationshipsSection tests — tier-graded rendering (H1/H2/H5).
 *
 * Tests verify the following acceptance criteria (09-05-PLAN.md Task 2):
 * 1. H1 renders 'Top partners by weight' heading and max 5 rows.
 * 2. H1 renders 'No relationships yet.' when edges is empty.
 * 3. H1 shows warmth label (cold/warm/hot) but NO numeric valence/weight (T-09-21).
 * 4. H1 "Reveal numeric weights" button triggers ElevationDialog with target='H2'.
 * 5. H2 renders numeric valence/weight to 3 decimals per row.
 * 6. H2 renders 'Numeric weights available at H2 Reviewer.' caption.
 * 7. H2 "Inspect raw turns (H5)" click triggers ElevationDialog H5.
 * 8. H5 "Inspect raw turns (H5)" click opens EdgeEventsModal without ElevationDialog.
 * 9. warmth colors — all three hex values appear in H1 DOM output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RelationshipsH1Response, RelationshipsH2Response } from '@/lib/api/relationships';

// ---------------------------------------------------------------------------
// Hoisted mutable state — accessible inside vi.mock factory closures
// ---------------------------------------------------------------------------
const hoisted = vi.hoisted(() => {
    // Tier state
    let _tier = 'H1';
    const _tierListeners = new Set<() => void>();

    // SWR data
    let _h1Data: RelationshipsH1Response | undefined = undefined;
    let _h2Data: RelationshipsH2Response | undefined = undefined;

    // ElevationDialog capture
    let _elevation: { targetTier: string; open: boolean; onConfirm: () => void; onCancel: () => void } | null = null;

    // EdgeEventsModal capture
    let _modalOpen = false;
    let _modalEdgeKey = '';

    const mockStore = {
        subscribe: (cb: () => void) => {
            _tierListeners.add(cb);
            return () => _tierListeners.delete(cb);
        },
        getSnapshot: () => _tier as 'H1' | 'H2' | 'H5',
        setTier: (t: string) => {
            _tier = t;
            _tierListeners.forEach((l) => l());
        },
    };

    return {
        get tier() { return _tier; },
        set tier(v: string) { _tier = v; },
        get h1Data() { return _h1Data; },
        set h1Data(v: RelationshipsH1Response | undefined) { _h1Data = v; },
        get h2Data() { return _h2Data; },
        set h2Data(v: RelationshipsH2Response | undefined) { _h2Data = v; },
        get elevation() { return _elevation; },
        set elevation(v: typeof _elevation) { _elevation = v; },
        get modalOpen() { return _modalOpen; },
        set modalOpen(v: boolean) { _modalOpen = v; },
        get modalEdgeKey() { return _modalEdgeKey; },
        set modalEdgeKey(v: string) { _modalEdgeKey = v; },
        mockStore,
    };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/stores/tick-store', () => ({ useTick: () => 0 }));

vi.mock('@/lib/hooks/use-relationships', () => ({
    useRelationshipsH1: () => ({ data: hoisted.h1Data, isLoading: false, error: undefined }),
    useRelationshipsH2: () => ({ data: hoisted.h2Data, isLoading: false, error: undefined }),
}));

vi.mock('@/lib/stores/agency-store', () => ({
    agencyStore: hoisted.mockStore,
    getOperatorId: () => 'op:test-operator-id',
}));

vi.mock('@/components/agency/elevation-dialog', () => ({
    ElevationDialog: (props: {
        targetTier: string;
        open: boolean;
        onConfirm: () => void;
        onCancel: () => void;
    }) => {
        hoisted.elevation = props;
        return (
            <div data-testid="elevation-dialog" data-target-tier={props.targetTier}>
                <button data-testid="elevation-confirm" onClick={props.onConfirm}>Confirm</button>
                <button data-testid="elevation-cancel" onClick={props.onCancel}>Cancel</button>
            </div>
        );
    },
}));

vi.mock('@/app/grid/components/inspector-sections/edge-events-modal', () => ({
    EdgeEventsModal: (props: { edgeKey: string; onClose: () => void }) => {
        hoisted.modalOpen = true;
        hoisted.modalEdgeKey = props.edgeKey;
        return (
            <div data-testid="edge-events-modal" data-edge-key={props.edgeKey}>
                <button data-testid="edge-events-close" onClick={props.onClose}>Close</button>
            </div>
        );
    },
}));

import { RelationshipsSection } from './relationships';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeH1Response(edges: RelationshipsH1Response['edges']): RelationshipsH1Response {
    return { did: 'did:noesis:test', edges, observed_at_tick: 100, top_n: 5 };
}

function makeH2Response(edges: RelationshipsH2Response['edges']): RelationshipsH2Response {
    return { did: 'did:noesis:test', edges, observed_at_tick: 100, top_n: 5 };
}

const SAMPLE_H1_EDGES: RelationshipsH1Response['edges'] = [
    { counterparty_did: 'did:noesis:alpha', warmth_bucket: 'cold', recency_tick: 10, edge_hash: 'hash-a' },
    { counterparty_did: 'did:noesis:beta',  warmth_bucket: 'warm', recency_tick: 20, edge_hash: 'hash-b' },
    { counterparty_did: 'did:noesis:gamma', warmth_bucket: 'hot',  recency_tick: 30, edge_hash: 'hash-c' },
];

const SAMPLE_H2_EDGES: RelationshipsH2Response['edges'] = [
    {
        counterparty_did: 'did:noesis:alpha',
        valence: 0.420,
        weight: 0.780,
        recency_tick: 10,
        last_event_hash: 'abcdef01',
        warmth_bucket: 'warm',
        edge_hash: 'hash-a',
    },
    {
        counterparty_did: 'did:noesis:beta',
        valence: -0.130,
        weight: 0.250,
        recency_tick: 20,
        last_event_hash: 'bcdef012',
        warmth_bucket: 'cold',
        edge_hash: 'hash-b',
    },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RelationshipsSection', () => {
    beforeEach(() => {
        hoisted.h1Data = undefined;
        hoisted.h2Data = undefined;
        hoisted.tier = 'H1';
        hoisted.elevation = null;
        hoisted.modalOpen = false;
        hoisted.modalEdgeKey = '';
    });

    // -----------------------------------------------------------------------
    // Test 1: H1 renders heading and max 5 rows
    // -----------------------------------------------------------------------
    it('H1: renders "Top partners by weight" heading and up to 5 rows', () => {
        const sixEdges: RelationshipsH1Response['edges'] = Array.from({ length: 6 }, (_, i) => ({
            counterparty_did: `did:noesis:nous-${i}`,
            warmth_bucket: 'cold' as const,
            recency_tick: i,
            edge_hash: `hash-${i}`,
        }));
        hoisted.h1Data = makeH1Response(sixEdges);
        hoisted.tier = 'H1';

        render(<RelationshipsSection did="did:noesis:test" />);

        expect(screen.getByText('Top partners by weight')).toBeTruthy();
        const rows = screen.getAllByTestId(/^relationship-row-/);
        expect(rows.length).toBeLessThanOrEqual(5);
    });

    // -----------------------------------------------------------------------
    // Test 2: H1 empty state
    // -----------------------------------------------------------------------
    it('H1: renders "No relationships yet." when edges is empty', () => {
        hoisted.h1Data = makeH1Response([]);
        hoisted.tier = 'H1';

        render(<RelationshipsSection did="did:noesis:test" />);

        expect(screen.getByText('No relationships yet.')).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Test 3: H1 shows warmth labels but ZERO numeric values (T-09-21)
    // -----------------------------------------------------------------------
    it('H1: shows warmth bucket labels but NO numeric valence/weight in DOM (T-09-21)', () => {
        hoisted.h1Data = makeH1Response(SAMPLE_H1_EDGES);
        hoisted.tier = 'H1';

        const { container } = render(<RelationshipsSection did="did:noesis:test" />);

        expect(container.textContent).toMatch(/cold/);
        expect(container.textContent).toMatch(/warm/);
        expect(container.textContent).toMatch(/hot/);

        // No numeric patterns like 0.420, -0.130 (3 decimal places)
        const numericMatches = container.textContent?.match(/[+-]?\d+\.\d{3}/g);
        expect(numericMatches).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Test 4: H1 "Reveal numeric weights" triggers ElevationDialog H2
    // -----------------------------------------------------------------------
    it('H1: "Reveal numeric weights" triggers ElevationDialog with targetTier=H2', () => {
        hoisted.h1Data = makeH1Response(SAMPLE_H1_EDGES);
        hoisted.tier = 'H1';

        render(<RelationshipsSection did="did:noesis:test" />);

        const revealBtn = screen.getByTestId('relationships-elevate-h2');
        fireEvent.click(revealBtn);

        expect(hoisted.elevation).not.toBeNull();
        expect(hoisted.elevation!.targetTier).toBe('H2');
        expect(hoisted.elevation!.open).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Test 5: H2 renders numeric valence/weight to 3 decimals
    // -----------------------------------------------------------------------
    it('H2: renders numeric valence/weight to 3 decimals per row', () => {
        hoisted.h2Data = makeH2Response(SAMPLE_H2_EDGES);
        hoisted.tier = 'H2';

        render(<RelationshipsSection did="did:noesis:test" />);

        expect(screen.getByText(/valence \+0\.420 · weight 0\.780/)).toBeTruthy();
        expect(screen.getByText(/valence -0\.130 · weight 0\.250/)).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Test 6: H2 renders 'Numeric weights available at H2 Reviewer.' caption
    // -----------------------------------------------------------------------
    it('H2: renders "Numeric weights available at H2 Reviewer." caption', () => {
        hoisted.h2Data = makeH2Response(SAMPLE_H2_EDGES);
        hoisted.tier = 'H2';

        render(<RelationshipsSection did="did:noesis:test" />);

        expect(screen.getByText('Numeric weights available at H2 Reviewer.')).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Test 7: H2 "Inspect raw turns (H5)" triggers ElevationDialog H5
    // -----------------------------------------------------------------------
    it('H2: "Inspect raw turns (H5)" click triggers ElevationDialog with targetTier=H5', () => {
        hoisted.h2Data = makeH2Response(SAMPLE_H2_EDGES);
        hoisted.tier = 'H2';

        render(<RelationshipsSection did="did:noesis:test" />);

        const inspectBtn = screen.getByTestId('relationship-inspect-h5-0');
        fireEvent.click(inspectBtn);

        expect(hoisted.elevation).not.toBeNull();
        expect(hoisted.elevation!.targetTier).toBe('H5');
        expect(hoisted.elevation!.open).toBe(true);
        // Modal should NOT be open yet (before H5 confirmation)
        expect(hoisted.modalOpen).toBe(false);
    });

    // -----------------------------------------------------------------------
    // Test 8: H5 "Inspect raw turns (H5)" opens EdgeEventsModal directly
    // -----------------------------------------------------------------------
    it('H5: "Inspect raw turns (H5)" opens EdgeEventsModal without ElevationDialog', () => {
        hoisted.h2Data = makeH2Response(SAMPLE_H2_EDGES);
        hoisted.tier = 'H5';

        render(<RelationshipsSection did="did:noesis:test" />);

        const inspectBtn = screen.getByTestId('relationship-inspect-h5-0');
        fireEvent.click(inspectBtn);

        // No ElevationDialog captured at H5
        expect(hoisted.elevation).toBeNull();
        // Modal opens immediately
        expect(hoisted.modalOpen).toBe(true);
        expect(hoisted.modalEdgeKey).toBe('hash-a');
    });

    // -----------------------------------------------------------------------
    // Test 9: Warmth colors present in H1 DOM output (via data-warmth-hex attr)
    // -----------------------------------------------------------------------
    it('H1: all three warmth hex colors appear in DOM (#9ca3af, #f59e0b, #e11d48)', () => {
        hoisted.h1Data = makeH1Response(SAMPLE_H1_EDGES);
        hoisted.tier = 'H1';

        const { container } = render(<RelationshipsSection did="did:noesis:test" />);

        // data-warmth-hex attributes carry the hex string without CSS rgb() conversion
        const html = container.innerHTML;
        expect(html).toContain('data-warmth-hex="#9ca3af"');
        expect(html).toContain('data-warmth-hex="#f59e0b"');
        expect(html).toContain('data-warmth-hex="#e11d48"');
    });
});
