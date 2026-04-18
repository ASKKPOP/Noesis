/**
 * Task 1 — Tests for useStores / useFirehose / usePresence / useHeartbeat.
 *
 * These hooks sit between the framework-agnostic stores (Plan 04) and the
 * React components landed in Task 2. They must:
 *   • expose a single shared triple of stores for the lifetime of a render
 *     tree (StoresProvider),
 *   • wire stores to React via useSyncExternalStore so ingest is reflected
 *     in the next render,
 *   • re-tick "seconds since last event" on a 1s interval so the heartbeat
 *     widget stays live even without new events.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { StoresProvider, useStores } from './use-stores';
import { useFirehose, useHeartbeat, usePresence } from './hooks';
import {
    makeAuditEntry,
    makeTickEntry,
    resetFixtureIds,
} from '@/test/fixtures/ws-frames';

function Wrapper({ children }: { children: ReactNode }) {
    return <StoresProvider>{children}</StoresProvider>;
}

describe('useStores', () => {
    beforeEach(() => resetFixtureIds());

    it('returns the same store instances across re-renders of the same tree', () => {
        const captured: Array<ReturnType<typeof useStores>> = [];
        function Probe() {
            const s = useStores();
            captured.push(s);
            return <div data-testid="probe">{String(captured.length)}</div>;
        }
        const { rerender } = render(<Probe />, { wrapper: Wrapper });
        rerender(<Probe />);
        expect(captured.length).toBeGreaterThanOrEqual(2);
        expect(captured[0].firehose).toBe(captured[1].firehose);
        expect(captured[0].presence).toBe(captured[1].presence);
        expect(captured[0].heartbeat).toBe(captured[1].heartbeat);
    });

    it('throws if used outside a StoresProvider', () => {
        function Naked() {
            useStores();
            return null;
        }
        // Silence the React error-boundary noise for this case.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(() => render(<Naked />)).toThrow(/useStores/);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('useFirehose', () => {
    beforeEach(() => resetFixtureIds());

    it('renders 0 initially then re-renders after ingest', () => {
        let stores: ReturnType<typeof useStores> | null = null;
        function Count() {
            stores = useStores();
            const snap = useFirehose();
            return <div data-testid="count">{snap.filteredEntries.length}</div>;
        }
        render(<Count />, { wrapper: Wrapper });
        expect(screen.getByTestId('count').textContent).toBe('0');
        act(() => {
            stores!.firehose.ingest([makeAuditEntry({ id: 1 })]);
        });
        expect(screen.getByTestId('count').textContent).toBe('1');
    });
});

describe('usePresence', () => {
    beforeEach(() => resetFixtureIds());

    it('exposes regionOf() reflecting the latest spawned event', () => {
        let stores: ReturnType<typeof useStores> | null = null;
        function RegionProbe() {
            stores = useStores();
            const presence = usePresence();
            return <div data-testid="region">{presence.regionOf('did:nous:alice') ?? 'none'}</div>;
        }
        render(<RegionProbe />, { wrapper: Wrapper });
        expect(screen.getByTestId('region').textContent).toBe('none');
        act(() => {
            stores!.presence.applyEvents([
                makeAuditEntry({
                    id: 10,
                    eventType: 'nous.spawned',
                    actorDid: 'did:nous:alice',
                    payload: { name: 'Alice', region: 'agora' },
                }),
            ]);
        });
        expect(screen.getByTestId('region').textContent).toBe('agora');
    });
});

describe('useHeartbeat', () => {
    beforeEach(() => {
        resetFixtureIds();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('updates secondsSinceLastEvent once per second via its own ticker', () => {
        // Pin wall-clock BEFORE render so the hook's initial
        // useState(Date.now()) snapshot uses the pinned time.
        vi.setSystemTime(new Date(1_000_000));
        let stores: ReturnType<typeof useStores> | null = null;
        function SecondsProbe() {
            stores = useStores();
            const hb = useHeartbeat(1000);
            return (
                <div data-testid="secs">{hb.secondsSinceLastEvent === null ? 'null' : String(hb.secondsSinceLastEvent)}</div>
            );
        }

        render(<SecondsProbe />, { wrapper: Wrapper });

        act(() => {
            stores!.heartbeat.ingestBatch([
                // tick entry with createdAt = 1_000_000 ms (pinned above)
                makeTickEntry(42, 30_000),
            ]);
        });
        // Pinning system time ensures the entry's createdAt === Date.now() → 0.
        expect(screen.getByTestId('secs').textContent).toBe('0');

        // advanceTimersByTime also advances Date.now() under fake timers —
        // the hook's setInterval callback reads Date.now() and stores it,
        // and deriveStatus subtracts lastEventAt to get elapsed seconds.
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByTestId('secs').textContent).toBe('1');

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByTestId('secs').textContent).toBe('2');
    });
});
