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
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelection } from '@/lib/hooks/use-selection';
import { fetchNousState, type NousStateResponse, type FetchError } from '@/lib/api/introspect';
import { EmptyState } from '@/components/primitives';
import { PsycheSection } from './inspector-sections/psyche';
import { ThymosSection } from './inspector-sections/thymos';
import { TelosSection } from './inspector-sections/telos';
import { MemorySection } from './inspector-sections/memory';

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
};

/** Selector for elements we consider focusable inside the drawer. */
const FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type DrawerState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ok';    data: NousStateResponse }
    | { status: 'error'; error: FetchError };

export function Inspector(): React.ReactElement | null {
    const { selectedDid, clear } = useSelection();
    const [state, setState] = useState<DrawerState>({ status: 'idle' });

    // Tracks the focused element at the moment the drawer opened so we can
    // hand focus back on close. Never read during SSR — guarded by selectedDid.
    const openerRef = useRef<HTMLElement | null>(null);
    const firstFocusable = useRef<HTMLButtonElement | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);

    // NEXT_PUBLIC_GRID_ORIGIN is baked at build time per dashboard/.env.example.
    const origin = useMemo(() => process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '', []);

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

    if (!selectedDid) return null;
    // SSR guard: document is undefined on server — caller already sets
    // 'use client', but double-guard to be explicit about browser-only usage.
    if (typeof document === 'undefined') return null;

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

            {state.status === 'ok' && (
                <>
                    <PsycheSection psyche={state.data.psyche} />
                    <ThymosSection thymos={state.data.thymos} />
                    <TelosSection  telos={state.data.telos} />
                    <MemorySection memories={state.data.memory_highlights} />
                </>
            )}

            {/*
             * H5 "Delete Nous" disabled affordance (Phase 6 D-20 / SC#5).
             * Visible-but-disabled for all tiers H1–H4. Clicking does nothing
             * (no onClick handler bound); keyboard focus is reachable via
             * tabIndex={0} so screen-readers can announce the tooltip.
             * Irreversibility dialog + consent flow lands in Phase 8
             * (AGENCY-05). Rendered outside the fetch-state branches so
             * it is present regardless of loading/error state.
             */}
            <div className="mt-4 border-t border-neutral-800 pt-3">
                <button
                    type="button"
                    data-testid="inspector-h5-delete"
                    disabled
                    aria-disabled="true"
                    title="Requires Phase 8"
                    tabIndex={0}
                    className="w-full cursor-not-allowed rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-600 line-through"
                >
                    Delete Nous
                </button>
                <p className="mt-1 text-[10px] text-neutral-600">
                    H5 — irreversible action, requires Phase 8 consent dialog.
                </p>
            </div>

            <footer className="mt-auto pt-3 text-[11px] text-neutral-600">
                Esc to close
            </footer>
        </div>
    );
}
