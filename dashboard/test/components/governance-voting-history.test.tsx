/**
 * Phase 12 Wave 4 — VotingHistoryModal component tests (VOTE-07 / D-12-09).
 *
 * Verifies the H5-only voting history modal:
 *   - Modal is closed by default (dialog is closed)
 *   - Open via prop; renders ballot history rows
 *   - 403 from API → renders "H5 required" message
 *   - Esc key closes modal (dispatched on dialogRef)
 *   - Backdrop click closes modal
 *   - Close button closes modal
 *
 * The modal uses native HTML <dialog> (no Radix/Headless).
 * Tests use @testing-library/react with vi.mock for fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { BallotHistoryEntry } from '../../src/app/grid/governance/voting-history-modal';

// ── Mock global fetch ─────────────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ── Import after mock ─────────────────────────────────────────────────────────
import { VotingHistoryModal } from '../../src/app/grid/governance/voting-history-modal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBallot(overrides: Partial<BallotHistoryEntry> = {}): BallotHistoryEntry {
    return {
        voter_did: 'did:noesis:alice',
        committed_at_tick: 5,
        revealed_at_tick: 7,
        choice: 'yes',
        ...overrides,
    };
}

function makeHistoryResponse(ballots: BallotHistoryEntry[]) {
    return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ballots }),
    });
}

function make403Response() {
    return Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'H5 required' }),
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VotingHistoryModal — H5-only ballot history (VOTE-07)', () => {

    beforeEach(() => {
        fetchMock.mockReset();
        // jsdom does not implement HTMLDialogElement.showModal — polyfill minimally
        if (!HTMLDialogElement.prototype.showModal) {
            HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
                this.setAttribute('open', '');
            });
        }
        if (!HTMLDialogElement.prototype.close) {
            HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
                this.removeAttribute('open');
                this.dispatchEvent(new Event('close'));
            });
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Closed by default ─────────────────────────────────────────────────────

    it('modal is closed (no open attribute) when isOpen=false', () => {
        render(
            <VotingHistoryModal
                isOpen={false}
                proposalId="test-proposal"
                onClose={vi.fn()}
            />,
        );

        const dialog = document.querySelector('dialog');
        expect(dialog).toBeTruthy();
        expect(dialog?.hasAttribute('open')).toBeFalsy();
    });

    // ── Open + fetch + render rows ────────────────────────────────────────────

    it('when open: fetches ballot history and renders rows', async () => {
        const ballots = [
            makeBallot({ voter_did: 'did:noesis:alice', choice: 'yes' }),
            makeBallot({ voter_did: 'did:noesis:bob', choice: 'no', revealed_at_tick: undefined }),
        ];
        fetchMock.mockReturnValue(makeHistoryResponse(ballots));

        await act(async () => {
            render(
                <VotingHistoryModal
                    isOpen={true}
                    proposalId="test-proposal"
                    onClose={vi.fn()}
                />,
            );
        });

        // Both voter DIDs should appear (truncated)
        expect(document.body.textContent).toContain('did:noesis:alice'.slice(0, 12));
        expect(document.body.textContent).toContain('did:noesis:bob'.slice(0, 12));
        // Choice should appear
        expect(document.body.textContent).toContain('yes');
    });

    // ── 403 → "H5 required" message ──────────────────────────────────────────

    it('403 from API renders "H5 required" message', async () => {
        fetchMock.mockReturnValue(make403Response());

        await act(async () => {
            render(
                <VotingHistoryModal
                    isOpen={true}
                    proposalId="test-proposal"
                    onClose={vi.fn()}
                />,
            );
        });

        expect(document.body.textContent).toContain('H5');
    });

    // ── Close button ──────────────────────────────────────────────────────────

    it('close button calls onClose', async () => {
        fetchMock.mockReturnValue(makeHistoryResponse([]));
        const onClose = vi.fn();

        await act(async () => {
            render(
                <VotingHistoryModal
                    isOpen={true}
                    proposalId="test-proposal"
                    onClose={onClose}
                />,
            );
        });

        const closeBtn = document.querySelector('[data-testid="modal-close-btn"]') as HTMLButtonElement;
        expect(closeBtn).toBeTruthy();
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // ── Backdrop click closes modal ───────────────────────────────────────────

    it('backdrop click (clicking dialog itself) calls onClose', async () => {
        fetchMock.mockReturnValue(makeHistoryResponse([]));
        const onClose = vi.fn();

        await act(async () => {
            render(
                <VotingHistoryModal
                    isOpen={true}
                    proposalId="test-proposal"
                    onClose={onClose}
                />,
            );
        });

        const dialog = document.querySelector('dialog')!;
        // Simulate clicking exactly on the backdrop (event target === dialog)
        fireEvent.click(dialog);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // ── Esc key closes modal ──────────────────────────────────────────────────

    it('Esc key (native dialog close event) calls onClose', async () => {
        fetchMock.mockReturnValue(makeHistoryResponse([]));
        const onClose = vi.fn();

        await act(async () => {
            render(
                <VotingHistoryModal
                    isOpen={true}
                    proposalId="test-proposal"
                    onClose={onClose}
                />,
            );
        });

        const dialog = document.querySelector('dialog')!;
        // Dispatch native close event (what browsers fire on Esc)
        fireEvent(dialog, new Event('close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // ── Unrevealed ballot shows "—" for choice ────────────────────────────────

    it('unrevealed ballot (no revealed_at_tick) shows "—" for choice', async () => {
        const ballots = [
            makeBallot({ voter_did: 'did:noesis:charlie', choice: undefined, revealed_at_tick: undefined }),
        ];
        fetchMock.mockReturnValue(makeHistoryResponse(ballots));

        await act(async () => {
            render(
                <VotingHistoryModal
                    isOpen={true}
                    proposalId="test-proposal"
                    onClose={vi.fn()}
                />,
            );
        });

        expect(document.body.textContent).toContain('—');
    });
});
