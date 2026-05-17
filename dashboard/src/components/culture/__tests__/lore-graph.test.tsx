import React from 'react';
import { render, screen } from '@testing-library/react';

// Component under test — created in Wave 2 Plan 05
// import { LoreGraph } from '../lore-graph';

vi.mock('swr');

describe('LoreGraph', () => {
    it.todo('renders loading state when SWR isLoading=true');
    it.todo('renders error state when SWR error is set');
    it.todo('renders EmptyState when entries is empty array');
    it.todo('renders SVG with data-testid="lore-graph-svg" when data has entries');
    it.todo('renders Nous column node circles at x=150');
    it.todo('renders lore entry column node circles at x=850');
    it.todo('renders solid edge for lore.contributed with correct title');
    it.todo('renders dashed edge for lore.cited (strokeDasharray="4 2")');
    it.todo('renders <title> on each Nous node with full DID');
    it.todo('renders <title> on each lore node with full content_hash');
});
