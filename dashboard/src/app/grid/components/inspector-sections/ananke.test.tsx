/**
 * Plan 10a-05 Task 2 — AnankeSection DOM contract tests.
 *
 * Covers:
 *   - section shell (testid, h3 "Drives", 5 rows in DRIVE_ORDER)
 *   - baseline first-paint (no direction glyph on any row)
 *   - 45-state aria-label matrix (5 drives × 3 levels × 3 directions)
 *   - Unicode glyph-per-drive (5 tests)
 *   - data-level / data-direction attributes
 *   - single row transition (baseline → crossing-applied)
 *   - all row structural invariants (dot + glyph + label + level text)
 *
 * All tests mock useAnankeLevels — the hook is already exercised by
 * use-ananke-levels.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    DRIVE_ORDER,
    DRIVE_LEVELS,
    DRIVE_BASELINE_LEVEL,
    type DriveName,
    type DriveLevel,
    type DriveDirection,
    type AnankeLevelEntry,
} from '@/lib/protocol/ananke-types';

// Mutable mock map the test body rewrites per-case.
let mockLevels = new Map<DriveName, AnankeLevelEntry>();

vi.mock('@/lib/hooks/use-ananke-levels', () => ({
    useAnankeLevels: () => mockLevels,
}));

import { AnankeSection } from './ananke';

function baselineMap(): Map<DriveName, AnankeLevelEntry> {
    const m = new Map<DriveName, AnankeLevelEntry>();
    for (const drive of DRIVE_ORDER) {
        m.set(drive, { level: DRIVE_BASELINE_LEVEL[drive], direction: null });
    }
    return m;
}

function singletonMap(
    drive: DriveName,
    level: DriveLevel,
    direction: DriveDirection | null,
): Map<DriveName, AnankeLevelEntry> {
    const m = baselineMap();
    m.set(drive, { level, direction });
    return m;
}

beforeEach(() => {
    mockLevels = baselineMap();
});

describe('AnankeSection — shell and baseline', () => {
    it('renders section with testid="section-ananke"', () => {
        render(<AnankeSection did={null} />);
        expect(screen.getByTestId('section-ananke')).not.toBeNull();
    });

    it('h3 reads literally "Drives"', () => {
        render(<AnankeSection did={null} />);
        const h3 = screen
            .getByTestId('section-ananke')
            .querySelector('h3');
        expect(h3).not.toBeNull();
        expect(h3!.textContent).toBe('Drives');
    });

    it('renders 5 rows in locked DRIVE_ORDER', () => {
        render(<AnankeSection did={null} />);
        const rows = screen
            .getByTestId('section-ananke')
            .querySelectorAll('li');
        expect(rows.length).toBe(5);
        const observed = Array.from(rows).map((r) => r.getAttribute('data-drive'));
        expect(observed).toEqual([
            'hunger',
            'curiosity',
            'safety',
            'boredom',
            'loneliness',
        ]);
    });

    it('baseline first-paint — no direction glyph on any row', () => {
        render(<AnankeSection did={null} />);
        for (const drive of DRIVE_ORDER) {
            const arrow = screen.queryByTestId(`drive-direction-${drive}`);
            expect(arrow).toBeNull();
            const row = screen.getByTestId(`drive-row-${drive}`);
            expect(row.getAttribute('data-direction')).toBe('stable');
        }
    });

    it('renders dot, glyph, name, level-text on every row', () => {
        render(<AnankeSection did={null} />);
        for (const drive of DRIVE_ORDER) {
            expect(screen.getByTestId(`drive-dot-${drive}`)).not.toBeNull();
            expect(screen.getByTestId(`drive-glyph-${drive}`)).not.toBeNull();
            expect(screen.getByTestId(`drive-level-${drive}`)).not.toBeNull();
        }
    });

    it('dot and glyph spans are aria-hidden', () => {
        render(<AnankeSection did={null} />);
        for (const drive of DRIVE_ORDER) {
            expect(
                screen.getByTestId(`drive-dot-${drive}`).getAttribute('aria-hidden'),
            ).toBe('true');
            expect(
                screen
                    .getByTestId(`drive-glyph-${drive}`)
                    .getAttribute('aria-hidden'),
            ).toBe('true');
        }
    });

    it('<ul role="list" aria-label> describes the panel', () => {
        render(<AnankeSection did={null} />);
        const ul = screen
            .getByTestId('section-ananke')
            .querySelector('ul');
        expect(ul).not.toBeNull();
        expect(ul!.getAttribute('role')).toBe('list');
        expect(ul!.getAttribute('aria-label')).toBe(
            'Current drive pressure levels',
        );
    });
});

describe('AnankeSection — 45-state aria-label matrix', () => {
    const DIRECTIONS = [null, 'rising', 'falling'] as const;
    for (const drive of DRIVE_ORDER) {
        for (const level of DRIVE_LEVELS) {
            for (const direction of DIRECTIONS) {
                const expected = direction
                    ? `${drive} level ${level}, ${direction}`
                    : `${drive} level ${level}`;
                const label = direction ?? 'stable';
                it(`aria-label for (${drive}, ${level}, ${label}) = "${expected}"`, () => {
                    mockLevels = singletonMap(drive, level, direction);
                    render(<AnankeSection did="did:noesis:alpha" />);
                    const el = screen.getByTestId(`drive-level-${drive}`);
                    expect(el.getAttribute('aria-label')).toBe(expected);
                });
            }
        }
    }
});

describe('AnankeSection — Unicode glyph per drive', () => {
    const GLYPHS: Record<DriveName, string> = {
        hunger: '\u2298',      // ⊘
        curiosity: '\u2726',   // ✦
        safety: '\u25C6',      // ◆
        boredom: '\u25EF',     // ◯
        loneliness: '\u274D',  // ❍
    };
    for (const drive of DRIVE_ORDER) {
        it(`renders locked glyph for ${drive}`, () => {
            render(<AnankeSection did={null} />);
            expect(
                screen.getByTestId(`drive-glyph-${drive}`).textContent,
            ).toBe(GLYPHS[drive]);
        });
    }
});

describe('AnankeSection — data-level and data-direction attributes', () => {
    it('reflects level enum on the row', () => {
        mockLevels = singletonMap('hunger', 'high', 'rising');
        render(<AnankeSection did="did:noesis:alpha" />);
        const row = screen.getByTestId('drive-row-hunger');
        expect(row.getAttribute('data-drive')).toBe('hunger');
        expect(row.getAttribute('data-level')).toBe('high');
        expect(row.getAttribute('data-direction')).toBe('rising');
    });

    it('data-direction="stable" when direction is null', () => {
        mockLevels = singletonMap('curiosity', 'low', null);
        render(<AnankeSection did="did:noesis:alpha" />);
        const row = screen.getByTestId('drive-row-curiosity');
        expect(row.getAttribute('data-direction')).toBe('stable');
    });

    it('falling direction attribute propagates', () => {
        mockLevels = singletonMap('safety', 'med', 'falling');
        render(<AnankeSection did="did:noesis:alpha" />);
        const row = screen.getByTestId('drive-row-safety');
        expect(row.getAttribute('data-direction')).toBe('falling');
        const arrow = screen.getByTestId('drive-direction-safety');
        expect(arrow.getAttribute('aria-hidden')).toBe('true');
        expect(arrow.textContent).toBe('\u2193');
    });

    it('rising direction renders ↑ glyph', () => {
        mockLevels = singletonMap('boredom', 'high', 'rising');
        render(<AnankeSection did="did:noesis:alpha" />);
        const arrow = screen.getByTestId('drive-direction-boredom');
        expect(arrow.textContent).toBe('\u2191');
    });
});

describe('AnankeSection — transition from baseline to crossing', () => {
    it('updates row from baseline stable to med/rising after hook changes', () => {
        mockLevels = baselineMap();
        const { rerender } = render(<AnankeSection did="did:noesis:alpha" />);
        // Baseline first-paint for hunger.
        expect(
            screen.getByTestId('drive-row-hunger').getAttribute('data-level'),
        ).toBe(DRIVE_BASELINE_LEVEL.hunger);
        expect(
            screen.getByTestId('drive-row-hunger').getAttribute('data-direction'),
        ).toBe('stable');

        // Simulate a crossing landing → update mock.
        mockLevels = singletonMap('hunger', 'med', 'rising');
        rerender(<AnankeSection did="did:noesis:alpha" />);

        expect(
            screen.getByTestId('drive-row-hunger').getAttribute('data-level'),
        ).toBe('med');
        expect(
            screen.getByTestId('drive-row-hunger').getAttribute('data-direction'),
        ).toBe('rising');
        // Other rows unchanged.
        expect(
            screen.getByTestId('drive-row-safety').getAttribute('data-direction'),
        ).toBe('stable');
    });
});

describe('AnankeSection — privacy contract (render-surface)', () => {
    it('no title= attribute on any drive-related element', () => {
        mockLevels = singletonMap('hunger', 'high', 'rising');
        const { container } = render(<AnankeSection did="did:noesis:alpha" />);
        const withTitles = container.querySelectorAll('[title]');
        expect(withTitles.length).toBe(0);
    });

    it('no data-value or data-drive-raw attributes', () => {
        mockLevels = singletonMap('hunger', 'high', 'rising');
        const { container } = render(<AnankeSection did="did:noesis:alpha" />);
        expect(container.querySelector('[data-value]')).toBeNull();
        expect(container.querySelector('[data-drive-raw]')).toBeNull();
    });

    it('rendered HTML contains no 0.x float literal', () => {
        mockLevels = singletonMap('curiosity', 'high', 'rising');
        const { container } = render(<AnankeSection did="did:noesis:alpha" />);
        expect(container.innerHTML).not.toMatch(/0\.[0-9]+/);
    });
});
