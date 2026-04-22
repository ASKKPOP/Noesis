'use client';
/**
 * EdgeEventsModal — read-only H5 per-edge audit inspection dialog.
 *
 * This is a PLAIN <dialog> — read-only, non-destructive. Per 09-CONTEXT.md
 * §specifics REL-04 and 09-UI-SPEC.md: reading edge events is non-destructive;
 * no audit-chain mutation occurs. The rose-900 destructive frame does NOT apply.
 *
 * Uses native HTMLDialogElement.showModal() for:
 *   - Automatic focus trap (browser-native inert background)
 *   - ESC key fires native 'close' event → handleClose
 *   - aria-modal="true" set implicitly by showModal()
 *
 * Focus restoration: openerRef pattern inherited from Phase 6 — the calling
 * component is responsible for restoring focus to the trigger button on close.
 * (EdgeEventsModal itself calls onClose; caller cleans up.)
 *
 * Error mapping (T-09-25): server errors are mapped to locked copy strings.
 * Raw server error bodies are never rendered.
 */

import { useEffect, useRef, useState } from 'react';
import { fetchEdgeEvents, type EdgeEventsResponse } from '@/lib/api/relationships';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EdgeEventsModalProps {
    readonly edgeKey: string;
    readonly operatorId: string;
    readonly onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EdgeEventsModal({
    edgeKey,
    operatorId,
    onClose,
}: EdgeEventsModalProps): React.ReactElement {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const [events, setEvents] = useState<EdgeEventsResponse['events'] | null>(null);
    const [errorKind, setErrorKind] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // -----------------------------------------------------------------------
    // showModal on mount; close on ESC (native event)
    // -----------------------------------------------------------------------

    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        if (!dlg.open) dlg.showModal();

        const handleClose = (): void => {
            onClose();
        };
        dlg.addEventListener('close', handleClose);
        return () => {
            dlg.removeEventListener('close', handleClose);
        };
    }, [onClose]);

    // -----------------------------------------------------------------------
    // Backdrop click closes the dialog
    // -----------------------------------------------------------------------

    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>): void => {
        if (e.target === dialogRef.current) {
            dialogRef.current?.close();
        }
    };

    // -----------------------------------------------------------------------
    // Close button handler
    // -----------------------------------------------------------------------

    const handleClose = (): void => {
        dialogRef.current?.close();
        // onClose is also fired by the native 'close' event listener above,
        // but calling it here ensures immediate React state update.
        onClose();
    };

    // -----------------------------------------------------------------------
    // Fetch edge events with AbortController (D-9-06 canonical GET route)
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!edgeKey) return;
        const ac = new AbortController();
        setIsLoading(true);
        setErrorKind(null);

        (async () => {
            try {
                const result = await fetchEdgeEvents(edgeKey, operatorId, ac.signal);
                if (ac.signal.aborted) return;
                setEvents(result.events);
                setIsLoading(false);
            } catch (err) {
                if (ac.signal.aborted) return;
                if ((err as { name?: string }).name === 'AbortError') return;
                // Map fetchError kind to error state
                const fe = (err as { fetchError?: { kind: string } }).fetchError;
                setErrorKind(fe?.kind ?? 'network');
                setIsLoading(false);
            }
        })();

        return () => ac.abort();
    }, [edgeKey, operatorId]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <dialog
            ref={dialogRef}
            role="dialog"
            aria-labelledby="edge-events-title"
            data-testid="edge-events-modal"
            onClick={handleBackdropClick}
            className="min-w-[480px] max-w-[720px] rounded border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-2xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 id="edge-events-title" className="text-sm font-semibold text-neutral-100">
                    Edge dialogue turns
                </h3>
                <button
                    type="button"
                    data-testid="edge-events-close-x"
                    onClick={handleClose}
                    autoFocus
                    aria-label="Close"
                    className="text-xs text-neutral-400 hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                >
                    ✕
                </button>
            </div>

            <div className="my-4 border-t border-neutral-800" aria-hidden="true" />

            {/* Content */}
            {isLoading && (
                <div className="text-xs text-neutral-400" role="status">
                    Loading edge dialogue turns…
                </div>
            )}

            {!isLoading && errorKind === 'edge_not_found' && (
                <p className="text-xs text-neutral-400">
                    This edge is no longer visible.
                </p>
            )}

            {!isLoading && errorKind === 'self_loop' && (
                <p className="text-xs text-neutral-400">
                    Self-edges are silently rejected.
                </p>
            )}

            {!isLoading && errorKind && errorKind !== 'edge_not_found' && errorKind !== 'self_loop' && (
                <p className="text-xs text-neutral-400">
                    Grid unreachable. The audit chain is temporarily inaccessible.
                </p>
            )}

            {!isLoading && !errorKind && events !== null && events.length === 0 && (
                <p data-testid="edge-events-empty" className="text-xs text-neutral-400">
                    No raw turns recorded for this edge.
                </p>
            )}

            {!isLoading && !errorKind && events !== null && events.length > 0 && (
                <ul className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                    {events.map((event, i) => (
                        <li key={i} data-testid={`edge-event-${i}`}>
                            <div className="text-[11px] text-neutral-500">
                                tick {event.tick} · {event.type}
                            </div>
                            <pre className="font-mono text-xs text-neutral-200 bg-neutral-800 rounded p-2 overflow-x-auto">
                                {JSON.stringify(event.payload, null, 2)}
                            </pre>
                        </li>
                    ))}
                </ul>
            )}

            {/* Bottom close button */}
            <div className="mt-4 flex justify-end">
                <button
                    type="button"
                    data-testid="edge-events-close"
                    onClick={handleClose}
                    className="px-3 py-1 text-sm font-semibold text-neutral-200 hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                >
                    Close
                </button>
            </div>
        </dialog>
    );
}
