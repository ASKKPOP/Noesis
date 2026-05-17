import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillLineageGraph } from '../skill-lineage-graph';
import { useSkillLineage } from '@/lib/hooks/use-culture';

vi.mock('@/lib/hooks/use-culture');
const mockUseSkillLineage = useSkillLineage as ReturnType<typeof vi.fn>;

const NOUS_NODE = { id: 'did:noesis:sophia', label: 'sophia', type: 'nous' as const, x: 100, y: 50 };
const SKILL_NODE = { id: 'sha256:a1b2c3def456', label: 'a1b2c3', type: 'skill' as const, x: 200, y: 150 };
const TAUGHT_EDGE = { source: 'did:noesis:sophia', target: 'sha256:a1b2c3def456', tick: 42, type: 'taught' as const };
const INFERRED_EDGE = { source: 'did:noesis:sophia', target: 'sha256:a1b2c3def456', tick: 7, type: 'inferred' as const };

describe('SkillLineageGraph', () => {
    it('renders loading state when SWR isLoading=true', () => {
        mockUseSkillLineage.mockReturnValue({ data: undefined, isLoading: true, error: undefined });
        render(<SkillLineageGraph />);
        const el = screen.getByRole('status');
        expect(el.textContent).toContain('Loading skill lineage…');
    });

    it('renders error state when SWR error is set', () => {
        mockUseSkillLineage.mockReturnValue({ data: undefined, isLoading: false, error: new Error('net') });
        render(<SkillLineageGraph />);
        const el = screen.getByRole('alert');
        expect(el.textContent).toContain('Skill lineage could not be loaded.');
    });

    it('renders EmptyState when data.nodes is empty array', () => {
        mockUseSkillLineage.mockReturnValue({ data: { nodes: [], edges: [] }, isLoading: false, error: undefined });
        render(<SkillLineageGraph />);
        expect(screen.getByText('No skill events yet.')).toBeTruthy();
    });

    it('renders SVG with data-testid="skill-lineage-svg" when data has nodes', () => {
        mockUseSkillLineage.mockReturnValue({
            data: { nodes: [NOUS_NODE], edges: [] },
            isLoading: false,
            error: undefined,
        });
        const { container } = render(<SkillLineageGraph />);
        expect(container.querySelector('[data-testid="skill-lineage-svg"]')).toBeTruthy();
    });

    it('renders <circle> elements for each node', () => {
        mockUseSkillLineage.mockReturnValue({
            data: { nodes: [NOUS_NODE, SKILL_NODE], edges: [] },
            isLoading: false,
            error: undefined,
        });
        const { container } = render(<SkillLineageGraph />);
        const circles = container.querySelectorAll('circle');
        expect(circles).toHaveLength(2);
    });

    it('renders solid edge for skill.taught type (no strokeDasharray)', () => {
        mockUseSkillLineage.mockReturnValue({
            data: { nodes: [NOUS_NODE, SKILL_NODE], edges: [TAUGHT_EDGE] },
            isLoading: false,
            error: undefined,
        });
        const { container } = render(<SkillLineageGraph />);
        const line = container.querySelector('line');
        expect(line).toBeTruthy();
        expect(line!.getAttribute('stroke-dasharray')).toBeNull();
    });

    it('renders dashed edge for skill.inferred type (strokeDasharray="4 2")', () => {
        mockUseSkillLineage.mockReturnValue({
            data: { nodes: [NOUS_NODE, SKILL_NODE], edges: [INFERRED_EDGE] },
            isLoading: false,
            error: undefined,
        });
        const { container } = render(<SkillLineageGraph />);
        const line = container.querySelector('line');
        expect(line).toBeTruthy();
        expect(line!.getAttribute('stroke-dasharray')).toBe('4 2');
    });

    it('renders <title> on each node with full DID or hash', () => {
        mockUseSkillLineage.mockReturnValue({
            data: { nodes: [NOUS_NODE, SKILL_NODE], edges: [] },
            isLoading: false,
            error: undefined,
        });
        const { container } = render(<SkillLineageGraph />);
        const titles = container.querySelectorAll('g > title');
        const titleTexts = Array.from(titles).map((t) => t.textContent);
        expect(titleTexts).toContain('did:noesis:sophia');
        expect(titleTexts).toContain('sha256:a1b2c3def456');
    });

    it('renders <title> on each edge with tick number', () => {
        mockUseSkillLineage.mockReturnValue({
            data: { nodes: [NOUS_NODE, SKILL_NODE], edges: [TAUGHT_EDGE] },
            isLoading: false,
            error: undefined,
        });
        const { container } = render(<SkillLineageGraph />);
        const lineTitles = container.querySelectorAll('line > title');
        expect(lineTitles).toHaveLength(1);
        expect(lineTitles[0].textContent).toBe('tick 42');
    });
});
