import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoreGraph } from '../lore-graph';
import { useLoreGraph } from '@/lib/hooks/use-culture';

vi.mock('@/lib/hooks/use-culture');
const mockUseLoreGraph = useLoreGraph as ReturnType<typeof vi.fn>;

const loreGraphData = {
    loreEntries: [{
        contributor_did: 'did:noesis:sophia',
        tick: 100,
        content_hash: 'sha256:abcdef1234567890',
        category_tag: 'observation',
        citation_count: 2,
    }],
    loreCitations: [{
        citing_did: 'did:noesis:kai',
        content_hash: 'sha256:abcdef1234567890',
        tick: 150,
    }],
};

describe('LoreGraph', () => {
    it('renders loading state when SWR isLoading=true', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: true, error: undefined, data: undefined });
        render(<LoreGraph />);
        expect(screen.getByText('Loading lore graph…')).toBeTruthy();
    });

    it('renders error state when SWR error is set', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: false, error: new Error('fail'), data: undefined });
        render(<LoreGraph />);
        expect(screen.getByText('Lore graph could not be loaded.')).toBeTruthy();
    });

    it('renders EmptyState when loreEntries and loreCitations are empty', () => {
        mockUseLoreGraph.mockReturnValue({
            isLoading: false, error: undefined,
            data: { loreEntries: [], loreCitations: [] },
        });
        const { container } = render(<LoreGraph />);
        expect(screen.getByText('No lore yet.')).toBeTruthy();
        expect(container.querySelector('[data-testid="lore-graph-svg"]')).toBeNull();
    });

    it('renders SVG with data-testid="lore-graph-svg" when data has entries', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: false, error: undefined, data: loreGraphData });
        const { container } = render(<LoreGraph />);
        expect(container.querySelector('[data-testid="lore-graph-svg"]')).toBeTruthy();
    });

    it('renders Nous column node circle at cx=150', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: false, error: undefined, data: loreGraphData });
        const { container } = render(<LoreGraph />);
        const circles = container.querySelectorAll('circle');
        // First circle encountered is a Nous node (rendered first in DOM)
        const nousCircle = Array.from(circles).find(c => c.getAttribute('cx') === '150');
        expect(nousCircle).toBeTruthy();
    });

    it('renders lore entry column node circle at cx=850', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: false, error: undefined, data: loreGraphData });
        const { container } = render(<LoreGraph />);
        const circles = container.querySelectorAll('circle');
        const loreCircle = Array.from(circles).find(c => c.getAttribute('cx') === '850');
        expect(loreCircle).toBeTruthy();
    });

    it('renders solid contributed edge (no strokeDasharray)', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: false, error: undefined, data: loreGraphData });
        const { container } = render(<LoreGraph />);
        const lines = container.querySelectorAll('line');
        const solidLine = Array.from(lines).find(l => !l.getAttribute('strokeDasharray'));
        expect(solidLine).toBeTruthy();
    });

    it('renders dashed cited edge with strokeDasharray="4 2"', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: false, error: undefined, data: loreGraphData });
        const { container } = render(<LoreGraph />);
        const lines = container.querySelectorAll('line');
        // React serializes SVG camelCase props to hyphenated DOM attributes
        const dashedLine = Array.from(lines).find(
            l => l.getAttribute('stroke-dasharray') === '4 2' || l.getAttribute('strokeDasharray') === '4 2'
        );
        expect(dashedLine).toBeTruthy();
    });

    it('renders <title> on Nous node with full contributor_did', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: false, error: undefined, data: loreGraphData });
        const { container } = render(<LoreGraph />);
        // Find the <g> element that is a Nous node (contains a circle at cx=150)
        const svg = container.querySelector('[data-testid="lore-graph-svg"]')!;
        const nousGroup = Array.from(svg.querySelectorAll('g')).find(g => {
            const circle = g.querySelector('circle');
            return circle?.getAttribute('cx') === '150';
        });
        const title = nousGroup?.querySelector('title');
        expect(title?.textContent).toBe('did:noesis:sophia');
    });

    it('renders <title> on lore node with full content_hash', () => {
        mockUseLoreGraph.mockReturnValue({ isLoading: false, error: undefined, data: loreGraphData });
        const { container } = render(<LoreGraph />);
        const svg = container.querySelector('[data-testid="lore-graph-svg"]')!;
        const loreGroup = Array.from(svg.querySelectorAll('g')).find(g => {
            const circle = g.querySelector('circle');
            return circle?.getAttribute('cx') === '850';
        });
        const title = loreGroup?.querySelector('title');
        expect(title?.textContent).toBe('sha256:abcdef1234567890');
    });
});
