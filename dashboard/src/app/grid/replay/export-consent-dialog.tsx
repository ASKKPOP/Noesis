'use client';
/**
 * ExportConsentDialog — H5-gated paste-suppressed dialog for audit chain export.
 *
 * Phase 13 (REPLAY-02 / D-13-08 / D-13-09 / T-10-10).
 *
 * Cloned from IrreversibilityDialog — same discipline:
 *   - role="alertdialog" with aria-labelledby + aria-describedby
 *   - Paste suppressed on Grid-ID input — keyboard typing only (D-13-08)
 *   - Export gated on exact case-sensitive typed === capturedGridId (D-13-08)
 *   - autoFocus on "Keep private" (safer default; Enter-on-open cannot export)
 *   - Closure-capture: gridId snapshot at open time (D-13-08 race safety)
 *   - All close paths (ESC, backdrop, Cancel, programmatic) fire onCancel via
 *     the native `close` event — single onCancel source prevents double-fire
 *   - Cancel path auto-downgrades tier to H1 (D-13-07)
 *   - The dialog only signals intent; parent owns the fetch call
 *
 * Copy is VERBATIM per D-13-08 copy-lock. Tests assert against these
 * literal strings — any paraphrase fails tests intentionally.
 */

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { agencyStore } from '@/lib/stores/agency-store';

// ── Copy constants (D-13-08 single source of truth — tests assert these literals) ──
const TITLE_COPY = 'Export audit chain slice';
const WARNING_COPY =
    'This export is permanent and cannot be undone. The tarball will contain the complete audit chain for the selected tick range. Anyone with the file can verify the chain.';
const GRID_ID_LABEL = 'Type the Grid-ID exactly to confirm:';
const HINT_MISMATCH = 'Grid-ID does not match. Type exactly as shown.';
const HINT_MATCH = 'Match confirmed.';
const CONFIRM_LABEL = 'Export forever';
const CANCEL_LABEL = 'Keep private';
const CONFIRM_ARIA = 'Export this audit chain slice. The archive cannot be recalled.';
const CANCEL_ARIA = 'Keep this slice private. No archive will be created.';

export interface ExportConsentDialogProps {
    open: boolean;
    gridId: string;        // operator's Grid-ID (DID); shown for typing match
    onConfirm: () => void; // parent owns the fetch; dialog only signals
    onCancel: () => void;
    openerRef?: RefObject<HTMLElement | null>;
}

export function ExportConsentDialog({
    open,
    gridId,
    onConfirm,
    onCancel,
    openerRef,
}: ExportConsentDialogProps) {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const [typed, setTyped] = useState('');
    const titleId = useId();
    const warnId = useId();

    // Closure-capture: snapshot gridId at open time (D-13-08 race safety).
    // The exact-match comparison uses this ref, NOT the latest prop value.
    // Guards the race where a new gridId prop arrives while the dialog is open.
    const capturedGridIdRef = useRef<string>(gridId);

    // Open/close lifecycle — driven by the `open` prop.
    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        if (open && !dlg.open) {
            // Snapshot at open time (D-13-08 race safety)
            capturedGridIdRef.current = gridId;
            setTyped('');
            dlg.showModal();
        } else if (!open && dlg.open) {
            dlg.close();
        }
    }, [open, gridId]);

    // Close event listener — single source for onCancel across ALL close paths
    // (ESC, backdrop click, Cancel button click, programmatic .close()).
    // Also auto-downgrades tier to H1 on any close (D-13-07).
    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        const handleClose = () => {
            // Restore focus to opener
            openerRef?.current?.focus();
            // D-13-07: auto-downgrade tier to H1 on any close path
            agencyStore.setTier('H1');
            onCancel();
        };
        dlg.addEventListener('close', handleClose);
        return () => dlg.removeEventListener('close', handleClose);
    }, [onCancel, openerRef]);

    // Backdrop click: native <dialog> fires click events on the dialog element
    // itself when the backdrop is clicked (event.target === dialog node).
    const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === dialogRef.current) {
            dialogRef.current?.close();
        }
    };

    const matched = typed === capturedGridIdRef.current;
    const showHint = typed.length > 0;
    const hint = matched ? HINT_MATCH : HINT_MISMATCH;

    return (
        <dialog
            ref={dialogRef}
            role="alertdialog"
            aria-labelledby={titleId}
            aria-describedby={warnId}
            className="border-2 border-amber-600 bg-neutral-950 p-6 min-w-[420px] rounded"
            onClick={handleDialogClick}
            data-testid="export-consent-dialog"
        >
            <h2
                id={titleId}
                className="text-lg font-semibold text-neutral-100"
            >
                {TITLE_COPY}
            </h2>

            <p
                id={warnId}
                data-testid="export-warning"
                className="mt-3 text-sm text-amber-300"
            >
                {WARNING_COPY}
            </p>

            <label className="mt-4 block text-sm text-neutral-200">
                <span data-testid="export-grid-label">{GRID_ID_LABEL}</span>
                <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onPaste={(e) => {
                        // D-13-08: paste suppressed — operator must type Grid-ID character-by-character
                        e.preventDefault();
                    }}
                    onKeyDown={(e) => {
                        // Enter must not submit — export is always a deliberate click
                        if (e.key === 'Enter') e.preventDefault();
                    }}
                    className="mt-1 w-full border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none"
                    data-testid="export-grid-input"
                    autoComplete="off"
                    spellCheck={false}
                />
            </label>

            {showHint && (
                <p
                    data-testid="export-hint"
                    className={`mt-1 text-xs ${matched ? 'text-emerald-400' : 'text-neutral-400'}`}
                >
                    {hint}
                </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
                <button
                    type="button"
                    autoFocus
                    data-testid="export-cancel"
                    onClick={() => dialogRef.current?.close()}
                    aria-label={CANCEL_ARIA}
                    className="px-3 py-1 text-sm text-neutral-200 hover:text-neutral-100"
                >
                    {CANCEL_LABEL}
                </button>
                <button
                    type="button"
                    data-testid="export-confirm"
                    onClick={() => onConfirm()}
                    aria-disabled={matched ? 'false' : 'true'}
                    disabled={!matched}
                    aria-label={CONFIRM_ARIA}
                    className={
                        matched
                            ? 'px-3 py-1 text-sm font-semibold text-amber-400 hover:text-amber-300'
                            : 'px-3 py-1 text-sm font-semibold text-amber-900 cursor-not-allowed'
                    }
                >
                    {CONFIRM_LABEL}
                </button>
            </div>
        </dialog>
    );
}
