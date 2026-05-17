import React from 'react';
import { render, screen } from '@testing-library/react';
import { NormTimeline } from '../norm-timeline';
import { useNorms } from '@/lib/hooks/use-culture';

vi.mock('@/lib/hooks/use-culture');
const mockUseNorms = useNorms as ReturnType<typeof vi.fn>;

const singleNorm = {
    norm_id: 'uuid-1',
    fingerprint: 'a1b2c3',
    crystallized_tick: 450,
    participant_count: 4,
    convergence_type: 'emergent' as const,
    evidence_tick_range: [410, 450] as [number, number],
};
const normsData = { norms: [singleNorm] };

describe('NormTimeline', () => {
    it('renders loading state when SWR isLoading=true', () => {
        mockUseNorms.mockReturnValue({ isLoading: true, error: undefined, data: undefined });
        render(<NormTimeline />);
        expect(screen.getByText('Loading norm timeline…')).toBeTruthy();
    });

    it('renders error state when SWR error is set', () => {
        mockUseNorms.mockReturnValue({ isLoading: false, error: new Error('fail'), data: undefined });
        render(<NormTimeline />);
        expect(screen.getByText('Norm timeline could not be loaded.')).toBeTruthy();
    });

    it('renders EmptyState when data.norms is empty array', () => {
        mockUseNorms.mockReturnValue({ isLoading: false, error: undefined, data: { norms: [] } });
        const { container } = render(<NormTimeline />);
        expect(screen.getByText('No norms yet.')).toBeTruthy();
        expect(container.querySelector('[data-testid="norm-timeline-svg"]')).toBeNull();
    });

    it('renders SVG with data-testid="norm-timeline-svg" when data has norms', () => {
        mockUseNorms.mockReturnValue({ isLoading: false, error: undefined, data: normsData });
        const { container } = render(<NormTimeline />);
        expect(container.querySelector('[data-testid="norm-timeline-svg"]')).toBeTruthy();
    });

    it('renders <rect> element for emergent norm with fill="#7DD3FC"', () => {
        mockUseNorms.mockReturnValue({ isLoading: false, error: undefined, data: normsData });
        const { container } = render(<NormTimeline />);
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBeGreaterThan(0);
        expect(rects[0].getAttribute('fill')).toBe('#7DD3FC');
    });

    it('renders <rect> with fill="#9CA3AF" for coincidental norm', () => {
        const coincidentalNorm = { ...singleNorm, convergence_type: 'coincidental' as const };
        mockUseNorms.mockReturnValue({ isLoading: false, error: undefined, data: { norms: [coincidentalNorm] } });
        const { container } = render(<NormTimeline />);
        const rects = container.querySelectorAll('rect');
        expect(rects[0].getAttribute('fill')).toBe('#9CA3AF');
    });

    it('renders participant_count as "{N} Nous" label', () => {
        mockUseNorms.mockReturnValue({ isLoading: false, error: undefined, data: normsData });
        render(<NormTimeline />);
        // The SVG text label contains "4 Nous · emergent" — getAllByText returns all matches
        const elements = screen.getAllByText(/4 Nous/);
        expect(elements.length).toBeGreaterThan(0);
    });

    it('renders convergence_type as text label in SVG', () => {
        mockUseNorms.mockReturnValue({ isLoading: false, error: undefined, data: normsData });
        render(<NormTimeline />);
        // getAllByText handles multiple matches (SVG label + legend)
        const elements = screen.getAllByText(/emergent/);
        expect(elements.length).toBeGreaterThan(0);
    });

    it('renders <title> on rect with fingerprint, convergence_type, Nous count, duration', () => {
        mockUseNorms.mockReturnValue({ isLoading: false, error: undefined, data: normsData });
        const { container } = render(<NormTimeline />);
        const rects = container.querySelectorAll('rect');
        const title = rects[0].querySelector('title');
        expect(title?.textContent).toBe('a1b2c3 — emergent — 4 Nous — 40 ticks');
    });
});
