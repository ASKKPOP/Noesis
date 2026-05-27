/**
 * Phase 36 Wave 0 — CivicMap SVG component test.
 *
 * Asserts:
 * - SVG renders exactly 6 <polygon> elements (D-V3-32 six-zone invariant).
 * - Each of the 6 zone labels is present in the rendered text.
 * - SVG has role="img" with aria-label containing 'Civic Map'.
 *
 * Tests fail RED because the CivicMap component does not exist yet (Plan 06).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CivicMap from './CivicMap';

// D-V3-32 zone names — exactly these 6, in this order.
const SIX_ZONE_NAMES = [
    'Business',
    'Manufacture',
    'Shopping',
    'Residential',
    'Infrastructure',
    'Government Quarter',
] as const;

// Mock zone data matching the 6-zone invariant (D-V3-32).
const mockZones = SIX_ZONE_NAMES.map((label, i) => ({
    id: `zone-${i}`,
    label,
    polygon: `${i * 100},0 ${i * 100 + 80},0 ${i * 100 + 80},80 ${i * 100},80`,
    fillColor: '#15151a',
    strokeColor: '#2a2a34',
    labelX: i * 100 + 40,
    labelY: 40,
    taxRate: 5,
}));

// Mock Nous avatars.
const mockNous = [
    {
        civic_did_hash: 'did:civic:noesis:gen-001',
        display_name: 'Sophia',
        type: 'A',
        status: 'online',
        x: 150,
        y: 150,
    },
    {
        civic_did_hash: 'did:civic:noesis:gen-002',
        display_name: 'Hermes',
        type: 'B',
        status: 'offline',
        x: 300,
        y: 200,
    },
];

describe('CivicMap — SVG structure (D-V3-32)', () => {
    it('renders exactly 6 <polygon> elements (one per zone)', () => {
        const { container } = render(<CivicMap zones={mockZones} nous={mockNous} />);
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(6);
    });

    it.each(SIX_ZONE_NAMES)('renders zone label "%s" in the SVG', (zoneName) => {
        const { getByText } = render(<CivicMap zones={mockZones} nous={mockNous} />);
        expect(getByText(zoneName)).toBeTruthy();
    });

    it('SVG has role="img"', () => {
        const { container } = render(<CivicMap zones={mockZones} nous={mockNous} />);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg!.getAttribute('role')).toBe('img');
    });

    it('SVG aria-label contains "Civic Map"', () => {
        const { container } = render(<CivicMap zones={mockZones} nous={mockNous} />);
        const svg = container.querySelector('svg');
        expect(svg!.getAttribute('aria-label')).toContain('Civic Map');
    });
});
