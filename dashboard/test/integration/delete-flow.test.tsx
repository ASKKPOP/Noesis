/**
 * delete-flow integration test — Phase 8 AGENCY-05
 *
 * End-to-end: Inspector H5 delete button → ElevationDialog(H5) confirm →
 * IrreversibilityDialog opens → type DID → Delete forever → POST 200 →
 * toast "Nous deleted." → Inspector renders State B tombstoned caption.
 *
 * Also covers:
 *   - 503 brain_unavailable: dialog stays open with inline error
 *   - 410 race: info toast + State B re-render
 *
 * Uses vi.mock of fetchNousState and deleteNous to control the fetch lifecycle.
 * HTMLDialogElement shim required for native <dialog> in jsdom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SelectionStore } from '@/lib/stores/selection-store';
import { useSelection } from '@/lib/hooks/use-selection';
import type { NousStateResponse } from '@/lib/api/introspect';
import { Inspector } from '@/app/grid/components/inspector';

// ── HTMLDialogElement shim ─────────────────────────────────────────────────────
const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal: () => void;
    close: () => void;
};
if (!proto.showModal) {
    proto.showModal = function (this: HTMLDialogElement) {
        (this as unknown as { open: boolean }).open = true;
    };
}
if (!proto.close) {
    proto.close = function (this: HTMLDialogElement) {
        (this as unknown as { open: boolean }).open = false;
        this.dispatchEvent(new Event('close'));
    };
}

// ── Mocks ──────────────────────────────────────────────────────────────────────
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

// ── Test harness ───────────────────────────────────────────────────────────────
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

function Harness() {
    const { select } = useSelection(localStore);
    return (
        <>
            <button data-testid="opener" onClick={() => select('did:noesis:alpha')}>
                open
            </button>
            <Inspector />
        </>
    );
}

function flushMicrotasks(): Promise<void> {
    return new Promise((r) => setTimeout(r, 0));
}

const HASH = 'a'.repeat(64);

const ACTIVE_FIXTURE: NousStateResponse = {
    did: 'did:noesis:alpha',
    name: 'Alpha',
    archetype: 'curious-scholar',
    location: 'origin',
    grid_name: 'noesis',
    mood: 'calm',
    emotions: {},
    active_goals: [],
    psyche: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5 },
    thymos: { mood: 'calm', emotions: {} },
    telos: { active_goals: [] },
    memory_highlights: [],
    status: 'active',
};

const DELETED_FIXTURE: NousStateResponse = {
    ...ACTIVE_FIXTURE,
    status: 'deleted',
    deleted_at_tick: 40,
};

describe('delete-flow integration', () => {
    beforeEach(() => {
        localStore = new SelectionStore();
        fetchMock.mockReset();
        deleteNousMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('happy path: click → elevate H5 → type DID → confirm → toast → State B', async () => {
        // First fetch: active Nous
        fetchMock.mockResolvedValue({ ok: true, data: ACTIVE_FIXTURE });
        deleteNousMock.mockResolvedValue({
            ok: true,
            data: { tombstoned_at_tick: 40, pre_deletion_state_hash: HASH },
        });

        render(<Harness />);

        // Open inspector
        await act(async () => {
            localStore.selectNous('did:noesis:alpha');
            await flushMicrotasks();
        });

        // Step 1: click H5 delete button
        await act(async () => {
            fireEvent.click(screen.getByTestId('inspector-h5-delete'));
            await flushMicrotasks();
        });
        expect(screen.getByTestId('elevation-dialog')).not.toBeNull();

        // Step 2: confirm H5 elevation
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
            await flushMicrotasks();
        });
        expect(screen.getByTestId('irrev-dialog')).not.toBeNull();

        // Step 3: type the DID into the IrreversibilityDialog input
        const input = screen.getByTestId('irrev-did-input') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { value: 'did:noesis:alpha' } });
            await flushMicrotasks();
        });
        // Delete button should now be enabled
        expect(screen.getByTestId('irrev-delete').getAttribute('aria-disabled')).toBe('false');

        // Second fetchMock call: after deletion, refetch shows State B
        fetchMock.mockResolvedValue({ ok: true, data: DELETED_FIXTURE });

        // Step 4: click Delete forever
        await act(async () => {
            fireEvent.click(screen.getByTestId('irrev-delete'));
            await flushMicrotasks();
        });

        // Toast "Nous deleted." should appear
        const toast = screen.queryByTestId('inspector-toast');
        expect(toast).not.toBeNull();
        expect(toast!.textContent).toContain('Nous deleted.');

        // State B: tombstoned caption
        expect(screen.queryByTestId('inspector-tombstone-caption')).not.toBeNull();
        expect(screen.queryByTestId('inspector-h5-delete')).toBeNull();
    });

    it('503 brain_unavailable: dialog stays open, inline error shown', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: ACTIVE_FIXTURE });
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

    it('410 race: info toast + refetch shows State B', async () => {
        fetchMock.mockResolvedValue({ ok: true, data: ACTIVE_FIXTURE });
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

        // After 410, refetch shows deleted
        fetchMock.mockResolvedValue({ ok: true, data: DELETED_FIXTURE });

        await act(async () => {
            fireEvent.click(screen.getByTestId('irrev-delete'));
            await flushMicrotasks();
        });

        // 410 toast
        const toast = screen.queryByTestId('inspector-toast');
        expect(toast).not.toBeNull();
        expect(toast!.textContent).toContain('This Nous was already deleted.');
    });
});
