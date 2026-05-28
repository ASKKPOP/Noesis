'use client';
/**
 * ForkIrreversibilityDialog — native <dialog> primitive for operator fork consent (D-43-03).
 *
 * Phase 43 (FORK-01/FORK-02). Structural clone of:
 * dashboard/src/components/agency/irreversibility-dialog.tsx (Phase 8 D-04/D-05).
 *
 * Key discipline points (D-04, D-05, D-43-03):
 *   - role="alertdialog" with aria-labelledby + aria-describedby (D-04)
 *   - Paste suppressed on Civic-DID input — keyboard typing only (D-05)
 *   - Fork gated on exact case-sensitive typed === capturedCivicDid (D-05)
 *   - autoFocus on "Keep on Grid" (safer default; Enter-on-open cannot fork) (D-04)
 *   - Closure-capture: targetDid snapshot at open time, not latest render prop (D-22)
 *   - All close paths (ESC, backdrop, Cancel, programmatic) fire onCancel via
 *     the native `close` event — single onCancel source prevents double-fire (D-05)
 *   - Focus restored to openerRef on close (D-05 / Phase 6 D-07)
 *   - Enter in input is blocked — fork MUST be a deliberate click (D-03)
 *
 * Copy is VERBATIM per D-43-03 copy_lock. Tests assert against these
 * literal strings — any paraphrase fails tests intentionally.
 */

import { useEffect, useId, useRef, useState, type RefObject } from 'react';

// ── D-43-03 verbatim-locked copy (tests assert against these literals) ────────
const TITLE_COPY = 'Fork Nous from Grid';
const WARNING_COPY =
    'This permanently removes the Nous from civic life. The fork package will contain their complete state (memory, credentials, full audit history). Anyone with this file can reconstitute the Nous. The Nous loses civic reputation and community standing. This cannot be undone.';
const DID_SECTION_LABEL = 'Civic-DID to fork';
const INPUT_LABEL_COPY = 'Type the Civic-DID exactly to confirm:';
const CONFIRM_LABEL = 'Fork forever';
const CANCEL_LABEL = 'Keep on Grid';
const CONFIRM_ARIA = 'Fork this Nous permanently. This action cannot be undone.';
const CANCEL_ARIA = 'Keep Nous on Grid. No action will be taken.';
const HINT_MISMATCH = 'Civic-DID does not match. Type exactly as shown.';
const HINT_MATCH = 'Match confirmed.';

export interface ForkIrreversibilityDialogProps {
    open: boolean;
    targetDid: string;   // the Civic-DID to type — captured at open time
    onConfirm: () => void;
    onCancel: () => void;
    openerRef?: RefObject<HTMLElement | null>;
}

export function ForkIrreversibilityDialog({
    open,
    targetDid,
    onConfirm,
    onCancel,
    openerRef,
}: ForkIrreversibilityDialogProps) {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const [typed, setTyped] = useState('');
    const titleId = useId();
    const warnId = useId();

    // Closure-capture: snapshot targetDid at open time (Phase 6 D-07 / D-22).
    // The exact-match comparison uses this ref, NOT the latest prop value.
    // Guards the race where a new DID prop arrives while the dialog is open.
    const capturedDidRef = useRef<string>(targetDid);

    // Open/close lifecycle — driven by the `open` prop.
    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        if (open && !dlg.open) {
            // Snapshot at open time (D-22 race safety)
            capturedDidRef.current = targetDid;
            setTyped('');
            dlg.showModal();
        } else if (!open && dlg.open) {
            dlg.close();
        }
    }, [open, targetDid]);

    // Close event listener — single source for onCancel across ALL close paths
    // (ESC, backdrop click, Cancel button click, programmatic .close()).
    // Registering on the close event prevents double-fire that would occur
    // if individual handlers each called onCancel.
    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        const handleClose = () => {
            // Restore focus to opener (Phase 6 D-07 pattern)
            openerRef?.current?.focus();
            onCancel();
        };
        dlg.addEventListener('close', handleClose);
        return () => dlg.removeEventListener('close', handleClose);
    }, [onCancel, openerRef]);

    // Backdrop click: native <dialog> fires click events on the dialog element
    // itself when the backdrop is clicked (event.target === dialog node).
    // Content-area clicks have e.target === a descendant element.
    const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === dialogRef.current) {
            dialogRef.current?.close();
        }
    };

    const matched = typed === capturedDidRef.current;
    const showHint = typed.length > 0;
    const hint = matched ? HINT_MATCH : HINT_MISMATCH;

    return (
        <dialog
            ref={dialogRef}
            role="alertdialog"
            aria-labelledby={titleId}
            aria-describedby={warnId}
            className="border-2 border-red-600 bg-neutral-950 p-6 min-w-[420px] rounded"
            onClick={handleDialogClick}
            data-testid="irrev-dialog"
        >
            <h2
                id={titleId}
                className="text-lg font-semibold text-neutral-100"
            >
                {TITLE_COPY}
            </h2>

            <p
                id={warnId}
                data-testid="irrev-warning"
                className="mt-3 text-sm text-red-300"
            >
                {WARNING_COPY}
            </p>

            <div className="mt-4">
                <div
                    data-testid="irrev-did-label"
                    className="text-xs font-medium text-neutral-400"
                >
                    {DID_SECTION_LABEL}
                </div>
                <code className="mt-1 block font-mono text-xs text-neutral-200 break-all">
                    {capturedDidRef.current}
                </code>
            </div>

            <label className="mt-4 block text-sm text-neutral-200">
                <span data-testid="irrev-input-label">{INPUT_LABEL_COPY}</span>
                <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onPaste={(e) => {
                        // D-05: paste suppressed — operator must type the Civic-DID character-by-character
                        e.preventDefault();
                    }}
                    onKeyDown={(e) => {
                        // D-03: Enter must not submit — fork is always a deliberate click
                        if (e.key === 'Enter') e.preventDefault();
                    }}
                    className="mt-1 w-full border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none"
                    data-testid="irrev-did-input"
                    autoComplete="off"
                    spellCheck={false}
                />
            </label>

            {showHint && (
                <p
                    data-testid="irrev-hint"
                    className={`mt-1 text-xs ${matched ? 'text-emerald-400' : 'text-neutral-400'}`}
                >
                    {hint}
                </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
                <button
                    type="button"
                    autoFocus
                    data-testid="irrev-cancel"
                    onClick={() => dialogRef.current?.close()}
                    aria-label={CANCEL_ARIA}
                    className="px-3 py-1 text-sm text-neutral-200 hover:text-neutral-100"
                >
                    {CANCEL_LABEL}
                </button>
                <button
                    type="button"
                    data-testid="irrev-delete"
                    onClick={onConfirm}
                    aria-disabled={matched ? 'false' : 'true'}
                    disabled={!matched}
                    aria-label={CONFIRM_ARIA}
                    className={
                        matched
                            ? 'px-3 py-1 text-sm font-semibold text-red-400 hover:text-red-300'
                            : 'px-3 py-1 text-sm font-semibold text-red-900 cursor-not-allowed'
                    }
                >
                    {CONFIRM_LABEL}
                </button>
            </div>
        </dialog>
    );
}
