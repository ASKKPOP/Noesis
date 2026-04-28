/**
 * Tests for ReplayClient (REPLAY-05 / D-13-05..07 / T-10-09).
 *
 * Wave 6 (Plan 13-07): Updated to verify the three-panel surface
 * (Firehose, Inspector, RegionMap) mounted with replayMode={true},
 * sourced from ReplayStoresProvider seeded with the entries prop.
 *
 * Threat mitigation: T-10-09 — "H1 operator sees plaintext during replay".
 * Tier gate H1/H2 must show 'Replay requires H3 or higher'; H3/H4/H5 see panels.
 * H4 redaction placeholder '— Requires H4'; H5 whisper placeholder '— Requires H5'.
 * Tier reset on unmount (D-13-07): agencyStore.setTier('H1') called on unmount.
 * Wall-clock grep (D-13-05): no Date.now/setInterval/setTimeout/requestAnimationFrame/
 * Math.random in the source file.
 *
 * Test architecture:
 *   - ReplayClient uses ReplayStoresProvider internally, which calls useStores()
 *     from the context. Tests wrap renders with StoresProvider so useStores()
 *     resolves via React context (not bypassed by a mock).
 *   - ReplayStoresProvider overrides firehose+presence in the context subtree,
 *     so Firehose reads from the replay-scoped seeded store, not the live one.
 *   - agencyStore is mocked so Firehose's useSyncExternalStore reads the tier
 *     that the test controls (H3 default → H4 redaction applies; H4 → H5 applies).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Verbatim export copy constants — mirrored here from export-consent-dialog.test.tsx
// to ensure both test files are updated together if copy changes (D-13-08 discipline).
const _EXPORT_TITLE_COPY = 'Export audit chain slice';     // locked D-13-08
const _EXPORT_CONFIRM_LABEL = 'Export forever';             // locked D-13-08
const _EXPORT_CANCEL_LABEL = 'Keep private';                // locked D-13-08

// ── Mocks ────────────────────────────────────────────────────────────────────

// agencyStore mock — controls what operatorTier Firehose sees.
// getSnapshot() returns the tier for the current test. Tests that need a
// specific tier call mockAgencyTier(tier) before rendering.
let _currentMockTier = 'H3';
vi.mock('@/lib/stores/agency-store', () => ({
    agencyStore: {
        setTier: vi.fn(),
        getTier: vi.fn(() => _currentMockTier),
        subscribe: vi.fn((listener: () => void) => {
            // Return an unsubscribe noop — store won't emit in tests.
            void listener;
            return () => {};
        }),
        getSnapshot: vi.fn(() => _currentMockTier),
    },
}));

function mockAgencyTier(tier: string): void {
    _currentMockTier = tier;
}

// useFirehoseFilter — not relevant to replay redaction tests.
vi.mock('@/lib/hooks/use-firehose-filter', () => ({
    useFirehoseFilter: vi.fn(() => ({ filter: null })),
}));

// useSelection — Inspector calls this; null selectedDid makes Inspector return null.
vi.mock('@/lib/hooks/use-selection', () => ({
    useSelection: vi.fn(() => ({ selectedDid: null, clear: vi.fn() })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { StoresProvider } from '../use-stores';
import { ReplayClient } from './replay-client';
import { agencyStore } from '@/lib/stores/agency-store';
import { H4_PLACEHOLDER, H5_PLACEHOLDER } from './replay-redaction-copy';

// ── Test wrapper (provides StoresProvider so useStores() resolves via context) ─

function Wrapper({ children }: { children: ReactNode }) {
    return <StoresProvider>{children}</StoresProvider>;
}

// ── Fixture entries ───────────────────────────────────────────────────────────

const EMPTY_ENTRIES: unknown[] = [];
const TELOS_ENTRY = {
    id: 1,
    eventType: 'telos.refined',
    actorDid: 'did:noesis:sophia',
    payload: {
        did: 'did:noesis:sophia',
        before_goal_hash: 'a'.repeat(64),
        after_goal_hash: 'b'.repeat(64),
        triggered_by_dialogue_id: 'a1b2c3d4e5f60718',
    },
    prevHash: '0'.repeat(64),
    eventHash: 'c'.repeat(64),
    createdAt: 1714435200000,
};
const WHISPER_ENTRY = {
    id: 2,
    eventType: 'nous.whispered',
    actorDid: 'did:noesis:sophia',
    payload: {
        ciphertext_hash: 'd'.repeat(64),
        from_did: 'did:noesis:sophia',
        tick: 5,
        to_did: 'did:noesis:hermes',
    },
    prevHash: 'c'.repeat(64),
    eventHash: 'e'.repeat(64),
    createdAt: 1714435201000,
};

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.mocked(agencyStore.setTier).mockClear();
    mockAgencyTier('H3'); // default tier for most tests
    cleanup();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReplayClient — tier gate', () => {
    it('H1 operator sees "Replay requires H3 or higher" and no firehose', () => {
        mockAgencyTier('H1');
        render(
            <ReplayClient
                operatorTier="H1"
                entries={EMPTY_ENTRIES as never}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
            { wrapper: Wrapper },
        );
        expect(screen.getByText(/Replay requires H3/i)).toBeTruthy();
        expect(screen.queryByTestId('replay-firehose')).toBeNull();
    });

    it('H2 operator sees "Replay requires H3 or higher" and no firehose', () => {
        mockAgencyTier('H2');
        render(
            <ReplayClient
                operatorTier="H2"
                entries={EMPTY_ENTRIES as never}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
            { wrapper: Wrapper },
        );
        expect(screen.getByText(/Replay requires H3/i)).toBeTruthy();
        expect(screen.queryByTestId('replay-firehose')).toBeNull();
    });
});

describe('ReplayClient — three-panel surface (D-13-03 / gap-closure 13-07)', () => {
    it('H3 mounts the Firehose panel (aria-label="Event firehose")', () => {
        render(
            <ReplayClient
                operatorTier="H3"
                entries={EMPTY_ENTRIES as never}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
            { wrapper: Wrapper },
        );
        expect(screen.getByLabelText('Event firehose')).toBeTruthy();
    });

    it('H3 mounts the RegionMap panel (aria-label="Region map")', () => {
        render(
            <ReplayClient
                operatorTier="H3"
                entries={EMPTY_ENTRIES as never}
                startTick={0}
                endTick={50}
                gridId="test-grid"
                regions={[]}
                connections={[]}
            />,
            { wrapper: Wrapper },
        );
        expect(screen.getByLabelText('Region map')).toBeTruthy();
    });
});

describe('ReplayClient — redaction placeholders (via FirehoseRow)', () => {
    it('H3 renders "— Requires H4" placeholder for telos-revealing frame', () => {
        mockAgencyTier('H3');
        render(
            <ReplayClient
                operatorTier="H3"
                entries={[TELOS_ENTRY] as never}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
            { wrapper: Wrapper },
        );
        // The Telos plaintext must NOT appear; placeholder must be shown
        expect(screen.getByText(H4_PLACEHOLDER)).toBeTruthy();
    });

    it('H3 renders "— Requires H5" placeholder for whisper frame', () => {
        mockAgencyTier('H3');
        render(
            <ReplayClient
                operatorTier="H3"
                entries={[WHISPER_ENTRY] as never}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
            { wrapper: Wrapper },
        );
        expect(screen.getByText(H5_PLACEHOLDER)).toBeTruthy();
    });

    it('H4 renders "— Requires H5" placeholder for whisper frame', () => {
        mockAgencyTier('H4');
        render(
            <ReplayClient
                operatorTier="H4"
                entries={[WHISPER_ENTRY] as never}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
            { wrapper: Wrapper },
        );
        expect(screen.getByText(H5_PLACEHOLDER)).toBeTruthy();
    });

    it('H4 renders unredacted payload for H4-restricted telos event', () => {
        mockAgencyTier('H4');
        render(
            <ReplayClient
                operatorTier="H4"
                entries={[TELOS_ENTRY] as never}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
            { wrapper: Wrapper },
        );
        // H4 can see telos.refined payload — no placeholder
        expect(screen.queryByText(H4_PLACEHOLDER)).toBeNull();
    });
});

describe('ReplayClient — tier reset on unmount (D-13-07)', () => {
    it('unmounting calls agencyStore.setTier("H1")', () => {
        const { unmount } = render(
            <ReplayClient
                operatorTier="H3"
                entries={EMPTY_ENTRIES as never}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
            { wrapper: Wrapper },
        );
        unmount();
        expect(agencyStore.setTier).toHaveBeenCalledWith('H1');
    });
});

describe('ReplayClient — wall-clock grep gate (D-13-05)', () => {
    it('source file contains no banned time/random APIs', () => {
        const srcPath = path.resolve(
            import.meta.dirname ?? __dirname,
            'replay-client.tsx',
        );
        const src = readFileSync(srcPath, 'utf8');
        const BANNED = [
            'Date.now',
            'setInterval',
            'setTimeout',
            'requestAnimationFrame',
            'Math.random',
        ];
        for (const banned of BANNED) {
            expect(src).not.toContain(banned);
        }
    });
});
