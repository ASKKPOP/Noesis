import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TierTooltip, TIER_DEFINITIONS } from './tier-tooltip';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';

/**
 * Plan 06-02 Task 2 — TierTooltip tests.
 *
 * The five strings below are embedded INLINE (not imported from
 * TIER_DEFINITIONS) so this test is the drift detector between the source
 * file and PHILOSOPHY.md §7. Any paraphrase of TIER_DEFINITIONS fails here.
 */

const EXPECTED_VERBATIM: ReadonlyArray<[HumanAgencyTier, string]> = [
    ['H1', 'H1 Observer — read-only (firehose, map, inspector); leaves no trace'],
    ['H2', 'H2 Reviewer — query Nous memory; read-only, audit-logged'],
    [
        'H3',
        'H3 Partner — co-decision (pause sim, change broadcast allowlist, amend a Grid law); explicit elevation dialog',
    ],
    [
        'H4',
        "H4 Driver — force-mutate a specific Nous's Telos; operator drives, system executes",
    ],
    [
        'H5',
        'H5 Sovereign — delete a Nous; irreversibility dialog, DID-typed confirm, full state hash preserved for forensic reconstruction',
    ],
];

describe('TierTooltip — PHILOSOPHY §7 verbatim copy', () => {
    it.each(EXPECTED_VERBATIM)(
        '%s row text matches PHILOSOPHY.md §7 verbatim',
        (tier, expected) => {
            render(<TierTooltip activeTier="H1" />);
            const row = screen.getByTestId(`tier-row-${tier}`);
            expect(row.textContent).toContain(expected);
        },
    );

    it('TIER_DEFINITIONS exports the same 5 strings in the same order', () => {
        const actual = TIER_DEFINITIONS.map((row) => [row.tier, row.text] as const);
        expect(actual).toEqual(EXPECTED_VERBATIM);
    });
});

describe('TierTooltip — H5 styling (D-20)', () => {
    it('H5 row has line-through + text-neutral-500', () => {
        render(<TierTooltip activeTier="H1" />);
        const h5 = screen.getByTestId('tier-row-H5');
        expect(h5.className).toContain('line-through');
        expect(h5.className).toContain('text-neutral-500');
    });

    it('H5 row contains the (requires Phase 8) suffix', () => {
        render(<TierTooltip activeTier="H1" />);
        const h5 = screen.getByTestId('tier-row-H5');
        expect(h5.textContent).toContain('(requires Phase 8)');
    });

    it('non-H5 rows do NOT have line-through decoration', () => {
        render(<TierTooltip activeTier="H1" />);
        for (const tier of ['H1', 'H2', 'H3', 'H4'] as const) {
            const row = screen.getByTestId(`tier-row-${tier}`);
            expect(row.className).not.toContain('line-through');
        }
    });

    it('non-H5 rows do NOT contain a (requires Phase 8) suffix', () => {
        render(<TierTooltip activeTier="H1" />);
        for (const tier of ['H1', 'H2', 'H3', 'H4'] as const) {
            const row = screen.getByTestId(`tier-row-${tier}`);
            expect(row.textContent).not.toContain('(requires Phase 8)');
        }
    });
});

describe('TierTooltip — active-tier highlight', () => {
    it('highlights the active tier row (H3) with font-semibold + left border', () => {
        render(<TierTooltip activeTier="H3" />);
        const h3 = screen.getByTestId('tier-row-H3');
        expect(h3.className).toContain('font-semibold');
        expect(h3.className).toContain('border-l-2');
    });

    it('does NOT highlight inactive tiers', () => {
        render(<TierTooltip activeTier="H3" />);
        const h2 = screen.getByTestId('tier-row-H2');
        expect(h2.className).not.toContain('font-semibold');
        expect(h2.className).not.toContain('border-l-2');
    });

    it('never highlights H5 even when activeTier === H5', () => {
        // H5 is not a runtime-reachable tier, but defensive check: active state
        // should not override the disabled decoration.
        render(<TierTooltip activeTier={'H5' as HumanAgencyTier} />);
        const h5 = screen.getByTestId('tier-row-H5');
        expect(h5.className).toContain('line-through');
        expect(h5.className).not.toContain('font-semibold');
    });
});

describe('TierTooltip — structure', () => {
    it('has role="tooltip" for assistive tech', () => {
        render(<TierTooltip activeTier="H1" />);
        expect(screen.getByRole('tooltip')).not.toBeNull();
    });

    it('renders the "Agency Scale" heading', () => {
        render(<TierTooltip activeTier="H1" />);
        expect(screen.getByText('Agency Scale').textContent).toBe('Agency Scale');
    });

    it('renders exactly 5 tier rows', () => {
        render(<TierTooltip activeTier="H1" />);
        const tooltip = screen.getByTestId('tier-tooltip');
        const list = within(tooltip).getByRole('list');
        expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    });
});
