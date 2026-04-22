'use client';
/**
 * Inspector — the right-side Nous drawer. WAI-ARIA dialog with hand-rolled
 * focus trap, ESC-to-close, and AbortController-guarded fetch lifecycle.
 *
 * Lives at `dashboard/src/app/grid/components/inspector.tsx` — D15 layout
 * lock. Sub-sections are in `./inspector-sections/`. Primitives come from
 * `@/components/primitives` (Plan 04-04); none are redeclared here.
 *
 * Lifecycle (Plan 04-05 Task 3):
 *   1. `selectedDid === null` → render null (including during SSR).
 *   2. Selection transitions non-null → capture `document.activeElement` in
 *      `openerRef` so we can restore focus on close.
 *   3. New AbortController spawned per selection; prior one is aborted on
 *      either selection change or unmount (T-04-25 race mitigation).
 *   4. While fetch is pending → loading skeleton.
 *   5. Success → stack Psyche / Thymos / Telos / Memory sections.
 *   6. Error → EmptyState with per-kind copy from `ERR_COPY` (T-04-22:
 *      backend error strings are never rendered; only our locked copy).
 *   7. Keyboard: ESC calls `selection.clear()`; Tab/Shift+Tab cycle the
 *      focusable descendants (T-04-24: no focus escape from dialog).
 *   8. On close → restore focus to the opener if still in the DOM.
 *
 * Phase 8 (AGENCY-05): adds H5 two-stage delete flow.
 *   - State A: active Nous → inspector-h5-delete button enabled
 *   - State B: deleted Nous → tombstoned caption, no delete button (D-06)
 *   - State C: loading/error → delete button visible but click is no-op
 *   - ElevationDialog(H5) → IrreversibilityDialog → deleteNous() → toast + refetch
 *   - 410 race: info toast + refetch → State B; auto-downgrade H5→H1
 *   - 503: inline error in dialog, tier stays H5 until explicit cancel
 *   - Cancel path: auto-downgrade H5→H1, no deleteNous call (D-05)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelection } from '@/lib/hooks/use-selection';
import { fetchNousState, type NousStateResponse, type FetchError } from '@/lib/api/introspect';
import { deleteNous } from '@/lib/api/operator';
import { agencyStore } from '@/lib/stores/agency-store';
import { EmptyState } from '@/components/primitives';
import { ElevationDialog } from '@/components/agency/elevation-dialog';
import { IrreversibilityDialog } from '@/components/agency/irreversibility-dialog';
import { PsycheSection } from './inspector-sections/psyche';
import { ThymosSection } from './inspector-sections/thymos';
import { AnankeSection } from './inspector-sections/ananke';
import { TelosSection } from './inspector-sections/telos';
import { MemorySection } from './inspector-sections/memory';
import { RelationshipsSection } from './inspector-sections/relationships';

/**
 * Locked error-copy map. UI-SPEC §162-166 is the single source of truth for
 * these strings. Backend error discriminants map to UI copy here; the raw
 * `error` field from the server is NEVER rendered (T-04-22).
 */
const ERR_COPY: Record<FetchError['kind'], { title: string; description: string }> = {
    invalid_did: {
        title: 'Invalid Nous ID',
        description: 'The DID is malformed. Close and reopen from the map.',
    },
    unknown_nous: {
        title: 'Nous not found',
        description: 'This DID is not in the current roster. It may have been despawned — close and reopen from the map.',
    },
    brain_unavailable: {
        title: 'Brain unreachable',
        description: 'The Grid returned 503 for this DID. Is the noesis-nous container up?',
    },
    network: {
        title: 'Inspector failed to load',
        description: 'The Grid could not be reached. Refresh to retry.',
    },
    // Phase 8 (D-20): 410 Gone → nous_deleted EmptyState (copy-locked per copy_lock)
    nous_deleted: {
        title: 'Nous deleted',
        description: 'This Nous was deleted. Audit history remains in the firehose.',
    },
};

// Phase 8 copy constants (copy-locked — tests assert these literals)
const TOAST_SUCCESS = 'Nous deleted.';
const TOAST_RACE = 'This Nous was already deleted.';
const INLINE_ERROR_503 = 'Brain unavailable. Try again.';

/** Selector for elements we consider focusable inside the drawer. */
const FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type DrawerState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ok';    data: NousStateResponse }
    | { status: 'error'; error: FetchError };

type ToastState = { message: string; id: number } | null;

export function Inspector(): React.ReactElement | null {
    const { selectedDid, clear } = useSelection();
    const [state, setState] = useState<DrawerState>({ status: 'idle' });

    // Phase 9: in-drawer tab state (Overview | Relationships)
    const [inspectorTab, setInspectorTab] = useState<'overview' | 'relationships'>('overview');

    // Phase 8: two-stage delete state
    const [elevationOpen, setElevationOpen] = useState(false);
    const [irrevOpen, setIrrevOpen] = useState(false);
    const [inlineError, setInlineError] = useState<string | null>(null);
    const [toast, setToast] = useState<ToastState>(null);

    // Tracks the focused element at the moment the drawer opened so we can
    // hand focus back on close. Never read during SSR — guarded by selectedDid.
    const openerRef = useRef<HTMLElement | null>(null);
    const firstFocusable = useRef<HTMLButtonElement | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const deleteButtonRef = useRef<HTMLButtonElement | null>(null);

    // NEXT_PUBLIC_GRID_ORIGIN is baked at build time per dashboard/.env.example.
    const origin = useMemo(() => process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '', []);

    // --- Phase 9: reset tab to 'overview' on every DID change (UI-SPEC §Surface 1b)
    useEffect(() => {
        setInspectorTab('overview');
    }, [selectedDid]);

    // --- Fetch lifecycle -----------------------------------------------------
    useEffect(() => {
        if (!selectedDid) {
            setState({ status: 'idle' });
            return;
        }
        // Capture the opener BEFORE we move focus into the drawer.
        if (typeof document !== 'undefined') {
            openerRef.current = document.activeElement as HTMLElement | null;
        }

        const ac = new AbortController();
        setState({ status: 'loading' });

        (async () => {
            try {
                const r = await fetchNousState(selectedDid, origin, ac.signal);
                if (ac.signal.aborted) return;
                setState(r.ok
                    ? { status: 'ok', data: r.data }
                    : { status: 'error', error: r.error });
            } catch (err) {
                // AbortError is expected on selection change; anything else is network.
                if ((err as { name?: string }).name === 'AbortError') return;
                setState({ status: 'error', error: { kind: 'network' } });
            }
        })();

        return () => ac.abort();
    }, [selectedDid, origin]);

    // --- Focus management + keyboard trap ------------------------------------
    useEffect(() => {
        if (!selectedDid) {
            // Restore focus to the opener if still connected.
            const opener = openerRef.current;
            if (opener && typeof document !== 'undefined' && document.contains(opener)) {
                opener.focus();
            }
            return;
        }

        // Focus the close button once the drawer mounts.
        firstFocusable.current?.focus();

        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                e.preventDefault();
                clear();
                return;
            }
            if (e.key !== 'Tab') return;
            const root = dialogRef.current;
            if (!root) return;
            const focusables = Array.from(
                root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            ).filter((el) => !el.hasAttribute('disabled'));
            if (focusables.length === 0) return;

            const first = focusables[0]!;
            const last  = focusables[focusables.length - 1]!;
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selectedDid, clear]);

    // --- Phase 8: H5 delete orchestration -----------------------------------

    const showToast = (message: string) => {
        setToast({ message, id: Date.now() });
        // Auto-dismiss after 4s
        setTimeout(() => setToast(null), 4000);
    };

    const refetchState = () => {
        if (!selectedDid) return;
        setState({ status: 'loading' });
        (async () => {
            try {
                const r = await fetchNousState(selectedDid, origin);
                setState(r.ok
                    ? { status: 'ok', data: r.data }
                    : { status: 'error', error: r.error });
            } catch {
                setState({ status: 'error', error: { kind: 'network' } });
            }
        })();
    };

    const onH5DeleteClick = () => {
        // State C guard: only open ElevationDialog when Nous is confirmed active
        if (state.status !== 'ok' || state.data.status !== 'active') return;
        setElevationOpen(true);
    };

    const onElevationConfirm = () => {
        setElevationOpen(false);
        agencyStore.setTier('H5');
        setIrrevOpen(true);
    };

    const onElevationCancel = () => {
        setElevationOpen(false);
    };

    const onIrrevConfirm = async () => {
        if (!selectedDid) return;
        setInlineError(null);
        const result = await deleteNous(selectedDid, origin);
        if (result.ok) {
            showToast(TOAST_SUCCESS);
            setIrrevOpen(false);
            agencyStore.setTier('H1');
            refetchState();
            return;
        }
        switch (result.error.kind) {
            case 'nous_deleted':
                showToast(TOAST_RACE);
                setIrrevOpen(false);
                agencyStore.setTier('H1');
                refetchState();
                break;
            case 'brain_unavailable':
                // Dialog stays open — operator can retry (D-30)
                setInlineError(INLINE_ERROR_503);
                break;
            default:
                // invalid_did / unknown_nous / network → close + downgrade
                setIrrevOpen(false);
                agencyStore.setTier('H1');
                break;
        }
    };

    const onIrrevCancel = () => {
        setIrrevOpen(false);
        setInlineError(null);
        // D-05 auto-downgrade: H5 is single-use; cancel exits the elevation
        agencyStore.setTier('H1');
    };

    if (!selectedDid) return null;
    // SSR guard: document is undefined on server — caller already sets
    // 'use client', but double-guard to be explicit about browser-only usage.
    if (typeof document === 'undefined') return null;

    // Determine which delete affordance to render (State A / B / C)
    const isStateB =
        state.status === 'ok' && state.data.status === 'deleted';

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspector-title"
            data-testid="inspector-drawer"
            className="fixed right-0 top-0 z-40 flex h-full w-96 flex-col overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4 shadow-xl"
        >
            <header className="mb-3 flex items-center justify-between">
                <h2
                    id="inspector-title"
                    className="text-sm font-semibold text-neutral-100"
                >
                    Nous Inspector
                </h2>
                <button
                    ref={firstFocusable}
                    data-testid="inspector-close"
                    onClick={clear}
                    aria-label="Close inspector"
                    className="rounded px-2 text-neutral-400 hover:text-neutral-100"
                >
                    ×
                </button>
            </header>

            {/* Phase 9: in-drawer tab strip (Overview | Relationships) */}
            <div
                role="tablist"
                data-testid="inspector-tabs"
                className="flex gap-0 border-b border-neutral-800 mb-3"
                onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                        setInspectorTab((t) => t === 'overview' ? 'relationships' : 'overview');
                    } else if (e.key === 'ArrowLeft') {
                        setInspectorTab((t) => t === 'overview' ? 'relationships' : 'overview');
                    }
                }}
            >
                <button
                    role="tab"
                    type="button"
                    data-testid="inspector-tab-overview"
                    aria-selected={inspectorTab === 'overview'}
                    aria-controls="inspector-panel-overview"
                    onClick={() => setInspectorTab('overview')}
                    className={`px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500 ${
                        inspectorTab === 'overview'
                            ? 'border-b-2 border-accent text-neutral-100 -mb-[1px]'
                            : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                >
                    Overview
                </button>
                <button
                    role="tab"
                    type="button"
                    data-testid="inspector-tab-relationships"
                    aria-selected={inspectorTab === 'relationships'}
                    aria-controls="inspector-panel-relationships"
                    onClick={() => setInspectorTab('relationships')}
                    className={`px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500 ${
                        inspectorTab === 'relationships'
                            ? 'border-b-2 border-accent text-neutral-100 -mb-[1px]'
                            : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                >
                    Relationships
                </button>
            </div>

            {/* Toast (Phase 8 delete feedback) */}
            {toast && (
                <div
                    data-testid="inspector-toast"
                    className="mb-2 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200"
                >
                    {toast.message}
                </div>
            )}

            {state.status === 'loading' && (
                <div data-testid="inspector-loading" className="text-xs text-neutral-400">
                    Loading…
                </div>
            )}

            {state.status === 'error' && (
                <EmptyState
                    title={ERR_COPY[state.error.kind].title}
                    description={ERR_COPY[state.error.kind].description}
                    testId="inspector-error"
                />
            )}

            {state.status === 'ok' && !isStateB && (
                <>
                    <div
                        id="inspector-panel-overview"
                        role="tabpanel"
                        aria-labelledby="inspector-tab-overview"
                        hidden={inspectorTab !== 'overview'}
                    >
                        <PsycheSection psyche={state.data.psyche} />
                        <ThymosSection thymos={state.data.thymos} />
                        <AnankeSection did={selectedDid} />
                        <TelosSection  telos={state.data.telos} did={selectedDid} />
                        <MemorySection memories={state.data.memory_highlights} />
                    </div>
                    <div
                        id="inspector-panel-relationships"
                        role="tabpanel"
                        aria-labelledby="inspector-tab-relationships"
                        hidden={inspectorTab !== 'relationships'}
                    >
                        <RelationshipsSection did={selectedDid} />
                    </div>
                </>
            )}

            {/* State B: tombstoned Nous — show caption, hide delete button (D-06) */}
            {isStateB && (
                <div className="mt-2">
                    <p
                        data-testid="inspector-tombstone-caption"
                        className="text-sm text-neutral-300"
                    >
                        Nous deleted at tick {state.data.deleted_at_tick}
                    </p>
                    <p
                        data-testid="inspector-tombstone-firehose"
                        className="mt-1 text-xs text-neutral-500"
                    >
                        Audit history available in the firehose.
                    </p>
                </div>
            )}

            {/* State A + C: Delete Nous button (Phase 8 AGENCY-05). Hidden in State B (D-06). */}
            {!isStateB && (
                <div className="mt-4 border-t border-neutral-800 pt-3">
                    <button
                        ref={deleteButtonRef}
                        type="button"
                        data-testid="inspector-h5-delete"
                        onClick={onH5DeleteClick}
                        className="w-full rounded border border-rose-900/60 bg-neutral-900 px-3 py-2 text-xs text-red-400 hover:bg-rose-950/30 hover:text-red-300"
                    >
                        Delete Nous
                    </button>
                    <p className="mt-1 text-[10px] text-neutral-600">
                        H5 Sovereign — irreversible action.
                    </p>
                </div>
            )}

            {/* Phase 8: Inline error for 503 (shown when IrreversibilityDialog is open) */}
            {inlineError && irrevOpen && (
                <p
                    data-testid="inspector-inline-error"
                    className="mt-2 text-xs text-red-400"
                >
                    {inlineError}
                </p>
            )}

            <footer className="mt-auto pt-3 text-[11px] text-neutral-600">
                Esc to close
            </footer>

            {/* Phase 8: ElevationDialog for H5 gate */}
            {elevationOpen && (
                <ElevationDialog
                    targetTier="H5"
                    open={elevationOpen}
                    onConfirm={onElevationConfirm}
                    onCancel={onElevationCancel}
                />
            )}

            {/* Phase 8: IrreversibilityDialog — DID-typed confirmation.
                Conditionally rendered so queryByTestId returns null after cancel. */}
            {irrevOpen && (
                <IrreversibilityDialog
                    open={irrevOpen}
                    targetDid={selectedDid}
                    onConfirm={onIrrevConfirm}
                    onCancel={onIrrevCancel}
                    openerRef={deleteButtonRef}
                />
            )}
        </div>
    );
}
