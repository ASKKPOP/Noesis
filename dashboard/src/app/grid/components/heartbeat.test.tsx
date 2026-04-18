/**
 * Heartbeat tests — widget derives status from HeartbeatStore + clock.
 *
 * Coverage:
 *   H-1: initial 'unknown' state copy
 *   H-2: live state shows tick number and "last event 0s ago" right after ingest
 *   H-3: stale state applies stale styling and updates data-status attribute
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { StoresProvider, useStores } from '../use-stores';
import { Heartbeat } from './heartbeat';
import { makeTickEntry, resetFixtureIds } from '@/test/fixtures/ws-frames';
import type { HeartbeatStore } from '@/lib/stores/heartbeat-store';

function Wrapper({ children }: { children: ReactNode }) {
    return <StoresProvider>{children}</StoresProvider>;
}

/** Inline probe component — captures the store triple via useStores(). */
function Capture({ capture }: { capture: { heartbeat?: HeartbeatStore } }) {
    const s = useStores();
    capture.heartbeat = s.heartbeat;
    return <Heartbeat />;
}

describe('Heartbeat', () => {
    beforeEach(() => {
        resetFixtureIds();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('H-1: renders "No data yet" when store has no tick', () => {
        vi.setSystemTime(new Date(1_000_000));
        render(<Heartbeat />, { wrapper: Wrapper });
        const status = screen.getByTestId('heartbeat-status');
        expect(status.getAttribute('data-status')).toBe('unknown');
        expect(status.textContent).toContain('No data yet');
    });

    it('H-2: renders live tick number after a tick entry is ingested', () => {
        // Pin clock BEFORE render so hook's initial useState(Date.now()) sees it.
        vi.setSystemTime(new Date(1_000_000));
        const capture: { heartbeat?: HeartbeatStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });
        act(() => {
            // Tick 42 arriving exactly at current wall clock.
            capture.heartbeat!.ingest(makeTickEntry(42, 30_000));
        });
        const status = screen.getByTestId('heartbeat-status');
        expect(status.getAttribute('data-status')).toBe('live');
        expect(screen.getByTestId('heartbeat-tick').textContent).toContain('42');
        expect(screen.getByTestId('heartbeat-elapsed').textContent).toContain('0s ago');
    });

    it('H-3: flips to stale when elapsed > 2 × tickRateMs', () => {
        // createdAt = 1_000_000; now = 1_070_000 → elapsed 70s > 2×30s = 60s.
        vi.setSystemTime(new Date(1_000_000));
        const capture: { heartbeat?: HeartbeatStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });
        act(() => {
            capture.heartbeat!.ingest(makeTickEntry(5, 30_000));
        });

        // Advance wall clock 70 seconds so the hook's interval repolls Date.now().
        // The hook runs a setInterval at 1 Hz; advance past the next tick boundary
        // so the state update fires and React commits a stale-state render.
        act(() => {
            vi.advanceTimersByTime(70_000);
        });

        const status = screen.getByTestId('heartbeat-status');
        expect(status.getAttribute('data-status')).toBe('stale');
        const elapsed = screen.getByTestId('heartbeat-elapsed');
        expect(elapsed.className).toContain('text-red-400');
    });
});
