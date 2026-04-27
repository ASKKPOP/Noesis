/**
 * RED tests for ReplayClient (REPLAY-05 / D-13-05..07 / T-10-09).
 *
 * These tests encode the acceptance criteria for Wave 4 (Plan 13-05).
 * They MUST fail until dashboard/src/app/grid/replay/replay-client.tsx is created.
 *
 * Threat mitigation: T-10-09 — "H1 operator sees plaintext during replay".
 * Tier gate H1/H2 must show 'Replay requires H3 or higher'; H3/H4/H5 see the viewer.
 * H4 redaction placeholder 'Requires H4'; H5 whisper placeholder 'Requires H5'.
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

// RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/replay-client.tsx
import { ReplayClient } from './replay-client';
import { agencyStore } from '@/lib/stores/agency-store';

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
});

describe('ReplayClient — tier gate', () => {
    it('H1 operator sees "Replay requires H3 or higher" and no firehose', () => {
        render(
            <ReplayClient
                operatorTier="H1"
                entries={EMPTY_ENTRIES}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
        );
        expect(screen.getByText(/Replay requires H3/i)).toBeTruthy();
        expect(screen.queryByTestId('replay-firehose')).toBeNull();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/replay-client.tsx

    it('H2 operator sees "Replay requires H3 or higher" and no firehose', () => {
        render(
            <ReplayClient
                operatorTier="H2"
                entries={EMPTY_ENTRIES}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
        );
        expect(screen.getByText(/Replay requires H3/i)).toBeTruthy();
        expect(screen.queryByTestId('replay-firehose')).toBeNull();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/replay-client.tsx
});

describe('ReplayClient — redaction placeholders', () => {
    it('H3 renders "— Requires H4" placeholder for telos-revealing frame', () => {
        render(
            <ReplayClient
                operatorTier="H3"
                entries={[TELOS_ENTRY]}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
        );
        // The Telos plaintext must NOT appear; placeholder must be shown
        expect(screen.getByText(/— Requires H4/i)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/replay-client.tsx

    it('H3 renders "— Requires H5" placeholder for whisper frame', () => {
        render(
            <ReplayClient
                operatorTier="H3"
                entries={[WHISPER_ENTRY]}
                startTick={0}
                endTick={10}
                gridId="test-grid"
            />,
        );
        expect(screen.getByText(/— Requires H5/i)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/replay-client.tsx
});

describe('ReplayClient — tier reset on unmount (D-13-07)', () => {
    it('unmounting calls agencyStore.setTier("H1")', () => {
        const { unmount } = render(
            <ReplayClient
                operatorTier="H3"
                entries={EMPTY_ENTRIES}
                startTick={0}
                endTick={50}
                gridId="test-grid"
            />,
        );
        unmount();
        expect(agencyStore.setTier).toHaveBeenCalledWith('H1');
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/replay-client.tsx
});

describe('ReplayClient — wall-clock grep gate (D-13-05)', () => {
    it('source file contains no banned time/random APIs', () => {
        /**
         * This test will throw ENOENT until Wave 4 creates replay-client.tsx.
         * That ENOENT is the expected RED failure mode for this test.
         * Once Wave 4 creates the file, this test must pass — no forbidden APIs.
         */
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
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/replay-client.tsx
});
