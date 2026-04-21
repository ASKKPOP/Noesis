/**
 * IrreversibilityDialog tests — native <dialog> primitive for H5 Sovereign deletion
 * (D-04, D-05, Phase 8 AGENCY-05).
 *
 * Discipline:
 *   - Verbatim copy asserted against literal strings (D-04 copy-lock)
 *   - Paste suppression on DID input (D-05)
 *   - Delete gated on exact case-sensitive typed === targetDid match
 *   - autoFocus on "Keep this Nous" (safer default — Enter-on-open cannot delete)
 *   - All close paths (ESC, backdrop, Cancel, programmatic) fire onCancel via close event
 *   - Closure-capture race safety: targetDid snapshot at open, not latest render prop
 *   - Focus restoration to openerRef on close
 *   - ARIA: role=alertdialog, aria-labelledby, aria-describedby
 *
 * Uses the same HTMLDialogElement prototype shim as elevation-dialog.test.tsx.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IrreversibilityDialog } from './irreversibility-dialog';

// ── HTMLDialogElement shim (jsdom 26 has partial support; ensure showModal/close work) ──
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

const showModalSpy = vi.spyOn(proto, 'showModal');
const closeSpy = vi.spyOn(proto, 'close');

beforeAll(() => {
    showModalSpy.mockClear();
    closeSpy.mockClear();
});

afterAll(() => {
    showModalSpy.mockRestore();
    closeSpy.mockRestore();
});

beforeEach(() => {
    showModalSpy.mockClear();
    closeSpy.mockClear();
});

const TARGET_DID = 'did:noesis:alpha';

// ── Verbatim copy assertions (D-04 copy-lock) ──────────────────────────────────

describe('IrreversibilityDialog — verbatim copy (D-04)', () => {
    beforeEach(() => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
    });

    it('h2 title is "Delete Nous — permanent"', () => {
        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
            'Delete Nous — permanent',
        );
    });

    it('warning paragraph is verbatim: "This is H5 Sovereign. Audit entries about this Nous will remain forever; the Nous itself will not. There is no undo."', () => {
        const warning = screen.getByTestId('irrev-warning');
        expect(warning.textContent).toBe(
            'This is H5 Sovereign. Audit entries about this Nous will remain forever; the Nous itself will not. There is no undo.',
        );
    });

    it('DID section label is "Nous to delete"', () => {
        expect(screen.getByTestId('irrev-did-label').textContent).toBe('Nous to delete');
    });

    it('input label is "Type the DID exactly to confirm:"', () => {
        expect(screen.getByTestId('irrev-input-label').textContent).toBe(
            'Type the DID exactly to confirm:',
        );
    });

    it('Delete button visible text is "Delete forever"', () => {
        expect(screen.getByTestId('irrev-delete').textContent).toBe('Delete forever');
    });

    it('Cancel button visible text is "Keep this Nous"', () => {
        expect(screen.getByTestId('irrev-cancel').textContent).toBe('Keep this Nous');
    });
});

// ── Paste suppression (D-05) ───────────────────────────────────────────────────

describe('IrreversibilityDialog — paste suppression (D-05)', () => {
    it('userEvent.paste into the DID input is blocked — value stays empty', async () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const input = screen.getByTestId('irrev-did-input') as HTMLInputElement;
        // userEvent.paste triggers the paste event; onPaste preventDefault should stop it
        await userEvent.click(input);
        await userEvent.paste('did:noesis:pasted');
        expect(input.value).toBe('');
    });

    it('fireEvent.paste is prevented — input value unchanged', () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const input = screen.getByTestId('irrev-did-input') as HTMLInputElement;
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: new DataTransfer(),
        });
        fireEvent(input, pasteEvent);
        expect(pasteEvent.defaultPrevented).toBe(true);
        expect(input.value).toBe('');
    });
});

// ── Exact-match gate ───────────────────────────────────────────────────────────

describe('IrreversibilityDialog — exact-match gate', () => {
    it('Delete button is disabled initially (aria-disabled=true)', () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const del = screen.getByTestId('irrev-delete');
        expect(del.getAttribute('aria-disabled')).toBe('true');
    });

    it('Delete stays disabled on partial DID input', async () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const input = screen.getByTestId('irrev-did-input');
        await userEvent.type(input, 'did:noesis:al');
        expect(screen.getByTestId('irrev-delete').getAttribute('aria-disabled')).toBe('true');
        // Hint shows mismatch copy
        expect(screen.getByTestId('irrev-hint').textContent).toBe(
            'DID does not match. Type exactly as shown.',
        );
    });

    it('Delete stays disabled on wrong-case DID', async () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const input = screen.getByTestId('irrev-did-input');
        await userEvent.type(input, 'did:noesis:ALPHA');
        expect(screen.getByTestId('irrev-delete').getAttribute('aria-disabled')).toBe('true');
    });

    it('Delete becomes enabled when typed matches exactly; hint shows "Match confirmed."', async () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const input = screen.getByTestId('irrev-did-input');
        await userEvent.type(input, TARGET_DID);
        const del = screen.getByTestId('irrev-delete');
        expect(del.getAttribute('aria-disabled')).toBe('false');
        expect(screen.getByTestId('irrev-hint').textContent).toBe('Match confirmed.');
    });
});

// ── autoFocus on Keep this Nous (D-04) ────────────────────────────────────────

describe('IrreversibilityDialog — autoFocus on Keep this Nous', () => {
    it('Keep this Nous button receives focus on open (safer default)', () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const keepBtn = screen.getByTestId('irrev-cancel');
        expect(document.activeElement).toBe(keepBtn);
    });
});

// ── Close paths trigger onCancel ──────────────────────────────────────────────

describe('IrreversibilityDialog — close paths invoke onCancel', () => {
    it('ESC key (native close event on dialog) → onCancel called', () => {
        const onCancel = vi.fn();
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={onCancel}
            />,
        );
        const dialog = screen.getByRole('alertdialog');
        fireEvent(dialog, new Event('close'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('Backdrop click (e.target === dialog element) → onCancel called via close event', () => {
        const onCancel = vi.fn();
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={onCancel}
            />,
        );
        const dialog = screen.getByRole('alertdialog');
        // Simulate backdrop click: target is the dialog itself (not a child)
        fireEvent.click(dialog);
        // close() should have been called, triggering the close event → onCancel
        expect(closeSpy).toHaveBeenCalledTimes(1);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('Keep this Nous button click → onCancel called', () => {
        const onCancel = vi.fn();
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={onCancel}
            />,
        );
        fireEvent.click(screen.getByTestId('irrev-cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('Programmatic dialog.close() → onCancel called via close event listener', () => {
        const onCancel = vi.fn();
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={onCancel}
            />,
        );
        const dialog = screen.getByRole('alertdialog') as HTMLDialogElement;
        act(() => { dialog.close(); });
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

// ── onConfirm invocation ───────────────────────────────────────────────────────

describe('IrreversibilityDialog — onConfirm invocation', () => {
    it('With typed === targetDid, clicking Delete forever → onConfirm called once', async () => {
        const onConfirm = vi.fn();
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={onConfirm}
                onCancel={() => {}}
            />,
        );
        const input = screen.getByTestId('irrev-did-input');
        await userEvent.type(input, TARGET_DID);
        fireEvent.click(screen.getByTestId('irrev-delete'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('With typed === targetDid, pressing Enter in input does NOT invoke onConfirm (D-03)', async () => {
        const onConfirm = vi.fn();
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={onConfirm}
                onCancel={() => {}}
            />,
        );
        const input = screen.getByTestId('irrev-did-input');
        await userEvent.type(input, TARGET_DID);
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onConfirm).not.toHaveBeenCalled();
    });
});

// ── Closure-capture race safety (Phase 6 D-07 pattern) ───────────────────────

describe('IrreversibilityDialog — closure-capture race safety', () => {
    it('re-render with new targetDid while open uses the DID captured at open time', async () => {
        const onConfirm = vi.fn();
        const { rerender } = render(
            <IrreversibilityDialog
                open={true}
                targetDid="did:noesis:alpha"
                onConfirm={onConfirm}
                onCancel={() => {}}
            />,
        );
        // Change targetDid prop while dialog is open — should NOT affect captured DID
        rerender(
            <IrreversibilityDialog
                open={true}
                targetDid="did:noesis:beta"
                onConfirm={onConfirm}
                onCancel={() => {}}
            />,
        );
        // The input should still require typing the ORIGINAL did (alpha), not beta
        const input = screen.getByTestId('irrev-did-input');
        // Type original DID — should match the captured value
        await userEvent.type(input, 'did:noesis:alpha');
        const del = screen.getByTestId('irrev-delete');
        expect(del.getAttribute('aria-disabled')).toBe('false');
    });
});

// ── ARIA attributes ───────────────────────────────────────────────────────────

describe('IrreversibilityDialog — ARIA', () => {
    it('dialog has role=alertdialog, aria-labelledby, aria-describedby', () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const dialog = screen.getByRole('alertdialog');
        expect(dialog.getAttribute('aria-labelledby')).not.toBeNull();
        expect(dialog.getAttribute('aria-describedby')).not.toBeNull();
    });

    it('Delete button aria-label is "Delete this Nous permanently. This action cannot be undone."', () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const del = screen.getByTestId('irrev-delete');
        expect(del.getAttribute('aria-label')).toBe(
            'Delete this Nous permanently. This action cannot be undone.',
        );
    });

    it('Cancel button aria-label is "Keep this Nous. No action will be taken."', () => {
        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const cancel = screen.getByTestId('irrev-cancel');
        expect(cancel.getAttribute('aria-label')).toBe(
            'Keep this Nous. No action will be taken.',
        );
    });
});

// ── Focus restoration ─────────────────────────────────────────────────────────

describe('IrreversibilityDialog — focus restoration', () => {
    it('openerRef.current.focus() is called after close via ESC', () => {
        const openerRef = { current: document.createElement('button') };
        const focusSpy = vi.spyOn(openerRef.current, 'focus');

        render(
            <IrreversibilityDialog
                open={true}
                targetDid={TARGET_DID}
                onConfirm={() => {}}
                onCancel={() => {}}
                openerRef={openerRef}
            />,
        );
        const dialog = screen.getByRole('alertdialog') as HTMLDialogElement;
        act(() => { dialog.close(); });
        expect(focusSpy).toHaveBeenCalledTimes(1);
    });
});
