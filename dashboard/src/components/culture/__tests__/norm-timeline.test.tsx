import React from 'react';
import { render, screen } from '@testing-library/react';

// Component under test — created in Wave 2 Plan 05
// import { NormTimeline } from '../norm-timeline';

vi.mock('swr');

describe('NormTimeline', () => {
    it.todo('renders loading state when SWR isLoading=true');
    it.todo('renders error state when SWR error is set');
    it.todo('renders EmptyState when data.norms is empty array');
    it.todo('renders SVG with data-testid="norm-timeline-svg" when data has norms');
    it.todo('renders <rect> element for each norm');
    it.todo('renders emergent label text for convergence_type=emergent norm');
    it.todo('renders coincidental label text for convergence_type=coincidental norm');
    it.todo('renders participant_count Nous label for each norm');
    it.todo('renders <title> on each rect with fingerprint and convergence_type');
});
