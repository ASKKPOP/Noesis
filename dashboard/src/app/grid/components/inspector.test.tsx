/**
 * Inspector tests — WAI-ARIA focus-trap drawer around fetchNousState.
 *
 * Contract (Plan 04-05 Task 3):
 *   - Unmounted when selectedDid === null.
 *   - Opens with role="dialog" aria-modal="true" aria-labelledby="inspector-title".
 *   - Fires fetchNousState on selection change; loading skeleton → error
 *     EmptyState (per-kind copy) or success sections.
 *   - ESC calls selection.clear().
 *   - Tab/Shift+Tab cycles across focusable descendants (hand-rolled trap).
 *   - On close, focus restored to the opener element that held focus at open time.
 *   - New selection during load aborts the prior request.
 *
 * Uses vi.mock of @/lib/api/introspect so tests own the fetch lifecycle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { SelectionStore } from '@/lib/stores/selection-store';
import { useSelection } from '@/lib/hooks/use-selection';
import type { NousStateResponse } from '@/lib/api/introspect';
import { Inspector } from './inspector';

// Mock the fetch wrapper — each test rewrites the resolved value.
const fetchMock = vi.fn();
vi.mock('@/lib/api/introspect', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api/introspect')>(
        '@/lib/api/introspect',
    );
    return {
        ...actual,
        fetchNousState: (...args: unknown[]) => fetchMock(...args),
    };
});

const FIXTURE: NousStateResponse = {
    did: 'did:noesis:alpha',
    name: 'Alpha',
    archetype: 'curious-scholar',
    location: 'origin',
    grid_name: 'noesis',
    mood: 'calm',
    emotions: { joy: 0.4 },
    active_goals: [],
    psyche: {
        openness: 0.5, conscientiousness: 0.5, extraversion: 0.5,
        agreeableness: 0.5, neuroticism: 0.5,
    },
    thymos: { mood: 'calm', emotions: { joy: 0.4 } },
    telos: { active_goals: [] },
    memory_highlights: [],
};

// Harness that renders the Inspector next to a visible "opener" button and
// threads a fresh SelectionStore via a local hook shim. Because the Inspector
// imports the default useSelection singleton, we use module-level mock of the
// hook to thread our custom store in.
let localStore: SelectionStore;

vi.mock('@/lib/hooks/use-selection', async () => {
    const actual = await vi.importActual<typeof import('@/lib/hooks/use-selection')>(
        '@/lib/hooks/use-selection',
    );
    return {
        ...actual,
        useSelection: (store?: SelectionStore) => actual.useSelection(store ?? localStore),
    };
});

// Phase 7: TelosSection now renders TelosRefinedBadge which subscribes to
// useRefinedTelosHistory (→ useFirehose → StoresProvider). The Inspector test
// harness has no StoresProvider, so we short-circuit the hook with an empty
// history. next/navigation also needs stubbing for the badge's router wiring.
vi.mock('@/lib/hooks/use-refined-telos-history', () => ({
    useRefinedTelosHistory: () => ({
        refinedCount: 0,
        lastRefinedDialogueId: null,
        refinedAfterHashes: new Set<string>(),
    }),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(''),
}));

function Harness() {
    const { select } = useSelection(localStore);
    return (
        <>
            <button
                data-testid="opener"
                onClick={() => select('did:noesis:alpha')}
            >
                open
            </button>
            <Inspector />
        </>
    );
}

function flushMicrotasks(): Promise<void> {
    return new Promise((r) => setTimeout(r, 0));
}

describe('Inspector', () => {
    beforeEach(() => {
        localStore = new SelectionStore();
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders nothing when selectedDid is null', () => {
        render(<Harness />);
        expect(screen.queryByTestId('inspector-drawer')).toBeNull();
    });

    it('opens a role="dialog" aria-modal panel on selection', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        const drawer = screen.getByTestId('inspector-drawer');
        expect(drawer).not.toBeNull();
        expect(drawer.getAttribute('role')).toBe('dialog');
        expect(drawer.getAttribute('aria-modal')).toBe('true');
        expect(drawer.getAttribute('aria-labelledby')).toBe('inspector-title');
    });

    it('shows a loading skeleton before the fetch resolves', async () => {
        // Never-resolves promise so state stays "loading".
        fetchMock.mockImplementation(() => new Promise(() => {}));
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        expect(screen.getByTestId('inspector-loading')).not.toBeNull();
    });

    it('renders all four sections on a successful fetch', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        expect(screen.getByTestId('section-psyche')).not.toBeNull();
        expect(screen.getByTestId('section-thymos')).not.toBeNull();
        expect(screen.getByTestId('section-telos')).not.toBeNull();
        expect(screen.getByTestId('section-memory')).not.toBeNull();
    });

    it('renders an error EmptyState for brain_unavailable', async () => {
        fetchMock.mockResolvedValue({ ok: false, error: { kind: 'brain_unavailable' } });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        const err = screen.getByTestId('inspector-error');
        expect(err).not.toBeNull();
        // Per UI-SPEC §162: "Brain unreachable"
        expect(err.textContent).toMatch(/Brain unreachable/i);
    });

    it('ESC key clears the selection and unmounts the drawer', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        expect(screen.getByTestId('inspector-drawer')).not.toBeNull();
        await act(async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            await flushMicrotasks();
        });
        expect(screen.queryByTestId('inspector-drawer')).toBeNull();
        expect(localStore.getSnapshot()).toBeNull();
    });

    it('Tab from last focusable wraps to first; Shift+Tab from first wraps to last', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        const drawer = screen.getByTestId('inspector-drawer');
        // Mirror the production FOCUSABLE_SELECTOR + disabled filter
        // (inspector.tsx:59-60, 137). The H5 "Delete Nous" button
        // (data-testid="inspector-h5-delete") is disabled+tabIndex=0 so
        // it matches the raw selector but is filtered by the production
        // Tab handler. Test MUST filter identically or wrap assertions
        // will fail the first time the H5 affordance lands (Plan 06-06).
        const focusables = Array.from(
            drawer.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'),
        ).filter((el) => !el.hasAttribute('disabled'));
        expect(focusables.length).toBeGreaterThan(0);
        const first = focusables[0]!;
        const last  = focusables[focusables.length - 1]!;

        // Wrap forward: focus last, Tab → first.
        last.focus();
        expect(document.activeElement).toBe(last);
        await act(async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
            await flushMicrotasks();
        });
        expect(document.activeElement).toBe(first);

        // Wrap backward: focus first, Shift+Tab → last.
        first.focus();
        expect(document.activeElement).toBe(first);
        await act(async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
            await flushMicrotasks();
        });
        expect(document.activeElement).toBe(last);
    });

    it('restores focus to the opener after ESC closes the drawer', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE });
        render(<Harness />);
        const opener = screen.getByTestId('opener') as HTMLButtonElement;
        opener.focus();
        expect(document.activeElement).toBe(opener);

        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        expect(document.activeElement).not.toBe(opener);

        await act(async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            await flushMicrotasks();
        });
        expect(document.activeElement).toBe(opener);
    });

    it('aborts the prior fetch when selection changes mid-flight', async () => {
        // Capture the AbortSignals passed to each fetch call.
        const signals: AbortSignal[] = [];
        fetchMock.mockImplementation((_did, _origin, signal: AbortSignal) => {
            signals.push(signal);
            return new Promise(() => {}); // never resolves
        });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        await act(async () => {
            localStore.selectNous('did:noesis:beta');
            await flushMicrotasks();
        });
        expect(signals.length).toBe(2);
        // The first signal must have been aborted once the second request fired.
        expect(signals[0]!.aborted).toBe(true);
        expect(signals[1]!.aborted).toBe(false);
    });
});
