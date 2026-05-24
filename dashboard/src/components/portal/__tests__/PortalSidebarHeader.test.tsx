/**
 * Tests for PortalSidebar mobile overlay + PortalHeader hamburger button — Plan 24-03.
 *
 * Covers:
 * - PortalSidebar: isOpen/onClose props, backdrop, CSS transform
 * - PortalHeader: onMenuOpen prop, hamburger button
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortalSidebar } from '../PortalSidebar';
import { PortalHeader } from '../PortalHeader';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
    usePathname: () => '/portal',
}));

vi.mock('wagmi', () => ({
    useAccount: () => ({ address: undefined, isConnected: false }),
    useDisconnect: () => ({ disconnect: vi.fn() }),
}));

vi.mock('@/lib/stores/human-auth-store', () => ({
    useHumanAuthStore: () => ({ currentUser: null, clearUser: vi.fn() }),
}));

// ── PortalSidebar tests ──────────────────────────────────────────────────────

describe('PortalSidebar — mobile overlay', () => {
    it('Test 1: PortalSidebar accepts isOpen and onClose props without TypeScript error', () => {
        // If this renders without throwing, the props are accepted
        const { container } = render(
            <PortalSidebar isOpen={false} onClose={vi.fn()} />
        );
        expect(container).toBeTruthy();
    });

    it('Test 2: PortalSidebar renders backdrop div when isOpen is true', () => {
        render(<PortalSidebar isOpen={true} onClose={vi.fn()} />);
        // Backdrop has aria-hidden="true"
        const backdrop = document.querySelector('[aria-hidden="true"]');
        expect(backdrop).not.toBeNull();
    });

    it('Test 3: PortalSidebar does NOT render backdrop when isOpen is false', () => {
        render(<PortalSidebar isOpen={false} onClose={vi.fn()} />);
        const backdrop = document.querySelector('[aria-hidden="true"]');
        expect(backdrop).toBeNull();
    });

    it('Test 4: aside has translateX(0) when isOpen true, translateX(-100%) when false', () => {
        const { rerender } = render(
            <PortalSidebar isOpen={true} onClose={vi.fn()} />
        );
        const aside = document.querySelector('aside') as HTMLElement;
        expect(aside.style.transform).toBe('translateX(0)');

        rerender(<PortalSidebar isOpen={false} onClose={vi.fn()} />);
        expect(aside.style.transform).toBe('translateX(-100%)');
    });

    it('Test 5: × close button has aria-label="Close navigation" and className md:hidden', () => {
        render(<PortalSidebar isOpen={true} onClose={vi.fn()} />);
        const closeBtn = screen.getByRole('button', { name: 'Close navigation' });
        expect(closeBtn).toBeTruthy();
        expect(closeBtn.className).toContain('md:hidden');
    });
});

// ── PortalHeader tests ───────────────────────────────────────────────────────

describe('PortalHeader — hamburger button', () => {
    it('Test 6: PortalHeader accepts onMenuOpen prop without TypeScript error', () => {
        const { container } = render(
            <PortalHeader onMenuOpen={vi.fn()} />
        );
        expect(container).toBeTruthy();
    });

    it('Test 7: hamburger button has aria-label="Open navigation" and className md:hidden', () => {
        render(<PortalHeader onMenuOpen={vi.fn()} />);
        const hamburger = screen.getByRole('button', { name: 'Open navigation' });
        expect(hamburger).toBeTruthy();
        expect(hamburger.className).toContain('md:hidden');
    });
});
