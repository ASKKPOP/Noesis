/**
 * RED tests for ExportConsentDialog (REPLAY-02 / D-13-08 / T-10-10).
 *
 * These tests encode the acceptance criteria for Wave 4 (Plan 13-05).
 * They MUST fail until dashboard/src/app/grid/replay/export-consent-dialog.tsx
 * is created.
 *
 * Threat mitigation: T-10-10 — "Plaintext in tarball / no-consent export".
 * Verbatim copy lock (D-13-08) + paste suppression + confirm-disabled-until-match
 * + auto-downgrade on close (D-13-07).
 *
 * VERBATIM COPY CONSTANTS (D-13-08 / 13-UI-SPEC.md §Export Consent Dialog):
 * These strings are the sole source of truth for the component's UI copy.
 * If Wave 4 paraphrases any of these strings in export-consent-dialog.tsx,
 * the assertions below will fail — ensuring the copy-lock discipline is enforced.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock agencyStore
vi.mock('@/lib/stores/agency-store', () => ({
    agencyStore: {
        setTier: vi.fn(),
        getTier: vi.fn(() => 'H5'),
        subscribe: vi.fn(() => () => {}),
        getSnapshot: vi.fn(() => 'H5'),
    },
}));

// RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx
import { ExportConsentDialog } from './export-consent-dialog';
import { agencyStore } from '@/lib/stores/agency-store';

// ── Verbatim copy constants (D-13-08 single source of truth — tests assert these literals) ──
// Any paraphrase in the implementation fails these tests intentionally.
const TITLE_COPY = 'Export audit chain slice';
const WARNING_COPY =
    'This export is permanent and cannot be undone. The tarball will contain the complete audit chain for the selected tick range. Anyone with the file can verify the chain.';
const CONFIRM_LABEL = 'Export forever';
const CANCEL_LABEL = 'Keep private';
const INPUT_LABEL = 'Type the Grid-ID exactly to confirm:';
const HINT_MATCH = 'Match confirmed.';
const HINT_MISMATCH = 'Grid-ID does not match. Type exactly as shown.';

// ── HTMLDialogElement shim (jsdom partial support — ensure showModal/close work) ──
const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal: () => void;
    close: () => void;
};
proto.showModal = function (this: HTMLDialogElement) {
    (this as unknown as { open: boolean }).open = true;
};
proto.close = function (this: HTMLDialogElement) {
    (this as unknown as { open: boolean }).open = false;
    this.dispatchEvent(new Event('close'));
};

const GRID_ID = 'grid-alpha';
const ON_CONFIRM = vi.fn();
const ON_CANCEL = vi.fn();

beforeEach(() => {
    vi.mocked(agencyStore.setTier).mockClear();
    ON_CONFIRM.mockClear();
    ON_CANCEL.mockClear();
    cleanup();
});

function renderDialog(open = true) {
    return render(
        <ExportConsentDialog
            open={open}
            gridId={GRID_ID}
            onConfirm={ON_CONFIRM}
            onCancel={ON_CANCEL}
        />,
    );
}

describe('ExportConsentDialog — verbatim copy (D-13-08)', () => {
    it('renders TITLE_COPY exactly: "Export audit chain slice"', () => {
        renderDialog();
        expect(screen.getByText(TITLE_COPY)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx

    it('renders WARNING_COPY exactly (full warning text)', () => {
        renderDialog();
        expect(screen.getByText(WARNING_COPY)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx

    it('renders CONFIRM_LABEL "Export forever" on confirm button', () => {
        renderDialog();
        expect(screen.getByText(CONFIRM_LABEL)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx

    it('renders CANCEL_LABEL "Keep private" on cancel button', () => {
        renderDialog();
        expect(screen.getByText(CANCEL_LABEL)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx

    it('renders INPUT_LABEL "Type the Grid-ID exactly to confirm:"', () => {
        renderDialog();
        expect(screen.getByText(INPUT_LABEL)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx

    it('renders HINT_MATCH "Match confirmed." when typed equals gridId', () => {
        renderDialog();
        const input = screen.getByTestId('export-grid-input');
        fireEvent.change(input, { target: { value: GRID_ID } });
        expect(screen.getByText(HINT_MATCH)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx

    it('renders HINT_MISMATCH "Grid-ID does not match. Type exactly as shown." when typed does not match', () => {
        renderDialog();
        const input = screen.getByTestId('export-grid-input');
        fireEvent.change(input, { target: { value: 'wrong-id' } });
        expect(screen.getByText(HINT_MISMATCH)).toBeTruthy();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx
});

describe('ExportConsentDialog — paste suppression (D-13-08)', () => {
    it('pasting into Grid-ID input is preventDefault — typed value remains empty', () => {
        renderDialog();
        const input = screen.getByTestId('export-grid-input') as HTMLInputElement;

        // Simulate a paste event with clipboard data
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: new DataTransfer(),
        });
        pasteEvent.clipboardData?.setData('text/plain', GRID_ID);

        fireEvent(input, pasteEvent);

        // Input value must remain empty — paste was prevented
        expect(input.value).toBe('');
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx
});

describe('ExportConsentDialog — confirm disabled until exact match', () => {
    it('confirm button is disabled when typed !== gridId', () => {
        renderDialog();
        const input = screen.getByTestId('export-grid-input');
        fireEvent.change(input, { target: { value: 'grid-alph' } });
        const confirmBtn = screen.getByText(CONFIRM_LABEL).closest('button');
        expect(confirmBtn).not.toBeNull();
        expect(confirmBtn?.disabled).toBe(true);
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx

    it('confirm button is enabled when typed === gridId exactly', () => {
        renderDialog();
        const input = screen.getByTestId('export-grid-input');
        fireEvent.change(input, { target: { value: GRID_ID } });
        const confirmBtn = screen.getByText(CONFIRM_LABEL).closest('button');
        expect(confirmBtn).not.toBeNull();
        expect(confirmBtn?.disabled).toBe(false);
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx
});

describe('ExportConsentDialog — cancel auto-downgrade (D-13-07)', () => {
    it('cancel button click calls onCancel and agencyStore.setTier("H1")', () => {
        renderDialog();
        const cancelBtn = screen.getByText(CANCEL_LABEL).closest('button');
        expect(cancelBtn).not.toBeNull();
        fireEvent.click(cancelBtn!);
        expect(ON_CANCEL).toHaveBeenCalledTimes(1);
        expect(agencyStore.setTier).toHaveBeenCalledWith('H1');
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx
});

describe('ExportConsentDialog — confirm payload shape (presentation-only)', () => {
    it('confirm button when enabled calls onConfirm with no arguments', () => {
        renderDialog();
        const input = screen.getByTestId('export-grid-input');
        fireEvent.change(input, { target: { value: GRID_ID } });
        const confirmBtn = screen.getByText(CONFIRM_LABEL).closest('button');
        fireEvent.click(confirmBtn!);
        // Dialog is presentation-only — parent constructs the operator.exported event
        expect(ON_CONFIRM).toHaveBeenCalledTimes(1);
        expect(ON_CONFIRM).toHaveBeenCalledWith();
    });
    // RED until Wave 4 (Plan 13-05) creates dashboard/src/app/grid/replay/export-consent-dialog.tsx
});
