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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SelectionStore } from '@/lib/stores/selection-store';
import { useSelection } from '@/lib/hooks/use-selection';
import type { NousStateResponse } from '@/lib/api/introspect';
import { Inspector } from './inspector';

// Mock deleteNous so Inspector tests don't need a real backend
const deleteNousMock = vi.fn();
vi.mock('@/lib/api/operator', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api/operator')>(
        '@/lib/api/operator',
    );
    return {
        ...actual,
        deleteNous: (...args: unknown[]) => deleteNousMock(...args),
    };
});

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

// Phase 9: RelationshipsSection imports tick-store → useStores (StoresProvider).
// Short-circuit the relationships hook and tick store so the Inspector test
// harness (which has no StoresProvider) keeps working without modification.
vi.mock('@/lib/stores/tick-store', () => ({ useTick: () => 0 }));
vi.mock('@/lib/hooks/use-relationships', () => ({
    useRelationshipsH1: () => ({ data: undefined, isLoading: false, error: undefined }),
    useRelationshipsH2: () => ({ data: undefined, isLoading: false, error: undefined }),
    useGraph: () => ({ data: undefined, isLoading: false, error: undefined }),
}));

// Phase 10a: AnankeSection subscribes to useAnankeLevels → useFirehose →
// StoresProvider. Short-circuit with a baseline map so the Inspector test
// harness keeps working without a StoresProvider (mirrors Phase 7 + 9 pattern).
vi.mock('@/lib/hooks/use-ananke-levels', () => ({
    useAnankeLevels: () => new Map([
        ['hunger',     { level: 'low', direction: null }],
        ['curiosity',  { level: 'med', direction: null }],
        ['safety',     { level: 'low', direction: null }],
        ['boredom',    { level: 'med', direction: null }],
        ['loneliness', { level: 'med', direction: null }],
    ]),
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

// ── HTMLDialogElement shim for IrreversibilityDialog + ElevationDialog ────────
// (mirrors elevation-dialog.test.tsx pattern)
const dialogProto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal: () => void;
    close: () => void;
};
if (!dialogProto.showModal) {
    dialogProto.showModal = function (this: HTMLDialogElement) {
        (this as unknown as { open: boolean }).open = true;
    };
}
if (!dialogProto.close) {
    dialogProto.close = function (this: HTMLDialogElement) {
        (this as unknown as { open: boolean }).open = false;
        this.dispatchEvent(new Event('close'));
    };
}

const FIXTURE_ACTIVE: NousStateResponse = {
    ...{
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
    },
    status: 'active',
};

const FIXTURE_DELETED: NousStateResponse = {
    ...FIXTURE_ACTIVE,
    status: 'deleted',
    deleted_at_tick: 42,
};

describe('Inspector — State A/B/C + H5 two-stage flow (Phase 8)', () => {
    beforeEach(() => {
        localStore = new SelectionStore();
        fetchMock.mockReset();
        deleteNousMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('State A: active Nous → inspector-h5-delete button is present and not disabled', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE_ACTIVE });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        const deleteBtn = screen.getByTestId('inspector-h5-delete');
        expect(deleteBtn).not.toBeNull();
        expect(deleteBtn.hasAttribute('disabled')).toBe(false);
    });

    it('State B: deleted Nous → renders tombstoned caption, no delete button', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE_DELETED });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        // State B caption text (copy-locked)
        expect(screen.getByTestId('inspector-tombstone-caption').textContent).toContain(
            'Nous deleted at tick 42',
        );
        expect(screen.getByTestId('inspector-tombstone-firehose').textContent).toContain(
            'Audit history available in the firehose.',
        );
        // Delete button hidden in State B (D-06)
        expect(screen.queryByTestId('inspector-h5-delete')).toBeNull();
    });

    it('State C: loading state → inspector-h5-delete rendered (click is no-op)', async () => {
        fetchMock.mockImplementation(() => new Promise(() => {})); // never resolves
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        // Button visible in State C
        const deleteBtn = screen.queryByTestId('inspector-h5-delete');
        expect(deleteBtn).not.toBeNull();
    });

    it('Clicking inspector-h5-delete on active Nous opens ElevationDialog with H5', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE_ACTIVE });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('inspector-h5-delete'));
            await flushMicrotasks();
        });
        // ElevationDialog opens
        const elevDlg = screen.queryByTestId('elevation-dialog');
        expect(elevDlg).not.toBeNull();
        // Dialog content mentions H5
        expect(elevDlg!.textContent).toContain('H5');
    });

    it('Confirming H5 elevation opens IrreversibilityDialog', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE_ACTIVE });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        // Open ElevationDialog
        await act(async () => {
            fireEvent.click(screen.getByTestId('inspector-h5-delete'));
            await flushMicrotasks();
        });
        // Confirm H5
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
            await flushMicrotasks();
        });
        // IrreversibilityDialog should now be open
        expect(screen.queryByTestId('irrev-dialog')).not.toBeNull();
    });

    it('On 200 delete success: toast text appears, tier auto-downgrades', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE_ACTIVE });
        deleteNousMock.mockResolvedValue({
            ok: true,
            data: { tombstoned_at_tick: 40, pre_deletion_state_hash: 'a'.repeat(64) },
        });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        // Click delete → elevate → confirm irrev
        await act(async () => {
            fireEvent.click(screen.getByTestId('inspector-h5-delete'));
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
            await flushMicrotasks();
        });
        // Type the DID to enable delete
        const input = screen.getByTestId('irrev-did-input') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { value: 'did:noesis:alpha' } });
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('irrev-delete'));
            await flushMicrotasks();
        });
        // Success toast should appear
        expect(screen.queryByTestId('inspector-toast')).not.toBeNull();
        expect(screen.getByTestId('inspector-toast').textContent).toContain('Nous deleted.');
    });

    it('On 410 race: info toast "This Nous was already deleted." appears', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE_ACTIVE });
        deleteNousMock.mockResolvedValue({ ok: false, error: { kind: 'nous_deleted' } });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('inspector-h5-delete'));
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
            await flushMicrotasks();
        });
        const input = screen.getByTestId('irrev-did-input') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { value: 'did:noesis:alpha' } });
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('irrev-delete'));
            await flushMicrotasks();
        });
        const toast = screen.queryByTestId('inspector-toast');
        expect(toast).not.toBeNull();
        expect(toast!.textContent).toContain('This Nous was already deleted.');
    });

    it('On 503: IrreversibilityDialog stays open with inline error', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE_ACTIVE });
        deleteNousMock.mockResolvedValue({ ok: false, error: { kind: 'brain_unavailable' } });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('inspector-h5-delete'));
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
            await flushMicrotasks();
        });
        const input = screen.getByTestId('irrev-did-input') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { value: 'did:noesis:alpha' } });
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('irrev-delete'));
            await flushMicrotasks();
        });
        // Dialog stays open on 503
        expect(screen.queryByTestId('irrev-dialog')).not.toBeNull();
        // Inline error shown
        expect(screen.getByTestId('inspector-inline-error').textContent).toContain(
            'Brain unavailable. Try again.',
        );
    });

    it('Cancel from IrreversibilityDialog auto-downgrades H5→H1, no deleteNous call', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: FIXTURE_ACTIVE });
        render(<Harness />);
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('inspector-h5-delete'));
            await flushMicrotasks();
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
            await flushMicrotasks();
        });
        // Cancel from IrreversibilityDialog
        await act(async () => {
            fireEvent.click(screen.getByTestId('irrev-cancel'));
            await flushMicrotasks();
        });
        expect(deleteNousMock).not.toHaveBeenCalled();
        // IrreversibilityDialog closed
        expect(screen.queryByTestId('irrev-dialog')).toBeNull();
    });
});
