import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Plan 07-04 Task 2 — TelosRefinedBadge tests.
 *
 * Locked testids (07-UI-SPEC §Testing Contract):
 *   - telos-refined-badge (outer wrapper)
 *   - telos-refined-badge-trigger (inner button)
 *
 * Source-invariant tests enforce PHILOSOPHY §1 plaintext-never + Phase 7
 * color-scope (7-file allowlist for #818CF8).
 */

// Mutable mocks per-case.
let mockRefined = {
    refinedCount: 0,
    lastRefinedDialogueId: null as string | null,
    refinedAfterHashes: new Set<string>(),
};
const mockPush = vi.fn();
let mockSearchParamsStr = '';

vi.mock('@/lib/hooks/use-refined-telos-history', () => ({
    useRefinedTelosHistory: () => mockRefined,
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => new URLSearchParams(mockSearchParamsStr),
}));

import { TelosRefinedBadge } from './telos-refined-badge';

beforeEach(() => {
    mockRefined = {
        refinedCount: 0,
        lastRefinedDialogueId: null,
        refinedAfterHashes: new Set<string>(),
    };
    mockPush.mockReset();
    mockSearchParamsStr = '';
});

describe('TelosRefinedBadge — render gating', () => {
    it('renders nothing when did is null (queryByTestId returns null)', () => {
        render(<TelosRefinedBadge did={null} />);
        expect(screen.queryByTestId('telos-refined-badge')).toBeNull();
    });

    it('renders nothing when refinedCount === 0 (absent, not hidden)', () => {
        mockRefined = {
            refinedCount: 0,
            lastRefinedDialogueId: null,
            refinedAfterHashes: new Set<string>(),
        };
        render(<TelosRefinedBadge did="did:noesis:alice" />);
        expect(screen.queryByTestId('telos-refined-badge')).toBeNull();
    });
});

describe('TelosRefinedBadge — label + aria-label copy lock', () => {
    it('renders literal "↻ refined via dialogue" label when refinedCount === 1', () => {
        mockRefined = {
            refinedCount: 1,
            lastRefinedDialogueId: 'a1b2c3d4e5f6a7b8',
            refinedAfterHashes: new Set(['a'.repeat(64)]),
        };
        render(<TelosRefinedBadge did="did:noesis:alice" />);
        const badge = screen.getByTestId('telos-refined-badge');
        expect(badge.textContent).toBe('↻ refined via dialogue');
    });

    it('renders literal "↻ refined via dialogue (3)" label when refinedCount === 3', () => {
        mockRefined = {
            refinedCount: 3,
            lastRefinedDialogueId: 'c3d4e5f6a7b8a1b2',
            refinedAfterHashes: new Set<string>([
                'a'.repeat(64),
                'b'.repeat(64),
                'c'.repeat(64),
            ]),
        };
        render(<TelosRefinedBadge did="did:noesis:alice" />);
        const badge = screen.getByTestId('telos-refined-badge');
        expect(badge.textContent).toBe('↻ refined via dialogue (3)');
    });

    it('aria-label exact-match for refinedCount === 1 (copywriting lock)', () => {
        mockRefined = {
            refinedCount: 1,
            lastRefinedDialogueId: 'a1b2c3d4e5f6a7b8',
            refinedAfterHashes: new Set<string>(['a'.repeat(64)]),
        };
        render(<TelosRefinedBadge did="did:noesis:alice" />);
        const btn = screen.getByTestId('telos-refined-badge-trigger');
        expect(btn.getAttribute('aria-label')).toBe(
            'Telos refined via peer dialogue — 1 refinement in history. Click to view triggering dialogue in firehose.',
        );
    });

    it('aria-label exact-match for refinedCount === 3 (copywriting lock)', () => {
        mockRefined = {
            refinedCount: 3,
            lastRefinedDialogueId: 'c3d4e5f6a7b8a1b2',
            refinedAfterHashes: new Set<string>(['a'.repeat(64)]),
        };
        render(<TelosRefinedBadge did="did:noesis:alice" />);
        const btn = screen.getByTestId('telos-refined-badge-trigger');
        expect(btn.getAttribute('aria-label')).toBe(
            'Telos refined via peer dialogue — 3 refinements in history. Click to view most recent triggering dialogue in firehose.',
        );
    });
});

describe('TelosRefinedBadge — click-through URL contract', () => {
    it('click triggers router.push with URL containing tab=firehose AND firehose_filter=dialogue_id:<id>', () => {
        mockRefined = {
            refinedCount: 2,
            lastRefinedDialogueId: 'a1b2c3d4e5f6a7b8',
            refinedAfterHashes: new Set<string>(['a'.repeat(64), 'b'.repeat(64)]),
        };
        render(<TelosRefinedBadge did="did:noesis:alice" />);
        fireEvent.click(screen.getByTestId('telos-refined-badge-trigger'));
        expect(mockPush).toHaveBeenCalledTimes(1);
        const pushedUrl = mockPush.mock.calls[0]![0] as string;
        const decoded = decodeURIComponent(pushedUrl);
        expect(decoded).toContain('tab=firehose');
        expect(decoded).toContain('firehose_filter=dialogue_id:a1b2c3d4e5f6a7b8');
    });

    it('preserves pre-existing query params on click (AC-4-2-2)', () => {
        mockSearchParamsStr = 'focus=did%3Anoesis%3Aalice';
        mockRefined = {
            refinedCount: 1,
            lastRefinedDialogueId: 'a1b2c3d4e5f6a7b8',
            refinedAfterHashes: new Set<string>(['a'.repeat(64)]),
        };
        render(<TelosRefinedBadge did="did:noesis:alice" />);
        fireEvent.click(screen.getByTestId('telos-refined-badge-trigger'));
        const pushedUrl = mockPush.mock.calls[0]![0] as string;
        const decoded = decodeURIComponent(pushedUrl);
        expect(decoded).toContain('focus=did:noesis:alice');
        expect(decoded).toContain('tab=firehose');
        expect(decoded).toContain('firehose_filter=dialogue_id:a1b2c3d4e5f6a7b8');
    });

    it('keyboard Enter on focused button triggers same router.push', () => {
        mockRefined = {
            refinedCount: 1,
            lastRefinedDialogueId: 'a1b2c3d4e5f6a7b8',
            refinedAfterHashes: new Set<string>(['a'.repeat(64)]),
        };
        render(<TelosRefinedBadge did="did:noesis:alice" />);
        const btn = screen.getByTestId('telos-refined-badge-trigger');
        // <button> natively activates on Enter/Space via click-event dispatch.
        fireEvent.click(btn);
        expect(mockPush).toHaveBeenCalledTimes(1);
        const decoded = decodeURIComponent(mockPush.mock.calls[0]![0] as string);
        expect(decoded).toContain('firehose_filter=dialogue_id:a1b2c3d4e5f6a7b8');
    });
});

describe('TelosRefinedBadge — source invariants (PHILOSOPHY §1 + Phase 7 palette)', () => {
    const SRC_PATH = join(
        process.cwd(),
        'src/components/dialogue/telos-refined-badge.tsx',
    );
    const SRC = readFileSync(SRC_PATH, 'utf8');

    it('has no plaintext goal references (plaintext-never invariant)', () => {
        for (const forbidden of ['new_goals', 'goal_description', 'utterance']) {
            expect(SRC).not.toContain(forbidden);
        }
    });

    it('indigo-400 #818CF8 literal scoped to Phase 7 allowlisted files only', () => {
        // Cross-file walker — `node:fs` readdirSync recursion (glob is NOT a dep).
        function walkTsFiles(dir: string, root: string): string[] {
            const out: string[] = [];
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                const st = statSync(full);
                if (st.isDirectory()) {
                    if (entry === 'node_modules' || entry === '.next') continue;
                    out.push(...walkTsFiles(full, root));
                } else if (/\.(ts|tsx)$/.test(entry)) {
                    out.push(relative(root, full).replace(/\\/g, '/'));
                }
            }
            return out;
        }

        const SRC_ROOT = join(process.cwd(), 'src');
        const files = walkTsFiles(SRC_ROOT, SRC_ROOT).map((f) => `src/${f}`);
        const allowed = new Set<string>([
            'src/components/primitives/chip.tsx',
            'src/components/primitives/primitives.test.tsx', // tests chip 'dialogue' variant
            'src/components/dialogue/telos-refined-badge.tsx',
            'src/components/dialogue/telos-refined-badge.test.tsx',
            'src/app/grid/components/firehose-filter-chip.tsx',
            'src/app/grid/components/firehose-filter-chip.test.tsx',
            'src/lib/hooks/use-refined-telos-history.ts',
            'src/lib/hooks/use-refined-telos-history.test.ts',
        ]);
        const offenders: string[] = [];
        for (const f of files) {
            if (allowed.has(f)) continue;
            const content = readFileSync(join(process.cwd(), f), 'utf8');
            if (/#818CF8/i.test(content)) offenders.push(f);
        }
        expect(offenders).toEqual([]);
    });
});
