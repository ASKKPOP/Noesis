/**
 * Phase 43 Plan 04 — ForkIrreversibilityDialog tests (D-43-03).
 *
 * D-43-03 verbatim-locked copy strings:
 *   Title:   "Fork Nous from Grid"
 *   Warning: "This permanently removes the Nous from civic life. The fork package will
 *             contain their complete state (memory, credentials, full audit history).
 *             Anyone with this file can reconstitute the Nous. The Nous loses civic
 *             reputation and community standing. This cannot be undone."
 *   Confirm: "Fork forever"
 *   Cancel:  "Keep on Grid"
 *
 * THESE STRINGS ARE LOCKED. Any change requires updating this test file AND the
 * component implementation simultaneously (H5-consent gate verbatim-copy discipline).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForkIrreversibilityDialog } from './fork-irreversibility-dialog';

// D-43-03 verbatim-locked copy constants — DO NOT CHANGE without Plan 04 review
const D43_03_TITLE = 'Fork Nous from Grid';
const D43_03_WARNING =
    'This permanently removes the Nous from civic life. The fork package will contain their complete state (memory, credentials, full audit history). Anyone with this file can reconstitute the Nous. The Nous loses civic reputation and community standing. This cannot be undone.';
const D43_03_CONFIRM = 'Fork forever';
const D43_03_CANCEL = 'Keep on Grid';
const TEST_CIVIC_DID = 'did:civic:noesis:test123';

function renderDialog(overrides: Record<string, unknown> = {}) {
    const props = {
        open: true,
        targetDid: TEST_CIVIC_DID,
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
        ...overrides,
    };
    render(<ForkIrreversibilityDialog {...(props as Parameters<typeof ForkIrreversibilityDialog>[0])} />);
    return props;
}

describe('ForkIrreversibilityDialog — D-43-03 verbatim copy (Plan 04 / T-43-copy)', () => {
    it('43-04-01a: dialog renders title "Fork Nous from Grid"', () => {
        renderDialog();
        expect(screen.getByText(D43_03_TITLE)).toBeInTheDocument();
    });
    it('43-04-01b: warning body matches D-43-03 verbatim string', () => {
        renderDialog();
        expect(screen.getByText(D43_03_WARNING)).toBeInTheDocument();
    });
    it('43-04-01c: confirm button label is exact literal "Fork forever"', () => {
        renderDialog();
        // Button text is the visible content; aria-label is for screen readers only.
        // Use getByTestId to find the confirm button by its stable test identifier.
        const confirmBtn = screen.getByTestId('irrev-confirm');
        expect(confirmBtn.textContent).toBe(D43_03_CONFIRM);
    });
    it('43-04-01d: cancel button label is exact literal "Keep on Grid"', () => {
        renderDialog();
        // Button text is the visible content; use getByTestId for stable lookup.
        const cancelBtn = screen.getByTestId('irrev-cancel');
        expect(cancelBtn.textContent).toBe(D43_03_CANCEL);
    });
});

describe('ForkIrreversibilityDialog — paste/keyboard discipline (Plan 04)', () => {
    it('43-04-02a: onPaste handler on DID input calls preventDefault (paste suppressed)', () => {
        renderDialog();
        const input = screen.getByTestId('irrev-did-input');
        const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
        const preventDefault = vi.spyOn(event, 'preventDefault');
        fireEvent(input, event);
        expect(preventDefault).toHaveBeenCalled();
    });
    it('43-04-02b: Enter key in DID input calls preventDefault (Enter blocked)', () => {
        renderDialog();
        const input = screen.getByTestId('irrev-did-input');
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        const preventDefault = vi.spyOn(event, 'preventDefault');
        fireEvent(input, event);
        expect(preventDefault).toHaveBeenCalled();
    });
});

describe('ForkIrreversibilityDialog — typed confirmation gate (Plan 04)', () => {
    it('43-04-03a: Fork forever button disabled when typed value !== targetDid', () => {
        renderDialog();
        const input = screen.getByTestId('irrev-did-input');
        fireEvent.change(input, { target: { value: 'wrong:did:value' } });
        const confirmBtn = screen.getByTestId('irrev-confirm');
        expect(confirmBtn).toBeDisabled();
    });
    it('43-04-03b: Fork forever button enabled when typed value === targetDid exactly (closure-captured)', () => {
        renderDialog();
        const input = screen.getByTestId('irrev-did-input');
        fireEvent.change(input, { target: { value: TEST_CIVIC_DID } });
        const confirmBtn = screen.getByTestId('irrev-confirm');
        expect(confirmBtn).not.toBeDisabled();
    });
    it('43-04-03c: clicking Cancel calls onCancel prop', () => {
        const props = renderDialog();
        const cancelBtn = screen.getByTestId('irrev-cancel');
        fireEvent.click(cancelBtn);
        expect(props.onCancel).toHaveBeenCalled();
    });
    it('43-04-03d: Cancel button has autoFocus attribute (safer default)', () => {
        renderDialog();
        const cancelBtn = screen.getByTestId('irrev-cancel');
        // React 19 with jsdom may not reflect autoFocus as an HTML attribute.
        // Check document.activeElement (autofocus gives focus on mount) OR
        // the JSX autoFocus prop (which React handles internally).
        // Per plan pre-knowledge: "Try both; one will work with jsdom 26."
        const hasAttr = cancelBtn.hasAttribute('autofocus') || cancelBtn.hasAttribute('autoFocus');
        const hasFocus = document.activeElement === cancelBtn;
        expect(hasAttr || hasFocus).toBe(true);
    });
});

// Re-export constants for use by Plan 04 implementation assertions
export { D43_03_TITLE, D43_03_WARNING, D43_03_CONFIRM, D43_03_CANCEL };
