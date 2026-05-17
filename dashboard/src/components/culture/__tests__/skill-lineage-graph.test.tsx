import React from 'react';
import { render, screen } from '@testing-library/react';

// Component under test — created in Wave 2 Plan 04
// import { SkillLineageGraph } from '../skill-lineage-graph';

vi.mock('swr');

describe('SkillLineageGraph', () => {
    it.todo('renders loading state when SWR isLoading=true');
    it.todo('renders error state when SWR error is set');
    it.todo('renders EmptyState when data.nodes is empty array');
    it.todo('renders SVG with data-testid="skill-lineage-svg" when data has nodes');
    it.todo('renders <circle> elements for each node');
    it.todo('renders <line> elements for each edge');
    it.todo('renders dashed edge for skill.inferred type (strokeDasharray="4 2")');
    it.todo('renders solid edge for skill.taught type (no strokeDasharray)');
    it.todo('renders <title> on each node with full DID or hash');
    it.todo('renders <title> on each edge with tick number');
});
