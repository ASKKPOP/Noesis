/**
 * Tests for ElevationDialog — native <dialog> primitive (D-08).
 *
 * jsdom 26 ships polyfills for HTMLDialogElement.showModal/close but the
 * focus-trap is a no-op. We stub prototype methods so open/close mutations
 * reach the ref and the close event fires on Escape simulation. This stub
 * pattern is reused in elevation-race.test.tsx and use-elevated-action.test.tsx.
 *
 * REQ-verbatim copy discipline: the three body strings (H2/H3/H4) appear as
 * LITERALS in Test 1 — a rename of TIER_NAME.H3 from 'Partner' to anything
 * else must fail loudly here rather than pass silently.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ElevationDialog } from './elevation-dialog';

/**
 * jsdom 26 leaves HTMLDialogElement.showModal/close undefined. We assign a
 * minimal shim onto the prototype so React's useEffect can call them — and
 * then wrap the shim with vi.spyOn so tests can assert call counts and
 * trigger the `close` event that Escape would fire natively.
 */
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

describe('ElevationDialog — REQ-verbatim body copy (AGENCY-04 + D-06)', () => {
    it('H2 body reads "Entering H2 — Reviewer. This will be logged."', () => {
        render(
            <ElevationDialog
                targetTier="H2"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByTestId('elevation-body').textContent).toBe(
            'Entering H2 — Reviewer. This will be logged.',
        );
    });

    it('H3 body reads "Entering H3 — Partner. This will be logged."', () => {
        render(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByTestId('elevation-body').textContent).toBe(
            'Entering H3 — Partner. This will be logged.',
        );
    });

    it('H4 body reads "Entering H4 — Driver. This will be logged."', () => {
        render(
            <ElevationDialog
                targetTier="H4"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByTestId('elevation-body').textContent).toBe(
            'Entering H4 — Driver. This will be logged.',
        );
    });
});

describe('ElevationDialog — native <dialog> lifecycle', () => {
    it('calls showModal() on transition from open=false to open=true', () => {
        const { rerender } = render(
            <ElevationDialog
                targetTier="H3"
                open={false}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(showModalSpy).not.toHaveBeenCalled();
        rerender(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(showModalSpy).toHaveBeenCalledTimes(1);
    });

    it('calls close() on transition from open=true to open=false', () => {
        const { rerender } = render(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(showModalSpy).toHaveBeenCalledTimes(1);
        rerender(
            <ElevationDialog
                targetTier="H3"
                open={false}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('does not thrash showModal/close when open stays false across rerenders', () => {
        const { rerender } = render(
            <ElevationDialog
                targetTier="H3"
                open={false}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        rerender(
            <ElevationDialog
                targetTier="H3"
                open={false}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(showModalSpy).not.toHaveBeenCalled();
        expect(closeSpy).not.toHaveBeenCalled();
    });
});

describe('ElevationDialog — accessibility (aria-label per UI-SPEC)', () => {
    it('Cancel button aria-label is "Cancel elevation to H{N}. No action will be taken."', () => {
        render(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const cancel = screen.getByTestId('elevation-cancel');
        expect(cancel.getAttribute('aria-label')).toBe(
            'Cancel elevation to H3. No action will be taken.',
        );
    });

    it('Confirm button aria-label is "Confirm elevation to H{N}. The action will dispatch and be logged."', () => {
        render(
            <ElevationDialog
                targetTier="H4"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const confirm = screen.getByTestId('elevation-confirm');
        expect(confirm.getAttribute('aria-label')).toBe(
            'Confirm elevation to H4. The action will dispatch and be logged.',
        );
    });

    it('Cancel button has autoFocus (safer default — UI-SPEC line 617)', () => {
        render(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const cancel = screen.getByTestId('elevation-cancel');
        // React's autoFocus prop does not emit an `autofocus` attribute; it
        // calls .focus() during mount. jsdom reflects this as document.activeElement.
        expect(document.activeElement).toBe(cancel);
    });
});

describe('ElevationDialog — interaction', () => {
    it('Escape (native close event) invokes onCancel via onClose handler', () => {
        const onCancel = vi.fn();
        render(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={() => {}}
                onCancel={onCancel}
            />,
        );
        const dialog = screen.getByTestId('elevation-dialog');
        fireEvent(dialog, new Event('close'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('clicking Confirm invokes onConfirm', () => {
        const onConfirm = vi.fn();
        render(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={onConfirm}
                onCancel={() => {}}
            />,
        );
        fireEvent.click(screen.getByTestId('elevation-confirm'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('clicking Cancel invokes onCancel', () => {
        const onCancel = vi.fn();
        render(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={() => {}}
                onCancel={onCancel}
            />,
        );
        fireEvent.click(screen.getByTestId('elevation-cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe('ElevationDialog — tier-colored confirm (UI-SPEC lines 232-238)', () => {
    it('H2 confirm button carries bg-blue-400', () => {
        render(
            <ElevationDialog
                targetTier="H2"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByTestId('elevation-confirm').className).toContain('bg-blue-400');
    });

    it('H3 confirm button carries bg-amber-300', () => {
        render(
            <ElevationDialog
                targetTier="H3"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByTestId('elevation-confirm').className).toContain('bg-amber-300');
    });

    it('H4 confirm button carries bg-red-400 (destructive tier)', () => {
        render(
            <ElevationDialog
                targetTier="H4"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.getByTestId('elevation-confirm').className).toContain('bg-red-400');
    });

    it('Cancel button does NOT carry tier-specific fill classes', () => {
        render(
            <ElevationDialog
                targetTier="H4"
                open={true}
                onConfirm={() => {}}
                onCancel={() => {}}
            />,
        );
        const cancel = screen.getByTestId('elevation-cancel');
        expect(cancel.className).not.toContain('bg-red-400');
        expect(cancel.className).not.toContain('bg-amber-300');
        expect(cancel.className).not.toContain('bg-blue-400');
    });
});
