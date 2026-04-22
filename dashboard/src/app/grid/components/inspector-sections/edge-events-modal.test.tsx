/**
 * EdgeEventsModal tests — plain dialog for H5 edge-event history.
 *
 * Tests verify (09-05-PLAN.md Task 2):
 * 1. Renders 'Edge dialogue turns' heading.
 * 2. Renders 'Close' button that invokes onClose.
 * 3. ESC key invokes onClose.
 * 4. Backdrop click invokes onClose.
 * 5. Self-loop error renders 'Self-edges are silently rejected.' copy.
 *
 * Note: native <dialog> showModal() is partially supported in jsdom — we mock
 * the dialog element to avoid "not implemented" errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { EdgeEventsResponse } from '@/lib/api/relationships';

// ---------------------------------------------------------------------------
// Mock fetchEdgeEvents
// ---------------------------------------------------------------------------
let _mockEvents: EdgeEventsResponse['events'] = [];
let _mockErrorKind: string | null = null;

vi.mock('@/lib/api/relationships', () => ({
    fetchEdgeEvents: vi.fn(async () => {
        if (_mockErrorKind) {
            const err = Object.assign(new Error(_mockErrorKind), {
                fetchError: { kind: _mockErrorKind, status: _mockErrorKind === 'self_loop' ? 400 : 404 },
            });
            throw err;
        }
        return { edge_key: 'test-edge-key', events: _mockEvents };
    }),
    fetchRelationshipsH1: vi.fn(),
    fetchRelationshipsH2: vi.fn(),
    fetchGraph: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Patch HTMLDialogElement for jsdom (showModal / close not implemented)
// ---------------------------------------------------------------------------
beforeEach(() => {
    // jsdom doesn't implement showModal/close — patch them on the prototype
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
    _mockEvents = [];
    _mockErrorKind = null;
});

import { EdgeEventsModal } from './edge-events-modal';

describe('EdgeEventsModal', () => {
    // -----------------------------------------------------------------------
    // Test 1: Renders 'Edge dialogue turns' heading
    // -----------------------------------------------------------------------
    it('renders "Edge dialogue turns" heading', async () => {
        _mockEvents = [];
        const onClose = vi.fn();

        render(
            <EdgeEventsModal
                edgeKey="test-edge-key"
                operatorId="op:test"
                onClose={onClose}
            />,
        );

        expect(screen.getByText('Edge dialogue turns')).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Test 2: 'Close' button invokes onClose
    // -----------------------------------------------------------------------
    it('renders "Close" button that calls onClose when clicked', async () => {
        _mockEvents = [];
        const onClose = vi.fn();

        render(
            <EdgeEventsModal
                edgeKey="test-edge-key"
                operatorId="op:test"
                onClose={onClose}
            />,
        );

        const closeBtn = screen.getByTestId('edge-events-close');
        expect(closeBtn.textContent).toBe('Close');
        fireEvent.click(closeBtn);

        expect(onClose).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Test 3: ESC key fires close event → onClose
    // -----------------------------------------------------------------------
    it('ESC key (native close event) invokes onClose', async () => {
        _mockEvents = [];
        const onClose = vi.fn();

        render(
            <EdgeEventsModal
                edgeKey="test-edge-key"
                operatorId="op:test"
                onClose={onClose}
            />,
        );

        const dialog = screen.getByTestId('edge-events-modal') as HTMLDialogElement;
        // Simulate native ESC → 'close' event on the dialog element
        fireEvent(dialog, new Event('close'));

        expect(onClose).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Test 4: Backdrop click invokes onClose
    // -----------------------------------------------------------------------
    it('backdrop click (click on dialog element itself) invokes onClose', async () => {
        _mockEvents = [];
        const onClose = vi.fn();

        render(
            <EdgeEventsModal
                edgeKey="test-edge-key"
                operatorId="op:test"
                onClose={onClose}
            />,
        );

        const dialog = screen.getByTestId('edge-events-modal') as HTMLDialogElement;
        // Simulate a click where the target IS the dialog itself (backdrop area)
        fireEvent.click(dialog, { target: dialog });

        expect(onClose).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Test 5: self_loop error renders 'Self-edges are silently rejected.'
    // -----------------------------------------------------------------------
    it('self_loop error renders "Self-edges are silently rejected." copy', async () => {
        _mockErrorKind = 'self_loop';
        const onClose = vi.fn();

        render(
            <EdgeEventsModal
                edgeKey="test-edge-key"
                operatorId="op:test"
                onClose={onClose}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Self-edges are silently rejected.')).toBeTruthy();
        });
    });

    // -----------------------------------------------------------------------
    // Test 6: edge_not_found error renders 'This edge is no longer visible.'
    // -----------------------------------------------------------------------
    it('edge_not_found error renders "This edge is no longer visible." copy', async () => {
        _mockErrorKind = 'edge_not_found';
        const onClose = vi.fn();

        render(
            <EdgeEventsModal
                edgeKey="test-edge-key"
                operatorId="op:test"
                onClose={onClose}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('This edge is no longer visible.')).toBeTruthy();
        });
    });
});
