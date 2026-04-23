/**
 * Plan 10b-06 Task 2 — BiosSection DOM contract tests.
 *
 * Covers:
 *   - pending state (did === null → "{need} pending" aria-labels)
 *   - 18-case aria-label matrix: 2 needs × 3 levels × 3 direction states
 *     (rising, falling, null/stable)
 *   - no numeric values rendered anywhere in the Bios section
 *
 * All tests mock useBiosLevels — the hook is exercised separately via
 * the firehose filter tests.
 *
 * Aria-label grammar (BIOS, not Ananke):
 *   "{need} {level}"                  — stable (direction=null)
 *   "{need} {level} {direction}"      — crossing in flight
 *   "{need} pending"                  — no Nous selected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    NEED_ORDER,
    NEED_LEVELS,
    NEED_BASELINE_LEVEL,
    type NeedName,
    type NeedLevel,
    type NeedDirection,
    type BiosLevelEntry,
} from '@/lib/protocol/bios-types';

// Mutable mock map the test body rewrites per-case.
let mockLevels = new Map<NeedName, BiosLevelEntry>();

vi.mock('@/lib/hooks/use-bios-levels', () => ({
    useBiosLevels: () => mockLevels,
}));

import { BiosSection } from './bios';

function baselineMap(): Map<NeedName, BiosLevelEntry> {
    const m = new Map<NeedName, BiosLevelEntry>();
    for (const need of NEED_ORDER) {
        m.set(need, { level: NEED_BASELINE_LEVEL[need], direction: null });
    }
    return m;
}

function singletonMap(
    need: NeedName,
    level: NeedLevel,
    direction: NeedDirection,
): Map<NeedName, BiosLevelEntry> {
    const m = baselineMap();
    m.set(need, { level, direction });
    return m;
}

const DIRECTIONS: readonly NeedDirection[] = [null, 'rising', 'falling'];

beforeEach(() => {
    mockLevels = baselineMap();
});

describe('BiosSection — shell and baseline', () => {
    it('renders section with testid="section-bios"', () => {
        render(<BiosSection did={null} />);
        expect(screen.getByTestId('section-bios')).not.toBeNull();
    });

    it('h3 reads literally "Bios"', () => {
        render(<BiosSection did={null} />);
        const h3 = screen.getByTestId('section-bios').querySelector('h3');
        expect(h3).not.toBeNull();
        expect(h3!.textContent).toBe('Bios');
    });

    it('renders 2 rows in NEED_ORDER', () => {
        render(<BiosSection did={null} />);
        const rows = screen.getByTestId('section-bios').querySelectorAll('li');
        expect(rows.length).toBe(2);
        const observed = Array.from(rows).map((r) => r.getAttribute('data-need'));
        expect(observed).toEqual(['energy', 'sustenance']);
    });

    it('pending state when did is null — aria-label={need} pending on each row', () => {
        mockLevels = new Map();
        render(<BiosSection did={null} />);
        for (const need of NEED_ORDER) {
            const row = screen.getByTestId(`need-row-${need}`);
            expect(row.getAttribute('aria-label')).toBe(`${need} pending`);
        }
    });
});

describe('BiosSection — 18-case aria-label matrix', () => {
    for (const need of NEED_ORDER) {
        for (const level of NEED_LEVELS) {
            for (const direction of DIRECTIONS) {
                const expected = direction
                    ? `${need} ${level} ${direction}`
                    : `${need} ${level}`;
                const dirLabel = direction ?? 'stable';
                it(`aria-label for (${need}, ${level}, ${dirLabel}) = "${expected}"`, () => {
                    mockLevels = singletonMap(need, level, direction);
                    render(<BiosSection did="did:noesis:abc" />);
                    const row = screen.getByTestId(`need-row-${need}`);
                    expect(row.getAttribute('aria-label')).toBe(expected);
                });
            }
        }
    }
});

describe('BiosSection — privacy contract (render-surface)', () => {
    it('does NOT render any numeric value', () => {
        mockLevels = singletonMap('energy', 'high', 'rising');
        const { container } = render(<BiosSection did="did:noesis:abc" />);
        // No digits anywhere in the Bios section text content
        expect(container.textContent ?? '').not.toMatch(/[0-9]/);
    });

    it('rendered HTML contains no 0.x float literal', () => {
        mockLevels = singletonMap('sustenance', 'med', 'falling');
        const { container } = render(<BiosSection did="did:noesis:abc" />);
        expect(container.innerHTML).not.toMatch(/0\.[0-9]+/);
    });
});
