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
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Verbatim export copy constants — mirrored here from export-consent-dialog.test.tsx
// to ensure both test files are updated together if copy changes (D-13-08 discipline).
// Wave 4 must implement these exact strings in ExportConsentDialog.
const _EXPORT_TITLE_COPY = 'Export audit chain slice';     // locked D-13-08
const _EXPORT_CONFIRM_LABEL = 'Export forever';             // locked D-13-08
const _EXPORT_CANCEL_LABEL = 'Keep private';                // locked D-13-08

// Mock agencyStore so tests can verify setTier calls
vi.mock('@/lib/stores/agency-store', () => ({
    agencyStore: {
        setTier: vi.fn(),
        getTier: vi.fn(() => 'H3'),
        subscribe: vi.fn(() => () => {}),
        getSnapshot: vi.fn(() => 'H3'),
    },
}));

// Mock useStores so ReplayStoresProvider can call it without a live StoresProvider.
// We provide minimal in-memory FirehoseStore + PresenceStore instances.
import { FirehoseStore } from '@/lib/stores/firehose-store';
import { PresenceStore } from '@/lib/stores/presence-store';
import { HeartbeatStore } from '@/lib/stores/heartbeat-store';
import { selectionStore } from '@/lib/stores/selection-store';

const mockFirehose = new FirehoseStore();
const mockPresence = new PresenceStore();
const mockHeartbeat = new HeartbeatStore();

vi.mock('../use-stores', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../use-stores')>();
    return {
        ...actual,
        useStores: vi.fn(() => ({
            firehose: mockFirehose,
            presence: mockPresence,
            heartbeat: mockHeartbeat,
            selection: selectionStore,
        })),
    };
});

// Mock useFirehoseFilter — used inside Firehose component
vi.mock('@/lib/hooks/use-firehose-filter', () => ({
    useFirehoseFilter: vi.fn(() => ({ filter: null })),
}));

// Mock useSelection — used inside Inspector (returns null selectedDid so Inspector renders null)
vi.mock('@/lib/hooks/use-selection', () => ({
    useSelection: vi.fn(() => ({ selectedDid: null, clear: vi.fn() })),
}));

import { ReplayClient } from './replay-client';
import { agencyStore } from '@/lib/stores/agency-store';
import { H4_PLACEHOLDER, H5_PLACEHOLDER } from './replay-redaction-copy';

// Fixture entries for rendering tests
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

beforeEach(() => {
    vi.mocked(agencyStore.setTier).mockClear();
    cleanup();
    // Reset stores for isolation
    mockFirehose.ingest([]);
});

describe('ReplayClient — tier gate', () => {
    it('H1 operator sees "Replay requires H3 or higher" and no firehose', () => {
        render(
            <ReplayClient
                operatorTier="H1"
                entries={EMPTY_ENTRIES as never}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
        );
        expect(screen.getByText(/Replay requires H3/i)).toBeTruthy();
        expect(screen.queryByTestId('replay-firehose')).toBeNull();
    });

    it('H2 operator sees "Replay requires H3 or higher" and no firehose', () => {
        render(
            <ReplayClient
                operatorTier="H2"
                entries={EMPTY_ENTRIES as never}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
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
        );
        expect(screen.getByLabelText('Region map')).toBeTruthy();
    });
});

describe('ReplayClient — redaction placeholders (via FirehoseRow)', () => {
    it('H3 renders "— Requires H4" placeholder for telos-revealing frame', () => {
        render(
            <ReplayClient
                operatorTier="H3"
                entries={[TELOS_ENTRY] as never}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
        );
        // The Telos plaintext must NOT appear; placeholder must be shown
        expect(screen.getByText(H4_PLACEHOLDER)).toBeTruthy();
    });

    it('H3 renders "— Requires H5" placeholder for whisper frame', () => {
        render(
            <ReplayClient
                operatorTier="H3"
                entries={[WHISPER_ENTRY] as never}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
        );
        expect(screen.getByText(H5_PLACEHOLDER)).toBeTruthy();
    });

    it('H4 renders "— Requires H5" placeholder for whisper frame', () => {
        render(
            <ReplayClient
                operatorTier="H4"
                entries={[WHISPER_ENTRY] as never}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
        );
        expect(screen.getByText(H5_PLACEHOLDER)).toBeTruthy();
    });

    it('H4 renders unredacted payload for H4-restricted telos event', () => {
        render(
            <ReplayClient
                operatorTier="H4"
                entries={[TELOS_ENTRY] as never}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
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
