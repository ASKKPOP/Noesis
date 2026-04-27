'use client';
import React from 'react';
/**
 * VotingHistoryModal — H5-only native <dialog> modal showing per-Nous voting history.
 *
 * Fetches GET /api/v1/governance/proposals/:id/ballots/history on open.
 * Renders voter_did (truncated to first 12 chars + "…"), committed_tick,
 * revealed_tick, choice (or "—" if not revealed).
 *
 * Defense in depth:
 *   - Page renders no trigger button for non-H5 callers (D-12-09)
 *   - Modal self-guards: 403 response renders "H5 required" message
 *
 * Native <dialog> (no Radix/Headless — project convention, D-08 / D-12-09):
 *   - showModal() called on open
 *   - Esc handled natively via dialog close event listener
 *   - Backdrop click via onClick checking event.target === dialogRef.current
 *   - Close button explicit trigger
 *
 * Wall-clock ban: no Date.now / Math.random. Tick numbers from server.
 *
 * Phase 12 Wave 4 — VOTE-07 / D-12-09 / T-09-16.
 */

import { useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BallotHistoryEntry {
    voter_did: string;
    committed_at_tick: number;
    revealed_at_tick?: number;
    choice?: 'yes' | 'no' | 'abstain';
}

interface HistoryResponse {
    ballots: BallotHistoryEntry[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface VotingHistoryModalProps {
    isOpen: boolean;
    proposalId: string;
    onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VotingHistoryModal({ isOpen, proposalId, onClose }: VotingHistoryModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [ballots, setBallots] = useState<BallotHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // ── Open / close dialog ───────────────────────────────────────────────────
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen) {
            dialog.showModal();
            // Fetch history on open
            setIsLoading(true);
            setErrorMsg(null);
            setBallots([]);

            fetch(`/api/v1/governance/proposals/${proposalId}/ballots/history`)
                .then((resp) => {
                    if (resp.status === 403) {
                        setErrorMsg('H5 required — only H5 operators may view voting history.');
                        return null;
                    }
                    if (!resp.ok) {
                        setErrorMsg(`Failed to load ballot history (${resp.status}).`);
                        return null;
                    }
                    return resp.json() as Promise<HistoryResponse>;
                })
                .then((data) => {
                    if (data) setBallots(data.ballots ?? []);
                })
                .catch(() => {
                    setErrorMsg('Network error loading ballot history.');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            // Programmatic close when isOpen becomes false
            if (dialog.hasAttribute('open')) {
                dialog.close();
            }
        }
    }, [isOpen, proposalId]);

    // ── Register close event listener (Esc key + programmatic close) ──────────
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const handleClose = () => {
            onClose();
        };
        dialog.addEventListener('close', handleClose);
        return () => dialog.removeEventListener('close', handleClose);
    }, [onClose]);

    // ── Backdrop click handler ────────────────────────────────────────────────
    const handleDialogClick = (ev: React.MouseEvent<HTMLDialogElement>) => {
        // Only fire onClose when clicking exactly on the <dialog> backdrop
        // (event.target === dialog means user clicked outside the inner content)
        if (ev.target === dialogRef.current) {
            onClose();
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <dialog
            ref={dialogRef}
            onClick={handleDialogClick}
            className="bg-neutral-900 text-neutral-100 rounded p-6 max-w-2xl w-full backdrop:bg-black/60"
            aria-labelledby="modal-title"
        >
            <div className="flex justify-between items-center mb-4">
                <h2 id="modal-title" className="text-sm font-semibold">
                    Voting History
                </h2>
                <button
                    data-testid="modal-close-btn"
                    onClick={onClose}
                    className="text-neutral-400 hover:text-neutral-100 text-xs"
                    aria-label="Close voting history"
                >
                    Close
                </button>
            </div>

            {isLoading && (
                <p role="status" className="text-xs text-neutral-400">
                    Loading ballot history…
                </p>
            )}

            {errorMsg && (
                <p role="alert" className="text-xs text-rose-400">
                    {errorMsg}
                </p>
            )}

            {!isLoading && !errorMsg && ballots.length === 0 && (
                <p className="text-xs text-neutral-400">No revealed ballots yet.</p>
            )}

            {!isLoading && !errorMsg && ballots.length > 0 && (
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="text-neutral-500 text-left">
                            <th className="pb-2 pr-4">Voter</th>
                            <th className="pb-2 pr-4">Committed Tick</th>
                            <th className="pb-2 pr-4">Revealed Tick</th>
                            <th className="pb-2">Choice</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ballots.map((b, i) => (
                            <tr key={i} className="border-t border-neutral-800">
                                <td className="py-1 pr-4 font-mono">
                                    {b.voter_did.slice(0, 12)}…
                                </td>
                                <td className="py-1 pr-4">{b.committed_at_tick}</td>
                                <td className="py-1 pr-4">
                                    {b.revealed_at_tick !== undefined ? b.revealed_at_tick : '—'}
                                </td>
                                <td className="py-1">
                                    {b.choice ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </dialog>
    );
}
